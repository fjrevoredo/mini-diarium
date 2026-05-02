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
$validationFailed = $false

function Report-Mismatch {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath,
        [Parameter(Mandatory=$true)]
        [string]$Expected,
        [Parameter(Mandatory=$true)]
        [string]$Actual
    )
    Write-Host "${Red}❌ Version mismatch in $FilePath`: expected $Expected, found $Actual${Reset}"
    $script:validationFailed = $true
}

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
$cargoToml = $cargoToml -replace '(?m)^version\s*=\s*"\d+\.\d+\.\d+"', "version = `"$Version`""
Set-Content -Path $cargoTomlPath -Value $cargoToml -NoNewline

# 4. Update Cargo.lock
Write-Host "Updating src-tauri/Cargo.lock..."
Push-Location src-tauri
$null = cargo build --quiet 2>$null
if (-not $?) {
    $null = cargo check --quiet 2>$null
}
Pop-Location

# 5. Update website/index.html
Write-Host "Updating website/index.html..."
$websitePath = "website\index.html"
$releaseDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$website = Get-Content $websitePath -Raw
$website = $website -replace '<span class="app-version">\d+\.\d+\.\d+</span>', "<span class=`"app-version`">$Version</span>"
$website = $website -replace 'Mini-Diarium-\d+\.\d+\.\d+-(windows\.exe|macos\.dmg|linux\.AppImage)', "Mini-Diarium-$Version-`$1"
$website = $website -replace '"softwareVersion":\s*"[^"]*"', "`"softwareVersion`": `"$Version`""
$website = $website -replace '"dateModified":\s*"[^"]*"', "`"dateModified`": `"$releaseDate`""
Set-Content -Path $websitePath -Value $website -NoNewline

# 5b. Update website/encrypted-journal/index.html
Write-Host "Updating website/encrypted-journal/index.html..."
$encryptedJournalPath = "website\encrypted-journal\index.html"
$encryptedJournal = Get-Content $encryptedJournalPath -Raw
$encryptedJournal = $encryptedJournal -replace '"softwareVersion":\s*"[^"]*"', "`"softwareVersion`": `"$Version`""
$encryptedJournal = $encryptedJournal -replace '"dateModified":\s*"[^"]*"', "`"dateModified`": `"$releaseDate`""
Set-Content -Path $encryptedJournalPath -Value $encryptedJournal -NoNewline

# 6. Update README version badge
Write-Host "Updating README.md version badge..."
$readmePath = "README.md"
$readme = Get-Content $readmePath -Raw
$readme = $readme -replace 'version-\d+\.\d+\.\d+-', "version-$Version-"
Set-Content -Path $readmePath -Value $readme -NoNewline

# 7. Prepend release entry to metainfo.xml
Write-Host "Prepending release entry to data\linux\io.github.fjrevoredo.mini-diarium.metainfo.xml..."
$metainfoPath = "data\linux\io.github.fjrevoredo.mini-diarium.metainfo.xml"
$metainfo = Get-Content $metainfoPath -Raw
$releaseEntry = "    <release version=`"$Version`" date=`"$releaseDate`">`n      <url type=`"details`">https://github.com/fjrevoredo/mini-diarium/releases/tag/v$Version</url>`n    </release>"
$metainfo = $metainfo -replace "(<!-- New release entries are prepended here by bump-version.sh -->)", "`$1`n$releaseEntry"
Set-Content -Path $metainfoPath -Value $metainfo -NoNewline

# 8. Validate all versions
Write-Host "Validating version updates..."

