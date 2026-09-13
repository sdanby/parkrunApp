DROP MATERIALIZED VIEW IF EXISTS mv_club_members_cache;

CREATE MATERIALIZED VIEW mv_club_members_cache AS
WITH club_runs AS (
    SELECT
        regexp_replace(LOWER(BTRIM(m.club)), '\s+ac$', '') AS club_key,
        m.athlete_code,
        COUNT(*)::int AS club_runs_total,
        COUNT(*) FILTER (
            WHERE m.event_dt >= CURRENT_DATE - INTERVAL '1 year'
        )::int AS club_runs_last_year,
        MIN(m.event_dt) AS first_club_run_date,
        MAX(m.event_dt) AS last_club_run_date,
        MIN(m.time_seconds) AS fastest_time_seconds,
        (ARRAY_AGG(m.time ORDER BY m.time_seconds ASC NULLS LAST, m.event_dt DESC NULLS LAST))[1] AS fastest_time,
        MIN(m.event_adj_time_seconds) AS best_event_adj_time_seconds,
        (ARRAY_AGG(m.event_adj_time ORDER BY m.event_adj_time_seconds ASC NULLS LAST, m.event_dt DESC NULLS LAST))[1] AS best_event_adj_time,
        MIN(m.age_event_adj_time_seconds) AS best_age_event_adj_time_seconds,
        (ARRAY_AGG(m.age_event_adj_time ORDER BY m.age_event_adj_time_seconds ASC NULLS LAST, m.event_dt DESC NULLS LAST))[1] AS best_age_event_adj_time,
        MIN(m.age_sex_event_adj_time_seconds) AS best_age_sex_event_adj_time_seconds,
        (ARRAY_AGG(m.age_sex_event_adj_time ORDER BY m.age_sex_event_adj_time_seconds ASC NULLS LAST, m.event_dt DESC NULLS LAST))[1] AS best_age_sex_event_adj_time
    FROM mv_extend_runs m
    WHERE m.club IS NOT NULL
      AND BTRIM(m.club) <> ''
      AND m.athlete_code IS NOT NULL
      AND BTRIM(m.athlete_code) <> ''
    GROUP BY regexp_replace(LOWER(BTRIM(m.club)), '\s+ac$', ''), m.athlete_code
),
latest_age AS (
    SELECT DISTINCT ON (m.athlete_code)
        m.athlete_code,
        m.age_group AS latest_age_group
    FROM mv_extend_runs m
    WHERE m.athlete_code IS NOT NULL
      AND BTRIM(m.athlete_code) <> ''
    ORDER BY m.athlete_code, m.event_dt DESC NULLS LAST, m.event_code DESC
),
latest_1y_row AS (
    SELECT DISTINCT ON (m.athlete_code)
        m.athlete_code,
        m.current_best_rank_b,
        m.current_best_rank_e,
        m.current_best_rank_ae,
        m.current_best_rank_es,
        m.current_best_rank_aes
    FROM mv_extend_runs m
    WHERE m.athlete_code IS NOT NULL
      AND BTRIM(m.athlete_code) <> ''
      AND m.event_dt >= CURRENT_DATE - INTERVAL '1 year'
    ORDER BY m.athlete_code, m.event_dt DESC NULLS LAST, m.event_code DESC
),
latest_1y_rank_candidates AS (
    SELECT athlete_code, 'B'::text AS metric_type, current_best_rank_b::numeric AS rank, 1 AS metric_order
    FROM latest_1y_row
    WHERE current_best_rank_b IS NOT NULL

    UNION ALL

    SELECT athlete_code, 'E'::text AS metric_type, current_best_rank_e::numeric AS rank, 2 AS metric_order
    FROM latest_1y_row
    WHERE current_best_rank_e IS NOT NULL

    UNION ALL

    SELECT athlete_code, 'AE'::text AS metric_type, current_best_rank_ae::numeric AS rank, 3 AS metric_order
    FROM latest_1y_row
    WHERE current_best_rank_ae IS NOT NULL

    UNION ALL

    SELECT athlete_code, 'ES'::text AS metric_type, current_best_rank_es::numeric AS rank, 4 AS metric_order
    FROM latest_1y_row
    WHERE current_best_rank_es IS NOT NULL

    UNION ALL

    SELECT athlete_code, 'AES'::text AS metric_type, current_best_rank_aes::numeric AS rank, 5 AS metric_order
    FROM latest_1y_row
    WHERE current_best_rank_aes IS NOT NULL
),
current_rank_best AS (
    SELECT
        athlete_code,
        metric_type,
        rank,
        ROW_NUMBER() OVER (
            PARTITION BY athlete_code
            ORDER BY rank DESC, metric_order ASC
        ) AS rn
    FROM latest_1y_rank_candidates
),
historic_rank AS (
    SELECT
        m.athlete_code,
        GREATEST(
            COALESCE(MAX(m.current_best_rank_b)::numeric, 0),
            COALESCE(MAX(m.current_best_rank_e)::numeric, 0),
            COALESCE(MAX(m.current_best_rank_ae)::numeric, 0),
            COALESCE(MAX(m.current_best_rank_es)::numeric, 0),
            COALESCE(MAX(m.current_best_rank_aes)::numeric, 0)
        ) AS best_curve_ranking_historic
    FROM mv_extend_runs m
    WHERE m.athlete_code IS NOT NULL
      AND BTRIM(m.athlete_code) <> ''
      AND (
          m.current_best_rank_b IS NOT NULL
          OR m.current_best_rank_e IS NOT NULL
          OR m.current_best_rank_ae IS NOT NULL
          OR m.current_best_rank_es IS NOT NULL
          OR m.current_best_rank_aes IS NOT NULL
      )
    GROUP BY m.athlete_code
)
SELECT
    cr.club_key,
    cr.athlete_code,
    COALESCE(a.name, cr.athlete_code) AS name,
    a.club AS current_club,
    la.latest_age_group,
    cr.club_runs_total,
    cr.club_runs_last_year,
    cr.first_club_run_date,
    cr.last_club_run_date,
    cr.fastest_time,
    cr.fastest_time_seconds,
    cr.best_event_adj_time,
    cr.best_event_adj_time_seconds,
    cr.best_age_event_adj_time,
    cr.best_age_event_adj_time_seconds,
    cr.best_age_sex_event_adj_time,
    cr.best_age_sex_event_adj_time_seconds,
    crb.rank AS best_curve_ranking_current,
    COALESCE(hr.best_curve_ranking_historic, crb.rank) AS best_curve_ranking_historic,
    crb.metric_type AS best_curve_ranking_current_type,
    COALESCE(a.total_runs, 0) AS total_runs_all_clubs
FROM club_runs cr
LEFT JOIN athletes a ON a.athlete_code = cr.athlete_code
LEFT JOIN latest_age la ON la.athlete_code = cr.athlete_code
LEFT JOIN current_rank_best crb ON crb.athlete_code = cr.athlete_code AND crb.rn = 1
LEFT JOIN historic_rank hr ON hr.athlete_code = cr.athlete_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_club_members_cache_club_athlete
ON mv_club_members_cache (club_key, athlete_code);

CREATE INDEX IF NOT EXISTS idx_mv_club_members_cache_lookup
ON mv_club_members_cache (club_key, club_runs_total DESC, name);

REFRESH MATERIALIZED VIEW mv_club_members_cache;

-- Use this after initial creation whenever source data changes:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_club_members_cache;