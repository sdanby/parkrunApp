import json
import os
import time
import re
from pathlib import Path
from datetime import datetime, timedelta
import sqlite3
import tkinter as _tk
from tkinter import messagebox as _messagebox

from scripts.scraper_tools import (
    create_webdriver,
    WebDriverWait,
    check_page_not_found,
    get_parkrun_events,
    select_detailed_view,
    load_more_results,
    findElements,
)
from selenium.webdriver.common.by import By

from scripts.database_helpers import connections, update_parkrun_events
from psycopg2.extras import execute_values

PROGRESS_FILE = Path("athlete_runs_progress.json")
FLUSH_SIZE = 10


def load_progress():
    if PROGRESS_FILE.exists():
        try:
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return int(data.get("index", 0))
        except Exception:
            return 0
    return 0


def save_progress(index):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump({"index": index}, f)


def column_exists_sqlite(cursor, table, column):
    try:
        cursor.execute(f"PRAGMA table_info({table});")
        cols = [r[1] for r in cursor.fetchall()]
        return column in cols
    except Exception:
        return False


def column_exists_postgres(render_cursor, table, column):
    try:
        render_cursor.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=%s AND column_name=%s;",
            (table, column),
        )
        return render_cursor.fetchone() is not None
    except Exception:
        return False


def build_event_url(event_name, event_number):
    # event_name is expected to be the parkrun slug used in URLs
    return f"https://www.parkrun.org.uk/{event_name}/results/{event_number}/"


def extract_runner_code_from_row(row):
    try:
        # find anchor inside name cell
        a = row.find_element(By.CSS_SELECTOR, "td.Results-table-td--name a")
        href = a.get_attribute("href")
        if href:
            parts = [p for p in href.split("/") if p]
            return parts[-1]
    except Exception:
        pass
    return None


def extract_runs_from_row(row):
    # Primary: data-runs attribute on the tr
    try:
        runs_attr = row.get_attribute("data-runs")
        if runs_attr and runs_attr.strip().isdigit():
            return int(runs_attr.strip())
    except Exception:
        pass

    # Fallback: look for .detailed text like "36 parkruns"
    try:
        detailed = row.find_element(By.CSS_SELECTOR, "td.Results-table-td--name .detailed")
        m = re.search(r"(\d+)\s+parkrun", detailed.text)
        if m:
            return int(m.group(1))
    except Exception:
        pass

    return None


