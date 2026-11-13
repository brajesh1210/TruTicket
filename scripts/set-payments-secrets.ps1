# TruTicket: set the Razorpay TEST secrets on the DEV project (package 2.6). Run ONCE.
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-payments-secrets.ps1 -ProjectRef oviqjnzlgbkmggytaqao
#
# You will be asked for 3 values. Paste them into THIS window only. They are never saved in the repo
# and never sent to chat. The key id must start with rzp_test_ (test mode). Live keys are refused.
# The secrets go to a temp file, are used once, and the file is deleted.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef
)

$ErrorActionPreference = 'Stop'
$DevRef = 'oviqjnzlgbkmggytaqao'
if ($ProjectRef -eq 'ccqbubgebsayoviilnul') {
  throw 'STOP: ccqbubgebsayoviilnul is PRODUCTION. Nothing was set. This script never runs there.'
}
if ($ProjectRef -ne $DevRef) {
  throw "STOP: this script only runs on the dev project ($DevRef)."
}

function Read-Secret([string] $prompt) {
  $s = Read-Host -AsSecureString $prompt
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$keyId = (Read-Host 'RAZORPAY_KEY_ID (starts with rzp_test_)').Trim()
if (-not $keyId.StartsWith('rzp_test_')) {
  throw 'STOP: the key id must start with rzp_test_. Live keys are refused. Nothing was set.'
}
$keySecret = Read-Secret 'RAZORPAY_KEY_SECRET (typing is hidden)'
$hookSecret = Read-Secret 'RAZORPAY_WEBHOOK_SECRET (the secret you typed in the Razorpay webhook form; typing is hidden)'
if ([string]::IsNullOrWhiteSpace($keySecret) -or [string]::IsNullOrWhiteSpace($hookSecret)) {
  throw 'STOP: a secret was empty. Nothing was set.'
}

$lines = @(
  "RAZORPAY_KEY_ID=$keyId",
  "RAZORPAY_KEY_SECRET=$keySecret",
  "RAZORPAY_WEBHOOK_SECRET=$hookSecret"
)

$envFile = Join-Path $env:TEMP 'truticket-payments-secrets.env'
try {
  [System.IO.File]::WriteAllLines($envFile, $lines)
  npx --yes supabase@2 secrets set --env-file $envFile --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed with code $LASTEXITCODE" }
  Write-Host 'Razorpay TEST secrets saved on DEV.' -ForegroundColor Green
}
finally {
  if (Test-Path $envFile) { Remove-Item $envFile -Force }
  $keySecret = $null; $hookSecret = $null; $lines = $null
}
