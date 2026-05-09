---
name: flathub-maintenance
description: |
  Diagnose, fix, and manage Mini Diarium's Flatpak/Flathub packaging across the multi-repo ecosystem.
  Use when Flathub builds fail, the manifest or vendored sources (cargo-sources.json, node-sources.json)
  need regeneration, the runtime or permissions need bumping, AppStream metadata needs updating, or a
  Flathub PR needs manual intervention. Also use for initial Flathub submission changes, store listing
  updates, and any task touching flatpak/, .github/workflows/flathub-publish.yml, or the Flathub repo.
  Triggers: flathub, flatpak, Flatpak, Flathub, flatpak build, flathub build, vorarbeiter,
  flatpak-builder, flatpak manifest, flatpak publish, cargo-sources, node-sources, runtime bump,
  GNOME runtime, SDK extension, AppStream, metainfo, flathub PR, flathub publish, flathub token,
  flatpak permission, finish-args, flathub submission.
compatibility: Designed for Claude Code. Requires git, Python 3, node.
---

# Flathub Maintenance

Manage Mini Diarium's Flatpak packaging end-to-end — from initial submission through release updates,
build diagnosis, and long-term runtime maintenance.

## Load These Files First

1. `docs/FLATPAK_MAINTENANCE.md` — file inventory, invariants, failure signatures, validation checklist, runtime docs
2. `docs/RELEASING.md` — "Automated Flathub Publishing" section explains the publish workflow
3. `.github/workflows/flathub-publish.yml` — the actual automation that generates sources and opens the Flathub PR
4. `flatpak/rewrite-manifest.py` — transforms the local `type: dir` manifest into a pinned `type: git` manifest
5. `flatpak/io.github.fjrevoredo.mini-diarium.yml` — the local Flatpak manifest (source of truth)

If any of these files are missing or unreadable, stop and tell the user.

## Multi-Repo Architecture

Mini Diarium's Flatpak presence spans **3 separate systems**:

| System | Repository | Role |
|---|---|---|
| **Main repo** | `github.com/fjrevoredo/mini-diarium` | Source of truth for the manifest, lockfiles, fonts, metadata, and CI workflow |
| **Flathub repo** | `github.com/flathub/io.github.fjrevoredo.mini-diarium` | Holds the live manifest + vendored sources; receives automated PRs from the workflow |
| **Vorarbeiter CI** | `github.com/flathub-infra/vorarbeiter/actions` | Flathub's build system — every PR to the Flathub repo triggers a test build here |

The **publish workflow** (`flathub-publish.yml`) bridges main → Flathub:
1. Checkout the tagged release commit via `git worktree`
2. Generate `cargo-sources.json` and `node-sources.json` from lockfiles
3. Run `rewrite-manifest.py` to convert `type: dir` → `type: git`
4. Clone the Flathub repo, copy the 3 files, commit, push branch, open PR

**Key insight for diagnosis:** failures can originate in any of the 3 systems, and fixes may need to land in one or both repos.

## Local Repo Discovery

Before doing any work, locate the local checkouts.

**Step 1:** Check for `.agents/flathub-paths.md`. If it exists, read the paths from it:

```markdown
main_repo: /absolute/path/to/mini-diarium
flathub_repo: /absolute/path/to/flathub-repo
```

**Step 2:** If that file doesn't exist, try common locations:
- Windows: `D:\Repos\mini-diarium`, `D:\Repos\io.github.fjrevoredo.mini-diarium`
- Linux/WSL: `/mnt/d/Repos/mini-diarium`, `/mnt/d/Repos/io.github.fjrevoredo.mini-diarium`
- macOS: `~/Repos/mini-diarium`, `~/Repos/io.github.fjrevoredo.mini-diarium`

**Step 3:** If still not found, ask the user for the paths. If the user doesn't have a local Flathub repo clone, clone it:

```bash
git clone https://github.com/flathub/io.github.fjrevoredo.mini-diarium.git <path>
```

