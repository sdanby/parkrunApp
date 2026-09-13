-- PostgreSQL: fast adjusted-time query pipeline
-- Creates:
--   1) Base MV with all adjusted-second metrics
--   2) One "best row per athlete" MV per metric
--   3) Indexes for fast ORDER BY ... LIMIT 1000 queries

-- ==============================================================
-- 0) Date parsing is inlined (no helper function dependency)
-- ==============================================================

-- ==============================================================
-- 1) Supporting indexes on base tables (helps MV refresh)
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_eventpositions_mv_source
	ON eventpositions (event_code, event_date, athlete_code, position);

CREATE INDEX IF NOT EXISTS idx_eventpositions_mv_filter
	ON eventpositions (event_code, event_date)
	WHERE time_seconds IS NOT NULL
	  AND age_ratio_male IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parkrun_events_mv_source
	ON parkrun_events (event_code, event_date);

CREATE INDEX IF NOT EXISTS idx_events_event_code
	ON events (event_code);

-- ==============================================================
-- 2) Base MV: all adjusted numeric metrics (no MM:SS formatting)
-- ==============================================================
-- Keep object stable for faster recurring refreshes.
-- Drop manually only when you change the MV column definition.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_extend_runs AS
SELECT
	e.event_code,
	e.event_date,
	e.athlete_code,
	e.position,
	e.name,
	e.age_group,
	e.age_grade,
	e.club,
	e.comment,
	e.time,
	e.time_seconds,
	e.age_ratio_male,
	e.age_ratio_sex,
	p.coeff,
	p.coeff_event,

	GREATEST(
		COALESCE(
			e.time_seconds::double precision / COALESCE(NULLIF(p.coeff::double precision, 0.0), 1.0),
			0.0
		),
		769.0
	) AS season_adj_time_seconds,
	GREATEST(
		COALESCE(
			e.time_seconds::double precision / COALESCE(NULLIF((COALESCE(NULLIF(p.coeff::double precision, 0.0), 1.0) + COALESCE(NULLIF(p.coeff_event::double precision, 0.0), 1.0) - 1.0), 0.0), 1.0),
			0.0
		),
		769.0
	) AS event_adj_time_seconds,
	GREATEST(
		COALESCE(e.time_seconds::double precision / NULLIF(e.age_ratio_male::double precision, 0.0), 0.0),
		769.0
	) AS age_adj_time_seconds,
	GREATEST(
		COALESCE(e.time_seconds::double precision / NULLIF(e.age_ratio_sex::double precision, 0.0), 0.0),
		769.0
	) AS age_sex_adj_time_seconds,
	GREATEST(
		COALESCE(
			e.time_seconds::double precision /
			(
				COALESCE(NULLIF((COALESCE(NULLIF(p.coeff::double precision, 0.0), 1.0) + COALESCE(NULLIF(p.coeff_event::double precision, 0.0), 1.0) - 1.0), 0.0), 1.0)
				/
				NULLIF(e.age_ratio_male::double precision, 0.0)
			),
			0.0
		),
		769.0
	) AS age_event_adj_time_seconds,
	GREATEST(
		COALESCE(
			e.time_seconds::double precision /
			(
				COALESCE(NULLIF((COALESCE(NULLIF(p.coeff::double precision, 0.0), 1.0) + COALESCE(NULLIF(p.coeff_event::double precision, 0.0), 1.0) - 1.0), 0.0), 1.0)
				/
				NULLIF(e.age_ratio_sex::double precision, 0.0)
			),
			0.0
		),
		769.0
	) AS age_sex_event_adj_time_seconds,
	GREATEST(
		COALESCE(
			e.time_seconds::double precision /
			(
				COALESCE(NULLIF((COALESCE(NULLIF(p.coeff::double precision, 0.0), 1.0) + COALESCE(NULLIF(p.coeff_event::double precision, 0.0), 1.0) - 1.0), 0.0), 1.0)
				*
				(e.age_ratio_sex::double precision / NULLIF(e.age_ratio_male::double precision, 0.0))
			),
			0.0
		),
		769.0
	) AS sex_event_adj_time_seconds,
	GREATEST(
		COALESCE(
			e.time_seconds::double precision /
			NULLIF((e.age_ratio_sex::double precision / NULLIF(e.age_ratio_male::double precision, 0.0)), 0.0),
			0.0
		),
		769.0
	) AS sex_adj_time_seconds
