# Current Plan vs Codebase Audit (Tasks 1-31)

Date: 2026-02-15  
Plan audited: `Current-implementation-plan.md`

## Scope and method
- Compared every task claim from 1 through 31 in `Current-implementation-plan.md:58` through `Current-implementation-plan.md:256` against the actual codebase.
- Used static code verification (file/function/component presence, behavior-level checks, and acceptance-criteria deltas).
- Ran available frontend checks with Bun from `C:\Users\Francisco\.bun\bin\bun.exe`.

## Verification limits
- `bun run type-check` passed.
- `bun run lint` failed with 2 errors and 5 warnings.
  - Errors: `src/components/calendar/Calendar.tsx:46`, `src/components/overlays/PreferencesOverlay.tsx:94`.
- Could not run Rust tests in this environment because `cargo` is not available in PATH.

## Executive summary
- The plan currently says tasks 1-30 are complete and task 31 is next (`Current-implementation-plan.md:6`, `Current-implementation-plan.md:20`, `Current-implementation-plan.md:743`, `Current-implementation-plan.md:756`).
- Codebase reality for tasks 1-31:
  - 16 tasks are broadly aligned/implemented.
  - 15 tasks are partial or materially divergent from the stated acceptance criteria.
  - Task 31 is already implemented in code, so the plan status is stale.

## Task-by-task audit (1-31)

### Phase 1 (Tasks 1-19)

1. Task 1 (claimed complete): **Aligned (static evidence only)**  
Evidence: `package.json:2`, `src-tauri/tauri.conf.json:3`, `src-tauri/tauri.conf.json:5`.

2. Task 2 (claimed complete): **Partial / regressed**  
What matches: scripts/config exist (`package.json:12`, `package.json:15`, `package.json:16`, `tsconfig.json:19`, `vite.config.ts:10`).  
Gap: lint no longer passes (2 errors, 5 warnings), which contradicts the task verification claim.

3. Task 3 (claimed complete): **Aligned**  
Evidence: expected module structure exists (e.g., `src/components/overlays/GoToDateOverlay.tsx`, `src/components/editor/EditorToolbar.tsx`, `src-tauri/src/commands/auth.rs`; plus backend folders `import/export/backup/i18n`).

4. Task 4 (claimed complete): **Aligned**  
Evidence: Argon2id with m=65536, t=3, p=4 in `src-tauri/src/crypto/password.rs:7`, `src-tauri/src/crypto/password.rs:8`, `src-tauri/src/crypto/password.rs:9`, `src-tauri/src/crypto/password.rs:10`; hashing/verify functions in `src-tauri/src/crypto/password.rs:47`, `src-tauri/src/crypto/password.rs:73`.

5. Task 5 (claimed complete): **Aligned**  
Evidence: AES-256-GCM encrypt/decrypt in `src-tauri/src/crypto/cipher.rs:85`, `src-tauri/src/crypto/cipher.rs:114`; zeroization in `src-tauri/src/crypto/cipher.rs:15`.

6. Task 6 (claimed complete): **Aligned**  
Evidence: schema/tables/triggers/FTS5 in `src-tauri/src/db/schema.rs:106`, `src-tauri/src/db/schema.rs:111`, `src-tauri/src/db/schema.rs:117`, `src-tauri/src/db/schema.rs:127`, `src-tauri/src/db/schema.rs:136`, `src-tauri/src/db/schema.rs:142`, `src-tauri/src/db/schema.rs:148`.

7. Task 7 (claimed complete): **Aligned**  
Evidence: CRUD functions in `src-tauri/src/db/queries.rs:21`, `src-tauri/src/db/queries.rs:59`, `src-tauri/src/db/queries.rs:117`, `src-tauri/src/db/queries.rs:160`, `src-tauri/src/db/queries.rs:176`.

8. Task 8 (claimed complete): **Partial**  
What matches: auth commands exist in `src-tauri/src/commands/auth.rs:23`, `src-tauri/src/commands/auth.rs:43`, `src-tauri/src/commands/auth.rs:63`, `src-tauri/src/commands/auth.rs:92`, `src-tauri/src/commands/auth.rs:152`; registered in `src-tauri/src/lib.rs:42`-`src-tauri/src/lib.rs:48`.  
Gap: plan claims Tauri integration tests, but file contains workflow/unit style tests rather than Tauri command integration harness (`src-tauri/src/commands/auth.rs:184` onward).

9. Task 9 (claimed complete): **Partial**  
What matches: entry commands exist in `src-tauri/src/commands/entries.rs:9`, `src-tauri/src/commands/entries.rs:54`, `src-tauri/src/commands/entries.rs:67`, `src-tauri/src/commands/entries.rs:90`; update timestamp logic in `src-tauri/src/commands/entries.rs:21`, `src-tauri/src/commands/entries.rs:34`.  
Gap: plan claims integration tests; file has workflow/unit tests (`src-tauri/src/commands/entries.rs:118` onward).

