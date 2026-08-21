# Project Support Overlay remediation plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-21
- Last Updated: 2026-08-21
- Owner: Coding agent
- Source: [`2026-08-21-project-support-overlay-self-check.md`](reports/2026-08-21-project-support-overlay-self-check.md)

## Goal

Eliminate the Project Support milestone's cross-journal async race and unhandled statistics-error
path, then reconcile the plan/report documentation and coverage procedure with the now-archived,
committed implementation.

## Scope

- `src/state/support-milestone.ts` and `src/state/support-milestone.test.ts` — make pending
  milestone state request- and journal-bound across lock, unlock, and journal-switch boundaries;
  handle `getStatistics()` failures as a non-fatal absence of a prompt.
- Existing support-overlay consumers/tests only if the chosen state representation requires a
  type-safe consumer update.
- `docs/archive/project-support-overlay-plan.md` — correct the staged-working-tree coverage
  command and its recorded verification language.
- All live and archived references to the original implementation plan — point them at
  `docs/archive/project-support-overlay-plan.md` using correct relative paths.
- `docs/reports/2026-08-21-project-support-overlay-self-check.md` — retain the review's snapshot
  evidence and append a dated follow-up recording that the plan was subsequently committed and
  archived, rather than rewriting the historical finding as if it had been false.
- `CHANGELOG.md` — add a `Fixed` entry for the user-visible cross-journal milestone bug.

## Non-Goals

- No Rust/backend, schema, encryption, network, URL, or focus-lock behavior change.
- No redesign of the Project Support overlay, milestone rungs, localStorage key names, or
  checklist persistence.
- No new E2E suite unless the targeted Vitest tests cannot prove the asynchronous state contract.
- Do not modify or stage unrelated user work.

## Assumptions

- The committed plan's archival location is authoritative:
  `docs/archive/project-support-overlay-plan.md` (verified at the current `HEAD`).
- A stale request must neither render a Heart icon nor write a shown-rung key for another journal.
- `getStatistics()` is optional support-prompt data; failure must leave `pendingRung()` null and
  must not escape as an unhandled rejection.
- The current `resetSessionState()` call remains the session-boundary invalidation point. The fix
  must also prevent an older request from winning when a newer request starts in the same session.

## Open Questions

None. The remediation is fully defined by the reviewed failure paths and current repository state.

## Tasks

### Task 1: Establish the state-invalidation contract

- Status: COMPLETED
- Objective: Define a narrow, testable ownership rule for a pending milestone before changing the
  implementation.
- Steps:
  1. Inspect the current `checkSupportMilestone`, `dismissSupportMilestone`,
     `resetSupportMilestoneState`, `App.tsx` unlock effect, and journal-switch/lock lifecycle.
  2. Make each lookup carry a monotonically increasing request generation captured before
     `await getStatistics()`; invalidate it whenever a newer lookup starts and when
     `resetSupportMilestoneState()` runs.
  3. After the await, publish only if both the generation still matches and the captured journal
     remains `activeJournalId()`.
  4. Store enough pending-state ownership information for `dismissSupportMilestone()` to refuse
     writes unless the active journal is the journal that earned the pending rung. Preserve the
     existing `pendingRung(): number | null` consumer contract where possible.
- Validation: A code read-through can state the exact conditions required for publish and dismiss;
  `Header.tsx` continues to compile without semantic changes to its conditional rendering.
- Notes: Do not rely on response order or `resetSessionState()` alone; A → B → A and overlapping
  requests in one journal must be safe.

### Task 2: Implement fail-safe milestone lookup and dismissal

- Status: COMPLETED
- Objective: A support prompt is shown only for the active, current session, and statistics
  failures silently produce no prompt.
- Steps:
  1. Implement the generation and journal-ownership checks specified in Task 1 in
     `src/state/support-milestone.ts`.
  2. Catch a rejected `getStatistics()` inside `checkSupportMilestone()`; if the failed request is
     still current, clear any pending milestone for that request and return normally.
  3. Ensure session reset invalidates all in-flight checks and clears both rung and ownership
     state without persisting a dismissal.
  4. Keep the public API free of journal IDs in presentation consumers; any ownership metadata is
     internal to the milestone state module.
- Validation: `cmd.exe /d /s /c "bun run type-check"` and the focused milestone test file pass.
- Notes: This is frontend-only session integrity work. It must not alter the independent idle,
  OS-event, or focus-loss auto-lock paths.

### Task 3: Add adversarial regression tests

- Status: COMPLETED
- Objective: Lock/switch timing and IPC failure cannot regress behind green happy-path tests.
- Steps:
  1. In `src/state/support-milestone.test.ts`, add a deferred-statistics test: start a lookup for
     journal A, reset the session and change the mocked active journal to B, resolve A's promise,
     then assert `pendingRung()` remains null and no B shown-rung key is written on dismissal.
  2. Add an A → B → A or overlapping-request case where an older resolution arrives after the
     newer one; assert only the newest valid request determines the pending rung.
  3. Add a rejected-statistics case; await `checkSupportMilestone()` and assert it resolves,
     leaves no pending rung, and writes no shown-rung key.
  4. Retain and rerun the existing first-seen, rung-boundary, dismissal, and reset tests.
