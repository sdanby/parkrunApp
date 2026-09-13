# Proposed Repo Structure

This document is a planning view only. It does not mean files should be moved yet.

## Goals

- Separate active product code from experiments, archives, and generated artifacts.
- Make the canonical backend obvious.
- Group rebuild scripts and SQL definitions by purpose.
- Reduce the number of root-level files.
- Make cleanup safer by labeling files as `keep`, `review`, or `archive` before deleting anything.

## Proposed Top-Level Layout

```text
parkrun_project/
|-- frontend/                  # React user-facing application
|   |-- src/                   # TypeScript source for pages, components, API clients, and UI logic
|   |-- public/                # Static assets, icons, help text, and public images
|   |-- package.json           # Frontend dependencies and npm scripts
|   |-- tsconfig.json          # TypeScript compiler settings for the frontend
|   `-- README.md              # Frontend-specific setup and developer notes
|
|-- backend/                   # Canonical Flask/Postgres API
|   |-- app/                   # Main backend package
|   |   |-- __init__.py        # App factory and shared backend bootstrapping
|   |   |-- routes/            # HTTP endpoints grouped by feature area
|   |   |-- services/          # Domain and query logic behind the routes
|   |   |-- auth/              # Login, sessions, password reset, and user profile logic
|   |   |-- admin/             # Admin-only workflows and control endpoints
|   |   |-- lists/             # Lists and ranking API modules
|   |   `-- models/            # SQLAlchemy models and data-access structures
|   |-- wsgi/                  # Thin runtime entrypoints for local and deployed hosting
|   |   |-- app_local.py       # Local backend launcher/wrapper
|   |   `-- app_render.py      # Render deployment launcher/wrapper
|   |-- requirements.txt       # Python dependency pinning for the backend runtime
|   `-- README.md              # Backend structure, setup, and deployment notes
|
|-- data_pipeline/             # Scraping, rebuild, and sync workflows
|   |-- scraping/              # Event/result collection from parkrun pages
|   |-- transforms/            # Data enrichment and metric calculations
|   |-- sync/                  # SQLite/Postgres copy and reconciliation steps
|   |-- curve_rank/            # Curve-rank generation and related rebuild logic
|   `-- validation/            # Data quality and consistency checks
|
|-- sql/                       # SQL assets split by reuse level
|   |-- materialized_views/    # Postgres MV definitions and performance objects
|   |-- pipeline_sections/     # Structured SQL used by rebuild workflows
|   |-- analytics_queries/     # Reusable analysis and reporting queries
|   |-- one_off_reviews/       # Investigations worth keeping but not runtime-critical
|   `-- scratch/               # Temporary or exploratory SQL
|
|-- scripts/                   # Operator-facing helper scripts
|   |-- deploy/                # Push or publish scripts for hosted environments
|   |-- rebuild/               # MV rebuild and reference-refresh helpers
|   |-- operations/            # Batch jobs and operational tooling
|   `-- verification/          # Validation scripts for data and MV correctness
|
|-- docs/                      # Human-readable project documentation
|   |-- architecture/          # System structure and dependency explanations
|   |-- runbooks/              # Repeatable operational procedures
|   |-- cleanup/               # Repo tidy-up plans and archive decisions
|   `-- product/               # Product-level notes, feature descriptions, and UX docs
|
|-- archive/                   # Retained legacy files moved out of the active path
|   |-- old_frontend/          # Retired React pages/components kept for reference
|   |-- old_backend/           # Superseded Flask or API copies
|   |-- old_sql/               # Old SQL drafts and previous query approaches
|   |-- old_scripts/           # No-longer-active operational helpers
|   `-- snapshots/             # Point-in-time backups and transitional copies
|
|-- tests/                     # Automated validation grouped by scope
|   |-- backend/               # API and backend unit/integration tests
|   |-- pipeline/              # Rebuild and transformation tests
|   `-- integration/           # Cross-layer end-to-end checks
|
|-- data_samples/              # Working sample data kept outside source folders
|   |-- csv/                   # CSV extracts for review and debugging
|   `-- spreadsheets/          # XLSX/XLSM workbooks used for analysis or manual checks
|
|-- build_artifacts/           # Generated outputs that are not hand-maintained source
|   |-- frontend_build/        # React production build output
|   `-- compiled_extensions/   # Generated C/Cython binaries and compiled modules
|
`-- workspace/                 # Local runtime state and machine-specific working files
    |-- curve_progress/        # Persisted curve rebuild state and history files
    |-- instance/              # Flask/runtime instance data
    `-- local_db/              # Local SQLite database storage
```

## Proposed Mapping From Current Repo

### 1. Frontend

Keep as active product code, but rename the container folder for clarity.

Current:

- `parkrun-react-app/` - current React app containing the active UI, static assets, and frontend build setup

Proposed:

- `frontend/` - clearer product-facing name for the active React application

Keep active inside `frontend/src`:

- `pages/` - page-level screens such as Event, Course, Lists, Clubs, and Admin
- `components/` - reusable UI building blocks shared across pages
- `api/` - frontend HTTP clients and API type definitions
- `config/` - layout JSON, tile definitions, and other UI configuration
- `utils/` - navigation, hooks, and small shared frontend helpers
- `styles/` - app-wide styling and CSS support files

Review inside frontend:

- `pages/Results.tsx` - older event-analysis page kept as a compatibility route
- `pages/Races.tsx` - older event page implementation likely superseded by `EventTest.tsx`
- `pages/Courses.tsx` - older course page implementation likely superseded by `CourseTest.tsx`

