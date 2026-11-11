# TruTicket: deploy the auth Edge Function to a Supabase project.
# Run from the repo root, in PowerShell:
#   .\scripts\deploy-auth.ps1 -ProjectRef <your-project-ref>
# First time on this PC, the CLI asks you to log in: npx --yes supabase@2 login
# (it opens a browser; click Allow). Your login is never written into the repo.
#
# The source stays in services\api\supabase\functions (per PHASE2_PLAN §2.2).
# The Supabase CLI wants functions under a supabase\ folder, so this script copies
# them to a temp folder and deploys from there. Nothing extra is added to the repo.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef
)

$ErrorActionPreference = 'Stop'

$repo  = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $env:TEMP 'truticket-auth-deploy'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $stage 'supabase') -Force | Out-Null

$src = Join-Path $repo 'services\api\supabase\functions'
$dst = Join-Path $stage 'supabase\functions'
robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

Copy-Item (Join-Path $repo 'supabase\config.toml') (Join-Path $stage 'supabase\config.toml')

Push-Location $stage
try {
  npx --yes supabase@2 functions deploy auth --no-verify-jwt --use-api --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "supabase deploy failed with code $LASTEXITCODE" }
}
finally {
  Pop-Location
}

Write-Host "auth function deployed to project $ProjectRef" -ForegroundColor Green
