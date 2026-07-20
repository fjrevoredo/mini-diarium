#!/usr/bin/env pwsh
# check-no-network.ps1 — CI static check for network-capable APIs.
# Exits 0 if the codebase is clean, non-zero if any forbidden pattern is found.
# Runs with pwsh (PowerShell 7) on Windows, macOS, and Linux.

$ErrorActionPreference = 'Continue'
$failed = $false

function Fail([string]$msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    $script:failed = $true
}

function Ok([string]$msg) {
    Write-Host "OK:   $msg" -ForegroundColor Green
}

# ── 1. Rust: no network-capable crates in any workspace manifest ─────────────
# Dependencies are split across two crates: the app crate (src-tauri/Cargo.toml)
# and the Tauri-free business layer (crates/mini-diarium-core/Cargo.toml), which
# now holds the crypto/db/import/export deps. Scan BOTH so the no-network
# guarantee spans the whole workspace, not just the app crate.
$cargoManifests = @(
    (Join-Path $PSScriptRoot ".." "src-tauri" "Cargo.toml"),
    (Join-Path $PSScriptRoot ".." "crates" "mini-diarium-core" "Cargo.toml")
)
$networkCrates = 'reqwest|hyper|ureq|isahc|curl|native-tls|rustls|tokio-tungstenite|tauri-plugin-http|tauri-plugin-updater|tauri-plugin-websocket'
foreach ($cargoToml in $cargoManifests) {
    $matches = Select-String -Path $cargoToml -Pattern $networkCrates -ErrorAction SilentlyContinue
    if ($matches) {
        foreach ($m in $matches) { Fail "Forbidden network crate in ${cargoToml}: $($m.Line.Trim())" }
    } else {
        Ok "No forbidden network crates in $cargoToml"
    }
}

# ── 2. Frontend: no raw network APIs outside the isolation script ────────────
$srcDir = Join-Path $PSScriptRoot ".." "src"
$isolationFile = Join-Path $srcDir "lib" "network-isolation-script.ts"
$resolvedIsolationPath = (Resolve-Path $isolationFile -ErrorAction SilentlyContinue).Path
$sourceFiles = Get-ChildItem -Path $srcDir -Recurse -Include "*.ts","*.tsx"
$checkedFiles = $sourceFiles | Where-Object { $_.FullName -ne $resolvedIsolationPath }

# Patterns forbidden everywhere except the isolation script itself
$networkPatterns = @(
    'new WebSocket\(',
    'new EventSource\(',
    'navigator\.sendBeacon\('
)
foreach ($pattern in $networkPatterns) {
    $hits = $checkedFiles | Select-String -Pattern $pattern -ErrorAction SilentlyContinue
    if ($hits) {
        foreach ($h in $hits) { Fail "Forbidden network API ($pattern) in $($h.Filename):$($h.LineNumber)" }
    } else {
        Ok "No '$pattern' outside isolation script"
    }
}

# External fetches are forbidden. Local asset fetches (for example '/notifications.json')
# remain allowed.
$externalFetchPatterns = @(
    'fetch\(\s*["'']https?://',
    'fetch\(\s*`https?://',
    'fetch\(\s*["'']//',
    'fetch\(\s*`//'
)
foreach ($pattern in $externalFetchPatterns) {
    $hits = $checkedFiles | Select-String -Pattern $pattern -ErrorAction SilentlyContinue
    if ($hits) {
        foreach ($h in $hits) { Fail "Forbidden external fetch pattern ($pattern) in $($h.Filename):$($h.LineNumber)" }
    } else {
        Ok "No external fetch pattern '$pattern'"
    }
}

# ── 3. Capabilities: no http:, websocket: permissions ────────────────────────
$capDir = Join-Path $PSScriptRoot ".." "src-tauri" "capabilities"
if (Test-Path $capDir) {
    $capHits = Get-ChildItem -Path $capDir -Recurse -Include "*.json" |
        Select-String -Pattern '"http:|"websocket:' -ErrorAction SilentlyContinue
    if ($capHits) {
        foreach ($h in $capHits) { Fail "Forbidden capability ($($h.Matches[0].Value)) in $($h.Filename)" }
    } else {
        Ok "No http:/websocket: capabilities"
    }
}

# ── Result ───────────────────────────────────────────────────────────────────
if ($failed) {
    Write-Host "`nNetwork isolation check FAILED." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nNetwork isolation check passed." -ForegroundColor Green
    exit 0
}
