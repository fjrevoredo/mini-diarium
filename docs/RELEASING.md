# Release Guide

Simple step-by-step instructions for creating a new Mini Diarium release.

---

## Pre-Release Checklist

Before starting the release process:

- [ ] All planned features/fixes are merged to `master`
- [ ] All tests passing (`cargo test` and `bun run test:run`)
- [ ] Run `cargo audit` — no known vulnerabilities in Rust dependencies
  ```bash
  cargo install cargo-audit  # one-time install
  cargo audit
  ```
- [ ] CI/CD pipeline passing on master
- [ ] No known P0/P1 bugs
- [ ] CHANGELOG.md updated with release notes
- [ ] Create `latest-changelog.md` from `latest-changelog.example.md` and fill it with the exact release body to publish
- [ ] Philosophy alignment reviewed for unreleased changelog items against `PHILOSOPHY.md`
  - Confirm each unreleased `CHANGELOG.md` item still fits the six philosophy principles: core vs extension, security impact, testability, portability, focused scope, and simplicity cost
  - If any item introduces a tradeoff or drift risk, record it explicitly in the release PR description or a dedicated audit note before tagging the release

---

## Release Process

### Step 1: Create Release Branch

```bash
# Create a new branch from master
git checkout master
git pull
git checkout -b release-0.1.1
```

### Step 2: Bump Version

Run the version bump script:

**Linux/macOS:**

```bash
./bump-version.sh 0.1.1
```

**Windows (PowerShell):**

```powershell
.\bump-version.ps1 0.1.1
```

This automatically updates:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `website/index.html` version badge, structured-data `softwareVersion`, and direct website download URLs

### Step 3: Prepare the Release Notes File

Create `latest-changelog.md` from the template and replace all placeholder text:

```bash
cp latest-changelog.example.md latest-changelog.md
```

The workflow publishes this file verbatim as the GitHub release body, so it must contain the exact notes you want users and WinGet to receive.

### Step 4: Commit and Push Branch

```bash
# Commit version bump and release notes
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md latest-changelog.md
git commit -m "chore: bump version to 0.1.1"

# Push branch
git push origin release-0.1.1
```

### Step 5: Create Pull Request

1. Go to: https://github.com/fjrevoredo/mini-diarium/pulls
2. Click "New pull request"
3. Base: `master` ← Compare: `release-0.1.1`
4. Title: "Release v0.1.1"
5. Add release notes in description
6. Create and merge the PR

### Step 6: Tag the Release (After PR Merged)

```bash
# Switch to master and pull the merged changes
git checkout master
git pull

# Create and push tag
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

**⚠️ Important**: The tag MUST be created on `master` after the PR is merged, not on the release branch!

### Step 7: Monitor Release Workflow

1. Go to: https://github.com/fjrevoredo/mini-diarium/actions
2. Wait for "Release" workflow to complete (~15-20 minutes)
3. Workflow will:
   - Validate `latest-changelog.md`
   - Create a draft GitHub release using `latest-changelog.md` as the release body
   - Build for Linux, macOS, Windows
   - Upload installers and checksums to the draft release
   - Publish the release automatically after all expected assets are present
   - Open a cleanup PR removing `latest-changelog.md` if it still matches the tagged release copy

### Step 8: Verify the Published Release

1. Go to: https://github.com/fjrevoredo/mini-diarium/releases
2. Open the published release for v0.1.1
3. Confirm the release notes exactly match `latest-changelog.md`
4. Confirm all installers and checksum files are attached
5. Confirm the cleanup PR was opened unless `latest-changelog.md` had already changed on `master`
6. Merge the cleanup PR so the next release must create a fresh `latest-changelog.md`

---

## Post-Release

After publishing:

- [ ] Verify the direct website installer URLs match the published release assets
  ```bash
  ./scripts/website-release-urls.sh
  ```
- [ ] In Google Search Console, inspect `https://mini-diarium.com/` and click "Request indexing"
- [ ] Optionally ping IndexNow if you have a configured key
  ```bash
  INDEXNOW_KEY=your-key ./scripts/ping-indexnow.sh https://mini-diarium.com/
  ```
