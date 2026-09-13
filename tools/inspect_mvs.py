from scripts.database_helpers import connections


def main() -> None:
    mvs = ["mv_extend_runs","mv_best_curve","mv_best_season_curve","mv_event_summary_cache","mv_club_members_cache"]
    conn, cursor, render_db_conn, render_cursor = connections()
    try:
        print("=== MV COLUMNS ===")
        for mv in mvs:
            render_cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position", (mv,))
            cols = [r[0] for r in render_cursor.fetchall()]
            print(f"\n[{mv}] columns ({len(cols)}):")
            print(", ".join(cols))
        print("\n=== MV DEFINITIONS (first 1200 chars each) ===")
        for mv in mvs:
            render_cursor.execute("SELECT definition FROM pg_matviews WHERE schemaname='public' AND matviewname=%s", (mv,))
            row = render_cursor.fetchone()
            definition = row[0] if row and row[0] else "<not found>"
            print(f"\n[{mv}]\n{definition[:1200]}")
    finally:
        for obj in (render_cursor, render_db_conn, cursor, conn):
            try:
                obj.close()
            except Exception:
                pass


if __name__ == '__main__':
    main()
