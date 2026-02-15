# Current Plan vs Codebase Audit (Tasks 1-34) - Self-Checked Revision

Date: 2026-02-15  
Scope: Compare `Current-implementation-plan.md` claims vs actual code for tasks 1-34.

## Verification rerun (this revision)
- Frontend checks:
  - `C:\Users\Francisco\.bun\bin\bun.exe run type-check` -> pass
  - `C:\Users\Francisco\.bun\bin\bun.exe run lint` -> pass with warnings (0 errors, 6 warnings)
  - `C:\Users\Francisco\.bun\bin\bun.exe run format:check` -> fail (5 files not formatted)
- Rust checks:
  - `C:\Users\Francisco\.cargo\bin\cargo.exe test --lib` -> **85 tests run: 81 passed, 4 failed**

Failing Rust tests:
- `commands::import::tests::test_rebuild_fts_index` (`src-tauri/src/commands/import.rs:216`)
- `import::merge::tests::test_merge_different_titles_and_texts` (`src-tauri/src/import/merge.rs:93`)
- `import::merge::tests::test_merge_recalculates_word_count` (`src-tauri/src/import/merge.rs:191`)
- `import::minidiary::tests::test_is_valid_date_format` (`src-tauri/src/import/minidiary.rs:217`)

## Key current-state summary
- Plan still says Phase 3 is "NOT STARTED" and next is Task 34 (`Current-implementation-plan.md:10`, `Current-implementation-plan.md:25`).
- Codebase includes Task 34 parser work (`src-tauri/src/import/minidiary.rs`) and also additional out-of-scope progress into Task 35/36:
  - merge module: `src-tauri/src/import/merge.rs`
  - import command: `src-tauri/src/commands/import.rs`
  - import overlay/menu wiring: `src/components/overlays/ImportOverlay.tsx`, `src-tauri/src/menu.rs`, `src/components/layout/MainLayout.tsx`

## Task-by-task status (1-34)

### Phase 1
1. Task 1: **Aligned**  
Evidence: `package.json:2`, `src-tauri/tauri.conf.json:5`.
2. Task 2: **Partial / regressed**  
`lint` and `type-check` pass, but `format:check` fails (task verification criteria in plan requires all three).
3. Task 3: **Aligned**  
Expected folders/modules exist under `src/` and `src-tauri/src/`.
4. Task 4: **Aligned**  
Argon2id params in `src-tauri/src/crypto/password.rs:8`-`src-tauri/src/crypto/password.rs:10`.
5. Task 5: **Aligned**  
AES-GCM implementation in `src-tauri/src/crypto/cipher.rs:85`, `src-tauri/src/crypto/cipher.rs:114`.
6. Task 6: **Aligned**  
Schema + FTS + triggers in `src-tauri/src/db/schema.rs:106`, `src-tauri/src/db/schema.rs:127`, `src-tauri/src/db/schema.rs:136`.
7. Task 7: **Aligned**  
CRUD + encrypted storage + FTS update path in `src-tauri/src/db/queries.rs`.
8. Task 8: **Partial**  
Commands implemented; tests are mostly workflow/unit-style rather than explicit command-boundary integration harness.
9. Task 9: **Partial**  
Same testing gap pattern as Task 8.
10. Task 10: **Partial**  
Feature exists, no frontend component tests.
11. Task 11: **Partial**  
Feature exists, no frontend component tests.
12. Task 12: **Aligned**  
Auth-state routing in `src/App.tsx` is complete.
13. Task 13: **Partial (intentional deviation)**  
TipTap persists HTML (`getHTML`) instead of Markdown extension.
14. Task 14: **Aligned**  
Enter in title now focuses editor end (`src/components/layout/EditorPanel.tsx:105`).
15. Task 15: **Partial**  
Debounced save/unload save exist, but explicit blur-save and timer tests are missing.
16. Task 16: **Partial (implementation difference)**  
Custom calendar implementation, not Kobalte Calendar + Temporal.
17. Task 17: **Aligned**  
Entry-date markers implemented.
18. Task 18: **Aligned**  
Calendar-editor date loading flow implemented.
19. Task 19: **Aligned**  
Empty-entry auto-delete logic implemented.

### Phase 2
20. Task 20: **Partial**  
Search command works; still only serialization test + TODO for comprehensive FTS tests (`src-tauri/src/commands/search.rs:56`, `src-tauri/src/commands/search.rs:62`).
21. Task 21: **Aligned**  
Debounced search + immediate clear behavior implemented.
22. Task 22: **Aligned**  
Search sorted newest-first in backend (`ORDER BY date DESC`).
23. Task 23: **Aligned**  
Go-to-today next to search, disabled when already selected, icon present.
24. Task 24: **Partial**  
Toolbar implemented with Lucide icons; automated toolbar tests still missing.
25. Task 25: **Aligned**  
Word count from persisted value after save.
26. Task 26: **Partial (implementation difference)**  
Navigation integrated in `Calendar.tsx`; no separate `CalendarNav.tsx`.
27. Task 27: **Partial (spec mismatch)**  
Behavior works, but accelerator mapping differs from plan wording.
28. Task 28: **Aligned**  
Go-to-date overlay validation implemented.
29. Task 29: **Aligned**  
Future-date restriction + clamp behavior implemented.
30. Task 30: **Aligned**  
First-day-of-week preference implemented.
31. Task 31: **Aligned**  
Hide-titles preference implemented.
32. Task 32: **Aligned**  
Spellcheck preference implemented and wired to both editors.
33. Task 33: **Aligned**  
Statistics backend + overlay + menu wiring implemented.

### Phase 3 start
34. Task 34: **Partial (implemented but not green)**  
Mini Diary JSON parser exists with tests in `src-tauri/src/import/minidiary.rs`, but at least one parser test currently fails (`src-tauri/src/import/minidiary.rs:217`).

## Scorecard (tasks 1-34)
- **Aligned:** 21
- **Partial / deviating:** 13
- **Not implemented:** 0

## Out-of-scope progress noticed (beyond task 34)
- Task 35 artifacts present: `src-tauri/src/import/merge.rs` (with tests).
- Task 36 artifacts present: `src-tauri/src/commands/import.rs`, `src/components/overlays/ImportOverlay.tsx`, menu/state wiring in `src-tauri/src/menu.rs`, `src/components/layout/MainLayout.tsx`, and IPC wrapper in `src/lib/tauri.ts`.
- These out-of-scope features currently contribute to failing Rust tests.

## Immediate blockers before claiming stable progress
1. Fix the 4 failing Rust tests (parser strict-date, merge word-count expectations, FTS rebuild test).
2. Resolve plan/status mismatch (plan says Phase 3 not started while code contains Task 34+ work).
3. Decide and document whether HTML persistence remains accepted for Task 13.
4. Run formatter and commit style fixes for the 5 flagged frontend files.
