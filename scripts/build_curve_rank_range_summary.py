import argparse
import os
import sys
from typing import Optional
from sqlite3 import OperationalError

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from etl.analytics import copy_table_to_postgres
from scripts.database_helpers import connections
from psycopg2.extras import execute_batch


CREATE_SQLITE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS curve_rank_range_summary (
    snapshot_date TEXT NOT NULL,
    period_type TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    rank INTEGER NOT NULL,
    min_best_metric_seconds REAL,
    max_best_metric_seconds REAL,
    source_rows INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (snapshot_date, period_type, metric_type, rank)
)
"""

CREATE_POSTGRES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS curve_rank_range_summary (
    snapshot_date DATE NOT NULL,
    period_type TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    rank INTEGER NOT NULL,
    min_best_metric_seconds DOUBLE PRECISION,
    max_best_metric_seconds DOUBLE PRECISION,
    source_rows INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (snapshot_date, period_type, metric_type, rank)
)
"""

CREATE_POSTGRES_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_curve_rank_range_summary_metric
ON curve_rank_range_summary (snapshot_date, period_type, metric_type, rank)
"""


def _latest_snapshot(cursor) -> Optional[str]:
    cursor.execute("SELECT MAX(snapshot_date) FROM curve_rank_mapping_history")
    row = cursor.fetchone()
    if not row:
        return None
    return row[0]


def _build_summary(cursor, snapshot_date: Optional[str]) -> int:
    cursor.execute(CREATE_SQLITE_TABLE_SQL)
    cursor.execute("PRAGMA table_info(curve_rank_range_summary)")
    existing_cols = {str(r[1]).lower() for r in cursor.fetchall()}
    if "source_rows" not in existing_cols:
        cursor.execute(
            "ALTER TABLE curve_rank_range_summary ADD COLUMN source_rows INTEGER NOT NULL DEFAULT 0"
        )

    if snapshot_date:
        cursor.execute(
            "DELETE FROM curve_rank_range_summary WHERE snapshot_date = ?",
            (snapshot_date,),
        )
        params = (snapshot_date,)
        snapshot_where = "AND snapshot_date = ?"
    else:
        cursor.execute("DELETE FROM curve_rank_range_summary")
        params = tuple()
        snapshot_where = ""

    # Aggregate dense source rows into rank-level min/max ranges.
    cursor.execute(
        f"""
        INSERT INTO curve_rank_range_summary (
            snapshot_date,
            period_type,
            metric_type,
            rank,
            min_best_metric_seconds,
            max_best_metric_seconds,
            source_rows
        )
        SELECT
            snapshot_date,
            period_type,
            metric_type,
            rank,
            MIN(best_metric_seconds) AS min_best_metric_seconds,
            MAX(best_metric_seconds) AS max_best_metric_seconds,
            COUNT(*) AS source_rows
        FROM curve_rank_mapping_history
        WHERE rank BETWEEN 0 AND 100
          {snapshot_where}
        GROUP BY snapshot_date, period_type, metric_type, rank
        """,
        params,
    )

    cursor.execute(
        "SELECT COUNT(*) FROM curve_rank_range_summary" + (" WHERE snapshot_date = ?" if snapshot_date else ""),
        ((snapshot_date,) if snapshot_date else tuple()),
    )
    return int(cursor.fetchone()[0] or 0)


def _fetch_summary_rows(cursor, snapshot_date: Optional[str]):
    if snapshot_date:
        cursor.execute(
            """
            SELECT
                snapshot_date,
                period_type,
                metric_type,
                rank,
                MIN(best_metric_seconds) AS min_best_metric_seconds,
                MAX(best_metric_seconds) AS max_best_metric_seconds,
                COUNT(*) AS source_rows
            FROM curve_rank_mapping_history
            WHERE rank BETWEEN 0 AND 100
              AND snapshot_date = ?
            GROUP BY snapshot_date, period_type, metric_type, rank
            ORDER BY snapshot_date, period_type, metric_type, rank
            """,
            (snapshot_date,),
        )
    else:
        cursor.execute(
            """
            SELECT
                snapshot_date,
                period_type,
                metric_type,
                rank,
                MIN(best_metric_seconds) AS min_best_metric_seconds,
                MAX(best_metric_seconds) AS max_best_metric_seconds,
                COUNT(*) AS source_rows
            FROM curve_rank_mapping_history
            WHERE rank BETWEEN 0 AND 100
            GROUP BY snapshot_date, period_type, metric_type, rank
            ORDER BY snapshot_date, period_type, metric_type, rank
            """
        )
    return cursor.fetchall()


def _upsert_summary_rows_postgres(render_cursor, render_db_conn, rows) -> int:
    if not rows:
        return 0

    upsert_sql = """
    INSERT INTO curve_rank_range_summary (
        snapshot_date,
        period_type,
        metric_type,
        rank,
        min_best_metric_seconds,
        max_best_metric_seconds,
        source_rows
    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (snapshot_date, period_type, metric_type, rank)
    DO UPDATE SET
        min_best_metric_seconds = EXCLUDED.min_best_metric_seconds,
        max_best_metric_seconds = EXCLUDED.max_best_metric_seconds,
        source_rows = EXCLUDED.source_rows
    """
    execute_batch(render_cursor, upsert_sql, rows, page_size=1000)
    render_db_conn.commit()
    return len(rows)


def _ensure_postgres_table(render_cursor, render_db_conn) -> None:
    render_cursor.execute(CREATE_POSTGRES_TABLE_SQL)
    render_cursor.execute(CREATE_POSTGRES_INDEX_SQL)
    render_db_conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build curve_rank_range_summary from curve_rank_mapping_history and optionally upload to Postgres."
    )
    parser.add_argument(
        "--snapshot-date",
        default="latest",
        help="ISO snapshot date (YYYY-MM-DD), 'latest', or 'all' (default: latest)",
    )
    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Build in SQLite only; do not upload to Postgres",
    )
    args = parser.parse_args()

    conn, cursor, render_db_conn, render_cursor = connections()
    try:
        requested = (args.snapshot_date or "latest").strip().lower()
        if requested == "latest":
            snapshot_date = _latest_snapshot(cursor)
            if not snapshot_date:
                raise RuntimeError("No snapshot_date found in curve_rank_mapping_history.")
        elif requested == "all":
            snapshot_date = None
        else:
            snapshot_date = args.snapshot_date

        rows = _fetch_summary_rows(cursor, snapshot_date)
        row_count = len(rows)

        wrote_sqlite_summary = False
        try:
            _build_summary(cursor, snapshot_date)
            conn.commit()
            wrote_sqlite_summary = True
        except OperationalError as exc:
            # Another process can hold a write lock; keep going with in-memory rows.
            if "database is locked" in str(exc).lower():
                try:
                    conn.rollback()
                except Exception:
                    pass
                print("[curve_rank_range_summary] SQLite write locked; continuing with in-memory summary rows")
            else:
                raise

        scope = snapshot_date if snapshot_date else "all snapshots"
        if wrote_sqlite_summary:
            print(f"[curve_rank_range_summary] built {row_count} rows for {scope} in SQLite")
        else:
            print(f"[curve_rank_range_summary] built {row_count} rows for {scope} in memory")

        if args.no_upload:
            print("[curve_rank_range_summary] upload skipped (--no-upload)")
            return

        _ensure_postgres_table(render_cursor, render_db_conn)

        if wrote_sqlite_summary:
            # copy_table_to_postgres reads from SQLite and upserts into Postgres.
            copy_table_to_postgres(
                table_name="curve_rank_range_summary",
                key_columns=["snapshot_date", "period_type", "metric_type", "rank"],
                fields=["min_best_metric_seconds", "max_best_metric_seconds", "source_rows"],
                earliest_date=(snapshot_date if snapshot_date else "1900-01-01"),
                date_column="snapshot_date",
                date_is_iso=True,
                updateOnly=False,
                exact_date=bool(snapshot_date),
                start_date=(snapshot_date if snapshot_date else None),
                end_date=(snapshot_date if snapshot_date else None),
            )
        else:
            uploaded = _upsert_summary_rows_postgres(render_cursor, render_db_conn, rows)
            print(f"[curve_rank_range_summary] upserted {uploaded} rows directly to Postgres")

        print(f"[curve_rank_range_summary] uploaded summary rows for {scope} to Postgres")
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


if __name__ == "__main__":
    main()
