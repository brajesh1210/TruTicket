# TruTicket Phase 5: start n8n on this PC (Docker) for the DEV project and load the 8 workflows.
# Run from the repo root:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-n8n-dev.ps1
# Safe to run twice. Secrets are typed in hidden prompts and never printed.
# Needs: Docker Desktop running, and infra\.env from set-chain-secrets-dev.ps1.

$ErrorActionPreference = 'Stop'

$DevRef = 'oviqjnzlgbkmggytaqao'
$ProdRef = 'ccqbubgebsayoviilnul'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$infra = Join-Path $repo 'infra'
$envFile = Join-Path $infra '.env'

if (-not (Test-Path $envFile)) {
  throw 'STOP: infra\.env not found. Run set-chain-secrets-dev.ps1 first.'
}

$lines = @([System.IO.File]::ReadAllLines($envFile))
$text = ($lines -join "`n")

if ($text -match $ProdRef) {
  throw 'STOP: infra\.env contains the PRODUCTION project ref. Do not continue.'
}
if ($text -notmatch ("SUPABASE_URL=https://" + $DevRef + "\.supabase\.co")) {
  throw 'STOP: SUPABASE_URL in infra\.env is not the DEV project (truticket-dev).'
}

function Test-Key([string]$name) {
  return [bool]($lines | Where-Object { $_ -match ('^' + $name + '=.+') })
}

function Read-Plain([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$newLines = New-Object System.Collections.Generic.List[string]
$newLines.AddRange([string[]]$lines)

if (-not (Test-Key 'BREVO_API_KEY')) {
  $brevo = (Read-Plain 'Paste the Brevo API key (hidden, from Brevo > SMTP & API): ').Trim()
  if (-not $brevo) { throw 'STOP: Brevo key is empty.' }
  $newLines.Add('BREVO_API_KEY=' + $brevo)
}
if (-not (Test-Key 'BREVO_SENDER_EMAIL')) {
  $sender = (Read-Host 'Type the verified Brevo sender email (e.g. noreply@yourdomain.com)').Trim()
  if (-not $sender) { throw 'STOP: sender email is empty.' }
  $newLines.Add('BREVO_SENDER_EMAIL=' + $sender)
}
if (-not (Test-Key 'N8N_USER')) {
  $newLines.Add('N8N_USER=admin')
}
if (-not (Test-Key 'N8N_PASSWORD')) {
  $chars = (48..57) + (65..90) + (97..122)
  $pw = -join ($chars | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  $newLines.Add('N8N_PASSWORD=' + $pw)
  Write-Host 'Made a new n8n login password. It is saved in infra\.env (N8N_PASSWORD). Open that file in Notepad to read it.' -ForegroundColor Yellow
}

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($envFile, $newLines.ToArray(), $utf8)

# Read the file again, so the checks below see the keys we just wrote.
$lines = @([System.IO.File]::ReadAllLines($envFile))

foreach ($k in @('SUPABASE_SERVICE_KEY', 'CHAIN_INTERNAL_SECRET', 'CHAIN_FUNCTION_URL', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'N8N_PASSWORD')) {
  if (-not (Test-Key $k)) { throw ('STOP: ' + $k + ' is still empty in infra\.env.') }
}
Write-Host 'infra\.env is complete (values hidden).' -ForegroundColor Green

docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'STOP: Docker is not running. Open Docker Desktop, wait until it says Running, then run this again.' }

Push-Location $infra
try {
  docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw 'STOP: docker compose up failed. Send the red text to Claude.' }

  $up = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri 'http://localhost:5678/healthz' -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { $up = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $up) { throw 'STOP: n8n did not answer on http://localhost:5678 within 2 minutes.' }

  docker compose exec -T -u node n8n n8n import:workflow --separate --input=/home/node/workflows
  if ($LASTEXITCODE -ne 0) { throw 'STOP: workflow import failed. Send the red text to Claude.' }

  docker compose exec -T -u node n8n n8n update:workflow --all --active=true
  if ($LASTEXITCODE -ne 0) { throw 'STOP: could not activate the workflows.' }

  docker compose restart n8n
  if ($LASTEXITCODE -ne 0) { throw 'STOP: n8n restart failed.' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'n8n is running with 8 TruTicket workflows (DEV).' -ForegroundColor Green
Write-Host 'Open http://localhost:5678 . Login: admin . Password: N8N_PASSWORD in infra\.env' -ForegroundColor Green
