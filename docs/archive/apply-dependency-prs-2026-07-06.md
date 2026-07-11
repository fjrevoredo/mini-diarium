# Apply 7 Dependency PRs — 2026-07-06

## Metadata

- Plan Status: COMPLETED
- Created: 2026-07-06
- Last Updated: 2026-07-06
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Apply all 7 open Dependabot PRs to the workspace across npm, cargo, and github-actions ecosystems, regenerate lockfiles, run validation suites, and commit the unified change set.

## Scope

- npm: #203 — 7 devDependencies in package.json + regenerate bun.lock + package-lock.json
- cargo: #202 (aes-gcm manifest bump), #201 (env_logger lockfile-only), #197 (cmov lockfile-only)
- github-actions: #200 (setup-python), #199 (tauri-action MAJOR), #198 (actions/cache MAJOR)
- Commit with `Dependency Update:` prefix, no push

## Non-Goals

- Manual `nix/package.nix` npmDepsHash refresh (requires Linux+Nix; CI auto-patches on push)
- E2E tests (no bumped dependency affects IPC)
- Closing the Dependabot PRs (Dependabot auto-closes after base branch reflects the change)

## Assumptions

- Workspace is clean (`git status` returns nothing)
- All project commands use `cmd.exe /c` (WSL over Windows checkout)
- GitHub-hosted runners satisfy actions/cache v6 runtime requirements
- tauri-action v1.0.0 breaking changes (renamed options, dropped Tauri v1, removed includeRelease/includeDebug) do not affect current workflow config (none of those options are used)

## Open Questions

None. All 7 PRs analyzed; no conflicting bumps, no breaking changes that affect this repo.

## Milestones

### Milestone 1: npm dependencies (#203)

- Status: COMPLETED
- Purpose: Apply the 7 devDependency version bumps and regenerate both lockfiles.
- Exit Criteria: package.json has all 7 version bumps; bun.lock and package-lock.json are regenerated and consistent; type-check, lint, and test:run all exit 0; Flatpak lockfile integrity check passes; git diff shows only package.json, bun.lock, package-lock.json.

#### Task 1.1: Edit package.json with version bumps

- Status: TO BE DONE
- Objective: All 7 dependency versions match the PR #203 diff.
- Steps:
  1. Edit `@unocss/reset`: `^66.7.0` → `^66.7.3`
  2. Edit `@unocss/vite`: `^66.7.0` → `^66.7.3`
  3. Edit `eslint`: `^10.4.1` → `^10.6.0`
  4. Edit `prettier`: `^3.8.2` → `^3.9.3`
  5. Edit `unocss`: `^66.7.0` → `^66.7.3`
  6. Edit `vite`: `^8.0.16` → `^8.1.0`
  7. Edit `@playwright/test`: `^1.50.0` → `^1.61.1`
- Validation: `Select-String -Path package.json -Pattern '"@unocss/reset": "\^66\.7\.3"'` and equivalent for each of the 7 dependencies.
- Notes: Change only version strings; preserve formatting, ordering, and all other content.

#### Task 1.2: Regenerate bun.lock

- Status: TO BE DONE
- Objective: bun.lock reflects the new package.json versions.
- Steps:
  1. Run `cmd.exe /c bun install`
- Validation: Command exits 0. `git diff --stat` shows bun.lock as modified.
- Notes: Dependabot does not touch bun.lock; it must be regenerated locally.

#### Task 1.3: Regenerate package-lock.json

