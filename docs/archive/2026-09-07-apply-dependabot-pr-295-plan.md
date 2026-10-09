# Apply Dependabot PR 295

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master`, clean at `860c040` (`git status --short` empty, `git log --oneline -1` → `860c040 Dependency Update: bump toml to 4.3.0 in .opencode`). `master` is 0 ahead / 0 behind `origin/master`.
- Remote: `origin https://github.com/fjrevoredo/mini-diarium.git` (`git remote -v`).
- Shell: Windows PowerShell (win32). Project commands run via `cmd.exe /c ...` per root `AGENTS.md` (Execution Environment); `cargo` runs bare from repo root.
- Stack: SolidJS frontend (`package.json`, dual lockfiles `bun.lock` + `package-lock.json`); Rust/Tauri v2 Cargo workspace (unchanged by this plan).
- Open Dependabot PRs on `fjrevoredo/mini-diarium`: `#295` (root npm, `@tiptap/*` 3.30.5→3.30.6, 9 packages) and `#285` (`.opencode` toml 4.1.1→4.3.0). `#285` is **already applied**: commit `860c040` on `master` and pushed, so it needs no work here; Dependabot auto-closes it once its base-branch check sees the bump. `gh pr list --state open` output confirms both are still open as of today.

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Current `@tiptap/*` in `package.json` | `^3.30.5` for core/color/highlight/image/placeholder/text-align/pm/starter-kit, exact `3.30.5` for `extension-text-style` | `package.json:71-79` |
| PR #295 `package.json` target | `^3.30.6` for 8 packages, exact `3.30.6` for `extension-text-style` | `gh pr diff 295` (package.json hunk) |
| Latest `@tiptap/*` published | 3.31.3 (caret `^3.30.6` would re-resolve past the PR target) | `npm view @tiptap/core versions` |
| `bun.lock` currently resolves | `@tiptap/core@3.30.5` etc. (all `@tiptap/*` 3.30.5) | `Select-String -Path bun.lock -Pattern '@tiptap/core'` |
| `package-lock.json` root devDeps | `"vitest": "^4.1.8"` (stale vs `package.json` `^4.1.11`; resolved entry already `4.1.11`) | `Select-String -Path package-lock.json -Pattern '"vitest":'` |
| PR #295 lockfile side effects | corrects root `vitest` spec to `^4.1.11`; bumps `ws` 8.21.0→8.21.3; adds dev `peer: true` entries (`puppeteer`, `tailwindcss`, etc.) | `gh pr diff 295` (package-lock hunks) |
| `@tiptap/extension-text-style` pin style | exact (no caret) in both current and PR `package.json` | `package.json:77` + `gh pr diff 295` |
| `.opencode` `toml` (#285) | resolved `4.3.0`, committed at `860c040`, pushed | `Select-String .opencode/package-lock.json -Pattern 'toml'`; `git log` |
| Prior plan precedent | caret `^3.30.x` resolved to 3.31.3 during lockfile regeneration; fixed by temp exact-pin to the PR target then revert | `docs/plans/2026-09-07-apply-dependabot-dependency-prs-plan.md` DEC-001/DEC-003 |

### Hard constraints

1. Never hand-edit `bun.lock` or `package-lock.json` — regenerate with the documented commands; a hand-patch breaks the Flatpak/Nix pipelines and is unreviewable (`procedures/npm.md` Phase 3 step 5).
2. All `@tiptap/*` packages must resolve to one identical version (monorepo type-sharing; a mismatch causes `TS2322` duplicate types) — `procedures/npm.md` gotcha. Since the PR target 3.30.6 is below the published latest 3.31.3, lockfile generation must use temporary exact pins to 3.30.6, then revert `package.json` to the PR's caret form (same trick as the prior plan's DEC-001/DEC-003).
3. Run project commands through `cmd.exe /c ...`; bare `bun`/`npm` from this shell is unreliable.
4. Do not touch `nix/package.nix` from Windows — the `npmDepsHash` refresh is Linux+Nix only; note the omission in the commit message (CI auto-patches on push, `procedures/npm.md` Phase 5).
5. Commit only the intentionally changed files with the user's real git identity; do not push.

