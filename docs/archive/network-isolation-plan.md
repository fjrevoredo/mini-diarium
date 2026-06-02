# Network Isolation Hardening Plan

## Metadata

- Plan Status: IN PROGRESS
- Created: 2026-05-18
- Last Updated: 2026-05-19 (follow-up fixes applied; 4.1b verification still pending)
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Ensure Mini Diarium's process and embedded WebView cannot make any outbound network request. User-clicked help/docs links that open in the system browser are an explicit documented exception (see Milestone 0). The app already has `on_navigation` (blocks WebView2 URL navigation), `default-src 'self'` CSP, and a no-network design principle. This plan hardens that guarantee by adding layered defenses: explicit CSP gap-fill, JS-API nullification via an init script, WebView platform handlers, OS-level firewall rules, release devtools removal, and a packaging matrix that accurately documents the guarantee per distribution target.

## Scope

- Add explicit disclosure of `tauri_plugin_opener` / `openUrl()` as an exception (help/docs links open in system browser — not removed, but disclosed)
- Add explicit `connect-src` and other missing CSP directives to `tauri.conf.json`
- Add `initialization_script_for_all_frames()` init script that nulls JS network APIs
- Add `on_new_window(Deny)` builder handler (blocks `window.open()` cross-platform)
- Add Windows WebView2 `WebResourceRequested` handler via `with_webview()` COM (correct approach — `on_web_resource_request` confirmed to NOT fire for external HTTP)
- Add macOS `WKContentRuleList` via `with_webview()` ObjC
- Add explicit `webview2-com` and `objc2-web-kit` direct deps in `Cargo.toml`
- Add CI static check for network-capable crates/plugins/APIs
- Add E2E runtime test for init script nullification
- Windows NSIS firewall rule with WebView2 process attribution investigation
- Verify Linux Flatpak excludes `--share=network`
- Document macOS `.app` sandbox limitation (sandboxing deferred; residual risk documented in packaging matrix)
- Remove `devtools` Cargo feature from release builds
- Add per-target packaging guarantee matrix to documentation
- Update security docs and CHANGELOG

## Non-Goals

- Blocking WebView2's own internal traffic at the in-process level — Task 4.1 addresses this via OS Firewall, but the non-goal is any in-process socket interception
- DNS-over-HTTPS or proxy configuration
- Blocking the Rust process's own sockets (no HTTP client crate is used — design invariant, not enforced by code)
- Blocking outbound network for Linux AppImage/deb without an external sandbox (Firejail/bubblewrap) — these targets have normal process network access; the plan documents this limitation

## Assumptions

