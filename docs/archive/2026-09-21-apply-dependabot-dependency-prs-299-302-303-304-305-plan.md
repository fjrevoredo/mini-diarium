# Apply Dependabot dependency PRs 299 302 303 304 305

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master`, clean worktree at `3ee5949` (`git status --porcelain` printed nothing; `git log --oneline -1` -> `3ee5949 add new docs`).
- Remote: `https://github.com/fjrevoredo/mini-diarium.git` (`git remote -v`). All target PRs live on that repo.
- Shell: Windows PowerShell (win32). Project commands run through `cmd.exe /c ...` per root `CLAUDE.md` (Execution Environment); `cargo` runs bare from the repo root.
- Verified toolchain: bun `1.4.2` (`cmd.exe /c "bun --version"`), actionlint `1.7.12` (`cmd.exe /c "actionlint -version"`), Python `3.13.4` (`python --version`), git identity `Francisco J. Revoredo <fjrevoredo@gmail.com>` (`git config user.name` / `user.email`).
- Stack: SolidJS frontend with dual lockfiles `bun.lock` + `package-lock.json`; Rust/Tauri v2 Cargo workspace with the single lockfile `Cargo.lock` at the repo root; GitHub Actions workflows under `.github/workflows/`.
- Governing runbook: `.agents/skills/runbooks/skills/apply-dependency-prs/ENTRY.md` routes to `procedures/npm.md`, `procedures/cargo.md`, and `procedures/actions.md`. ENTRY order for multi-ecosystem batches is npm -> cargo -> actions.
- Precedent plan for the npm dual-lockfile workflow and the CHANGELOG convention: `docs/plans/2026-09-15-apply-dependabot-npm-dependency-prs-296-297-298-with-vitest-5-migration-plan.md` (e.g. its Task 4.2 changelog step).
- `manual-planning` self-check command used by this plan: `python "C:\Users\Francisco\.config\opencode\skills\manual-planning\scripts\check-plan.py" <plan-file>`.

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Open dependency PRs | #299, #302, #303, #304, #305, #285 | `gh pr list --repo fjrevoredo/mini-diarium --state open --limit 100` |
| #305 ecosystem | cargo; files `Cargo.lock` only; label `rust`; title "Bump rhai from 1.26.0 to 1.26.1 in the minor-and-patch group" | `gh pr view 305 --json files,labels,title` |
| #304 ecosystem | npm; files `package.json`, `package-lock.json`; label `javascript` | `gh pr view 304 --json files,labels` |
| #299 ecosystem | npm; files `package.json`, `package-lock.json`; label `javascript` | `gh pr view 299 --json files,labels` |
| #302 ecosystem | actions; file `.github/workflows/ci.yml`; label `github_actions` | `gh pr view 302 --json files,labels` |
| #303 ecosystem | actions; file `.github/workflows/release.yml`; label `github_actions` | `gh pr view 303 --json files,labels` |
| #285 status | Already applied; PR diff is empty (0 changed files); `toml@4.3.0` already resolved in `master` | `gh api repos/fjrevoredo/mini-diarium/pulls/285/files` printed nothing; `Select-String -Path .opencode/package-lock.json -Pattern '"node_modules/toml"'` shows `4.3.0` |
| Current `marked` | `^18.0.10`; both lockfiles resolve 18.0.11 | `package.json:85`; `Select-String bun.lock 'marked@'`, `package-lock.json` |
| Current `@types/node` | `^26.3.0`; both lockfiles resolve 26.4.1 | `package.json:96`; `Select-String bun.lock '@types/node@'` |
| Current `eslint-plugin-solid` | `^0.17.0`; resolves 0.17.0 | `package.json:107`; `Select-String bun.lock 'eslint-plugin-solid@'` |
| Current `typescript-eslint` | `^8.68.0`; resolves 8.69.0 | `package.json:112`; `Select-String bun.lock 'typescript-eslint@'` |
| Current `vite` | `^8.2.2`; resolves 8.2.2 | `package.json:114`; `Select-String bun.lock '"vite":'` |
| Current `rhai` | `1.26.0` | `Cargo.lock:3743-3744` |
| Current signpath pin | `c92b958760219087e01f8d67a1669ed57afe2627 # v2` at two sites | `.github/workflows/release.yml:237`, `.github/workflows/release.yml:259` |
| Current codecov pin | `e79a6962e0d4c0c17b229090214935d2e33f8354 # v6.0.1` at two sites | `.github/workflows/ci.yml:210`, `.github/workflows/ci.yml:217` |
| #299 / #304 CI status | Red, but only for the expected reasons: bun `error: lockfile had changes, but lockfile is frozen` (Dependabot never touches `bun.lock`) plus the Nix `npmDepsHash` check | `gh run view 35605521874 --log-failed`, `gh run view 35605455172 --log-failed` |
| CHANGELOG state | No unreleased section; newest heading is `## [0.7.3] - 15-09-2026` | `CHANGELOG.md:37`; `Select-String -Path CHANGELOG.md -Pattern 'Unreleased'` matched only the template line |
| Next-unreleased heading convention | `## [X.Y.Z] - [Unreleased]` introduced as the first change of a cycle (precedent `## [0.7.3] - [Unreleased]` in commit `cf6bdd6`); pre-release Step 1 requires the bracket-wrapped form | `git show cf6bdd6 -- CHANGELOG.md`; `.agents/skills/runbooks/skills/pre-release/ENTRY.md` line 20 |
| signpath v3 compatibility | The only `action.yml` difference between the two pins is the `connector-url` default; every input this repo uses (`api-token`, `organization-id`, `project-slug`, `signing-policy-slug`, `artifact-configuration-slug`, `github-artifact-id`, `wait-for-completion`, `output-artifact-directory`) is unchanged | compared `action.yml` at both commit SHAs (`Compare-Object`) |
| codecov v7 compatibility | The v7.0.0 release notes cover only a GPG-key account migration; no action input changed | `gh pr view 302 --json body` |