def extract_vols_from_row(row):
    # Primary: data-vols attribute on the tr
    try:
        vols_attr = row.get_attribute("data-vols")
        if vols_attr and vols_attr.strip().isdigit():
            return int(vols_attr.strip())
    except Exception:
        pass

    # Fallback: look for volunteer milestone text in the detailed section when present.
    try:
        detailed = row.find_element(By.CSS_SELECTOR, "td.Results-table-td--name .detailed")
        m = re.search(r"(\d+)\s+volunteer", detailed.text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    except Exception:
        pass

    return None


def ensure_athletes_total_vols_column(sqlite_cursor, render_cursor):
    sqlite_has_column = column_exists_sqlite(sqlite_cursor, 'athletes', 'total_vols')
    pg_has_column = column_exists_postgres(render_cursor, 'athletes', 'total_vols')

    if not sqlite_has_column:
        try:
            sqlite_cursor.execute("ALTER TABLE athletes ADD COLUMN total_vols INTEGER;")
            sqlite_cursor.connection.commit()
            sqlite_has_column = True
        except Exception:
            try:
                sqlite_cursor.connection.rollback()
            except Exception:
                pass

    if not pg_has_column:
        try:
            render_cursor.execute("ALTER TABLE athletes ADD COLUMN total_vols INTEGER;")
            render_cursor.connection.commit()
            pg_has_column = True
        except Exception:
            try:
                render_cursor.connection.rollback()
            except Exception:
                pass

    return sqlite_has_column, pg_has_column


def bulk_update_athlete_total_runs(sqlite_cursor, render_cursor, runs_list, has_column_sqlite, has_column_pg, force_update: bool = False):
    """Apply runs_list in bulk. runs_list is list of (athlete_code, runs).
    - For SQLite: INSERT OR IGNORE athlete_code (if missing), then executemany UPDATE where total_runs IS NULL.
    - For Postgres: create TEMP table, insert values via execute_values, UPDATE athletes from temp table where total_runs IS NULL,
      then INSERT missing athletes.
    Commits are performed here for both DBs.
        :param force_update: if True, update total_runs for all matching athlete rows (not only where total_runs IS NULL)
    """
    if not runs_list:
        return

    # Filter valid entries and collapse duplicate athlete codes within the same flush.
    pair_map = {}
    for code, runs in runs_list:
        if code and runs is not None:
            pair_map[str(code)] = int(runs)
    pairs = list(pair_map.items())
    if not pairs:
        return

    # SQLite bulk ops
    if has_column_sqlite:
        try:
            # Ensure minimal athlete rows exist to allow UPDATE
            #codes = [(p[0],) for p in pairs]
            #sqlite_cursor.executemany("INSERT OR IGNORE INTO athletes (athlete_code) VALUES (?);", codes)

            # Bulk update where NULL using executemany
            updates = [(p[1], p[0]) for p in pairs]
            # Retry loop for transient 'database is locked' errors
            import time as _time
            max_attempts = 6
            delay = 0.2
            for attempt in range(1, max_attempts + 1):
                try:
                    if force_update:
                        sqlite_cursor.executemany(
                            "UPDATE athletes SET total_runs = ? WHERE athlete_code = ?;",
                            updates,
                        )
                    else:
                        sqlite_cursor.executemany(
                            "UPDATE athletes SET total_runs = ? WHERE athlete_code = ? AND (total_runs IS NULL);",
                            updates,
                        )
                    sqlite_cursor.connection.commit()
                    break
                except sqlite3.OperationalError as e:
                    # Only retry for locked DB; re-raise other OperationalErrors
                    if "locked" in str(e).lower() and attempt < max_attempts:
                        try:
                            sqlite_cursor.connection.rollback()
                        except Exception:
                            pass
                        _time.sleep(delay)
                        delay *= 1.5
                        continue
                    raise
        except Exception as e:
            import traceback
            print("Error during SQLite bulk UPDATE of athletes.total_runs:", e)
            traceback.print_exc()
            try:
                sqlite_cursor.connection.rollback()
            except Exception:
                pass
            # Re-raise so failures are visible to the caller (remove if you prefer to continue)
            raise

    # Postgres bulk ops
    if has_column_pg:
        try:
            # create temp table (dropped at end of session or transaction)
            render_cursor.execute("CREATE TEMP TABLE IF NOT EXISTS temp_runs (athlete_code TEXT PRIMARY KEY, total_runs INTEGER) ON COMMIT DROP;")
            # insert values quickly
            execute_values(render_cursor,
                           "INSERT INTO temp_runs (athlete_code, total_runs) VALUES %s",
                           pairs)

            # update athletes from temp where total_runs is null
            if force_update:
                render_cursor.execute(
                    """
                    UPDATE athletes
                    SET total_runs = tr.total_runs
                    FROM temp_runs tr
                    WHERE athletes.athlete_code = tr.athlete_code;
                    """
                )
            else:
                render_cursor.execute(
                    """
                    UPDATE athletes
                    SET total_runs = tr.total_runs
                    FROM temp_runs tr
                    WHERE athletes.athlete_code = tr.athlete_code
                      AND athletes.total_runs IS NULL;
                    """
                )

            # insert missing athlete rows
           # render_cursor.execute(
            #    """
            #    INSERT INTO athletes (athlete_code, total_runs)
            #    SELECT tr.athlete_code, tr.total_runs
            #    FROM temp_runs tr
            #    WHERE NOT EXISTS (SELECT 1 FROM athletes a WHERE a.athlete_code = tr.athlete_code);
            #    """
            #)

            render_cursor.connection.commit()
        except Exception as e:
            import traceback
            print("Error during Postgres bulk UPDATE of athletes.total_runs:", e)
            traceback.print_exc()
            try:
                render_cursor.connection.rollback()
            except Exception:
                pass
            raise


def bulk_update_athlete_total_vols(sqlite_cursor, render_cursor, vols_list, has_column_sqlite, has_column_pg, force_update: bool = False):
    """Apply vols_list in bulk. vols_list is list of (athlete_code, total_vols)."""
    if not vols_list:
        return

    pair_map = {}
    for code, vols in vols_list:
        if code and vols is not None:
            pair_map[str(code)] = int(vols)
    pairs = list(pair_map.items())
    if not pairs:
        return

    if has_column_sqlite:
        try:
            updates = [(p[1], p[0]) for p in pairs]
            import time as _time
            max_attempts = 6
            delay = 0.2
            for attempt in range(1, max_attempts + 1):
                try:
                    if force_update:
                        sqlite_cursor.executemany(
                            "UPDATE athletes SET total_vols = ? WHERE athlete_code = ?;",
                            updates,
                        )
                    else:
                        sqlite_cursor.executemany(
                            "UPDATE athletes SET total_vols = ? WHERE athlete_code = ? AND (total_vols IS NULL);",
                            updates,
                        )
                    sqlite_cursor.connection.commit()
                    break
                except sqlite3.OperationalError as e:
                    if "locked" in str(e).lower() and attempt < max_attempts:
                        try:
                            sqlite_cursor.connection.rollback()
                        except Exception:
                            pass
                        _time.sleep(delay)
                        delay *= 1.5
                        continue
                    raise
        except Exception as e:
            import traceback
            print("Error during SQLite bulk UPDATE of athletes.total_vols:", e)
            traceback.print_exc()
            try:
                sqlite_cursor.connection.rollback()
            except Exception:
                pass
            raise

    if has_column_pg:
        try:
            render_cursor.execute("CREATE TEMP TABLE IF NOT EXISTS temp_vols (athlete_code TEXT PRIMARY KEY, total_vols INTEGER) ON COMMIT DROP;")
            execute_values(render_cursor,
                           "INSERT INTO temp_vols (athlete_code, total_vols) VALUES %s",
                           pairs)

            if force_update:
                render_cursor.execute(
                    """
                    UPDATE athletes
                    SET total_vols = tv.total_vols
                    FROM temp_vols tv
                    WHERE athletes.athlete_code = tv.athlete_code;
                    """
                )
            else:
                render_cursor.execute(
                    """
                    UPDATE athletes
                    SET total_vols = tv.total_vols
                    FROM temp_vols tv
                    WHERE athletes.athlete_code = tv.athlete_code
                      AND athletes.total_vols IS NULL;
                    """
                )

            render_cursor.connection.commit()
        except Exception as e:
            import traceback
            print("Error during Postgres bulk UPDATE of athletes.total_vols:", e)
            traceback.print_exc()
            try:
                render_cursor.connection.rollback()
            except Exception:
                pass
            raise



def update_athlete_total_runs(sqlite_cursor, render_cursor, runner_code, runs, has_column_sqlite, has_column_pg):
    """Update `athletes.total_runs` for the given runner_code if it's not already set.
    If the athlete row doesn't exist, insert a minimal row with athlete_code and total_runs.
    This operation is idempotent: it only updates when total_runs IS NULL.
    """
    if not runner_code or runs is None:
        return

    # SQLite: try to update only when NULL
    try:
        if has_column_sqlite:
            sqlite_cursor.execute(
                "UPDATE athletes SET total_runs = ? WHERE athlete_code = ? AND (total_runs IS NULL);",
                (runs, runner_code),
            )
            if sqlite_cursor.rowcount != 0:
                # If no row updated, try to insert minimal row (INSERT OR IGNORE)
                #try:
                #    sqlite_cursor.execute(
                #        "INSERT OR IGNORE INTO athletes (athlete_code, total_runs) VALUES (?, ?);",
                #        (runner_code, runs),
                #    )
                #except Exception:
                #    pass
                sqlite_cursor.connection.commit()
        else:
            # If athletes table doesn't have total_runs column, do nothing
            pass
    except Exception:
        pass

    # Postgres: similar logic
    try:
        if has_column_pg:
            render_cursor.execute(
                "UPDATE athletes SET total_runs = %s WHERE athlete_code = %s AND (total_runs IS NULL);",
                (runs, runner_code),
            )
            if render_cursor.rowcount != 0:
                #try:
                #    render_cursor.execute(
                #        "INSERT INTO athletes (athlete_code, total_runs) VALUES (%s, %s) ON CONFLICT (athlete_code) DO NOTHING;",
                #        (runner_code, runs),
                #    )
                #except Exception:
                #    pass
                render_cursor.connection.commit()
        else:

            pass
    except Exception:
        pass


def _detect_human_challenge(driver):
    try:
        body = driver.find_element(By.TAG_NAME, 'body').text.lower()
        if any(
            phrase in body
            for phrase in (
                'are you human',
                'please verify',
                'complete the security check',
                'human test',
                'one more step',
            )
        ):
            return True
    except Exception:
        pass

    try:
        if driver.find_elements(By.CSS_SELECTOR, 'iframe[src*="captcha"]'):
            return True
        if driver.find_elements(
            By.CSS_SELECTOR,
            '[id*="captcha"], [class*="captcha"], [class*="cf-browser-verification"], [id*="cf-challenge"]',
        ):
            return True
    except Exception:
        pass

    return False


def _prompt_human_verification(target_url):
    try:
        root = _tk.Tk()
        root.withdraw()
        res = _messagebox.askokcancel(
            'Human verification required',
            f"A human verification challenge was detected for:\n{target_url}\n\nPlease complete the challenge in the opened browser window, then click 'OK' to continue or 'Cancel' to abort.",
        )
        root.destroy()
        return bool(res)
    except Exception:
        try:
            ans = input(
                f'Human verification detected at {target_url}. Complete it in the browser, then type Y to continue (or N to abort): '
            )
            return ans.strip().lower().startswith('y')
        except Exception:
            return False


def _prepare_event_page_for_scraping(driver, url):
    driver.get(url)

    if _detect_human_challenge(driver):
        while True:
            ok = _prompt_human_verification(url)
            if not ok:
                raise RuntimeError('Human verification aborted by user')
            time.sleep(1)
            if not _detect_human_challenge(driver):
                break

    wait = WebDriverWait(driver, 1, poll_frequency=0.2)
    if check_page_not_found(wait):
        raise RuntimeError(f'Page not found for {url}')

    try:
        select_detailed_view(wait)
    except Exception:
        pass

    try:
        load_more_results(wait)
    except Exception:
        pass


def _lookup_last_position(sqlite_cursor, event_code, event_date, event_number):
    try:
        sqlite_cursor.execute(
            'SELECT last_position FROM parkrun_events WHERE event_code = ? AND event_date = ? LIMIT 1;',
            (event_code, event_date),
        )
        row = sqlite_cursor.fetchone()
        if row and row[0] is not None:
            return int(row[0])
    except Exception:
        pass

    try:
        sqlite_cursor.execute(
            'SELECT MAX(position) FROM eventpositions WHERE event_code = ? AND event_date = ?;',
            (event_code, event_date),
        )
        row = sqlite_cursor.fetchone()
        if row and row[0] is not None:
            return int(row[0])
    except Exception:
        pass

    try:
        sqlite_cursor.execute(
            'SELECT last_position FROM parkrun_events WHERE event_code = ? AND event_number = ? LIMIT 1;',
            (event_code, event_number),
        )
        row = sqlite_cursor.fetchone()
        if row and row[0] is not None:
            return int(row[0])
    except Exception:
        pass

    return 0


def scrape_event_volunteers(event_code=None, event_date=None, event_number=None, event_name=None, browser=None, retain_browser=False):
    """Scrape and store volunteers for a single event identified by course/date."""
    conn = cursor = render_db_conn = render_cursor = None
    driver = browser
    created_driver = False

    try:
        if event_date is None:
            raise ValueError('event_date is required')
        if event_code is None and not event_name:
            raise ValueError('Either event_code or event_name is required')

        conn, cursor, render_db_conn, render_cursor = connections()
        normalized_event_date = str(event_date)
        resolved_event_name = str(event_name).strip() if event_name is not None else None
        normalized_event_code = str(event_code).strip() if event_code is not None else None

        if normalized_event_code is None:
            cursor.execute('SELECT event_code FROM events WHERE event_name = ? LIMIT 1;', (resolved_event_name,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f'No event_code found for event_name={resolved_event_name}')
            normalized_event_code = str(row[0])

        if event_number is None:
            cursor.execute(
                'SELECT event_number FROM parkrun_events WHERE event_code = ? AND event_date = ? LIMIT 1;',
                (normalized_event_code, normalized_event_date),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(
                    f'No event_number found for event_code={normalized_event_code} and event_date={normalized_event_date}'
                )
            event_number = int(row[0])

        if resolved_event_name is None:
            cursor.execute('SELECT event_name FROM events WHERE event_code = ? LIMIT 1;', (normalized_event_code,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f'No event_name found for event_code={normalized_event_code}')
            resolved_event_name = str(row[0])

        url = build_event_url(resolved_event_name, event_number)
        print(
            f'Scraping volunteers for event_code={normalized_event_code}, event_date={normalized_event_date}, '
            f'event_number={event_number}, event_name={resolved_event_name}'
        )
        print(f'Loading {url}')

        if driver is None:
            driver = create_webdriver()
            created_driver = True

        _prepare_event_page_for_scraping(driver, url)
        page_event_number, volunteer_count = get_parkrun_events(driver)
        if page_event_number is not None:
            event_number = int(page_event_number)
        extract_and_store_volunteers(driver, cursor, render_cursor, normalized_event_code, normalized_event_date, event_number)
        last_position = _lookup_last_position(cursor, normalized_event_code, normalized_event_date, event_number)
        update_parkrun_events(
            cursor,
            render_cursor,
            normalized_event_code,
            normalized_event_date,
            last_position,
            event_number,
            volunteer_count,
            resolved_event_name,
        )

        return {
            'event_code': normalized_event_code,
            'event_date': normalized_event_date,
            'event_number': int(event_number),
            'event_name': resolved_event_name,
            'volunteer_count': int(volunteer_count or 0),
            'last_position': int(last_position or 0),
            'url': url,
        }
    finally:
        if created_driver and driver is not None and not retain_browser:
            try:
                driver.quit()
            except Exception:
                pass
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if render_cursor is not None:
            try:
                render_cursor.close()
            except Exception:
                pass
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
        if render_db_conn is not None:
            try:
                render_db_conn.close()
            except Exception:
                pass


def ensure_volunteers_table(sqlite_cursor, render_cursor):
    # SQLite
    try:
        sqlite_cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS volunteers (
                event_code INTEGER NOT NULL,
                event_date TEXT NOT NULL,
                event_number INTEGER,
                athlete_code TEXT NOT NULL,
                athlete_name TEXT,
                volunteer_role TEXT,
                PRIMARY KEY (event_code, event_date, athlete_code)
            );
            '''
        )
        if not column_exists_sqlite(sqlite_cursor, "volunteers", "volunteer_role"):
            sqlite_cursor.execute("ALTER TABLE volunteers ADD COLUMN volunteer_role TEXT;")
        sqlite_cursor.connection.commit()
    except Exception:
        try:
            sqlite_cursor.connection.rollback()
        except Exception:
            pass

    # Postgres
    try:
        render_cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS volunteers (
                event_code INTEGER NOT NULL,
                event_date TEXT NOT NULL,
                event_number INTEGER,
                athlete_code TEXT NOT NULL,
                athlete_name TEXT,
                volunteer_role TEXT,
                PRIMARY KEY (event_code, event_date, athlete_code)
            );
            '''
        )
        if not column_exists_postgres(render_cursor, "volunteers", "volunteer_role"):
            render_cursor.execute("ALTER TABLE volunteers ADD COLUMN volunteer_role TEXT;")
        render_cursor.connection.commit()
    except Exception:
        try:
            render_cursor.connection.rollback()
        except Exception:
            pass


def extract_and_store_volunteers(driver, sqlite_cursor, render_cursor, event_code, event_date, event_number):
    """Extract volunteers from page (new + legacy layouts) and upsert into volunteers table."""
    def _extract_code_from_href(href: str):
        if not href:
            return None
        clean = href.split("?", 1)[0].rstrip("/")
        parts = [p for p in clean.split("/") if p]
        return parts[-1] if parts else None

    def _first_role(raw: str):
        if not raw:
            return None
        parts = [p.strip(" ,\t\r\n") for p in re.split(r"[\n,]+", raw) if p and p.strip(" ,\t\r\n")]
        return parts[0] if parts else None

    try:
        ensure_volunteers_table(sqlite_cursor, render_cursor)

        sqlite_rows = []
        pg_rows = []

        # New layout
        volunteer_rows = driver.find_elements(By.CSS_SELECTOR, "tr.Volunteers-table-row")

        if volunteer_rows:
            for row in volunteer_rows:
                try:
                    a = row.find_element(By.CSS_SELECTOR, "td.Volunteers-table-td--name a")
                    href = a.get_attribute("href") or ""
                    athlete_code = _extract_code_from_href(href)
                    if not athlete_code:
                        continue

                    athlete_name = (row.get_attribute("data-name") or "").strip() or (a.text or "").strip()

                    raw_role = (row.get_attribute("data-role") or "").strip()
                    if not raw_role:
                        try:
                            role_el = row.find_element(
                                By.CSS_SELECTOR,
                                "td.Volunteers-table-td--volunteerRoles .compact",
                            )
                            raw_role = role_el.get_attribute("textContent") or role_el.text or ""
                        except Exception:
                            raw_role = ""

                    volunteer_role = _first_role(raw_role)  # e.g. "Marshal"

                    rec = (event_code, event_date, event_number, athlete_code, athlete_name, volunteer_role)
                    sqlite_rows.append(rec)
                    pg_rows.append(rec)
                except Exception:
                    continue

        else:
            # Legacy fallback
            containers = driver.find_elements(By.CSS_SELECTOR, "div.paddedt.left")
            target_p = None
            for c in containers:
                try:
                    h3 = c.find_element(By.TAG_NAME, "h3")
                    if "Thanks to the volunteers" in h3.text:
                        ps = c.find_elements(By.TAG_NAME, "p")
                        if ps:
                            target_p = ps[0]
                            break
                except Exception:
                    continue

            if target_p is None:
                return

            anchors = target_p.find_elements(By.TAG_NAME, "a")
            for a in anchors:
                try:
                    href = a.get_attribute("href") or ""
                    athlete_code = _extract_code_from_href(href)
                    if not athlete_code:
                        continue

                    athlete_name = (a.text or "").strip()
                    volunteer_role = None

                    # If anchor is inside a modern volunteer row, still read data-role
                    try:
                        row = a.find_element(By.XPATH, "./ancestor::tr[contains(@class,'Volunteers-table-row')]")
                        raw_role = (row.get_attribute("data-role") or "").strip()
                        if not raw_role:
                            role_el = row.find_element(By.CSS_SELECTOR, "td.Volunteers-table-td--volunteerRoles .compact")
                            raw_role = role_el.get_attribute("textContent") or role_el.text or ""
                        volunteer_role = _first_role(raw_role)
                    except Exception:
                        pass

                    rec = (event_code, event_date, event_number, athlete_code, athlete_name, volunteer_role)
                    sqlite_rows.append(rec)
                    pg_rows.append(rec)
                except Exception:
                    continue

        # SQLite upsert
        if sqlite_rows:
            try:
                sqlite_cursor.executemany(
                    """
                    INSERT OR IGNORE INTO volunteers
                    (event_code, event_date, event_number, athlete_code, athlete_name, volunteer_role)
                    VALUES (?, ?, ?, ?, ?, ?);
                    """,
                    sqlite_rows,
                )
                sqlite_cursor.executemany(
                    """
                    UPDATE volunteers
                    SET event_number = ?, athlete_name = ?, volunteer_role = ?
                    WHERE event_code = ? AND event_date = ? AND athlete_code = ?;
                    """,
                    [(r[2], r[4], r[5], r[0], r[1], r[3]) for r in sqlite_rows],
                )
                sqlite_cursor.connection.commit()
            except Exception:
                try:
                    sqlite_cursor.connection.rollback()
                except Exception:
                    pass

        # Postgres upsert
        if pg_rows:
            try:
                sql = """
                    INSERT INTO volunteers
                    (event_code, event_date, event_number, athlete_code, athlete_name, volunteer_role)
                    VALUES %s
                    ON CONFLICT (event_code, event_date, athlete_code)
                    DO UPDATE SET
                        event_number = EXCLUDED.event_number,
                        athlete_name = EXCLUDED.athlete_name,
                        volunteer_role = EXCLUDED.volunteer_role;
                """
                execute_values(render_cursor, sql, pg_rows)
                render_cursor.connection.commit()
            except Exception:
                try:
                    render_cursor.connection.rollback()
                except Exception:
                    pass

    except Exception:
        return


def update_db_runs(sqlite_cursor, render_cursor, event_code, event_date, runner_code, position, runs, has_column_sqlite, has_column_pg):
    if runs is None:
        return

    # prefer updating by athlete_code when available, otherwise by position
    if runner_code:
        if has_column_sqlite:
            sqlite_cursor.execute(
                "UPDATE eventpositions SET athlete_total_runs = ? WHERE event_code = ? AND event_date = ? AND athlete_code = ?;",
                (runs, event_code, event_date, runner_code),
            )
        #else:
        #    # append to comment as fallback
        #    sqlite_cursor.execute(
        #        "UPDATE eventpositions SET comment = COALESCE(comment, '') || ? WHERE event_code = ? AND event_date = ? AND athlete_code = ?;",
        #        (f" | runs:{runs}", event_code, event_date, runner_code),
        #    )

        if has_column_pg:
            render_cursor.execute(
                "UPDATE eventpositions SET athlete_total_runs = %s WHERE event_code = %s AND event_date = %s AND athlete_code = %s;",
                (runs, event_code, event_date, runner_code),
            )
        #else:
        #    render_cursor.execute(
        #        "UPDATE eventpositions SET comment = COALESCE(comment, '') || %s WHERE event_code = %s AND event_date = %s AND athlete_code = %s;",
        #        (f" | runs:{runs}", event_code, event_date, runner_code),
        #    )
    else:
        # fallback to updating by position
        if has_column_sqlite:
            sqlite_cursor.execute(
                "UPDATE eventpositions SET athlete_total_runs = ? WHERE event_code = ? AND event_date = ? AND position = ?;",
                (runs, event_code, event_date, position),
            )
        #else:
        #    sqlite_cursor.execute(
        #        "UPDATE eventpositions SET comment = COALESCE(comment, '') || ? WHERE event_code = ? AND event_date = ? AND position = ?;",
        #        (f" | runs:{runs}", event_code, event_date, position),
        #    )

        if has_column_pg:
            render_cursor.execute(
                "UPDATE eventpositions SET athlete_total_runs = %s WHERE event_code = %s AND event_date = %s AND position = %s;",
                (runs, event_code, event_date, position),
            )
        #else:
        #    render_cursor.execute(
        #        "UPDATE eventpositions SET comment = COALESCE(comment, '') || %s WHERE event_code = %s AND event_date = %s AND position = %s;",
        #        (f" | runs:{runs}", event_code, event_date, position),
        #    )


def main(resume=True, batch_limit=None, events_override=None, no_volunteers=False, override_csv_path='reprocess_events.csv', all_athletes: bool = False, browser=None, retain_browser: bool = False):
    """Main processing loop.

    Optional parameters:
    - events_override: list of tuples or dicts to reprocess. Each item can be (event_code, event_date)
        or (event_code, event_date, event_number) or {'event_code':..,'event_date':..,'event_number':..}.
    - no_volunteers: if True, skip extracting and storing volunteers for each event.
    - override_csv_path: path to CSV file with header `event_code,event_date,event_number`.
        If that file exists and contains rows, it will be used as the event list to process.
    """
    conn, cursor, render_db_conn, render_cursor = connections()

    # Determine events to process. By default use distinct events from eventpositions.
    override_event_numbers = {}
    if events_override is None:
        # If a CSV file exists with overrides, prefer that
        if os.path.exists(override_csv_path):
            events = []
            try:
                with open(override_csv_path, 'r', encoding='utf-8') as f:
                    # expect header: event_code,event_date,event_number
                    first = f.readline()
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = [p.strip() for p in line.split(',')]
                        if len(parts) >= 2:
                            code = parts[0]
                            date = parts[1]
                            events.append((code, date))
                            if len(parts) >= 3 and parts[2]:
                                try:
                                    override_event_numbers[(str(code), str(date))] = int(parts[2])
                                except Exception:
                                    pass
                print(f"Loaded {len(events)} events from {override_csv_path} to reprocess")
            except Exception as e:
                print(f"Failed to read override CSV {override_csv_path}: {e}")
                # fallback to DB
                cursor.execute('SELECT DISTINCT event_code, event_date FROM eventpositions ORDER BY event_code, event_date;')
                events = cursor.fetchall()
        else:
            # default behaviour
            cursor.execute('SELECT DISTINCT event_code, event_date FROM eventpositions ORDER BY event_code, event_date;')
            events = cursor.fetchall()
    else:
        # events_override provided programmatically
        events = []
        try:
            for item in events_override:
                if isinstance(item, dict):
                    code = item.get('event_code')
                    date = item.get('event_date')
                    num = item.get('event_number')
                else:
                    # tuple/list
                    if len(item) >= 3:
                        code, date, num = item[0], item[1], item[2]
                    else:
                        code, date = item[0], item[1]
                        num = None
                events.append((str(code), str(date)))
                if num is not None:
                    try:
                        override_event_numbers[(str(code), str(date))] = int(num)
                    except Exception:
                        pass
        except Exception:
            events = []
        print(f"Loaded {len(events)} events from events_override to reprocess")

    start_index = load_progress() if resume else 0

    has_column_sqlite = column_exists_sqlite(cursor, 'athletes', 'total_runs')
    has_column_pg = column_exists_postgres(render_cursor, 'athletes', 'total_runs')
    has_total_vols_sqlite, has_total_vols_pg = ensure_athletes_total_vols_column(cursor, render_cursor)

    total = len(events)
    print(f"Found {total} events to process. Resuming at index {start_index}.")

    # `browser` may be an existing webdriver instance supplied by the caller.
    # If provided, reuse it and do not consider it 'created' here.
    driver = None
    created_driver = False
    if browser is not None:
        driver = browser
    processed = 0
    run_start_time = None

    # Load cache of athlete_codes that already have total_runs set so we can skip them.
    known_with_runs = set()
    try:
        if has_column_sqlite:
            try:
                cursor.execute("SELECT athlete_code FROM athletes WHERE total_runs IS NOT NULL;")
                rows = cursor.fetchall()
                for r in rows:
                    if r and r[0]:
                        known_with_runs.add(str(r[0]))
            except Exception:
                pass
        if has_column_pg:
            try:
                render_cursor.execute("SELECT athlete_code FROM athletes WHERE total_runs IS NOT NULL;")
                rows = render_cursor.fetchall()
                for r in rows:
                    if r and r[0]:
                        known_with_runs.add(str(r[0]))
            except Exception:
                pass
    except Exception:
        known_with_runs = set()
    print(f"Loaded {len(known_with_runs)} athletes with existing total_runs into cache")
    try:
        aggregated_runs = []
        aggregated_vols = []
        last_flush_index = start_index
        for idx in range(start_index, total):
            event_code, event_date = events[idx]

            # Save progress before processing this event so we can resume after a stop
            save_progress(idx)

            # Initialize run_start_time at the first processed event (corresponds to start_index)
            if run_start_time is None:
                run_start_time = time.time()

            # Find event_number and event_name from parkrun_events / events
            # Prefer event_number from override mapping if provided, otherwise lookup in parkrun_events
            key = (str(event_code), str(event_date))
            if key in override_event_numbers:
                event_number = override_event_numbers[key]
            else:
                cursor.execute('SELECT event_number FROM parkrun_events WHERE event_code = ? AND event_date = ? LIMIT 1;', (event_code, event_date))
                row = cursor.fetchone()
                if not row:
                    print(f"No event_number found for {event_code} / {event_date}, skipping")
                    continue
                event_number = row[0]

            cursor.execute('SELECT event_name FROM events WHERE event_code = ? LIMIT 1;', (event_code,))
            ev = cursor.fetchone()
            if not ev:
                print(f"No event_name found for event_code {event_code}, skipping")
                continue
            event_name = ev[0]

            url = build_event_url(event_name, event_number)
            print(f"Processing [{idx+1}/{total}] {event_code} {event_date} -> {url}")

            # Lazily create webdriver to avoid re-creating for every event
            if driver is None:
                driver = create_webdriver()
                created_driver = True

            try:
                _prepare_event_page_for_scraping(driver, url)

                # Get rows
                rows = findElements(driver)
                print(f"  Found {len(rows)} rows")

                runs_list = []
                vols_list = []
                for r in rows:
                    try:
                        position_attr = r.get_attribute('data-position')
                        position = int(position_attr) if position_attr and position_attr.isdigit() else None
                        runner_code = extract_runner_code_from_row(r)
                        if runner_code == '10014900':
                            print("Stop here")
                        runs = extract_runs_from_row(r)
                        vols = extract_vols_from_row(r)
                        # Skip athletes known to already have total_runs (reduces duplicate work)
                        # If `all_athletes` is True we want to update everyone so do not skip.
                        if runner_code and str(runner_code) in known_with_runs and not all_athletes:
                            if vols is not None:
                                vols_list.append((runner_code, vols))
                            continue
                        if runner_code and runs is not None:
                            runs_list.append((runner_code, runs))
                        if runner_code and vols is not None:
                            vols_list.append((runner_code, vols))
                    except Exception as e:
                        print(f"  Error processing a row: {e}")

                # Accumulate runs; flush in bulk periodically to improve speed
                aggregated_runs.extend(runs_list)
                aggregated_vols.extend(vols_list)

                # Flush when we've advanced FLUSH_SIZE events since last flush
                # Flush either when we've processed FLUSH_SIZE events since last flush,
                # or on the final event (so any remaining small batch is processed).
                if idx >= last_flush_index + FLUSH_SIZE - 1 or idx == total - 1:
                    try:
                        # commit aggregated runs
                        bulk_update_athlete_total_runs(cursor, render_cursor, aggregated_runs, has_column_sqlite, has_column_pg, force_update=all_athletes)
                        bulk_update_athlete_total_vols(cursor, render_cursor, aggregated_vols, has_total_vols_sqlite, has_total_vols_pg, force_update=all_athletes)
                        # After bulk update, add updated athlete_codes to known set to avoid re-processing
                        newly_added = 0
                        try:
                            for pair in aggregated_runs:
                                code = pair[0]
                                if code and str(code) not in known_with_runs:
                                    known_with_runs.add(str(code))
                                    newly_added += 1
                        except Exception:
                            newly_added = 0
                        # Report cache growth every flush
                        try:
                            print(f"  Bulk update applied. New athlete totals added this flush: {newly_added}. Total athletes with total_runs: {len(known_with_runs)}")
                        except Exception:
                            pass
                        # Save progress to the next event (idx is zero-based so +1)
                        save_progress(idx + 1)
                        aggregated_runs = []
                        aggregated_vols = []
                        last_flush_index = idx + 1
                    except Exception as e:
                        print(f"  Error in bulk update of athlete totals: {e}")

                # Extract and store volunteers for this event unless disabled
                if not no_volunteers:
                    try:
                        extract_and_store_volunteers(driver, cursor, render_cursor, event_code, event_date, event_number)
                    except Exception as e:
                        print(f"  Error extracting volunteers: {e}")

                # NOTE: we commit when flushing aggregated runs; volunteers insert commits inside its function

                processed += 1

                # ETA / progress reporting: compute average time per processed event since start_index
                try:
                    # number of events processed since we began this run
                    events_done = (idx - start_index) + 1
                    if events_done > 0:
                        elapsed = time.time() - run_start_time
                        avg_per_event = elapsed / events_done
                        remaining = total - (idx + 1)
                        est_seconds = remaining * avg_per_event
                        eta_dt = datetime.now() + timedelta(seconds=est_seconds)
                        pct = ((idx + 1) / total) * 100
                        # Print concise progress every FLUSH_SIZE events to reduce noise
                        if events_done % FLUSH_SIZE == 0 or remaining == 0:
                            def fmt_secs(s):
                                s = int(s)
                                return f"{s//3600:d}h{(s%3600)//60:02d}m{(s%60):02d}s"
                            print(
                                f"Progress: {idx+1}/{total} ({pct:.2f}%), "
                                f"elapsed {fmt_secs(elapsed)}, avg {avg_per_event:.2f}s/ev, "
                                f"remaining {remaining} ev, ETA {eta_dt.strftime('%Y-%m-%d %H:%M:%S')} ({fmt_secs(est_seconds)})"
                            )
                except Exception:
                    pass

                # Optional: throttle to be polite
                time.sleep(0.1)

                if batch_limit and processed >= batch_limit:
                    print("Reached batch limit, stopping for now.")
                    break

            except Exception as e:
                print(f"Error processing {url}: {e}")
                # don't crash entire run; move to next event
                continue

    finally:
        # Only quit the browser if we created it here and the caller did not ask to retain it.
        if driver and created_driver and not retain_browser:
            try:
                driver.quit()
            except Exception:
                pass

        # Flush any remaining aggregated_runs and save progress
        try:
            if ('aggregated_runs' in locals() and aggregated_runs) or ('aggregated_vols' in locals() and aggregated_vols):
                if 'aggregated_runs' in locals() and aggregated_runs:
                    bulk_update_athlete_total_runs(cursor, render_cursor, aggregated_runs, has_column_sqlite, has_column_pg, force_update=all_athletes)
                if 'aggregated_vols' in locals() and aggregated_vols:
                    bulk_update_athlete_total_vols(cursor, render_cursor, aggregated_vols, has_total_vols_sqlite, has_total_vols_pg, force_update=all_athletes)
                try:
                    newly_added = 0
                    for pair in aggregated_runs:
                        code = pair[0]
                        if code and str(code) not in known_with_runs:
                            known_with_runs.add(str(code))
                            newly_added += 1
                    print(f"  Final flush applied. New athlete totals added: {newly_added}. Total athletes with total_runs: {len(known_with_runs)}")
                except Exception:
                    pass
                # save progress as all processed events
                save_progress(start_index + processed)
        except Exception as e:
            print(f"Error flushing remaining aggregated runs: {e}")

        # Save progress as next index to process
        last_index = start_index + processed
        save_progress(last_index)
        print(f"Finished. Progress saved at index {last_index}.")


if __name__ == '__main__':
    # Simple CLI: call main(); you can set resume=False to start from beginning
    main(resume=True)
