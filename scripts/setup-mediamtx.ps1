$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$version = "v1.19.3"
$workspace = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $workspace ".runtime\mediamtx\$version"
$downloadDir = Join-Path $workspace ".runtime\downloads"
$assetName = "mediamtx_${version}_windows_amd64.zip"
$zipPath = Join-Path $downloadDir $assetName
$checksumsPath = Join-Path $downloadDir "mediamtx-$version-checksums.sha256"
$releaseBase = "https://github.com/bluenviron/mediamtx/releases/download/$version"

New-Item -ItemType Directory -Force -Path $runtimeDir, $downloadDir | Out-Null

if (-not (Test-Path -LiteralPath $zipPath)) {
  Invoke-WebRequest -Uri "$releaseBase/$assetName" -OutFile $zipPath
}
if (-not (Test-Path -LiteralPath $checksumsPath)) {
  Invoke-WebRequest -Uri "$releaseBase/checksums.sha256" -OutFile $checksumsPath
}

$expectedLine = Get-Content -LiteralPath $checksumsPath | Where-Object {
  $_ -match [regex]::Escape($assetName)
}
if (-not $expectedLine) {
  throw "Checksum entry not found for $assetName"
}

$expected = ($expectedLine -split "\s+")[0].ToUpperInvariant()
$actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actual -ne $expected) {
  throw "Checksum mismatch for $assetName"
}

$exePath = Join-Path $runtimeDir "mediamtx.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
  Expand-Archive -LiteralPath $zipPath -DestinationPath $runtimeDir
}

& $exePath --version
Write-Output "MediaMTX is ready at $runtimeDir"
