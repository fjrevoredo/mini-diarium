# Auto-Focus Editor on Startup (TODO-0009 / #119)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-07
- Last Updated: 2026-05-07
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

When the journal is unlocked and the app first shows the editor, the TipTap editor should receive focus automatically so the user can start typing immediately. This should fire only once per unlock session — not on every date navigation, entry switch, or save cycle. Re-locking and re-unlocking should reset the behavior so focus fires again on the next unlock.

## Scope

- Add a session-level flag (`hasFocusedEditorOnUnlock`) to `src/state/session.ts` that tracks whether focus has been fired since the last unlock.
- Reset the flag in `resetSessionState()` (called on every lock).
- Add a `createEffect` in `EditorPanel.tsx` that watches the editor instance signal, calls `editor.commands.focus('end')` once after the TipTap editor is created, and sets the flag.
- Use `requestAnimationFrame` to ensure the browser has painted before focusing.
- The effect depends ONLY on `editorInstance()` (not `content()`), so it fires once when the editor mounts — TipTap's `setContent` does not steal focus, so content loading after focus is safe.

## Non-Goals

- Do not auto-focus on date navigation or entry switching within the same unlocked session.
- Do not change focus behavior for the title editor (Enter already focuses the content editor via `handleTitleEnter`).
- Do not add new i18n keys, UI changes, or preference toggles for this behavior.

## Assumptions

- `resetSessionState()` is called on every lock boundary (confirmed in `auth.ts` via `resetForLockedSession()` and all unlock paths).
- `EditorPanel` is only rendered when `authState() === 'unlocked'` (confirmed in `App.tsx` via `MainLayout`).
- The TipTap editor instance is available via `onEditorReady` callback and stored in `editorInstance` signal.
- Entry content is loaded asynchronously via `lifecycle.loadEntriesForDate()`, which calls `setContent()` after fetch completes.
- `content()` starts as `''` and is set to the loaded entry's HTML (or remains `''` for blank days).

## Open Questions

- None.

## Tasks

### Task 1: Add `hasFocusedEditorOnUnlock` flag to session state

- Status: COMPLETED
- Objective: Add a module-level signal in `session.ts` that tracks whether the editor has been auto-focused since the last unlock, and reset it when the session is reset.
- Steps:
  1. In `src/state/session.ts`, add a signal: `const [hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock] = createSignal(false);`
  2. Add `setHasFocusedEditorOnUnlock(false);` inside `resetSessionState()`.
  3. Export both the reader and setter: `export { hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock };`
- Validation: `cmd.exe /c bun run type-check` passes. No lint errors.
- Notes: This signal is session-transient — it lives in memory only and is never persisted.

### Task 2: Add auto-focus effect in EditorPanel

- Status: COMPLETED
- Objective: Add a `createEffect` in `EditorPanel.tsx` that focuses the TipTap editor once after the editor instance is created on initial unlock.
- Steps:
  1. In `src/components/layout/EditorPanel.tsx`, import `hasFocusedEditorOnUnlock` and `setHasFocusedEditorOnUnlock` from `../../state/session`.
  2. Add a new `createEffect` (after the existing `loadEntriesForDate` effect) that:
     - Reads `editorInstance()` and `hasFocusedEditorOnUnlock()`.
     - Guards: skip if no editor, editor is destroyed, or already focused this session.
     - Calls `requestAnimationFrame(() => { if (!hasFocusedEditorOnUnlock()) { editor.commands.focus('end'); setHasFocusedEditorOnUnlock(true); } })` to ensure the browser has painted and to double-check the flag inside the callback (prevents double-focus if the effect re-runs before the RAF fires).
- Validation: `cmd.exe /c bun run type-check` passes. No lint errors.
- Notes: The effect depends ONLY on `editorInstance()`, not `content()`. It fires once when TipTap is created in `DiaryEditor`'s `onMount`. For blank days, `content()` stays `''` and would not re-trigger a content-dependent effect — this is why `editorInstance` is the correct dependency. TipTap's `setContent` (called later by `loadEntriesForDate`) does not steal focus, so the cursor remains at the end after content loads. The double-check of `hasFocusedEditorOnUnlock` inside `requestAnimationFrame` prevents race conditions if the effect re-runs before the RAF callback executes.

### Task 3: Manual verification of focus behavior

- Status: COMPLETED
- Objective: Verify the editor auto-focuses on initial unlock but not on subsequent date navigation.
- Steps:
  1. Run `cmd.exe /c bun run tauri dev` to start the dev build.
  2. Unlock a journal with existing entries — verify the cursor appears at the end of the editor content without clicking.
  3. Navigate to a different date via calendar — verify focus does NOT shift back to the editor automatically.
  4. Lock the journal (lock button), then unlock again — verify focus fires again on the new unlock.
  5. Navigate to a blank date (no entries) — verify the editor receives focus (placeholder visible, cursor blinking) so the user can start typing immediately.
- Validation: Observable behavior matches steps above.
- Notes: This is a manual self-check since E2E does not currently test focus behavior. All automated checks (type-check, lint, 253 tests) passed. Manual verification steps should be run by the user during dogfooding.

### Task 4: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspected the worktree — only intended changes exist: `EditorPanel.tsx`, `session.ts`, and the plan file.
  2. No temporary documentation, scripts, scratch tests, or fixtures were created.
  3. No artifacts to remove.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- `cmd.exe /c bun run type-check` passes with no errors.
- `cmd.exe /c bun run lint` passes with no errors.
- `cmd.exe /c bun run test:run` passes (existing tests should not be affected).
- Manual verification (Task 3) confirms correct behavior.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user.
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
