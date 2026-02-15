# Testing Assessment by Implemented Feature (Tasks 1-34) - Self-Checked Revision

Date: 2026-02-15

## Legend
- `1` = Add tests
- `2` = Remove tests
- `3` = Both (add and remove)
- `4` = Test looks fine for the feature

## Current testing baseline (revalidated)
- Frontend automated tests under `src/`: **none found** (`*.test.*` / `*.spec.*` absent).
- Rust automated tests: **85 total**, **81 pass**, **4 fail** (`cargo test --lib`).
- Failing Rust tests:
  - `commands::import::tests::test_rebuild_fts_index` (`src-tauri/src/commands/import.rs:216`)
  - `import::merge::tests::test_merge_different_titles_and_texts` (`src-tauri/src/import/merge.rs:93`)
  - `import::merge::tests::test_merge_recalculates_word_count` (`src-tauri/src/import/merge.rs:191`)
  - `import::minidiary::tests::test_is_valid_date_format` (`src-tauri/src/import/minidiary.rs:217`)

## Coverage target check (80%)
- Feature-level automated coverage for tasks 1-34 is still well below 80%.
- Main gap is frontend/component/integration coverage, not backend unit-test count.

## Per-feature recommendations (tasks 1-34)

| Task | Feature | Current test state | Rec | Recommendation |
|---|---|---|---|---|
| 1 | Tauri + Solid init | Structural validation only | 4 | No dedicated tests needed beyond build/dev checks. |
| 2 | Tooling/lint/typecheck/format | Scripts exist, `format:check` currently fails | 4 | Keep test strategy; enforce `lint`, `type-check`, and `format:check` in CI gate. |
| 3 | Folder structure | Structural only | 4 | No dedicated tests needed. |
| 4 | Argon2 password crypto | Strong unit coverage | 4 | Looks fine. |
| 5 | AES-GCM crypto | Strong unit coverage | 4 | Looks fine. |
| 6 | DB schema + FTS | Good unit coverage | 4 | Looks fine. |
| 7 | DB CRUD + encryption | Good unit coverage | 4 | Looks fine. |
| 8 | Auth commands | Workflow-heavy tests, limited IPC-boundary confidence | 3 | Add 3 command-boundary integration tests; remove 2 duplicated DB workflow tests from command module after replacements exist. |
| 9 | Entry commands | Same pattern as task 8 | 3 | Add 3 command-boundary integration tests; remove 1 duplicated workflow test after replacement. |
| 10 | Password creation UI | No component tests | 1 | Add 3 tests: mismatch validation, minimum-length validation, successful submit path. |
| 11 | Password prompt UI | No component tests | 1 | Add 3 tests: required validation, wrong-password handling, successful unlock path. |
| 12 | Auth routing + layout branch | No UI routing tests | 1 | Add 2 tests for `App.tsx` auth-state branch rendering. |
| 13 | Diary editor (HTML persistence) | No editor component tests | 1 | Add 4 tests: initial hydrate, update emits HTML, prop sync, editor-ready callback. |
| 14 | Title editor enter behavior | No tests | 1 | Add 2 tests: Enter calls `onEnter`, input calls `onInput`. |
| 15 | Debounced autosave | No timer/integration tests | 1 | Add 4 tests: 500ms debounce, rapid typing collapse, unload-save trigger, empty-entry delete branch. |
| 16 | Calendar core rendering | No component tests | 1 | Add 4 tests: grid render, selected day highlight, month shift, disabled future dates. |
| 17 | Entry-day highlighting | No dedicated tests | 1 | Add 2 tests for dot rendering/reactivity to `entryDates`. |
| 18 | Calendar-editor integration | No integration tests | 1 | Add 3 tests: date change loads/clears entry, save refreshes date list. |
| 19 | Empty auto-delete | No UI boundary tests | 1 | Add 2 tests: empty calls delete path; non-empty does not. |
| 20 | Search command (FTS) | Serialization test only | 1 | Add 4 tests: title match, text match, prefix behavior, empty results. |
| 21 | Search bar debounce | No component tests | 1 | Add 2 tests: debounce timing and immediate clear reset. |
| 22 | Search results list | No component tests | 1 | Add 3 tests: result ordering assumption, click navigation, empty state. |
| 23 | Go-to-today button | No component tests | 1 | Add 2 tests: disabled state when today selected, click behavior otherwise. |
| 24 | Editor toolbar | No component tests | 1 | Add 4 tests: bold/italic/list toggles and active-state updates. |
| 25 | Word count display | No component tests | 1 | Add 2 tests: singular/plural rendering and persisted-count update path. |
| 26 | Calendar month navigation | No dedicated tests | 1 | Add 2 tests: prev/next month actions and date stability. |
| 27 | Keyboard/menu date navigation | Command tests exist, UI integration untested | 1 | Add 3 tests: keyboard shortcuts, menu event listeners, future-clamp behavior. |
| 28 | Go-to-date overlay | No component tests | 1 | Add 3 tests: disabled invalid/unchanged/future, submit flow, escape close. |
| 29 | Future-date restriction preference | No dedicated preference tests | 1 | Add 3 tests: calendar disable, clamp behavior, go-to-date restriction interplay. |
| 30 | First-day-of-week preference | No dedicated tests | 1 | Add 3 tests: weekday header rotation, offset correctness, persistence reload. |
| 31 | Hide titles preference | No dedicated tests | 1 | Add 2 tests: title visibility toggle and title persistence despite hidden editor. |
| 32 | Spellcheck preference | No dedicated tests | 1 | Add 3 tests: pref toggle persistence, title spellcheck attr, editor spellcheck attr update. |
| 33 | Statistics (backend + overlay) | Backend tests good; overlay untested | 1 | Add 4 tests: loading/error/success rendering, formatting assertions, close behavior. |
| 34 | Mini Diary JSON parser | Parser tests present; strict-date test currently failing | 1 | Add 2 edge tests (metadata/schema tolerance), keep failing strict-date test and fix parser to satisfy it. |

## Recommendation totals (tasks 1-34)
- Additions recommended: **~73 tests**
- Removals recommended: **~3 tests** (after replacement integration tests are added)

## Out-of-scope but currently implemented (impacts baseline)
- Task 35/36 work is present and currently tested:
  - `src-tauri/src/import/merge.rs`
  - `src-tauri/src/commands/import.rs`
  - `src/components/overlays/ImportOverlay.tsx`
- These out-of-scope areas currently include failing tests and should be stabilized before claiming overall test health.

## Priority execution plan toward 80%
1. Fix current failing Rust tests (all 4) to restore green baseline.
2. Add first wave of high-impact frontend tests (tasks 10, 11, 13, 15, 21, 22, 24, 28, 32, 33).
3. Add command/UI integration tests for tasks 8, 9, 27, 29, 30, 31.
4. Keep E2E deferred, but define 5 smoke specs now for final phase.

## Immediate next step
- Resolve the four failing Rust tests first, then scaffold frontend test infrastructure (Vitest + Solid Testing Library) and implement the first 10 component/integration tests.
