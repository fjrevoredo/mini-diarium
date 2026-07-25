/**
 * E2E test: Header in-app actions
 *
 * Covers the in-app-reachable Header paths:
 *   - the `⋮` overflow menu → Preferences / Statistics / Import / Export
 *     (TODO-0061/0062). These were previously reachable only via the native OS
 *     menu bar, which `tauri-driver` cannot drive; `HeaderMoreMenu` surfaces them
 *     inside the WebView. Statistics/Import/Export are shallow "overlay opens"
 *     smoke checks (TODO-0064-01 scope discipline), not feature suites.
 *   - the day-navigation controls: ◀ / ▶ day buttons and the clickable date title
 *     that opens the Go to Date overlay (TODO-0063).
 *   - one keyboard-shortcut smoke check (TODO-0065). The native menu was reduced
 *     to Preferences + Quit and its accelerators were re-implemented as JS keydown
 *     handlers (`src/lib/keyboard-shortcuts.ts`); this is the only place that
 *     proves the JS layer really replaced the OS accelerators in a real WebView.
 *
 * The `⋮` menu is unconditional since the `inAppMenu` feature flag graduated
 * (TODO-0065) — no flag seeding is needed before it exists.
 *
 * Session model: each spec file gets a fresh (locked) app process, so this file
 * starts at the auth screen regardless of spec order — unlock branch if the
 * shared journal already exists on disk, create branch (+ tour) if this file
 * happens to run first. `authenticate()` handles both.
 *
 * Prerequisites:
 *   - `bun run tauri build --` must have been run
 *   - `tauri-driver` must be installed (`cargo install tauri-driver`)
 *   - Run via: `bun run test:e2e`
 */

import { Key } from 'webdriverio';
import { connectToApp, authenticate, dismissOnboardingTour } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts

/**
 * Open the `⋮` overflow menu, click one item, and assert its overlay opens.
 *
 * Shared by every `⋮` → overlay smoke check so the near-identical open/click/
 * assert bodies are not copy-pasted (SonarCloud `new_duplicated_lines_density`
 * gate, root CLAUDE.md Gotcha #5). Assumes the session is already unlocked (the
 * first `it` in the describe block establishes that and the rest reuse the
 * session). Leaves the overlay closed on exit so the next check starts clean.
 */
