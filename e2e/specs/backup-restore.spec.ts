/**
 * E2E test: Backup restore round trip (TODO-0098 Task 4.4)
 *
 * Exercises the recovery flow the whole backup redesign exists for, against the real
 * Tauri binary and real SQLite DB:
 *
 *   write an entry → take a manual snapshot → delete the entry (clear it, then confirm
 *   the entry-persistence consent-gate dialog — see below) → restore it from the
 *   snapshot via the per-entry restore dialog → confirm the content is back.
 *
 * Why clear-then-confirm-via-Timeline-toggle instead of the entry nav bar's trash button
 * (`entry-delete-button`): that button is hidden whenever a day holds only one entry
 * (`EntryNavBar.tsx`'s `<Show when={total > 1}>`), which this test's single-entry day
 * always is. Toggling Timeline is the simplest available navigation trigger that reaches
 * the same in-app confirm dialog the trash button itself now uses.
 *
 * Historical note: an earlier version of this test cleared the entry and let the
 * debounced autosave silently auto-delete it via `deleteEntryIfEmpty`, with no dialog
 * involved at all — because at the time, the trash button's confirm was a native OS
 * dialog (`src/lib/dialog.ts`'s `confirm()`) outside WebDriver's reach, so no delete path
 * in the app was WebDriver-testable through a real confirmation click. TODO-0104's
 * entry-persistence-consent-gate plan changed both halves of that picture at once: the
 * backend now refuses to silently auto-delete an entry that still holds real on-disk
 * content (so the old clear-and-wait approach no longer deletes anything), and the trash
 * button's confirm was migrated to the same in-app dialog exercised here — which, unlike
 * the native dialog it replaced, is ordinary WebView content WebDriver can click through.
 *
 * Per-entry restore (`BackupInspectDialog`) needs no confirm dialog either: unlike
 * whole-journal restore, it only adds entries and never overwrites (UX-5), so the plan
 * signed it off as a non-destructive action.
 *
 * Prerequisites:
 *   - `bun run tauri build --` must have been run
 *   - `tauri-driver` must be installed (`cargo install tauri-driver`)
 *   - Run via: `bun run test:e2e`
 */

import { Key } from 'webdriverio';
import { connectToApp, authenticate, dismissOnboardingTour } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts

// Previous month, day 20 — every month has at least 28 days, so this is always valid,
// and it is distinct from diary-workflow's (current month) and multi-entry's (previous
// month, days 1-4) dates so the three specs' entries never collide on the shared journal.
const now = new Date();
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const lmYear = prevMonth.getFullYear().toString();
const lmMonth = String(prevMonth.getMonth() + 1).padStart(2, '0');
const RESTORE_DATE = `${lmYear}-${lmMonth}-20`;

const ENTRY_TITLE = 'Backup Restore E2E Entry';
const ENTRY_BODY = 'This entry proves the backup restore round trip works end to end.';

