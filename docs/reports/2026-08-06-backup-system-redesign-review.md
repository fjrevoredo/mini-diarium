# Backup System Redesign Review (Milestones 1-3)

**Review date:** 2026-08-06  
**Scope:** the implementation from `master` through `70fd4e5c`, assessed against [`docs/backup-system-redesign-plan.md`](../backup-system-redesign-plan.md). Milestone 4 is explicitly not implemented and is out of scope.

## Outcome

The snapshot engine is substantially aligned with the plan: it uses `VACUUM INTO`, verifies modern snapshots, persists privacy-bounded metadata, applies a deterministic tiered policy, and exposes typed, sanitized UI operations. Two actionable findings remain. The first can falsely reassure a user that backups are healthy when the backup path is unusable; the second expands the locked-screen disclosure beyond the specified reduced view.

## Findings

### P1 — Backup health can report healthy while the backup path is blocked

**Requirement:** UX-6 requires a persistent, non-blocking degraded indicator when backups fail, with a plain-language cause. Task 3.2 requires that indicator in the panel.

**Evidence:** `FsSnapshotStore::list` treats every `read_dir` error as an empty directory ([`store.rs`](../../crates/mini-diarium-core/src/backup/store.rs:118)). `backups_dir_is_usable` then returns `true` whenever the journal's parent directory exists, even if `backups_dir` itself is a file or cannot be read ([`mod.rs`](../../crates/mini-diarium-core/src/backup/mod.rs:266)). If the directory is blocked by a file, `create_snapshot` cannot write either the snapshot or `manifest.json`; the failure record is therefore not durable ([`mod.rs`](../../crates/mini-diarium-core/src/backup/mod.rs:124)). A subsequent health read has no failure record and reports the path as accessible. The panel renders that combination as “Backups are working” ([`BackupsPanel.tsx`](../../src/components/backups/BackupsPanel.tsx:184)).

**Impact:** A user with a replaced, inaccessible, or permission-denied backups path can be told that backups work while no new snapshot can be made. This defeats the health indicator at the point it is most safety-critical.

**Recommendation:** Make health distinguish `missing but creatable` from `exists but inaccessible/invalid`. Do not collapse `read_dir` errors into an empty list. For an existing backup path, verify it is a directory and perform a non-destructive accessibility check (or preserve a durable failure status somewhere writable outside the blocked path). Add regression coverage for a backup-directory path occupied by a file and for an unreadable directory, asserting a degraded health result.

**Resolution (2026-08-06):** Fixed as recommended. `store::dir_state` classifies the path as `Usable` / `Absent` / `Blocked` by walking `ancestors()` to the deepest path that exists — portable, because a file occupying a *parent* surfaces as `NotFound` on Windows and `NotADirectory` on Unix. `FsSnapshotStore::list` now returns `Ok(vec![])` only for `NotFound` and `Err` for anything else, and `manifest::load_reconciled` logs at `warn!` where it still degrades to an empty list. `backups_dir_is_usable` defers to the classifier, falling back to the journal's own directory only for `Absent`. The durable-failure-status alternative was not taken: the manifest lives inside the blocked directory by design, so `directory_accessible` is the only honest signal there, and the new tests assert `last_failure` is `None` to pin that. Coverage: `test_health_reports_a_backups_path_blocked_by_a_file_as_unusable` (flat and nested shapes), `#[cfg(unix)] test_health_reports_an_unreadable_backups_directory_as_unusable`, `test_list_distinguishes_a_missing_directory_from_an_unusable_one`. `prefs.backups.healthUnreachable` was reworded across all seven locales, since it named only the removable-drive cause.

### P2 — The pre-auth “reduced” panel discloses entry counts and date ranges contrary to Task 3.3

**Requirement:** Task 3.3, step 2 specifies that reduced mode shows “dates, sizes, triggers, and health only”; key-requiring actions remain disabled.

**Evidence:** Reduced mode uses the same `SnapshotMeta` data as the authenticated panel ([`BackupsPanel.tsx`](../../src/components/backups/BackupsPanel.tsx:81)). List rows always render `entry_count` ([`BackupsPanel.tsx`](../../src/components/backups/BackupsPanel.tsx:336)) and `entry_date_range` ([`BackupsPanel.tsx`](../../src/components/backups/BackupsPanel.tsx:347)), including while the journal is locked. The implementation record acknowledges that the pre-auth panel “listed the snapshot in full” (plan line 282), but no maintainer sign-off or revised requirement records that scope change.

