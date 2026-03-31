# Flatpak / Flathub Setup Guide

This guide covers the **one-time manual steps** required to get Mini Diarium listed on Flathub. Once completed, all future releases are automated by `.github/workflows/flathub-publish.yml`.

For a high-level overview see [RELEASING.md — Automated Flathub Publishing](../RELEASING.md#automated-flathub-publishing).

---

## Prerequisites

- A Linux machine with `flatpak`, `flatpak-builder`, `git`, `python3`, `bun`, and `npm` installed
- `flatpak-builder-tools` cloned from GitHub (instructions below)
- The GNOME SDK and Platform Flatpak runtimes installed locally (instructions below)

---

## Step 1 — Take Screenshots (Hard Blocker)

Flathub **will reject** a new app submission that has no screenshots. This must be done before opening the initial submission PR.

**Requirements:**

- At least 1 screenshot; 2–3 recommended
- Must be taken from a real Linux install of the app
- Must be hosted at stable, permanent URLs (use GitHub release assets or `mini-diarium.com/screenshots/`)
- Recommended sizes: 1280×800 or 1920×1080

**Suggested screenshots:**

1. Main journal view with a sample entry open
2. Calendar navigation showing multiple entries
3. Preferences overlay

**After hosting the images**, add `<screenshot>` entries to `flatpak/io.github.fjrevoredo.mini-diarium.metainfo.xml` inside the `<screenshots>` block:

```xml
<screenshots>
  <screenshot type="default">
    <caption>Main journal view</caption>
    <image type="source" width="1920" height="1080">https://github.com/fjrevoredo/mini-diarium/blob/2737c02b96855240122c7bb3586a1f0276fdf439/public/promotional/flatpak/main.png</image>
  </screenshot>
  <screenshot>
    <caption>Calendar navigation</caption>
    <image type="source" width="1920" height="1080">https://github.com/fjrevoredo/mini-diarium/blob/2737c02b96855240122c7bb3586a1f0276fdf439/public/promotional/flatpak/calendar.png</image>
  </screenshot>
  <screenshot>
    <caption>Preferences</caption>
    <image type="source" width="1920" height="1080">https://github.com/fjrevoredo/mini-diarium/blob/2737c02b96855240122c7bb3586a1f0276fdf439/public/promotional/flatpak/preferences.png</image>
  </screenshot>
</screenshots>
```

---

## Step 2 — Install System Dependencies

On the Linux machine:

```bash
# Flatpak tooling
sudo apt-get install flatpak flatpak-builder    # Debian/Ubuntu
# or: sudo dnf install flatpak flatpak-builder  # Fedora

# Add the Flathub remote
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Install the GNOME 47 runtime and SDK (needed for local test build)
flatpak install --user flathub org.gnome.Platform//47 org.gnome.Sdk//47

# Install the Rust stable and Node 20 SDK extensions
flatpak install --user flathub org.freedesktop.Sdk.Extension.rust-stable//24.08
flatpak install --user flathub org.freedesktop.Sdk.Extension.node20//24.08

# Python deps for source generators
# --break-system-packages is required on Ubuntu 22.04+ / Debian 12+ (PEP 668)
pip install --break-system-packages aiohttp toml tomlkit ~/flatpak-builder-tools/node

# Clone the flatpak-builder-tools scripts
git clone --depth=1 https://github.com/flatpak/flatpak-builder-tools.git ~/flatpak-builder-tools
```

---

## Step 3 — Generate Source Lists

Flatpak builds happen in a network-isolated sandbox. All dependencies must be declared in advance as source entries. Two lists are needed: one for Cargo crates, one for npm packages.

From the repository root:

```bash
# 1. Generate Cargo source list from the lockfile
python3 ~/flatpak-builder-tools/cargo/flatpak-cargo-generator.py \
  src-tauri/Cargo.lock \
  -o flatpak/cargo-sources.json

# 2. Derive package-lock.json from bun.lock
#    (flatpak-node-generator does not support Bun lock files directly)
bun install --frozen-lockfile                        # populate node_modules
npm install --package-lock-only --ignore-scripts --legacy-peer-deps    # generate package-lock.json

# 3. Generate Node source list
flatpak-node-generator npm package-lock.json -o flatpak/node-sources.json
```

> **Note:** `npm install --package-lock-only` makes a network call to resolve package metadata. The resolved versions should match `bun.lock` exactly since `package.json` uses `^` ranges and `bun.lock` is frozen. If version drift is detected on first run, pin exact versions in `package.json`.

> **Note:** `--legacy-peer-deps` is required because the project uses `eslint@10` which has not yet been adopted by all ESLint plugins (e.g. `eslint-plugin-solid`). Bun resolves this gracefully, but npm's strict peer dependency resolution fails without this flag.

The generated `cargo-sources.json` and `node-sources.json` are **not committed** to the repo — they are regenerated fresh on every release by `flathub-publish.yml`. You only need them locally for the test build in Step 4.

---

## Step 4 — Test the Build Locally

Update the manifest's `tag` and `commit` fields to point at the latest release tag, then test the full sandbox build:

```bash
# Get the commit SHA of the tag you want to test (replace vX.Y.Z with the actual tag)
git rev-list -n 1 vX.Y.Z

# Edit flatpak/io.github.fjrevoredo.mini-diarium.yml — replace placeholder values:
#   tag: vX.Y.Z          →  tag: vX.Y.Z   (e.g. v0.4.14)
#   commit: PLACEHOLDER  →  commit: <sha from above>

# Run the Flatpak build (takes ~15 min on first run due to Cargo compilation)
flatpak-builder \
  --user \
  --install \
  --force-clean \
  build-dir \
  flatpak/io.github.fjrevoredo.mini-diarium.yml

# Launch the installed Flatpak
flatpak run io.github.fjrevoredo.mini-diarium
```

**What to verify:**

- The app launches without errors
- The journal directory picker works and can write to `~/` paths (tests `--filesystem=home`)
- Creating, saving, and reading entries works (tests the encrypted SQLite path)
- The window title and app name read "Mini Diarium" (tests the `.desktop` and metainfo)

**Common build failures:**

| Symptom                            | Cause                                | Fix                                                                          |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `error: could not find Cargo.toml` | Manifest `--manifest-path` is wrong  | Verify `src-tauri/Cargo.toml` exists in the git source checkout              |
| npm `integrity` mismatch           | `node-sources.json` is stale         | Regenerate with `flatpak-node-generator`                                     |
| Rust `E0*` compile errors          | Outdated `rust-stable` SDK extension | Update extension: `flatpak update org.freedesktop.Sdk.Extension.rust-stable` |
| `WebKitGTK` missing                | Wrong runtime version                | Ensure `org.gnome.Platform//47` is installed                                 |
| App opens but journal path errors  | `--filesystem=home` not in manifest  | Verify `finish-args` in `flatpak/io.github.fjrevoredo.mini-diarium.yml`      |

---

## Step 5 — Validate AppStream Metadata

Install `appstreamcli` and validate the metainfo before submission — Flathub runs this check and will reject invalid files:

```bash
sudo apt-get install appstream          # Debian/Ubuntu
# or: sudo dnf install libappstream     # Fedora

appstreamcli validate flatpak/io.github.fjrevoredo.mini-diarium.metainfo.xml
```

The output should be `validation was successful` with zero errors. Warnings about missing optional fields are acceptable, but errors must be fixed.

---

## Step 6 — Submit to Flathub

1. Fork `https://github.com/flathub/flathub`
2. In your fork, create a new directory `new-pr/io.github.fjrevoredo.mini-diarium/`
3. Copy all files from `flatpak/` into it:
   ```
   new-pr/io.github.fjrevoredo.mini-diarium/
   ├── io.github.fjrevoredo.mini-diarium.yml           (manifest — with real tag/commit, not placeholders)
   ├── io.github.fjrevoredo.mini-diarium.metainfo.xml  (with screenshots and at least one <release>)
   ├── io.github.fjrevoredo.mini-diarium.desktop
   ├── cargo-sources.json            (generated in Step 3)
   └── node-sources.json             (generated in Step 3)
   ```
4. Open a PR against `flathub/flathub` from your fork branch
5. Follow the [Flathub App Submission checklist](https://github.com/flathub/flathub/wiki/App-Submission)

**PR description must include the `--filesystem=home` justification:**

> Mini Diarium's journal directory is user-configurable via the `change_diary_directory` command and can be set to any arbitrary path on the filesystem. This is core to the app's local-first model — users may store journals on external drives, shared folders, or alongside other personal files. Restricting to `xdg-documents` would silently break multi-journal setups and any existing journal location already configured by the user. `xdg-documents` alone is therefore insufficient.

**Flathub review typically takes 1–4 weeks.** Reviewers may request changes to the manifest, metainfo, or sandbox permissions. Watch the PR for comments and respond promptly.

---

## Step 7 — After Acceptance

Once Flathub merges the initial submission PR, they create the `flathub/io.github.fjrevoredo.mini-diarium` repository. At that point:

1. **Create a GitHub PAT:**
   - Go to `https://github.com/settings/tokens` → "Generate new token (classic)"
   - Scopes: `repo` (full repository access on `flathub/io.github.fjrevoredo.mini-diarium`)
   - Expiry: 1 year (set a calendar reminder to rotate before it expires)
   - Copy the token value

2. **Add the secret to the repo:**
   - Go to `https://github.com/fjrevoredo/mini-diarium/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `FLATHUB_TOKEN`
   - Value: paste the PAT

3. **Run a CI dry-run:**
   - Go to Actions → "Publish to Flathub" → "Run workflow"
   - Enter `tag`: the latest release tag (e.g. `v0.4.14`)
   - Confirm a PR is opened against `flathub/io.github.fjrevoredo.mini-diarium` with correct content

All subsequent releases will now trigger the workflow automatically. The Flathub PR still requires a manual merge by Flathub maintainers — this is by design and cannot be automated.

---

## Annual Maintenance

`org.gnome.Platform//47` in `flatpak/io.github.fjrevoredo.mini-diarium.yml` must be bumped each major GNOME release (approximately every autumn). Check the [Flathub runtime EOL list](https://docs.flathub.org/docs/for-app-authors/requirements/#runtimes) and update the runtime version before the old one reaches end-of-life to avoid build failures on Flathub.

Add this to the release checklist at the start of each year:

- [ ] Check whether a new GNOME runtime is available and update `runtime-version` in `flatpak/io.github.fjrevoredo.mini-diarium.yml`

---

## File Reference

| File                                                     | Purpose                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `flatpak/io.github.fjrevoredo.mini-diarium.yml`          | Flatpak manifest — build instructions, sandbox permissions, source list    |
| `flatpak/io.github.fjrevoredo.mini-diarium.metainfo.xml` | AppStream metadata — required by Flathub for app store listing             |
| `flatpak/io.github.fjrevoredo.mini-diarium.desktop`      | Desktop entry — app name, icon, categories                                 |
| `.github/workflows/flathub-publish.yml`                  | CI automation — generates source lists, patches manifest, opens Flathub PR |
| `docs/RELEASING.md`                                      | Release process overview including Flathub section                         |
| `docs/wip/FLATPAK_SETUP.md`                              | This file — remove once Flathub submission is complete                     |
