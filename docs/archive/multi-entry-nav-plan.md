# Multi-Entry Number Navigation Bar

## Metadata

- Plan Status: APPROVED
- Created: 2026-04-30
- Last Updated: 2026-04-30
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace the `← 1 / 3 →` counter in `EntryNavBar` with a `← 1 2 3 →` layout where each number is a clickable button that jumps directly to that entry, the current entry's number is visually highlighted, and the ← / → arrows retain their existing step-by-step behaviour.

## Scope

- `src/components/editor/EntryNavBar.tsx` — new number-button rendering logic + `onGoTo` prop + `For` import
- `src/components/layout/EditorPanel.tsx` — wire `onGoTo` prop to `nav.navigateToEntry`
- `src/components/editor/EntryNavBar.test.tsx` — updated + new test cases for number buttons
- `e2e/specs/multi-entry.spec.ts` — update counter assertions, add a direct-jump scenario
- `e2e/CLAUDE.md` — update `data-testid` inventory table
- `src/i18n/locales/en.ts` + `de.json` + `es.json` + `it.json` — add `goToEntry` aria-label key
- `src/CLAUDE.md` + root `AGENTS.md` — update `data-testid` inventory

## Non-Goals

- Changing the `useMultiEntryNav` hook (already exposes `navigateToEntry(index)`, no changes needed)
- Visual redesign beyond the number bar (colours, font sizes, spacing outside the nav row)
- Keyboard shortcuts for number entry (e.g., pressing "2" to jump) — future enhancement
- Scrollable/paginated number bar for very high entry counts (unlikely in a diary app; cap can be added later)

## Assumptions

- `EntryNavBarProps` gets a new optional `onGoTo: (index: number) => void` callback (or the existing `navigateToEntry` from the hook is re-used via a renamed prop). The parent `EditorPanel` already has `nav.navigateToEntry(index)` — we just need to thread it through.
- Number buttons are `button` elements (accessible, keyboard-focusable, match existing pattern).
- The current entry number uses `font-weight: bold` (or `font-bold` in Tailwind) as its highlight style, matching the TODO description. The `bg-hover` class provides hover feedback, consistent with the existing prev/next buttons.
- The `data-testid="entry-counter"` attribute is **removed** since the counter text `1 / 3` is replaced by numbered buttons. E2E tests that assert on `entry-counter` text will be migrated to assert on the new number buttons instead.
- A new `data-testid="entry-number-button-{n}"` pattern is introduced for E2E selectivity (where `{n}` is 1-based). The currently active button gets `data-testid="entry-number-button-{n}"` plus an `aria-current="true"` attribute.
- `total < 2` continues to hide the entire navigation row (existing `<Show when={total >= 2}>` guard).

## Open Questions

None.

## Tasks

### Task 1: Add `onGoTo` prop to `EntryNavBarProps`

- Status: COMPLETED
- Objective: Thread the direct-jump callback from `EditorPanel` through to `EntryNavBar`.
- Steps:
  1. In `EntryNavBar.tsx`, add `onGoTo?: (index: number) => void` to the `EntryNavBarProps` interface.
  2. In `EditorPanel.tsx`, pass `onGoTo={(idx) => void nav.navigateToEntry(idx)}` to the `<EntryNavBar>` JSX.
- Validation: `cmd.exe /c bun run type-check` passes.
- Notes: If `onGoTo` is not provided, the number buttons still render but are no-ops. Defensive but unlikely — the parent always provides the callback.

### Task 2: Render number buttons in `EntryNavBar`

- Status: COMPLETED
- Objective: Replace the `{index + 1} / {total}` counter span with a row of numbered buttons.
- Steps:
  1. Inside the `<Show when={props.total >= 2}>` block, replace the `<span data-testid="entry-counter">` element with a `<For each={[...Array(props.total).keys()]}>` loop.
  2. For each number `i` (0-based), render a `<button>` with:
     - Text content: `{i + 1}`
     - `data-testid="entry-number-button-{i + 1}"` (1-based for readability)
     - `aria-current={i === props.index ? 'true' : undefined}`
     - `aria-label={t('editor.goToEntry', { number: i + 1 })}` (new i18n key, see Task 4)
     - `onClick={() => props.onGoTo?.(i)}`
     - Class: `px-1.5 py-0.5 rounded hover:bg-hover text-tertiary` (base) + `font-bold text-primary` when `i === props.index`.
  3. Remove the `data-testid="entry-counter"` span entirely.
  4. Keep the existing `<Show when={props.total >= 2}>` guard — number buttons only appear when 2+ entries exist.
- Validation:
  - `cmd.exe /c bun run type-check` passes.
  - Manual visual check: `cmd.exe /c bun run tauri dev` → create 3 entries → verify `← 1 2 3 →` renders with "2" bold when viewing entry 2.
- Notes: The `<For>` component from SolidJS is required (project convention: no `.map()` in JSX).

### Task 3: Update `EntryNavBar` unit tests

