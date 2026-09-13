# Backend And Runtime SQL Comparison

This note records the current Phase 0 comparison pass across the active backend files and the still-active runtime SQL assets.

## Backend Comparison

### 1. `python_sql_calls_repo/app.py`

Current role:

- Best candidate for the canonical product backend.

Evidence:

- Includes the product-facing auth and user-management routes.
- Includes admin user editing routes for both default course and athlete code.
- Includes participant and discovery endpoints such as `/api/athletes/search`, `/api/athlete_runs`, `/api/athlete_best_summary`, `/api/clubs/search`, `/api/clubs/members`, `/api/clubs/course-summary`, `/api/curve-rank-reference`, and `/api/next_ext_similar`.
- Includes `event_highlights` and event-info routes used by the current frontend.

Notable gap versus the operational backends:

- Does not carry the weekly-upload and curve-reference admin orchestration surface.

### 2. `python_sql_calls_repo/App_render.py`

Current role:

- Compatibility/deploy wrapper for the canonical product backend.

Evidence:

- File hash matched `python_sql_calls_repo/app.py` exactly before wrapper conversion.
- Deploy tooling previously pointed directly at this file.
- Deploy script now treats `python_sql_calls_repo/app.py` as the canonical source.

Conclusion:

- This no longer needs to remain a mirrored code copy. Keep it only as a thin compatibility wrapper if any manual workflow still references the filename.

### 3. `backendAPI.py`

Current role:

- Active local operations/backend control surface.

Evidence:

- Local launchers point directly at this file: `.vscode/launch.json`, `start_all.ps1`, `__run_backend_api_direct.py`, and `__wsgi_probe.py`.
- Owns weekly-upload and curve-reference admin orchestration endpoints.
- Owns auth, feedback, chat, event-highlights, and some event-processing routes.
- Includes admin athlete-code editing and `athlete_best_summary`.

Notable gaps versus the canonical product backend:

- No admin default-course edit route surfaced in this pass.
- No `athletes/search`, `athlete_runs`, `clubs/search`, `clubs/course-summary`, `curve-rank-reference`, or `next_ext_similar` routes surfaced in this pass.

Conclusion:

- Keep it for now as an operations/local-control backend, but treat it as an overlap source rather than the canonical product API.

Unique route paths versus root `app.py` found in this pass:

- `/api/athlete_best_summary`
- `/api/admin/users/<int:user_id>/athlete-code`

### 4. `app.py`

Current role:

- Overlapping operational backend similar to `backendAPI.py`.
- This section refers to the repo-root `app.py`, not `python_sql_calls_repo/app.py`.

Evidence:

- Owns weekly-upload and curve-reference admin orchestration endpoints.
- Owns auth, feedback, chat, event-highlights, scrape/process, and event-management routes.
- Includes `/api/clubs/members`.

Notable gaps versus the canonical product backend:

- No admin default-course or athlete-code edit routes surfaced in this pass.
- No `athletes/search`, `athlete_runs`, `clubs/search`, `clubs/course-summary`, `curve-rank-reference`, or `next_ext_similar` routes surfaced in this pass.
- No active launcher reference surfaced in this pass.

Conclusion:

- Treat it as another overlapping operational copy until a direct runtime owner is proven.

Unique route path versus `backendAPI.py` found in this pass:

- `/api/clubs/members`

## Backend Takeaway

The repo currently appears to have two backend families:

1. Product/API family: `python_sql_calls_repo/app.py` and `python_sql_calls_repo/App_render.py`
2. Operations/admin orchestration family: `backendAPI.py` and root `app.py`

Recommended current planning stance:

- Use `python_sql_calls_repo/app.py` as the canonical product backend.
- `python_sql_calls_repo/App_render.py` can now remain only as a thin compatibility wrapper.
- Decide whether `backendAPI.py` remains a separate operations runtime.
- Treat repo-root `app.py` as a compatibility entrypoint only; its full duplicated implementation has been retired.
- Shared handler extraction now covers email auth register/login/logout/me/link-athlete, auth/config, password-reset request/validate/confirm, and feedback list/create/update, while `event_highlights` still diverges in payload richness and data access.

Retirement guidance from this pass:

- Do not retire `backendAPI.py` yet because it is still the file actively targeted by the local launchers.
- `backendAPI.py` now owns `/api/clubs/members`, so repo-root `app.py` no longer carries any route surface that `backendAPI.py` lacks.
- Repo-root `app.py` has been reduced to a compatibility wrapper that imports `backendAPI.app`; the pre-wrapper implementation was archived to `Archive/app_retired_20260726.py`.
- `python_sql_calls_repo/app.py` is not an archive candidate from this pass. It is the canonical product backend candidate.
- The former full `python_sql_calls_repo/App_render.py` implementation was archived to `python_sql_calls_repo/Archive/App_render_retired_20260726.py`, and the deploy script now sources canonical `python_sql_calls_repo/app.py` directly.

## Event Highlights Comparison

Current conclusion:

- `event_highlights` is not the next safe whole-route extraction target.

Evidence:

- `python_sql_calls_repo/app.py` uses SQLAlchemy/Postgres mappings and returns a richer payload including `first_finishers`, `gender_breakdown`, `pb_breakdown`, `first_timer_breakdown`, run and volunteer milestone breakdowns, name lists, and volunteer milestone details.
- `backendAPI.py` still uses `connections()` plus cursor tuples and returns a smaller payload centered on `first_finisher`, `top_age_grade`, `first_timers`, `pb_roster`, `milestone_candidates`, and a simpler volunteer roster.
- The two routes share helper-shaped logic such as date normalization and time parsing, but they do not currently share the same response contract.

Recommended next step:

- If `event_highlights` is the next target, extract only pure helpers first, then align the local payload contract before attempting a shared route handler.

## Runtime SQL Comparison

### `Materialize.sql`

Current role:

- Base/support MV build definition.

Evidence:

- Referenced by `scripts/rebuild_all_materialized_views.sql`.
- Referenced by `newAnalytics.py` when rebuilding materialized-view chains.

Planning conclusion:

- Treat as active runtime SQL and keep it in the supported rebuild path.

### `mv_curve_rank_views.sql`

Current role:

- Canonical curve-rank materialized-view definition.

Evidence:

- `newAnalytics.py` now rebuilds curve-rank views directly from `sql/materialized_views/mv_curve_rank_views.sql`.
- `scripts/rebuild_all_materialized_views.sql` now includes `sql/materialized_views/mv_curve_rank_views.sql` directly.
- `scripts/recreate_curve_views.sql` has been reduced to a compatibility wrapper for manual/scripted callers that still expect that path.

Planning conclusion:

- Treat `sql/materialized_views/mv_curve_rank_views.sql` as the single source of truth.
- Keep `scripts/recreate_curve_views.sql` only as a compatibility wrapper until no manual workflow depends on that filename.

### `newSQL.sql`

Current role:

- Active staged rebuild SQL library.

Evidence:

- Referenced by root `app.py`.
- Referenced by `backendAPI.py`.
- Used by `database.py` helper functions for temp/update/insert table SQL extraction.
- Referenced by `newAnalytics.py` as a live candidate SQL source.

Planning conclusion:

- Treat as active runtime SQL and do not move it until callers are updated together.

Observed owner split:

- `database.py` owns the reusable SQL section loader and the temp/update/insert helpers that read `newSQL.sql`.
- `backendAPI.py` and root `app.py` are runtime callers that trigger workflows depending on those helpers.
- `newAnalytics.py` is the operator-oriented orchestrator that treats `newSQL.sql` as a primary runnable pipeline source.

### `SQL.sql`

Current role:

- Still-active older section-based SQL library.

Evidence:

- Referenced several times by `analytics.py`.
- Used as a default filename by `database.py` section helpers.
- `newAnalytics.py` still considers it as a candidate SQL source alongside `newSQL.sql`.

Planning conclusion:

- Treat as active runtime SQL, even if it is older and likely transitional.

Observed owner split:

- `database.py` owns the generic section-loading helpers and defaults several helper paths to `SQL.sql`.
- `analytics.py` is the strongest functional owner of the older section-based query assembly still using `SQL.sql` directly.
- `newAnalytics.py` still treats `SQL.sql` as a fallback candidate alongside `newSQL.sql`.

## Runtime SQL Takeaway

The active SQL split currently looks like this:

1. `Materialize.sql` = MV/bootstrap definition layer
2. `newSQL.sql` = staged rebuild/temp/update workflow layer
3. `SQL.sql` = still-active legacy section library that has not been fully retired

Recommended current planning stance:

- Keep all three in place during Phase 0 and Phase 1.
- Move them only as part of the SQL classification phase with caller updates validated together.