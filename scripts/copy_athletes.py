from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from psycopg2.extras import execute_batch
from scripts.database_helpers import connections

from typing import Optional
def copy_athletes_to_postgres(end_date: str = None,
                              updateFrom: 'str | None' = None,
                              batch_size: int = 500,
                              cast_timestamps: bool = False,
                              run_age_update: bool = False):
    """
    Copy `athletes` from SQLite -> Postgres with optional filtering and an age update step.

    Parameters
    - end_date: unused for the copy but kept for parity with other callers (optional)
    - updateFrom: if set (string yyyy-mm-dd), only source rows with last_updated >= updateFrom
      will be selected for upsert. This implements your "updateFrom" gating requirement.
    - batch_size: how many rows to upsert per batch
    - cast_timestamps: if True, cast last_updated comparisons to timestamp in Postgres
    - run_age_update: if True, run a Postgres UPDATE that computes `current_age_estimate`
      from `tmp_final_age_updates` using the logic you supplied (translated to Postgres).

    Notes:
    - This function uses the repo `connections()` helper to obtain both SQLite and
      Postgres cursors. It expects `athlete_code` to be a unique key in Postgres.
    - The Postgres age-update expects a table `tmp_final_age_updates` in Postgres with
      columns: athlete_code, final_min_dob, final_max_dob, final_last_updated.
      The SQL uses `::date` casts and the difference in days divided by 365.2425.
    """
    conn_sqlite, cur_sqlite, conn_pg, cur_pg = connections()
    try:
        cols = [
            "athlete_code",
            "name",
            "min_dob",
            "max_dob",
            "last_updated",
            "club",
            "sex",
            "last_age_estimate",
            "current_age_estimate",
            "total_runs",
            "total_vols",
            "recent_runs",
        ]

        select_sql = "SELECT " + ", ".join(cols) + " FROM athletes"
        params = None
        if updateFrom:
            # SQLite placeholder is ?
            select_sql += " WHERE date(last_updated) >= date(?)"
            params = (updateFrom,)

        if params:
            cur_sqlite.execute(select_sql, params)
        else:
            cur_sqlite.execute(select_sql)

        rows = cur_sqlite.fetchall()
        if not rows:
            print("No athlete rows to copy (after updateFrom filter).")
            return

        # build upsert statement
        placeholders = ", ".join(["%s"] * len(cols))
        update_assign = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols if c != "athlete_code"])

        # guard updates by last_updated when existing value is newer
        if cast_timestamps:
            last_cmp = "(EXCLUDED.last_updated::timestamp >= athletes.last_updated::timestamp OR athletes.last_updated IS NULL)"
        else:
            last_cmp = "(EXCLUDED.last_updated >= athletes.last_updated OR athletes.last_updated IS NULL)"

        insert_sql = (
            f"INSERT INTO athletes ({', '.join(cols)}) VALUES ({placeholders}) "
            f"ON CONFLICT (athlete_code) DO UPDATE SET {update_assign} WHERE {last_cmp}"
        )

        def _coerce_row(r):
            coerced = []
            for v in r:
                if isinstance(v, str) and v.strip() == "":
                    coerced.append(None)
                else:
                    coerced.append(v)
            return tuple(coerced)

        prepared = [_coerce_row(r) for r in rows]

        total = len(prepared)
        for start in range(0, total, batch_size):
            batch = prepared[start : start + batch_size]
            execute_batch(cur_pg, insert_sql, batch, page_size=batch_size)
            print(f"Upserted athletes {start+1}-{min(start+batch_size,total)} of {total}")

        conn_pg.commit()
        print(f"Completed copying {total} athletes to Postgres.")

        if run_age_update:
            # Postgres SQL translating your SQLite julianday logic to Postgres date arithmetic
            # NOTE: this expects tmp_final_age_updates to exist in Postgres with the
            # columns: athlete_code, final_min_dob, final_max_dob, final_last_updated
            age_sql = f"""
            UPDATE athletes a
            SET current_age_estimate = sub.new_age
            FROM (
              SELECT fu.athlete_code,
                CASE
                  WHEN fu.final_min_dob IS NULL AND fu.final_max_dob IS NULL THEN NULL
                  WHEN fu.final_min_dob IS NULL THEN ROUND(((fu.final_last_updated::date - fu.final_max_dob::date)::numeric / 365.2425)::numeric, 2)
                  WHEN fu.final_max_dob IS NULL THEN ROUND(((fu.final_last_updated::date - fu.final_min_dob::date)::numeric / 365.2425)::numeric, 2)
                  ELSE ROUND((((fu.final_last_updated::date - fu.final_max_dob::date) + (fu.final_last_updated::date - fu.final_min_dob::date))::numeric / (2.0 * 365.2425))::numeric, 2)
                END AS new_age
              FROM tmp_final_age_updates fu
            ) sub
            WHERE a.athlete_code = sub.athlete_code
              AND sub.new_age IS NOT NULL
            """
            try:
                cur_pg.execute(age_sql)
                conn_pg.commit()
                print("Updated current_age_estimate in Postgres from tmp_final_age_updates.")
            except Exception as e:
                print(f"Error running age update SQL: {e}")
                try:
                    conn_pg.rollback()
                except Exception:
                    pass

    finally:
        try:
            conn_sqlite.close()
        except Exception:
            pass
        try:
            conn_pg.close()
        except Exception:
            pass


if __name__ == '__main__':
    # Example run (adjust parameters as needed)
    copy_athletes_to_postgres(updateFrom=None, cast_timestamps=False, run_age_update=False)
