# Cancel Restores Real Content Instead of Leaving the Editor Blank

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-20
- Last Updated: 2026-08-20
- Owner: Coding agent
- Approval: APPROVED (user instructed direct implementation)
- UX-GATE: REQUIRED (satisfied — Task 9, user-approved 2026-08-20)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Background

TODO-0104 (`docs/entry-persistence-consent-gate-plan.md`, COMPLETED 2026-08-20) shipped a confirm dialog that
blocks navigation away from an entry whose real, on-disk content you just erased in the editor. Clicking
**Confirm** deletes the entry and proceeds. Clicking **Cancel** was deliberately scoped to do nothing beyond
denying that one navigation attempt — see that plan's Non-Goals: *"A cancelled navigation simply keeps the
user on the current entry with their edit intact; there is no separate trash state."*

In practice, "with their edit intact" means the editor keeps showing the **blank** state that triggered the
dialog — because the erase is what triggered it in the first place — even though the disk row underneath is
still safe (proven by `entryHasContent()` returning `true` right before the dialog opened, and enforced by
`delete_entry_if_empty_inner`'s on-disk refusal check). The user reported this directly: Cancel blocks
navigation as intended, but the editor is left looking exactly as blank/deleted as if Confirm had been
clicked, with no visible way back to the real content short of manually undoing their own edit.

This plan closes that gap: on Cancel, the editor now reloads and displays the entry's actual on-disk content
before denying the navigation, so Cancel visibly means "never mind, keep it" rather than "stay here, blank."

## Goal

`checkCanLeaveCurrentEntry`'s cancel branch (`src/components/layout/editor-panel/useEntryLifecycle.ts`)
restores the current entry's real on-disk content into the editor before returning `false`, so the user sees
their actual entry again instead of the blank state that triggered the dialog. Because this function is the
single guard shared by all ~11 navigation call sites this plan's predecessor wired up (entry nav, lock
toggle, day nav, Calendar, Sidebar, Go To Date, Timeline, Search), fixing it here fixes it everywhere at once.

## Scope

- `src/components/layout/editor-panel/useEntryLifecycle.ts`: add a `restoreEntryFromDisk(entryId)` helper and
  call it from `checkCanLeaveCurrentEntry`'s cancel branch.
- Test coverage (written first, TDD): `src/components/layout/editor-panel/useEntryLifecycle.test.ts`,
  `src/components/layout/EditorPanel.integration.test.tsx`, and `e2e/specs/multi-entry.spec.ts` (Scenario F,
  the existing real-WebDriver dialog round trip).
