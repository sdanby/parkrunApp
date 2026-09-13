from asyncio import run
import itertools
from flask import Flask, jsonify, request
import os
import csv
from etl.analytics import copy_table_to_postgres
from scripts.database_helpers import connections, update_coefficients, with_sections, flatten_sql, debug_sql_render_named, get_single_section_sql, flatten_sql_preserve_newlines, pretty_flatten_sql,get_temp_table_sql,get_update_table_sql,get_insert_table_sql,get_update_simple_table
from datetime import datetime, timedelta
from time import perf_counter
import math
# track last processing time for progress logging
_last_process_time = None
import numpy as np  # Import numpy for numerical calculations
from collections import defaultdict
from psycopg2.extras import execute_values, execute_batch
from etl.analytics import copy_athletes_to_postgres
from scripts.scraper_tools import create_webdriver


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETL_ROOT = os.path.dirname(os.path.abspath(__file__))


CURVE_EVENTPOSITION_COLUMNS = [
    ("event_rank_b", "NUMERIC(6,1)"),
    ("event_rank_e", "NUMERIC(6,1)"),
    ("event_rank_es", "NUMERIC(6,1)"),
    ("event_rank_ae", "NUMERIC(6,1)"),
    ("event_rank_aes", "NUMERIC(6,1)"),
    ("best_curve_ranking_current", "INTEGER"),
    ("best_curve_ranking_historic", "INTEGER"),
    ("best_curve_ranking_current_type", "TEXT"),
]

CURVE_TIME_RANK_REFERENCE_DEFAULT_X = 27.5
CURVE_TIME_RANK_REFERENCE_DEFAULT_START_SEC = (12 * 60 + 30)
CURVE_TIME_RANK_REFERENCE_DEFAULT_END_SEC = (59 * 60 + 59)
CURVE_TIME_RANK_REFERENCE_DEFAULT_MIN_APPEARANCES = 10


