<#
.SYNOPSIS
    Stage the Mini Diarium MSIX payload and (optionally) pack it into a .msix.

.DESCRIPTION
    Assembles a complete MSIX payload under msix\dist\ from an already-built Tauri
    release, stamping the release version into a copy of msix\Package.appxmanifest.

    This is the single source of truth for MSIX payload assembly, used both for local
    smoke testing and by .github\workflows\msstore-publish.yml. Run `bun run tauri build`
    (release) BEFORE this script — it does not build the app itself.

    The payload must contain everything Tauri lays down next to the installed binary,
    not just the .exe (the common MSIX-from-Tauri mistake):
      * mini-diarium.exe
      * any DLLs Tauri emits next to the exe (e.g. WebView2Loader.dll, if present)
      * the bundled fonts, in the SAME layout Tauri resolves at runtime
      * the Store/tile icon assets

    VERSION: MSIX requires a 4-part version. X.Y.Z is mapped to X.Y.Z.0 and written into
    the staged manifest's Identity/@Version. The committed manifest keeps a placeholder
    version; this script never edits the committed file.

.PARAMETER Version
    Release version as X.Y.Z (a leading 'v' and a trailing '.0' are both tolerated).

.PARAMETER Build
    Run `bun run tauri build --no-bundle` first to produce a frontend-embedded release
    binary. CRITICAL: the packaged exe MUST come from a Tauri build, not a bare
    `cargo build`/`cargo test` — a cargo-only binary has no embedded frontend and the
    packaged app falls back to the dev URL (http://localhost:1420), failing with
    ERR_CONNECTION_REFUSED. Use -Build (or run the Tauri build yourself) whenever the
    release exe might be stale or cargo-produced.

.PARAMETER Pack
    After staging, invoke `winapp pack` to produce the .msix. Requires the winapp CLI
    (winget install microsoft.winappcli) and a real identity in the manifest.

.PARAMETER CertPath
    Path to a dev-signing .pfx for `-Pack` (local testing only; the Store re-signs on
    submission). Defaults to msix\dist\devcert.pfx, generated via `winapp cert generate`
    if it does not exist. Ignored when packing for Store submission (leave the package
    unsigned; the Store signs it).

.PARAMETER Unsigned
    With -Pack, produce an UNSIGNED .msix (for Store submission). Mutually exclusive
    with signing via -CertPath.

.EXAMPLE
    pwsh ./scripts/build-msix.ps1 -Version 0.6.2 -Pack
    Stage + pack a dev-signed MSIX for local Add-AppxPackage testing.

.EXAMPLE
    pwsh ./scripts/build-msix.ps1 -Version 0.6.2 -Pack -Unsigned
    Stage + pack an unsigned MSIX for Store submission (CI path).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [switch]$Build,

    [switch]$Pack,

    [string]$CertPath,

    [switch]$Unsigned
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- Paths -----------------------------------------------------------------
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$MsixDir    = Join-Path $RepoRoot 'msix'
$DistDir    = Join-Path $MsixDir 'dist'
$ManifestSrc = Join-Path $MsixDir 'Package.appxmanifest'
$ReleaseDir = Join-Path $RepoRoot 'src-tauri\target\release'
$FontsDir   = Join-Path $RepoRoot 'fonts'
$IconsDir   = Join-Path $RepoRoot 'src-tauri\icons'
$ExeName    = 'mini-diarium.exe'

# Tauri resolves the `../fonts/*.ttf` resource glob (declared in tauri.conf.json)
# through BaseDirectory::Resource, which normalizes the leading `..` to an `_up_`
# folder next to the exe. The runtime lookup in commands/fonts.rs
# (`resolve("../fonts", BaseDirectory::Resource)`) mirrors that normalization, so the
# fonts MUST land at <payload>\_up_\fonts\. If fonts fail to load from a packed MSIX,
# inspect the layout Tauri produces under target\release\bundle and correct this path.
$FontsSubPath = '_up_\fonts'

# --- Version ---------------------------------------------------------------
$v = $Version.TrimStart('v')
$parts = $v.Split('.')
if ($parts.Count -eq 4 -and $parts[3] -eq '0') { $parts = $parts[0..2] }
if ($parts.Count -ne 3) {
    throw "Version must be X.Y.Z (got '$Version')."
}
foreach ($p in $parts) {
    if ($p -notmatch '^\d+$') { throw "Version component '$p' is not numeric (got '$Version')." }
}
$FourPart = "$($parts -join '.').0"
Write-Host "MSIX version: $FourPart" -ForegroundColor Cyan

# --- Build (optional) ------------------------------------------------------
if ($Build) {
    Write-Host "Running 'bun run tauri build --no-bundle' (embeds the frontend)..." -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
        bun run tauri build --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "tauri build failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

# --- Preconditions ---------------------------------------------------------
$ExePath = Join-Path $ReleaseDir $ExeName
if (-not (Test-Path $ExePath)) {
    throw "Release binary not found: $ExePath`nRun with -Build, or 'bun run tauri build' first."
}

# Reminder: the exe MUST be a Tauri build (embedded frontend), not a bare cargo build —
# a cargo-only binary navigates to the dev URL and the packaged app fails with
# ERR_CONNECTION_REFUSED. mtime can't reliably distinguish the two (a real tauri build
# also compiles the exe after the frontend), so there is no auto-detect here; pass -Build
# when in doubt.
if (-not $Build) {
    Write-Host "Using existing release exe (built $((Get-Item $ExePath).LastWriteTime)). If the packaged app shows a localhost error, re-run with -Build." -ForegroundColor DarkYellow
}

# --- Clean + stage payload -------------------------------------------------
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null

Write-Host "Staging exe + DLLs..." -ForegroundColor Cyan
Copy-Item $ExePath (Join-Path $DistDir $ExeName)
# Ship any DLLs Tauri emits directly next to the exe (non-recursive; deps\ is excluded).
Get-ChildItem -Path $ReleaseDir -Filter '*.dll' -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $DistDir $_.Name)
    Write-Host "  + $($_.Name)"
}

