# Dependency Updates Plan (PRs #113, #114, #115)

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-05
- Last Updated: 2026-05-05
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Merge three Dependabot PRs that update all production and development dependencies across the project: Rust crates in `src-tauri/Cargo.toml`, JavaScript prod dependencies in `package.json`, and JavaScript dev dependencies in `package.json`.

## Scope

- Update Rust crates: tauri, tauri-plugin-opener, tauri-plugin-dialog, tauri-build
- Update JS production deps: @tauri-apps/api, @tauri-apps/plugin-dialog, @tauri-apps/plugin-opener, dompurify, lucide-solid, marked
- Update JS dev deps: @mermaid-js/mermaid-cli, @tauri-apps/cli, @wdio/cli, @wdio/local-runner, @wdio/mocha-framework, @wdio/spec-reporter, @wdio/types, eslint, jsdom, webdriverio
- Run all validation commands to ensure build and tests pass

## Non-Goals

- No code changes beyond dependency version bumps
- No new features or behavior changes

## Assumptions

- All three PRs are to be merged together as a coordinated batch
- No version conflicts exist between updated dependencies
- The repository is in a clean state with no uncommitted changes

## Open Questions

- None

## Tasks

### Task 1: Update Rust dependencies in src-tauri/Cargo.toml

- Status: TO BE DONE
- Objective: Update Cargo.toml with new crate versions from PR #113
- Steps:
  1. Open `src-tauri/Cargo.toml`
  2. Update `tauri` from 2.10.3 to 2.11.0
  3. Update `tauri-plugin-opener` from 2.5.3 to 2.5.4
  4. Update `tauri-plugin-dialog` from 2.7.0 to 2.7.1
  5. Update `tauri-build` from 2.5.6 to 2.6.0
  6. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo update"` to sync Cargo.lock
  7. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo check"` to validate
- Notes: `cargo update` resolves the new minimum versions in Cargo.lock. These are the same versions already proposed in PR #113.

### Task 2: Update JS production dependencies in package.json

- Status: TO BE DONE
- Objective: Update package.json prod deps with new versions from PR #115
- Steps:
  1. Open `package.json`
  2. Update `@tauri-apps/api` from 2.10.1 to 2.11.0
  3. Update `@tauri-apps/plugin-dialog` from 2.7.0 to 2.7.1
  4. Update `@tauri-apps/plugin-opener` from 2.5.3 to 2.5.4
  5. Update `dompurify` from 3.4.1 to 3.4.2
  6. Update `lucide-solid` from 1.12.0 to 1.14.0
  7. Update `marked` from 18.0.2 to 18.0.3
- Validation: `cmd.exe /c bun run type-check`
- Notes: These are the same versions already proposed in PR #115

### Task 3: Update JS dev dependencies in package.json

- Status: TO BE DONE
- Objective: Update package.json dev deps with new versions from PR #114
- Steps:
  1. Open `package.json`
  2. Update `@mermaid-js/mermaid-cli` from 11.12.0 to 11.14.0
  3. Update `@tauri-apps/cli` from 2.10.1 to 2.11.0
  4. Update `@wdio/cli` from 9.27.0 to 9.27.1
  5. Update `@wdio/local-runner` from 9.27.0 to 9.27.1
  6. Update `@wdio/mocha-framework` from 9.27.0 to 9.27.1
  7. Update `@wdio/spec-reporter` from 9.27.0 to 9.27.1
  8. Update `@wdio/types` from 9.27.0 to 9.27.1
  9. Update `eslint` from 10.2.1 to 10.3.0
  10. Update `jsdom` from 29.1.0 to 29.1.1
  11. Update `webdriverio` from 9.27.0 to 9.27.1
- Validation: `cmd.exe /c bun run lint`
- Notes: These are the same versions already proposed in PR #114

### Task 4: Run full test suite

- Status: TO BE DONE
- Objective: Validate that all updates work correctly and don't break existing functionality
- Steps:
  1. Run frontend tests: `cmd.exe /c bun run test:run`
  2. Run Rust tests: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
  3. Run linting: `cmd.exe /c bun run lint`
  4. Run type-check: `cmd.exe /c bun run type-check`
- Validation: All commands exit with code 0
- Notes: None

### Task 5: Verify build succeeds

- Status: TO BE DONE
- Objective: Confirm the app builds successfully with updated dependencies
- Steps:
  1. Run production build: `cmd.exe /c bun run build`
- Validation: Build completes without errors
- Notes: None

### Task 6: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation
- Steps:
  1. Inspect the worktree for any unexpected files
  2. Remove only artifacts that are not part of the intended final repository state
  3. Keep all dependency updates as the intended changes
- Validation: Worktree diff contains only intended dependency changes in package.json and Cargo.toml
- Notes: None

## Final Verification

- `git diff` shows only version changes in `package.json` and `src-tauri/Cargo.toml`
- All three PRs (#113, #114, #115) are effectively merged

## Plan Self-Check

- [x] Plan location follows the default location rule (docs/ directory).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user (none).
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.