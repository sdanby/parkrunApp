DROP MATERIALIZED VIEW IF EXISTS mv_extend_runs CASCADE;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_extend_runs
TABLESPACE pg_default
AS
 WITH base AS (
         SELECT e.event_code,
            e.event_date,
            to_date(e.event_date::text, 'DD/MM/YYYY') AS event_dt,
            e.athlete_code,
            e."position",
            e.name,
            e.age_group,
            e.age_grade,
            e.club,
            e.comment,
            e."time",
            e.time_seconds,
            e.age_ratio_male,
            e.age_ratio_sex,
            p.coeff,
            p.coeff_event,
            ev.event_name,
            GREATEST(COALESCE(e.time_seconds::double precision / COALESCE(NULLIF(p.coeff, 0::double precision), 1::real), 0::double precision), 769.0::double precision) AS season_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / COALESCE(NULLIF(COALESCE(NULLIF(p.coeff, 0::double precision), 1::real) + COALESCE(NULLIF(p.coeff_event, 0::double precision), 1::real) - 1::double precision, 0::double precision), 1::double precision), 0::double precision), 769.0::double precision) AS event_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / NULLIF(e.age_ratio_male, 0::double precision), 0::double precision), 769.0::double precision) AS age_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / (e.age_ratio_sex / NULLIF(e.age_ratio_male, 0::double precision)), 0::double precision), 769.0::double precision) AS sex_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / COALESCE(NULLIF(COALESCE(NULLIF(p.coeff, 0::double precision), 1::real) + COALESCE(NULLIF(p.coeff_event, 0::double precision), 1::real) - 1::double precision, 0::double precision), 1::double precision) / NULLIF(e.age_ratio_male, 0::double precision), 0::double precision), 769.0::double precision) AS age_event_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / NULLIF(e.age_ratio_sex, 0::double precision), 0::double precision), 769.0::double precision) AS age_sex_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / COALESCE(NULLIF(COALESCE(NULLIF(p.coeff, 0::double precision), 1::real) + COALESCE(NULLIF(p.coeff_event, 0::double precision), 1::real) - 1::double precision, 0::double precision), 1::double precision) * (e.age_ratio_sex / NULLIF(e.age_ratio_male, 0::double precision)), 0::double precision), 769.0::double precision) AS sex_event_adj_time_seconds,
            GREATEST(COALESCE(e.time_seconds::double precision / COALESCE(NULLIF(COALESCE(NULLIF(p.coeff, 0::double precision), 1::real) + COALESCE(NULLIF(p.coeff_event, 0::double precision), 1::real) - 1::double precision, 0::double precision), 1::double precision) / NULLIF(e.age_ratio_sex, 0::double precision), 0::double precision), 769.0::double precision) AS age_sex_event_adj_time_seconds,
            round(e.best_curve_ranking_current::numeric, 1)::numeric(6,1) AS best_curve_ranking_current,
            round(e.best_curve_ranking_historic::numeric, 1)::numeric(6,1) AS best_curve_ranking_historic,
            e.best_curve_ranking_current_type,
            e.event_rank_b,
            e.event_rank_e,
            e.event_rank_es,
            e.event_rank_ae,
            e.event_rank_aes,
            e.current_best_rank_b,
            e.current_best_rank_e,
            e.current_best_rank_es,
            e.current_best_rank_ae,
            e.current_best_rank_aes
			FROM eventpositions e
             JOIN parkrun_events p ON p.event_code = e.event_code AND p.event_date = e.event_date::text
             JOIN events ev ON e.event_code = ev.event_code
          WHERE e.time_seconds IS NOT NULL AND e.age_ratio_male IS NOT NULL
          ), athlete_stats AS (
            SELECT b.athlete_code,
                COUNT(*)::int AS mv_runs_total,
                COUNT(*) FILTER (
                     WHERE b.event_dt >= CURRENT_DATE - INTERVAL '1 year'
                )::int AS mv_runs_last_year
              FROM base b
             WHERE b.athlete_code IS NOT NULL AND BTRIM(b.athlete_code) <> ''
             GROUP BY b.athlete_code
        )
 SELECT b.event_code,
     b.event_date,
     b.event_dt,
     b.athlete_code,
     b."position",
     b.name,	
     b.age_group,
     b.age_grade,
     b.club,
     b.comment,
     b."time",
     b.time_seconds,
     b.age_ratio_male,
     b.age_ratio_sex,
     b.coeff,
     b.coeff_event,
     b.event_name,
     COALESCE(a.total_runs, s.mv_runs_total, 0) AS total_runs_all_parkruns,
     COALESCE(s.mv_runs_total, 0) AS total_runs_local_parkruns,
     COALESCE(s.mv_runs_last_year, 0) AS runs_last_year,
	 best_curve_ranking_current,
	 best_curve_ranking_historic,
	 best_curve_ranking_current_type,
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
     b.season_adj_time_seconds,
     b.event_adj_time_seconds,
     b.age_adj_time_seconds,
     b.sex_adj_time_seconds,
     b.age_event_adj_time_seconds,
     b.age_sex_adj_time_seconds,
     b.sex_event_adj_time_seconds,
     b.age_sex_event_adj_time_seconds,
     (b.season_adj_time_seconds::integer / 60)::text || ':' || lpad((b.season_adj_time_seconds::integer % 60)::text, 2, '0') AS season_adj_time,
     (b.event_adj_time_seconds::integer / 60)::text || ':' || lpad((b.event_adj_time_seconds::integer % 60)::text, 2, '0') AS event_adj_time,
     (b.age_adj_time_seconds::integer / 60)::text || ':' || lpad((b.age_adj_time_seconds::integer % 60)::text, 2, '0') AS age_adj_time,
     (b.sex_adj_time_seconds::integer / 60)::text || ':' || lpad((b.sex_adj_time_seconds::integer % 60)::text, 2, '0') AS sex_adj_time,
     (b.age_event_adj_time_seconds::integer / 60)::text || ':' || lpad((b.age_event_adj_time_seconds::integer % 60)::text, 2, '0') AS age_event_adj_time,
     (b.age_sex_adj_time_seconds::integer / 60)::text || ':' || lpad((b.age_sex_adj_time_seconds::integer % 60)::text, 2, '0') AS age_sex_adj_time,
     (b.sex_event_adj_time_seconds::integer / 60)::text || ':' || lpad((b.sex_event_adj_time_seconds::integer % 60)::text, 2, '0') AS sex_event_adj_time,
     (b.age_sex_event_adj_time_seconds::integer / 60)::text || ':' || lpad((b.age_sex_event_adj_time_seconds::integer % 60)::text, 2, '0') AS age_sex_event_adj_time
    FROM base b
      LEFT JOIN athlete_stats s ON s.athlete_code = b.athlete_code
      LEFT JOIN athletes a ON a.athlete_code = b.athlete_code
