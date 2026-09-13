from __future__ import annotations

from datetime import datetime, timedelta
from time import perf_counter, sleep
from typing import List, Optional, Sequence, Tuple
import math
import os
import csv
import json
import sqlite3
import threading

from etl.analytics import copy_table_to_postgres
from scripts.database_helpers import connections


PROJECT_ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, os.pardir, os.pardir)))


METRIC_TYPES: Tuple[str, ...] = ("B", "E", "ES", "AE", "AES")
METRIC_PRIORITY = {
    "B": 1,
    "E": 2,
    "ES": 3,
    "AE": 4,
    "AES": 5,
}

CURVE_REFERENCE_DEFAULT_X = 23
CURVE_REFERENCE_DEFAULT_START_SEC = (12 * 60 + 30)
CURVE_REFERENCE_DEFAULT_END_SEC = (59 * 60 + 59)
CURVE_REFERENCE_DEFAULT_MIN_APPEARANCES = 1
CURVE_REFERENCE_INTERNAL_PRECISION = 4
CURVE_REFERENCE_BAND_DENOMINATOR = 5151.0
CURVE_HISTORY_OUTPUT_PRECISION = 1
CURVE_ATHLETE_HISTORY_WEEKLY_BACKFILL_WEEKS = 3

EVENTPOSITION_CURVE_RANK_COLUMNS: Tuple[Tuple[str, str], ...] = (
    ("current_best_rank_b", "NUMERIC(6,1)"),
    ("current_best_rank_e", "NUMERIC(6,1)"),
    ("current_best_rank_es", "NUMERIC(6,1)"),
    ("current_best_rank_ae", "NUMERIC(6,1)"),
    ("current_best_rank_aes", "NUMERIC(6,1)"),
    ("event_rank_b", "NUMERIC(6,1)"),
    ("event_rank_e", "NUMERIC(6,1)"),
    ("event_rank_es", "NUMERIC(6,1)"),
    ("event_rank_ae", "NUMERIC(6,1)"),
    ("event_rank_aes", "NUMERIC(6,1)"),
    ("best_curve_ranking_current", "NUMERIC(6,1)"),
    ("best_curve_ranking_historic", "NUMERIC(6,1)"),
    ("best_curve_ranking_current_type", "TEXT"),
)

EVENTPOSITION_CURVE_RANK_FIELDS: Tuple[str, ...] = tuple(col_name for col_name, _ in EVENTPOSITION_CURVE_RANK_COLUMNS)
POSTGRES_CURVE_RANK_FIELDS: Tuple[str, ...] = EVENTPOSITION_CURVE_RANK_FIELDS

CURVE_ATHLETE_BEST_RANK_HISTORY_OBSOLETE_COLUMNS: Tuple[str, ...] = (
    "current_best_rank_s",
    "current_best_rank_a",
    "current_best_rank_x",
    "current_best_rank_as",
    "historic_best_rank_s",
    "historic_best_rank_a",
    "historic_best_rank_x",
    "historic_best_rank_as",
    "historic_best_rank_1Y_s",
    "historic_best_rank_1Y_a",
    "historic_best_rank_1Y_x",
    "historic_best_rank_1Y_as",
)


def _ts() -> float:
    return perf_counter()


def _log_timing(label: str, started: float) -> float:
    elapsed = perf_counter() - started
    print(f"[curved_ranks][timing] {label}: {elapsed:.2f}s")
    return elapsed


