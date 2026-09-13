# SQL Ownership Pass

This note records the first concrete Phase 4 ownership pass for the root SQL files.

## Summary

- Phase 4 is now in progress.
- The first runtime move batch has been executed.
- `newSQL.sql` and `SQL.sql` are still active runtime assets and are not archive candidates.
- `Materialize.sql`, `mv_curve_rank_views.sql`, `event_summary_cache_mv.sql`, and `club_members_cache_mv.sql` are confirmed runtime rebuild assets.
- `mv_fast_adjusted_queries.sql`, `event_summary_perf.sql`, and `eventposition_view.sql` are still unproven by live callers and should stay in place until a stronger owner is found.
- The remaining exploratory SQL files have no live callers surfaced outside documentation and can be treated as manual review assets.

## Exact Classification List

| File | Classification | Current evidence | Proposed destination | Move readiness |
| --- | --- | --- | --- | --- |
| `Materialize.sql` | runtime materialized view | `newAnalytics.py`; `scripts/rebuild_all_materialized_views.sql` | `sql/materialized_views/Materialize.sql` | moved |
| `mv_curve_rank_views.sql` | runtime materialized view | `newAnalytics.py` and `scripts/rebuild_all_materialized_views.sql` now point directly to it; `scripts/recreate_curve_views.sql` is only a compatibility wrapper | `sql/materialized_views/mv_curve_rank_views.sql` | moved |
| `event_summary_cache_mv.sql` | runtime materialized view | `newAnalytics.py`; `scripts/rebuild_all_materialized_views.sql` | `sql/materialized_views/event_summary_cache_mv.sql` | moved |
| `club_members_cache_mv.sql` | runtime materialized view | `newAnalytics.py`; `scripts/rebuild_all_materialized_views.sql` | `sql/materialized_views/club_members_cache_mv.sql` | moved |
| `mv_fast_adjusted_queries.sql` | runtime materialized view candidate | proof pass still found no live caller outside planning docs | `sql/materialized_views/mv_fast_adjusted_queries.sql` | hold in place pending owner proof |
| `event_summary_perf.sql` | runtime analytics candidate | proof pass still found no live caller outside planning docs | `sql/analytics_queries/event_summary_perf.sql` | hold in place pending owner proof |
| `eventposition_view.sql` | runtime analytics candidate | proof pass still found no live caller outside planning docs | `sql/analytics_queries/eventposition_view.sql` | hold in place pending owner proof |
| `newSQL.sql` | runtime pipeline section | `backendAPI.py`; `database.py`; `newAnalytics.py`; `docs/runbooks/analytics-runbook.md` | `sql/pipeline_sections/newSQL.sql` | moved |
| `SQL.sql` | runtime pipeline section (legacy-core) | `analytics.py`; `database.py`; `newAnalytics.py` candidate fallback | `sql/pipeline_sections/SQL.sql` | moved |
| `adjustments.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/adjustments.sql` | move-ready |
| `age_base times.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/age_base times.sql` | move-ready |
| `age_grading.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/age_grading.sql` | move-ready |
| `athlete_build_test.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/athlete_build_test.sql` | move-ready |
| `athlete_rebuild.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/athlete_rebuild.sql` | move-ready |
| `bad_athletes.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/bad_athletes.sql` | move-ready |
| `consitent_performers.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/consitent_performers.sql` | move-ready |
| `local_stars.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/local_stars.sql` | move-ready |
| `new_coeff.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/new_coeff.sql` | move-ready |
| `new_eligible.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/new_eligible.sql` | move-ready |
| `old_coeff.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/old_coeff.sql` | move-ready |
| `old_eligible.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/old_eligible.sql` | move-ready |
| `Process for eventpositions.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/Process for eventpositions.sql` | move-ready |
| `recent.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/recent.sql` | move-ready |
| `regulars.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/regulars.sql` | move-ready |
| `tourist_count.sql` | one-off review/manual | no live caller surfaced outside docs | `sql/one_off_reviews/tourist_count.sql` | move-ready |

## Hardcoded Caller Notes

These files should not move until callers are updated away from root-level filenames:

- `sql/materialized_views/Materialize.sql`: loaded by `newAnalytics.py` and included by `scripts/rebuild_all_materialized_views.sql`
- `sql/materialized_views/mv_curve_rank_views.sql`: now called directly by `newAnalytics.py` and `scripts/rebuild_all_materialized_views.sql`; `scripts/recreate_curve_views.sql` remains only as a wrapper path
- `sql/materialized_views/event_summary_cache_mv.sql`: loaded by `newAnalytics.py` and included by `scripts/rebuild_all_materialized_views.sql`
- `sql/materialized_views/club_members_cache_mv.sql`: loaded by `newAnalytics.py` and included by `scripts/rebuild_all_materialized_views.sql`
- `sql/pipeline_sections/newSQL.sql`: referenced directly by `backendAPI.py`, `database.py`, and `newAnalytics.py`
- `sql/pipeline_sections/SQL.sql`: referenced directly by `analytics.py` and `database.py`, with `newAnalytics.py` still treating it as a fallback candidate

## Executed First Move Batch

1. `Materialize.sql` -> `sql/materialized_views/Materialize.sql`
2. `mv_curve_rank_views.sql` -> `sql/materialized_views/mv_curve_rank_views.sql`
3. `event_summary_cache_mv.sql` -> `sql/materialized_views/event_summary_cache_mv.sql`
4. `club_members_cache_mv.sql` -> `sql/materialized_views/club_members_cache_mv.sql`
5. `newSQL.sql` -> `sql/pipeline_sections/newSQL.sql`
6. `SQL.sql` -> `sql/pipeline_sections/SQL.sql`

Validation completed after move:

- Python compile checks passed for `database.py`, `backendAPI.py`, `analytics.py`, and `newAnalytics.py`
- `resolve_sql_path(...)` now resolves both bare filenames and canonical `sql/...` paths to the moved files
- Section-loading smoke checks still succeed for `get_eventpositions` in `newSQL.sql` and `final_AgeCalculation` in `SQL.sql`

## Exact Hold List

Leave these root-level files in place until an active caller is proven:

1. `mv_fast_adjusted_queries.sql`
2. `event_summary_perf.sql`
3. `eventposition_view.sql`