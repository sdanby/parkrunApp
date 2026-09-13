import sqlite3,psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values
import re, textwrap
from functools import lru_cache
from typing import Optional, Dict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SQL_ROOT = PROJECT_ROOT / 'sql'
SQL_SEARCH_DIRS = (
    Path('pipeline_sections'),
    Path('materialized_views'),
    Path('analytics_queries'),
    Path('one_off_reviews'),
    Path('scratch'),
)

def connections():
    # Connect to the SQLite database
    database_path = 'C:\\Users\\stevi\\flask-backend\\myapp\\parkrun.db'
    # Increase timeout to reduce transient 'database is locked' errors and enable WAL
    conn = sqlite3.connect(database_path, check_same_thread=False, timeout=30)
    try:
        # Prefer WAL mode for better concurrency between readers and writers (especially on Windows)
        conn.execute('PRAGMA journal_mode=WAL;')
        # Use NORMAL synchronous for a balance of performance and durability
        conn.execute('PRAGMA synchronous=NORMAL;')
    except Exception:
        # If pragmas fail for any reason, continue with the connection
        pass
    cursor = conn.cursor()
    render_db_conn = psycopg2.connect(
        host="dpg-cs2r25dsvqrc73dpgdd0-a.frankfurt-postgres.render.com",
        database="parkrundata",
        user="parkrundata_user",
        password="m3UE0JWilwRNS1MBVgN2kr0BnIOVZUmH",
        port="5432"
    )
    render_cursor = render_db_conn.cursor()
    return conn,cursor,render_db_conn,render_cursor
def get_or_insert_event_code(conn, cursor, render_db_conn,render_cursor, parkrun_name):
    parkrun_name = (parkrun_name or '').strip()

    # Prefer existing local event code first (case-insensitive match)
    cursor.execute('SELECT event_code FROM events WHERE LOWER(TRIM(event_name)) = LOWER(?) LIMIT 1', (parkrun_name,))
    existing_local = cursor.fetchone()
    if existing_local:
        event_code = existing_local[0]
        print(f"Found existing local event: {parkrun_name} with event_code: {event_code}.")
        return event_code

    # If missing locally, check Render/Postgres so we reuse its event_code
    render_cursor.execute('SELECT event_code FROM events WHERE LOWER(TRIM(event_name)) = LOWER(%s) LIMIT 1', (parkrun_name,))
    existing_render = render_cursor.fetchone()
    if existing_render:
        event_code = existing_render[0]
        cursor.execute('INSERT OR IGNORE INTO events (event_code, event_name) VALUES (?, ?)', (event_code, parkrun_name))
        conn.commit()
        print(f"Found existing render event: {parkrun_name} with event_code: {event_code}. Synced locally.")
        return event_code

    # New event: allocate a code that is safe across both DBs
    cursor.execute('SELECT MAX(event_code) FROM events;')
    local_max = cursor.fetchone()[0]
    render_cursor.execute('SELECT MAX(event_code) FROM events;')
    render_max = render_cursor.fetchone()[0]

    max_code = max(local_max or 0, render_max or 0)
    event_code = max_code + 1

    # Insert idempotently in both DBs
    cursor.execute('INSERT OR IGNORE INTO events (event_code, event_name) VALUES (?, ?)', (event_code, parkrun_name))
    conn.commit()

    render_cursor.execute('''
        INSERT INTO events (event_code, event_name)
        VALUES (%s, %s)
        ON CONFLICT (event_code) DO NOTHING
    ''', (event_code, parkrun_name))
    render_db_conn.commit()

    print(f"Inserted new event: {parkrun_name} with event_code: {event_code}.")
    return event_code  # Return the event code
def record_exists(cursor, event_code, event_date,dbType):
    """
    Check if a record with the specified event_code and event_date exists in the eventpositions table.

    :param cursor: SQLite cursor object
    :param event_code: The event code to check
    :param event_date: The event date to check
    :return: True if the record exists, False otherwise
    """
    if dbType==1:
        cursor.execute('SELECT * FROM eventpositions WHERE event_code = %s AND event_date = %s;', (event_code, event_date))
    else:
       cursor.execute('SELECT * FROM eventpositions WHERE event_code = ? AND event_date = ?;', (event_code, event_date))
    return len(cursor.fetchall()) > 0  # Ret
def upsert_event_position(cursor, render_cursor, event_code, event_date, position, name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, athlete_code, updateFlag=False):
    """
    Updates an existing record or inserts a new record in both SQLite and PostgreSQL databases.
    
        :param cursor: SQLite cursor object
        :param render_cursor: PostgreSQL cursor object
        :param event_code: The unique event code
        :param event_date: The event date
        :param position: The position in the event
        :param name: The name of the participant
        :param malePos: Male position value
        :param maleCount: Male count value
        :param ageGroup: Age group of the participant
        :param ageGrade: Age grade of the participant
        :param time_: Finish time of the participant
        :param club: Club associated with the participant
        :param comment: Any comments about the participant
        :param athlete_code: The athlete's unique code
        :param updateFlag: If True, updates existing record; if False, inserts new record
        """

    # SQLite Logic
    if updateFlag:
        # Attempt to update the existing record in SQLite
        #print(1)
        cursor.execute('''
        UPDATE eventpositions
        SET name = ?, male_position = ?, male_count = ?, age_group = ?, age_grade = ?, time = ?, club = ?, comment = ?, athlete_code = ?
        WHERE event_code = ? AND event_date = ? AND position = ?;
        ''', (name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, athlete_code, event_code, event_date, position))
        #print(1.1)
    else:
        # Try to perform an INSERT if the record does not already exist in SQLite
        #print(1.4)
        #cursor.execute('BEGIN TRANSACTION;')
        cursor.execute('''
        INSERT OR IGNORE INTO eventpositions (event_code, event_date, position, name, male_position, male_count, age_group, age_grade, time, club, comment, athlete_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        ''', (event_code, event_date, position, name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, athlete_code))
        #print(1.5)

    # PostgreSQL Logic (same logic applied)
    if updateFlag:
        # Attempt to update the existing record in PostgreSQL
        #print(1)
        render_cursor.execute('''
        UPDATE eventpositions
        SET name = %s, male_position = %s, male_count = %s, age_group = %s, age_grade = %s, time = %s, club = %s, comment = %s, athlete_code = %s
        WHERE event_code = %s AND event_date = %s AND position = %s;
        ''', (name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, athlete_code, event_code, event_date, position))
        #print(2)
    else:
        # Try to perform an INSERT if the record does not already exist in PostgreSQL
        #print(3)
        render_cursor.execute('''
        INSERT INTO eventpositions (event_code, event_date, position, name, male_position, male_count, age_group, age_grade, time, club, comment, athlete_code)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (event_code, event_date, position) DO UPDATE
        SET name = excluded.name,male_position = excluded.male_position,male_count = excluded.male_count,age_group = excluded.age_group,
            age_grade = excluded.age_grade,time= excluded.time,club = excluded.club,comment = excluded.comment,athlete_code = excluded.athlete_code;
        ''', (event_code, event_date, position, name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, athlete_code))
        #print(4)