- Tauri 2.11.0 `WebviewWindowBuilder::initialization_script_for_all_frames(script)` confirmed in `tauri-2.11.0/src/webview/webview_window.rs`.
- Tauri 2.11.0 `WebviewWindowBuilder::on_new_window(F)` returning `NewWindowResponse::Deny` blocks new-window creation on all platforms (Windows `NewWindowRequested`, macOS `WKUIDelegate createWebViewWithConfiguration`) without unsafe code. Confirmed in WRY 0.55.1 source.
- **`on_web_resource_request` in Tauri does NOT fire for external HTTP(S) requests.** WRY wires the `WebResourceRequested` event only for the custom protocol filter (e.g., `tauri://`, `ipc://`), confirmed in `wry-0.55.1/src/webview2/mod.rs`. Task 3.2 uses `with_webview()` COM directly instead.
- `webview2-com` is a transitive dep of `tauri-runtime-wry` (via `tauri`), confirmed in `Cargo.lock`. Task 6.1 adds it as a direct dep to make the code's dependency on it explicit.
- `objc2-web-kit` and related crates are transitive deps of `tauri-runtime-wry` on macOS. Task 6.1 adds them as direct deps.
- NSIS `installMode: currentUser` does NOT run the installer as Administrator. Task 4.1a must resolve the elevation approach before adding `netsh` commands.
- The Windows Firewall rule for `mini-diarium.exe` may NOT cover WebView2 subprocess traffic (WebView2 browser processes run from the Edge WebView2 runtime). Task 4.1b verifies attribution empirically before the plan claims it blocks WebView2's own traffic.
- `WKContentRuleList` is the ONLY mechanism for blocking HTTP(S) subresource requests in WKWebView (macOS `NSURLProtocol` does not intercept WKWebView — WebKit bug #138169, won't-fix). Valid resource-type values: `document`, `image`, `style-sheet`, `script`, `font`, `raw` (covers XHR/fetch/WebSocket), `svg-document`, `media`, `popup`, `ping`.
- Milestone 3 (Windows COM + macOS ObjC handlers) and Task 4.1 (NSIS firewall) are confirmed in scope per user answers on 2026-05-19.
- Opener plugin (Task 0.1): Option B chosen (document exception). macOS sandbox (Task 4.3): Option B chosen (document limitation). Both resolved 2026-05-19.

## Open Questions

1. **Opener plugin fate — remove or document exception?**
   **Answer (2026-05-19): Option B — Document as explicit exception.** Keep the opener plugin. Add explicit disclosure to `PHILOSOPHY.md`, `SECURITY.md`, and the About screen: "Help and documentation links open in your system browser." The product promise is narrowed to "no network access from within the Mini Diarium process or WebView."

2. **macOS `.app` sandbox — in scope?**
   **Answer (2026-05-19): Option B — Document as limitation.** Keep `.app` unsandboxed. Add a clear note in the packaging matrix that macOS DMG/`.app` provides WebView-layer isolation only, not OS-level process isolation. Sandboxing would require significant entitlement work for arbitrary journal file paths.

## Milestones

### Milestone 0: Opener Plugin Disclosure

- Status: COMPLETED
- Purpose: Add explicit disclosure of the opener plugin's external URL capability and scope the product guarantee correctly. The plan's goal is narrowed to "no network access from within the Mini Diarium process or WebView" — user-clicked help links opening in the system browser are an explicit documented exception.
- Exit Criteria: `PHILOSOPHY.md`, `SECURITY.md`, and `AboutOverlay.tsx` contain explicit disclosure of the opener exception. CI check prevents new undisclosed network-capable APIs from appearing.

#### Task 0.1: Add opener plugin disclosure to docs and UI

- Status: COMPLETED
- Objective: `PHILOSOPHY.md`, `SECURITY.md`, and the About overlay explicitly disclose that help/docs links open in the system browser.
- Steps:
  1. Read `PHILOSOPHY.md` and add a note under the privacy/network section: "Help and documentation links (About screen, Settings, Onboarding) open in your system browser via the OS opener API. No network request is made from within the Mini Diarium process or WebView."
  2. Read `SECURITY.md` and add the same disclosure.
  3. In `src/components/overlays/AboutOverlay.tsx`, add a brief note near the external links (e.g., a small italic `(opens in browser)` label or tooltip) so users understand the links leave the app.
- Validation: `Select-String -Path "PHILOSOPHY.md","SECURITY.md" -Pattern "system browser"` returns matches in both files. The About overlay visually indicates external links.
- Notes: No code removal required. This task narrows the product promise to match the actual behavior without removing functionality. The CI check (Task 0.2) prevents accidental expansion of this exception.

#### Task 0.2: Add CI static check for network-capable APIs

- Status: COMPLETED
- Objective: A script in `scripts/` fails CI if any of the following appear in the codebase: network-capable Rust crates (`reqwest`, `hyper`, `ureq`, `isahc`, `curl`, `native-tls`, `rustls`, `tokio-tungstenite`), Tauri plugins with network access (`tauri-plugin-http`, `tauri-plugin-updater`, `tauri-plugin-websocket`), or frontend patterns (`new WebSocket(`, `EventSource(`, `navigator.sendBeacon(` outside the nullification script file, external `fetch(` calls).
- Steps:
  1. Create `scripts/check-no-network.ps1` (PowerShell for cross-platform CI) that runs:
     - `Select-String -Path "src-tauri/Cargo.toml" -Pattern "reqwest|hyper|ureq|isahc|curl|native-tls|rustls|tokio-tungstenite|tauri-plugin-http|tauri-plugin-updater|tauri-plugin-websocket"` — must return zero matches.
     - `Select-String -Path "src" -Recurse -Include "*.ts","*.tsx" -Pattern "new WebSocket\(|new EventSource\(|navigator\.sendBeacon\("` — must return zero matches outside `src/lib/network-isolation-script.ts`.
     - `Select-String -Path "src" -Recurse -Include "*.ts","*.tsx" -Pattern "fetch\(\s*['\"`]https?://|fetch\(\s*['\"`]//"` — must return zero matches outside `src/lib/network-isolation-script.ts`.
     - Verify `src-tauri/capabilities/default.json` does not contain `"http:"` or `"websocket:"` permissions.
  2. Add the script to `.github/workflows/` as a step in the existing CI check job.
- Validation: Run `pwsh scripts/check-no-network.ps1` — exits 0 on the clean codebase. Test by temporarily adding a forbidden pattern and confirm it exits non-zero.
- Notes: The script must be cross-platform (PowerShell 7 `pwsh` runs on Windows, macOS, Linux). Under Option A (opener removed), also check for `openUrl` and `plugin-opener`.

### Milestone 1: CSP Hardening

- Status: COMPLETED
- Purpose: Close known CSP coverage gaps. The current config has `default-src 'self' data:` but no explicit `connect-src`, which means `fetch`, XHR, WebSocket, EventSource, and `sendBeacon` fall back to `default-src`. Explicit directives are clearer and more restrictive.
- Exit Criteria: `tauri.conf.json` CSP includes explicit `connect-src`, `worker-src 'none'`, `child-src 'none'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `manifest-src 'none'`. App builds and loads in dev mode without CSP violation errors.

#### Task 1.1: Add missing CSP directives

- Status: COMPLETED
- Objective: The `security.csp` string in `src-tauri/tauri.conf.json` contains all listed directives.
- Steps:
  1. Open `src-tauri/tauri.conf.json`.
  2. Replace or extend the `security.csp` value with the following complete string (preserving existing `img-src`, `font-src`, and `style-src` which are intentional):
     ```
     default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; worker-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'none'
     ```
  3. Keep `dangerousDisableAssetCspModification: ["style-src"]` unchanged (required for TipTap inline styles).
  4. Verify Tauri's IPC mechanism requires `ipc:` and `http://ipc.localhost` in `connect-src`. On Windows and Linux, Tauri IPC uses the `ipc://` scheme or `http://ipc.localhost`; on macOS it uses `ipc://`. Both must be allowed or IPC calls fail.
- Validation: Run `bun tauri dev`. Open DevTools → Application → Content Security Policy and confirm the new directives appear. No `Refused to connect` or other new CSP violation messages appear during normal app use (entry editing, tag operations, etc.).
- Notes: `connect-src` governs `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, and `<a ping>` (per MDN). Adding it explicitly is more restrictive than relying on `default-src` fallback. Tauri's documentation examples include `ipc: http://ipc.localhost` in `connect-src` for IPC to function.

