# Apply npm/bun Dependency PRs

Apply npm/bun dependency update PRs from GitHub into the workspace, ensuring
correctness across the dual-lockfile setup (`bun.lock` + `package-lock.json`)
and the Flatpak/Nix pipelines, and catching state mismatches.

This is the per-ecosystem procedure dispatched from `ENTRY.md` for PRs
classified as **npm** by the Triage section.

## Quick Checklist

- [ ] Discovery: fetch PR diffs, compare against current workspace, detect stale
  lockfiles
- [ ] Planning: create a plan via `manual-planning`, surface open questions,
  get user approval
- [ ] Execution: edit `package.json`, run `bun install`, run
  `npm install --package-lock-only --legacy-peer-deps`, optionally refresh
  `nix/package.nix` `npmDepsHash` (Linux only)
- [ ] Verification: grep lockfiles for correct versions, run type-check + lint
  + test:run, verify `git diff --stat` shows 3 or 4 files
- [ ] Commit: stage changed files, create commit with user identity,
  message format `Dependency Update: <short-summary>`, no push

## Gotchas

These are the mistakes that happen most often when applying npm dependency
PRs. Read before starting.

- **`package-lock.json` can be stale.** If a previous PR was applied with
  `bun install` alone, `package-lock.json` may still show an old version
  number. Always read its first few lines to check. It will be regenerated as
  a side effect of execution.
- **Dependabot PRs only touch `package-lock.json`.** Dependabot uses npm, so
  its PRs leave `bun.lock` untouched. You must regenerate `bun.lock` locally.
- **The npm command is NOT `npm install`.** Use the canonical command:
  `npm install --package-lock-only --legacy-peer-deps`. The `--legacy-peer-deps`
  flag is mandatory because `eslint-plugin-solid` peers on `eslint@^9` but the
  project uses `eslint@10`.
- **One PR may already be applied.** Always compare each PR's `package.json`
  diff against the current `package.json`. Don't assume all PRs are pending.
- **Multiple PRs can overlap on the same dependency.** When two PRs bump
  the same package to different versions, take the highest version.
- **All project commands need `cmd.exe /c`.** This repo is worked on from WSL
  over a Windows checkout. Bare `bun`/`npm` from WSL may fail.
