# Apply Cargo Dependency PRs

Apply Cargo dependency update PRs from GitHub to `src-tauri/Cargo.toml` and
`src-tauri/Cargo.lock`. This is the per-ecosystem procedure dispatched from
`ENTRY.md` for PRs classified as **cargo** by the Triage section.

Cargo has two distinct update paths, selected by whether the PR touches the
manifest file:

- **Lockfile-Only Procedure** — PR modifies only `src-tauri/Cargo.lock`
  (Dependabot's `minor-and-patch` group typically produces these).
- **Manifest Bump Procedure** — PR modifies `src-tauri/Cargo.toml` and
  `src-tauri/Cargo.lock` (Dependabot's major or version-type-specific
  groups, or hand-written PRs).

Always pick the path that matches the PR's `files[]`. If neither matches
(e.g., a hand-written PR that touches other files), abort and ask the user.

## Quick Checklist

- [ ] Discovery: `gh pr view <N> --json files --jq '.files[].path'`
- [ ] Triage sub-step: does the PR include `src-tauri/Cargo.toml`?
- [ ] Per-path Execution: follow the matching procedure below
- [ ] Verification: `git diff --stat` shows the expected files; `cargo test` and `cargo build` exit 0

## Triage Sub-Step

```bash
gh pr view <NUMBER> --repo <owner/repo> --json files --jq '.files[].path'
```

- If the output **includes** `src-tauri/Cargo.toml` → **Manifest Bump Procedure**.
- If the output contains **only** `src-tauri/Cargo.lock` (and possibly
  other Cargo files but not `Cargo.toml`) → **Lockfile-Only Procedure**.
- If the output contains neither (e.g., a hand-written PR touching
  `build.rs` only) → **abort** and ask the user.

## Gotchas

- **`windows` / `webview2-com` Cargo crates are tied to the Tauri version.**
  Tauri's transitive deps (wry, tao, tauri-runtime-wry) own the `windows`
  and `webview2-com` types passed to our code. A version mismatch causes
  type-level incompatibilities (e.g. `PCWSTR`/`Interface`/
  `COREWEBVIEW2_WEB_RESOURCE_CONTEXT` from different `windows-core`
  versions won't unify). If a cargo PR touches these crates, **reject the
  PR and let the Tauri upgrade dictate the new version**. The current
  pins are in `src-tauri/Cargo.toml` under `[target.'cfg(target_os =
  "windows")'.dependencies]`.
- **Diamond dependency conflicts against Tauri.** `cargo update` may pick
  a transitive version for a `windows-*` crate that disagrees with
  Tauri's pins. If `cargo update` reports a non-additive change to any
  `windows-*` or `webview2-com` crate, **abort** the update and re-evaluate
  (the change may need to ship with a Tauri upgrade).
- **All project commands need `cmd.exe /c`.** This repo is worked on from
  WSL over a Windows checkout. Bare `cargo` from WSL may fail or use a
  different toolchain.
- **`Cargo.lock` is committed.** Unlike most Rust libraries, Mini Diarium
  commits `src-tauri/Cargo.lock` (a binary application convention). Both
  procedures must regenerate and commit the lockfile.

## Lockfile-Only Procedure

Use this when the PR's `files[]` contains only `src-tauri/Cargo.lock` (no
`Cargo.toml` change). The PR was produced by Dependabot's `minor-and-patch`
group or a hand-written `cargo update` commit.

### Steps

1. **Fetch the bumped crate name and version from the PR title or body.**
   The PR body lists `name: log, from: 0.4.32, to: 0.4.33`. Extract the
   `to` version.

2. **Run `cargo update` for the single crate:**
   ```bash
   cmd.exe /c "cd src-tauri && cargo update -p <crate>@<to-version>"
   ```
   Replace `<crate>` with the crate name (e.g., `log`) and `<to-version>`
   with the target version (e.g., `0.4.33`). Omit `<to-version>` to let
   cargo pick the latest within the existing semver range; only do this
   if the PR's target version matches the spec's allowed range.

3. **Run the test suite:**
   ```bash
   cmd.exe /c "cd src-tauri && cargo test"
   ```

4. **Run the build (release-like, with the `custom-protocol` feature that
   release builds use):**
   ```bash
   cmd.exe /c "cd src-tauri && cargo build --features custom-protocol"
   ```

5. **Confirm the change set is just the lockfile:**
   ```bash
   git diff --stat
   ```
   Expected: only `src-tauri/Cargo.lock` shows changes. If `Cargo.toml`
   or other files changed, you picked the wrong path — abort and switch
   to the Manifest Bump Procedure.

### Validation

- `cmd.exe /c "cd src-tauri && cargo test"` exits 0.
- `cmd.exe /c "cd src-tauri && cargo build --features custom-protocol"` exits 0.
- `git diff --stat` shows changes only under `src-tauri/Cargo.lock`.
- `git diff src-tauri/Cargo.lock` shows the expected crate version.

## Manifest Bump Procedure

Use this when the PR's `files[]` includes `src-tauri/Cargo.toml`. The PR
changed the version constraint in the manifest and updated the lockfile
accordingly.

### Steps

1. **Read the PR's `Cargo.toml` diff:**
   ```bash
   gh pr diff <NUMBER> --repo <owner/repo> -- src-tauri/Cargo.toml
   ```
   Note the exact version pin change (e.g., `log = "0.4"` → `log = "0.4.33"`
   or `tauri = { version = "2.11.2" }` → `tauri = { version = "2.11.3" }`).

2. **Apply the same change to the local `src-tauri/Cargo.toml`:**
   - Edit only the affected line.
   - Preserve formatting (whitespace, ordering, feature lists).
   - Do not reorder dependencies or alter unrelated lines.

3. **Regenerate the lockfile for the bumped crate:**
   ```bash
   cmd.exe /c "cd src-tauri && cargo update -p <crate>"
   ```
   If the PR bumps multiple crates, run this for each.

4. **Run the test suite:**
   ```bash
   cmd.exe /c "cd src-tauri && cargo test"
   ```

5. **Run the build (release-like):**
   ```bash
   cmd.exe /c "cd src-tauri && cargo build --features custom-protocol"
   ```

6. **Confirm the change set is the manifest + lockfile only:**
   ```bash
   git diff --stat
   ```
   Expected: `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` show
   changes. Investigate any other files.

### Validation

- `cmd.exe /c "cd src-tauri && cargo test"` exits 0.
- `cmd.exe /c "cd src-tauri && cargo build --features custom-protocol"` exits 0.
- `git diff --stat` shows changes only under `src-tauri/Cargo.toml` and
  `src-tauri/Cargo.lock`.
- `git diff src-tauri/Cargo.toml` matches the PR's manifest diff.
- `git diff src-tauri/Cargo.lock` shows the expected resolved versions.

## Reference

- `src-tauri/Cargo.toml` — current version pins and the `[target.'cfg(target_os = "windows")'.dependencies]` block where `windows` / `webview2-com` are pinned.
- `src-tauri/Cargo.lock` — resolved transitive versions; do not hand-edit.
- `ENTRY.md` Cross-Cutting Gotchas — the Tauri `windows` / `webview2-com` constraint is duplicated here for completeness.
- For npm dependency updates, see `procedures/npm.md`.
- For GitHub Actions dependency updates, see `procedures/actions.md`.
