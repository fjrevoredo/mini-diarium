# Flatpak / Flathub Maintenance Guide

This document is the source of truth for Mini Diarium Flatpak and Flathub maintenance.

If a PR changes any Flatpak-related file, update this document in the same PR.

## Scope

Use this guide when touching any of the following:

- `flatpak/io.github.fjrevoredo.mini-diarium.yml`
- `data/linux/io.github.fjrevoredo.mini-diarium.desktop`
- `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
- `package-lock.json`
- `Cargo.lock`
- `.github/workflows/flathub-publish.yml`
- `flatpak/rewrite-manifest.py`

## Files That Matter

| File | Purpose |
| --- | --- |
| `flatpak/io.github.fjrevoredo.mini-diarium.yml` | Local Flatpak manifest used for local validation builds. |
| `data/linux/io.github.fjrevoredo.mini-diarium.desktop` | Desktop entry installed into the Flatpak. |
| `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` | AppStream metadata used by Flathub validation and store listing. |
| `package-lock.json` | npm lockfile used by offline `npm ci` in the Flatpak sandbox. |
| `Cargo.lock` | Cargo lockfile used for vendored Rust crates. |
| `.github/workflows/flathub-publish.yml` | Release automation that prepares the Flathub update PR. |
| `flatpak/rewrite-manifest.py` | Rewrites the local manifest from `type: dir` to a pinned `type: git` source for Flathub. |

## Current Invariants

These are not optional unless there is a deliberate, documented reason to change them.

### Manifest

- The manifest uses `id: io.github.fjrevoredo.mini-diarium`, not deprecated `app-id:`.
- The local manifest uses `type: dir` with `path: ..` so local Flatpak builds test the current checkout.
- The Flathub PR manifest must be the same file rewritten to a pinned `type: git` source.
- The runtime is currently `org.gnome.Platform//50` with `org.gnome.Sdk//50`.
- The matching SDK extensions are currently `org.freedesktop.Sdk.Extension.rust-stable` and `org.freedesktop.Sdk.Extension.node20` on branch `25.08`.
- The build commands are:
  - `npm ci --offline --legacy-peer-deps`
  - `npm run build`
  - `cargo build --release --features custom-protocol --manifest-path src-tauri/Cargo.toml`
- `ESBUILD_BINARY_PATH` must stay set to `/run/build/mini-diarium/flatpak-node/cache/esbuild/bin/esbuild-current`.
- The manifest must install:
  - the binary
  - the desktop file
  - the metainfo file
  - the icons
  - the upstream `LICENSE`
  - the bundled fonts (`fonts/*.ttf`)

### Permissions

Current `finish-args` are intentionally minimal:

- `--socket=wayland`
- `--socket=fallback-x11`
- `--share=ipc`
- `--device=dri`

Do not add `--share=network`, `--filesystem=home`, or any broad filesystem permission unless there is a real runtime requirement and a reviewer-ready justification.

Flathub reviewers expect a portal-first app. Mini Diarium currently passes review with no broad filesystem permission and no network permission.

### Metadata

These IDs must stay aligned:

- Manifest `id`
- Desktop filename
- Desktop `Name/Icon` usage where relevant
- Metainfo `<id>`
- Installed icon filenames

The metainfo file must keep:

- `<launchable type="desktop-id">io.github.fjrevoredo.mini-diarium.desktop</launchable>`
- `<developer id="io.github.fjrevoredo">`
- `<url type="homepage">...`
- `<url type="bugtracker">...`
- `<url type="vcs-browser">...`
- a valid `<project_license>`
- a valid `<content_rating type="oars-1.1" />`
- screenshots with stable URLs

## What Usually Breaks

### npm / frontend dependency changes

Flatpak builds run offline. If frontend dependencies change, all of these must stay in sync:

- `package.json`
- `bun.lock`
- `package-lock.json`
- generated `node-sources.json` in the Flathub update

Use real `npm`, not Bun's npm shim, to regenerate the lockfile:

```bash
npm install --package-lock-only --ignore-scripts --legacy-peer-deps
```

The resulting `package-lock.json` must contain real `resolved` and `integrity` entries. Quick sanity check:

```bash
rg -n '"resolved"|"integrity"' package-lock.json
```

If those fields are missing, `npm ci --offline` in Flathub will fail with `ENOTCACHED`.

