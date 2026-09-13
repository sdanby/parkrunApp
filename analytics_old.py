from collections import defaultdict

from psycopg2.extras import execute_values

from database import connections, flatten_sql
from analytics import (
    build_CoeffEvents_query,
    build_eligibleAthletes_query,
    build_getEventsDates_query,
    build_timeRatio_query,
    to_dd_mm_yyyy,
)

def run_update_for_eligible_timesOld(last=False):
    """
    For each event_code and each event_number >= 15, calculate appearances and time_ratio for eligible athletes,
    and update eventpositions with these values.
    If last=True, only process the last event_number for each event_code.
    """
    conn, cursor, render_db_conn, render_cursor = connections()
    #last=False
    # Get all event_codes
    cursor.execute("SELECT DISTINCT event_code FROM parkrun_events")
    event_codes = [row[0] for row in cursor.fetchall()]

    for event_code in event_codes:
        if last:
            cursor.execute("SELECT max(event_number) FROM parkrun_events WHERE event_code = ? AND event_number >= 15 and event_number<10000", (event_code,))
            event_numbers = [row[0] for row in cursor.fetchall() if row[0] is not None]
        else:
            cursor.execute("SELECT event_number FROM parkrun_events WHERE event_code = ? AND event_number >= 15 and event_number<10000 ORDER BY event_number", (event_code,))
            event_numbers = [row[0] for row in cursor.fetchall()]

        for event_number in event_numbers:
            print(f"Processing event_code={event_code}, event_number={event_number}")

            sql = """
              WITH selected_range AS (
              SELECT 
                substr(pe1.event_date, 7, 4) || '-' || substr(pe1.event_date, 4, 2) || '-' || substr(pe1.event_date, 1, 2) AS end_date,
                substr(pe2.event_date, 7, 4) || '-' || substr(pe2.event_date, 4, 2) || '-' || substr(pe2.event_date, 1, 2) AS start_date,
                pe1.event_code,
                pe1.event_number AS end_number,
                1.2 AS max_ratio
              FROM parkrun_events pe1
              JOIN parkrun_events pe2  
                ON pe1.event_code = pe2.event_code
               AND pe2.event_number = pe1.event_number - 15
              WHERE pe1.event_code = ? AND pe1.event_number = ?
            ),
            parsed_events AS (
            SELECT ep.event_code,ep.event_date,ep.time,ep.time_seconds,ep.athlete_code,pe.event_number,
                substr(ep.event_date, 7, 4) || '-' || substr(ep.event_date, 4, 2) || '-' || substr(ep.event_date, 1, 2) AS formatted_date
            FROM eventpositions_view ep
            JOIN parkrun_events pe ON ep.event_code = pe.event_code AND ep.event_date = pe.event_date
            JOIN selected_range sr ON pe.event_code = sr.event_code
                AND pe.event_number BETWEEN sr.end_number - 15 AND sr.end_number
            ),
            athlete_stats AS (
                SELECT athlete_code,
                    MIN(time_seconds) AS min_time_seconds,
                    COUNT(*) AS appearances
                FROM parsed_events
                CROSS JOIN selected_range
                WHERE parsed_events.event_code = ?
                AND formatted_date BETWEEN selected_range.start_date AND selected_range.end_date
                GROUP BY athlete_code
                HAVING COUNT(*) > 1
            ),
            ratios AS (
                SELECT pe.formatted_date, pe.athlete_code, pe.time, pe.event_code, pe.event_number, ast.appearances,
                    CAST(pe.time_seconds AS REAL) / ast.min_time_seconds AS time_ratio
                FROM parsed_events pe
                JOIN athlete_stats ast ON pe.athlete_code = ast.athlete_code
                CROSS JOIN selected_range
                WHERE pe.event_code = ?
                AND pe.formatted_date BETWEEN selected_range.start_date AND selected_range.end_date
                AND CAST(pe.time_seconds AS REAL) / ast.min_time_seconds <= 1.2
                AND pe.event_number = ?
            )
            SELECT formatted_date, athlete_code, time, event_code, event_number, appearances, time_ratio
            FROM ratios
            """

            try:
                sql, params = build_timeRatio_query(event_code, event_number)
                fSql = flatten_sql(sql, params)
                cursor.execute(sql, params)
                #cursor.execute(sql, (event_code, event_number, event_code, event_code, event_number))
                rows = cursor.fetchall()

                for row in rows:
                    formatted_date, athlete_code, time, event_code_val, event_number_val, appearances, time_ratio = row
                    if '-' in formatted_date and len(formatted_date) == 10:
                        #event_date = f"{formatted_date[8:10]}/{formatted_date[5:7]}/{formatted_date[0:4]}"
                        event_date = to_dd_mm_yyyy(formatted_date)
                    else:
                        event_date = formatted_date
                    # Update eventpositions with appearances and time_ratio
                    cursor.execute("""
                        UPDATE eventpositions
                        SET appearances = ?, time_ratio = ?
                        WHERE event_code = ? AND event_date = ? AND athlete_code = ?
                    """, (appearances, time_ratio, event_code_val, event_date, athlete_code))
                    #print(f"Updated eventpositions for {event_code_val}, {event_date}, {athlete_code}")
                conn.commit()
            except Exception as e:
                print(f"SQLite error for event_code={event_code}, event_number={event_number}: {e}")
                conn.rollback()
    # --- After all updates, copy all eventpositions to PostgreSQL ---
    print("Copying all updated eventpositions to PostgreSQL...")
    # 1. Fetch all updated rows from SQLite
    cursor.execute("""
        SELECT event_code, event_date, athlete_code, time, appearances, time_ratio
        FROM eventpositions
        WHERE appearances IS NOT NULL OR time_ratio IS NOT NULL
    """)
    all_rows = cursor.fetchall()
    print(f"Fetched {len(all_rows)} rows to copy to PostgreSQL.")

    # If last=True, filter to only the last event_number for each event_code
    if last:
        # Build a mapping of event_code -> max event_number
        cursor.execute("""
            SELECT event_code, MAX(event_number)
            FROM parkrun_events
            GROUP BY event_code
        """)
        last_event_numbers = {row[0]: row[1] for row in cursor.fetchall()}

        # Build a mapping of (event_code, event_date) -> event_number for all_rows
        event_code_date_to_number = {}
        for row in all_rows:
            event_code_val, event_date_val, *_ = row
            cursor.execute(
                "SELECT event_number FROM parkrun_events WHERE event_code = ? AND event_date = ?",
                (event_code_val, event_date_val)
            )
            result = cursor.fetchone()
            if result:
                event_code_date_to_number[(event_code_val, event_date_val)] = result[0]

        # Filter all_rows to only those with the last event_number for each event_code
        filtered_rows = []
        for row in all_rows:
            event_code_val, event_date_val, *_ = row
            event_number = event_code_date_to_number.get((event_code_val, event_date_val))
            if event_number and event_number == last_event_numbers[event_code_val]:
                filtered_rows.append(row)
        all_rows = filtered_rows
        print(f"Filtered to {len(all_rows)} rows for last event_number per event_code.")

 
    # Group all_rows by event_code
    rows_by_event_code = defaultdict(list)
    for row in all_rows:
        event_code_val, event_date_val, athlete_code_val, time_val, appearances_val, time_ratio_val = row
        rows_by_event_code[event_code_val].append((event_code_val, event_date_val, athlete_code_val, time_val, appearances_val, time_ratio_val))

    for event_code, rows in rows_by_event_code.items():
        print(f"Processing event_code {event_code} with {len(rows)} rows...")

        # Create a temp table for this event_code
        render_cursor.execute("""
            CREATE TEMP TABLE tmp_eventpositions_update (
                event_code INTEGER,
                event_date VARCHAR,
                athlete_code INTEGER,
                time VARCHAR,
                appearances INTEGER,
                time_ratio DOUBLE PRECISION
            ) ON COMMIT DROP;
        """)

        # Bulk insert for this event_code

        insert_sql = """
            INSERT INTO tmp_eventpositions_update (event_code, event_date, athlete_code, time, appearances, time_ratio)
            VALUES %s
        """
        execute_values(render_cursor, insert_sql, rows)
        print(f"Inserted {len(rows)} rows into tmp_eventpositions_update for event_code {event_code}.")

        # Update eventpositions for this event_code
        render_cursor.execute("""
            UPDATE eventpositions ep
            SET appearances = tmp.appearances,
                time_ratio = tmp.time_ratio
            FROM tmp_eventpositions_update tmp
            WHERE ep.event_code = tmp.event_code
            AND ep.event_date = tmp.event_date
            AND ep.athlete_code = tmp.athlete_code::VARCHAR
            AND ep.time = tmp.time
        """)
        render_db_conn.commit()
        print(f"Updated eventpositions for event_code {event_code}.")

    print("All eligible times copied to PostgreSQL by event_code.")

    conn.close()
    render_db_conn.close()
