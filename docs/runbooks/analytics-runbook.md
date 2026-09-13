# newAnalytics Runbook

This document lists the main processes that can be run from `newAnalytics.py`, how to run them, and when to use each one.

It is organized into:

- full pipeline runs
- one-off history rebuild / repopulation runs
- date-specific / weekly top-up runs
- utility and backup runs

Notes:

- Public, scriptable entry points are the functions without a leading underscore.
- Functions with a leading underscore are helper functions and normally should not be called directly unless you know exactly why you need them.
- Dates are safest in ISO format: `YYYY-MM-DD`.

## Main Entry Points

The main callable processes in `newAnalytics.py` are:

- `run_simple_sql_loop(...)`
- `run_curve_eventpositions_sync_from_history_one_off(...)`
- `run_curve_rank_updates_only(...)`
- `run_curve_latest(...)`
- `run_curve_backfill_today(...)`
- `rebuild_curve_historic_from_current(...)`
- `backup_eventpositions_curve_history(...)`

Useful helper utilities that are callable but more operational/internal are:

- `build_curve_time_rank_reference_for_date(...)`
- `backup_materialized_views_sql(...)`

Related callable utilities in `curved_ranks.py` that are not launched through `newAnalytics.py` but are still useful operationally are:

- `run_curve_time_ranks_reference_one_off(...)`

## 1. Full Process

### Full Pipeline Run

This is the main rebuild / normal processing flow. It can:

- generate the event date list
- run the SQL pipeline per date
- update athletes
- update coefficients
- run scraper / volunteer steps
- rebuild the all-history curve time-rank reference for the weekly curve step
- run curve-rank updates
- update local `eventpositions` with the curve-rank results
- copy `eventpositions` and `parkrun_events` to Postgres
- refresh materialized views
- optionally rebuild historic curve ranking after the run

### Full Pipeline Order

The dependency order is:

1. SQL pipeline, including coefficient updates
2. scraper / athlete-local updates
3. rebuild the all-history curve time-rank reference for the weekly curve step
4. curve ranking update
5. upload final `eventpositions` and `parkrun_events` state to Postgres
6. refresh materialized views last

This keeps curve ranking separable when you want to run it on its own with `run_curve_rank_updates_only(...)`, while ensuring the normal full pipeline only refreshes materialized views after all dependent tables are finished.

### Example Full Process

This is the current example pattern from `newAnalytics.py`:

```python
run_simple_sql_loop(
    start_date="2026-05-16",
    rebuild=True,
    run_sql_pipeline=True,
    buildAthletes=True,
    skip_coeff_updates=False,
    no_parkrun_postgres=False,
    event_code=None,
    Scraper=True,
    all_athletes=True,
    leave_athlete_postgres=False,
    no_volunteers=False,
    update_curve_rankings=True,
    refresh_materialized_view=True,
    rebuild_historic_after_run=False,
)
```

  `curve_processing` in the full pipeline is controlled by `update_curve_rankings=True`.
  If you omit it, the function still runs curve processing because the default is `True`.

### Command Prompt Version

```bat
  python -c "from newAnalytics import run_simple_sql_loop; run_simple_sql_loop(start_date='2026-05-16', rebuild=True, run_sql_pipeline=True, buildAthletes=True, skip_coeff_updates=False, no_parkrun_postgres=False, event_code=None, Scraper=True, all_athletes=True, leave_athlete_postgres=False, no_volunteers=False, update_curve_rankings=True, refresh_materialized_view=True, rebuild_historic_after_run=False)"
```

### What `run_simple_sql_loop(...)` Does

When `rebuild=True`:

- obtains a list of dates from SQL (`rebuild_all_event_positions`)
- loops those dates
- runs `process_athlete_sections(...)` for each date
- if `update_curve_rankings=True`, runs curve processing inside the full pipeline before the final Postgres upload and materialized view refresh

When `rebuild=False`:

- treats `start_date` as the one date to process
- runs `process_athlete_sections(...)` once for that date

## 2. `run_simple_sql_loop` Parameter Guide

### Core Parameters

- `filename='sql/pipeline_sections/newSQL.sql'`
  - SQL section file to read from.
  - Leave as default unless you are intentionally testing a different SQL file.

- `rebuild=False`
  - `True`: build a date list and process a range/history.
  - `False`: run only the supplied `start_date` as a single-date process.

- `start_date=None`
  - Start of range when `rebuild=True`.
  - The exact date to process when `rebuild=False`.

- `end_date=None`
  - Optional end of range when `rebuild=True`.

- `event_code=None`
  - Restricts processing to one event when set.

### Pipeline / Data Controls

- `run_sql_pipeline=True`
  - `True`: run the SQL pipeline blocks.
  - `False`: skip SQL pipeline and only do upload/scraper/refresh stages.

- `buildAthletes=True`
  - `True`: run heavy athlete update logic.
  - `False`: skip athlete update block to reduce runtime.

- `skip_coeff_updates=False`
  - `True`: do not recalculate coefficients.
  - `False`: normal coefficient processing.

