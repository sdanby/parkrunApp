import psycopg2
from psycopg2 import sql

MVS = [
    'mv_extend_runs',
    'mv_latest_curve_ranks',
    'mv_participant_run_filters',
    'mv_best_age_curve',
    'mv_best_age_event_curve',
    'mv_best_age_sex_curve',
    'mv_best_age_sex_event_curve',
    'mv_best_event_curve',
    'mv_best_season_curve',
    'mv_best_sex_curve',
    'mv_best_sex_event_curve',
    'mv_best_curve',
    'mv_best_age_1y_curve',
    'mv_best_age_event_1y_curve',
    'mv_best_age_sex_1y_curve',
    'mv_best_age_sex_event_1y_curve',
    'mv_best_event_1y_curve',
    'mv_best_season_1y_curve',
    'mv_best_sex_1y_curve',
    'mv_best_sex_event_1y_curve',
    'mv_best_1y_curve',
    'mv_event_summary_cache',
    'mv_club_members_cache',
]


def main() -> None:
    conn = psycopg2.connect(
        host='dpg-cs2r25dsvqrc73dpgdd0-a.frankfurt-postgres.render.com',
        database='parkrundata',
        user='parkrundata_user',
        password='m3UE0JWilwRNS1MBVgN2kr0BnIOVZUmH',
        port='5432',
    )
    conn.autocommit = True
    cur = conn.cursor()

    print('refresh_start_count', len(MVS))
    for mv in MVS:
        try:
            cur.execute(sql.SQL('REFRESH MATERIALIZED VIEW {}').format(sql.Identifier(mv)))
            print('refreshed', mv)
        except Exception as exc:
            print('failed', mv, type(exc).__name__, str(exc))
            try:
                conn.rollback()
            except Exception:
                pass

    # Verify one athlete (Lists-style ev_rank/cur_rank for time_seconds view)
    athlete = '528017'
    cur.execute(
        """
        WITH latest_rank AS (
            SELECT
                m.athlete_code,
                m.current_best_rank_b,
                m.best_curve_ranking_current,
                m.current_best_rank_e,
                m.current_best_rank_ae,
                m.current_best_rank_es,
                m.current_best_rank_aes
            FROM mv_latest_curve_ranks m
        )
        SELECT
            v.athlete_code,
            v.rank::numeric AS ev_rank,
            latest.current_best_rank_b::numeric AS cur_rank,
            v.event_date,
            v.time
        FROM mv_best_curve v
        LEFT JOIN latest_rank latest
          ON latest.athlete_code = v.athlete_code
        WHERE v.athlete_code = %s
        """,
        (athlete,),
    )
    row = cur.fetchone()
    print('athlete_528017_best_curve', row)

    # Verify top-100 list payload readiness
    cur.execute(
        """
        WITH latest_rank AS (
            SELECT
                m.athlete_code,
                m.current_best_rank_b
            FROM mv_latest_curve_ranks m
        ), top100 AS (
            SELECT
                v.athlete_code,
                v.rank::numeric AS ev_rank,
                latest.current_best_rank_b::numeric AS cur_rank
            FROM mv_best_curve v
            LEFT JOIN latest_rank latest
              ON latest.athlete_code = v.athlete_code
            ORDER BY v.rank DESC, v.athlete_code
            LIMIT 100
        )
        SELECT
            COUNT(*) AS top_rows,
            COUNT(*) FILTER (WHERE ev_rank IS NOT NULL) AS ev_rank_nonnull,
            COUNT(*) FILTER (WHERE cur_rank IS NOT NULL) AS cur_rank_nonnull,
            MIN(ev_rank) AS min_ev_rank,
            MAX(ev_rank) AS max_ev_rank,
            MIN(cur_rank) AS min_cur_rank,
            MAX(cur_rank) AS max_cur_rank
        FROM top100
        """
    )
    summary = cur.fetchone()
    print('top100_summary', summary)

    cur.close()
    conn.close()
    print('done')


if __name__ == '__main__':
    main()
