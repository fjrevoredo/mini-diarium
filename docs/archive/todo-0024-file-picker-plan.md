# TODO-0024: Let users pick .db file directly instead of folder for "Open Existing"

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-10
- Last Updated: 2026-05-10
- Owner: Coding agent
- Approval: PENDING
- Source TODO: `docs/todo/TODO.md` TODO-0024

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace the folder picker in the "Open Existing Journal" flow with a file picker filtered to `.db` files. The user selects a `.db` file directly; the parent directory is extracted and stored as the journal path. The DB filename (no longer hardcoded to `diary.db`) is persisted in `JournalConfig` so journal switches work correctly. Backups are namespaced by DB filename stem (`backups/{stem}/`) so co-located journals don't share a backup pool.

## Scope

- File dialog for "Open Existing" (`handleBrowseOpen` in `JournalPicker.tsx`)
- `JournalConfig.db_filename` optional field (defaults to `"diary.db"`)
- `check_diary_path` backend command: accept file path, check existence directly
- Derive `backups_dir` from the stem of `db_path` (`backups/{stem}/`) everywhere it is set
- `add_journal` backend command: accept optional `db_filename` parameter
- `switch_journal`, `remove_journal`, `change_diary_directory`: use `db_filename` from config instead of hardcoded `"diary.db"`
- `backup.rs`: rotate backups within namespaced subdirectory
- i18n: update `selectFolderTitle` and `noJournalFound` text for file-oriented UX
- `JournalPicker.test.tsx`: update dialog mock and assertions
- `backup.rs` tests: update for namespaced backup directories
- TypeScript `tauri.ts`: update `checkJournalPath` param name, `JournalConfig` interface, `addJournal` signature

## Non-Goals

- Changing the "Create New Journal" flow (still uses folder picker — `handleBrowseCreate` unchanged)
- Migrating existing flat `backups/` contents into the new namespaced `backups/{stem}/` directory
- Changing `DiaryState` struct fields (stem derived from `db_path`, no new field needed)
- Changing `change_diary_directory` UX (still folder-based; uses `db_filename` from config)
- Changing plugin directory (`plugins/` stays shared under journal dir)
- Updating E2E specs (audit only — no `.db` file picking exercised by current E2E)

## Assumptions

