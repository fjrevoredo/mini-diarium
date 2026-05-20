# Network Isolation Plan Review

**Reviewed plan:** `docs/network-isolation-plan.md`  
**Review date:** 2026-05-19  
**Review scope:** Fit against `PHILOSOPHY.md`, `SECURITY.md`, current repository state, Tauri v2 best practices, Rust best practices, and cross-platform network-isolation controls.

## Executive Verdict

The plan is directionally correct: it adds useful WebView-layer defenses (`on_navigation`, stricter CSP, document-start script, popup denial), recognizes Flatpak as the strongest Linux distribution target, and includes a Windows firewall concept. However, in its current form it does **not** fully satisfy the stated goal: "Mini Diarium cannot make any outbound network request under any circumstances."

The plan has three blocking gaps:

1. It omits the existing `@tauri-apps/plugin-opener` capability and multiple `openUrl(...)` call sites that intentionally launch external URLs.
2. It relies on `WebviewWindowBuilder::on_web_resource_request` to block external HTTP(S), but Tauri documents that this hook is currently only implemented for the `tauri` URI protocol and is not executed for external URLs.
3. It does not provide OS-level network denial for macOS `.app`/DMG builds, Linux AppImage/deb builds, or WebView2 child processes on Windows.

The plan should move from "ready for approval" back to "revision required" before implementation.

## Blockers

### B1 - Remove Or Redesign External URL Opening

**Problem:** The current app grants `opener:default` in `src-tauri/capabilities/default.json` and initializes `tauri_plugin_opener` in `src-tauri/src/lib.rs`. The frontend calls `openUrl(...)` in:

- `src/components/overlays/AboutOverlay.tsx`
- `src/components/overlays/NotificationsOverlay.tsx`
- `src/components/overlays/OnboardingOverlay.tsx`
- `src/components/overlays/preferences/PreferencesAdvancedTab.tsx`

The plan does not address this at all. Tauri's opener API is specifically for opening a URL with the system default app. Even if the network traffic occurs in the user's browser instead of the Mini Diarium process, Mini Diarium is still initiating a network-capable action. That conflicts with the stronger claims in `PHILOSOPHY.md` and `SECURITY.md`.

**Action:** Add a new milestone before CSP hardening:

- Remove `tauri_plugin_opener::init()` from `src-tauri/src/lib.rs`.
- Remove `"opener:default"` from `src-tauri/capabilities/default.json`.
- Replace all `openUrl(...)` buttons with copy-only URL affordances or local bundled documentation.
- Remove or rewrite tests that expect `openUrl(...)`.
- Add a static test that fails if `openUrl`, `@tauri-apps/plugin-opener`, or `opener:` reappears under `src/` or `src-tauri/`.

**Fallback if you keep it:** Document an explicit exception: "user-clicked help links open in the system browser." That would be more honest, but it weakens the "no network access" product promise.

**Sources:** Tauri opener `openUrl()` opens URLs in the system default app; Tauri capabilities are the permission boundary for webview access to plugins.

### B2 - Replace Task 3.2: `on_web_resource_request` Does Not Block External HTTP(S)

**Problem:** Task 3.2 says `on_web_resource_request` will return an empty 403 for any HTTP(S) WebView2 request. Tauri's own docs say this hook is currently only implemented for the `tauri` URI protocol and is not executed for external URLs.

That means Task 3.2 cannot accomplish its stated objective. It may harden CSP headers for local app assets, but it is not an external network firewall.

**Action:** Replace Task 3.2 with one of these:

- Preferred: delete Task 3.2 as an external-network blocker and rely on CSP, init script, `on_navigation`, `on_new_window`, and OS-level controls.
- If a Windows WebView2 subresource interceptor is required, implement the native WebView2 `WebResourceRequested` event via `with_webview()` and direct WebView2 bindings, with tight `#[cfg(windows)]`, documented `unsafe`, and tests on Windows.
- Update validation so `fetch('https://example.com')` is not considered proof for `on_web_resource_request`; it should be verified with network instrumentation.

**Sources:** Tauri `on_web_resource_request` docs; Microsoft WebView2 `WebResourceRequested` and `NewWindowRequested` docs.

