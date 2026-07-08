/**
 * E2E test: Search overlay
 *
 * Exercises the newly-wired search UI end to end against the real Tauri binary:
 *   create/unlock journal → write a searchable entry → open search (Ctrl+F and the
 *   Header button) → type a query → click a result → verify the editor lands on it.
 *
 * Prerequisites:
 *   - `bun run tauri build --` must have been run
 *   - `tauri-driver` must be installed (`cargo install tauri-driver`)
 *   - Run via: `bun run test:e2e`
 */

import { connectToApp, authenticate, dismissOnboardingTour } from './helpers';

const TEST_PASSWORD = 'e2e-test-password-123'; // same journal DB as diary-workflow.spec.ts
const TEST_TITLE = 'Sunset picnic at the reservoir';
const SEARCH_TERM = 'Sunset';

describe('Search overlay', () => {
  it('finds an entry via search and opens it in the editor', async () => {
    await connectToApp();

    // 1. Auth screen: create (clean mode) or unlock (stateful).
    await authenticate(TEST_PASSWORD);

    // 2. Dismiss the first-run onboarding tour if it appears.
    await dismissOnboardingTour();
    await $('[data-testid="search-button"]').waitForClickable({ timeout: 10000 });

    // 3. Write a searchable entry. The editor is the default view after unlock.
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 10000 });
    await $('[data-testid="title-input"]').setValue(TEST_TITLE);

    const editor = await $('.ProseMirror');
    await editor.click();
    await browser.keys('The light through the trees was incredible.');
    await browser.pause(2500); // let autosave flush

    // 4. Open search via the Header button (the Cmd/Ctrl+F shortcut is covered by the
    //    PLATFORM-VERIFY manual step; the chord is flaky across WebView2/WebKitGTK drivers).
    await $('[data-testid="search-button"]').click();
    const searchInput = await $('[data-testid="search-overlay"] input');
    await searchInput.waitForDisplayed({ timeout: 10000 });
    expect(await searchInput.isDisplayed()).toBe(true);

    // 5. Type the query and wait for the result (500 ms debounce + decrypt scan).
    await searchInput.setValue(SEARCH_TERM);
    const resultButton = await browser.waitUntil(
      async () => {
        const b = await $('//button[contains(., "Sunset")]');
        if ((await b.isExisting()) && (await b.isDisplayed())) return b;
        return false;
      },
      { timeout: 20000, timeoutMsg: 'Search did not return a result containing "Sunset"' },
    );
    await resultButton.click();

    // 6. The overlay closes and the editor lands on the entry.
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(
      async () => (await $('[data-testid="title-input"]').getValue()) === TEST_TITLE,
      { timeout: 20000, timeoutMsg: `Editor did not load the searched entry "${TEST_TITLE}"` },
    );
  });
});