- `update_curve_rankings=True`
  - `True`: run curve ranking update workflow after coefficients and before the final Postgres upload / materialized-view refresh.
  - `False`: skip curve ranking update.

### Postgres / Copy Controls

- `no_parkrun_postgres=False`
  - `True`: skip copying parkrun data to Postgres.
  - `False`: normal Postgres copy behavior.

- `leave_athlete_postgres=False`
  - `True`: skip athlete table copy to Postgres.
  - `False`: copy athletes after processing.

- `refresh_materialized_view=True`
  - `True`: refresh materialized views at the very end, after curve updates and Postgres uploads.
  - `False`: skip refresh.

### Scraper Controls

- `Scraper=True`
  - `True`: run scraper after each processed date.
  - `False`: do not run scraper.

- `all_athletes=True`
  - `True`: scraper / athlete update can work over all athletes.
  - `False`: narrower athlete scope.

- `no_volunteers=False`
  - `True`: skip volunteer scraping.
  - `False`: include volunteer scraping.

- `scraper_only=False`
  - `True`: skip SQL/pipeline/copy and run only scraper logic.
  - `False`: normal behavior.

- `driver=None`
  - Optional webdriver instance for scraper workflows.

### Curve-Only Controls

- `curve_rank_only=False`
  - `True`: skip normal pipeline and run only the separable curve-rank workflow.

- `curve_rank_missing_only=False`
  - Only used when `curve_rank_only=True`.
  - Restricts to rows missing curve ranks.

- `curve_rank_descending=True`
  - Only used when `curve_rank_only=True`.
  - Controls date order for curve-rank processing.

### Historic Rebuild Controls

- `rebuild_historic_after_run=False`
  - `True`: after the main process finishes, rebuild `best_curve_ranking_historic` from prior current values.

- `historic_rebuild_end_date=None`
  - Optional explicit end date for the post-run historic rebuild.

- `historic_rebuild_batch_size=50000`
  - Batch size for historic rebuild updates.

- `historic_rebuild_copy_to_postgres=True`
  - If historic rebuild runs, also copy rebuilt historic values to Postgres.

## 3. One-Off History Rebuild / Repopulation Processes

Use these when history may be wrong and you want to rebuild or resync older data.

### A. Full Historical Pipeline Rebuild

Best for:

- rebuilding all event positions from a historical date onward
- re-running coefficients / aggregates / Postgres copy across a range

Example:

```bat
python -c "from newAnalytics import run_simple_sql_loop; run_simple_sql_loop(start_date='2025-01-01', end_date='2025-12-31', rebuild=True, run_sql_pipeline=True, buildAthletes=False, skip_coeff_updates=False, no_parkrun_postgres=False, Scraper=False, refresh_materialized_view=False, rebuild_historic_after_run=False)"
```

### B. Repopulate `eventpositions` Curve Fields From History

Best for:

- copying already-built curve history back into `eventpositions`
- pushing those curve fields to Postgres

Function:

- `run_curve_eventpositions_sync_from_history_one_off(...)`

Example:

```bat
python -c "from newAnalytics import run_curve_eventpositions_sync_from_history_one_off; print(run_curve_eventpositions_sync_from_history_one_off(start_date='2025-01-01', end_date='2025-12-31', event_code=None, copy_to_postgres=True))"
```

### C. Rebuild Historic Curve Rank From Current Curve Rank

Best for:

- fixing `best_curve_ranking_historic`
- recalculating prior-best historic values over a range

Function:

- `rebuild_curve_historic_from_current(...)`

Example:

```bat
python -c "from newAnalytics import rebuild_curve_historic_from_current; rebuild_curve_historic_from_current(start_date='2025-01-01', end_date='2025-12-31', event_code=None, copy_to_postgres=True, batch_size=50000)"
```

### D. Curve-Rank-Only Backfill Across History

Best for:

- rebuilding curve-rank outputs without rerunning the full SQL pipeline
- backfilling missing or stale curve ranks over a historical range

Function:

- `run_curve_rank_updates_only(...)`

Example:

```bat
python -c "from newAnalytics import run_curve_rank_updates_only; run_curve_rank_updates_only(start_date='2025-01-01', end_date='2025-12-31', event_code=None, missing_only=False, descending=True, copy_to_postgres=False)"
```

## 4. Date-Specific / Weekly Top-Up Processes

Use these when processing a single event date or keeping the latest data current.

### A. Single-Date Full Processing

Best for:

- processing one known event date
- weekly top-up when you want the full event pipeline for one date

Example:

```bat
python -c "from newAnalytics import run_simple_sql_loop; run_simple_sql_loop(start_date='2026-05-09', rebuild=False, run_sql_pipeline=True, buildAthletes=True, skip_coeff_updates=False, no_parkrun_postgres=False, event_code=None, Scraper=True, all_athletes=True, leave_athlete_postgres=False, no_volunteers=False, refresh_materialized_view=True, rebuild_historic_after_run=False)"
```

### B. Pipeline-Off Upload / Refresh Run For One Date

Best for:

- re-uploading / refreshing a date without rerunning the heavy SQL pipeline

Example:

