# Refactoring Roadmap Implementation Status Review

## Metadata

- Review date: 2026-05-22
- Reviewed plan: `docs/refactoring-recommendations-implementation-roadmap.md`
- Source report: `docs/refactoring-report-2026-05-21.md`
- Scope: current repository state, including uncommitted implementation/test changes
- Method: static inspection, targeted grep checks, and project validation commands through the Windows toolchain

## Executive Summary

The roadmap implementation is mostly present, but the plan's final status is too optimistic. Several major refactors exist in the codebase: the query/schema splits, markdown export deduplication, row decoding helpers, TipTap extension extraction, security preference component split, auth command split, WebView handler extraction, and added frontend tests.

The implementation is not cleanly complete. The most important gap is in the multi-auth unlock path: the backend verifies the number of credentials, but it does not prove that every required auth slot is represented by a distinct credential. A duplicate credential can satisfy the count check. The raw UI error sanitization work is also incomplete: the new guard fails on its own documentation comments and misses indirect raw-error assignments in user-facing components.

The normal frontend and backend test suites pass, and `bun run build` passes, but `bun run check` fails because of formatting drift and the broken UI-error guard.

## Findings

### 1. Multi-auth unlock can be satisfied with duplicate credentials

Severity: Critical

`perform_unlock(UnlockMode::AllMethods)` checks only `credentials.len()` against the number of non-auto auth slots, then verifies each credential independently. It does not track which auth slot each credential satisfied, and it does not reject duplicates. In a journal with password + keypair and `require_all_auth = true`, two copies of the password credential can satisfy the count check and then verify the same password slot twice. The same class of issue applies to repeated keypair credentials.

Evidence:

- `src-tauri/src/commands/auth/auth_core.rs:80` `check_require_all_auth_credential_count` validates only a count.
- `src-tauri/src/commands/auth/auth_core.rs:168` calls that count check before per-credential verification.
- `src-tauri/src/commands/auth/auth_core.rs:169-194` verifies remaining credentials but does not record satisfied slot IDs/types.
- Existing backend tests cover count rejection only; there is no duplicate-credential regression test.

Impact:

This weakens the intended "all authentication methods" policy at the command boundary. The current frontend builds one credential per `peek_auth_slot_types()` slot, but the Tauri command accepts arbitrary `Vec<MultiAuthCredential>`, so the backend should enforce the invariant itself.

Recommended fix:

- Resolve each credential to a concrete auth slot ID.
- Reject duplicate slot IDs.
- Require the satisfied non-auto slot ID set to equal all registered non-auto auth slots when `require_all_auth` is active.
- Add regression tests for password+keypair with duplicate password credentials and duplicate keypair credentials.

### 2. Raw UI error sanitization is still incomplete

Severity: High

Task 3.2 claims remaining raw UI errors were sanitized and guarded. The known original sites were mostly converted, but several user-facing error paths still display raw `err.message` / `String(err)` through an intermediate `message` variable. The grep guard does not catch this pattern.

Evidence:

- `src/components/auth/JournalPicker.tsx:36-37`, `53-54`, `71-72`, `114-115`, and `164-165` display raw journal management errors.
- `src/components/overlays/preferences/PreferencesDataTab.tsx:48` injects a raw reset error into an alert message.
- Note: `src/components/auth/PasswordPrompt.tsx` has similar-looking `err.message` assignments, but those catch errors thrown by `src/state/auth.ts` helpers that already call `mapTauriError()` before rethrowing. They are not counted as confirmed raw Tauri leaks in this finding.

Impact:

These paths can leak filesystem paths, SQLite internals, OS errors, or crypto details into user-visible UI. This contradicts the roadmap's P19 objective and `src/CLAUDE.md` guidance.

Recommended fix:

- Convert these paths to `mapTauriError(err, t)`.
- Add focused tests for at least `JournalPicker` and `PreferencesDataTab` leak prevention.
- Expand the sanitizer script to detect raw alias patterns like `const message = ...err.message...; setError(message)` while allowing already-sanitized state-layer rethrows.

### 3. The UI-error sanitizer guard is wired but currently broken

Severity: High

`bun run check:ui-errors` exists and is wired into `bun run check`, but it fails on the current tree because it scans documentation comments in `src/lib/errors.ts`.

