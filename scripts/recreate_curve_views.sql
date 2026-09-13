-- Compatibility wrapper for operators who still expect scripts/recreate_curve_views.sql.
-- The canonical curve-rank definition now lives in sql/materialized_views/mv_curve_rank_views.sql.
\i sql/materialized_views/mv_curve_rank_views.sql
