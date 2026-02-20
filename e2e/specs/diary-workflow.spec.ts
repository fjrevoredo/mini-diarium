/**
 * E2E test: Core diary workflow
 *
 * Exercises the full app stack (real Tauri binary + real SQLite DB) as a user would:
 *   create diary → write an entry → lock → unlock → verify persistence
 *
 * Prerequisites:
 *   - `bun run tauri build --` must have been run
 *   - `tauri-driver` must be installed (`cargo install tauri-driver`)
 *   - Run via: `bun run test:e2e`
 */

const TEST_PASSWORD = 'e2e-test-password-123';
const TEST_TITLE = 'E2E Test Entry';
const TEST_BODY = 'This entry was written by the E2E test suite.';

// Fixed day within the month the calendar opens on. Day 15 exists in every
// month, is never a future date, and is computed once (at module load) so the
// value cannot drift if a test run crosses midnight.
const now = new Date();
const TEST_DATE = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

describe('Core diary workflow', () => {
  it('creates diary, writes an entry, locks, and verifies persistence after unlock', async () => {
    // Navigate to the app — session connects before the window finishes loading its URL
    await browser.url('tauri://localhost');

    // Give WebView2 time to render the UI
    await browser.pause(5000);

    // 1. App starts at PasswordCreation screen (fresh temp dir = no diary yet)
    await $('[data-testid="password-create-input"]').waitForDisplayed({ timeout: 15000 });
    await $('[data-testid="password-create-input"]').setValue(TEST_PASSWORD);

    // Confirm-password field
    await $('[data-testid="password-repeat-input"]').setValue(TEST_PASSWORD);

    await $('[data-testid="create-diary-button"]').click();

    // 2. Diary created and unlocked → MainLayout is now visible
    //    Wait for the auth overlay to finish transitioning out, then click the target date
    await $(`[data-testid="calendar-day-${TEST_DATE}"]`).waitForClickable({ timeout: 10000 });
    await $(`[data-testid="calendar-day-${TEST_DATE}"]`).click();

    // 3. Write the entry title
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 5000 });
    await $('[data-testid="title-input"]').setValue(TEST_TITLE);

    // 4. Write the entry body in the TipTap ProseMirror contenteditable div
    const editor = await $('.ProseMirror');
    await editor.click();
    await browser.keys(TEST_BODY);

    // 5. Wait for autosave to flush (debounce is ~1.5 s)
    await browser.pause(2500);

    // 6. Lock the diary
    await $('[data-testid="lock-diary-button"]').click();

    // 7. Verify we are now on the unlock screen
    await $('[data-testid="password-unlock-input"]').waitForDisplayed({ timeout: 5000 });

    // 8. Unlock again to verify the entry was persisted
    await $('[data-testid="password-unlock-input"]').setValue(TEST_PASSWORD);
    await $('[data-testid="unlock-diary-button"]').click();

    // 9. selectedDate persists through lock/unlock (module-level signal), so EditorPanel
    //    auto-reloads the entry for TEST_DATE on mount — no calendar click needed.
    await $('[data-testid="title-input"]').waitForDisplayed({ timeout: 10000 });
    expect(await $('[data-testid="title-input"]').getValue()).toBe(TEST_TITLE);
  });
});