Reason:
These appear to be legacy UI routes kept for compatibility, while `EventAnalysisTest.tsx`, `EventTest.tsx`, and `CourseTest.tsx` are the active pages.

### 2. Backend

Use one canonical backend codebase, and make all deployment or local entrypoints thin wrappers around it.

Current active candidates:

- `python_sql_calls_repo/app.py` - strongest candidate for the canonical Flask API with core product routes
- `python_sql_calls_repo/App_render.py` - mirrored deployment-oriented backend copy for Render hosting
- `backendAPI.py` - local workflow backend that mixes admin jobs, scraping control, and overlapping API routes
- `app.py` - additional root backend entrypoint that appears to duplicate part of the API surface

Proposed structure:

```text
backend/
|-- app/                   # Canonical backend package
|   |-- routes/            # Feature-grouped HTTP endpoints
|   |-- services/          # Shared business/query logic used by routes
|   |-- auth/              # Authentication and session logic
|   |-- admin/             # Admin-only features and control flows
|   |-- lists/             # Ranking/list-specific backend modules
|   `-- models/            # Database models and schema objects
`-- wsgi/
    |-- app_local.py       # Local launcher with minimal boot code
    `-- app_render.py      # Hosted launcher with minimal boot code
```

Suggested canonical source:

- `python_sql_calls_repo/app.py` - main backend route surface and API composition root
- `python_sql_calls_repo/lists_api.py` - canonical lists blueprint plus shared adjustment SQL helpers

Suggested treatment of the others:

- `python_sql_calls_repo/App_render.py`: keep temporarily as a deploy wrapper or mirror while removing duplicated logic
- `backendAPI.py`: review and split into true admin/workflow orchestration versus duplicated product API routes
- `app.py`: review whether it still has a unique runtime role once backend logic is consolidated

### 3. Data Pipeline Python

These files are part of ingestion, rebuild, or sync workflows and should sit together rather than at repo root.

Current:

- `process.py` - event scraping orchestration and result ingestion workflow
- `scraper.py` - Selenium/browser helpers used to collect parkrun event data
- `database.py` - SQLite/Postgres connection and upsert/sync helper layer
- `analytics.py` - transformation and rebuild support for coefficients, SQL sections, and event metrics
- `Athlete_runs.py` - athlete and volunteer run-history scraping logic
- `curved_ranks.py` - curve-rank generation and history synchronization logic
- `rebuildAthletes.py` - athlete rebuild runner for consolidated athlete state
- `reprocess_events.py` - batch reprocessing utility for event data rebuilds
- `run_age.py` - age-related rebuild/update workflow
- `run_rebuild_batch.py` - scripted batch execution for rebuild tasks
- `run_event_volunteers.py` - single-event volunteer scraping runner
- `update_athelete_postgres.py` - Postgres update/copy helper for athlete records
- `clearAgeErrors.py` - cleanup helper for age-data anomalies
- `volunteerUpdate.py` - volunteer refresh/update script
- `volunteers.py` - volunteer-focused processing or export helper module

Proposed:

```text
data_pipeline/
|-- scraping/
|   |-- scraper.py                 # Browser scraping primitives and page parsers
|   |-- process.py                 # Main scrape-and-ingest coordinator
|   `-- Athlete_runs.py            # Athlete/volunteer history scraping helpers
|-- transforms/
|   |-- analytics.py               # Metric calculations and SQL-driven data transforms
|   |-- curved_ranks.py            # Curve-ranking generation and propagation
|   `-- run_age.py                 # Age-related transformation runner
|-- sync/
|   |-- database.py                # DB connection, upsert, and sync helpers
|   |-- update_athelete_postgres.py # Athlete sync step into Postgres
|   `-- rebuildAthletes.py         # Athlete record rebuild workflow
|-- operations/
|   |-- reprocess_events.py        # Event rerun/rebuild operator tool
|   |-- run_rebuild_batch.py       # Batch driver for rebuild jobs
|   |-- run_event_volunteers.py    # Volunteer-only event load runner
|   |-- volunteerUpdate.py         # Volunteer refresh task
|   `-- clearAgeErrors.py          # Data repair script for age inconsistencies
`-- validation/
    `-- consistency.py             # SQLite versus Postgres consistency checker