- **`windows`/`webview2-com` Cargo crates are tied to the Tauri version.**
  Do not bump these independently. Tauri's transitive deps (wry, tao,
  tauri-runtime-wry) own the `windows` and `webview2-com` types passed to
  our code. A version mismatch causes type-level incompatibilities
  (e.g. `PCWSTR`/`Interface`/`COREWEBVIEW2_WEB_RESOURCE_CONTEXT` from
  different `windows-core` versions won't unify). Only bump these when
  the Tauri upgrade dictates it.
- **Check for pre-existing changes before starting.** Run `git status` and
  `git diff --stat` before any edits. Dangling changes from prior work can
  contaminate the final change set and must be addressed separately.
- **`npm install --package-lock-only` can drop `resolved`/`integrity` fields.**
  With `--legacy-peer-deps`, npm may write lockfile entries for some transitive
  packages that lack `resolved` and `integrity` hashes. The Flatpak CI's
  `generate-node-sources.mjs` (line 152: `if (!resolved || !integrity) continue`)
  skips these entries, causing `npm ci --offline` to fail with
  `npm error ... cache mode is 'only-if-cached' but no cached response is available`.
  **Detection:** after `--package-lock-only`, check for missing fields
  (see Phase 4 step 4). **Fix when detected:** delete `node_modules/`, run
  a full `npm install --legacy-peer-deps` to regenerate the lockfile with
  complete entries, then `bun install` to sync `bun.lock`. In the common
  case where all entries are complete, `--package-lock-only` is preferred
  — it's faster and leaves `node_modules/` untouched.
- **`@tiptap/*` packages are a monorepo — all must be the same version.**
  You cannot independently pin or downgrade one `@tiptap` package (e.g. pin
  `@tiptap/core` to 3.23.5 while leaving `@tiptap/extensions` at 3.23.6).
  The packages share internal TypeScript types (`Node`, `Mark`, `Editor`),
  and a version mismatch creates duplicate copies in `node_modules` with
  incompatible types — resulting in `TS2322: Two different types with this
  name exist, but they are unrelated`. To pin, pin ALL `@tiptap/*` packages
  to the same exact version. If the pinned version's `@tiptap/extensions`
  tarball is missing `dist/` files (published incomplete), the pin is not
  viable — revert and find a different fix for whatever the pin was meant
  to address.
- **`npmDepsHash` in `nix/package.nix` must be refreshed on Linux.**
  Whenever `package-lock.json` changes, the `npmDepsHash` field in
  `nix/package.nix` (inside the `frontend = buildNpmPackage { ... }` block)
  must also be updated or the Nix build breaks. This requires Linux+Nix —
  it cannot be done from Windows/WSL. If operating on Windows, note the
  omission in the commit message so a Linux-capable maintainer can follow
  up. See Phase 3 step 4.

## Workflow

### Phase 1: Discovery

For each PR the user wants to apply:

1. **Fetch PR metadata and diff:**
   ```bash
   gh pr view <NUMBER> --repo <owner/repo> --json title,body,files,commits
   gh pr diff <NUMBER> --repo <owner/repo>
   ```
   If the user provides URLs instead of numbers, extract the owner, repo, and
   PR number from the URL. The owner/repo can be inferred from `git remote -v`
   when not explicitly provided.

2. **Extract the dependency versions from each PR diff.** Focus on the
   `package.json` changes: what packages are bumped, from what version to what
   version. Ignore `package-lock.json` hunks during this comparison — the
   lockfile is regenerated locally.

3. **Compare against the current workspace.** Read `package.json` and check
   each dependency version from the PR. Categorize each PR:
   - **Fully applied:** all version bumps already present in `package.json`
   - **Partially applied:** some bumps present, others not
   - **Not applied:** no bumps from this PR are present

4. **Check lockfile health.** Read the first few lines of `package-lock.json`
   to check its version. If it differs from the version in `package.json`,
   flag it as stale. It will be corrected during `npm install`.

5. **Check for overlapping changes.** If multiple PRs modify the same
   dependency to different versions, take the highest version from the
   superset of all PRs. The lower-version PR will be auto-closed by
   Dependabot once the base branch reflects the higher version — do not
   ask the user whether to close it; just note it in the plan.

### Phase 2: Planning

1. **Load the `manual-planning` skill** and produce a plan file in `docs/`
   with a descriptive kebab-case name. The plan must follow the
   manual-planning template structure exactly: metadata block with status,
   Goal/Scope/Non-Goals, Assumptions, Open Questions, numbered tasks each
   with Status/Objective/Steps/Validation/Notes, a Cleanup task, and a
   Final Verification section. Each task's Validation field must list the
   specific commands to run (not prose).

2. The plan must include these details:
   - Which PRs are already applied and which are pending
   - Which dependencies will change and their new versions
   - **Lockfile strategy:** both `bun install` and
     `npm install --package-lock-only --legacy-peer-deps` will be run
   - **Stale lockfile warning** if detected in Phase 1
   - **Expected changed files:** `package.json`, `bun.lock`,
     `package-lock.json`, and optionally `nix/package.nix` if the Nix hash
     was refreshed on Linux
   - **Validation tasks:** separate tasks for type-check, lint, and test:run,
     each with the exact `cmd.exe /c bun run <command>` as its Validation

3. Surface only blocking questions before marking the plan
   `READY FOR APPROVAL`:
   - Are there truly conflicting version bumps (two PRs targeting different
     major versions of the same package)?
   - Is there a major version bump that could break the app?
   - Does `Cargo.toml` also need updates?
   Do NOT ask operational questions (e.g., "should I close the superseded
   PR?") — Dependabot auto-closes PRs when their base branch no longer
   needs the bump after the higher version is applied.

4. Do not begin implementation until the user approves.

### Phase 3: Execution

1. **Edit `package.json`** to apply all pending version bumps. Change only
   version strings — do not reorder dependencies or alter formatting.

2. **Regenerate `bun.lock`:**
   ```bash
   cmd.exe /c bun install
   ```

3. **Regenerate `package-lock.json`:**
   ```bash
   cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"
   ```
   `--package-lock-only` prevents npm from touching `node_modules/`.
   `--legacy-peer-deps` handles the eslint-plugin-solid peer mismatch.

4. **Refresh `npmDepsHash` in `nix/package.nix`** (Linux+Nix only):
   ```bash
   nix run nixpkgs#prefetch-npm-deps -- package-lock.json
   ```
   Update the `npmDepsHash` field in the `frontend = buildNpmPackage { ... }`
   block of `nix/package.nix` with the new hash. If on Windows/WSL, skip
   this step and note in the commit message that the hash needs a Linux
   follow-up. See `docs/todo/TODO_EXTRA.md` Part 2 for details.

5. **Never manually edit lockfiles.** If any install command fails,
   diagnose and fix the error; do not hand-patch the lockfile.

### Phase 4: Verification

1. **Verify versions in both lockfiles.** For each bumped dependency, grep
   both lockfiles to confirm the resolved version matches:
   ```powershell
   Select-String -Path bun.lock -Pattern "<package>@<version>" -SimpleMatch
   Select-String -Path package-lock.json -Pattern "<package>" -SimpleMatch
   ```
   Also confirm the project version in `package-lock.json` now matches
   `package.json`:
   ```powershell
   Select-String -Path package-lock.json -Pattern '"version": "<expected>"'
   ```

2. **Run the full validation suite:**
   ```bash
   cmd.exe /c bun run type-check
   cmd.exe /c bun run lint
   cmd.exe /c bun run test:run
   ```
   All three must exit with code 0.

3. **Verify the file change set:**
   ```bash
   git diff --stat
   ```
   Should show 3 or 4 files: `package.json`, `bun.lock`,
   `package-lock.json`, and optionally `nix/package.nix` if the Nix hash
   was refreshed. Investigate any other additional files.

   Note: when the refresh was skipped (Windows/WSL), `nix/package.nix` is
   expected to be unchanged. The Nix CI workflow catches the drift; see
   Phase 5 below for the required follow-up once the user pushes.

4. **Verify Flatpak lockfile integrity.** The Flatpak CI build runs
   `npm ci --offline` from a cache built by `generate-node-sources.mjs`,
   which requires every `node_modules/` entry to have `resolved` and
   `integrity` fields. Check for missing entries:
   ```powershell
   # Count entries with resolved+integrity vs total
   $pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages
   ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count
   ```
   If any entry lacks these fields, re-run a full `npm install --legacy-peer-deps`
   (deleting `node_modules/` first) before committing.

5. **Update the plan** to mark all tasks completed and plan status to
   `COMPLETED`.

6. **Commit the changes** with the user's git identity (no LLM user,
   no co-author), no push:
   ```bash
   git commit -m "Dependency Update: <short-summary>"
   ```
   Use the author's real name/email from `git config user.name` / `git config user.email`
   (set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`,
   `GIT_COMMITTER_EMAIL` if needed). The commit message format is:
   `Dependency Update: <list of bumped packages>`. Stage only the files
   that were intentionally changed (typically `package.json`, `bun.lock`,
   `package-lock.json`; for Cargo-only updates, `Cargo.lock`).

### Phase 5: Nix hash after push

If `package-lock.json` changed and the `npmDepsHash` refresh in Phase 3
step 4 was skipped (Windows/WSL), `nix/package.nix` is now stale. The
Nix CI workflow handles this automatically on pushes to master: if the
build detects a hash mismatch it patches `nix/package.nix` and pushes a
`chore(nix): refresh npmDepsHash [skip ci]` commit by itself.

No manual action is needed. If the Nix CI job fails for a reason other than
hash mismatch (genuine build error), investigate that separately.

---

## Scope Boundaries

- **Covers:** npm/bun dependencies in `package.json` and the corresponding
  `bun.lock` and `package-lock.json` files. The Linux-only `npmDepsHash`
  refresh in `nix/package.nix` is the only file outside `package.json`
  touched from this procedure.
- **For Cargo/Rust dependency updates**, use `procedures/cargo.md`.
- **For GitHub Actions dependency updates**, use `procedures/actions.md`.
- **E2E tests are out of scope** for dependency bumps. Running
  `test:e2e` is not required unless the bumped dependency is a Tauri API or
  plugin that could affect IPC behavior.

## Reference

For full details on the dual-lockfile requirement and the Flatpak pipeline:
- Root `CLAUDE.md` — "Updating Dependencies (npm/bun)" section
- `docs/FLATPAK_MAINTENANCE.md` — why `package-lock.json` is required
- `docs/todo/TODO_EXTRA.md` Part 2 — origin of the `npmDepsHash` step