def main_process_function(cursor, render_cursor, collected_data, last_position, event_code, event_date,localStatus,renderStatus):
    """
    Main processing function to handle data collection, CSV writing, and database insertion.

    :param cursor: SQLite cursor object
    :param render_cursor: PostgreSQL cursor object
    :param results_rows: The iterable containing rows to be processed
    :param event_code: The unique event code to be included in every row
    :param event_date: The event date to be included in every row
    :param conn: SQLite connection object for committing changes
    """
    if not localStatus:
        cursor.executemany('''
            INSERT INTO eventpositions (event_code, event_date, position, name, male_position, male_count, 
                                        age_group, age_grade, time, club, comment, athlete_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (event_code, event_date, position) DO UPDATE SET
                name = excluded.name,
                male_position = excluded.male_position,
                male_count = excluded.male_count,
                age_group = excluded.age_group,
                age_grade = excluded.age_grade,
                time = excluded.time,
                club = excluded.club,
                comment = excluded.comment,
                athlete_code = excluded.athlete_code;
        ''', collected_data)
        cursor.connection.commit()
        print(f"Bulk uploaded event code={event_code}; for event date={event_date}; in SQLite DB")

    if not renderStatus:
        insert_query = sql.SQL('''
                INSERT INTO eventpositions (event_code, event_date, position, name, male_position, male_count, 
                                            age_group, age_grade, time, club, comment, athlete_code)
                VALUES %s
                ON CONFLICT (event_code, event_date, position) DO UPDATE SET
                    name = EXCLUDED.name,
                    male_position = EXCLUDED.male_position,
                    male_count = EXCLUDED.male_count,
                    age_group = EXCLUDED.age_group,
                    age_grade = EXCLUDED.age_grade,
                    time = EXCLUDED.time,
                    club = EXCLUDED.club,
                    comment = EXCLUDED.comment,
                    athlete_code = EXCLUDED.athlete_code;
            ''')
        execute_values(render_cursor, insert_query, collected_data)
        render_cursor.connection.commit()
        print(f"Bulk uploaded event code={event_code}; for event date={event_date}; in Render DB")
        return last_position   
def update_athlete_code(cursor, runner_code, event_code, event_date, position):
    """
    Updates the athlete_code for a specific event in the eventpositions table.

    :param cursor: SQLite cursor object
    :param runner_code: The athlete code to set
    :param event_code: The unique event code
    :param event_date: The event date
    :param position: The position in the event
    """
    try:
        # Attempt to update
        cursor.execute('UPDATE eventpositions SET athlete_code = ? WHERE event_code = ? AND event_date = ? AND position = ?;', (runner_code, event_code, event_date, position))
        # Display how many rows were updated
        print(f'Rows updated: {cursor.rowcount}')  # It will still show 0 if no rows match the condition
        # Commit changes
        cursor.connection.commit()  # Make sure to commit through cursor's connection
    except Exception as e:
        print(f"An error occurred during the update: {e}")
def update_parkrun_events(sqlite_cursor,render_cursor,event_code, event_date, last_position,event_number,volunteersNo,parkrunName):
    print(f"{event_code}, {event_date}, {last_position}, {volunteersNo}")
    try:
        # Insert into SQLite
        sqlite_cursor.execute('''
            INSERT INTO parkrun_events (event_code, event_number, event_date, last_position, volunteers)
            VALUES (?, ?, ?, ?,?)
            ON CONFLICT (event_code, event_number) DO UPDATE SET
                event_date = excluded.event_date,
                last_position = excluded.last_position,
                volunteers = excluded.volunteers;
        ''', (event_code, event_number, event_date, last_position, volunteersNo))

        # Insert into PostgreSQL
        render_cursor.execute('''
            INSERT INTO parkrun_events (event_code, event_number, event_date, last_position, volunteers)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (event_code, event_number) DO UPDATE SET 
                event_date = excluded.event_date,
                last_position = excluded.last_position,
                volunteers = excluded.volunteers;
        ''', (event_code, event_number, event_date, last_position, volunteersNo))
    except Exception as e:
        print(f"Error processing event {event_code} ({parkrunName}): {e}")
    # Commit changes to both databases after all inserts
    sqlite_cursor.connection.commit()  # Commit SQLite changes
    render_cursor.connection.commit()    # Commit PostgreSQL changes
def write_to_csv(collected_data, file_name):
    """
    Writes collected data to a CSV file.
    :param collected_data: The list of data to write to CSV
    :param file_name: The filename for the output CSV
    """
    #with open(file_name, mode='w', newline='') as file:
        #writer = csv.writer(file)
        #writer.writerow(['event_code', 'event_date', 'position', 'name', 'male_position', 
        #                 'male_count', 'age_group', 'age_grade', 'time', 'club', 
        #                 'comment', 'athlete_code'])
        #writer.writerows(collected_data)
    #process_row(cursor, render_cursor,columns, event_code, event_date,updateFlag, conn,render_db_conn)
def update_coefficients(sqlite_cursor, render_cursor, coeffs, event_date):
    """
    Update the coefficients for each event_code in the parkrun_events table in both SQLite and PostgreSQL.
    
    :param sqlite_cursor: SQLite cursor object
    :param render_cursor: PostgreSQL cursor object
    :param coeffs: Dictionary of {event_code: coeff} to update
    :param event_date: The event date to filter by
    """
    try:
        # Update coefficients in SQLite
        for event_code, coeff in coeffs.items():
            sqlite_cursor.execute('''
                UPDATE parkrun_events
                SET coeff = ?
                WHERE event_code = ? AND event_date = ?;
            ''', (coeff, event_code, event_date))
            print(f"Updated coefficient for event_code: {event_code} to {coeff} for event date {event_date} in SQLite.")
        
        # Commit changes to SQLite
        sqlite_cursor.connection.commit()

        # Update coefficients in PostgreSQL
        for event_code, coeff in coeffs.items():
            render_cursor.execute('''
                UPDATE parkrun_events
                SET coeff = %s
                WHERE event_code = %s AND event_date = %s;
            ''', (coeff, event_code, event_date))
            print(f"Updated coefficient for event_code: {event_code} to {coeff} for event date {event_date} in PostgreSQL.")
        
        # Commit changes to PostgreSQL
        render_cursor.connection.commit()

        sqlite_cursor.execute('SELECT coeff from parkrun_events WHERE event_code = ? AND event_date = ?', (event_code, event_date))
        print(f"coeff=",{sqlite_cursor.fetchone()})

        print(f"Successfully updated coefficients for event_date: {event_date}")

    except Exception as e:
        print(f"Error updating coefficients: {e}")
        raise
def fetch_coefficients_for_all_events():
    """
    Fetch coefficients for all event_codes and event_dates from the parkrun_events table.
    :return: A dictionary of {event_code: {event_date: coeff}}.
    """
    try:
        # Connect to the database
        conn, cursor, _, _ = connections()

        # Query to fetch coefficients for all event_codes and event_dates
        cursor.execute('''
            SELECT event_code, event_date, coeff
            FROM parkrun_events
        ''')

        # Fetch the results
        rows = cursor.fetchall()

        # Close the database connection
        conn.close()

        # Convert the results into a nested dictionary
        coefficients = {}
        for event_code, event_date, coeff in rows:
            if event_code not in coefficients:
                coefficients[event_code] = {}
            coefficients[event_code][event_date] = coeff

        return coefficients

    except Exception as e:
        print(f"Error fetching coefficients: {e}")
        return {}
def get_most_recent_date_with_coeff_not_one(sqlite_cursor):
    """
    Fetch the most recent event_date where coeff is not equal to 1.
    
    :param sqlite_cursor: SQLite cursor object
    :return: The most recent date as a string (YYYY-MM-DD) or None if no rows match.
    """
    try:
        # Execute the SQL query
        sqlite_cursor.execute('''
            SELECT MAX(DATE(SUBSTR(event_date, 7, 4) || '-' || SUBSTR(event_date, 4, 2) || '-' || SUBSTR(event_date, 1, 2))) AS most_recent_date
            FROM parkrun_events
            WHERE coeff <> 1;
        ''')
        
        # Fetch the result
        result = sqlite_cursor.fetchone()
        
        # Return the most recent date or None if no rows match
        most_recent_date = result[0] if result else None
        print(f"Most recent date with coeff <> 1: {most_recent_date}")
        return most_recent_date

    except Exception as e:
        print(f"Error fetching most recent date: {e}")
        return None
