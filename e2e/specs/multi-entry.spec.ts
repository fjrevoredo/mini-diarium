/**
 * E2E test: Multi-entry workflow
 *
 * Exercises the multi-entry day feature end-to-end against the real Tauri binary:
 *
 *   Scenario A — Persistence: create 2 entries on a day → lock → unlock → both survive
 *   Scenario B — Regression (v0.4.9 Variant 1): "+" must stay enabled after navigating
 *                back to entry 1 via "←" from a blank entry 2
 *   Scenario C — Regression (v0.4.9 Variant 2): "+" must stay enabled after switching
 *                to another day (which auto-deletes the blank entry 2) and switching back
 *   Scenario D — Direct jump via the `← 1 2 →` number bar. Doubles as the guard for the
 *                title-input focus steal (TODO-0089): if TitleEditor re-focuses itself when
 *                dayEntries changes, the tail of ENTRY_1_BODY is typed into entry 1's title
 *   Scenario E — Regression (TODO-0089): typing into an entry and immediately toggling the
 *                Timeline must not wipe the body. Uses real TipTap, which the Vitest suite
 *                cannot: the mock editor there cannot reproduce real destroy/teardown timing.
 *   Scenario F — Entry persistence consent gate (TODO-0104): erasing a real entry's content
 *                and toggling Timeline must show an in-app confirm dialog that resists
 *                Escape/backdrop dismissal (UX-GATE #15), only acting on an explicit
 *                Cancel/Confirm click. Real dialog round trip, which the Vitest suite cannot
 *                fully substitute for — see the plan's Decision History for why this dialog
 *                is in-app DOM content rather than a native OS window.
 *
 * Prerequisites:
 *   - `bun run tauri build --` must have been run
 *   - `tauri-driver` must be installed (`cargo install tauri-driver`)
 *   - Run via: `bun run test:e2e`
 *
 * Date strategy: use days 1, 2, 3 of the PREVIOUS month. These are always distinct,
 * always in the past, and every month has at least 3 days. The test must navigate
 * the calendar to the previous month (via "Previous month" button) before clicking
 * these dates, since the calendar initialises on the current month after each unlock.
 */

import { connectToApp, authenticate, dismissOnboardingTour, typeText } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts

const now = new Date();
// Previous-month dates are always distinct and in the past regardless of today's
// day-of-month. The old strategy clamped days 6/7/8 to today, which made all three
// dates collide when today ≤ 8 (e.g. April 2 → all three became 2026-04-02).
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const lmYear = prevMonth.getFullYear().toString();
const lmMonth = String(prevMonth.getMonth() + 1).padStart(2, '0');
const MULTI_DATE_1 = `${lmYear}-${lmMonth}-01`; // scenario A: persistence
const MULTI_DATE_2 = `${lmYear}-${lmMonth}-02`; // scenario B: variant-1 regression
const MULTI_DATE_3 = `${lmYear}-${lmMonth}-03`; // scenario C: variant-2 regression
const MULTI_DATE_4 = `${lmYear}-${lmMonth}-04`; // scenario E: TODO-0089 body-wipe regression
const MULTI_DATE_5 = `${lmYear}-${lmMonth}-05`; // scenario F: TODO-0104 consent gate

const ENTRY_1_BODY = 'First entry for multi-entry test.';
// Second entry uses the title field (via setValue) rather than the ProseMirror body.
// After clicking "+", focus lands on the "+" button and waitForCounter polling doesn't
// restore editor focus — so browser.keys() into ProseMirror is unreliable here.
// Using title-input.setValue() is deterministic and matches the persistence-check pattern
// already established in diary-workflow.spec.ts.
const ENTRY_2_TITLE = 'Second entry (persistence check)';
// Scenario E (TODO-0089): a titled, non-blank entry — the wipe kept the title and
// emptied the body, so both must be asserted.
const SCENARIO_E_TITLE = 'Body wipe regression';
const SCENARIO_E_BODY = 'This body must survive a Timeline toggle.';
const SCENARIO_F_TITLE = 'Consent gate regression';
const SCENARIO_F_BODY = 'This entry must not vanish without asking first.';