```bat
python -c "from newAnalytics import run_simple_sql_loop; run_simple_sql_loop(start_date='2026-05-09', rebuild=False, run_sql_pipeline=False, buildAthletes=True, no_parkrun_postgres=False, Scraper=True, refresh_materialized_view=True)"
```

### C. Latest Curve Date Only

Best for:

- updating curve ranks only for the latest available date

Function:

- `run_curve_latest(...)`

Example:

```bat
python -c "from newAnalytics import run_curve_latest; run_curve_latest(event_code=None, missing_only=False, date_override='2026-05-09', copy_to_postgres=False)"
```

### D. Backfill Curve Ranks Up To Today

Best for:

- filling missing curve ranks up to the current day / current cutoff
- running a curve-only weekly top-up over recent data

Function:

- `run_curve_backfill_today(...)`

Example:

```bat
python -c "from newAnalytics import run_curve_backfill_today; run_curve_backfill_today(event_code=None, missing_only=True, copy_to_postgres=False, today_override=None, copy_every_n_dates=1)"
```

### E. Curve-Rank-Only Weekly / Date-Range Top-Up

Best for:

- a specific date
- a recent date range
- only rows currently missing curve ranks

Function:

- `run_curve_rank_updates_only(...)`

Examples:

```bat
python -c "from newAnalytics import run_curve_rank_updates_only; run_curve_rank_updates_only(start_date='2026-05-09', end_date='2026-05-09', event_code=None, missing_only=False, descending=True, copy_to_postgres=False)"
```

```bat
python -c "from newAnalytics import run_curve_rank_updates_only; run_curve_rank_updates_only(start_date='2026-05-01', end_date='2026-05-09', event_code=None, missing_only=True, descending=True, copy_to_postgres=False)"
```

## 5. Utility / Backup Runs

### Back Up Existing Curve Fields Before Rebuild

Function:

- `backup_eventpositions_curve_history(...)`

Best for:

- taking a snapshot before running a historic rebuild or curve resync

Example:

```bat
python -c "from newAnalytics import backup_eventpositions_curve_history; print(backup_eventpositions_curve_history(start_date='2025-01-01', end_date='2025-12-31', event_code=None))"
```

### Build Curve Time-Rank Reference For One Snapshot Date

Function:

- `build_curve_time_rank_reference_for_date(sqlite_conn, snapshot_date, ...)`

Best for:

- low-level debugging
- rebuilding reference ranks for one snapshot inside an existing Python session

This is normally not the first thing to call from the command prompt because it requires an open SQLite connection.

### Build Curve Time-Rank Reference As A One-Off Command

Function:

- `run_curve_time_ranks_reference_one_off(...)`

Best for:

- rebuilding the standalone `curve_time_ranks_reference` table manually
- debugging or repopulating the reference table without running full Stage 2 / Stage 3 updates

Important:

- this public function is a one-off utility and is not itself called by the weekly `newAnalytics.py` flow
- the underlying builder does run inside the weekly curve pipeline, and the weekly path now also rebuilds the all-history reference immediately before the weekly athlete-history curve build
- default one-off behavior builds a single all-history reference, not per-date eventpositions updates

Example:

```bat
python -c "from curved_ranks import run_curve_time_ranks_reference_one_off; print(run_curve_time_ranks_reference_one_off())"
```

### Back Up Materialized View SQL

Function:

- `backup_materialized_views_sql(render_cursor, ...)`

Best for:

- capturing current Postgres materialized view definitions before refresh / rebuild work

This also requires an existing Postgres cursor, so it is normally used from an interactive Python session.

## 6. Choosing The Right Process

### Use for one-off history repopulation

- `run_simple_sql_loop(..., rebuild=True, ...)`
- `run_curve_eventpositions_sync_from_history_one_off(...)`
- `rebuild_curve_historic_from_current(...)`
- `run_curve_rank_updates_only(start_date=..., end_date=..., ...)`
- `backup_eventpositions_curve_history(...)`

### Use for a specific date or weekly top-up

- `run_simple_sql_loop(..., rebuild=False, start_date='YYYY-MM-DD', ...)`
- `run_simple_sql_loop(..., run_sql_pipeline=False, start_date='YYYY-MM-DD', ...)`
- `run_curve_latest(...)`
- `run_curve_backfill_today(...)`
- `run_curve_rank_updates_only(start_date='YYYY-MM-DD', end_date='YYYY-MM-DD', ...)`

## 7. Recommended Patterns

### Weekly Normal Top-Up

Use:

- `run_simple_sql_loop(rebuild=False, start_date='YYYY-MM-DD', ...)`

### Historical Rebuild From A Known Start Date

Use:

- `run_simple_sql_loop(rebuild=True, start_date='YYYY-MM-DD', end_date='YYYY-MM-DD', ...)`

### Fix Curve Ranks Only

Use:

- `run_curve_rank_updates_only(...)`

### Recopy Curve History Into `eventpositions`

Use:

- `run_curve_eventpositions_sync_from_history_one_off(...)`

### Rebuild Historic Curve Rank Only

Use:

- `rebuild_curve_historic_from_current(...)`
