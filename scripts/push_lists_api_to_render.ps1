param(
    [string]$SourceListsApiPath = "C:\Users\stevi\parkrun_project\python_sql_calls_repo\lists_api.py",
    [string]$RepoPath = "C:\Users\stevi\parkrun_project\python_sql_calls_repo",
    [string]$Branch = "master",
    [string]$CommitMessage = "Update lists_api.py"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $SourceListsApiPath)) {
    throw "Source lists_api.py not found: $SourceListsApiPath"
}

$gitDir = Join-Path $RepoPath ".git"
if (-not (Test-Path -LiteralPath $gitDir)) {
    throw "Git repository not found at: $RepoPath"
}

Write-Host "[1/6] Syncing latest '$Branch' from origin..." -ForegroundColor Cyan
git -C $RepoPath fetch origin
git -C $RepoPath checkout $Branch
git -C $RepoPath pull origin $Branch

$destinationListsApiPath = Join-Path $RepoPath "lists_api.py"
$resolvedSourcePath = [System.IO.Path]::GetFullPath($SourceListsApiPath)
$resolvedDestinationPath = [System.IO.Path]::GetFullPath($destinationListsApiPath)

if ($resolvedSourcePath -ieq $resolvedDestinationPath) {
    Write-Host "[2/6] Source already points at repo lists_api.py; skipping copy..." -ForegroundColor Yellow
} else {
    Write-Host "[2/6] Copying lists_api.py into repo clone..." -ForegroundColor Cyan
    Copy-Item -LiteralPath $SourceListsApiPath -Destination $destinationListsApiPath -Force
}

Write-Host "[3/6] Staging lists_api.py..." -ForegroundColor Cyan
git -C $RepoPath add lists_api.py

Write-Host "[4/6] Checking for changes..." -ForegroundColor Cyan
$status = git -C $RepoPath status --porcelain -- lists_api.py
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes in lists_api.py. Nothing to commit or push." -ForegroundColor Yellow
    exit 0
}

Write-Host "[5/6] Committing..." -ForegroundColor Cyan
git -C $RepoPath commit -m $CommitMessage

Write-Host "[6/6] Pushing to origin/$Branch..." -ForegroundColor Cyan
git -C $RepoPath push origin $Branch

$commitHash = (git -C $RepoPath rev-parse --short HEAD).Trim()
Write-Host "Done. Pushed commit $commitHash to origin/$Branch." -ForegroundColor Green
