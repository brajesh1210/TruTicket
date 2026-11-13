# TruTicket: end-to-end check of the rotating QR and the gate scan on the DEV project (package 2.7).
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-gate-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
# Needs: 2.6 done (a demo ticket that is still ISSUED_ACTIVE), the 2.7 SQL applied, DEV_ONLY device fixture
# re-run (covers the organiser too), and the QR key set (set-qr-secret-dev.ps1), and the functions deployed.
# It uses 1 demo ticket. Each run needs a new ticket (run test-orders-dev.ps1 to buy one; the limit is 4).
# What it checks, in order:
#   1. a QR that is 11 seconds old is refused: EXPIRED (ticket still unused)
#   2. a fresh QR scanned: VALID, the ticket becomes REDEEMED
#   3. the same QR scanned again (new scan key): ALREADY_USED
#   4. a changed QR: INVALID
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

function Show([string] $label, [string] $expected, $resp) {
  $got = if ($resp.body) { $resp.body.result } else { $null }
  if ($resp.status -eq 200 -and $got -eq $expected) { Write-Host "PASS  $label -> $got" -ForegroundColor Green }
  else { Write-Host "FAIL  ${label}: expected $expected, got HTTP $($resp.status) $($resp.body | ConvertTo-Json -Compress)" -ForegroundColor Red }
}

# Sign in both demo accounts (each sign-in is linked to its dev test device).
$attToken = Sign-In 'demo.attendee@example.com' 'dev-demo-attendee-device'
$orgToken = Sign-In 'demo.organiser@example.com' 'dev-demo-organiser-device'
$attAuth = @{ apikey = $anon; Authorization = "Bearer $attToken" }
$orgAuth = @{ apikey = $anon; Authorization = "Bearer $orgToken" }

# Find one ticket that is still unused.
$mine = Invoke-Api "$base/tickets" $attAuth @{ action = 'mine' }
if ($mine.status -ne 200) { throw "tickets mine failed: HTTP $($mine.status)" }
$ticket = $mine.body.tickets | Where-Object { $_.status -eq 'ISSUED_ACTIVE' } | Select-Object -First 1
if (-not $ticket) { throw 'No unused ticket for the demo attendee. Run test-orders-dev.ps1 once to buy one, then run this again.' }
Write-Host "Using ticket $($ticket.id) ($($ticket.ticket_types.name))" -ForegroundColor Cyan

# Find the demo event id.
$list = Invoke-RestMethod -Method Post -Uri "$base/events" -Headers $h -ContentType 'application/json' -Body '{"action":"list"}'
$event = $list.events | Where-Object { $_.title -eq 'TruTicket Demo Night' } | Select-Object -First 1
if (-not $event) { throw 'Demo event not found.' }

$scanUrl = "$base/scanner_verify"

# 1. A QR that is 11 seconds old: EXPIRED.
$q1 = Invoke-Api "$base/tickets" $attAuth @{ action = 'qr'; ticket_id = $ticket.id }
if ($q1.status -ne 200) { throw "qr failed: HTTP $($q1.status) $($q1.body | ConvertTo-Json -Compress)" }
Write-Host "QR made, valid for $($q1.body.ttl_seconds) s. Waiting 11 s..." -ForegroundColor Cyan
Start-Sleep -Seconds 11
$r1 = Invoke-Api $scanUrl $orgAuth @{ token = $q1.body.token; event_id = $event.id; idempotency_key = 'scan-expired-' + [guid]::NewGuid().ToString('N') }
Show '1 old QR (11 s)' 'EXPIRED' $r1

# 2. A fresh QR, scanned: VALID.
$q2 = Invoke-Api "$base/tickets" $attAuth @{ action = 'qr'; ticket_id = $ticket.id }
$r2 = Invoke-Api $scanUrl $orgAuth @{ token = $q2.body.token; event_id = $event.id; idempotency_key = 'scan-a-' + [guid]::NewGuid().ToString('N') }
Show '2 fresh QR, first scan' 'VALID' $r2

# 3. The same QR again, with a new scan key (a second phone scanning the same screen): ALREADY_USED.
$r3 = Invoke-Api $scanUrl $orgAuth @{ token = $q2.body.token; event_id = $event.id; idempotency_key = 'scan-b-' + [guid]::NewGuid().ToString('N') }
Show '3 same QR, second scan' 'ALREADY_USED' $r3

# 4. A changed QR: INVALID.
$bad = $q2.body.token.Substring(0, $q2.body.token.Length - 1) + $(if ($q2.body.token.EndsWith('0')) { '1' } else { '0' })
$r4 = Invoke-Api $scanUrl $orgAuth @{ token = $bad; event_id = $event.id; idempotency_key = 'scan-bad-' + [guid]::NewGuid().ToString('N') }
Show '4 changed QR' 'INVALID' $r4

Write-Host ''
Write-Host 'Expected: 4 PASS lines. Check the ticket in the orders/tickets table: status REDEEMED.' -ForegroundColor Cyan