- [ ] Confirm production hosting still redirects `https://www.mini-diarium.com/` to `https://mini-diarium.com/`
- [ ] Confirm Cloudflare is not injecting the invalid `Content-Signal` directive into `robots.txt`
- [ ] Test installers on each platform (Windows, macOS, Linux)
- [ ] Announce release (if applicable)
- [ ] Close related GitHub issues/PRs
- [ ] Update project board/milestones

### Search Discovery Notes

- Search Console submission is still manual. Keep it in the release checklist for every public release.
- `scripts/ping-indexnow.sh` is optional and only works if you have an IndexNow key provisioned for `mini-diarium.com`.
- Production is served as static content on Coolify. Docker/nginx files in `website/` are local/dev parity references, not the production control plane.
- Keep production cache rules aligned with the site assumptions:
  - static assets (`css`, `js`, `png`, `jpg`, `svg`, `ico`, `woff2`, `mp4`, `webm`) should be cached for 1 year with `immutable`
  - HTML should remain non-cached
- Cloudflare-specific ops:
  - disable `robots.txt` Content Signals injection, or move the AI-training policy to a supported header such as `X-Robots-Tag`
  - keep any Cloudflare canonical-host redirect rules aligned with apex `https://mini-diarium.com/`

---

## Version Numbering