Command result:

```text
cmd.exe /c bun run check:ui-errors
exit 1
src/lib\errors.ts:19: *   setError(String(err))
src/lib\errors.ts:20: *   setError(err.message)
```

Impact:

The guard is not usable in CI/pre-commit as written. It also has false negatives for the confirmed indirect raw-error paths listed in Finding 2.

Recommended fix:

- Ignore `src/lib/errors.ts` comments or parse source files more carefully.
- Add patterns for raw `const message = ...err.message...` followed by `set*Error(message)` in the same block, with a documented allowlist or source-aware handling for sanitized rethrows.
- Keep the command in `bun run check` only after it passes on a clean tree.

### 4. Final verification claims are stale or incomplete

Severity: Medium

The plan records final frontend tests as `377/377`, but the current test suite is `381/381`. It also marks format/final verification complete, while the current quick check fails.

Observed validation:

```text
cmd.exe /c bun run type-check  -> pass
cmd.exe /c bun run lint        -> pass
cmd.exe /c bun run test:run    -> pass, 381 tests
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test" -> pass, 337 tests
cmd.exe /c bun run build       -> pass
cmd.exe /c bun run check       -> fail: Prettier + UI error sanitization
cmd.exe /c bun run format:check -> fail: src/components/overlays/preferences/ChangePasswordForm.test.tsx
```

Impact:

Task 10.2 and the pre-flight checklist do not reflect the actual current repository state. The build now passes, so the earlier "build not required" note is obsolete, but the format and quick-check failures must be recorded or fixed before calling the implementation complete.

Recommended fix:

- Run `bun run format` or format `ChangePasswordForm.test.tsx`.
- Fix the UI-error sanitizer and remaining raw-error paths.
- Update final verification notes with current counts and command results.

### 5. Roadmap status metadata is internally inconsistent

Severity: Medium

The roadmap says:

- Metadata: `Plan Status: IN PROGRESS`.
- Milestone 9: `COMPLETED`, while Task 9.4 remains `TO BE DONE`.
- Milestone 10: `COMPLETED`.
- Plan self-check: `Plan status is READY FOR APPROVAL`.
- Pre-flight checklist: "Plan status updated" is checked, but no final `COMPLETED` plan status is present.

Impact:

The document no longer provides a reliable single source of truth. Task 9.4 may be intentionally deferred, but the plan should explicitly distinguish "implementation wave complete except deferred release-boundary task" from "all tasks complete."

Recommended fix:

- Choose one top-level status, likely `IN PROGRESS` or `COMPLETED WITH DEFERRED TASK`.
- Correct the stale self-check item that still says `READY FOR APPROVAL`.
- Make Milestone 9 status reflect the deferred Task 9.4 accurately.

### 6. Security preference test coverage is overstated

Severity: Medium

Task 9.1 completion notes claim `PreferencesSecurityTab.test.tsx` was extended with 6 tests and covers the require-all-auth checkbox/fallback/auto-protected hide. The file currently has 5 tests total: 2 conditional-section tests and 3 require-all-auth visibility tests.

More importantly, the roadmap step asked for disabled-state/error-consistency coverage. The current tests do not cover:

- Initial checkbox state from `peekAuthSlotTypes().require_all_auth`.
- Calling `setRequireAllAuth` when the checkbox changes.
- Error display through `mapTauriError` when `setRequireAllAuth` rejects.

Impact:

The highest-risk UI toggle around multi-auth policy is still lightly covered, and the completion note is inaccurate.

Recommended fix:

- Add tests for initial checked state, successful toggle, and rejected toggle sanitization.
- Update Task 9.1 notes to the real test count.

### 7. Documentation references are stale after the module splits

Severity: Medium

Some living docs still point contributors to old files that no longer exist after P3/P4/P12.

Examples:

- `src-tauri/CLAUDE.md:217` references `db/queries.rs`.
- `src-tauri/CLAUDE.md:223` references `db/schema.rs`.
- `docs/decisions/2026-05-settings-storage-taxonomy.md:180` references `db/schema.rs`.
- `docs/KNOWN_ISSUES.md:124` references search hooks in `db/queries.rs`.
- `docs/KNOWN_ISSUES.md:186` references `commands/auth/auth_methods.rs`.

