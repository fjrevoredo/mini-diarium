# E2E Tests (e2e/) — Mini Diarium

> For project architecture and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

**Prerequisites:**
```bash
cargo install tauri-driver   # install once
```

## File Structure

```
e2e/
├── specs/
│   ├── diary-workflow.spec.ts  # Core workflow: create → write → lock → unlock → verify
│   └── multi-entry.spec.ts    # Multi-entry persistence + nav bar edge cases
└── tsconfig.json               # Separate TS config (node + webdriverio/async globals)
wdio.conf.ts                    # WebdriverIO config (root level)
```

## Specs

| File | Description |
|------|-------------|
| `e2e/specs/diary-workflow.spec.ts` | 1 test: create diary → write entry → lock → unlock → verify persistence |
| `e2e/specs/multi-entry.spec.ts` | 1 test (3 scenarios): (A) 2 entries persist after lock/unlock; (B) "+" enabled after "←" navigation from blank entry (v0.4.9 Variant 1); (C) "+" enabled after day-switch with blank entry (v0.4.9 Variant 2) |

## Verification Commands

```bash
bun run test:e2e:local                  # Build binary + run full suite
bun run test:e2e:local -- --skip-build  # Skip build, run suite only (faster on repeat runs)
bun run test:e2e                        # Run suite only (binary must already exist)
bun run test:e2e:stateful               # Stateful E2E mode (persistence-oriented lane)
```

## data-testid Attributes

The source of truth for these attributes is the frontend components in `src/`. Do not use selectors not listed here — add a `data-testid` to the component first.

| Component | Element | data-testid |
|-----------|---------|-------------|
| `PasswordCreation.tsx` | Password input | `password-create-input` |
| `PasswordCreation.tsx` | Confirm password input | `password-repeat-input` |
| `PasswordCreation.tsx` | Create button | `create-journal-button` |
| `PasswordPrompt.tsx` | Password input | `password-unlock-input` |
| `PasswordPrompt.tsx` | Unlock submit button | `unlock-journal-button` |
| `Header.tsx` | Sidebar toggle (hamburger) | `toggle-sidebar-button` |
| `Header.tsx` | Lock button | `lock-journal-button` |
| `TitleEditor.tsx` | Title input | `title-input` |
| `Calendar.tsx` | Each day button | `calendar-day-YYYY-MM-DD` |
| `EntryNavBar.tsx` | Nav bar container | `entry-nav-bar` |
| `EntryNavBar.tsx` | Previous entry button (`←`) | `entry-prev-button` |
| `EntryNavBar.tsx` | Entry position counter | `entry-counter` |
| `EntryNavBar.tsx` | Next entry button (`→`) | `entry-next-button` |
| `EntryNavBar.tsx` | Delete entry button (`−`) | `entry-delete-button` |
| `EntryNavBar.tsx` | Add entry button (`+`) | `entry-add-button` |

## Gotchas and Pitfalls

1. **E2E mode contracts:** Default E2E uses clean-room mode (`E2E_MODE=clean`) and sets both `MINI_DIARIUM_DATA_DIR` (fresh temp diary path) and `MINI_DIARIUM_E2E=1` (backend disables `tauri-plugin-window-state` so host window geometry does not leak into tests). Stateful lane (`bun run test:e2e:stateful`) uses a repo-local persistent root (`.e2e-stateful/`, optionally overridden by `E2E_STATEFUL_ROOT`) for persistence-specific checks.

2. **Sidebar is always in mobile/overlay mode during E2E**: Default clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px). The sidebar uses `lg:relative lg:translate-x-0`, so calendar day elements are only reachable after opening the sidebar. Any change to `isSidebarCollapsed` default or `resetUiState()` WILL break E2E tests. When frontend UI visibility signal defaults change, audit specs here.

3. **E2E viewport sizing — three rules that must hold:**
   - **Why this keeps breaking:** WebView2 captures CSS viewport values (`100vh`, `window.innerHeight`) at first paint. Any resize after `win.show()` leaves those values stale, producing a white gap above vertically-centred content. This has broken three times (v0.4.3, v0.4.9 ×2); the root cause is always the same pattern.
   - **Rust** (`lib.rs`): call `win.set_size(LogicalSize::new(800, 660))` **before** `win.show()` in E2E mode. Never move it after. This is the single source of truth for E2E viewport size. Production window: `800×780` (`tauri.conf.json`).
   - **CSS**: all screen-filling containers (`JournalPicker`, `PasswordCreation`, `PasswordPrompt`, `App` checking state, `MainLayout`) use `h-full` (`height: 100%` via `html → body → #root` chain from `index.html`). **Never** use `h-screen`/`min-h-screen` (`100vh`) — it may report the full Tauri inner-window height (including the native app menu bar) rather than the WebView viewport, making containers taller than the visible area.
   - **wdio** (`wdio.conf.ts`): the `before` hook must NOT call `browser.setWindowSize()`. WebDriver `setWindowRect` fires after first paint and uses different size semantics than Tauri's `LogicalSize` — see "why this keeps breaking" above.
   - **uno.config.ts**: `h-screen` and `min-h-screen` are intentionally **absent** from the safelist. Do not add them back.
