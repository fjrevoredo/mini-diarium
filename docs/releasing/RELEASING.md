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

> **Note:** the two **library** crates — `mini-diarium-core` (`crates/mini-diarium-core/Cargo.toml`) and `mini-diarium-crypto` (`crates/mini-diarium-crypto/Cargo.toml`) — each carry their own fixed `version = "0.1.0"`, **intentionally decoupled** from the app version and **not** bumped per release. Do not add them to `bump-version.sh`/`.ps1` or the version-consistency checks. This is now a settled decision, not a provisional one: open-core **M4a** (2026-07-24) chose a **tagged git dependency** over crates.io publication, so an app release never bumps, tags, or publishes a library crate, and there is no library release track to run here. See [`docs/decisions/2026-07-core-crate-distribution.md`](../decisions/2026-07-core-crate-distribution.md) and [`OPEN_CORE_STRATEGY.md`](../OPEN_CORE_STRATEGY.md).

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

### Windows leg fails at the SignPath signing step

- **Cause**: A `SIGNPATH_*` repository secret is missing/misnamed, or the SignPath
  artifact-configuration slug (`windows-msi` / `windows-exe`) doesn't match what's
  configured in the SignPath dashboard for the project
- **Fix**: Check the "Verify SignPath secrets are set" step output for which secret is
  missing, and confirm the artifact-configuration slugs in the SignPath dashboard exactly
  match `windows-msi` / `windows-exe` — see "Windows Code Signing (SignPath)" above

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
✅ Sign Windows `.msi`/`.exe` installers via SignPath (see "Windows Code Signing (SignPath)" below)

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

**Important:** the workflow is not the source of truth for Flatpak correctness. Flatpak dependency vendoring, AppStream metadata, runtime assumptions, and permissions are documented in [FLATPAK_MAINTENANCE.md](../FLATPAK_MAINTENANCE.md). Read that guide before changing anything Flatpak-related.

**After the release:**

1. Flathub PR will appear in: https://github.com/flathub/io.github.fjrevoredo.mini-diarium/pulls
2. Wait for Flathub maintainers to review and merge the PR (same process as WinGet)
3. Users can then install with: `flatpak install flathub io.github.fjrevoredo.mini-diarium`

**Runtime maintenance:** `org.gnome.Platform//50` in `flatpak/io.github.fjrevoredo.mini-diarium.yml` must be bumped each major GNOME release. When this runtime is bumped, re-check the matching Freedesktop SDK extension branch instead of assuming it stays unchanged.

---

### Flatpak Maintenance

The initial Flathub submission work is already complete. For future changes, debugging, or release upkeep, use [FLATPAK_MAINTENANCE.md](../FLATPAK_MAINTENANCE.md).

---

## Microsoft Store (MSIX)

Mini Diarium is distributed on the Microsoft Store as an **MSIX with package identity**.
The **Store signs the package and manages updates** — there is no paid code-signing
certificate and no in-app updater, so this channel stays compatible with the app's
no-network / no-telemetry non-negotiables (see `PHILOSOPHY.md`).

Packaging sources live in [`../../msix/`](../../msix/) (`Package.appxmanifest`) and
[`../../scripts/build-msix.ps1`](../../scripts/build-msix.ps1). Read
[`../../msix/README.md`](../../msix/README.md) before changing anything Store-related — it
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
   life of the app — see [`../../msix/README.md`](../../msix/README.md) → "Product identity".
2. Built and smoke-tested a local MSIX (`msix/README.md` → "Local build + smoke test").
3. Created the submission in Partner Center, uploaded the **unsigned** `.msix` (the Store
   signs it), and filled the listing: description (reuse `longDescription` from
   `tauri.conf.json`), screenshots, category (Utility), age rating, and privacy —
   emphasizing local-only, no data collection, no network.
4. Submitted for certification and recorded the **Product ID** (needed for CI).
5. Once live, captured the Store listing URL and Package Family Name and added the "Get it
   from the Microsoft Store" option to the install surfaces: `website/index.html` (hero
   badge + Windows platform card) and [`INSTALLATION.md`](../INSTALLATION.md). Both are
   hand-edited; `website/index.html` still needs `bun run website:build-static` afterwards
   so asset fingerprints stay in sync.

### Automated update submissions (every release after the first)

The `msstore-publish.yml` workflow builds the MSIX and pushes a package update,
dispatched from the release workflow alongside WinGet/Homebrew/Flathub. It is
**non-blocking**: a failure never fails the core release.

