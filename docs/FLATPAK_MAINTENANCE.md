# Flatpak / Flathub Maintenance Guide

This document is the source of truth for Mini Diarium Flatpak and Flathub maintenance.

If a PR changes any Flatpak-related file, update this document in the same PR.

## Scope

Use this guide when touching any of the following:

- `flatpak/io.github.fjrevoredo.mini-diarium.yml`
- `data/linux/io.github.fjrevoredo.mini-diarium.desktop`
- `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
- `package-lock.json`
- `src-tauri/Cargo.lock`
- `.github/workflows/flathub-publish.yml`
- `flatpak/rewrite-manifest.py`

## Files That Matter

| File | Purpose |
| --- | --- |
| `flatpak/io.github.fjrevoredo.mini-diarium.yml` | Local Flatpak manifest used for local validation builds. |
| `data/linux/io.github.fjrevoredo.mini-diarium.desktop` | Desktop entry installed into the Flatpak. |
| `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` | AppStream metadata used by Flathub validation and store listing. |
| `package-lock.json` | npm lockfile used by offline `npm ci` in the Flatpak sandbox. |
| `src-tauri/Cargo.lock` | Cargo lockfile used for vendored Rust crates. |
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

### Rust dependency changes

If `Cargo.toml` or `Cargo.lock` changes, regenerate `cargo-sources.json` for the Flathub update.

Typical failure signature:

| Error | Meaning |
| --- | --- |
| `perhaps a crate was updated and forgotten to be re-vendored?` | `cargo-sources.json` is stale. |

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
python3 /path/to/flatpak-builder-tools/cargo/flatpak-cargo-generator.py src-tauri/Cargo.lock -o flatpak/cargo-sources.json
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
- file picking still works through portals
- metainfo validation passes

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