```

### 4. SQL Assets

These are currently mixed between reusable production SQL and one-off analytical scratch work.

#### 4a. Production or reusable SQL definitions

Move to `sql/materialized_views/` or `sql/pipeline_sections/`:

- `Materialize.sql` - master definition file for core materialized views such as `mv_extend_runs`
- `mv_curve_rank_views.sql` - materialized views for curve-based ranking outputs used by lists and profiles
- `mv_fast_adjusted_queries.sql` - performance-oriented MV/query setup for adjusted-time lookups
- `event_summary_cache_mv.sql` - cache MV for fast event-summary and Top250 style endpoints
- `club_members_cache_mv.sql` - cache MV for club-members and club-performance views
- `event_summary_perf.sql` - supporting performance objects for event summary queries
- `eventposition_view.sql` - reusable SQL views over event positions and event headers
- `newSQL.sql` - structured staged SQL library for rebuild sections and temp-table workflows
- `SQL.sql` - earlier structured SQL section library still used as reference or helper source

#### 4b. One-off or review SQL

Move to `sql/one_off_reviews/` or `sql/scratch/`:

- `adjustments.sql` - ad hoc exploration of time-adjustment formulas and outputs
- `age_base times.sql` - analysis of average age and age-based participant category measures
- `age_grading.sql` - investigations into age-grade interpretation and age-category mapping
- `athlete_build_test.sql` - manual SQL for testing athlete-build logic
- `athlete_rebuild.sql` - scratch SQL for rebuilding athlete DOB and age fields
- `bad_athletes.sql` - diagnostic queries for broken athlete records
- `consitent_performers.sql` - one-off query for identifying consistent performers
- `local_stars.sql` - one-off query for highly local repeat participants
- `new_coeff.sql` - experimental coefficient-calculation approach
- `new_eligible.sql` - experimental eligible-run calculation flow
- `old_coeff.sql` - previous coefficient approach retained for comparison
- `old_eligible.sql` - previous eligible-run approach retained for comparison
- `Process for eventpositions.sql` - manual walk-through of eventposition processing logic
- `recent.sql` - mixed scratch analysis around recent events and schema tweaks
- `regulars.sql` - one-off query for regular participant counts
- `tourist_count.sql` - one-off query for tourist participation counts

Reason:
Some of these are effectively notebooks in SQL form. They are useful, but they should not sit beside active runtime files unless they are part of the official rebuild path.

### 5. Scripts

Current `scripts/` is already a good start. It just needs clearer internal grouping.

Current:

- `batch_process_events.py` - sequential event-processing driver for remote/local runs
- `build_curve_rank_range_summary.py` - builder for rank-range summary tables derived from mapping history
- `copy_athletes.py` - athlete table copy/upsert utility from SQLite into Postgres
- `push_app_to_render.ps1` - deployment helper for pushing backend app changes to Render-linked repo
- `push_lists_api_to_render.ps1` - deployment helper for publishing `lists_api.py`
- `refresh_mvs_verify.py` - MV refresh and spot-check verification script
- `rebuild_all_materialized_views.sql` - SQL batch to rebuild the full MV stack
- `rebuild_extend_runs_dependents.sql` - SQL rebuild for views depending on `mv_extend_runs`
- `rebuild_extend_runs_support.sql` - SQL support objects required by extend-runs rebuilds
- `recreate_curve_views.sql` - SQL for recreating curve-rank view definitions

Proposed:

```text
scripts/
|-- deploy/
|   |-- push_app_to_render.ps1          # Push backend app changes to the deployment repo
|   `-- push_lists_api_to_render.ps1    # Push canonical lists API changes to the deployment repo
|-- rebuild/
|   |-- build_curve_rank_range_summary.py # Rebuild curve rank summary reference tables
|   |-- rebuild_all_materialized_views.sql # Full MV rebuild batch
|   |-- rebuild_extend_runs_dependents.sql # Rebuild extend-runs dependent objects
|   |-- rebuild_extend_runs_support.sql    # Rebuild extend-runs support objects
|   `-- recreate_curve_views.sql           # Recreate curve-view definitions
|-- operations/
|   |-- batch_process_events.py          # Run multiple event-processing jobs in sequence
|   `-- copy_athletes.py                 # Copy athlete rows into Postgres with upsert behavior
`-- verification/
    `-- refresh_mvs_verify.py            # Refresh MVs and verify key rows/payloads
```

### 6. Documentation

Current markdown is sparse and split.

Current:

- `NEWANALYTICS_RUNBOOK.md` - runbook for analytics or rebuild workflows around the newer pipeline
- `python_sql_calls_repo/README.md` - backend repo notes for the canonical SQL/API codebase
- `parkrun-react-app/README.md` - frontend setup and build notes for the React app

Proposed:

```text
docs/
|-- architecture/
|   |-- repo-overview.md        # High-level map of the whole software suite
|   |-- backend-structure.md    # Canonical backend layout and dependency flow
|   `-- data-pipeline.md        # Ingestion, rebuild, and sync architecture notes
|-- runbooks/
|   |-- analytics-runbook.md    # Repeatable steps for analytics and rebuild tasks
|   |-- deploy-runbook.md       # Release and deployment procedure notes
|   `-- weekly-update-runbook.md # Weekly refresh process for new parkrun data
`-- cleanup/
    |-- proposed-repo-structure.md # This planning document for target repo structure
    `-- archive-decisions.md       # Log of what was archived and why
```

This file would eventually move to:

- `docs/cleanup/proposed-repo-structure.md` - permanent home for the reviewed cleanup proposal

### 7. Archive and Legacy

Move obviously retired or superseded items out of the root path.

Candidates:

- `Archive/` - existing legacy folder already holding retired or superseded files
- `analytics_old.py` - previous analytics module version kept for fallback/reference
- `Lists_api.py` - older root copy of lists API likely superseded by the canonical backend copy
- `newAnalytics.py` - experimental or transitional analytics rewrite
- `newSQL.py` - Python helper or experiment associated with newer SQL workflows
- `updated_api_code.py` - staging copy of API changes rather than a canonical module
- `updated_get_last_positions.py` - transitional patch file for last-position logic
- `postgres_compatible_get_last_positions.py` - compatibility experiment for Postgres-specific last-position logic
- `highLevel.py` - likely high-level scratch orchestration or exploratory helper
- `evernote.py` - likely personal notes/export helper rather than product runtime code

Proposed archive target:

```text
archive/
|-- old_backend/   # Retired Flask/API modules kept for reference
|-- old_sql/       # Superseded SQL drafts and older query approaches
|-- old_scripts/   # Retired scripts not used in normal operations
`-- snapshots/     # Backup copies from transition points
```

These should be archived, not deleted, until you confirm they are no longer referenced.

### 8. Data Samples and Working Files

Current root contains many CSV/XLSX/XLSM files that look like working data rather than source code.

Current examples:

- `athletes.csv` - athlete export or working data snapshot
- `athletes1.csv` - alternate athlete snapshot or intermediate export
- `athletes2.csv` - alternate athlete snapshot or intermediate export
- `results.csv` - generic results export for analysis or troubleshooting
- `my_results.csv` - personal/local results export used during checks
- `analysis_eventpositions_1_2026-05-02_grouped.csv` - grouped analysis output for eventpositions review
- `analysis_eventpositions_4_2026-05-02_grouped.csv` - grouped analysis output for another eventpositions review
- `volunteers.csv` - volunteer export or analysis source file
- `parkrun_events.xlsm` - workbook with macros for event data review or manual tooling
- `parkrun_events.xlsx` - spreadsheet version of event data review material
- `volunteers.xlsm` - workbook with macros for volunteer review or processing

Proposed:

```text
data_samples/
|-- csv/            # Working CSV extracts kept outside source folders
`-- spreadsheets/   # XLSX/XLSM files used for manual review or analysis
```

### 9. Generated or Local-Only Artifacts

These should be separated from source if they must remain in the repo at all.

Current:

- `build/` - generated build output or compiled package artifacts at repo root
- `parkrun-react-app/build/` - generated React production build output
- `__pycache__/` - Python bytecode cache directories
- `process_data.c` - generated C file from Cython source
- `process_data.cp312-win_amd64.pyd` - compiled Python extension for CPython 3.12 on Windows
- `process_data.cp39-win_amd64.pyd` - compiled Python extension for CPython 3.9 on Windows
- `parkrun.db` - local SQLite database used for development or rebuild workflows
- `instance/` - local runtime instance data for Flask or related tooling
- `curve_progress/` - persisted progress files for curve rebuild jobs

Proposed:

```text
build_artifacts/
|-- frontend_build/        # Generated frontend bundles and static build output
`-- compiled_extensions/   # Generated Cython/C extension binaries

workspace/
|-- local_db/          # Local SQLite database and DB-side temp files
|-- instance/          # Flask instance/runtime state
`-- curve_progress/    # Persisted rebuild progress and state history
```

## Suggested Keep / Review / Archive Summary

### Keep Active

- `parkrun-react-app/` - active frontend product application
- `python_sql_calls_repo/app.py` - main candidate for canonical backend API
- `python_sql_calls_repo/lists_api.py` - canonical lists/ranking backend blueprint
- `database.py` - shared persistence and sync infrastructure
- `process.py` - core event ingestion workflow
- `scraper.py` - scraping primitives used by ingestion workflows
- `analytics.py` - key rebuild and transformation support module
- `curved_ranks.py` - key ranking-generation module
- `scripts/` - active operator tooling directory
- production SQL definition files - SQL assets needed to build live views and caches

### Review Carefully

- `backendAPI.py` - may still own useful local workflows but overlaps with canonical API logic
- `app.py` - likely duplicated backend entrypoint that needs role clarification
- `python_sql_calls_repo/App_render.py` - deploy copy that should ideally become a thin wrapper
- `Lists_api.py` - older lists API copy that may now be redundant
- `newSQL.py` - transitional helper whose current runtime role is unclear
- `newAnalytics.py` - experimental analytics file whose ownership is unclear
- legacy frontend pages - compatibility routes that may still receive inbound links
- operational one-off Python helpers - potentially useful, but not clearly part of the stable runtime

### Archive Likely

- `Archive/` - already designated legacy material
- `analytics_old.py` - superseded analytics implementation retained only for reference
- `updated_api_code.py` - patch-stage backend copy rather than a maintained module
- `updated_get_last_positions.py` - patch-stage helper for a specific API concern
- `postgres_compatible_get_last_positions.py` - compatibility experiment not obviously needed in the main runtime
- generated build outputs - reproducible artifacts that do not need to live beside source
- compiled extension outputs - machine/build-specific binaries
- scratch SQL files once classified - exploratory analysis assets moved out of the root path

## Low-Risk First Moves

These are the safest moves if you later decide to implement the restructure.

1. Create `docs/`, `archive/`, `data_samples/`, and `build_artifacts/`.
2. Move root markdown planning/runbook files into `docs/`.
3. Move clearly generated output into `build_artifacts/`.
4. Move CSV/XLS/XLSM working files into `data_samples/`.
5. Move archive/backups into `archive/` without changing code imports.

## High-Risk Moves

These need code changes and validation, not just file moves.

1. Consolidating `app.py`, `backendAPI.py`, and `python_sql_calls_repo/app.py`.
2. Renaming `parkrun-react-app/` to `frontend/`.
3. Splitting `analytics.py` and `database.py` into smaller modules.
4. Moving SQL files that are still referenced by automation.
5. Removing legacy frontend pages before all navigation paths are verified.

## Recommendation

Use this proposal as a review artifact first, then do the cleanup in phases:

1. Documentation and archive separation
2. Data/build artifact separation
3. SQL classification
4. Backend consolidation
5. Frontend legacy retirement

## Step-by-Step Reorganisation Plan

This is the safest practical order for carrying out the reorganisation with the least risk to runtime behavior.

### Phase 0 - Freeze the Current Shape

Goal:
Create a stable baseline before moving anything.

Steps:

1. Confirm which backend is currently serving each active frontend feature.
2. Confirm which root-level Python files are still executed directly by scripts, batch files, or deployment jobs.
3. Confirm which SQL files are referenced by automation versus used only for manual analysis.
4. Confirm whether any legacy frontend routes still receive real navigation or external links.
5. Capture a before-state checklist covering frontend build, main backend startup, admin flows, and weekly pipeline entrypoints.

Validation:

- Frontend build completes.
- Main backend boots cleanly.
- Admin page loads and edits users successfully.
- Weekly/manual operational scripts still run from their current paths.

Why first:

- If the current execution paths are not clear, later file moves will break silently.

### Phase 1 - Create the Destination Folders Without Moving Code

Goal:
Prepare the target structure while keeping all imports and runtime paths unchanged.

Steps:

1. Create `docs/`, `archive/`, `data_samples/`, `build_artifacts/`, and `workspace/`.
2. Inside `docs/`, create `architecture/`, `runbooks/`, `cleanup/`, and `product/`.
3. Inside `archive/`, create `old_frontend/`, `old_backend/`, `old_sql/`, `old_scripts/`, and `snapshots/`.
4. Inside `data_samples/`, create `csv/` and `spreadsheets/`.
5. Inside `build_artifacts/`, create `frontend_build/` and `compiled_extensions/`.
6. Inside `workspace/`, create `curve_progress/`, `instance/`, and `local_db/`.

Validation:

- No imports, scripts, or configs need to change in this phase.
- Existing commands should behave exactly as before.

Why now:

- It gives you landing zones for non-code clutter before touching active source.

### Phase 2 - Move Documentation and Planning Files

Goal:
Reduce root clutter using files that do not affect runtime behavior.

Steps:

1. Move `PROPOSED_REPO_STRUCTURE.md` into `docs/cleanup/`.
2. Move `NEWANALYTICS_RUNBOOK.md` into `docs/runbooks/`.
3. Move frontend and backend README-style notes into `docs/architecture/` or keep them beside the active app if they are setup-critical.
4. Create `docs/cleanup/archive-decisions.md` to record what gets moved and why.
5. Add a short root README later that points people to the new documentation locations.

Validation:

- No code imports documentation paths.
- Team can still find operating instructions quickly.

Rollback:

- These files can be moved back trivially if the new layout feels harder to navigate.

### Phase 3 - Separate Generated Files, Samples, and Local Working State

Goal:
Remove non-source files from the root without changing source behavior.

Steps:

1. Move CSV review files such as `athletes.csv`, `results.csv`, `volunteers.csv`, and analysis extracts into `data_samples/csv/`.
2. Move spreadsheet files such as `parkrun_events.xlsm` and `volunteers.xlsm` into `data_samples/spreadsheets/`.
3. Move generated build output from `parkrun-react-app/build/` into `build_artifacts/frontend_build/` only if your deployment flow does not depend on the current path.
4. Move compiled artifacts such as `process_data.c` and compiled `.pyd` files into `build_artifacts/compiled_extensions/` if they are not expected at import time.
5. Move `curve_progress/`, `instance/`, and the local SQLite database into `workspace/` once any scripts using hardcoded paths are updated.

Validation:

- Re-run any scripts that read sample files manually.
- Confirm no production or local boot path assumes the old `build/`, `curve_progress/`, or database locations.

Risk note:

- `workspace/` moves are low code value but can be high operational risk if scripts use literal filenames.

### Phase 4 - Classify SQL Into Runtime, Review, and Scratch

Current status (2026-07-26):

- In progress.
- Runtime owners are now identified for `Materialize.sql`, `mv_curve_rank_views.sql`, `event_summary_cache_mv.sql`, `club_members_cache_mv.sql`, `newSQL.sql`, and `SQL.sql`.
- The first runtime move batch is complete under `sql/materialized_views/` and `sql/pipeline_sections/`.
- `sql/materialized_views/mv_curve_rank_views.sql` is now the live curve-rank source, while `scripts/recreate_curve_views.sql` remains only as a compatibility wrapper.
- `mv_fast_adjusted_queries.sql`, `event_summary_perf.sql`, and `eventposition_view.sql` still need stronger caller proof before they should move.

Goal:
Make it obvious which SQL is part of the supported rebuild path.

Steps:

1. Create `sql/materialized_views/`, `sql/pipeline_sections/`, `sql/analytics_queries/`, `sql/one_off_reviews/`, and `sql/scratch/`.
2. Move clearly active runtime SQL first, including `Materialize.sql`, `mv_curve_rank_views.sql`, `mv_fast_adjusted_queries.sql`, `event_summary_cache_mv.sql`, and `club_members_cache_mv.sql`.
3. Move staged rebuild SQL such as `newSQL.sql` and `SQL.sql` into `sql/pipeline_sections/` after checking which scripts call them.
4. Move clearly investigative SQL such as `recent.sql`, `regulars.sql`, `tourist_count.sql`, and `bad_athletes.sql` into `sql/one_off_reviews/`.
5. Leave any ambiguous SQL files in place until their callers are known.
6. Add a short index file describing which SQL files are runtime-critical.

Validation:

- Re-run any backend job that loads SQL from disk.
- Search for hardcoded filenames before each move.
- Confirm admin rebuild or MV refresh flows still resolve their SQL assets.

Why before backend consolidation:

- Backend cleanup is easier when SQL responsibilities are already labeled.

### Phase 5 - Establish the Canonical Backend

Current status (2026-07-26):

