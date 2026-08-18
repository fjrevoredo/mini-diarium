# Backup System Redesign Adversarial Review

**Review date:** 2026-08-16  
**Scope:** `origin/master...HEAD` for TODO-0098, assessed against `docs/backup-system-redesign-plan.md`, the backup/security guidance, and the shipped frontend and backend behavior.  
**Validation performed:** source-level control-flow review, requirement traceability, and `cargo test --workspace` (749 tests passed).

## Assessment

The redesign substantially improves the prior unlock-copy implementation: snapshot creation is verified and atomic, retention is policy-driven, pre-auth visibility works without exposing entry content, and both restoration paths remain in-process. However, the implementation is not ready to be considered complete against its own recovery and destructive-operation requirements. The findings below include paths that can permanently discard a snapshot, bypass the stated migration safety invariant, or let users enqueue contradictory restore operations.

Priority definitions: **P1** can cause data loss, a misleading recovery result, or a material security-state failure. **P2** violates an explicit requirement or can materially mislead a user during recovery.

## Findings

### 1. Restore migrates the swapped journal without its required pre-migration snapshot

- **Priority:** P1
- **Description:** Restoring an older-schema snapshot swaps it into `diary.db` and then invokes `apply_pending` directly. This bypasses the pre-migration snapshot path used by normal journal opening. If that migration fails, the rollback only restores the pre-restore live journal. It does not preserve an independently verified copy of the just-restored, pre-migration database. The original target snapshot may already have been evicted by retention when the safety snapshot was created, so the recoverable migration input can be lost.
- **Evidence:** The plan requires a snapshot before every migration and calls out the restore/migration interaction in `docs/backup-system-redesign-plan.md:179-185` and `:386-390`. `restore_from_snapshot` creates the safety snapshot after staging the target at `crates/mini-diarium-core/src/backup/restore.rs:110-145`; `reopen_current` then calls `apply_pending` directly at `:237-251`. Normal opening routes migrations through the pre-migration snapshot helper in `crates/mini-diarium-core/src/db/schema/open.rs:13-51`. The existing restore migration test verifies success only, not failed migration recovery.
- **Suggested fix and rationale:** Route restore reopening through a core-internal helper that takes and verifies a `Migration` snapshot before `apply_pending`, or explicitly create and retain that snapshot in `reopen_current`. Ensure a failure rolls back safely and that retention cannot delete this new pre-migration copy until migration completes. This restores the plan's central guarantee: a risky migration is never the only copy of the state it changes.

### 2. Journal relocation commits backup relocation before the database move

- **Priority:** P1
- **Description:** When a user elects to move backups, the implementation deletes the source backup directory before it copies and deletes `diary.db`. If either database operation fails, the journal remains at its old location while its backups have moved to the new directory, but `DiaryState.backups_dir` still points at the now-deleted old directory. This is neither atomic nor resumable from the application's state and violates the task's explicit requirement.
- **Evidence:** `change_diary_directory_inner` calls `relocate_backups` before copying `diary.db` at `src-tauri/src/commands/auth/auth_directory.rs:54-69`, and updates the state paths only after both operations at `:73-80`. `relocate_backups` removes the source directory on successful relocation at `crates/mini-diarium-core/src/backup/relocate.rs:81-94`. The plan requires the operation to be "all-or-nothing or resumable" at `docs/backup-system-redesign-plan.md:521-530`; its completion note explicitly acknowledges this remaining failure mode at `:534`.
- **Suggested fix and rationale:** Stage and verify the database copy first without deleting the old database; relocate backups next; then commit configuration/state and remove old sources only after all destination artifacts are verified. On failure, either remove staging artifacts or retain enough durable state to resume. This prevents a disk-I/O failure from separating a journal from the recovery history the feature promises to carry with it.

### 3. A same-name collision during backup relocation silently loses the source snapshot

- **Priority:** P1
- **Description:** Relocation treats an existing destination filename as a duplicate without comparing the two files. It then removes the entire source directory and lets the destination manifest record win. Two different snapshots with the same timestamp-derived name therefore cause the source snapshot to be discarded permanently.
- **Evidence:** `relocate_backups` skips any destination file that exists at `crates/mini-diarium-core/src/backup/relocate.rs:56-64`; `merge_manifests` removes the source record when its filename matches at `:97-103`; and the source directory is removed at `:81-86`. The test accepts that behavior in `test_relocate_backups_skips_a_same_name_collision_at_the_destination` in the same file. Timestamp names can collide, including after an earlier interrupted move or manual recovery, and `store.rs:391-412` itself documents that same-second names need collision handling.
- **Suggested fix and rationale:** Compare colliding files using a strong content identity before deduplicating. If they differ, preserve both by allocating a unique destination filename and updating its manifest record; alternatively abort the move without deleting the source. A filename is not a data-integrity identifier, so it must not decide which recovery point survives.

### 4. The Backups panel allows conflicting destructive actions to be queued