10. Task 10 (claimed complete): **Partial**  
What matches: password creation UI + validation exists (`src/components/auth/PasswordCreation.tsx:24`, `src/components/auth/PasswordCreation.tsx:72`, `src/components/auth/PasswordCreation.tsx:98`), state + IPC wired (`src/state/auth.ts:29`, `src/lib/tauri.ts:4`).  
Gap: no frontend component tests found.

11. Task 11 (claimed complete): **Partial**  
What matches: password prompt UI and error handling (`src/components/auth/PasswordPrompt.tsx:16`, `src/components/auth/PasswordPrompt.tsx:22`, `src/components/auth/PasswordPrompt.tsx:28`, `src/components/auth/PasswordPrompt.tsx:72`); unlock flow loads entry dates (`src/state/auth.ts:53`).  
Gap: no frontend component tests found.

12. Task 12 (claimed complete): **Aligned**  
Evidence: auth-based routing in `src/App.tsx:13`, `src/App.tsx:23`, `src/App.tsx:28`, `src/App.tsx:32`; two-panel layout in `src/components/layout/MainLayout.tsx` and responsive sidebar behavior in `src/components/layout/Sidebar.tsx`.

13. Task 13 (claimed complete): **Partial / criteria mismatch**  
What exists: TipTap with StarterKit and placeholder (`src/components/editor/DiaryEditor.tsx:26`, `src/components/editor/DiaryEditor.tsx:31`).  
Gap: no Markdown extension; editor update uses `getText()` not markdown serialization (`src/components/editor/DiaryEditor.tsx:43`); no component tests found.

14. Task 14 (claimed complete): **Partial**  
What matches: title editor exists/integrated (`src/components/editor/TitleEditor.tsx`, `src/components/layout/EditorPanel.tsx:125`).  
Gap: Enter-to-focus-body behavior is not implemented (callback in panel is a log only).

15. Task 15 (claimed complete): **Partial**  
What matches: debounced autosave 500ms (`src/components/layout/EditorPanel.tsx:85`), save on unload (`src/components/layout/EditorPanel.tsx:105`, `src/components/layout/EditorPanel.tsx:110`).  
Gap: no explicit blur-save handler found; no timer-based tests found.

16. Task 16 (claimed complete): **Partial / implementation differs from plan**  
What matches: calendar exists with selected date handling and month navigation UI (`src/components/calendar/Calendar.tsx:121`, `src/components/calendar/Calendar.tsx:125`, `src/components/calendar/Calendar.tsx:135`).  
Gap vs plan: not using Kobalte Calendar component and not using Temporal utilities.

17. Task 17 (claimed complete): **Aligned**  
Evidence: entry-date highlighting logic (`src/components/calendar/Calendar.tsx:38`, `src/components/calendar/Calendar.tsx:202`).

18. Task 18 (claimed complete): **Aligned**  
Evidence: date selection drives entry load in editor (`src/components/layout/EditorPanel.tsx:18`); entry date list refreshed after save/delete (`src/components/layout/EditorPanel.tsx:54`, `src/components/layout/EditorPanel.tsx:69`); formatted date in header (`src/components/layout/Header.tsx`).

19. Task 19 (claimed complete): **Aligned**  
Evidence: empty entry auto-delete flow (`src/components/layout/EditorPanel.tsx:52`).

### Phase 2 subset (Tasks 20-31)

20. Task 20 (claimed complete): **Partial**  
What matches: FTS5 search command and ranking query (`src-tauri/src/commands/search.rs:15`, `src-tauri/src/commands/search.rs:32`, `src-tauri/src/commands/search.rs:33`).  
Gap: plan claims substantive search tests; file explicitly notes TODO and only has serialization test (`src-tauri/src/commands/search.rs:56`, `src-tauri/src/commands/search.rs:62`).

21. Task 21 (claimed complete): **Aligned**  
Evidence: debounced search + immediate clear behavior (`src/components/search/SearchBar.tsx:29`, `src/components/search/SearchBar.tsx:38`, `src/components/search/SearchBar.tsx:47`).

22. Task 22 (claimed complete): **Partial**  
What matches: results list, click-to-navigate, no-title fallback, empty state (`src/components/search/SearchResults.tsx:7`, `src/components/search/SearchResults.tsx:26`, `src/components/search/SearchResults.tsx:34`, `src/components/search/SearchResults.tsx:43`).  
Gap: plan says newest-first sorting, but UI renders backend order directly (`src/components/search/SearchResults.tsx:34`) while backend orders by rank (`src-tauri/src/commands/search.rs:33`).

23. Task 23 (claimed complete): **Partial**  
What matches: Go To Today button exists (`src/components/layout/Sidebar.tsx:70`) and sets today (`src/components/layout/Sidebar.tsx:66`).  
Gaps vs plan: button is not next to search, has no disabled state, and no icon.

