-- Performance support objects for /api/lists/event_summary
-- Goal: avoid re-aggregating latest run date per athlete on every API request.

-- 1) Precompute each athlete's latest run date across all events.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_athlete_last_any_run AS
SELECT
    athlete_code,
    MAX(event_dt) AS last_any_run_date
FROM mv_extend_runs
WHERE athlete_code IS NOT NULL
  AND event_dt IS NOT NULL
GROUP BY athlete_code
WITH NO DATA;

-- 2) Required for fast joins and concurrent refresh.
CREATE UNIQUE INDEX IF NOT EXISTS mv_athlete_last_any_run_uq
    ON mv_athlete_last_any_run (athlete_code);

-- Optional helper index if you filter/report by staleness windows elsewhere.
CREATE INDEX IF NOT EXISTS mv_athlete_last_any_run_date_idx
    ON mv_athlete_last_any_run (last_any_run_date DESC);

-- 3) Supporting index for volunteer aggregation in event_summary.
CREATE INDEX IF NOT EXISTS volunteers_event_athlete_idx
    ON volunteers (event_code, athlete_code);

-- 4) Initial fill.
REFRESH MATERIALIZED VIEW mv_athlete_last_any_run;

-- 5) Ongoing refresh after mv_extend_runs refresh.
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_athlete_last_any_run;
