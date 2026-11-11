# TruTicket: set the sign-in secrets on a Supabase project. Run ONCE per project.
# Run from the repo root, in PowerShell:
#   .\scripts\set-auth-secrets.ps1 -ProjectRef <your-project-ref>
# The project ref is the code in your dashboard URL:
#   https://supabase.com/dashboard/project/<your-project-ref>
#
# The secrets are written to a temp file, used once, and deleted. Nothing is saved in the repo.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef
)

$ErrorActionPreference = 'Stop'

# 1. A random key for hashing the email codes (32 bytes, base64).
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$otpKey = [Convert]::ToBase64String($bytes)

# 2. Values you must provide.
$googleIds = Read-Host 'GOOGLE_CLIENT_IDS (press Enter for the default web client ID)'
if ([string]::IsNullOrWhiteSpace($googleIds)) {
  $googleIds = '493121609698-6u959iadmpqnoi7q7hvihh02153sttp5.apps.googleusercontent.com'
}
$brevoKey  = Read-Host 'BREVO_API_KEY (starts with xkeysib-)'
$emailFrom = Read-Host 'EMAIL_FROM (the sender email you verified in Brevo)'
$fromName  = Read-Host 'EMAIL_FROM_NAME (press Enter for TruTicket)'
if ([string]::IsNullOrWhiteSpace($fromName)) { $fromName = 'TruTicket' }

$lines = @(
  "OTP_HMAC_KEY=$otpKey",
  "GOOGLE_CLIENT_IDS=$($googleIds.Trim())",
  "BREVO_API_KEY=$($brevoKey.Trim())",
  "EMAIL_FROM=$($emailFrom.Trim())",
  "EMAIL_FROM_NAME=$($fromName.Trim())"
)

$envFile = Join-Path $env:TEMP 'truticket-auth-secrets.env'
try {
  [System.IO.File]::WriteAllLines($envFile, $lines)
  npx --yes supabase@2 secrets set --env-file $envFile --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed with code $LASTEXITCODE" }
  Write-Host 'Secrets saved on the project.' -ForegroundColor Green
}
finally {
  if (Test-Path $envFile) { Remove-Item $envFile -Force }
}
