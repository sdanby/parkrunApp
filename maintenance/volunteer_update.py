import argparse
import csv
import re
from datetime import datetime

import scripts.database_helpers as database


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").strip().lower())


def _parse_date_candidates(raw_date: str):
    raw = (raw_date or "").strip()
    if not raw:
        return ["", "", ""]

    formats = ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d")
    dt = None
    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            break
        except ValueError:
            pass

    if dt is None:
        # Keep raw only if parsing failed
        return [raw, raw, raw]

    dmy = dt.strftime("%d/%m/%Y")
    iso = dt.strftime("%Y-%m-%d")
    raw_clean = raw
    vals = []
    for v in (raw_clean, dmy, iso):
        if v not in vals:
            vals.append(v)
    while len(vals) < 3:
        vals.append(vals[-1])
    return vals[:3]


def _to_int(value):
    s = str(value or "").strip().replace(",", "")
    return int(s) if s else 0


def _resolve_conn_cursor(obj):
    """Accepts connection, cursor, or tuple/list and returns (conn, cursor)."""
    if obj is None:
        return None, None

    # DB-API connection
    if hasattr(obj, "cursor") and callable(getattr(obj, "cursor", None)):
        try:
            return obj, obj.cursor()
        except Exception:
            pass

    # Cursor object
    if hasattr(obj, "execute") and hasattr(obj, "connection"):
        try:
            return obj.connection, obj
        except Exception:
            pass

    # Tuple/list forms
    if isinstance(obj, (tuple, list)):
        if len(obj) == 2:
            a, b = obj[0], obj[1]

            # (conn, cursor)
            if hasattr(a, "cursor") and hasattr(b, "execute"):
                return a, b

            # (cursor, conn)
            if hasattr(a, "execute") and hasattr(b, "cursor"):
                return b, a

        # nested scan
        for item in obj:
            c, cur = _resolve_conn_cursor(item)
            if c and cur:
                return c, cur

    return None, None


def _call_noarg(fn):
    try:
        return fn()
    except TypeError:
        # function needs args
        return None
    except Exception:
        return None


def _find_conn_from_module(kind: str):
    """
    kind='sqlite' or kind='pg'
    Scans database.py callables with name hints and returns (conn, cursor, function_name).
    """
    names = [n for n in dir(database) if callable(getattr(database, n, None))]
    if kind == "sqlite":
        hints = ("sqlite",)
    else:
        hints = ("postgres", "render", "pg")

    ordered = sorted(
        names,
        key=lambda n: (
            0 if any(h in n.lower() for h in hints) else 1,
            0 if "connection" in n.lower() else 1,
            0 if n.lower().startswith(("get_", "create_", "connect_")) else 1,
            n.lower(),
        ),
    )

    for name in ordered:
        lname = name.lower()
        if not any(h in lname for h in hints):
            continue

        fn = getattr(database, name)
        result = _call_noarg(fn)
        conn, cur = _resolve_conn_cursor(result)
        if conn and cur:
            return conn, cur, name

    return None, None, None


def _resolve_connection_bundle(result):
    """
    Normalize common bundle shapes into:
    (sqlite_conn, sqlite_cursor, pg_conn, pg_cursor)
    """
    if result is None:
        return None, None, None, None

    # dict style
    if isinstance(result, dict):
        s_conn = result.get("sqlite_conn") or result.get("sqlite_connection") or result.get("conn_sqlite")
        s_cur = result.get("sqlite_cursor") or result.get("cursor_sqlite")
        p_conn = result.get("pg_conn") or result.get("postgres_conn") or result.get("render_conn") or result.get("postgres_connection")
        p_cur = result.get("pg_cursor") or result.get("postgres_cursor") or result.get("render_cursor")

        s_conn, s_cur = _resolve_conn_cursor((s_conn, s_cur)) if (s_conn or s_cur) else (None, None)
        p_conn, p_cur = _resolve_conn_cursor((p_conn, p_cur)) if (p_conn or p_cur) else (None, None)
        if s_conn and s_cur and p_conn and p_cur:
            return s_conn, s_cur, p_conn, p_cur

    # tuple/list style
    if isinstance(result, (tuple, list)):
        # (s_conn, s_cur, p_conn, p_cur)
        if len(result) == 4:
            s_conn, s_cur = _resolve_conn_cursor((result[0], result[1]))
            p_conn, p_cur = _resolve_conn_cursor((result[2], result[3]))
            if s_conn and s_cur and p_conn and p_cur:
                return s_conn, s_cur, p_conn, p_cur

        # ((s_conn,s_cur),(p_conn,p_cur)) OR (s_conn,p_conn)
        if len(result) == 2:
            left_conn, left_cur = _resolve_conn_cursor(result[0])
            right_conn, right_cur = _resolve_conn_cursor(result[1])
            if left_conn and left_cur and right_conn and right_cur:
                return left_conn, left_cur, right_conn, right_cur

            # maybe (sqlite_conn, pg_conn)
            s_conn, s_cur = _resolve_conn_cursor(result[0])
            p_conn, p_cur = _resolve_conn_cursor(result[1])
            if s_conn and s_cur and p_conn and p_cur:
                return s_conn, s_cur, p_conn, p_cur

    return None, None, None, None


