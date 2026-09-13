# Phase 0 Status Sheet

This is a pre-filled working view of the Phase 0 checklist using current repo evidence and the best available local guesses.

Status labels:

- `likely active` - current evidence suggests the file or path is still in use
- `likely keep but refactor later` - still needed, but probably should move or be wrapped later
- `likely compatibility only` - appears kept mainly to preserve old links or old flows
- `likely redundant` - appears superseded, but should still be verified before archiving
- `unknown` - not enough direct evidence yet

## A. Backend ownership and entrypoints

| Item | Current best guess | Evidence | Next verification |
| --- | --- | --- | --- |
| `python_sql_calls_repo/app.py` canonical backend for product routes | `likely active` | Prior backend review and repo notes already treat this as the strongest canonical API candidate | Compare live route coverage against frontend API calls |
| `python_sql_calls_repo/App_render.py` unique runtime logic versus wrapper | `retired to compatibility wrapper` | File hash matched `python_sql_calls_repo/app.py`, the former full implementation was archived, and `scripts/push_app_to_render.ps1` now sources canonical `python_sql_calls_repo/app.py` directly | Leave wrapper in place for one validation cycle, then decide whether the filename can be removed entirely |
| `backendAPI.py` still needed as separate local/admin workflow backend | `active local operations backend` | `.vscode/launch.json`, `start_all.ps1`, `__run_backend_api_direct.py`, and `__wsgi_probe.py` all point at `backendAPI.py`; it now also owns `/api/clubs/members` in addition to weekly-upload and curve-reference admin routes | Keep as the maintained local runtime while product and deploy backends stay separate |
| repo-root `app.py` still has a distinct role | `retired to compatibility wrapper` | No active launcher reference surfaced, route comparison found no root-only endpoints, and `/api/clubs/members` was migrated into `backendAPI.py` | Leave wrapper in place for one validation cycle, then decide whether it can be removed entirely |
| `python_sql_calls_repo/lists_api.py` is the active lists blueprint | `likely active` | `scripts/push_lists_api_to_render.ps1` sources `python_sql_calls_repo/lists_api.py`, and both `python_sql_calls_repo/app.py` and `App_render.py` import `lists_api` | Confirm route parity against frontend calls |
| root `Lists_api.py` has remaining callers | `likely redundant` | No live imports of `Lists_api` surfaced; active backends import lowercase `lists_api` from the canonical backend area | Keep until archive phase, but treat as a redundancy candidate |
| root `requirements.txt` still used | `likely redundant` | The root file is empty | Confirm no setup docs still point at it |
| `python_sql_calls_repo/requirements.txt` is real backend dependency source | `likely active` | It contains the actual Flask, SQLAlchemy, Postgres, and auth dependencies | Confirm deployment and local install instructions |
| `__run_backend_api_direct.py` still used | `likely active local helper` | It imports `backendAPI` and runs `backendAPI.app` directly on port 5000 | Decide whether to keep as wrapper or retire after backend consolidation |
| `__wsgi_probe.py` still used | `likely active local helper` | It imports `backendAPI.app` and serves it via `wsgiref` on port 5050 | Decide whether to keep as diagnostics wrapper or retire later |
| `start_all.ps1` assumes current backend locations | `likely active` | Script launches `python backendAPI.py` | Review all paths in `start_all.ps1` before any backend move |
| `push-render.bat` assumes a specific backend source file | `likely active wrapper` | It delegates to `scripts\push_app_to_render.ps1`, which now targets canonical `python_sql_calls_repo\app.py` | Keep in sync if the canonical backend path changes again |
| `push-render-lists-api.bat` assumes a specific lists API file | `likely active wrapper` | It delegates to `scripts\push_lists_api_to_render.ps1`, which targets `python_sql_calls_repo\lists_api.py` | Update wrapper only after canonical lists path changes |

## B. Data pipeline and operations files