Write-Host "Staging fonts -> $FontsSubPath ..." -ForegroundColor Cyan
$FontsDest = Join-Path $DistDir $FontsSubPath
New-Item -ItemType Directory -Path $FontsDest -Force | Out-Null
$fontFiles = Get-ChildItem -Path $FontsDir -Filter '*.ttf' -File
if ($fontFiles.Count -eq 0) { throw "No .ttf fonts found in $FontsDir" }
$fontFiles | ForEach-Object { Copy-Item $_.FullName (Join-Path $FontsDest $_.Name) }
Write-Host "  + $($fontFiles.Count) fonts"

Write-Host "Staging Store/tile assets..." -ForegroundColor Cyan
$AssetsDest = Join-Path $DistDir 'Assets'
New-Item -ItemType Directory -Path $AssetsDest -Force | Out-Null
# Manifest references these exact names; the Tauri icon generator produces them.
$requiredAssets = @(
    'StoreLogo.png',
    'Square44x44Logo.png',
    'Square71x71Logo.png',
    'Square150x150Logo.png'
)
foreach ($asset in $requiredAssets) {
    $src = Join-Path $IconsDir $asset
    if (-not (Test-Path $src)) {
        throw "Missing tile asset '$asset' in $IconsDir. Regenerate via the update-app-icons runbook."
    }
    Copy-Item $src (Join-Path $AssetsDest $asset)
}
Write-Host "  + $($requiredAssets.Count) assets"

# --- Stamp manifest --------------------------------------------------------
Write-Host "Staging manifest with version $FourPart..." -ForegroundColor Cyan
$manifest = Get-Content $ManifestSrc -Raw
$manifest = $manifest -replace '(<Identity[^>]*?\bVersion=")[^"]*(")', "`${1}$FourPart`${2}"
# winapp pack reads Package.appxmanifest from the payload root (same name `winapp init`
# emits). If you fall back to the raw SDK `makeappx pack`, rename this to AppxManifest.xml.
Set-Content -Path (Join-Path $DistDir 'Package.appxmanifest') -Value $manifest -NoNewline -Encoding UTF8