def _open_connections():
    # 1) Try all-in-one functions first (including your database.connections)
    for fn_name in ("connections", "get_database_connections", "get_connections", "get_db_connections"):
        fn = getattr(database, fn_name, None)
        if callable(fn):
            result = _call_noarg(fn)
            s_conn, s_cur, p_conn, p_cur = _resolve_connection_bundle(result)
            if s_conn and s_cur and p_conn and p_cur:
                print(f"Using database.py connector bundle: {fn_name}")
                return s_conn, s_cur, p_conn, p_cur

    # 2) Existing explicit-name fallback
    sqlite_conn = sqlite_cursor = None
    pg_conn = pg_cursor = None
    sqlite_source = pg_source = None

    for n in ("get_sqlite_connection", "create_sqlite_connection", "connect_sqlite", "sqlite_connection"):
        fn = getattr(database, n, None)
        if callable(fn):
            sqlite_conn, sqlite_cursor = _resolve_conn_cursor(_call_noarg(fn))
            if sqlite_conn and sqlite_cursor:
                sqlite_source = n
                break

    for n in ("get_postgres_connection", "create_postgres_connection", "get_render_connection", "connect_postgres", "pg_connection", "render_connection"):
        fn = getattr(database, n, None)
        if callable(fn):
            pg_conn, pg_cursor = _resolve_conn_cursor(_call_noarg(fn))
            if pg_conn and pg_cursor:
                pg_source = n
                break

    if not (sqlite_conn and sqlite_cursor):
        sqlite_conn, sqlite_cursor, sqlite_source = _find_conn_from_module("sqlite")
    if not (pg_conn and pg_cursor):
        pg_conn, pg_cursor, pg_source = _find_conn_from_module("pg")

    if sqlite_conn and sqlite_cursor and pg_conn and pg_cursor:
        print(f"Using database.py connectors: sqlite={sqlite_source}, pg={pg_source}")
        return sqlite_conn, sqlite_cursor, pg_conn, pg_cursor

    callable_names = [n for n in dir(database) if callable(getattr(database, n, None))]
    raise RuntimeError(
        "Could not auto-resolve SQLite/Postgres connections from database.py.\n"
        f"Callable names found: {', '.join(sorted(callable_names))}"
    )




def _load_updates(csv_path):
    updates = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            event_name = (row.get("event_name") or row.get("event") or row.get("display_name") or "").strip()
            event_date = (row.get("event_date") or row.get("date") or "").strip()
            volunteers_raw = row.get("volunteers") or row.get("volunteer_count") or row.get("volunteer")

            if not event_name or not event_date or volunteers_raw in (None, ""):
                print(f"Skipping line {i}: missing event_name/event_date/volunteers")
                continue

            try:
                volunteers = _to_int(volunteers_raw)
            except Exception:
                print(f"Skipping line {i}: invalid volunteers '{volunteers_raw}'")
                continue

            updates.append(
                {
                    "event_name": event_name,
                    "event_date": event_date,
                    "volunteers": volunteers,
                }
            )
    return updates


