# Refactoring Recommendations Implementation Plan

## Metadata

- Plan Status: IN PROGRESS
- Created: 2026-05-21
- Last Updated: 2026-05-21
- Owner: Coding agent
- Approval: APPROVED 2026-05-21
- Source Report: `docs/refactoring-report-2026-05-21.md`

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Implement every recommendation from `docs/refactoring-report-2026-05-21.md` in a staged sequence that keeps security behavior stable, adds missing test coverage before behavior-changing refactors, and leaves the codebase easier to navigate and audit.

## Scope

- Apply P1 through P20 from the source report, including the out-of-order P18.
- Preserve the existing privacy and encryption guarantees: no plaintext diary content on disk, no network behavior, and no weakening of auth policies.
- Split large Rust and SolidJS files only along the boundaries recommended by the report.
- Add or update focused tests before broad refactors where the report identifies coverage gaps.
- Update stale documentation and remove false or misleading test coverage.
- Keep release-boundary cleanup for legacy `require_all_auth` machinery as an explicit deferred task until the maintainer chooses the release boundary.

## Non-Goals

- Do not implement encrypted search or revive plaintext FTS.
- Do not introduce an ORM, a new command framework, custom crypto, telemetry, update checks, or broader plugin types.
- Do not convert backend errors away from the current `Result<T, String>` IPC contract.
- Do not split the Rust backend into multiple crates.
- Do not remove `JournalConfig.require_all_auth` or `migrate_require_all_auth_to_db` before the release-boundary task is explicitly approved.

## Assumptions

- The sequencing in Part III of the report is authoritative unless implementation findings prove a dependency is different.
- `unlock_diary_auto` remains excluded from `require_all_auth` by the maintainer's 2026-05-21 Position A decision.
- `JournalConfig.require_all_auth` cleanup follows the maintainer's 2026-05-21 Option B decision: no sentinel row, derived-state check only, single future cleanup PR.
- Project commands should be run through the Windows toolchain from this shell, for example `cmd.exe /c bun run test:run` and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.
- Each task should be validated immediately after completion before starting the next task.
- Implementation should use a red-green TDD approach whenever practical: write or update the focused failing test first, run it to confirm the expected failure, implement the smallest change that makes it pass, then refactor and rerun the relevant validation. Pure documentation tasks and mechanical move-only refactors may use compile/test-after validation instead, but should still preserve or move existing tests before changing behavior.

## Open Questions

- None.

## Milestones

### Milestone 1: Safe Documentation And Cleanup

- Status: COMPLETED
- Purpose: Land unambiguous cleanup first so later refactors start from accurate docs and fewer misleading artifacts.
- Exit Criteria: Stale docs are corrected, dead frontend state and empty backend directories are removed, misleading guard tests are gone or replaced with honest pending coverage, and the full local validation suite relevant to these changes passes.

#### Task 1.1: Update Stale Documentation (P8)

- Status: COMPLETED
- Objective: Remove or correct stale version, schema, test-count, and command-count claims in repository docs.
- Steps:
  1. Update `PHILOSOPHY.md` to remove exact test totals and point readers to current test commands.
  2. Update the schema-version statement in `PHILOSOPHY.md` to v7 and mention the tags migration where appropriate.
  3. Update `SECURITY.md` supported-version wording to the current maintainer policy without over-promising stale version ranges.
  4. Update `AGENTS.md` to remove the exact Tauri command count and refer readers to `src-tauri/src/lib.rs` `generate_handler![]`.
  5. TDD exception: this is documentation-only; use the validation grep as the objective check instead of a red test.
- Validation: Inspect the edited docs for removed stale counts; run `rg -n "v0\\.4\\.19|Current version: v6|54 registered|276 tests|229 tests" PHILOSOPHY.md SECURITY.md AGENTS.md` and confirm no stale targeted claims remain.
- Notes: Do not edit external agent memory; it is outside the repository.

#### Task 1.2: Remove Safe Dead Code And Empty Directories (P6 Items 1-2)