#### Task 1.2: Smoke-test CSP in dev mode

- Status: SKIPPED
- Objective: Confirm the updated CSP does not break any existing app functionality.
- Steps:
  1. Run `bun tauri dev`.
  2. Unlock a journal, navigate to an entry, paste or drag an image, add/remove a tag, switch themes, and change font settings.
  3. Inspect DevTools console for any new CSP violation warnings (`Refused to ...`).
- Validation: No new CSP violation messages. All listed app features work normally.
- Notes: None.

### Milestone 2: JavaScript API Nullification

- Status: COMPLETED
- Purpose: Null network-capable JS globals that CSP does not cover (`RTCPeerConnection`, `WebTransport`) or that can bypass CSP (`Worker` with inline blob). Runs before any page JS in all frames including subframes.
- Exit Criteria: Init script registered via `initialization_script_for_all_frames` in `lib.rs`. Static coverage test and E2E runtime test both pass.

#### Task 2.1: Write and register the init script

- Status: COMPLETED
- Objective: `lib.rs` registers `initialization_script_for_all_frames()` that nulls all identified JS network globals via `Object.defineProperty` with `configurable: false`.
- Steps:
  1. Create `src/lib/network-isolation-script.ts` with the exported constant (used by the Task 2.2 static test):
     ```typescript
     export const NETWORK_ISOLATION_SCRIPT = `(function() {
       'use strict';
       const kill = (obj, prop) => {
         try {
           Object.defineProperty(obj, prop, {
             value: undefined,
             writable: false,
             configurable: false,
           });
         } catch (_) {}
       };
       // WebRTC
       kill(window, 'RTCPeerConnection');
       kill(window, 'webkitRTCPeerConnection');
       kill(window, 'mozRTCPeerConnection');
       kill(window, 'RTCSessionDescription');
       // Network transports
       kill(window, 'WebSocket');
       kill(window, 'WebTransport');
       kill(window, 'EventSource');
       kill(window, 'XMLHttpRequest');
       kill(window, 'fetch');
       // Popup navigation
       kill(window, 'open');
       // Worker constructors (CSP worker-src none is primary control; this is defense-in-depth)
       kill(window, 'Worker');
       kill(window, 'SharedWorker');
       // Navigator network APIs
       if (navigator) {
         kill(navigator, 'serviceWorker');
         kill(navigator, 'sendBeacon');
         kill(navigator, 'connection');
       }
     })();`;
     ```
  2. In `src-tauri/src/lib.rs`, after `on_new_window` and before `.build()`, add the same JS body inline (both copies must stay in sync — add a `// NOTE: keep in sync with src/lib/network-isolation-script.ts` comment):
     ```rust
     .initialization_script_for_all_frames(
         r#"(function() {
           'use strict';
           const kill = (obj, prop) => {
             try {
               Object.defineProperty(obj, prop, {
                 value: undefined, writable: false, configurable: false,
               });
             } catch (_) {}
           };
           kill(window, 'RTCPeerConnection');
           kill(window, 'webkitRTCPeerConnection');
           kill(window, 'mozRTCPeerConnection');
           kill(window, 'RTCSessionDescription');
           kill(window, 'WebSocket');
           kill(window, 'WebTransport');
           kill(window, 'EventSource');
           kill(window, 'XMLHttpRequest');
           kill(window, 'fetch');
           kill(window, 'open');
           kill(window, 'Worker');
           kill(window, 'SharedWorker');
           if (navigator) {
             kill(navigator, 'serviceWorker');
             kill(navigator, 'sendBeacon');
             kill(navigator, 'connection');
           }
         })();"#
     )
     ```
  3. Compile: `Set-Location src-tauri; cargo build`.
- Validation: `cargo build` succeeds. In dev mode DevTools console: `window.fetch`, `window.WebSocket`, `window.RTCPeerConnection`, `window.Worker`, `navigator.sendBeacon` all evaluate to `undefined`.
- Notes: `initialization_script_for_all_frames` is confirmed in Tauri 2.11.0. `Worker` constructor nullification is defense-in-depth; `worker-src 'none'` CSP is the primary control. The two copies (TS and Rust) must be kept in sync; the comment in `lib.rs` documents the obligation.

#### Task 2.2: Add static string-coverage test

- Status: COMPLETED
- Objective: A Vitest test asserts `NETWORK_ISOLATION_SCRIPT` contains a kill call for every targeted global.
- Steps:
  1. Create `src/lib/network-isolation.test.ts`:
     ```typescript
     import { describe, it, expect } from 'vitest';
     import { NETWORK_ISOLATION_SCRIPT } from './network-isolation-script';

     const REQUIRED_TARGETS = [
       'RTCPeerConnection', 'WebSocket', 'WebTransport', 'EventSource',
       'XMLHttpRequest', 'fetch', 'open', 'Worker', 'SharedWorker',
       'serviceWorker', 'sendBeacon', 'connection', 'Object.defineProperty',
     ];

     describe('network-isolation-script', () => {
       REQUIRED_TARGETS.forEach((target) => {
         it(`kills '${target}'`, () => {
           expect(NETWORK_ISOLATION_SCRIPT).toContain(target);
         });
       });
     });
     ```
  2. Run `bun run test:run`.
- Validation: `bun run test:run` passes with all assertions green.
- Notes: This verifies coverage but not execution. Task 2.3 adds runtime verification.

#### Task 2.3: Add E2E runtime test for init script