- Partially complete.
- Repo-root `app.py` has already been reduced to a compatibility wrapper.
- `backendAPI.py` has absorbed `/api/clubs/members` and remains the maintained local operations backend.
- `python_sql_calls_repo/App_render.py` no longer needs to remain a mirrored copy and can stay only as a compatibility wrapper.
- Shared auth register/login logic now lives in `python_sql_calls_repo/shared_auth_handlers.py` and is reused by both backend families.
- Shared auth logout/me/link-athlete logic, auth/config and password-reset route logic, and feedback list/create/update logic have now also been extracted into shared handler modules; `event_highlights` still requires separate payload-alignment work.

Goal:
Stop backend duplication from growing before deeper refactoring.

Steps:

1. Treat `python_sql_calls_repo/app.py` as the canonical API source unless a missing feature proves otherwise.
2. Compare `backendAPI.py`, root `app.py`, and `python_sql_calls_repo/App_render.py` against that canonical backend and list any unique routes or behaviors.
3. Move unique logic that must survive into the canonical backend package or clearly separate admin/workflow modules.
4. Convert `python_sql_calls_repo/App_render.py` from a mirrored code copy into a thin wrapper around canonical app creation. Completed on 2026-07-26.
5. Clarify whether `backendAPI.py` should become an admin/workflow runtime only, or whether it should be retired after its unique operator features move.
6. Clarify whether root `app.py` still has a real role; if not, archive it only after replacements are verified. Completed on 2026-07-26 via compatibility wrapper plus archived full copy.

Validation:

- Route parity check across active frontend API calls.
- Local login, admin, participant search, lists, clubs, and event pages still work.
- Deployment entrypoint still imports and boots from the canonical backend.

Rollback:

- Keep wrappers and old entrypoints until at least one clean verification cycle has passed.

### Phase 6 - Split Backend by Concern Inside a Package

Goal:
Reorganize backend internals without changing external behavior.

Steps:

1. Create a `backend/app/` package structure for routes, services, auth, admin, lists, and models.
2. Move route groups first, but preserve exported app creation behavior.
3. Move query-heavy logic out of route files into service modules.
4. Keep deployment and local launchers thin under `backend/wsgi/`.
5. Introduce compatibility imports temporarily if needed to avoid a large single cutover.

Validation:

- Python compile checks pass.
- App startup still works in local and hosted modes.
- Endpoint smoke tests pass for the main user flows.

Why this phase is separate:

- Canonicalization answers "which backend owns the truth".
- Packaging answers "how that truth is organized internally".

### Phase 7 - Group the Data Pipeline Modules

Goal:
Move rebuild and scraping code out of the repo root once backend ownership is stable.

Steps:

1. Create `data_pipeline/scraping/`, `data_pipeline/transforms/`, `data_pipeline/sync/`, `data_pipeline/operations/`, and `data_pipeline/validation/`.
2. Move `process.py`, `scraper.py`, and `Athlete_runs.py` into scraping-related locations.
3. Move `analytics.py`, `curved_ranks.py`, and `run_age.py` into transform-related locations.
4. Move `database.py`, `update_athelete_postgres.py`, and `rebuildAthletes.py` into sync-related locations.
5. Move one-off execution scripts such as `reprocess_events.py`, `run_rebuild_batch.py`, and `volunteerUpdate.py` into operations.
6. Leave temporary compatibility wrappers at the old file paths if other scripts still import them.

Validation:

- Re-run weekly/manual rebuild flows.
- Re-run volunteer scraping and athlete rebuild entrypoints.
- Confirm no import paths remain broken.

Risk note:

- This phase is mostly import churn; do it only after backend consolidation reduces other moving parts.

### Phase 8 - Tidy the Frontend Container and Legacy Routes

Goal:
Make the active frontend obvious without breaking navigation.

Steps:

1. Keep `parkrun-react-app/` in place until backend and pipeline moves settle.
2. Audit legacy pages such as `Results.tsx`, `Races.tsx`, and `Courses.tsx` to confirm whether they still serve real routes.
3. Remove or archive legacy pages only after route usage is verified.
4. Rename `parkrun-react-app/` to `frontend/` only after scripts, docs, deployment paths, and developer habits are updated.
5. Update any batch files, PowerShell deploy scripts, and docs that assume the current frontend folder name.

Validation:

- Frontend build succeeds.
- All active routes load.
- Admin, participant search, lists, clubs, and event pages still resolve their API calls.

Why late:

- The folder rename is simple structurally but wide in knock-on references.

### Phase 9 - Archive Redundant Files and Remove Compatibility Shims

Goal:
Finish the cleanup only after the new structure has proven stable.

Steps:

1. Move superseded files into `archive/old_backend/`, `archive/old_sql/`, `archive/old_frontend/`, or `archive/old_scripts/`.
2. Keep a dated note in `docs/cleanup/archive-decisions.md` for each archived file group.
3. Remove compatibility wrappers only after all callers are updated.
4. Delete generated or scratch files only when you are confident they are reproducible or no longer useful.
5. Add a final root README that explains the new layout and points to the active backend, frontend, docs, and operator scripts.

Validation:

- Search shows no imports or scripts still depending on archived paths.
- A final frontend build and backend smoke test both pass.
- Core weekly/admin workflows complete from the new locations.

## Practical Execution Rules

1. Archive first, delete later.
2. Do not combine backend consolidation and frontend renaming in the same change set.
3. Prefer compatibility wrappers for Python entrypoints during transitions.
4. Search for hardcoded file paths before moving SQL, databases, or generated assets.
5. Validate after every phase rather than after the whole reorganisation.
6. Keep a written move log so you can reverse a bad phase quickly.