- Validation: `cmd.exe /d /s /c "bunx vitest run src/state/support-milestone.test.ts"` passes;
  the new tests explicitly contain deferred-resolution and rejection assertions rather than only
  broad suite coverage.
- Notes: The tests must manipulate only mocked state and promises; do not add timeout-based tests.

### Task 4: Reconcile plan locations, links, and review history

- Status: COMPLETED
- Objective: Documentation accurately describes the committed archive layout and remains
  navigable.
- Steps:
  1. Replace every active or archived reference that incorrectly targets the former root-level
     plan location with a relative link to `docs/archive/project-support-overlay-plan.md`; include TODO, ADR, source comments, the
     security-stance skill, the archived exploration, and the self-check report.
  2. In `docs/archive/project-support-overlay-plan.md`, replace Task 5.4's coverage command with
     `cmd.exe /d /s /c "bun run coverage:diff -- --working-tree"`, and state that
     `coverage:check -- --working-tree` is required when lcov must be regenerated.
  3. Add a dated follow-up to the self-check report explaining that the P1 staging finding was
     accurate at review time, and that commit `41e7297` subsequently moved the plan into the
     tracked archive; do not erase the original evidence.
  4. Use `rg -n "project-support-overlay-plan\.md"` over tracked project documentation and
     source comments to prove no stale destination remains.
- Validation: Every resulting Markdown link resolves locally; the `rg` audit has no reference to
  the former root-level plan location; documentation spelling/relative paths
  are manually proofread.
- Notes: The original plan is already tracked in `docs/archive/`; do not recreate a second copy
  in `docs/`.

### Task 5: Record the user-visible fix and preserve scoped history

- Status: COMPLETED
- Objective: The changelog and report accurately distinguish the fixed runtime defect from the
  already-resolved document-staging event.
- Steps:
  1. Add a `### Fixed` bullet under the current unreleased section of `CHANGELOG.md` explaining
     that a late support-milestone lookup can no longer make another journal show or consume a
     milestone.
  2. Do not create a new TODO: this is an in-scope remediation of completed TODO-0106, not a
     separate feature request.
  3. Confirm the report follow-up from Task 4 does not overstate manual or E2E validation.
- Validation: Compare the new bullet with neighboring changelog voice; verify its linked plan and
  TODO references resolve.
- Notes: Use an Internal note only for documentation-only follow-up; the runtime race belongs in
  `Fixed`.

### Task 6: Cleanup and final verification

- Status: COMPLETED
- Objective: The final diff contains only the remedial code, regression tests, and durable
  documentation, with all frontend gates passing against the actual working-tree patch.
- Steps:
  1. Inspect `git status --short`, `git diff --check`, and the staged diff; preserve unrelated
     files and stage only this remediation's coherent file set when requested to commit.
  2. Remove no maintained report, archived plan, regression test, or documentation artifact.
  3. Run the mandatory frontend checks and the corrected coverage command.
  4. Re-read this plan's tasks and validations; update the task ledger before declaring the work
     complete.
- Validation:
  - `cmd.exe /d /s /c "bun run type-check"`
  - `cmd.exe /d /s /c "bun run lint"`
  - `cmd.exe /d /s /c "bun run format:check"`
  - `cmd.exe /d /s /c "bun run test:run"`
  - `cmd.exe /d /s /c "bun run build"`
  - `cmd.exe /d /s /c "bun run coverage:diff -- --working-tree"`
  - `git diff --check`
- Notes: Locale validation is not required for this plan because no i18n key changes are planned.
  Local E2E is not required by the post-task scope rules: this is frontend session-state logic with
  deterministic unit coverage and no changed window/viewport or cross-layer UI behavior.

## Final Verification

- [x] Every Task 3 named regression scenario passes in its focused test.
- [x] The full frontend suite and all Task 6 commands pass.
- [x] A stale A request cannot display or dismiss a milestone in B, including after A → B → A.
- [x] A `getStatistics()` rejection is contained and leaves no prompt.
- [x] All references resolve to the single archived implementation plan; the self-check report has
      a truthful dated follow-up.
- [x] The final working-tree file set contains only the remediation scope; no files are staged because
      the user requested implementation without a commit.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` exists).
- [x] Plan Status is `COMPLETED`.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No open questions remain; all choices are constrained by the review findings and current
      repository state.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions and identifies concrete files, state invariants, tests, and
      commands.
- [x] The plan can be executed without the original conversation.
- [x] No new dialog/WebView interaction is introduced, so a new UX-GATE or PLATFORM-VERIFY is not
      required. Existing overlay behavior remains covered by the original archived plan.

## Approval Gate

Approval was satisfied by the user's explicit request to implement this plan.

## Execution Notes

- Set the plan status to `IN PROGRESS` and the active task to `IN PROGRESS` before editing.
- Update each task to `COMPLETED` immediately after its named validation passes.
- Mark a task `BLOCKED` with the concrete reason if the required source, test seam, or validation
  cannot be completed.
- Treat newly discovered defects as in-scope only when they are required to preserve the
  request/journal ownership invariant; otherwise record a new blocked task before proceeding.
