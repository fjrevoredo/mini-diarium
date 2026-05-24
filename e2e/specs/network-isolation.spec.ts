/**
 * E2E test: Network isolation init script
 *
 * Verifies that the document-start init script (registered via
 * initialization_script_for_all_frames in lib.rs) has nulled all
 * network-capable JS globals before any page script runs.
 *
 * The check runs from the auth screen — the init script fires before
 * document parsing, so no unlock is required.
 */

const NULLED_GLOBALS: Array<string> = [
  'RTCPeerConnection',
  'WebTransport',
  'Worker',
  'SharedWorker',
];

const NULLED_NAVIGATOR: Array<string> = [
  'serviceWorker',
  'sendBeacon',
  'connection',
];

const expectMissingGlobal = (value: unknown) => {
  // WebDriver's script-result serialization can map `undefined` to `null`
  // (notably in WebView2), so both indicate an unavailable global here.
  expect(value === undefined || value === null).toBe(true);
};

describe('Network isolation init script', () => {
  it('nulls all network-capable globals before page scripts run', async () => {
    await browser.url('tauri://localhost');
    // Wait for the app to render (auth screen or main UI)
    await browser.pause(3000);

    for (const name of NULLED_GLOBALS) {
      const value = await browser
        .execute((n) => (window as unknown as Record<string, unknown>)[n], name)
        .catch(() => 'error');
      expectMissingGlobal(value);
    }

    for (const name of NULLED_NAVIGATOR) {
      const value = await browser
        .execute(
          (n) => (navigator as unknown as Record<string, unknown>)[n],
          name,
        )
        .catch(() => 'error');
      expectMissingGlobal(value);
    }

    // window.open should also be nulled
    const openVal = await browser
      .execute(() => (window as unknown as Record<string, unknown>)['open'])
      .catch(() => 'error');
    expectMissingGlobal(openVal);
  });
});
