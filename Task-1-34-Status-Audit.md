# Current Plan vs Codebase Audit (Tasks 1-34)

Date: 2026-02-15  
Scope: Compare `Current-implementation-plan.md` claims vs actual code for tasks 1-34.

## What I verified
- Static code audit across frontend and backend files.
- Frontend checks:
  - `C:\Users\Francisco\.bun\bin\bun.exe run type-check` -> pass
  - `C:\Users\Francisco\.bun\bin\bun.exe run lint` -> pass with warnings (0 errors, 6 warnings)
- Rust checks:
  - `C:\Users\Francisco\.cargo\bin\cargo.exe test --lib` -> **81 tests run: 78 passed, 3 failed**

## Key current-state summary
- Plan header says Phase 3 is "NOT STARTED" and next is Task 34 (`Current-implementation-plan.md:10`, `Current-implementation-plan.md:25`).
- Codebase already has Task 34 parser implementation and tests (`src-tauri/src/import/minidiary.rs:45`, `src-tauri/src/import/minidiary.rs:102`).
- Codebase also has out-of-scope progress into Task 35 (merge logic + tests) (`src-tauri/src/import/merge.rs:18`, `src-tauri/src/import/merge.rs:83`).
- Rust test suite currently fails on three import tests:
  - `src-tauri/src/import/minidiary.rs:217`
  - `src-tauri/src/import/merge.rs:93`
  - `src-tauri/src/import/merge.rs:191`

## Task-by-task status (1-34)

### Phase 1
1. Task 1: **Aligned**  
Evidence: `package.json:2`, `src-tauri/tauri.conf.json:5`.
2. Task 2: **Aligned**  
Evidence: scripts/config present and checks run; `type-check` + `lint` commands succeed (`package.json:12`, `package.json:16`).
3. Task 3: **Aligned**  
Evidence: required folders/modules exist under `src/` and `src-tauri/src/`.
4. Task 4: **Aligned**  
Evidence: Argon2id params in `src-tauri/src/crypto/password.rs:8`-`src-tauri/src/crypto/password.rs:10`.
5. Task 5: **Aligned**  
Evidence: AES-GCM encrypt/decrypt in `src-tauri/src/crypto/cipher.rs:85`, `src-tauri/src/crypto/cipher.rs:114`.
6. Task 6: **Aligned**  
Evidence: schema + FTS + triggers in `src-tauri/src/db/schema.rs:106`, `src-tauri/src/db/schema.rs:127`, `src-tauri/src/db/schema.rs:136`.
7. Task 7: **Aligned**  
Evidence: CRUD + FTS index update in `src-tauri/src/db/queries.rs:21`, `src-tauri/src/db/queries.rs:194`.
8. Task 8: **Partial**  
Commands exist, but tests are workflow/unit style rather than true Tauri command integration harness (`src-tauri/src/commands/auth.rs:23`, `src-tauri/src/commands/auth.rs:184`).
9. Task 9: **Partial**  
Commands implemented, but same test mismatch as task 8 (`src-tauri/src/commands/entries.rs:9`, `src-tauri/src/commands/entries.rs:118`).
10. Task 10: **Partial**  
Feature works (`src/components/auth/PasswordCreation.tsx`), but no frontend component tests.
11. Task 11: **Partial**  
Feature works (`src/components/auth/PasswordPrompt.tsx`), but no frontend component tests.
12. Task 12: **Aligned**  
Routing/layout flow present in `src/App.tsx:13`, `src/App.tsx:23`, `src/App.tsx:32`.
13. Task 13: **Partial (intentional deviation)**  
Uses HTML via TipTap `getHTML()` rather than Markdown extension (`src/components/editor/DiaryEditor.tsx:45`, `src/components/editor/DiaryEditor.tsx:59`).
14. Task 14: **Aligned**  
Enter in title now focuses editor (`src/components/layout/EditorPanel.tsx:105`).
15. Task 15: **Partial**  
Debounced save + unload save exist (`src/components/layout/EditorPanel.tsx:87`, `src/components/layout/EditorPanel.tsx:109`), but explicit blur-save and timer tests are missing.
16. Task 16: **Partial (implementation difference)**  
Calendar is custom, not Kobalte Calendar/Temporal as written in plan (`src/components/calendar/Calendar.tsx`).
17. Task 17: **Aligned**  
Entry-date highlighting exists (`src/components/calendar/Calendar.tsx:64`, `src/components/calendar/Calendar.tsx:193`).
18. Task 18: **Aligned**  
Calendar/editor integration works (`src/components/layout/EditorPanel.tsx:20`, `src/components/layout/Header.tsx:12`).
19. Task 19: **Aligned**  
Empty entry deletion path exists (`src/components/layout/EditorPanel.tsx:51`).