### B3 - The Windows Firewall Rule May Not Block WebView2 Runtime Traffic

**Problem:** Task 4.1 proposes a rule for `$INSTDIR\mini-diarium.exe` and says this is the only mechanism that blocks WebView2's own outbound traffic. That is not established. WebView2 runs browser subprocesses from the Microsoft Edge WebView2 runtime, so network traffic may be attributed to WebView2 runtime executables rather than `mini-diarium.exe`.

The plan's claim is too strong without proof. It risks giving users a false sense that WebView2 SmartScreen, certificate revocation, or other runtime traffic is blocked.

**Action:** Split Task 4.1 into two tasks:

- `4.1a` - Add the firewall rule for `mini-diarium.exe` and validate it blocks Rust-process outbound sockets.
- `4.1b` - Empirically identify WebView2 network process attribution on Windows using Windows Defender Firewall logs, Resource Monitor, ProcMon, or equivalent. Only document "blocks WebView2 internal traffic" if the rule demonstrably does.

If WebView2 traffic is attributed to shared runtime binaries, do **not** add broad firewall rules for `msedgewebview2.exe`; that could break unrelated applications. Instead, document the limitation and rely on WRY/Tauri default browser args where applicable. Tauri documents that WRY passes `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` by default unless overridden.

**Sources:** Microsoft `netsh advfirewall` supports outbound block rules; Tauri documents WRY's default WebView2 feature-disabling args and warns that overriding browser args requires preserving them.

### B4 - macOS And Non-Flatpak Linux Are Not OS-Isolated

**Problem:** The plan verifies Flatpak lacks `--share=network`, which is good, but Mini Diarium also ships DMG, `.app`, AppImage, and deb targets. Those builds do not get Flatpak's network namespace. The macOS non-goal says no sandbox entitlements are needed because the app does not grant network access, but an unsandboxed `.app` has normal process network access.

**Action:** Adjust the goal or add platform work:

- For macOS: evaluate shipping a sandboxed `.app` with `com.apple.security.app-sandbox=true` and no `com.apple.security.network.client` entitlement. If this is not compatible with current distribution or file access, document that macOS OS-level outbound denial is not provided.
- For Linux AppImage/deb: either stop claiming OS-level isolation for these targets or add documented launcher profiles for users who want hard isolation (for example Firejail/bubblewrap), while making Flatpak the recommended no-network Linux package.
- Update the plan's completion criteria to distinguish "WebView-layer isolation" from "OS-enforced process isolation."

**Sources:** Tauri config exposes macOS entitlements and hardened runtime separately; Flatpak network access is granted explicitly with `--share=network`.

## High Priority Corrections

### H1 - Fix The CSP Baseline And Make It Explicit

**Problem:** The plan says the app already has `connect-src 'self'`, but the current `src-tauri/tauri.conf.json` CSP does not include `connect-src`; it relies on `default-src 'self' data:` fallback.

**Action:** Change Task 1.1 to add an explicit connection policy and additional no-network directives:

```text
connect-src 'self' ipc: http://ipc.localhost;
worker-src 'none';
child-src 'none';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'none';
manifest-src 'none';
prefetch-src 'none';
```

Keep `img-src 'self' data: blob:` and `font-src 'self' data:` because the app intentionally supports embedded images and bundled fonts. Verify whether Tauri IPC needs `ipc:` or `http://ipc.localhost` in the app's current runtime; Tauri's own CSP example includes those connection sources.

