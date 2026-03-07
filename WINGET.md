This guide shows how to publish and automatically update Mini Diarium on WinGet using your NSIS EXE installer, GitHub releases, and a GitHub Actions workflow, with `fjrevoredo.MiniDiarium` as the package identifier.

## Prerequisites

- GitHub app repo: `https://github.com/fjrevoredo/mini-diarium`
- Windows releases use tags like `X.Y.Z` (for example `0.3.0`)
- Each Windows release has an installer asset named:
  - `Mini-Diarium-X.Y.Z-windows.exe`
- You have a Windows machine available for the initial submit
- You have the Windows Package Manager (`winget`) and can run PowerShell on Windows

## 1. One‑time GitHub and local setup

### 1.1 Create a GitHub personal access token (PAT)

1. Open GitHub in your browser.
2. Go to:
   - Your profile → Settings → Developer settings → Personal access tokens → Tokens (classic).
3. Create a new classic token:
   - Name: `winget-publish` (or similar).
   - Scope: **`public_repo`** (you do not need more for a public repo).
4. Copy the token value and store it securely.

You will:

- Use it once locally to submit the initial manifest.
- Store it as a repository secret (`WINGET_TOKEN`) for the GitHub Actions workflow.

### 1.2 Install WinGet and wingetcreate locally

On a Windows machine:

1. Ensure WinGet is available:
   - Open PowerShell.
   - Run: `winget --version`
   - If this fails, install **App Installer** from the Microsoft Store (this includes WinGet).
2. Download the `wingetcreate` tool:
   - In PowerShell, run:
     - `iwr https://aka.ms/wingetcreate/latest -OutFile wingetcreate.exe`
3. Keep `wingetcreate.exe` in a convenient folder (for example `C:\tools\wingetcreate`).

## 2. Initial submission of Mini Diarium to WinGet

This step creates the first WinGet manifest for `fjrevoredo.MiniDiarium` and opens a pull request in the central WinGet manifest repository. You only do this once.

### 2.1 Identify the installer URL

Pick your latest stable Windows release, for example with tag `0.3.0`, and the Windows asset:

- `Mini-Diarium-0.3.0-windows.exe`

The download URL will be:

- `https://github.com/fjrevoredo/mini-diarium/releases/download/0.3.0/Mini-Diarium-0.3.0-windows.exe`

Replace `0.3.0` with your actual version as needed.

### 2.2 Run `wingetcreate new` for the first version

1. Open PowerShell in the folder where `wingetcreate.exe` is located.
2. Run:
   - `.\wingetcreate.exe new https://github.com/fjrevoredo/mini-diarium/releases/download/0.3.0/Mini-Diarium-0.3.0-windows.exe`

3. When prompted, fill the fields along these lines:
   - PackageIdentifier: `fjrevoredo.MiniDiarium`
   - PackageVersion: `0.3.0`
   - PackageName: `Mini Diarium`
   - Publisher: `fjrevoredo` (or `MiniDiarium`)
   - Short description: something like `Encrypted, local-first journaling app`
   - License: the license from your repository (for example `MIT`, `GPL-3.0-only`, etc.)
   - Homepage: `https://mini-diarium.com` or the GitHub repo URL

4. At the end, the tool will ask whether to submit the manifest.
   - Choose to submit.
   - When prompted, enter your GitHub username.
   - When asked for a token, paste the PAT from step 1.1.

This opens a pull request against the community WinGet manifest repository with generated YAML manifests for `fjrevoredo.MiniDiarium`.

### 2.3 Wait for review and verify installation

1. Watch the pull request:
   - Fix any automated review comments if they appear (for example incorrect hash or metadata).
   - Push updates and resubmit if needed.
2. After the pull request is merged and the index updates, verify that WinGet can install the app:
   - Open PowerShell.
   - Run:
     - `winget search Mini Diarium`
     - `winget install fjrevoredo.MiniDiarium`
3. Confirm that:
   - WinGet downloads the correct EXE for your version.
   - The NSIS installer runs and installs Mini Diarium correctly.

Once this works, the package is live on WinGet and ready for automated updates.

## 3. Configure GitHub Actions for automatic WinGet updates

The goal is: every time you publish a new GitHub release for Mini Diarium with a tag like `X.Y.Z` and a Windows asset named `Mini-Diarium-X.Y.Z-windows.exe`, a workflow will automatically:

- Generate an updated manifest for `fjrevoredo.MiniDiarium`.
- Submit it as a pull request to the WinGet manifest repository.

### 3.1 Add the PAT as a repository secret

In the `fjrevoredo/mini-diarium` repository:

1. Go to:
   - Settings → Security → Secrets and variables → Actions.
2. Add a new repository secret:
   - Name: `WINGET_TOKEN`
   - Value: the PAT created in step 1.1.

### 3.2 Add the WinGet publish workflow