### Phase 2
20. Task 20: **Partial**  
Search command works, but still only serialization test and TODO for comprehensive FTS tests (`src-tauri/src/commands/search.rs:15`, `src-tauri/src/commands/search.rs:56`, `src-tauri/src/commands/search.rs:62`).
21. Task 21: **Aligned**  
Search bar debounce/clear behavior implemented (`src/components/search/SearchBar.tsx:28`, `src/components/search/SearchBar.tsx:45`).
22. Task 22: **Aligned**  
Newest-first ordering now in backend query (`src-tauri/src/commands/search.rs:33`).
23. Task 23: **Aligned**  
Go-to-today button now beside search with disabled state and icon (`src/components/layout/Sidebar.tsx:48`, `src/components/layout/Sidebar.tsx:56`).
24. Task 24: **Partial**  
Toolbar + Lucide icons implemented (`src/components/editor/EditorToolbar.tsx:3`), but no automated toolbar tests.
25. Task 25: **Aligned**  
Word count from persisted entry data (`src/components/layout/EditorPanel.tsx:72`, `src/components/editor/WordCount.tsx:5`).
26. Task 26: **Partial (implementation difference)**  
Month navigation exists in `Calendar.tsx`; no separate `CalendarNav.tsx`.
27. Task 27: **Partial (spec mismatch)**  
Navigation works, but accelerator mapping differs from plan text (`src-tauri/src/menu.rs:10`, `src-tauri/src/menu.rs:26`).
28. Task 28: **Aligned**  
Go-to-date overlay with validation/disable logic (`src/components/overlays/GoToDateOverlay.tsx:19`, `src/components/overlays/GoToDateOverlay.tsx:102`).
29. Task 29: **Aligned**  
Future-date restriction + clamping implemented (`src/components/calendar/Calendar.tsx:66`, `src/lib/shortcuts.ts:66`, `src/components/layout/MainLayout.tsx:58`).
30. Task 30: **Aligned**  
First-day-of-week preference implemented (`src/state/preferences.ts:5`, `src/components/overlays/PreferencesOverlay.tsx:103`, `src/components/calendar/Calendar.tsx:140`).
31. Task 31: **Aligned**  
Hide titles preference implemented (`src/state/preferences.ts:6`, `src/components/layout/EditorPanel.tsx:124`).
32. Task 32: **Aligned**  
Spellcheck preference wired to both editors (`src/state/preferences.ts:7`, `src/components/editor/TitleEditor.tsx:40`, `src/components/editor/DiaryEditor.tsx:41`).
33. Task 33: **Aligned**  
Stats command + overlay + menu wiring implemented (`src-tauri/src/commands/stats.rs:18`, `src/components/overlays/StatsOverlay.tsx:11`, `src-tauri/src/menu.rs:39`, `src-tauri/src/lib.rs:60`).

### Phase 3 start
34. Task 34: **Partial (implemented but not green)**  
Parser implementation exists and is wired into module tree (`src-tauri/src/import/minidiary.rs:45`, `src-tauri/src/import/mod.rs:2`, `src-tauri/src/lib.rs:4`), with tests present (`src-tauri/src/import/minidiary.rs:102`).  
Current blocker: test failure in date validation strictness (`src-tauri/src/import/minidiary.rs:217`).

## Scorecard (tasks 1-34)
- **Aligned:** 22
- **Partial / deviating:** 12
- **Not implemented:** 0

## Out-of-scope progress noticed
- Task 35 artifacts already exist: `src-tauri/src/import/merge.rs` + tests.
- Current failures there indicate unresolved word-count expectations on merged text (`src-tauri/src/import/merge.rs:93`, `src-tauri/src/import/merge.rs:191`).

## Immediate blockers before claiming stable progress
1. Fix failing Rust tests in import modules (3 failures).
2. Resolve plan/status inconsistency for Task 34 and Phase 3 start.
3. Decide whether Markdown is still a requirement for Task 13 or accepted long-term deviation.