def _run_curved_ranks_for_weekly_update(
    current_date: str,
    event_code: int = None,
    rolling_rebuild_weeks: int = 3,
    run_stage1: bool = True,
    resume_from_all_history: bool = False,
):
    import importlib.util

    module_path = os.path.join(ETL_ROOT, "curved_ranks.py")
    if not os.path.exists(module_path):
        raise FileNotFoundError(f"curved_ranks.py not found at {module_path}")

    spec = importlib.util.spec_from_file_location("curved_ranks_runtime", module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module spec from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    fn = getattr(module, "run_curved_ranks_for_weekly_update", None)
    if fn is None:
        raise AttributeError("run_curved_ranks_for_weekly_update not found in curved_ranks.py")

    return fn(
        current_date=current_date,
        event_code=event_code,
        rolling_rebuild_weeks=rolling_rebuild_weeks,
        run_stage1=run_stage1,
        resume_from_all_history=resume_from_all_history,
    )


def _run_curve_rank_range_summary_upload(snapshot_date: str = None):
    """Build curve_rank_range_summary from SQLite and upload to Postgres."""
    import importlib.util

    module_path = os.path.join(PROJECT_ROOT, "scripts", "build_curve_rank_range_summary.py")
    if not os.path.exists(module_path):
        raise FileNotFoundError(f"build_curve_rank_range_summary.py not found at {module_path}")

    spec = importlib.util.spec_from_file_location("curve_rank_range_summary_runtime", module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module spec from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Reuse the script internals directly to avoid shelling out and to keep
    # this step inside the same weekly pipeline transaction flow.
    conn, cursor, render_db_conn, render_cursor = module.connections()
    try:
        resolved_snapshot = snapshot_date
        if not resolved_snapshot:
            resolved_snapshot = module._latest_snapshot(cursor)
        if not resolved_snapshot:
            raise RuntimeError("No snapshot_date found in curve_rank_mapping_history.")

        rows = module._fetch_summary_rows(cursor, resolved_snapshot)
        if not rows:
            print(f"[curve_rank_range_summary] no rows for snapshot {resolved_snapshot}; skipping upload")
            return 0

        # Best effort persist in local SQLite (may be locked by other process).
        wrote_sqlite_summary = False
        try:
            module._build_summary(cursor, resolved_snapshot)
            conn.commit()
            wrote_sqlite_summary = True
        except Exception as exc:
            if "database is locked" in str(exc).lower():
                try:
                    conn.rollback()
                except Exception:
                    pass
                print("[curve_rank_range_summary] SQLite write locked; continuing with direct Postgres upsert")
            else:
                raise

        module._ensure_postgres_table(render_cursor, render_db_conn)
        uploaded = module._upsert_summary_rows_postgres(render_cursor, render_db_conn, rows)

        if wrote_sqlite_summary:
            print(
                f"[curve_rank_range_summary] built+uploaded {uploaded} rows for snapshot {resolved_snapshot}"
            )
        else:
            print(
                f"[curve_rank_range_summary] uploaded {uploaded} rows for snapshot {resolved_snapshot} (in-memory summary)"
            )
        return uploaded
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            render_cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass


def _run_eventpositions_sync_from_curve_history_one_off(
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
    copy_to_postgres: bool = True,
):
    import importlib.util

    module_path = os.path.join(ETL_ROOT, "curved_ranks.py")
    if not os.path.exists(module_path):
        raise FileNotFoundError(f"curved_ranks.py not found at {module_path}")

    spec = importlib.util.spec_from_file_location("curved_ranks_runtime", module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module spec from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    fn = getattr(module, "run_eventpositions_sync_from_curve_history_one_off", None)
    if fn is None:
        raise AttributeError("run_eventpositions_sync_from_curve_history_one_off not found in curved_ranks.py")

    return fn(
        start_date=start_date,
        end_date=end_date,
        event_code=event_code,
        copy_to_postgres=copy_to_postgres,
    )


def run_curve_eventpositions_sync_from_history_one_off(
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
    copy_to_postgres: bool = True,
):
    """
    One-off utility exposed in newAnalytics to sync eventpositions curve columns
    from curve_athlete_best_rank_history and optionally push to Postgres.
    """
    started = _timing_start()
    print(
        "run_curve_eventpositions_sync_from_history_one_off: "
        f"start_date={start_date}, end_date={end_date}, event_code={event_code}, "
        f"copy_to_postgres={copy_to_postgres}"
    )
    rows_changed = _run_eventpositions_sync_from_curve_history_one_off(
        start_date=start_date,
        end_date=end_date,
        event_code=event_code,
        copy_to_postgres=copy_to_postgres,
    )
    print(f"run_curve_eventpositions_sync_from_history_one_off: rows_changed={rows_changed}")
    _timing_log("curve.run_curve_eventpositions_sync_from_history_one_off.total", started)
    return rows_changed

def _format_indexdef_with_if_not_exists(indexdef: str) -> str:
    if not indexdef:
        return ""
    if "CREATE UNIQUE INDEX " in indexdef:
        return indexdef.replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ", 1)
    if "CREATE INDEX " in indexdef:
        return indexdef.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", 1)
    return indexdef

def backup_materialized_views_sql(render_cursor, out_dir: str = r"C:\temp\parkrun_mv_backups", schema: str = "public", save_version_history: bool = True) -> str:
    """Back up materialized view SQL definitions, owners, and indexes.

    Writes:
      - latest snapshot: materialized_views_latest.sql
      - optional historical snapshots: materialized_views_YYYYMMDD_HHMMSS.sql
        and per-view files under a timestamped folder.
    """
    os.makedirs(out_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    render_cursor.execute(
        """
        SELECT
            m.schemaname,
            m.matviewname,
            pg_get_userbyid(c.relowner) AS owner,
            pg_get_viewdef(c.oid, true) AS definition
        FROM pg_matviews m
        JOIN pg_namespace n
          ON n.nspname = m.schemaname
        JOIN pg_class c
          ON c.relname = m.matviewname
         AND c.relnamespace = n.oid
        WHERE m.schemaname = %s
        ORDER BY m.matviewname
        """,
        (schema,),
    )
    rows = render_cursor.fetchall() or []

    if not rows:
        print(f"[mv-backup] no materialized views found for schema '{schema}'")
        return ""

    version_dir = os.path.join(out_dir, f"materialized_views_{timestamp}")
    if save_version_history:
        os.makedirs(version_dir, exist_ok=True)

    combined_sections = []
    for schemaname, matviewname, owner, definition in rows:
        render_cursor.execute(
            """
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = %s
              AND tablename = %s
            ORDER BY indexname
            """,
            (schemaname, matviewname),
        )
        index_rows = render_cursor.fetchall() or []
        index_ddls = [
            _format_indexdef_with_if_not_exists(idx_def)
            for (idx_def,) in index_rows
            if idx_def
        ]

        owner_clause = f"ALTER TABLE IF EXISTS {schemaname}.{matviewname} OWNER TO {owner};" if owner else ""
        ddl = (
            f"-- Materialized View: {schemaname}.{matviewname}\n"
            f"CREATE MATERIALIZED VIEW IF NOT EXISTS {schemaname}.{matviewname} AS\n"
            f"{definition}\n"
            f"WITH DATA;\n\n"
            f"{owner_clause}\n"
        )
        if index_ddls:
            ddl += "\n" + ";\n\n".join(index_ddls) + ";\n"

        combined_sections.append(ddl)

        if save_version_history:
            per_view_path = os.path.join(version_dir, f"{matviewname}.sql")
            with open(per_view_path, "w", encoding="utf-8") as f:
                f.write(ddl)

    combined_sql = "\n\n".join(combined_sections)
    latest_path = os.path.join(out_dir, "materialized_views_latest.sql")
    with open(latest_path, "w", encoding="utf-8") as f:
        f.write(combined_sql)

    if save_version_history:
        version_file = os.path.join(out_dir, f"materialized_views_{timestamp}.sql")
        with open(version_file, "w", encoding="utf-8") as f:
            f.write(combined_sql)

    print(
        f"[mv-backup] saved {len(rows)} materialized view definitions to {latest_path}"
        + (f" and {version_dir}" if save_version_history else "")
    )
    return latest_path

def write_pretty_sql_to_file(sql: str, out_dir: str = r"C:\temp", filename: str = 'out.sql') -> None:
    """Pretty-format SQL and write to disk for inspection.

    Example: write_pretty_sql_to_file(sql)
    """
    pretty = pretty_flatten_sql(sql)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, filename)
    try:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(pretty)
    except Exception as e:
        print(f"Could not write SQL preview to {out_path}: {e}")

def _timing_start():
    return perf_counter()

def _timing_log(label: str, started_at: float):
    elapsed = perf_counter() - started_at
    print(f"[timing] {label}: {elapsed:.2f}s")
    return elapsed

def _sqlite_has_function(sqlite_conn, call_sql: str) -> bool:
    cur = None
    try:
        cur = sqlite_conn.cursor()
        cur.execute(call_sql)
        cur.fetchone()
        return True
    except Exception:
        return False
    finally:
        try:
            if cur is not None:
                cur.close()
        except Exception:
            pass

def _ensure_sqlite_math_functions(sqlite_conn):
    to_register = []
    if not _sqlite_has_function(sqlite_conn, "SELECT FLOOR(1.5)"):
        to_register.append(("FLOOR", 1, lambda x: None if x is None else math.floor(float(x))))
    if not _sqlite_has_function(sqlite_conn, "SELECT LN(2.0)"):
        to_register.append(("LN", 1, lambda x: None if x is None or float(x) <= 0 else math.log(float(x))))
    if not _sqlite_has_function(sqlite_conn, "SELECT POWER(2.0, 3.0)"):
        to_register.append(("POWER", 2, lambda x, y: None if x is None or y is None else math.pow(float(x), float(y))))

    if not to_register:
        print("[curve] sqlite math functions already available (FLOOR/LN/POWER).")
        return

    for fn_name, arg_count, fn_callable in to_register:
        try:
            sqlite_conn.create_function(fn_name, arg_count, fn_callable)
            print(f"[curve] registered sqlite function: {fn_name}/{arg_count}")
        except Exception as e:
            print(f"[curve] warning: could not register sqlite function {fn_name}/{arg_count}: {e}")


def _ensure_curve_time_rank_reference_table(sqlite_conn):
    cur = sqlite_conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_time_rank_reference (
            snapshot_date TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            second INTEGER NOT NULL,
            time TEXT NOT NULL,
            linear_rank REAL,
            curved_rank REAL,
            x_value REAL NOT NULL,
            start_sec INTEGER NOT NULL,
            end_sec INTEGER NOT NULL,
            min_appearances INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (snapshot_date, metric_type, second)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_time_rank_reference_snapshot ON curve_time_rank_reference(snapshot_date, metric_type, second)"
    )
    sqlite_conn.commit()
    cur.close()


def build_curve_time_rank_reference_for_date(
    sqlite_conn,
    snapshot_date: str,
    x_value: float = CURVE_TIME_RANK_REFERENCE_DEFAULT_X,
    start_sec: int = CURVE_TIME_RANK_REFERENCE_DEFAULT_START_SEC,
    end_sec: int = CURVE_TIME_RANK_REFERENCE_DEFAULT_END_SEC,
    min_appearances: int = CURVE_TIME_RANK_REFERENCE_DEFAULT_MIN_APPEARANCES,
) -> int:
    started = _timing_start()
    _ensure_sqlite_math_functions(sqlite_conn)
    _ensure_curve_time_rank_reference_table(sqlite_conn)

    cur = sqlite_conn.cursor()
    params = {
        "snapshot_date": snapshot_date,
        "x_value": float(x_value),
        "start_sec": int(start_sec),
        "end_sec": int(end_sec),
        "min_appearances": int(min_appearances),
    }

    cur.execute(
        "DELETE FROM curve_time_rank_reference WHERE snapshot_date = :snapshot_date",
        {"snapshot_date": snapshot_date},
    )

    cur.execute(
        """
        INSERT OR REPLACE INTO curve_time_rank_reference (
            snapshot_date,
            metric_type,
            second,
            time,
            linear_rank,
            curved_rank,
            x_value,
            start_sec,
            end_sec,
            min_appearances
        )
        WITH RECURSIVE
        params AS (
            SELECT
                CAST(:x_value AS REAL) AS x,
                CAST(:start_sec AS INTEGER) AS start_sec,
                CAST(:end_sec AS INTEGER) AS end_sec,
                CAST(:min_appearances AS INTEGER) AS min_appearances
        ),
        metric_types(metric_type) AS (
            VALUES ('B'), ('E'), ('AE'), ('ES'), ('AES')
        ),
        series(metric_seconds) AS (
            SELECT start_sec FROM params
            UNION ALL
            SELECT metric_seconds + 1
            FROM series, params
            WHERE metric_seconds < params.end_sec
        ),
        eligible_athletes AS (
            SELECT
                c.athlete_code
            FROM curve_run_metrics_history c
            WHERE c.metric_type = 'B'
              AND c.metric_seconds IS NOT NULL
              AND c.formatted_date <= :snapshot_date
            GROUP BY c.athlete_code
            HAVING COUNT(DISTINCT c.event_code || '|' || c.event_date) >= (SELECT min_appearances FROM params)
        ),
        ranked AS (
            SELECT
                c.metric_type,
                CAST(c.metric_seconds AS INTEGER) AS metric_seconds,
                (1.0 - PERCENT_RANK() OVER (
                    PARTITION BY c.metric_type
                    ORDER BY CAST(c.metric_seconds AS INTEGER) ASC
                )) * 100.0 AS linear_rank
            FROM curve_run_metrics_history c
            JOIN eligible_athletes ea
              ON ea.athlete_code = c.athlete_code
            WHERE c.metric_type IN ('B', 'E', 'AE', 'ES', 'AES')
              AND c.metric_seconds IS NOT NULL
              AND c.formatted_date <= :snapshot_date
        ),
        curved AS (
            SELECT
                r.metric_type,
                r.metric_seconds,
                r.linear_rank,
                (POWER(2.718281828459045, (r.linear_rank / p.x)) - 1.0) * 100.0
                    / (POWER(2.718281828459045, (100.0 / p.x)) - 1.0) AS curved_rank
            FROM ranked r
            CROSS JOIN params p
        ),
        anchors AS (
            SELECT
                metric_type,
                metric_seconds,
                MAX(linear_rank) AS linear_rank,
                MAX(curved_rank) AS curved_rank
            FROM curved
            GROUP BY metric_type, metric_seconds
        ),
        grid AS (
            SELECT
                t.metric_type,
                s.metric_seconds
            FROM metric_types t
            CROSS JOIN series s
        ),
        joined AS (
            SELECT
                g.metric_type,
                g.metric_seconds,
                a.linear_rank,
                a.curved_rank
            FROM grid g
            LEFT JOIN anchors a
              ON a.metric_type = g.metric_type
             AND a.metric_seconds = g.metric_seconds
        ),
        neighbors AS (
            SELECT
                j.*,
                MAX(CASE WHEN j.linear_rank IS NOT NULL THEN j.metric_seconds END) OVER (
                    PARTITION BY j.metric_type
                    ORDER BY j.metric_seconds
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS prev_sec,
                MIN(CASE WHEN j.linear_rank IS NOT NULL THEN j.metric_seconds END) OVER (
                    PARTITION BY j.metric_type
                    ORDER BY j.metric_seconds
                    ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
                ) AS next_sec
            FROM joined j
        ),
        interp AS (
            SELECT
                n.metric_type,
                n.metric_seconds,
                n.prev_sec,
                n.next_sec,
                p.linear_rank AS prev_linear,
                nx.linear_rank AS next_linear,
                p.curved_rank AS prev_curved,
                nx.curved_rank AS next_curved
            FROM neighbors n
            LEFT JOIN anchors p
              ON p.metric_type = n.metric_type
             AND p.metric_seconds = n.prev_sec
            LEFT JOIN anchors nx
              ON nx.metric_type = n.metric_type
             AND nx.metric_seconds = n.next_sec
        ),
        filled AS (
            SELECT
                metric_type,
                metric_seconds,
                CASE
                    WHEN prev_sec IS NULL THEN next_linear
                    WHEN next_sec IS NULL THEN prev_linear
                    WHEN prev_sec = next_sec THEN prev_linear
                    ELSE prev_linear + (next_linear - prev_linear) * 1.0
                        * (metric_seconds - prev_sec) / (next_sec - prev_sec)
                END AS linear_rank,
                CASE
                    WHEN prev_sec IS NULL THEN next_curved
                    WHEN next_sec IS NULL THEN prev_curved
                    WHEN prev_sec = next_sec THEN prev_curved
                    ELSE prev_curved + (next_curved - prev_curved) * 1.0
                        * (metric_seconds - prev_sec) / (next_sec - prev_sec)
                END AS curved_rank
            FROM interp
        )
        SELECT
            :snapshot_date,
            metric_type,
            metric_seconds,
            printf('%02d:%02d', metric_seconds / 60, metric_seconds % 60) AS time,
            ROUND(linear_rank, 1),
            ROUND(curved_rank, 1),
            :x_value,
            :start_sec,
            :end_sec,
            :min_appearances
        FROM filled
        """,
        params,
    )

    sqlite_conn.commit()
    cur.execute(
        "SELECT COUNT(*) FROM curve_time_rank_reference WHERE snapshot_date = :snapshot_date",
        {"snapshot_date": snapshot_date},
    )
    row_count = int(cur.fetchone()[0] or 0)
    cur.close()
    _timing_log(f"curve_time_rank_reference.build ({snapshot_date})", started)
    print(f"[curve] curve_time_rank_reference rows for {snapshot_date}={row_count}")
    return row_count

def process_event_sections(event_code: int, formatted_date: str,   sqlite_cursor, render_cursor,period: int=15,all_athletes=all):
    """Placeholder for the sequence of per-event SQL/processing to run.

    Replace or extend this with calls to the named SQL sections you want executed
    for each (event_code, formatted_date).
    """
    # Example placeholder - you will replace this with the actual sequence
    print(f"Processing event_code={event_code}, formatted_date={formatted_date}, period={period}, all_athletes={all_athletes}")
    params = {'event_code': event_code, 'formatted_date': formatted_date, 'period': period}

    # generate, write and execute DDL in one call (creates persistent table)
    ddl = get_temp_table_sql('tmp_selected_eventRange',  write_file=True,params=params, execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_endDate',  write_file=True, params=params, execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions_end',  write_file=True, params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_parkrun_events', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athletesInEventRange', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_ages', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_age_changes', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_dob_ranges', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_dob_summary', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_latest_club', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_final_age_updates', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_coalesce_age_fields', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True) 
    ddl = get_temp_table_sql('tmp_extended_age_fields', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_update', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)

    return

def _refresh_materialized_views(render_cursor):
    """
    Run ONLY the materialized view refresh block.
    Paste your existing refresh SQL calls here unchanged.
    """
    try:
        try:
            backup_materialized_views_sql(render_cursor)
        except Exception as e:
            print(f"[mv-backup] warning: backup failed before refresh: {e}")

        materialized_views = [
            "mv_extend_runs",
            "mv_latest_curve_ranks",
            "mv_participant_run_filters",
            "mv_best_age_curve",
            "mv_best_age_event_curve",
            "mv_best_age_sex_curve",
            "mv_best_age_sex_event_curve",
            "mv_best_event_curve",
            "mv_best_season_curve",
            "mv_best_sex_curve",
            "mv_best_sex_event_curve",
            "mv_best_curve",
            "mv_best_age_1y_curve",
            "mv_best_age_event_1y_curve",
            "mv_best_age_sex_1y_curve",
            "mv_best_age_sex_event_1y_curve",
            "mv_best_event_1y_curve",
            "mv_best_season_1y_curve",
            "mv_best_sex_1y_curve",
            "mv_best_sex_event_1y_curve",
            "mv_best_1y_curve",
            "mv_event_summary_cache",
            "mv_club_members_cache",
        ]

        def _get_existing_materialized_views():
            render_cursor.execute(
                """
                SELECT matviewname
                FROM pg_matviews
                WHERE schemaname = 'public'
                """
            )
            return {row[0] for row in (render_cursor.fetchall() or []) if row and row[0]}

        existing_materialized_views = _get_existing_materialized_views()
        missing_materialized_views = [mv for mv in materialized_views if mv not in existing_materialized_views]

        cache_definition_scripts = {
            'mv_club_members_cache': os.path.join('sql', 'materialized_views', 'club_members_cache_mv.sql'),
            'mv_event_summary_cache': os.path.join('sql', 'materialized_views', 'event_summary_cache_mv.sql'),
        }
        missing_cache_materialized_views = [
            mv for mv in cache_definition_scripts
            if mv in missing_materialized_views
        ]

        for mv in missing_cache_materialized_views:
            script_path = cache_definition_scripts[mv]
            print(f"Recreating missing materialized view '{mv}' from {script_path}...")
            _execute_sql_script(render_cursor, script_path, script_path)

        if missing_cache_materialized_views:
            existing_materialized_views = _get_existing_materialized_views()
            missing_materialized_views = [mv for mv in materialized_views if mv not in existing_materialized_views]

        if missing_materialized_views:
            print(
                "Skipping missing materialized views in Postgres: "
                + ", ".join(missing_materialized_views)
            )

        for mv in materialized_views:
            if mv not in existing_materialized_views:
                continue
            try:
                started = datetime.now()
                print(f"Refreshing materialized view: {mv}...")
                render_cursor.execute(f"REFRESH MATERIALIZED VIEW {mv};")
                # Commit per view so each refresh is finalized independently.
                # This keeps disk usage lower than one large transaction.
                render_cursor.connection.commit()
                elapsed = (datetime.now() - started).total_seconds()
                print(f"Refreshed {mv} in {elapsed:.2f}s")
            except Exception as e:
                try:
                    render_cursor.connection.rollback()
                except Exception:
                    pass
                print(f"Error refreshing materialized view '{mv}': {e}")
                raise

        print("Materialized views refreshed successfully.")
    except Exception as e:
        print(f"Error refreshing materialized views: {e}")
        try:
            render_cursor.connection.rollback()
        except Exception:
            pass


def _execute_sql_script(render_cursor, script_path, label):
    absolute_path = script_path
    if not os.path.isabs(absolute_path):
        absolute_path = os.path.join(PROJECT_ROOT, absolute_path)

    with open(absolute_path, 'r', encoding='utf-8') as sql_file:
        sql_text = sql_file.read()

    started = datetime.now()
    print(f"Rebuilding materialized views from {label}: {absolute_path}")
    try:
        render_cursor.execute(sql_text)
        render_cursor.connection.commit()
        elapsed = (datetime.now() - started).total_seconds()
        print(f"Completed {label} rebuild in {elapsed:.2f}s")
    except Exception as e:
        try:
            render_cursor.connection.rollback()
        except Exception:
            pass
        print(f"Error rebuilding materialized views from {label}: {e}")
        raise


def _rebuild_materialized_views_from_definitions(render_cursor):
    try:
        try:
            backup_materialized_views_sql(render_cursor)
        except Exception as e:
            print(f"[mv-backup] warning: backup failed before rebuild: {e}")

        _execute_sql_script(render_cursor, os.path.join('sql', 'materialized_views', 'Materialize.sql'), 'sql/materialized_views/Materialize.sql')
        _execute_sql_script(
            render_cursor,
            os.path.join('sql', 'materialized_views', 'mv_curve_rank_views.sql'),
            'sql/materialized_views/mv_curve_rank_views.sql'
        )
        print("Materialized view definitions rebuilt successfully.")
    except Exception as e:
        print(f"Error rebuilding materialized view definitions: {e}")
        try:
            render_cursor.connection.rollback()
        except Exception:
            pass
        raise


def _apply_materialized_view_update(render_cursor, rebuild_materialized_views_from_definitions=False):
    if rebuild_materialized_views_from_definitions:
        _rebuild_materialized_views_from_definitions(render_cursor)
    else:
        _refresh_materialized_views(render_cursor)

def _run_event_scraper(formatted_date, Scraper, sqlite_cursor, event_code, all_athletes, no_volunteers, driver):
    if not Scraper:
        return
    try:
        opened_local_conn = False
        local_sqlite_cursor = sqlite_cursor
        if local_sqlite_cursor is None:
            try:
                sqlite_conn_tmp, local_sqlite_cursor, _, _ = connections()
                opened_local_conn = True
            except Exception:
                sqlite_conn_tmp = None
                local_sqlite_cursor = None

        fd = formatted_date
        try:
            if fd and '-' in fd and fd.count('-') == 2:
                y, m, d = fd.split('-')
                fd = f"{d.zfill(2)}/{m.zfill(2)}/{y}"
        except Exception:
            pass

        if event_code is not None:
            q = "SELECT event_code, event_number FROM parkrun_events WHERE event_date = ? AND event_code = ?"
            q_params = [fd, event_code]
        else:
            q = "SELECT event_code, event_number FROM parkrun_events WHERE event_date = ?"
            q_params = [fd]
        rows = []
        if local_sqlite_cursor is not None:
            try:
                local_sqlite_cursor.execute(q, q_params)
                rows = local_sqlite_cursor.fetchall()
            except Exception:
                try:
                    cur_tmp = local_sqlite_cursor.connection.execute(q, q_params)
                    rows = cur_tmp.fetchall()
                except Exception:
                    rows = []
        else:
            try:
                conn2, cur2, _, _ = connections()
                cur2.execute(q, q_params)
                rows = cur2.fetchall()
                try:
                    conn2.close()
                except Exception:
                    pass
            except Exception:
                rows = []

        events = []
        for r in rows:
            try:
                ec, en = r[0], r[1]
                if ec is None or en is None:
                    continue
                events.append((int(ec), str(fd), int(en)))
            except Exception:
                continue

        if events:
            try:
                try:
                    if local_sqlite_cursor is not None and hasattr(local_sqlite_cursor, 'connection'):
                        local_sqlite_cursor.connection.commit()
                except Exception:
                    pass

                from scripts.athlete_runs_etl import main as athlete_main
                print(f"Running Athlete_runs for {len(events)} event(s) (scrape+volunteers)...")
                retain_browser = False
                if not driver:
                    retain_browser = True
                athlete_main(resume=False, events_override=events, all_athletes=all_athletes,
                                no_volunteers=no_volunteers, browser=driver, retain_browser=retain_browser)
            except Exception as e:
                print(f"Error running Athlete_runs.main: {e}")
    finally:
        try:
            if 'opened_local_conn' in locals() and opened_local_conn and 'sqlite_conn_tmp' in locals() and sqlite_conn_tmp is not None:
                sqlite_conn_tmp.close()
        except Exception:
            pass

def _copy_parkrun_events_to_postgres(no_parkrun_postgres, formatted_date, event_code, range_start=None, range_end=None):
    if no_parkrun_postgres:
        return

    if range_start is None:
        range_start = formatted_date
    if range_end is None:
        range_end = formatted_date

    # Keep date-scoped event metrics aligned with coeff/obs when rebuilding or backfilling ranges.
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["coeff_event", "Avg_time", "Avgtimelim12", "avgtimelim5", "tourist_count", "regulars", "avg_age",
                "super_tourist_count", "first_timers_count", "returners_count", "eligible_time_count", "unknown_count", "super_returner_count",
                "club_count", "pb_count", "recentbest_count"],
        exact_date=False,
        updateOnly=True,
        start_date=range_start,
        end_date=range_end,
        event_code=event_code)

    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["coeff", "obs"],
        exact_date=False,
        updateOnly=True,
        start_date=range_start,
        end_date=range_end,
        event_code=event_code)

def _copy_eventpositions_to_postgres(formatted_date, event_code):
    curve_fields = [col_name for col_name, _ in CURVE_EVENTPOSITION_COLUMNS]
    copy_table_to_postgres(
        table_name="eventpositions",
        key_columns=["event_code", "event_date", "athlete_code"],
        fields=["position","age_ratio_male", "age_ratio_sex","event_eligible_appearances","time_ratio","adj_time_ratio","adj_time_seconds",
            "event_code_count","super_tourist","regular","current_age_estimate","total_runs","time_seconds",
            "tourist_flag","returner","super_returner","last_event_code_count","last_event_code_count_long",
            "local_time_ratio","adj2_time_ratio","adj2_time_seconds","distinct_courses_long","total_runs_long",
            *curve_fields],
        earliest_date=formatted_date,
        exact_date=True,
        updateOnly=False,
        event_code=event_code)

def _ensure_eventpositions_curve_rank_columns(sqlite_conn):
    cur = sqlite_conn.cursor()
    cur.execute("PRAGMA table_info(eventpositions)")
    existing = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name, col_type in CURVE_EVENTPOSITION_COLUMNS:
        if col_name.lower() not in existing:
            cur.execute(f"ALTER TABLE eventpositions ADD COLUMN {col_name} {col_type}")
    sqlite_conn.commit()

def _fetch_curve_rank_dates(sqlite_conn, start_date: str = None, end_date: str = None, event_code: int = None, missing_only: bool = False, descending: bool = True):
    cur = sqlite_conn.cursor()
    where = []
    params = {}

    iso_date_expr = "(substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2))"
    where.append("1=1")

    if start_date:
        where.append(f"{iso_date_expr} >= :start_date")
        params["start_date"] = start_date
    if end_date:
        where.append(f"{iso_date_expr} <= :end_date")
        params["end_date"] = end_date
    if event_code is not None:
        where.append("e.event_code = :event_code")
        params["event_code"] = event_code
    if missing_only:
        where.append(
            "(e.best_curve_ranking_current IS NULL OR e.best_curve_ranking_historic IS NULL OR e.best_curve_ranking_current_type IS NULL)"
        )

    direction = "DESC" if descending else "ASC"
    sql = f"""
        SELECT DISTINCT {iso_date_expr} AS formatted_date
        FROM eventpositions e
        WHERE {' AND '.join(where)}
        ORDER BY formatted_date {direction};
    """
    cur.execute(sql, params)
    return [row[0] for row in cur.fetchall() if row and row[0]]

def run_curve_rank_updates_only(
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
    missing_only: bool = False,
    descending: bool = True,
    copy_to_postgres: bool = False,
    copy_every_n_dates: int = 1,
):
    overall_started = _timing_start()
    conn, cursor, render_db_conn, render_cursor = connections()
    processed_dates = []
    try:
        _ensure_sqlite_math_functions(conn)
        _ensure_curve_time_rank_reference_table(conn)
        fetch_started = _timing_start()
        dates = _fetch_curve_rank_dates(
            sqlite_conn=conn,
            start_date=start_date,
            end_date=end_date,
            event_code=event_code,
            missing_only=missing_only,
            descending=descending,
        )
        _timing_log("curve.fetch_dates", fetch_started)
        print(
            f"Curve-rank-only run: dates={len(dates)}, start_date={start_date}, end_date={end_date}, "
            f"event_code={event_code}, missing_only={missing_only}, descending={descending}, "
            f"copy_to_postgres={copy_to_postgres}, copy_every_n_dates={copy_every_n_dates}"
        )
        successful_dates = 0
        for idx, formatted_date in enumerate(dates, start=1):
            date_started = _timing_start()
            print(f"[curve] processing {idx}/{len(dates)}: {formatted_date}")
            try:
                _run_curved_ranks_for_weekly_update(
                    current_date=formatted_date,
                    event_code=event_code,
                    rolling_rebuild_weeks=3,
                )
                build_curve_time_rank_reference_for_date(
                    sqlite_conn=conn,
                    snapshot_date=formatted_date,
                )
                successful_dates += 1
                processed_dates.append(formatted_date)

                if copy_to_postgres and copy_every_n_dates > 0 and (successful_dates % copy_every_n_dates == 0):
                    verify_started = _timing_start()
                    if not _verify_curve_rankings_in_postgres(render_cursor, formatted_date, event_code, require_rows=True):
                        raise RuntimeError(
                            f"Curve-rank Postgres verification failed for date={formatted_date}, event_code={event_code}"
                        )
                    _timing_log(f"curve.verify_postgres.date ({formatted_date})", verify_started)

                _timing_log(f"curve.date_complete ({formatted_date})", date_started)
            except Exception as e:
                print(f"Error updating curve ranks for {formatted_date}: {e}")

        if copy_to_postgres and copy_every_n_dates > 1 and (successful_dates % copy_every_n_dates != 0):
            verify_started = _timing_start()
            for d in processed_dates:
                if not _verify_curve_rankings_in_postgres(render_cursor, d, event_code, require_rows=True):
                    raise RuntimeError(
                        f"Curve-rank Postgres verification failed for date={d}, event_code={event_code}"
                    )
            _timing_log("curve.verify_postgres.final_partial_batch", verify_started)

        conn.commit()
        _timing_log("curve.commit", overall_started)
    finally:
        _timing_log("curve.run_curve_rank_updates_only.total", overall_started)
        try:
            conn.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass

def _normalize_curve_date(value: str):
    if value is None:
        return None
    raw = str(value).strip().replace('//', '/')
    if not raw:
        return None
    if '-' in raw and raw.count('-') == 2:
        parts = raw.split('-')
        if len(parts[0]) == 4:
            return raw
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    if '/' in raw and raw.count('/') == 2:
        d, m, y = raw.split('/')
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return raw

def _last_completed_saturday_iso(reference_dt: datetime = None) -> str:
    """Return the most recent completed Saturday as YYYY-MM-DD.

    - If today is Saturday, returns the previous Saturday (7 days ago).
    - Otherwise returns the immediately preceding Saturday.
    """
    current = reference_dt or datetime.now()
    days_since_saturday = (current.weekday() - 5) % 7
    if days_since_saturday == 0:
        days_since_saturday = 7
    cutoff = current - timedelta(days=days_since_saturday)
    return cutoff.strftime("%Y-%m-%d")

def run_curve_latest(event_code: int = None, missing_only: bool = False, date_override: str = None, copy_to_postgres: bool = False):
    overall_started = _timing_start()
    conn, cursor, render_db_conn, render_cursor = connections()
    try:
        started = _timing_start()
        target_date = _normalize_curve_date(date_override)
        if target_date is None:
            cursor.execute(
                """
                SELECT MAX(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2))
                FROM eventpositions
                WHERE (:event_code IS NULL OR event_code = :event_code);
                """,
                {"event_code": event_code},
            )
            row = cursor.fetchone()
            target_date = row[0] if row else None
        _timing_log("curve.run_curve_latest.resolve_target_date", started)

        if not target_date:
            print("run_curve_latest: no eligible date found in eventpositions")
            return

        print(
            f"run_curve_latest: target_date={target_date}, event_code={event_code}, missing_only={missing_only}, copy_to_postgres={copy_to_postgres}"
        )
        started = _timing_start()
        run_curve_rank_updates_only(
            start_date=target_date,
            end_date=target_date,
            event_code=event_code,
            missing_only=missing_only,
            descending=True,
        )
        _timing_log("curve.run_curve_latest.sqlite_updates", started)

        if copy_to_postgres:
            started = _timing_start()
            if not _verify_curve_rankings_in_postgres(render_cursor, target_date, event_code, require_rows=True):
                raise RuntimeError(
                    f"Curve-rank Postgres verification failed for date={target_date}, event_code={event_code}"
                )
            _timing_log("curve.run_curve_latest.copy_to_postgres", started)
    finally:
        _timing_log("curve.run_curve_latest.total", overall_started)
        try:
            conn.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass

def run_curve_backfill_today(
    event_code: int = None,
    missing_only: bool = True,
    copy_to_postgres: bool = False,
    today_override: str = None,
    copy_every_n_dates: int = 1,
):
    overall_started = _timing_start()
    target_end_date = _normalize_curve_date(today_override) or datetime.now().strftime("%Y-%m-%d")

    print(
        f"run_curve_backfill_today: end_date={target_end_date}, event_code={event_code}, "
        f"missing_only={missing_only}, copy_to_postgres={copy_to_postgres}, "
        f"copy_every_n_dates={copy_every_n_dates}"
    )

    started = _timing_start()
    run_curve_rank_updates_only(
        start_date=None,
        end_date=target_end_date,
        event_code=event_code,
        missing_only=missing_only,
        descending=True,
        copy_to_postgres=copy_to_postgres,
        copy_every_n_dates=copy_every_n_dates,
    )
    _timing_log("curve.run_curve_backfill_today.sqlite_updates", started)

    _timing_log("curve.run_curve_backfill_today.total", overall_started)

def rebuild_curve_historic_from_current(
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
    copy_to_postgres: bool = False,
    batch_size: int = 100000,
):
    """Rebuild best_curve_ranking_historic from PRIOR running max of best_curve_ranking_current.

    - Running max is computed per athlete over chronological event rows, excluding current row.
      (i.e. historic means "best before this event")
    - Scope controls which rows are UPDATED, but running max considers prior rows
      (up to end_date if provided) so history remains correct.
    - Prints batch progress so long runs are observable.
    """
    overall_started = _timing_start()
    conn, cursor, render_db_conn, render_cursor = connections()
    try:
        started = _timing_start()
        _ensure_eventpositions_curve_rank_columns(conn)
        _timing_log("curve.rebuild_historic.ensure_columns", started)

        params = {
            "start_date": _normalize_curve_date(start_date),
            "end_date": _normalize_curve_date(end_date),
            "event_code": event_code,
        }

        print(
            "rebuild_curve_historic_from_current: "
            f"start_date={params['start_date']}, end_date={params['end_date']}, "
            f"event_code={event_code}, copy_to_postgres={copy_to_postgres}, batch_size={batch_size}"
        )

        if batch_size is None or int(batch_size) <= 0:
            batch_size = 100000
        else:
            batch_size = int(batch_size)

        create_tmp_sql = """
            WITH
            all_rows AS (
                SELECT
                    e.event_code,
                    e.event_date,
                    e.position,
                    e.athlete_code,
                    (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) AS formatted_date,
                    e.best_curve_ranking_current
                FROM eventpositions e
                WHERE (:end_date IS NULL OR (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) <= :end_date)
            ),
            ranked AS (
                SELECT
                    ar.event_code,
                    ar.event_date,
                    ar.position,
                    ar.athlete_code,
                    ar.formatted_date,
                    MAX(ar.best_curve_ranking_current) OVER (
                        PARTITION BY ar.athlete_code
                        ORDER BY ar.formatted_date, ar.event_code, ar.position
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ) AS best_curve_ranking_historic_new
                FROM all_rows ar
            ),
            targets AS (
                SELECT
                    e.event_code,
                    e.event_date,
                    e.position,
                    e.athlete_code
                FROM eventpositions e
                WHERE (:start_date IS NULL OR (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) >= :start_date)
                  AND (:end_date IS NULL OR (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) <= :end_date)
                  AND (:event_code IS NULL OR e.event_code = :event_code)
            )
            SELECT
                r.event_code,
                r.event_date,
                r.position,
                r.athlete_code,
                r.formatted_date,
                r.best_curve_ranking_historic_new
            FROM ranked r
            JOIN targets t
              ON t.event_code = r.event_code
             AND t.event_date = r.event_date
             AND t.position = r.position
             AND t.athlete_code = r.athlete_code;
        """

        started = _timing_start()
        conn.execute("DROP TABLE IF EXISTS tmp_curve_historic_rebuild")
        conn.execute(
            """
            CREATE TEMP TABLE tmp_curve_historic_rebuild AS
            """ + create_tmp_sql,
            params,
        )
        conn.commit()
        _timing_log("curve.rebuild_historic.prepare_tmp", started)

        count_started = _timing_start()
        total_targets = conn.execute(
            "SELECT COUNT(*) FROM tmp_curve_historic_rebuild"
        ).fetchone()[0]
        _timing_log("curve.rebuild_historic.count_targets", count_started)
        print(f"rebuild_curve_historic_from_current: target rows={total_targets}")

        rows_changed = 0
        if total_targets > 0:
            update_chunk_sql = """
                WITH chunk AS (
                    SELECT
                        event_code,
                        event_date,
                        position,
                        athlete_code,
                        best_curve_ranking_historic_new
                    FROM tmp_curve_historic_rebuild
                    ORDER BY formatted_date, event_code, position
                    LIMIT :limit_rows OFFSET :offset_rows
                )
                UPDATE eventpositions
                SET best_curve_ranking_historic = (
                    SELECT c.best_curve_ranking_historic_new
                    FROM chunk c
                    WHERE c.event_code = eventpositions.event_code
                      AND c.event_date = eventpositions.event_date
                      AND c.position = eventpositions.position
                      AND c.athlete_code = eventpositions.athlete_code
                )
                WHERE EXISTS (
                    SELECT 1
                    FROM chunk c
                    WHERE c.event_code = eventpositions.event_code
                      AND c.event_date = eventpositions.event_date
                      AND c.position = eventpositions.position
                      AND c.athlete_code = eventpositions.athlete_code
                );
            """

            update_started = _timing_start()
            offset = 0
            batch_num = 0
            while offset < total_targets:
                batch_num += 1
                before_changes = conn.total_changes
                conn.execute(
                    update_chunk_sql,
                    {
                        "limit_rows": batch_size,
                        "offset_rows": offset,
                    },
                )
                conn.commit()
                changed_this_batch = conn.total_changes - before_changes
                rows_changed += changed_this_batch
                offset += batch_size
                done_rows = min(offset, total_targets)
                pct = (done_rows / total_targets) * 100.0
                elapsed = perf_counter() - update_started
                print(
                    f"[curve.rebuild_historic] batch={batch_num} "
                    f"done={done_rows}/{total_targets} ({pct:.1f}%) "
                    f"changed_batch={changed_this_batch} changed_total={rows_changed} "
                    f"elapsed={elapsed:.1f}s"
                )

            _timing_log("curve.rebuild_historic.sqlite_update", update_started)
        else:
            print("[curve.rebuild_historic] no target rows matched scope; nothing to update")

        print(f"rebuild_curve_historic_from_current: sqlite rows changed={rows_changed}")

        try:
            conn.execute("DROP TABLE IF EXISTS tmp_curve_historic_rebuild")
            conn.commit()
        except Exception:
            pass

        if copy_to_postgres:
            started = _timing_start()
            copy_table_to_postgres(
                table_name="eventpositions",
                key_columns=["event_code", "event_date", "athlete_code"],
                fields=["best_curve_ranking_historic"],
                exact_date=False,
                updateOnly=True,
                start_date=params["start_date"],
                end_date=params["end_date"],
                event_code=event_code,
            )
            _timing_log("curve.rebuild_historic.copy_to_postgres", started)
    finally:
        _timing_log("curve.rebuild_historic.total", overall_started)
        try:
            conn.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass

def backup_eventpositions_curve_history(
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
    out_dir: str = r"C:\temp\parkrun_backups",
):
    """Snapshot existing eventpositions curve-rank fields before rebuild.

    Creates:
      1) SQLite table backup: eventpositions_curve_history_backup_YYYYMMDD_HHMMSS
      2) CSV file in out_dir with same rows
    """
    overall_started = _timing_start()
    conn, cursor, render_db_conn, render_cursor = connections()
    try:
        params = {
            "start_date": _normalize_curve_date(start_date),
            "end_date": _normalize_curve_date(end_date),
            "event_code": event_code,
        }
        where_sql = """
            WHERE (:start_date IS NULL OR (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) >= :start_date)
              AND (:end_date IS NULL OR (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) <= :end_date)
              AND (:event_code IS NULL OR e.event_code = :event_code)
        """

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_table = f"eventpositions_curve_history_backup_{timestamp}"

        create_sql = f"""
            CREATE TABLE {backup_table} AS
            SELECT
                e.event_code,
                e.event_date,
                e.position,
                e.athlete_code,
                e.best_curve_ranking_current,
                e.best_curve_ranking_historic,
                e.best_curve_ranking_current_type
            FROM eventpositions e
            {where_sql};
        """

        started = _timing_start()
        conn.execute(create_sql, params)
        conn.commit()
        _timing_log("curve.backup.create_sqlite_table", started)

        count_started = _timing_start()
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {backup_table}")
        backup_rows = int(cur.fetchone()[0] or 0)
        _timing_log("curve.backup.count_rows", count_started)

        os.makedirs(out_dir, exist_ok=True)
        csv_path = os.path.join(out_dir, f"{backup_table}.csv")

        csv_started = _timing_start()
        cur.execute(f"SELECT * FROM {backup_table}")
        rows = cur.fetchall() or []
        headers = [d[0] for d in (cur.description or [])]
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if headers:
                writer.writerow(headers)
            writer.writerows(rows)
        _timing_log("curve.backup.write_csv", csv_started)

        print(
            f"backup_eventpositions_curve_history: rows={backup_rows}, "
            f"sqlite_table={backup_table}, csv_path={csv_path}"
        )
        return {
            "rows": backup_rows,
            "sqlite_table": backup_table,
            "csv_path": csv_path,
            "start_date": params["start_date"],
            "end_date": params["end_date"],
            "event_code": event_code,
        }
    finally:
        _timing_log("curve.backup.total", overall_started)
        try:
            conn.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass

def _verify_curve_rankings_in_postgres(render_cursor, formatted_date: str, event_code: int = None, require_rows: bool = True) -> bool:
    """Verify curve-rank fields are present in Postgres eventpositions for a date/event scope."""
    sql = """
        WITH normalized AS (
            SELECT
                event_code,
                CASE
                    WHEN (event_date::text) ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_char(to_date(event_date::text, 'DD/MM/YYYY'), 'YYYY-MM-DD')
                    WHEN (event_date::text) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN event_date::text
                    ELSE NULL
                END AS formatted_date,
                time_seconds,
                best_curve_ranking_current,
                best_curve_ranking_historic,
                best_curve_ranking_current_type
            FROM eventpositions
        )
        SELECT
            COUNT(*) AS total_rows,
            SUM(CASE WHEN time_seconds IS NOT NULL THEN 1 ELSE 0 END) AS eligible_rows,
            SUM(
                CASE
                    WHEN time_seconds IS NOT NULL
                     AND (
                            best_curve_ranking_current IS NULL
                         OR best_curve_ranking_historic IS NULL
                         OR best_curve_ranking_current_type IS NULL
                     )
                    THEN 1 ELSE 0
                END
            ) AS missing_rows
        FROM normalized
        WHERE formatted_date = %s
          AND (%s IS NULL OR event_code = %s)
    """

    render_cursor.execute(sql, (formatted_date, event_code, event_code))
    row = render_cursor.fetchone() or (0, 0, 0)
    total_rows = int(row[0] or 0)
    eligible_rows = int(row[1] or 0)
    missing_rows = int(row[2] or 0)

    print(
        f"[curve][verify] postgres eventpositions date={formatted_date}, event_code={event_code}, "
        f"total_rows={total_rows}, eligible_rows={eligible_rows}, missing_rows={missing_rows}"
    )

    if require_rows and total_rows == 0:
        return False
    if missing_rows > 0:
        return False
    return True

def _run_sql_pipeline(formatted_date, params, sqlite_cursor, update_athletes, skip_coeff_updates, event_code, no_parkrun_postgres=False):
    pipeline_started = _timing_start()
    print(f"[pipeline] start date={formatted_date}, event_code={event_code}")

    # this section updates the athlete table
    started = _timing_start()
    ddl = get_temp_table_sql('tmp_selected_eventRange',  write_file=True,params=params, execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_endDate',  write_file=True, params=params, execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    _timing_log("pipeline.range_setup", started)
 
    # build the age estimates (but this is not required for historic event processing)
    if update_athletes:
        started = _timing_start()
        ddl = get_temp_table_sql('tmp_athlete_ages', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_age_changes', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_dob_ranges', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_dob_summary_base', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_dob_summary_fix', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_dob_summary', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_latest_club', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_final_age_updates', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_temp_table_sql('tmp_coalesce_age_fields', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True) 
        ddl = get_update_table_sql('tmp_coalesce_age_fields', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection)
        ddl = get_temp_table_sql('tmp_new_athletes', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
        ddl = get_insert_table_sql('tmp_new_athletes', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection)
        _timing_log("pipeline.update_athletes_block", started)

    # build the age ratios for evernote
    started = _timing_start()
    ddl = get_temp_table_sql('tmp_eventpositions_end', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_inputs', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_calc', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_fract', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_clamped', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_expanded', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ageRatio_final', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    _timing_log("pipeline.age_ratio_block", started)

    # this section updates the parkrun_events table - for the 1st coefficient
    started = _timing_start()
    ddl = get_temp_table_sql('tmp_eventpositions_age', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_parkrun_events', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athletesInEventRange', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athletesInEventRangeStat', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eligible_appearances', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_ranked', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_quartile', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_final_output', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_normalized', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    if not skip_coeff_updates:
        ddl = get_update_simple_table('parkrun_events_coeff', write_file=False,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    _timing_log("pipeline.coeff_primary_block", started)

    # this section updates the parkrun_events table - for the 2nd coefficient and related aggregates
    started = _timing_start()
    ddl = get_temp_table_sql('tmp_parkrun_events', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athletesInEventRange', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athletesRangeStat', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_adjusted_eligible_appearances', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_event_min', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_min', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_adj_ratio', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_adj_ranked_ratio', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_adj_median_summary', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_unknown_count', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eligible_end', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eligible_summary_end', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_parkrun_stats', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_update_table_sql('tmp_parkrun_stats', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_parkrun_events', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    _timing_log("pipeline.coeff_secondary_block", started)

    # update super tourists, regulars, returners and distinct courses
    started = _timing_start()
    ddl = get_temp_table_sql('tmp_max_code_count', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)  
    ddl = get_temp_table_sql('tmp_tourist_flag', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions_long', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions_long_end', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_distinct_event_long', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_stats_long', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_stats_long_end', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_superTourists', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_regulars', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_eventpositions_updates', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_update_simple_table('eventpositions_update', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_parkrun_events_agg', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_update_simple_table('parkrun_events_update', write_file=True,  params=params,  execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_temp_table_sql('tmp_athlete_recent_runs', write_file=True, params=params, execute_conn=sqlite_cursor.connection, silent=True)
    ddl = get_update_simple_table('athletes_recent_runs_update', write_file=True, params=params, execute_conn=sqlite_cursor.connection, silent=True)
    _timing_log("pipeline.eventpositions_and_parkrun_aggregates", started)

    start_date = None
    end_date = None
    try:
        cur = sqlite_cursor.connection.execute("SELECT start_date, end_date FROM tmp_selected_eventRange;")
        row = cur.fetchone()
        if row:
            start_date, end_date = row[0], row[1]
    except Exception:
        start_date = None
        end_date = None

    _timing_log("pipeline.total", pipeline_started)

    return start_date, end_date

def _get_section_sql(name: str, filename_local: str, start_date: str = None, end_date: str = None):
    try:
        params = {'formatted_date': start_date, 'end_date': end_date}
        return get_single_section_sql(name, filename=filename_local, params=params)
    except Exception as e1:
        try:
            return get_single_section_sql(name)
        except Exception as e2:
            from scripts.database_helpers import load_sql_sections
            candidate_files = [
                filename_local,
                os.path.join('sql', 'pipeline_sections', 'newSQL.sql'),
                os.path.join('sql', 'pipeline_sections', 'SQL.sql'),
                'newSQL.sql',
                'SQL.sql',
            ]
            found = {}
            for f in candidate_files:
                try:
                    secs = load_sql_sections(f)
                    found[f] = name in secs
                except Exception:
                    found[f] = False
            raise KeyError(f"Section '{name}' not found. Attempts: {e1}; {e2}. Presence by file: {found}")

def process_athlete_sections(formatted_date: str, sqlite_cursor, render_cursor, period: int = 15, update_athletes: bool = True, skip_coeff_updates: bool = False, event_code: int = None,all_athletes=all,no_volunteers=False,leave_athlete_postgres=False,driver=None,Scraper=True,no_parkrun_postgres=False,scraper_only: bool = False, refresh_materialized_view: bool = True, rebuild_materialized_views_from_definitions: bool = False, run_sql_pipeline: bool = True, update_curve_rankings: bool = True, update_curve_rank_range_summary: bool = False, resume_curve_from_stage2: bool = False, resume_curve_from_all_history: bool = False):
    # Example placeholder - you will replace this with the actual sequence
    global _last_process_time
    now = datetime.now()
    if _last_process_time is None:
        delta = 0.0
    else:
        delta = (now - _last_process_time).total_seconds()
    # update the last timestamp immediately
    _last_process_time = now
    print(f"Processing Event Data for -  formatted_date={formatted_date}, period={period} (Δ {delta:.2f}s since last)")
    params = {'formatted_date': formatted_date, 'period': period, 'event_code': event_code}
    overall_started = _timing_start()

    if scraper_only:
        run_mode = "scraper_only"
    elif not run_sql_pipeline:
        run_mode = "pipeline_off"
    else:
        run_mode = "full_pipeline"

    print(
        "Execution plan: "
        f"mode={run_mode}, "
        f"resume_curve_from_stage2={resume_curve_from_stage2}, "
        f"resume_curve_from_all_history={resume_curve_from_all_history}, "
        f"refresh_materialized_view={refresh_materialized_view}, "
        f"rebuild_materialized_views_from_definitions={rebuild_materialized_views_from_definitions}, "
        f"no_parkrun_postgres={no_parkrun_postgres}, "
        f"leave_athlete_postgres={leave_athlete_postgres}, "
        f"Scraper={Scraper}, "
        f"update_athletes={update_athletes}, "
        f"skip_coeff_updates={skip_coeff_updates}, "
        f"update_curve_rankings={update_curve_rankings}, "
        f"update_curve_rank_range_summary={update_curve_rank_range_summary}"
    )

    if resume_curve_from_stage2:
        print("Mode curve_resume_stage2: skipping SQL pipeline, scraper, and athlete copy; resuming at weekly Curve Stage 2 current snapshot")

        if update_curve_rankings:
            started = _timing_start()
            _run_curved_ranks_for_weekly_update(
                current_date=formatted_date,
                event_code=event_code,
                rolling_rebuild_weeks=3,
                run_stage1=False,
                resume_from_all_history=False,
            )
            _timing_log("process.resume_curve_stage2.curve_rank_updates_from_stage2", started)

            started = _timing_start()
            if not _verify_curve_rankings_in_postgres(render_cursor, formatted_date, event_code, require_rows=True):
                raise RuntimeError(
                    f"Curve-rank Postgres verification failed for date={formatted_date}, event_code={event_code}"
                )
            _timing_log("process.resume_curve_stage2.verify_curve_rankings_in_postgres", started)

            if update_curve_rank_range_summary and not no_parkrun_postgres:
                started = _timing_start()
                uploaded_rows = _run_curve_rank_range_summary_upload(snapshot_date=formatted_date)
                print(f"curve_rank_range_summary rows uploaded: {uploaded_rows}")
                _timing_log("process.resume_curve_stage2.curve_rank_range_summary_upload", started)

        started = _timing_start()
        _copy_eventpositions_to_postgres(formatted_date, event_code)
        _timing_log("process.resume_curve_stage2.copy_eventpositions", started)

        started = _timing_start()
        _copy_parkrun_events_to_postgres(no_parkrun_postgres, formatted_date, event_code, formatted_date, formatted_date)
        _timing_log("process.resume_curve_stage2.copy_parkrun_events", started)

        if refresh_materialized_view:
            started = _timing_start()
            _apply_materialized_view_update(render_cursor, rebuild_materialized_views_from_definitions)
            _timing_log("process.resume_curve_stage2.refresh_materialized_views", started)

        _timing_log("process.total", overall_started)
        return

    if resume_curve_from_all_history:
        print("Mode curve_resume_all_history: skipping SQL pipeline, scraper, and athlete copy; resuming at weekly all-history curve rebuild")

        if update_curve_rankings:
            started = _timing_start()
            _run_curved_ranks_for_weekly_update(
                current_date=formatted_date,
                event_code=event_code,
                rolling_rebuild_weeks=3,
                resume_from_all_history=True,
            )
            _timing_log("process.resume_curve.curve_rank_updates_from_all_history", started)

            started = _timing_start()
            if not _verify_curve_rankings_in_postgres(render_cursor, formatted_date, event_code, require_rows=True):
                raise RuntimeError(
                    f"Curve-rank Postgres verification failed for date={formatted_date}, event_code={event_code}"
                )
            _timing_log("process.resume_curve.verify_curve_rankings_in_postgres", started)

            if update_curve_rank_range_summary and not no_parkrun_postgres:
                started = _timing_start()
                uploaded_rows = _run_curve_rank_range_summary_upload(snapshot_date=formatted_date)
                print(f"curve_rank_range_summary rows uploaded: {uploaded_rows}")
                _timing_log("process.resume_curve.curve_rank_range_summary_upload", started)

        started = _timing_start()
        _copy_eventpositions_to_postgres(formatted_date, event_code)
        _timing_log("process.resume_curve.copy_eventpositions", started)

        started = _timing_start()
        _copy_parkrun_events_to_postgres(no_parkrun_postgres, formatted_date, event_code, formatted_date, formatted_date)
        _timing_log("process.resume_curve.copy_parkrun_events", started)

        if refresh_materialized_view:
            started = _timing_start()
            _apply_materialized_view_update(render_cursor, rebuild_materialized_views_from_definitions)
            _timing_log("process.resume_curve.refresh_materialized_views", started)

        _timing_log("process.total", overall_started)
        return

    if scraper_only:
        print("Mode scraper_only: running scraper and skipping SQL/refresh/copy sections")
        started = _timing_start()
        _run_event_scraper(formatted_date, Scraper, sqlite_cursor, event_code, all_athletes, no_volunteers, driver)
        _timing_log("process.scraper_only.scraper", started)
        _timing_log("process.total", overall_started)
        return

    if (
        rebuild_materialized_views_from_definitions
        and not run_sql_pipeline
        and not Scraper
        and leave_athlete_postgres
        and no_parkrun_postgres
    ):
        print("Mode materialized_view_rebuild_only: rebuilding Postgres materialized view definitions without SQL pipeline, scraper, or copy steps")
        started = _timing_start()
        _rebuild_materialized_views_from_definitions(render_cursor)
        _timing_log("process.materialized_view_rebuild_only.rebuild_materialized_views_from_definitions", started)
        _timing_log("process.total", overall_started)
        return

    if not run_sql_pipeline:
        print("Mode pipeline_off: skipping SQL pipeline sections")
        print("Mode pipeline_off: uploading local eventpositions to Postgres")
        started = _timing_start()
        _copy_eventpositions_to_postgres(formatted_date, event_code)
        _timing_log("process.pipeline_off.copy_eventpositions", started)
        if not no_parkrun_postgres:
            print("Mode pipeline_off: running parkrun_events Postgres copy")
        started = _timing_start()
        _copy_parkrun_events_to_postgres(no_parkrun_postgres, formatted_date, event_code, formatted_date, formatted_date)
        _timing_log("process.pipeline_off.copy_parkrun_events", started)
        started = _timing_start()
        _run_event_scraper(formatted_date, Scraper, sqlite_cursor, event_code, all_athletes, no_volunteers, driver)
        _timing_log("process.pipeline_off.scraper", started)
        if not leave_athlete_postgres:
            started = _timing_start()
            copy_athletes_to_postgres(cast_timestamps=True, updateFrom=formatted_date, run_age_update=True)
            _timing_log("process.pipeline_off.copy_athletes", started)
        if refresh_materialized_view:
            print("Mode pipeline_off: running materialized view refresh")
            started = _timing_start()
            _apply_materialized_view_update(render_cursor, rebuild_materialized_views_from_definitions)
            _timing_log("process.pipeline_off.refresh_materialized_views", started)
        _timing_log("process.total", overall_started)
        return

    print("Mode full_pipeline: running SQL pipeline sections")

    started = _timing_start()
    start_date, end_date = _run_sql_pipeline(
        formatted_date=formatted_date,
        params=params,
        sqlite_cursor=sqlite_cursor,
        update_athletes=update_athletes,
        skip_coeff_updates=skip_coeff_updates,
        event_code=event_code,
        no_parkrun_postgres=no_parkrun_postgres,
    )
    _timing_log("process.full_pipeline.sql_pipeline", started)
    
    started = _timing_start()
    _run_event_scraper(formatted_date, Scraper, sqlite_cursor, event_code, all_athletes, no_volunteers, driver)
    _timing_log("process.full_pipeline.scraper", started)
    if not leave_athlete_postgres:
        # c:\Users\stevi\parkrun_project>python -c "from analytics import copy_athletes_to_postgres; copy_athletes_to_postgres(cast_timestamps=True, updateFrom='2026-02-28', run_age_update=True)"
        started = _timing_start()
        copy_athletes_to_postgres(cast_timestamps=True,updateFrom=end_date,run_age_update=True) 
        _timing_log("process.full_pipeline.copy_athletes", started)
    if update_curve_rankings:
        started = _timing_start()
        _run_curved_ranks_for_weekly_update(
            current_date=formatted_date,
            event_code=event_code,
            rolling_rebuild_weeks=3,
        )
        _timing_log("process.full_pipeline.curve_rank_updates_with_copy", started)

        started = _timing_start()
        if not _verify_curve_rankings_in_postgres(render_cursor, formatted_date, event_code, require_rows=True):
            raise RuntimeError(
                f"Curve-rank Postgres verification failed for date={formatted_date}, event_code={event_code}"
            )
        _timing_log("process.full_pipeline.verify_curve_rankings_in_postgres", started)

        if update_curve_rank_range_summary and not no_parkrun_postgres:
            started = _timing_start()
            uploaded_rows = _run_curve_rank_range_summary_upload(snapshot_date=formatted_date)
            print(f"curve_rank_range_summary rows uploaded: {uploaded_rows}")
            _timing_log("process.full_pipeline.curve_rank_range_summary_upload", started)

    started = _timing_start()
    _copy_eventpositions_to_postgres(formatted_date, event_code)
    _timing_log("process.full_pipeline.copy_eventpositions", started)

    started = _timing_start()
    _copy_parkrun_events_to_postgres(no_parkrun_postgres, formatted_date, event_code, start_date, end_date)
    _timing_log("process.full_pipeline.copy_parkrun_events", started)

    if refresh_materialized_view:
        started = _timing_start()
        _apply_materialized_view_update(render_cursor, rebuild_materialized_views_from_definitions)
        _timing_log("process.full_pipeline.refresh_materialized_views", started)

    _timing_log("process.total", overall_started)

def run_simple_sql_loop(filename: str = 'sql/pipeline_sections/newSQL.sql', rebuild: bool = False, start_date: str = None,skip_coeff_updates: bool = False, event_code: int = None,end_date: str = None ,all_athletes=True,no_volunteers=False,buildAthletes=True ,leave_athlete_postgres=False,driver=None,Scraper=True,no_parkrun_postgres=False,scraper_only: bool = False, refresh_materialized_view: bool = True, rebuild_materialized_views_from_definitions: bool = False, run_sql_pipeline: bool = True, update_curve_rankings: bool = True, update_curve_rank_range_summary: bool = False, curve_rank_only: bool = False, curve_rank_missing_only: bool = False, curve_rank_descending: bool = True, rebuild_historic_after_run: bool = False, historic_rebuild_end_date: str = None, historic_rebuild_batch_size: int = 50000, historic_rebuild_copy_to_postgres: bool = True, resume_curve_from_stage2: bool = False, resume_curve_from_all_history: bool = False):
    """Load the named SQL section from `filename`, execute it, and loop results.
    If `rebuild` is True the function will run `rebuild_all_event_positions` to
    obtain formatted_dates; otherwise it will run `latest_event_positions`.
    If `start_date` (ISO YYYY-MM-DD) is provided, athlete-specific recomputations
    (the heavy `update_athletes` work) will only run for dates >= `start_date`.
    """
    conn, cursor, render_db_conn, render_cursor = connections()
    print(
        "run_simple_sql_loop switches: "
        f"rebuild={rebuild}, start_date={start_date}, end_date={end_date}, "
        f"run_sql_pipeline={run_sql_pipeline}, refresh_materialized_view={refresh_materialized_view}, "
        f"rebuild_materialized_views_from_definitions={rebuild_materialized_views_from_definitions}, "
        f"no_parkrun_postgres={no_parkrun_postgres}, leave_athlete_postgres={leave_athlete_postgres}, "
        f"Scraper={Scraper}, scraper_only={scraper_only}, buildAthletes={buildAthletes}, "
        f"skip_coeff_updates={skip_coeff_updates}, event_code={event_code}, all_athletes={all_athletes}, "
        f"update_curve_rankings={update_curve_rankings}, curve_rank_only={curve_rank_only}, "
        f"update_curve_rank_range_summary={update_curve_rank_range_summary}, "
        f"curve_rank_missing_only={curve_rank_missing_only}, curve_rank_descending={curve_rank_descending}, "
        f"rebuild_historic_after_run={rebuild_historic_after_run}, historic_rebuild_end_date={historic_rebuild_end_date}, "
        f"historic_rebuild_batch_size={historic_rebuild_batch_size}, historic_rebuild_copy_to_postgres={historic_rebuild_copy_to_postgres}, "
        f"resume_curve_from_stage2={resume_curve_from_stage2}, "
        f"resume_curve_from_all_history={resume_curve_from_all_history}"
    )

    if curve_rank_only:
        print("Curve-rank-only mode: skipping scraper/pipeline/copy and updating only curve-rank columns in eventpositions")
        conn.close()
        render_db_conn.close()
        run_curve_rank_updates_only(
            start_date=start_date,
            end_date=end_date,
            event_code=event_code,
            missing_only=curve_rank_missing_only,
            descending=curve_rank_descending,
        )
        return
    # The logic below is driven by the `rebuild` flag. We no longer read 'simpleSQL' here.
    # Use the rebuild flag to choose which SQL section to run to obtain dates
    #buildAthletes = True
    if rebuild and start_date is not None:
        print("Rebuild flag True: running 'rebuild_all_event_positions' to obtain dates")
        #buildAthletes = False
        #sec_sql = _get_section_sql('update_clear_coeffs',filename)
        #flat = flatten_sql(sec_sql)
        #cursor.execute(flat)
        #conn.commit()
        try:
            sec_sql = _get_section_sql('rebuild_all_event_positions', filename, start_date=start_date,end_date=end_date)
            flat = flatten_sql(sec_sql)
            # If the section is a simple SELECT, execute it and fetch rows.
            # If it contains multiple statements (DDL/temporary table creation),
            # execute as a script and then expect the script to include a final
            # SELECT section (handled by separate named sections).
            try:
                if sec_sql.lstrip().lower().startswith('select'):
                    cursor.execute(flat)
                    dates = [r[0] for r in cursor.fetchall()]
                else:
                    cursor.executescript(flat)
                    conn.commit()
                    # after a script, caller should provide a named SELECT section
                    # to read results (fallback handled below)
                    try:
                        cursor.execute(flat)
                        dates = [r[0] for r in cursor.fetchall()]
                    except Exception:
                        dates = []
            except Exception as e_sel:
                raise RuntimeError(f"Failed to execute section 'rebuild_all_event_positions': {e_sel}")
        except Exception as e:
            print(f"Error generating rebuild dates: {e}")
            dates = []
    elif rebuild:
        print("Rebuild flag False: running 'latest_event_positions' to obtain dates")
        try:
            sec_sql = _get_section_sql('latest_event_positions', filename)
            flat = flatten_sql(sec_sql)
            try:
                if sec_sql.lstrip().lower().startswith('select'):
                    cursor.execute(flat)
                    dates = [r[0] for r in cursor.fetchall()]
                else:
                    cursor.executescript(flat)
                    conn.commit()
                    try:
                        cursor.execute(flat)
                        dates = [r[0] for r in cursor.fetchall()]
                    except Exception:
                        dates = []
            except Exception as e_sel:
                raise RuntimeError(f"Failed to execute section 'latest_event_positions': {e_sel}")
        except Exception as e:
            print(f"Error generating latest dates: {e}")
            dates = []

    # Loop over the produced dates and run athlete processing for each
    if rebuild:
        for formatted_date in dates:
            try:
                process_athlete_sections(formatted_date, period=15, sqlite_cursor=cursor, render_cursor=render_cursor,update_athletes=buildAthletes,skip_coeff_updates=skip_coeff_updates,event_code=event_code,all_athletes=all_athletes,no_volunteers=no_volunteers,leave_athlete_postgres=leave_athlete_postgres,driver=driver,Scraper=Scraper,no_parkrun_postgres=no_parkrun_postgres,scraper_only=scraper_only, refresh_materialized_view=refresh_materialized_view, rebuild_materialized_views_from_definitions=rebuild_materialized_views_from_definitions, run_sql_pipeline=run_sql_pipeline, update_curve_rankings=update_curve_rankings, update_curve_rank_range_summary=update_curve_rank_range_summary, resume_curve_from_stage2=resume_curve_from_stage2, resume_curve_from_all_history=resume_curve_from_all_history)
            except Exception as e:
                print(f"Error processing athletes for {formatted_date}: {e}")
    if not rebuild:
        #print(f"Processing Athletes") 
        #process_athlete_sections("2025-11-29", period=15, sqlite_cursor=cursor, render_cursor=render_cursor)
        #process_athlete_sections("2025-12-06", period=15, sqlite_cursor=cursor, render_cursor=render_cursor)
        process_athlete_sections(start_date, period=15, sqlite_cursor=cursor, render_cursor=render_cursor,skip_coeff_updates=skip_coeff_updates,event_code=event_code,all_athletes=all_athletes,no_volunteers=no_volunteers,Scraper=Scraper,leave_athlete_postgres=leave_athlete_postgres,no_parkrun_postgres=no_parkrun_postgres,scraper_only=scraper_only, refresh_materialized_view=refresh_materialized_view, rebuild_materialized_views_from_definitions=rebuild_materialized_views_from_definitions, run_sql_pipeline=run_sql_pipeline, update_curve_rankings=update_curve_rankings, update_curve_rank_range_summary=update_curve_rank_range_summary, resume_curve_from_stage2=resume_curve_from_stage2, resume_curve_from_all_history=resume_curve_from_all_history) 

    # close base pipeline transactions before optional historic rebuild
    conn.commit()

    if rebuild_historic_after_run:
        resolved_historic_end_date = historic_rebuild_end_date or _last_completed_saturday_iso()
        rebuild_copy = bool(historic_rebuild_copy_to_postgres and not no_parkrun_postgres)
        print(
            "Running post-run historic rebuild: "
            f"start_date={start_date}, end_date={resolved_historic_end_date}, "
            f"event_code={event_code}, batch_size={historic_rebuild_batch_size}, "
            f"copy_to_postgres={rebuild_copy}"
        )
        rebuild_curve_historic_from_current(
            start_date=start_date,
            end_date=resolved_historic_end_date,
            event_code=event_code,
            copy_to_postgres=rebuild_copy,
            batch_size=historic_rebuild_batch_size,
        )

    conn.close()
    render_db_conn.close()


if __name__ == '__main__':
    
    # ok so that the curve ranked get calculated after the materialized view refresh,it needs to upload the eventpositions to postgres, so we need to make sure that happens in the right order in the pipeline. The simplest way to achieve this is to run the full pipeline but with a start date of 2026-04-18 (the date of the last processed event) - this will cause it to run through all the steps but only for that date, and then we can verify that the curve ranks are calculated and copied to postgres correctly for that date. Once we have verified that, we can then run the full pipeline for all dates up to the current date.
    #run_simple_sql_loop(start_date="2026-04-18",
    #    rebuild=True, # if True runs the full sequence of SQL sections to rebuild all event positions from the start date - this is the default and normal mode of operation. If False, only runs the scraper and materialized view refresh for the provided start_date (and optional end_date) - this is useful for testing and reprocessing specific dates without running the full SQL pipeline.
    #    run_sql_pipeline=False, # this is the main bulk of the processing - set to False to skip and just run scraper and materialized view refresh
    #    buildAthletes=False,  ## athlete update block is very heavy to run - set to False to skip
    #    skip_coeff_updates=True, ## coeffiecient update off for testing - set to True to skip
    #    no_parkrun_postgres=True, ##skips copying parkrun data to postgres
    #    event_code=None, ## optional filter to pass into scraper and SQL to restrict to a specific event
    #    Scraper=True, ## runs at the end of each processed date
    #    all_athletes=True, ## passes into scraper to control whether all athletes or just those in the event range are scraped/updated
    #    leave_athlete_postgres=False, ## skips copying athlete table to postgres - this is important tokeep the athlete_totals aligned
    #    no_volunteers=False, ## volunteer scraping
    #    refresh_materialized_view=True ## skips refreshing materialized views after processing each date (can be done as a separate step after all processing is done
    #    ) 
    run_simple_sql_loop(start_date="2026-05-30",
        rebuild=True, # if True runs the full sequence of SQL sections to rebuild all event positions from the start date - this is the default and normal mode of operation. If False, only runs the scraper and materialized view refresh for the provided start_date (and optional end_date) - this is useful for testing and reprocessing specific dates without running the full SQL pipeline.
        run_sql_pipeline=True, # this is the main bulk of the processing - set to False to skip and just run scraper and materialized view refresh
        buildAthletes=True,  ## athlete update block is very heavy to run - set to False to skip
        skip_coeff_updates=False, ## coeffiecient update off for testing - set to True to skip
        no_parkrun_postgres=False, ##skips copying parkrun data to postgres
        event_code=None, ## optional filter to pass into scraper and SQL to restrict to a specific event
        Scraper=True, ## runs at the end of each processed date
        all_athletes=True, ## passes into scraper to control whether all athletes or just those in the event range are scraped/updated
        leave_athlete_postgres=False, ## skips copying athlete table to postgres - this is important tokeep the athlete_totals aligned
        no_volunteers=False, ## volunteer scraping
        refresh_materialized_view=True, ## skips refreshing materialized views after processing each date (can be done as a separate step after all processing is done
        rebuild_historic_after_run=False ## recomputes historic as prior-best after weekly run
        ) 
    #run_simple_sql_loop(
    #    start_date="2026-04-11",
    #    rebuild=True,
    #    run_sql_pipeline=False,      # key change: skip pipeline, start from upload stage
    #    buildAthletes=True,
    #    skip_coeff_updates=False,    # ignored when run_sql_pipeline=False
    #    no_parkrun_postgres=False,
    #    event_code=None,
    #    Scraper=True,
    #    all_athletes=True,
    #    leave_athlete_postgres=False,
    #    no_volunteers=False,
    #    refresh_materialized_view=True
    #    )
    #run_simple_sql_loop(start_date="2026-04-18",
    #    rebuild=True, # if True runs the full sequence of SQL sections to rebuild all event positions from the start date - this is the default and normal mode of operation. If False, only runs the scraper and materialized view refresh for the provided start_date (and optional end_date) - this is useful for testing and reprocessing specific dates without running the full SQL pipeline.
    #    run_sql_pipeline=True, # this is the main bulk of the processing - set to False to skip and just run scraper and materialized view refresh
    #    buildAthletes=True,  ## athlete update block is very heavy to run - set to False to skip
    #    skip_coeff_updates=False, ## coeffiecient update off for testing - set to True to skip
    #    no_parkrun_postgres=False, ##skips copying parkrun data to postgres
    #    event_code=1, ## optional filter to pass into scraper and SQL to restrict to a specific event
    #    Scraper=True, ## runs at the end of each processed date
    #    all_athletes=True, ## passes into scraper to control whether all athletes or just those in the event range are scraped/updated
    #    leave_athlete_postgres=False, ## skips copying athlete table to postgres - this is important tokeep the athlete_totals aligned
    #    no_volunteers=False, ## volunteer scraping
    #    refresh_materialized_view=True ## skips refreshing materialized views after processing each date (can be done as a separate step after all processing is done
    #    )  
    
    #run_simple_sql_loop(rebuild=False,start_date="2026-02-14",all_athletes=True) #check existing athlete have updated for total_runs 
    #run_simple_sql_loop(rebuild=False,start_date="2026-02-14",skip_coeff_updates=True,leave_athlete_postgres=True,Scraper=False,no_volunteers=True,all_athletes=False)
    #run_simple_sql_loop(rebuild=False,start_date="2026-02-14",skip_coeff_updates=True)
        
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2026-02-14",event_code=18,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2025-12-06",end_date="2025-12-06",skip_coeff_updates=True,event_code=7,all_athletes=True,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2023-05-06",end_date="2023-05-06",skip_coeff_updates=True,event_code=19,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2023-11-04",end_date="2023-11-04",skip_coeff_updates=True,event_code=10,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2024-02-03",end_date="2024-02-03",skip_coeff_updates=True,event_code=18,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2024-05-18",end_date="2024-05-18",skip_coeff_updates=True,event_code=19,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
    #run_simple_sql_loop(rebuild=True,buildAthletes=True,start_date="2025-11-15",end_date="2025-11-15",skip_coeff_updates=True,event_code=23,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,driver=create_webdriver())
 
    #run_simple_sql_loop(rebuild=False,start_date="2012-01-01")
    #run_simple_sql_loop(rebuild=True,buildAthletes=False,start_date="2011-05-21",end_date="2011-05-21",skip_coeff_updates=True,event_code=25,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,Scraper=False,no_parkrun_postgres=True,refresh_materialized_view=False)
    #run_simple_sql_loop(rebuild=True,buildAthletes=False,start_date="2011-05-21",end_date="2011-05-21",skip_coeff_updates=True,event_code=25,all_athletes=False,no_volunteers=True,leave_athlete_postgres=True,Scraper=False,no_parkrun_postgres=True)
 
    #run_simple_sql_loop(rebuild=False,start_date='2025-11-29',skip_coeff_updates=True)
    #run_simple_sql_loop(rebuild=False,start_date='2025-12-06',skip_coeff_updates=True)
    #run_simple_sql_loop(rebuild=False,start_date='2025-12-13',skip_coeff_updates=True)
    #run_simple_sql_loop(rebuild=False,start_date='2025-12-20',skip_coeff_updates=True)
    #run_simple_sql_loop(rebuild=False,start_date='2025-12-25',skip_coeff_updates=True)
    #run_simple_sql_loop(rebuild=False,start_date='2025-12-27',skip_coeff_updates=True)

    #run_simple_sql_loop(rebuild=False,start_date="2026-01-24", all_athletes=True, scraper_only=True) 

    #python -c "from newAnalytics import run_curve_latest; 
    #     run_curve_latest(date_override='2026-04-04', copy_to_postgres=True)"
    #python -c "from newAnalytics import run_curve_backfill_today; run_curve_backfill_today(copy_to_postgres=True)"

    #python -c "from newAnalytics import run_curve_rank_updates_only; run_curve_rank_updates_only(start_date='2026-04-18', end_date='2026-04-18', event_code=None, missing_only=False, descending=True, copy_to_postgres=False)"

    #To manually update MV
    #C:/Users/stevi/AppData/Local/Programs/Python/Python312/python.exe scripts/refresh_mvs_verify.py



   