- Status: COMPLETED
- Objective: Remove `_isLoadingEntry` plumbing and ghost backend directories without changing runtime behavior.
- Steps:
  1. Remove `_isLoadingEntry` from `src/components/editor/EditorPanel.tsx`.
  2. Remove the corresponding setter parameter from `useEntryLifecycle` and its call sites.
  3. Delete empty directories `src-tauri/src/backup/` and `src-tauri/src/i18n/` if still empty.
  4. TDD exception: this is dead-code removal; run the type-check before and after if the starting tree is clean enough, and use the final type-check plus `rg` inspection as the safety check.
- Validation: `cmd.exe /c bun run type-check`; inspect `rg -n "isLoadingEntry|setIsLoadingEntry" src` for no stale references.
- Notes: Do not touch `JournalConfig.require_all_auth` in this task.

#### Task 1.3: Remove Or Replace Misleading Guard Tests (P7)

- Status: COMPLETED
- Objective: Eliminate tests that only test inline reimplementations of production guards.
- Steps:
  1. Red: if a direct production-path replacement is feasible without P14, write that replacement test first and run the focused backend test to confirm it fails against the current misleading coverage gap.
  2. Green: implement the smallest test-harness or production-path adjustment needed for the replacement test to pass.
  3. Delete `test_change_diary_directory_blocked_when_unlocked` if it still only checks a local boolean.
  4. Delete `test_remove_auth_method_last_slot_guard` if it still only checks an inline guard.
  5. If replacement tests must wait for the P14 harness, add explicit follow-up notes near the relevant real command test area and rely on Milestone 6 for the red-green replacement.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.
- Notes: Prefer no test over false confidence. Integration replacements are covered in Milestone 6.

### Milestone 2: Contained Backend Refactors

- Status: COMPLETED
- Purpose: Deduplicate local logic in single-file areas before larger module splits.
- Exit Criteria: Markdown export behavior is unchanged, entry row decoding is centralized, corrupt encrypted entry data surfaces as an error, and backend tests pass.

#### Task 2.1: Deduplicate Markdown Export Walkers (P2)

- Status: COMPLETED
- Objective: Replace duplicated markdown date grouping and entry-header rendering with one shared implementation.
- Steps:
  1. Red/safety: before refactoring, identify one existing markdown test per export entry point and run the focused markdown test command as a baseline; if any duplicated behavior is not covered, add a characterization test first.
  2. Add a private shared markdown export walker in `src-tauri/src/export/markdown.rs`.
  3. Route `export_entries_to_markdown`, `export_entries_to_markdown_with_assets`, and `export_entries_to_markdown_inline` through that walker.
  4. Keep image processing differences isolated to closures or small helper functions.
  5. Green/refactor: preserve existing date ordering, entry numbering, heading fallback, asset extraction, and inline image behavior, then rerun the same focused markdown tests.
- Validation: Run the markdown export tests with `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test markdown"`, then run full `cargo test` if the filtered command passes.
- Notes: No security behavior should change.

#### Task 2.2: Centralize Diary Entry Row Decoding (P5)

- Status: COMPLETED
- Objective: Use one row mapper for encrypted `DiaryEntry` rows and stop silently swallowing decrypt failures.
- Steps:
  1. Red: add a regression test that corrupts `title_encrypted` and asserts `get_all_entries` returns an error instead of an empty title; run the focused test and confirm it fails against the current silent fallback.
  2. Add a shared `ENTRY_SELECT` projection in the entry query module.
  3. Add a `row_to_entry` helper that reads encrypted title/text blobs, decrypts them, validates UTF-8, and maps failures into a concrete query error.
  4. Green: update `get_entries_by_date`, `get_entry_by_id`, `get_all_entries`, and `get_entries_in_range` to use the helper until the new regression test passes.
  5. Refactor: remove duplicated row decoding and rerun the broader query tests.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test queries"`; then full `cargo test`.
- Notes: The report's rusqlite snippet is pseudocode. Confirm exact error type bounds at compile time.

#### Task 2.3: Centralize Encrypted Row Storage Helpers (P18)

