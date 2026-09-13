# Higher-risk Phase 3 move commands
# Run from: C:\Users\stevi\parkrun_project
# This script is intentionally cautious.
# Read the comment checks before uncommenting any move block.

$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\stevi\parkrun_project'

New-Item -ItemType Directory -Force -Path 'workspace\curve_progress' | Out-Null
New-Item -ItemType Directory -Force -Path 'workspace\instance' | Out-Null
New-Item -ItemType Directory -Force -Path 'workspace\local_db' | Out-Null
New-Item -ItemType Directory -Force -Path 'build_artifacts\frontend_build' | Out-Null
New-Item -ItemType Directory -Force -Path 'build_artifacts\compiled_extensions' | Out-Null

# PRE-MOVE CHECKS: workspace state
# - Confirm every reference to `curve_progress` has been updated away from the current root path.
# - Confirm every reference to `athlete_runs_progress.json` has been updated away from the current root path.
# - Confirm database openers no longer assume the current `parkrun.db` path.
# - Confirm no Flask/local scripts assume the current `instance/` path.
# - Re-run the relevant backend or pipeline smoke checks before and after the move.

# UNCOMMENT ONLY AFTER THE CHECKS ABOVE PASS
# Move-Item -LiteralPath 'curve_progress' -Destination 'workspace\curve_progress'
# Move-Item -LiteralPath 'instance' -Destination 'workspace\instance'
# Move-Item -LiteralPath 'parkrun.db' -Destination 'workspace\local_db\parkrun.db'
# Move-Item -LiteralPath 'athlete_runs_progress.json' -Destination 'workspace\athlete_runs_progress.json'

# PRE-MOVE CHECKS: frontend build output
# - Confirm deployment and local serving do not expect `parkrun-react-app\build` in its default CRA location.
# - Confirm no scripts or docs still reference the current build path.
# - Re-run the frontend build after any path updates.

# UNCOMMENT ONLY AFTER THE CHECKS ABOVE PASS
# Move-Item -LiteralPath 'parkrun-react-app\build' -Destination 'build_artifacts\frontend_build'

# PRE-MOVE CHECKS: compiled extension artifacts
# - Confirm imports do not rely on the current root-level `.pyd` locations.
# - Confirm build or packaging scripts do not expect `process_data.c` in the current location.
# - Confirm `process_data.pyx` stays in place as the maintained source file unless you have a separate source layout plan.

# UNCOMMENT ONLY AFTER THE CHECKS ABOVE PASS
# Move-Item -LiteralPath 'process_data.c' -Destination 'build_artifacts\compiled_extensions\process_data.c'
# Move-Item -LiteralPath 'process_data.cp312-win_amd64.pyd' -Destination 'build_artifacts\compiled_extensions\process_data.cp312-win_amd64.pyd'
# Move-Item -LiteralPath 'process_data.cp39-win_amd64.pyd' -Destination 'build_artifacts\compiled_extensions\process_data.cp39-win_amd64.pyd'

# PRE-MOVE CHECKS: root build directory
# - Confirm what generated the root `build/` directory.
# - Confirm it is not still being used by any script, packaging step, or manual workflow.
# - Inspect contents before moving so it lands in the correct artifact bucket.

# UNCOMMENT ONLY AFTER THE CHECKS ABOVE PASS
# Move-Item -LiteralPath 'build' -Destination 'build_artifacts\compiled_extensions\build'