- **Priority:** P2
- **Description:** During a whole-journal restore, the UI disables only the selected row. A user can confirm another restore, start a manual snapshot, delete another snapshot, or open a per-entry restore while the first restore is still running. Some calls wait on the database mutex, but that does not make the UI safe: the second action was confirmed against stale pre-restore state and can run afterward. Deletion is worse: it checks the database mutex and releases it before deleting the snapshot, so it can overlap filesystem work in a restore. A later action also overwrites `busyAction` and `busyFile`, allowing completion of the first operation to clear the only busy indication while another mutation remains in progress.
- **Evidence:** `BackupsPanel.tsx` stores only one mutable `busyAction`/`busyFile` pair at `src/components/backups/BackupsPanel.tsx:99-106` and overwrites it in each handler at `:135-163` and `:180-236`. Button disabling checks only the local action or row at `:376-384`, `:483-524`; deletion has no busy state at all (`:166-178`). `restore_backup_inner` holds the database mutex for its operation at `src-tauri/src/commands/backup.rs:241-260`, whereas `delete_backup` releases its database guard before calling `delete_snapshot` at `:134-145`. Existing component tests cover independent actions, not deferred concurrent actions.
- **Suggested fix and rationale:** Use one panel-wide mutation lock from confirmation until the post-operation refresh completes. Disable create, verify, delete, restore, and inspection while it is held; keep reveal available if desired. Also serialize backup-directory mutations in the backend so a future caller cannot delete a snapshot while restore is staging or finalizing. Add a deferred-promise component test proving a second destructive click cannot invoke IPC. Recovery actions must not accept contradictory consent based on stale state.

### 5. A poisoned path mutex can lock the journal without notifying the frontend

- **Priority:** P1
- **Description:** The lock snapshot helper removes the live database connection before it reads `db_path` and `backups_dir`. If either subsequent mutex is poisoned, it returns `None` after dropping the connection. The normal lock flow then mistakes this for an already-locked journal and does not emit `journal-locked`; the frontend can remain on an unlocked screen with existing plaintext state until a later command fails.
- **Evidence:** `take_connection_and_snapshot` executes `state.db.lock().ok()?.take()?` before the path locks at `src-tauri/src/commands/backup_triggers.rs:109-117`. `lock_diary_inner_with` treats `None` as the already-locked branch at `src-tauri/src/commands/auth/mod.rs:72-83`. `auto_lock_diary_if_unlocked` emits `journal-locked` only when this branch returns `true` at `:121-134`. This conflicts with the repository's mutex-poisoning rule and the requirement that all auto-lock paths cleanly reset the UI.
- **Suggested fix and rationale:** Acquire and clone `db_path` and `backups_dir` before taking the database connection, and return a typed/string state-lock error rather than collapsing poisoned locks into `None`. Add a regression test that poisons a path mutex and asserts the database remains installed or the lock error reaches the caller without suppressing the lock event. A poisoned state must not silently weaken the lock-screen boundary.

### 6. A stale asynchronous refresh can overwrite newer backup state

- **Priority:** P2
- **Description:** Every visibility transition and successful mutation starts an independent `load`. Results are applied unconditionally. A slow initial load can finish after a post-create, post-delete, or post-restore refresh and replace the newer list and health with stale data, temporarily hiding a newly created manual or safety snapshot and reporting obsolete health.
- **Evidence:** `load` applies results directly at `src/components/backups/BackupsPanel.tsx:111-129`; visibility starts it at `:131-133`; create, delete, and restore each start another at `:135-146`, `:166-178`, and `:180-230`. There is no request generation, cancellation, or serialization. Tests use immediately settled mocks, so they cannot exercise completion out of order.
- **Suggested fix and rationale:** Track a monotonic load generation and apply results/errors/finally state only when the response is current, or serialize refreshes behind the mutation lock. Add a test with deferred promises resolving in reverse order. Backup state is a recovery-status surface, so stale success must not overwrite the result of a completed destructive action.

### 7. Whole-journal restore can report success without identifying its safety snapshot

- **Priority:** P2
- **Description:** The restore command returns the safety snapshot filename, but the UI derives its display timestamp only by finding that filename in a subsequent list refresh. `load` catches refresh errors instead of throwing, so a successful restore followed by a failed list request shows the generic success string without naming the safety snapshot. This fails UX-2's required reversibility feedback at precisely the point a user needs to know which snapshot can undo the action.
- **Evidence:** The UX gate requires success to name the safety snapshot in `docs/backup-system-redesign-plan.md:79-80`. The command returns only `safety_snapshot: Option<String>` at `src-tauri/src/commands/backup.rs:179-187` and `:262-268`. The UI refreshes, then searches the current list and falls back to a generic message at `src/components/backups/BackupsPanel.tsx:214-230`; `load` consumes its own errors at `:111-129`.
- **Suggested fix and rationale:** Return the safety snapshot's immutable display metadata (`created_at`, and optionally filename) in `RestoreSummary`, then render it directly. Retain the refresh for the list, but decouple essential confirmation text from a secondary read. Add a test where `restoreBackup` succeeds and the following list request fails.