WITH DATA;

CREATE UNIQUE INDEX mv_extend_runs_uq ON mv_extend_runs (event_code, event_date, athlete_code, position);
CREATE INDEX mv_extend_runs_athlete_eventdt_idx ON mv_extend_runs (athlete_code, event_dt DESC) WHERE athlete_code IS NOT NULL AND event_dt IS NOT NULL;
CREATE INDEX mv_extend_runs_time_idx ON mv_extend_runs (time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_season_idx ON mv_extend_runs (season_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_event_idx ON mv_extend_runs (event_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_age_idx ON mv_extend_runs (age_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_sex_idx ON mv_extend_runs (sex_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_age_event_idx ON mv_extend_runs (age_event_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_age_sex_idx ON mv_extend_runs (age_sex_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_sex_event_idx ON mv_extend_runs (sex_event_adj_time_seconds, athlete_code);
CREATE INDEX mv_extend_runs_age_sex_event_idx ON mv_extend_runs (age_sex_event_adj_time_seconds, athlete_code);

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

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_time CASCADE;
CREATE MATERIALIZED VIEW mv_best_time AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_time_uq ON mv_best_time (athlete_code);
CREATE INDEX mv_best_time_top_idx ON mv_best_time (time_seconds, athlete_code);


--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_season CASCADE;
CREATE MATERIALIZED VIEW mv_best_season AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, season_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY season_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_season_uq ON mv_best_season (athlete_code);
CREATE INDEX mv_best_season_top_idx ON mv_best_season (season_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_event AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, event_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY event_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_event_uq ON mv_best_event (athlete_code);
CREATE INDEX mv_best_event_top_idx ON mv_best_event (event_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_age CASCADE;
CREATE MATERIALIZED VIEW mv_best_age AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, age_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY age_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_age_uq ON mv_best_age (athlete_code);
CREATE INDEX mv_best_age_top_idx ON mv_best_age (age_adj_time_seconds, athlete_code);

--================================================================================================


DROP MATERIALIZED VIEW IF EXISTS mv_best_sex CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, sex_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY sex_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_sex_uq ON mv_best_sex (athlete_code);
CREATE INDEX mv_best_sex_top_idx ON mv_best_sex (sex_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, age_sex_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY age_sex_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_age_sex_uq ON mv_best_age_sex (athlete_code);
CREATE INDEX mv_best_age_sex_top_idx ON mv_best_age_sex (age_sex_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_event AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, age_event_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY age_event_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_age_event_uq ON mv_best_age_event (athlete_code);
CREATE INDEX mv_best_age_event_top_idx ON mv_best_age_event (age_event_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_event AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, sex_event_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY sex_event_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_sex_event_uq ON mv_best_sex_event (athlete_code);
CREATE INDEX mv_best_sex_event_top_idx ON mv_best_sex_event (sex_event_adj_time_seconds, athlete_code);


--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, age_sex_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY age_sex_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_age_sex_uq ON mv_best_age_sex (athlete_code);
CREATE INDEX mv_best_age_sex_top_idx ON mv_best_age_sex (age_sex_adj_time_seconds, athlete_code);

--================================================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_event AS
SELECT *
FROM (
    SELECT DISTINCT ON (athlete_code) *
    FROM mv_extend_runs
    ORDER BY athlete_code, age_sex_event_adj_time_seconds, position, event_date DESC, event_code
) best_per_athlete
ORDER BY age_sex_event_adj_time_seconds, athlete_code
LIMIT 1000
WITH NO DATA;

CREATE UNIQUE INDEX mv_best_age_sex_event_uq ON mv_best_age_sex_event (athlete_code);
CREATE INDEX mv_best_age_sex_event_top_idx ON mv_best_age_sex_event (age_sex_event_adj_time_seconds, athlete_code);


REFRESH MATERIALIZED VIEW mv_best_time WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_age WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_event WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_season WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_sex WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_age_event WITH DATA;  
REFRESH MATERIALIZED VIEW mv_best_age_sex WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_sex_event WITH DATA;
REFRESH MATERIALIZED VIEW mv_best_age_sex_event WITH DATA;