**After discovery:** offer to create `.agents/flathub-paths.md` so future sessions skip the search.

## The Manifest

### Local manifest (`flatpak/io.github.fjrevoredo.mini-diarium.yml`)

Uses `type: dir` with `path: ..` for local validation builds. All build command paths are relative
to the repo root. For local validation:

```bash
flatpak-builder --user --install --force-clean build-dir flatpak/io.github.fjrevoredo.mini-diarium.yml
flatpak run io.github.fjrevoredo.mini-diarium
```

### Flathub manifest (after rewrite)

The workflow replaces the `type: dir` source block with:

```yaml
- type: git
  url: https://github.com/fjrevoredo/mini-diarium
  commit: <sha>
```

The rest of the manifest (build commands, finish-args, runtime) is **preserved verbatim**.
Build command paths must work identically in both source modes.

### Critical path rule

All paths in `build-commands` are relative to the **build directory**, which is the repo root in both modes.
Never use `../` or nested prefixes that only resolve in one context.

### Vendored sources (`cargo-sources.json`, `node-sources.json`)

These files **do not exist in the main repo** — they are generated artifacts:

- Generated automatically by the `flathub-publish.yml` workflow during a release
- Generated manually for local validation using the tools documented in `FLATPAK_MAINTENANCE.md`
- **Never edit them by hand** — they must be regenerated from lockfiles

The Flathub repo carries the generated copies alongside the manifest. When diagnosing build failures,
treat these files as potentially stale if lockfiles changed without re-generation.

### The `generate-node-sources.mjs` script

Located at `flatpak/generate-node-sources.mjs`. Generates `node-sources.json` from `package-lock.json` and an `.npm` cache.

**Usage:**
```bash
node flatpak/generate-node-sources.mjs package-lock.json output.json "$HOME/.npm"
```

**How it works:**
- Reads every `node_modules/` entry from `lock.packages` that has `resolved` + `integrity`.
- For each package, computes the content file path under the npm cache. If the cache file exists, uses its size. Otherwise, makes an HTTP HEAD request to get `content-length`.
- **Critical:** many npm registry URLs do not return `content-length` on HEAD requests. When this happens, the script falls back to a full GET download of the tarball. This can be very slow when many packages are missing from the cache.
- Generates two JSON entries per package: a `type: file` content entry and a `type: inline` index entry. Esbuild binaries get special `type: archive` entries with `only-arches` constraints.

**Fallback when generation fails:**
1. Run `node flatpak/check-node-sources.mjs package-lock.json node-sources.json` to find all missing packages.
2. **Critical: always use integrity values from `package-lock.json`, never from `bun.lock`.** The two lockfiles can have different sha512 hashes for the same package@version (bun and npm may resolve different tarball contents). Using `bun.lock` integrity will cause "Wrong sha512 checksum" errors in vorarbeiter. Verify with: `node -e "const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log(l.packages['node_modules/<name>'].integrity)"`
3. For each missing package, manually construct two entries and insert them into `node-sources.json` in URL-sorted order:

Content entry format:
```json
{
  "type": "file",
  "url": "<resolved tarball URL>",
  "sha512": "<integrity hex (base64 decoded)>",
  "dest-filename": "<hex chars after position 4>",
  "dest": "flatpak-node/npm-cache/_cacache/content-v2/sha512/<hex[0:2]>/<hex[2:4]>"
}
```

Index entry format:
```json
{
  "type": "inline",
  "contents": "<sha1-of-index-json>\t<index-json>",
  "dest-filename": "<sha1-of-key chars after position 4>",
  "dest": "flatpak-node/npm-cache/_cacache/index-v5/<sha1-of-key[0:2]>/<sha1-of-key[2:4]>"
}
```

The index JSON object is: `{"key":"make-fetch-happen:request-cache:<url>","integrity":"<integrity>","time":0,"size":<tarball-size>,"metadata":{"url":"<url>","reqHeaders":{},"resHeaders":{}}}`. Compute the SHA1 of the full JSON string for the contents prefix, and the SHA1 of the key string for the index path.

