# Release Guide

Simple step-by-step instructions for creating a new Mini Diarium release.

---

## Pre-Release Checklist

Before starting the release process:

- [ ] All planned features/fixes are merged to `master`
- [ ] All tests passing (`cargo test` and `bun run test:run`)
- [ ] GitHub repo secrets set: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (one-time setup — see below)
- [ ] Run `cargo audit` — no known vulnerabilities in Rust dependencies
  ```bash
  cargo install cargo-audit  # one-time install
  cargo audit
  ```
- [ ] CI/CD pipeline passing on master
- [ ] No known P0/P1 bugs
- [ ] CHANGELOG.md updated with release notes

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

### Step 3: Commit and Push Branch

```bash
# Commit version bump
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to 0.1.1"

# Push branch
git push origin release-0.1.1
```

### Step 4: Create Pull Request

1. Go to: https://github.com/fjrevoredo/mini-diarium/pulls
2. Click "New pull request"
3. Base: `master` ← Compare: `release-0.1.1`
4. Title: "Release v0.1.1"
5. Add release notes in description
6. Create and merge the PR

### Step 5: Tag the Release (After PR Merged)

```bash
# Switch to master and pull the merged changes
git checkout master
git pull

# Create and push tag
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

**⚠️ Important**: The tag MUST be created on `master` after the PR is merged, not on the release branch!

### Step 6: Monitor Release Workflow

1. Go to: https://github.com/fjrevoredo/mini-diarium/actions
2. Wait for "Release" workflow to complete (~15-20 minutes)
3. Workflow will:
   - Build for Linux, macOS, Windows (with signed update artifacts)
   - Create draft release with all installers + `.sig` files
   - Upload checksums for each platform
   - Generate and upload `latest.json` (in-app updater manifest)

### Step 7: Complete the Draft Release

1. Go to: https://github.com/fjrevoredo/mini-diarium/releases
2. Find the draft release for v0.1.1
3. Edit the release notes:
   - Replace `<!-- Add release notes here before publishing -->` with actual changes
   - Organize changes by category (Features, Fixes, Performance, etc.)
4. Click "Publish release"

---

## Post-Release

After publishing:

- [ ] Test installers on each platform (Windows, macOS, Linux)
- [ ] Announce release (if applicable)
- [ ] Close related GitHub issues/PRs
- [ ] Update project board/milestones

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
1. Delete the draft release on GitHub
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

# 3. Commit and push branch
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to X.Y.Z"
git push origin release-X.Y.Z

# 4. Create PR on GitHub: release-X.Y.Z → master

# 5. After PR merged, tag on master
git checkout master && git pull
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 6. Wait for GitHub Actions → publish draft release
```

**Full release workflow (Windows PowerShell):**
```powershell
# 1. Create release branch
git checkout master; git pull; git checkout -b release-X.Y.Z

# 2. Bump version
.\bump-version.ps1 X.Y.Z

# 3. Commit and push branch
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to X.Y.Z"
git push origin release-X.Y.Z

# 4. Create PR on GitHub: release-X.Y.Z → master

# 5. After PR merged, tag on master
git checkout master; git pull
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 6. Wait for GitHub Actions → publish draft release
```

---

## Automated by Release Workflow

The following happens automatically when you push a tag:

✅ Build for all platforms (Linux x64, macOS universal, Windows x64)
✅ Generate installers (.AppImage, .deb, .dmg, .msi, .exe)
✅ Generate signed update artifacts (.AppImage.sig, .app.tar.gz + .sig, .exe.sig)
✅ Calculate SHA256 checksums for all artifacts
✅ Create draft GitHub release with all files
✅ Upload artifacts to release
✅ Generate and upload `latest.json` (in-app updater manifest for "Check for Updates…")

You only need to:
1. Bump version
2. Push tag
3. Publish the draft release

---

## One-Time Setup: Updater Signing Keys

The in-app updater (`tauri-plugin-updater`) requires a signing keypair. This is a one-time setup:

```bash
# Generate keypair (run locally, once)
bunx tauri signer generate -w ~/.tauri/mini-diarium.key
# Prints: public key (goes in tauri.conf.json) + writes private key to ~/.tauri/mini-diarium.key
```

Then:
1. Paste the printed **public key** into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
2. Add to GitHub repo secrets:
   - `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/mini-diarium.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the passphrase used during generation (empty string if none)

Without these secrets, the CI build will fail when it tries to sign the update artifacts.