def dedent_sql(s: str) -> str:
    return textwrap.dedent(s).strip()
def with_sql(ctes: list[str], tail_sql: str) -> str:
    return "WITH " + ",\n".join(ctes) + "\n" + dedent_sql(tail_sql)
def debug_sql_render(sql: str, params: dict) -> str:
    # Replace :param with literal values for copy/paste into DB Browser (for debugging only)
    def repl(m):
        key = m.group(1)
        val = params[key]
        if isinstance(val, str):
            return "'" + val.replace("'", "''") + "'"
        return str(val)
    return re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", repl, sql)
def _dedent(s: str) -> str:
    return textwrap.dedent(s).strip()


def resolve_sql_path(filename: str) -> Path:
    path = Path(filename)
    if path.is_absolute():
        return path

    base = PROJECT_ROOT
    candidates = [base / path, SQL_ROOT / path]
    if len(path.parts) == 1:
        candidates.extend(SQL_ROOT / subdir / path for subdir in SQL_SEARCH_DIRS)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[1] if len(candidates) > 1 else candidates[0]


@lru_cache(maxsize=None)
def load_sql_sections(filename: str) -> dict[str, str]:
    text = resolve_sql_path(filename).read_text(encoding="utf-8")
    sections: dict[str, str] = {}
    current = None
    buf: list[str] = []
    for line in text.splitlines():
        # accept '-- @section name' or '-- @section: name' and also '-- @sectionname: name'
        m_start = re.match(r"\s*--\s*@section:??\s*([A-Za-z0-9_]+)\s*$", line)
        m_start_name = re.match(r"\s*--\s*@sectionname:??\s*([A-Za-z0-9_]+)\s*$", line)
        m_end   = re.match(r"\s*--\s*@endsection\s*$", line)
        if m_start or m_start_name:
            name = (m_start.group(1) if m_start else m_start_name.group(1))
            if current:
                sections[current] = _dedent("\n".join(buf)); buf = []
            current = name
        elif m_end:
            if current:
                sections[current] = _dedent("\n".join(buf)); buf = []
                current = None
        elif current:
            buf.append(line)
    if current:  # EOF without @endsection
        sections[current] = _dedent("\n".join(buf))
    return sections
def get_sql(name: str, filename: str = "snippets.sql") -> str:
    return load_sql_sections(filename)[name]
# ...existing code...
def with_sections(names: list[str], tail_name: str, filename: str = "sql/pipeline_sections/SQL.sql") -> str:
    sections = load_sql_sections(filename)
    def strip_semis(s: str) -> str:
        return s.strip().rstrip(";")
    ctes = [strip_semis(sections[n]) for n in names]           # already include "name AS ( ... )"
    tail = strip_semis(sections[tail_name])                    # must be a bare SELECT/UPDATE/etc.
    return "WITH " + ",\n".join(ctes) + "\n" + tail
def debug_sql_render_named(sql: str, params: dict) -> str:
    def q(v):
        if v is None: return "NULL"
        if isinstance(v, (int, float)): return str(v)
        return "'" + str(v).replace("'", "''") + "'"
    return re.sub(r":([A-Za-z_][A-Za-z0-9_]*)",
                  lambda m: q(params.get(m.group(1), m.group(0))),
                  sql)
def flatten_sql(sql: str, params: dict = None) -> str:
    """
    Remove all SQL comments, flatten to a single line, optionally substitute params,
    and remove all occurrences of /'-'/.
    """
    # Remove multi-line comments (/* ... */)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # Remove single-line comments (-- ...)
    sql = re.sub(r'--.*', '', sql)
    # Substitute params if provided
    if params:
        for key, value in params.items():
            if isinstance(value, str):
                value_str = f"'{value}'"
            else:
                value_str = str(value)
            sql = re.sub(rf":{key}\b", value_str, sql)
    # Remove extra whitespace and flatten to one line
    sql = " ".join(sql.split())
    # Remove all occurrences of /'-'/
    sql = sql.replace("\\", "")
    return sql
def get_single_section_sql(section_name: str, filename: str = "sql/pipeline_sections/SQL.sql", single_line: bool = False, silent: bool = False, params: Optional[Dict[str, object]] = None) -> str:
    """
    Load a single SQL section by name, optionally flattening to a single line.

    If `params` is provided, perform named rendering using `debug_sql_render_named`.
    """
    sql = load_sql_sections(filename)[section_name]
    # perform named rendering if params supplied
    if params:
        try:
            sql = debug_sql_render_named(sql, params)
        except Exception:
            # best-effort: if rendering fails, return unrendered sql
            pass
    if single_line:
        sql = " ".join(sql.splitlines())
    return sql


