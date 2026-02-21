#!/usr/bin/env pwsh
#requires -version 5.1

param(
    [Parameter(Mandatory=$false)]
    [string]$Version
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

# Check if version argument is provided
if (-not $Version) {
    Write-Host "${Red}❌ Error: Version number required${Reset}"
    Write-Host "Usage: .\bump-version.ps1 <version>"
    Write-Host "Example: .\bump-version.ps1 0.1.1"
    exit 1
}

# Validate version format (X.Y.Z)
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "${Red}❌ Error: Invalid version format${Reset}"
    Write-Host "Version must be in format X.Y.Z (e.g., 0.1.1)"
    exit 1
}

Write-Host "${Yellow}📦 Bumping version to $Version...${Reset}"
Write-Host ""

# 1. Update package.json
Write-Host "Updating package.json..."
$packageJsonPath = "package.json"
$packageJson = Get-Content $packageJsonPath -Raw
$packageJson = $packageJson -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`""
Set-Content -Path $packageJsonPath -Value $packageJson -NoNewline

# 2. Update tauri.conf.json
Write-Host "Updating src-tauri/tauri.conf.json..."
$tauriConfigPath = "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content $tauriConfigPath -Raw
$tauriConfig = $tauriConfig -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`""
Set-Content -Path $tauriConfigPath -Value $tauriConfig -NoNewline

# 3. Update Cargo.toml
Write-Host "Updating src-tauri/Cargo.toml..."
$cargoTomlPath = "src-tauri\Cargo.toml"
$cargoToml = Get-Content $cargoTomlPath -Raw
$cargoToml = $cargoToml -replace '^version\s*=\s*"\d+\.\d+\.\d+"', "version = `"$Version`""  -replace '(?m)^version\s*=\s*"\d+\.\d+\.\d+"', "version = `"$Version`""
Set-Content -Path $cargoTomlPath -Value $cargoToml -NoNewline

# 4. Update Cargo.lock
Write-Host "Updating src-tauri/Cargo.lock..."
Push-Location src-tauri
$null = cargo build --quiet 2>$null
if (-not $?) {
    $null = cargo check --quiet 2>$null
}
Pop-Location

# 5. Update README version badge
Write-Host "Updating README.md version badge..."
$readmePath = "README.md"
$readme = Get-Content $readmePath -Raw
$readme = $readme -replace 'version-\d+\.\d+\.\d+-', "version-$Version-"
Set-Content -Path $readmePath -Value $readme -NoNewline

Write-Host ""
Write-Host "${Green}✅ Version updated in all files${Reset}"
Write-Host ""

# Show what changed
Write-Host "Changes:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock README.md | Select-Object -First 30

# Get current branch
$currentBranch = git branch --show-current

Write-Host ""
Write-Host "${Yellow}Next steps:${Reset}"
Write-Host "1. Review the changes above"
Write-Host "2. Commit: ${Green}git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock README.md; git commit -m `"chore: bump version to $Version`"${Reset}"
Write-Host "3. Push branch: ${Green}git push origin $currentBranch${Reset}"
Write-Host "4. Create PR to merge $currentBranch → master"
Write-Host "5. After PR is merged, checkout master and create tag:"
Write-Host "   ${Green}git checkout master; git pull; git tag -a v$Version -m `"Release v$Version`"; git push origin v$Version${Reset}"
Write-Host ""
Write-Host "${Yellow}⚠️  Important: Tag must be created on master AFTER the PR is merged!${Reset}"
