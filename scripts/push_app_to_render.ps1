param(
    [string]$SourceAppPath = "C:\Users\stevi\parkrun_project\python_sql_calls_repo\app.py",
    [string]$RepoPath = "C:\Users\stevi\parkrun_project\python_sql_calls_repo",
    [string]$Branch = "master",
    [string]$CommitMessage = "Sync backend files"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $SourceAppPath)) {
    throw "Source app.py not found: $SourceAppPath"
}

$gitDir = Join-Path $RepoPath ".git"
if (-not (Test-Path -LiteralPath $gitDir)) {
    throw "Git repository not found at: $RepoPath"
}

Write-Host "[1/6] Syncing latest '$Branch' from origin..." -ForegroundColor Cyan
git -C $RepoPath fetch origin
git -C $RepoPath checkout $Branch
git -C $RepoPath pull origin $Branch

Write-Host "[2/6] Resolving canonical app.py source..." -ForegroundColor Cyan
$destinationAppPath = Join-Path $RepoPath "app.py"
$sourceResolved = [System.IO.Path]::GetFullPath($SourceAppPath)
$destinationResolved = [System.IO.Path]::GetFullPath($destinationAppPath)

$backendFilesToStage = @(
    "app.py",
    "App_render.py",
    "shared_auth_handlers.py",
    "shared_admin_user_handlers.py",
    "shared_chat_handlers.py",
    "shared_event_lookup_handlers.py",
    "shared_analytics_handlers.py",
    "shared_feedback_handlers.py",
    "shared_event_highlights.py",
    "shared_password_reset_handlers.py"
)

if ($sourceResolved -ne $destinationResolved) {
    Copy-Item -LiteralPath $SourceAppPath -Destination $destinationAppPath -Force
} else {
    Write-Host "Source already points at the canonical repo app.py; skipping copy." -ForegroundColor Yellow
}

Write-Host "[3/6] Staging backend files..." -ForegroundColor Cyan
$filesToStage = @()
foreach ($relativePath in $backendFilesToStage) {
    $candidatePath = Join-Path $RepoPath $relativePath
    if (Test-Path -LiteralPath $candidatePath) {
        $filesToStage += $relativePath
    }
}

if ($filesToStage.Count -eq 0) {
    throw "No backend files were found to stage under $RepoPath"
}

git -C $RepoPath add -- @filesToStage

Write-Host "[4/6] Checking for changes..." -ForegroundColor Cyan
$status = git -C $RepoPath status --porcelain -- @filesToStage
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes in tracked backend files. Nothing to commit or push." -ForegroundColor Yellow
    exit 0
}

Write-Host "[5/6] Committing..." -ForegroundColor Cyan
git -C $RepoPath commit -m $CommitMessage

Write-Host "[6/6] Pushing to origin/$Branch..." -ForegroundColor Cyan
git -C $RepoPath push origin $Branch

$commitHash = (git -C $RepoPath rev-parse --short HEAD).Trim()
Write-Host "Done. Pushed commit $commitHash to origin/$Branch." -ForegroundColor Green