describe('Multi-entry workflow', () => {
  it('creates multiple entries, persists them, and guards the "+" button across navigation', async () => {
    // ── helpers ──────────────────────────────────────────────────────────────

    const waitForSidebarExpanded = async (expectedExpanded: boolean, timeoutMsg: string) => {
      await browser.waitUntil(
        async () =>
          (await $('[data-testid="toggle-sidebar-button"]').getAttribute('aria-expanded')) ===
          String(expectedExpanded),
        { timeout: 5000, timeoutMsg },
      );
    };

    const openSidebar = async () => {
      const toggle = $('[data-testid="toggle-sidebar-button"]');
      await toggle.waitForExist({ timeout: 10000 });
      const expanded = (await toggle.getAttribute('aria-expanded')) === 'true';
      if (!expanded) {
        await toggle.waitForClickable({ timeout: 10000 });
        await toggle.click();
        await waitForSidebarExpanded(true, 'Sidebar did not open in time');
      }
    };

    const clickCalendarDay = async (date: string, waitForDay: 'clickable' | 'displayed' = 'clickable') => {
      await openSidebar();
      const dayButton = $(`[data-testid="calendar-day-${date}"]`);
      if (waitForDay === 'clickable') {
        await dayButton.waitForClickable({ timeout: 10000 });
      } else {
        await dayButton.waitForDisplayed({ timeout: 10000 });
      }
      await dayButton.click();
      await waitForSidebarExpanded(false, `Sidebar did not close after selecting ${date}`);
    };

    const waitForEntryButtons = async (expectedTotal: number, msg: string) => {
      await browser.waitUntil(
        async () => {
          const el = $(`[data-testid="entry-number-button-${expectedTotal}"]`);
          if (!(await el.isExisting())) return false;
          return await el.isDisplayed();
        },
        { timeout: 10000, timeoutMsg: msg },
      );
    };

    // ── connect ───────────────────────────────────────────────────────────────

    await connectToApp();

    // ── Scenario A: Multi-entry persistence ──────────────────────────────────
    // Creates 2 entries on MULTI_DATE_1, locks the journal, unlocks it, and verifies
    // both entries survive: the counter still shows "/ 2" and the newest entry's content
    // is visible (loadEntriesForDate opens the newest entry after unlock).

    // Auth (create or unlock) then dismiss the onboarding tour if it appears.
    // Calling dismissOnboardingTour() here (even though this spec usually hits the
    // unlock path with no tour) removes a latent order-dependency: if this file ran
    // first it would create the journal and the tour would block the flow.
    await authenticate(TEST_PASSWORD);
    await dismissOnboardingTour();
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 10000 });

    // Open sidebar and navigate to the test date (in the previous month).
    await openSidebar();
    // Calendar opens on the current month — navigate back one month to reach MULTI_DATE_1.
    await $('[aria-label="Previous month"]').waitForClickable({ timeout: 5000 });
    await $('[aria-label="Previous month"]').click();
    await clickCalendarDay(MULTI_DATE_1);
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write the first entry
    const editor = await $('.ProseMirror');
    await editor.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500); // flush autosave debounce (~1.5 s)

    // Add a second entry and write its body
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForEntryButtons(2, 'entry number button 2 should appear after clicking "+"');

    // Write the second entry via the title field (setValue is deterministic; after clicking "+"
    // focus is on the button and browser.keys() into ProseMirror is unreliable from E2E).
    // handleTitleInput → debouncedSave() so the entry persists even with an empty body.
    // Let the new blank entry's editor settle (DiaryEditor createEffect microtask).
    // This pause is no longer race-critical: the justCreatedEntryId guard in onSetContent
    // suppresses the auto-delete debounce for a freshly created entry, so typing the
    // title at any point after this is safe regardless of debounce timing.
    await browser.pause(500);
    await $('[data-testid="title-input"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="title-input"]').setValue(ENTRY_2_TITLE);
    await browser.pause(2500); // flush autosave debounce

    // Lock the journal
    await $('[data-testid="lock-journal-button"]').click();
    await $('[data-testid="password-unlock-input"]').waitForDisplayed({ timeout: 5000 });

    // Unlock and navigate back to the test date
    await $('[data-testid="password-unlock-input"]').setValue(TEST_PASSWORD);
    await $('[data-testid="unlock-journal-button"]').click();
    await openSidebar(); // sidebar collapses on unlock; reopen
    // Calendar remounts after unlock and resets to the current month — navigate back.
    await $('[aria-label="Previous month"]').waitForClickable({ timeout: 5000 });
    await $('[aria-label="Previous month"]').click();
    await clickCalendarDay(MULTI_DATE_1);

    // Both entries must have survived the lock/unlock cycle.
    // Counter "/ 2" confirms both exist; title check confirms we're on the newest entry.
    await waitForEntryButtons(
      2,
      'both entries should survive lock/unlock (entry number button 2 visible)',
    );
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === ENTRY_2_TITLE,
      {
        timeout: 10000,
        timeoutMsg: `Newest entry title "${ENTRY_2_TITLE}" not loaded after unlock`,
      },
    );

    // ── Scenario B: "+" enabled after backward navigation (v0.4.9 Variant 1) ──
    // Regression: clicking "+", getting a blank 2nd entry, then navigating back with "←"
    // left the "+" permanently disabled. Fixed by the `editorIsEmpty` reactive signal.

    // Navigate to a fresh date with no prior entries.
    // Scenario A's last calendar click (MULTI_DATE_1) auto-closed the sidebar via handleDayClick;
    // reopen it before accessing the calendar (required in mobile/overlay mode at 800 px).
    await clickCalendarDay(MULTI_DATE_2);
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write a first entry
    const editorB = await $('.ProseMirror');
    await editorB.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500);

    // Click "+" — creates a blank second entry (counter shows "2 / 2")
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForEntryButtons(
      2,
      'entry number button 2 should appear after clicking "+" in scenario B',
    );

    // Navigate back to entry 1 with "←" — entry 1 has real content
    await $('[data-testid="entry-prev-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-prev-button"]').click();

    // THE REGRESSION GUARD: "+" must be enabled once TipTap loads entry 1's content.
    // Before the fix, editorIsEmpty was stale (still true from the blank entry), keeping
    // addDisabled=true even though the loaded entry had content.
    await browser.waitUntil(async () => $('[data-testid="entry-add-button"]').isEnabled(), {
      timeout: 5000,
      timeoutMsg: '"+" button stuck disabled after backward navigation (v0.4.9 Variant 1)',
    });

    // ── Scenario C: "+" enabled after day switch with blank entry (v0.4.9 Variant 2) ──
    // Regression: creating a blank 2nd entry and switching to another day triggered a
    // debounced blank-entry deletion that called setPendingEntryId(null), leaving "+"
    // permanently disabled when switching back. Fixed by auto-navigating to the
    // nearest remaining entry after blank deletion in saveCurrentById.
    //
    // Sidebar note: clicking a *different* date closes the mobile overlay sidebar (UX
    // auto-close). Scenario B just clicked MULTI_DATE_2, so the sidebar is now closed.
    // Every calendar interaction in this scenario must explicitly reopen the sidebar first.

    // Navigate to another fresh date
    await clickCalendarDay(MULTI_DATE_3);
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write a first entry
    const editorC = await $('.ProseMirror');
    await editorC.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500);

    // Click "+" — creates a blank second entry
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForEntryButtons(
      2,
      'entry number button 2 should appear after clicking "+" in scenario C',
    );
    // addEntry() is still finishing (getAllEntryDates is async). Wait for it to complete so
    // setEntryDates() doesn't fire a calendar re-render while we're trying to click a day.
    await browser.pause(1000);

    // Switch to MULTI_DATE_2. Switching to another date leaves the blank entry 2 alive in
    // the DB; it will be auto-deleted via the debounce when we reload MULTI_DATE_3 next.
    // MULTI_DATE_2 (last month day 2) is always different from MULTI_DATE_3 (last month day 3).
    // Use waitForDisplayed (not waitForClickable) — addEntry's async setEntryDates call can
    // trigger a calendar re-render that momentarily causes elementFromPoint to miss the button.
    await clickCalendarDay(MULTI_DATE_2, 'displayed');
    await browser.pause(1500); // let loadEntriesForDate(MULTI_DATE_2) complete before switching back

    // Switch back to MULTI_DATE_3. loadEntriesForDate loads blank entry 2 as current, fires
    // setContent('') → 500 ms debounce → saveCurrentById deletes blank entry 2 and auto-navigates
    // to entry 1 (the v0.4.9 Variant 2 fix).
    await clickCalendarDay(MULTI_DATE_3, 'displayed');
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // THE REGRESSION GUARD: "+" must be enabled. Before the fix, saveCurrentById set
    // pendingEntryId(null) after deleting the blank entry, leaving "+" disabled on switch-back.
    await browser.waitUntil(async () => $('[data-testid="entry-add-button"]').isEnabled(), {
      timeout: 5000,
      timeoutMsg: '"+" button stuck disabled after day switch (v0.4.9 Variant 2)',
    });
    // ── Scenario D: Direct jump via number button ──────────────────────────
    // Navigate directly to entry 1 by clicking its number button while on entry 2.
    // This validates the new `← 1 2 →` clickable number bar end-to-end.

    // We're currently on MULTI_DATE_3 with 1 surviving entry (blank entry was auto-deleted).
    // Add a second entry so we have 2 entries to navigate between.
    await browser.waitUntil(async () => $('[data-testid="entry-add-button"]').isEnabled(), {
      timeout: 5000,
      timeoutMsg: '"+" button not enabled before Scenario D',
    });
    await $('[data-testid="entry-add-button"]').click();
    await browser.pause(500);
    await $('[data-testid="title-input"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="title-input"]').setValue('Second entry for direct jump');
    await browser.pause(2500); // flush autosave

    // Confirm we have 2 entries and are on entry 2
    await waitForEntryButtons(2, 'Scenario D: should have 2 entries');
    await browser.waitUntil(
      async () =>
        (await $('[data-testid="title-input"]').getValue()) === 'Second entry for direct jump',
      { timeout: 5000, timeoutMsg: 'Scenario D: should be on entry 2' },
    );

    // Click number button 1 to jump directly to entry 1
    await $('[data-testid="entry-number-button-1"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-number-button-1"]').click();

    // Verify we jumped to entry 1 — its title should be empty (only body was set).
    // This also guards the title-input focus-steal regression: if TitleEditor re-focuses
    // itself when dayEntries changes, the tail of ENTRY_1_BODY lands in entry 1's title
    // instead of its body, and this assertion sees that leftover title. See TODO-0089.
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === '',
      {
        timeout: 5000,
        timeoutMsg: 'Scenario D: direct jump to entry 1 failed (title should be empty)',
      },
    );

    // Verify entry 1 number button is now active
    const activeBtn = await $(`[data-testid="entry-number-button-1"][aria-current='true']`);
    await activeBtn.waitForExist({
      timeout: 5000,
      timeoutMsg: 'Scenario D: entry-number-button-1 should be active',
    });

    // ── Scenario E: type-then-toggle-Timeline must not wipe the body (TODO-0089) ──
    // The reported symptom was an entry row surviving with its title intact and its body
    // blank — i.e. save_entry(id, title, ''). It happened when the editor committed WHICH
    // entry it was editing before it knew WHAT that entry contained, so the flush that
    // runs on unmount paired a real id+title with an empty document. The Timeline toggle
    // is a plain <Show> swap in MainLayout, so it unmounts EditorPanel outright.

    const toggleTimeline = async () => {
      const btn = $('[data-testid="timeline-toggle-button"]');
      await btn.waitForClickable({ timeout: 10000 });
      await btn.click();
    };

    await clickCalendarDay(MULTI_DATE_4);
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });
    await browser.pause(1000); // let loadEntriesForDate(MULTI_DATE_4) settle before seeding

    // Seed a persisted entry with both a title and a body.
    await $('[data-testid="title-input"]').setValue(SCENARIO_E_TITLE);
    const editorE = await $('.ProseMirror');
    await editorE.click();
    // typeText, not browser.keys(): SCENARIO_E_BODY contains a doubled letter
    // ("toggle") — see typeText's doc comment in helpers.ts.
    await typeText(SCENARIO_E_BODY);
    await browser.pause(2500); // flush autosave

    // Seed sanity-check: without this, a seeding failure is indistinguishable from the
    // wipe the loop below is meant to detect (both leave the body missing).
    await browser.waitUntil(
      async () => ((await $('.ProseMirror').getText()) ?? '').includes(SCENARIO_E_BODY),
      { timeout: 5000, timeoutMsg: 'Scenario E: seed body never reached the editor' },
    );
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === SCENARIO_E_TITLE,
      { timeout: 5000, timeoutMsg: 'Scenario E: seed title never reached the editor' },
    );

    // Three type-then-immediately-toggle cycles. No pause between the keystrokes and the
    // toggle: the whole point is to land inside the 500 ms debounce window, which is where
    // the wipe used to happen. The repeat covers the "under load" variant.
    for (let i = 1; i <= 3; i++) {
      const appended = ` add${i}`;
      const editorLoop = await $('.ProseMirror');
      await editorLoop.click();
      await browser.keys(['End']);
      // typeText, not browser.keys(): "add1"/"add2"/"add3" contain a doubled
      // letter ("add") — see typeText's doc comment in helpers.ts.
      await typeText(appended);
      await toggleTimeline(); // → Timeline (unmounts EditorPanel mid-debounce)
      await browser.pause(500);
      await toggleTimeline(); // → back to the editor (remounts + reloads the date)
      await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 10000 });

      // THE REGRESSION GUARD: the title must survive AND the body must still be there.
      // A wipe leaves the title intact and the body empty, so asserting only on the title
      // would pass against the bug.
      await browser.waitUntil(
        async () => (await $('[data-testid="title-input"]').getValue()) === SCENARIO_E_TITLE,
        { timeout: 10000, timeoutMsg: `Scenario E cycle ${i}: title lost after Timeline toggle` },
      );
      await browser.waitUntil(
        async () => ((await $('.ProseMirror').getText()) ?? '').includes(SCENARIO_E_BODY),
        {
          timeout: 10000,
          timeoutMsg: `Scenario E cycle ${i}: entry body was wiped by the Timeline toggle (TODO-0089)`,
        },
      );
    }

    // The typed additions must have been flushed on unmount, not dropped: dispose() now
    // snapshots and writes rather than merely cancelling the pending debounce.
    await browser.waitUntil(
      async () => ((await $('.ProseMirror').getText()) ?? '').includes('add3'),
      {
        timeout: 10000,
        timeoutMsg: 'Scenario E: the last typed text was dropped instead of flushed on unmount',
      },
    );

    // ── Scenario F: entry persistence consent gate (TODO-0104) ────────────────
    // A user erases real content and toggles Timeline — before this plan the entry was
    // silently deleted. An in-app confirm dialog must appear, resist Escape/backdrop
    // dismissal (UX-GATE #15), and only act on an explicit Cancel/Confirm click.
    //
    // Sequencing choice: waits past the 500 ms autosave debounce before toggling
    // Timeline, rather than toggling immediately after clearing. This deliberately lets
    // the debounce's own deleteEntryIfEmpty attempt fire and get refused by Milestone 1's
    // backend on-disk check FIRST, so the guard's subsequent entryHasContent() read is
    // exercised against a real prior refusal — the strongest test of how the backend
    // safety net and the frontend guard interact — rather than a body that was typed and
    // immediately toggled away from before any write was ever attempted.

    const clearTitleInput = async () => {
      const titleInput = $('[data-testid="title-input"]');
      await titleInput.click();
      // Two distinct keystrokes (Ctrl+A, then Backspace) — reliable for a plain <input>.
      // See e2e/CLAUDE.md gotcha #6: .setValue('') is not reliable for clearing to empty.
      await browser.keys(['Control', 'a']);
      await browser.keys(['Backspace']);
    };

    const clearProseMirrorBody = async () => {
      const editorToClear = $('.ProseMirror');
      // Measure actual current content rather than assuming it equals a fixture length —
      // see e2e/CLAUDE.md gotcha #7.
      const currentText = (await editorToClear.getText()) ?? '';
      await editorToClear.click();
      await browser.keys(['Control', 'End']);
      // One Backspace per character in its own browser.keys() call — avoids gotcha #5's
      // key-repeat coalescing hazard on WebKitGTK.
      for (let i = 0; i < currentText.length; i++) {
        await browser.keys(['Backspace']);
      }
    };

    await clickCalendarDay(MULTI_DATE_5);
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });
    await browser.pause(1000); // let loadEntriesForDate(MULTI_DATE_5) settle before seeding

    // Seed a persisted entry with real content.
    await $('[data-testid="title-input"]').setValue(SCENARIO_F_TITLE);
    const editorF = await $('.ProseMirror');
    await editorF.click();
    await typeText(SCENARIO_F_BODY);
    await browser.pause(2500); // flush autosave debounce

    // Seed sanity-check: without this, a seeding failure is indistinguishable from the
    // deletion the rest of this scenario is meant to guard against.
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === SCENARIO_F_TITLE,
      { timeout: 5000, timeoutMsg: 'Scenario F: seed title never reached the editor' },
    );
    await browser.waitUntil(
      async () => ((await $('.ProseMirror').getText()) ?? '').includes(SCENARIO_F_BODY),
      { timeout: 5000, timeoutMsg: 'Scenario F: seed body never reached the editor' },
    );

    // Erase both fields via real keystrokes.
    await clearTitleInput();
    await clearProseMirrorBody();
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === '',
      { timeout: 5000, timeoutMsg: 'Scenario F: title did not clear' },
    );
    await browser.waitUntil(
      async () => ((await $('.ProseMirror').getText()) ?? '').trim() === '',
      { timeout: 5000, timeoutMsg: 'Scenario F: body did not clear' },
    );

    // Wait past the debounce (see sequencing note above) before toggling.
    await browser.pause(700);

    await toggleTimeline();

    // The confirm dialog must appear.
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000 });

    // UX-GATE scenario #15: Escape must be inert — dialog stays open.
    await browser.keys(['Escape']);
    await browser.pause(300);
    expect(await $('[data-testid="confirm-dialog"]').isDisplayed()).toBe(true);

    // UX-GATE scenario #15: an outside backdrop click must also be inert. The dialog card
    // is a centered max-w-md box; a click near the viewport's top-left corner lands on the
    // dimmed overlay behind it, not the card.
    await $('body').click({ x: -350, y: -280 });
    await browser.pause(300);
    expect(await $('[data-testid="confirm-dialog"]').isDisplayed()).toBe(true);

    // Cancel — the app stays on the editor; the entry (still blank in the live editor,
    // but never actually deleted on disk) is untouched.
    await $('[data-testid="confirm-dialog-cancel-button"]').click();
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000, reverse: true });
    expect(await $('[data-testid="title-input"]').isDisplayed()).toBe(true);
    expect(await $('[data-testid="timeline-toggle-button"]').getAttribute('aria-pressed')).toBe(
      'false',
    );

    // Toggling again re-asks — the entry still exists (Cancel denied the earlier
    // navigation), so the guard's on-disk check still finds real content.
    await toggleTimeline();
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="confirm-dialog-confirm-button"]').click();
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000, reverse: true });

    // Confirm — Timeline is now showing; the entry was hard-deleted.
    await browser.waitUntil(
      async () =>
        (await $('[data-testid="timeline-toggle-button"]').getAttribute('aria-pressed')) ===
        'true',
      { timeout: 5000, timeoutMsg: 'Scenario F: Timeline did not show after confirming the delete' },
    );
  });
});