| Item | Current best guess | Evidence | Next verification |
| --- | --- | --- | --- |
| `process.py` scrape-and-ingest workflow | `likely active` | Existing reorganisation notes classify it as core ingestion | Confirm direct callers and import graph |
| `scraper.py` event scraping | `likely active` | Existing reorganisation notes classify it as scraping primitive | Confirm direct callers |
| `Athlete_runs.py` athlete and volunteer scraping | `likely active` | `run_event_volunteers.py` was previously identified as backed by this module; file also owns `athlete_runs_progress.json` | Confirm imports and volunteer flow entrypoints |
| `database.py` SQLite/Postgres sync and persistence | `likely active` | Existing notes and SQL helpers indicate it is a shared support module | Confirm major importers |
| `analytics.py` rebuild and transformation workflows | `likely active` | File references `SQL.sql` directly and is part of rebuild notes | Confirm runtime entrypoints |
| `curved_ranks.py` rank generation and sync | `likely active` | File references `curve_progress` directly and repo notes mention active batching changes | Confirm entrypoints |
| `rebuildAthletes.py` athlete rebuild jobs | `likely active` | Inline usage notes remain in file comments | Confirm whether it is operator-run versus imported |
| `run_age.py` age rebuild logic | `likely active` | Existing planning notes treat it as part of transforms | Confirm callers |
| `reprocess_events.py` batch repair/rebuild operations | `likely active` | Existing planning notes treat it as an operator tool | Confirm callers |
| `run_rebuild_batch.py` one-off rebuild/data fix | `reclassified to maintenance` | Hardcoded date/event list, no live callers found, now owned by `maintenance.run_rebuild_batch` with a root compatibility runner | Closed |
| `run_event_volunteers.py` one-event volunteer scraping | `likely active` | Repo memory explicitly calls out this command as available | Confirm any hardcoded relative paths |
| `update_athelete_postgres.py` Postgres sync | `likely active` | Existing planning notes place it in sync-related work | Confirm callers |
| `volunteerUpdate.py` volunteer refresh | `likely active` | Existing planning notes classify it as an operational refresh task | Confirm callers |
| `volunteers.py` volunteer processing/export logic | `likely active` | It now writes exports into `data_samples/csv/volunteers.csv` instead of the repo root | Confirm whether any manual workflow still expects the old root-level file |
| `clearAgeErrors.py` data repair | `likely active` | File contains direct CLI usage examples | Confirm whether it is still part of normal maintenance |
| `consistency.py` validation | `likely active` | It now exposes a default spreadsheet export path under `data_samples/spreadsheets/parkrun_events.xlsx` | Confirm whether any manual workflow still expects the old root-level file |
| `corrected_athletes_eventpositions.py` active maintenance flow | `unknown` | File exists but no caller surfaced in this pass | Search for imports and recent operational usage |
| `backendTest.py` still useful | `unknown` | Looks like a diagnostic/test file, but no direct evidence yet | Inspect contents and usage |
| `testDB.py` still useful | `unknown` | Looks like a diagnostic/test file, but no direct evidence yet | Inspect contents and usage |
| `test_driver.py` still useful | `unknown` | Looks like a diagnostic/test file, but no direct evidence yet | Inspect contents and usage |
| `test_run_update.py` still useful | `unknown` | Looks like a diagnostic/test file, but no direct evidence yet | Inspect contents and usage |
| `test_stage2_accumulation.py` still useful | `likely path-sensitive diagnostic` | File references an absolute SQLite path outside the repo | Inspect before treating it as a stable test |

## C. SQL ownership and runtime references