def get_temp_table_sql(name_or_section: str, filename: str = 'sql/pipeline_sections/newSQL.sql', params: Optional[Dict[str, object]] = None, persistent: bool = True, write_file: bool = True, out_dir: str = r"C:\temp", out_filename: str = 'out.sql', execute_conn=None, silent: bool = False) -> str:
    """Generate DROP/CREATE TEMP TABLE and optional INDEX SQL from a section.

    The section should include metadata comments of the form:
      -- @tempTable: tmp_name
      -- @keys: col1, col2

    Behavior:
      - Read the section text from `filename`.
      - Extract the temp table name from `@tempTable` and the keys from `@keys`.
      - Substitute params using `debug_sql_render_named` then produce:
          DROP TABLE IF EXISTS tmp_name;
          CREATE TEMP TABLE tmp_name AS
            <section select statement>;
          CREATE INDEX IF NOT EXISTS idx_tmp_name ON tmp_name(key1, key2);

    If @keys is missing, no index is created.
    """
    sections = load_sql_sections(filename)
    raw = resolve_sql_path(filename).read_text(encoding='utf-8')

    # If caller passed a section name that exists, use it. Otherwise search
    # sections for one that declares @tempTable: <name_or_section> and use that.
    section_name = None
    temp_name = None
    keys = []

    if name_or_section in sections:
        section_name = name_or_section
        # find the raw block for this section
        pattern = rf"(?ms)--\s*@section:?\s*{re.escape(section_name)}\b(.*?)--\s*@endsection\b"
        m = re.search(pattern, raw)
        block = m.group(1) if m else sections[section_name]
        temp_m = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block)
        keys_m = re.search(r"--\s*@keys:\s*(.+)", block)
        temp_name = temp_m.group(1) if temp_m else None
        if keys_m:
            keys = [k.strip() for k in keys_m.group(1).split(',') if k.strip()]
    else:
        # search all section blocks for a @tempTable that matches the provided name
        found = False
        for sm in re.finditer(r"(?ms)--\s*@section:?\s*([A-Za-z0-9_]+)\b(.*?)--\s*@endsection\b", raw):
            sec = sm.group(1)
            block = sm.group(2)
            temp_m = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block)
            if temp_m and temp_m.group(1) == name_or_section:
                section_name = sec
                temp_name = temp_m.group(1)
                keys_m = re.search(r"--\s*@keys:\s*(.+)", block)
                if keys_m:
                    keys = [k.strip() for k in keys_m.group(1).split(',') if k.strip()]
                found = True
                break
        if not found:
            raise KeyError(f"Neither section nor @tempTable named '{name_or_section}' found in {filename}")

    if not temp_name:
        raise ValueError(f"Section '{section_name}' does not declare a @tempTable")

    # Extract the SQL body: start after the @tempTable line and stop at the
    # next metadata marker (@keys, @examples, or @endsection). This prevents
    # example SQL (like 'select * from tmp_...') from being included.
    # The variable `block` is already set above in both branches:
    # - when the caller requested a section name, we extracted the block into `block`
    # - when searching for a matching @tempTable we also captured `block` during iteration
    # Re-searching the raw text by `section_name` here can incorrectly match the first
    # section with the same generic section name (e.g., many sections use '@section: tempTable').
    # So reuse the previously-captured `block` value.
    # (If for some reason `block` isn't set, fall back to searching the file.)
    try:
        block  # exists
    except NameError:
        raw_block_pattern = rf"(?ms)--\s*@section:?\s*{re.escape(section_name)}\b(.*?)--\s*@endsection\b"
        m = re.search(raw_block_pattern, raw)
        block = m.group(1) if m else sections.get(section_name, '')

    # find the @tempTable line within the block and slice after it
    m_temp_line = re.search(r"(?m)^\s*--\s*@tempTable:[^\n]*\n", block)
    if m_temp_line:
        tail = block[m_temp_line.end():]
    else:
        tail = block

    # cut off at the next metadata marker so @examples/@keys are not included
    tail = re.split(r"(?m)^\s*--\s*@(?:keys|examples|endsection)\b", tail)[0]

    # remove any remaining @-meta lines and strip
    body_lines = [ln for ln in tail.splitlines() if not re.match(r"\s*--\s*@", ln)]
    body_sql = "\n".join(body_lines).strip()

    # capture @examples content (if any) from the original block so we can
    # append it to the written preview file later
    examples_m = re.search(r"(?ms)--\s*@examples\b(.*?)(?=(?:--\s*@\w+)|\Z)", block)
    examples_content = examples_m.group(1).strip() if examples_m else ''

    # Substitute params in the body SQL using named rendering
    if params:
        body_sql = debug_sql_render_named(body_sql, params)

    # normalize whitespace: collapse multiple blank lines to one
    body_sql = re.sub(r"\n{2,}", "\n", body_sql)
    # remove any blank lines immediately before FROM/WHERE/JOIN (including LEFT/RIGHT/INNER JOIN)
    body_sql = re.sub(r"\n(?:\s*\n)+\s*(FROM|WHERE|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN)\b", r"\n\1", body_sql, flags=re.IGNORECASE)
    # strip leading indentation on clause lines (e.g., '    FROM' -> 'FROM')
    body_sql = re.sub(r"^[ \t]+(?=(FROM|WHERE|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN)\b)", "", body_sql, flags=re.IGNORECASE | re.MULTILINE)

    # Ensure the CREATE ... AS <select>; has a terminating semicolon
    body_sql = body_sql.rstrip().rstrip(';')

    parts = []
    parts.append(f"DROP TABLE IF EXISTS {temp_name};")
    # for persistent snapshots use CREATE TABLE (no TEMP) per the user's request
    create_kw = 'CREATE TABLE' if persistent else 'CREATE TEMP TABLE'
    # Ensure a space before AS and a terminating semicolon
    parts.append(f"{create_kw} {temp_name} AS\n{body_sql};")
    if keys:
        idx_name = f"idx_{temp_name}"
        key_list = ", ".join(keys)
        parts.append(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {temp_name}({key_list});")
    ddl = "\n".join(parts) + "\n"

    # Optionally write pretty DDL to file for inspection
    if write_file:
        # get pretty_flatten_sql from globals (defined later in this module)
        _pf = globals().get('pretty_flatten_sql')
        if _pf is None:
            # fallback: use a simple preserve-newlines then collapse clauses
            def _pf(x):
                return re.sub(r"\n{2,}", "\n", x)
        pretty = _pf(ddl)
        Path(out_dir).mkdir(parents=True, exist_ok=True)
        out_path = Path(out_dir) / out_filename
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(pretty)
            if examples_content:
                f.write('\n\n')
                # write examples block as-is (trim leading/trailing whitespace)
                f.write(examples_content.strip() + '\n')

    # Optionally execute the DDL using a provided sqlite connection or cursor
    if execute_conn is not None:
        # accept either a connection or a cursor
        exec_conn = getattr(execute_conn, 'connection', execute_conn)
        # if a cursor-like object was passed, try to get .connection
        if hasattr(exec_conn, 'executescript'):
            conn_obj = exec_conn
        else:
            conn_obj = exec_conn
        # run executescript and commit
        conn_obj.executescript(ddl)
        try:
            conn_obj.commit()
        except Exception:
            # if object is a cursor, try to commit via connection
            if hasattr(execute_conn, 'connection'):
                execute_conn.connection.commit()
        # attempt to report row count for the created table
        try:
            count = None
            # prefer executing on a connection object
            conn_for_query = None
            if hasattr(execute_conn, 'cursor'):
                # execute_conn is likely a connection
                conn_for_query = execute_conn
            elif 'conn_obj' in locals() and hasattr(conn_obj, 'execute'):
                conn_for_query = conn_obj
            elif hasattr(execute_conn, 'connection'):
                conn_for_query = execute_conn.connection

            if conn_for_query is not None and hasattr(conn_for_query, 'execute'):
                cur = conn_for_query.execute(f"SELECT COUNT(*) FROM {temp_name};")
                # sqlite returns cursor-like object
                try:
                    count = cur.fetchone()[0]
                except Exception:
                    # sometimes execute returns rows directly
                    try:
                        count = cur[0]
                    except Exception:
                        count = None
            else:
                # fallback: if execute_conn looks like a cursor
                if hasattr(execute_conn, 'execute'):
                    try:
                        execute_conn.execute(f"SELECT COUNT(*) FROM {temp_name};")
                        count = execute_conn.fetchone()[0]
                    except Exception:
                        count = None

            # print single-line progress message (respect `silent`)
            try:
                if not silent:
                    if count is not None:
                        print(f"Updating table {temp_name}... contains {count} rows")
                    else:
                        print(f"Updating table {temp_name}... done")
            except Exception:
                pass
        except Exception:
            # don't fail on counting
            pass
    # Append examples_content to the returned DDL so callers get the tip/select too
    if examples_content:
        ddl = ddl + examples_content.strip() + "\n"
    return ddl


def flatten_sql_preserve_newlines(sql: str, params: dict = None) -> str:
    """Remove SQL comments but preserve original line breaks for readability.

    This is useful when you want a cleaned-up SQL string that remains easy to
    inspect or log because it retains the original paragraph/line structure.
    """
    # Remove multi-line comments (/* ... */)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # Remove single-line comments (-- ...), but keep the newline
    sql = re.sub(r'--.*', '', sql)
    # Substitute params if provided
    if params:
        for key, value in params.items():
            if isinstance(value, str):
                value_str = f"'{value}'"
            else:
                value_str = str(value)
            sql = re.sub(rf":{key}\b", value_str, sql)
    # Normalize trailing whitespace but keep newlines
    lines = [ln.rstrip() for ln in sql.splitlines()]
    return "\n".join(lines).strip()


def pretty_flatten_sql(sql: str, params: dict = None) -> str:
    """Produce a compact, readable SQL string with line breaks before major clauses.

    This function removes comments, optionally substitutes params, and ensures
    keywords like SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, HAVING, LIMIT
    start on their own lines for easier scanning while keeping the SQL compact.
    """
    s = flatten_sql_preserve_newlines(sql, params)
    # Insert a newline before major clause keywords (case-insensitive)
    clauses = [r'\bSELECT\b', r'\bFROM\b', r'\bWHERE\b', r'\bJOIN\b', r'\bLEFT JOIN\b', r'\bRIGHT JOIN\b', r'\bINNER JOIN\b', r'\bGROUP BY\b', r'\bORDER BY\b', r'\bHAVING\b', r'\bLIMIT\b', r'\bUNION\b']
    for c in clauses:
        s = re.sub(c, lambda m: '\n' + m.group(0), s, flags=re.IGNORECASE)
    # Collapse multiple consecutive newlines into a single newline (single-spaced)
    s = re.sub(r'\n{2,}', '\n', s)
    return s.strip()


def get_update_table_sql(name_or_section: str, filename: str = 'sql/pipeline_sections/newSQL.sql', params: Optional[Dict[str, object]] = None, write_file: bool = False, execute_conn=None, out_dir: str = r"C:\temp", out_filename: str = 'out.sql', silent: bool = False) -> str:
    """Generate an UPDATE ... SET ... FROM (subselects) style SQL from an
    -- @section: updateTable block in the given filename.

    Behavior:
      - Scan only sections whose @section name is 'updateTable'.
      - Within that section read @tempTable, @updateTable, @fieldsToUpdate, and @keys.
      - Build an UPDATE that sets each field to COALESCE((SELECT new_<field> FROM <tmp> t WHERE <keys_match>), <updateTable>.<field>)
      - Add a WHERE EXISTS(SELECT 1 FROM <tmp> t WHERE <keys_match>) clause so only matching rows are updated.

    Raises KeyError/ValueError if the named section or expected metadata is missing.
    """
    raw = resolve_sql_path(filename).read_text(encoding='utf-8')
    # find all updateTable sections only
    pattern = r"(?ms)--\s*@section:??\s*updateTable\b(.*?)(?:--\s*@endsection|\Z)"
    for m in re.finditer(pattern, raw):
        block = m.group(1)
        # try to find a @tempTable that matches the requested name_or_section
        temp_m = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block)
        if not temp_m:
            continue
        temp_name = temp_m.group(1)
        if temp_name != name_or_section and name_or_section in [None, '']:
            # caller didn't specify; continue to next
            continue
        if temp_name != name_or_section:
            # not the block we're looking for
            continue

        update_m = re.search(r"--\s*@updateTable:\s*([A-Za-z0-9_]+)", block)
        fields_m = re.search(r"--\s*@fieldsToUpdate:\s*(.+)", block)
        keys_m = re.search(r"--\s*@keys:\s*(.+)", block)
        examples_m = re.search(r"(?ms)--\s*@examples?\b(.*?)(?=(?:--\s*@\w+)|\Z)", block)
        examples_content = examples_m.group(1).strip() if examples_m else ''

        if not update_m:
            raise ValueError("Section 'updateTable' does not declare a @updateTable")
        if not fields_m:
            raise ValueError("Section 'updateTable' does not declare @fieldsToUpdate")
        if not keys_m:
            raise ValueError("Section 'updateTable' does not declare @keys")

        tgt_table = update_m.group(1)
        fields = [f.strip() for f in fields_m.group(1).split(',') if f.strip()]
        keys = [k.strip() for k in keys_m.group(1).split(',') if k.strip()]

        # Build key column names and two WHERE expressions:
        # - `where_inner` references the outer target table explicitly (e.g., athletes.athlete_code = t.athlete_code)
        #    so correlated subselects correctly correlate to the current row.
        # - `where_unqualified` uses unqualified column names (e.g., athlete_code = t.athlete_code)
        #    for contexts where an unqualified reference is required. We will
        #    use unqualified column names on the left-hand side of SET assignments
        #    to satisfy SQLite, but the subselect/EXISTS predicates must refer to
        #    the outer table name so the correlation works.
        cols = [k.split('.')[-1] for k in keys]
        where_unqualified = " AND ".join([f"{c} = t.{c}" for c in cols])
        where_inner = " AND ".join([f"{tgt_table}.{c} = t.{c}" for c in cols])

        # Inspect the SQL file to see if the temp-section defines new_<col> aliases.
        temp_block = None
        for sm2 in re.finditer(r"(?ms)--\s*@section:?\s*([A-Za-z0-9_]+)\b(.*?)--\s*@endsection\b", raw):
            sec2 = sm2.group(1)
            block2 = sm2.group(2)
            tm2 = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block2)
            if tm2 and tm2.group(1) == temp_name:
                temp_block = block2
                break

        new_exists = {}
        for fld in fields:
            col = fld.split('.')[-1]
            if temp_block and re.search(r"\bnew_" + re.escape(col) + r"\b", temp_block):
                new_exists[col] = True
            else:
                new_exists[col] = False

        # If the caller provided an execute_conn and the temp table exists in
        # that connection, prefer inspecting the real table columns instead
        # of relying on the heuristic above. This prevents assuming `new_...`
        # columns that aren't actually present (which causes runtime errors).
        if execute_conn is not None:
            try:
                # get a connection-like object we can run PRAGMA on
                conn_for_info = None
                if hasattr(execute_conn, 'connection') and execute_conn.connection is not None:
                    conn_for_info = execute_conn.connection
                else:
                    conn_for_info = execute_conn

                # run PRAGMA table_info to discover columns in the temp table
                cols_found = None
                if hasattr(conn_for_info, 'execute'):
                    cur = conn_for_info.execute(f"PRAGMA table_info({temp_name});")
                    try:
                        rows = cur.fetchall()
                    except Exception:
                        # cursor-like object sometimes returns rows in different ways
                        rows = []
                    cols_found = [r[1] for r in rows] if rows else []

                if cols_found:
                    for col in list(new_exists.keys()):
                        new_exists[col] = (f"new_{col}" in cols_found)
            except Exception:
                # if anything goes wrong, keep the heuristic result and continue
                pass

        set_clauses = []
        for fld in fields:
            col = fld.split('.')[-1]
            # choose the column name present in the temp table (new_x if available)
            src_col = f"new_{col}" if new_exists.get(col, False) else col
            # selector: correlated subselect must reference the outer table explicitly
            subselect = f"(SELECT {src_col} FROM {temp_name} t WHERE {where_inner} LIMIT 1)"
            # left-hand side uses unqualified column name (SQLite requirement)
            set_clauses.append(f"{col} = COALESCE({subselect}, {col})")

        set_sql = ",\n    ".join(set_clauses)

        sql_out = f"UPDATE {tgt_table}\nSET {set_sql}\nWHERE EXISTS (SELECT 1 FROM {temp_name} t WHERE {where_inner});"
        # apply param rendering if requested
        if params:
            sql_out = debug_sql_render_named(sql_out, params)

        # Optionally write a pretty preview to disk
        if write_file:
            def format_update_sql(src: str) -> str:
                s = src.strip().rstrip(';')
                # split WHERE EXISTS part
                m = re.search(r"(?is)\bWHERE\s+EXISTS\s*\((.*)\)\s*$", s)
                exists_inner = None
                if m:
                    exists_inner = m.group(1).strip()
                    head = s[:m.start()].strip()
                else:
                    head = s

                # format head: expect 'UPDATE <tbl> SET <assignments>'
                head_m = re.match(r"(?is)UPDATE\s+([A-Za-z0-9_\.]+)\s+SET\s*(.*)$", head, flags=re.DOTALL)
                if head_m:
                    tgt = head_m.group(1)
                    assigns = head_m.group(2).strip()
                    # split assignments by top-level commas before next <identifier> =
                    parts = re.split(r",\s*(?=[A-Za-z0-9_\.]+\s*=)", assigns)
                    # normalize each assignment to a single line (collapse internal newlines)
                    parts = [" ".join(p.split()) for p in parts]
                    # rebuild with desired indentation
                    assign_lines = []
                    for i, p in enumerate(parts):
                        comma = ',' if i < len(parts)-1 else ''
                        assign_lines.append('\t' + p + comma)
                    new_head = f"UPDATE {tgt}\nSET \n" + "\n".join(assign_lines)
                else:
                    new_head = head

                if exists_inner is not None:
                    # format inner SELECT into multiple lines with clauses on their own lines
                    inner = exists_inner
                    # put major clauses on their own lines
                    inner = re.sub(r"\bSELECT\b", "SELECT", inner, flags=re.IGNORECASE)
                    clauses = [r'\bSELECT\b', r'\bFROM\b', r'\bWHERE\b', r'\bGROUP BY\b', r'\bORDER BY\b']
                    for c in clauses:
                        inner = re.sub(c, lambda m: '\n' + m.group(0), inner, flags=re.IGNORECASE)
                    # cleanup whitespace
                    inner_lines = [ln.strip() for ln in inner.splitlines() if ln.strip()]
                    inner_pretty = '\n'.join(inner_lines)
                    return new_head + '\nWHERE EXISTS (\n' + inner_pretty + '\n);'
                else:
                    return new_head + ';'

            if sql_out.strip().upper().startswith('UPDATE '):
                pretty = format_update_sql(sql_out)
            else:
                pretty = globals().get('pretty_flatten_sql', flatten_sql_preserve_newlines)(sql_out, params)

            Path(out_dir).mkdir(parents=True, exist_ok=True)
            out_path = Path(out_dir) / out_filename
            try:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(pretty)
                    if examples_content:
                        f.write('\n\n')
                        f.write(examples_content.strip() + '\n')
            except Exception:
                # failure to write preview shouldn't stop execution
                pass

        # Optionally execute the UPDATE using a provided sqlite connection/cursor
        if execute_conn is not None:
            exec_obj = getattr(execute_conn, 'connection', execute_conn)
            try:
                # if it's a connection-like object with executescript, use it
                if hasattr(exec_obj, 'executescript'):
                    exec_obj.executescript(sql_out)
                else:
                    # assume cursor-like
                    exec_obj.execute(sql_out)
                try:
                    exec_obj.commit()
                except Exception:
                    if hasattr(execute_conn, 'connection'):
                        try:
                            execute_conn.connection.commit()
                        except Exception:
                            pass
            except Exception as e:
                # capture the execution error for debugging and include the SQL
                try:
                    if not silent:
                        print(f"Error executing SQL: {e}\nSQL:\n{sql_out}")
                except Exception:
                    # best-effort printing should never raise
                    pass
                # swallow the exception to preserve existing behavior; caller can re-run the returned SQL if desired
                

            # attempt to report row count for the temp table (preferred) or the target
            try:
                count = None
                # try to compute how many rows were updated by the UPDATE we just ran.
                updated_count = None
                try:
                    # some DB-API cursor/connection objects expose `rowcount` after execute
                    if hasattr(exec_obj, 'rowcount'):
                        updated_count = exec_obj.rowcount
                except Exception:
                    updated_count = None
                conn_for_query = None
                if hasattr(execute_conn, 'cursor'):
                    conn_for_query = execute_conn
                elif 'exec_obj' in locals() and hasattr(exec_obj, 'execute'):
                    conn_for_query = exec_obj
                elif hasattr(execute_conn, 'connection'):
                    conn_for_query = execute_conn.connection

                # prefer temp table count
                candidate_tables = [temp_name, tgt_table]
                for tbl in candidate_tables:
                    if not tbl:
                        continue
                    try:
                        if conn_for_query is not None and hasattr(conn_for_query, 'execute'):
                            cur = conn_for_query.execute(f"SELECT COUNT(*) FROM {tbl};")
                            try:
                                count = cur.fetchone()[0]
                            except Exception:
                                try:
                                    count = cur[0]
                                except Exception:
                                    count = None
                        elif hasattr(execute_conn, 'execute'):
                            execute_conn.execute(f"SELECT COUNT(*) FROM {tbl};")
                            try:
                                count = execute_conn.fetchone()[0]
                            except Exception:
                                count = None
                        if count is not None:
                            which = tbl
                            break
                    except Exception:
                        # try next candidate
                        count = None
                        continue

                # If we couldn't get a rowcount via the DB-API, try SQLite-specific changes()
                try:
                    if updated_count is None:
                        # locate a connection-like object to run changes()
                        conn_for_changes = None
                        if hasattr(execute_conn, 'connection') and execute_conn.connection is not None:
                            conn_for_changes = execute_conn.connection
                        elif 'exec_obj' in locals() and hasattr(exec_obj, 'execute'):
                            conn_for_changes = exec_obj
                        elif hasattr(execute_conn, 'execute'):
                            conn_for_changes = execute_conn

                        if conn_for_changes is not None and hasattr(conn_for_changes, 'execute'):
                            try:
                                curc = conn_for_changes.execute("SELECT changes();")
                                try:
                                    updated_count = curc.fetchone()[0]
                                except Exception:
                                    try:
                                        updated_count = curc[0]
                                    except Exception:
                                        updated_count = None
                            except Exception:
                                # fall back to total_changes() if available
                                try:
                                    curc = conn_for_changes.execute("SELECT total_changes();")
                                    updated_count = curc.fetchone()[0]
                                except Exception:
                                    updated_count = None
                except Exception:
                    updated_count = None

                # print single-line progress message (respect `silent`)
                try:
                    if not silent:
                        # prefer the user's preferred wording: "Updating <target> with table <temp>... contains <n> rows"
                        if count is not None:
                            # `which` holds the table we counted (temp or tgt); prefer reporting the target table when possible
                            if which == temp_name:
                                if updated_count is not None:
                                    print(f"Updating {tgt_table} with table {temp_name}... updated {updated_count} rows; contains {count} rows")
                                else:
                                    print(f"Updating {tgt_table} with table {temp_name}... contains {count} rows")
                            else:
                                if updated_count is not None:
                                    print(f"Updating {which}... updated {updated_count} rows; contains {count} rows")
                                else:
                                    print(f"Updating {which}... contains {count} rows")
                        else:
                            if updated_count is not None:
                                print(f"Updating {tgt_table} with table {temp_name}... updated {updated_count} rows")
                            else:
                                print(f"Updating {tgt_table} with table {temp_name}... done")
                except Exception:
                    pass
            except Exception:
                pass

        return sql_out

    raise KeyError(f"No updateTable section declaring @tempTable: {name_or_section} found in {filename}")


