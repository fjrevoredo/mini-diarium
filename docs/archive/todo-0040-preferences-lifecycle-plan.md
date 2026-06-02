# TODO-0040: Preferences Lifecycle Unification

## Metadata

- Plan Status: IN PROGRESS
- Created: 2026-05-28
- Last Updated: 2026-05-28
- Owner: Coding agent
- Approval: APPROVED
- Related TODO: TODO-0040 in `docs/todo/TODO.md`

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace the Preferences dialog's deferred Save/Cancel flow with a close-only shell, so preference changes apply immediately when the user interacts with them, while destructive or irreversible operations remain explicit action buttons with their existing confirmations and error handling.

## Scope

- Remove the Preferences shell's Save/Cancel footer and its deferred commit registry
- Convert buffered General, Writing, and Security auto-lock controls to immediate persistence
- Audit every control in Preferences and classify it as either an immediate preference or an explicit action
- Bring Theme Overrides into the no-confirmation model without losing safe handling of invalid JSON
- Keep the plan aligned with the current tab ownership, where custom-font management now lives in Advanced rather than Writing
- Update tests, docs, changelog, and agent-facing frontend guidance for the new lifecycle

## Non-Goals

- Changing journal security semantics, auth slot rules, or destructive confirmations
- Reworking the Preferences tab layout, tab access rules, or styling beyond removing the redundant footer
- Moving timestamp format/precision controls out of the editor timestamp popup
- General settings-taxonomy refactors outside the Preferences lifecycle change

## Current Status

- `src/components/overlays/preferences/PreferencesOverlay.tsx` still owns a Save/Cancel footer and a `registerCommit()` shell API used by buffered tabs.
- `PreferencesGeneralTab.tsx`, `PreferencesWritingTab.tsx`, and the auto-lock part of `PreferencesSecurityTab.tsx` buffer local draft state and only persist on Save.
- `PreferencesDataTab.tsx`, require-all-auth, auth method forms, key-file generation, password change, custom font upload/delete, and debug dump already run as explicit immediate actions.
- `PreferencesAdvancedTab.tsx` now owns both Theme Overrides and `PreferencesCustomFontsSection`, but still has its own `Apply Overrides` / `Reset to Default` mini-flow, so it does not yet match the intended no-confirmation UX.
- Current docs and changelog text still contain stale locations such as **Preferences → Writing → Custom fonts** and **Preferences → General → Theme Overrides** even though those controls now live under Advanced.
- Existing unit and integration tests assert Save-based behavior and will fail or become obsolete once the shell is removed.

## Assumptions

- "Apply immediately" applies to reversible UI preferences, not to irreversible or externally side-effecting actions such as password rotation, key-file generation, journal reset, directory moves, debug dump export, or custom font upload/delete.
- The explicit action buttons inside Security, Data, and Diagnostics remain, because typing into those forms must not trigger backend mutations until the user invokes the action.
- Theme Overrides should lose the dedicated `Apply Overrides` button and auto-apply only when the current JSON parses successfully; invalid JSON may remain visible locally with an inline error while the last valid persisted overrides stay active.
- `setPreferences()` remains the canonical immediate persistence path for `localStorage['preferences']`; the separate theme keys (`theme-preference`, `theme-overrides`) continue to be managed by their existing helpers.
- The user-facing docs that matter here are `website/docs-src/07-preferences.md`, `website/docs-src/01-writing-entries.md`, and `docs/USER_GUIDE.md`; the most specific agent doc to update is `src/CLAUDE.md`.

## Open Questions

- None

## Milestones

### Milestone 1: Remove Deferred Shell Commit Flow

- Status: COMPLETED
- Purpose: Delete the shell-level Save/Cancel lifecycle so the overlay becomes a close-only container.
- Exit Criteria: The overlay no longer exposes Save/Cancel buttons or a commit registry, and closing the dialog never performs an implicit batched write.

#### Task 1.1: Remove the shell commit registry and footer buttons

- Status: COMPLETED
- Objective: `PreferencesOverlay` becomes a close-only dialog shell with no deferred commit infrastructure.
- Steps:
  1. Update `src/components/overlays/preferences/shared.ts` to remove the `PreferencesShellApi` / `registerCommit()` contract if no longer needed by any tab.
  2. Refactor `src/components/overlays/preferences/PreferencesOverlay.tsx` to remove the `commits` set, `handleSave()`, and the footer Save/Cancel button row.
  3. Keep the existing top-right `Dialog.CloseButton`, Escape handling, overlay dismissal, active-tab reset, and locked/unlocked tab gating intact.
  4. Ensure closing the dialog simply calls `props.onClose()` and does not perform any hidden persistence pass.