## Goal

Apply the pending npm Dependabot PR `#295` (all nine direct `@tiptap/*` packages 3.30.5→3.30.6) into `master` as one scoped commit with both lockfiles regenerated and aligned at 3.30.6, leaving the frontend gates green.

## Scope

- `package.json` bump for the nine `@tiptap/*` entries (`package.json:71-79`) to the PR's exact target form (`^3.30.6`, and exact `3.30.6` for `extension-text-style`).
- Regeneration of `bun.lock` and `package-lock.json`, including the stale root `"vitest": "^4.1.8"` spec correction to `^4.1.11`.
- A `CHANGELOG.md` `### Internal` entry under `## [0.7.3] - Unreleased` (`CHANGELOG.md:37`), matching the dependency-bump convention at `CHANGELOG.md:57-59`.
- One commit: `Dependency Update: bump @tiptap/* to 3.30.6`, authored with the user's git identity, no push.

## Non-Goals

- PR `#285` (`.opencode` toml) — already applied and pushed at `860c040`; Dependabot auto-closes it. Not re-applied, not manually closed.
- E2E tests — out of scope for dependency bumps (`procedures/npm.md` Scope Boundaries); the bump is patch-level within the `@tiptap` editor, not a Tauri API/plugin IPC change.
- `nix/package.nix` `npmDepsHash` — requires Linux+Nix, unavailable on Windows; omitted and noted in the commit message (CI auto-patches on push).
- Cargo/Actions ecosystems — no pending cargo or actions PRs exist.

## Assumptions