$packageVersion = [regex]::Match((Get-Content $packageJsonPath -Raw), '"version"\s*:\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
$tauriVersion = [regex]::Match((Get-Content $tauriConfigPath -Raw), '"version"\s*:\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
$cargoVersion = [regex]::Match((Get-Content $cargoTomlPath -Raw), '(?m)^version\s*=\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
$readmeVersion = [regex]::Match((Get-Content $readmePath -Raw), 'version-(\d+\.\d+\.\d+)-').Groups[1].Value

if ($packageVersion -ne $Version) {
    Report-Mismatch -FilePath "package.json" -Expected $Version -Actual ($(if ($packageVersion) { $packageVersion } else { "<missing>" }))
}

if ($tauriVersion -ne $Version) {
    Report-Mismatch -FilePath "src-tauri\tauri.conf.json" -Expected $Version -Actual ($(if ($tauriVersion) { $tauriVersion } else { "<missing>" }))
}

if ($cargoVersion -ne $Version) {
    Report-Mismatch -FilePath "src-tauri\Cargo.toml" -Expected $Version -Actual ($(if ($cargoVersion) { $cargoVersion } else { "<missing>" }))
}

if ($readmeVersion -ne $Version) {
    Report-Mismatch -FilePath "README.md" -Expected $Version -Actual ($(if ($readmeVersion) { $readmeVersion } else { "<missing>" }))
}

$websiteMatches = [regex]::Matches((Get-Content $websitePath -Raw), '<span class="app-version">(\d+\.\d+\.\d+)</span>')
if ($websiteMatches.Count -eq 0) {
    Report-Mismatch -FilePath "website\index.html" -Expected $Version -Actual "<no app-version spans found>"
} else {
    $websiteMismatchValues = @(
        $websiteMatches |
            ForEach-Object { $_.Groups[1].Value } |
            Where-Object { $_ -ne $Version } |
            Sort-Object -Unique
    )
    if ($websiteMismatchValues.Count -gt 0) {
        Report-Mismatch -FilePath "website\index.html" -Expected $Version -Actual ($websiteMismatchValues -join ",")
    }
}

$websiteDownloadMatches = [regex]::Matches((Get-Content $websitePath -Raw), 'Mini-Diarium-(\d+\.\d+\.\d+)-(windows\.exe|macos\.dmg|linux\.AppImage)')
if ($websiteDownloadMatches.Count -gt 0) {
    $websiteDownloadMismatchValues = @(
        $websiteDownloadMatches |
            ForEach-Object { $_.Groups[1].Value } |
            Where-Object { $_ -ne $Version } |
            Sort-Object -Unique
    )
    if ($websiteDownloadMismatchValues.Count -gt 0) {
        Report-Mismatch -FilePath "website\index.html download URLs" -Expected $Version -Actual ($websiteDownloadMismatchValues -join ",")
    }
}

$websiteSoftwareVersion = [regex]::Match((Get-Content $websitePath -Raw), '"softwareVersion"\s*:\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
if ($websiteSoftwareVersion -ne $Version) {
    Report-Mismatch -FilePath "website\index.html softwareVersion" -Expected $Version -Actual ($(if ($websiteSoftwareVersion) { $websiteSoftwareVersion } else { "<missing>" }))
}

$encryptedJournalSoftwareVersion = [regex]::Match((Get-Content $encryptedJournalPath -Raw), '"softwareVersion"\s*:\s*"(\d+\.\d+\.\d+)"').Groups[1].Value
if ($encryptedJournalSoftwareVersion -ne $Version) {
    Report-Mismatch -FilePath "website\encrypted-journal\index.html softwareVersion" -Expected $Version -Actual ($(if ($encryptedJournalSoftwareVersion) { $encryptedJournalSoftwareVersion } else { "<missing>" }))
}

$encryptedJournalDateModified = [regex]::Match((Get-Content $encryptedJournalPath -Raw), '"dateModified"\s*:\s*"([^"]+)"').Groups[1].Value
if ($encryptedJournalDateModified -ne $releaseDate) {
    Report-Mismatch -FilePath "website\encrypted-journal\index.html dateModified" -Expected $releaseDate -Actual ($(if ($encryptedJournalDateModified) { $encryptedJournalDateModified } else { "<missing>" }))
}

$websiteDateModified = [regex]::Matches((Get-Content $websitePath -Raw), '"dateModified"\s*:\s*"([^"]+)"')
if ($websiteDateModified.Count -eq 0) {
    Report-Mismatch -FilePath "website\index.html dateModified" -Expected $releaseDate -Actual "<no dateModified found>"
} else {
    $websiteDateMismatchValues = @(
        $websiteDateModified |
            ForEach-Object { $_.Groups[1].Value } |
            Where-Object { $_ -ne $releaseDate } |
            Sort-Object -Unique
    )
    if ($websiteDateMismatchValues.Count -gt 0) {
        Report-Mismatch -FilePath "website\index.html dateModified" -Expected $releaseDate -Actual ($websiteDateMismatchValues -join ",")
    }
}

$metainfoRelease = [regex]::Match((Get-Content $metainfoPath -Raw), "<release version=`"$Version`"").Success
if (-not $metainfoRelease) {
    Report-Mismatch -FilePath "data\linux\io.github.fjrevoredo.mini-diarium.metainfo.xml" -Expected $Version -Actual "<release entry not found>"
}

if ($validationFailed) {
    Write-Host ""
    Write-Host "${Red}Version bump aborted: one or more files did not match $Version.${Reset}"
    exit 1
}

Write-Host ""
Write-Host "${Green}✅ Version updated in all files${Reset}"
Write-Host ""

# Show what changed
Write-Host "Changes:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html website/encrypted-journal/index.html README.md data\linux\io.github.fjrevoredo.mini-diarium.metainfo.xml | Select-Object -First 30

# Get current branch
$currentBranch = git branch --show-current

Write-Host ""
Write-Host "${Yellow}Next steps:${Reset}"
Write-Host "1. Review the changes above"
Write-Host "2. Commit: ${Green}git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md data\linux\io.github.fjrevoredo.mini-diarium.metainfo.xml; git commit -m `"chore: bump version to $Version`"${Reset}"
Write-Host "3. Push branch: ${Green}git push origin $currentBranch${Reset}"
Write-Host "4. Create PR to merge $currentBranch → master"
Write-Host "5. After PR is merged, checkout master and create tag:"
Write-Host "   ${Green}git checkout master; git pull; git tag -a v$Version -m `"Release v$Version`"; git push origin v$Version${Reset}"
Write-Host ""
Write-Host "${Yellow}⚠️  Important: Tag must be created on master AFTER the PR is merged!${Reset}"
