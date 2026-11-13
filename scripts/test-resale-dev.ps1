# TruTicket: end-to-end check of the price-capped resale and the group invite on the DEV project (package 2.8).
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-resale-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
# Needs: 2.8 SQL applied (APPLY_2_8_TO_SUPABASE_DEV.sql), DEV_ONLY_2_8_resale_group_fixture.sql run
# just before this script (it resets the two test tickets), the device fixture (2.6), and the functions deployed.
# It checks, in order:
#   1. listing above the cap is refused (422 OVER_CAP, with the maximum)
#   2. listing at the cap is accepted
#   3. the manager invites the demo organiser by email (dev mode returns the claim code)
#   4. the organiser claims the invite
#   5. the same code claimed again is refused (ALREADY_CLAIMED)
#   6. the manager has no QR for the ticket they gave away (NOT_YOURS)
#   7. the manager takes the resale listing down again (cleanup)
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

$base = "https://$ProjectRef.supabase.co/functions/v1"
$anon = (Read-Host 'Paste the dev anon key (Dashboard > Project Settings > API > anon public)').Trim()
$code = (Read-Host 'Paste the DEMO_OTP_CODE set on dev (6 digits)').Trim()
$h = @{ apikey = $anon }
$resaleTicket = '00000000-0000-4000-8000-0000000008a1'
$bucketTicket = '00000000-0000-4000-8000-0000000008b1'

function Invoke-Api([string] $url, [hashtable] $headers, [hashtable] $payload) {
  $json = $payload | ConvertTo-Json -Compress
  $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($json)
  try {
    $r = Invoke-WebRequest -Method Post -Uri $url -Headers $headers -ContentType 'application/json' -Body $bytes -UseBasicParsing
    return @{ status = [int]$r.StatusCode; body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $resp = $_.Exception.Response
    $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $text = ''
    if ($resp) { $text = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd() }
    $parsed = $null
    try { $parsed = $text | ConvertFrom-Json } catch { }
    return @{ status = $status; body = $parsed }
  }
}

function Sign-In([string] $email, [string] $deviceKey) {
  Invoke-RestMethod -Method Post -Uri "$base/auth" -Headers $h -ContentType 'application/json' -Body (@{ action = 'otp_request'; email = $email } | ConvertTo-Json -Compress) | Out-Null
  $ver = Invoke-RestMethod -Method Post -Uri "$base/auth" -Headers $h -ContentType 'application/json' -Body (@{ action = 'otp_verify'; email = $email; code = $code; device_key_id = $deviceKey } | ConvertTo-Json -Compress)
  if (-not $ver.session.access_token) { throw "No token for $email. Check DEMO_MODE and DEMO_OTP_CODE on dev." }
  return $ver.session.access_token
}

$script:fails = 0
function Check([string] $label, [int] $wantStatus, [string] $wantCode, $resp) {
  $gotCode = if ($resp.body -and $resp.body.error) { $resp.body.error.code } else { '' }
  $ok = ($resp.status -eq $wantStatus) -and (($wantCode -eq '') -or ($gotCode -eq $wantCode))
  if ($wantStatus -eq 200) { $ok = ($resp.status -eq 200) }
  if ($ok) {
    Write-Host "PASS  $label -> HTTP $($resp.status) $gotCode" -ForegroundColor Green
  } else {
    $script:fails++
    Write-Host "FAIL  ${label}: expected HTTP $wantStatus $wantCode, got HTTP $($resp.status) $($resp.body | ConvertTo-Json -Compress)" -ForegroundColor Red
  }
}

# Sign in both demo accounts (each sign-in is linked to its dev test device).
$attToken = Sign-In 'demo.attendee@example.com' 'dev-demo-attendee-device'
$orgToken = Sign-In 'demo.organiser@example.com' 'dev-demo-organiser-device'
$attAuth = @{ apikey = $anon; Authorization = "Bearer $attToken" }
$orgAuth = @{ apikey = $anon; Authorization = "Bearer $orgToken" }

# 1. Above the cap (General ₹499, cap 110% = ₹548.90 = 54890 paise): refused.
$r1 = Invoke-Api "$base/resale" $attAuth @{ action = 'list'; ticket_id = $resaleTicket; ask_minor = 54891 }
Check '1 list above the cap' 422 'OVER_CAP' $r1
if ($r1.body.error.max_minor -ne 54890) { $script:fails++; Write-Host "FAIL  1 cap value: expected 54890, got $($r1.body.error.max_minor)" -ForegroundColor Red }

# 2. At the cap: accepted.
$r2 = Invoke-Api "$base/resale" $attAuth @{ action = 'list'; ticket_id = $resaleTicket; ask_minor = 54890 }
Check '2 list at the cap' 200 '' $r2
$listing = $r2.body.listing_id

# 3. The manager invites the demo organiser (dev mode returns the claim code).
$r3 = Invoke-Api "$base/groups" $attAuth @{ action = 'allocate'; ticket_id = $bucketTicket; invitee_email = 'demo.organiser@example.com' }
Check '3 invite a member' 200 '' $r3
$claim = $r3.body.dev_claim_code
if (-not $claim) { $script:fails++; Write-Host 'FAIL  3 no dev_claim_code: is DEMO_MODE=true on dev?' -ForegroundColor Red }

# 4. The organiser claims the ticket.
$r4 = Invoke-Api "$base/groups" $orgAuth @{ action = 'claim'; claim_code = $claim }
Check '4 member claims the invite' 200 '' $r4

# 5. The same code again: refused.
$r5 = Invoke-Api "$base/groups" $orgAuth @{ action = 'claim'; claim_code = $claim }
Check '5 same code again' 409 'ALREADY_CLAIMED' $r5

# 6. The manager no longer has a QR for the ticket they gave away.
$r6 = Invoke-Api "$base/tickets" $attAuth @{ action = 'qr'; ticket_id = $bucketTicket }
Check '6 manager QR for the given ticket' 403 'NOT_YOURS' $r6

# 7. Cleanup: take the resale listing down.
if ($listing) {
  $r7 = Invoke-Api "$base/resale" $attAuth @{ action = 'cancel'; listing_id = $listing }
  Check '7 cancel the listing (cleanup)' 200 '' $r7
}

Write-Host ''
if ($script:fails -eq 0) {
  Write-Host 'All checks passed. Run DEV_ONLY_2_8 fixture again before the next run.' -ForegroundColor Cyan
} else {
  Write-Host "$($script:fails) check(s) failed. Re-run the DEV_ONLY_2_8 fixture first if a ticket was already listed or claimed." -ForegroundColor Yellow
}