def _normalize_iso_date(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip().replace("//", "/")
    if not raw:
        return None
    if "-" in raw and raw.count("-") == 2:
        parts = raw.split("-")
        if len(parts[0]) == 4:
            return raw
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    if "/" in raw and raw.count("/") == 2:
        d, m, y = raw.split("/")
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return raw


def _iso_expr(col: str) -> str:
    return f"(substr({col}, 7, 4) || '-' || substr({col}, 4, 2) || '-' || substr({col}, 1, 2))"


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _write_json(path: str, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def _write_csv(path: str, headers: Sequence[str], rows: Sequence[Sequence]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(list(headers))
        for r in rows:
            w.writerow(list(r))


def _append_csv_row(path: str, headers: Sequence[str], row: Sequence) -> None:
    is_new = not os.path.exists(path)
    with open(path, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if is_new:
            w.writerow(list(headers))
        w.writerow(list(row))


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


def _execute_with_retry(sqlite_conn, sql: str, params: dict = None, max_retries: int = 5) -> None:
    """Execute SQL with retry logic for database locks."""
    if params is None:
        params = {}
    cur = sqlite_conn.cursor()
    last_error = None
    for attempt in range(max_retries):
        try:
            cur.execute(sql, params)
            cur.close()
            return
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                last_error = e
                wait = (2 ** attempt) * 0.1  # exponential backoff: 0.1s, 0.2s, 0.4s, 0.8s, 1.6s
                print(f"[curved_ranks] Database locked, retry {attempt + 1}/{max_retries} after {wait}s")
                sleep(wait)
            else:
                cur.close()
                raise
    cur.close()
    if last_error:
        raise last_error


def _execute_with_progress(
    sqlite_conn,
    cur,
    sql: str,
    params: dict = None,
    label: str = "sql",
    heartbeat_seconds: float = 5.0,
    vm_steps: int = 250000,
) -> None:
    """Execute SQL with periodic heartbeat output so long operations show progress."""
    if params is None:
        params = {}

    started = perf_counter()
    last_log = [started]
    print(f"[curved_ranks] {label} started", flush=True)

    def _progress_handler() -> int:
        now = perf_counter()
        if now - last_log[0] >= heartbeat_seconds:
            print(f"[curved_ranks] {label} still running... {now - started:.0f}s elapsed", flush=True)
            last_log[0] = now
        return 0

    try:
        sqlite_conn.set_progress_handler(_progress_handler, vm_steps)
        cur.execute(sql, params)
    finally:
        sqlite_conn.set_progress_handler(None, 0)
    print(f"[curved_ranks] {label} complete in {perf_counter() - started:.1f}s", flush=True)


def _start_heartbeat(label: str, interval_seconds: float = 15.0, on_tick=None):
    """Start periodic heartbeat logs while a long synchronous operation runs."""
    started = perf_counter()
    stop_event = threading.Event()

    def _run() -> None:
        while not stop_event.wait(interval_seconds):
            elapsed = int(perf_counter() - started)
            print(f"[curved_ranks] {label} still running... {elapsed}s elapsed", flush=True)
            if on_tick is not None:
                try:
                    on_tick(elapsed)
                except Exception:
                    pass

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return stop_event, thread, started


def _stop_heartbeat(stop_event, thread, started: float, label: str) -> None:
    stop_event.set()
    try:
        thread.join(timeout=1.0)
    except Exception:
        pass
    elapsed = perf_counter() - started
    print(f"[curved_ranks] {label} complete in {elapsed:.1f}s", flush=True)





def _ensure_sqlite_math_functions(sqlite_conn) -> None:
    to_register = []
    def _safe_floor(x):
        if x is None:
            return None
        try:
            value = float(x)
            if math.isnan(value) or math.isinf(value):
                return None
            return math.floor(value)
        except Exception:
            return None

    def _safe_ln(x):
        if x is None:
            return None
        try:
            value = float(x)
            if value <= 0 or math.isnan(value) or math.isinf(value):
                return None
            return math.log(value)
        except Exception:
            return None

    def _safe_sqrt(x):
        if x is None:
            return None
        try:
            value = float(x)
            if value < 0 or math.isnan(value) or math.isinf(value):
                return None
            return math.sqrt(value)
        except Exception:
            return None

    if not _sqlite_has_function(sqlite_conn, "SELECT FLOOR(1.5)"):
        to_register.append(("FLOOR", 1, _safe_floor))
    if not _sqlite_has_function(sqlite_conn, "SELECT LN(2.0)"):
        to_register.append(("LN", 1, _safe_ln))
    if not _sqlite_has_function(sqlite_conn, "SELECT EXP(1.0)"):
        def _safe_exp(x):
            if x is None:
                return None
            try:
                return math.exp(float(x))
            except Exception:
                return None
        to_register.append(("EXP", 1, _safe_exp))
    if not _sqlite_has_function(sqlite_conn, "SELECT SQRT(2.0)"):
        to_register.append(("SQRT", 1, _safe_sqrt))
    if not _sqlite_has_function(sqlite_conn, "SELECT POWER(2.0, 3.0)"):
        def _safe_power(x, y):
            if x is None or y is None:
                return None
            try:
                return math.pow(float(x), float(y))
            except Exception:
                return None
        to_register.append(("POWER", 2, _safe_power))

    for fn_name, arg_count, fn_callable in to_register:
        sqlite_conn.create_function(fn_name, arg_count, fn_callable)
        print(f"[curved_ranks] registered sqlite function {fn_name}/{arg_count}")


def _ensure_stage_tables(sqlite_conn) -> None:
    cur = sqlite_conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_run_metrics_history (
            event_code INTEGER NOT NULL,
            event_date TEXT NOT NULL,
            formatted_date TEXT NOT NULL,
            athlete_code TEXT NOT NULL,
            position INTEGER NOT NULL,
            metric_type TEXT NOT NULL,
            metric_seconds REAL NOT NULL,
            PRIMARY KEY (event_code, event_date, athlete_code, position, metric_type)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_run_metrics_formatted_date ON curve_run_metrics_history(formatted_date)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_run_metrics_metric ON curve_run_metrics_history(metric_type, metric_seconds, athlete_code)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_run_metrics_snapshot_athlete_metric ON curve_run_metrics_history(formatted_date, athlete_code, metric_type, metric_seconds)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_run_metrics_athlete_metric_snapshot ON curve_run_metrics_history(athlete_code, metric_type, formatted_date, metric_seconds)"
    )

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='curve_rank_mapping_history'")
    has_mapping_table = bool(cur.fetchone())

    if has_mapping_table:
        cur.execute("PRAGMA table_info(curve_rank_mapping_history)")
        mapping_cols = {str(row[1]).lower(): row for row in cur.fetchall()}
        needs_migration = (
            "athlete_code" in mapping_cols
            or "best_metric_seconds" not in mapping_cols
            or "freq" not in mapping_cols
            or "cum_before" not in mapping_cols
            or "total_freq" not in mapping_cols
            or "weighted_percentile" not in mapping_cols
        )
        if needs_migration:
            cur.execute("DROP TABLE IF EXISTS curve_rank_mapping_history")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_rank_mapping_history (
            snapshot_date TEXT NOT NULL,
            period_type TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            best_metric_seconds REAL NOT NULL,
            freq INTEGER NOT NULL,
            cum_before REAL NOT NULL,
            total_freq INTEGER NOT NULL,
            weighted_percentile REAL NOT NULL,
            rank INTEGER,
            PRIMARY KEY (snapshot_date, period_type, metric_type, best_metric_seconds)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_rank_mapping_snapshot ON curve_rank_mapping_history(snapshot_date, period_type, metric_type)"
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_athlete_rank_summary_history (
            snapshot_date TEXT NOT NULL,
            athlete_code TEXT NOT NULL,
            best_curve_ranking_current INTEGER,
            best_curve_ranking_historic INTEGER,
            best_curve_ranking_current_type TEXT,
            PRIMARY KEY (snapshot_date, athlete_code)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_athlete_rank_summary_snapshot ON curve_athlete_rank_summary_history(snapshot_date)"
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_athlete_best_rank_history (
            snapshot_date TEXT NOT NULL,
            athlete_code TEXT NOT NULL,
            event_rank_b REAL,
            event_rank_e REAL,
            event_rank_es REAL,
            event_rank_ae REAL,
            event_rank_aes REAL,
            current_best_rank_b REAL,
            current_best_rank_e REAL,
            current_best_rank_es REAL,
            current_best_rank_ae REAL,
            current_best_rank_aes REAL,
            historic_best_rank_b REAL,
            historic_best_rank_e REAL,
            historic_best_rank_es REAL,
            historic_best_rank_ae REAL,
            historic_best_rank_aes REAL,
            historic_best_rank_1Y_b REAL,
            historic_best_rank_1Y_e REAL,
            historic_best_rank_1Y_es REAL,
            historic_best_rank_1Y_ae REAL,
            historic_best_rank_1Y_aes REAL,
            best_curve_ranking_current REAL,
            best_curve_ranking_historic REAL,
            best_curve_ranking_current_type TEXT,
            PRIMARY KEY (snapshot_date, athlete_code)
        )
        """
    )
    cur.execute("PRAGMA table_info(curve_athlete_best_rank_history)")
    best_rank_history_cols = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name in (
        "event_rank_b",
        "event_rank_e",
        "event_rank_es",
        "event_rank_ae",
        "event_rank_aes",
    ):
        if col_name.lower() not in best_rank_history_cols:
            cur.execute(f"ALTER TABLE curve_athlete_best_rank_history ADD COLUMN {col_name} REAL")
    cur.execute("PRAGMA table_info(curve_athlete_best_rank_history)")
    best_rank_history_cols = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name in (
        "historic_best_rank_1Y_b",
        "historic_best_rank_1Y_e",
        "historic_best_rank_1Y_es",
        "historic_best_rank_1Y_ae",
        "historic_best_rank_1Y_aes",
    ):
        if col_name.lower() not in best_rank_history_cols:
            cur.execute(f"ALTER TABLE curve_athlete_best_rank_history ADD COLUMN {col_name} REAL")

    # Remove deprecated metric-family columns so they do not linger after migration.
    cur.execute("PRAGMA table_info(curve_athlete_best_rank_history)")
    best_rank_history_cols = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name in CURVE_ATHLETE_BEST_RANK_HISTORY_OBSOLETE_COLUMNS:
        if col_name.lower() in best_rank_history_cols:
            try:
                cur.execute(f"ALTER TABLE curve_athlete_best_rank_history DROP COLUMN {col_name}")
            except Exception:
                # Older SQLite versions may not support DROP COLUMN.
                pass

    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_athlete_best_rank_snapshot ON curve_athlete_best_rank_history(snapshot_date)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_athlete_best_rank_athlete_snapshot ON curve_athlete_best_rank_history(athlete_code, snapshot_date)"
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_athlete_metric_rank_history (
            snapshot_date TEXT NOT NULL,
            athlete_code TEXT NOT NULL,
            period_type TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            best_metric_seconds REAL,
            rank INTEGER,
            PRIMARY KEY (snapshot_date, athlete_code, period_type, metric_type)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_athlete_metric_rank_snapshot ON curve_athlete_metric_rank_history(snapshot_date, period_type, metric_type)"
    )

    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='curve_time_ranks_reference'"
    )
    has_time_ref_table = bool(cur.fetchone())

    if has_time_ref_table:
        cur.execute("PRAGMA table_info(curve_time_ranks_reference)")
        time_ref_cols = {str(row[1]).lower() for row in cur.fetchall()}
        # Rebuild if old schema still includes repeated metadata columns.
        if {
            "snapshot_date",
            "x_value",
            "start_sec",
            "end_sec",
            "created_at",
        } & time_ref_cols:
            cur.execute("DROP TABLE IF EXISTS curve_time_ranks_reference")
        # Rebuild if compact schema uses old metric_seconds/metric_mmss names.
        elif "metric_seconds" in time_ref_cols or "metric_mmss" in time_ref_cols:
            cur.execute("DROP TABLE IF EXISTS curve_time_ranks_reference")
        elif {"second", "time", "linear_rank", "curved_rank"} & time_ref_cols:
            cur.execute("DROP TABLE IF EXISTS curve_time_ranks_reference")
        elif "curve_rank_reference_version" not in time_ref_cols:
            cur.execute("DROP TABLE IF EXISTS curve_time_ranks_reference")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS curve_time_ranks_reference (
            metric_type TEXT NOT NULL,
            curve_rank_group INTEGER NOT NULL,
            curve_rank_reference_version TEXT NOT NULL,
            min_seconds INTEGER,
            max_seconds INTEGER,
            min_time TEXT,
            max_time TEXT,
            target_group_cnt REAL,
            actual_group_cnt INTEGER,
            score_upper REAL,
            score_lower REAL,
            PRIMARY KEY (metric_type, curve_rank_group)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_curve_time_ranks_reference_metric ON curve_time_ranks_reference(metric_type, max_seconds, curve_rank_group)"
    )

    cur.execute("PRAGMA table_info(eventpositions)")
    existing = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name, col_type in EVENTPOSITION_CURVE_RANK_COLUMNS:
        if col_name.lower() not in existing:
            cur.execute(f"ALTER TABLE eventpositions ADD COLUMN {col_name} {col_type}")

    # Best effort cleanup: historic per-metric columns are no longer written to eventpositions.
    obsolete_eventposition_cols = (
        "current_best_rank_s",
        "current_best_rank_a",
        "current_best_rank_x",
        "current_best_rank_as",
        "historic_best_rank_b",
        "historic_best_rank_s",
        "historic_best_rank_e",
        "historic_best_rank_a",
        "historic_best_rank_x",
        "historic_best_rank_as",
        "historic_best_rank_es",
        "historic_best_rank_ae",
        "historic_best_rank_aes",
    )
    cur.execute("PRAGMA table_info(eventpositions)")
    existing_after_add = {str(row[1]).lower() for row in cur.fetchall()}
    for col_name in obsolete_eventposition_cols:
        if col_name in existing_after_add:
            try:
                cur.execute(f"ALTER TABLE eventpositions DROP COLUMN {col_name}")
            except Exception:
                # Older SQLite versions may not support DROP COLUMN.
                pass

    sqlite_conn.commit()
    cur.close()


def _ensure_postgres_eventpositions_curve_rank_columns() -> None:
    conn = None
    render_db_conn = None
    render_cursor = None
    try:
        conn, _, render_db_conn, render_cursor = connections()
        render_cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'eventpositions'
            """
        )
        existing = {str(row[0]).lower() for row in render_cursor.fetchall() if row and row[0]}
        for col_name, col_type in EVENTPOSITION_CURVE_RANK_COLUMNS:
            if col_name.lower() not in existing:
                print(f"[curved_ranks] Postgres DDL: ADD COLUMN {col_name} {col_type}")
                render_cursor.execute(f"ALTER TABLE eventpositions ADD COLUMN {col_name} {col_type}")

        # Ensure existing rank columns are decimal-friendly and normalized to 1dp.
        # If a dependent view/materialized view blocks type changes, continue and log guidance.
        try:
            for col_name in (
                "current_best_rank_b",
                "current_best_rank_e",
                "current_best_rank_es",
                "current_best_rank_ae",
                "current_best_rank_aes",
                "best_curve_ranking_current",
                "best_curve_ranking_historic",
            ):
                print(
                    f"[curved_ranks] Postgres DDL: ALTER COLUMN {col_name} TYPE NUMERIC(6,1)"
                )
                render_cursor.execute(
                    f"""
                    ALTER TABLE eventpositions
                    ALTER COLUMN {col_name} TYPE NUMERIC(6,1)
                    USING ROUND({col_name}::numeric, 1)
                    """
                )
        except Exception as ex:
            print(
                "[curved_ranks] Postgres type migration skipped for eventpositions curve rank columns: "
                f"{ex}. Drop/recreate dependent materialized views (for example mv_extend_runs) "
                "then rerun the migration."
            )

        obsolete_eventposition_cols = (
            "current_best_rank_s",
            "current_best_rank_a",
            "current_best_rank_x",
            "current_best_rank_as",
            "historic_best_rank_b",
            "historic_best_rank_s",
            "historic_best_rank_e",
            "historic_best_rank_a",
            "historic_best_rank_x",
            "historic_best_rank_as",
            "historic_best_rank_es",
            "historic_best_rank_ae",
            "historic_best_rank_aes",
        )
        for col_name in obsolete_eventposition_cols:
            try:
                print(f"[curved_ranks] Postgres DDL: DROP COLUMN IF EXISTS {col_name}")
                render_cursor.execute(f"ALTER TABLE eventpositions DROP COLUMN IF EXISTS {col_name}")
            except Exception:
                pass
        render_db_conn.commit()
    finally:
        try:
            if render_cursor is not None:
                render_cursor.close()
        except Exception:
            pass
        try:
            if render_db_conn is not None:
                render_db_conn.close()
        except Exception:
            pass
        try:
            if conn is not None:
                conn.close()
        except Exception:
            pass


def _get_max_event_date(sqlite_conn) -> Optional[str]:
    cur = sqlite_conn.cursor()
    cur.execute(f"SELECT MAX({_iso_expr('event_date')}) FROM parkrun_events")
    row = cur.fetchone()
    cur.close()
    if not row or not row[0]:
        return None
    return str(row[0])


def _get_snapshot_dates(sqlite_conn, start_date: Optional[str], end_date: str) -> List[str]:
    cur = sqlite_conn.cursor()
    params = {"end_date": end_date}
    where = [f"{_iso_expr('event_date')} <= :end_date"]
    if start_date:
        where.append(f"{_iso_expr('event_date')} >= :start_date")
        params["start_date"] = start_date

    sql = f"""
        SELECT DISTINCT {_iso_expr('event_date')} AS formatted_date
        FROM parkrun_events
        WHERE {' AND '.join(where)}
        ORDER BY formatted_date ASC
    """
    cur.execute(sql, params)
    out = [str(r[0]) for r in cur.fetchall() if r and r[0]]
    cur.close()
    return out


def _resolve_curve_reference_version(sqlite_conn, snapshot_date: Optional[str]) -> str:
    cur = sqlite_conn.cursor()
    try:
        if snapshot_date:
            cur.execute(
                "SELECT MAX(formatted_date) FROM curve_run_metrics_history WHERE formatted_date <= :snapshot_cutoff",
                {"snapshot_cutoff": snapshot_date},
            )
        else:
            cur.execute("SELECT MAX(formatted_date) FROM curve_run_metrics_history")
        row = cur.fetchone()
        resolved = str(row[0]) if row and row[0] else None
        return resolved or (_normalize_iso_date(snapshot_date) or "unknown")
    finally:
        cur.close()


def _rebuild_stage1(
    sqlite_conn,
    upto_date: str,
    full_rebuild: bool,
    rolling_weeks: int = 15,
) -> None:
    started = _ts()
    cur = sqlite_conn.cursor()

    if full_rebuild:
        print(f"[curved_ranks] Stage 1 full rebuild up to {upto_date}")
        cur.execute("DELETE FROM curve_run_metrics_history")
        params = {"start_date": None, "end_date": upto_date}
        date_filter = f"{_iso_expr('e.event_date')} <= :end_date"
    else:
        cutoff = (datetime.strptime(upto_date, "%Y-%m-%d") - timedelta(days=7 * int(rolling_weeks))).strftime("%Y-%m-%d")
        print(f"[curved_ranks] Stage 1 rolling rebuild from {cutoff} to {upto_date}")
        cur.execute(
            "DELETE FROM curve_run_metrics_history WHERE formatted_date BETWEEN :start_date AND :end_date",
            {"start_date": cutoff, "end_date": upto_date},
        )
        params = {"start_date": cutoff, "end_date": upto_date}
        date_filter = f"{_iso_expr('e.event_date')} BETWEEN :start_date AND :end_date"

    sql = f"""
        INSERT OR REPLACE INTO curve_run_metrics_history (
            event_code, event_date, formatted_date, athlete_code, position, metric_type, metric_seconds
        )
        WITH base AS (
            SELECT
                e.event_code,
                e.event_date,
                {_iso_expr('e.event_date')} AS formatted_date,
                e.athlete_code,
                e.position,
                e.time_seconds,
                p.coeff,
                p.coeff_event,
                e.age_ratio_male,
                e.age_ratio_sex
            FROM eventpositions e
            JOIN parkrun_events p
              ON p.event_code = e.event_code
             AND p.event_date = e.event_date
            WHERE e.time_seconds IS NOT NULL
              AND {date_filter}
        )
        SELECT event_code, event_date, formatted_date, athlete_code, position, 'B' AS metric_type,
               CAST(time_seconds AS REAL) AS metric_seconds
        FROM base

        UNION ALL
        SELECT event_code, event_date, formatted_date, athlete_code, position, 'E',
               MAX(
                   COALESCE(
                       time_seconds / COALESCE(NULLIF(COALESCE(NULLIF(coeff, 0), 1.0) + COALESCE(NULLIF(coeff_event, 0), 1.0) - 1.0, 0), 1.0),
                       0
                   ),
                   769.0
               )
        FROM base

        UNION ALL
        SELECT event_code, event_date, formatted_date, athlete_code, position, 'A',
               MAX(
                   COALESCE(
                       time_seconds / NULLIF(age_ratio_male, 0),
                       0
                   ),
                   769.0
               )
        FROM base
        WHERE age_ratio_sex IS NOT NULL

        UNION ALL
         SELECT event_code, event_date, formatted_date, athlete_code, position, 'ES',
             MAX(
                   COALESCE(
                       time_seconds /
                       COALESCE(NULLIF(COALESCE(NULLIF(coeff, 0), 1.0) + COALESCE(NULLIF(coeff_event, 0), 1.0) - 1.0, 0), 1.0)
                       /
                       NULLIF((age_ratio_sex / NULLIF(age_ratio_male, 0)), 0),
                       0
                   ),
                   769.0
               )
        FROM base
        WHERE age_ratio_male IS NOT NULL AND age_ratio_sex IS NOT NULL

        UNION ALL
         SELECT event_code, event_date, formatted_date, athlete_code, position, 'AE',
             MAX(
                   COALESCE(
                       time_seconds /
                       COALESCE(NULLIF(COALESCE(NULLIF(coeff, 0), 1.0) + COALESCE(NULLIF(coeff_event, 0), 1.0) - 1.0, 0), 1.0)
                       /
                       NULLIF(age_ratio_male, 0),
                       0
                   ),
                   769.0
               )
        FROM base
        WHERE age_ratio_male IS NOT NULL

        UNION ALL
         SELECT event_code, event_date, formatted_date, athlete_code, position, 'AES',
             MAX(
                   COALESCE(
                       time_seconds /
                       COALESCE(NULLIF(COALESCE(NULLIF(coeff, 0), 1.0) + COALESCE(NULLIF(coeff_event, 0), 1.0) - 1.0, 0), 1.0)
                       /
                       NULLIF(age_ratio_sex, 0),
                       0
                   ),
                   769.0
               )
        FROM base
        WHERE age_ratio_sex IS NOT NULL
    """

    _execute_with_progress(
        sqlite_conn=sqlite_conn,
        cur=cur,
        sql=sql,
        params=params,
        label="stage1 curve_run_metrics_history insert",
    )
    sqlite_conn.commit()

    cur.execute("SELECT COUNT(*) FROM curve_run_metrics_history")
    row_count = int(cur.fetchone()[0] or 0)
    cur.close()
    print(f"[curved_ranks] Stage 1 rows in curve_run_metrics_history={row_count}")
    _log_timing("stage1.rebuild", started)


def _build_stage2_for_date(sqlite_conn, snapshot_date: str) -> None:
    started = _ts()
    cur = sqlite_conn.cursor()

    cur.execute("DELETE FROM curve_rank_mapping_history")

    sql = """
        INSERT OR REPLACE INTO curve_rank_mapping_history (
            snapshot_date, period_type, metric_type, best_metric_seconds, freq, cum_before, total_freq, weighted_percentile, rank
        )
        WITH
        source_rows AS (
            SELECT
                :snapshot_date AS snapshot_date,
                'ALL' AS period_type,
                metric_type,
                athlete_code,
                event_code,
                event_date,
                formatted_date,
                position,
                metric_seconds
            FROM curve_run_metrics_history
            WHERE formatted_date <= :snapshot_date

            UNION ALL

            SELECT
                :snapshot_date AS snapshot_date,
                '1Y' AS period_type,
                metric_type,
                athlete_code,
                event_code,
                event_date,
                formatted_date,
                position,
                metric_seconds
            FROM curve_run_metrics_history
            WHERE formatted_date <= :snapshot_date
              AND formatted_date >= date(:snapshot_date, '-1 year')
        ),
        best_per_athlete AS (
            SELECT *
            FROM (
                SELECT
                    s.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.snapshot_date, s.period_type, s.metric_type, s.athlete_code
                        ORDER BY s.metric_seconds ASC, s.position ASC, s.formatted_date DESC, s.event_code
                    ) AS rn
                FROM source_rows s
            ) q
            WHERE q.rn = 1
        ),
        time_frequency AS (
            SELECT
                snapshot_date,
                period_type,
                metric_type,
                metric_seconds AS best_metric_seconds,
                COUNT(*) AS freq
            FROM best_per_athlete
            GROUP BY snapshot_date, period_type, metric_type, metric_seconds
        ),
        weighted AS (
            SELECT
                tf.snapshot_date,
                tf.period_type,
                tf.metric_type,
                tf.best_metric_seconds,
                tf.freq,
                COALESCE(
                    SUM(tf.freq) OVER (
                        PARTITION BY tf.snapshot_date, tf.period_type, tf.metric_type
                        ORDER BY tf.best_metric_seconds ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    0
                ) AS cum_before,
                SUM(tf.freq) OVER (
                    PARTITION BY tf.snapshot_date, tf.period_type, tf.metric_type
                ) AS total_freq
            FROM time_frequency tf
        ),
        banded AS (
            SELECT
                w.snapshot_date,
                w.period_type,
                w.metric_type,
                w.best_metric_seconds,
                w.freq,
                w.cum_before,
                w.total_freq,
                CASE
                    WHEN w.total_freq <= 1 THEN 0.0
                    ELSE MIN(1.0, MAX(0.0, (w.cum_before + ((w.freq - 1) / 2.0)) / (w.total_freq - 1.0)))
                END AS weighted_percentile,
                CASE
                    WHEN w.total_freq <= 0 THEN NULL
                    ELSE (
                        SQRT(
                            1.0 + 8.0 * (
                                (w.cum_before + ((w.freq + 1) / 2.0))
                                * CAST(:band_denominator AS REAL)
                                / w.total_freq
                            )
                        ) - 1.0
                    ) / 2.0
                END AS band_progress
            FROM weighted w
        ),
        ranked AS (
            SELECT
                b.snapshot_date,
                b.period_type,
                b.metric_type,
                b.best_metric_seconds,
                b.freq,
                b.cum_before,
                b.total_freq,
                b.weighted_percentile,
                CAST(
                    MAX(
                        0,
                        101 - (
                            CAST(b.band_progress AS INTEGER)
                            + CASE
                                WHEN b.band_progress IS NULL THEN 101
                                WHEN b.band_progress > CAST(b.band_progress AS INTEGER) THEN 1
                                ELSE 0
                            END
                        )
                    ) AS INTEGER
                ) AS rank
            FROM banded b
        )
        SELECT
            snapshot_date,
            period_type,
            metric_type,
            best_metric_seconds,
            freq,
            cum_before,
            total_freq,
            weighted_percentile,
            rank
        FROM ranked
    """
    cur.execute(
        sql,
        {
            "snapshot_date": snapshot_date,
            "band_denominator": float(CURVE_REFERENCE_BAND_DENOMINATOR),
        },
    )
    sqlite_conn.commit()

    cur.execute(
        "SELECT COUNT(*) FROM curve_rank_mapping_history WHERE snapshot_date = :snapshot_date",
        {"snapshot_date": snapshot_date},
    )
    rows = int(cur.fetchone()[0] or 0)
    cur.close()
    print(f"[curved_ranks] Stage 2 rows for {snapshot_date}={rows}")
    _log_timing(f"stage2.build ({snapshot_date})", started)


def _build_curve_time_ranks_reference_for_date(
    sqlite_conn,
    snapshot_date: Optional[str],
    x_value: float = CURVE_REFERENCE_DEFAULT_X,
    start_sec: int = CURVE_REFERENCE_DEFAULT_START_SEC,
    end_sec: int = CURVE_REFERENCE_DEFAULT_END_SEC,
    min_appearances: int = CURVE_REFERENCE_DEFAULT_MIN_APPEARANCES,
) -> int:
    started = _ts()
    cur = sqlite_conn.cursor()

    scope_label = snapshot_date if snapshot_date else "ALL"
    reference_version = _resolve_curve_reference_version(sqlite_conn, snapshot_date)

    params = {
        "snapshot_cutoff": snapshot_date,
        "reference_version": reference_version,
        "start_sec": int(start_sec),
        "end_sec": int(end_sec),
        "min_appearances": int(min_appearances),
        "band_denominator": float(CURVE_REFERENCE_BAND_DENOMINATOR),
        "reference_precision": int(CURVE_REFERENCE_INTERNAL_PRECISION),
    }

    # Keep only one compact reference set (all-history by default, or cutoff-specific when requested).
    cur.execute("DELETE FROM curve_time_ranks_reference")

    sql = """
        INSERT OR REPLACE INTO curve_time_ranks_reference (
            metric_type,
            curve_rank_group,
            curve_rank_reference_version,
            min_seconds,
            max_seconds,
            min_time,
            max_time,
            target_group_cnt,
            actual_group_cnt,
            score_upper,
            score_lower
        )
        WITH RECURSIVE
        params AS (
            SELECT
                CAST(:min_appearances AS INTEGER) AS min_appearances,
                CAST(:band_denominator AS REAL) AS band_denominator
        ),
        bands(curve_rank_group, band_weight) AS (
            SELECT 100, 1
            UNION ALL
            SELECT curve_rank_group - 1, band_weight + 1
            FROM bands
            WHERE curve_rank_group > 0
        ),
        eligible_athletes AS (
            SELECT
                c.athlete_code
            FROM curve_run_metrics_history c
            WHERE c.metric_type = 'B'
              AND c.metric_seconds IS NOT NULL
                            AND (:snapshot_cutoff IS NULL OR c.formatted_date <= :snapshot_cutoff)
            GROUP BY c.athlete_code
            HAVING COUNT(DISTINCT c.event_code || '|' || c.event_date) >= (SELECT min_appearances FROM params)
        ),
        athlete_best AS (
            SELECT
                c.metric_type,
                c.athlete_code,
                MIN(CAST(c.metric_seconds AS INTEGER)) AS metric_seconds
            FROM curve_run_metrics_history c
            JOIN eligible_athletes ea
              ON ea.athlete_code = c.athlete_code
            WHERE c.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
              AND c.metric_seconds IS NOT NULL
              AND (:snapshot_cutoff IS NULL OR c.formatted_date <= :snapshot_cutoff)
            GROUP BY c.metric_type, c.athlete_code
        ),
        time_frequency AS (
            SELECT
                metric_type,
                metric_seconds,
                COUNT(*) AS freq
            FROM athlete_best
            GROUP BY metric_type, metric_seconds
        ),
        weighted AS (
            SELECT
                tf.metric_type,
                tf.metric_seconds,
                tf.freq,
                COALESCE(
                    SUM(tf.freq) OVER (
                        PARTITION BY tf.metric_type
                        ORDER BY tf.metric_seconds ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    0
                ) AS cum_before,
                SUM(tf.freq) OVER (
                    PARTITION BY tf.metric_type
                ) AS total_freq
            FROM time_frequency tf
        ),
        group_assignments AS (
            SELECT
                w.metric_type,
                w.metric_seconds,
                CASE
                    WHEN w.total_freq <= 0 THEN NULL
                    ELSE (
                        SQRT(
                            1.0 + 8.0 * (
                                (w.cum_before + ((w.freq + 1) / 2.0))
                                * (SELECT band_denominator FROM params)
                                / w.total_freq
                            )
                        ) - 1.0
                    ) / 2.0
                END AS band_progress,
                w.total_freq,
                w.freq
            FROM weighted w
        ),
        assigned_blocks AS (
            SELECT
                g.metric_type,
                g.metric_seconds,
                g.freq,
                g.total_freq,
                CAST(
                    MAX(
                        0,
                        101 - (
                            CAST(g.band_progress AS INTEGER)
                            + CASE
                                WHEN g.band_progress IS NULL THEN 101
                                WHEN g.band_progress > CAST(g.band_progress AS INTEGER) THEN 1
                                ELSE 0
                            END
                        )
                    ) AS INTEGER
                ) AS curve_rank_group
            FROM group_assignments g
        ),
        metric_totals AS (
            SELECT
                metric_type,
                COUNT(*) AS total_freq
            FROM athlete_best
            GROUP BY metric_type
        ),
        band_targets AS (
            SELECT
                m.metric_type,
                b.curve_rank_group,
                (m.total_freq * b.band_weight * 1.0) / (SELECT band_denominator FROM params) AS target_group_cnt,
                CASE
                    WHEN b.curve_rank_group = 100 THEN 100.0
                    ELSE b.curve_rank_group + 0.5
                END AS score_upper,
                CASE
                    WHEN b.curve_rank_group = 0 THEN 0.0
                    ELSE b.curve_rank_group - 0.5
                END AS score_lower
            FROM metric_totals m
            CROSS JOIN bands b
        ),
        band_rollup AS (
            SELECT
                bt.metric_type,
                bt.curve_rank_group,
                MIN(ab.metric_seconds) AS min_seconds,
                MAX(ab.metric_seconds) AS max_seconds,
                CAST(ROUND(bt.target_group_cnt, :reference_precision) AS REAL) AS target_group_cnt,
                COALESCE(SUM(ab.freq), 0) AS actual_group_cnt,
                bt.score_upper,
                bt.score_lower
            FROM band_targets bt
            LEFT JOIN assigned_blocks ab
              ON ab.metric_type = bt.metric_type
             AND ab.curve_rank_group = bt.curve_rank_group
            GROUP BY
                bt.metric_type,
                bt.curve_rank_group,
                bt.target_group_cnt,
                bt.score_upper,
                bt.score_lower
        )
        SELECT
            metric_type,
            curve_rank_group,
            :reference_version AS curve_rank_reference_version,
            min_seconds,
            max_seconds,
            CASE
                WHEN min_seconds IS NULL THEN NULL
                ELSE printf('%02d:%02d', min_seconds / 60, min_seconds % 60)
            END AS min_time,
            CASE
                WHEN max_seconds IS NULL THEN NULL
                ELSE printf('%02d:%02d', max_seconds / 60, max_seconds % 60)
            END AS max_time,
            target_group_cnt,
            actual_group_cnt,
            score_upper,
            score_lower
        FROM band_rollup
    """
    _execute_with_progress(
        sqlite_conn=sqlite_conn,
        cur=cur,
        sql=sql,
        params=params,
        label=f"curve_time_ranks_reference build ({scope_label})",
    )
    sqlite_conn.commit()

    cur.execute("SELECT COUNT(*) FROM curve_time_ranks_reference")
    rows = int(cur.fetchone()[0] or 0)
    cur.close()

    print(f"[curved_ranks] curve_time_ranks_reference rows for {scope_label}={rows}")
    _log_timing(f"curve_time_ranks_reference.build ({scope_label})", started)
    return rows


def _sync_eventpositions_from_curve_athlete_best_rank_history(
    sqlite_conn,
    start_date: str,
    end_date: str,
    event_code: Optional[int] = None,
    batch_size: int = 25000,
) -> int:
    started = _ts()
    cur = sqlite_conn.cursor()

    params = {
        "start_date": start_date,
        "end_date": end_date,
        "event_code": event_code,
    }

    cur.execute("DROP TABLE IF EXISTS tmp_curve_history_sync")
    cur.execute(
        f"""
        CREATE TEMP TABLE tmp_curve_history_sync AS
        SELECT
            e.rowid AS ep_rowid,
            h.current_best_rank_b,
            h.current_best_rank_e,
            h.current_best_rank_es,
            h.current_best_rank_ae,
            h.current_best_rank_aes,
            er.event_rank_b,
            er.event_rank_e,
            er.event_rank_es,
            er.event_rank_ae,
            er.event_rank_aes,
            h.best_curve_ranking_current,
            h.best_curve_ranking_historic,
            h.best_curve_ranking_current_type
        FROM eventpositions e
        JOIN curve_athlete_best_rank_history h
          ON h.snapshot_date = {_iso_expr('e.event_date')}
         AND h.athlete_code = e.athlete_code
                LEFT JOIN (
                        SELECT
                                c.event_code,
                                c.formatted_date,
                                c.athlete_code,
                                MAX(CASE WHEN c.metric_type = 'B' THEN
                                    CASE
                                        WHEN r.max_seconds IS NULL THEN NULL
                                        WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                                        ELSE r.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                                                )
                                            ) * (r.score_upper - r.score_lower)
                                    END
                                END) AS event_rank_b,
                                MAX(CASE WHEN c.metric_type = 'E' THEN
                                    CASE
                                        WHEN r.max_seconds IS NULL THEN NULL
                                        WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                                        ELSE r.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                                                )
                                            ) * (r.score_upper - r.score_lower)
                                    END
                                END) AS event_rank_e,
                                MAX(CASE WHEN c.metric_type = 'ES' THEN
                                    CASE
                                        WHEN r.max_seconds IS NULL THEN NULL
                                        WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                                        ELSE r.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                                                )
                                            ) * (r.score_upper - r.score_lower)
                                    END
                                END) AS event_rank_es,
                                MAX(CASE WHEN c.metric_type = 'AE' THEN
                                    CASE
                                        WHEN r.max_seconds IS NULL THEN NULL
                                        WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                                        ELSE r.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                                                )
                                            ) * (r.score_upper - r.score_lower)
                                    END
                                END) AS event_rank_ae,
                                MAX(CASE WHEN c.metric_type = 'AES' THEN
                                    CASE
                                        WHEN r.max_seconds IS NULL THEN NULL
                                        WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                                        ELSE r.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                                                )
                                            ) * (r.score_upper - r.score_lower)
                                    END
                                        END) AS event_rank_aes
                        FROM curve_run_metrics_history c
                        JOIN curve_time_ranks_reference r
                            ON r.metric_type = c.metric_type
                         AND r.curve_rank_group = COALESCE(
                                (
                                    SELECT r2.curve_rank_group
                                    FROM curve_time_ranks_reference r2
                                    WHERE r2.metric_type = c.metric_type
                                      AND r2.max_seconds IS NOT NULL
                                      AND CAST(c.metric_seconds AS INTEGER) <= r2.max_seconds
                                    ORDER BY r2.max_seconds ASC, r2.curve_rank_group DESC
                                    LIMIT 1
                                ),
                                (
                                    SELECT r3.curve_rank_group
                                    FROM curve_time_ranks_reference r3
                                    WHERE r3.metric_type = c.metric_type
                                      AND r3.max_seconds IS NOT NULL
                                    ORDER BY r3.max_seconds DESC, r3.curve_rank_group ASC
                                    LIMIT 1
                                )
                            )
                        WHERE c.formatted_date BETWEEN :start_date AND :end_date
                            AND (:event_code IS NULL OR c.event_code = :event_code)
                            AND c.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
                            AND c.metric_seconds IS NOT NULL
                        GROUP BY c.event_code, c.formatted_date, c.athlete_code
                ) er
                    ON er.event_code = e.event_code
                 AND er.formatted_date = {_iso_expr('e.event_date')}
                 AND er.athlete_code = e.athlete_code
        WHERE h.snapshot_date BETWEEN :start_date AND :end_date
          AND {_iso_expr('e.event_date')} BETWEEN :start_date AND :end_date
          AND (:event_code IS NULL OR e.event_code = :event_code)
        """,
        params,
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tmp_curve_history_sync_rowid ON tmp_curve_history_sync(ep_rowid)"
    )

    cur.execute("SELECT COUNT(*) FROM tmp_curve_history_sync")
    matched_rows = int(cur.fetchone()[0] or 0)
    print(
        f"[curved_ranks] Prepared sync rows for {start_date}..{end_date}: "
        f"matched_eventpositions={matched_rows}",
        flush=True,
    )

    print(f"[curved_ranks] Updating {start_date}..{end_date} eventpositions from curve_athlete_best_rank_history...")

    if batch_size is None or int(batch_size) <= 0:
        batch_size = 25000
    else:
        batch_size = int(batch_size)

    rows_changed = 0
    if matched_rows > 0:
        update_started = perf_counter()
        offset = 0
        batch_num = 0
        update_chunk_sql = """
            WITH chunk AS (
                SELECT
                    ep_rowid,
                    current_best_rank_b,
                    current_best_rank_e,
                    current_best_rank_es,
                    current_best_rank_ae,
                    current_best_rank_aes,
                    event_rank_b,
                    event_rank_e,
                    event_rank_es,
                    event_rank_ae,
                    event_rank_aes,
                    best_curve_ranking_current,
                    best_curve_ranking_historic,
                    best_curve_ranking_current_type
                FROM tmp_curve_history_sync
                ORDER BY ep_rowid
                LIMIT :limit_rows OFFSET :offset_rows
            )
            UPDATE eventpositions
            SET
                current_best_rank_b = ROUND(
                    (SELECT c.current_best_rank_b FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                current_best_rank_e = ROUND(
                    (SELECT c.current_best_rank_e FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                current_best_rank_es = ROUND(
                    (SELECT c.current_best_rank_es FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                current_best_rank_ae = ROUND(
                    (SELECT c.current_best_rank_ae FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                current_best_rank_aes = ROUND(
                    (SELECT c.current_best_rank_aes FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                event_rank_b = ROUND(
                    (SELECT c.event_rank_b FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                event_rank_e = ROUND(
                    (SELECT c.event_rank_e FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                event_rank_es = ROUND(
                    (SELECT c.event_rank_es FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                event_rank_ae = ROUND(
                    (SELECT c.event_rank_ae FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                event_rank_aes = ROUND(
                    (SELECT c.event_rank_aes FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                best_curve_ranking_current = ROUND(
                    (SELECT c.best_curve_ranking_current FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                best_curve_ranking_historic = ROUND(
                    (SELECT c.best_curve_ranking_historic FROM chunk c WHERE c.ep_rowid = eventpositions.rowid),
                    1
                ),
                best_curve_ranking_current_type = (
                    SELECT c.best_curve_ranking_current_type
                    FROM chunk c
                    WHERE c.ep_rowid = eventpositions.rowid
                )
            WHERE rowid IN (SELECT ep_rowid FROM chunk)
        """

        while offset < matched_rows:
            batch_num += 1
            before_changes = sqlite_conn.total_changes
            _execute_with_progress(
                sqlite_conn=sqlite_conn,
                cur=cur,
                sql=update_chunk_sql,
                params={"limit_rows": batch_size, "offset_rows": offset},
                label=f"eventpositions update from curve history batch {batch_num}",
            )
            sqlite_conn.commit()
            changed_this_batch = sqlite_conn.total_changes - before_changes
            rows_changed += changed_this_batch
            offset += batch_size
            done_rows = min(offset, matched_rows)
            pct = (done_rows / matched_rows) * 100.0
            elapsed = perf_counter() - update_started
            print(
                f"[curved_ranks] curve history sync batch={batch_num} "
                f"done={done_rows}/{matched_rows} ({pct:.1f}%) "
                f"changed_batch={changed_this_batch} changed_total={rows_changed} "
                f"elapsed={elapsed:.1f}s"
            )

    cur.execute("DROP TABLE IF EXISTS tmp_curve_history_sync")
    cur.close()

    print(
        f"[curved_ranks] ✓ Synced {start_date}..{end_date}, event_code={event_code}, rows_changed={rows_changed}"
    )
    _log_timing("curve.eventpositions_sync_from_history", started)
    return rows_changed


def _build_curve_athlete_best_rank_history_fast(
    sqlite_conn,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    rebuild_all: bool = False,
) -> int:
    started = _ts()
    cur = sqlite_conn.cursor()

    if end_date is None:
        cur.execute("SELECT MAX(formatted_date) FROM curve_run_metrics_history")
        row = cur.fetchone()
        end_date = str(row[0]) if row and row[0] else None

    if not end_date:
        cur.close()
        print("[curved_ranks] No curve_run_metrics_history rows found; skipping curve_athlete_best_rank_history build.")
        return 0

    if rebuild_all:
        start_effective = None
    else:
        start_effective = _normalize_iso_date(start_date)

    print(
        f"[curved_ranks] curve_athlete_best_rank_history build start: "
        f"scope={'ALL' if (rebuild_all or not start_effective) else start_effective + '..' + end_date}"
    )

    cur.execute("SELECT COUNT(*) FROM curve_time_ranks_reference")
    ref_count = int(cur.fetchone()[0] or 0)
    if ref_count <= 0:
        print("[curved_ranks] curve_time_ranks_reference is empty; rebuilding before athlete history build")
        _build_curve_time_ranks_reference_for_date(sqlite_conn=sqlite_conn, snapshot_date=None)

    cur.execute("DROP TABLE IF EXISTS tmp_curve_current_ranks")
    print("[curved_ranks] Building temp current-rank table from curve_run_metrics_history...")
    _execute_with_progress(
        sqlite_conn=sqlite_conn,
        cur=cur,
        sql=
        """
        CREATE TEMP TABLE tmp_curve_current_ranks AS
        SELECT
            c.formatted_date AS snapshot_date,
            c.athlete_code,
            c.metric_type,
            MAX(
                CASE
                    WHEN r.max_seconds IS NULL THEN NULL
                    WHEN r.max_seconds <= COALESCE(r.min_seconds, r.max_seconds) THEN r.score_upper
                    ELSE r.score_upper -
                        MIN(
                            1.0,
                            MAX(
                                0.0,
                                (CAST(c.metric_seconds AS REAL) - r.min_seconds) * 1.0 / NULLIF(r.max_seconds - r.min_seconds, 0)
                            )
                        ) * (r.score_upper - r.score_lower)
                END
            ) AS current_rank
        FROM curve_run_metrics_history c
        JOIN curve_time_ranks_reference r
          ON r.metric_type = c.metric_type
         AND r.curve_rank_group = COALESCE(
                (
                    SELECT r2.curve_rank_group
                    FROM curve_time_ranks_reference r2
                    WHERE r2.metric_type = c.metric_type
                      AND r2.max_seconds IS NOT NULL
                      AND CAST(c.metric_seconds AS INTEGER) <= r2.max_seconds
                    ORDER BY r2.max_seconds ASC, r2.curve_rank_group DESC
                    LIMIT 1
                ),
                (
                    SELECT r3.curve_rank_group
                    FROM curve_time_ranks_reference r3
                    WHERE r3.metric_type = c.metric_type
                      AND r3.max_seconds IS NOT NULL
                    ORDER BY r3.max_seconds DESC, r3.curve_rank_group ASC
                    LIMIT 1
                )
            )
                WHERE c.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
          AND c.metric_seconds IS NOT NULL
          AND c.formatted_date <= :end_date
        GROUP BY c.formatted_date, c.athlete_code, c.metric_type
        """,
                params={"end_date": end_date},
                label="tmp_curve_current_ranks build",
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tmp_curve_current_ranks_athlete_metric_date ON tmp_curve_current_ranks(athlete_code, metric_type, snapshot_date)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tmp_curve_current_ranks_snapshot_athlete ON tmp_curve_current_ranks(snapshot_date, athlete_code)"
    )

    if rebuild_all or not start_effective:
        cur.execute("DELETE FROM curve_athlete_best_rank_history")
    else:
        cur.execute(
            "DELETE FROM curve_athlete_best_rank_history WHERE snapshot_date BETWEEN :start_date AND :end_date",
            {"start_date": start_effective, "end_date": end_date},
        )

    insert_params = {
        "start_date": start_effective,
        "end_date": end_date,
        "history_precision": int(CURVE_HISTORY_OUTPUT_PRECISION),
    }
    print("[curved_ranks] Writing current/historic rank columns into curve_athlete_best_rank_history...")
    _execute_with_progress(
        sqlite_conn=sqlite_conn,
        cur=cur,
        sql=
        """
        INSERT OR REPLACE INTO curve_athlete_best_rank_history (
            snapshot_date,
            athlete_code,
            event_rank_b,
            event_rank_e,
            event_rank_es,
            event_rank_ae,
            event_rank_aes,
            current_best_rank_b,
            current_best_rank_e,
            current_best_rank_es,
            current_best_rank_ae,
            current_best_rank_aes,
            historic_best_rank_b,
            historic_best_rank_e,
            historic_best_rank_es,
            historic_best_rank_ae,
            historic_best_rank_aes,
            historic_best_rank_1Y_b,
            historic_best_rank_1Y_e,
            historic_best_rank_1Y_es,
            historic_best_rank_1Y_ae,
            historic_best_rank_1Y_aes,
            best_curve_ranking_current,
            best_curve_ranking_historic,
            best_curve_ranking_current_type
        )
        WITH
        base AS (
            SELECT
                t.snapshot_date,
                t.athlete_code,
                t.metric_type,
                ROUND(t.current_rank, :history_precision) AS current_rank,
                ROUND(
                    MAX(t.current_rank) OVER (
                        PARTITION BY t.athlete_code, t.metric_type
                        ORDER BY t.snapshot_date
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    :history_precision
                ) AS historic_rank,
                ROUND(
                    (
                        SELECT MAX(t2.current_rank)
                        FROM tmp_curve_current_ranks t2
                        WHERE t2.athlete_code = t.athlete_code
                          AND t2.metric_type = t.metric_type
                          AND t2.snapshot_date <= t.snapshot_date
                          AND t2.snapshot_date >= date(t.snapshot_date, '-1 year')
                    ),
                    :history_precision
                ) AS historic_rank_1y
            FROM tmp_curve_current_ranks t
        ),
        pivoted AS (
            SELECT
                snapshot_date,
                athlete_code,
                MAX(CASE WHEN metric_type = 'B' THEN current_rank END) AS event_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN current_rank END) AS event_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN current_rank END) AS event_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN current_rank END) AS event_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN current_rank END) AS event_rank_aes,
                MAX(CASE WHEN metric_type = 'B' THEN current_rank END) AS current_best_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN current_rank END) AS current_best_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN current_rank END) AS current_best_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN current_rank END) AS current_best_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN current_rank END) AS current_best_rank_aes,
                MAX(CASE WHEN metric_type = 'B' THEN historic_rank END) AS historic_best_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN historic_rank END) AS historic_best_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN historic_rank END) AS historic_best_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN historic_rank END) AS historic_best_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN historic_rank END) AS historic_best_rank_aes,
                MAX(CASE WHEN metric_type = 'B' THEN historic_rank_1y END) AS historic_best_rank_1Y_b,
                MAX(CASE WHEN metric_type = 'E' THEN historic_rank_1y END) AS historic_best_rank_1Y_e,
                MAX(CASE WHEN metric_type = 'ES' THEN historic_rank_1y END) AS historic_best_rank_1Y_es,
                MAX(CASE WHEN metric_type = 'AE' THEN historic_rank_1y END) AS historic_best_rank_1Y_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN historic_rank_1y END) AS historic_best_rank_1Y_aes
            FROM base
            GROUP BY snapshot_date, athlete_code
        ),
        scored AS (
            SELECT
                p.*,
                ROUND(
                    MAX(
                        COALESCE(p.historic_best_rank_1Y_b, -1.0),
                        COALESCE(p.historic_best_rank_1Y_e, -1.0),
                        COALESCE(p.historic_best_rank_1Y_es, -1.0),
                        COALESCE(p.historic_best_rank_1Y_ae, -1.0),
                        COALESCE(p.historic_best_rank_1Y_aes, -1.0)
                    ),
                    :history_precision
                ) AS best_curve_ranking_current,
                ROUND(
                    MAX(
                        COALESCE(p.historic_best_rank_b, -1.0),
                        COALESCE(p.historic_best_rank_e, -1.0),
                        COALESCE(p.historic_best_rank_es, -1.0),
                        COALESCE(p.historic_best_rank_ae, -1.0),
                        COALESCE(p.historic_best_rank_aes, -1.0)
                    ),
                    :history_precision
                ) AS best_curve_ranking_historic
            FROM pivoted p
        )
        SELECT
            s.snapshot_date,
            s.athlete_code,
            ROUND(s.event_rank_b, :history_precision),
            ROUND(s.event_rank_e, :history_precision),
            ROUND(s.event_rank_es, :history_precision),
            ROUND(s.event_rank_ae, :history_precision),
            ROUND(s.event_rank_aes, :history_precision),
            -- Store "current" as trailing-1Y best-as-of-snapshot to match downstream list semantics.
            ROUND(s.historic_best_rank_1Y_b, :history_precision),
            ROUND(s.historic_best_rank_1Y_e, :history_precision),
            ROUND(s.historic_best_rank_1Y_es, :history_precision),
            ROUND(s.historic_best_rank_1Y_ae, :history_precision),
            ROUND(s.historic_best_rank_1Y_aes, :history_precision),
            ROUND(s.historic_best_rank_b, :history_precision),
            ROUND(s.historic_best_rank_e, :history_precision),
            ROUND(s.historic_best_rank_es, :history_precision),
            ROUND(s.historic_best_rank_ae, :history_precision),
            ROUND(s.historic_best_rank_aes, :history_precision),
            ROUND(s.historic_best_rank_1Y_b, :history_precision),
            ROUND(s.historic_best_rank_1Y_e, :history_precision),
            ROUND(s.historic_best_rank_1Y_es, :history_precision),
            ROUND(s.historic_best_rank_1Y_ae, :history_precision),
            ROUND(s.historic_best_rank_1Y_aes, :history_precision),
            CASE WHEN s.best_curve_ranking_current < 0 THEN NULL ELSE s.best_curve_ranking_current END,
            CASE WHEN s.best_curve_ranking_historic < 0 THEN NULL ELSE s.best_curve_ranking_historic END,
            CASE
                WHEN s.best_curve_ranking_current < 0 THEN NULL
                WHEN COALESCE(s.historic_best_rank_1Y_b, -1.0) = s.best_curve_ranking_current THEN ''
                WHEN COALESCE(s.historic_best_rank_1Y_e, -1.0) = s.best_curve_ranking_current THEN 'E'
                WHEN COALESCE(s.historic_best_rank_1Y_es, -1.0) = s.best_curve_ranking_current THEN 'ES'
                WHEN COALESCE(s.historic_best_rank_1Y_ae, -1.0) = s.best_curve_ranking_current THEN 'AE'
                WHEN COALESCE(s.historic_best_rank_1Y_aes, -1.0) = s.best_curve_ranking_current THEN 'AES'
                ELSE NULL
            END AS best_curve_ranking_current_type
        FROM scored s
        WHERE s.snapshot_date <= :end_date
          AND (:start_date IS NULL OR s.snapshot_date >= :start_date)
        """,
                params=insert_params,
                label="curve_athlete_best_rank_history insert",
    )

    cur.execute("DROP TABLE IF EXISTS tmp_curve_current_ranks")
    sqlite_conn.commit()

    if rebuild_all or not start_effective:
        cur.execute("SELECT COUNT(*) FROM curve_athlete_best_rank_history")
        rows = int(cur.fetchone()[0] or 0)
    else:
        cur.execute(
            "SELECT COUNT(*) FROM curve_athlete_best_rank_history WHERE snapshot_date BETWEEN :start_date AND :end_date",
            {"start_date": start_effective, "end_date": end_date},
        )
        rows = int(cur.fetchone()[0] or 0)

    cur.close()
    scope = "ALL" if (rebuild_all or not start_effective) else f"{start_effective}..{end_date}"
    print(f"[curved_ranks] curve_athlete_best_rank_history rows built for {scope}={rows}")
    _log_timing(f"curve_athlete_best_rank_history.fast_build ({scope})", started)
    return rows


def _dump_stage2_snapshot_to_csv(sqlite_conn, snapshot_date: str, out_file: str) -> None:
    cur = sqlite_conn.cursor()
    cur.execute(
        """
        SELECT
            snapshot_date,
            period_type,
            metric_type,
            best_metric_seconds,
            freq,
            cum_before,
            total_freq,
            weighted_percentile,
            rank
        FROM curve_rank_mapping_history
        WHERE snapshot_date = :snapshot_date
        ORDER BY period_type, metric_type, rank DESC, best_metric_seconds
        """,
        {"snapshot_date": snapshot_date},
    )
    rows = cur.fetchall()
    cur.close()
    _write_csv(
        out_file,
        [
            "snapshot_date",
            "period_type",
            "metric_type",
            "best_metric_seconds",
            "freq",
            "cum_before",
            "total_freq",
            "weighted_percentile",
            "rank",
        ],
        rows,
    )


def _apply_stage3_to_eventpositions(sqlite_conn, snapshot_date: str, event_code: Optional[int] = None) -> Tuple[int, List[Tuple]]:
    started = _ts()
    cur = sqlite_conn.cursor()

    # Configure connection for better lock handling
    sqlite_conn.execute("PRAGMA busy_timeout = 5000")  # 5 second timeout

    params = {"snapshot_date": snapshot_date, "event_code": event_code}

    cur.execute("DROP TABLE IF EXISTS tmp_curve_output")
    print(f"[curved_ranks] Stage 3 prep: building tmp_curve_output for {snapshot_date}...")
    _execute_with_progress(
        sqlite_conn=sqlite_conn,
        cur=cur,
        sql=
        """
        CREATE TEMP TABLE tmp_curve_output AS
        WITH
        target_athletes AS (
            SELECT DISTINCT e.athlete_code
            FROM eventpositions e
            WHERE (substr(e.event_date, 7, 4) || '-' || substr(e.event_date, 4, 2) || '-' || substr(e.event_date, 1, 2)) = :snapshot_date
              AND (:event_code IS NULL OR e.event_code = :event_code)
        ),
        best_1y_by_metric AS (
            SELECT athlete_code, metric_type, metric_seconds
            FROM (
                SELECT
                    r.athlete_code,
                    r.metric_type,
                    r.metric_seconds,
                    ROW_NUMBER() OVER (
                        PARTITION BY r.athlete_code, r.metric_type
                        ORDER BY r.metric_seconds ASC, r.position ASC, r.formatted_date DESC, r.event_code
                    ) AS rn
                FROM curve_run_metrics_history r
                JOIN target_athletes t ON t.athlete_code = r.athlete_code
                WHERE r.formatted_date <= :snapshot_date
                  AND r.formatted_date >= date(:snapshot_date, '-1 year')
            ) x
            WHERE x.rn = 1
        ),
        best_all_by_metric AS (
            SELECT athlete_code, metric_type, metric_seconds
            FROM (
                SELECT
                    r.athlete_code,
                    r.metric_type,
                    r.metric_seconds,
                    ROW_NUMBER() OVER (
                        PARTITION BY r.athlete_code, r.metric_type
                        ORDER BY r.metric_seconds ASC, r.position ASC, r.formatted_date DESC, r.event_code
                    ) AS rn
                FROM curve_run_metrics_history r
                JOIN target_athletes t ON t.athlete_code = r.athlete_code
                WHERE r.formatted_date <= :snapshot_date
            ) x
            WHERE x.rn = 1
        ),
        current_ranked AS (
            SELECT
                b.athlete_code,
                b.metric_type,
                m.rank
            FROM best_1y_by_metric b
            JOIN curve_rank_mapping_history m
              ON m.snapshot_date = :snapshot_date
             AND m.period_type = '1Y'
             AND m.metric_type = b.metric_type
             AND m.best_metric_seconds = b.metric_seconds
        ),
        historic_ranked AS (
            SELECT
                b.athlete_code,
                b.metric_type,
                m.rank
            FROM best_all_by_metric b
            JOIN curve_rank_mapping_history m
              ON m.snapshot_date = :snapshot_date
             AND m.period_type = 'ALL'
             AND m.metric_type = b.metric_type
             AND m.best_metric_seconds = b.metric_seconds
        ),
                event_ranked AS (
                        SELECT
                                r.athlete_code,
                                r.metric_type,
                                MAX(
                                    CASE
                                        WHEN t.max_seconds IS NULL THEN NULL
                                        WHEN t.max_seconds <= COALESCE(t.min_seconds, t.max_seconds) THEN t.score_upper
                                        ELSE t.score_upper -
                                            MIN(
                                                1.0,
                                                MAX(
                                                    0.0,
                                                    (CAST(r.metric_seconds AS REAL) - t.min_seconds) * 1.0 / NULLIF(t.max_seconds - t.min_seconds, 0)
                                                )
                                            ) * (t.score_upper - t.score_lower)
                                    END
                                    ) AS event_rank
                        FROM curve_run_metrics_history r
                        JOIN curve_time_ranks_reference t
                            ON t.metric_type = r.metric_type
                         AND t.curve_rank_group = COALESCE(
                                (
                                    SELECT t2.curve_rank_group
                                    FROM curve_time_ranks_reference t2
                                    WHERE t2.metric_type = r.metric_type
                                      AND t2.max_seconds IS NOT NULL
                                      AND CAST(r.metric_seconds AS INTEGER) <= t2.max_seconds
                                    ORDER BY t2.max_seconds ASC, t2.curve_rank_group DESC
                                    LIMIT 1
                                ),
                                (
                                    SELECT t3.curve_rank_group
                                    FROM curve_time_ranks_reference t3
                                    WHERE t3.metric_type = r.metric_type
                                      AND t3.max_seconds IS NOT NULL
                                    ORDER BY t3.max_seconds DESC, t3.curve_rank_group ASC
                                    LIMIT 1
                                )
                            )
                        WHERE r.formatted_date = :snapshot_date
                            AND (:event_code IS NULL OR r.event_code = :event_code)
                            AND r.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
                            AND r.metric_seconds IS NOT NULL
                        GROUP BY r.athlete_code, r.metric_type
                ),
        current_by_metric AS (
            SELECT
                athlete_code,
                MAX(CASE WHEN metric_type = 'B' THEN rank END) AS current_best_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN rank END) AS current_best_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN rank END) AS current_best_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN rank END) AS current_best_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN rank END) AS current_best_rank_aes
            FROM current_ranked
            GROUP BY athlete_code
        ),
        historic_by_metric AS (
            SELECT
                athlete_code,
                MAX(CASE WHEN metric_type = 'B' THEN rank END) AS historic_best_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN rank END) AS historic_best_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN rank END) AS historic_best_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN rank END) AS historic_best_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN rank END) AS historic_best_rank_aes
            FROM historic_ranked
            GROUP BY athlete_code
        ),
        event_by_metric AS (
            SELECT
                athlete_code,
                MAX(CASE WHEN metric_type = 'B' THEN event_rank END) AS event_rank_b,
                MAX(CASE WHEN metric_type = 'E' THEN event_rank END) AS event_rank_e,
                MAX(CASE WHEN metric_type = 'ES' THEN event_rank END) AS event_rank_es,
                MAX(CASE WHEN metric_type = 'AE' THEN event_rank END) AS event_rank_ae,
                MAX(CASE WHEN metric_type = 'AES' THEN event_rank END) AS event_rank_aes
            FROM event_ranked
            GROUP BY athlete_code
        ),
        prior_best_history AS (
            SELECT
                athlete_code,
                MAX(current_best_rank_b) AS prior_historic_best_rank_b,
                MAX(current_best_rank_e) AS prior_historic_best_rank_e,
                MAX(current_best_rank_es) AS prior_historic_best_rank_es,
                MAX(current_best_rank_ae) AS prior_historic_best_rank_ae,
                MAX(current_best_rank_aes) AS prior_historic_best_rank_aes,
                MAX(best_curve_ranking_current) AS prior_best_curve_ranking_historic
            FROM curve_athlete_best_rank_history
            WHERE snapshot_date < :snapshot_date
            GROUP BY athlete_code
        ),
        current_choice AS (
            SELECT athlete_code, rank AS best_curve_ranking_current,
                   CASE metric_type WHEN 'B' THEN '' ELSE metric_type END AS best_curve_ranking_current_type
            FROM (
                SELECT
                    m.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.athlete_code
                        ORDER BY m.rank DESC,
                                 CASE m.metric_type
                                     WHEN 'B' THEN 1
                                     WHEN 'E' THEN 2
                                     WHEN 'ES' THEN 3
                                     WHEN 'AE' THEN 4
                                     WHEN 'AES' THEN 5
                                     ELSE 99
                                 END
                    ) AS rn
                                FROM current_ranked m
                WHERE m.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
            ) x
            WHERE x.rn = 1
        ),
        historic_choice AS (
            SELECT athlete_code, rank AS best_curve_ranking_historic
            FROM (
                SELECT
                    m.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.athlete_code
                        ORDER BY m.rank DESC,
                                 CASE m.metric_type
                                     WHEN 'B' THEN 1
                                     WHEN 'E' THEN 2
                                     WHEN 'ES' THEN 3
                                     WHEN 'AE' THEN 4
                                     WHEN 'AES' THEN 5
                                     ELSE 99
                                 END
                    ) AS rn
                                FROM historic_ranked m
                WHERE m.metric_type IN ('B', 'E', 'ES', 'AE', 'AES')
            ) x
            WHERE x.rn = 1
        )
        SELECT
            t.athlete_code,
            cb.current_best_rank_b,
            cb.current_best_rank_e,
            cb.current_best_rank_es,
            cb.current_best_rank_ae,
            cb.current_best_rank_aes,
            eb.event_rank_b,
            eb.event_rank_e,
            eb.event_rank_es,
            eb.event_rank_ae,
            eb.event_rank_aes,
            pb.prior_historic_best_rank_b AS historic_best_rank_b,
            pb.prior_historic_best_rank_e AS historic_best_rank_e,
            pb.prior_historic_best_rank_es AS historic_best_rank_es,
            pb.prior_historic_best_rank_ae AS historic_best_rank_ae,
            pb.prior_historic_best_rank_aes AS historic_best_rank_aes,
            c.best_curve_ranking_current,
            pb.prior_best_curve_ranking_historic AS best_curve_ranking_historic,
            c.best_curve_ranking_current_type
        FROM target_athletes t
        LEFT JOIN current_by_metric cb ON cb.athlete_code = t.athlete_code
        LEFT JOIN event_by_metric eb ON eb.athlete_code = t.athlete_code
        LEFT JOIN prior_best_history pb ON pb.athlete_code = t.athlete_code
        LEFT JOIN current_choice c ON c.athlete_code = t.athlete_code
        LEFT JOIN historic_by_metric hb ON hb.athlete_code = t.athlete_code
        LEFT JOIN historic_choice h ON h.athlete_code = t.athlete_code
        """,
        params=params,
        label=f"stage3 tmp_curve_output build ({snapshot_date})",
    )

    cur.execute("SELECT COUNT(*) FROM tmp_curve_output")
    tmp_curve_output_rows = int(cur.fetchone()[0] or 0)
    print(
        f"[curved_ranks] Stage 3 prep complete for {snapshot_date}: tmp_curve_output rows={tmp_curve_output_rows}"
    )

    cur.execute(
        """
        SELECT athlete_code, best_curve_ranking_current, best_curve_ranking_historic, best_curve_ranking_current_type
        FROM tmp_curve_output
        ORDER BY athlete_code
        """
    )
    preview_rows = cur.fetchall()

    cur.execute(
        "DELETE FROM curve_athlete_rank_summary_history WHERE snapshot_date = :snapshot_date",
        {"snapshot_date": snapshot_date},
    )
    cur.execute(
        """
        INSERT OR REPLACE INTO curve_athlete_rank_summary_history (
            snapshot_date,
            athlete_code,
            best_curve_ranking_current,
            best_curve_ranking_historic,
            best_curve_ranking_current_type
        )
        SELECT
            :snapshot_date,
            athlete_code,
            best_curve_ranking_current,
            best_curve_ranking_historic,
            best_curve_ranking_current_type
        FROM tmp_curve_output
        """,
        {"snapshot_date": snapshot_date},
    )

    cur.execute(
        "DELETE FROM curve_athlete_best_rank_history WHERE snapshot_date = :snapshot_date",
        {"snapshot_date": snapshot_date},
    )
    cur.execute(
        """
        INSERT OR REPLACE INTO curve_athlete_best_rank_history (
            snapshot_date,
            athlete_code,
            current_best_rank_b,
            current_best_rank_e,
            current_best_rank_es,
            current_best_rank_ae,
            current_best_rank_aes,
            historic_best_rank_b,
            historic_best_rank_e,
            historic_best_rank_es,
            historic_best_rank_ae,
            historic_best_rank_aes,
            best_curve_ranking_current,
            best_curve_ranking_historic,
            best_curve_ranking_current_type
        )
        SELECT
            :snapshot_date,
            athlete_code,
            current_best_rank_b,
            current_best_rank_e,
            current_best_rank_es,
            current_best_rank_ae,
            current_best_rank_aes,
            historic_best_rank_b,
            historic_best_rank_e,
            historic_best_rank_es,
            historic_best_rank_ae,
            historic_best_rank_aes,
            best_curve_ranking_current,
            best_curve_ranking_historic,
            best_curve_ranking_current_type
        FROM tmp_curve_output
        """,
        {"snapshot_date": snapshot_date},
    )

    before_changes = sqlite_conn.total_changes
    print(f"[curved_ranks] Stage 3: Updating eventpositions for {snapshot_date}...")
    cur.execute(
        """
        UPDATE eventpositions
        SET
                    current_best_rank_b = ROUND(
                        (SELECT u.current_best_rank_b FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    current_best_rank_e = ROUND(
                        (SELECT u.current_best_rank_e FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    current_best_rank_es = ROUND(
                        (SELECT u.current_best_rank_es FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    current_best_rank_ae = ROUND(
                        (SELECT u.current_best_rank_ae FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    current_best_rank_aes = ROUND(
                        (SELECT u.current_best_rank_aes FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    event_rank_b = ROUND(
                        (SELECT u.event_rank_b FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    event_rank_e = ROUND(
                        (SELECT u.event_rank_e FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    event_rank_es = ROUND(
                        (SELECT u.event_rank_es FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    event_rank_ae = ROUND(
                        (SELECT u.event_rank_ae FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
                    event_rank_aes = ROUND(
                        (SELECT u.event_rank_aes FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
                        1
                    ),
          best_curve_ranking_current = ROUND(
            (SELECT u.best_curve_ranking_current FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
            1
          ),
          best_curve_ranking_historic = ROUND(
            (SELECT u.best_curve_ranking_historic FROM tmp_curve_output u WHERE u.athlete_code = eventpositions.athlete_code LIMIT 1),
            1
          ),
          best_curve_ranking_current_type = (
            SELECT u.best_curve_ranking_current_type
            FROM tmp_curve_output u
            WHERE u.athlete_code = eventpositions.athlete_code
            LIMIT 1
          )
        WHERE (substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) = :snapshot_date
          AND (:event_code IS NULL OR event_code = :event_code)
          AND EXISTS (
            SELECT 1
            FROM tmp_curve_output u
            WHERE u.athlete_code = eventpositions.athlete_code
          )
        """,
        params,
    )

    sqlite_conn.commit()
    rows_changed = sqlite_conn.total_changes - before_changes

    cur.execute("DROP TABLE IF EXISTS tmp_curve_output")
    cur.close()

    print(f"[curved_ranks] ✓ Stage 3 complete for {snapshot_date}: {rows_changed} rows changed")
    _log_timing(f"stage3.apply ({snapshot_date})", started)
    return rows_changed, preview_rows


def run_curved_ranks_pipeline(
    current_date: Optional[str] = None,
    start_date: Optional[str] = None,
    loop_all_dates: bool = True,
    full_stage1_rebuild: bool = True,
    run_stage1: bool = True,
    rolling_rebuild_weeks: int = 3,
    event_code: Optional[int] = None,
    copy_to_postgres: bool = True,
    output_dir: Optional[str] = None,
    write_csv_outputs: bool = False,
) -> List[str]:
    """
    Run staged curve-rank pipeline.

    Stage 1
      - Build or refresh `curve_run_metrics_history` (B/E/ES/AE/AES run-level metrics).
      - Full rebuild for first run; rolling rebuild supports coeff backfill windows.

    Stage 2
            - For each snapshot date, refresh `curve_rank_mapping_history` for ALL and 1Y periods.

    Stage 3
      - For each snapshot date, update `eventpositions` fields:
          `best_curve_ranking_current`,
          `best_curve_ranking_historic`,
          `best_curve_ranking_current_type`.
            - Optionally upload updated fields to Postgres.
            - Persist compact athlete history in `curve_athlete_best_rank_history`.
    """
    overall_started = _ts()
    conn, cursor, render_db_conn, render_cursor = connections()
    processed_dates: List[str] = []
    try:
        if output_dir is None:
            output_dir = os.path.join(PROJECT_ROOT, "curve_progress")
        _ensure_dir(output_dir)
        if write_csv_outputs:
            _ensure_dir(os.path.join(output_dir, "stage2"))
            _ensure_dir(os.path.join(output_dir, "stage3"))

        progress_json_path = os.path.join(output_dir, "progress.json")
        date_log_path = os.path.join(output_dir, "dates_processed.csv")

        _ensure_sqlite_math_functions(conn)
        _ensure_stage_tables(conn)
        
        # Configure connection for lock handling
        conn.execute("PRAGMA busy_timeout = 5000")  # 5 second timeout
        
        # Close render connection early to avoid lock contention during heavy stage2/3 processing
        try:
            render_cursor.close()
        except Exception:
            pass
        try:
            render_db_conn.close()
        except Exception:
            pass

        max_date = _get_max_event_date(conn)
        if not max_date:
            print("[curved_ranks] No parkrun_events dates found; nothing to process.")
            return processed_dates

        current = _normalize_iso_date(current_date) or max_date
        start = _normalize_iso_date(start_date)

        if run_stage1:
            stage1_started = _ts()
            _rebuild_stage1(
                sqlite_conn=conn,
                upto_date=current,
                full_rebuild=full_stage1_rebuild,
                rolling_weeks=rolling_rebuild_weeks,
            )
            _log_timing("pipeline.stage1", stage1_started)
        else:
            print("[curved_ranks] Skipping Stage 1 rebuild; using existing curve_run_metrics_history.")

        if loop_all_dates:
            dates = _get_snapshot_dates(conn, start_date=start, end_date=current)
        else:
            dates = [current]

        total_dates = len(dates)
        print(
            f"[curved_ranks] Stage 2+3 processing dates={total_dates}, "
            f"start={dates[0] if dates else None}, end={dates[-1] if dates else None}, event_code={event_code}"
        )

        _write_json(
            progress_json_path,
            {
                "status": "running",
                "started_at": datetime.now().isoformat(timespec="seconds"),
                "total_dates": total_dates,
                "processed_dates": 0,
                "current_date": None,
                "output_dir": output_dir,
                "stage2_dir": os.path.join(output_dir, "stage2"),
                "stage3_dir": os.path.join(output_dir, "stage3"),
            },
        )

        for idx, d in enumerate(dates, start=1):
            print(f"[curved_ranks] processing {idx}/{total_dates}: {d}")
            _build_stage2_for_date(conn, d)
            ref_rows = _build_curve_time_ranks_reference_for_date(conn, d)
            stage2_file = os.path.join(output_dir, "stage2", f"stage2_{d}.csv") if write_csv_outputs else None
            if write_csv_outputs:
                _dump_stage2_snapshot_to_csv(conn, d, stage2_file)

            rows_changed, stage3_preview_rows = _apply_stage3_to_eventpositions(conn, d, event_code=event_code)
            stage3_file = os.path.join(output_dir, "stage3", f"stage3_{d}.csv") if write_csv_outputs else None
            if write_csv_outputs:
                _write_csv(
                    stage3_file,
                    ["athlete_code", "best_curve_ranking_current", "best_curve_ranking_historic", "best_curve_ranking_current_type"],
                    stage3_preview_rows,
                )

            processed_dates.append(d)

            if write_csv_outputs:
                _append_csv_row(
                    date_log_path,
                    ["idx", "snapshot_date", "rows_changed", "stage2_file", "stage3_file", "processed_at"],
                    [idx, d, rows_changed, stage2_file, stage3_file, datetime.now().isoformat(timespec="seconds")],
                )
            _write_json(
                progress_json_path,
                {
                    "status": "running",
                    "started_at": None,
                    "total_dates": total_dates,
                    "processed_dates": idx,
                    "current_date": d,
                    "last_rows_changed": rows_changed,
                    "last_curve_reference_rows": ref_rows,
                    "last_stage2_file": stage2_file,
                    "last_stage3_file": stage3_file,
                    "updated_at": datetime.now().isoformat(timespec="seconds"),
                    "output_dir": output_dir,
                },
            )

        if copy_to_postgres and processed_dates:
            copy_started = _ts()
            print(f"[curved_ranks] Ensuring Postgres curve rank columns...")
            _ensure_postgres_eventpositions_curve_rank_columns()
            print(f"[curved_ranks] Copying {len(processed_dates)} date(s) to Postgres...")
            if loop_all_dates and len(processed_dates) > 1:
                print(f"[curved_ranks] Copy range: {processed_dates[0]}..{processed_dates[-1]}")
                copy_table_to_postgres(
                    table_name="eventpositions",
                    key_columns=["event_code", "event_date", "athlete_code"],
                        fields=list(POSTGRES_CURVE_RANK_FIELDS),
                    exact_date=False,
                    updateOnly=True,
                    start_date=processed_dates[0],
                    end_date=processed_dates[-1],
                    event_code=event_code,
                )
            else:
                print(f"[curved_ranks] Copy date: {processed_dates[-1]}")
                copy_table_to_postgres(
                    table_name="eventpositions",
                    key_columns=["event_code", "event_date", "athlete_code"],
                    fields=list(POSTGRES_CURVE_RANK_FIELDS),
                    earliest_date=processed_dates[-1],
                    exact_date=True,
                    updateOnly=True,
                    event_code=event_code,
                )
            print(f"[curved_ranks] ✓ Postgres copy complete")
            _log_timing("pipeline.copy_to_postgres", copy_started)

        conn.commit()
        _write_json(
            progress_json_path,
            {
                "status": "completed",
                "completed_at": datetime.now().isoformat(timespec="seconds"),
                "total_dates": len(processed_dates),
                "processed_dates": len(processed_dates),
                "first_date": processed_dates[0] if processed_dates else None,
                "last_date": processed_dates[-1] if processed_dates else None,
                "output_dir": output_dir,
            },
        )
        _log_timing("pipeline.total", overall_started)
        return processed_dates
    except Exception:
        try:
            if output_dir:
                _write_json(
                    os.path.join(output_dir, "progress.json"),
                    {
                        "status": "failed",
                        "failed_at": datetime.now().isoformat(timespec="seconds"),
                        "processed_dates": len(processed_dates),
                        "last_date": processed_dates[-1] if processed_dates else None,
                        "output_dir": output_dir,
                    },
                )
        except Exception:
            pass
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            if render_db_conn:
                render_db_conn.close()
        except Exception:
            pass


def run_curved_ranks_for_weekly_update(
    current_date: str,
    event_code: Optional[int] = None,
    rolling_rebuild_weeks: int = 3,
    output_dir: Optional[str] = None,
    run_stage1: bool = True,
    resume_from_all_history: bool = False,
) -> List[str]:
    """
    Weekly mode:
    - normal weekly runs reuse the active all-history curve_time_ranks_reference
    - rebuild Stage 1 for the recent rolling window
    - refresh Stage 2 mapping for the current date only (for summary consumers)
    - rebuild athlete history for the recent backfill window
    - sync recent eventpositions and push to Postgres
    - resume_from_all_history mode explicitly rebuilds the all-history reference first
    """
    current_iso = _normalize_iso_date(current_date) or current_date

    if resume_from_all_history:
        print(
            f"[curved_ranks] Resume mode: skipping Stage 1-3 pipeline and starting at all-history rebuild for {current_iso}"
        )
        processed = [current_iso]
    else:
        conn = None
        cursor = None
        render_db_conn = None
        render_cursor = None
        try:
            conn, cursor, render_db_conn, render_cursor = connections()
            _ensure_sqlite_math_functions(conn)
            _ensure_stage_tables(conn)

            if run_stage1:
                stage1_started = _ts()
                _rebuild_stage1(
                    sqlite_conn=conn,
                    upto_date=current_iso,
                    full_rebuild=False,
                    rolling_weeks=rolling_rebuild_weeks,
                )
                _log_timing("weekly.stage1", stage1_started)
            else:
                print("[curved_ranks] Weekly mode: skipping Stage 1 rebuild; using existing curve_run_metrics_history.")

            stage2_started = _ts()
            print(f"[curved_ranks] Weekly Stage 2 current snapshot started for {current_iso}")
            _build_stage2_for_date(conn, current_iso)
            _log_timing("weekly.stage2.current_snapshot", stage2_started)
            conn.commit()
            processed = [current_iso]
        finally:
            try:
                if cursor is not None:
                    cursor.close()
            except Exception:
                pass
            try:
                if render_cursor is not None:
                    render_cursor.close()
            except Exception:
                pass
            try:
                if conn is not None:
                    conn.close()
            except Exception:
                pass
            try:
                if render_db_conn is not None:
                    render_db_conn.close()
            except Exception:
                pass

    if processed:
        conn, cursor, render_db_conn, render_cursor = connections()
        try:
            _ensure_sqlite_math_functions(conn)
            _ensure_stage_tables(conn)
            current_iso = _normalize_iso_date(current_date) or processed[-1]
            backfill_start = (
                datetime.strptime(current_iso, "%Y-%m-%d")
                - timedelta(days=7 * CURVE_ATHLETE_HISTORY_WEEKLY_BACKFILL_WEEKS)
            ).strftime("%Y-%m-%d")

            cur = conn.cursor()
            try:
                cur.execute("SELECT COUNT(*) FROM curve_time_ranks_reference")
                ref_count = int(cur.fetchone()[0] or 0)
            finally:
                cur.close()

            if resume_from_all_history or ref_count <= 0:
                reference_started = _ts()
                reason = "resume rebuild" if resume_from_all_history else "table empty"
                print(
                    f"[curved_ranks] Rebuilding all-history curve_time_ranks_reference before weekly athlete history build ({reason})..."
                )
                _build_curve_time_ranks_reference_for_date(sqlite_conn=conn, snapshot_date=None)
                _log_timing("weekly.curve_time_ranks_reference.rebuild_all_history", reference_started)
            else:
                print(
                    f"[curved_ranks] Reusing existing all-history curve_time_ranks_reference for weekly athlete history build (rows={ref_count})."
                )

            _build_curve_athlete_best_rank_history_fast(
                sqlite_conn=conn,
                start_date=backfill_start,
                end_date=current_iso,
                rebuild_all=False,
            )
            _sync_eventpositions_from_curve_athlete_best_rank_history(
                sqlite_conn=conn,
                start_date=backfill_start,
                end_date=current_iso,
                event_code=event_code,
            )

            print(f"[curved_ranks] Ensuring Postgres curve rank columns...")
            _ensure_postgres_eventpositions_curve_rank_columns()
            print(f"[curved_ranks] Copying 3-week backfill {backfill_start}..{current_iso} to Postgres...")
            copy_table_to_postgres(
                table_name="eventpositions",
                key_columns=["event_code", "event_date", "athlete_code"],
                fields=list(EVENTPOSITION_CURVE_RANK_FIELDS),
                exact_date=False,
                updateOnly=True,
                start_date=backfill_start,
                end_date=current_iso,
                event_code=event_code,
            )
            print(f"[curved_ranks] ✓ Weekly Postgres backfill copy complete")
            conn.commit()
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                if render_cursor is not None:
                    render_cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass
            try:
                if render_db_conn is not None:
                    render_db_conn.close()
            except Exception:
                pass

    return processed


def run_curve_athlete_best_rank_history_one_off(
    current_date: Optional[str] = None,
    start_date: Optional[str] = None,
    run_stage1: bool = False,
    full_stage1_rebuild: bool = False,
    rolling_rebuild_weeks: int = 3,
) -> int:
    """
    One-off fast builder for curve_athlete_best_rank_history.

    - Builds current_best_rank_* from curve_run_metrics_history joined to curve_time_ranks_reference.
    - Builds historic_best_rank_* from prior dates only (excludes current week).
    - Builds historic_best_rank_1Y_* from trailing 1 year including the current day.
    - Sets best_curve_ranking_current from the best historic_best_rank_1Y_* value.
    - If start_date is not provided, rebuilds full history from scratch.
    """
    overall_started = _ts()
    conn, cursor, render_db_conn, render_cursor = connections()
    output_dir = os.path.join(PROJECT_ROOT, "curve_progress")
    progress_json_path = os.path.join(output_dir, "one_off_progress.json")
    try:
        _ensure_dir(output_dir)
        _ensure_sqlite_math_functions(conn)
        _ensure_stage_tables(conn)

        max_date = _get_max_event_date(conn)
        if not max_date:
            print("[curved_ranks] No parkrun_events dates found; nothing to process.")
            return 0

        current = _normalize_iso_date(current_date) or max_date
        start = _normalize_iso_date(start_date)

        print(
            f"[curved_ranks] one-off athlete history build: "
            f"start={start if start else 'ALL'}, end={current}, run_stage1={run_stage1}"
        )
        print(f"[curved_ranks] progress file: {progress_json_path}")
        _write_json(
            progress_json_path,
            {
                "status": "running",
                "mode": "one_off_athlete_history",
                "phase": "starting",
                "start_date": start,
                "end_date": current,
                "run_stage1": run_stage1,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            },
        )

        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT COUNT(DISTINCT formatted_date)
                FROM curve_run_metrics_history
                WHERE formatted_date <= :end_date
                  AND (:start_date IS NULL OR formatted_date >= :start_date)
                """,
                {"start_date": start, "end_date": current},
            )
            snapshot_count = int(cur.fetchone()[0] or 0)
            print(f"[curved_ranks] one-off scope includes {snapshot_count} snapshot dates")
        finally:
            cur.close()

        if run_stage1:
            _write_json(
                progress_json_path,
                {
                    "status": "running",
                    "mode": "one_off_athlete_history",
                    "phase": "stage1_rebuild",
                    "start_date": start,
                    "end_date": current,
                    "updated_at": datetime.now().isoformat(timespec="seconds"),
                },
            )
            _rebuild_stage1(
                sqlite_conn=conn,
                upto_date=current,
                full_rebuild=full_stage1_rebuild,
                rolling_weeks=rolling_rebuild_weeks,
            )

        # Ensure all-history time-rank reference exists for direct mapping by metric_type+second.
        _write_json(
            progress_json_path,
            {
                "status": "running",
                "mode": "one_off_athlete_history",
                "phase": "curve_time_reference",
                "start_date": start,
                "end_date": current,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        _build_curve_time_ranks_reference_for_date(sqlite_conn=conn, snapshot_date=None)

        _write_json(
            progress_json_path,
            {
                "status": "running",
                "mode": "one_off_athlete_history",
                "phase": "athlete_best_rank_history",
                "start_date": start,
                "end_date": current,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        rows = _build_curve_athlete_best_rank_history_fast(
            sqlite_conn=conn,
            start_date=start,
            end_date=current,
            rebuild_all=(start is None),
        )
        conn.commit()
        _write_json(
            progress_json_path,
            {
                "status": "completed",
                "mode": "one_off_athlete_history",
                "phase": "done",
                "start_date": start,
                "end_date": current,
                "rows_built": rows,
                "completed_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        _log_timing("one_off.curve_athlete_best_rank_history.total", overall_started)
        return rows
    except Exception:
        _write_json(
            progress_json_path,
            {
                "status": "failed",
                "mode": "one_off_athlete_history",
                "failed_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            if render_cursor is not None:
                render_cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        try:
            if render_db_conn is not None:
                render_db_conn.close()
        except Exception:
            pass


def run_eventpositions_sync_from_curve_history_one_off(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_code: Optional[int] = None,
    copy_to_postgres: bool = True,
) -> int:
    """
    One-off sync of eventpositions curve columns from curve_athlete_best_rank_history.

    - Updates eventpositions for matching (snapshot_date/event_date, athlete_code).
    - Optionally copies the updated curve columns to Postgres for the same date range.
    - If start/end are omitted, uses full available snapshot range in curve_athlete_best_rank_history.
    """
    overall_started = _ts()
    conn, cursor, render_db_conn, render_cursor = connections()
    output_dir = os.path.join(PROJECT_ROOT, "curve_progress")
    progress_json_path = os.path.join(output_dir, "one_off_progress.json")
    try:
        _ensure_dir(output_dir)
        _ensure_stage_tables(conn)

        normalized_start = _normalize_iso_date(start_date)
        normalized_end = _normalize_iso_date(end_date)

        if normalized_start is None:
            cursor.execute("SELECT MIN(snapshot_date) FROM curve_athlete_best_rank_history")
            row = cursor.fetchone()
            normalized_start = str(row[0]) if row and row[0] else None
        if normalized_end is None:
            cursor.execute("SELECT MAX(snapshot_date) FROM curve_athlete_best_rank_history")
            row = cursor.fetchone()
            normalized_end = str(row[0]) if row and row[0] else None

        if not normalized_start or not normalized_end:
            print("[curved_ranks] No curve_athlete_best_rank_history snapshots found; nothing to sync.")
            return 0

        print(
            f"[curved_ranks] one-off eventpositions sync from history: "
            f"start={normalized_start}, end={normalized_end}, event_code={event_code}, "
            f"copy_to_postgres={copy_to_postgres}"
        )
        print(f"[curved_ranks] progress file: {progress_json_path}")
        _write_json(
            progress_json_path,
            {
                "status": "running",
                "mode": "one_off_eventpositions_sync",
                "phase": "eventpositions_sync",
                "start_date": normalized_start,
                "end_date": normalized_end,
                "event_code": event_code,
                "copy_to_postgres": copy_to_postgres,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            },
        )

        def _eventpositions_sync_tick(elapsed_seconds: int) -> None:
            _write_json(
                progress_json_path,
                {
                    "status": "running",
                    "mode": "one_off_eventpositions_sync",
                    "phase": "eventpositions_sync",
                    "start_date": normalized_start,
                    "end_date": normalized_end,
                    "event_code": event_code,
                    "copy_to_postgres": copy_to_postgres,
                    "heartbeat_at": datetime.now().isoformat(timespec="seconds"),
                    "elapsed_seconds": elapsed_seconds,
                },
            )

        sync_hb_stop, sync_hb_thread, sync_hb_started = _start_heartbeat(
            label="one-off eventpositions sync",
            interval_seconds=15.0,
            on_tick=_eventpositions_sync_tick,
        )
        try:
            rows_changed = _sync_eventpositions_from_curve_athlete_best_rank_history(
                sqlite_conn=conn,
                start_date=normalized_start,
                end_date=normalized_end,
                event_code=event_code,
            )
        finally:
            _stop_heartbeat(sync_hb_stop, sync_hb_thread, sync_hb_started, "one-off eventpositions sync")

        if copy_to_postgres and rows_changed > 0:
            _write_json(
                progress_json_path,
                {
                    "status": "running",
                    "mode": "one_off_eventpositions_sync",
                    "phase": "copy_to_postgres",
                    "start_date": normalized_start,
                    "end_date": normalized_end,
                    "event_code": event_code,
                    "rows_changed": rows_changed,
                    "updated_at": datetime.now().isoformat(timespec="seconds"),
                },
            )
            print(f"[curved_ranks] Ensuring Postgres curve rank columns...")
            _ensure_postgres_eventpositions_curve_rank_columns()
            print(f"[curved_ranks] Copying one-off range {normalized_start}..{normalized_end} to Postgres...")
            def _copy_tick(elapsed_seconds: int) -> None:
                _write_json(
                    progress_json_path,
                    {
                        "status": "running",
                        "mode": "one_off_eventpositions_sync",
                        "phase": "copy_to_postgres",
                        "start_date": normalized_start,
                        "end_date": normalized_end,
                        "event_code": event_code,
                        "rows_changed": rows_changed,
                        "heartbeat_at": datetime.now().isoformat(timespec="seconds"),
                        "elapsed_seconds": elapsed_seconds,
                    },
                )

            copy_hb_stop, copy_hb_thread, copy_hb_started = _start_heartbeat(
                label="one-off copy_to_postgres",
                interval_seconds=15.0,
                on_tick=_copy_tick,
            )
            try:
                copy_table_to_postgres(
                    table_name="eventpositions",
                    key_columns=["event_code", "event_date", "athlete_code"],
                    fields=list(EVENTPOSITION_CURVE_RANK_FIELDS),
                    exact_date=False,
                    updateOnly=True,
                    start_date=normalized_start,
                    end_date=normalized_end,
                    event_code=event_code,
                )
            finally:
                _stop_heartbeat(copy_hb_stop, copy_hb_thread, copy_hb_started, "one-off copy_to_postgres")
            print(f"[curved_ranks] ✓ One-off Postgres copy complete")

        conn.commit()
        _write_json(
            progress_json_path,
            {
                "status": "completed",
                "mode": "one_off_eventpositions_sync",
                "phase": "done",
                "start_date": normalized_start,
                "end_date": normalized_end,
                "event_code": event_code,
                "rows_changed": rows_changed,
                "completed_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        _log_timing("one_off.eventpositions_sync_from_curve_history.total", overall_started)
        return rows_changed
    except Exception:
        _write_json(
            progress_json_path,
            {
                "status": "failed",
                "mode": "one_off_eventpositions_sync",
                "failed_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            if render_cursor is not None:
                render_cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        try:
            if render_db_conn is not None:
                render_db_conn.close()
        except Exception:
            pass


def run_curve_time_ranks_reference_one_off(
    current_date: Optional[str] = None,
    start_date: Optional[str] = None,
    loop_all_dates: bool = False,
    run_stage1: bool = False,
    full_stage1_rebuild: bool = False,
    rolling_rebuild_weeks: int = 3,
    x_value: float = CURVE_REFERENCE_DEFAULT_X,
    start_sec: int = CURVE_REFERENCE_DEFAULT_START_SEC,
    end_sec: int = CURVE_REFERENCE_DEFAULT_END_SEC,
    min_appearances: int = CURVE_REFERENCE_DEFAULT_MIN_APPEARANCES,
) -> List[str]:
    """
    One-off builder for curve_time_ranks_reference only.

    - Does not run Stage 2/Stage 3 athlete/eventpositions updates.
    - Optionally refreshes Stage 1 first when run_stage1=True.
    - Default behavior builds one all-history reference (`snapshot_date='ALL'`).
    """
    overall_started = _ts()
    conn, cursor, render_db_conn, render_cursor = connections()
    processed_dates: List[str] = []
    try:
        _ensure_sqlite_math_functions(conn)
        _ensure_stage_tables(conn)

        max_date = _get_max_event_date(conn)
        if not max_date:
            print("[curved_ranks] No parkrun_events dates found; nothing to process.")
            return processed_dates

        current = _normalize_iso_date(current_date)
        start = _normalize_iso_date(start_date)

        if run_stage1:
            stage1_upto_date = current or max_date
            _rebuild_stage1(
                sqlite_conn=conn,
                upto_date=stage1_upto_date,
                full_rebuild=full_stage1_rebuild,
                rolling_weeks=rolling_rebuild_weeks,
            )

        if loop_all_dates:
            end_date = current or max_date
            dates = _get_snapshot_dates(conn, start_date=start, end_date=end_date)
            print(
                f"[curved_ranks] one-off curve_time_ranks_reference build by snapshot dates: dates={len(dates)}, "
                f"start={dates[0] if dates else None}, end={dates[-1] if dates else None}, "
                f"x={x_value}, min_appearances={min_appearances}, sec_range={start_sec}-{end_sec}"
            )

            for idx, d in enumerate(dates, start=1):
                print(f"[curved_ranks] one-off build {idx}/{len(dates)}: {d}")
                _build_curve_time_ranks_reference_for_date(
                    sqlite_conn=conn,
                    snapshot_date=d,
                    x_value=x_value,
                    start_sec=start_sec,
                    end_sec=end_sec,
                    min_appearances=min_appearances,
                )
                processed_dates.append(d)
        else:
            snapshot_for_build = current if current else None
            label = snapshot_for_build if snapshot_for_build else "ALL"
            if snapshot_for_build is None:
                # Default one-off mode is a full-history reference. Clear older dated snapshots to avoid mixed results.
                conn.execute("DELETE FROM curve_time_ranks_reference")
            print(
                f"[curved_ranks] one-off curve_time_ranks_reference single build: snapshot={label}, "
                f"x={x_value}, min_appearances={min_appearances}, sec_range={start_sec}-{end_sec}"
            )
            _build_curve_time_ranks_reference_for_date(
                sqlite_conn=conn,
                snapshot_date=snapshot_for_build,
                x_value=x_value,
                start_sec=start_sec,
                end_sec=end_sec,
                min_appearances=min_appearances,
            )
            processed_dates.append(label)

        conn.commit()
        _log_timing("one_off.curve_time_ranks_reference.total", overall_started)
        return processed_dates
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            if render_cursor is not None:
                render_cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        try:
            if render_db_conn is not None:
                render_db_conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    processed = run_curved_ranks_pipeline(
        current_date=None,
        start_date=None,
        loop_all_dates=True,
        full_stage1_rebuild=True,
        rolling_rebuild_weeks=3,
        event_code=None,
        copy_to_postgres=False,
    )
    print(f"[curved_ranks] done. processed_dates={len(processed)}")