Impact:

This undercuts the roadmap's documentation-cleanup goals and sends future contributors to dead paths.

Recommended fix:

- Update living docs to `src-tauri/src/db/queries/`, `src-tauri/src/db/schema/`, and the new auth command modules.
- Archive/report documents can remain historical, but living guides and known issues should be reconciled.

### 8. E2E validation was skipped despite UI and WebView refactors

Severity: Low

The final checklist says E2E was skipped because there were "no UI/WebView behavior changes in this session." That may be true for the last sub-session, but the roadmap implementation includes UI structural changes and WebView handler extraction. Task 8.4 explicitly listed build/backend tests and network-isolation E2E "if available."

Impact:

This is not proof of a defect, but the final validation rationale is too narrow for the full roadmap review.

Recommended fix:

- Either run the relevant E2E/network-isolation checks, or document the environmental blocker and residual risk.

## Implemented Areas Confirmed

- P1 helper exists in `src-tauri/src/commands/auth/mod.rs`, with helper tests.
- P2 markdown export deduplication exists.
- P3 query module split exists under `src-tauri/src/db/queries/`.
- P4 schema/migration split exists under `src-tauri/src/db/schema/`, including `migrations::apply_pending`.
- P5/P18 centralized entry row decoding and encrypted storage helpers exist.
- P6 safe cleanup is done; legacy `require_all_auth` cleanup remains deferred.
- P7 misleading guard tests were replaced or moved toward production-path helpers.
- P8 original stale exact strings were removed.
- P10 TipTap extensions were extracted.
- P11 security tab was split into focused child components.
- P12 auth method commands were split into identity/slots/policy modules.
- P13 WebView handlers were extracted into `webview_security/`.
- P14 fallback command-test strategy is documented and represented by pure inner tests.
- P20 auto-key policy is documented in code and backend guide.

## Validation Log

Commands run during this review:

| Command | Result |
| --- | --- |
| `cmd.exe /c bun run check:ui-errors` | Failed; false positives in `src/lib/errors.ts` comments |
| `cmd.exe /c bun run type-check` | Passed |
| `cmd.exe /c bun run lint` | Passed |
| `cmd.exe /c bun run test:run` | Passed, 381 tests |
| `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` | Passed, 337 tests |
| `cmd.exe /c bun run build` | Passed |
| `cmd.exe /c bun run check` | Failed; Prettier + UI error sanitizer |
| `cmd.exe /c bun run format:check` | Failed; `ChangePasswordForm.test.tsx` |

## Suggested Completion Criteria

Before treating this roadmap implementation as complete:

1. Fix the multi-auth duplicate-credential backend bug and add regression tests.
2. Convert the remaining raw UI error paths to `mapTauriError`.
3. Repair and broaden `scripts/check-ui-error-sanitization.js`.
4. Restore `bun run check` to green.
5. Add the missing require-all-auth toggle tests.
6. Update stale living documentation paths.
7. Reconcile the roadmap status, task counts, and validation notes.
8. Run or explicitly defer E2E/network-isolation validation with a concrete reason.

## Self-Check

Self-check performed after drafting this report:

- Re-read the report against the current implementation.
- Rechecked the multi-auth finding against `auth_core.rs` and `auth_slots.rs`; the duplicate-credential issue remains valid because the backend tracks credential count, not distinct satisfied auth slot IDs.
- Rechecked raw-error findings against `JournalPicker.tsx`, `PreferencesDataTab.tsx`, `PasswordPrompt.tsx`, and `src/state/auth.ts`. The report was corrected to remove `PasswordPrompt` from confirmed raw-leak evidence because those errors are sanitized in the state layer before rethrow.
- Re-ran `bun run check:ui-errors` and `bun run format:check`; both still fail for the reasons recorded above.
- Rechecked roadmap status/test-count claims against `docs/refactoring-recommendations-implementation-roadmap.md`; the inconsistency findings remain valid.
- Rechecked stale living-doc path references in `src-tauri/CLAUDE.md`, `docs/KNOWN_ISSUES.md`, and `docs/decisions/2026-05-settings-storage-taxonomy.md`; the examples remain valid.
