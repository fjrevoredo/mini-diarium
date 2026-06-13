param(
  [string]$Path = "docker/secrets/gui-password.txt",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedDir = Split-Path -Parent $Path
New-Item -ItemType Directory -Force -Path $resolvedDir | Out-Null

if ((Test-Path $Path) -and -not $Force) {
  Write-Host "GUI password secret already exists at $Path"
  exit 0
}

$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($bytes)
} finally {
  $rng.Dispose()
}
$secret = [Convert]::ToBase64String($bytes)

Set-Content -Path $Path -Value $secret -NoNewline -Encoding ascii

try {
  icacls $Path /inheritance:r | Out-Null
  icacls $Path /grant:r "$($env:USERNAME):(F)" | Out-Null
} catch {
  Write-Warning "Could not tighten NTFS ACLs automatically for $Path"
}

Write-Host "Created GUI password secret at $Path"
