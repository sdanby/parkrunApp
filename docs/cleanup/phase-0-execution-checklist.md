# Phase 0 Execution Checklist

This is the short execution checklist derived from the `Next verification` column in the Phase 0 status sheet.

## Highest-priority checks

1. Compare `python_sql_calls_repo/app.py`, `backendAPI.py`, root `app.py`, and `python_sql_calls_repo/App_render.py` to list unique routes and decide the canonical backend boundary.
2. Read `push-render.bat`, `push-render-lists-api.bat`, `scripts/push_app_to_render.ps1`, `scripts/push_lists_api_to_render.ps1`, and `start_all.ps1` together and record every hardcoded backend path.
3. Confirm whether any setup or deployment notes still point at the empty root `requirements.txt` instead of `python_sql_calls_repo/requirements.txt`.

## Backend and launcher checks

4. Decide whether `__run_backend_api_direct.py` should remain as a local wrapper or be retired after backend consolidation.
5. Decide whether `__wsgi_probe.py` should remain as a diagnostics wrapper or be retired after backend consolidation.
6. Confirm whether root `app.py` still has any unique routes or launch role not covered elsewhere.
7. Confirm whether `backendAPI.py` should remain a separate admin/workflow runtime or be split and reduced later.
8. Confirm route parity between the active frontend API calls and `python_sql_calls_repo/app.py`.

## Data pipeline checks

9. Map direct callers and imports for `process.py`, `scraper.py`, `Athlete_runs.py`, `database.py`, `analytics.py`, `curved_ranks.py`, `rebuildAthletes.py`, `run_age.py`, `reprocess_events.py`, `run_rebuild_batch.py`, `run_event_volunteers.py`, `update_athelete_postgres.py`, `volunteerUpdate.py`, `volunteers.py`, `clearAgeErrors.py`, and `corrected_athletes_eventpositions.py`.
10. Inspect `backendTest.py`, `testDB.py`, `test_driver.py`, `test_run_update.py`, and `test_stage2_accumulation.py` to classify each one as stable test, diagnostic, or archive candidate.

## SQL checks

11. Confirm runtime callers for `Materialize.sql`, `mv_curve_rank_views.sql`, `mv_fast_adjusted_queries.sql`, `event_summary_cache_mv.sql`, `club_members_cache_mv.sql`, `event_summary_perf.sql`, `eventposition_view.sql`, `newSQL.sql`, and `SQL.sql`.
12. Treat `adjustments.sql`, `age_base times.sql`, `age_grading.sql`, `athlete_build_test.sql`, `athlete_rebuild.sql`, `bad_athletes.sql`, `consitent_performers.sql`, `local_stars.sql`, `new_coeff.sql`, `new_eligible.sql`, `old_coeff.sql`, `old_eligible.sql`, `Process for eventpositions.sql`, `recent.sql`, `regulars.sql`, and `tourist_count.sql` as likely one-off/manual until a live caller is found.

## Frontend compatibility checks

13. Confirm whether any docs, bookmarks, or inbound links still depend on `Results.tsx`, `Races.tsx`, or `Courses.tsx`.
14. Keep `parkrun-react-app/README.md` in place until the frontend folder rename is actually scheduled.

## Path-sensitive artifact checks

15. Audit all code that references `parkrun.db`, `curve_progress/`, `instance/`, `athlete_runs_progress.json`, `parkrun-react-app/build/`, `process_data.c`, and the compiled `.pyd` files before any move is attempted.
16. Change `volunteers.py` and `consistency.py` output paths before moving their current root-level output files.

## Exit criteria for Phase 0

17. You can leave Phase 0 once the canonical backend is named, active runtime SQL is separated from manual SQL, legacy frontend routes are classified, and every path-sensitive Phase 3 move has an identified code owner.