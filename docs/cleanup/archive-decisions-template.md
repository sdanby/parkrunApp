# Archive Decisions Template

Use this template to record each archive move before anything is deleted.

## How To Use

1. Copy this file to `docs/cleanup/archive-decisions.md` when Phase 2 starts.
2. Add one section per archive batch or one row per file group.
3. Record the evidence for why a file is being archived.
4. Record the validation step that proved nothing active still depends on it.
5. Do not delete archived files until they have survived at least one clean validation cycle.

## Decision Log

| Decision Date | File or Folder | Current Path | Archive Target | Category | Reason For Archive | Evidence Checked | Validation Performed | Rollback Plan | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Example file | `old/path/example.py` | `archive/old_backend/example.py` | old_backend | Superseded by canonical backend module | searched callers, compared routes | frontend build plus backend smoke test | move file back and restore imports | proposed | name |

## Per-Batch Notes

### Batch: YYYY-MM-DD - short description

- Scope:
- Why now:
- Risks:
- Validation gate:
- Rollback trigger:

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