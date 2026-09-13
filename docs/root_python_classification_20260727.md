# Repo Root Python Classification

Snapshot date: 2026-07-27

This inventory groups current repo-root Python files by ownership after the
`etl/`, `maintenance/`, and `tools/` package moves, so the next restructure
slices can keep operating package-by-package instead of falling back to
individual file moves.

## Runtime

- `app.py`: compatibility entrypoint for `backendAPI.app`
- `backendAPI.py`: maintained local/admin backend runtime
- `parkrunAPI.py`: Flask blueprint consumed by `backendAPI.py`
- `Lists_api.py`: compatibility shim for `python_sql_calls_repo.lists_api`
- `__run_backend_api_direct.py`: compatibility runner for `scripts.run_backend_api_direct`
- `__wsgi_probe.py`: compatibility runner for `scripts.wsgi_probe`

## Package-Owned Wrappers

- `analytics.py`: compatibility shim for `etl.analytics`
- `newAnalytics.py`: compatibility shim for `etl.newAnalytics`
- `curved_ranks.py`: compatibility shim for `etl.curved_ranks`
- `newSQL.py`: compatibility shim for `etl.newSQL`
- `consistency.py`: compatibility shim for `etl.consistency`
- `run_age.py`: compatibility shim for `etl.run_age`
- `postgres_compatible_get_last_positions.py`: compatibility shim for `etl.postgres_compatible_get_last_positions`
- `updated_get_last_positions.py`: compatibility shim for `etl.updated_get_last_positions`
- `updated_api_code.py`: compatibility shim for `etl.updated_api_code`
- `Athlete_runs.py`: compatibility shim for `scripts.athlete_runs_etl`
- `database.py`: compatibility shim for `scripts.database_helpers`
- `process.py`: compatibility shim for `scripts.parkrun_process`
- `rebuildAthletes.py`: compatibility runner for `scripts.rebuild_athletes`
- `reprocess_events.py`: compatibility runner for `scripts.reprocess_events`
- `scraper.py`: compatibility shim for `scripts.scraper_tools`
- `clearAgeErrors.py`: compatibility shim for `maintenance.clear_age_errors`
- `corrected_athletes_eventpositions.py`: compatibility shim for `maintenance.corrected_athletes_eventpositions`
- `volunteerUpdate.py`: compatibility shim for `maintenance.volunteer_update`
- `update_athelete_postgres.py`: compatibility shim for `maintenance.update_athlete_postgres`
- `backendTest.py`: compatibility runner for `tools.backend_test`
- `testDB.py`: compatibility runner for `tools.test_db`
- `test_driver.py`: compatibility runner for `tools.test_driver`
- `_inspect_mvs.py`: compatibility runner for `tools.inspect_mvs`

## Remaining Active ETL And Pipeline Roots

- `run_event_volunteers.py`: one-off runner over canonical athlete-runs ETL
- `run_rebuild_batch.py`: compatibility runner for a one-off maintenance rebuild batch

## One-Off Maintenance Or Diagnostics

- `highLevel.py`: ad hoc analysis/helper script
- `photos.py`: standalone utility script
- `evernote.py`: standalone utility script
- `volunteers.py`: volunteer-oriented standalone script
- `run_rebuild_batch.py`: one-off historic rebuild/data-fix runner

## Tests

- `test_run_update.py`: runnable regression script
- `test_stage2_accumulation.py`: runnable regression script

## Legacy Or Transitional

- `analytics_old.py`: superseded analytics variant
- `setup.py`: build/extension support for native processing components

## Canonical Package Owners

1. `etl/`: owns `analytics`, `newAnalytics`, `curved_ranks`, `newSQL`, `consistency`, `run_age`, and the remaining last-position/API ETL support snippets.
2. `maintenance/`: owns the age-correction, corrected-eventpositions, volunteer-reconciliation, athlete-postgres repair scripts, and one-off rebuild/data-fix runners.
3. `tools/`: owns the remaining manual harnesses and probes.
4. `scripts/`: owns shared ETL/runtime helpers and thin operational entrypoints.

## Next Package-Based Moves

1. Decide whether `highLevel.py`, `photos.py`, `evernote.py`, and `volunteers.py` belong in `maintenance/`, `tools/`, or an archive bucket.
2. Audit archive and legacy modules that still import the root wrapper names so future cleanup can distinguish intentional compatibility surfaces from dead compatibility code.