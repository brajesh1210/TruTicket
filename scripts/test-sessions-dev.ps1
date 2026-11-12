# TruTicket: package 2.3 checks on the DEV project (truticket-dev) only.
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-sessions-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao -Email <test gmail>
#
# What it checks (PHASE2_PLAN §2.3 "done when"):
#   1. the second sign-in ends the first (old refresh token and old access token refused)
#   2. a new device waits: it cannot be activated during the 48-hour cooldown
#   3. refresh-token reuse is refused, and the newer token is revoked too
#
# You type the two email codes into this window. Nothing is printed or saved except the PASS/FAIL list.
# Needs: the auth and devices functions deployed on dev, and ATTESTATION_REQUIRED=false set on dev
# only (no real phone attestation in this test). Never run this against production.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef,
  [Parameter(Mandatory = $true)] [string] $Email
)

$ErrorActionPreference = 'Stop'
$DevRef = 'oviqjnzlgbkmggytaqao'
if ($ProjectRef -eq 'ccqbubgebsayoviilnul') {
  throw 'STOP: ccqbubgebsayoviilnul is PRODUCTION. This test never runs there.'
}
if ($ProjectRef -ne $DevRef) {
  throw "STOP: this test only runs on truticket-dev ($DevRef). You passed $ProjectRef."
}

$base = "https://$ProjectRef.supabase.co"
$authUrl = "$base/functions/v1/auth"
$devUrl  = "$base/functions/v1/devices"
$tokenUrl = "$base/auth/v1/token?grant_type=refresh_token"

$anon = Read-Host 'Paste the dev anon key (Dashboard > Project Settings > API > anon public). It stays in this window'
$h = @{ apikey = $anon }
# Unique device ids per run: device_key_id must be unique in the database, so a re-run never collides.
$stamp = (Get-Date).ToString('yyyyMMddHHmmss')
$idA = "dev-test-A-$stamp"
$idB = "dev-test-B-$stamp"

$results = New-Object System.Collections.Generic.List[string]
function Pass($m) { $script:results.Add("PASS  $m"); Write-Host "PASS  $m" -ForegroundColor Green }
function Fail($m) { $script:results.Add("FAIL  $m"); Write-Host "FAIL  $m" -ForegroundColor Red }

function Call-Api($url, $body, $headers) {
  $json = $body | ConvertTo-Json -Depth 6 -Compress
  try {
    $r = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType 'application/json' -Body $json
    return @{ ok = $true; status = 200; code = ''; text = ''; body = $r }
  } catch {
    $status = 0; $text = ''
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      try { $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    }
    $code = ''
    try { $code = (ConvertFrom-Json $text).error.code } catch {}
    return @{ ok = $false; status = $status; code = $code; text = $text; body = $null }
  }
}

$spki1 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE' + ('A' * 88)
$spki2 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE' + ('B' * 88)
$chain = @('QUFBQQ==', 'QkJCQg==')

# ---------- Sign-in 1 ----------
$r = Call-Api $authUrl @{ action = 'otp_request'; email = $Email } $h
if (-not $r.ok) { throw "otp_request failed: HTTP $($r.status) $($r.code)" }
$c1 = Read-Host 'Enter the 6-digit code from the email (sign-in 1)'
$l1 = Call-Api $authUrl @{ action = 'otp_verify'; email = $Email; code = $c1 } $h
if (-not $l1.ok) { throw "sign-in 1 failed: HTTP $($l1.status) $($l1.code)" }
$s1 = $l1.body.session

# Device A: the first device, activates at once
$hA = @{ apikey = $anon; Authorization = "Bearer $($s1.access_token)" }
$ca = Call-Api $devUrl @{ action = 'challenge' } $hA
if (-not $ca.ok) { throw "challenge A failed: HTTP $($ca.status) $($ca.code)" }
$ra = Call-Api $devUrl @{ action = 'register'; nonce = $ca.body.nonce; device_key_id = $idA; public_key = $spki1; platform = 'android'; certificate_chain = $chain } $hA
if ($ra.ok -and $ra.body.status -eq 'active') { Pass 'first device is registered and active' }
else { Fail "first device: HTTP $($ra.status) $($ra.code) $($ra.text) status=$($ra.body.status). If status=pending, this test account already has an active phone from an earlier run: delete the test user in the DEV dashboard (Authentication > Users) and run again." }