| Item | Current best guess | Evidence | Next verification |
| --- | --- | --- | --- |
| `Materialize.sql` master MV build definition | `likely active` | Referenced by `scripts/rebuild_all_materialized_views.sql` and `newAnalytics.py` for base/support MV rebuilds | Confirm whether any other rebuild wrapper shells in additional files |
| `mv_curve_rank_views.sql` current curve-rank rebuild asset | `likely active` | `scripts/recreate_curve_views.sql` explicitly references it | Confirm full rebuild chain |
| `mv_fast_adjusted_queries.sql` current API/rebuild asset | `likely active` | Planning notes classify it as performance SQL for active lookups | Search runtime references more narrowly |
| `event_summary_cache_mv.sql` supported runtime build path | `likely active` | `scripts/rebuild_all_materialized_views.sql` includes it | Confirm API dependencies |
| `club_members_cache_mv.sql` supported runtime build path | `likely active` | `scripts/rebuild_all_materialized_views.sql` includes it | Confirm API dependencies |
| `event_summary_perf.sql` supported runtime build path | `likely active` | Planning notes classify it as supporting performance SQL | Search callers explicitly |
| `eventposition_view.sql` referenced by active code or jobs | `likely active` | Planning notes classify it as reusable runtime SQL | Search callers explicitly |
| `newSQL.sql` active staged rebuild asset | `likely active` | Referenced by `app.py`, `backendAPI.py`, `database.py`, and `newAnalytics.py` for staged temp/update/insert workflows | Keep in place until SQL reclassification phase |
| `SQL.sql` still referenced | `likely active legacy-core SQL` | Referenced several times in `analytics.py` and in `database.py` defaults for section-based transform assembly | Keep in place until callers are migrated |
| `adjustments.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `age_base times.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `age_grading.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `athlete_build_test.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `athlete_rebuild.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `bad_athletes.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `consitent_performers.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `local_stars.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `new_coeff.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `new_eligible.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `old_coeff.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `old_eligible.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `Process for eventpositions.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `recent.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `regulars.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |
| `tourist_count.sql` callers | `likely one-off/manual` | No live callers surfaced outside documentation | Leave out of runtime moves until proven otherwise |

## D. Frontend route and compatibility checks

| Item | Current best guess | Evidence | Next verification |
| --- | --- | --- | --- |
| `EventAnalysisTest.tsx`, `EventTest.tsx`, and `CourseTest.tsx` are the primary active pages | `likely active` | `App.tsx` comment explicitly says these are preferred active pages | None beyond normal route smoke test |
| `Results.tsx` still needed as compatibility route | `likely compatibility only` | `App.tsx` keeps legacy route support and redirects `/results` to `/results_test` | Check inbound links and docs |
| `Races.tsx` still needed as compatibility route | `likely compatibility only` | `App.tsx` uses `EventTest` for `/races` and keeps `Races` as `event_old` | Check inbound links and docs |
| `Courses.tsx` still needed as compatibility route | `likely compatibility only` | `App.tsx` routes `/courses` to `Courses` and `/courses_test` to `CourseTest` | Check inbound links and docs |
| Deployment/docs/saved links still point at legacy pages | `likely yes` | The app deliberately preserves legacy routes | Search docs and shared links if available |
| `parkrun-react-app/README.md` should stay beside the app for now | `likely active` | It is app-local setup documentation and folder rename has not happened yet | Keep until frontend rename phase |

## E. Working state, generated assets, and path assumptions

| Item | Current best guess | Evidence | Next verification |
| --- | --- | --- | --- |
| root `parkrun.db` is referenced by literal paths | `likely yes` | `database.py` and `test_stage2_accumulation.py` reference absolute SQLite paths; app backends also default to a SQLite path | Audit every DB opener before moving |
| root `curve_progress/` is referenced by literal paths | `likely yes` | `app.py`, `backendAPI.py`, and `curved_ranks.py` construct paths relative to current file locations | Update code before moving |
| root `instance/` is referenced by literal paths | `unknown` | Folder exists but no direct reference surfaced in this pass | Search explicit callers |
| root `athlete_runs_progress.json` is referenced by literal paths | `likely yes` | `Athlete_runs.py` uses `Path("athlete_runs_progress.json")` | Update code before moving |
| root `build/` is safe to move | `unknown` | Root build folder exists but its producer/consumer was not identified in this pass | Inspect contents and references first |
| `parkrun-react-app/build/` is used directly by deployment or local serving | `likely yes` | Standard CRA output path; build currently succeeds there | Inspect deployment/serve steps before moving |
| `process_data.c` is safe to move | `likely build artifact but verify import chain` | It is a generated C file from the Cython source | Confirm no tool expects it in root |
| `process_data.cp312-win_amd64.pyd` is safe to move | `likely path-sensitive build artifact` | Compiled extension names suggest import-time expectations may exist | Search imports before moving |
| `process_data.cp39-win_amd64.pyd` is safe to move | `likely path-sensitive build artifact` | Compiled extension names suggest import-time expectations may exist | Search imports before moving |
| root `__pycache__/` should be moved | `likely no` | It is a generated cache directory | Remove from version control or ignore rather than formalize |

## Short conclusions from the current pass

1. Backend duplication remains the main structural risk: `backendAPI.py` is clearly still part of local operations, while `python_sql_calls_repo/app.py` still looks like the best canonical product backend.
2. The low-risk move set now includes documentation plus sample data, and the two previously path-sensitive export scripts now default into `data_samples/` locations instead of the repo root.
3. `curve_progress/`, `athlete_runs_progress.json`, `parkrun.db`, `parkrun-react-app/build/`, and compiled extension outputs are not low-risk moves yet.
4. Several backend unknowns are now resolved enough for planning: the root batch files are just wrappers, the local helper launchers both target `backendAPI`, and the root `requirements.txt` appears redundant because it is empty.
5. The exploratory SQL files currently look like manual/reference assets rather than runtime dependencies because no live callers surfaced outside docs.
6. The backend comparison now points to a split role: `python_sql_calls_repo/app.py` is the canonical product backend, `App_render.py` is now only a compatibility wrapper, `backendAPI.py` is the maintained local operations backend, and repo-root `app.py` is only a compatibility wrapper.
7. The next backend overlap reduction has started: identical email register/login logic now lives in `python_sql_calls_repo/shared_auth_handlers.py` and is reused by both `backendAPI.py` and `python_sql_calls_repo/app.py`.
8. Shared handlers now also cover auth logout/me/link-athlete, auth/config, password-reset request/validate/confirm, and feedback list/create/update; `event_highlights` still needs payload alignment before it can become a shared route.