Native optional npm packages are especially fragile. After npm dependency changes, verify that the generated `node-sources.json` includes at least the Linux `x64` and `arm64` variants for packages such as:

- `@esbuild/linux-*`
- `@rolldown/binding-linux-*`
- `@oxc-parser/binding-linux-*`
- `lightningcss-linux-*`
- `@tauri-apps/cli-linux-*`

Typical failure signatures:

| Error | Meaning |
| --- | --- |
| `npm ERR! ENOTCACHED` | `package-lock.json` or vendored node sources are incomplete/stale. |
| `Failed to find package "@esbuild/linux-x64"` | esbuild binary vendoring is broken or `ESBUILD_BINARY_PATH` is missing/wrong. |
| `Cannot find module '@rolldown/binding-linux-arm64-gnu'` | `node-sources.json` is missing arch-specific optional native packages. |

Passing `flatpak-node-generator` is not enough by itself. Always verify the generated output when native npm dependencies change.

### Bundled font changes

The app bundles five font families (Noto Sans, Noto Serif, Source Sans 3, JetBrains Mono, Fira Mono) as `.ttf` files in `fonts/` at the repo root. The Flatpak manifest installs them with:

```
install -Dm644 fonts/*.ttf -t /app/share/fonts/
```

The path `fonts/*.ttf` is relative to the build directory (repo root for both `type: dir` and `type: git` sources). Do not add a `files/`, `../`, or any other prefix to this path.

Critical invariant: the `fonts/*.ttf` glob must match at least one file at build time, otherwise the `install` command fails. If fonts are ever removed, the install command must be removed too.

### Rust dependency changes

If `Cargo.toml` or `Cargo.lock` changes, regenerate `cargo-sources.json` for the Flathub update.

Typical failure signature:

| Error | Meaning |
| --- | --- |
| `perhaps a crate was updated and forgotten to be re-vendored?` | `cargo-sources.json` is stale. |

### Upstream Flathub outages (SDK dependency install)

The CI job installs its runtime, SDK, and SDK extensions from the Flathub remote before building.
A 404 during that install is an upstream Flathub problem, not a defect in this repository:

| Error | Meaning |
| --- | --- |
| `Failed to install org.freedesktop.Sdk.Extension.<name>: While pulling runtime/...: Server returned HTTP 404` | The Flathub summary advertises a commit whose objects are missing or not yet propagated on `dl.flathub.org`. Typically follows a fresh republish of that SDK extension. Nothing in this repo can fix it; wait for Flathub to repair the repo, then re-run the job. |

Diagnosis steps:

1. Copy the `objects/<xx>/<hash>.filez` URL from the error and check it directly (HTTP HEAD). A 404
   confirmed outside the runner proves the object is gone from Flathub's CDN.
2. Compare the failing object hash across runs. Identical hashes across hours rule out a transient
   blip and point at a bad publish on Flathub's side.
