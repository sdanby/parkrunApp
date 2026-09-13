# Archive Decisions Log

Use this working log to record each archive move before anything is deleted.

## How To Use

1. Add one section per archive batch or one row per file group.
2. Record the evidence for why a file is being archived.
3. Record the validation step that proved nothing active still depends on it.
4. Do not delete archived files until they have survived at least one clean validation cycle.

## Decision Log

| Decision Date | File or Folder | Current Path | Archive Target | Category | Reason For Archive | Evidence Checked | Validation Performed | Rollback Plan | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Example file | `old/path/example.py` | `archive/old_backend/example.py` | old_backend | Superseded by canonical backend module | searched callers, compared routes | frontend build plus backend smoke test | move file back and restore imports | proposed | name |
| 2026-07-26 | repo-root Flask backend implementation | `app.py` | `Archive/app_retired_20260726.py` | old_backend | Superseded by `backendAPI.py` for local operations; route surface no longer differs after `/api/clubs/members` migration | compared declared routes, checked `.vscode/launch.json`, searched for direct launcher/import references | `python -m py_compile backendAPI.py`; editor errors clean for `backendAPI.py` | restore `Archive/app_retired_20260726.py` back to `app.py` if wrapper runtime breaks | archived-as-wrapper | GitHub Copilot |
| 2026-07-26 | Render backend mirror implementation | `python_sql_calls_repo/App_render.py` | `python_sql_calls_repo/Archive/App_render_retired_20260726.py` | old_backend | Byte-identical to canonical `python_sql_calls_repo/app.py`; deploy script now sources canonical app directly | compared file hashes, searched for imports and script references, updated deploy script source path | `python -m py_compile python_sql_calls_repo\app.py python_sql_calls_repo\App_render.py`; import check returned `App_render.app is app.app == True` | restore archived file back to `python_sql_calls_repo/App_render.py` if any workflow still depends on the full mirrored module | archived-as-wrapper | GitHub Copilot |

## Current State

- One backend archive move has been recorded: the former repo-root `app.py` implementation is preserved under `Archive/app_retired_20260726.py`, while `app.py` now remains only as a compatibility wrapper.
- A second backend archive move is now recorded for `python_sql_calls_repo/App_render.py`, whose former full implementation is preserved under `python_sql_calls_repo/Archive/App_render_retired_20260726.py` while the live file remains only as a compatibility wrapper.
- Continue deferring deletion until the wrapper survives a stable validation cycle.

## Per-Batch Notes

### Batch: YYYY-MM-DD - short description

- Scope:
- Why now:
- Risks:
- Validation gate:
- Rollback trigger:

### Batch: 2026-07-26 - retire duplicated repo-root backend implementation

- Scope: archive the full repo-root `app.py` implementation and replace the live file with a thin wrapper to `backendAPI.app`
- Why now: `backendAPI.py` now includes `/api/clubs/members`, so the repo-root backend no longer adds unique route coverage
- Risks: any hidden workflow that expected the old standalone repo-root implementation could behave differently even though the entrypoint path still exists
- Validation gate: confirm the wrapper imports and launches cleanly, then use the local backend workflow once before deleting anything further
- Rollback trigger: any failure unique to `python app.py` that does not reproduce under direct `python backendAPI.py`

### Batch: 2026-07-26 - retire mirrored Render backend implementation

- Scope: archive the full `python_sql_calls_repo/App_render.py` implementation and keep the live file only as a compatibility wrapper while deploys source canonical `python_sql_calls_repo/app.py`
- Why now: file hash matched canonical `python_sql_calls_repo/app.py` exactly, so the duplicate code was no longer providing any unique behavior
- Risks: any manual workflow still depending on `App_render.py` as a full standalone module could fail if it imports deeper symbols than `app`
- Validation gate: confirm the wrapper imports cleanly and that deploy tooling now targets canonical `python_sql_calls_repo/app.py`
- Rollback trigger: any import or deploy issue that reproduces only when `App_render.py` is wrapper-based

## Archive Categories

- `old_frontend` - retired pages, components, or route implementations kept for reference
- `old_backend` - superseded Flask/API modules and compatibility copies
- `old_sql` - old query drafts, experiments, or replaced definitions
- `old_scripts` - retired helper scripts no longer part of normal operations
- `snapshots` - point-in-time backups taken during a risky transition

## Required Questions Before Archiving

- Is there any current import, script, batch file, or deployment path still referencing this file?
- Is there a canonical replacement already in place?
- Has the replacement been validated with the relevant runtime or build check?
- Is the archive target path obvious enough that the file can still be found later?
- Is deletion being deferred until after at least one stable verification cycle?