def _event_code_map(sqlite_cursor):
    sqlite_cursor.execute("SELECT event_code, event_name, display_name FROM events;")
    rows = sqlite_cursor.fetchall()

    out = {}
    for event_code, event_name, display_name in rows:
        if event_name:
            out[_norm_key(event_name)] = event_code
            out[event_name.strip().lower()] = event_code
        if display_name:
            out[_norm_key(display_name)] = event_code
            out[display_name.strip().lower()] = event_code
    return out


def _update_sqlite(sqlite_cursor, event_code, date_candidates, volunteers):
    sql = """
        UPDATE parkrun_events
        SET volunteers = ?
        WHERE event_code = ?
          AND CAST(event_date AS TEXT) IN (?, ?, ?)
    """
    sqlite_cursor.execute(sql, (volunteers, event_code, date_candidates[0], date_candidates[1], date_candidates[2]))
    return sqlite_cursor.rowcount if sqlite_cursor.rowcount is not None else 0


def _update_pg(pg_cursor, event_code, date_candidates, volunteers):
    sql = """
        UPDATE parkrun_events
        SET volunteers = %s
        WHERE event_code = %s
          AND event_date::text IN (%s, %s, %s)
    """
    pg_cursor.execute(sql, (volunteers, event_code, date_candidates[0], date_candidates[1], date_candidates[2]))
    return pg_cursor.rowcount if pg_cursor.rowcount is not None else 0


def main():
    parser = argparse.ArgumentParser(description="Update volunteers in parkrun_events (SQLite + Postgres).")
    parser.add_argument("--input", required=True, help="CSV file with event_name,event_date,volunteers")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without committing")
    args = parser.parse_args()

    sqlite_conn = sqlite_cursor = pg_conn = pg_cursor = None

    try:
        sqlite_conn, sqlite_cursor, pg_conn, pg_cursor = _open_connections()

        updates = _load_updates(args.input)
        if not updates:
            print("No valid rows found in input.")
            return

        code_map = _event_code_map(sqlite_cursor)

        ok = 0
        missing_event = 0
        not_found = 0

        for row in updates:
            key_raw = row["event_name"].strip().lower()
            key_norm = _norm_key(row["event_name"])
            event_code = code_map.get(key_raw) or code_map.get(key_norm)

            if event_code is None:
                print(f"[MISS EVENT] {row['event_name']}")
                missing_event += 1
                continue

            dates = _parse_date_candidates(row["event_date"])
            volunteers = row["volunteers"]

            if args.dry_run:
                print(
                    f"[DRY] event_code={event_code}, event_name={row['event_name']}, "
                    f"event_date={row['event_date']}, volunteers={volunteers}, candidates={dates}"
                )
                ok += 1
                continue

            s_count = _update_sqlite(sqlite_cursor, event_code, dates, volunteers)
            p_count = _update_pg(pg_cursor, event_code, dates, volunteers)

            if s_count == 0 and p_count == 0:
                print(
                    f"[NOT FOUND] event_code={event_code}, event_name={row['event_name']}, "
                    f"event_date={row['event_date']}, candidates={dates}"
                )
                not_found += 1
            else:
                print(
                    f"[OK] event_code={event_code}, event_name={row['event_name']}, "
                    f"event_date={row['event_date']} -> volunteers={volunteers} "
                    f"(sqlite={s_count}, pg={p_count})"
                )
                ok += 1

        if args.dry_run:
            sqlite_conn.rollback()
            pg_conn.rollback()
            print(f"\nDry run complete. rows={len(updates)}, ok={ok}, missing_event={missing_event}, not_found={not_found}")
        else:
            sqlite_conn.commit()
            pg_conn.commit()
            print(f"\nUpdate complete. rows={len(updates)}, ok={ok}, missing_event={missing_event}, not_found={not_found}")

    except Exception as e:
        print(f"Error: {e}")
        try:
            if sqlite_conn:
                sqlite_conn.rollback()
        except Exception:
            pass
        try:
            if pg_conn:
                pg_conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            if sqlite_cursor:
                sqlite_cursor.close()
        except Exception:
            pass
        try:
            if pg_cursor:
                pg_cursor.close()
        except Exception:
            pass
        try:
            if sqlite_conn:
                sqlite_conn.close()
        except Exception:
            pass
        try:
            if pg_conn:
                pg_conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()