### 8. Snapshot inspection omits the entry count required by the UX gate

- **Priority:** P2
- **Description:** Once inspection is open, the dialog identifies the snapshot date and read-only status but never states its entry count. Rendering individual rows is not an equivalent summary for an empty or long snapshot, and it does not meet the approved UX-1 requirement.
- **Evidence:** UX-1 requires the open snapshot's date and entry count in `docs/backup-system-redesign-plan.md:77-80`. In the entries phase, the dialog renders only the date and read-only notice at `src/components/backups/BackupInspectDialog.tsx:413-421`, followed by the list/empty state at `:423-490`. Neither component nor E2E tests assert an entry-count summary.
- **Suggested fix and rationale:** Render `props.snapshot.entry_count` (or the loaded-entry count after the list is available) beside the snapshot date, with an explicit unknown-state fallback for adopted metadata. Add component coverage for populated and empty snapshots. This is small code but a direct, approved recovery-UX requirement.

## Implementation Organization

The findings do not require separate sessions, but they should be tracked and committed as four independent workstreams. Do not combine them into one undifferentiated change: the first three alter recovery or locking guarantees and need focused fault-injection coverage.

### A. Restore Integrity

- **Findings:** 1, 4, 7
- **Objective:** A restore remains reversible across schema migration, cannot race another backup-directory mutation, and always tells the user which safety snapshot can undo it.
- **Scope:** Add the required verified pre-migration snapshot to the restored-database path. Introduce backend serialization for restore, snapshot creation, verification, and deletion; apply a panel-wide mutation lock. Return immutable safety-snapshot display metadata from the restore result rather than deriving it from a refresh.
- **Validation:** Add failure-path coverage for an older-schema restore whose migration fails; add command coverage that blocks/defer-rejects a deletion during restore; add component tests for concurrent action suppression and a successful restore followed by a failed list refresh.
- **Dependency:** None. It can proceed independently of relocation.

### B. Journal And Backup Relocation Integrity

- **Findings:** 2, 3
- **Objective:** Moving a journal with backups is atomic or safely resumable, and never selects one snapshot to discard based only on its filename.
- **Scope:** Stage and verify the destination database before committing backup relocation and configuration changes. Preserve both snapshots on non-identical filename collisions, or abort without deleting the source. Make failure recovery/retry state explicit.
- **Validation:** Add injected database-copy and old-file-removal failures after backup staging/relocation; assert the source journal and backup history remain usable or the move resumes deterministically. Add same-name, different-content collision coverage asserting both recovery points survive.
- **Dependency:** None. Keep this in a dedicated commit because it changes the irreversible ordering of journal relocation.

### C. Lock-State Security

- **Findings:** 5
- **Objective:** A poisoned state mutex cannot silently drop the database connection while leaving the frontend unlocked.
- **Scope:** Read required paths before removing the connection and propagate state-lock failures instead of mapping them to an already-locked result. Preserve the existing auto-lock event contract.
- **Validation:** Add a regression test that poisons each path mutex and proves that the connection is retained or a lock error is surfaced; verify that a successful lock still emits the frontend reset event.
- **Dependency:** None. This is a small, isolated backend/security commit.

### D. Backup UI State And Inspection Clarity

- **Findings:** 4, 6, 8
- **Objective:** The backup panel always presents current status and meets the approved inspection feedback requirements.
- **Scope:** Use latest-wins/serialized loading so older responses cannot replace fresh backup state. Render the inspected snapshot's entry count, including an unknown-metadata fallback. Coordinate with Workstream A for the shared panel-wide mutation lock.
- **Validation:** Add deferred-promise tests resolving loads out of order, and populated/empty inspection tests asserting the summary count. Run the affected component suite and manually verify a slow refresh plus restore flow in the desktop app.
- **Dependency:** The mutation-lock portion should land with Workstream A; the latest-wins loading and count summary can land independently.

## Recommended Order

1. Workstream A: restore integrity.
2. Workstream B: journal and backup relocation integrity.
3. Workstream C: lock-state security.
4. Workstream D: remaining UI consistency and UX-gate completion.

After all four workstreams, rerun the full backup recovery rehearsal: whole-journal restore from an older-schema snapshot, per-entry restore, concurrent-action attempts, a relocation failure/retry, and all three auto-lock paths.

## Self-Check

The report was self-reviewed after drafting.

- Re-read every cited control-flow region and verified the stated order of database, backup, manifest, and UI operations.
- Checked each finding against the approved plan rather than treating a stylistic preference as a defect.
- Excluded low-priority documentation-status inconsistencies and wording ambiguity because they do not independently create a code or recovery failure.
- Independently revalidated all findings after drafting. This changed Finding 4 from P1 to P2 and clarified that deletion can overlap restore filesystem work because it releases the database mutex before deleting.
- Confirmed that all eight findings remain actionable with a bounded fix and a concrete regression-test shape.
- Confirmed `cargo test --workspace` passes. Passing tests do not cover the failure schedules or concurrent UI interactions identified above.