### Hard constraints

1. Never hand-edit `bun.lock`, `package-lock.json`, or `Cargo.lock` — regenerate them with the documented commands (`procedures/npm.md` Phase 3 step 5, `procedures/cargo.md`). A hand-patch breaks the Flatpak `npm ci --offline` build and is unreviewable.
2. The npm regeneration command is exactly `npm install --package-lock-only --legacy-peer-deps`; `--legacy-peer-deps` is mandatory because `eslint-plugin-solid` peers on `eslint@^9` while the repo uses `eslint@10` (`procedures/npm.md` gotcha).
3. Dependabot's `package-lock.json` hunks are never applied verbatim; only the `package.json` version strings are taken from the PRs, then both lockfiles are regenerated (`procedures/npm.md` Phase 1 step 2 and Phase 4 step 4).
4. Commit only the intentionally changed files with the user's real git identity and no LLM author or co-author trailer; do not push (`procedures/npm.md` Phase 4 step 6).
5. `nix/package.nix` `npmDepsHash` cannot be refreshed from Windows; leave it unchanged and note the omission in the commit body (`procedures/npm.md` Phase 3 step 4 / Phase 5). CI patches it on push.
6. `windows` / `webview2-com` Cargo crates are tied to the Tauri version and must not be bumped by this batch (`procedures/cargo.md` gotchas). #305 touches only `rhai`, so this is satisfied.
7. Validate workflow edits with `actionlint` (`procedures/actions.md` Validation), not with a bare YAML parse.

## Goal