3. Check [builds.flathub.org](https://builds.flathub.org) for a recent stable build of the affected
   extension; a publish shortly before the failures started is the trigger.

Mitigation in `.github/workflows/ci.yml`: the `flatpak` job pre-installs all four refs
(GNOME Platform/Sdk plus the `rust-stable` and `node20` extensions) with five attempts and
increasing backoff before invoking the pinned `flatpak-builder` action, which installs dependencies
only once with no retry of its own. Retries absorb short CDN hiccups; a persistently broken object
still fails loudly after ~5 minutes of backoff.

Incident history:

- **2026-08-21 → 2026-08-22**: every run failed with a byte-identical 404 for object
  `06/0fdf65e0a1042c0db51bf9d009048f9f07e047b422e0e736c5d8ad35ac3a9c.filez` while pulling
  `org.freedesktop.Sdk.Extension.rust-stable/x86_64/25.08`, starting right after Flathub's
  stable republish of that extension (commit `7c4a7fd`, vorarbeiter run 32437698732).
  Independently hit by another project ([Dasher-GTK #52](https://github.com/dasher-project/Dasher-GTK/issues/52)).
  This outage motivated the retry pre-install step above; retries cannot help while the object
  itself is missing.

### Metadata / store listing changes

If desktop integration, screenshots, releases, or app identity changes:

- validate `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
- check that the desktop file and metainfo still reference the same ID
- keep screenshot URLs stable and pinned to a release asset or immutable commit URL

AppStream validation command:

```bash
appstreamcli validate data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml
```

Important: Flathub treats both AppStream warnings and errors as submission blockers in practice. Fix them before shipping.

## Local Validation Checklist

Before changing anything significant in the Flatpak package, validate locally on Linux:

1. Install the required runtime and SDK extensions.
2. Regenerate `package-lock.json` with real `npm` if frontend deps changed.
3. Regenerate the vendored Cargo and Node source lists used for the Flatpak update.

Typical generation commands:

```bash
python3 /path/to/flatpak-builder-tools/cargo/flatpak-cargo-generator.py Cargo.lock -o flatpak/cargo-sources.json
node flatpak/generate-node-sources.mjs package-lock.json flatpak/node-sources.json "$HOME/.npm"
```

4. Build locally with:

```bash
flatpak-builder --user --install --force-clean build-dir flatpak/io.github.fjrevoredo.mini-diarium.yml
flatpak run io.github.fjrevoredo.mini-diarium
```

5. Verify:
- the app launches
- the UI loads in release mode
- journal open/save flows still work
- **+ Create New Journal** shows a dialog-free form (Name, Filename, and Location fields)
  pre-filled with the default location and `diary.db` — it must **never open a native save
  dialog** on Flatpak; this is the path most users take, and it must not depend on the portal
- file picking still works through portals — open an import/export dialog and confirm a file
  is actually read or written afterwards. Note what this check does **not** prove: browsing to
  a folder *outside* the sandbox returns a `/run/user/<uid>/doc/` handle that resolves now and
  stops resolving later, which is why a Flathub user's journal became unopenable (see
  KI-10 in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)). `add_journal` refuses such paths as of
  v0.6.6; verify that refusal shows its own message rather than a generic permissions error
- metainfo validation passes

### Journal-location smoke test (v0.6.6) — NOT YET RUN

The v0.6.6 journal-location fix has **not been verified on a real Flatpak build**. No
`flatpak` or `flatpak-builder` exists in the development environment or its WSL distro, so
every claim below about sandbox behaviour is reasoned from the manifest and from Tauri's
`document_dir()` source, not observed. The fix is safe either way — `get_default_journal_dir`
probes its preferred location and falls back to the app's own data directory when it is not
writable — but the steps here are what would turn "safe either way" into "verified". Run them
on the next Linux session and replace this notice with the result.

The manifest's `finish-args` carries **no `--filesystem=` argument at all**, so the sandbox
holds no host filesystem permission. Whether `dirs::document_dir()` then resolves to a real
path, to an inaccessible one, or to `None` (it reads `$XDG_CONFIG_HOME/user-dirs.dirs` and
returns `None` when that file is absent) is exactly what these steps establish.

1. Build and install **without any Flatseal override** — a granted `--filesystem` permission
   invalidates the whole test, since it is the absence of one that produces the failure.
2. **+ Create New Journal**: the dialog-free form must appear directly — Name, Filename
   (pre-filled `diary.db`), and Location (pre-filled, Browse…/Use default location available)
   — and the journal must be creatable **with no native save dialog at any point**. Record
   which path the Location field resolved to — `~/Documents/Mini Diarium` or
   `~/.var/app/io.github.fjrevoredo.mini-diarium/data/…`. Either is a pass; which one it is
   answers the open question.
3. Create a **second** journal the same way, in the same default folder, but change the
   Filename field (e.g. `work.db`) — journals now share a folder by distinct filename rather
   than each getting an auto-allocated folder of its own. It must land on password creation,
   not on the first journal's unlock prompt. Leaving the Filename as `diary.db` unchanged
   must instead be refused with an "already exists" error before anything is created.
4. Quit, relaunch, and unlock both journals.
5. Inspect `~/.var/app/io.github.fjrevoredo.mini-diarium/data/config.json`: each entry's `path`
   must be a durable location and **must not** be under `/run/user/*/doc/` or
   `/run/flatpak/doc/`.

## Release / Flathub Update Checklist

When preparing a Flathub update:

1. Make sure all Flatpak-relevant upstream changes are committed first.
2. The Flathub manifest must point to that exact upstream commit.
3. Regenerate vendored dependency sources from the current lockfiles.
4. Do not carry Flathub-only patches unless the upstream fix is impossible or still pending review.
5. If a temporary Flathub-only patch is needed, remove it as soon as the upstream fix is merged and the manifest can point at the new commit.
6. The release tag itself must already contain valid Flathub/AppStream metadata. Post-tag fixes on `master` do not help an automated Flathub PR for that release.
7. The publish workflow must generate `cargo-sources.json`, `node-sources.json`, and the rewritten manifest from the tagged source tree, not from whatever is currently on `master`.
8. The tagged metainfo `<releases>` block must include the exact released version and matching GitHub release URL, otherwise Flathub can publish the new build while still displaying the previous version in the store listing.

### Required GitHub Secret: `FLATHUB_TOKEN`

The release workflow pushes a branch to `flathub/io.github.fjrevoredo.mini-diarium` and then opens a PR. That token is stored in the `mini-diarium` GitHub repository as the Actions secret `FLATHUB_TOKEN`.

Setup steps:

1. Create a GitHub personal access token on an account that has write access to `flathub/io.github.fjrevoredo.mini-diarium`.
2. In `fjrevoredo/mini-diarium`, go to `Settings -> Secrets and variables -> Actions`.
3. Add a new repository secret named `FLATHUB_TOKEN`.
4. Re-run the `Publish to Flathub` workflow after saving the secret.

Token type guidance:

- Safest practical choice for this repo: a classic personal access token with `public_repo`.
- Reason: the target Flathub repository is public, and GitHub still documents that fine-grained tokens do not support contributing as an outside collaborator or repository collaborator.
- If the account is an actual member of the `flathub` organization and fine-grained access works, scope it to `flathub/io.github.fjrevoredo.mini-diarium` with repository permissions `Contents: write` and `Pull requests: write`.

Failure signature when missing:

| Error | Meaning |
| --- | --- |
| `FLATHUB_TOKEN secret is not set.` | The release workflow cannot clone, push to, or open a PR against the Flathub repo. |

## Runtime And Permission Changes

If you change runtime version, SDK extension branch, or permissions:

- check the official Flatpak and Flathub docs first
- update this document in the same PR
- explain the reason in the PR description
- expect reviewer questions if the change adds access or deviates from current minimal permissions

The most common annual maintenance task is the GNOME runtime bump. When `runtime-version` changes, re-check the matching Freedesktop SDK extension branch instead of assuming it stays the same.

## CI Validation

The `ci.yml` workflow includes a `flatpak` job that builds the Flatpak on every PR and push to `master`. This catches build issues, dependency vendoring problems, manifest path errors, and AppStream metadata issues **before** merge — not after the Flathub PR is created.

### How It Works

- The job runs in the `ghcr.io/flathub-infra/flatpak-github-actions:gnome-50` container with `flatpak-builder@v6`.
- `cargo-sources.json` and `node-sources.json` are generated on-the-fly from `Cargo.lock` and `package-lock.json` (not committed to the repo).
- Desktop file and AppStream metainfo are validated before the build (fail fast).
- The build skips bundle creation (`build-bundle: false`) for speed — we only validate the build succeeds.
- The job depends on `lint` and `test` passing first, and runs in parallel with `build-linux` and `build-other`.

### If the CI Flatpak Job Fails

Fix the issue in the main repo **before merging**. Do NOT wait for the Flathub PR to fail. Typical fixes:

- Regenerate `package-lock.json` with real `npm` if frontend deps changed.
- Update the manifest, desktop file, or metainfo if IDs or paths drifted.
- Check `cargo-sources.json` or `node-sources.json` generation if native dependencies changed.

## Current Automation Caveat

`flathub-publish.yml` is a convenience workflow, not proof that the package is correct.

In particular:

- the workflow must operate on the tagged release tree; generating sources from `master` and pinning the manifest to a different tag commit is invalid
- the workflow should fail if the tagged metainfo does not contain a matching `<release version="...">` entry for the released tag
- successful source generation does not guarantee that `node-sources.json` includes all required arch-specific optional native npm packages
- successful local `x86_64` builds do not guarantee `aarch64` will pass
- AppStream validation can fail after the build itself succeeds

If a Flatpak-related change is risky, treat a Flathub test build on both `x86_64` and `aarch64` as the real verification step.

## Official References

- Flatpak builder reference: https://docs.flatpak.org/en/latest/flatpak-builder-command-reference.html
- Flatpak module sources: https://docs.flatpak.org/en/latest/module-sources.html
- Flathub requirements: https://docs.flathub.org/docs/for-app-authors/requirements
- Flathub MetaInfo guidelines: https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines

If this guide and the code disagree, fix one of them immediately. Do not let them drift.
