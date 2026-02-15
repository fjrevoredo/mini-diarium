# Testing Assessment by Implemented Feature (Tasks 1-34)

Date: 2026-02-15

## Legend
- `1` = Add tests
- `2` = Remove tests
- `3` = Both (add and remove)
- `4` = Test looks fine for the feature

## Current testing baseline
- Frontend automated tests: **none found** under `src/` (`*.test.*` / `*.spec.*` not present).
- Rust automated tests: **81 total**, **78 pass**, **3 fail** (`cargo test --lib`).
- Current Rust failures:
  - `import::merge::tests::test_merge_different_titles_and_texts` (`src-tauri/src/import/merge.rs:93`)
  - `import::merge::tests::test_merge_recalculates_word_count` (`src-tauri/src/import/merge.rs:191`)
  - `import::minidiary::tests::test_is_valid_date_format` (`src-tauri/src/import/minidiary.rs:217`)

## Coverage target check (80%)
- If we measure feature-level automated coverage for tasks 1-34, the project is currently well below 80% because UI-heavy tasks have little/no automated coverage.
- Main gap is frontend/component/integration test coverage, not raw backend unit test volume.

## Per-feature recommendations

| Task | Feature | Current test state | Rec | Recommendation |
|---|---|---|---|---|
| 1 | Tauri + Solid init | Structural only | 4 | No dedicated tests needed beyond build/dev checks. |
| 2 | Tooling/lint/typecheck | Verified by scripts | 4 | Keep as-is; continue CI enforcement. |
| 3 | Folder structure | Structural only | 4 | No dedicated tests needed. |
| 4 | Argon2 password crypto | Strong unit coverage (`src-tauri/src/crypto/password.rs`) | 4 | Looks fine. |
| 5 | AES-GCM crypto | Strong unit coverage (`src-tauri/src/crypto/cipher.rs`) | 4 | Looks fine. |
| 6 | DB schema + FTS | Good unit coverage (`src-tauri/src/db/schema.rs`) | 4 | Looks fine. |
| 7 | DB CRUD + encryption | Good unit coverage (`src-tauri/src/db/queries.rs`) | 4 | Looks fine. |
| 8 | Auth commands | Has tests but mostly DB/workflow duplication (`src-tauri/src/commands/auth.rs:184`) | 3 | Add 3 real command-invocation integration tests; remove 2 duplicated DB-open/create workflow tests from command module. |
| 9 | Entry commands | Has workflow tests (`src-tauri/src/commands/entries.rs:118`) | 3 | Add 3 command-level integration tests (save/get/delete via command boundary); remove 1 duplicated word-count test from command module. |
| 10 | Password creation UI | No component tests | 1 | Add 3 tests: match validation, min length validation, successful submit path. |
| 11 | Password prompt UI | No component tests | 1 | Add 3 tests: required validation, wrong-password error reset, successful unlock transition. |
| 12 | Auth routing + main layout | No component/integration tests | 1 | Add 2 tests for `App.tsx` state routing branches (`no-diary`, `locked`, `unlocked`). |
| 13 | Diary editor (TipTap HTML persistence) | No editor component tests | 1 | Add 4 tests: initial content hydration, HTML on update, content sync on prop change, editor ready callback. |
| 14 | Title editor enter-to-focus | No tests | 1 | Add 2 tests: Enter triggers `onEnter`, input emits `onInput`. |
| 15 | Debounced autosave | No timer tests | 1 | Add 4 tests: 500ms debounce behavior, rapid typing collapse, unload save trigger, empty-entry delete branch. |
| 16 | Calendar core rendering | No calendar tests | 1 | Add 4 tests: day grid generation, selected date highlighting, month switch, disabled future dates. |
| 17 | Entry-date highlighting | No dedicated tests | 1 | Add 2 tests: entry dot rendering and update when `entryDates` changes. |
| 18 | Calendar-editor integration | No integration tests | 1 | Add 3 tests: selecting date loads entry, missing entry clears form, saving refreshes date markers. |
| 19 | Empty auto-delete | No dedicated tests at UI boundary | 1 | Add 2 tests: empty title/text calls delete command; non-empty does not. |
| 20 | Search command (FTS) | Minimal serialization-only test (`src-tauri/src/commands/search.rs:62`) | 1 | Add 4 tests: title match, text match, prefix/fuzzy query shape, empty result path. |
| 21 | Search bar debounce | No component tests | 1 | Add 2 tests: debounce timing and immediate clear behavior. |
| 22 | Search results list | No component tests | 1 | Add 3 tests: newest-first order assumption, click navigates date, empty-state rendering. |
| 23 | Go-to-today button | No component tests | 1 | Add 2 tests: disabled when today selected, click sets today otherwise. |
| 24 | Editor toolbar | No toolbar tests | 1 | Add 4 tests: bold/italic/list toggles and active-state styling. |
| 25 | Word count display | No component tests | 1 | Add 2 tests: singular/plural text and persisted count update integration from panel. |
| 26 | Calendar month navigation | No dedicated tests | 1 | Add 2 tests: previous/next month controls keep valid dates. |
| 27 | Date navigation shortcuts/menu | Rust command tests exist (`src-tauri/src/commands/navigation.rs`) | 1 | Add 3 integration tests: menu event -> state update, keyboard shortcut handling, future-clamp behavior with preference off. |
| 28 | Go-to-date overlay | No component tests | 1 | Add 3 tests: disabled invalid/unchanged/future date, submit sets date, escape closes. |
| 29 | Future-date restriction pref | No dedicated pref tests | 1 | Add 3 tests: calendar disable logic, next-day clamp, go-to-date restriction interaction. |
| 30 | First-day-of-week pref | No dedicated tests | 1 | Add 3 tests: week header rotation, grid offset rotation, persistence reload. |
| 31 | Hide titles pref | No tests | 1 | Add 2 tests: TitleEditor hidden when enabled, title still preserved in saved entry. |
| 32 | Spellcheck pref | No tests | 1 | Add 3 tests: checkbox persistence, `TitleEditor` spellcheck attr, TipTap spellcheck attr update. |
| 33 | Statistics (backend + overlay) | Backend has good unit tests (`src-tauri/src/commands/stats.rs`) but no overlay tests | 1 | Add 4 tests: overlay loading/error/success states, number formatting, open/close flow. |
| 34 | Mini Diary JSON parser | Good parser tests exist, but one failing strict-format test (`src-tauri/src/import/minidiary.rs:217`) | 1 | Add 2 tests: strict 4-digit year enforcement and metadata edge cases; keep failing test and fix parser behavior to satisfy it. |

## Recommended additions/removals summary
- Additions recommended: **~73 tests** (mix of unit/component/integration; many are small focused tests).
- Removals recommended: **3 tests** (duplicate command-module workflow tests once command-level integration tests are in place).

## Priority plan to approach 80% efficiently
1. **Stabilize current Rust suite first**
   - Fix the 3 failing import tests and align word-count semantics for merged separator handling.
2. **Add high-leverage frontend/component tests**
   - Start with tasks 10, 11, 13, 15, 21, 22, 24, 28, 32, 33.
3. **Add key integration tests (backend + UI wiring)**
   - Task 8, 9, 27, 29, 30, 31.
4. **Defer E2E until phase-end, but define smoke list now**
   - Create/unlock diary
   - Write/edit/save entry
   - Search and jump to result
   - Preferences toggles (future dates/hide titles/spellcheck)
   - Statistics overlay open/load/close

## Suggested immediate next step
- Implement the three failing import test fixes first, then add the first 10 frontend/component tests from the priority list to quickly raise meaningful coverage.
