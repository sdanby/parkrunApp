-- Single materialized view for fast /api/lists/event_summary lookups
-- Includes per-athlete global last run date so no separate mv_athlete_last_any_run is required.

DROP MATERIALIZED VIEW IF EXISTS public.mv_event_summary_cache CASCADE;

CREATE MATERIALIZED VIEW public.mv_event_summary_cache AS
WITH
base AS (
    SELECT
        event_code,
        athlete_code,
        name,
        club,
        age_group,
        time_seconds,
        event_adj_time_seconds,
        age_ratio_male,
        age_ratio_sex,
        best_curve_ranking_current,
        best_curve_ranking_historic,
        best_curve_ranking_current_type,
        event_dt
    FROM mv_extend_runs
    WHERE athlete_code IS NOT NULL
      AND event_dt IS NOT NULL
),
agg AS (
    SELECT
        event_code,
        athlete_code,
        MIN(time_seconds) AS min_time_seconds,
        MIN(event_adj_time_seconds) AS min_event_adj_time_seconds,
        MIN(event_adj_time_seconds / NULLIF(age_ratio_male, 0)) AS min_age_event_adj_time_seconds,
        MIN(event_adj_time_seconds / NULLIF(age_ratio_sex, 0)) AS min_age_sex_event_adj_time_seconds,
        COUNT(*) AS appearances
    FROM base
    GROUP BY event_code, athlete_code
),
latest_event AS (
    SELECT DISTINCT ON (event_code, athlete_code)
        event_code,
        athlete_code,
        name,
        club,
        age_group,
        best_curve_ranking_current,
        best_curve_ranking_historic,
        best_curve_ranking_current_type,
        event_dt AS last_run_date
    FROM base
    ORDER BY event_code, athlete_code, event_dt DESC
),
latest_any_event AS (
    SELECT
        athlete_code,
        MAX(event_dt) AS last_any_run_date
    FROM mv_extend_runs
    WHERE athlete_code IS NOT NULL
      AND event_dt IS NOT NULL
    GROUP BY athlete_code
),
vol_base AS (
    SELECT
        v.event_code,
        v.athlete_code,
        CASE
            WHEN v.event_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(v.event_date, 'DD/MM/YYYY')
            WHEN v.event_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(v.event_date, 'YYYY-MM-DD')
            ELSE NULL
        END AS vol_dt
    FROM volunteers v
    WHERE v.athlete_code IS NOT NULL
),
vol_counts AS (
    SELECT
        event_code,
        athlete_code,
        COUNT(*) AS volunteer_count,
        MAX(vol_dt) AS last_volunteer_date
    FROM vol_base
    GROUP BY event_code, athlete_code
),
joined AS (
    SELECT
        a.event_code,
        a.athlete_code,
        l.name,
        l.club,
        l.age_group,

        -- Keep both raw and formatted values so API can stay simple and fast.
        a.min_time_seconds,
        a.min_event_adj_time_seconds,
        a.min_age_event_adj_time_seconds,
        a.min_age_sex_event_adj_time_seconds,

        to_char((a.min_time_seconds::int || ' seconds')::interval, 'FMMI:SS') AS min_time_mmss,
        to_char((round(a.min_event_adj_time_seconds)::int || ' seconds')::interval, 'FMMI:SS') AS min_event_adj_mmss,
        to_char((round(a.min_age_event_adj_time_seconds)::int || ' seconds')::interval, 'FMMI:SS') AS min_age_event_adj_mmss,
        to_char((round(a.min_age_sex_event_adj_time_seconds)::int || ' seconds')::interval, 'FMMI:SS') AS min_age_sex_event_adj_mmss,

        a.appearances,
        COALESCE(v.volunteer_count, 0) AS volunteer_count,
        (a.appearances + COALESCE(v.volunteer_count, 0)) AS total_count,

        la.last_any_run_date,
        CASE
            WHEN la.last_any_run_date < (current_date - INTERVAL '1 year') THEN NULL
            ELSE l.best_curve_ranking_current
        END AS best_curve_ranking_current,
        l.best_curve_ranking_historic,
        l.best_curve_ranking_current_type,

        l.last_run_date,
        (current_date - l.last_run_date) AS days_since_last_run,

        v.last_volunteer_date,
        CASE
            WHEN v.last_volunteer_date IS NULL THEN NULL
            ELSE (current_date - v.last_volunteer_date)
        END AS days_since_last_volunteered,

        to_char(l.last_run_date, 'DD/MM/YYYY') AS last_run_date_ddmmyyyy,
        to_char(v.last_volunteer_date, 'DD/MM/YYYY') AS last_volunteer_date_ddmmyyyy

    FROM agg a
    JOIN latest_event l
      ON l.event_code = a.event_code
     AND l.athlete_code = a.athlete_code
    LEFT JOIN latest_any_event la
      ON la.athlete_code = a.athlete_code
    LEFT JOIN vol_counts v
      ON v.event_code = a.event_code
     AND v.athlete_code = a.athlete_code
),
ranked AS (
    SELECT
        j.*,
        ROW_NUMBER() OVER (
            PARTITION BY j.event_code
            ORDER BY j.total_count DESC, j.appearances DESC, j.volunteer_count DESC, j.athlete_code
        ) AS event_rank
    FROM joined j
)
SELECT *
FROM ranked
WHERE event_rank <= 250
WITH NO DATA;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX mv_event_summary_cache_uq
    ON public.mv_event_summary_cache (event_code, athlete_code);

-- Supports Top250 endpoint ordering per event_code
CREATE INDEX mv_event_summary_cache_top250_idx
    ON public.mv_event_summary_cache (event_code, total_count DESC, appearances DESC, volunteer_count DESC);

-- Optional helper indexes
CREATE INDEX mv_event_summary_cache_last_any_idx
    ON public.mv_event_summary_cache (last_any_run_date DESC);

CREATE INDEX mv_event_summary_cache_last_run_idx
    ON public.mv_event_summary_cache (event_code, last_run_date DESC);

-- Initial load
REFRESH MATERIALIZED VIEW public.mv_event_summary_cache;

-- Ongoing refresh after mv_extend_runs refresh
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_summary_cache;