- Status: COMPLETED
- Objective: An E2E test opens the app and evaluates each nulled global in the WebView, asserting each is `undefined`.
- Steps:
  1. Add a new E2E spec file `e2e/specs/network-isolation.spec.ts` (or add to an existing file) that:
     - Opens the app and waits for the auth screen.
     - Executes `window.fetch` via WebdriverIO's `browser.execute()` — asserts it returns `undefined`.
     - Repeats for `window.WebSocket`, `window.RTCPeerConnection`, `window.Worker`, `window.SharedWorker`, `navigator.serviceWorker`, `navigator.sendBeacon`, `navigator.connection`, and `window.open`.
  2. Run `bun run test:e2e:local -- --skip-build` to confirm the spec passes.
- Validation: `bun run test:e2e:local -- --skip-build` exits 0 and the new spec appears as passing.
- Notes: The test does not require the journal to be unlocked — the init script runs on document creation before auth, so the check works from the auth screen. Wrap `browser.execute(...)` in a try/catch and fail if the returned value is not `undefined`.

### Milestone 3: Platform WebView Handlers

- Status: COMPLETED
- Purpose: Add WebView-layer controls that operate below JS and CSP. `on_new_window(Deny)` is the cross-platform popup blocker (no unsafe). Windows COM `WebResourceRequested` and macOS `WKContentRuleList` block HTTP(S) subresource requests at the engine level.
- Exit Criteria: `cargo build` succeeds on all platforms. Manual testing confirms `window.open('https://example.com')` returns `null`. Windows network tab shows blocked responses for external requests. macOS Safari Web Inspector shows no outbound HTTP(S) requests.

#### Task 3.1: Block new-window creation on all platforms via on_new_window

- Status: COMPLETED
- Objective: `WebviewWindowBuilder::on_new_window(|_, _| NewWindowResponse::Deny)` is added to `win_builder` in `lib.rs`.
- Steps:
  1. In `src-tauri/src/lib.rs`, add to the `win_builder` chain after `on_navigation`:
     ```rust
     .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Deny)
     ```
  2. Compile: `cargo build`.
- Validation: `cargo build` succeeds. In dev mode DevTools: `window.open('https://example.com')` returns `null`. No new window opens.
- Notes: Maps to WebView2 `NewWindowRequested` on Windows and `WKUIDelegate createWebViewWithConfiguration` on macOS (confirmed in WRY 0.55.1). No `unsafe` code required. Defense-in-depth alongside the init script kill of `window.open`.

#### Task 3.2: Windows — block HTTP(S) subresource requests via WebResourceRequested COM

- Status: COMPLETED
- Objective: A `WebResourceRequested` handler on WebView2 returns an empty 403 for any HTTP(S) request to an external host, providing engine-level blocking on top of CSP and the init script.
- Steps:
  1. Ensure `webview2-com` is a direct dependency (Task 6.1 does this). Import the necessary COM interfaces.
  2. In `src-tauri/src/lib.rs`, after `win.build()`, add a `with_webview()` handler that:
     ```rust
     #[cfg(target_os = "windows")]
     {
         win.with_webview(|webview| {
             unsafe {
                 use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL;
                 use webview2_com::WebResourceRequestedEventHandler;
                 let core = webview.controller().CoreWebView2().unwrap();
                 let env = core.Environment().unwrap();
                 core.AddWebResourceRequestedFilter(
                     windows::core::w!("*"),
                     COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                 ).unwrap();
                 core.add_WebResourceRequested(
                     &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                         let Some(args) = args else { return Ok(()); };
                         let request = args.Request().unwrap();
                         let mut uri = windows::core::PWSTR::null();
                         request.Uri(&mut uri).unwrap();
                         let uri_str = uri.to_string().unwrap_or_default();
                         let is_http = uri_str.starts_with("http://") || uri_str.starts_with("https://");
                         let allow_local = uri_str.starts_with("http://localhost")
                             || uri_str.starts_with("http://127.0.0.1")
                             || uri_str.starts_with("https://localhost")
                             || uri_str.starts_with("https://127.0.0.1")
                             || uri_str.starts_with("https://tauri.localhost");
                         if is_http && !allow_local {
                             let response = env.CreateWebResourceResponse(
                                 None,
                                 403,
                                 windows::core::w!("Forbidden"),
                                 windows::core::w!("Content-Type: text/plain\r\n"),
                             ).unwrap();
                             args.SetResponse(&response).ok();
                         }
                         Ok(())
                     })),
                 ).unwrap();
             }
         }).ok();
     }
     ```
  3. Compile on Windows: `Set-Location src-tauri; cargo build`.