# ---------- Sign-in 2 (same account) ----------
Write-Host 'Waiting 65 seconds (the code resend wait) ...'
Start-Sleep -Seconds 65
$r = Call-Api $authUrl @{ action = 'otp_request'; email = $Email } $h
if (-not $r.ok) { throw "otp_request 2 failed: HTTP $($r.status) $($r.code)" }
$c2 = Read-Host 'Enter the 6-digit code from the new email (sign-in 2)'
$l2 = Call-Api $authUrl @{ action = 'otp_verify'; email = $Email; code = $c2 } $h
if (-not $l2.ok) { throw "sign-in 2 failed: HTTP $($l2.status) $($l2.code)" }
$s2 = $l2.body.session

# 1. Sign-in 2 ends sign-in 1
$old = Call-Api $tokenUrl @{ refresh_token = $s1.refresh_token } $h
if ($old.status -eq 400 -or $old.status -eq 401) { Pass "sign-in 1 refresh token refused after sign-in 2 (HTTP $($old.status))" }
else { Fail "sign-in 1 refresh token: expected HTTP 400 or 401, got HTTP $($old.status) (0 means no HTTP answer, check network)" }

$st = Call-Api $devUrl @{ action = 'status' } $hA
if (-not $st.ok -and ($st.code -eq 'SESSION_REVOKED' -or $st.code -eq 'AUTH_INVALID')) {
  Pass "sign-in 1 access token refused by the devices function ($($st.code))"
} else { Fail "sign-in 1 access token: HTTP $($st.status) $($st.code)" }

# 2. A second device waits for the cooldown
$hB = @{ apikey = $anon; Authorization = "Bearer $($s2.access_token)" }
$cb = Call-Api $devUrl @{ action = 'challenge' } $hB
$rb = Call-Api $devUrl @{ action = 'register'; nonce = $cb.body.nonce; device_key_id = $idB; public_key = $spki2; platform = 'android'; certificate_chain = $chain } $hB
if ($rb.ok -and $rb.body.status -eq 'pending') { Pass "second device is pending until $($rb.body.activate_after)" }
else { Fail "second device: HTTP $($rb.status) $($rb.code) $($rb.text)" }

$act = Call-Api $devUrl @{ action = 'activate'; device_key_id = $idB } $hB
if (-not $act.ok -and $act.code -eq 'COOLDOWN') { Pass 'second device cannot be activated during the 48-hour cooldown' }
else { Fail "activate during cooldown: HTTP $($act.status) $($act.code)" }

# 3. Refresh-token reuse
$rot = Call-Api $tokenUrl @{ refresh_token = $s2.refresh_token } $h
if ($rot.ok) { Pass 'sign-in 2 refresh token rotates normally' }
else { Fail "normal refresh: HTTP $($rot.status)" }
$newer = $rot.body.refresh_token

Write-Host 'Waiting 20 seconds (past the reuse interval) ...'
Start-Sleep -Seconds 20
$reuse = Call-Api $tokenUrl @{ refresh_token = $s2.refresh_token } $h
if ($reuse.status -eq 400 -or $reuse.status -eq 401) { Pass "reused refresh token refused (HTTP $($reuse.status))" }
elseif ($reuse.ok) { Fail 'reused refresh token accepted. Check Authentication > Sessions > "Detect and revoke compromised tokens" on dev' }
else { Fail "reused refresh token: expected HTTP 400 or 401, got HTTP $($reuse.status)" }

$fam = Call-Api $tokenUrl @{ refresh_token = $newer } $h
if ($fam.status -eq 400 -or $fam.status -eq 401) { Pass "the newer token of the same family is revoked too (HTTP $($fam.status))" }
else { Fail "the newer token still works after the reuse (HTTP $($fam.status))" }

Write-Host ''
Write-Host '===== RESULTS (dev project only) =====' -ForegroundColor Cyan
$results | ForEach-Object { Write-Host $_ }
$fails = @($results | Where-Object { $_ -like 'FAIL*' }).Count
if ($fails -eq 0) { Write-Host 'ALL CHECKS PASSED' -ForegroundColor Green } else { Write-Host "$fails CHECK(S) FAILED. Send this list (no codes or tokens) to the assistant." -ForegroundColor Red }