See `flatpak/check-node-sources.mjs` for the companion gap-detection script.

### Patches in the Flathub repo

The Flathub repo may contain a `patches/` directory with `.patch` files. These are
**temporary Flathub-only patches** applied during the build to fix issues that haven't
been fixed upstream yet. Common patch scenarios: missing metainfo fields (e.g., `<url type="vcs-browser">`),
developer ID format fixes, AppStream compliance.

**Rule:** Remove patches as soon as the upstream fix is merged and the manifest can point
at a commit that includes the fix. Do not carry permanent Flathub-only patches.

## Common Failures → Diagnosis → Fix

### 1. Font install fails (`files/fonts` or `../fonts` not found)

**Symptom:** `install: cannot stat 'files/fonts/*.ttf': No such file or directory`

**Diagnosis:** The manifest references a font path that doesn't exist in the source checkout.
Fonts live at `fonts/*.ttf` in the repo root (10 .ttf files + `LICENSES.md`).

**Fix location:** BOTH repos need the fix.

- **Main repo:** `flatpak/io.github.fjrevoredo.mini-diarium.yml` — change to `fonts/*.ttf`
  (this fixes future releases via the publish workflow)
- **Flathub repo:** `io.github.fjrevoredo.mini-diarium.yml` — same change
  (this fixes the current PR so it can pass vorarbeiter)

**Push to Flathub repo:**
```bash
cd <flathub-repo>
git checkout update-<x.y.z>    # the PR branch
# edit io.github.fjrevoredo.mini-diarium.yml
git add io.github.fjrevoredo.mini-diarium.yml
git commit -m "fix: correct font install path"
git push origin update-<x.y.z>
```

Then comment `bot, build` on the Flathub PR to trigger a new vorarbeiter build.

### 2. npm `ENOTCACHED` — vendored node sources incomplete

**Symptom:** `npm ERR! ENOTCACHED` during `npm ci --offline`, e.g. `request to https://registry.npmjs.org/<pkg> failed: cache mode is 'only-if-cached' but no cached response is available.`

**Diagnosis:** `node-sources.json` is missing one or more packages declared in `package-lock.json`. The vendored sources are generated from the lockfile — if the lockfile is stale or the generation was incomplete, `npm ci --offline` fails because it cannot reach the network.

**Root cause chain:** `package-lock.json` → `node-sources.json` (generated by the publish workflow) → vorarbeiter `npm ci --offline`. A break at any link causes ENOTCACHED.

**First diagnostic step:** Run `node flatpak/check-node-sources.mjs <package-lock.json> <node-sources.json>` to discover ALL missing packages at once. The `npm ci` error only reports the first failure — there may be more.

**Fix — two repos, two actions:**

1. **Main repo (prevent recurrence):** Regenerate the lockfile with real npm so future releases ship a healthy one:
   ```bash
   npm install --package-lock-only --ignore-scripts --legacy-peer-deps
   ```
   Verify with `check-node-sources.mjs` afterward. Commit and push.

2. **Flathub repo (fix current PR):** Either re-run the publish workflow (if the lockfile fix is committed and the workflow can regenerate from it), or manually patch `node-sources.json` with the missing entries and force-push to the PR branch:
   ```bash
   cd <flathub-repo>
   git checkout update-<x.y.z>
   node flatpak/check-node-sources.mjs ../mini-diarium/package-lock.json node-sources.json
   # Add missing entries (see generate-node-sources.mjs docs for format)
   git add node-sources.json
   git commit -m "fix: add missing npm packages to node-sources.json"
   git push --force-with-lease origin update-<x.y.z>
   ```
   Then comment `bot, build` on the Flathub PR to trigger a new vorarbeiter build.

### 2a. Stale `package-lock.json` — dual lockfile pitfall

