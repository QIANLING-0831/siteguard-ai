$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function Get-Sha256([string] $Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

$assets = @(
    @{
        Name = "yolov8s-worldv2.pt"
        Destination = Join-Path $projectRoot "yolov8s-worldv2.pt"
        Sha256 = "9b2c17ab6124a913e9b3a5c170617920d91b0f01111a8479da69f00e2cf27792"
        Url = "https://github.com/QIANLING-0831/siteguard-ai/releases/download/model-weights-v1/yolov8s-worldv2.pt"
    },
    @{
        Name = "ViT-B-32.pt"
        Destination = Join-Path $projectRoot "weights\clip\ViT-B-32.pt"
        Sha256 = "40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af"
        Url = "https://openaipublic.azureedge.net/clip/models/40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af/ViT-B-32.pt"
    }
)

foreach ($asset in $assets) {
    $destination = $asset.Destination
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

    if (Test-Path -LiteralPath $destination) {
        $existingHash = Get-Sha256 $destination
        if ($existingHash -eq $asset.Sha256) {
            Write-Output "$($asset.Name) already exists and passed SHA-256 verification."
            continue
        }

        throw "$($asset.Name) already exists but its SHA-256 does not match. Remove or rename it before retrying."
    }

    $temporaryPath = "$destination.download"
    Write-Output "Downloading $($asset.Name)..."
    Invoke-WebRequest -Uri $asset.Url -OutFile $temporaryPath

    $downloadHash = Get-Sha256 $temporaryPath
    if ($downloadHash -ne $asset.Sha256) {
        Remove-Item -LiteralPath $temporaryPath -Force
        throw "SHA-256 verification failed for $($asset.Name)."
    }

    Move-Item -LiteralPath $temporaryPath -Destination $destination
    Write-Output "Saved $($asset.Name) and verified SHA-256."
}

Write-Output "Model weights are ready."
