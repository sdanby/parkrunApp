DROP MATERIALIZED VIEW IF EXISTS mv_latest_curve_ranks CASCADE;
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_latest_curve_ranks
TABLESPACE pg_default
AS
SELECT DISTINCT ON (r.athlete_code)
        r.athlete_code,
        r.current_best_rank_b,
        r.best_curve_ranking_current,
        r.current_best_rank_e,
        r.current_best_rank_ae,
        r.current_best_rank_es,
        r.current_best_rank_aes
FROM mv_extend_runs r
WHERE r.athlete_code IS NOT NULL
    AND BTRIM(r.athlete_code) <> ''
ORDER BY r.athlete_code, r.event_dt DESC NULLS LAST, r.event_code DESC
WITH DATA;

CREATE UNIQUE INDEX mv_latest_curve_ranks_uq ON mv_latest_curve_ranks (athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_participant_run_filters CASCADE;
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_participant_run_filters
TABLESPACE pg_default
AS
WITH athlete_totals AS (
    SELECT
        r.athlete_code,
        MAX(COALESCE(r.total_runs_all_parkruns, 0))::int AS total_runs_all_parkruns,
        MAX(COALESCE(r.total_runs_local_parkruns, 0))::int AS total_runs_local_parkruns,
        MAX(COALESCE(r.runs_last_year, 0))::int AS total_runs_local_parkruns_1y
    FROM mv_extend_runs r
    WHERE r.athlete_code IS NOT NULL
        AND BTRIM(r.athlete_code) <> ''
    GROUP BY r.athlete_code
),
athlete_freq_course AS (
    SELECT
        ranked.athlete_code,
        ranked.event_code::text AS freq_course_code,
        COALESCE(NULLIF(BTRIM(ranked.event_name), ''), ranked.event_code::text) AS freq_course,
        ranked.run_count::int AS freq_course_runs
    FROM (
        SELECT
            r.athlete_code,
            r.event_code,
            r.event_name,
            COUNT(*) AS run_count,
            MAX(to_date(r.event_date, 'DD/MM/YYYY')) AS latest_event_dt,
            ROW_NUMBER() OVER (
                PARTITION BY r.athlete_code
                ORDER BY COUNT(*) DESC,
                         MAX(to_date(r.event_date, 'DD/MM/YYYY')) DESC,
                         r.event_code::text ASC
            ) AS rn
        FROM mv_extend_runs r
        WHERE r.athlete_code IS NOT NULL
            AND BTRIM(r.athlete_code) <> ''
            AND r.event_code IS NOT NULL
        GROUP BY r.athlete_code, r.event_code, r.event_name
    ) ranked
    WHERE ranked.rn = 1
)
SELECT
        totals.athlete_code,
        totals.total_runs_all_parkruns,
        totals.total_runs_local_parkruns,
        totals.total_runs_local_parkruns_1y,
        freq.freq_course_code,
        COALESCE(freq.freq_course, '') AS freq_course,
        COALESCE(freq.freq_course_runs, 0)::int AS freq_course_runs
FROM athlete_totals totals
LEFT JOIN athlete_freq_course freq
    ON freq.athlete_code = totals.athlete_code
WITH DATA;

CREATE UNIQUE INDEX mv_participant_run_filters_uq ON mv_participant_run_filters (athlete_code);
CREATE INDEX mv_participant_run_filters_total_runs_idx ON mv_participant_run_filters (total_runs_all_parkruns DESC, athlete_code);
CREATE INDEX mv_participant_run_filters_local_runs_idx ON mv_participant_run_filters (total_runs_local_parkruns DESC, athlete_code);
CREATE INDEX mv_participant_run_filters_local_runs_1y_idx ON mv_participant_run_filters (total_runs_local_parkruns_1y DESC, athlete_code);
