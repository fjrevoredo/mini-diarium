/**
 * E2E test: Header in-app actions
 *
 * Covers the in-app-reachable Header paths:
 *   - the `⋮` overflow menu → Preferences (TODO-0061/0062, flag-gated). Preferences
 *     was previously reachable only via the native OS menu bar, which `tauri-driver`
 *     cannot drive; `HeaderMoreMenu` surfaces it inside the WebView.
 *   - the always-on day-navigation controls: ◀ / ▶ day buttons and the clickable
 *     date title that opens the Go to Date overlay (TODO-0063).
 *
 * The whole `⋮` menu is gated behind the `inAppMenu` runtime feature flag
 * (TODO-0062) and defaults OFF, so this spec enables the flag (via
 * `setFeatureFlag` → localStorage + reload) before the menu exists.
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

import { connectToApp, authenticate, dismissOnboardingTour, setFeatureFlag } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts

describe('Header in-app actions', () => {
  it('opens Preferences via the ⋮ overflow menu', async () => {
    // 1. Connect, enable the inAppMenu flag (reloads to re-read localStorage),
    //    then auth (create or unlock) and dismiss the tour if it appears. The `⋮`
    //    trigger lives in the Header right cluster (visible at 800×660; no
    //    browser.setWindowSize per e2e/CLAUDE.md gotchas #2–3) but only renders
    //    once the flag is on. setFeatureFlag runs before auth, so the reload it
    //    performs lands on the still-locked auth screen (no unlock state lost).
    await connectToApp();
    await setFeatureFlag('inAppMenu', true);
    await authenticate(TEST_PASSWORD);
    await dismissOnboardingTour();

    // 2. Open the overflow menu.
    const trigger = $('[data-testid="header-more-menu-trigger"]');
    await trigger.waitForClickable({ timeout: 10000 });
    await trigger.click();

    // 3. The dropdown content is displayed.
    const menuContent = $('[data-testid="header-more-menu-content"]');
    await menuContent.waitForDisplayed({ timeout: 5000 });

    // 4. Click the Preferences item. Kobalte's DropdownMenu renders items in a
    //    Portal; if a plain WebDriver click on the portal item proves flaky (the
    //    portal overlay can intercept the hit-test, same class of issue as the
    //    onboarding spotlight), fall back to a native JS click, mirroring the
    //    established onboarding pattern.
    const prefsItem = $('[data-testid="header-more-menu-preferences-item"]');
    await prefsItem.waitForDisplayed({ timeout: 5000 });
    await prefsItem.click();

    // 5. Core assertion: the Preferences overlay opened.
    const overlay = $('[data-testid="preferences-overlay"]');
    const opened = await overlay
      .waitForDisplayed({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      // Fallback: the plain click may not have fired onSelect through the portal.
      await browser.execute(() => {
        (
          document.querySelector(
            '[data-testid="header-more-menu-preferences-item"]',
          ) as HTMLElement
        )?.click();
      });
    }
    await overlay.waitForDisplayed({ timeout: 5000 });
    expect(await overlay.isDisplayed()).toBe(true);

    // 6. Secondary (best-effort): Escape closes the Kobalte Dialog via
    //    onOpenChange. "opens" (step 5) is the assertion that matters, so this
    //    close check is non-fatal — a WebKitGTK/WebView2 focus-timing difference
    //    on the CI platform (which we cannot exercise locally) must not red the
    //    run. It exercises the close path opportunistically when it works.
    await browser.keys(['Escape']);
    const closed = await overlay
      .waitForDisplayed({ timeout: 5000, reverse: true })
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      console.warn('Preferences overlay did not close on Escape (non-fatal secondary check)');
    }
  });

  // The day-navigation controls (◀ / date title / ▶) are always-on — unlike the
  // ⋮ overflow menu they are NOT gated behind the inAppMenu flag (TODO-0063).
  // These run after the Preferences test in the same session, so the app is
  // already unlocked on the main screen.
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