def get_update_simple_table(name_or_section: str, filename: str = 'sql/pipeline_sections/newSQL.sql', params: Optional[Dict[str, object]] = None, write_file: bool = False, execute_conn=None, out_dir: str = r"C:\temp", out_filename: str = 'out.sql', silent: bool = False) -> str:
    """Generate and optionally execute a simple UPDATE defined by an
    -- @section: updateSimpleTable block.

    The section should declare @updateTable: <table> and then contain the
    SET / WHERE clauses (i.e. the body of an UPDATE). This function will
    produce:

      UPDATE <table>
      <body>;

    Parameters and preview file behavior are consistent with other helpers.
    """
    raw = resolve_sql_path(filename).read_text(encoding='utf-8')
    pattern = r"(?ms)--\s*@section:??\s*updateSimpleTable\b(.*?)(?:--\s*@endsection|\Z)"

    for m in re.finditer(pattern, raw):
        block = m.group(1)

        # parse metadata within this block
        update_m = re.search(r"--\s*@updateTable:\s*([A-Za-z0-9_]+)", block)
        update_name_m = re.search(r"--\s*@updateTableName:\s*([A-Za-z0-9_]+)", block)
        examples_m = re.search(r"(?ms)--\s*@examples?\b(.*?)(?=(?:--\s*@\w+)|\Z)", block)
        examples_content = examples_m.group(1).strip() if examples_m else ''

        if not update_m:
            # not a usable block
            continue

        tgt_table = update_m.group(1)
        update_name = update_name_m.group(1) if update_name_m else None

        # Allow caller to select block either by @updateTableName (preferred when
        # multiple updates target the same physical table) or by the physical
        # table name. If name_or_section is provided, require a match against
        # the logical name first, otherwise fall back to matching the table.
        if name_or_section:
            if update_name:
                if name_or_section != update_name:
                    continue
            else:
                if name_or_section != tgt_table:
                    continue

        # Extract the SQL body by taking the first contiguous region of lines
        # that does not start with a metadata marker ("-- @..."). Stop the
        # body when the next metadata marker (e.g. "-- @examples") is found.
        lines = block.splitlines()
        start = None
        for i, ln in enumerate(lines):
            if not re.match(r"^\s*--\s*@", ln) and ln.strip() != '':
                start = i
                break
        if start is None:
            body_sql = ''
        else:
            end = len(lines)
            for j in range(start, len(lines)):
                if re.match(r"^\s*--\s*@", lines[j]):
                    end = j
                    break
            body_lines = lines[start:end]
            # remove only metadata comment-lines ("-- @...") within the slice
            body_lines = [ln for ln in body_lines if not re.match(r"^\s*--\s*@", ln)]
            body_sql = "\n".join(body_lines).strip()
        if not body_sql:
            raise ValueError(f"updateSimpleTable for {tgt_table} contains no body")

        sql_out = f"UPDATE {tgt_table}\n{body_sql.strip().rstrip(';')};"
        if params:
            sql_out = debug_sql_render_named(sql_out, params)

        # write preview: preserve the original SQL body and indentation
        if write_file:
            Path(out_dir).mkdir(parents=True, exist_ok=True)
            out_path = Path(out_dir) / out_filename
            try:
                with open(out_path, 'w', encoding='utf-8') as f:
                    # write the SQL exactly as constructed to preserve indentation
                    f.write(sql_out.rstrip() + '\n')
                    if examples_content:
                        f.write('\n')
                        f.write(examples_content.strip() + '\n')
            except Exception:
                pass

        # optional execution
        if execute_conn is not None:
            exec_obj = getattr(execute_conn, 'connection', execute_conn)
            try:
                if hasattr(exec_obj, 'executescript'):
                    exec_obj.executescript(sql_out)
                else:
                    exec_obj.execute(sql_out)
                try:
                    exec_obj.commit()
                except Exception:
                    if hasattr(execute_conn, 'connection'):
                        try:
                            execute_conn.connection.commit()
                        except Exception:
                            pass
            except Exception as e:
                try:
                    if not silent:
                        print(f"Error executing UPDATE SQL: {e}\nSQL:\n{sql_out}")
                except Exception:
                    pass
            else:
                # best-effort report: try to show total rows in the target table
                try:
                    conn_for_query = None
                    if hasattr(execute_conn, 'cursor'):
                        conn_for_query = execute_conn
                    elif 'exec_obj' in locals() and hasattr(exec_obj, 'execute'):
                        conn_for_query = exec_obj
                    elif hasattr(execute_conn, 'connection'):
                        conn_for_query = execute_conn.connection

                    if conn_for_query is not None and hasattr(conn_for_query, 'execute'):
                        cur = conn_for_query.execute(f"SELECT COUNT(*) FROM {tgt_table};")
                        try:
                            count = cur.fetchone()[0]
                        except Exception:
                            try:
                                count = cur[0]
                            except Exception:
                                count = None
                    else:
                        count = None

                    # determine how many rows were updated by the last UPDATE
                    updated_count = None
                    try:
                        if hasattr(exec_obj, 'rowcount'):
                            updated_count = exec_obj.rowcount
                    except Exception:
                        updated_count = None

                    try:
                        if updated_count is None:
                            conn_for_changes = None
                            if hasattr(execute_conn, 'connection') and execute_conn.connection is not None:
                                conn_for_changes = execute_conn.connection
                            elif 'exec_obj' in locals() and hasattr(exec_obj, 'execute'):
                                conn_for_changes = exec_obj
                            elif hasattr(execute_conn, 'execute'):
                                conn_for_changes = execute_conn

                            if conn_for_changes is not None and hasattr(conn_for_changes, 'execute'):
                                try:
                                    curc = conn_for_changes.execute("SELECT changes();")
                                    try:
                                        updated_count = curc.fetchone()[0]
                                    except Exception:
                                        try:
                                            updated_count = curc[0]
                                        except Exception:
                                            updated_count = None
                                except Exception:
                                    try:
                                        curc = conn_for_changes.execute("SELECT total_changes();")
                                        updated_count = curc.fetchone()[0]
                                    except Exception:
                                        updated_count = None
                    except Exception:
                        updated_count = None

                    try:
                        if not silent:
                            if count is not None:
                                if updated_count is not None:
                                    print(f"Updated {tgt_table}... updated {updated_count} rows; contains {count} rows")
                                else:
                                    print(f"Updated {tgt_table}... contains {count} rows")
                            else:
                                if updated_count is not None:
                                    print(f"Updated {tgt_table}... updated {updated_count} rows")
                                else:
                                    print(f"Updated {tgt_table}... done")
                    except Exception:
                        pass
                except Exception:
                    pass

        return sql_out

    raise KeyError(f"No updateSimpleTable section declaring @updateTable: {name_or_section} found in {filename}")


