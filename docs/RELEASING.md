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
- [ ] Run `bun run sync-languages` — regenerate the language list in README.md and website/index.html
- [ ] `public/notifications.json` updated — add a new entry (type `"release"`, today's date, version matching the tag) so users see the release notes in the notification center
- [ ] Create `latest-changelog.md` from `latest-changelog.example.md` and fill it with the exact release body to publish
- [ ] Philosophy alignment reviewed for unreleased changelog items against `PHILOSOPHY.md`
  - Confirm each unreleased `CHANGELOG.md` item still fits the six philosophy principles: core vs extension, security impact, testability, portability, focused scope, and simplicity cost
  - If any item introduces a tradeoff or drift risk, record it explicitly in the release PR description or a dedicated audit note before tagging the release

---

## Release Paths

Two equivalent paths lead to a published release. Both are trunk-based: the tag is always created on `master`.

### Path A — Trunk-pure (preferred)

Run the `pre-release` skill directly on `master`, commit the version bump to `master`, then push the tag.

Use this path when branch protection allows direct pushes to `master` (e.g., single-maintainer repository).

```bash
# 1. Run `$runbooks pre-release` on master (canonical entry: `.agents/skills/runbooks/skills/pre-release/ENTRY.md`)
# 2. Commit version bump
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock \
  website/index.html README.md data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml \
  latest-changelog.md
git commit -m "chore: bump version to X.Y.Z"
git push origin master
# 3. Tag on master
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

### Path B — Short-lived release branch (when a PR is required)

Create a `release-vX.Y.Z` branch from `master`, run the pre-release skill there, open a same-day PR, merge, then tag on `master`. The branch is deleted after merge.

Use this path when branch protection requires a PR before merging to `master`.

```bash
git checkout master && git pull
git checkout -b release-vX.Y.Z
# Run pre-release skill, commit version bump (see existing Release Process steps below)
git push origin release-vX.Y.Z
# Open PR: release-vX.Y.Z → master; merge same day
git checkout master && git pull
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
# Delete the release branch
git push origin --delete release-vX.Y.Z
```

**Branch naming convention:** `release-vX.Y.Z` (with `v` prefix). The `pre-release` skill's branch guard accepts either `master` or any branch whose name contains the version string.

---

## CI Gate Policy

| Gate | Required | Duration |
|---|---|---|
| Lint (`bun run lint`) | Yes — all PRs | ~1 min |
| Type-check + Vitest (`bun run type-check && bun run test:run`) | Yes — all PRs | ~2 min |
| Rust tests + Clippy | Yes — all PRs | ~5 min |
| E2E (Linux WebKit build + WebdriverIO suite) | Yes — all PRs | ~50 min total |

**Merge queue:** Not yet enabled. Enable it when the project has two or more active committers — it serializes merges at the E2E bottleneck without requiring every contributor to wait on their own machine.

**E2E on nightly-only:** Not recommended. The E2E suite covers core workflow and unlock/lock regressions; losing daily signal means bugs ship until the next nightly run.

---

## Release Process

### Step 1: Create Release Branch

```bash
# Create a new branch from master
git checkout master
git pull
git checkout -b release-v0.1.1
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
- `src-tauri/Cargo.toml` (the **app** crate version)
- `Cargo.lock` (repo-root workspace lockfile — refreshed by a `cargo build`/`check`)
- `website/index.html` version badge, structured-data `softwareVersion`, and direct website download URLs
- `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` release entry

> **Note:** the `mini-diarium-core` crate (`crates/mini-diarium-core/Cargo.toml`) carries its own fixed `version = "0.1.0"`, which is **intentionally decoupled** from the app version and **not** bumped per release. It is an internal path dependency; its version is irrelevant until distribution is decided (open-core roadmap M4). Do not add it to `bump-version.sh`/`.ps1` or the version-consistency checks. See [`OPEN_CORE_STRATEGY.md`](OPEN_CORE_STRATEGY.md).

### Step 3: Prepare the Release Notes File

Create `latest-changelog.md` from the template and replace all placeholder text:

```bash
cp latest-changelog.example.md latest-changelog.md
```

The workflow publishes this file verbatim as the GitHub release body, so it must contain the exact notes you want users and WinGet to receive.

### Step 4: Commit and Push Branch

```bash
# Commit version bump and release notes
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock website/index.html README.md data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml latest-changelog.md
git commit -m "chore: bump version to 0.1.1"

# Push branch
git push origin release-v0.1.1
```

### Step 5: Create Pull Request

1. Go to: https://github.com/fjrevoredo/mini-diarium/pulls
2. Click "New pull request"
3. Base: `master` ← Compare: `release-v0.1.1`
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
- [ ] Optionally submit URLs to IndexNow (Bing, Yandex, Seznam, etc.)
  ```bash
  bun run website:submit-indexnow
  # Or preview without sending:
  bun run website:submit-indexnow:dry-run
  ```
  Alternatively, trigger the `.github/workflows/indexnow.yml` workflow manually from the Actions tab.
- [ ] Confirm production hosting still redirects `https://www.mini-diarium.com/` to `https://mini-diarium.com/`
- [ ] Confirm Cloudflare is not injecting the invalid `Content-Signal` directive into `robots.txt`
- [ ] Test installers on each platform (Windows, macOS, Linux)
- [ ] Announce release (if applicable)
- [ ] Close related GitHub issues/PRs
- [ ] Update project board/milestones

### Search Discovery Notes

- Search Console submission is still manual. Keep it in the release checklist for every public release.
- IndexNow submission is now automated: `bun run website:submit-indexnow` submits all sitemap URLs to participating search engines. The key file lives at `website/indexnow-key-*.txt` and is auto-discovered by the script. A GitHub Actions workflow (`.github/workflows/indexnow.yml`) is also available for manual triggering.
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
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock website/index.html README.md data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml latest-changelog.md
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
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock website/index.html README.md data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml latest-changelog.md
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
✅ Dispatch WinGet, Homebrew, Flathub, and Microsoft Store publish workflows

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

When the release workflow publishes a release, the `flathub-publish.yml` workflow prepares the Flathub update PR by:

✅ Generates `cargo-sources.json` from `Cargo.lock` (offline Cargo deps for the Flatpak sandbox)
✅ Generates `node-sources.json` from `package-lock.json` for offline npm deps
✅ Rewrites the local Flatpak manifest to a pinned git source for the release commit
✅ Clones `flathub/io.github.fjrevoredo.mini-diarium`, copies the generated files, and opens a PR

**Requirements:**

- Repository secret `FLATHUB_TOKEN` must be configured (one-time setup — see below)
- The Flathub repo `flathub/io.github.fjrevoredo.mini-diarium` must exist (created by Flathub after initial submission)

**Important:** the workflow is not the source of truth for Flatpak correctness. Flatpak dependency vendoring, AppStream metadata, runtime assumptions, and permissions are documented in [FLATPAK_MAINTENANCE.md](FLATPAK_MAINTENANCE.md). Read that guide before changing anything Flatpak-related.

**After the release:**

1. Flathub PR will appear in: https://github.com/flathub/io.github.fjrevoredo.mini-diarium/pulls
2. Wait for Flathub maintainers to review and merge the PR (same process as WinGet)
3. Users can then install with: `flatpak install flathub io.github.fjrevoredo.mini-diarium`

**Runtime maintenance:** `org.gnome.Platform//50` in `flatpak/io.github.fjrevoredo.mini-diarium.yml` must be bumped each major GNOME release. When this runtime is bumped, re-check the matching Freedesktop SDK extension branch instead of assuming it stays unchanged.

---

### Flatpak Maintenance

The initial Flathub submission work is already complete. For future changes, debugging, or release upkeep, use [FLATPAK_MAINTENANCE.md](FLATPAK_MAINTENANCE.md).

---

## Microsoft Store (MSIX)

Mini Diarium is distributed on the Microsoft Store as an **MSIX with package identity**.
The **Store signs the package and manages updates** — there is no paid code-signing
certificate and no in-app updater, so this channel stays compatible with the app's
no-network / no-telemetry non-negotiables (see `PHILOSOPHY.md`).

Packaging sources live in [`../msix/`](../msix/) (`Package.appxmanifest`) and
[`../scripts/build-msix.ps1`](../scripts/build-msix.ps1). Read
[`../msix/README.md`](../msix/README.md) before changing anything Store-related — it
covers the identity manifest, the local build recipe, the smoke-test checklist, and the
AppData-virtualization limitation.

### First submission — done (2026-07-15)

The app is **live on the Store**. This section is kept as a record; the steps below are
not to be repeated.

| Fact | Value |
|------|-------|
| Product ID | `9PJFTX44ZS43` (the `MSSTORE_PRODUCT_ID` secret) |
| Store listing | https://apps.microsoft.com/detail/9PJFTX44ZS43 |
| Package Family Name | `fjrevoredo.MiniDiarium_4vckxhggeazhp` |
| Went live | 2026-07-15 |

The listing text, screenshots, age rating (IARC questionnaire), and privacy declarations
cannot be automated, so the first submission was done by hand in Partner Center:

1. Filled the identity values in `msix/Package.appxmanifest` from Partner Center →
   Product management → Product identity, and committed them. They are stable for the
   life of the app — see [`../msix/README.md`](../msix/README.md) → "Product identity".
2. Built and smoke-tested a local MSIX (`msix/README.md` → "Local build + smoke test").
3. Created the submission in Partner Center, uploaded the **unsigned** `.msix` (the Store
   signs it), and filled the listing: description (reuse `longDescription` from
   `tauri.conf.json`), screenshots, category (Utility), age rating, and privacy —
   emphasizing local-only, no data collection, no network.
4. Submitted for certification and recorded the **Product ID** (needed for CI).
5. Once live, captured the Store listing URL and Package Family Name and added the "Get it
   from the Microsoft Store" option to the install surfaces: `website/index.html` (hero
   badge + Windows platform card) and [`INSTALLATION.md`](INSTALLATION.md). Both are
   hand-edited; `website/index.html` still needs `bun run website:build-static` afterwards
   so asset fingerprints stay in sync.