24. Task 24 (claimed complete): **Partial**  
What matches: toolbar with bold/italic/list toggles + active states (`src/components/editor/EditorToolbar.tsx:10`-`src/components/editor/EditorToolbar.tsx:13`, `src/components/editor/EditorToolbar.tsx:42`, `src/components/editor/EditorToolbar.tsx:46`, `src/components/editor/EditorToolbar.tsx:109`, `src/components/editor/EditorToolbar.tsx:134`).  
Gaps: no Lucide icons (custom SVGs used) and no toolbar tests found.

25. Task 25 (claimed complete): **Aligned**  
Evidence: word count component (`src/components/editor/WordCount.tsx:5`) and persisted-data update path after save (`src/components/layout/EditorPanel.tsx:75`).

26. Task 26 (claimed complete): **Partial / implementation differs from plan**  
What matches: previous/next month navigation exists in calendar (`src/components/calendar/Calendar.tsx:121`, `src/components/calendar/Calendar.tsx:125`).  
Gaps vs plan: no separate `CalendarNav.tsx`; date math uses JS `Date`, not Temporal.

27. Task 27 (claimed complete): **Partial / shortcut spec differs**  
What matches: navigation commands + menu wiring + keyboard shortcuts are implemented (`src-tauri/src/commands/navigation.rs:5`, `src-tauri/src/menu.rs:67`, `src/lib/shortcuts.ts:63`).  
Gaps vs plan text: month/day accelerator mapping differs from the stated mapping (implemented as `CmdOrCtrl+Left/Right` for day and `CmdOrCtrl+Shift+Left/Right` for month in `src-tauri/src/menu.rs:10`, `src-tauri/src/menu.rs:14`, `src-tauri/src/menu.rs:26`, `src-tauri/src/menu.rs:30`), and menu file shows no platform-specific branching.

28. Task 28 (claimed complete): **Aligned**  
Evidence: Kobalte dialog + date input + disabled validation + state integration (`src/components/overlays/GoToDateOverlay.tsx:19`, `src/components/overlays/GoToDateOverlay.tsx:33`, `src/components/overlays/GoToDateOverlay.tsx:84`, `src/components/overlays/GoToDateOverlay.tsx:102`).

29. Task 29 (claimed complete): **Aligned**  
Evidence: preference default false (`src/state/preferences.ts:11`), calendar disables future dates (`src/components/calendar/Calendar.tsx:66`, `src/components/calendar/Calendar.tsx:200`), next-day/month clamping in shortcuts/menu listeners (`src/lib/shortcuts.ts:66`, `src/lib/shortcuts.ts:104`, `src/components/layout/MainLayout.tsx:58`, `src/components/layout/MainLayout.tsx:111`).

30. Task 30 (claimed complete): **Aligned**  
Evidence: `firstDayOfWeek` preference in state (`src/state/preferences.ts:5`, `src/state/preferences.ts:12`), overlay control (`src/components/overlays/PreferencesOverlay.tsx:27`, `src/components/overlays/PreferencesOverlay.tsx:49`), calendar week/day rotation (`src/components/calendar/Calendar.tsx:42`, `src/components/calendar/Calendar.tsx:140`).

31. Task 31 (plan says not complete / next): **Implemented (plan status is stale)**  
Plan still marks this as next (`Current-implementation-plan.md:20`, `Current-implementation-plan.md:256`, `Current-implementation-plan.md:756`).  
Code already implements it: preference field and default (`src/state/preferences.ts:6`, `src/state/preferences.ts:13`), preferences UI (`src/components/overlays/PreferencesOverlay.tsx:29`, `src/components/overlays/PreferencesOverlay.tsx:50`), conditional title visibility (`src/components/layout/EditorPanel.tsx:124`).

## High-impact discrepancies to fix in the plan
1. Update progress summary to reflect that Task 31 is already implemented in code.
2. Reclassify several “complete” tasks as “complete with deviations” or reopen them:
   - Task 13 (Markdown behavior mismatch)
   - Task 14 (Enter-to-body focus behavior)
   - Task 15 (missing blur-save + test claim)
   - Task 22 (sorting criterion mismatch)
   - Task 23 (UI placement/disabled/icon criteria mismatch)
   - Task 24 (icon/test criterion mismatch)
   - Task 26 (implementation approach mismatch)
   - Task 27 (shortcut/menu spec mismatch)
3. Adjust testing claims: many tasks cite frontend/integration tests that are not present in the repository.

## Optional follow-up actions
1. I can patch `Current-implementation-plan.md` so status text and per-task checkmarks match the actual codebase.
2. I can open a second report that separates “feature complete” vs “acceptance-complete” to make planning decisions easier.
3. I can implement/fix the concrete gaps above (starting with Task 13/14/15), then rerun lint/type-check.
