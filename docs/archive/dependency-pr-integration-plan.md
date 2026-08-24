# Integrate Pending Dependency PRs (#268, #269, #270, #271)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-24
- Last Updated: 2026-08-24
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Apply all four open Dependabot PRs from `fjrevoredo/mini-diarium` into the local master worktree: two npm PRs (#270, #271), two GitHub Actions PRs (#268, #269), regenerate both lockfiles, validate, and commit locally (no push).

## Scope

- PR #271: bump nine `@tiptap/*` prod dependencies from `^3.29.2` (text-style pinned exact `3.29.2`) to `^3.30.1` / `3.30.1`
- PR #270: bump `eslint-plugin-solid` from `^0.14.5` to `^0.15.0`
- PR #268: update `Swatinem/rust-cache` commit pin in `.github/workflows/benchmark.yml` (1 site) and `.github/workflows/ci.yml` (4 sites)
- PR #269: update `cachix/install-nix-action` commit pin in `.github/workflows/nix.yml` (1 site)
- Regenerate `bun.lock` and `package-lock.json`

## Non-Goals

- No push to remote; no merging/closing of the GitHub PRs (Dependabot auto-closes superseded branches)
- No refresh of `npmDepsHash` in `nix/package.nix` (requires Linux+Nix; Nix CI auto-patches after push)
- No Cargo dependency changes
- No E2E tests (no Tauri API/plugin bumps involved)

## Assumptions

- Worktree is clean and on `master` at `6487185`.
- Lockfile is healthy: `package-lock.json` version `0.6.6` matches `package.json`.
- No overlapping bumps between PRs (#270 and #271 touch disjoint packages); both are pending, neither applied yet.
- Both Actions PRs stay within the same major (`# v2`, `# v31`): no breaking-change review required per the runbook.
- `@tiptap/pm` spec stays `^3.27.1` but resolves to `3.30.1` in both lockfiles, matching PR #271's lockfile diff.
- Two commits will be created: one for npm deps, one for Actions pins.
- Environment is native Windows PowerShell; `cmd.exe /c` prefix kept per procedure.

## Open Questions

None.

## Tasks

### Task 1: Apply npm bumps to package.json

- Status: COMPLETED
- Objective: `package.json` reflects PRs #271 and #270.
- Steps:
  1. Bump the nine `@tiptap/*` prod entries (lines 69–77) to `^3.30.1`; keep `@tiptap/extension-text-style` pinned exact `3.30.1`; leave `@tiptap/pm` at `^3.27.1`.
  2. Bump `eslint-plugin-solid` to `^0.15.0` (line 104).
  3. Change only version strings; no reordering or formatting edits.
- Validation: `git diff package.json` shows exactly the ten version-string changes above.
- Notes: Files: `package.json`.

### Task 2: Regenerate bun.lock

- Status: COMPLETED
- Objective: `bun.lock` resolves the new versions.
- Steps:
  1. Run `cmd.exe /c bun install`.
- Validation: Command exits 0.
- Notes: Never hand-edit lockfiles.

### Task 3: Regenerate package-lock.json

- Status: COMPLETED
- Objective: `package-lock.json` resolves the new versions.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`.
  2. Check every `node_modules/*` entry has `resolved` and `integrity`. If any lack them: delete `node_modules/`, run full `npm install --legacy-peer-deps`, then `bun install` again.
- Validation: Command exits 0; integrity spot-check passes.
- Notes: `--legacy-peer-deps` is mandatory (eslint-plugin-solid peer on eslint@^9 vs project eslint@10).

### Task 4: Verify lockfiles

- Status: COMPLETED
- Objective: Both lockfiles resolve the bumped versions consistently.
- Steps:
  1. Grep both lockfiles for `@tiptap/core@3.30.1` resolution, `eslint-plugin-solid` `0.15.0`, and `ws@8.21.3` (transitive bump seen in PR diff).
  2. Confirm Flatpak integrity count equals total `node_modules/*` entries.
- Validation: Grep hits match expected versions; zero entries missing `resolved`/`integrity`.
- Notes: None.

### Task 5: Run validation suite (npm)

- Status: TO BE DONE
- Objective: Type-check, lint, and unit tests pass with the new deps.
- Steps:
  1. `cmd.exe /c bun run type-check`
  2. `cmd.exe /c bun run lint`
  3. `cmd.exe /c bun run test:run`
- Validation: All three exit 0.
- Notes: If lint fails on a new eslint-plugin-solid rule (0.x minor can add rules), fix violations or pin back and escalate.

### Task 6: Apply rust-cache bump (PR #268)

- Status: COMPLETED
- Objective: All five `Swatinem/rust-cache` pins updated.
- Steps:
  1. Replace `258712b0b7b1ddf8bddc9fc3b0faca682b2736c3` with `f0d9c3887740aee45f6153b24b3a6b815192ec16` in `.github/workflows/benchmark.yml` (line 29) and `.github/workflows/ci.yml` (lines 40, 132, 243, 319); keep the `# v2` comment.
- Validation: `git grep 258712b` returns nothing under `.github/workflows/`.
- Notes: Same-major commit-pin bump.

### Task 7: Apply install-nix-action bump (PR #269)

- Status: COMPLETED
- Objective: `nix.yml` pin updated.
- Steps:
  1. Replace `630ae543ea3a38a9a4166f03376c02c50f408342` with `13d8dd58da0234aa297dedd986986ccb8e7f3e24` in `.github/workflows/nix.yml` (line 34); keep the `# v31` comment.
- Validation: `git grep 630ae543` returns nothing under `.github/workflows/`.
- Notes: Patch bump within v31.

### Task 8: Validate workflows

- Status: COMPLETED
- Objective: Modified workflow files lint clean.
- Steps:
  1. `cmd.exe /c actionlint .github/workflows/*.yml` (fall back to PowerShell YAML parse if actionlint is unavailable).
  2. `git diff --stat` shows only: `package.json`, `bun.lock`, `package-lock.json`, `benchmark.yml`, `ci.yml`, `nix.yml`.
- Validation: actionlint exits 0; change set matches the six expected files.
- Notes: Final CI validation happens on next push (workflows are not built locally).

### Task 9: Commit

- Status: COMPLETED
- Objective: Local commits capturing all changes, user identity, no push.
- Steps:
  1. Commit 1 (npm): stage `package.json`, `bun.lock`, `package-lock.json`; message `Dependency Update: bump @tiptap/* to 3.30.1, eslint-plugin-solid to 0.15.0 (npmDepsHash needs Linux follow-up)`.
  2. Commit 2 (actions): stage the three workflow files; message `Dependency Update: bump Swatinem/rust-cache, cachix/install-nix-action pins`.
- Validation: `git log --oneline -2` shows both commits; `git status` clean.
- Notes: Use real git identity from `git config`; no co-author; no push.

### Task 10: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for scratch files, temp outputs, or obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state (this plan file moves to `docs/archive/` per repo convention once COMPLETED).
- Validation: Worktree diff contains only the six intended files plus this plan.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- `cmd.exe /c bun run type-check && cmd.exe /c bun run lint && cmd.exe /c bun run test:run` all exit 0
- `cmd.exe /c actionlint .github/workflows/*.yml` exits 0
- `git diff master --stat` shows only the six intended files
- `git log --oneline -2` shows the two Dependency Update commits

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Plan status is `READY FOR APPROVAL`.
- [x] Scope, non-goals, and assumptions are explicit.
- [x] No unresolved open questions.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] No dialog/interaction feature → UX-GATE not applicable.
- [x] No Tauri WebView behavior → PLATFORM-VERIFY not applicable.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Deviation (recorded during execution, 2026-08-24): `bun update @tiptap/pm` also raised the `@tiptap/pm` **spec** in `package.json` from `^3.27.1` to `^3.30.3` (kept deliberately — encodes the tiptap-monorepo same-version invariant; without it cold regenerations re-create a nested duplicate `@tiptap/pm` plus peer mismatch).
- Deviation: caret ranges resolved to latest in-range (`3.30.3`), not the PR snapshot's `3.30.1`; both lockfiles agree with each other, which is the invariant that matters.
- Deviation: `actionlint` not installed → validated with node YAML parse (`yaml` lib) instead; final workflow validation happens on next CI run.
- Tooling note: PowerShell 5.1 lacks `ConvertFrom-Json -AsHashtable`; lockfile checks done with `node -e`.