- Validation: `cmd.exe /c bun run type-check`
- Notes: Affected files are expected to include `PreferencesOverlay.tsx` and `shared.ts`. Preserve ARIA tab semantics and the responsive dialog sizing from TODO-0020.

#### Task 1.2: Rewrite shell tests around the close-only contract

- Status: COMPLETED
- Objective: Overlay shell tests validate the new close-only behavior instead of the removed Save/Cancel footer.
- Steps:
  1. Update `src/components/overlays/preferences/PreferencesOverlay.test.tsx` to remove Save/Cancel assertions.
  2. Add assertions that the close button is present and that clicking it closes the dialog.
  3. Add an assertion that Save/Cancel buttons are absent.
  4. Keep the existing tab-availability tests for locked vs unlocked journals.
- Validation: `cmd.exe /c bun run test:run`
- Notes: The current test file stubs child tabs, which is still appropriate for shell-only behavior.

### Milestone 2: Convert Buffered Preferences To Immediate Persistence

- Status: COMPLETED
- Purpose: Move General, Writing, and Security auto-lock settings from draft-on-save behavior to immediate write-through updates.
- Exit Criteria: Every reversible preference control in General, Writing, and Security persists at interaction time and still reopens with the correct saved value.

#### Task 2.1: Convert General tab controls to immediate persistence

- Status: COMPLETED
- Objective: Theme, language, and ESC-key action update persisted state immediately when changed.
- Steps:
  1. Refactor `src/components/overlays/preferences/PreferencesGeneralTab.tsx` to remove `usePreferencesShell()` and its `onMount(registerCommit)` flow.
  2. Update the Theme select to call `setTheme(...)` immediately on change.
  3. Update the Language and ESC-action selects to call `setPreferences(...)` immediately on change.
  4. Verify reopening the overlay reflects persisted values without any draft resync hacks.
- Validation: `cmd.exe /c bun run test:run`
- Notes: Theme preference persists through `src/lib/theme.ts`, not `src/state/preferences.ts`; keep that split intact.

#### Task 2.2: Convert simple Writing tab controls to immediate persistence

- Status: COMPLETED
- Objective: Writing-tab scalar controls persist immediately instead of waiting for a shell Save.
- Steps:
  1. Refactor `src/components/overlays/preferences/PreferencesWritingTab.tsx` to remove `usePreferencesShell()` and the commit callback.
  2. Update First day of week, Allow future entries, Hide titles, Show entry timestamps, Spellcheck, and Editor font size to write through with `setPreferences(...)` on change/input.
  3. Preserve existing range clamping and type conversions for `editorFontSize` and `firstDayOfWeek`.
  4. Verify no control depends on switching tabs or closing the overlay to persist.
- Validation: `cmd.exe /c bun run test:run`
- Notes: `timestampFormat` and `timestampPrecision` live in `TimestampOverlay.tsx`, not in Preferences; do not pull them into this task.

#### Task 2.3: Convert Writing tab collection controls to immediate persistence

- Status: COMPLETED
- Objective: Toolbar-item toggles/order and editor font-family selection stay in sync with saved preferences at every interaction.
- Steps:
  1. Update the toolbar item enable/disable handlers, move-up/down handlers, and select-all/select-none actions in `PreferencesWritingTab.tsx` to persist immediately after each mutation.
  2. Update `PreferencesFontFamilyField.tsx` and its parent wiring so selecting a bundled/custom font writes `editorFontFamily` immediately.
  3. Preserve or simplify the current local font-family sync behavior so the dropdown still clears correctly if a selected custom family is deleted elsewhere in Preferences.
  4. Confirm the toolbar controls in `src/components/editor/EditorToolbar.tsx` remain consistent with Preferences because both surfaces write to the same saved state.
- Validation: `cmd.exe /c bun run test:run`
- Notes: Custom-font upload/delete is no longer part of the Writing tab UI; that explicit-action behavior is covered in Milestone 3.

#### Task 2.4: Convert Security auto-lock controls to immediate persistence

- Status: COMPLETED
- Objective: Auto-lock enabled/timeout persist immediately while preserving the current validation range and unlocked-state behavior.
- Steps:
  1. Refactor `src/components/overlays/preferences/PreferencesSecurityTab.tsx` to remove the buffered auto-lock commit registration.
  2. Update the auto-lock checkbox to call `setPreferences({ autoLockEnabled: ... })` immediately on toggle.
  3. Update the timeout input so edits are persisted in a controlled way that preserves the `1..999` clamp and does not thrash invalid temporary values into storage.
  4. Preserve the existing require-all-auth toggle behavior and auth-method reload logic.
