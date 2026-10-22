param(
  [string] $OutputDirectory = "dist"
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:PKG_CACHE_PATH = Join-Path $PSScriptRoot 'pkg-cache'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm is required to build the hardware bridge.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
npx --yes @yao-pkg/pkg@5.16.1 bridge.js --targets node20-win-x64 --output (Join-Path $OutputDirectory 'MonaPOS-HardwareBridge.exe')
Copy-Item openCashDrawer.ps1 (Join-Path $OutputDirectory 'openCashDrawer.ps1') -Force
Copy-Item .env.example (Join-Path $OutputDirectory '.env.example') -Force
Copy-Item README.md (Join-Path $OutputDirectory 'README.md') -Force

Write-Host "Bridge package created in $((Resolve-Path $OutputDirectory).Path)"