def get_insert_table_sql(name_or_section: str, filename: str = 'sql/pipeline_sections/newSQL.sql', params: Optional[Dict[str, object]] = None, write_file: bool = False, execute_conn=None, out_dir: str = r"C:\temp", out_filename: str = 'out.sql', silent: bool = False) -> str:
    """Generate an INSERT ... SELECT statement from a -- @section: insertTable block.

    Expected metadata in the section:
      -- @tempTable: tmp_name
      -- @updateTable: target_name
      -- @fieldsToInsert: min_dob, max_dob, ...   (these map to new_<field> in tmp)
      -- @keys: athlete_code                      (optional; defaults to ['athlete_code'])
      -- @insertColumns: athlete_code, min_dob, ... (optional explicit target column order)
      -- @include: name,club                       (optional additional non-new columns pulled from tmp)

    Behavior:
      - Build the INSERT column list (either from @insertColumns or from keys + fields + include list).
      - Build the SELECT list mapping fields -> new_<field> and keys/include -> t.<col>.
      - Optionally write a pretty preview and execute against the provided connection.
    """
    raw = resolve_sql_path(filename).read_text(encoding='utf-8')
    pattern = r"(?ms)--\s*@section:??\s*insertTable\b(.*?)(?:--\s*@endsection|\Z)"
    for m in re.finditer(pattern, raw):
        block = m.group(1)
        temp_m = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block)
        if not temp_m:
            continue
        temp_name = temp_m.group(1)
        if temp_name != name_or_section and name_or_section in [None, '']:
            continue
        if temp_name != name_or_section:
            continue

        update_m = re.search(r"--\s*@updateTable:\s*([A-Za-z0-9_]+)", block)
        fields_m = re.search(r"--\s*@fieldsToInsert:\s*(.+)", block)
        keys_m = re.search(r"--\s*@keys:\s*(.+)", block)
        insertcols_m = re.search(r"--\s*@insertColumns:\s*(.+)", block)
        include_m = re.search(r"--\s*@include:\s*(.+)", block)
        examples_m = re.search(r"(?ms)--\s*@examples?\b(.*?)(?=(?:--\s*@\w+)|\Z)", block)
        examples_content = examples_m.group(1).strip() if examples_m else ''

        if not update_m:
            raise ValueError("Section 'insertTable' does not declare a @updateTable")
        if not fields_m:
            raise ValueError("Section 'insertTable' does not declare @fieldsToInsert")

        tgt_table = update_m.group(1)
        fields = [f.strip() for f in fields_m.group(1).split(',') if f.strip()]
        keys = [k.strip() for k in keys_m.group(1).split(',') if k.strip()] if keys_m else ['athlete_code']
        include = [c.strip() for c in include_m.group(1).split(',') if c.strip()] if include_m else []

        if insertcols_m:
            target_cols = [c.strip() for c in insertcols_m.group(1).split(',') if c.strip()]
        else:
            # default order: keys, fields, include
            target_cols = keys + fields + include

        # Inspect the SQL file to see if the temp-section defines new_<col> aliases
        temp_block = None
        for sm2 in re.finditer(r"(?ms)--\s*@section:?\s*([A-Za-z0-9_]+)\b(.*?)--\s*@endsection\b", raw):
            sec2 = sm2.group(1)
            block2 = sm2.group(2)
            tm2 = re.search(r"--\s*@tempTable:\s*([A-Za-z0-9_]+)", block2)
            if tm2 and tm2.group(1) == temp_name:
                temp_block = block2
                break

        # For each target column choose t.new_<col> if it exists in the temp block,
        # otherwise t.<col>.
        new_exists = {}
        for col in target_cols:
            base_col = col.split('.')[-1]
            if temp_block and re.search(r"\bnew_" + re.escape(base_col) + r"\b", temp_block):
                new_exists[base_col] = True
            else:
                new_exists[base_col] = False

        # If an execute connection was provided, prefer to inspect the real
        # temp table columns via PRAGMA table_info and update new_exists so
        # we don't generate t.new_<col> when that column isn't present.
        if execute_conn is not None:
            try:
                conn_for_info = None
                if hasattr(execute_conn, 'connection') and execute_conn.connection is not None:
                    conn_for_info = execute_conn.connection
                else:
                    conn_for_info = execute_conn

                cols_found = None
                if hasattr(conn_for_info, 'execute'):
                    cur = conn_for_info.execute(f"PRAGMA table_info({temp_name});")
                    try:
                        rows = cur.fetchall()
                    except Exception:
                        rows = []
                    cols_found = [r[1] for r in rows] if rows else []

                if cols_found:
                    for base_col in list(new_exists.keys()):
                        new_exists[base_col] = (f"new_{base_col}" in cols_found)
            except Exception:
                # ignore any inspection errors and keep heuristic
                pass

        select_exprs = []
        for col in target_cols:
            base_col = col.split('.')[-1]
            src_col = f"new_{base_col}" if new_exists.get(base_col, False) else base_col
            select_exprs.append(src_col)

        select_list = ", ".join([f"t.{s}" for s in select_exprs])
        cols_list = ", ".join(target_cols)

        # By default select from the provided temp table. To avoid inserting
        # duplicate rows when the temp table contains repeated keys we will
        # create a deduped temp table and select from that when executing.
        dedup_name = f"{temp_name}_dedup"
        sql_insert_from = f"{temp_name} t"
        # dedupe SQL: keep the row with smallest rowid per key (SQLite-friendly)
        key_cols = keys if keys else ['athlete_code']
        key_list = ", ".join(key_cols)
        dedupe_sql = (
            f"DROP TABLE IF EXISTS {dedup_name};\n"
            f"CREATE TEMP TABLE {dedup_name} AS\n"
            f"SELECT * FROM {temp_name} t1 WHERE rowid IN (\n"
            f"  SELECT MIN(rowid) FROM {temp_name} t2 GROUP BY {key_list}\n"
            f");\n"
        )
        # default insert selects from the original temp; when executing we will
        # run the dedupe_sql first and then select from the dedup table to avoid duplicates
        # build a WHERE NOT EXISTS predicate to avoid inserting rows whose keys
        # already exist in the target table (safest for older SQLite versions)
        where_not_exists = ""
        if key_cols:
            preds = " AND ".join([f"x.{k} = t.{k}" for k in key_cols])
            where_not_exists = f"WHERE NOT EXISTS (SELECT 1 FROM {tgt_table} x WHERE {preds})"

        insert_from_dedup = f"INSERT INTO {tgt_table} ({cols_list})\nSELECT {select_list} FROM {dedup_name} t {where_not_exists};"
        # for backward-compatibility return value show the original simple INSERT
        sql_out = f"INSERT INTO {tgt_table} ({cols_list})\nSELECT {select_list} FROM {temp_name} t;"

        # param rendering
        if params:
            sql_out = debug_sql_render_named(sql_out, params)

        # write preview
        if write_file:
            pretty = globals().get('pretty_flatten_sql', flatten_sql_preserve_newlines)(sql_out, params)
            Path(out_dir).mkdir(parents=True, exist_ok=True)
            out_path = Path(out_dir) / out_filename
            try:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(pretty)
                    if examples_content:
                        f.write('\n\n')
                        f.write(examples_content.strip() + '\n')
            except Exception:
                pass

        # optional execution: run dedupe first then the INSERT selecting from dedup
        if execute_conn is not None:
            exec_obj = getattr(execute_conn, 'connection', execute_conn)
            try:
                # run dedupe (safe even if temp has unique rows)
                if hasattr(exec_obj, 'executescript'):
                    exec_obj.executescript(dedupe_sql)
                else:
                    # emulate executescript by executing statements separately
                    for stmt in dedupe_sql.split(';'):
                        s = stmt.strip()
                        if not s:
                            continue
                        exec_obj.execute(s)

                # now perform the INSERT selecting from the dedup table while
                # avoiding rows that already exist in the target table
                if hasattr(exec_obj, 'executescript'):
                    exec_obj.executescript(insert_from_dedup)
                else:
                    exec_obj.execute(insert_from_dedup)

                try:
                    exec_obj.commit()
                except Exception:
                    if hasattr(execute_conn, 'connection'):
                        try:
                            execute_conn.connection.commit()
                        except Exception:
                            pass
            except Exception as e:
                try:
                    if not silent:
                        print(f"Error executing INSERT SQL: {e}\nSQL:\n{sql_out}")
                except Exception:
                    pass

            # report inserted rows (best-effort count from temp table)
            try:
                count = None
                conn_for_query = None
                if hasattr(execute_conn, 'cursor'):
                    conn_for_query = execute_conn
                elif 'exec_obj' in locals() and hasattr(exec_obj, 'execute'):
                    conn_for_query = exec_obj
                elif hasattr(execute_conn, 'connection'):
                    conn_for_query = execute_conn.connection

                if conn_for_query is not None and hasattr(conn_for_query, 'execute'):
                    cur = conn_for_query.execute(f"SELECT COUNT(*) FROM {temp_name};")
                    try:
                        count = cur.fetchone()[0]
                    except Exception:
                        try:
                            count = cur[0]
                        except Exception:
                            count = None
                try:
                    if not silent:
                        if count is not None:
                            print(f"Inserted from {temp_name} into {tgt_table}... contains {count} rows")
                        else:
                            print(f"Inserted from {temp_name} into {tgt_table}... done")
                except Exception:
                    pass
            except Exception:
                pass

        return sql_out

    raise KeyError(f"No insertTable section declaring @tempTable: {name_or_section} found in {filename}")