**Symptom:** The app builds and works locally (bun resolves everything from `bun.lock`), but vorarbeiter fails with `ENOTCACHED` because the publish workflow only reads `package-lock.json`.

**Diagnosis:** `bun.lock` is current (bun updated it when packages were added), but `package-lock.json` was never regenerated with real npm. The two lockfiles have diverged. Run `node flatpak/check-node-sources.mjs package-lock.json <node-sources.json>` and compare; any missing packages indicate a stale npm lockfile.

**Fix:** Regenerate with real npm:
```bash
npm install --package-lock-only --ignore-scripts --legacy-peer-deps
```
npm may say "up to date" but still modify the file if packages were added since the last generation. After regenerating, re-run `check-node-sources.mjs` and regenerate `node-sources.json`.

**Prevention:** The pre-release skill now includes a lockfile integrity guard (Step 3b) that catches this before tagging.

### 3. `cargo-sources.json` stale

**Symptom:** `perhaps a crate was updated and forgotten to be re-vendored?`

**Diagnosis:** `Cargo.lock` changed but `cargo-sources.json` wasn't regenerated.

**Fix location:** The publish workflow regenerates it automatically from the tagged tree.
If the workflow failed before generation, re-running it should work. If it was generated but
wrong, check that the tagged commit has the correct `Cargo.lock`.

### 4. Missing arch-specific npm packages

**Symptom:** `Cannot find module '@rolldown/binding-linux-arm64-gnu'` or similar

**Diagnosis:** `node-sources.json` is missing arch-specific optional native packages
(`@esbuild/linux-*`, `@rolldown/binding-linux-*`, `lightningcss-linux-*`, etc.).

**Fix:** The `generate-node-sources.mjs` script must be run with the correct `.npm` cache.
Check that the workflow's "Generate node-sources.json" step is using the tagged tree's
`package-lock.json`, not the checkout's.

### 5. ESBUILD_BINARY_PATH missing or wrong

**Symptom:** `Failed to find package "@esbuild/linux-x64"` or esbuild fails to execute

**Diagnosis:** The `ESBUILD_BINARY_PATH` env var is not set or the cached esbuild binary is missing.

**Fix:** The manifest's `build-options.env` must include:
```yaml
ESBUILD_BINARY_PATH: /run/build/mini-diarium/flatpak-node/cache/esbuild/bin/esbuild-current
```
This path is set by the vendored esbuild package in `node-sources.json`. If it breaks, the
`node-sources.json` is likely stale or was generated without the esbuild binary cache.

### 6. AppStream / metainfo validation fails

**Symptom:** Vorarbeiter build passes but AppStream validation fails (treated as a blocker).

**Diagnosis:** Missing or invalid `<developer>`, `<url>`, `<release>`, `<content_rating>`, or
screenshot URLs in `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`.

**Fix location:** Main repo — the tagged commit's metainfo is what Flathub validates.
Cut a new release after fixing, or manually patch the Flathub PR manifest if the fix
is cosmetic and the main repo fix will land in the next release.

### 7. Runtime / SDK extension mismatch

**Symptom:** Build fails with SDK/runtime errors.

**Diagnosis:** The manifest's `runtime-version` or `sdk-extensions` don't match available
GNOME runtimes or Freedesktop SDK extension branches.

**Fix:** Check the current available runtimes at Flathub docs. The manifest uses
`org.gnome.Platform//50` with `org.freedesktop.Sdk.Extension.rust-stable` and
`org.freedesktop.Sdk.Extension.node20` on branch `25.08`. When bumping the runtime,
re-check the matching SDK extension branches.

### 8. FLATHUB_TOKEN secret not set

**Symptom:** The publish workflow exits with `FLATHUB_TOKEN secret is not set.`

**Diagnosis:** The GitHub Actions secret is missing from the main repo.

**Fix:**
1. Create a GitHub personal access token (classic) with `public_repo` scope on an account
   that has write access to `flathub/io.github.fjrevoredo.mini-diarium`
