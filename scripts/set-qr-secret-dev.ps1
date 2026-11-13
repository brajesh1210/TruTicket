# TruTicket: create the QR signing key on the DEV project (package 2.7). Run ONCE.
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-qr-secret-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
# A random key is made here. It is never printed and never saved in the repo.
# Running it again makes a NEW key, and old QR codes stop working. That is expected.

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

$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)

$envFile = Join-Path $env:TEMP 'truticket-qr-secret.env'
try {
  [System.IO.File]::WriteAllLines($envFile, @("QR_HMAC_KEY=$key"))
  npx --yes supabase@2 secrets set --env-file $envFile --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed with code $LASTEXITCODE" }
  Write-Host 'QR_HMAC_KEY saved on DEV.' -ForegroundColor Green
}
finally {
  if (Test-Path $envFile) { Remove-Item $envFile -Force }
  $key = $null
}