## Recommended Order If You Want The Lowest Risk Path

1. Phase 0 - Freeze and inventory.
2. Phase 1 - Create folders.
3. Phase 2 - Move documentation.
4. Phase 3 - Move samples and artifacts.
5. Phase 4 - Classify SQL.
6. Phase 5 - Canonical backend.
7. Phase 6 - Backend package split.
8. Phase 7 - Data pipeline grouping.
9. Phase 8 - Frontend container and legacy cleanup.
10. Phase 9 - Archive and delete only after stability.

## Phase 0 Checklist For This Repo

Use this as the working checklist before any file moves.

### A. Backend ownership and entrypoints

- [ ] Confirm whether `python_sql_calls_repo/app.py` is the canonical backend for login, admin, participant search, lists, clubs, and event pages.
- [ ] Confirm whether `python_sql_calls_repo/App_render.py` still contains any unique runtime logic, or can be reduced to a thin deploy wrapper.
- [ ] Confirm whether `backendAPI.py` is still needed as a separate local/admin workflow backend.
- [ ] Confirm whether root `app.py` still serves any route set or startup path that is not already covered elsewhere.
- [ ] Confirm whether `python_sql_calls_repo/lists_api.py` is the only lists blueprint that should remain active.
- [ ] Confirm whether root `Lists_api.py` has any remaining callers.
- [ ] Confirm whether `requirements.txt` at repo root is still used, or whether `python_sql_calls_repo/requirements.txt` is the real backend dependency source.
- [ ] Confirm whether `__run_backend_api_direct.py` is still used for local startup.
- [ ] Confirm whether `__wsgi_probe.py` is still used for deployment/runtime diagnostics.
- [ ] Confirm whether `start_all.ps1` assumes the current backend file locations.
- [ ] Confirm whether `push-render.bat` assumes a specific backend source file.
- [ ] Confirm whether `push-render-lists-api.bat` assumes a specific lists API file.

### B. Data pipeline and operations files

- [ ] Confirm the active role of `process.py` in the scrape-and-ingest workflow.
- [ ] Confirm the active role of `scraper.py` in event scraping.
- [ ] Confirm the active role of `Athlete_runs.py` in athlete and volunteer scraping.
- [ ] Confirm the active role of `database.py` in SQLite/Postgres sync and persistence.
- [ ] Confirm the active role of `analytics.py` in rebuild and transformation workflows.
- [ ] Confirm the active role of `curved_ranks.py` in rank generation and sync.
- [ ] Confirm the active role of `rebuildAthletes.py` in athlete rebuild jobs.
- [ ] Confirm the active role of `run_age.py` in age-related rebuild logic.
- [ ] Confirm the active role of `reprocess_events.py` in batch repair/rebuild operations.
- [ ] Confirm the active role of `run_rebuild_batch.py` in multi-step rebuild orchestration.
- [ ] Confirm the active role of `run_event_volunteers.py` in one-event volunteer scraping.
- [ ] Confirm the active role of `update_athelete_postgres.py` in Postgres sync.
- [ ] Confirm the active role of `volunteerUpdate.py` in volunteer refresh flows.
- [ ] Confirm the active role of `volunteers.py` in volunteer processing or export logic.
- [ ] Confirm the active role of `clearAgeErrors.py` in data repair.
- [ ] Confirm the active role of `consistency.py` in validation.
- [ ] Confirm whether `corrected_athletes_eventpositions.py` is still part of an active maintenance flow.
- [ ] Confirm whether `backendTest.py`, `testDB.py`, `test_driver.py`, `test_run_update.py`, and `test_stage2_accumulation.py` are still useful tests versus one-off diagnostics.

### C. SQL ownership and runtime references

- [ ] Confirm whether `Materialize.sql` is still the master MV build definition.
- [ ] Confirm whether `mv_curve_rank_views.sql` is still used by the current curve-rank rebuild flow.
- [ ] Confirm whether `mv_fast_adjusted_queries.sql` is still used by current API endpoints or rebuild jobs.
- [ ] Confirm whether `event_summary_cache_mv.sql` is part of the supported runtime build path.
- [ ] Confirm whether `club_members_cache_mv.sql` is part of the supported runtime build path.
- [ ] Confirm whether `event_summary_perf.sql` is part of the supported runtime build path.
- [ ] Confirm whether `eventposition_view.sql` is referenced by active code or rebuild jobs.
- [ ] Confirm whether `newSQL.sql` is an active staged rebuild asset.
- [ ] Confirm whether `SQL.sql` is still referenced, or is retained only for history/reference.
- [ ] Confirm callers for `adjustments.sql`.
- [ ] Confirm callers for `age_base times.sql`.
- [ ] Confirm callers for `age_grading.sql`.
- [ ] Confirm callers for `athlete_build_test.sql`.
- [ ] Confirm callers for `athlete_rebuild.sql`.
- [ ] Confirm callers for `bad_athletes.sql`.
- [ ] Confirm callers for `consitent_performers.sql`.
- [ ] Confirm callers for `local_stars.sql`.
- [ ] Confirm callers for `new_coeff.sql`.
- [ ] Confirm callers for `new_eligible.sql`.
- [ ] Confirm callers for `old_coeff.sql`.
- [ ] Confirm callers for `old_eligible.sql`.
- [ ] Confirm callers for `Process for eventpositions.sql`.
- [ ] Confirm callers for `recent.sql`.
- [ ] Confirm callers for `regulars.sql`.
- [ ] Confirm callers for `tourist_count.sql`.