**Impact:** The locked-screen view exposes more journal activity metadata than the plan authorized. The metadata is permitted by the manifest privacy decision, so this is not a plaintext-content leak; it is nevertheless a requirements and least-disclosure regression for a screen deliberately designed to work without unlocking.

**Recommendation:** Gate entry count and date-range rendering behind `!props.reduced`, or obtain and record explicit approval to revise Task 3.3’s disclosure contract. Add a reduced-mode test that positively asserts the allowed fields and asserts that entry-count and date-range text are absent.

**Resolution (2026-08-06):** Fixed by the first option — both fields are now gated behind `!props.reduced`, leaving reduced rows with date, relative age, trigger, size, the checked/not-checked badge, and health. The backend is unchanged on purpose: `list_backups_unauthenticated` still returns the full `SnapshotMeta`, because it is the same manifest data an unlocked read gets, `test_the_unauthenticated_payload_carries_no_user_content` already holds the privacy line, and forking the DTO would buy nothing an attacker cannot get by opening `manifest.json`. This is least disclosure on a screen anyone walking past can see, not a security boundary. Covered by a new reduced-mode test asserting the allowed fields present and `/3 entries/` and `/2024-01-15 to 2024-03-20/` absent, with the unlocked test extended with a date-range assertion so both sides of the gate are pinned. The plan's deviation row 3 and the component doc comment were corrected to stop claiming the two views are identical.

## Requirements and quality checks

| Area | Result | Evidence |
|---|---|---|
| Atomic modern snapshot writes | Pass by inspection | Temp `VACUUM INTO`, file sync, rename, and post-write verification are implemented in [`store.rs`](../../crates/mini-diarium-core/src/backup/store.rs:210). |
| Manifest privacy boundary | Pass by inspection and targeted test | No path/content/labels are modeled; `test_manifest_contains_no_user_content` passed in the targeted backup run. |
| Retention and deduplication | Pass by inspection and targeted test | Policy is pure and has the required burst, depth, budget, and unchanged-database coverage. |
| IPC and displayed backend errors | Pass by inspection and static canary | Typed wrappers are used, panel error paths call `mapTauriError`, and the raw-error-display canary found no production matches. |
| Milestone 3 Linux reveal verification | Not complete (known) | The plan marks Task 3.4 BLOCKED pending a Linux desktop verification (plan lines 284-332). |
| `cargo test --workspace` | Unverified in this review | The environment terminates commands at about 60 seconds; two runs were interrupted, producing a broken-pipe error after termination rather than a test assertion failure. |
| `bun run test:run` | Unverified in this review | The same fixed command ceiling terminated the full and focused Vitest invocations before output was returned. |
| Targeted backup tests | Pass | `cargo test -p mini-diarium-core backup --lib`: 49 passed, 0 failed. |
| Type-check | Pass | `cmd.exe /c bun run type-check`. |
| Lint, Clippy, UI-error check, locale validation, formatting | Pass | `lint`, `cargo clippy --workspace --all-targets -- -D warnings`, `check:ui-errors`, `validate:locales`, `format:check`, and `cargo fmt --all --check`. |
| Security canaries | Pass | No network dependencies, raw UI-error displays, or E2E-only environment-variable access outside `src-tauri/src/lib.rs` were found. |

## Review conclusion

Do not close Milestone 3 yet: its Linux platform validation is knowingly outstanding, and P1 should be fixed before relying on the panel’s health status. P2 needs either a small rendering correction or explicit approval of the changed locked-screen disclosure.

### Status after remediation (2026-08-06)

Both findings are fixed; see the resolution note under each. The two "unverified in this review" test-suite rows were covered by the remediation's own validation (`cargo test --workspace` and `bun run test:run` both run to completion there). **Milestone 3 remains open**: Task 3.4's Linux `PLATFORM-VERIFY` still needs a maintainer on a Linux desktop, and nothing in this remediation touches it.
