# TruTicket: deploy the auth, devices and events Edge Functions (packages 2.3 and 2.5) to a Supabase project.
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-functions.ps1 -ProjectRef <ref>
# First time on this PC, the CLI asks you to log in: npx --yes supabase@2 login
#
# The source stays in services\api\supabase\functions (PHASE2_PLAN §2.2, §2.3). The Supabase CLI
# wants functions under a supabase\ folder, so this script copies them to a temp folder and
# deploys from there. Nothing extra is added to the repo.
#
# PRODUCTION GUARD: ccqbubgebsayoviilnul is the production project. This script refuses it unless
# you add -AllowProduction, which must only be used after the user approves that step.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef,
  [switch] $AllowProduction
)

$ErrorActionPreference = 'Stop'
$ProductionRef = 'ccqbubgebsayoviilnul'

if ($ProjectRef -eq $ProductionRef -and -not $AllowProduction) {
  throw "STOP: $ProductionRef is the PRODUCTION project. Nothing was deployed. Use -AllowProduction only with the user's approval."
}
if ($ProjectRef -eq $ProductionRef) {
  Write-Host "WARNING: deploying to PRODUCTION ($ProductionRef)." -ForegroundColor Yellow
}

$repo  = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $env:TEMP 'truticket-functions-deploy'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $stage 'supabase') -Force | Out-Null

$src = Join-Path $repo 'services\api\supabase\functions'
$dst = Join-Path $stage 'supabase\functions'
robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

Copy-Item (Join-Path $repo 'supabase\config.toml') (Join-Path $stage 'supabase\config.toml')

Push-Location $stage
try {
  foreach ($fn in @('auth', 'devices', 'events', 'orders', 'checkout', 'razorpay_webhook', 'tickets', 'scanner_verify', 'resale', 'groups', 'chain')) {
    Write-Host "Deploying $fn ..." -ForegroundColor Cyan
    npx --yes supabase@2 functions deploy $fn --no-verify-jwt --use-api --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) { throw "deploy of $fn failed with code $LASTEXITCODE" }
  }
}
finally {
  Pop-Location
}

Write-Host "auth, devices, events, orders, razorpay_webhook, tickets, scanner_verify, resale, groups and chain functions deployed to project $ProjectRef" -ForegroundColor Green
