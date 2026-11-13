# TruTicket: create the two demo accounts on the DEV project (package 2.5).
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo-accounts-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
# Needs DEMO_MODE=true and DEMO_EMAILS / DEMO_OTP_CODE set on DEV (see the guide). The code is the DEMO_OTP_CODE value.
# It never runs on production.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef
)

$ErrorActionPreference = 'Stop'
$DevRef = 'oviqjnzlgbkmggytaqao'
if ($ProjectRef -eq 'ccqbubgebsayoviilnul') {
  throw 'STOP: ccqbubgebsayoviilnul is PRODUCTION. This script never runs there.'
}
if ($ProjectRef -ne $DevRef) {
  throw "STOP: this script only runs on the dev project ($DevRef)."
}

$base = "https://$ProjectRef.supabase.co"
$authUrl = "$base/functions/v1/auth"
$anon = Read-Host 'Paste the dev anon key (Dashboard > Project Settings > API > anon public). It stays in this window'
$code = Read-Host 'Paste the DEMO_OTP_CODE you set on dev (6 digits)'
$h = @{ apikey = $anon }

foreach ($email in @('demo.organiser@example.com', 'demo.attendee@example.com')) {
  Write-Host "Requesting demo code for $email ..." -ForegroundColor Cyan
  $req = @{ action = 'otp_request'; email = $email } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $authUrl -Headers $h -ContentType 'application/json' -Body $req | Out-Null
  } catch {
    Write-Host "otp_request failed for $email. Check DEMO_MODE and DEMO_EMAILS on dev." -ForegroundColor Red
    throw
  }
  $ver = @{ action = 'otp_verify'; email = $email; code = $code } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri $authUrl -Headers $h -ContentType 'application/json' -Body $ver
  Write-Host "OK   $email signed in once (user_id $($r.user_id))" -ForegroundColor Green
}
Write-Host ''
Write-Host 'Demo accounts ready on dev. Next: run APPLY_2_5_TO_SUPABASE_DEV.sql in the SQL editor of the dev project.' -ForegroundColor Green