- The 3.30.5→3.30.6 patch bump is non-breaking; validated by the type-check/lint/test gates (failing gates turn the task `BLOCKED`).
- The `@tiptap` monorepo must stay at 3.30.6 (the PR's intended version), not drift to the published latest 3.31.3, per hard constraint 2 and the prior plan's precedent.
- `npm install --package-lock-only --legacy-peer-deps` produces complete `resolved`/`integrity` entries; if it does not, fall back to a full `npm install --legacy-peer-deps` after deleting `node_modules/` (Flatpak gotcha, `procedures/npm.md`).

## Open Questions

- None. No conflicting version bumps (single PR for these packages), no major-version bump, no `Cargo.toml` change.

## Milestones

### Milestone 1: Apply PR #295 `@tiptap/*` 3.30.6 bump

- Status: TO BE DONE
- Purpose: Apply the `package.json` bump and regenerate both lockfiles at 3.30.6, proving the frontend still passes its gates.
- Exit Criteria: Both `bun.lock` and `package-lock.json` resolve every `@tiptap/*` entry to 3.30.6 with the `package.json` in the PR's caret form; `type-check`, `lint`, and `test:run` all exit 0; Flatpak integrity check finds no missing `resolved`/`integrity` entries.

#### Task 1.1: Temporarily exact-pin `@tiptap/*` to 3.30.6 in `package.json`

- Status: COMPLETED
- Depends On: none
- Objective: All nine `@tiptap/*` version strings set to exact `3.30.6` so lockfile generation cannot drift to the published latest 3.31.3.
- Steps:
  1. In `dependencies` (`package.json:71-79`), set each of `@tiptap/core|extension-color|extension-highlight|extension-image|extension-placeholder|extension-text-align|pm|starter-kit` from `^3.30.5` to `3.30.6` (drop the caret), and `@tiptap/extension-text-style` from `3.30.5` to `3.30.6`.
  2. Preserve ordering and formatting; change only the version strings (`procedures/npm.md` Phase 3 step 1).
- Validation: `git diff package.json` shows exactly nine `@tiptap` version-string edits, all to exact `"3.30.6"`, and no other lines.
- Notes: These exact pins are temporary; Task 1.4 reverts `package.json` to the PR's caret form once both lockfiles pin 3.30.6.

#### Task 1.2: Regenerate `bun.lock`

- Status: COMPLETED
- Depends On: 1.1
- Objective: `bun.lock` resolves every `@tiptap/*` entry to 3.30.6.
- Steps:
  1. Run `cmd.exe /c bun install`.
- Validation: `Select-String -Path bun.lock -Pattern '"@tiptap/core@3.30.6"'` matches, and no `@tiptap/*` resolves to 3.31.x.
- Notes: Dependabot PRs never touch `bun.lock`; it is regenerated locally (`procedures/npm.md` gotcha).

#### Task 1.3: Regenerate `package-lock.json`

- Status: COMPLETED
- Depends On: 1.2
- Objective: `package-lock.json` resolves every `@tiptap/*` entry to 3.30.6 and corrects the stale root `"vitest": "^4.1.8"` spec to `^4.1.11`.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"` (canonical command; `--legacy-peer-deps` mandatory for the eslint-plugin-solid peer on eslint@^9).
- Validation: `Select-String -Path package-lock.json -Pattern '"version": "3.30.6"'` appears under `node_modules/@tiptap/core`, and the root block `"vitest"` spec reads `"^4.1.11"`.
- Notes: `--package-lock-only` leaves `node_modules/` untouched. If Task 1.5 finds missing `resolved`/`integrity`, fall back to a full `npm install --legacy-peer-deps` after deleting `node_modules/`.

#### Task 1.4: Revert `package.json` to the PR's caret form

- Status: COMPLETED
- Depends On: 1.3
- Objective: `package.json` matches PR #295's `package.json` diff exactly: `^3.30.6` for the 8 caret packages, exact `3.30.6` for `@tiptap/extension-text-style`.
- Steps:
  1. Set `@tiptap/core|extension-color|extension-highlight|extension-image|extension-placeholder|extension-text-align|pm|starter-kit` back to `^3.30.6`, and leave `@tiptap/extension-text-style` at exact `3.30.6`.
  2. Compare against the PR's package.json hunk.
- Validation: `gh pr diff 295 --repo fjrevoredo/mini-diarium` package.json hunks match local `git diff package.json` (same before/after lines).
- Notes: The lockfiles remain the resolution source of truth; the latent caret-drift hazard on a future re-resolution is inherited from the PR's design (prior plan DEC-003).

#### Task 1.5: Verify lockfile versions and Flatpak integrity

- Status: COMPLETED
- Depends On: 1.4
- Objective: Both lockfiles carry 3.30.6 for every `@tiptap/*` entry and every `node_modules/*` entry has `resolved` + `integrity`.
- Steps:
  1. Grep both lockfiles for each `@tiptap/*` entry and confirm version `3.30.6`.
  2. Run the integrity count: `$pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages; ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count` and compare against the total `node_modules/*` key count.
- Validation: Every `@tiptap/*` entry resolves to 3.30.6 in both lockfiles; the `resolved`+`integrity` count equals the total entry count (no missing fields).
- Notes: Missing fields break the Flatpak `npm ci --offline` build; if found, regenerate with a full `npm install --legacy-peer-deps` first (Task 1.3 note).

#### Task 1.6: Type-check

- Status: COMPLETED
- Depends On: 1.5
- Objective: TypeScript is clean under the new dependency set.
- Steps:
  1. Run `cmd.exe /c bun run type-check`.
- Validation: Exit code 0.
- Notes: Catches `@tiptap` monorepo type mismatches (TS2322) if any.

#### Task 1.7: Lint

- Status: COMPLETED
- Depends On: 1.5
- Objective: ESLint passes.
- Steps:
  1. Run `cmd.exe /c bun run lint`.
- Validation: Exit code 0.
- Notes: None.

#### Task 1.8: Frontend tests

- Status: COMPLETED
- Depends On: 1.5
- Objective: Vitest suite passes.
- Steps:
  1. Run `cmd.exe /c bun run test:run`.
- Validation: Exit code 0.
- Notes: None.

### Milestone 2: Finalize, commit, clean

- Status: TO BE DONE
- Purpose: Record the change in the changelog, commit with the user's identity, clean up, and close out.
- Exit Criteria: `git status --porcelain` shows only intended files; the commit exists; pre-flight checks pass; plan COMPLETED.

#### Task 2.1: Add the CHANGELOG entry

- Status: COMPLETED
- Depends On: 1.8
- Objective: Dependency update recorded under `## [0.7.3] - Unreleased` → `### Internal`.
- Steps:
  1. Add one bullet under `### Internal` of `## [0.7.3] - Unreleased` (`CHANGELOG.md:37`) summarizing PR #295 (`@tiptap/*` 3.30.5→3.30.6) and naming the `npmDepsHash` omission.
- Validation: `git diff CHANGELOG.md` shows a single added bullet in the `0.7.3` Internal section.
- Notes: Matches the existing dependency-bump entry style at `CHANGELOG.md:57-59`.

#### Task 2.2: Review the change set and commit

- Status: COMPLETED
- Depends On: 2.1
- Objective: The intended file set is the only thing changed, committed with the user's identity, no push.
- Steps:
  1. Run `git status --short` and `git diff --stat`; confirm the set is exactly `package.json`, `bun.lock`, `package-lock.json`, `CHANGELOG.md`.
  2. Stage those four files and commit with the runbook message format `Dependency Update: bump @tiptap/* to 3.30.6`, authoring with `git config user.name`/`user.email` via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` if needed.
  3. Note the `npmDepsHash` refresh omission in the commit body (`procedures/npm.md` Phase 3 step 4).
- Validation: `git log --oneline -3` shows the new commit; `git status --porcelain` clean except the untracked (excluded) plan.
- Notes: No push per procedure.

#### Task 2.3: Clean up intermediate artifacts

- Status: COMPLETED
- Depends On: 2.2
- Objective: No implementation-only artifacts remain.
- Steps:
  1. Inspect the worktree for scratch files, temp docs, or logs created during this task.
  2. Remove any found; keep the plan file (untracked and locally excluded) as the session's ledger.
- Validation: `git status --porcelain` shows no stray files.
- Notes: None.

#### Task 2.4: Final verification

- Status: COMPLETED
- Depends On: 2.3
- Objective: Repository is green after all changes.
- Steps:
  1. Run every `## Pre-flight Checks` item.
- Validation: All pre-flight commands exit 0; `git status --porcelain` shows only the intended final state.
- Notes: None.

## Project Gates

- Frontend gates: `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run test:run` — all must exit 0.
- Backend gate: `cargo test --workspace` — not affected by this npm-only change; skipped unless a gate failure suggests it (run bare from repo root).
- Bookkeeping: a `CHANGELOG.md` entry is required (repo has `CHANGELOG.md`; convention at `CHANGELOG.md:57`).
- No push; commit only. `nix/package.nix` hash handled by CI on push (Non-Goals).

## Pre-flight Checks

Run before the plan may reach `COMPLETED`. This is a named checklist of this project's actual
commands, distinct from per-task validation: per-task validation proves one task worked, these
prove the repository as a whole is in a shippable state.

- [ ] [`cmd.exe /c bun run type-check`]
- [ ] [`cmd.exe /c bun run lint`]
- [ ] [`cmd.exe /c bun run test:run`]
- [ ] [`git status --porcelain` shows only intended final changes]

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what this plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

No entries yet.

### DEC-001 — flaky 5s timeout in PreferencesOverlay integration test

- Date: 2026-09-07
- Task: 2.4
- Decision: One full `test:run` pass timed out `PreferencesOverlay.integration.test.tsx > persists General and Writing changes before the overlay is closed` (5000ms limit) while the immediate pre-commit run and all other gates were green. Re-running the file in isolation (2/2 passed) and then the full suite again (1126/1126 passed) both succeeded; no code or dependency changed between runs.
- Rationale: This is a load-dependent flake (full-suite transform/import time ~370s/~710s pushes the 5s test budget), not a regression from the `@tiptap` 3.30.6 bump — the same test passed in the same suite state both before and after. Recorded so it is not misread as a dependency-caused failure.

## Final Verification

Task 2.4 runs the `## Pre-flight Checks` list in full. The end-to-end checks are: all three
frontend gates, and a clean `git status` showing exactly the intended file set
(`package.json`, `bun.lock`, `package-lock.json`, `CHANGELOG.md`).

## Approval Gate

Approved by Francisco on 2026-09-07.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python scripts/check-plan.py docs/plans/2026-09-07-apply-dependabot-pr-295-plan.md
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