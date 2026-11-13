# Deploys the TruTicket contract to Polygon Amoy (TESTNET ONLY).
# The private key is typed at the prompt. It is kept in memory for this run only:
# it is never written to a file and never printed.
#
# Run from the TruTicket folder:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-amoy.ps1
#
# Needs: Node 20+, the contracts folder installed (npm install), and test MATIC in the wallet.

param(
    [string] $RpcUrl = "https://polygon-amoy.drpc.org"
)

$ErrorActionPreference = "Stop"

# The default RPC is used because rpc-amoy.polygon.technology does not resolve on some networks (DNS error).
$env:POLYGON_AMOY_RPC_URL = $RpcUrl

$secure = Read-Host "Paste the Amoy TEST wallet private key (input is hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ($plain -notmatch '^(0x)?[0-9a-fA-F]{64}$') {
        throw "That does not look like a 64-character private key. Nothing was deployed."
    }
    if ($plain -notmatch '^0x') { $plain = "0x" + $plain }
    $env:POLYGON_AMOY_PRIVATE_KEY = $plain
    Push-Location (Join-Path $PSScriptRoot "..\contracts")
    try {
        npx hardhat run scripts/deploy.js --network amoy
        if ($LASTEXITCODE -ne 0) { throw "Deploy failed (exit $LASTEXITCODE). See the messages above." }
        Write-Host ""
        Write-Host "Done. The address is in contracts\deployments\amoy.json. Send it to the backend setup step." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} finally {
    Remove-Variable plain -ErrorAction SilentlyContinue
    Remove-Item Env:\POLYGON_AMOY_PRIVATE_KEY -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
