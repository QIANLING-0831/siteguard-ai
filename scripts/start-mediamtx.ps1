$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspace = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $workspace ".runtime\mediamtx\v1.19.3\mediamtx.exe"
$configPath = Join-Path $workspace "infra\mediamtx\mediamtx.yml"

if (-not (Test-Path -LiteralPath $exePath)) {
  throw "MediaMTX is not installed. Run pnpm camera:gateway:setup first."
}

& $exePath $configPath