async function assertMenuItemOpensOverlay(itemTestId: string, overlayTestId: string) {
  const trigger = $('[data-testid="header-more-menu-trigger"]');
  await trigger.waitForClickable({ timeout: 10000 });
  await trigger.click();

  await $('[data-testid="header-more-menu-content"]').waitForDisplayed({ timeout: 5000 });

  const item = $(`[data-testid="${itemTestId}"]`);
  await item.waitForDisplayed({ timeout: 5000 });
  await item.click();

  const overlay = $(`[data-testid="${overlayTestId}"]`);
  const opened = await overlay
    .waitForDisplayed({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    // Kobalte renders menu items in a Portal; a plain WebDriver click can miss
    // through the portal overlay's hit-test. Fall back to a native JS click,
    // the same pattern the onboarding spec and Preferences check established.
    await browser.execute((id) => {
      (document.querySelector(`[data-testid="${id}"]`) as HTMLElement)?.click();
    }, itemTestId);
  }
  await overlay.waitForDisplayed({ timeout: 5000 });
  expect(await overlay.isDisplayed()).toBe(true);

  // Leave the session clean for the next check. Close is best-effort — "opens"
  // is the assertion that matters; a WebKitGTK/WebView2 focus-timing difference
  // on the close path must not red the run.
  await browser.keys(['Escape']);
  await overlay.waitForDisplayed({ timeout: 5000, reverse: true }).catch(() => {});
}

describe('Header in-app actions', () => {
  it('opens Preferences via the ⋮ overflow menu', async () => {
    // 1. Connect, auth (create or unlock), dismiss the tour if it appears. The `⋮`
    //    trigger lives in the Header right cluster (visible at 800×660; no
    //    browser.setWindowSize per e2e/CLAUDE.md gotchas #2–3) and always renders.
    await connectToApp();
    await authenticate(TEST_PASSWORD);
    await dismissOnboardingTour();

    // 2. Open the ⋮ menu → Preferences and assert its overlay opens (helper
    //    handles open/click/assert + Escape cleanup).
    await assertMenuItemOpensOverlay('header-more-menu-preferences-item', 'preferences-overlay');
  });

  // The remaining ⋮ → overlay checks are shallow "opens" smoke checks
  // (TODO-0064-01 scope discipline), not feature suites. They run after the
  // Preferences test in the same session — the app is already unlocked on the
  // main screen, so no new auth is needed.
  // Opening Import/Export only calls setIs*Open(true); the native OS file dialog
  // fires on in-overlay buttons, not on mount, so focus-loss auto-lock is not a
  // concern for a mere "opens" check.
  it('opens Statistics via the ⋮ overflow menu', async () =>
    assertMenuItemOpensOverlay('header-more-menu-statistics-item', 'stats-overlay'));

  it('opens Import via the ⋮ overflow menu', async () =>
    assertMenuItemOpensOverlay('header-more-menu-import-item', 'import-overlay'));

  it('opens Export via the ⋮ overflow menu', async () =>
    assertMenuItemOpensOverlay('header-more-menu-export-item', 'export-overlay'));

  // The day-navigation controls (◀ / date title / ▶) landed in TODO-0063. These
  // run after the Preferences test in the same session, so the app is already
  // unlocked on the main screen.
  it('moves the day forward and back via the ◀ / ▶ Header buttons', async () => {
    const dateTitle = $('[data-testid="header-date-title"]');
    await dateTitle.waitForDisplayed({ timeout: 10000 });
    const before = await dateTitle.getText();

    // Previous day: the title text must change.
    const prev = $('[data-testid="header-prev-day-button"]');
    await prev.waitForClickable({ timeout: 5000 });
    await prev.click();
    await browser.waitUntil(async () => (await dateTitle.getText()) !== before, {
      timeout: 5000,
      timeoutMsg: 'Header date title did not change after clicking Previous day',
    });
    const afterPrev = await dateTitle.getText();
    expect(afterPrev).not.toBe(before);

    // Next day returns to the original date.
    const next = $('[data-testid="header-next-day-button"]');
    await next.waitForClickable({ timeout: 5000 });
    await next.click();
    await browser.waitUntil(async () => (await dateTitle.getText()) === before, {
      timeout: 5000,
      timeoutMsg: 'Header date title did not return to the original date after clicking Next day',
    });
    expect(await dateTitle.getText()).toBe(before);
  });

  // The one keyboard-shortcut check (TODO-0065). Ctrl+[ used to be an OS-level
  // menu accelerator that fired before the WebView saw the keystroke; it is now a
  // JS keydown handler, and only a real WebView run can prove the swap works.
  // Ctrl+] restores the original date so later checks start where they expect.
  it('moves the day back via the Ctrl+[ keyboard shortcut', async () => {
    const dateTitle = $('[data-testid="header-date-title"]');
    await dateTitle.waitForDisplayed({ timeout: 10000 });
    const before = await dateTitle.getText();

    await browser.keys([Key.Ctrl, '[']);
    await browser.waitUntil(async () => (await dateTitle.getText()) !== before, {
      timeout: 5000,
      timeoutMsg: 'Header date title did not change after pressing Ctrl+[',
    });
    expect(await dateTitle.getText()).not.toBe(before);

    await browser.keys([Key.Ctrl, ']']);
    await browser.waitUntil(async () => (await dateTitle.getText()) === before, {
      timeout: 5000,
      timeoutMsg: 'Header date title did not return to the original date after pressing Ctrl+]',
    });
  });

  it('opens the Go to Date overlay when the Header date title is clicked', async () => {
    const dateTitle = $('[data-testid="header-date-title"]');
    await dateTitle.waitForClickable({ timeout: 10000 });
    await dateTitle.click();

    // GoToDateOverlay has no data-testid; its date input (#date-input) is a
    // stable, unique marker that the dialog rendered.
    const dateInput = $('#date-input');
    await dateInput.waitForDisplayed({ timeout: 5000 });
    expect(await dateInput.isDisplayed()).toBe(true);

    // Close it again so the session is left clean for any later tests.
    await browser.keys(['Escape']);
    await dateInput
      .waitForDisplayed({ timeout: 5000, reverse: true })
      .catch(() => console.warn('Go to Date overlay did not close on Escape (non-fatal)'));
  });
});
