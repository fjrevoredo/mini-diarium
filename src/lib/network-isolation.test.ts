import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NETWORK_ISOLATION_SCRIPT } from './network-isolation-script';

/**
 * These tests actually EXECUTE the isolation script against sandbox `window` /
 * `navigator` objects and assert the dangerous globals end up neutralized. A
 * plain `.toContain('RTCPeerConnection')` string check would still pass if the
 * identifier only survived in a comment or the `kill()` call were deleted — this
 * script is security-critical, so we verify behavior, not text.
 *
 * The Tauri runtime injects a SEPARATE, hand-duplicated copy of the same script
 * (the `NETWORK_ISOLATION_SCRIPT` Rust constant in `src-tauri/src/lib.rs`). The
 * two files carry "keep in sync" comments but nothing enforced it, so this suite
 * extracts the Rust copy and runs it through the same behavioral checks — if the
 * two drift in what they neutralize, these tests fail.
 *
 * The script must never run against the real jsdom `window` (it defines
 * non-configurable properties that would leak into every other test), so we run
 * it inside a fresh Function scope with our own `window`/`navigator` bindings.
 */
function runScript(script: string): {
  win: Record<string, unknown>;
  nav: Record<string, unknown>;
} {
  const win: Record<string, unknown> = {
    RTCPeerConnection: class {},
    webkitRTCPeerConnection: class {},
    mozRTCPeerConnection: class {},
    RTCSessionDescription: class {},
    WebTransport: class {},
    open: () => 'opened',
    Worker: class {},
    SharedWorker: class {},
    // Intentionally preserved (Tauri IPC / dev server depend on them).
    fetch: () => 'fetched',
    XMLHttpRequest: class {},
    WebSocket: class {},
    EventSource: class {},
  };
  const nav: Record<string, unknown> = {
    serviceWorker: {},
    sendBeacon: () => true,
    connection: {},
  };

  // Execute the trusted, in-repo isolation constant in an isolated Function
  // scope — that it runs at all is the point: it proves the neutralization works.
  const runner = new Function('window', 'navigator', script);
  runner(win, nav);

  return { win, nav };
}

/**
 * Extracts the `NETWORK_ISOLATION_SCRIPT` raw-string literal from the Rust
 * source so we can run the exact bytes the WebView injects at runtime.
 */
function extractRustIsolationScript(): string {
  const rustSource = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf-8');
  const match = rustSource.match(/const NETWORK_ISOLATION_SCRIPT: &str = r#"([\s\S]*?)"#;/);
  if (!match) {
    throw new Error(
      'Could not find NETWORK_ISOLATION_SCRIPT in src-tauri/src/lib.rs — did the constant move or change delimiters?',
    );
  }
  return match[1];
}

const NEUTRALIZED_WINDOW = [
  'RTCPeerConnection',
  'webkitRTCPeerConnection',
  'mozRTCPeerConnection',
  'RTCSessionDescription',
  'WebTransport',
  'open',
  'Worker',
  'SharedWorker',
];

const NEUTRALIZED_NAVIGATOR = ['serviceWorker', 'sendBeacon', 'connection'];

const PRESERVED_WINDOW = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];

// Both the frontend copy and the Rust runtime copy must neutralize/preserve the
// exact same APIs. Running the identical behavioral suite over both is the drift
// guard: divergence in either direction fails here.
describe.each([
  ['frontend (network-isolation-script.ts)', () => NETWORK_ISOLATION_SCRIPT],
  ['rust runtime (src-tauri/src/lib.rs)', extractRustIsolationScript],
])('network-isolation-script — %s', (_label, getScript) => {
  it.each(NEUTRALIZED_WINDOW)('neutralizes window.%s to undefined', (prop) => {
    const { win } = runScript(getScript());
    expect(win[prop]).toBeUndefined();
  });

  it.each(NEUTRALIZED_NAVIGATOR)('neutralizes navigator.%s to undefined', (prop) => {
    const { nav } = runScript(getScript());
    expect(nav[prop]).toBeUndefined();
  });

  it('makes the neutralized properties non-writable and non-configurable', () => {
    const { win } = runScript(getScript());
    const descriptor = Object.getOwnPropertyDescriptor(win, 'RTCPeerConnection');
    expect(descriptor).toMatchObject({ writable: false, configurable: false, value: undefined });
  });

  it.each(PRESERVED_WINDOW)('leaves window.%s intact', (prop) => {
    const { win } = runScript(getScript());
    expect(win[prop]).toBeTypeOf('function');
  });

  it('leaves fetch callable (not just defined)', () => {
    const { win } = runScript(getScript());
    expect((win.fetch as () => string)()).toBe('fetched');
  });
});
