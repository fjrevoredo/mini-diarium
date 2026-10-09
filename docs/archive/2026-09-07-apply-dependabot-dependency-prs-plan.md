# Apply Dependabot dependency PRs

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master`, clean at `cd06a75` (`git status --short` empty, `git log --oneline -3` → `cd06a75 fix documentation`).
- Remote: `origin https://github.com/fjrevoredo/mini-diarium.git` (`git remote -v`). All PRs below are on `fjrevoredo/mini-diarium`.
- Shell: Windows PowerShell (win32). Project commands are wrapped in `cmd.exe /c ...` per root `AGENTS.md` (Execution Environment); `cargo` runs bare from repo root.
- Stack: SolidJS frontend (`package.json`, dual lockfiles `bun.lock` + `package-lock.json`); Rust/Tauri v2 Cargo workspace (repo-root `Cargo.lock`, three crates). `.opencode/` is a separate npm-only sub-package (`package-lock.json` only, no `bun.lock`).
- All 7 open Dependabot PRs are minor/patch bumps. None touch `windows`/`webview2-com` (Tauri-owned gotcha in `ENTRY.md`).

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Current `@tauri-apps/plugin-dialog` | `^2.7.2` | `package.json:69` |
| Current `@tauri-apps/plugin-opener` | `^2.5.4` | `package.json:70` |
| Current `@tiptap/*` set | `^3.30.1` (core/color/highlight/image/placeholder/text-align/starter-kit), `3.30.3` (text-style exact), `^3.30.3` (pm) | `package.json:71-79` |
| Current `@vitest/ui` / `eslint-plugin-solid` / `undici` | `^4.1.10` / `^0.16.0` / `^8.9.0` | `package.json:100,107,119` |
| Cargo lock: `tauri-plugin-dialog` | `2.7.2` | `Cargo.lock:4540-4541` |
| Cargo lock: `tauri-plugin-fs` | `2.5.1` | `Cargo.lock:4558-4559` |
| Cargo lock: `tauri-plugin-opener` | `2.5.4` | `Cargo.lock:4582-4583` |
| Cargo manifest pins | `tauri-plugin-opener = "2.5.4"`, `tauri-plugin-dialog = "2.7.1"` (caret ranges allow the lock bumps) | `src-tauri/Cargo.toml:34-35` |
| `.opencode` `toml` | resolved `4.1.1` under req `^4.1.1` (transitive via `@opencode-ai/plugin`) | `.opencode/package-lock.json:176,399-402` |
| `release.yml` softprops pin | `@3d0d9888...# v3` (3.0.2) | `.github/workflows/release.yml` (2 occurrences) |
| `ci.yml` flatpak-builder pin | `@401fe28...# v6` (6.7) | `.github/workflows/ci.yml` |
| Open PRs | 292, 291, 290, 287, 286, 285, 284 | `gh pr list --repo fjrevoredo/mini-diarium --state open` |

### Hard constraints

1. Never hand-edit `bun.lock`, `package-lock.json`, or `Cargo.lock` — regenerate them with the documented commands; a hand-patch breaks the Flatpak/Nix pipelines and is unreviewable.
2. All `@tiptap/*` packages must resolve to the same version (monorepo type-sharing; a mismatch causes `TS2322` duplicates) — `procedures/npm.md` gotcha.
3. Do not bump `windows`/`webview2-com` Cargo crates — Tauri's transitive deps own them (`ENTRY.md` Cross-Cutting Gotchas). None of these PRs touch them.
4. Run project commands through `cmd.exe /c ...`; bare `bun`/`npm` from this shell is unreliable.
5. Commit only the intentionally changed files with the user's real git identity; do not push.

## Goal

