param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipNgrok
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot 'parkrun-react-app'

function Start-NewTerminal {
    param(
        [string]$WorkingDirectory,
        [string]$Command
    )

    $psCommand = "Set-Location -LiteralPath '$WorkingDirectory'; $Command"
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        $psCommand
    )
}

if (-not $SkipBackend) {
    Start-NewTerminal -WorkingDirectory $projectRoot -Command 'python backendAPI.py'
}

if (-not $SkipFrontend) {
    Start-NewTerminal -WorkingDirectory $frontendRoot -Command 'npm start'
}

if (-not $SkipNgrok) {
    Start-NewTerminal -WorkingDirectory $projectRoot -Command 'ngrok http 5000'
}

Write-Host 'Launch complete.'
Write-Host "Backend skipped: $SkipBackend"
Write-Host "Frontend skipped: $SkipFrontend"
Write-Host "Ngrok skipped: $SkipNgrok"