In `fjrevoredo/mini-diarium`, create a file:

- Path: `.github/workflows/winget-publish.yml`

Content (YAML):

```yaml
name: Publish to WinGet

permissions:
  contents: read

on:
  release:
    types: [released]

jobs:
  publish-winget:
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Determine version and asset
        id: prep
        shell: pwsh
        run: |
          # Extract tag from GITHUB_REF_NAME (format: v0.4.6)
          $tag = "${{ github.ref_name }}"
          # Strip 'v' prefix to get version (0.4.6)
          $version = $tag -replace '^v', ''

          # Construct asset name
          $assetName = "Mini-Diarium-$version-windows.exe"

          # Construct download URL
          $url = "https://github.com/fjrevoredo/mini-diarium/releases/download/$tag/$assetName"

          # Set outputs
          echo "version=$version" >> $env:GITHUB_OUTPUT
          echo "asset_name=$assetName" >> $env:GITHUB_OUTPUT
          echo "url=$url" >> $env:GITHUB_OUTPUT

      - name: Verify release asset exists
        shell: pwsh
        run: |
          $tag = "${{ github.ref_name }}"
          $assetName = "${{ steps.prep.outputs.asset_name }}"

          # Use gh CLI to check if asset exists
          gh release view "$tag" --json assets --jq '.assets[].name' --repo "fjrevoredo/mini-diarium" | Select-String -Pattern "$assetName" -Quiet
          if ($LASTEXITCODE -ne 0) {
            Write-Error "Asset $assetName not found in release $tag"
            exit 1
          }
        env:
          GH_TOKEN: ${{ github.token }}

      - name: Download wingetcreate tool
        shell: pwsh
        run: |
          iwr https://aka.ms/wingetcreate/latest -OutFile wingetcreate.exe
          if (-not (Test-Path wingetcreate.exe)) {
            Write-Error "Failed to download wingetcreate.exe"
            exit 1
          }

      - name: Submit WinGet manifest
        shell: pwsh
        env:
          WINGET_CREATE_GITHUB_TOKEN: ${{ secrets.WINGET_TOKEN }}
        run: |
          $version = "${{ steps.prep.outputs.version }}"
          $url = "${{ steps.prep.outputs.url }}"

          # Submit manifest to WinGet repo
          .\wingetcreate.exe update fjrevoredo.MiniDiarium --version $version --urls $url --submit

          if ($LASTEXITCODE -ne 0) {
            Write-Error "wingetcreate failed with exit code $LASTEXITCODE"
            exit 1
          }
```

Notes:

- The workflow triggers on `released` events only:
  - Drafts and pre‑releases do not trigger this workflow.
- It expects:
  - Tag name (for example `v0.4.6`) to be the version with a `v` prefix.
  - The `v` prefix is stripped automatically to get the version (e.g., `0.4.6`).
  - A Windows asset named exactly `Mini-Diarium-<version>-windows.exe`.
- The `--submit` flag automatically creates and opens a pull request to the WinGet repository.
- The environment variable `WINGET_CREATE_GITHUB_TOKEN` is used by `wingetcreate` for authentication, instead of passing the token as a command‑line argument.

## 4. Understanding the manifest (optional)

The installer manifest that gets generated will be conceptually similar to:

- `PackageIdentifier: fjrevoredo.MiniDiarium`
- `PackageVersion: 0.3.0`
- `InstallerType: exe`
- `Installers:`
- `  - Architecture: x64`
- `    InstallerUrl: https://github.com/fjrevoredo/mini-diarium/releases/download/0.3.0/Mini-Diarium-0.3.0-windows.exe`
- `    InstallerSha256: <sha256>`
- `    Scope: user`
- `    InstallerSwitches:`
- `      Silent: /S`
- `      SilentWithProgress: /S`
- `ManifestType: installer`
- `ManifestVersion: 1.6.0`

You can later tune the `InstallerSwitches` once you settle on NSIS flags for silent installs (if needed).

## 5. Normal WinGet release workflow

After everything is set up, your process for a new Windows version looks like:

1. Bump the app version to `X.Y.Z`.
2. Build the Windows NSIS installer:
   - `Mini-Diarium-X.Y.Z-windows.exe`.
3. Create a GitHub release in `fjrevoredo/mini-diarium`:
   - Tag: `X.Y.Z`.
   - Mark as a stable release (not a pre‑release).
   - Attach the installer asset `Mini-Diarium-X.Y.Z-windows.exe`.
4. Publish the release.
5. The WinGet workflow:
   - Runs automatically.
   - Finds the asset and constructs its URL.
   - Runs `wingetcreate update fjrevoredo.MiniDiarium ... --submit`.
   - Opens a pull request for the new version.
6. After the PR merges and the index refreshes, users can run:
   - `winget upgrade fjrevoredo.MiniDiarium`  
     to upgrade Mini Diarium via WinGet.