- Validation: `cmd.exe /c bun run test:run`
- Notes: This task replaces the current "save flow" tests that were added specifically to protect the old deferred commit behavior.

### Milestone 3: Audit Exceptions And Advanced Behavior

- Status: COMPLETED
- Purpose: Make the remaining controls consistent with the new lifecycle without accidentally auto-triggering irreversible actions.
- Exit Criteria: Every Preferences control is explicitly classified as either an immediate preference or an explicit action, and Theme Overrides follow the new no-confirmation model safely.

#### Task 3.1: Preserve explicit-action controls and confirm the boundary

- Status: COMPLETED
- Objective: Irreversible or side-effecting operations remain user-invoked actions rather than auto-executing form fields.
- Steps:
  1. Audit `ChangePasswordForm.tsx`, `AddPasswordForm.tsx`, `AddKeypairForm.tsx`, `AuthMethodsList.tsx`, `PreferencesDataTab.tsx`, `PreferencesCustomFontsSection.tsx`, and the debug-dump action in `PreferencesAdvancedTab.tsx`.
  2. Confirm these flows still require their explicit buttons, existing confirmations, and existing success/error feedback.
  3. Make only the minimal code changes needed so these forms no longer rely on any removed shell API.
  4. Add a concise code comment only where the immediate-vs-explicit boundary would otherwise be unclear to future maintainers.
- Validation: Manual code inspection confirms no backend mutation is triggered solely by typing, tab-switching, or closing the overlay.
- Notes: This is where "reversible where expected" is enforced. Journal reset, password/key-file operations, custom-font upload/delete, and debug-dump export are intentionally excluded from auto-apply.

#### Task 3.2: Convert Theme Overrides to the no-confirmation lifecycle

- Status: COMPLETED
- Objective: Theme Overrides stop depending on `Apply Overrides` while still handling invalid JSON safely.
- Steps:
  1. Refactor `src/components/overlays/preferences/PreferencesAdvancedTab.tsx` so valid JSON is persisted and applied automatically when the textarea content becomes parseable.
  2. Remove the `Apply Overrides` button and any copy that depends on it.
  3. Keep inline parse-error feedback for invalid JSON, but do not overwrite the last valid persisted overrides until the content parses again.
  4. Keep `Reset to Default` as an explicit reversible action that clears overrides immediately.
- Validation: `cmd.exe /c bun run test:run`
- Notes: This task likely needs updated copy in `src/i18n/locales/en.ts` and community locale files if the existing hint text no longer matches the behavior.

#### Task 3.3: Replace deferred-save tests with immediate-persistence regression coverage

- Status: COMPLETED
- Objective: Tab-level and integration tests prove that persistence now happens at interaction time and that closing the overlay does not perform a hidden commit pass.
- Steps:
  1. Update `PreferencesSecurityTab.test.tsx` so it asserts direct `setPreferences(...)` calls on toggle/input rather than invoking a captured commit callback.
  2. Update `PreferencesWritingTab.test.tsx` so font-family, toolbar-item, and other writing preferences assert immediate persistence, without assuming custom-font management lives in Writing.
  3. Add dedicated coverage for `PreferencesAdvancedTab` and/or `PreferencesCustomFontsSection` covering:
     - valid Theme Overrides JSON auto-applies and persists
     - invalid Theme Overrides JSON shows an inline error without overwriting the last valid saved overrides
     - Reset to Default still clears overrides explicitly
     - custom-font upload/delete remains explicit-action behavior in Advanced
  4. Rewrite `PreferencesOverlay.integration.test.tsx` to verify cross-tab changes are present in `localStorage` before the dialog is closed, and that closing the dialog just closes it.
- Validation: `cmd.exe /c bun run test:run`
- Notes: The previous integration tests specifically protected the old commit-order clobber bug. Replace them with immediate-write regressions instead of just deleting them.

### Milestone 4: Update Docs And Release Artifacts

- Status: COMPLETED
- Purpose: Keep user-facing docs, agent guidance, and release notes aligned with the new Preferences behavior.
- Exit Criteria: Docs describe immediate-apply Preferences accurately, agent guidance no longer mentions a save/cancel footer, and the unreleased changelog records the behavior change.

#### Task 4.1: Update user docs and frontend agent guidance

