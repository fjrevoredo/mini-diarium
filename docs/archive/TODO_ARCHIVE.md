# TODO Archive

Archived completed items moved out of [TODO.md](../TODO.md). This keeps the active backlog focused on open work while preserving the original task notes.

## Completed

- [x] **Expanded rich text editor support** (2026-02-28) — extend the built-in editor with more complete rich text capabilities beyond the current formatting set; define the supported feature set, keep the UX consistent with local-first editing, and ensure stored HTML remains compatible with import/export flows
- [x] **Configurable auto-lock timeout** (2026-03-01) — add a new Preferences setting to enable auto-lock and set the idle timeout in seconds; enforce a valid range of `1` to `999` seconds and lock the diary automatically when the threshold is reached
- [x] **Hide advanced rich-text controls behind a setting** (2026-03-01) — add a preference to keep the default editor toolbar minimal and reveal the extra formatting controls (for example underline, strikethrough, blockquote, inline code, horizontal rule, and heading picker) only when the user opts in; define the default state, make sure the setting only affects toolbar visibility and not rendering of existing content, and keep import/export behavior unchanged
- [x] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
- [x] **Basic embedded images in the editor** (2026-03-03) (#40) — support inserting and rendering inline images in diary entries, starting with the drag-and-drop flow that currently shows an OS-level “copy” affordance on macOS but does nothing in the editor; align PHILOSOPHY/docs wording and the UI capability so “basic embedded images” is either truly supported or not implied
- [x] **Text highlight formatting** (#41) — add a highlight/marker formatting option in the editor to improve scanability; start with a single theme-safe color and place it in the advanced formatting toolbar if shipped, then verify how it should round-trip through stored HTML plus Markdown/JSON export paths
- [x] **Configurable editor font size** (2026-03-01) (#30) — add a font-size preference (Preferences → Writing) so users can increase or decrease the editor text size; store in `localStorage` alongside existing preferences; apply via a CSS custom property on the editor container so no re-render is needed; define a sensible range (e.g. 12–24 px) and a default that matches the current size
- [x] **Fix window position flash on startup** (2026-03-05) — app appears in top-left then blinks to last position; `tauri-plugin-window-state` should restore position before the window is shown; investigate whether `visible_on_all_workspaces` or show-on-ready approach fixes it (issue #43)
  - **Root cause:** `tauri.conf.json:13-20` has no `"visible": false` on the window object, so Tauri shows the window at default (0,0) immediately; then `tauri-plugin-window-state` restores the saved bounds, causing the visible jump.
  - **Fix:** add `"visible": false` to the window config in `tauri.conf.json:13-20`; in `lib.rs` setup closure (after the plugin is registered at lines 56-60), call `app.get_webview_window("main").unwrap().show()` to reveal the window only after state has been restored. Must still be skipped in E2E mode (see existing `MINI_DIARIUM_E2E` guard pattern).
- [x] **Auto-select last-used journal on startup** (2026-03-05) — skip the journal picker when there is a previously used journal; go directly to password prompt and let the user switch journals from within the app (issue #43, owner agreed on this approach)
  - **Root cause:** `src/state/auth.ts` `initializeAuth()` (lines 66-73) always ends with `setAuthState('journal-select')`, even when `activeJournalId()` is already set after `loadJournals()`.
  - **Fix:** after `loadJournals()`, check `activeJournalId() !== null`; if so, call `refreshAuthState()` (already handles `diaryExists`/`isDiaryUnlocked` checks and transitions to the right state) instead of hard-coding `'journal-select'`. Only fall back to `'journal-select'` when no active journal is known.
  - **Files:** `src/state/auth.ts:66-73`, `src/state/journals.ts:8-12`.
- [x] **Fix "+" (add entry) button not working** (2026-03-05) — the plus icon in the header that creates an additional entry for the same day is reported as non-functional; investigate and fix (issue #43)
  - **Investigation:** the button IS rendered outside the `<Show when={props.total >= 2}>` guard in `EntryNavBar.tsx:37-43` and IS wired to `addEntry()` in `EditorPanel.tsx:307`. The function logic looks correct (save current → createEntry → refresh list).
  - **Likely problem:** errors in `addEntry()` are swallowed silently (logged only, `EditorPanel.tsx:204`). No loading/disabled state during async call; rapid double-clicks can cause duplicates. User sees nothing happen if an error occurs.
  - **Fix:** surface errors to the user (set a visible error signal); disable the button while `addEntry()` is in flight using `isCreatingEntry` (declared at line 38 but not yet used as a guard).
  - **Files:** `src/components/editor/EntryNavBar.tsx`, `src/components/layout/EditorPanel.tsx:173-206`.
- [x] **Fix "go to today" calendar button not working** (2026-03-05) — the calendar icon that should navigate to today is reported as non-functional; also disable/hide the button when already viewing today (issue #43)
  - **Root cause:** the sidebar button (`Sidebar.tsx:52-60`) correctly calls `setSelectedDate(getTodayString())`, but `currentMonth` is a **local `createSignal` inside `Calendar.tsx:20`** not connected to `selectedDate`. So when viewing a past/future month, "go to today" updates `selectedDate` but the calendar view stays on the old month — today is never visible.
  - **Fix option A (recommended):** add a `createEffect` inside `Calendar.tsx` that watches `selectedDate` and resets `currentMonth` when the selected date falls outside the currently displayed month. The sidebar button should also call `setCurrentMonth(new Date())`.
  - **Fix option B:** move `currentMonth`/`setCurrentMonth` into `src/state/ui.ts` as a shared signal, and have the sidebar button set it directly.
  - **Files:** `src/components/calendar/Calendar.tsx:20`, `src/components/layout/Sidebar.tsx:52-60`, `src/state/ui.ts`.
- [x] **Fix clicking days from adjacent months in calendar** (2026-03-05) — clicking a day shown from the previous or next month in the left calendar panel should navigate to that day (issue #43)
  - **Root cause:** `Calendar.tsx:130-138` `handleDayClick` has an `if (day.isCurrentMonth)` guard; adjacent-month day buttons are also `disabled={!day.isCurrentMonth}` (line 193).
  - **Fix:** remove the `isCurrentMonth` guard in `handleDayClick` and the `disabled` condition for adjacent-month days. When an adjacent-month day is clicked, call `setCurrentMonth` to navigate the calendar to that month AND call `setSelectedDate(day.date)`. The `isDisabled` future-date guard should remain — only the `isCurrentMonth` restriction is removed.
  - **Files:** `src/components/calendar/Calendar.tsx:130-138, 193`.
- [x] **Fix text alignment in left panel** (2026-03-05) — lines in the left sidebar panel are not aligned correctly; audit sidebar/calendar layout CSS (issue #43)
  - **Root cause:** the "Go to Today" button wrapper in `Sidebar.tsx:50` uses `flex justify-end`, right-aligning the button, while the Calendar below it is left-aligned — creating visual misalignment.
  - **Fix:** change the wrapper to `flex justify-start` (or remove the flex wrapper entirely) so the button aligns with the left edge of the calendar.
  - **File:** `src/components/layout/Sidebar.tsx:50`.
- [x] **Fix settings tab hover text readability on light theme** (2026-03-05) — hovered tab text becomes hard to read in the light theme; pick a contrast-safe color (issue #43)
  - **Root cause:** the active tab in `PreferencesOverlay.tsx:402` uses hardcoded Tailwind classes `bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200` instead of CSS variables. The `dark:` prefix only applies when a `.dark` class is on a parent element; if the dialog renders in a portal without that class, dark-mode active-tab colors won't apply.
  - **Fix:** replace hardcoded Tailwind active-tab colors with CSS variables (`bg-active`/`text-primary` or a dedicated `--tab-active-bg`/`--tab-active-text` variable in `index.css`) so they always follow the current theme.
  - **Files:** `src/components/overlays/PreferencesOverlay.tsx:399-403`, `src/index.css`.
- [x] **Fix empty editor placeholder showing "loading"** (2026-03-05) — when no entry exists for the selected day the editor placeholder reads "loading" instead of a proper empty-state message (issue #43)
  - **Root cause:** `EditorPanel.tsx:317` and `324` use `placeholder={isLoadingEntry() ? 'Loading...' : '...'}`. TipTap's Placeholder extension shows the placeholder whenever the editor is empty; during async entry-load (`isLoadingEntry === true`) an empty editor displays "Loading..." as its placeholder text.
  - **Fix:** use static placeholders (`'Title (optional)'` and `"What's on your mind today?"`) always; handle the loading state through a separate overlay or by disabling the editor while `isLoadingEntry()` is true — do not overload the placeholder prop for loading feedback.
  - **Files:** `src/components/layout/EditorPanel.tsx:317, 324`.
- [x] **Add "-" button to delete current extra entry (same day)** — add a delete-entry button next to the existing `+` button in the entry navigator for multi-entry days (2026-03-05)
  - **Visibility requirement:** show the `-` button only when the selected day has more than 1 entry
  - **Tooltip requirement:** the `-` button must have a clear tooltip that explains the action before click
  - **Confirmation requirement:** clicking `-` opens a `Yes` / `No` confirmation dialog
  - **Delete requirement:** selecting `Yes` deletes the currently selected entry for that day
  - **Navigation requirement:** after delete, navigate to the next available entry for that same day
  - **Cancel requirement:** selecting `No` closes the dialog and changes nothing
- [x] **Unify terminology to "Journal" across app and codebase** (2026-03-05) — remove mixed `diary`/`journal` wording and standardize user-facing language and internal naming conventions
  - **UI text requirement:** all user-visible labels/messages/tooltips/dialogs must use `Journal` consistently
  - **Codebase requirement:** naming in frontend/backend command wrappers and state modules should be aligned to the same term where feasible, with compatibility preserved where renames would break public interfaces
  - **Documentation requirement:** repository docs (README, guides, and related docs) must be updated to use `Journal` terminology consistently
  - **Website requirement:** marketing website content under `website/` must also use `Journal` terminology consistently
  - **Compatibility requirement:** existing persisted data, command contracts, and migrations must keep working after terminology cleanup