-- Rebuild all known materialized views in dependency order.
--
-- Run with psql from the repository root, for example:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "scripts/rebuild_all_materialized_views.sql"
--
-- This wrapper relies on psql meta-commands (`\i`), so it is intended for
-- psql/scripted execution rather than a generic SQL web console.
--
-- Materialized views rebuilt by this script:
--   Base/support views from sql/materialized_views/Materialize.sql
--     mv_extend_runs
--     mv_latest_curve_ranks
--     mv_participant_run_filters
--     mv_best_time
--     mv_best_season
--     mv_best_event
--     mv_best_age
--     mv_best_sex
--     mv_best_age_sex
--     mv_best_age_event
--     mv_best_sex_event
--     mv_best_age_sex_event
--
--   Curve ranking views from sql/materialized_views/mv_curve_rank_views.sql
--     mv_best_curve
--     mv_best_season_curve
--     mv_best_event_curve
--     mv_best_age_curve
--     mv_best_sex_curve
--     mv_best_age_sex_curve
--     mv_best_age_event_curve
--     mv_best_sex_event_curve
--     mv_best_age_sex_event_curve
--     mv_best_1y_curve
--     mv_best_season_1y_curve
--     mv_best_event_1y_curve
--     mv_best_age_1y_curve
--     mv_best_sex_1y_curve
--     mv_best_age_sex_1y_curve
--     mv_best_age_event_1y_curve
--     mv_best_sex_event_1y_curve
--     mv_best_age_sex_event_1y_curve
--
--   Clubs/event summary cache views
--     mv_club_members_cache
--     mv_event_summary_cache

\set ON_ERROR_STOP on

\echo Rebuilding base/support materialized views from sql/materialized_views/Materialize.sql...
\i sql/materialized_views/Materialize.sql

\echo Rebuilding curve ranking materialized views from sql/materialized_views/mv_curve_rank_views.sql...
\i sql/materialized_views/mv_curve_rank_views.sql

\echo Rebuilding club members cache from sql/materialized_views/club_members_cache_mv.sql...
\i sql/materialized_views/club_members_cache_mv.sql

\echo Rebuilding event summary cache from sql/materialized_views/event_summary_cache_mv.sql...
\i sql/materialized_views/event_summary_cache_mv.sql

\echo Materialized view rebuild complete.