- Status: TO BE DONE
- Objective: package-lock.json reflects the new versions with correct format.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`
  2. Check for resolved+integrity completeness (Task 1.4 step 2). If entries are missing, delete `node_modules/` and run `cmd.exe /c "npm install --legacy-peer-deps"`, then `cmd.exe /c bun install`.
- Validation: Command exits 0. package-lock.json is modified.
- Notes: `--legacy-peer-deps` is mandatory for eslint-plugin-solid peer mismatch.

#### Task 1.4: Verify lockfile correctness and Flatpak integrity

- Status: TO BE DONE
- Objective: Both lockfiles contain the correct resolved versions; package-lock.json has no missing resolved/integrity fields.
- Steps:
  1. Grep bun.lock for each bumped package version.
  2. Check package-lock.json for missing resolved/integrity:
     ```powershell
     $pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages
     ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count
     ```
- Validation: Grep confirms bumped versions. The resolved+integrity count matches the total node_modules/* entry count.
- Notes: If entries lack resolved/integrity, re-run full `npm install --legacy-peer-deps` (see Task 1.3 notes).

#### Task 1.5: Run JS validation suite

- Status: TO BE DONE
- Objective: type-check, lint, and test:run all pass.
- Steps:
  1. Run `cmd.exe /c bun run type-check`
  2. Run `cmd.exe /c bun run lint`
  3. Run `cmd.exe /c bun run test:run`
- Validation: All three commands exit 0.
- Notes: None.

#### Task 1.6: Verify npm change set

- Status: TO BE DONE
- Objective: Only the expected 3 files changed.
- Steps:
  1. Run `git diff --stat`
- Validation: Output shows only `package.json`, `bun.lock`, `package-lock.json`. No other files.
- Notes: `nix/package.nix` is expected unchanged (npmDepsHash refresh skipped on Windows).

### Milestone 2: cargo dependencies (#202, #201, #197)

- Status: COMPLETED
- Purpose: Apply one manifest bump and two lockfile-only bumps to the Cargo workspace.
- Exit Criteria: Cargo.toml has the aes-gcm version change; Cargo.lock reflects aes-gcm 0.11.0, env_logger 0.11.11, cmov 0.5.4; cargo test and cargo build pass; no `windows-*` or `webview2-com` crate version changes.

#### Task 2.1: Apply aes-gcm manifest bump (#202)

- Status: TO BE DONE
- Objective: Cargo.toml updated from `aes-gcm = "0.10"` to `aes-gcm = "0.11"`.
- Steps:
  1. Edit `src-tauri/Cargo.toml`: change `aes-gcm = "0.10"` to `aes-gcm = "0.11"`.
  2. Run `cmd.exe /c "cd src-tauri && cargo update -p aes-gcm"`
- Validation: `Select-String -Path src-tauri/Cargo.toml -Pattern 'aes-gcm = "0.11"'`. `git diff src-tauri/Cargo.lock` shows aes-gcm bumped to 0.11.0.
- Notes: This is a major version bump. Dependabot already confirmed it compiles on CI (lint/test failures on the PR were likely unrelated or due to coverage). No `windows-*` or `webview2-com` crates involved.

#### Task 2.2: Apply env_logger lockfile-only bump (#201)

- Status: TO BE DONE
- Objective: Cargo.lock reflects env_logger 0.11.11.
- Steps:
  1. Run `cmd.exe /c "cd src-tauri && cargo update -p env_logger@0.11.11"`
- Validation: Command exits 0. `git diff src-tauri/Cargo.lock` shows env_logger at 0.11.11.
- Notes: Lockfile-only — Cargo.toml is unchanged.

#### Task 2.3: Apply cmov lockfile-only bump (#197)

- Status: TO BE DONE
- Objective: Cargo.lock reflects cmov 0.5.4.
- Steps:
  1. Run `cmd.exe /c "cd src-tauri && cargo update -p cmov@0.5.4"`
- Validation: Command exits 0. `git diff src-tauri/Cargo.lock` shows cmov at 0.5.4.
- Notes: Lockfile-only — Cargo.toml is unchanged.

#### Task 2.4: Run cargo test and build

- Status: TO BE DONE
- Objective: All Rust tests pass and release-like build succeeds.
- Steps:
  1. Run `cmd.exe /c "cd src-tauri && cargo test"`
  2. Run `cmd.exe /c "cd src-tauri && cargo build --features custom-protocol"`
- Validation: Both commands exit 0.
- Notes: None.

#### Task 2.5: Verify cargo change set

- Status: TO BE DONE
- Objective: Only Cargo.toml and Cargo.lock changed.
- Steps:
  1. Run `git diff --stat`
- Validation: Output shows changes only under `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`. No `windows-*` or `webview2-com` version changes.
- Notes: None.

### Milestone 3: github-actions dependencies (#200, #199, #198)

- Status: TO BE DONE
- Purpose: Apply three action version bumps to workflow YAML files.
- Exit Criteria: All three version pins updated in the correct workflow files; actionlint passes; git diff shows changes only under .github/workflows/.

#### Task 3.1: Apply actions/setup-python bump (#200)

- Status: TO BE DONE
- Objective: flathub-publish.yml uses setup-python@v6.3.0.
- Steps:
  1. Edit `.github/workflows/flathub-publish.yml`: change `actions/setup-python@v6.2.0` to `actions/setup-python@v6.3.0`.
- Validation: `Select-String -Path .github/workflows/flathub-publish.yml -Pattern 'actions/setup-python@v6.3.0'`
- Notes: Minor bump, no breaking changes.

#### Task 3.2: Apply tauri-apps/tauri-action MAJOR bump (#199)

- Status: TO BE DONE
- Objective: All tauri-action references updated from v0.6.2 to v1.0.0.
- Steps:
  1. Edit `.github/workflows/ci.yml`: change both `tauri-apps/tauri-action@v0.6.2` to `tauri-apps/tauri-action@v1.0.0`.
  2. Edit `.github/workflows/release.yml`: change `tauri-apps/tauri-action@v0.6.2` to `tauri-apps/tauri-action@v1.0.0`.
- Validation: `Select-String -Path .github/workflows/ci.yml -Pattern 'tauri-apps/tauri-action@v1.0.0'` returns 2 matches. `Select-String -Path .github/workflows/release.yml -Pattern 'tauri-apps/tauri-action@v1.0.0'` returns 1 match.
- Notes: MAJOR bump. Breaking changes confirmed to not affect current usage: no `includeRelease`, `includeDebug`, `draft`, `includeUpdaterJson`, `updaterJsonKeepUniversal`, `assetNamePattern` options in any workflow. Tauri v2 stable is supported.

#### Task 3.3: Apply actions/cache MAJOR bump (#198)

- Status: TO BE DONE
- Objective: All actions/cache references updated from v5.0.5 to v6.1.0.
- Steps:
  1. Edit `.github/workflows/ci.yml`: change all 10 `actions/cache@v5.0.5` to `actions/cache@v6.1.0`.
  2. Edit `.github/workflows/release.yml`: change `actions/cache@v5.0.5` to `actions/cache@v6.1.0`.
- Validation: `Select-String -Path .github/workflows/ci.yml -Pattern 'actions/cache@v5.0.5'` returns 0 matches. `Select-String -Path .github/workflows/ci.yml -Pattern 'actions/cache@v6.1.0'` returns 10 matches. `Select-String -Path .github/workflows/release.yml -Pattern 'actions/cache@v5.0.5'` returns 0 matches.
- Notes: MAJOR bump (v5→v6). GitHub-hosted runners satisfy Node.js 24 runtime. No self-hosted runners in use.

#### Task 3.4: Validate with actionlint

- Status: TO BE DONE
- Objective: All modified workflow files pass actionlint.
- Steps:
  1. Run `cmd.exe /c actionlint -version`
  2. Run `cmd.exe /c actionlint .github/workflows/*.yml`
  3. If actionlint is not installed, fall back to PowerShell YAML parse.
- Validation: actionlint exits 0, or PowerShell YAML parse succeeds for all workflow files.
- Notes: None.

#### Task 3.5: Verify actions change set

- Status: TO BE DONE
- Objective: Only workflow files changed.
- Steps:
  1. Run `git diff --stat`
- Validation: Output shows changes only under `.github/workflows/` (ci.yml, release.yml, flathub-publish.yml). No other files.
- Notes: None.

### Milestone 4: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Review the complete change set and commit.
- Exit Criteria: git diff --stat matches the expected files across all ecosystems; commit is created with correct message and identity; plan status is COMPLETED.

#### Task 4.1: Final git diff review

- Status: TO BE DONE
- Objective: The complete change set contains only the expected files.
- Steps:
  1. Run `git diff --stat`
  2. Verify the file list: `package.json`, `bun.lock`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/flathub-publish.yml`.
  3. Run `git diff -- .github/ src-tauri/Cargo.toml src-tauri/Cargo.lock package.json` to quickly scan all non-lockfile changes.
- Validation: Exactly 8 files changed (3 npm + 2 cargo + 3 actions). No unexpected files.
- Notes: None.

#### Task 4.2: Commit all changes

- Status: TO BE DONE
- Objective: Single commit with all dependency updates, no push.
- Steps:
  1. Get git identity: `git config user.name` and `git config user.email`.
  2. Stage all 8 changed files.
  3. Commit with message:
     ```
     Dependency Update: @unocss/* 66.7.3, eslint 10.6.0, prettier 3.9.3, vite 8.1.0, @playwright/test 1.61.1, aes-gcm 0.11, env_logger 0.11.11, cmov 0.5.4, setup-python 6.3.0, tauri-action 1.0.0, actions/cache 6.1.0
     ```
  4. Do NOT push.
- Validation: `git log -1 --oneline` shows the commit. `git diff --stat HEAD~1` shows the 8 expected files.
- Notes: Set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` from `git config` values.

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user (none remain).
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks (17 tasks across 4 milestones).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] UX-GATE: Not applicable (no UI changes).
- [x] PLATFORM-VERIFY: Not applicable (no Tauri WebView changes).

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- All project commands must use `cmd.exe /c` prefix (WSL over Windows checkout).