- Status: COMPLETED
- Objective: All existing tests pass with the new number-button rendering; new tests cover direct-jump and highlight.
- Steps:
  1. **Remove/update counter tests**: The existing "EntryNavBar counter" describe block asserts on text like `"1 / 2"`. Replace these with assertions that the correct number button is highlighted:
     - Query `[data-testid="entry-number-button-1"]` through `[data-testid="entry-number-button-N"]`.
     - Assert that the button matching `index + 1` has `aria-current="true"`.
     - Assert that other buttons do not have `aria-current`.
  2. **Add direct-jump test**: Render with `total=3, index=0`, click `[data-testid="entry-number-button-3"]`, assert `onGoTo` was called with `2` (0-based).
  3. **Add highlight test**: Render with `total=3, index=1`, assert button "2" has `font-bold` class and `aria-current="true"`, assert buttons "1" and "3" do not.
  4. **Update arrow tests**: Arrow buttons still exist and work — these tests need no logic changes but verify they still render alongside the number buttons.
  5. **Update delete/add tests**: These test the right-side buttons which are unchanged — verify they still pass.
  6. **Add "no number buttons below 2 entries" test**: Assert `[data-testid="entry-number-button-1"]` does not exist when `total=0` or `total=1`.
- Validation: `cmd.exe /c bun run test:run -- --reporter=verbose src/components/editor/EntryNavBar.test.tsx` — all tests green.
- Notes: The `onGoTo` callback in tests uses `vi.fn()` for call verification. Pass it as `onGoTo` prop.

### Task 4: Add `goToEntry` i18n key to all locale files

- Status: COMPLETED
- Objective: Screen readers announce each number button purpose; `validate:locales` stays green.
- Steps:
  1. In `src/i18n/locales/en.ts`, under the `editor` section (near `prevEntry`/`nextEntry`), add:
     ```
     goToEntry: 'Go to entry {{ number }}',
     ```
  2. In each JSON locale file (`de.json`, `es.json`, `it.json`), add the same key under the `editor` object with an English placeholder value (translators will update later):
     - `de.json`: `"goToEntry": "Gehe zu Eintrag {{ number }}"`
     - `es.json`: `"goToEntry": "Ir a la entrada {{ number }}"`
     - `it.json`: `"goToEntry": "Vai alla voce {{ number }}"`
- Validation: `cmd.exe /c bun run validate:locales` passes with zero errors.
- Notes: The `validate:locales` script exits 1 if any JSON locale is missing keys present in `en.ts`, so all four files must be updated together. Machine-translated placeholders are acceptable — translators will refine them.

### Task 5: Update `multi-entry.spec.ts` E2E tests

- Status: COMPLETED
- Objective: E2E suite passes with the new number-button rendering; a direct-jump scenario is added.
- Steps:
  1. **Update `waitForCounter` helper**: The current helper waits for `entry-counter` text matching `/\/ 2$/`. Replace it with a helper that waits for `[data-testid="entry-number-button-2"]` to exist and be visible. Rename to `waitForEntryButtons` or similar.
  2. **Update Scenario A assertions**: After lock/unlock, verify entry 2 is current by checking `[data-testid="entry-number-button-2"][aria-current='true']` exists.
  3. **Update Scenario B assertions**: Same pattern — verify counter shows 2 entries via the number buttons.
  4. **Update Scenario C assertions**: Same pattern.
  5. **Add Scenario D (direct jump)**: After Scenario B creates 2 entries on `MULTI_DATE_2`, add a third entry, then click `[data-testid="entry-number-button-1"]` and verify the editor shows entry 1's content. This validates the direct-jump path end-to-end.
- Validation: `cmd.exe /c bun run test:e2e` passes (requires built Tauri binary and tauri-driver).
- Notes: Scenario D is optional but strongly recommended since it's the primary new behaviour. If it makes the spec too long, it can be a separate `multi-entry-nav.spec.ts` file — but co-locating is simpler.

### Task 6: Update documentation — `data-testid` inventory

- Status: COMPLETED
- Objective: All documentation reflects the new test IDs.
- Steps:
  1. In `src/CLAUDE.md`, find the `EntryNavBar.tsx` rows in the `data-testid` table.
  2. Replace `EntryNavBar.tsx | Entry position counter | entry-counter` with `EntryNavBar.tsx | Entry number button N (1-based) | entry-number-button-{N}`.
  3. Add a note that the active entry has `aria-current="true"`.
  4. In the root `AGENTS.md`, update the `data-testid` list in the "Key `data-testid` attributes used by E2E" section: replace `entry-counter` with `entry-number-button-{N}`.
  5. In `e2e/CLAUDE.md`, update the `data-testid` table: replace `EntryNavBar.tsx | Entry position counter | entry-counter` with `EntryNavBar.tsx | Entry number button N (1-based) | entry-number-button-{N}`.
- Validation: Read the updated sections in all three files and confirm they match the rendered HTML.
- Notes: Three files maintain test ID inventories: `src/CLAUDE.md`, root `AGENTS.md`, and `e2e/CLAUDE.md`. All three must be updated.

### Task 7: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

```bash
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run format:check
cmd.exe /c bun run test:run
cmd.exe /c bun run validate:locales
```

All five commands must pass with zero errors.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` exists).
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