**Upload timeout workaround:** the "Publish package update to the Store" step passes
`--uploadTimeout 300` to `msstore publish`. Without it, a bug in `msstore-cli` v0.4.0/v0.4.1
leaves the Azure blob upload's network timeout at 0 seconds, so every upload fails
instantly (`Uploading Bundle to Azure blob: 0%` → error). Fixed upstream
([microsoft/msstore-cli#163](https://github.com/microsoft/msstore-cli/issues/163)) but not
yet in a release as of 2026-09-01 — drop this flag once a release containing the fix ships.

**Requirements (one-time):**

- An Azure AD (Microsoft Entra) app registration associated with the Partner Center
  account, with a client secret.
- Repository secrets: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`,
  `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET`, and `MSSTORE_PRODUCT_ID`.

> **If the Partner Center account is a single personal Microsoft account** (no
> company/work account, as here), it likely has **no existing Entra tenant** to
> associate — Partner Center → Account settings → Tenants will only offer
> **"Create Microsoft Entra ID"** (no manual "enter existing tenant ID" field). Go
> through that wizard (free; "business name"/"number of employees" are just profile
> text, not a real business registration check) to create a new tenant, **then** create
> the app registration inside it (entra.microsoft.com → Identity → Applications → App
> registrations), grant it the **Manager** role under Partner Center → Account settings
> → User management → Microsoft Entra applications, and set the three
> `PARTNER_CENTER_TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET` secrets from that new
> registration. Associating/rotating the tenant does not touch the live Store listing —
> it's purely an API-identity concern, scoped by `MSSTORE_PRODUCT_ID`. After granting the
> Manager role, allow a few minutes for propagation before the first `reconfigure`/
> `publish` call succeeds (an early attempt may 401 on the specific application lookup
> even though authentication itself succeeds).

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
# Build the CURRENT branch with an explicit version, then create a draft only.
gh workflow run msstore-publish.yml --ref master \
  --field tag=master --field dry_run_version=X.Y.Z --field dry_run=true
```

> **Do not dry-run against an old release tag.** The workflow checks out `--field tag`
> and builds it. Any tag at or before `v0.6.2` predates `scripts/build-msix.ps1` and the
> `msix/` payload, so the pack step fails with "not recognized … script file". Build a
> branch (`tag=master`) that contains the tooling instead, and pass an explicit
> `dry_run_version` — a branch name is not a version, and the version must also **exceed
> the live Store package** or the Store rejects the update. For a real release,
> `release.yml` dispatches with `--field tag=vX.Y.Z` and **no** `dry_run_version` (it is
> derived from the tag).

This creates/updates a **draft** submission (`--noCommit`) without publishing; confirm
with `msstore submission status <productId>`. Once the draft looks right, a real tagged
release auto-dispatches the workflow and publishes the update.

---

## Windows Code Signing (SignPath)

Windows release artifacts (`Mini-Diarium-X.Y.Z-windows.msi` / `.exe`) are signed in CI by
[SignPath](https://signpath.io/), via its GitHub Actions "trusted build system"
integration. Mini Diarium was accepted into the **SignPath Foundation** program for open
source projects, which provides free code signing — this stays compatible with the app's
no-cost, no-network non-negotiables (see `PHILOSOPHY.md`).

The signing step lives in `.github/workflows/release.yml`, inside the Windows leg of the
`build-release` job: each installer is uploaded as a temporary GitHub Actions artifact,
submitted to SignPath with `signpath/github-action-submit-signing-request@v2`, and the
signed file returned by SignPath replaces the unsigned one before checksums are computed.
No changes were needed to `tauri.conf.json` — SignPath signs the finished installer after
the Tauri build, rather than through a native Tauri signing hook.

**One-time SignPath dashboard setup** (org, project, artifact configurations, signing
policy, CI submitter, API token) is **not done in this repo** and is not repeated here —
see [`SIGNPATH_FIRST_TIME_SETUP.md`](SIGNPATH_FIRST_TIME_SETUP.md) for the full
from-scratch walkthrough, verified against SignPath's own docs. That guide is what you
follow if this ever needs to be rebuilt (new project, lost access, migrating orgs).

**Current configuration for Mini Diarium:**

| Item | Value |
|------|-------|
| SignPath project slug | `mini-diarium` |
| Signing policy slug (test cert, in use) | `test-signing` |
| Signing policy slug (production cert, not yet issued — SignPath shows it as `INVALID` / `CSR PENDING`) | `release-signing` |
| Artifact-configuration slugs (hardcoded in the workflow, not secret) | `windows-msi`, `windows-exe` |
| Repository secrets | `SIGNPATH_API_TOKEN`, `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG` — Settings → Secrets and variables → Actions |

**Status: test certificate, confirmed working end-to-end (2026-08-28).** A manual
`workflow_dispatch` run ([33190184892](https://github.com/fjrevoredo/mini-diarium/actions/runs/33190184892))
built the Windows leg, submitted both signing requests, and returned signed artifacts;
`Get-AuthenticodeSignature` on the downloaded `.msi`/`.exe` confirmed a valid Authenticode
chain signed by `Test certificate for 'Mini Diarium [OSS]'`. SignPath's GitHub Actions
integration authenticates with an API token secret (not OIDC), so no `id-token: write`
permission is needed — only `actions: read`, which the job's `permissions:` block grants
alongside its existing `contents: write`.

> **Test-signed builds are not release-ready.** Until SignPath reviews this setup and
> imports the production signing certificate into the organization, installers signed
> through this pipeline carry a **test** Authenticode signature that Windows does not
> trust by default. Do not point users at a tagged release signed only with the test
> certificate as if it were production-signed.
>
> **Current blocker:** the `release-signing` policy (paired with the production
> certificate) shows **CSR PENDING** in the SignPath dashboard. Per SignPath's process this
> requires SignPath to review and import the certificate on their side — it cannot be
> advanced from this repo or the dashboard by the project owner. The cutover is tracked in
> TODO-0109, which also records the next step (following up with SignPath).
