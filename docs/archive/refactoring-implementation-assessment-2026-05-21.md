# Refactoring Roadmap Implementation Assessment

## Metadata

- Assessment date: 2026-05-21
- Assessed plan: `docs/refactoring-recommendations-implementation-roadmap.md`
- Source report: `docs/refactoring-report-2026-05-21.md`
- Scope inspected: repository state at assessment time, including the current uncommitted worktree
- Validation method: static code inspection and targeted grep checks; no full formatter, test, lint, build, or E2E suite was run for this assessment

## Executive Summary

The implementation is substantially aligned with the roadmap through Milestone 7. The largest backend refactors reported as complete are present in the codebase: markdown export deduplication, entry row decoding centralization, query and schema module splits, pure-function command test seams, `with_unlocked_db`, and the shared non-auto unlock helper all exist.

The roadmap status is not fully accurate, though. It reports Milestone 8 as `TO BE DONE`, but Task 8.1 is already in progress in the worktree: `DiaryEditor.tsx` has been shortened and new TipTap extension modules plus a `BidiExtension` unit test have been added. The plan should be updated before more work continues.

The main implementation gaps found are:

1. Task 3.2 requires a lightweight grep/CI check for raw UI error display patterns, but no script, package command, or CI hook for that check exists.
2. Task 7.1 only partially centralizes unlocked-DB command boilerplate. Several command paths that still take only `&DatabaseConnection` continue to open-code the DB lock and unlocked check.
3. Documentation references became stale after the query/schema module splits. `PHILOSOPHY.md` and at least one decision document still point readers to old single-file paths such as `src-tauri/src/db/schema.rs` and `src-tauri/src/db/queries.rs`.
4. Task 8.1 has code changes but no matching roadmap status update and no recorded validation result.

## Worktree State

`git status --short` reported:

```text
 M src/components/editor/DiaryEditor.tsx
?? src/components/editor/extensions/
```

This means the assessment includes uncommitted Task 8.1 work. No other uncommitted code or documentation changes were visible.

## Roadmap Status Accuracy

### Reported Complete Milestones

The plan marks Milestones 1 through 7 as `COMPLETED`. Static inspection supports most of those claims:

- Milestone 1 cleanup is visible: `_isLoadingEntry`/`setIsLoadingEntry` no longer appear under `src/`, and `src-tauri/src/backup/` plus `src-tauri/src/i18n/` do not exist.
- Milestone 2 backend refactors are visible: markdown export has a shared date grouping path, entry row decoding uses `ENTRY_SELECT` and `row_to_entry`, and encrypted storage helpers exist.
- Milestone 3 policy/error work is mostly visible: auto-key policy comments exist, frontend raw-error display paths have been converted to `mapTauriError`, and focused sanitization tests exist for the converted components.
- Milestone 4 and 5 structural splits are visible: `src-tauri/src/db/queries/` and `src-tauri/src/db/schema/` module trees exist.
- Milestone 6 command-level test seams are visible: pure inner functions and representative tests were added in command modules.
- Milestone 7 shared command refactors are visible: `with_unlocked_db`, `UnlockMode`, and `perform_unlock` exist.

### Status Mismatch

The plan marks Milestone 8 and Task 8.1 as `TO BE DONE`, but current files show Task 8.1 is already in progress:

- `src/components/editor/DiaryEditor.tsx` imports `AlignableImage`, `BidiExtension`, and `TimestampMark` from `src/components/editor/extensions/`.
- `src/components/editor/extensions/AlignableImage.ts` exists.
- `src/components/editor/extensions/BidiExtension.ts` exists.
- `src/components/editor/extensions/TimestampMark.ts` exists.
- `src/components/editor/extensions/BidiExtension.test.ts` exists.

The roadmap should mark Task 8.1 and Milestone 8 as `IN PROGRESS` and record the validation performed for the extraction.

## Detailed Findings

### Finding 1: Task 3.2 Is Missing The Required Grep/CI Guard

Severity: Medium

Task 3.2 step 5 requires:

> Add a lightweight grep-based script or CI check that flags `setError(String(err))`, `setError(err.message)`, and similar patterns outside `mapTauriError`.

The implementation converted the known raw UI error paths and added documentation in `src/lib/errors.ts`, but there is no visible enforcement hook:

- `package.json` contains no script for this check.
- `scripts/` contains no raw-error validation script.
- `.github/` search did not reveal a CI check for raw UI error patterns.

Current raw-display grep results are clean for the targeted patterns, which is good, but the roadmap explicitly asked for an ongoing guard. Without it, the same issue can regress silently.

Recommended follow-up:

- Add a small script, for example `scripts/check-ui-error-sanitization.js`, that scans `src/**/*.tsx` and fails on direct display patterns such as `setError(String(err))`, `setError(err.message)`, `set*Error(String(err))`, and `set*Error(err.message)`.
- Wire it into either `bun run lint`, `bun run check`, or the existing pre-commit/CI path.
- Update Task 3.2 notes with the command name and result.

### Finding 2: Task 7.1 `with_unlocked_db` Centralization Is Partial

Severity: Medium

Task 7.1's objective is to replace repeated unlocked-DB command preambles with one auditable helper. The helper exists in `src-tauri/src/commands/auth/mod.rs` and is used in several command modules:

- `src-tauri/src/commands/entries.rs`
- `src-tauri/src/commands/tags.rs`
- `src-tauri/src/commands/stats.rs`
- `src-tauri/src/commands/export.rs`
- part of `src-tauri/src/commands/auth/auth_methods.rs`

However, several command paths still open-code the same `state.db.lock()` plus unlocked check:

- `src-tauri/src/commands/auth/auth_methods.rs`: `verify_password`
- `src-tauri/src/commands/auth/auth_methods.rs`: `register_password`
- `src-tauri/src/commands/auth/auth_methods.rs`: `register_keypair`
- `src-tauri/src/commands/auth/auth_methods.rs`: `remove_auth_method_inner`
- `src-tauri/src/commands/auth/auth_methods.rs`: `set_require_all_auth`
- `src-tauri/src/commands/plugin.rs`: `run_import_plugin`
- `src-tauri/src/commands/plugin.rs`: `run_export_plugin`
- `src-tauri/src/commands/debug.rs`: `generate_debug_dump`

Some of these also touch other state or registry locks, so they may need careful conversion. But they still contain exactly the duplicated unlocked-DB preamble that the task was intended to centralize.

Recommended follow-up:

- Decide whether these remaining sites are intentionally excluded.
- If excluded, update Task 7.1 notes with the reason per command group.
- If not excluded, convert them to `with_unlocked_db` or extract narrowly scoped inner helpers that keep non-DB locks outside the DB closure where needed.

### Finding 3: Documentation Became Stale After The Module Splits

Severity: Medium

Task 1.1 corrected the originally targeted stale claims. The validation grep for the old exact strings now returns no matches:

- `v0.4.19`
- `Current version: v6`
- `54 registered`
- `276 tests`
- `229 tests`

But later refactors changed file locations, and some docs now point readers to paths that no longer exist as files:

- `PHILOSOPHY.md` says the schema is documented inline in `src-tauri/src/db/schema.rs`; the implementation now uses `src-tauri/src/db/schema/mod.rs`, `create.rs`, `open.rs`, `legacy.rs`, and `migrations/`.
- `PHILOSOPHY.md` says direct queries live in `src-tauri/src/db/queries.rs`; the implementation now uses `src-tauri/src/db/queries/mod.rs`, `entries.rs`, `tags.rs`, `auth_slots.rs`, and `db_settings.rs`.
- `docs/decisions/2026-05-settings-storage-taxonomy.md` still references `src-tauri/src/db/schema.rs` and `src-tauri/src/db/queries.rs`.

The roadmap's docs maintenance guidance says behavior/convention changes should update the most specific docs. The code moved, but the docs were not fully reconciled.

Recommended follow-up:

- Update `PHILOSOPHY.md` to refer to the module trees instead of old single-file paths.
- Update `docs/decisions/2026-05-settings-storage-taxonomy.md` references to `src-tauri/src/db/schema/` and `src-tauri/src/db/queries/db_settings.rs`.
- Consider a grep for `src-tauri/src/db/schema.rs` and `src-tauri/src/db/queries.rs` after the update.

### Finding 4: Task 8.1 Is In Progress But Not Reflected In The Plan

Severity: Medium

Task 8.1 requires moving `BidiExtension`, `AlignableImage`, and `TimestampMark` out of `DiaryEditor.tsx`, plus running frontend tests and type-checking. The code movement has started and appears structurally consistent:

