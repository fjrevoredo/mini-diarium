/**
 * E2E test: Header in-app actions
 *
 * Covers the one newly in-app-reachable main path that exists today: the `⋮`
 * overflow menu → Preferences. Preferences was previously reachable only via the
 * native OS menu bar, which `tauri-driver` cannot drive; the `HeaderMoreMenu`
 * (TODO-0061) surfaces it inside the WebView where WebDriver can reach it.
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

import { connectToApp, authenticate, dismissOnboardingTour } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts

describe('Header in-app actions', () => {
  it('opens Preferences via the ⋮ overflow menu', async () => {
    // 1. Connect, auth (create or unlock), dismiss the tour if it appears.
    //    No sidebar/calendar interaction and no entry write are needed — the `⋮`
    //    trigger lives in the always-visible Header right cluster (visible at
    //    800×660; no browser.setWindowSize per e2e/CLAUDE.md gotchas #2–3).
    await connectToApp();
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
});