### D. Frontend route and compatibility checks

- [ ] Confirm that `parkrun-react-app/src/App.tsx` still routes primarily to `EventAnalysisTest.tsx`, `EventTest.tsx`, and `CourseTest.tsx`.
- [ ] Confirm whether `parkrun-react-app/src/pages/Results.tsx` still needs to exist as a compatibility route.
- [ ] Confirm whether `parkrun-react-app/src/pages/Races.tsx` still needs to exist as a compatibility route.
- [ ] Confirm whether `parkrun-react-app/src/pages/Courses.tsx` still needs to exist as a compatibility route.
- [ ] Confirm whether any deployment, docs, or saved links still point to those legacy pages.
- [ ] Confirm whether `parkrun-react-app/README.md` is better kept beside the app until the eventual `frontend/` rename.

### E. Working state, generated assets, and file-path assumptions

- [ ] Confirm whether root `parkrun.db` is referenced by literal file paths in scripts.
- [ ] Confirm whether root `curve_progress/` is referenced by literal file paths in scripts.
- [ ] Confirm whether root `instance/` is referenced by literal file paths in scripts.
- [ ] Confirm whether root `athlete_runs_progress.json` is referenced by literal file paths in scripts.
- [ ] Confirm whether root `build/` is safe to move, and what generated it.
- [ ] Confirm whether `parkrun-react-app/build/` is used directly by deployment or local serving.
- [ ] Confirm whether `process_data.c`, `process_data.cp312-win_amd64.pyd`, and `process_data.cp39-win_amd64.pyd` are imported from their current paths.
- [ ] Confirm whether root `__pycache__/` should be removed from version control rather than moved.

## First-Pass Move List For Phase 2 And Phase 3

These are the exact first-pass move candidates from the current repo. This is still a planning list, not an instruction to move them immediately.

### Phase 2 - Documentation and planning files

Move now candidates:

- `PROPOSED_REPO_STRUCTURE.md` -> `docs/cleanup/proposed-repo-structure.md`
- `NEWANALYTICS_RUNBOOK.md` -> `docs/runbooks/analytics-runbook.md`

Create during this phase:

- `docs/cleanup/archive-decisions.md` - working log created from the template

Defer for now:

- `python_sql_calls_repo/README.md` - keep in place until backend folder consolidation is underway
- `parkrun-react-app/README.md` - keep in place until the frontend container rename is underway

### Phase 3 - Data samples, generated artifacts, and local working state

Move now candidates into `data_samples/csv/`:

- `analysis_eventpositions_1_2026-05-02_grouped.csv` -> `data_samples/csv/analysis_eventpositions_1_2026-05-02_grouped.csv`
- `analysis_eventpositions_4_2026-05-02_grouped.csv` -> `data_samples/csv/analysis_eventpositions_4_2026-05-02_grouped.csv`
- `athletes.csv` -> `data_samples/csv/athletes.csv`
- `athletes1.csv` -> `data_samples/csv/athletes1.csv`
- `athletes2.csv` -> `data_samples/csv/athletes2.csv`
- `athlete_err1.csv` -> `data_samples/csv/athlete_err1.csv`
- `athlete_err2.csv` -> `data_samples/csv/athlete_err2.csv`
- `athlete_err3.csv` -> `data_samples/csv/athlete_err3.csv`
- `athlete_err4.csv` -> `data_samples/csv/athlete_err4.csv`
- `my_results.csv` -> `data_samples/csv/my_results.csv`
- `results.csv` -> `data_samples/csv/results.csv`
- `volunteers.csv` -> `data_samples/csv/volunteers.csv`

Move now candidates into `data_samples/spreadsheets/`:

- `parkrun_events.xlsm` -> `data_samples/spreadsheets/parkrun_events.xlsm`
- `parkrun_events.xlsx` -> `data_samples/spreadsheets/parkrun_events.xlsx`
- `volunteers.xlsm` -> `data_samples/spreadsheets/volunteers.xlsm`

Move after path-check into `workspace/`:

- `curve_progress/` -> `workspace/curve_progress/`
- `instance/` -> `workspace/instance/`
- `parkrun.db` -> `workspace/local_db/parkrun.db`
- `athlete_runs_progress.json` -> `workspace/athlete_runs_progress.json`

Move after build/import check into `build_artifacts/`:

- `parkrun-react-app/build/` -> `build_artifacts/frontend_build/`
- `process_data.c` -> `build_artifacts/compiled_extensions/process_data.c`
- `process_data.cp312-win_amd64.pyd` -> `build_artifacts/compiled_extensions/process_data.cp312-win_amd64.pyd`
- `process_data.cp39-win_amd64.pyd` -> `build_artifacts/compiled_extensions/process_data.cp39-win_amd64.pyd`
- root `build/` -> `build_artifacts/compiled_extensions/build/`

Do not move as part of Phase 3 until clarified:

- `process_data.pyx` - source file, not just an artifact
- `curved_ranks/` - needs classification before moving
- `ngrok` - runtime tool/binary, not a sample file
- `Dictionary.txt` - role unclear; do not move blindly
- `.venv/` and `.vscode/` - local environment folders; treat separately from repo reorganisation
- root `__pycache__/` - remove or ignore rather than formalize as a kept artifact

## Notes

- This proposal is intentionally conservative: archive first, delete later.
- The biggest structural issue in the repo is backend duplication.
- The second biggest issue is the number of root-level scratch and working files mixed with source.
- The safest immediate improvement is to reduce root clutter without changing imports or runtime behavior.
