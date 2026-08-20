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

Specs live in `e2e/specs/`. Current suite covers: core diary workflow (create → write → lock → unlock → verify persistence); multi-entry persistence with nav bar edge cases — including two v0.4.9 regressions: `+` button enabled state after `←` navigation from a blank entry, and after a day-switch with a blank entry open; header in-app actions (⋮ overflow menu, day navigation, keyboard shortcuts); search; network isolation; and the backup restore round trip (TODO-0098 Task 4.4: write an entry → manual snapshot → delete → per-entry restore → confirm content is back).

## Verification Commands

For the canonical post-task checklist (tests + formatting + CHANGELOG + TODO), see [Post-Task Completion Best Practices](../docs/best-practices/POST_TASK_BEST_PRACTICES.md).

E2E-specific:

```bash
bun run test:e2e:local                  # Build binary + run full suite
bun run test:e2e:local -- --skip-build  # Skip build, run suite only (faster on repeat runs)
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

4. **Reload the WebView with `browser.refresh()`, never `browser.url('tauri://localhost')`**: navigating to the URL that is already loaded is a **no-op on msedgedriver/WebView2** (Windows) — the page does not actually reload, so module-init code (e.g. `feature-flags.ts` reading `localStorage['feature-flags']` once via `createSignal(loadFlags())`) never re-runs. The symptom is subtle and platform-split: the value looks correctly written in `localStorage`, yet the gated UI never appears, and it passes on CI (Linux/WebKitGTK, where same-URL navigation *does* reload) while failing locally on WebView2. `helpers.ts` `setFeatureFlag()` uses `browser.refresh()` (the unconditional WebDriver "Refresh" command) for exactly this reason — any spec that needs the app to re-read `localStorage` at boot must do the same.

5. **`browser.keys(str)` drops the second half of a doubled letter on WebKitGTK (Linux CI)**: it sends one WebDriver Actions tick with every `keyDown` for the string queued before any `keyUp`. On WebKitGTK, a second `keyDown` for a key that is still "down" (its `keyUp` hasn't been processed yet) reads as OS-level key-repeat, not a new keystroke, so e.g. typing `"toggle"` or `"add"` yields `"togle"`/`"ad"` in the DOM — deterministically, reproduced identically across separate CI runs, not flaky. `.setValue()` is unaffected (a different WebDriver command) but isn't an option for a TipTap/ProseMirror body. Use `typeText()` from `helpers.ts` (sends one `browser.keys()` call per character) for any string typed into `.ProseMirror` that may contain a doubled letter.

6. **Clearing a Solid-controlled field to empty with `.setValue('')` is not reliable (Windows/WebView2/msedgedriver, one confirmed case)**: `backup-restore.spec.ts` cleared an entry's title with `title-input.setValue('')` to trigger `deleteEntryIfEmpty`'s auto-delete path, and the debounced save that reached the backend still carried the **original, pre-clear** title — the app's own write-audit log (`useEntryPersistence.ts` `logWrite`, `[Editor] write op=...`) showed `titleLen=24`, exactly the original string's length, so the write silently became a `saveEntry` instead of a delete. `setValue()` with a **non-empty** value is not implicated — the same spec file's own step 1 (`title-input.setValue(ENTRY_TITLE)`) persists correctly, and `multi-entry.spec.ts` relies on the same path for its second entry's title. Whether the specific failure is `setValue('')` never dispatching `input` at all, or something more particular to clearing-to-empty, was not fully isolated — what is confirmed is the fix: clear with real keystrokes instead. For a plain `<input>` (not contenteditable), `Ctrl+A` then one `Backspace` is reliable — two distinct keystrokes, not a repeated key, so gotcha 5's coalescing hazard below does not apply. For a contenteditable body, don't rely on `Ctrl+A` (native select-all in a rich-text editor is not dependable through WebDriver) or backspace as one repeated-key `browser.keys()` array (that reintroduces gotcha 5's exact hazard for `Backspace` instead of a typed letter) — send one `Backspace` per character in a loop, mirroring `typeText()`'s "one `browser.keys()` call per keystroke" pattern.

7. **When clearing or overwriting a contenteditable field by counting keystrokes, measure its actual current content — never assume it equals whatever fixture string you originally typed, and never assume `click()` places the cursor at the end.** The stateful lane (gotcha 1) persists the journal across runs, so a date reused by a later run may already hold content a previous run wrote (e.g. a restored entry body). This broke `backup-restore.spec.ts` twice, on both sides of the same operation:
   - **Deleting:** if a spec types a known fixture string and later backspaces exactly `FIXTURE.length` times to clear it, a rerun that appends onto pre-existing content only removes the newly-typed copy, leaving the field non-empty — and any code gated on "field became blank" (e.g. `deleteEntryIfEmpty`'s debounced auto-delete) never fires.
   - **Writing:** `editor.click()` on a contenteditable body does not guarantee the cursor lands at the *end* of any existing text — on a non-empty paragraph it can land mid-content. Typing a fixture string there splices it into the middle of the old content instead of replacing it (observed: `"...trip wo" + FIXTURE + "rks end to end."`), and the corruption then persists through anything downstream (e.g. a manual snapshot taken right after).

   Fix both the same way: read the field's real current value at the point of use (e.g. `editor.getText()` for a `.ProseMirror` body) and clear it — `Ctrl+End` then one `Backspace` per character in a loop — before either deleting or typing new content. `.setValue()`-backed fields (e.g. `title-input`) don't have this problem — `setValue()` fully overwrites rather than appends or inserting-at-cursor, so a fixed fixture length is safe there; the hazard is specific to per-keystroke insertion into contenteditable bodies. Also prefer exact equality (`===`) over `.includes()` when asserting a contenteditable body's final content — a corrupted body that merely *contains* the fixture as a substring (exactly the splice pattern above) will still pass an `.includes()` check.

8. **`elem.getText()` is unreliable for matching against a CSS-truncated element — use `browser.execute((el) => el.textContent, elem)` instead.** `backup-restore.spec.ts` matched a snapshot-entry row by `row.getText().includes(fixture)`; the row's title and preview both carry Tailwind `truncate` (`overflow:hidden` + `text-overflow:ellipsis`), and WebDriver's `getText()` is spec'd to return *rendered* text — WebKitWebDriver (CI, Linux) and msedgedriver (local, Windows) are not guaranteed to compute that identically for a clipped box, so the same DOM matched locally and timed out on CI with no code difference and no flakiness (deterministic on both sides). `element.textContent`, read via `browser.execute`, is unaffected by CSS truncation on either engine and is the reliable choice whenever a selector target might be visually clipped.

9. **Never target a WebDriver element `.click()` at `body` (or anything else) while a Kobalte modal (`ConfirmDialog`, etc.) is open.** Kobalte sets `pointer-events: none` on `<body>` for the duration a `Dialog` is open, re-enabling `pointer-events: auto` only on `Dialog.Overlay` itself — that is how it blocks all background interaction except the backdrop. WebDriver's click actionability check rejects any target element whose own computed `pointer-events` is `none`, so `$('body').click(...)` times out as "element did not become interactable," deterministically, on every run while the dialog is up. This broke `multi-entry.spec.ts`'s outside-backdrop-click assertion (UX-GATE scenario #15). Retargeting the click at the overlay div doesn't reliably fix it either — the overlay is `fixed inset-0`, so its center coincides with the centered dialog card (a sibling subtree, not a descendant), and center-based actionability hit-testing can land on the card instead. Use a raw viewport-origin pointer action instead, which targets no element and so isn't subject to element actionability at all: `await browser.action('pointer').move({ x, y, origin: 'viewport' }).down().up().perform();`.
