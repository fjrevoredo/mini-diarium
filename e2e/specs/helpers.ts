/**
 * Shared E2E helpers
 *
 * Hoisted from the auth/onboarding boilerplate that was copy-pasted across
 * `diary-workflow`, `search`, and `multi-entry`. Named `helpers.ts` (not a
 * `.spec.ts` file) so wdio's spec glob skips it while `e2e/tsconfig.json`
 * (which includes every `.ts` under `specs/`) still type-checks it.
 *
 * These functions rely on the wdio ambient globals (`browser`, `$`) — the same
 * ones the specs use — which resolve from the shared `e2e/tsconfig.json`
 * (`types: ["node", "webdriverio/async"]`). No per-file setup or extra imports.
 *
 * E2E session model: each spec file gets a fresh WebDriver session, so
 * tauri-driver launches a fresh (empty in-memory `DiaryState`) app process per
 * file. The journal DB lives on the shared on-disk temp dir, so every spec file
 * starts LOCKED. `authenticate()` therefore handles both the first-run
 * create+tour path and the subsequent unlock path — do not rely on cross-file
 * session state.
 */

/**
 * Navigate to the app URL and wait for the WebView to render.
 *
 * The WebDriver session connects before the window finishes loading its URL, so
 * a fixed pause lets WebView2/WebKitGTK paint the initial UI (auth screen).
 */
export async function connectToApp(): Promise<void> {
  // Session connects before the window finishes loading its URL.
  await browser.url('tauri://localhost');
  // Give the WebView time to render the UI.
  await browser.pause(5000);
}

/**
 * Enable (or disable) a runtime feature flag, then reload so it takes effect.
 *
 * `src/state/feature-flags.ts` reads `localStorage['feature-flags']` once at
 * module-init (`createSignal(loadFlags())`), so seeding the key is not enough on
 * its own — the WebView must reload for the fresh value to be picked up. Call
 * this AFTER `connectToApp()` but BEFORE `authenticate()`: the reload lands back
 * on the (still locked) auth screen, so no unlock state is lost.
 */
export async function setFeatureFlag(flag: string, enabled: boolean): Promise<void> {
  await browser.execute(
    (key: string, f: string, on: boolean) => {
      let current: Record<string, unknown> = {};
      try {
        current = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {
        current = {};
      }
      current[f] = on;
      localStorage.setItem(key, JSON.stringify(current));
    },
    'feature-flags',
    flag,
    enabled,
  );
  // Reload so feature-flags.ts re-reads localStorage at module-init.
  await browser.url('tauri://localhost');
  await browser.pause(5000);
}

/**
 * Detect the auth screen and run the correct branch:
 *   - PasswordCreation (no journal yet — clean mode always, stateful first run)
 *   - PasswordPrompt   (journal exists — subsequent runs)
 *
 * Order-independent: works whichever spec file runs first, because each file's
 * fresh process starts locked (see the session-model note above).
 */
export async function authenticate(password: string): Promise<void> {
  const authScreen = await browser.waitUntil(
    async () => {
      const create = await $('[data-testid="password-create-input"]')
        .isDisplayed()
        .catch(() => false);
      const unlock = await $('[data-testid="password-unlock-input"]')
        .isDisplayed()
        .catch(() => false);
      if (create) return 'create' as const;
      if (unlock) return 'unlock' as const;
      return false;
    },
    {
      timeout: 10000,
      timeoutMsg: 'Neither password-create-input nor password-unlock-input appeared',
    },
  );

  if (authScreen === 'create') {
    await $('[data-testid="password-create-input"]').setValue(password);
    await $('[data-testid="password-repeat-input"]').setValue(password);
    await $('[data-testid="create-journal-button"]').click();
  } else {
    await $('[data-testid="password-unlock-input"]').setValue(password);
    await $('[data-testid="unlock-journal-button"]').click();
  }
}

/**
 * Dismiss the first-run onboarding tour if it appears (only on journal creation).
 *
 * The tour mounts asynchronously after `startOnboarding()` fires, so we first
 * wait up to 3 s for the button to appear in DOM before deciding whether the
 * tour is present. `browser.execute()` fires native JS clicks (bypassing the
 * spotlight overlay's z-50 stacking interference with WebDriver's
 * click-interception check), and `waitForExist({ reverse: true })` polls until
 * the button is actually removed from the DOM.
 */
export async function dismissOnboardingTour(): Promise<void> {
  const nextBtn = $('[data-testid="onboarding-next-btn"]');
  const tourPresent = await nextBtn
    .waitForExist({ timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (tourPresent) {
    for (let i = 0; i < 3; i++) {
      await browser.execute(() => {
        (document.querySelector('[data-testid="onboarding-next-btn"]') as HTMLElement)?.click();
      });
    }
    await nextBtn.waitForExist({ timeout: 5000, reverse: true });
  }
}