describe('Backup restore round trip', () => {
  it('restores a deleted entry from a manually created snapshot', async () => {
    // ── 1. Connect, auth, write the entry ────────────────────────────────────
    await connectToApp();
    await authenticate(TEST_PASSWORD);
    await dismissOnboardingTour();

    await $('[data-testid="toggle-sidebar-button"]').waitForClickable({ timeout: 10000 });
    await $('[data-testid="toggle-sidebar-button"]').click();
    await $('[aria-label="Previous month"]').waitForClickable({ timeout: 5000 });
    await $('[aria-label="Previous month"]').click();
    await $(`[data-testid="calendar-day-${RESTORE_DATE}"]`).waitForClickable({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${RESTORE_DATE}"]`).click();

    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="title-input"]').setValue(ENTRY_TITLE);
    const editor = await $('.ProseMirror');
    await editor.click();
    // Stateful lane (e2e/CLAUDE.md gotcha 1) persists the journal across runs, so this date's
    // editor may already hold a previous run's restored body. click() does not guarantee the
    // cursor lands at the end of any existing text — on a non-empty paragraph it can land
    // mid-content, and typing there splices ENTRY_BODY into the middle of the old text instead
    // of replacing it. Clear any pre-existing content first, using the same dynamic-length
    // backspace technique the delete step below uses for the same reason.
    const existingBody = (await editor.getText()) ?? '';
    await browser.keys([Key.Ctrl, 'End']);
    for (let i = 0; i < existingBody.length; i++) {
      await browser.keys(['Backspace']);
    }
    await browser.keys(ENTRY_BODY);
    await browser.pause(2500); // flush autosave debounce (~1.5 s)

    // ── 2. Open Preferences → Backups and take a manual snapshot ────────────
    await $('[data-testid="header-more-menu-trigger"]').waitForClickable({ timeout: 10000 });
    await $('[data-testid="header-more-menu-trigger"]').click();
    await $('[data-testid="header-more-menu-preferences-item"]').waitForDisplayed({
      timeout: 5000,
    });
    await $('[data-testid="header-more-menu-preferences-item"]').click();
    await $('[data-testid="preferences-overlay"]').waitForDisplayed({ timeout: 5000 });

    await $('#pref-tab-backups').waitForClickable({ timeout: 5000 });
    await $('#pref-tab-backups').click();
    await $('[data-testid="backups-panel"]').waitForDisplayed({ timeout: 5000 });

    await $('[data-testid="backups-create-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="backups-create-button"]').click();
    // Manual snapshots always bypass the dedup/interval rules (SnapshotTrigger::Manual),
    // so this always produces a fresh row; wait for the button to re-enable once the
    // panel's post-create `load()` has finished.
    await browser.waitUntil(async () => $('[data-testid="backups-create-button"]').isEnabled(), {
      timeout: 10000,
      timeoutMsg: 'Back up now button did not re-enable after taking a manual snapshot',
    });
    await $('[data-testid="backups-list-item"]').waitForDisplayed({ timeout: 5000 });

    // Nothing to restore yet — the snapshot was just taken with the entry still present.
    // Close Preferences and delete the entry first.
    await browser.keys(['Escape']);
    await $('[data-testid="preferences-overlay"]').waitForDisplayed({
      timeout: 5000,
      reverse: true,
    });

    // ── 3. Delete the entry: clear title + body, then confirm the consent-gate dialog ──
    // Both fields are cleared with real keystrokes, not `.setValue('')`: clearing to an empty
    // string does not reliably dispatch the `input` event Solid's `onInput` binding needs on
    // this WebView2/msedgedriver setup — confirmed empirically via the app's own write-audit
    // log (`useEntryPersistence.ts` `logWrite`): the debounced save fired with `titleLen=24`,
    // exactly `ENTRY_TITLE.length`, meaning the title signal never saw the clear and the write
    // silently became a save instead of a delete (`e2e/CLAUDE.md` gotcha 6).
    //
    // The title is a plain `<input>`, so `Ctrl+A` + one `Backspace` is reliable and safe: two
    // distinct keystrokes, not a repeated key, so gotcha 5's WebKitGTK coalescing hazard (a
    // `keyDown` for a key that is still "down" reading as OS repeat rather than a new
    // keystroke) does not apply. `Ctrl+A` inside the ProseMirror body is a different story —
    // native select-all in a contenteditable region is not reliable through WebDriver, and a
    // single `Backspace` only removes the character before the cursor if nothing is actually
    // selected. Instead of gambling on either, the body is cleared one `Backspace` per
    // character via a loop — the exact same "one `browser.keys()` call per keystroke" pattern
    // `typeText()` already uses to dodge gotcha 5, just for deletion instead of insertion.
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="title-input"]').click();
    await browser.keys([Key.Ctrl, 'a']);
    await browser.keys(['Backspace']);

    await editor.click();
    // Read the current body text rather than assuming it's exactly ENTRY_BODY: the stateful
    // E2E lane (e2e/CLAUDE.md gotcha 1) persists the journal across runs, so a second run's
    // browser.keys(ENTRY_BODY) above appends to whatever this date's editor already held
    // (e.g. a previous run's restored copy) instead of replacing it. Backspacing a fixed
    // ENTRY_BODY.length would then strip only the newly typed copy, leaving the entry
    // non-empty and the auto-delete never firing.
    const currentBody = (await editor.getText()) ?? '';
    await browser.keys([Key.Ctrl, 'End']);
    for (let i = 0; i < currentBody.length; i++) {
      await browser.keys(['Backspace']);
    }
    // 500 ms debounce + buffer. The debounce's own deleteEntryIfEmpty attempt fires here and
    // is refused by Milestone 1's backend on-disk check — the on-disk row still holds the
    // real content typed in step 1, so the entry survives until explicitly confirmed below.
    await browser.pause(1500);

    // Toggling Timeline is a navigation action, so it asks the entry-persistence consent
    // gate (TODO-0104) before leaving the now-blank entry — the entry nav bar's trash button
    // is unavailable here (single-entry day), so this is the simplest reachable trigger.
    await $('[data-testid="timeline-toggle-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="timeline-toggle-button"]').click();
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="confirm-dialog-confirm-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="confirm-dialog-confirm-button"]').click();
    await $('[data-testid="confirm-dialog"]').waitForDisplayed({ timeout: 5000, reverse: true });

    // Confirming left mainView on Timeline (the navigation the dialog was gating). Toggle
    // back to the editor view now, with nothing left to confirm, so step 5 below has an
    // editor panel to find the restored entry in.
    await $('[data-testid="timeline-toggle-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="timeline-toggle-button"]').click();
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });

    await browser.waitUntil(
      async () => {
        const label = await $(`[data-testid="calendar-day-${RESTORE_DATE}"]`).getAttribute(
          'aria-label',
        );
        return !(label ?? '').includes('has entry');
      },
      { timeout: 10000, timeoutMsg: 'Entry was not deleted within 10s of confirming the dialog' },
    );

    // ── 4. Reopen Preferences → Backups and restore the entry via the inspect dialog ──
    await $('[data-testid="header-more-menu-trigger"]').waitForClickable({ timeout: 10000 });
    await $('[data-testid="header-more-menu-trigger"]').click();
    await $('[data-testid="header-more-menu-preferences-item"]').waitForDisplayed({
      timeout: 5000,
    });
    await $('[data-testid="header-more-menu-preferences-item"]').click();
    await $('[data-testid="preferences-overlay"]').waitForDisplayed({ timeout: 5000 });

    await $('#pref-tab-backups').waitForClickable({ timeout: 5000 });
    await $('#pref-tab-backups').click();
    await $('[data-testid="backups-panel"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="backups-list-item"]').waitForDisplayed({ timeout: 5000 });

    // No lock/unlock, migration, or destructive operation happened in between, and
    // clicking Back up now again was not repeated, so no new snapshot was created —
    // the newest row is still the one from step 2.
    const rowsAfterDelete = await $$('[data-testid="backups-list-item"]');
    await rowsAfterDelete[0].$('[data-testid="backups-restore-entries-button"]').click();

    await $('[data-testid="backup-inspect-dialog"]').waitForDisplayed({ timeout: 5000 });
    const passwordInput = $('[data-testid="backup-inspect-dialog"] input[type="password"]');
    await passwordInput.waitForDisplayed({ timeout: 5000 });
    await passwordInput.setValue(TEST_PASSWORD);
    await $('[data-testid="backup-inspect-open-button"]').click();

    // Locate this test's own row instead of trusting a dialog-wide selector: a snapshot can
    // hold other specs' entries (especially once the stateful lane runs — see Finding 1), and
    // [data-testid="backup-inspect-status-missing"] matches any row with that status, not
    // specifically this test's entry.
    //
    // Match against `el.textContent` via `browser.execute`, not `row.getText()`: the title
    // span and preview `<p>` both carry Tailwind `truncate` (overflow:hidden +
    // text-overflow:ellipsis), and WebDriver's `getText()` returns *rendered* text, which
    // WebKitWebDriver (CI) and msedgedriver (local) are not guaranteed to compute identically
    // for a clipped box — `textContent` is unaffected by CSS truncation on either engine.
    const findTargetRows = async (): Promise<WebdriverIO.Element[]> => {
      const rows = await $$('[data-testid="backup-inspect-entry-item"]');
      const matches: WebdriverIO.Element[] = [];
      for (const row of rows) {
        const text = await browser.execute((el: HTMLElement) => el.textContent ?? '', row);
        if (text.includes(ENTRY_TITLE) && text.includes(RESTORE_DATE)) {
          matches.push(row);
        }
      }
      return matches;
    };

    // The just-deleted entry must show up as "missing" — this is the proof that the
    // delete in step 3 actually reached the database, not just the editor. The wait is
    // generous because opening the snapshot re-derives the master key via Argon2id, whose
    // cost is deliberately variable under system load.
    try {
      await browser.waitUntil(
        async () => {
          const matches = await findTargetRows();
          if (matches.length !== 1) return false;
          return matches[0]
            .$('[data-testid="backup-inspect-status-missing"]')
            .isDisplayed()
            .catch(() => false);
        },
        {
          timeout: 20000,
          timeoutMsg: `Row for "${ENTRY_TITLE}" on ${RESTORE_DATE} did not show as missing within 20s`,
        },
      );
    } catch (waitError) {
      // `loadEntries()` (BackupInspectDialog.tsx) fetches the entry list exactly once, right
      // after the snapshot opens — this wait never re-fetches, so a timeout here is
      // deterministic, not flaky. Dump enough state to diagnose it from one CI run instead of
      // guessing across several: whether the snapshot even opened, and what every row's own
      // text and status actually say.
      const openErrorText = await $('[data-testid="backup-inspect-dialog"] [role="alert"]')
        .getText()
        .catch(() => '<none>');
      const emptyState = await $('[data-testid="backup-inspect-empty"]')
        .isExisting()
        .catch(() => false);
      const rows = await $$('[data-testid="backup-inspect-entry-item"]');
      const rowDumps = await Promise.all(
        rows.map(async (row, i) => {
          const text = await browser
            .execute((el: HTMLElement) => el.textContent ?? '', row)
            .catch(() => '<getText failed>');
          const statusTestId = await row
            .$('[data-testid^="backup-inspect-status-"]')
            .getAttribute('data-testid')
            .catch(() => '<no status badge>');
          return `  row[${i}] status=${statusTestId} text=${JSON.stringify(text)}`;
        }),
      );
      throw new Error(
        `${(waitError as Error).message}\n` +
          `Diagnostics: rowCount=${rows.length} emptyState=${emptyState} alertText=${JSON.stringify(openErrorText)}\n` +
          rowDumps.join('\n'),
      );
    }

    // Defensive: fail loudly, not silently restore/skip the wrong entry, on a title/date collision.
    const targetRows = await findTargetRows();
    expect(targetRows.length).toBe(1);
    await targetRows[0].$('input[type="checkbox"]').click();

    await $('[data-testid="backup-inspect-restore-button"]').waitForClickable({ timeout: 5000 });
    await $('[data-testid="backup-inspect-restore-button"]').click();
    await $('[data-testid="backup-inspect-success"]').waitForDisplayed({ timeout: 10000 });

    // ── 5. Close both dialogs and confirm the entry is back in the live editor ──
    await browser.keys(['Escape']); // close the inspect dialog
    await $('[data-testid="backup-inspect-dialog"]').waitForDisplayed({
      timeout: 5000,
      reverse: true,
    });
    await browser.keys(['Escape']); // close Preferences
    await $('[data-testid="preferences-overlay"]').waitForDisplayed({
      timeout: 5000,
      reverse: true,
    });

    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === ENTRY_TITLE,
      { timeout: 20000, timeoutMsg: `Restored title "${ENTRY_TITLE}" did not load within 20s` },
    );
    // Exact equality (modulo surrounding whitespace), not `.includes()`: a corrupted body that
    // merely contains ENTRY_BODY as a substring (e.g. old content spliced around freshly typed
    // text on a stateful rerun — see the write-step clear above) must fail this check, not pass
    // it. `.trim()` only tolerates a leading/trailing whitespace difference between WebKitGTK
    // (CI) and msedgedriver's (local) getText() rendering — it does not weaken the corruption
    // guard, since the splice pattern this guards against inserts text in the interior, not at
    // the edges.
    await browser.waitUntil(
      async () => ((await $('.ProseMirror').getText()) ?? '').trim() === ENTRY_BODY,
      {
        timeout: 20000,
        timeoutMsg: 'Restored body did not load within 20s',
      },
    );
  });
});
