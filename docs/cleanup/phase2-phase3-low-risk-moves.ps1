# Low-risk Phase 2 and Phase 3 move commands
# Run from: C:\Users\stevi\parkrun_project
# These commands intentionally cover only the low-risk documentation and sample-data moves.
# They do not move workspace state, build outputs, databases, or compiled extensions.

$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\stevi\parkrun_project'

function Move-IfPresent {
	param(
		[string]$Source,
		[string]$Destination
	)

	if (Test-Path -LiteralPath $Source) {
		Move-Item -LiteralPath $Source -Destination $Destination
	}
}

New-Item -ItemType Directory -Force -Path 'docs\cleanup' | Out-Null
New-Item -ItemType Directory -Force -Path 'docs\runbooks' | Out-Null
New-Item -ItemType Directory -Force -Path 'data_samples\csv' | Out-Null
New-Item -ItemType Directory -Force -Path 'data_samples\spreadsheets' | Out-Null

# Phase 2: documentation and planning files
Move-IfPresent 'PROPOSED_REPO_STRUCTURE.md' 'docs\cleanup\proposed-repo-structure.md'
Move-IfPresent 'NEWANALYTICS_RUNBOOK.md' 'docs\runbooks\analytics-runbook.md'

# Phase 3: CSV sample and review files
Move-IfPresent 'analysis_eventpositions_1_2026-05-02_grouped.csv' 'data_samples\csv\analysis_eventpositions_1_2026-05-02_grouped.csv'
Move-IfPresent 'analysis_eventpositions_4_2026-05-02_grouped.csv' 'data_samples\csv\analysis_eventpositions_4_2026-05-02_grouped.csv'
Move-IfPresent 'athletes.csv' 'data_samples\csv\athletes.csv'
Move-IfPresent 'athletes1.csv' 'data_samples\csv\athletes1.csv'
Move-IfPresent 'athletes2.csv' 'data_samples\csv\athletes2.csv'
Move-IfPresent 'athlete_err1.csv' 'data_samples\csv\athlete_err1.csv'
Move-IfPresent 'athlete_err2.csv' 'data_samples\csv\athlete_err2.csv'
Move-IfPresent 'athlete_err3.csv' 'data_samples\csv\athlete_err3.csv'
Move-IfPresent 'athlete_err4.csv' 'data_samples\csv\athlete_err4.csv'
Move-IfPresent 'my_results.csv' 'data_samples\csv\my_results.csv'
Move-IfPresent 'results.csv' 'data_samples\csv\results.csv'
Move-IfPresent 'volunteers.csv' 'data_samples\csv\volunteers.csv'

# Phase 3: spreadsheet sample and review files
Move-IfPresent 'parkrun_events.xlsm' 'data_samples\spreadsheets\parkrun_events.xlsm'
Move-IfPresent 'parkrun_events.xlsx' 'data_samples\spreadsheets\parkrun_events.xlsx'
Move-IfPresent 'volunteers.xlsm' 'data_samples\spreadsheets\volunteers.xlsm'