def update_coeff_event_for_all_weeks():
    """
    Iterates over all event weeks, builds eligible_summary for each 15-week window,
    calculates median_ratio for each event_code, and updates parkrun_events.
    If last=True, only process the last (maximum) week.
    """
    conn, cursor, *_ = connections()
    earliest_date=None

    # 1. Get all event weeks (dates) in order
    sql, params = build_getEventsDates_query()
    cursor.execute(sql, params)
    all_weeks = [row[0] for row in cursor.fetchall()]
    total_weeks = len(all_weeks)

    # 2. Iterate over each possible window
    week_indices = range(total_weeks)
    for i in reversed(week_indices):
        end_date = all_weeks[i]
        # Check if coeff_event is already set for this week
        sDate=to_dd_mm_yyyy(end_date)
        cursor.execute("SELECT COUNT(coeff_event) FROM parkrun_events WHERE event_date = ?", (sDate,))
        count = cursor.fetchone()[0]
        if count == 0:
            earliest_date = end_date
            start_date = all_weeks[max(0, i-14)]  # Use up to 15 weeks, fewer at the start
            print(f"Processing window: {start_date} to {end_date}")

            # 3. Build eligible_summary temp table for this window
            cursor.execute("DROP TABLE IF EXISTS eligible_summary")
            sql, params = build_eligibleAthletes_query(start_date, end_date)
            full_sql = f"CREATE TEMP TABLE eligible_summary AS {sql}"
            fSql = flatten_sql(sql, params)
            cursor.execute(full_sql, params)

            # 4. For each event_code in this window, calculate median_ratio and update parkrun_events
            sql, params = build_CoeffEvents_query()
            cursor.execute(sql, params)
            median_rows = cursor.fetchall()

            # 5. Update parkrun_events for each event_code at end_date
            for event_code, median_ratio in median_rows:
                cursor.execute("""
                    UPDATE parkrun_events
                    SET coeff_event = ?
                    WHERE event_code = ? AND substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = ?
                """, (median_ratio, event_code, end_date))
            # Commit the updates for this week
            conn.commit()
            print(f"Updated coeff_event for {len(median_rows)} event_codes on {end_date}")
        else:
            print(f"Found coeff_event for {end_date}, stopping further processing.")
            break

    conn.close()
    print("All windows processed.")
    return earliest_date
