# TruTicket Phase 3: set the blockchain secrets on the DEV project. Run ONCE (after deploy-amoy).
# Run from the repo root, in PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-chain-secrets-dev.ps1 -ProjectRef oviqjnzlgbkmggytaqao
#
# You will be asked to type/paste:
#   1. The Amoy TEST operator private key (hidden input). Same wallet you used for deploy-amoy.
#   2. The contract address from contracts\deployments\amoy.json (0x...).
#   3. The n8n-side service role key of the DEV project (hidden input), written to infra\.env for n8n.
# Generated here and never printed:
#   CHAIN_MASTER_SECRET   derives every user's custodial wallet. NEVER change it after the first mint.
#   CHAIN_INTERNAL_SECRET shared secret for n8n and scanner_verify -> chain function.
#
# Refuses to run twice (marker file). Use -Force only if you know tickets were not minted yet.

param(
  [Parameter(Mandatory = $true)] [string] $ProjectRef,
  [switch] $Force
)

$ErrorActionPreference = 'Stop'
$DevRef = 'oviqjnzlgbkmggytaqao'
if ($ProjectRef -eq 'ccqbubgebsayoviilnul') {
  throw 'STOP: ccqbubgebsayoviilnul is PRODUCTION. Nothing was set. This script never runs there.'
}
if ($ProjectRef -ne $DevRef) {
  throw "STOP: this script only runs on the dev project ($DevRef)."
}

$repo = Split-Path -Parent $PSScriptRoot
$marker = Join-Path $repo 'infra\.chain-secrets-set'
if ((Test-Path $marker) -and -not $Force) {
  throw 'STOP: chain secrets were already set on this PC. Changing CHAIN_MASTER_SECRET would make minted tickets unreachable. Use -Force only if no ticket was minted.'
}

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Read-Plain([string] $prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$opKey = Read-Plain 'Paste the Amoy TEST operator private key (input is hidden)'
if ($opKey -notmatch '^(0x)?[0-9a-fA-F]{64}$') { throw 'That does not look like a 64-character private key. Nothing was set.' }
if ($opKey -notmatch '^0x') { $opKey = '0x' + $opKey }

$contract = Read-Host 'Paste the contract address from contracts\deployments\amoy.json (0x...)'
if ($contract -notmatch '^0x[0-9a-fA-F]{40}$') { throw 'That is not a valid contract address. Nothing was set.' }

$serviceKey = Read-Plain 'Paste the DEV service_role key for n8n (input is hidden; Supabase > Settings > API Keys)'
if ($serviceKey.Length -lt 20) { throw 'Service key looks too short. Nothing was set.' }

$master = New-RandomSecret
$internal = New-RandomSecret
$fnUrl = "https://$DevRef.supabase.co/functions/v1/chain"

$envFile = Join-Path $env:TEMP 'truticket-chain-secrets.env'
try {
  $lines = @(
    "CHAIN_OPERATOR_KEY=$opKey",
    "CHAIN_CONTRACT_ADDRESS=$contract",
    "CHAIN_RPC_URL=https://polygon-amoy.drpc.org",
    "CHAIN_MASTER_SECRET=$master",
    "CHAIN_INTERNAL_SECRET=$internal",
    "CHAIN_FUNCTION_URL=$fnUrl"
  )
  [System.IO.File]::WriteAllLines($envFile, $lines)
  npx --yes supabase@2 secrets set --env-file $envFile --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed with code $LASTEXITCODE" }
} finally {
  if (Test-Path $envFile) { Remove-Item $envFile -Force }
  $opKey = $null
}

# Local env for the n8n container (docker compose reads infra\.env). Never commit this file.
$infraEnv = Join-Path $repo 'infra\.env'
[System.IO.File]::WriteAllLines($infraEnv, @(
  "CHAIN_INTERNAL_SECRET=$internal",
  "CHAIN_FUNCTION_URL=$fnUrl",
  "SUPABASE_URL=https://$DevRef.supabase.co",
  "SUPABASE_SERVICE_KEY=$serviceKey"
))
$serviceKey = $null
$internal = $null
$master = $null

New-Item -ItemType File -Path $marker -Force | Out-Null
Write-Host 'Chain secrets saved on DEV. Local n8n settings written to infra\.env (do not commit it).' -ForegroundColor Green
Write-Host "Next: npx --yes supabase@2 functions deploy chain --no-verify-jwt --use-api --project-ref $DevRef (or re-run deploy-functions.ps1)." -ForegroundColor Green