### Automated update submissions (every release after the first)

The `msstore-publish.yml` workflow builds the MSIX and pushes a package update,
dispatched from the release workflow alongside WinGet/Homebrew/Flathub. It is
**non-blocking**: a failure never fails the core release.

**Requirements (one-time):**

- An Azure AD (Microsoft Entra) app registration associated with the Partner Center
  account, with a client secret.
- Repository secrets: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`,
  `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET`, and `MSSTORE_PRODUCT_ID`.

**Version handling:** the MSIX 4-part version is derived from the release tag at build
time (`vX.Y.Z` → `X.Y.Z.0`) by `build-msix.ps1`, which stamps it into a staged copy of the
manifest. The committed manifest carries a concrete version that `bump-version.sh` does
**not** stamp (avoids a fourth version file drifting), so it is informational only and
will drift behind the current release — that is expected and harmless.

**Dry-run before trusting a tag to auto-publish:** the `msstore` CLI has no native Tauri
integration, so this pipeline packs the MSIX with `winapp` and pushes it via the raw
`msstore publish` command rather than `msstore init`. Use the workflow's dry-run mode
whenever you want to check the pipeline without publishing:

```bash
gh workflow run msstore-publish.yml --ref master \
  --field tag=vX.Y.Z --field dry_run=true
```

This creates/updates a **draft** submission (`--noCommit`) without publishing; confirm
with `msstore submission status <productId>`. Once the draft looks right, a real tagged
release auto-dispatches the workflow and publishes the update.
