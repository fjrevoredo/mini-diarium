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

const ENTRY_1_BODY = 'First entry for multi-entry test.';
// Second entry uses the title field (via setValue) rather than the ProseMirror body.
// After clicking "+", focus lands on the "+" button and waitForCounter polling doesn't
// restore editor focus — so browser.keys() into ProseMirror is unreliable here.
// Using title-input.setValue() is deterministic and matches the persistence-check pattern
// already established in diary-workflow.spec.ts.
const ENTRY_2_TITLE = 'Second entry (persistence check)';

describe('Multi-entry workflow', () => {
  it('creates multiple entries, persists them, and guards the "+" button across navigation', async () => {
    // ── helpers ──────────────────────────────────────────────────────────────

    const unlockOrCreate = async () => {
      const authScreen = await browser.waitUntil(
        async () => {
          const create = await $('[data-testid="password-create-input"]').isDisplayed().catch(() => false);
          const unlock = await $('[data-testid="password-unlock-input"]').isDisplayed().catch(() => false);
          if (create) return 'create' as const;
          if (unlock) return 'unlock' as const;
          return false;
        },
        { timeout: 10000, timeoutMsg: 'Neither password-create-input nor password-unlock-input appeared' },
      );

      if (authScreen === 'create') {
        await $('[data-testid="password-create-input"]').setValue(TEST_PASSWORD);
        await $('[data-testid="password-repeat-input"]').setValue(TEST_PASSWORD);
        await $('[data-testid="create-journal-button"]').click();
      } else {
        await $('[data-testid="password-unlock-input"]').setValue(TEST_PASSWORD);
        await $('[data-testid="unlock-journal-button"]').click();
      }

      await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 10000 });
    };

    const waitForCounter = async (msg: string) => {
      await browser.waitUntil(
        async () => {
          const el = $('[data-testid="entry-counter"]');
          if (!(await el.isExisting())) return false;
          // Counter format: "{index+1} / {total}" — match "/ 2" at end to confirm 2 total entries
          return /\/ 2$/.test((await el.getText()).trim());
        },
        { timeout: 10000, timeoutMsg: msg },
      );
    };

    // ── connect ───────────────────────────────────────────────────────────────

    await browser.url('tauri://localhost');
    await browser.pause(5000);

    // ── Scenario A: Multi-entry persistence ──────────────────────────────────
    // Creates 2 entries on MULTI_DATE_1, locks the journal, unlocks it, and verifies
    // both entries survive: the counter still shows "/ 2" and the newest entry's content
    // is visible (loadEntriesForDate opens the newest entry after unlock).

    await unlockOrCreate();

    // Open sidebar and navigate to the test date (in the previous month).
    await $('[data-testid="toggle-sidebar-button"]').click();
    // Calendar opens on the current month — navigate back one month to reach MULTI_DATE_1.
    await $('[aria-label="Previous month"]').waitForClickable({ timeout: 5000 });
    await $('[aria-label="Previous month"]').click();
    await $(`[data-testid="calendar-day-${MULTI_DATE_1}"]`).waitForClickable({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_1}"]`).click();
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write the first entry
    const editor = await $('.ProseMirror');
    await editor.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500); // flush autosave debounce (~1.5 s)

    // Add a second entry and write its body
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForCounter('counter should show 2 total entries after clicking "+"');

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
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 10000 });
    await $('[data-testid="toggle-sidebar-button"]').click(); // sidebar collapses on unlock; reopen
    // Calendar remounts after unlock and resets to the current month — navigate back.
    await $('[aria-label="Previous month"]').waitForClickable({ timeout: 5000 });
    await $('[aria-label="Previous month"]').click();
    await $(`[data-testid="calendar-day-${MULTI_DATE_1}"]`).waitForClickable({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_1}"]`).click();

    // Both entries must have survived the lock/unlock cycle.
    // Counter "/ 2" confirms both exist; title check confirms we're on the newest entry.
    await waitForCounter('both entries should survive lock/unlock (counter "/ 2")');
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === ENTRY_2_TITLE,
      { timeout: 10000, timeoutMsg: `Newest entry title "${ENTRY_2_TITLE}" not loaded after unlock` },
    );

    // ── Scenario B: "+" enabled after backward navigation (v0.4.9 Variant 1) ──
    // Regression: clicking "+", getting a blank 2nd entry, then navigating back with "←"
    // left the "+" permanently disabled. Fixed by the `editorIsEmpty` reactive signal.

    // Navigate to a fresh date with no prior entries.
    // Scenario A's last calendar click (MULTI_DATE_1) auto-closed the sidebar via handleDayClick;
    // reopen it before accessing the calendar (required in mobile/overlay mode at 800 px).
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="toggle-sidebar-button"]').click();
    await $(`[data-testid="calendar-day-${MULTI_DATE_2}"]`).waitForDisplayed({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_2}"]`).click(); // sidebar closes after this
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write a first entry
    const editorB = await $('.ProseMirror');
    await editorB.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500);

    // Click "+" — creates a blank second entry (counter shows "2 / 2")
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForCounter('counter should show 2 entries after clicking "+" in scenario B');

    // Navigate back to entry 1 with "←" — entry 1 has real content
    await $('[data-testid="entry-prev-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-prev-button"]').click();

    // THE REGRESSION GUARD: "+" must be enabled once TipTap loads entry 1's content.
    // Before the fix, editorIsEmpty was stale (still true from the blank entry), keeping
    // addDisabled=true even though the loaded entry had content.
    await browser.waitUntil(
      async () => $('[data-testid="entry-add-button"]').isEnabled(),
      { timeout: 5000, timeoutMsg: '"+" button stuck disabled after backward navigation (v0.4.9 Variant 1)' },
    );

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
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="toggle-sidebar-button"]').click();
    await $(`[data-testid="calendar-day-${MULTI_DATE_3}"]`).waitForClickable({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_3}"]`).click(); // sidebar closes after this
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // Write a first entry
    const editorC = await $('.ProseMirror');
    await editorC.click();
    await browser.keys(ENTRY_1_BODY);
    await browser.pause(2500);

    // Click "+" — creates a blank second entry
    await $('[data-testid="entry-add-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="entry-add-button"]').click();
    await waitForCounter('counter should show 2 entries after clicking "+" in scenario C');
    // addEntry() is still finishing (getAllEntryDates is async). Wait for it to complete so
    // setEntryDates() doesn't fire a calendar re-render while we're trying to click a day.
    await browser.pause(1000);

    // Switch to MULTI_DATE_2. Switching to another date leaves the blank entry 2 alive in
    // the DB; it will be auto-deleted via the debounce when we reload MULTI_DATE_3 next.
    // MULTI_DATE_2 (last month day 2) is always different from MULTI_DATE_3 (last month day 3).
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="toggle-sidebar-button"]').click();
    // Use waitForDisplayed (not waitForClickable) — addEntry's async setEntryDates call can
    // trigger a calendar re-render that momentarily causes elementFromPoint to miss the button.
    await $(`[data-testid="calendar-day-${MULTI_DATE_2}"]`).waitForDisplayed({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_2}"]`).click(); // sidebar closes after this
    await browser.pause(1500); // let loadEntriesForDate(MULTI_DATE_2) complete before switching back

    // Switch back to MULTI_DATE_3. loadEntriesForDate loads blank entry 2 as current, fires
    // setContent('') → 500 ms debounce → saveCurrentById deletes blank entry 2 and auto-navigates
    // to entry 1 (the v0.4.9 Variant 2 fix).
    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="toggle-sidebar-button"]').click();
    await $(`[data-testid="calendar-day-${MULTI_DATE_3}"]`).waitForDisplayed({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${MULTI_DATE_3}"]`).click(); // sidebar closes after this
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    // THE REGRESSION GUARD: "+" must be enabled. Before the fix, saveCurrentById set
    // pendingEntryId(null) after deleting the blank entry, leaving "+" disabled on switch-back.
    await browser.waitUntil(
      async () => $('[data-testid="entry-add-button"]').isEnabled(),
      { timeout: 5000, timeoutMsg: '"+" button stuck disabled after day switch (v0.4.9 Variant 2)' },
    );
  });
});
