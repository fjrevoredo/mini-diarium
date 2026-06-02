# Apply Dependabot Bumps (#115 + #116)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-06
- Last Updated: 2026-05-06
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Apply the remaining Dependabot dependency bump from PR #116 (`typescript-eslint` ^8.59.1 → ^8.59.2), given that PR #115 is already applied in the workspace. Update both lockfiles (`bun.lock` and `package-lock.json`) to reflect the new dependency resolution.

## Scope

- Bump `typescript-eslint` from `^8.59.1` to `^8.59.2` in `package.json` (line 83)
- Regenerate `bun.lock` via `bun install`
- Regenerate `package-lock.json` via `npm install` (also brings it from stale 0.4.19 to 0.4.20)
- Run validation: type-check, lint, and frontend tests

## Non-Goals

- Applying other Dependabot PRs not explicitly requested
- Applying PR #115 (already applied to `package.json` and `bun.lock`)
- Any unrelated dependency changes

## Assumptions

- PR #115 changes are already present in `package.json` and `bun.lock` (version 0.4.20, all deps at bumped versions)
- `package-lock.json` is stale at version 0.4.19 and will be updated as a side effect
- `bun` is the primary package manager for development; `npm` is used only for Dependabot lockfile compatibility
- The `cmd.exe /c` wrapper is used for all project commands per AGENTS.md

## Open Questions

None

## Tasks

### Task 1: Bump typescript-eslint and regenerate lockfiles

- Status: COMPLETED
- Objective: `package.json` has `typescript-eslint` at `^8.59.2`, and both `bun.lock` and `package-lock.json` reflect the updated resolution.
- Steps:
  1. Edit `package.json` line 83: change `"typescript-eslint": "^8.59.1"` to `"typescript-eslint": "^8.59.2"`
  2. Run `cmd.exe /c bun install` to regenerate `bun.lock`
  3. Run `cmd.exe /c npm install` to regenerate `package-lock.json`
- Validation:
  - `package.json` contains `"typescript-eslint": "^8.59.2"`
  - `bun.lock` contains `typescript-eslint@8.59.2` (not `8.59.1`)
  - `package-lock.json` has version `0.4.20` and typescript-eslint resolved to 8.59.2
  - Both install commands exit with code 0
- Notes: Do not manually edit lockfiles; they are auto-generated. `npm install` is used alongside `bun install` to update the npm-format lockfile that Dependabot targets.

### Task 2: Run validation suite

- Status: COMPLETED
- Objective: All validation commands pass with the updated dependency.
- Steps:
  1. Run `cmd.exe /c bun run type-check`
  2. Run `cmd.exe /c bun run lint`
  3. Run `cmd.exe /c bun run test:run`
- Validation: All three commands exit with code 0.
- Notes: E2E and Rust tests are out of scope for a devDependency patch bump.

### Task 3: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Worktree contains only the intended changes.
- Steps:
  1. Verify `git diff --stat` shows only `package.json`, `bun.lock`, and `package-lock.json`.
  2. Remove this plan file (`docs/apply-dependabot-bumps-plan.md`) if the user does not want to keep it.
- Validation: `git diff --stat` shows exactly three files changed.
- Notes: None.

## Final Verification

- `cmd.exe /c bun run type-check` passes
- `cmd.exe /c bun run lint` passes
- `cmd.exe /c bun run test:run` passes
- `git diff --stat` shows only the three expected files

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, and assumptions are explicit.
- [x] All open questions are either answered or marked None.
- [x] Every task has concrete steps and validation.
- [x] Tasks <= 10, so no milestones needed.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] Accounted for both lockfiles (`bun.lock` and `package-lock.json`).
- [x] Accounted for stale `package-lock.json` (version 0.4.19 → 0.4.20).
- [x] PR #115 fully scoped as already-applied.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