- `DiaryEditor.tsx` line count is down to 345 lines.
- `AlignableImage.ts` is 39 lines.
- `BidiExtension.ts` is 92 lines.
- `TimestampMark.ts` is 10 lines.
- `BidiExtension.test.ts` adds direct coverage for `getFirstStrongDir`.

This aligns with the source report's P10 recommendation, including the optional `getFirstStrongDir` coverage. But the roadmap still says Task 8.1 is `TO BE DONE`, and there is no validation note for:

- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run type-check`

Recommended follow-up:

- Mark Task 8.1 as `IN PROGRESS`.
- Run the task validation commands.
- If validation passes, mark Task 8.1 complete and record the result.
- If validation fails, leave it `IN PROGRESS` or `BLOCKED` with the failing command and error summary.

### Finding 5: Task 8.2, 8.3, And 8.4 Are Correctly Not Implemented Yet

Severity: Informational

The roadmap marks Tasks 8.2 through 8.4 as `TO BE DONE`. Static inspection matches that status:

- `src/components/overlays/preferences/PreferencesSecurityTab.tsx` remains one 526-line component; no `AuthMethodsList`, `AddPasswordForm`, `AddKeypairForm`, or `ChangePasswordForm` component files were found.
- `src-tauri/src/commands/auth/auth_methods.rs` remains one 791-line command module; no `auth_identity.rs`, `auth_slots.rs`, or `auth_policy.rs` command split was found.
- `src-tauri/src/lib.rs` still owns platform WebView handlers; no `src-tauri/src/webview_security/` module was found.

These are not implementation failures yet, because the plan says they are still pending.

### Finding 6: Milestone 9 And 10 Are Correctly Still Open

Severity: Informational

The roadmap marks Milestones 9 and 10 as `TO BE DONE`. Static inspection is consistent:

- Security subsection tests from Task 9.1 are not present because the P11 component split has not landed.
- EditorPanel integration extensions from Task 9.2 were not observed as new implementation work.
- `JournalConfig.require_all_auth`, `JournalInfo.require_all_auth`, `set_journal_require_all_auth`, and `migrate_require_all_auth_to_db` still exist, which matches the release-boundary deferral policy.
- No `_migrated_require_all_auth` sentinel was found in source code.
- Pre-flight checklist items in the roadmap remain unchecked, which is appropriate while implementation is incomplete.

## Milestone-by-Milestone Assessment

| Milestone | Roadmap status | Assessment | Notes |
| --- | --- | --- | --- |
| 1. Safe Documentation And Cleanup | COMPLETED | Mostly accurate | Original stale exact strings are gone; however later module splits introduced new stale path references in docs. |
| 2. Contained Backend Refactors | COMPLETED | Accurate by static inspection | Markdown walker, row mapper, corruption test, and storage helpers are present. |
| 3. Policy Documentation And Error Sanitization | COMPLETED | Partially accurate | Code conversions and tests exist, but the required grep/CI guard is missing. |
| 4. Query Module Split | COMPLETED | Accurate by static inspection | `queries/` module tree exists with domain files and re-exports. |
| 5. Schema And Migration Module Split | COMPLETED | Mostly accurate | `schema/` module tree and `apply_pending` exist. Legacy v1/v2 special handling still calls migrations directly before `apply_pending`, which appears intentional for old DB open paths. |
| 6. Command-Level Test Infrastructure | COMPLETED | Accurate by static inspection | Pure inner helpers and replacement command-path tests are present. |
| 7. Behavior-Changing Command Refactors | COMPLETED | Partially accurate | `perform_unlock` exists and non-auto unlock paths use it. `with_unlocked_db` exists but not all eligible command preambles were centralized. |
| 8. Structural UI And Backend Splits | TO BE DONE | Inaccurate | Task 8.1 is already in progress in the worktree. Tasks 8.2-8.4 remain pending. |
| 9. Long-Tail Test Coverage And Release-Boundary Cleanup | TO BE DONE | Accurate | Pending work matches dependencies and release-boundary gate. |
| 10. Cleanup, Verification, And Final Self-Check | TO BE DONE | Accurate | Final validation has not been recorded. |

## P-Item Coverage Summary

| P item | Roadmap task | Current assessment |
| --- | --- | --- |
| P1 `with_unlocked_db` | 7.1 | Partially implemented; helper exists, many call sites converted, several eligible preambles remain. |
| P2 Markdown export dedupe | 2.1 | Implemented. |
| P3 query split | 4.1 | Implemented. |
| P4 schema split and `apply_pending` | 5.1 | Implemented. |
| P5 row decoding | 2.2 | Implemented. |
| P6 dead code / deferred legacy cleanup | 1.2 and 9.4 | Safe cleanup implemented; legacy cleanup correctly deferred. |
| P7 misleading guard tests | 1.3 and 6.2 | Implemented with production-path inner tests. |
| P8 stale docs | 1.1 | Original targets fixed; needs follow-up for paths stale after P3/P4. |
| P9 non-auto unlock unification | 7.2 | Implemented. |
| P10 TipTap extension split | 8.1 | In progress despite roadmap saying `TO BE DONE`. |
| P11 security tab split | 8.2 | Not implemented, matching roadmap. |
| P12 auth method command split | 8.3 | Not implemented, matching roadmap. |
| P13 WebView handler split | 8.4 | Not implemented, matching roadmap. |
| P14 command harness spike/fallback | 6.1 | Implemented by documented fallback to pure-function extraction. |
| P15 security subsection tests | 9.1 | Not implemented, matching roadmap dependency on P11. |
| P16 derived-state/no sentinel policy | 9.3/9.4 | Preserved so far; no sentinel found. |
| P17 editor integration tests | 9.2 | Not implemented, matching roadmap. |
| P18 encrypted storage helpers | 2.3 | Implemented. |
| P19 raw UI error sanitization | 3.2 | Mostly implemented; enforcement check missing. |
| P20 auto-key policy docs | 3.1 | Implemented. |

## Positive Implementation Evidence

- `src-tauri/src/db/queries/entries.rs` defines `ENTRY_SELECT` and `row_to_entry`.
- `src-tauri/src/db/queries/mod.rs` defines `encrypt_for_storage` and `decrypt_utf8`.
- `src-tauri/src/db/queries/tags.rs` uses the shared storage helpers for tag create/rename/decrypt paths.
- `src-tauri/src/db/schema/migrations/mod.rs` defines `apply_pending`.
- `src-tauri/src/commands/auth/auth_core.rs` defines `UnlockMode`, `perform_unlock`, and `check_require_all_auth_credential_count`.
- `src-tauri/src/commands/auth/auth_core.rs` documents why `unlock_diary_auto` bypasses `require_all_auth` and legacy migration.
- `src-tauri/CLAUDE.md` records the same auto-key policy.
- `src/lib/errors.ts` documents the UI error sanitization rule.
- `src/components/auth/PasswordCreation.test.tsx`, `src/components/overlays/ImportOverlay.test.tsx`, and `src/components/overlays/StatsOverlay.test.tsx` include sanitization tests.
- `src/components/editor/extensions/BidiExtension.test.ts` adds direct coverage for first-strong-direction detection.

## Recommended Next Actions

1. Update the roadmap status immediately:
   - Milestone 8: `IN PROGRESS`
   - Task 8.1: `IN PROGRESS`
   - Add a note that `DiaryEditor.tsx` extraction has uncommitted changes and validation is pending.

2. Finish Task 8.1 validation:
   - `cmd.exe /c bun run test:run`
   - `cmd.exe /c bun run type-check`
   - Run `cmd.exe /c bun run format` after code changes, per repository workflow.

3. Close the Task 3.2 enforcement gap:
   - Add and wire a grep/script check for raw UI error display.
   - Record its command in the roadmap validation notes.

4. Reconcile Task 7.1:
   - Convert remaining eligible unlocked-DB preambles or document why each remaining site is intentionally excluded.

5. Fix stale module-path documentation introduced by P3/P4:
   - `PHILOSOPHY.md`
   - `docs/decisions/2026-05-settings-storage-taxonomy.md`
   - Any other matches for `src-tauri/src/db/schema.rs` and `src-tauri/src/db/queries.rs`.

6. Continue with Tasks 8.2 through 8.4 only after Task 8.1 validation is recorded.

## Assessment Limitations

This report is based on static inspection and targeted searches. It does not prove the current tree builds or that tests pass. The roadmap contains historical validation notes, but this assessment did not re-run the full suite. Before marking any additional task complete, run the task-specific validation commands through the Windows toolchain as required by `AGENTS.md`.