Write-Host "Payload staged at: $DistDir" -ForegroundColor Green
Write-Host "Smoke-test before packing:  $DistDir\$ExeName" -ForegroundColor Yellow

# --- Pack ------------------------------------------------------------------
if (-not $Pack) {
    Write-Host "Staging only (no -Pack). Done." -ForegroundColor Green
    return
}

# A package with placeholder identity is uninstallable (Add-AppxPackage) and unsubmittable.
# The guard lives here, not in staging, so the payload can still be assembled and the app
# run directly from dist\ to verify completeness before identity is filled in.
$stagedManifest = Get-Content (Join-Path $DistDir 'Package.appxmanifest') -Raw
if ($stagedManifest -match '__PARTNER_CENTER_') {
    throw @"
Package.appxmanifest still contains placeholder identity tokens.
Fill Identity/@Name, Identity/@Publisher, and PublisherDisplayName from Partner Center
(see msix/README.md) before packing.
"@
}

if (-not (Get-Command winapp -ErrorAction SilentlyContinue)) {
    throw "winapp CLI not found. Install with: winget install microsoft.winappcli"
}

# winapp CLI surface verified against winapp 0.4.0 (`winapp package --help`):
#   * `winapp package <folder>` (alias `pack`); manifest auto-detected from the folder.
#   * `--output <path>` sets the exact .msix path; `--cert <pfx>` auto-signs.
#   * Output path must be OUTSIDE the packed content dir, so it lands in msix\ then moves
#     to msix\dist\ for a deterministic, CI-friendly location.
$ManifestPath = Join-Path $DistDir 'Package.appxmanifest'
$StagingMsix  = Join-Path $MsixDir "MiniDiarium_${FourPart}_x64.msix"
$FinalMsix    = Join-Path $DistDir "MiniDiarium_${FourPart}_x64.msix"

if ($Unsigned) {
    # Store-submission path: leave the package unsigned; the Store signs it.
    Write-Host "Packing UNSIGNED MSIX for Store submission..." -ForegroundColor Cyan
    winapp package $DistDir --manifest $ManifestPath --output $StagingMsix --verbose
    if ($LASTEXITCODE -ne 0) { throw "winapp package failed with exit code $LASTEXITCODE" }
} else {
    # Local test path: generate a dev cert whose publisher matches the manifest (pass
    # --manifest explicitly — cert generate only auto-infers from the CWD manifest, and
    # ours lives in dist\). Then sign. The Store re-signs on submission; this cert is
    # local-only.
    if (-not $CertPath) { $CertPath = Join-Path $MsixDir 'devcert.pfx' }
    Write-Host "Generating dev certificate (publisher from manifest)..." -ForegroundColor Cyan
    winapp cert generate --manifest $ManifestPath --output $CertPath --if-exists overwrite --export-cer
    if ($LASTEXITCODE -ne 0) { throw "winapp cert generate failed with exit code $LASTEXITCODE" }
    Write-Host "Packing dev-signed MSIX (cert: $CertPath)..." -ForegroundColor Cyan
    winapp package $DistDir --manifest $ManifestPath --cert $CertPath --output $StagingMsix --verbose
    if ($LASTEXITCODE -ne 0) { throw "winapp package failed with exit code $LASTEXITCODE" }
}

Move-Item $StagingMsix $FinalMsix -Force
Write-Host "Packed: $FinalMsix" -ForegroundColor Green
if (-not $Unsigned) {
    Write-Host "Dev cert: $CertPath" -ForegroundColor Yellow
    Write-Host "Trust it once (elevated):  winapp cert install `"$CertPath`"" -ForegroundColor Yellow
    Write-Host "Then install:              Add-AppxPackage `"$FinalMsix`"" -ForegroundColor Yellow
}
