-- Curve-ranked materialized views (single-step build from mv_extend_runs)
-- Each view uses the stored snapshot rank from the selected best row.

-- =========================
-- All-time curve views
-- =========================

DROP MATERIALIZED VIEW IF EXISTS mv_best_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.best_curve_ranking_current,
        r.best_curve_ranking_historic,
        r.best_curve_ranking_current_type,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.current_best_rank_b AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_curve_uq ON mv_best_curve (athlete_code);
CREATE INDEX mv_best_curve_rank_idx ON mv_best_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_season_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_season_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.best_curve_ranking_current,
        r.best_curve_ranking_historic,
        r.best_curve_ranking_current_type,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.season_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.season_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_season_curve_uq ON mv_best_season_curve (athlete_code);
CREATE INDEX mv_best_season_curve_rank_idx ON mv_best_season_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_event_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_event_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.best_curve_ranking_current,
        r.best_curve_ranking_historic,
        r.best_curve_ranking_current_type,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.current_best_rank_e AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_event_curve_uq ON mv_best_event_curve (athlete_code);
CREATE INDEX mv_best_event_curve_rank_idx ON mv_best_event_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.age_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_curve_uq ON mv_best_age_curve (athlete_code);
CREATE INDEX mv_best_age_curve_rank_idx ON mv_best_age_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.sex_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.sex_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_sex_curve_uq ON mv_best_sex_curve (athlete_code);
CREATE INDEX mv_best_sex_curve_rank_idx ON mv_best_sex_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.age_sex_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_sex_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_sex_curve_uq ON mv_best_age_sex_curve (athlete_code);
CREATE INDEX mv_best_age_sex_curve_rank_idx ON mv_best_age_sex_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_event_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_event_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.current_best_rank_ae AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.age_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_event_curve_uq ON mv_best_age_event_curve (athlete_code);
CREATE INDEX mv_best_age_event_curve_rank_idx ON mv_best_age_event_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_event_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_event_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.current_best_rank_es AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.sex_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.sex_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_sex_event_curve_uq ON mv_best_sex_event_curve (athlete_code);
CREATE INDEX mv_best_sex_event_curve_rank_idx ON mv_best_sex_event_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_event_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_event_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.current_best_rank_aes AS best_rank
    FROM mv_extend_runs r
    ORDER BY
        r.athlete_code,
        r.age_sex_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_sex_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_sex_event_curve_uq ON mv_best_age_sex_event_curve (athlete_code);
CREATE INDEX mv_best_age_sex_event_curve_rank_idx ON mv_best_age_sex_event_curve (rank DESC, athlete_code);


-- =========================
-- Last-year (1y) curve views
-- =========================

DROP MATERIALIZED VIEW IF EXISTS mv_best_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.best_curve_ranking_current,
        r.best_curve_ranking_historic,
        r.best_curve_ranking_current_type,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.event_rank_b AS best_rank,
        MAX(r.event_rank_b) OVER (PARTITION BY r.athlete_code) AS period_best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_1y_curve_uq ON mv_best_1y_curve (athlete_code);
CREATE INDEX mv_best_1y_curve_rank_idx ON mv_best_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_season_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_season_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.season_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.season_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_season_1y_curve_uq ON mv_best_season_1y_curve (athlete_code);
CREATE INDEX mv_best_season_1y_curve_rank_idx ON mv_best_season_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_event_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_event_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.event_rank_e AS best_rank,
        MAX(r.event_rank_e) OVER (PARTITION BY r.athlete_code) AS period_best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_event_1y_curve_uq ON mv_best_event_1y_curve (athlete_code);
CREATE INDEX mv_best_event_1y_curve_rank_idx ON mv_best_event_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.age_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_1y_curve_uq ON mv_best_age_1y_curve (athlete_code);
CREATE INDEX mv_best_age_1y_curve_rank_idx ON mv_best_age_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.sex_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.sex_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_sex_1y_curve_uq ON mv_best_sex_1y_curve (athlete_code);
CREATE INDEX mv_best_sex_1y_curve_rank_idx ON mv_best_sex_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.best_curve_ranking_current AS best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.age_sex_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_sex_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_sex_1y_curve_uq ON mv_best_age_sex_1y_curve (athlete_code);
CREATE INDEX mv_best_age_sex_1y_curve_rank_idx ON mv_best_age_sex_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_event_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_event_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.event_rank_ae AS best_rank,
        MAX(r.event_rank_ae) OVER (PARTITION BY r.athlete_code) AS period_best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.age_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_event_1y_curve_uq ON mv_best_age_event_1y_curve (athlete_code);
CREATE INDEX mv_best_age_event_1y_curve_rank_idx ON mv_best_age_event_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_sex_event_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_sex_event_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.event_rank_es AS best_rank,
        MAX(r.event_rank_es) OVER (PARTITION BY r.athlete_code) AS period_best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.sex_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.sex_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_sex_event_1y_curve_uq ON mv_best_sex_event_1y_curve (athlete_code);
CREATE INDEX mv_best_sex_event_1y_curve_rank_idx ON mv_best_sex_event_1y_curve (rank DESC, athlete_code);

DROP MATERIALIZED VIEW IF EXISTS mv_best_age_sex_event_1y_curve CASCADE;
CREATE MATERIALIZED VIEW mv_best_age_sex_event_1y_curve AS
WITH best_per_athlete AS (
    SELECT DISTINCT ON (r.athlete_code)
        r.event_code,
        r.event_date,
        r.athlete_code,
        r.position,
        r.name,
        r.age_group,
        r.age_grade,
        r.club,
        r.comment,
        r.time,
        r.time_seconds,
        r.age_ratio_male,
        r.age_ratio_sex,
        r.coeff,
        r.coeff_event,
        r.event_name,
        r.season_adj_time_seconds,
        r.event_adj_time_seconds,
        r.age_adj_time_seconds,
        r.sex_adj_time_seconds,
        r.age_event_adj_time_seconds,
        r.age_sex_adj_time_seconds,
        r.sex_event_adj_time_seconds,
        r.age_sex_event_adj_time_seconds,
        r.season_adj_time,
        r.event_adj_time,
        r.age_adj_time,
        r.sex_adj_time,
        r.age_event_adj_time,
        r.age_sex_adj_time,
        r.sex_event_adj_time,
        r.age_sex_event_adj_time,
        r.event_rank_aes AS best_rank,
        MAX(r.event_rank_aes) OVER (PARTITION BY r.athlete_code) AS period_best_rank
    FROM mv_extend_runs r
    WHERE to_date(r.event_date, 'DD/MM/YYYY') >= (CURRENT_DATE - INTERVAL '1 year')::date
    ORDER BY
        r.athlete_code,
        r.age_sex_event_adj_time_seconds ASC,
        r.position ASC,
        to_date(r.event_date, 'DD/MM/YYYY') DESC,
        r.event_code
)
SELECT
    b.*,
    b.best_rank AS rank
FROM best_per_athlete b
WHERE b.best_rank IS NOT NULL
ORDER BY b.age_sex_event_adj_time_seconds, b.athlete_code
WITH DATA;
CREATE UNIQUE INDEX mv_best_age_sex_event_1y_curve_uq ON mv_best_age_sex_event_1y_curve (athlete_code);
CREATE INDEX mv_best_age_sex_event_1y_curve_rank_idx ON mv_best_age_sex_event_1y_curve (rank DESC, athlete_code);