Mini Diarium uses [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes, major rewrites
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, minor improvements

**Examples:**

- Bug fix: `0.1.0` → `0.1.1`
- New feature: `0.1.1` → `0.2.0`
- Breaking change: `0.9.0` → `1.0.0`

---

## Troubleshooting

### "Resource not accessible by integration"

- **Cause**: Missing permissions in workflow
- **Fix**: Ensure `.github/workflows/release.yml` has `permissions: contents: write`

### Release workflow fails on artifact upload

- **Cause**: Build artifacts not found
- **Fix**: Check Tauri build succeeded for all platforms in workflow logs

### Tag already exists

```bash
# Delete local tag
git tag -d v0.1.1

# Delete remote tag
git push origin :refs/tags/v0.1.1

# Recreate tag
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

### Need to cancel/redo a release

1. Delete the GitHub release on GitHub
2. Delete the tag (see above)
3. Fix any issues
4. Start from Step 2 (commit changes if needed)

---

## Quick Reference

**Full release workflow (Linux/macOS):**

```bash
# 1. Create release branch
git checkout master && git pull && git checkout -b release-X.Y.Z

# 2. Bump version
./bump-version.sh X.Y.Z

# 3. Create release notes from the template
cp latest-changelog.example.md latest-changelog.md

# 4. Commit and push branch
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md latest-changelog.md
git commit -m "chore: bump version to X.Y.Z"
git push origin release-X.Y.Z

# 5. Create PR on GitHub: release-X.Y.Z → master

# 6. After PR merged, tag on master
git checkout master && git pull
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 7. Wait for GitHub Actions → publish the release automatically
```

**Full release workflow (Windows PowerShell):**

```powershell
# 1. Create release branch
git checkout master; git pull; git checkout -b release-X.Y.Z

# 2. Bump version
.\bump-version.ps1 X.Y.Z

# 3. Create release notes from the template
Copy-Item latest-changelog.example.md latest-changelog.md

# 4. Commit and push branch
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md latest-changelog.md
git commit -m "chore: bump version to X.Y.Z"
git push origin release-X.Y.Z

# 5. Create PR on GitHub: release-X.Y.Z → master

# 6. After PR merged, tag on master
git checkout master; git pull
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 7. Wait for GitHub Actions → publish the release automatically
```

---

## Automated by Release Workflow

The following happens automatically when you push a tag:

✅ Build for all platforms (Linux x64, macOS universal, Windows x64)
✅ Generate installers (.AppImage, .deb, .dmg, .msi, .exe)
✅ Calculate SHA256 checksums for all artifacts
✅ Create draft GitHub release from `latest-changelog.md`
✅ Upload artifacts to the draft release
✅ Publish the release automatically after artifact verification
✅ Open a cleanup PR removing `latest-changelog.md` when it is safe to do so
✅ Dispatch WinGet, Homebrew, and Flathub publish workflows

You only need to:

1. Bump version
2. Create and commit `latest-changelog.md` from `latest-changelog.example.md`
3. Push tag
4. Verify the published release and merge the cleanup PR

---

## Automated WinGet Publishing

When the release workflow publishes a release, an additional workflow automatically:

✅ Generates WinGet manifests with pinned `wingetcreate` `1.12.x`
✅ Adds `ReleaseNotes` and `ReleaseNotesUrl` from the published GitHub release body
✅ Submits WinGet manifest update to `microsoft/winget-pkgs`
✅ Opens a pull request for the new version
✅ Package identifier: `fjrevoredo.MiniDiarium`

**Requirements:**

- Repository secret `WINGET_TOKEN` must be configured (one-time setup)
- Windows asset `Mini-Diarium-X.Y.Z-windows.exe` must be in the release
- Published GitHub release body must not be empty

**After the release:**

1. WinGet PR will appear in: https://github.com/microsoft/winget-pkgs/pulls
2. Wait for WinGet maintainers to review and merge the PR
3. Users can then upgrade with: `winget upgrade fjrevoredo.MiniDiarium`

No separate WinGet setup document exists; configure `WINGET_TOKEN` and follow this guide.

---

## Automated Flathub Publishing

When the release workflow publishes a release, the `flathub-publish.yml` workflow automatically:

✅ Generates `cargo-sources.json` from `src-tauri/Cargo.lock` (offline Cargo deps for the Flatpak sandbox)
✅ Derives a `package-lock.json` from the Bun lockfile and generates `node-sources.json` (offline npm deps)
✅ Updates the manifest `flatpak/com.minidiarium.yml` with the release tag and commit SHA
✅ Prepends a new `<release>` entry to `flatpak/com.minidiarium.metainfo.xml`
✅ Clones `flathub/com.minidiarium`, copies all updated files, and opens a PR

**Requirements:**

- Repository secret `FLATHUB_TOKEN` must be configured (one-time setup — see below)
- The Flathub repo `flathub/com.minidiarium` must exist (created by Flathub after initial submission)

**After the release:**

1. Flathub PR will appear in: https://github.com/flathub/com.minidiarium/pulls
2. Wait for Flathub maintainers to review and merge the PR (same process as WinGet)
3. Users can then install with: `flatpak install flathub com.minidiarium`

**Annual maintenance:** `org.gnome.Platform//47` in `flatpak/com.minidiarium.yml` must be bumped each major GNOME release (approximately annually). Update it before the first release of the year when GNOME ships a new major version.

---

### One-Time Flathub Setup (Manual)

These steps are required once before the automation can take over. They cannot be automated.

**Step 1 — Take screenshots (hard blocker):**
Flathub requires at least one screenshot with a hosted URL before it will accept a new app submission.
Capture 2–3 screenshots of the app running on Linux. Host them at stable URLs (GitHub release assets or `mini-diarium.com`). Add `<screenshot>` entries to `flatpak/com.minidiarium.metainfo.xml`. Without screenshots, Flathub will reject the submission.

**Step 2 — Generate source lists and test locally:**
```bash
# On a Linux machine with flatpak + flatpak-builder installed:
pip install aiohttp toml
git clone --depth=1 https://github.com/flatpak/flatpak-builder-tools.git

python3 flatpak-builder-tools/cargo/flatpak-cargo-generator.py src-tauri/Cargo.lock -o flatpak/cargo-sources.json

bun install --frozen-lockfile
npm install --package-lock-only --ignore-scripts
python3 flatpak-builder-tools/node/flatpak-node-generator.py npm package-lock.json -o flatpak/node-sources.json

flatpak-builder --user --install --force-clean build-dir flatpak/com.minidiarium.yml
flatpak run com.minidiarium
```

**Step 3 — Submit to Flathub:**
Open a PR to https://github.com/flathub/flathub with a new directory `new-pr/com.minidiarium/` containing all files from `flatpak/`. Follow the [Flathub submission checklist](https://github.com/flathub/flathub/wiki/App-Submission). The PR description must explain why `--filesystem=home` is needed: the journal directory is user-configurable and can be set to any path on the filesystem — restricting to `xdg-documents` would silently break multi-journal setups.

**Step 4 — After acceptance:**
Flathub creates the `flathub/com.minidiarium` repository. Add `FLATHUB_TOKEN` (a GitHub PAT with `repo` scope on `flathub/com.minidiarium`) as a repository secret at `Settings → Secrets and variables → Actions`. Subsequent releases are then fully automated.