- Status: COMPLETED
- Objective: Make entry and tag encryption/decryption storage format explicit through helper functions.
- Steps:
  1. Red/safety: add or identify focused entry and tag storage tests that cover insert/update/create/rename encryption paths; run them before changing helpers.
  2. Add `encrypt_for_storage` and `decrypt_utf8` helpers near the entry query row mapper.
  3. Green: use `encrypt_for_storage` in entry insert/update paths and rerun the focused storage tests.
  4. Use the same storage helper pattern for tag create/rename paths where tag ciphertext is written.
  5. Refactor: reuse `decrypt_utf8` from the P5 row mapper and remove duplicated encryption error mapping.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test queries"`; verify `rg -n "cipher::encrypt\\(db\\.key\\(\\)" src-tauri/src/db` shows only intentional low-level exceptions.
- Notes: This task can be implemented directly after P5 or folded into the same PR if that keeps the diff clearer.

### Milestone 3: Policy Documentation And Error Sanitization

- Status: COMPLETED
- Purpose: Close the documented security-policy gap and finish the frontend raw-error sanitization contract before larger UI refactors.
- Exit Criteria: Auto-key policy is documented in code and backend guide, confirmed raw-error UI paths use `mapTauriError`, and tests prove leaky strings are not displayed.

#### Task 3.1: Document Auto-Key Multi-Auth Policy (P20)

- Status: COMPLETED
- Objective: Record why `unlock_diary_auto` intentionally bypasses legacy migration and `require_all_auth` verification.
- Steps:
  1. Add the report's policy comment above `unlock_diary_auto` in `src-tauri/src/commands/auth/auth_core.rs`.
  2. Add the matching paragraph to the auth/security section of `src-tauri/CLAUDE.md`.
  3. Confirm the comment references `docs/refactoring-report-2026-05-21.md` P20 and the 2026-05-21 decision.
  4. TDD exception: this is policy documentation only; use text inspection as validation and do not change unlock behavior.
- Validation: Inspect `rg -n "Auto-key|local-only|unlock_diary_auto|require_all_auth" src-tauri/src/commands/auth/auth_core.rs src-tauri/CLAUDE.md`.
- Notes: This is policy documentation only; do not change unlock behavior here.

#### Task 3.2: Sanitize Remaining Raw UI Errors (P19)

- Status: COMPLETED
- Objective: Ensure user-facing UI error state flows through `mapTauriError(err, t)`.
- Steps:
  1. Red: add component tests for each converted site with a deliberately leaky raw error string and assert the UI does not show that raw string.
  2. Run the focused frontend tests and confirm the new tests fail against the current raw-error paths.
  3. Green: update `ImportOverlay.tsx`, `StatsOverlay.tsx`, `PasswordCreation.tsx`, and `SearchBar.tsx` raw error handling to use `mapTauriError(err, t)`.
  4. Add or update fallback i18n keys only if existing keys are insufficient.
  5. Add a lightweight grep-based script or CI check that flags `setError(String(err))`, `setError(err.message)`, and similar patterns outside `mapTauriError`.
  6. Refactor: document the rule in `src/lib/errors.ts` and rerun the full frontend validation.
- Validation: `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`; run the new grep/script check.
- Notes: Do not hide errors needed for logs unless those logs are local and intentionally not user-facing.

### Milestone 4: Query Module Split

- Status: COMPLETED
- Purpose: Split the largest query module after row handling is centralized so the move stays mostly mechanical.
- Exit Criteria: `db/queries.rs` is replaced by a `queries/` module tree, public imports still compile, moved tests pass, and no behavior changes are introduced beyond completed P5/P18 work.

#### Task 4.1: Split `db/queries.rs` By Domain (P3)

- Status: COMPLETED
- Objective: Move query code into domain-specific files with stable public re-exports.
- Steps:
  1. Mechanical safety: run the current backend query tests before the split, or record the existing failure if the tree is already red.
  2. Create `src-tauri/src/db/queries/mod.rs`.
  3. Move tests next to their functions or into domain-specific test modules before editing function bodies.
  4. Move entry CRUD/range/count code into `queries/entries.rs`.
  5. Move tag queries and tag structs into `queries/tags.rs`.
  6. Move auth-slot queries into `queries/auth_slots.rs`.
  7. Move db-settings and MAC verification code into `queries/db_settings.rs`.
  8. Re-export the existing public functions and types so callers do not need broad changes.
  9. Green/refactor: repair imports until the same query/backend tests pass with no behavior changes.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`; inspect `rg -n "mod queries|pub mod queries" src-tauri/src/db`.
- Notes: Keep this as a file move plus import repair. Avoid opportunistic logic changes.

### Milestone 5: Schema And Migration Module Split

- Status: COMPLETED
- Purpose: Make schema creation, open paths, legacy helpers, and migrations independently navigable.
- Exit Criteria: `db/schema.rs` is replaced by a schema module tree, all open paths call one `migrations::apply_pending`, migration tests pass, and schema version behavior is unchanged.

#### Task 5.1: Split `db/schema.rs` And Add `apply_pending` (P4)

- Status: COMPLETED
- Objective: Separate database creation/opening from migration implementations and centralize migration ordering.
- Steps:
  1. Mechanical safety: run the current schema and migration tests before the split, or record the existing failure if the tree is already red.
  2. Create `src-tauri/src/db/schema/mod.rs` and move `DatabaseConnection` plus `SCHEMA_VERSION` there or to the most appropriate existing module boundary.
  3. Move migration tests with their migration files and keep a cross-version integration test in an obvious module.
  4. Move create paths and schema DDL to `schema/create.rs`.
  5. Move password/keypair/auto open paths to `schema/open.rs`.
  6. Move legacy metadata/hash helpers to `schema/legacy.rs`.
  7. Move each migration into `schema/migrations/v*_to_v*.rs`.
  8. Red/green for ordering: add or identify a focused test that proves pending migrations are applied in order through one open path before replacing duplicated call chains.
  9. Add `schema/migrations/mod.rs` with `apply_pending(&db)` that owns migration ordering.
  10. Update every open path to call `apply_pending` once.
  11. Refactor: repair imports and rerun the same schema/migration tests plus full backend tests.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`; inspect `rg -n "migrate_v[0-9]_to_v[0-9]" src-tauri/src/db/schema src-tauri/src/db` to confirm migration calls are centralized.
- Notes: Preserve the report's two-tier migration safety policy: re-encryption migrations create backups, DDL-only migrations rely on SQLite transaction rollback.

### Milestone 6: Command-Level Test Infrastructure

- Status: COMPLETED
- Purpose: Establish the command testing safety net required before behavior-changing command refactors.
- Exit Criteria: The Tauri v2 test harness spike is documented, either an in-process harness exists or the fallback pure-function strategy is implemented, and representative security-critical command tests pass.

#### Task 6.1: Spike Tauri Command Integration Harness (P14)

- Status: COMPLETED
- Objective: Determine whether this app can invoke Tauri commands in-process in tests.
- Spike outcome (2026-05-21):
  - Added `tauri = { version = "2.11.2", features = ["test"] }` to dev-dependencies and wrote a
    minimal `mock_builder()` + `get_ipc_response` spike targeting `is_diary_unlocked`.
  - **The spike code compiled cleanly** (the Tauri 2.x test API — `mock_builder`, `mock_context`,
    `noop_assets`, `get_ipc_response`, `InvokeResponseBody::deserialize`, `INVOKE_KEY` — is
    syntactically correct and findable in 2.11.2).
  - **The spike failed at runtime on Windows**: `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) crashed
    the test binary the moment it started, before any test ran. Adding `features = ["test"]` to the
    dev-dependency merges with the existing `features = ["devtools"]` main dependency, and the
    combined feature set produces a test binary that fails to locate a required DLL entry point on
    Windows.  Every existing test also failed, not just the spike.
  - **`AppHandle<Wry>` boundary confirmed**: commands typed `AppHandle<Wry>` (concrete, not generic
    `R: Runtime`) cannot be invoked through `MockRuntime` without changing their signatures.
  - **Fallback confirmed**: pure-function extraction is the only viable approach. The pattern is
    already established in this codebase via `lock_diary_inner` (pure `&DiaryState` → `Result`) and
    `make_state` test helpers. Task 6.2 will use this pattern exclusively.
- Notes: Do not add `tauri = { features = ["test"] }` to dev-dependencies — it crashes all tests on
  Windows. The fallback pure-function pattern covers all command coverage needs for Milestones 6–7.

#### Task 6.2: Add Representative Command Tests For Later Refactors (P1/P7/P14)

- Status: COMPLETED
- Objective: Cover the command paths needed before broad `with_unlocked_db` and unlock refactors.
- Steps:
  1. Red: add locked-vs-unlocked smoke tests for representative commands such as `save_entry`, `get_statistics`, and `list_auth_methods`; run them and confirm failures expose missing command-level coverage or harness gaps.
  2. Green: add only the harness or setup needed for those representative command tests to pass without changing command behavior.
  3. Red: add a real production-path test for `change_diary_directory` auto-lock behavior.
  4. Green: adjust only production code or test setup needed for the real command behavior to pass.
  5. Red: add a real production-path test for `remove_auth_method` last-slot guard.
  6. Green: adjust only production code or test setup needed for the real guard behavior to pass.
  7. Red/green: add and satisfy a multi-auth test that `unlock_diary_all_methods` rejects too few credentials.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` — 334 tests, 0 failures.
- Notes:
  - Pure-function extraction pattern used throughout (fallback from Task 6.1 spike).
  - Extracted: `save_entry_inner` (entries.rs), `get_statistics_inner` (stats.rs),
    `list_auth_methods_inner` + `remove_auth_method_inner` (auth_methods.rs),
    `check_require_all_auth_credential_count` (auth_core.rs),
    `change_diary_directory_with_auto_lock_inner` (auth_directory.rs).
  - Locked-state tests added for all five extracted functions.
  - `test_remove_auth_method_last_slot_guard` now calls `remove_auth_method_inner` directly.
  - `test_check_require_all_auth_rejects_single_credential` now calls
    `check_require_all_auth_credential_count` directly (replaces the old simulated guard test).
  - `test_change_diary_directory_auto_locks_and_moves_file` now calls
    `change_diary_directory_with_auto_lock_inner` directly and verifies DB is locked + file moved.
  - TODOs from Task 1.3 removed across all three files.

### Milestone 7: Behavior-Changing Command Refactors

- Status: IN PROGRESS
- Purpose: Reduce command duplication only after representative command coverage exists.
- Exit Criteria: Unlocked-DB boilerplate is centralized, shared unlock scaffolding covers password/keypair/all-method unlock paths, `unlock_diary_auto` remains separate by policy, and command tests pass.

#### Task 7.1: Introduce `with_unlocked_db` Helper And Convert Call Sites (P1)

- Status: COMPLETED
- Objective: Replace repeated unlocked-DB command preambles with one auditable helper.
- Steps:
  1. Red: add two focused tests for the helper before implementing it: unlocked path returns the inner result, locked path returns `Journal must be unlocked`.
  2. Green: add `with_unlocked_db` in the most appropriate commands/auth module location using the canonical errors `Journal state lock failed` and `Journal must be unlocked`.
  3. Rerun the helper tests and representative command tests from Milestone 6.
  4. Refactor: convert only commands that need `&DatabaseConnection`; leave `db_path`, `backups_dir`, and plugin-registry locks alone.
  5. Update tests or `mapTauriError` mappings that intentionally match the old error strings.
  6. Keep each converted command's inner behavior unchanged and rerun backend tests after each command group.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`; `cmd.exe /c bun run test:run` if frontend mappings changed.
- Notes: This task is blocked until Milestone 6 has representative tests.

#### Task 7.2: Unify Non-Auto Unlock Paths (P9)

- Status: TO BE DONE
- Objective: Share unlock scaffolding for password, keypair, and all-method unlocks while preserving auto-key divergence.
- Steps:
  1. Red: add or update regression tests proving auto-key behavior remains unchanged and all-method unlock still enforces the multi-auth policy.
  2. Run the focused auth tests and confirm any new behavior expectations fail before the refactor, or record if they already pass as characterization coverage.
  3. Green: introduce a typed `UnlockMode` enum for password, keypair, and all-method credentials.
  4. Extract shared path/state read, DB existence check, open, legacy migration, `require_all_auth` guard, state install, backup rotation, logging, and menu update into `perform_unlock`.
  5. Route `unlock_diary`, `unlock_diary_with_keypair`, and `unlock_diary_all_methods` through the helper.
  6. Keep `unlock_diary_auto` as a separate function with the P20 policy comment.
  7. Refactor: rerun focused auth tests after each unlock path moves, then run full backend tests.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test auth"`; then full `cargo test`.
- Notes: Do not use a boolean flag for unlock mode.

### Milestone 8: Structural UI And Backend Splits

- Status: TO BE DONE
- Purpose: Move large components and command modules into smaller files after behavior-sensitive refactors are covered.
- Exit Criteria: TipTap extensions, security preferences subsections, auth command responsibilities, and platform WebView handlers are split into focused files with unchanged runtime behavior and passing tests.

#### Task 8.1: Move TipTap Extensions Out Of `DiaryEditor.tsx` (P10)

- Status: TO BE DONE
- Objective: Reduce `DiaryEditor.tsx` by moving standalone TipTap extensions into dedicated modules.
- Steps:
  1. Red/safety: run the existing editor tests before the split; if extension behavior lacks any focused coverage needed for safe movement, add a characterization test first.
  2. Create focused files for `BidiExtension`, `AlignableImage`, and `TimestampMark`.
  3. Move extension definitions without changing their public behavior.
  4. Keep file/path/data URL image handling and editor synchronization in `DiaryEditor.tsx`.
  5. Green/refactor: update imports and rerun the same editor tests.
- Validation: `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`.
- Notes: If editor behavior is visually affected, run relevant E2E/editor checks.

#### Task 8.2: Split `PreferencesSecurityTab.tsx` Into Security Subsections (P11)

- Status: TO BE DONE
- Objective: Split the largest security UI into pragmatic per-feature components.
- Steps:
  1. Red/safety: before extraction, add the smallest characterization tests needed for behavior that will be moved if existing tests do not already cover it.
  2. Extract `AuthMethodsList`.
  3. Green: rerun the focused preferences/security tests and fix only extraction issues.
  4. Extract `AddPasswordForm`.
  5. Green: rerun focused tests again.
  6. Extract `AddKeypairForm`.
  7. Green: rerun focused tests again.
  8. Extract `ChangePasswordForm`.
  9. Green/refactor: rerun focused tests again, then full frontend tests.
  10. Keep lower-risk `RequireAllAuthToggle` and `AutoLockSettings` in place initially or extract only if the local code shape makes it cheaper.
  11. Keep all state ownership and Tauri call ordering equivalent unless tests explicitly cover a safe improvement.
- Validation: `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`.
- Notes: This task enables P15 tests.

#### Task 8.3: Split Auth Method Commands By Responsibility (P12)

- Status: TO BE DONE
- Objective: Move `commands/auth/auth_methods.rs` into focused auth command modules without changing command names.
- Steps:
  1. Mechanical safety: run focused auth command tests before the split, or record the existing failure if the tree is already red.
  2. Move tests with the functions they cover before changing imports.
  3. Create `auth_identity.rs` for verify/list/peek commands and peek structs.
  4. Create `auth_slots.rs` for keypair/password registration, key-file writing, and removal commands.
  5. Create `auth_policy.rs` for `set_require_all_auth`.
  6. Keep command registration in `lib.rs` stable.
  7. Green/refactor: repair imports until the same auth tests pass with no command-name changes.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test auth"`; then full `cargo test`.
- Notes: Keep the frontend IPC API unchanged.

#### Task 8.4: Move Platform WebView Handlers Out Of `lib.rs` (P13)

- Status: TO BE DONE
- Objective: Move Windows and macOS WebView security handlers into a dedicated module.
- Steps:
  1. Mechanical safety: run build/backend tests before the move, or record the existing failure if the tree is already red.
  2. Create `src-tauri/src/webview_security/mod.rs`.
  3. Move Windows COM handler code into `webview_security/windows.rs`.
  4. Move macOS content-rule handler code into `webview_security/macos.rs`.
  5. Expose `install_platform_handlers(&win)` from the module and call it from `lib.rs`.
  6. Preserve all existing `unsafe` blocks and SAFETY comments.
  7. Green/refactor: repair imports/cfg gates until build and backend tests pass.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`; `cmd.exe /c bun run build`; run network-isolation E2E if available in the current environment.
- Notes: This is a move-only task; do not change CSP or navigation policy here.

### Milestone 9: Long-Tail Test Coverage And Release-Boundary Cleanup

- Status: TO BE DONE
- Purpose: Add the remaining focused tests and execute the deferred legacy cleanup only when the release boundary is approved.
- Exit Criteria: Security-tab subsection tests exist, editor integration coverage is extended, and legacy `require_all_auth` cleanup is either completed at an approved boundary or explicitly remains deferred.

#### Task 9.1: Add Security Preferences Subsection Tests (P15)

- Status: TO BE DONE
- Objective: Cover the highest-risk security preference flows after the P11 split.
- Steps:
  1. Red: add `AddKeypairForm.test.tsx` covering verify password, generate keypair, save dialog, register keypair, and write key file ordering; run it and confirm any missing ordering guard fails.
  2. Green: adjust `AddKeypairForm` only enough for the test to pass.
  3. Red/green: add and satisfy `ChangePasswordForm.test.tsx` covering empty fields, mismatch, success, and field clearing.
  4. Red/green: add and satisfy `AuthMethodsList.test.tsx` covering last-method removal guard and password requirement.
  5. Red/green: add and satisfy `RequireAllAuthToggle.test.tsx` covering disabled state with fewer than two non-auto methods and error consistency.
  6. Refactor: clean up shared test helpers only after all four focused tests pass.
- Validation: `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`.
- Notes: Skip lower-risk `AddPasswordForm` and `AutoLockSettings` unless they become naturally covered.

#### Task 9.2: Extend EditorPanel Integration Tests (P17)

- Status: TO BE DONE
- Objective: Add focused editor-shell integration coverage without chasing complete component coverage.
- Steps:
  1. Red: extend `EditorPanel.integration.test.tsx` for word-count display updates on content change and run the focused test.
  2. Green: implement or adjust only the code needed for that test to pass.
  3. Red/green: add and satisfy a save-status footer visibility test tied to `isSaving()`.
  4. Red/green: add and satisfy an import-markdown error banner test for failed reads.
  5. Refactor: remove duplicate test setup after the new cases pass.
- Validation: `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`.
- Notes: Defer `Sidebar`, `Header`, and `MainLayout` component sweeps unless a future task targets them.

#### Task 9.3: Keep Derived-State Legacy Migration Policy, No Sentinel (P16)

- Status: TO BE DONE
- Objective: Preserve the Option B migration policy and avoid adding a sentinel row.
- Steps:
  1. Confirm no `_migrated_require_all_auth` or equivalent sentinel is introduced.
  2. Keep `migrate_require_all_auth_to_db` idempotent until the release-boundary deletion task is approved.
  3. Record in the relevant docs or execution notes that P16 is satisfied by preserving derived-state behavior until cleanup.
  4. TDD exception: this is a policy guardrail and inspection task; use grep inspection instead of a red test.
- Validation: Inspect `rg -n "_migrated_require_all_auth|sentinel|migrate_require_all_auth_to_db" src-tauri docs`.
- Notes: This task is mostly a guardrail for future implementation.

#### Task 9.4: Release-Boundary Removal Of Legacy `require_all_auth` Config (P6 Item 3, P16)

- Status: TO BE DONE
- Objective: Remove legacy config-field migration machinery in one coordinated PR after maintainer approval of the release boundary.
- Steps:
  1. Get maintainer approval for the exact release boundary and CHANGELOG wording.
  2. Red: before deletion, add a regression test proving a legacy `config.json` with `require_all_auth: true` migrates to the DB setting on first unlock.
  3. Green: confirm the regression test passes against the still-present legacy migration before deleting it.
  4. Remove `JournalConfig.require_all_auth` and `JournalInfo.require_all_auth`.
  5. Remove `set_journal_require_all_auth` and its legacy cleanup call sites.
  6. Remove `migrate_require_all_auth_to_db` and its call sites.
  7. Remove frontend type field references, including `src/lib/tauri.ts` and `JournalPicker.test.tsx`.
  8. Refactor: remove the temporary legacy regression test only if it is no longer meaningful after deleting the migration code, and keep any replacement test that validates the current DB-backed policy.
  9. Update CHANGELOG or latest changelog with the release-boundary cleanup.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test auth"`; `cmd.exe /c bun run test:run`; `cmd.exe /c bun run type-check`.
- Notes: This task has its own approval gate. Do not execute it until the maintainer chooses the release boundary; keep it deferred during the initial implementation wave.

### Milestone 10: Cleanup, Verification, And Final Self-Check

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts, the complete change set is verified, and the finished implementation is checked against the approved plan.
- Exit Criteria: Intermediate artifacts are removed, formatting is applied, final verification passes or blockers are documented, the final self-check confirms correctness/completeness/accuracy, and the plan status can be set to COMPLETED after approved implementation.

#### Task 10.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
  4. Confirm no empty directories or stale generated outputs remain from the refactors.
  5. TDD exception: this is cleanup; validate by diff inspection and final test runs.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task 10.2: Format And Final Verification

- Status: TO BE DONE
- Objective: Validate the integrated refactoring set after cleanup.
- Steps:
  1. Run formatter after code changes.
  2. Run frontend type-check, lint, tests, and build.
  3. Run backend tests.
  4. Run E2E tests when UI flows or WebView security behavior changed and the environment supports it.
  5. Fix failures and rerun until verification passes, or record blockers in this plan.
  6. Confirm task notes show red-green evidence for implementation tasks, or an explicit mechanical/docs exception.
- Validation:
  - `cmd.exe /c bun run format`
  - `cmd.exe /c bun run type-check`
  - `cmd.exe /c bun run lint`
  - `cmd.exe /c bun run test:run`
  - `cmd.exe /c bun run build`
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
  - `cmd.exe /c bun run test:e2e` when relevant and available
- Notes: If legacy release-boundary cleanup remains blocked, the plan should remain partially open or record Task 9.4 as intentionally deferred.

#### Task 10.3: Final Plan Self-Check

- Status: TO BE DONE
- Objective: Confirm the finished implementation is correct, complete, and accurate against this plan and the source report.
- Steps:
  1. Confirm every non-deferred task is marked `COMPLETED` and every intentionally deferred task includes the reason, approval gate, and next action.
  2. Compare the source report's P-items against this roadmap and verify each recommendation is implemented, explicitly deferred, or intentionally skipped with a recorded reason.
  3. Confirm task notes show red-green evidence for implementation tasks, or an explicit mechanical/docs exception.
  4. Review the final diff for accidental scope creep, unrelated refactors, plaintext diary exposure, network behavior, or auth-policy changes not approved by the plan.
  5. Confirm all task-level validation commands and final verification commands have passing results recorded, or that any failure is documented as a blocker.
  6. Re-read the changed documentation and public comments for accuracy against the final code.
  7. Update this plan's metadata, pre-flight checklist, and execution notes so they reflect the final state.
- Validation: The self-check section below is fully updated, all applicable checklist items are checked, and any remaining deferred work is explicitly documented.
- Notes: Do this after all required implementation changes and verification commands, immediately before marking the plan `COMPLETED`.

## Approval Gate

Implementation must not start until the user approves this plan. After approval, update `Plan Status` to `APPROVED`, then `IN PROGRESS` before changing code.

## Pre-flight Checks

Run these commands before marking the implementation COMPLETED. Fix all failures before proceeding, or record the blocker and affected milestone.

- [ ] `cmd.exe /c bun run format`
- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cmd.exe /c bun run build`
- [ ] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- [ ] `cmd.exe /c bun run test:e2e` for UI/WebView behavior changes when the environment supports it
- [ ] `cmd.exe /c bun run diagrams:check` if any diagram source changes
- [ ] `cmd.exe /c bun run validate:locales` if any i18n keys change
- [ ] Final plan self-check completed after all required implementation changes
- [ ] Plan status updated to COMPLETED or deferred release-boundary task explicitly documented

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Plan status is `READY FOR APPROVAL`.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Zero unanswered questions remain.
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] Final post-implementation self-check is included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Validate after each completed task rather than batching all validation at the end.
- Run `cmd.exe /c bun run format` after code changes, as required by the repository workflow.
- Prefer red-green TDD for implementation tasks:
  1. Red: add or update the focused test for the intended behavior or regression and run the narrowest relevant command to confirm it fails for the expected reason.
  2. Green: make the minimal implementation change and rerun the same test until it passes.
  3. Refactor: clean up the implementation, run formatting, then run the task's full validation command.
- For mechanical file splits, move existing tests with the code before changing imports, then run the narrow compile/test command as the equivalent safety check.