- Status: COMPLETED
- Objective: The documented Preferences behavior matches the implemented no-confirmation UX.
- Steps:
  1. Update `website/docs-src/07-preferences.md` to describe the close-only dialog, immediate persistence model, Theme Overrides under Advanced, and custom-font management under Advanced.
  2. Update related user docs with stale locations or stale lifecycle wording, specifically `website/docs-src/01-writing-entries.md` and `docs/USER_GUIDE.md`.
  3. Update `src/CLAUDE.md` so `PreferencesOverlay.tsx` is no longer described as a "save/cancel footer" shell.
  4. If the new immediate-write rule is intended to guide future settings work broadly, add a short note to `docs/best-practices/FRONTEND_BEST_PRACTICES.md`; otherwise keep the guidance local to `src/CLAUDE.md`.
- Validation:
  - `cmd.exe /c bun run website:build-static`
  - File inspection confirms `docs/USER_GUIDE.md` no longer mentions stale Preferences locations or the removed Save/Apply flow
- Notes: `website/docs-src/` is the authoritative user reference. Do not hand-edit generated docs under `docs/`.

#### Task 4.2: Update changelog and close the originating TODO

- Status: COMPLETED
- Objective: Repository tracking artifacts reflect that the Preferences lifecycle change shipped.
- Steps:
  1. Add an unreleased entry to `CHANGELOG.md` describing the new close-only Preferences flow and immediate application of reversible settings.
  2. Correct any unreleased changelog text that still points at stale Preferences locations affected by this work, especially custom-font and Theme Overrides references.
  3. Mark TODO-0040 as completed in `docs/todo/TODO.md`.
  4. If implementation leaves any follow-up gaps that should not block merge, create a new TODO instead of overloading TODO-0040.
- Validation: File inspection confirms `CHANGELOG.md` and `docs/todo/TODO.md` reflect the completed work.
- Notes: Do not archive TODO-0040 manually unless the repo’s TODO workflow explicitly requires it during the same task.

### Milestone 5: Cleanup And Final Verification

- Status: IN PROGRESS
- Purpose: Ensure the repository contains only intended final artifacts and that the integrated Preferences lifecycle change is fully validated.
- Exit Criteria: Temporary artifacts are removed, all final verification passes, TODO-0040 is checked off, and the plan status is set to COMPLETED.

#### Task 5.1: Cleanup intermediate artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary notes, scratch tests, debug logging, one-off helper files, and stale comments created during the refactor.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, docs, and generated outputs that are part of the repository contract.
  4. Verify TODO-0040 is marked `[x]` in `docs/todo/TODO.md`.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove unrelated user changes already present in the worktree.

#### Task 5.2: Final verification

- Status: IN PROGRESS
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run the final verification commands listed below.
  2. Perform a manual Preferences smoke test in the running app:
     - Change Theme, Language, Hide titles, Editor font size, Toolbar items, Auto-lock enabled/timeout, and Theme Overrides.
     - Confirm each reversible preference takes effect without pressing Save.
     - Close and reopen Preferences to confirm persisted values reload correctly.
     - Confirm explicit actions such as Change Password, Generate Debug Dump, Move Journal, Reset Journal, and custom-font upload/delete still require their dedicated buttons.
  3. Fix failures and rerun until verification passes, or record the blocker.
- Validation:
  - `cmd.exe /c bun run format`
  - `cmd.exe /c bun run type-check`
  - `cmd.exe /c bun run lint`
  - `cmd.exe /c bun run test:run`
  - `cmd.exe /c bun run validate:locales`
  - `cmd.exe /c bun run website:build-static`
- Notes: If a dedicated Windows UI smoke test is needed, use the repo’s `tauri-agent-dev` workflow rather than ad hoc browser assumptions.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these checks before marking the plan COMPLETED. Fix all failures before proceeding.

- [x] `cmd.exe /c bun run format` succeeds
- [x] `cmd.exe /c bun run type-check` passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run test:run` passes
- [x] `cmd.exe /c bun run validate:locales` passes if i18n keys or copy changed
- [x] `cmd.exe /c bun run website:build-static` succeeds after docs updates
- [ ] Manual Preferences smoke test passes in the running app
- [x] `CHANGELOG.md` updated with the behavior change
- [x] TODO-0040 marked completed
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user.
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] Plan status is updated during execution (`IN PROGRESS` while work is ongoing).

## Execution Notes

- Update the plan status to `IN PROGRESS` before implementation starts.
- Update each task to `IN PROGRESS` before changing code for that task.
- Run the listed validation immediately after each task and mark the task `COMPLETED` only after validation passes.
- Mark a task or milestone `BLOCKED` with a short reason if progress cannot continue.