2. In `fjrevoredo/mini-diarium`, go to Settings → Secrets and variables → Actions
3. Add a new repository secret named `FLATHUB_TOKEN` with the token value
4. Re-run the `Publish to Flathub` workflow

See `docs/FLATPAK_MAINTENANCE.md` "Required GitHub Secret: FLATHUB_TOKEN" section for details.

## Fix Propagation Rules

| What changed | Fix in main repo? | Fix in Flathub repo? |
|---|---|---|
| Build command (install path, env var, flag) | Yes (for future releases) | Yes (for current PR) |
| Vendored deps (cargo-sources, node-sources) | Workflow regenerates them | Workflow pushes them |
| Manifest source type/path | Handled by rewrite-manifest.py | N/A |
| finish-args / permissions | Yes | Yes (until next workflow run) |
| runtime / SDK extensions | Yes | Yes |
| Desktop file / metainfo / icons | Yes | No (comes from git source) |
| Fonts / bundled assets | Yes (path fix) + ensure files exist | Yes (path fix in current PR) |

## Flathub PR Operations

### Check PR status

```
https://github.com/flathub/io.github.fjrevoredo.mini-diarium/pulls
```

### Find the vorarbeiter build for a PR

The flathubbot comments on the PR with links. Look for "Started test build" comments.
The build number is in the URL: `runs/<number>`.

Alternatively, browse: `https://github.com/flathub-infra/vorarbeiter/actions`

### Trigger a rebuild

Comment `bot, build` on the Flathub PR. Only collaborators can trigger builds.

### Force-push a fix to an existing PR branch

```bash
cd <flathub-repo>
git checkout update-<x.y.z>
# make changes
git add .
git commit -m "fix: <description>"
git push --force-with-lease origin update-<x.y.z>
```

Note: the publish workflow uses `--force-with-lease`, so force-pushing the same branch is safe.

### Manual PR creation (bypassing the workflow)

Only needed if the automated workflow can't run or a quick fix is needed:

```bash
cd <flathub-repo>
git checkout master
git pull
git checkout -b update-<x.y.z>
# copy manifest, cargo-sources.json, node-sources.json from main repo
git add .
git commit -m "Update to <x.y.z>"
git push origin update-<x.y.z>
gh pr create \
  --repo flathub/io.github.fjrevoredo.mini-diarium \
  --base master \
  --head update-<x.y.z> \
  --title "Update to <x.y.z>" \
  --body "Automated update from https://github.com/fjrevoredo/mini-diarium/releases/tag/v<x.y.z>"
```

## Full Lifecycle Operations

### Runtime bump

1. Check Flathub docs for current GNOME runtime version
2. Update `runtime-version` in both manifests (local + Flathub)
3. Verify the matching Freedesktop SDK extension branch (`25.08` currently)
4. Test locally with `flatpak-builder`
5. Update `FLATPAK_MAINTENANCE.md` with the new values

### Permission changes (`finish-args`)

1. Justify the change — Flathub reviewers expect portal-first, minimal permissions
2. Update `finish-args` in the local manifest
3. Do NOT add `--share=network`, `--filesystem=home`, or broad filesystem permissions
   without a real runtime requirement and a reviewer-ready justification
4. Update `FLATPAK_MAINTENANCE.md` "Permissions" section

### AppStream metadata update

1. Edit `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
2. Validate: `appstreamcli validate data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
3. Fix all warnings — Flathub treats them as blockers
4. Ensure `<release version="x.y.z">` block is correct for the tagged release
5. Screenshot URLs must be stable (pinned to a release asset or immutable commit URL)

### Initial Flathub submission (reference)

Already completed, but for reference:
1. Manifest with `type: git` pointing to a release commit
2. Generated `cargo-sources.json` and `node-sources.json`
3. Valid AppStream metainfo with `<developer>`, `<launchable>`, `<url>`, `<content_rating>`
4. Desktop file, icons, and LICENSE installed
5. PR opened manually to `flathub/io.github.fjrevoredo.mini-diarium`

