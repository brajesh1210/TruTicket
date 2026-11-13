# TruTicket: store the mobile app's DEV settings in Expo (EAS) for the "development" build profile.
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-mobile-env-dev.ps1
# First time on this PC, log in once: npx --yes eas-cli@latest login
#
# Only PUBLIC values go to the app: the DEV project URL, the anon key, and the gate event id.
# Never a service key, Razorpay secret, or HMAC key. The anon key is typed at the prompt, so it
# is not written in this file or in chat.
#
# PRODUCTION GUARD: ccqbubgebsayoviilnul is the production project. This script only accepts DEV.

$ErrorActionPreference = 'Stop'
$DevRef = 'oviqjnzlgbkmggytaqao'
$ProdRef = 'ccqbubgebsayoviilnul'
$SupabaseUrl = "https://$DevRef.supabase.co"

$repo = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $repo 'apps\mobile'
if (-not (Test-Path (Join-Path $mobile 'app.json'))) { throw "apps\mobile not found under $repo" }

Write-Host "Target Supabase project: $DevRef (DEV)" -ForegroundColor Cyan
if ($SupabaseUrl -like "*$ProdRef*") { throw 'STOP: this is the PRODUCTION project. Nothing was set.' }

$anon = Read-Host 'Paste the DEV anon key (truticket-dev > Project Settings > API > anon public)'
$anon = $anon.Trim()
if ($anon.Length -lt 20 -or $anon -match '\s') { throw 'The anon key looks wrong. Nothing was set.' }

$gate = Read-Host 'Paste the gate event id (a published event id from the DEV events list)'
$gate = $gate.Trim()
if ($gate -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw 'The gate event id must be a UUID. Nothing was set.'
}

$values = [ordered]@{
  'EXPO_PUBLIC_SUPABASE_URL'      = $SupabaseUrl
  'EXPO_PUBLIC_SUPABASE_ANON_KEY' = $anon
  'EXPO_PUBLIC_GATE_EVENT_ID'     = $gate
}

Push-Location $mobile
try {
  foreach ($name in $values.Keys) {
    $value = [string]$values[$name]
    Write-Host "Setting $name for the development profile ..." -ForegroundColor Cyan
    npx --yes eas-cli@latest env:set --name $name --value $value --environment development --visibility plaintext
    if ($LASTEXITCODE -ne 0) { throw "eas env:set failed for $name (code $LASTEXITCODE). Fix it and run this script again." }
  }
}
finally {
  Pop-Location
}

Write-Host 'Done. Next: build the development client with eas build (see the guide).' -ForegroundColor Green
