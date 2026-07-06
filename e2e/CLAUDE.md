# E2E Tests (e2e/) — Mini Diarium

> For project architecture and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

**Prerequisites:**
```bash
cargo install tauri-driver   # install once
```

## Test Runners

Two test runners coexist with distinct responsibilities:

- **WebdriverIO** (`e2e/specs/`) — Full-app E2E tests. Launches the real Tauri binary via `tauri-driver`. Use for all end-to-end feature and regression tests.
- **Playwright** (`tests/print/`) — Print-CSS and PDF-layout tests. Loads static HTML pages in a headless Chromium browser; does **not** launch the Tauri binary. Use only for print-media and PDF rendering verification.

When adding new tests, use WebdriverIO for app behavior and Playwright for print/PDF layout.

## Specs

Specs live in `e2e/specs/`. Current suite covers: core diary workflow (create → write → lock → unlock → verify persistence) and multi-entry persistence with nav bar edge cases — including two v0.4.9 regressions: `+` button enabled state after `←` navigation from a blank entry, and after a day-switch with a blank entry open.

## Verification Commands

```bash
bun run test:e2e:local                  # Build binary + run full suite
bun run test:e2e:local -- --skip-build  # Skip build, run suite only (faster on repeat runs)
bun run test:e2e                        # Run suite only (binary must already exist)
bun run test:e2e:stateful               # Stateful E2E mode (persistence-oriented lane)
```

**CI platform coverage gap:** CI E2E runs Linux/WebKitGTK only. WebView2 (Windows) behavior is covered exclusively by local `bun run test:e2e:local` runs and manual `tauri-agent-dev` verification — green CI does not exercise `#[cfg(windows)]` paths (e.g. `WebResourceRequested` network blocking, print image decode timing). Do not treat a green CI E2E run as evidence that platform-specific WebView code works.

## data-testid Attributes

The canonical `data-testid` inventory lives in [`src/CLAUDE.md — data-testid Attributes`](../src/CLAUDE.md#data-testid-attributes). The E2E specs use a subset of those attributes. Do not add a new `data-testid` selector to a spec without first adding it to the canonical table.

## Gotchas and Pitfalls

1. **E2E mode contracts:** Default E2E uses clean-room mode (`E2E_MODE=clean`) and sets both `MINI_DIARIUM_DATA_DIR` (fresh temp diary path) and `MINI_DIARIUM_E2E=1` (backend disables `tauri-plugin-window-state` so host window geometry does not leak into tests). Stateful lane (`bun run test:e2e:stateful`) uses a repo-local persistent root (`.e2e-stateful/`, optionally overridden by `E2E_STATEFUL_ROOT`) for persistence-specific checks.

2. **Sidebar is always in mobile/overlay mode during E2E**: Default clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px). The sidebar uses `lg:relative lg:translate-x-0`, so calendar day elements are only reachable after opening the sidebar. Any change to `isSidebarCollapsed` default or `resetUiState()` WILL break E2E tests. When frontend UI visibility signal defaults change, audit specs here.

3. **E2E viewport sizing — three rules that must hold:**
   - **Why this keeps breaking:** WebView2 captures CSS viewport values (`100vh`, `window.innerHeight`) at first paint. Any resize after `win.show()` leaves those values stale, producing a white gap above vertically-centred content. This has broken three times (v0.4.3, v0.4.9 ×2); the root cause is always the same pattern.
   - **Rust** (`lib.rs`): call `win.set_size(LogicalSize::new(800, 660))` **before** `win.show()` in E2E mode. Never move it after. This is the single source of truth for E2E viewport size. Production window: `800×780` (`tauri.conf.json`).
   - **CSS**: all screen-filling containers (`JournalPicker`, `PasswordCreation`, `PasswordPrompt`, `App` checking state, `MainLayout`) use `h-full` (`height: 100%` via `html → body → #root` chain from `index.html`). **Never** use `h-screen`/`min-h-screen` (`100vh`) — it may report the full Tauri inner-window height (including the native app menu bar) rather than the WebView viewport, making containers taller than the visible area.
   - **wdio** (`wdio.conf.ts`): the `before` hook must NOT call `browser.setWindowSize()`. WebDriver `setWindowRect` fires after first paint and uses different size semantics than Tauri's `LogicalSize` — see "why this keeps breaking" above.
   - **uno.config.ts**: `h-screen` and `min-h-screen` are intentionally **absent** from the safelist. Do not add them back.