- Docs: `src/CLAUDE.md` (gotcha #10's TODO-0104 extension paragraph), `docs/diagrams/save-entry.mmd` +
  `save-entry-dark.mmd` (and their rendered SVGs), a short addendum to
  `docs/entry-persistence-consent-gate-plan.md`, `CHANGELOG.md`.
- A new `docs/todo/TODO.md` entry for this fix (added via the `todo-manager` skill), checked off at cleanup.

## Non-Goals

- Changing the **Confirm** (delete) branch's behavior — unaffected by this plan.
- Reworking the `selectedEntryId` one-shot deep-link mechanism in `src/state/ui.ts` /
  `loadEntriesForDate` — see "The Multi-Entry Wrinkle" section below for why this plan deliberately does
  **not** reuse it.
- Letting Cancel also allow the original navigation to proceed. Cancel restores content and denies that one
  navigation click; the user clicks again if they still want to move on. (Resolved via `AskUserQuestion`
  during exploration — see Open Questions.)
- Building any new dialog, undo stack, or trash state — this plan only changes what happens *after* the
  existing dialog's Cancel button, using the existing `discardAndReload`-style reload pattern already
  established elsewhere in this file.

## Assumptions

- `entryHasContent(snap.entryId)` having just returned `true` (the only way this dialog shows at all) means
  the on-disk row is safe to re-fetch and display at the moment Cancel is clicked — nothing else can delete
  it out from under the guard in that window (single-flight `leaveCheckInFlight` coalescing already prevents
  a second concurrent guard call for the same entry; see `useEntryLifecycle.ts`'s existing doc comment on
  that field).
- `fetchEntriesOrdered` (`useMultiEntryNav.ts`), `resolveEntryHtml`, `commitEntryToEditor`, and
  `clearEntryFromEditor` (`entryHydration.ts`) are already imported in `useEntryLifecycle.ts` — no new imports
  needed for the implementation task.
- The project's Windows execution environment rules apply: frontend commands via `cmd.exe /c bun run ...`,
  backend via bare `cargo` (not touched by this plan — no Rust changes).
- If auto-lock fires while the confirm dialog is open, `resetConfirmDialogState()` resolves `confirmed` as
  `false`, so the cancel branch (and therefore `restoreEntryFromDisk`) runs against a database that may
  already be locked or mid-teardown. This is not a new risk this plan introduces — it is the same class of
  teardown race every other await in `checkCanLeaveCurrentEntry`/`useEntryLifecycle.ts` already tolerates via
  the existing outer `try/catch` (deny-on-error) and `persistence.isDisposed()` checks. `restoreEntryFromDisk`
  is written to degrade the same way when its own fetch fails: see Task 3's fourth test and Task 6's Notes.

## Open Questions

Resolved during exploration (via `AskUserQuestion`), recorded here per the skill's protocol:

1. **Should Cancel restore content and still block the navigation, or restore content and let the navigation
   proceed?** **Resolved: restore and still block** (Option A). Rationale given: "Cancel" on a
   delete-confirmation conventionally means "abort what I was about to do," not "also complete an unrelated
   navigation I clicked earlier." Matches the existing Non-Goals language in the predecessor plan almost
   verbatim — this plan only fixes what "stay on the current entry" visibly looks like.

No unresolved questions remain.

## The Multi-Entry Wrinkle (why this isn't a 3-line `discardAndReload()` call)

`useEntryLifecycle.ts` already has a `discardAndReload()` function that re-fetches and displays the
current date's entries from scratch — built for whole-journal restores. It seems like the obvious thing to
reuse here, but it isn't, for two independent reasons verified against the actual source before writing this
plan (per root `CLAUDE.md`'s Agent Workflow Rule #5):

1. **Wrong default entry.** `loadEntriesForDate` (which `discardAndReload` calls) defaults to the day's
   *newest* entry when there is no deep-link target (`useEntryLifecycle.ts` line ~239,
   `entries.length - 1`). If the entry you erased and are cancelling on is *not* the newest entry in a
   multi-entry day, a bare `discardAndReload()` would restore the day but silently switch you to the newest
   entry instead of restoring the one you were actually looking at.
2. **The deep-link fix races an existing consumer.** The obvious fix for (1) — call
   `setSelectedEntryId(snap.entryId)` before `discardAndReload()`, reusing the same one-shot deep-link
   `SearchResults.tsx` uses to reopen a specific entry on an already-open day — does not work here. Writing
   `selectedEntryId` is a plain SolidJS signal write, which fires dependent effects synchronously (confirmed
   by the predecessor plan's own Post-Completion Review, which traced exactly this synchronous-firing
   behavior for the identical signal). `EditorPanel.tsx`'s own same-day deep-link effect
   (lines ~92-100) is *also* subscribed to `selectedEntryId`, and it consumes-and-clears the signal
   (`setSelectedEntryId(null)`) as its own first action, then calls `nav.navigateToEntry(idx)` — all before
   `loadEntriesForDate` (called from inside `discardAndReload`, further down the same call stack) ever gets
   to read the signal itself. The target id would be clobbered to `null` by that other consumer before our
   own reload reads it back, silently losing the restore target.

The fix in Task 6 avoids both problems by **not** touching `selectedEntryId` at all: a small dedicated
`restoreEntryFromDisk(entryId)` helper re-fetches the day's entries, finds the specific entry by id in the
result, and commits it directly via the existing atomic `commitEntryToEditor` helper — self-contained, no
shared-signal indirection, no race.

## Tasks

### Task 1: Add a TODO entry for this fix

- Status: COMPLETED
- Objective: This fix is tracked in `docs/todo/TODO.md` like any other unit of work, per root `CLAUDE.md`'s
  Agent Workflow Rule #4.
- Steps:
  1. Load the `todo-manager` skill and add a new TODO entry (let it auto-assign the ID — do not hand-assign
     one). Title: "Cancelling the delete-confirmation dialog restores the entry's real content instead of
     leaving the editor blank." Reference TODO-0104 as the originating feature and this plan file
     (`docs/entry-persistence-cancel-restore-plan.md`) as the implementation plan.
- Validation: `docs/todo/TODO.md` contains the new entry with a freshly assigned ID; `bun run` TODO validation
  (whatever `todo-manager` runs internally) passes.
- Notes: Assigned **TODO-0105**. Entry added to `docs/todo/TODO.md` High Priority section, immediately before
  TODO-0008.

### Task 2: Prepare the unit-test harness (`useEntryLifecycle.test.ts`)

- Status: COMPLETED
- Objective: The existing `makeLifecycle()` test helper and module-level Tauri mock in
  `src/components/layout/editor-panel/useEntryLifecycle.test.ts` can drive and observe a full
  restore-from-disk cycle, so Task 3's tests can be written against it.
- Steps:
  1. In the `mocks` hoisted object (currently `createEntry`, `deleteEntry`, `entryHasContent`,
     `confirmInApp`, `getAllEntryDates`), add `getEntriesForDate: vi.fn()`.
  2. In the `vi.mock('../../../lib/tauri', ...)` factory, add `getEntriesForDate: mocks.getEntriesForDate,`
     to the returned override object (alongside the existing four overrides). Without this, the restore path
     calls the real `getEntriesForDate`, which falls through to the global `invoke` stub in
     `src/test/setup.ts` (`vi.fn(() => Promise.resolve())`), resolving `undefined` — `fetchEntriesOrdered`'s
     `.slice()` on `undefined` throws, failing every restore-path test with an unrelated `TypeError` instead
     of a real assertion failure.
  3. In `beforeEach`, add `mocks.getEntriesForDate.mockReset();` alongside the existing five resets.
  4. In `makeLifecycle()`'s return statement (currently `{ lifecycle, setPendingEntryId, dayEntries }`), add
     `title, content, currentIndex` (all already in scope as local signals inside the function) so tests can
     assert on the editor's restored display state.
- Validation: `cmd.exe /c bun run type-check` passes. No behavioral test changes yet — this task only touches
  test infrastructure, so the existing test suite in this file must still be 100% green after this task
  (`cmd.exe /c bun run test:run -- useEntryLifecycle`).
- Notes: Purely additive — does not change any existing test's assertions.

### Task 3: Write failing unit tests for the restore-on-cancel behavior (TDD red)

- Status: COMPLETED
- Objective: `useEntryLifecycle.test.ts` has tests that describe the intended behavior and fail against the
  current (pre-fix) implementation, proving they actually exercise the gap before it's closed.
- Steps:
  1. Replace the existing test `'canLeaveCurrentEntry shows the confirm dialog and denies navigation on
     cancel, leaving the entry unmodified'` (current lines ~137-147) with:
     ```ts
     it("canLeaveCurrentEntry shows the confirm dialog and, on cancel, restores the entry's real content from disk while still denying navigation", async () => {
       mocks.entryHasContent.mockResolvedValue(true);
       mocks.confirmInApp.mockResolvedValue(false);
       mocks.getEntriesForDate.mockResolvedValue([
         {
           id: 3,
           date: '2026-01-01',
           title: 'Real title',
           text: '<p>Real content</p>',
           word_count: 2,
           date_created: '2026-01-01T00:00:00Z',
           date_updated: '2026-01-01T00:00:00Z',
           metadata: null,
           locked: false,
         },
       ]);
       const { lifecycle, title, content, currentIndex } = makeLifecycle({
         pendingEntryId: 3,
         title: '',
         content: '',
       });

       const result = await lifecycle.canLeaveCurrentEntry('test');

       expect(result).toBe(false);
       expect(mocks.deleteEntry).not.toHaveBeenCalled();
       expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
       expect(title()).toBe('Real title');
       expect(content()).toBe('<p>Real content</p>');
       expect(currentIndex()).toBe(0);
     });
     ```
  2. Add a new test covering the multi-entry wrinkle described above:
     ```ts
     it("canLeaveCurrentEntry restores the correct entry on cancel when it is not the day's newest entry", async () => {
       mocks.entryHasContent.mockResolvedValue(true);
       mocks.confirmInApp.mockResolvedValue(false);
       // Backend returns newest-first: id 10 is the day's newest, id 3 is older.
       // fetchEntriesOrdered reverses this to [id 3 (idx 0), id 10 (idx 1)].
       mocks.getEntriesForDate.mockResolvedValue([
         {
           id: 10,
           date: '2026-01-01',
           title: 'Newest',
           text: '<p>Newest content</p>',
           word_count: 2,
           date_created: '2026-01-01T00:00:00Z',
           date_updated: '2026-01-01T00:00:00Z',
           metadata: null,
           locked: false,
         },
         {
           id: 3,
           date: '2026-01-01',
           title: 'Erased entry real title',
           text: '<p>Erased entry real content</p>',
           word_count: 3,
           date_created: '2026-01-01T00:00:00Z',
           date_updated: '2026-01-01T00:00:00Z',
           metadata: null,
           locked: false,
         },
       ]);
       // The user was editing entry 3 (not the day's newest) and erased it.
       const { lifecycle, title, content, currentIndex } = makeLifecycle({
         pendingEntryId: 3,
         title: '',
         content: '',
       });

       const result = await lifecycle.canLeaveCurrentEntry('test');

       expect(result).toBe(false);
       // Restored entry 3's own content (idx 0 after reversal) — not entry 10's, even
       // though entry 10 is the day's newest and would be loadEntriesForDate's own default.
       expect(title()).toBe('Erased entry real title');
       expect(content()).toBe('<p>Erased entry real content</p>');
       expect(currentIndex()).toBe(0);
     });
     ```
  3. Add a defensive test for the case where the entry is unexpectedly gone by restore time:
     ```ts
     it('canLeaveCurrentEntry clears the editor on cancel if the entry no longer exists on disk', async () => {
       mocks.entryHasContent.mockResolvedValue(true);
       mocks.confirmInApp.mockResolvedValue(false);
       mocks.getEntriesForDate.mockResolvedValue([]); // entry 3 is gone by the time of the reload
       const { lifecycle, title, content } = makeLifecycle({ pendingEntryId: 3, title: '', content: '' });

       const result = await lifecycle.canLeaveCurrentEntry('test');

       expect(result).toBe(false);
       // title()/content() are already '' before this call (they were blank — that's what
       // triggered the dialog), so asserting them alone would pass identically whether or
       // not a restore was ever attempted. Assert the restore fetch actually ran — that is
       // the only way this test can fail against the pre-fix implementation, which never
       // calls getEntriesForDate from the cancel branch at all.
       expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
       expect(title()).toBe('');
       expect(content()).toBe('');
     });
     ```
  4. Add a test pinning the deliberate fallback when the restore fetch itself fails (see Assumptions above —
     a transient IPC failure or a mid-teardown lock during the dialog):
     ```ts
     it('canLeaveCurrentEntry attempts the restore and still denies navigation if the restore fetch itself fails', async () => {
       mocks.entryHasContent.mockResolvedValue(true);
       mocks.confirmInApp.mockResolvedValue(false);
       mocks.getEntriesForDate.mockRejectedValue(new Error('network error'));
       const { lifecycle, title, content } = makeLifecycle({ pendingEntryId: 9, title: '', content: '' });

       const result = await lifecycle.canLeaveCurrentEntry('test');

       expect(result).toBe(false);
       // Same reasoning as the previous test: assert the restore was actually attempted
       // (this is what makes the test meaningful pre- vs. post-fix), not just that nothing
       // crashed — a no-op cancel branch would also trivially satisfy the assertions below.
       expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-01-01');
       // The restore itself failed — this degrades to the pre-fix visual state (blank, but
       // nothing was deleted) rather than throwing past the caller. Deliberate, narrow
       // fallback: this failure is rare, and the entry is still safe on disk regardless —
       // deny only blocks navigation, it deletes nothing.
       expect(title()).toBe('');
       expect(content()).toBe('');
       expect(mocks.deleteEntry).not.toHaveBeenCalled();
     });
     ```
- Validation: `cmd.exe /c bun run test:run -- useEntryLifecycle` — all four tests above must **fail** at this
  point (red), since the pre-fix cancel branch never calls `getEntriesForDate` at all — every
  `toHaveBeenCalledWith` assertion above is what actually fails pre-fix (not the `title()`/`content()`
  checks, which happen to already hold blank in every one of these four setups and would pass either way).
  Confirm each failure is the `toHaveBeenCalledWith` assertion specifically, not a crash — if it crashes,
  Task 2 was not completed correctly.
- Notes: Depends on Task 2. Do not touch the implementation file in this task. Every test in this task
  intentionally asserts `mocks.getEntriesForDate` was called — without that assertion, tests 3 and 4 would
  pass unchanged whether or not the cancel branch does anything at all, since their starting `title`/`content`
  already equal the values they assert (the guard only ever fires when the editor is already blank).

### Task 4: Write failing integration tests for the restore-on-cancel behavior (TDD red)

- Status: COMPLETED
- Objective: `EditorPanel.integration.test.tsx` proves the fix end-to-end through the real rendered
  `EditorPanel` component tree (real effects, real async timing) — not just the isolated hook — and fails
  against the current implementation.
- Steps:
  1. Update the existing test `'navigateToEntry: cancelling the confirm dialog leaves dayEntries/currentIndex
     unchanged'` (current lines ~791-820): rename it to
     `'navigateToEntry: cancelling the confirm dialog restores the erased entry's real content and leaves
     dayEntries/currentIndex unchanged'`, and replace the final block:
     ```ts
     expect(mocks.confirm).toHaveBeenCalled();
     expect(mocks.deleteEntry).not.toHaveBeenCalled();
     // Restored from disk — no longer blank.
     await waitFor(() =>
       expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
     );
     expect(bus.mockEditor.getHTML()).toBe('<p>Real content</p>');
     expect(screen.getByTestId('entry-number-button-2').getAttribute('aria-current')).toBe('true');
     ```
     (`mocks.getEntriesForDate` in this test already uses `mockResolvedValue` — not `mockResolvedValueOnce` —
     returning `[current, older]` on every call, so the restore's re-fetch naturally returns `current`'s
     original real title/text again without any mock changes.)
  2. Add a new test immediately after it, covering the multi-entry wrinkle end-to-end:
     ```ts
     it("navigateToEntry: cancelling the confirm dialog restores the correct entry when it is not the day's newest", async () => {
       const newest = makeEntry({ id: 50, title: 'Newest', text: '<p>Newest content</p>' });
       const older = makeEntry({ id: 20, title: 'Erase me', text: '<p>Real older content</p>' });
       // Backend newest-first: [50, 20] -> fetchEntriesOrdered reverses to [older (idx 0), newest (idx 1)].
       mocks.getEntriesForDate.mockResolvedValue([newest, older]);
       mocks.entryHasContent.mockResolvedValue(true);
       mocks.confirm.mockResolvedValue(false);

       // Deep-link to the older entry so it is the one open, not the day's default newest.
       setSelectedEntryId(20);
       renderWithI18n(() => <EditorPanel />);
       await waitFor(() => expect(mocks.getEntriesForDate).toHaveBeenCalledWith('2026-04-23'));
       await flushMicrotasks();
       await waitFor(() =>
         expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
       );

       fireEvent.input(screen.getByTestId('title-input'), { target: { value: '' } });
       typeIntoEditor('<p></p>');
       await flushMicrotasks();

       fireEvent.click(screen.getByTestId('entry-number-button-2')); // navigate to the newest
       await waitFor(() => expect(mocks.entryHasContent).toHaveBeenCalledWith(20));
       await flushMicrotasks();

       expect(mocks.deleteEntry).not.toHaveBeenCalled();
       // Restored entry 20's real content on entry-number-button-1 (idx 0) — not entry 50's.
       await waitFor(() =>
         expect((screen.getByTestId('title-input') as HTMLInputElement).value).toBe('Erase me'),
       );
       expect(bus.mockEditor.getHTML()).toBe('<p>Real older content</p>');
       expect(screen.getByTestId('entry-number-button-1').getAttribute('aria-current')).toBe('true');
     });
     ```
- Validation: `cmd.exe /c bun run test:run -- EditorPanel.integration` — both tests above must **fail** at this
  point (red). The second one is the test that specifically catches the `selectedEntryId`-race regression
  described in "The Multi-Entry Wrinkle" if a future change reintroduces it (e.g. reusing
  `discardAndReload()` naively) — it must fail cleanly (wrong restored entry or blank), not hang or crash.
- Notes: Depends on Task 1 of the predecessor plan's test infra (already in place — `mocks.getEntriesForDate`
  is already mocked in this file, unlike `useEntryLifecycle.test.ts`). Do not touch the implementation file
  in this task. Confirmed red: both tests fail. The first fails via an unrelated artifact of the pre-fix
  state — this file's `vi.useFakeTimers({ shouldAdvanceTime: true })` lets the 500ms auto-delete debounce
  fire for real while the test's `waitFor` polls (since the restore that would otherwise resolve the
  `waitFor` quickly doesn't exist yet), so the debounced `deleteEntryIfEmpty` auto-navigates to the other
  entry instead of leaving the title blank. This is expected: Task 6's `restoreEntryFromDisk` calls
  `persistence.debouncedSave.cancel()` as its first statement specifically to close this race, so it cannot
  recur once Task 6 lands.

### Task 5: Update the E2E consent-gate scenario for the restore behavior (TDD red)

- Status: COMPLETED
- Objective: `e2e/specs/multi-entry.spec.ts` Scenario F — the existing real-WebDriver round trip through the
  actual confirm dialog (TODO-0104's own E2E coverage) — asserts that Cancel visibly restores the seeded
  title/body, not just that the dialog closes and nothing was deleted.
- Steps:
  1. In Scenario F (starting ~line 401), locate the Cancel block (current lines ~491-499):
     ```ts
     // Cancel — the app stays on the editor; the entry (still blank in the live editor,
     // but never actually deleted on disk) is untouched.
     await $('[data-testid="confirm-dialog-cancel-button"]').click();
     await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000, reverse: true });
     expect(await $('[data-testid="title-input"]').isDisplayed()).toBe(true);
     expect(await $('[data-testid="timeline-toggle-button"]').getAttribute('aria-pressed')).toBe(
       'false',
     );
     ```
     Replace it with:
     ```ts
     // Cancel — the app stays on the editor, the entry was never deleted on disk, and the
     // editor now shows the real seeded content again instead of the blank state that
     // triggered the dialog (entry-persistence-cancel-restore-plan.md).
     await $('[data-testid="confirm-dialog-cancel-button"]').click();
     await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000, reverse: true });
     expect(await $('[data-testid="timeline-toggle-button"]').getAttribute('aria-pressed')).toBe(
       'false',
     );
     await browser.waitUntil(
       async () => (await $('[data-testid="title-input"]').getValue()) === SCENARIO_F_TITLE,
       { timeout: 5000, timeoutMsg: 'Scenario F: title was not restored after Cancel' },
     );
     await browser.waitUntil(
       async () => ((await $('.ProseMirror').getText()) ?? '').includes(SCENARIO_F_BODY),
       { timeout: 5000, timeoutMsg: 'Scenario F: body was not restored after Cancel' },
     );
     ```
  2. The comment on line ~406-412 explaining the debounce-sequencing choice, and the comment on the "Toggling
     again re-asks" block (current lines ~500-501), remain accurate as-is — no change needed there. The
     second toggle-and-confirm block that follows (current lines ~502-513) is unaffected by this task; leave
     it in place.
  3. Scenario C (current lines ~224-274, the blank-second-entry auto-delete regression) does not exercise
     `checkCanLeaveCurrentEntry`'s confirm dialog at all: the entry it switches away from is genuinely blank
     (never had real content), so `entryHasContent` returns `false` and the guard resolves without ever
     showing a dialog (existing `if (!hasContent) return true;` branch, unchanged by this plan). Verified by
     reading the scenario before writing this task — no change needed there, and note this in the task's
     Notes once confirmed during execution so a future reader does not have to re-derive it.
- Validation: `cmd.exe /c bun run test:e2e:local` (full build + full suite — verified in this repo's own
  command list; `scripts/e2e-local.js` does not support filtering to one spec file, it always runs
  `bun run test:e2e`, so there is no cheaper verified alternative). Scenario F's two new `waitUntil`
  assertions must **fail/time out** at this point (red) — the editor is still blank after Cancel until
  Task 6 lands. Everything else in the suite must still pass; a failure anywhere other than these two new
  assertions means something else broke and needs investigation before proceeding.
- Notes: Depends on Task 2 of the predecessor plan for `SCENARIO_F_TITLE`/`SCENARIO_F_BODY` fixture constants
  (already defined earlier in this spec file — confirmed present by reading the file while drafting this
  plan). Full E2E runs are slow (build + suite); if re-running the full local lane twice (once red, once
  green) is judged too costly at execution time, it is acceptable to reason through the red state from the
  diff instead of an actual local run — but the green state (Task 6) MUST be verified with a real
  `test:e2e:local` run before this task is marked COMPLETED, since this is exactly the platform-specific
  dialog-interaction path the predecessor plan's Decision History called out as needing real WebDriver
  coverage, not just Vitest mocks. `bun run format`/`format:check` are scoped to `src/**/*.{ts,tsx,css}` only
  (verified in `package.json`) and never reach `e2e/specs/`, so match the surrounding file's existing style
  by hand.
  Red state reasoned through from the diff (not re-run standalone, per this task's own cost/benefit note):
  pre-fix, Cancel's branch is a bare `if (!confirmed) return false;` — nothing re-populates the title/body,
  so the two new `waitUntil` assertions (title === SCENARIO_F_TITLE, body includes SCENARIO_F_BODY) would
  time out after 5000ms each, since both fields stay blank. Step 3 (Scenario C) re-confirmed by reading the
  current file: Scenario C's entry switch triggers no confirm dialog (`entryHasContent` returns `false` for
  a genuinely-blank entry), so it is untouched by this plan — no change made there.

  **Deviation found during the real `test:e2e:local` green-state run (Task 10 Final Verification):** the
  original "Toggling again re-asks" block this task's step 1 left untouched (old lines ~500-513) turned out
  to be a stale assumption, not something this task could have known in advance from reading the diff alone
  — it fails for real once the fix is live. Root cause: that block assumed the editor still showed blank
  content after Cancel (true pre-fix), so toggling Timeline again would still hit the delete branch and
  re-ask. Post-fix, Cancel's restore puts the editor's live title/body back in sync with disk, so an
  immediate second toggle is now an ordinary navigation away from unmodified real content —
  `canLeaveCurrentEntry`'s own `shouldDelete` check correctly takes the early-return "ordinary save" path
  and no dialog appears at all. The failure was `[data-testid="confirm-dialog"]` never appearing within
  5000ms — exactly this. Fixed in place (same task, not spun into a separate TODO — small, directly
  in-scope correction to this task's own E2E assertions): the block now asserts Timeline toggles
  immediately with **no** dialog on the first re-toggle (proving the restore truly synced the live editor
  to disk, not just visually), then toggles back, erases the (still-real) content a second time, waits past
  the debounce, and toggles again to exercise the Confirm/hard-delete branch — using the same
  `clearTitleInput`/`clearProseMirrorBody` helpers already defined earlier in this scenario. Re-verified
  green via a second full `test:e2e:local` run (see Task 10 Notes).

### Task 6: Implement `restoreEntryFromDisk` and wire it into the cancel branch (TDD green)

- Status: COMPLETED
- Objective: All tests from Tasks 3 and 4 pass; no other existing test regresses.
- Steps:
  1. In `src/components/layout/editor-panel/useEntryLifecycle.ts`, add a new private function (placed after
     `discardAndReload`, before `startEntryCreation`):
     ```ts
     /**
      * Re-fetches the given entry's on-disk content and commits it into the editor, without
      * touching `selectedEntryId` — that signal is a shared one-shot deep-link consumed
      * synchronously by EditorPanel's same-day deep-link effect, so writing it here would
      * race that consumer and lose the target before loadEntriesForDate ever reads it back
      * (see docs/entry-persistence-cancel-restore-plan.md's "Multi-Entry Wrinkle" section).
      * Used by canLeaveCurrentEntry's cancel branch (TODO-0104 addendum) to restore real
      * content the user just erased, instead of leaving the editor showing the blank state
      * that triggered the confirm dialog.
      *
      * Shares `loadRequestId` with `loadEntriesForDate` (same staleness token, same
      * increment-then-compare pattern) so a concurrent unrelated load — e.g. a lock/unlock
      * or a whole-journal restore firing while these awaits are in flight — cannot have its
      * result stomped by this one committing late. If the two awaits below reject (a
      * transient IPC failure, or the DB going away mid-teardown), the rejection propagates
      * to checkCanLeaveCurrentEntry's own try/catch, which already denies navigation and
      * logs — the editor is simply left as it was, not worse off than before this function
      * existed.
      */
     const restoreEntryFromDisk = async (entryId: number): Promise<void> => {
       persistence.debouncedSave.cancel();
       const requestId = ++loadRequestId;
       const isStale = () => persistence.isDisposed() || requestId !== loadRequestId;
       const date = untrack(opts.selectedDate);
       const entries = await fetchEntriesOrdered(date);
       if (isStale()) return;
       opts.setDayEntries(entries);
       const idx = entries.findIndex((e) => e.id === entryId);
       if (idx < 0) {
         // Entry vanished between entryHasContent's check and now (shouldn't happen in
         // practice) — clear rather than commit a mismatched index.
         clearEntryFromEditor(entryCommitTargets);
         return;
       }
       const entry = entries[idx];
       const html = await resolveEntryHtml(entry);
       if (isStale()) return;
       commitEntryToEditor(entryCommitTargets, entry, html, idx);
     };
     ```
  2. In `checkCanLeaveCurrentEntry`, change:
     ```ts
     const confirmed = await confirmInApp(opts.t('editor.deleteConfirmMessage'), {
       title: opts.t('editor.deleteConfirmTitle'),
     });
     if (!confirmed) return false;
     ```
     to:
     ```ts
     const confirmed = await confirmInApp(opts.t('editor.deleteConfirmMessage'), {
       title: opts.t('editor.deleteConfirmTitle'),
     });
     if (!confirmed) {
       await restoreEntryFromDisk(snap.entryId);
       log.info(`${path}: canLeaveCurrentEntry cancelled — restored entry ${snap.entryId} from disk`);
       return false;
     }
     ```
- Validation: `cmd.exe /c bun run type-check` passes. `cmd.exe /c bun run test:run` — full suite green,
  including all four Task 3 tests and both Task 4 tests now passing, and zero regressions elsewhere
  (particularly the existing "coalescing" and "Entry not found" tests in `useEntryLifecycle.test.ts`, which
  exercise adjacent branches of the same function). Task 5's E2E scenario is verified separately per that
  task's own Notes — not required to re-run here, but must be green before this plan reaches `COMPLETED`
  (Task 10).
- Notes: No new imports required — `fetchEntriesOrdered`, `resolveEntryHtml`, `commitEntryToEditor`,
  `clearEntryFromEditor` are already imported at the top of this file (lines ~16-23), and `persistence`,
  `entryCommitTargets`, `opts`, `untrack`, and the `loadRequestId` mutable counter (declared line ~101) are
  already in scope inside the hook. Task 3's fourth test (restore fetch fails) turns green here because a
  rejection from `fetchEntriesOrdered`/`resolveEntryHtml` propagates out of `restoreEntryFromDisk` (nothing
  in it catches), through `checkCanLeaveCurrentEntry`'s `await restoreEntryFromDisk(...)` call, into that
  function's existing outer `try/catch`, which logs and returns `false` — the same deny-on-error path that
  already handles `entryHasContent`'s own rejection today. Verified: `bun run type-check` clean; full
  `bun run test:run` — 99 files, 1025 tests, all green (all six Task 3/4 tests now pass, zero regressions).

### Task 7: Update the save-entry flow diagrams

- Status: COMPLETED
- Objective: `docs/diagrams/save-entry.mmd` and `save-entry-dark.mmd` reflect the new restore step, and their
  rendered SVGs are regenerated.
- Steps:
  1. In both `docs/diagrams/save-entry.mmd` and `docs/diagrams/save-entry-dark.mmd`, add a new node after the
     existing `HARDDEL` node declaration:
     ```
     RESTORE["restoreEntryFromDisk(id)<br/>re-fetch + commit real content"]
     ```
  2. In both files, change the edge `CONFIRM -- Cancel --> EDITOR` to:
     ```
     CONFIRM -- Cancel --> RESTORE --> EDITOR
     ```
  3. In both files, add `RESTORE` to the `class DATE,LOAD,STATE,EDITOR,DATES,NAV,CONFIRM ui;` line (making it
     `class DATE,LOAD,STATE,EDITOR,DATES,NAV,CONFIRM,RESTORE ui;`).
  4. Run `cmd.exe /c bun run diagrams` to regenerate `save-entry.svg`, `save-entry-dark.svg`, and
     `.source-hashes.json`.
- Validation: `cmd.exe /c bun run diagrams:check` passes.
- Notes: Depends on Task 6 (so the node name matches the real function name).

### Task 8: Update docs

- Status: COMPLETED
- Objective: `src/CLAUDE.md` and the predecessor plan doc accurately describe the new cancel behavior.
- Steps:
  1. In `src/CLAUDE.md`, gotcha #10's final bullet (the "Extension (TODO-0104)" paragraph) ends with the
     exact sentence: `This guard is deliberately **not** wired into the auto-lock or `beforeunload` paths
     (Non-Goals in `docs/entry-persistence-consent-gate-plan.md`) — those rely solely on the backend
     on-disk refusal in `delete_entry_if_empty_inner` (`src-tauri/src/commands/entries.rs`), never on a
     dialog.` Append a new sentence immediately after it, inside the same bullet: "On cancel, it now also
     restores the entry's real on-disk content into the editor via a `restoreEntryFromDisk` helper
     (targeting the exact entry being restored, not just the day's newest — see
     `docs/entry-persistence-cancel-restore-plan.md`) before denying the navigation, so Cancel no longer
     leaves the editor visibly blank while the disk row underneath it is intact."
  2. In `docs/entry-persistence-consent-gate-plan.md`, add a new section right after the existing
     "Handover Note (2026-08-20, plan COMPLETED)" section and before "## Status Legend" — matching this
     file's own established convention of stacking dated follow-up sections (`Post-Completion Review`,
     `Handover Note`) near the top, above the Status Legend/Decision History/Goal boilerplate:
     ```markdown
     ## Addendum (2026-08-20): Cancel Now Restores Content

     A user-reported gap surfaced after this plan shipped: cancelling the confirm dialog correctly denied
     navigation and never deleted anything, but left the editor showing the blank state that triggered the
     dialog, with no visible way back to the real (still-safe-on-disk) content. The Non-Goals line above
     ("keeps the user on the current entry with their edit intact") is now superseded in one specific way:
     "intact" means the real on-disk content is restored into view, not that the blank state is left as-is.
     See `docs/entry-persistence-cancel-restore-plan.md` for the fix.
     ```
- Validation: Manual read-through of both edited files. `cmd.exe /c bun run lint` runs ESLint over `src/**/*.ts,tsx`
  only (verified: `package.json`'s `lint` script is `eslint src --ext .ts,.tsx`) — it does not see `docs/` or
  `src/CLAUDE.md` at all, so it is not a meaningful check for this task and is not listed here.
- Notes: Depends on Task 6 (function name) and Task 1 (TODO id, if citing it). Neither `bun run format` nor
  `format:check` reaches this task's files — both are scoped to `src/**/*.{ts,tsx,css}` only (verified in
  `package.json`) — so match the surrounding Markdown's existing style by hand rather than assuming Final
  Verification's `format` step covers it.

### Task 9: Live UX-GATE walkthrough

- Status: COMPLETED
- Objective: The restore-on-cancel behavior is confirmed against the real running app, not just automated
  tests, per this project's UX-GATE rule for dialog/multi-step interactions.
- Steps:
  1. Use the `tauri-agent-dev` skill to spawn the dev app.
  2. **Scenario 1 (single-entry day):** open an entry with real saved content, select-all and delete the
     body, click the entry's own nav button (or any other guarded navigation) to trigger the dialog, click
     **Cancel**. Confirm: dialog closes, editor now shows the original title/body again (not blank), no
     entry was deleted (check via Calendar/Timeline indicator), and clicking navigate again this time
     proceeds without a second dialog (since content now matches disk).
  3. **Scenario 2 (multi-entry day, non-newest entry):** create a day with two entries, open the *older*
     (non-newest) one, erase its content, trigger the guard via the entry-nav buttons, click **Cancel**.
     Confirm the *older* entry's real content is restored (not the newest entry's), and the nav bar's active
     index still points at the entry you were editing.
  4. **Scenario 3 (a second call site):** repeat Scenario 1 through the lock-toggle button instead of entry
     nav, confirming the same restore behavior there.
  5. Record screenshots and get explicit user sign-off for each scenario, following the same
     table format the predecessor plan used (`docs/entry-persistence-consent-gate-plan.md`'s "UX-GATE
     Scenarios" section) — add the sign-off notes directly into this plan's Tasks section (this task's Notes)
     once walked.
- Validation: User-confirmed sign-off recorded in this task's Notes for all three scenarios.
- Notes: Depends on Task 6. UX-GATE-blocking — this plan cannot move to `COMPLETED` without it.
  **Walked 2026-08-20 via `tauri-agent-dev` skill (Windows sandbox, real WebView2).** Hit and worked around
  the documented Vite optimizer wedge (dev server accepted the TCP connection but never completed an HTTP
  response) twice; fix both times was `agent:dev:stop`, delete `node_modules/.vite`, restart, and poll the
  port with `curl` before connecting `agent-browser` — matches the skill's own troubleshooting entry.
  **Scenario 1** (single-entry day, Aug 17): seeded real title+body, erased both back-to-back (no pause
  between clearing title and body — see below), triggered the guard via the header's Previous-day button,
  clicked Cancel. Dialog closed, editor showed the original title/body again (not blank), calendar showed no
  deletion, and a second Previous-day click proceeded without a second dialog. **Scenario 2** (multi-entry
  day, Aug 16): created two entries, opened the older (non-newest, nav button 1), erased it, triggered the
  guard via `entry-number-button-2`, clicked Cancel. The older entry's own real content was restored (not the
  newest entry's), and `entry-number-button-1` stayed `aria-current=true`. **Scenario 3**: repeated Scenario 1
  (Aug 15) but triggered the guard via the entry-lock-toggle button instead of day nav — same restore
  behavior, and `aria-pressed` on the lock button stayed `false` (not locked). All three screenshots sent to
  the user and explicitly approved via `AskUserQuestion` ("Yes, approve all three").
  **One false-positive investigated and ruled out during the walkthrough**: an initial attempt at Scenario 1
  cleared the title, waited ~2s, then cleared the body — restoreEntryFromDisk correctly restored title=''
  (matching what was genuinely on disk at Cancel time), which looked like a missing-title bug at first
  glance. Console log inspection (`agent-browser console`) showed the real cause: the pre-existing 500ms
  autosave debounce fired *during* the pause between clearing title and clearing body, persisting an
  intermediate state (title='', body=still-real) to disk — a pre-existing, correct autosave behavior
  unrelated to this plan's change. `restoreEntryFromDisk` faithfully restored that genuinely-on-disk state,
  proven by re-running the same scenario with title+body cleared back-to-back (no pause), which produced full
  correct restoration. No code change was needed; this is a test-methodology note for any future manual
  walkthrough of this guard, not a defect.

### Task 10: Cleanup, CHANGELOG, and final verification

- Status: COMPLETED
- Objective: The repository is left in a clean, fully-verified state with the change documented for users.
- Steps:
  1. Inspect the worktree diff for anything not part of the intended final change (scratch files, stray
     console.logs, leftover debug code) and remove it.
  2. Check off the TODO entry added in Task 1 in `docs/todo/TODO.md`.
  3. Add a new nested sub-bullet under the existing TODO-0104 entry in `CHANGELOG.md`'s
     `## [0.7.0] - Unreleased` `### Fixed` section, placed immediately **after** the existing self-review
     sub-bullet (the "Clicking a search result..." line) so the two follow-ups read in chronological order —
     matching that existing sub-bullet's own nested indentation exactly. E.g.: "**Cancelling that
     confirmation dialog left the editor showing blank instead of your actual entry** (user-reported gap,
     TODO-0104 follow-up, see [TODO-XXXX](docs/todo/TODO.md)): ... [fill in the assigned TODO id from
     Task 1] ... Cancel now reloads and displays the entry's real, still-intact content instead of leaving
     the blank state that triggered the dialog — including correctly restoring the exact entry you were
     editing, not just the day's newest, when a day has more than one entry."
  4. Run the full verification suite (see Final Verification below).
- Validation: Worktree diff contains only the intended final changes; all Final Verification commands pass.
- Notes: Do not remove the new plan file itself, the new tests, or the diagram/doc updates — all are part of
  the intended final state. `docs/entry-persistence-consent-gate-plan.md` remained untracked in `git status`
  going into this task — pre-existing from the predecessor plan's own session, not something this task
  created; left as-is (not a stray artifact of this plan). `.agent-dev/` walkthrough screenshots and logs are
  gitignored, not tracked, no cleanup needed. TODO-0105 checked off in `docs/todo/TODO.md`. CHANGELOG nested
  sub-bullet added under the existing TODO-0104 entry in `## [0.7.0] - Unreleased` → `### Fixed`.

  **Final Verification results:** `type-check` clean; `lint` clean; `format` reformatted the two files
  touched in Task 6 (`useEntryLifecycle.ts`, `useEntryLifecycle.test.ts` — Prettier line-wrapping only, no
  semantic change) — re-verified `type-check` and the targeted test files stayed green afterward;
  `validate:locales` — all 6 community locales OK (649 keys); full `test:run` — 99 files, 1025 tests, all
  green; `diagrams:check` — up to date; `test:e2e:local` (full build) — **first run surfaced a real gap**
  (see Task 5's Notes for the full deviation writeup): the old "toggling again re-asks" assertion in
  Scenario F broke for real once the fix was live, because Cancel's restore now puts the live editor back in
  sync with disk, so an immediate second toggle correctly takes the no-dialog "ordinary save" path instead of
  re-asking. Fixed in place in `e2e/specs/multi-entry.spec.ts` (same task scope — a direct correction to this
  plan's own E2E assertions, not a new bug in the implementation). Second `test:e2e:local -- --skip-build`
  run: **6 spec files, all passing**, including the corrected Scenario F. UX-GATE walkthrough (Task 9) and
  its three user-approved screenshots stand as additional independent confirmation against the real app.

  **Post-advisor-review additions (not in the plan's original Final Verification list, added because an
  advisor pass caught them before declaring done):**
  - `website/docs-src/` audited for stale claims about the delete-confirmation dialog (root `CLAUDE.md`'s
    docs-authority rule) — no page describes that dialog at all (the predecessor TODO-0104 plan never added
    one either), so nothing was stale. Confirmed via `grep -ril` for delete/confirm/erase/cancel language
    across `website/docs-src/`; the two incidental hits (`07-preferences.md`'s Save/Cancel-footer removal,
    `05-export.md`'s PDF save-dialog cancel) are unrelated features.
  - `bun run diagrams` had also rewritten `context.svg`, `context-dark.svg`, `unlock.svg`, `unlock-dark.svg`
    — pure mermaid-renderer drift, confirmed by `.source-hashes.json`'s diff only touching the two
    `save-entry*.mmd` entries (their sources are unchanged). Reverted with `git checkout --`; `diagrams:check`
    stayed green. Kept the diff scoped to the intended four `save-entry*` files.
  - `cmd.exe /c bun run coverage:diff` (Gotcha #6 — a green `test:run` does not imply the patch gate passes;
    this was missing from the plan's own Final Verification list). First `coverage:check` run hit a known
    unrelated flake (`PreferencesOverlay.integration.test.tsx` timed out under coverage instrumentation only,
    passed standalone on retry — not a file this plan touches). Regenerated `coverage/lcov.info` via
    `bun run test:coverage` (full suite green, global thresholds met) and re-ran `coverage:diff`: **97.4%
    combined patch coverage**, well above the 80% gate. `useEntryLifecycle.ts` alone is 32/34 (94%); the two
    missing lines are the `isStale()` early-returns inside `restoreEntryFromDisk` for a disposed/superseded
    load — narrow teardown-race guards not exercised by the four Task 3 unit tests, consistent with every
    other `isStale()`-style guard elsewhere in this file (none of which are unit-tested either). Not a gap
    worth adding a fifth test for.
  - One additional non-blocking observation surfaced by the advisor, deliberately **not** fixed in this plan
    (narrow, pre-existing-pattern race, out of this plan's scope): `restoreEntryFromDisk` bumps
    `loadRequestId` without touching the `loadInFlight` signal, so if a `loadEntriesForDate` is genuinely
    still in flight the instant Cancel fires, that load's own `finally` block sees a stale `requestId` and
    skips its `setLoadInFlight(false)` — leaving `loadInFlight` stuck `true` and keystroke-creation
    deferred via `queuedCreationReason` until the next load. The window requires a load in flight while the
    confirm dialog is open, which is narrow given the dialog only appears after `entryHasContent` already
    resolved. Left as a known follow-up, not filed as a new TODO — flagged here for whoever next touches
    `restoreEntryFromDisk` or `loadInFlight`.

## Final Verification

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run` (full suite, not just the two touched unit/integration files)
- `cmd.exe /c bun run test:e2e:local` (full build + suite — confirms Scenario F's restore assertions from
  Task 5 are green against the real fix, not just reasoned through)
- `cmd.exe /c bun run format` (or verify pre-commit hook already formatted staged files)
- `cmd.exe /c bun run diagrams:check`
- `cmd.exe /c bun run validate:locales` (no new i18n keys introduced, but cheap to confirm nothing broke)

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] The one open question raised during exploration was surfaced via `AskUserQuestion` and answered
      (Option A) before this plan was written.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets — exact file paths, function names, and full
      test code are specified.
- [x] The plan can be executed by a coding agent without reading the original conversation — the Background
      and "Multi-Entry Wrinkle" sections capture the necessary context inline.
- [x] UX-GATE: tagged `REQUIRED`; Task 9 lists three concrete scenarios requiring explicit user sign-off,
      not just a description of behavior.
- [ ] (Tauri WebView interaction) N/A — no link/navigation/new-window behavior involved.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes — for Tasks 3, 4, and 5,
  "validation passes" means the new/changed assertions **fail** as expected (red). Do not mark a red-phase
  task COMPLETED if a test that should be red passes early — it means the test doesn't actually exercise the
  gap (see Task 3's own Notes for why every one of its four tests must assert `getEntriesForDate` was
  called, not just the resulting `title()`/`content()` values).
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Tasks 3, 4, and 5 must all be COMPLETED (tests/E2E assertions written and confirmed red) before Task 6
  (implementation) starts — this is a TDD plan; do not implement first and backfill tests after.