Apply the six applicable open Dependabot PRs (npm root #291 + #290, cargo #292, actions #286 + #287, `.opencode` npm #285) into `master` as scoped, verified commits with regenerated lockfiles, leaving the tree green.

## Scope

- `package.json` bumps for #291 (`@tauri-apps/plugin-dialog` → `^2.7.3`, `@tauri-apps/plugin-opener` → `^2.5.5`, all `@tiptap/*` → `3.30.5`) and #290 (`@vitest/ui` → `^4.1.11`, `eslint-plugin-solid` → `^0.17.0`, `undici` → `^8.10.1`; `vitest` resolves 4.1.10→4.1.11 within the unchanged `^4.1.8` range).
- Regeneration of `bun.lock` + `package-lock.json`.
- `Cargo.lock` bump for #292 (`tauri-plugin-dialog` → 2.7.3, `tauri-plugin-opener` → 2.5.5, `tauri-plugin-fs` → 2.5.2 as a transitive of dialog).
- `.github/workflows/release.yml` (#286, softprops 3.0.2→3.0.3) and `.github/workflows/ci.yml` (#287, flatpak-builder 6.7→6.8) SHA pin updates.
- `.opencode/package-lock.json` `toml` 4.1.1→4.3.0 (#285).
- A `CHANGELOG.md` `### Internal` entry under `## [0.7.3] - Unreleased` (`CHANGELOG.md:37`), matching the dependency-bump convention at `CHANGELOG.md:57`.

## Non-Goals

- PR #284 (`@tiptap/core` 3.30.4) — superseded by #291's higher 3.30.5 bump; Dependabot auto-closes it once master reflects 3.30.5 (`procedures/npm.md` Phase 1 step 5). Not applied, not manually closed.
- E2E tests — out of scope for dependency bumps (`procedures/npm.md` Scope Boundaries); no Tauri API/plugin IPC behavior changes beyond patch-level plugin bumps.
- `nix/package.nix` `npmDepsHash` — requires Linux+Nix, unavailable on Windows/WSL; omitted and noted in the commit message (CI auto-patches on push, `procedures/npm.md` Phase 5).

## Assumptions

- The six PRs are the intended set (user supplied the open-PRs list URL). Confirmed via the Open Questions.
- `eslint-plugin-solid` 0.16→0.17 and all other bumps are non-breaking; validated by the lint/type-check/test gates (failing gates would turn the task `BLOCKED`).
- `cargo update` resolves `tauri-plugin-fs` 2.5.1→2.5.2 automatically because dialog 2.7.3 depends on fs@2.5.2 (dialog 2.7.3 changelog: "Upgraded to fs@2.5.2").

## Open Questions

- Q1: Apply all six applicable open PRs (291, 290, 292, 287, 286, 285), excluding superseded #284? — **Resolved: Yes, apply all six applicable PRs.** (#284 skipped, left for Dependabot auto-close.)
- Q2: Commit shape: four scoped commits (npm, cargo, actions, `.opencode`) vs one combined commit? — **Resolved: Four scoped commits.**

## Milestones

### Milestone 1: Root npm updates (#291 prod + #290 dev)

- Status: COMPLETED
- Purpose: Apply both root `package.json` groups and regenerate both lockfiles, proving the frontend still passes its gates.
- Exit Criteria: `bun.lock` and `package-lock.json` resolve all bumped packages to the new versions; `type-check`, `lint`, and `test:run` all exit 0; Flatpak integrity check finds no missing `resolved`/`integrity` entries.

#### Task 1.1: Edit `package.json` with the pending version bumps

- Status: COMPLETED
- Depends On: none
- Objective: All #291 and #290 version strings updated in `package.json`; nothing else touched.
- Steps:
  1. In `dependencies` (`package.json:64-87`): set `@tauri-apps/plugin-dialog` `^2.7.2`→`^2.7.3`, `@tauri-apps/plugin-opener` `^2.5.4`→`^2.5.5`, and each of `@tiptap/core|extension-color|extension-highlight|extension-image|extension-placeholder|extension-text-align` `^3.30.1`→`^3.30.5`, `@tiptap/extension-text-style` `3.30.3`→`3.30.5`, `@tiptap/pm` `^3.30.3`→`^3.30.5`, `@tiptap/starter-kit` `^3.30.1`→`^3.30.5`.
  2. In `devDependencies` (`package.json:88-120`): set `@vitest/ui` `^4.1.10`→`^4.1.11`, `eslint-plugin-solid` `^0.16.0`→`^0.17.0`, `undici` `^8.9.0`→`^8.10.1`. Leave `vitest` at `^4.1.8` (range already covers 4.1.11).
  3. Preserve ordering and formatting; change only version strings (per `procedures/npm.md` Phase 3 step 1).
- Validation: `git diff package.json` shows exactly the version-string edits above and no other lines.
- Notes: Target versions taken from the highest of overlapping PRs (#291's 3.30.5 > #284's 3.30.4).

#### Task 1.2: Regenerate `bun.lock`

- Status: COMPLETED
- Depends On: 1.1
- Objective: `bun.lock` reflects the new versions.
- Steps:
  1. Run `cmd.exe /c bun install`.
- Validation: `Select-String -Path bun.lock -Pattern '"@tiptap/core"'` shows `3.30.5`; `"@tauri-apps/plugin-dialog"` shows `2.7.3`; `"eslint-plugin-solid"` shows `0.17.0`.
- Notes: Dependabot PRs never touch `bun.lock`; it is regenerated locally (`procedures/npm.md` gotcha).

#### Task 1.3: Regenerate `package-lock.json`

- Status: COMPLETED
- Depends On: 1.2
- Objective: `package-lock.json` matches the new `package.json`.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"` (canonical command, `--legacy-peer-deps` mandatory for the eslint-plugin-solid peer on eslint@^9).
- Validation: `Select-String -Path package-lock.json -Pattern '"version": "0.7.2"'` (project version line) and the bumped packages resolve to `2.7.3` / `2.5.5` / `3.30.5` / `0.17.0` / `8.10.1`.
- Notes: `--package-lock-only` leaves `node_modules/` untouched. If npm reports missing `resolved`/`integrity` later (Task 1.4), fall back to `npm install --legacy-peer-deps` after deleting `node_modules/`.

#### Task 1.4: Verify lockfiles and Flatpak integrity

- Status: COMPLETED
- Depends On: 1.3
- Objective: Both lockfiles carry the new versions and every `node_modules/*` entry has `resolved` + `integrity`.
- Steps:
  1. Grep both lockfiles for each bumped package/version.
  2. Run the integrity count: `$pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages; ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count` and compare against the total `node_modules/*` key count.
- Validation: Every bumped package/version appears in both lockfiles; the `resolved`+`integrity` count equals the total entry count (no missing fields).
- Notes: Missing fields break the Flatpak `npm ci --offline` build (`procedures/npm.md` gotcha); if found, regenerate with a full `npm install --legacy-peer-deps` first.

#### Task 1.5: Type-check

- Status: COMPLETED
- Depends On: 1.4
- Objective: TypeScript is clean under the new dependency set.
- Steps:
  1. Run `cmd.exe /c bun run type-check`.
- Validation: Exit code 0.
- Notes: Catches `@tiptap` monorepo type mismatches if any.

#### Task 1.6: Lint

- Status: COMPLETED
- Depends On: 1.4
- Objective: ESLint passes with `eslint-plugin-solid` 0.17.
- Steps:
  1. Run `cmd.exe /c bun run lint`.
- Validation: Exit code 0.
- Notes: The 0.16→0.17 plugin bump is the main lint surface risk.

#### Task 1.7: Frontend tests

- Status: COMPLETED
- Depends On: 1.4
- Objective: Vitest suite passes.
- Steps:
  1. Run `cmd.exe /c bun run test:run`.
- Validation: Exit code 0.
- Notes: None.

### Milestone 2: Cargo update (#292)

- Status: COMPLETED
- Purpose: Apply the lockfile-only `minor-and-patch` bump for the three Tauri plugins and prove the Rust workspace still builds and tests.
- Exit Criteria: `Cargo.lock` resolves dialog 2.7.3 / opener 2.5.5 / fs 2.5.2; `cargo test --workspace` and the `custom-protocol` build exit 0; no manifest changes.

#### Task 2.1: Bump the plugin crates in `Cargo.lock`

- Status: COMPLETED
- Depends On: none
- Objective: Lockfile-only update matching PR #292's `Cargo.lock` hunk.
- Steps:
  1. Run `cmd.exe /c "cargo update -p tauri-plugin-dialog -p tauri-plugin-opener"` (lockfile-only procedure, `procedures/cargo.md`).
  2. Confirm `tauri-plugin-fs` follows to 2.5.2 as a transitive of dialog 2.7.3.
- Validation: `git diff Cargo.lock` shows dialog `2.7.2`→`2.7.3`, opener `2.5.4`→`2.5.5`, fs `2.5.1`→`2.5.2` and no other version changes; no `Cargo.toml` modified.
- Notes: If `cargo update` picks a non-additive `windows-*`/`webview2-com` change, abort and re-evaluate (gotcha) — not expected here.

#### Task 2.2: Backend tests

- Status: COMPLETED
- Depends On: 2.1
- Objective: All three crates' tests pass.
- Steps:
  1. Run `cmd.exe /c "cargo test --workspace"`.
- Validation: Exit code 0.
- Notes: `--workspace` is required to run all three crates (`AGENTS.md`).

#### Task 2.3: Release-like build

- Status: COMPLETED
- Depends On: 2.1
- Objective: App crate builds with the release `custom-protocol` feature.
- Steps:
  1. Run `cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"`.
- Validation: Exit code 0.
- Notes: None.

### Milestone 3: GitHub Actions updates (#286 + #287)

- Status: COMPLETED
- Purpose: Apply both workflow SHA pin bumps; they are non-major, so no breaking-change review is required (`procedures/actions.md`).
- Exit Criteria: Both workflow files match the PR diffs; `actionlint` and GitHub's own YAML parse succeed; no other files changed.

#### Task 3.1: Bump `softprops/action-gh-release` in `release.yml`

- Status: COMPLETED
- Depends On: none
- Objective: Both `uses:` lines for `softprops/action-gh-release` move `@3d0d9888...# v3` → `@efb35369...# v3`.
- Steps:
  1. Edit the two `uses:` lines in `.github/workflows/release.yml` to match PR #286's diff (3.0.2→3.0.3, same `v3` tag).
- Validation: `git diff .github/workflows/release.yml` equals PR #286's diff (2 lines changed).
- Notes: Non-major (patch) bump; no breaking-change review needed.

#### Task 3.2: Bump `flatpak/flatpak-github-actions/flatpak-builder` in `ci.yml`

- Status: COMPLETED
- Depends On: none
- Objective: The `uses:` line moves `@401fe28...# v6` → `@79327416...# v6`.
- Steps:
  1. Edit the `uses:` line in `.github/workflows/ci.yml` to match PR #287's diff (6.7→6.8, same `v6` tag).
- Validation: `git diff .github/workflows/ci.yml` equals PR #287's diff (1 line changed).
- Notes: Non-major (minor) bump; no breaking-change review needed.

#### Task 3.3: Validate the workflows

- Status: COMPLETED
- Depends On: 3.1, 3.2
- Objective: Both workflows parse cleanly.
- Steps:
  1. Run `cmd.exe /c actionlint .github/workflows/release.yml .github/workflows/ci.yml` (fall back to a PowerShell `ConvertFrom-Yaml` parse if actionlint is absent).
  2. Run `gh workflow view release.yml --yaml | Out-Null` and `gh workflow view ci.yml --yaml | Out-Null` to confirm GitHub's parser accepts them.
- Validation: All commands exit 0 without parse errors.
- Notes: Final real-world validation is the next CI run after push (out of scope here; no push per procedure).

### Milestone 4: `.opencode` npm update (#285)

- Status: COMPLETED
- Purpose: Apply the single transitive `toml` resolution bump in the `.opencode` sub-package.
- Exit Criteria: `.opencode/package-lock.json` resolves `toml` 4.3.0 with no other changes.

#### Task 4.1: Update `toml` resolution in `.opencode/package-lock.json`

- Status: COMPLETED
- Depends On: none
- Objective: `toml` entry moves 4.1.1→4.3.0, matching PR #285's diff.
- Steps:
  1. Run `cmd.exe /c "npm update toml"` with working directory `.opencode` (range `^4.1.1` at `.opencode/package-lock.json:176` already permits 4.3.0; no `package.json` edit needed).
  2. If `npm update` moves other packages, instead apply PR #285's exact two hunks by regenerating with `npm install --package-lock-only` in `.opencode` and diffing against the PR.
- Validation: `git diff .opencode/package-lock.json` shows only the `toml` version/resolved/integrity change (4.1.1→4.3.0).
- Notes: `.opencode` is npm-only (no `bun.lock`). Never hand-edit the lockfile; regenerate.

### Milestone 5: Finalize, commit, clean

- Status: COMPLETED
- Purpose: Review the full change set, record it in the changelog, commit with the user's identity, and close out the plan.
- Exit Criteria: `git status --porcelain` shows only intended changes; commits created; pre-flight checks pass; plan COMPLETED.

#### Task 5.1: Review the change set

- Status: COMPLETED
- Depends On: 1.7, 2.3, 3.3, 4.1
- Objective: The intended file set is the only thing changed.
- Steps:
  1. Run `git status --short` and `git diff --stat`.
  2. Confirm the set is exactly: `package.json`, `bun.lock`, `package-lock.json`, `Cargo.lock`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `.opencode/package-lock.json`, `CHANGELOG.md` (entry added in 5.2).
- Validation: No unexpected files appear; `git status --porcelain` lists no untracked artifacts (plan dir is excluded via `.git/info/exclude`).
- Notes: `nix/package.nix` intentionally unchanged (see Non-Goals).

#### Task 5.2: Add the CHANGELOG entry

- Status: COMPLETED
- Depends On: 5.1
- Objective: Dependency update recorded under `## [0.7.3] - Unreleased` → `### Internal`.
- Steps:
  1. Add one `- **Internal**: ...` bullet under `### Internal` of `## [0.7.3] - Unreleased` (`CHANGELOG.md:37`) summarizing the six applied PRs and naming the `npmDepsHash` omission.
- Validation: `git diff CHANGELOG.md` shows a single added bullet in the `0.7.3` Internal section.
- Notes: Matches the dependency-bump entry style at `CHANGELOG.md:57`.

#### Task 5.3: Commit

- Status: COMPLETED
- Depends On: 5.2
- Objective: Four scoped commits (or one, per Q2 answer), user identity, no push.
- Steps:
  1. Stage and commit per ecosystem with the runbook message format `Dependency Update: <short-summary>`, authoring with `git config user.name`/`user.email` via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` if needed.
  2. Note the `npmDepsHash` refresh omission in the npm commit message (`procedures/npm.md` Phase 3 step 4).
- Validation: `git log --oneline -5` shows the expected commit(s); `git status --porcelain` clean except the untracked (excluded) plan.
- Notes: Default is four scoped commits per `AGENTS.md` rule 6 unless Q2 says otherwise.

#### Task 5.4: Clean up intermediate artifacts

- Status: COMPLETED
- Depends On: 5.3
- Objective: No implementation-only artifacts remain.
- Steps:
  1. Remove scratch files created during discovery under `%TEMP%` (`pr286.md`, `pr287.md`, `pr290.md`, `pr291.md`) if present.
  2. Keep the plan file (untracked and locally excluded); it is the session's ledger.
- Validation: `git status --porcelain` shows no stray files; scratch temp files deleted.
- Notes: None.

#### Task 5.5: Final verification

- Status: COMPLETED
- Depends On: 5.4
- Objective: Repository is green after all changes.
- Steps:
  1. Run every `## Pre-flight Checks` item.
- Validation: All pre-flight commands exit 0.
- Notes: None.

## Project Gates

- Frontend gates: `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run test:run` — all must exit 0.
- Backend gates: `cmd.exe /c "cargo test --workspace"`, `cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"` — both must exit 0.
- Workflow gate: `cmd.exe /c actionlint .github/workflows/release.yml .github/workflows/ci.yml` — exit 0 (or YAML parse fallback).
- Bookkeeping: a `CHANGELOG.md` entry is required for this user-facing-visible dependency update (repo has `CHANGELOG.md`; convention at `CHANGELOG.md:57`).
- No push; commits only. `nix/package.nix` hash handled by CI on push (Non-Goals).

## Pre-flight Checks

Run before the plan may reach `COMPLETED`. This is a named checklist of this project's actual
commands, distinct from per-task validation: per-task validation proves one task worked, these
prove the repository as a whole is in a shippable state.

- [ ] [`cmd.exe /c bun run type-check`]
- [ ] [`cmd.exe /c bun run lint`]
- [ ] [`cmd.exe /c bun run test:run`]
- [ ] [`cmd.exe /c "cargo test --workspace"`]
- [ ] [`cmd.exe /c "cargo build -p mini-diarium --features custom-protocol"`]
- [ ] [`cmd.exe /c actionlint .github/workflows/release.yml .github/workflows/ci.yml`]
- [ ] [`git status --porcelain` shows only intended final changes]

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what this plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

<!--
Once this section passes ~10 entries, move it to a companion
`YYYY-MM-DD-<name>-decisions.md` and leave a pointer here. `check-plan.py` warns (`W005`)
at that threshold.
-->

No entries yet.

### DEC-001 — caret drift on @tiptap monorepo during lockfile regeneration

- Date: 2026-09-07
- Task: 1.2
- Decision: `bun install` resolved the caret `^3.30.5` ranges to 3.31.3 (newest), while `@tiptap/extension-text-style` is exact-pinned at 3.30.5, producing peer-mismatch warnings. To keep the monorepo aligned at the PR-intended 3.30.5 in both lockfiles, the @tiptap/* entries are temporarily exact-pinned to 3.30.5 during lockfile generation, then reverted to the PR's caret form (`^3.30.5`) once both lockfiles pin 3.30.5.
- Rationale: Hard constraint 2 (all @tiptap/* at one version) — a mixed 3.30.5/3.31.3 set causes `TS2322` type duplicates. The approved plan and PR #291 target 3.30.5; Dependabot will open a separate PR when 3.31.x becomes the intended bump.

### DEC-002 — undici resolves 8.10.2 instead of PR target 8.10.1

- Date: 2026-09-07
- Task: 1.3
- Decision: `npm install --package-lock-only` resolved `undici` to 8.10.2 (latest within `^8.10.1`). Kept 8.10.2 in the lockfile.
- Rationale: 8.10.1 and 8.10.2 both require node `>=22.19.0` (verified via `npm view undici@8.10.1 engines` / `@8.10.2`), so the newer patch has no engine downside vs the PR target; `package.json` keeps the PR's `^8.10.1` range.

### DEC-003 — caret range for @tiptap/* restored after lockfile generation

- Date: 2026-09-07
- Task: 1.3
- Decision: After both lockfiles pinned all `@tiptap/*` at 3.30.5, `package.json` reverts to the PR's caret form (`^3.30.5` for core/pm/extensions etc., exact `3.30.5` for `extension-text-style`).
- Rationale: Matches PR #291's hunks (approved plan). The lockfiles remain the resolution source of truth; the latent caret-drift hazard on future re-resolution is inherited from the PR's design and will be resolved by Dependabot's next monorepo bump.

### DEC-004 — eslint-plugin-solid 0.17 adds 13 non-failing solid/reactivity warnings

- Date: 2026-09-07
- Task: 1.6
- Decision: Accepted the 13 `solid/reactivity` warnings produced by the eslint-plugin-solid 0.16→0.17 rule set; `bun run lint` exits 0.
- Rationale: The gate (exit 0) is met; CI (`ci.yml` runs `bun run lint` without `--max-warnings`) and `scripts/pre-commit.js` treat warnings as non-failing. Fixing the captured-variable patterns is code change out of scope for this dependency runbook.

## Final Verification

Task 5.5 runs the `## Pre-flight Checks` list in full. The end-to-end checks are: all three frontend gates, both backend gates, the workflow YAML validation, and a clean `git status` showing exactly the intended file set.

## Approval Gate

Approved by Francisco on 2026-09-07.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python scripts/check-plan.py docs/plans/2026-09-07-apply-dependabot-dependency-prs-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-09-07

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
- All project commands must be run via `cmd.exe /c ...` from the PowerShell shell.