- `JournalConfig.path` continues to store a **directory** path (parent of the `.db` file)
- `JournalConfig.db_filename` defaults to `"diary.db"` when absent (backward-compatible with existing configs)
- `DiaryState.db_path` already stores the full path including filename — we derive the stem from it for `backups_dir`
- The `db_filename` for new journals created via "Create New Journal" is always `"diary.db"` (the user didn't pick a file)
- Existing backups at `{dir}/backups/` become orphaned but are not deleted; new backups go to `{dir}/backups/{stem}/`
- All `// Search index hook:` comments are preserved as-is

## Open Questions

- **chooseFolderTitle key**: Resolved — use generic text (`"Choose Location"`) that works for both the folder picker (create flow) and the file picker (open flow). Updated in Task 4.4.

## Milestones

### Milestone 1: Backend Data Model & Path Infrastructure

- Status: COMPLETED
- Purpose: Lay the config and stateless foundations before touching journal-switching logic.
- Exit Criteria: `JournalConfig` has `db_filename`, `check_diary_path` accepts file paths, `lib.rs` derives `db_filename` and namespaced backups on startup, `cargo test` passes.

#### Task 1.1: Add `db_filename` to `JournalConfig` and `JournalInfo`

- Status: COMPLETED
- Objective: `JournalConfig` carries an optional `db_filename` field. `JournalInfo` exposes it to the frontend.
- Steps:
  1. In `src-tauri/src/config.rs`, add `pub db_filename: Option<String>` to `JournalConfig` with `#[serde(skip_serializing_if = "Option::is_none")]`.
  2. Add `pub db_filename: String` to `JournalInfo` (always populated, defaults to `"diary.db"` when absent in config).
  3. Update `impl From<&JournalConfig> for JournalInfo` to populate `db_filename` from the config field (default `"diary.db"`).
  4. Update all `JournalConfig` literals in `config.rs` tests to include the new field.
- Validation: `cargo test --lib config` passes with zero failures.
- Notes: The `db_filename` field serializes as e.g. `"diary.db"` (includes extension). The stem for backups is extracted via `Path::file_stem()`.

#### Task 1.2: Update `check_diary_path` to accept a file path

- Status: COMPLETED
- Objective: The command checks if the given path exists as a file, not whether `{dir}/diary.db` exists.
- Steps:
  1. In `src-tauri/src/commands/auth/auth_core.rs`, change `check_diary_path` from `path.join("diary.db").exists()` to `path.exists() && path.is_file()` (or just `path.exists()` — the file dialog filters to `.db` so this is sufficient).
  2. Update the doc comment above the function to describe the new semantics.
  3. Update the test at ~line 562 to check a file path instead of a directory.
- Validation: `cargo test check_diary_path` or `cargo test --lib commands::auth` passes.
- Notes: Parameter name `dir` should be renamed to `path` in the Rust function signature and in the frontend wrapper.

#### Task 1.3: Update `lib.rs` startup to derive `db_filename` and namespaced backups

- Status: COMPLETED
- Objective: On app startup, `db_path` and `backups_dir` in `DiaryState` are set using the active journal's `db_filename` (if any), and backups are namespaced.
- Steps:
  1. In `src-tauri/src/lib.rs` (~lines 100-140), after determining `diary_dir` and before constructing `db_path`, look up the active journal's `db_filename` from config.
  2. Set `db_path = diary_dir.join(db_filename)` instead of `diary_dir.join("diary.db")`.
  3. Set `backups_dir = diary_dir.join("backups").join(stem)` where `stem` is derived from `db_path.file_stem()`.
  4. For the legacy/no-journal case, fall back to `"diary.db"` filename and `"diary"` stem.
- Validation: `cargo build` succeeds. No runtime test needed at this stage (tested end-to-end via integration in later milestones).
- Notes: The `stem` helper: `db_path.file_stem().and_then(|s| s.to_str()).unwrap_or("diary")`.

#### Task 1.4: Run backend tests to establish baseline

- Status: COMPLETED
- Objective: Confirm the current backend test suite passes before further changes.
- Steps:
  1. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` 
- Validation: All tests pass with zero failures.
- Notes: Some config tests may need updates from Task 1.1. Fix any failures before proceeding.

---

### Milestone 2: Journal Commands

- Status: COMPLETED
- Purpose: Update all journal management commands to accept, store, and use `db_filename`.
- Exit Criteria: `add_journal`, `switch_journal`, `remove_journal`, and `change_diary_directory` all use `db_filename`; relevant backend tests pass.

#### Task 2.1: Update `add_journal` to accept and store `db_filename`

- Status: COMPLETED
- Objective: `add_journal_inner` accepts an optional `db_filename` parameter and stores it in `JournalConfig`.
- Steps:
  1. Add `db_filename: Option<String>` parameter to `add_journal_inner` (after `path`).
  2. Store it in the `JournalConfig` literal: `db_filename: db_filename.filter(|s| s != "diary.db")` or just store it directly.
  3. Update the `#[tauri::command]` wrapper `add_journal` to accept the new param.
  4. Update `add_journal_inner` tests in `auth_journals.rs` to pass `None` for `db_filename`.
  5. Register the updated command parameter in `generate_handler![]` (lib.rs) — no change needed if the macro picks up the new param automatically.
- Validation: `cargo test auth_journals` passes.
- Notes: Default to storing `None` when `db_filename` is `"diary.db"` to minimize config.json churn. Use `db_filename.filter(|s| s != "diary.db")`.

#### Task 2.2: Update `switch_journal` to use `db_filename`

- Status: COMPLETED
- Objective: When switching journals, `db_path` and `backups_dir` are computed using the target journal's `db_filename`.
- Steps:
  1. In `switch_journal_inner` (`auth_journals.rs` ~line 157), read `journal.db_filename` and default to `"diary.db"`.
  2. Set `db_path = journal_dir.join(db_filename)` instead of `journal_dir.join("diary.db")`.
  3. Set `backups_dir = journal_dir.join("backups").join(stem)` where `stem` comes from `db_filename.file_stem()`.
  4. Update the `test_switch_journal_updates_paths` test to use a journal with a non-default `db_filename`.
- Validation: `cargo test switch_journal` passes.
- Notes: The `stem` computation: `Path::new(&db_filename).file_stem().and_then(|s| s.to_str()).unwrap_or("diary")`.

#### Task 2.3: Update `remove_journal` to use `db_filename`

- Status: COMPLETED
- Objective: When removing the active journal and switching to another, use the replacement journal's `db_filename`.
- Steps:
  1. In `remove_journal_inner` (`auth_journals.rs` ~line 88-98), read the replacement journal's `db_filename`.
  2. Use it when constructing the new `db_path` and `backups_dir`.
  3. Update relevant tests.
- Validation: `cargo test remove_journal` passes.
- Notes: Follow the same pattern as `switch_journal_inner`.

#### Task 2.4: Update `change_diary_directory` to use `db_filename`

- Status: COMPLETED
- Objective: The directory change command uses the current `db_filename` instead of hardcoded `"diary.db"`.
- Steps:
  1. In `change_diary_directory_inner` (`auth_directory.rs` ~line 21), replace `new_dir_path.join("diary.db")` with `new_dir_path.join(db_filename)`.
  2. Accept a `db_filename: &str` parameter — read from `DiaryState` by deriving from `db_path` before calling the inner function.
  3. Update `backups_dir` to use namespaced path.
  4. Update all tests in `auth_directory.rs` to pass a `db_filename` parameter.
- Validation: `cargo test auth_directory` passes.
- Notes: The `change_diary_directory` command handler reads `db_filename` from `state.db_path` stem before calling the inner function.

---

### Milestone 3: Backup Namespace

- Status: COMPLETED
- Purpose: Backups are stored in `backups/{db_stem}/` instead of flat `backups/`.
- Exit Criteria: `backup.rs` functions operate within a namespaced subdirectory; all `backup.rs` tests pass with updated paths.

#### Task 3.1: Update `backup.rs` call sites for namespaced paths

- Status: COMPLETED
- Objective: All places that construct `backups_dir` already use the namespaced path (from Milestones 1-2). Verify and fix any remaining hardcoded references.
- Steps:
  1. In `auth_core.rs` (unlock path, ~line 82), verify that `backup_and_rotate` is called with the state's `backups_dir` (which is now namespaced). No change needed if it already reads from state.
  2. Grep for `join("backups")` in `src-tauri/src/` to find any remaining flat-path constructions and update them.
  3. Ensure `create_backup` creates the namespaced directory (`fs::create_dir_all` already handles nested paths).
- Validation: `cargo build` succeeds; grep for `join("backups")` shows only the already-updated namespaced patterns.
- Notes: `auth_core.rs` `unlock_diary` (~line 82) calls `backup_and_rotate(&db_path, &backups_dir)` where `backups_dir` comes from `state.backups_dir.lock()`. This is already set correctly by lib.rs, switch_journal, etc. Verify no other call sites construct the path independently.

#### Task 3.2: Update `backup.rs` tests

- Status: COMPLETED
- Objective: All backup tests use namespaced backup directories (`backups/{stem}/`).
- Steps:
  1. Update the test helper to create a namespaced backup dir (e.g., `temp_dir.join("backups").join("diary")`).
  2. Update each test (`test_create_backup`, `test_rotate_backups_under_limit`, `test_rotate_backups_over_limit`, `test_backup_and_rotate`, `test_rotate_ignores_non_backup_files`, `test_backup_and_rotate_repeated_unlocks`) to use the namespaced path.
  3. The rotation logic (`rotate_backups`) reads files from the namespaced dir — verify the filter pattern `backup-*.db` still works within the namespace.
  4. The `rotate_backups` function itself does NOT need to change — it works on whatever `backups_dir` it receives.
- Validation: `cargo test backup` passes with zero failures.
- Notes: The `rotate_backups` function is path-agnostic; only the `backups_dir` passed to it changes. Tests just need their temp `backups_dir` to be the namespaced subdirectory.

---

### Milestone 4: Frontend

- Status: COMPLETED
- Purpose: Update TypeScript wrappers, the JournalPicker component, its tests, and i18n locale strings.
- Exit Criteria: File picker works for Open Existing, all frontend tests pass, i18n keys are file-oriented.

#### Task 4.1: Update `tauri.ts` wrappers

- Status: COMPLETED
- Objective: `checkJournalPath` accepts a file path; `addJournal` accepts optional `dbFilename`; `JournalConfig` includes `db_filename`.
- Steps:
  1. In `src/lib/tauri.ts`, update `JournalConfig` interface to include `db_filename: string`.
  2. Update `checkJournalPath` parameter name from `dir` to `path` (and update the invoke param name to match the Rust command).
  3. Update `addJournal` signature: `addJournal(name: string, path: string, dbFilename?: string)`.
  4. Update the `invoke` call in `addJournal` to pass the optional `dbFilename`.
- Validation: `cmd.exe /c bun run type-check` passes.
- Notes: The Rust command `check_diary_path` parameter was renamed from `dir` to `path` in Task 1.2 — keep the invoke param name in sync.

#### Task 4.2: Update `JournalPicker.tsx` — file dialog in `handleBrowseOpen`

- Status: COMPLETED
- Objective: `handleBrowseOpen` uses a file picker filtered to `.db` files, extracts parent directory and filename.
- Steps:
  1. Change the import from `import { confirm, open as openDirDialog }` to `import { confirm, open }`.
  2. In `handleBrowseCreate` (~line 79), replace `openDirDialog({ directory: true, ... })` with `open({ directory: true, ... })` (same call, different import name).
  3. In `handleBrowseOpen` (~line 119), replace `openDirDialog({ directory: true, ... })` with `open({ filters: [{ name: 'Database Files', extensions: ['db'] }], multiple: false, directory: false, title: t('auth.picker.selectFolderTitle') })`.
  4. After the file is selected, extract the parent directory: `const parentDir = selected.replace(/[/\\][^/\\]*$/, '')`.
  5. Extract the filename: `const dbFilename = selected.split(/[/\\]/).pop() || 'diary.db'`.
  6. Call `checkJournalPath(selected)` with the file path (now checks file existence).
  7. Set `newDir(parentDir)` (the journal path stored in config is the parent directory).
  8. Store `dbFilename` in a new signal `dbFilename` or in the component state.
  9. Auto-name from the filename stem instead of folder name: `selected.split(/[/\\]/).pop()?.replace(/\.db$/, '') || 'My Journal'`.
  10. In `handleConfirmOpen` (~line 145), pass `dbFilename` to `addJournal(name, parentDir, dbFilename)`.
  11. Update the button label in the "Open Existing" form from `browseFolderDotDotDot` to use `browseDotDotDot` (common key already exists).
- Validation: `cmd.exe /c bun run type-check` passes; manual inspection of the component logic.
- Notes: The `newDir` signal keeps its name but now holds the **parent directory** path. The browse button in the create form still uses `handleBrowseCreate` (unchanged folder picker). The `handleBrowseCreate` function still uses `open({ directory: true, ... })`.

#### Task 4.3: Update `JournalPicker.test.tsx`

- Status: COMPLETED
- Objective: Tests reflect the new file dialog behavior and updated API signatures.
- Steps:
  1. Update the "shows error when Open Existing is clicked" test (~line 93):
     - Change the dialog mock to return a file path: `vi.mocked(dialogMock.open).mockResolvedValueOnce('/some/folder/myjournal.db')`.
     - Update the `checkJournalPath` assertion to expect the file path: `expect(mocks.checkJournalPath).toHaveBeenCalledWith('/some/folder/myjournal.db')`.
  2. Verify other tests still pass (no changes to create flow tests).
- Validation: `cmd.exe /c bun run test:run -- JournalPicker` passes.
- Notes: `checkJournalPath` mock still returns `false` for the error test (unchanged behavior — file doesn't exist → error). Only the argument changes.

#### Task 4.4: Update i18n locale files

- Status: COMPLETED
- Objective: All three referenced i18n keys have updated text in all 5 locales: `selectFolderTitle` → file-oriented, `noJournalFound` → file-oriented, `chooseFolderTitle` → generic (works for both folder and file contexts).
- Steps:
  1. In `src/i18n/locales/en.ts`:
     - `selectFolderTitle`: `'Select Journal Folder'` → `'Select Journal File'`
     - `noJournalFound`: `'No journal found in the selected folder. Make sure the folder contains a diary.db file.'` → `'The selected file is not a valid diary database.'`
     - `chooseFolderTitle`: `'Choose Journal Folder'` → `'Choose Location'` (generic, still used by folder picker in create flow)
  2. Update the 4 community locale JSON files (`es.json`, `fr.json`, `de.json`, `it.json`) with equivalent translations.
  3. Run `cmd.exe /c bun run validate:locales` to confirm all keys are present.
- Validation: `cmd.exe /c bun run validate:locales` passes. `cmd.exe /c bun run type-check` passes (en.ts TypeScript source).
- Notes: Community locale translations can be approximate (marked as needing translator review).

---

### Milestone 5: Final Verification & Cleanup

- Status: COMPLETED
- Purpose: Verify the complete change across all layers and clean up.
- Exit Criteria: All test suites pass, lint/format/type-check pass, E2E audit complete, TODO-0024 checked in TODO.md.

#### Task 5.1: Run full backend test suite

- Status: COMPLETED
- Objective: All Rust tests pass after all backend changes.
- Steps:
  1. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
  2. Fix any test failures.
- Validation: Zero test failures.
- Notes: Pay special attention to `auth_journals`, `auth_directory`, `auth_core`, `config`, and `backup` test modules.

#### Task 5.2: Run full frontend validation suite

- Status: COMPLETED
- Objective: All TypeScript/JS checks pass.
- Steps:
  1. Run `cmd.exe /c bun run type-check`
  2. Run `cmd.exe /c bun run lint`
  3. Run `cmd.exe /c bun run test:run`
  4. Run `cmd.exe /c bun run format`
  5. Run `cmd.exe /c bun run validate:locales`
- Validation: All commands exit zero.
- Notes: Fix any lint/format/type errors before proceeding.

#### Task 5.3: Audit E2E specs

- Status: COMPLETED
- Objective: Confirm no E2E tests are broken by the changes.
- Steps:
  1. Read `e2e/specs/diary-workflow.spec.ts` and `e2e/specs/multi-entry.spec.ts`.
  2. Verify neither spec exercises `handleBrowseOpen`, file dialogs, or depends on the old folder-picking behavior.
  3. Check that `config.json` journal paths (directories) are still compatible with E2E test setup.
  4. Document findings in task notes.
- Validation: E2E specs do not reference affected flows. No E2E test changes needed.
- Notes: Current E2E specs use pre-configured journals from `config.json` and bypass `JournalPicker`. Minimal risk, but verify.

#### Task 5.4: Cleanup and TODO check-off

- Status: COMPLETED
- Objective: Remove intermediate artifacts and mark TODO-0024 as completed.
- Steps:
  1. Verify no temporary files, debug logs, or scratch scripts were left in the worktree.
  2. In `docs/todo/TODO.md`, mark `TODO-0024` checkbox as `[x]`.
  3. Optionally append a changelog entry.
  4. Update the plan status to `COMPLETED`.
- Validation: `git status` shows only intended changes. TODO.md reflects completion.
- Notes: Use the `todo-manager` skill for the TODO check-off if the item format requires it.

---

## Approval Gate

Approved. Implementation completed 2026-05-10.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [x] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` passes with zero failures
- [x] `cmd.exe /c bun run type-check` passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run test:run` passes
- [x] `cmd.exe /c bun run format` passes
- [x] `cmd.exe /c bun run validate:locales` passes
- [x] All new i18n keys present in every locale file
- [x] E2E specs audited for compatibility
- [x] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (under `docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions.
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