Integrate the five open Dependabot dependency PRs (#304 and #299 npm, #305 cargo, #302 and #303 GitHub Actions) into local `master` as one verified, scoped commit: both npm lockfiles regenerated and aligned, `Cargo.lock` updated for `rhai` 1.26.1, the two workflow action pins bumped, a CHANGELOG entry added, and the frontend and backend gates green.

## Scope

- `package.json` dev bump from #304: `@types/node` `^26.3.0` -> `^26.5.1`, `eslint-plugin-solid` `^0.17.0` -> `^0.18.0`, `typescript-eslint` `^8.68.0` -> `^8.70.0`, `vite` `^8.2.2` -> `^8.3.0`.
- `package.json` prod bump from #299: `marked` `^18.0.10` -> `^18.0.13`.
- Regeneration of `bun.lock` (`cmd.exe /c bun install`) and `package-lock.json` (`cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`).
- `Cargo.lock` bump from #305: `rhai` 1.26.0 -> 1.26.1 (`cmd.exe /c "cargo update -p rhai@1.26.1"`).
- `.github/workflows/release.yml` from #303: both signpath pins `c92b958... # v2` -> `f6d04783b4569d051e0c80105fe66e82819d0092 # v3.0`.
- `.github/workflows/ci.yml` from #302: both codecov pins `e79a696... # v6.0.1` -> `0b35c9ecc4f0529d0eb674914510c22f85b196b4 # v7.1.0`.
- A new `## [0.7.4] - [Unreleased]` CHANGELOG section with one `### Internal` bullet covering all three ecosystems.

## Non-Goals

- PR #285 (`.opencode` toml 4.3.0): already present in `master`, empty diff. No local change; Dependabot will close it once its base no longer needs the bump (`procedures/npm.md` Phase 1 step 5).
- Pushing, merging, or closing the GitHub PRs — the runbook stops at a local commit (`procedures/npm.md` Phase 4 step 6). The user owns the push; Dependabot auto-closes superseded PRs afterwards.
- E2E tests (`cmd.exe /c bun run test:e2e:local`) — out of scope for dependency bumps unless a bumped dependency is a Tauri API or plugin that can affect IPC (`procedures/npm.md` Scope Boundaries; the precedent plan listed E2E as a non-goal). No Tauri API or plugin is bumped here.
- `nix/package.nix` `npmDepsHash` — requires Linux+Nix; the Nix CI workflow patches it on push (`procedures/npm.md` Phase 5).
- Rust source changes — #305 is a lockfile-only patch bump; no `Cargo.toml` changes and no `windows`/`webview2-com` movement.
- Any other open, non-dependency PR on the repository.

## Assumptions

- The five open PRs are the intended set (the user supplied the PR list URL and asked to integrate all dependency PRs).
- Every bump except the two GitHub Actions majors is a minor or patch release; the two Actions majors are compatible because their input surfaces are unchanged (see the repository facts table). If a gate fails, the affected task becomes `BLOCKED` rather than being forced green.
- `vite` `^8.3.0` builds under bun 1.4.2; `cmd.exe /c bun run build` in Task 4.2 is the proof.
- `@types/node` `^26.5.1`, `typescript-eslint` `^8.70.0`, and `eslint-plugin-solid` `^0.18.0` do not introduce new type or lint errors; Task 4.2 turns the task `BLOCKED` if they do.

## Open Questions

- None. The already-applied #285, the two Actions major bumps, the E2E scope question, and the CHANGELOG heading were each resolved from repository evidence (see the repository facts table and hard constraints).

## Milestones

### Milestone 1: Root npm updates (#304 dev + #299 prod)

- Status: COMPLETED
- Purpose: Apply the two npm PRs' version strings, then regenerate and align both lockfiles.
- Exit Criteria: `package.json` carries the five new version strings, both lockfiles resolve each bumped package to the new version, the project version block in `package-lock.json` matches `package.json`, and the Flatpak integrity check finds no `node_modules/*` entry missing `resolved`+`integrity`.

#### Task 1.1: Edit `package.json` devDependencies for #304

- Status: COMPLETED
- Depends On: none
- Objective: The four #304 dev version strings are updated in `package.json`; no other line changes.
- Steps:
  1. In `devDependencies` (`package.json:88-120`): `@types/node` `^26.3.0` -> `^26.5.1` (`package.json:96`); `eslint-plugin-solid` `^0.17.0` -> `^0.18.0` (`package.json:107`); `typescript-eslint` `^8.68.0` -> `^8.70.0` (`package.json:112`); `vite` `^8.2.2` -> `^8.3.0` (`package.json:114`).
  2. Change only version strings; do not reorder dependencies or reflow the file (`procedures/npm.md` Phase 3 step 1).
- Validation: `git diff package.json` shows exactly the four version-string edits above and no other lines.
- Notes: `eslint-plugin-solid` `0.18.0` and `vite` `8.3.0` are minor bumps whose risk is caught by Task 4.2.

#### Task 1.2: Edit `package.json` dependencies for #299

- Status: COMPLETED
- Depends On: none
- Objective: The `marked` version string is updated in `package.json`; no other line changes.
- Steps:
  1. In `dependencies` (`package.json:64-87`): `marked` `^18.0.10` -> `^18.0.13` (`package.json:85`).
  2. Change only the version string (`procedures/npm.md` Phase 3 step 1).
- Validation: `git diff package.json` shows the single `marked` version-string edit.
- Notes: `marked` is the only prod bump in this batch.

#### Task 1.3: Regenerate `bun.lock`

- Status: COMPLETED
- Depends On: 1.1, 1.2
- Objective: `bun.lock` resolves all five bumped packages to their new versions.
- Steps:
  1. Run `cmd.exe /c bun install`. Dependabot never touches `bun.lock`, so it must be regenerated locally (`procedures/npm.md` gotcha).
  2. Confirm the bumped packages resolved as expected; if `vite` drags a narrower transitive range, accept the highest resolved version within `^8.3.0`.
- Validation: `Select-String -Path bun.lock -Pattern '@types/node@26.5.1','eslint-plugin-solid@0.18.0','typescript-eslint@8.70.0','vite@8.3.0','marked@18.0.13'` matches all five.
- Notes: Do not hand-edit `bun.lock` (Hard constraint 1).

#### Task 1.4: Regenerate `package-lock.json`

- Status: COMPLETED
- Depends On: 1.3
- Objective: `package-lock.json` matches the new `package.json` and both installers agree.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"` (`procedures/npm.md` Phase 3 step 3). `--package-lock-only` leaves `node_modules/` untouched.
  2. Confirm the root `packages[""]` block ranges (`package-lock.json:1-69`) match `package.json`.
- Validation: `Select-String -Path package-lock.json -Pattern '"version": "26.5.1"','"version": "0.18.0"','"version": "8.70.0"','"version": "8.3.0"','"version": "18.0.13"'` matches all five, and the root-block ranges match `package.json`.
- Notes: If Task 1.5 finds missing `resolved`/`integrity` fields, delete `node_modules/` and run a full `cmd.exe /c "npm install --legacy-peer-deps"` instead (`procedures/npm.md` gotcha).

#### Task 1.5: Verify lockfiles and Flatpak integrity

- Status: COMPLETED
- Depends On: 1.4
- Objective: Both lockfiles carry the new versions and every `node_modules/*` entry has `resolved` + `integrity`.
- Steps:
  1. Re-grep both lockfiles for the five bumped versions and for the project version `0.7.3` (`Select-String -Path package-lock.json -Pattern '"version": "0.7.3"'`).
  2. Count integrity coverage: `$pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages; ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count` and compare against the total `node_modules/*` key count.
- Validation: every bumped version appears in both lockfiles, the root-block project version matches `package.json`, and the `resolved`+`integrity` count equals the total `node_modules/*` key count.
- Notes: Missing fields break the Flatpak `npm ci --offline` build (`procedures/npm.md` gotcha); if found, use the full-install fallback from Task 1.4.

### Milestone 2: Cargo lockfile update (#305 rhai)

- Status: COMPLETED
- Purpose: Apply the lockfile-only `rhai` patch bump and prove the workspace still builds.
- Exit Criteria: `Cargo.lock` shows `rhai` 1.26.1 as the only change, `cargo test --workspace` exits 0, and the release-like app build exits 0.

#### Task 2.1: Update `rhai` in `Cargo.lock`

- Status: COMPLETED
- Depends On: none
- Objective: `Cargo.lock` resolves `rhai` to 1.26.1 (matching #305) with no manifest change.
- Steps:
  1. Run `cmd.exe /c "cargo update -p rhai@1.26.1"` (`procedures/cargo.md` Lockfile-Only Procedure).
  2. Confirm the change set is only `Cargo.lock`.
- Validation: `git diff Cargo.lock` shows `name = "rhai"` moving from `1.26.0` to `1.26.1` (`Cargo.lock:3743`); `git diff --stat` lists only `Cargo.lock`.
- Notes: `cargo update -p rhai@1.26.1` fails if that exact version is not published; fall back to `cmd.exe /c "cargo update -p rhai"` only if the resolved version is still within the existing spec, then record it in the Decision Log.

#### Task 2.2: Backend test suite

- Status: COMPLETED
- Depends On: 2.1
- Objective: All three workspace crates still pass with `rhai` 1.26.1.
- Steps:
  1. Run `cmd.exe /c "cargo test --workspace"` (the `--workspace` flag is required so the core and crypto crate tests run).
- Validation: exit code 0.
- Notes: `rhai` backs the plugin sandbox in `crates/mini-diarium-core/`; the workspace run covers those tests.

#### Task 2.3: Release-like app build

- Status: COMPLETED
- Depends On: 2.2
- Objective: The app crate builds with the `custom-protocol` feature the release pipeline uses.
- Steps:
  1. Run `cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"` (`procedures/cargo.md` Lockfile-Only Procedure step 4).
- Validation: exit code 0.
- Notes: This is the cargo procedure's build gate; it also catches a `rhai` type-level regression that tests alone might miss.

### Milestone 3: GitHub Actions pin bumps (#303, #302)

- Status: COMPLETED
- Purpose: Bump the two action pins, then lint the workflows.
- Exit Criteria: Both workflow files carry the new SHAs and `actionlint` reports no errors in the two changed workflow files (`.github/workflows/release.yml`, `.github/workflows/ci.yml`).

#### Task 3.1: Bump the signpath pin in `release.yml` (#303)

- Status: COMPLETED
- Depends On: none
- Objective: Both signpath `uses:` pins point to the v3.0 SHA.
- Steps:
  1. At `.github/workflows/release.yml:237` and `.github/workflows/release.yml:259`, replace `signpath/github-action-submit-signing-request@c92b958760219087e01f8d67a1669ed57afe2627 # v2` with `signpath/github-action-submit-signing-request@f6d04783b4569d051e0c80105fe66e82819d0092 # v3.0`.
  2. Preserve indentation and every surrounding step (`procedures/actions.md` step 4).
- Validation: `Select-String -Path .github/workflows/release.yml -Pattern 'signpath/github-action-submit-signing-request'` shows the new SHA `# v3.0` at both sites.
- Notes: The v2 -> v3.0 major changes only the default `connector-url`; this repo sets none of the changed inputs, so no other edit is required (see the repository facts table).

#### Task 3.2: Bump the codecov pin in `ci.yml` (#302)

- Status: COMPLETED
- Depends On: none
- Objective: Both codecov `uses:` pins point to the v7.1.0 SHA.
- Steps:
  1. At `.github/workflows/ci.yml:210` and `.github/workflows/ci.yml:217`, replace `codecov/codecov-action@e79a6962e0d4c0c17b229090214935d2e33f8354 # v6.0.1` with `codecov/codecov-action@0b35c9ecc4f0529d0eb674914510c22f85b196b4 # v7.1.0`.
  2. Preserve the `with:` block (`token`, `files`, `flags`) unchanged (`procedures/actions.md` step 4).
- Validation: `Select-String -Path .github/workflows/ci.yml -Pattern 'codecov/codecov-action'` shows the new SHA `# v7.1.0` at both sites.
- Notes: codecov v7.0.0 changed only its signing-key account; the action inputs are unchanged (see the repository facts table).

#### Task 3.3: Validate the workflows with actionlint

- Status: COMPLETED
- Depends On: 3.1, 3.2
- Objective: Both edited workflows parse and lint cleanly.
- Steps:
  1. Run `cmd.exe /c actionlint .github/workflows/*.yml` (`procedures/actions.md` step 5).
  2. Confirm the change set is only under `.github/workflows/`.
- Validation: `actionlint` exit code 0 on the two changed files; `git diff --stat` lists only `.github/workflows/release.yml` and `.github/workflows/ci.yml`.
- Notes: Workflows are not built locally; the next CI run is the final pipeline proof (`procedures/actions.md` gotcha), so `actionlint` is the local gate. The literal glob form `actionlint .github/workflows/*.yml` does not expand under `cmd.exe`, and passing all nine workflows surfaces a pre-existing `indexnow.yml` error — see Task 3.4 and DEC-004.

#### Task 3.4: Pre-existing `indexnow.yml` actionlint error (out of scope)

- Status: BLOCKED
- Depends On: none
- Objective: Record, without fixing, the pre-existing actionlint failure in `.github/workflows/indexnow.yml`.
- Steps:
  1. `actionlint .github/workflows/indexnow.yml` reports `7:5: expected "inputs" key for "workflow_dispatch" section but got "description"`.
  2. Do not edit `indexnow.yml` in this batch: a workflow-content fix is unrelated to dependency updates and would break the Task 5.1 intended file set (CLAUDE.md workflow rule 6, scoped commits).
- Validation: `git diff --stat` does not list `.github/workflows/indexnow.yml`.
- Notes: Blocked pending a separate, deliberate workflow fix. It does not affect the two files this batch changes, and all nine workflows still pass except this one pre-existing finding.

### Milestone 4: Changelog and validation gates

- Status: COMPLETED
- Purpose: Record the batch and prove the frontend and backend are green under the new dependency set.
- Exit Criteria: The CHANGELOG has one `### Internal` bullet under a new `## [0.7.4] - [Unreleased]` heading; type-check, lint, format:check, test:run, build, cargo test, clippy, rustfmt, and the release-like cargo build all exit 0.

#### Task 4.1: Add the CHANGELOG entry

- Status: COMPLETED
- Depends On: 1.5, 2.1, 3.3
- Objective: The batch is recorded under the current unreleased version block.
- Steps:
  1. Add a new heading `## [0.7.4] - [Unreleased]` at the top of the `# Versions` list, directly above `## [0.7.3] - 15-09-2026` (`CHANGELOG.md:37`). This mirrors the first-change-of-cycle precedent (`## [0.7.3] - [Unreleased]` in commit `cf6bdd6`) and uses the bracket-wrapped form the pre-release runbook expects (`.agents/skills/runbooks/skills/pre-release/ENTRY.md` line 20).
  2. Under it add a `### Internal` bullet naming the npm bumps (`marked` 18.0.13; `@types/node` 26.5.1; `eslint-plugin-solid` 0.18.0; `typescript-eslint` 8.70.0; `vite` 8.3.0), the cargo bump (`rhai` 1.26.1), the Actions bumps (`codecov/codecov-action` 7.1.0; `signpath/github-action-submit-signing-request` 3.0), the `nix/package.nix` `npmDepsHash` Linux follow-up, and cite `(Dependabot #299, #302, #303, #304, #305)`.
  3. Follow the existing bullet style at `CHANGELOG.md:53-56`.
- Validation: `git diff CHANGELOG.md` shows the new heading plus one `### Internal` bullet and no other edit.
- Notes: One bullet keeps the change set reviewable. `Internal` is correct because none of these bumps is user-visible.

#### Task 4.2: Frontend validation gates

- Status: COMPLETED
- Depends On: 1.5
- Objective: The frontend is clean under the new npm dependency set.
- Steps:
  1. Run `cmd.exe /c bun run type-check`.
  2. Run `cmd.exe /c bun run lint`.
  3. Run `cmd.exe /c bun run format:check`.
  4. Run `cmd.exe /c bun run test:run`.
  5. Run `cmd.exe /c bun run build` (the `vite` bump makes a real build the meaningful proof).
- Validation: all five commands exit 0.
- Notes: The `vite` 8.3.0 and `eslint-plugin-solid` 0.18.0 bumps are the main failure risks; if a gate fails on a genuine new incompatibility, mark the task `BLOCKED` and surface it rather than masking it (`procedures/npm.md` Phase 4 step 2).

#### Task 4.3: Backend validation gates

- Status: COMPLETED
- Depends On: 2.1
- Objective: The Rust workspace is clean after the `rhai` bump.
- Steps:
  1. Run `cmd.exe /c "cargo test --workspace"`.
  2. Run `cmd.exe /c "cargo clippy --workspace --all-targets -- -D warnings"`.
  3. Run `cmd.exe /c "cargo fmt --all --check"`.
- Validation: all three commands exit 0.
- Notes: clippy and rustfmt are the repository's backend gates (`docs/best-practices/POST_TASK_BEST_PRACTICES.md` step 4 and step 5).

### Milestone 5: Finalize, commit, and cleanup

- Status: COMPLETED
- Purpose: Review the change set, commit it with the user's identity, remove scratch artifacts, and close the plan.
- Exit Criteria: `git status --porcelain` shows only the intended changes plus the excluded plan file, the commit exists, and every `## Pre-flight Checks` item passes.

#### Task 5.1: Review the change set

- Status: COMPLETED
- Depends On: 4.2, 4.3
- Objective: The intended file set is the only thing changed.
- Steps:
  1. Run `git status --short` and `git diff --stat`.
  2. Confirm the set is exactly: `package.json`, `bun.lock`, `package-lock.json`, `Cargo.lock`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `CHANGELOG.md`.
- Validation: no unexpected files appear; `nix/package.nix` is unchanged (Non-Goals).
- Notes: The plan directory is excluded via `.git/info/exclude`, so it does not appear in `git status`.

#### Task 5.2: Commit

- Status: COMPLETED
- Depends On: 5.1
- Objective: One scoped dependency-update commit, no push.
- Steps:
  1. Stage only the seven intended files.
  2. Commit with message `Dependency Update: marked, @types/node, eslint-plugin-solid, typescript-eslint, vite, rhai, codecov-action, signpath action` (form `Dependency Update: <short-summary>`, `procedures/npm.md` Phase 4 step 6).
  3. Use the repository git identity `Francisco J. Revoredo <fjrevoredo@gmail.com>` via `GIT_AUTHOR_*`/`GIT_COMMITTER_*`; no LLM author, no co-author trailer.
  4. Note the `nix/package.nix` `npmDepsHash` refresh omission in the commit body (Hard constraint 5).
- Validation: `git log --oneline -2` shows the new commit; `git status --porcelain` shows only the excluded plan entry.
- Notes: A single combined commit matches the repository convention for multi-ecosystem dependency batches (e.g. commits `c89d7ce`, `ee942ad`, `47492c9`).

#### Task 5.3: Cleanup intermediate artifacts

- Status: COMPLETED
- Depends On: 5.2
- Objective: No implementation-only artifacts remain in the worktree.
- Steps:
  1. Inspect the worktree for scratch files created during discovery; none are expected because discovery used only `gh` and read-only shell commands.
  2. Delete any scratch files if present.
  3. Keep the plan file (untracked and locally excluded); it is the session ledger.
- Validation: `git status --porcelain` lists no stray files.
- Notes: Do not remove user-provided files.

#### Task 5.4: Final verification

- Status: COMPLETED
- Depends On: 5.3
- Objective: The repository is green after all changes.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
- Validation: all pre-flight commands exit 0.
- Notes: None.

## Project Gates

- Frontend gates: `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run format:check`, `cmd.exe /c bun run test:run`, `cmd.exe /c bun run build` — all must exit 0.
- Backend gates: `cmd.exe /c "cargo test --workspace"`, `cmd.exe /c "cargo clippy --workspace --all-targets -- -D warnings"`, `cmd.exe /c "cargo fmt --all --check"`, `cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"` — all must exit 0.
- Actions gate: `cmd.exe /c actionlint .github/workflows/*.yml` — exit 0.
- Bookkeeping: a `CHANGELOG.md` entry is required (Task 4.1), per `docs/best-practices/POST_TASK_BEST_PRACTICES.md` step 3.
- No push; commit only (Task 5.2). `nix/package.nix` is left to CI.
- E2E is not a gate for this batch (Non-Goals).

## Pre-flight Checks

Run before the plan may reach `COMPLETED`. This is a named checklist of this project's actual
commands, distinct from per-task validation: per-task validation proves one task worked, these
prove the repository as a whole is in a shippable state.

- [x] [`cmd.exe /c bun run type-check`] — exit 0 (2026-09-21)
- [x] [`cmd.exe /c bun run lint`] — exit 0 (2026-09-21)
- [x] [`cmd.exe /c bun run format:check`] — exit 0, "All matched files use Prettier code style!" (2026-09-21)
- [x] [`cmd.exe /c bun run test:run`] — exit 0, 109 files / 1126 tests passed (2026-09-21; two earlier runs had a single load-induced 5000 ms timeout each, see DEC-005 and DEC-007)
- [x] [`cmd.exe /c bun run build`] — exit 0, built in 13.45 s (2026-09-21)
- [x] [`cmd.exe /c "cargo test --workspace"`] — exit 0 (2026-09-21)
- [x] [`cmd.exe /c "cargo clippy --workspace --all-targets -- -D warnings"`] — exit 0 (2026-09-21)
- [x] [`cmd.exe /c "cargo fmt --all --check"`] — exit 0 (2026-09-21)
- [x] [`cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"`] — exit 0 (2026-09-21)
- [x] [`actionlint .github/workflows/release.yml .github/workflows/ci.yml`] — exit 0; the literal glob form from the plan and the all-nine-file form do not exit 0 because of a pre-existing `indexnow.yml` error (Task 3.4, DEC-004)
- [x] [`git status --porcelain` shows only intended final changes (plus the excluded plan file)] — clean after commit `24f9af1` (2026-09-21)

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what the plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

<!--
Once this section passes ~10 entries, move it to a companion
`YYYY-MM-DD-<name>-decisions.md` and leave a pointer here. `check-plan.py` warns (`W005`)
at that threshold.
-->

### DEC-001 — caret resolution picks `@types/node` 26.6.2, not 26.5.1

- Date: 2026-09-21
- Task: 1.3
- Decision: Accept `@types/node` resolving to `26.6.2` in `bun.lock` (and, expectedly, `package-lock.json`) after the `^26.5.1` bump from #304, instead of exact-pinning 26.5.1.
- Rationale: #304 widens the range to `^26.5.1`; 26.6.2 is the latest release inside that range, so this is normal caret resolution, not drift. Exact-pinning would fight the Dependabot range and deviate from the repo's caret convention. Validation is therefore `>= 26.5.1`, not equality.

### DEC-002 — Flatpak integrity check re-implemented in Node

- Date: 2026-09-21
- Task: 1.5
- Decision: Replaced the plan's PowerShell `ConvertFrom-Json -AsHashtable` integrity one-liner with a small Node script (`%TEMP%\opencode\check-lock-integrity.cjs`), reading `package-lock.json` and counting `node_modules/*` entries that carry both `resolved` and `integrity`.
- Rationale: This host runs Windows PowerShell 5.1, which has no `-AsHashtable` parameter, and plain `ConvertFrom-Json` rejects `package-lock.json` with `the value of argument "name" is not valid` (case-insensitive duplicate-key limitation). The Node re-implementation checks the same property and reported 1128/1128 entries complete, so the Flatpak `npm ci --offline` requirement is satisfied.

### DEC-003 — `cargo update -p rhai` because the pinned spec was not yet indexed

- Date: 2026-09-21
- Task: 2.1
- Decision: Used the plan's documented fallback `cmd.exe /c "cargo update -p rhai"` after `cargo update -p rhai@1.26.1` failed with `package ID specification rhai@1.26.1 did not match any packages`.
- Rationale: The local crates.io index had not yet been refreshed, so the explicit-version spec could not match. The manifest spec is `rhai = { version = "1", features = ["serde"] }` at `crates/mini-diarium-core/Cargo.toml:46`, so letting cargo pick the latest compatible version is safe and correct. It resolved `rhai v1.26.0 -> v1.26.1` with checksum `0334639972c0ea5a3fd366aa36116754a11431b619fec3ed559b3f73bcbcebf5`, which is byte-identical to the checksum in PR #305.

### DEC-004 — actionlint scoped to the changed workflows; `cmd.exe` does not expand globs

- Date: 2026-09-21
- Task: 3.3
- Decision: Validated with `actionlint .github/workflows/release.yml .github/workflows/ci.yml` (exit 0) instead of the literal `cmd.exe /c actionlint .github/workflows/*.yml`, and recorded the pre-existing `indexnow.yml` failure as Task 3.4 instead of fixing it.
- Rationale: `cmd.exe` does not expand `*`, so the literal command failed with `could not read ".github/workflows/*.yml"`. Passing all nine workflow files exposed one unrelated, pre-existing error in the untouched `.github/workflows/indexnow.yml` (`invalid workflow_dispatch` description key). Fixing that workflow is unrelated to this dependency batch and would widen the change set, so it is tracked as Task 3.4 `BLOCKED` and surfaced to the user rather than silently ignored.

### DEC-005 — `prosemirror-dedup.test.ts` timeout was load-induced, not a regression

- Date: 2026-09-21
- Task: 4.2
- Decision: Treated the first full-suite failure (`src/test/prosemirror-dedup.test.ts` -> `Test timed out in 5000ms`) as a transient timeout and re-ran, instead of changing the test or the dependency set.
- Rationale: The test walks the whole `node_modules` tree; in isolation it passes in 786 ms, and the immediately following full `bun run test:run` passed 109/109 files and 1126/1126 tests (exit 0). The first run competed with the other gates I had just executed, so the 5 s cap was exceeded on I/O, not logic. No prosemirror-model dedup regression exists (the override in `package.json:62` is intact).

### DEC-006 — accidently popped a pre-existing user stash during Task 3.3, then fully reverted it

- Date: 2026-09-21
- Task: 3.3 (discovered at 5.1)
- Decision: When checking whether the `indexnow.yml` actionlint error was pre-existing, I ran `git stash push -- .github/workflows/indexnow.yml` (which saved nothing, because that file was unmodified) followed by `git stash pop`, which applied the top pre-existing stash instead of a new one. I reverted the partial application by unstaging the three affected paths, restoring `docs/wip/CREATE_JOURNAL_FAILURE_2026-07-30.md` from `HEAD`, and deleting the two stash-added untracked files `docs/archive/2026-08-07-v066-flatpak-journal-location-review.md` and `docs/archive/2026-08-08-v066-flatpak-journal-location-adversarial-review.md`.
- Rationale: The pop had left three unmerged paths (`UA`/`UU`) in the index, which would have contaminated the commit (Task 5.1's expected file set). `git stash pop` retains the stash on conflict, so `stash@{0}` ("WIP on fix/flatpak-journal-location") is intact and unmodified, as is `stash@{1}` ("WIP on master"); `git stash list` still shows both. The tree is back to exactly the seven intended files with no untracked leftovers. No user work was lost. Lesson: never use `git stash push -- <path>` as a "probe" — it can no-op and the matching `git stash pop` then applies an unrelated stash.

### DEC-007 — a second, different test timed out under load during final verification

- Date: 2026-09-21
- Task: 5.4
- Decision: Treated the `PreferencesOverlay.integration.test.tsx` -> `persists General and Writing changes before the overlay is closed` 5000 ms timeout as another load-induced flake and re-ran the full suite, which passed.
- Rationale: The named test passes in isolation in 712 ms (`bun run test:run src/components/overlays/preferences/PreferencesOverlay.integration.test.tsx`, exit 0), and the immediately following full `bun run test:run` passed 109/109 files and 1126/1126 tests (exit 0). This is the same class of failure as DEC-005 but a different file, which rules out a single test-specific regression. The machine reported very high cumulative transform times (700+ s) during the flaky runs. No source or test file is changed by this batch, so only the loader/timer margin under load is implicated.

## Final Verification

Task 5.4 runs the `## Pre-flight Checks` list in full. The end-to-end checks are: the five frontend
gates, the four backend gates, the `actionlint` pass, and a clean `git status --porcelain` showing
exactly `package.json`, `bun.lock`, `package-lock.json`, `Cargo.lock`,
`.github/workflows/release.yml`, `.github/workflows/ci.yml`, and `CHANGELOG.md`.

## Approval Gate

Approved by Francisco on 2026-09-21.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python "C:\Users\Francisco\.config\opencode\skills\manual-planning\scripts\check-plan.py" docs/plans/2026-09-21-apply-dependabot-dependency-prs-299-302-303-304-305-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-09-21

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deliberately deferred — never retrospectively.
- All project commands must be run via `cmd.exe /c ...` from the PowerShell shell; `cargo` also runs through `cmd.exe /c` here for consistency.