FROM eventpositions e
JOIN parkrun_events p
	ON p.event_code = e.event_code
	AND p.event_date = e.event_date
WHERE e.time_seconds IS NOT NULL
	AND e.age_ratio_male IS NOT NULL
WITH NO DATA;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX mv_extend_runs_uq
	ON mv_extend_runs (event_code, event_date, athlete_code, position);

-- ==============================================================
-- 3) Per-metric BEST-per-athlete MVs
-- ==============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_best_season CASCADE;
CREATE MATERIALIZED VIEW mv_best_season AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	season_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, season_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_season_uq ON mv_best_season (athlete_code);
CREATE INDEX mv_best_season_top_idx ON mv_best_season (season_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_event AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	event_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, event_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_event_uq ON mv_best_event (athlete_code);
CREATE INDEX mv_best_event_top_idx ON mv_best_event (event_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age CASCADE;
CREATE MATERIALIZED VIEW mv_best_age AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	age_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, age_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_age_uq ON mv_best_age (athlete_code);
CREATE INDEX mv_best_age_top_idx ON mv_best_age (age_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	age_sex_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, age_sex_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_age_sex_uq ON mv_best_age_sex (athlete_code);
CREATE INDEX mv_best_age_sex_top_idx ON mv_best_age_sex (age_sex_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_event AS
SELECT DISTINCT ON (athlete_code) *
FROM mv_extend_runs
ORDER BY athlete_code, age_event_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_age_event_uq ON mv_best_age_event (athlete_code);
CREATE INDEX mv_best_age_event_top_idx ON mv_best_age_event (age_event_adj_time_seconds, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_event AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	age_sex_event_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, age_sex_event_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_age_sex_event_uq ON mv_best_age_sex_event (athlete_code);
CREATE INDEX mv_best_age_sex_event_top_idx ON mv_best_age_sex_event (age_sex_event_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_event CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_event AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	sex_event_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, sex_event_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_sex_event_uq ON mv_best_sex_event (athlete_code);
CREATE INDEX mv_best_sex_event_top_idx ON mv_best_sex_event (sex_event_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex AS
SELECT DISTINCT ON (athlete_code)
	athlete_code,
	event_code,
	event_date,
	position,
	sex_adj_time_seconds
FROM mv_extend_runs
ORDER BY athlete_code, sex_adj_time_seconds, event_date DESC, event_code, position
WITH NO DATA;
CREATE UNIQUE INDEX mv_best_sex_uq ON mv_best_sex (athlete_code);
CREATE INDEX mv_best_sex_top_idx ON mv_best_sex (sex_adj_time_seconds, athlete_code) INCLUDE (event_code, event_date, position);

-- ==============================================================
-- 4) Initial population (first run)
-- ==============================================================
REFRESH MATERIALIZED VIEW mv_extend_runs;
REFRESH MATERIALIZED VIEW mv_best_season;
REFRESH MATERIALIZED VIEW mv_best_event;
REFRESH MATERIALIZED VIEW mv_best_age;
REFRESH MATERIALIZED VIEW mv_best_age_sex;
REFRESH MATERIALIZED VIEW mv_best_age_event;
REFRESH MATERIALIZED VIEW mv_best_age_sex_event;
REFRESH MATERIALIZED VIEW mv_best_sex_event;
REFRESH MATERIALIZED VIEW mv_best_sex;

-- ==============================================================
-- 5) Ongoing refresh (run after data loads)
-- ==============================================================
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_extend_runs;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_season;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_event;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_age;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_age_sex;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_age_event;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_age_sex_event;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_sex_event;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_best_sex;

-- ==============================================================
-- 6) Fast query examples
-- ==============================================================
-- Top 1000 by age_event_adj_time_seconds (best row per athlete already pre-selected)
-- SELECT *
-- FROM mv_best_age_event
-- ORDER BY age_event_adj_time_seconds, athlete_code
-- LIMIT 1000;

-- Top 1000 by sex_adj_time_seconds
-- SELECT *
-- FROM mv_best_sex
-- ORDER BY sex_adj_time_seconds, athlete_code
-- LIMIT 1000;