## Diagnosis Workflow

When a vorarbeiter build fails:

1. **Find the build URL** — from the Flathub PR comments or the vorarbeiter actions tab
2. **Identify the failing step** — review the build matrix (x86_64, aarch64) and find which job/steps failed
3. **Read the error** — fetch logs via `gh` CLI (see "Accessing Vorarbeiter Build Logs" below)
4. **Match to a known failure** — use the failure table in `FLATPAK_MAINTENANCE.md` and the "Common Failures" section above
5. **If ENOTCACHED** — run `node flatpak/check-node-sources.mjs <lockfile> <node-sources.json>` to find ALL missing packages at once, not just the first failure
6. **Determine fix location** — use the "Fix Propagation Rules" table above
7. **Apply the fix** — edit the correct file(s) in the correct repo(s)
8. **Push and trigger rebuild** — push to the Flathub PR branch and comment `bot, build`

### Accessing Vorarbeiter Build Logs

**Primary path (preferred):** Use the `gh` CLI to fetch logs programmatically.

1. List the build matrix jobs to find the failing one:
   ```bash
   gh api repos/flathub-infra/vorarbeiter/actions/runs/<run-id>/jobs \
     --jq '.jobs[] | select(.name | startswith("build")) | {name, id, conclusion}'
   ```
2. Fetch the failing job's logs:
   ```bash
   gh run view <run-id> --repo flathub-infra/vorarbeiter --log --job <job-id>
   ```
   Pipe through `Select-Object -Last 80` (PowerShell) or `tail -80` (bash) to see the end of the log where the error appears.

**Fallback:** If `gh` is unavailable or unauthenticated, use the `question` tool to ask the user:
> "The `gh` CLI is not available. Would you like to configure it, or should I fall back to you pasting the error logs manually?"
>
> - **"Configure gh CLI"** → guide through `gh auth login`
> - **"I'll paste the logs"** → ask for the content of the failing step from the build URL

**Last resort:** Reproduce the failure with a local `flatpak-builder` build.

## Quick Reference: Key IDs and URLs

| Item | Value |
|---|---|
| App ID | `io.github.fjrevoredo.mini-diarium` |
| Main repo | `https://github.com/fjrevoredo/mini-diarium` |
| Flathub repo | `https://github.com/flathub/io.github.fjrevoredo.mini-diarium` |
| Vorarbeiter CI | `https://github.com/flathub-infra/vorarbeiter/actions` |
| Flathub PRs | `https://github.com/flathub/io.github.fjrevoredo.mini-diarium/pulls` |
| GNOME runtime | `org.gnome.Platform//50` |
| Rust SDK | `org.freedesktop.Sdk.Extension.rust-stable` on `25.08` |
| Node SDK | `org.freedesktop.Sdk.Extension.node20` on `25.08` |
| Flathub docs | `https://docs.flathub.org/docs/category/for-app-authors` |
| Runtime docs | `https://docs.flatpak.org/en/latest/flatpak-builder-command-reference.html` |

## Agent Workflow Rules

1. **Always read `docs/FLATPAK_MAINTENANCE.md` first** — it has the authoritative invariant and failure lists
2. **Check both repos** before making changes — a fix might be needed in one or both
3. **Prefer fixing the main repo manifest** for long-term fixes; patch the Flathub repo only for the current PR
4. **Never modify `cargo-sources.json` or `node-sources.json` by hand** — they're generated
5. **Validate after every change** — run `flatpak-builder` locally if possible, or at minimum verify path correctness
6. **When in doubt about what the Flathub repo manifest should look like**, check the main repo's `flatpak/io.github.fjrevoredo.mini-diarium.yml` and run `rewrite-manifest.py` to see the output
7. **Comment `bot, build` on the PR after pushing fixes** so vorarbeiter picks up the change