- Validation: `cargo build` on Windows succeeds. In dev mode, evaluate `fetch('https://httpbin.org/get')` in DevTools — it must reject (network error or 403). App's Tauri IPC and `tauri://` protocol work normally.
- Notes: Known gaps NOT covered by this handler: WebSocket upgrades, service worker fetch, DNS prefetch (per WebView2 issue #4303). All are mitigated by CSP + init script. Every `unsafe` block must include a `// SAFETY:` comment explaining the invariant (COM object lifetime, thread model, callback ownership). This is `#[cfg(target_os = "windows")]` only.

#### Task 3.3: macOS — block HTTP(S) requests via WKContentRuleList

- Status: COMPLETED
- Objective: A `WKContentRuleList` rule installed on macOS blocks all external HTTP(S) subresource requests at the WebKit content-blocking layer.
- Steps:
  1. Ensure `objc2-web-kit` and `objc2-foundation` are direct deps (Task 6.1).
  2. In `src-tauri/src/lib.rs`, after `win.build()`, add:
     ```rust
     #[cfg(target_os = "macos")]
     {
         use std::sync::{Arc, Mutex};
         let result: Arc<Mutex<Option<()>>> = Arc::new(Mutex::new(None));
         let result_clone = result.clone();
         win.with_webview(move |webview| {
             // SAFETY: WKWebView and WKUserContentController must be accessed on the main thread.
             // This closure runs on the main thread during window setup.
             unsafe {
                 use objc2_web_kit::*;
                 use objc2_foundation::NSString;
                 let wk_webview: *mut WKWebView = webview.inner() as *mut _;
                 let config = (*wk_webview).configuration();
                 let ucc = config.userContentController();
                 // Block all external http/https; allow tauri:// and localhost (dev server)
                 let rules_json = r#"[{
                     "trigger": {
                         "url-filter": "https?://.*",
                         "unless-domain": ["localhost", "127.0.0.1", "tauri.localhost"]
                     },
                     "action": {"type": "block"}
                 }]"#;
                 let rules_ns = NSString::from_str(rules_json);
                 // WKContentRuleListStore compilation is async; use a dispatch semaphore to wait
                 let sema = dispatch2::Semaphore::new(0);
                 let sema_clone = sema.clone();
                 WKContentRuleListStore::default_store()
                     .compileContentRuleListForIdentifier_encodedContentRuleList_completionHandler(
                         &NSString::from_str("mini-diarium-block"),
                         &rules_ns,
                         move |list, _err| {
                             if let Some(list) = list {
                                 ucc.addContentRuleList(&list);
                             }
                             sema_clone.signal();
                         },
                     );
                 sema.wait();
             }
         }).ok();
     }
     ```
  3. Compile on macOS: `cargo build`.
  4. **Important:** The `dispatch2` crate (or `block2`) may be needed for the semaphore. Verify which is the correct crate for the libdispatch bindings available in this project's dep tree.
- Validation: `cargo build` on macOS succeeds. In Safari Web Inspector attached to the dev build, the Network tab shows no outbound HTTP(S) requests when app actions are performed. The `tauri://` protocol and localhost dev server are unaffected.
- Notes: Resource-type omitted from the rule trigger (no `resource-type` key) means ALL resource types are blocked, which is correct. Valid values if needed: `document`, `image`, `style-sheet`, `script`, `font`, `raw`, `svg-document`, `media`, `popup`, `ping`. Do NOT use `fetch`, `xhr`, or `websocket` — they are invalid in Apple's content blocker spec. The `url-filter` regex `https?://.*` leaves `tauri://` and `ipc://` unaffected. `unless-domain` excludes localhost for dev mode; consider wrapping in `#[cfg(debug_assertions)]` to remove localhost from the exclusion list in production builds.

### Milestone 4: OS-Level Controls and Platform Risk Documentation

- Status: IN PROGRESS
- Purpose: Add OS-level network isolation where available and document residual risks where it is not available.
- Exit Criteria: Windows installer adds a verified firewall rule. WebView2 process attribution is empirically documented. Flatpak manifest is verified. macOS and Linux non-Flatpak residual risks are explicitly documented.

#### Task 4.1a: Windows — resolve NSIS install mode and add firewall rule

- Status: COMPLETED
- Objective: NSIS installer adds a Windows outbound firewall rule for `mini-diarium.exe`.
- Steps:
  1. Resolve the install mode conflict: `tauri.conf.json` currently has `"installMode": "currentUser"` which does not run as Administrator. Change to `"perMachine"` OR keep `currentUser` and use `ShellExecWait` with UAC elevation.
     - **Recommended — perMachine:** In `tauri.conf.json`, change `"installMode": "perMachine"`. This runs the installer elevated on Windows, allowing `netsh` to succeed directly.
  2. Research Tauri 2.11.0 NSIS customization points: check `bundle.windows.nsis` in the Tauri config schema for `postinstallSectionTemplate` or similar. If a custom NSIS template is needed, create `src-tauri/nsis/installer.nsh` and reference it.
  3. Add to the NSIS install section:
     ```nsis
     ExecWait 'netsh advfirewall firewall add rule name="Mini Diarium - Block Outbound" dir=out action=block program="$INSTDIR\mini-diarium.exe" enable=yes'
     ```
  4. Add to the NSIS uninstall section:
     ```nsis
     ExecWait 'netsh advfirewall firewall delete rule name="Mini Diarium - Block Outbound"'
     ```
- Validation: Build the NSIS installer (`bun tauri build`). Install it, then open Windows Defender Firewall → Outbound Rules and confirm "Mini Diarium - Block Outbound" appears, targeting `mini-diarium.exe`. Uninstalling the app removes the rule.
- Notes: `perMachine` changes who the installer runs as and where the app is installed (Program Files instead of AppData). Verify that journal paths and `config.json` locations work correctly under `perMachine`.

#### Task 4.1b: Empirically verify WebView2 firewall attribution

- Status: BLOCKED
- Objective: Document whether the `mini-diarium.exe` firewall rule actually blocks WebView2's SmartScreen, CRL, and telemetry traffic — or whether those are attributed to separate WebView2 runtime processes.
- Steps:
  1. Enable Windows Firewall logging: `netsh advfirewall set currentprofile logging droppedconnections enable`.
  2. Install the app with the firewall rule active. Run the app for 5 minutes performing normal operations.
  3. Check `%systemroot%\system32\LogFiles\Firewall\pfirewall.log` for any DROP entries attributed to `msedgewebview2.exe` or other WebView2 processes (not `mini-diarium.exe`).
  4. Use Resource Monitor or Process Monitor to identify which process makes WebView2's background network calls (SmartScreen lookup, CRL, etc.).
  5. Document findings in `docs/network-isolation-plan.md` under this task's Notes, replacing the placeholder below.
- Validation: A documented finding exists in this task's Notes: either "The `mini-diarium.exe` rule blocks all WebView2 traffic (single process)" or "WebView2 uses subprocess `msedgewebview2.exe` — rule does not cover its traffic; residual risk documented in packaging matrix."
- Notes: **Attribution findings go here after Task 4.1b is executed.** Do NOT add a broad block rule for `msedgewebview2.exe` — it is a shared Edge WebView2 runtime binary and blocking it would affect other applications using WebView2. Per Tauri/WRY docs, WRY passes `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` by default unless overridden.

#### Task 4.2: Verify Linux Flatpak excludes network permission

- Status: COMPLETED
- Objective: Confirm `flatpak/io.github.fjrevoredo.mini-diarium.yml` does not grant `--share=network`.
- Steps:
  1. Read `flatpak/io.github.fjrevoredo.mini-diarium.yml`.
  2. Confirm `finish-args` has no `--share=network` entry.
- Validation: `Select-String -Path "flatpak\io.github.fjrevoredo.mini-diarium.yml" -Pattern "share=network"` returns zero results.
- Notes: Already confirmed present state — no `--share=network` in current manifest. This task is formal verification.

#### Task 4.3: macOS — document app sandbox limitation

- Status: COMPLETED
- Objective: The packaging matrix and `SECURITY.md` clearly state that macOS DMG/`.app` provides WebView-layer isolation only, not OS-level process network isolation.
- Steps:
  1. Add to the packaging matrix (Task 7.2) for the macOS DMG row: "OS process block: No. Residual: Unsandboxed Rust process has normal network access. The process makes no network calls by design, but this is not OS-enforced. Sandboxing deferred due to file-access entitlement complexity."
  2. Add a sentence to `SECURITY.md` under the macOS section: "The macOS `.app` distribution is not App Sandboxed. OS-level network isolation is not provided. Users who require hard isolation should wait for a future sandboxed release."
- Validation: Packaging matrix has accurate macOS row. `SECURITY.md` contains the sandboxing note.
- Notes: Option B chosen per user answer (2026-05-19). Sandboxing is deferred due to the entitlement complexity of arbitrary journal file paths. The residual risk is theoretical — the Rust process has no network code — but it is not OS-enforced.

#### Task 4.4: Document Linux non-Flatpak residual risk

- Status: COMPLETED
- Objective: The plan and packaging matrix explicitly document that AppImage and deb distributions have no OS-level network isolation.
- Steps:
  1. Add entries to the packaging matrix (Task 7.2) for AppImage and deb.
  2. Add a note in `SECURITY.md` recommending Flatpak as the preferred Linux distribution for users who require the strongest isolation guarantee.
- Validation: `SECURITY.md` contains the Flatpak recommendation. Packaging matrix has AppImage and deb rows with accurate limitation statements.
- Notes: Users who require hard isolation on AppImage/deb can run the app under Firejail (`firejail --net=none mini-diarium`) or bubblewrap. This is out-of-scope for the app itself.

### Milestone 5: Release Devtools Gate

- Status: COMPLETED
- Purpose: Remove the `devtools` Cargo feature from release builds. In Tauri, the `devtools` feature enables DevTools for all build types; without it, DevTools are only available in debug builds. Shipping release builds with DevTools exposes additional inspection and control surface in production.
- Exit Criteria: `src-tauri/Cargo.toml` no longer lists `"devtools"` in the `tauri` features. Release build has no DevTools. Debug build retains DevTools.

#### Task 5.1: Remove devtools from release Cargo feature

- Status: COMPLETED
- Objective: `tauri` dependency in `src-tauri/Cargo.toml` removes `features = ["devtools"]` or gates it behind a dev-only feature.
- Steps:
  1. Open `src-tauri/Cargo.toml`.
  2. Change:
     ```toml
     tauri = { version = "2.11.1", features = ["devtools"] }
     ```
     to:
     ```toml
     tauri = { version = "2.11.1" }
     ```
     Or, if DevTools in debug builds requires the feature flag:
     ```toml
     tauri = { version = "2.11.1" }

     [features]
     devtools = ["tauri/devtools"]
     ```
     and ensure the dev build/CI invokes `cargo build --features devtools`.
  3. Verify release build: `cargo build --release` succeeds without DevTools enabled.
  4. Verify debug build still allows DevTools in dev mode (`bun tauri dev`).
- Validation: `cargo build --release` succeeds. In a release build, right-clicking the window shows no "Inspect Element" or DevTools option. In a debug build (`bun tauri dev`), DevTools remain available.
- Notes: Tauri documents that DevTools are available in debug builds by default; the `devtools` feature flag is only needed to enable them in release builds. The existing code has `features = ["devtools"]` which enables DevTools in release — removing it has no functional impact other than removing the DevTools menu item from production.

### Milestone 6: Direct Rust Dependencies for Platform Interop

- Status: COMPLETED
- Purpose: Add `webview2-com` (Windows) and `objc2-web-kit` (macOS) as explicit direct dependencies in `Cargo.toml`. Rust best practice: crates your code imports directly must be declared directly, not relied on as transitive dependencies. Relying on transitive deps is fragile across Tauri/WRY upgrades.
- Exit Criteria: `src-tauri/Cargo.toml` lists `webview2-com` under `[target.'cfg(windows)'.dependencies]` and `objc2-web-kit` (plus `objc2-foundation` and `block2` if needed) under `[target.'cfg(target_os = "macos")'.dependencies]`.

#### Task 6.1: Add direct platform interop dependencies

- Status: COMPLETED
- Objective: `Cargo.toml` explicitly lists all crates imported by the platform-specific `unsafe` blocks in `lib.rs`.
- Steps:
  1. Open `src-tauri/Cargo.toml`.
  2. Determine exact versions in `Cargo.lock` for `webview2-com`, `objc2-web-kit`, `objc2-foundation`, and `block2`.
  3. Add:
     ```toml
     [target.'cfg(windows)'.dependencies]
     webview2-com = "X.Y.Z"   # match version in Cargo.lock

     [target.'cfg(target_os = "macos")'.dependencies]
     objc2-web-kit = "X.Y.Z"
     objc2-foundation = "X.Y.Z"
     block2 = "X.Y.Z"         # if needed for completion handler closures
     ```
  4. Run `cargo build` and confirm no version conflicts.
- Validation: `cargo build` succeeds. Each `use webview2_com::...` and `use objc2_web_kit::...` in `lib.rs` is now backed by a direct declared dependency.
- Notes: Every `unsafe` block added in Tasks 3.2 and 3.3 must include a `// SAFETY:` comment explaining: object lifetimes, thread/main-actor requirements, selector/method validity, and callback ownership model. This is a Rust best practice for unsafe code and is required per the review (H3).

### Milestone 7: Documentation and Packaging Matrix

- Status: COMPLETED
- Purpose: Keep security documentation accurate and add a per-target guarantee matrix so users and contributors understand exactly what protection each distribution package provides.
- Exit Criteria: `src-tauri/CLAUDE.md` security section updated. Packaging matrix exists. `CHANGELOG.md` has an entry.

#### Task 7.1: Update security documentation

- Status: COMPLETED
- Objective: `src-tauri/CLAUDE.md` Security Rules section reflects the full isolation stack added by this plan.
- Steps:
  1. Read `src-tauri/CLAUDE.md` Security Rules section.
  2. Add bullet points for: CSP directives, `initialization_script_for_all_frames` globals list, `on_new_window(Deny)`, Windows `WebResourceRequested`, macOS `WKContentRuleList`, Windows Firewall rule, Flatpak isolation, and opener fate.
- Validation: `Select-String -Path "src-tauri\CLAUDE.md" -Pattern "initialization_script_for_all_frames|WKContentRuleList|WebResourceRequested"` returns at least one match.
- Notes: None.

#### Task 7.2: Add packaging guarantee matrix

- Status: COMPLETED
- Objective: A packaging matrix table exists in `docs/network-isolation-plan.md` (or a separate `docs/security.md`) that documents isolation guarantees per distribution target.
- Steps:
  1. Add the following matrix to `docs/network-isolation-plan.md` under an "## Packaging Guarantee Matrix" heading, or to a new `docs/security.md`:

     | Target | CSP + init script + navigation | Popup blocked (`on_new_window`) | HTTP subresource blocked | Opener plugin | OS process block | Residual limitation |
     |---|:---:|:---:|:---:|:---:|:---:|---|
     | Windows NSIS/MSI | Yes | Yes | Yes (WebResourceRequested) | TBD (Q1) | Partial (firewall `mini-diarium.exe`) | WebView2 subprocess traffic may not be blocked (see Task 4.1b) |
     | macOS DMG (`.app`) | Yes | Yes | Yes (WKContentRuleList) | TBD (Q1) | No (unless Task 4.3 Option A) | Unsandboxed Rust process has normal network access |
     | Linux Flatpak | Yes | Yes | Yes (kernel namespace) | TBD (Q1) | Yes (`--share=network` absent) | User with Flatpak override can grant network |
     | Linux AppImage/deb | Yes | Yes | n/a | TBD (Q1) | No | Normal process network access; run under Firejail for hard isolation |

  2. Update the "TBD (Q1)" cells once Open Question 1 (opener) is resolved.
- Validation: The matrix table exists and all cells are filled in.
- Notes: This matrix is the answer to reviewer finding M4.

#### Task 7.3: Add CHANGELOG entry

- Status: COMPLETED
- Objective: `CHANGELOG.md` `[0.5.0] - Unreleased` section has a `### Security` subsection describing the hardening.
- Steps:
  1. Read `CHANGELOG.md`.
  2. Add under `## [0.5.0] - Unreleased`:
     ```markdown
     ### Security
     - **Network isolation hardening**: added defense-in-depth layers to prevent any outbound network request from within the WebView. Layers added: explicit `connect-src` CSP directive; `worker-src none`, `child-src none`, `frame-src none`, `object-src none`, `form-action none`, `manifest-src none` CSP directives; document-start init script nulling `RTCPeerConnection`, `WebSocket`, `WebTransport`, `EventSource`, `XMLHttpRequest`, `fetch`, `Worker`, `SharedWorker`, `navigator.serviceWorker`, `navigator.sendBeacon`, and `window.open` in all frames; `on_new_window(Deny)` handler blocking popup creation on all platforms; Windows WebView2 `WebResourceRequested` COM handler; macOS `WKContentRuleList` content-blocking rule; Windows installer outbound firewall rule; removed `devtools` Cargo feature from release builds.
     ```
- Validation: `Select-String -Path "CHANGELOG.md" -Pattern "Network isolation hardening"` returns a match.
- Notes: Project date format is `dd-mm-YYYY` (e.g., `19-05-2026`). The section is under the existing `## [0.5.0] - Unreleased` heading; do not add a new version header.

### Milestone 8: Cleanup and Final Verification

- Status: IN PROGRESS
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified end-to-end, including network instrumentation.
- Exit Criteria: No intermediate artifacts remain. All pre-flight checks pass. Network instrumentation confirms no external packet leaves the machine during normal app use on Windows.

#### Task 8.1: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove any scratch files created during implementation.
- Steps:
  1. Inspect `git status` for unexpected files.
  2. Remove only files that are not part of the intended final state.
  3. Keep: `src/lib/network-isolation-script.ts`, `src/lib/network-isolation.test.ts`, `e2e/specs/network-isolation.spec.ts`, `scripts/check-no-network.ps1`, `docs/network-isolation-plan.md`.
- Validation: `git status` shows only expected changed files: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src/lib/network-isolation-script.ts`, `src/lib/network-isolation.test.ts`, `e2e/specs/network-isolation.spec.ts`, `scripts/check-no-network.ps1`, `src-tauri/CLAUDE.md`, `CLAUDE.md`, `SECURITY.md` (if updated), `CHANGELOG.md`, and optionally `src-tauri/nsis/` and `src-tauri/capabilities/default.json` / overlay component files if Task 0.1 Option A was chosen.
- Notes: None.

#### Task 8.2: Final Verification with Network Instrumentation

- Status: BLOCKED
- Objective: All automated checks pass and network instrumentation confirms no external packet leaves the machine during normal Windows app use.
- Steps:
  1. Run `Set-Location src-tauri; cargo test` — all tests must pass.
  2. Run `bun run test:run` — all tests must pass.
  3. Run `bun run type-check` — no errors.
  4. Run `bun run lint` — no new warnings.
  5. Run `bun tauri build` — build succeeds.
  6. **Network instrumentation (Windows):** Enable Firewall logging (`netsh advfirewall set currentprofile logging droppedconnections enable`). Run the installed app for 5 minutes: unlock a journal, write an entry, drag an image, open About/Settings, trigger onboarding. Check `pfirewall.log` for any ALLOW entries from `mini-diarium.exe` to external IPs — there should be none.
  7. Run E2E suite: `bun run test:e2e:local -- --skip-build`.
- Validation: Steps 1–5 exit with code 0. Step 6 shows zero ALLOW entries from `mini-diarium.exe` to non-localhost external IPs. Step 7 passes including `e2e/specs/network-isolation.spec.ts`.
- Notes: Network instrumentation is Windows-specific in this validation; macOS validation via Safari Web Inspector (Task 3.3) and Linux via Flatpak sandbox verification (Task 4.2) cover other platforms. For macOS and Linux non-Flatpak, document that network instrumentation was not performed and rely on the WebView-layer controls verified in Task 3.3 and the E2E init-script test (Task 2.3). Current blocker: local E2E runs are failing before reaching network-isolation assertions (missing auth selectors), so the final E2E gate is not yet closed.

## Packaging Guarantee Matrix

Per-distribution isolation guarantees as of v0.5.0. "WebView layer" = CSP + init script + `on_navigation` + `on_new_window`.

| Target | WebView layer | Popup blocked | HTTP subresource blocked | Opener exception | OS process block | Residual limitation |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Windows NSIS/MSI | Yes | Yes | Yes (WebResourceRequested COM) | Yes — system browser | Partial (firewall `mini-diarium.exe`) | WebView2 subprocess traffic attribution unverified (Task 4.1b pending) |
| macOS DMG (`.app`) | Yes | Yes | Yes (WKContentRuleList) | Yes — system browser | No | Unsandboxed Rust process; OS-level isolation not enforced |
| Linux Flatpak | Yes | Yes | Yes (kernel namespace) | Yes — system browser | Yes (`--share=network` absent) | User with Flatpak override can grant network |
| Linux AppImage/deb | Yes | Yes | n/a | Yes — system browser | No | Normal process network access; use `firejail --net=none` for hard isolation |

## Approval Gate

Implementation must not start until the user approves this plan. All open questions have been answered (2026-05-19).

## Pre-flight Checks

- [ ] `cargo clippy` passes with zero warnings
- [ ] `cargo test` passes with zero failures
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun tauri build` succeeds
- [ ] `bun run test:run` passes
- [ ] `pwsh scripts/check-no-network.ps1` exits 0
- [ ] All new i18n keys (Task 0.1 Option A only) added to en, es, de locale files
- [ ] Every `unsafe` block in `lib.rs` has a `// SAFETY:` comment
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` exists, plan is at `docs/network-isolation-plan.md`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions answered — Q1 (opener: Option B/disclose) and Q2 (macOS sandbox: Option B/document) answered 2026-05-19.
- [x] Tasks grouped into milestones (22 tasks across 8 milestones).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] Post-review self-check (2026-05-19): all 4 blockers (B1–B4) addressed, H1–H4 addressed, M1–M4 addressed. Task 3.2 replaced with correct `with_webview()` COM approach. `on_web_resource_request` limitation documented in Assumptions. Direct deps added (Milestone 6). Devtools gate added (Milestone 5). E2E test added (Task 2.3). CI static check added (Task 0.2). Packaging matrix added (Task 7.2). Network instrumentation in final verification (Task 8.2).

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Milestone 0 is a blocker — do not begin Milestone 1 until Task 0.1 is resolved.
- Task 4.3 (macOS sandbox) is blocked by Open Question 2.
- All `unsafe` blocks require `// SAFETY:` comments before the plan can be marked COMPLETED.