**Sources:** MDN documents that `connect-src` controls `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, and `<a ping>`; Tauri recommends tailoring CSP and keeping it as restrictive as possible.

### H2 - The Init Script Needs Real Execution Tests, Not String Tests

**Problem:** Task 2.2 only asserts that a string contains keywords. That does not verify the script runs early, applies to all frames, freezes properties correctly, or remains synchronized with the Rust builder string.

**Action:** Replace or augment Task 2.2:

- Store the script in a single source file and include it from Rust at compile time with `include_str!`, or generate the Rust constant from the TypeScript source during build. Avoid maintaining two independent copies.
- Add a browser/E2E test that evaluates `fetch`, `WebSocket`, `RTCPeerConnection`, `Worker`, `SharedWorker`, `EventSource`, `XMLHttpRequest`, `navigator.sendBeacon`, `navigator.serviceWorker`, and `window.open` in the actual Tauri WebView.
- Include iframe coverage because Tauri's all-frames init script is intended to run in subframes too.
- Add `Worker`, `SharedWorker`, and `navigator.connection` to the review list. `worker-src 'none'` should be the primary worker control, but the init script should also remove worker constructors for defense in depth.

**Sources:** Tauri documents that `initialization_script_for_all_frames` runs after the global object is created but before document parsing and before page scripts, and applies to main and subframes.

### H3 - Avoid Relying On Transitive Rust Dependencies For Platform Interop

**Problem:** The plan says `webview2-com`, `objc2`, and `objc2-web-kit` can be used as transitive dependencies. Rust best practice is to declare crates that this crate imports directly. Relying on transitive dependencies makes the code brittle across Tauri/WRY updates and can fail under Cargo's public/private dependency checks or future dependency graph changes.

**Action:** If platform-native interop remains in scope, add target-specific direct dependencies in `src-tauri/Cargo.toml`:

- Windows: direct WebView2 bindings actually used by the code.
- macOS: direct `objc2-web-kit`, plus any `objc2-foundation`/`block2` features required for `WKContentRuleListStore`.

Every `unsafe` block must have a local `SAFETY:` comment that states the object lifetime, thread/main-actor assumption, selector validity, and callback ownership model.

### H4 - Gate Or Remove Release DevTools

**Problem:** `tauri = { version = "2.11.1", features = ["devtools"] }` enables WebView devtools support for release builds. For a privacy/security-focused desktop app, release devtools increase the exposed inspection/control surface and make manual network probes easier in production.

**Action:** Add a plan task to remove the `devtools` feature from release builds or gate it behind a non-default development feature. Verify release builds no longer expose devtools.

**Source:** Tauri documents that devtools work in debug builds by default but require the `devtools` feature for release.

## Medium Priority Improvements

### M1 - Turn "Rust Process Makes No Network Calls" Into A CI-Enforced Rule

**Problem:** The plan leaves Rust process network isolation as a design invariant. The project already promises that no HTTP client exists, so this should be machine-checked.

**Action:** Add a script and CI/local validation task that fails on:

- Rust crates: `reqwest`, `hyper`, `ureq`, `isahc`, `surf`, `curl`, `native-tls`, `rustls`, `tokio-tungstenite`, `async-tungstenite`, `websocket`, broad `socket2` use unless explicitly justified.
- Tauri plugins: `http`, `websocket`, `upload`, `updater`, `localhost`, `shell` URL-opening scopes, `opener`.
- Frontend APIs: `fetch(`, `new WebSocket`, `EventSource`, `sendBeacon`, `openUrl`, HTTP(S) external image/link loaders under the app `src/` tree.

This should be a dedicated check, not only reviewer memory.

### M2 - Add Network Instrumentation To Final Verification

**Problem:** The current manual validations mostly test JS globals and UI behavior. They do not prove that no packet left the machine.

**Action:** Add platform-specific verification:

- Windows: run the packaged app with Windows Firewall logging enabled and with a local packet monitor. Exercise drag/drop, app start, unlock, help/about/notifications, import/export, and editor image workflows.
- macOS: use `tcpdump`/Little Snitch-style tooling or `lsof -i` during the same workflows.
- Linux Flatpak: run `flatpak run` and verify no `--share=network`; additionally confirm socket attempts fail inside the sandbox.
- Linux AppImage/deb: document that no OS-level network namespace exists unless running under an external sandbox.

### M3 - Make Localhost Allowances Build-Mode Specific

**Problem:** Multiple plan snippets allow `localhost`, `127.0.0.1`, and `tauri.localhost`. That is necessary for Vite dev mode, but production should not allow arbitrary local HTTP endpoints unless Tauri requires a local custom-protocol host.

**Action:** Use build-mode guards:

- Dev: allow the exact Vite origin from `build.devUrl`, currently `http://localhost:1420`.
- Production: allow only the exact Tauri app/custom protocol origins actually used by the packaged app.
- Tests: assert that `http://localhost:1420` is not allowed in production navigation logic.

### M4 - Document Packaging Guarantees Per Target

**Problem:** The plan treats "multi-platform defense in depth" as one uniform outcome, but the packages have different enforcement levels.

**Action:** Add a matrix to the plan and final docs:

| Target | WebView CSP/init/navigation | Plugin opener removed | OS network block | Residual limitation |
|---|---:|---:|---:|---|
| Windows NSIS/MSI | Yes | Yes | Partial until WebView2 attribution verified | WebView2 runtime subprocesses |
| macOS `.app`/DMG | Yes | Yes | No unless app sandbox is added | Unsandboxed Rust process |
| Linux Flatpak | Yes | Yes | Yes, if no `--share=network` | User overrides can grant network |
| Linux AppImage/deb | Yes | Yes | No | Normal process network access |

## What The Plan Gets Right

- `on_new_window(...Deny)` is the right Tauri-level control for `window.open()` and `target="_blank"` popups. Tauri documents this as the new-window request handler for `window.open`.
- `initialization_script_for_all_frames` is an appropriate defense-in-depth layer because it runs before page scripts and applies to subframes.
- Strengthening CSP with `worker-src`, `frame-src`, `form-action`, and `base-uri` makes sense.
- Verifying Flatpak lacks `--share=network` is important and currently matches `flatpak/io.github.fjrevoredo.mini-diarium.yml`.
- Keeping the existing `dangerousDisableAssetCspModification: ["style-src"]` exception is justified by the app's documented TipTap inline-style requirement.
- Explicitly preserving drag/drop behavior in validation is necessary because the recent bug came from drag/drop URL navigation.

## Required Plan Edits Before Approval

1. Change plan status from `READY FOR APPROVAL` to `REVISION REQUIRED` or equivalent.
2. Add an opener-removal milestone and make it a blocker.
3. Replace Task 3.2; do not claim Tauri `on_web_resource_request` blocks external HTTP(S).
4. Re-scope Windows firewall claims until WebView2 process attribution is measured.
5. Add macOS and non-Flatpak Linux residual-risk decisions.
6. Replace static init-script string assertions with runtime WebView tests.
7. Add CI/static dependency checks for network-capable crates, Tauri plugins, and frontend APIs.
8. Add a packaging matrix that states the actual guarantee per distribution target.
9. Remove or gate release devtools.
10. Use Windows-routed validation commands from this repo's `AGENTS.md`, for example `cmd.exe /c bun run type-check` and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.

## Trusted Sources

- [Tauri CSP documentation](https://v2.tauri.app/security/csp/) - CSP is used to reduce web vulnerabilities, should be as restrictive as possible, and Tauri injects nonces/hashes for bundled assets.
- [Tauri WebviewWindowBuilder docs](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html) - documents `initialization_script_for_all_frames`, `on_new_window`, `on_navigation`, `devtools`, and default WebView2 browser args.
- [Tauri `on_web_resource_request` source docs](https://docs.rs/tauri/latest/src/tauri/webview/webview_window.rs.html) - states the hook is currently only implemented for the `tauri` URI protocol and not external URLs.
- [Tauri capabilities documentation](https://v2.tauri.app/security/capabilities/) - capabilities define which permissions are granted to windows/webviews.
- [Tauri opener API documentation](https://v2.tauri.app/reference/javascript/opener/) - `openUrl()` opens a URL with the system default app.
- [MDN `connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) - `connect-src` governs `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, and `<a ping>`.
- [Apple `WKContentRuleList`](https://developer.apple.com/documentation/webkit/wkcontentrulelist) and [Safari content blocker documentation](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker) - content rule lists are the WebKit-supported mechanism for compiled content-blocking rules.
- [Microsoft WebView2 `NewWindowRequested`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.newwindowrequested) - host apps can handle new-window requests so WebView2 does not open them.
- [Microsoft `netsh advfirewall`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-advfirewall) - supports outbound block rules and deletion of firewall rules.
- [Flatpak sandbox permissions](https://flatpak-docs.readthedocs.io/en/latest/sandbox-permissions-reference.html) - `--share=network` grants network access.
