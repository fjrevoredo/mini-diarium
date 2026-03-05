# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

TODO entry format:
- `- [ ] **Task title** — concise description with scope, constraints, and any key implementation notes`
- Put items under the appropriate priority section
- Use indented checkbox items only for true sub-tasks or explicit dependencies


---
## High Priority

- [ ] **Fix window position flash on startup** — app appears in top-left then blinks to last position; `tauri-plugin-window-state` should restore position before the window is shown; investigate whether `visible_on_all_workspaces` or show-on-ready approach fixes it (issue #43)
  - **Root cause:** `tauri.conf.json:13-20` has no `"visible": false` on the window object, so Tauri shows the window at default (0,0) immediately; then `tauri-plugin-window-state` restores the saved bounds, causing the visible jump.
  - **Fix:** add `"visible": false` to the window config in `tauri.conf.json:13-20`; in `lib.rs` setup closure (after the plugin is registered at lines 56-60), call `app.get_webview_window("main").unwrap().show()` to reveal the window only after state has been restored. Must still be skipped in E2E mode (see existing `MINI_DIARIUM_E2E` guard pattern).
- [ ] **Auto-select last-used journal on startup** — skip the journal picker when there is a previously used journal; go directly to password prompt and let the user switch journals from within the app (issue #43, owner agreed on this approach)
  - **Root cause:** `src/state/auth.ts` `initializeAuth()` (lines 66-73) always ends with `setAuthState('journal-select')`, even when `activeJournalId()` is already set after `loadJournals()`.
  - **Fix:** after `loadJournals()`, check `activeJournalId() !== null`; if so, call `refreshAuthState()` (already handles `diaryExists`/`isDiaryUnlocked` checks and transitions to the right state) instead of hard-coding `'journal-select'`. Only fall back to `'journal-select'` when no active journal is known.
  - **Files:** `src/state/auth.ts:66-73`, `src/state/journals.ts:8-12`.
- [ ] **Fix "+" (add entry) button not working** — the plus icon in the header that creates an additional entry for the same day is reported as non-functional; investigate and fix (issue #43)
  - **Investigation:** the button IS rendered outside the `<Show when={props.total >= 2}>` guard in `EntryNavBar.tsx:37-43` and IS wired to `addEntry()` in `EditorPanel.tsx:307`. The function logic looks correct (save current → createEntry → refresh list).
  - **Likely problem:** errors in `addEntry()` are swallowed silently (logged only, `EditorPanel.tsx:204`). No loading/disabled state during async call; rapid double-clicks can cause duplicates. User sees nothing happen if an error occurs.
  - **Fix:** surface errors to the user (set a visible error signal); disable the button while `addEntry()` is in flight using `isCreatingEntry` (declared at line 38 but not yet used as a guard).
  - **Files:** `src/components/editor/EntryNavBar.tsx`, `src/components/layout/EditorPanel.tsx:173-206`.
- [ ] **Fix "go to today" calendar button not working** — the calendar icon that should navigate to today is reported as non-functional; also disable/hide the button when already viewing today (issue #43)
  - **Root cause:** the sidebar button (`Sidebar.tsx:52-60`) correctly calls `setSelectedDate(getTodayString())`, but `currentMonth` is a **local `createSignal` inside `Calendar.tsx:20`** not connected to `selectedDate`. So when viewing a past/future month, "go to today" updates `selectedDate` but the calendar view stays on the old month — today is never visible.
  - **Fix option A (recommended):** add a `createEffect` inside `Calendar.tsx` that watches `selectedDate` and resets `currentMonth` when the selected date falls outside the currently displayed month. The sidebar button should also call `setCurrentMonth(new Date())`.
  - **Fix option B:** move `currentMonth`/`setCurrentMonth` into `src/state/ui.ts` as a shared signal, and have the sidebar button set it directly.
  - **Files:** `src/components/calendar/Calendar.tsx:20`, `src/components/layout/Sidebar.tsx:52-60`, `src/state/ui.ts`.
- [ ] **Fix clicking days from adjacent months in calendar** — clicking a day shown from the previous or next month in the left calendar panel should navigate to that day (issue #43)
  - **Root cause:** `Calendar.tsx:130-138` `handleDayClick` has an `if (day.isCurrentMonth)` guard; adjacent-month day buttons are also `disabled={!day.isCurrentMonth}` (line 193).
  - **Fix:** remove the `isCurrentMonth` guard in `handleDayClick` and the `disabled` condition for adjacent-month days. When an adjacent-month day is clicked, call `setCurrentMonth` to navigate the calendar to that month AND call `setSelectedDate(day.date)`. The `isDisabled` future-date guard should remain — only the `isCurrentMonth` restriction is removed.
  - **Files:** `src/components/calendar/Calendar.tsx:130-138, 193`.
- [ ] **Fix text alignment in left panel** — lines in the left sidebar panel are not aligned correctly; audit sidebar/calendar layout CSS (issue #43)
  - **Root cause:** the "Go to Today" button wrapper in `Sidebar.tsx:50` uses `flex justify-end`, right-aligning the button, while the Calendar below it is left-aligned — creating visual misalignment.
  - **Fix:** change the wrapper to `flex justify-start` (or remove the flex wrapper entirely) so the button aligns with the left edge of the calendar.
  - **File:** `src/components/layout/Sidebar.tsx:50`.
- [ ] **Fix settings tab hover text readability on light theme** — hovered tab text becomes hard to read in the light theme; pick a contrast-safe color (issue #43)
  - **Root cause:** the active tab in `PreferencesOverlay.tsx:402` uses hardcoded Tailwind classes `bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200` instead of CSS variables. The `dark:` prefix only applies when a `.dark` class is on a parent element; if the dialog renders in a portal without that class, dark-mode active-tab colors won't apply.
  - **Fix:** replace hardcoded Tailwind active-tab colors with CSS variables (`bg-active`/`text-primary` or a dedicated `--tab-active-bg`/`--tab-active-text` variable in `index.css`) so they always follow the current theme.
  - **Files:** `src/components/overlays/PreferencesOverlay.tsx:399-403`, `src/index.css`.
- [ ] **Fix empty editor placeholder showing "loading"** — when no entry exists for the selected day the editor placeholder reads "loading" instead of a proper empty-state message (issue #43)
  - **Root cause:** `EditorPanel.tsx:317` and `324` use `placeholder={isLoadingEntry() ? 'Loading...' : '...'}`. TipTap's Placeholder extension shows the placeholder whenever the editor is empty; during async entry-load (`isLoadingEntry === true`) an empty editor displays "Loading..." as its placeholder text.
  - **Fix:** use static placeholders (`'Title (optional)'` and `"What's on your mind today?"`) always; handle the loading state through a separate overlay or by disabling the editor while `isLoadingEntry()` is true — do not overload the placeholder prop for loading feedback.
  - **Files:** `src/components/layout/EditorPanel.tsx:317, 324`.


---

## Medium Priority

- [ ] **Remove minimum password length requirement** — the current UI enforces a minimum length; the owner needs to verify whether the encryption algorithm truly requires it (Argon2id does not); if not required, remove the hard block and replace with a strength hint/suggestion (issue #43)
  - **Investigation:** the 8-char minimum is enforced frontend-only in three places: `src/components/auth/PasswordCreation.tsx:28-31`, `src/components/overlays/PreferencesOverlay.tsx:218-221` (change password), and `PreferencesOverlay.tsx:300-303` (add password auth method). The backend (`src-tauri/src/crypto/password.rs`) and Argon2id have **no minimum length** — any string including empty is accepted.
  - **Fix:** remove the hard `return` block in each location; replace with a visual strength hint (e.g. yellow warning if < 8 chars, green if ≥ 12). The "Create"/"Save" button should remain enabled. Optionally add backend validation only for empty-string passwords.
  - **Files:** `src/components/auth/PasswordCreation.tsx:28-31`, `src/components/overlays/PreferencesOverlay.tsx:218-221, 300-303`.
- [ ] **Add month/year picker to left calendar** — clicking on the month/year header in the sidebar calendar should open a date-picker so users can jump to any month/year directly (issue #43)
  - **Investigation:** Calendar header (`Calendar.tsx:161`) is a static `<h3>` with no click handler. No date-picker library is installed (only `@kobalte/core` for UI primitives). A native `<input type="month">` approach is viable without new dependencies.
  - **Fix option A (simple):** replace the `<h3>` with a button that shows a `<Show>`-gated `<input type="month">` popover on click — no extra dependency.
  - **Fix option B (polished):** render a 12-month grid + year steppers in a small dropdown (~50 extra lines, no new dependency).
  - Clicking a month/year in either picker calls `setCurrentMonth(new Date(year, month))`. If the "go to today" fix (item above) moves `currentMonth` to `ui.ts`, this picker updates the same shared signal.
  - **File:** `src/components/calendar/Calendar.tsx`.
- [ ] **Restore CI diagram content-diff check** — the byte-comparison check in `scripts/verify-diagrams.mjs` was reverted to existence-only because mmdc/d2 produce slightly different SVG bytes depending on version (local vs CI runners differ). The proper fix is to pin identical tool versions in both CI and local dev (e.g. lock `@mermaid-js/mermaid-cli` in `devDependencies` and `d2` via a specific release download in CI), then re-add the byte comparison. Until then, `diagrams:check` only verifies that all 8 `.svg` files are present.
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
  - [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.


---

## Low Priority / Future

- [ ] **PDF export** — convert diary entries to PDF (A4); likely via Tauri webview printing
- [ ] **Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app’s privacy guarantees
- [ ] **Statistics extension point** — add a plugin/extension interface for journal statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app’s privacy-first local-only model
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and can be heap-copied across import/export flows; pass references where possible to reduce allocations when processing thousands of entries; audit current command and export call sites
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **Accessibility audit** — only 5 ARIA labels exist (Calendar nav buttons, EditorToolbar buttons); missing ARIA on overlays, form inputs, dialogs, focus trapping, and keyboard calendar navigation; add color contrast testing and screen reader testing (NVDA / VoiceOver)
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the diary DB location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
- [ ] **Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - [ ] **Optimize demo media** — replace the 4.7 MB `website/assets/demo.gif` with a lightweight preview strategy (e.g. poster image + optional MP4/WebM playback) to reduce transfer size and improve performance signals
  - [ ] **Canonical host redirect** — enforce one canonical host (`mini-diarium.com` vs `www`) with explicit 301 behavior in deployment/edge config and keep `<link rel="canonical">` aligned
  - [ ] **Email no-JS fallback** — make the contact email actionable without JavaScript (server-rendered `mailto:`), keeping optional obfuscation/enhancement on top
  - [ ] **Release freshness ops** — document and automate post-release discovery flow (Search Console URL inspection/request indexing and optional IndexNow ping) for high-cadence releases
