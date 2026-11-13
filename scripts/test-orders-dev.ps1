# TruTicket: end-to-end check of orders and the Razorpay webhook on the DEV project (package 2.6).
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-orders-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
# Needs: demo accounts (2.5), the 2.5 and 2.6 SQL applied, the dev test device (DEV_ONLY_2_6_demo_attendee_device.sql),
# and the Razorpay TEST secrets set (set-payments-secrets.ps1).
# What it checks:
#   1. demo attendee signs in, holds 1 General ticket, creates a Razorpay TEST order
#      (each run issues 1 demo ticket; the limit is 4 per account, so run it about 4 times at most)
#   2. a SIGNED payment.captured webhook issues the ticket (result ISSUED)
#   3. the same webhook again changes nothing (result DUPLICATE)
#   4. a webhook with a wrong signature is refused (HTTP 401)
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
$s = Read-Host -AsSecureString 'Paste the RAZORPAY_WEBHOOK_SECRET (typing is hidden)'
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { $hookSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-Api([string] $method, [string] $url, [hashtable] $headers, [string] $json) {
  # Returns @{ status = <int>; body = <object> }. Sends UTF-8 bytes, so the signed bytes match the sent bytes.
  $bytes = $utf8.GetBytes($json)
  try {
    $r = Invoke-WebRequest -Method $method -Uri $url -Headers $headers -ContentType 'application/json' -Body $bytes -UseBasicParsing
    return @{ status = [int]$r.StatusCode; body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $resp = $_.Exception.Response
    $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $text = ''
    if ($resp) {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $sr.ReadToEnd()
    }
    $parsed = $null
    try { $parsed = $text | ConvertFrom-Json } catch { }
    return @{ status = $status; body = $parsed }
  }
}

function Get-HmacHex([string] $secret, [byte[]] $bytes) {
  $hmac = New-Object System.Security.Cryptography.HMACSHA256 (, $utf8.GetBytes($secret))
  try { return ([BitConverter]::ToString($hmac.ComputeHash($bytes)) -replace '-', '').ToLower() }
  finally { $hmac.Dispose() }
}

function Send-Webhook([string] $eventId, [byte[]] $bytes, [string] $signature) {
  $h = @{ 'x-razorpay-event-id' = $eventId; 'x-razorpay-signature' = $signature }
  return Invoke-Api 'POST' "$base/razorpay_webhook" $h ([System.Text.Encoding]::UTF8.GetString($bytes))
}

# 1. Sign in the demo attendee (same flow as demo-accounts-dev.ps1).
$h = @{ apikey = $anon }
$email = 'demo.attendee@example.com'
Invoke-RestMethod -Method Post -Uri "$base/auth" -Headers $h -ContentType 'application/json' -Body (@{ action = 'otp_request'; email = $email } | ConvertTo-Json -Compress) | Out-Null
# device_key_id links this sign-in to the dev test device (created by DEV_ONLY_2_6_demo_attendee_device.sql).
# Without it the purchase gate (session_can_transact) refuses with CANNOT_TRANSACT.
$ver = Invoke-RestMethod -Method Post -Uri "$base/auth" -Headers $h -ContentType 'application/json' -Body (@{ action = 'otp_verify'; email = $email; code = $code; device_key_id = 'dev-demo-attendee-device' } | ConvertTo-Json -Compress)
$access = $ver.session.access_token
if (-not $access) { throw 'No access token from otp_verify. Check DEMO_MODE and DEMO_OTP_CODE on dev.' }
$auth = @{ apikey = $anon; Authorization = "Bearer $access" }

# 2. Find the General ticket type and hold 1 seat.
$list = Invoke-RestMethod -Method Post -Uri "$base/events" -Headers $h -ContentType 'application/json' -Body '{"action":"list"}'
$event = $list.events | Where-Object { $_.title -eq 'TruTicket Demo Night' } | Select-Object -First 1
if (-not $event) { throw 'Demo event not found. Run 2.5 Part D (demo accounts and APPLY_2_5) first.' }
$general = $event.ticketTypes | Where-Object { $_.name -eq 'General' } | Select-Object -First 1
$res = Invoke-RestMethod -Method Post -Uri "$base/events" -Headers $auth -ContentType 'application/json' -Body (@{ action = 'reserve'; ticket_type_id = $general.id; quantity = 1 } | ConvertTo-Json -Compress)
Write-Host "OK   hold made: $($res.reservation_id)" -ForegroundColor Green

# 3. Create the Razorpay TEST order.
$ord = Invoke-Api 'POST' "$base/orders" $auth (@{ action = 'create'; reservation_id = $res.reservation_id } | ConvertTo-Json -Compress)
if ($ord.status -ne 200) { throw "orders create failed: HTTP $($ord.status) $($ord.body | ConvertTo-Json -Compress)" }
Write-Host "OK   Razorpay test order: $($ord.body.razorpay_order_id) amount $($ord.body.amount) paise" -ForegroundColor Green

# 4. Build a payment.captured payload and sign it with the webhook secret.
$eventId = 'evt_test_' + [guid]::NewGuid().ToString('N')
$payload = @{
  event = 'payment.captured'
  payload = @{ payment = @{ entity = @{ id = "pay_test_$eventId"; order_id = $ord.body.razorpay_order_id; amount = $ord.body.amount; currency = 'INR'; status = 'captured' } } }
} | ConvertTo-Json -Depth 10 -Compress
$bytes = $utf8.GetBytes($payload)
$sig = Get-HmacHex $hookSecret $bytes

# 5. Signed webhook: expect ISSUED.
$r1 = Send-Webhook $eventId $bytes $sig
if ($r1.status -eq 200 -and $r1.body.result -eq 'ISSUED') { Write-Host 'PASS 1  signed webhook issued the ticket (ISSUED)' -ForegroundColor Green }
else { Write-Host "FAIL 1  expected 200 ISSUED, got HTTP $($r1.status) $($r1.body | ConvertTo-Json -Compress)" -ForegroundColor Red }

# 6. Same event again: expect DUPLICATE.
$r2 = Send-Webhook $eventId $bytes $sig
if ($r2.status -eq 200 -and $r2.body.result -eq 'DUPLICATE') { Write-Host 'PASS 2  replayed webhook changed nothing (DUPLICATE)' -ForegroundColor Green }
else { Write-Host "FAIL 2  expected 200 DUPLICATE, got HTTP $($r2.status) $($r2.body | ConvertTo-Json -Compress)" -ForegroundColor Red }

# 7. Wrong signature: expect 401.
$bad = Send-Webhook ('evt_bad_' + $eventId) $bytes ('00' * 32)
if ($bad.status -eq 401) { Write-Host 'PASS 3  wrong signature refused (401)' -ForegroundColor Green }
else { Write-Host "FAIL 3  expected 401, got HTTP $($bad.status)" -ForegroundColor Red }

Write-Host ''
Write-Host 'Next: open the orders table on DEV and check one row is TICKET_ISSUED, and the tickets row count went up by 1.' -ForegroundColor Cyan