def update_avg_time_for_events(last=False):
    """
    Update avg_time, avgTimeLim12, and avgTimeLim5 in parkrun_events.
    If last=True, only update the last event_date per event_code.
    This function calculates the average time for each event_code and event_date
    from eventpositions, and updates parkrun_events accordingly.
    """
    try:
        conn, sqlite_cursor, render_db_conn, render_cursor = connections()

        if last:
            # Update only the last event per event_code in SQLite
            sqlite_cursor.execute("""
                SELECT event_code, MAX(event_number) as max_event_number
                FROM parkrun_events
                GROUP BY event_code
            """)
            last_event_numbers = {row[0]: row[1] for row in sqlite_cursor.fetchall()}

            for event_code, event_number in last_event_numbers.items():
                sqlite_cursor.execute("""
                    UPDATE parkrun_events
                    SET avg_time = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                    ),
                    avgTimeLim12 = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                          AND time_ratio < 1.12
                    ),
                    avgTimeLim5 = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                          AND time_ratio < 1.05
                    )
                    WHERE event_code = ? AND event_number = ?;
                """, (event_code, event_number))
            conn.commit()
            print("SQLite: avg_time, avgTimeLim12, avgTimeLim5 updated for last event per event_code.")

            # --- Bulk copy to PostgreSQL ---
            sqlite_cursor.execute("""
                SELECT event_code, event_date, avg_time, avgTimeLim12, avgTimeLim5
                FROM parkrun_events
                WHERE (event_code, event_number) IN (
                    SELECT event_code, MAX(event_number)
                    FROM parkrun_events
                    GROUP BY event_code
                )
            """)
            all_rows = sqlite_cursor.fetchall()

            # Bulk insert and update in PostgreSQL
            render_cursor.execute("""
                CREATE TEMP TABLE tmp_parkrun_events_update (
                    event_code INTEGER,
                    event_date VARCHAR,
                    avg_time DOUBLE PRECISION,
                    avgTimeLim12 DOUBLE PRECISION,
                    avgTimeLim5 DOUBLE PRECISION
                ) ON COMMIT DROP;
            """)
            insert_sql = """
                INSERT INTO tmp_parkrun_events_update (event_code, event_date, avg_time, avgTimeLim12, avgTimeLim5)
                VALUES %s
            """
            execute_values(render_cursor, insert_sql, all_rows)
            render_cursor.execute("""
                UPDATE parkrun_events pe
                SET avg_time = tmp.avg_time,
                    avgTimeLim12 = tmp.avgTimeLim12,
                    avgTimeLim5 = tmp.avgTimeLim5
                FROM tmp_parkrun_events_update tmp
                WHERE pe.event_code = tmp.event_code
                  AND pe.event_date = tmp.event_date
            """)
            render_db_conn.commit()
            print("PostgreSQL: avg_time, avgTimeLim12, avgTimeLim5 updated for last event per event_code.")

        else:
            # --- SQLite update for all rows ---
            sqlite_cursor.execute("""
                UPDATE parkrun_events
                    SET avg_time = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                    ),
                    avgTimeLim12 = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                          AND time_ratio < 1.12
                    ),
                    avgTimeLim5 = (
                        SELECT AVG(time_seconds)
                        FROM eventpositions_view
                        WHERE eventpositions_view.event_code = parkrun_events.event_code
                          AND eventpositions_view.event_date = parkrun_events.event_date
                          AND time_seconds IS NOT NULL
                          AND time_ratio < 1.05
                    );
            """)
            conn.commit()
            print("SQLite: avg_time, avgTimeLim12, avgTimeLim5 updated for all rows in parkrun_events.")

            # --- Bulk copy to PostgreSQL ---
            sqlite_cursor.execute("""
                SELECT event_code, event_date, avg_time, avgTimeLim12, avgTimeLim5
                FROM parkrun_events
                WHERE avg_time IS NOT NULL OR avgTimeLim12 IS NOT NULL OR avgTimeLim5 IS NOT NULL
            """)
            all_rows = sqlite_cursor.fetchall()

            render_cursor.execute("""
                CREATE TEMP TABLE tmp_parkrun_events_update (
                    event_code INTEGER,
                    event_date VARCHAR,
                    avg_time DOUBLE PRECISION,
                    avgTimeLim12 DOUBLE PRECISION,
                    avgTimeLim5 DOUBLE PRECISION
                ) ON COMMIT DROP;
            """)
            insert_sql = """
                INSERT INTO tmp_parkrun_events_update (event_code, event_date, avg_time, avgTimeLim12, avgTimeLim5)
                VALUES %s
            """
            execute_values(render_cursor, insert_sql, all_rows)
            render_cursor.execute("""
                UPDATE parkrun_events pe
                SET avg_time = tmp.avg_time,
                    avgTimeLim12 = tmp.avgTimeLim12,
                    avgTimeLim5 = tmp.avgTimeLim5
                FROM tmp_parkrun_events_update tmp
                WHERE pe.event_code = tmp.event_code
                AND pe.event_date = tmp.event_date
            """)
            render_db_conn.commit()
            print("PostgreSQL: avg_time, avgTimeLim12, avgTimeLim5 updated for all rows in parkrun_events.")

        conn.close()
        render_db_conn.close()
    except Exception as e:
        print(f"Error updating avg_time: {e}")
