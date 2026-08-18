# Backup System Adversarial Review — Fixes

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-16
- Last Updated: 2026-08-18
- Owner: Coding agent
- Approval: Approved by user to start Milestone A (2026-08-16); Milestone F implemented per direct user instruction to execute the plan (2026-08-18)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Close all 8 findings from `docs/reports/2026-08-16-backup-system-redesign-adversarial-review.md` (TODO-0098 backup-system redesign), plus the three remaining recovery-integrity gaps found by the final post-implementation review. Every original finding was independently re-verified against the source before this plan was written — see the "Finding Verification" section below. All milestones (A–F) are complete.

## Scope

- Route restore's reopen-after-swap through a verified pre-migration snapshot before `apply_pending` (Finding 1).
- Serialize backup-directory-mutating backend commands (snapshot create, verify, delete, restore) behind one lock, and add a panel-wide mutation lock in `BackupsPanel.tsx` (Finding 4).
- Return immutable safety-snapshot display metadata from `restore_backup` instead of deriving it from a post-restore list refresh (Finding 7).
- Stage and verify the destination database copy before committing backup relocation and config/state changes in `change_diary_directory_inner` (Finding 2).
- Compare colliding backup filenames by content before deduplicating during relocation; abort rather than silently discard a differing snapshot (Finding 3).
- Fix `take_connection_and_snapshot` so a poisoned path mutex cannot silently drop the live connection while reporting "already locked" (Finding 5).
- Make `BackupsPanel.tsx`'s `load()` latest-wins so a stale in-flight refresh cannot overwrite a newer one (Finding 6).
- Render the inspected snapshot's entry count in `BackupInspectDialog.tsx` (Finding 8).
- A full manual backup-recovery rehearsal after all four workstreams land.
- Verify every present encrypted snapshot field and required table before marking a snapshot verified (post-implementation Finding F1).
- Make backup relocation crash-safe and retryable by staging, syncing, comparing, and atomically finalizing every copied snapshot (post-implementation Finding F2).
- Serialize every backup-directory mutation, including unlock, lock, and destructive-trigger snapshots, behind `DiaryState::backup_ops` without introducing an ABBA deadlock (post-implementation Finding F3).

## Non-Goals

- No new backup features (retention policy changes, new snapshot triggers, new UI surfaces beyond what each finding requires).
- No rename/restructuring of the backup subsystem beyond what each fix needs.
- Not building a generic concurrency framework outside one journal's backup-directory operations.
- Not addressing anything in the report explicitly excluded from its own findings (the report already excluded low-priority documentation/wording issues).

## Assumptions

- The four workstreams (A: Restore Integrity, B: Relocation Integrity, C: Lock-State Security, D: UI State & Inspection Clarity) are implemented and committed in the report's recommended order: A, B, C, D, then the final rehearsal — because A and D share the mutation-lock/UI surface and B/C are independent backend-only changes.
- `cargo test --workspace` and the frontend test/lint/type-check suite are the primary automated gates; the manual rehearsal in the Final Verification section is required in addition because several findings (4, 6) are concurrency/timing bugs that unit tests approximate with deferred promises but a real dev-app run is the only way to see the panel behave correctly end to end.
- Fixing Finding 3 by aborting relocation on a genuine content-differing collision (rather than allocating a unique destination filename) is preferred: it is the simpler, safer of the report's two suggested fixes, and same-name collisions are already documented as a rare edge case (interrupted move / manual recovery), so aborting the whole relocation with a clear error is an acceptable UX cost for a case expected to happen close to never.
- Fixing Finding 2 by staging the destination database copy (verify byte-for-byte, keep the source until the copy is verified) is preferred over a fully resumable multi-step protocol, because it removes the specific failure window the finding identifies (relocated backups + un-copied database) without introducing new persisted "resume" state.
- A relocated snapshot must not become visible under a `backup-*.db` final name until its bytes are complete and durable. A retry may find an already-finalized, byte-identical file from an interrupted prior attempt, but it must never be blocked by a partial final file.
- A snapshot marked `verified` promises that all encrypted content recoverable through the supported schema is readable with the live master key. Checking one sample is insufficient because whole-journal restore can otherwise report success before corrupted rows are accessed.
- `backup_ops` remains journal-local. Trigger paths and IPC commands must use the same `backup_ops` then `db` ordering; detached lock snapshots may acquire `backup_ops` in their worker after the connection is removed, because no command can mutate a locked journal's backups directory.

## Open Questions

None.

## Finding Verification

All 8 findings were re-validated by reading the cited source directly (not by trusting the report):

1. **Confirmed.** `restore.rs::reopen_current` (`crates/mini-diarium-core/src/backup/restore.rs:243-252`) calls `apply_pending(&db)` directly with no pre-migration snapshot, unlike `db/schema/open.rs::migrate_with_pre_migration_snapshot` (`crates/mini-diarium-core/src/db/schema/open.rs:13-52`), which every normal-open path routes through.
2. **Confirmed.** `change_diary_directory_inner` (`src-tauri/src/commands/auth/auth_directory.rs:54-80`) calls `relocate_backups` (which deletes the old backups directory on success) before copying/deleting `diary.db`, and updates `db_path_slot`/`backups_dir_slot` only after both steps succeed.
3. **Confirmed.** `relocate.rs::relocate_backups` (`crates/mini-diarium-core/src/backup/relocate.rs:56-64, 84-86`) skips a same-named destination file without comparing content, then unconditionally `remove_dir_all`s the source directory — permanently discarding a same-named-but-different source snapshot. The existing test `test_relocate_backups_skips_a_same_name_collision_at_the_destination` currently asserts this (undesirable) behavior.
4. **Confirmed.** `BackupsPanel.tsx:104-106` holds one `busyAction`/`busyFile` pair; each button's `disabled` check (e.g. `:486`, `:496`, `:507`) only compares to that single pair, and `handleDelete` (`:166-178`) sets no busy state at all. Backend: `restore_backup_inner` (`src-tauri/src/commands/backup.rs:246-260`) holds the `state.db` mutex guard for the entire restore; `delete_backup` (`:134-148`) releases its `state.db` guard (a `{ }` block) before calling `backup::delete_snapshot`, so a delete's own filesystem mutation is not covered by any lock at all — it is a genuine window for delete to interleave with a concurrent restore's or snapshot's filesystem work in the backups directory.
5. **Confirmed, and slightly worse than described.** `take_connection_and_snapshot` (`src-tauri/src/commands/backup_triggers.rs:109-118`) takes the connection out of `state.db` (line 113) *before* reading `db_path`/`backups_dir` (lines 114-115). If either of those locks is poisoned, `.ok()?` returns `None` and the already-removed connection is simply dropped in that stack frame (closing it, zeroizing the key) — it is not preserved anywhere. `lock_diary_inner_with` (`src-tauri/src/commands/auth/mod.rs:72-84`) then treats this `None` as "already locked" (`Ok(false)`), so `auto_lock_diary_if_unlocked` does not emit `journal-locked` even though the connection was, in fact, just destroyed.
6. **Confirmed.** `load()` (`BackupsPanel.tsx:111-129`) applies `setSnapshots`/`setHealth`/`setError` unconditionally with no generation guard; it is invoked independently by the visibility effect (`:131-133`) and every mutation handler (`:141`, `:174`, `:216`).
7. **Confirmed.** `RestoreSummary` (`src-tauri/src/commands/backup.rs:180-187`) carries only `safety_snapshot: Option<String>` (a filename). `BackupsPanel.tsx:218-230` looks that filename up in `snapshots()` *after* `load()` (which swallows its own errors, `:124-128`) — a failed post-restore list refresh silently degrades the success message to the generic fallback.
8. **Confirmed.** `BackupInspectDialog.tsx`'s `entries` phase (`:413-421`) renders only the snapshot date and a read-only notice — `props.snapshot.entry_count` is never rendered anywhere in the file.

Additionally, `docs/backup-system-redesign-plan.md`'s own Task 5.1 implementation note (lines ~530-535) already documents Finding 2's residual risk as a known, explicitly accepted limitation at the time TODO-0098 shipped ("This residual risk is not fully closed... closing that would need staging the database move as well, which is out of this task's scope") — independent confirmation that Finding 2 is real and was a deliberate scope cut, not a coincidental bug.

## Milestones

### Milestone A: Restore Integrity

- Status: COMPLETED
- Purpose: A restore remains reversible across a schema migration, cannot race another backup-directory mutation, and always tells the user which safety snapshot can undo it. Addresses Findings 1, 4 (restore/backend half), and 7.
- Exit Criteria: Restoring an older-schema snapshot preserves a recoverable copy of the pre-migration restored content even if the migration fails; the four IPC-reachable backup commands (`create_backup_now`, `verify_backup`, `delete_backup`, `restore_backup`) cannot run concurrently against the same journal's backups directory (background trigger-path snapshots — unlock/lock/destructive — are explicitly out of scope for this lock, see Task A2 Notes); the restore success message always names the safety snapshot's timestamp without depending on a subsequent list refresh succeeding. `cargo test --workspace` passes.

#### Task A1: Pre-migration snapshot on restore's post-swap reopen

- Status: COMPLETED
- Objective: Restoring a snapshot whose schema predates `SCHEMA_VERSION` takes a verified `Migration`-triggered snapshot of the just-swapped-in (pre-migration) content before `apply_pending` runs, mirroring the guarantee every normal unlock path already has.
- Steps:
  1. In `crates/mini-diarium-core/src/db/schema/open.rs`, change `migrate_with_pre_migration_snapshot` from private to `pub(crate)` so it is reachable from the `backup` module.
  2. In `crates/mini-diarium-core/src/backup/restore.rs`, change `reopen_current(db_path: &Path, key_bytes: &[u8; 32])` to also accept `backups_dir: &Path` (or take `ctx: &BackupContext` directly, since both call sites already have one in scope). Replace the direct `apply_pending(&db)` call with `crate::db::schema::migrate_with_pre_migration_snapshot(&db, db_path, backups_dir)`.
  3. Update both call sites — `restore_from_snapshot` (`:159`) and `roll_back` (`:195`) — to pass `ctx.backups_dir` (or `ctx` itself). `roll_back`'s reopen of the `PreRestore` safety snapshot will not trigger a migration in practice (the safety snapshot is always taken from an already-current-schema live journal), so this is a no-op there — confirm this stays true rather than assuming it silently.
  4. Update the module doc comment on `reopen_current` (`:237-242`) to state the new pre-migration-snapshot behavior instead of "mirrors what `open_database` does... minus the credential step."
  5. In the existing test `test_restore_migrates_a_pre_migration_snapshot_to_the_current_schema` (`crates/mini-diarium-core/src/backup/restore.rs:333-401`), **delete and invert** the trailing assertion block at `:392-400` — it currently asserts `!snapshots.iter().any(|s| s.trigger == SnapshotTrigger::Migration && ...)` with the comment "restoring an old-schema snapshot must not itself trigger a second Migration snapshot". That was correct against the pre-fix behavior this task removes; after this task, restoring a pre-migration snapshot *is* expected to take a `Migration`-triggered snapshot. Replace it with an assertion that a `Migration`-triggered, `verified` snapshot distinct from `target` now exists — assert *presence*, not an exact count, since retention/dedup could otherwise make a fixed count brittle.
  6. Update `docs/backup-system-redesign-plan.md` Task 4.2's implementation note, which currently states the two mechanisms were verified to "interact correctly rather than producing two snapshots for one action" — that statement is being reversed by this task; update it to describe the new behavior (a restored pre-migration snapshot does take its own `Migration` snapshot before re-migrating, so the failed-migration case has a recoverable copy).
- Validation:
  - The updated `test_restore_migrates_a_pre_migration_snapshot_to_the_current_schema` (per step 5) passes with its inverted assertion.
  - Add a new test `test_restore_of_a_pre_migration_snapshot_preserves_it_if_the_migration_fails_afterward`. Do **not** attempt to fail migration via an out-of-range `schema_version` — `migrate_with_pre_migration_snapshot` only snapshots when `stored_version < SCHEMA_VERSION`, so a future/unmapped version either takes no snapshot at all or (if `apply_pending`'s migration loop simply runs zero times) returns `Ok` vacuously; verify which before assuming either. Instead, mirror the precedent already in this file (`test_failed_restore_rolls_back_to_the_safety_snapshot`, `:551-558`, which calls `roll_back` directly because "a reachable post-swap failure needs a fault the public API has no way to inject deterministically") and force a *real* migration failure: build a v12-labeled fixture whose `entries` table **still has** the `locked` column (i.e. relabel `schema_version` to 12 via `UPDATE schema_version SET version = 12` **without** the usual `ALTER TABLE entries DROP COLUMN locked` step the other tests in this file use), so that when `apply_pending`'s v12→v13 migration runs `ALTER TABLE entries ADD COLUMN locked`, it fails deterministically with a duplicate-column error. Snapshot this fixture as `SnapshotTrigger::Manual`, then call `restore_from_snapshot` against it as the target. Assert: (a) `outcome.restored == false`, `outcome.db.is_some()`, and `outcome.error` mentions the rollback (matching `roll_back`'s message), i.e. the failure was caught post-swap and the journal was rolled back to the `PreRestore` safety snapshot; (b) `list_snapshots(&fixture.backups_dir)` still contains a `verified`, `Migration`-triggered snapshot afterward — the attempted-but-failed restore's pre-migration content was not lost.
  - `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml`, then full `cargo test --workspace`.
- Notes: Affected files: `crates/mini-diarium-core/src/db/schema/open.rs`, `crates/mini-diarium-core/src/backup/restore.rs`, `docs/backup-system-redesign-plan.md`. Do not change the "failed pre-migration snapshot aborts the migration" semantics documented in `src-tauri/CLAUDE.md` Gotcha #12 — that asymmetry is intentional and must hold here too.

#### Task A2: Serialize the four IPC-reachable backup commands

- Status: COMPLETED
- Objective: `create_backup_now`, `verify_backup`, `delete_backup`, and `restore_backup` — the four commands the Backups panel invokes directly — cannot run concurrently against the same journal's backups directory, closing the window Finding 4 identifies where `delete_backup`'s filesystem mutation runs outside any lock.
- Steps:
  1. **Scope guard, read first:** `src-tauri/src/commands/backup_triggers.rs` also mutates the backups directory — `snapshot_before_destructive`/`snapshot_after_unlock` call `create_snapshot` while holding `state.db`, and `take_connection_and_snapshot` spawns a **detached thread** that calls `create_snapshot` holding no lock at all. If the new lock below were acquired `db` → `backup_ops` in those paths but `backup_ops` → `db` in the four IPC commands, that is two different lock orderings on the same two locks — a deadlock hazard. This task deliberately does **not** touch `backup_triggers.rs`. The four IPC commands establish `backup_ops` → `db` as their only order; the trigger paths are out of scope and keep running without `backup_ops`. Record this as an accepted residual gap (see Notes), not a silent omission.
  2. Add a new field `pub backup_ops: Mutex<()>` to `DiaryState` (`src-tauri/src/commands/auth/mod.rs`), initialized in `DiaryState::new`.
  3. In `src-tauri/src/commands/backup.rs`, extract testable inner functions mirroring the existing `restore_backup_inner` split (`:231-272`, and see its own doc comment's rationale, "testable command cores" in `docs/best-practices/TAURI_BEST_PRACTICES.md`) for the other three commands: `create_backup_now_inner(state: &DiaryState) -> Result<SnapshotMeta, String>`, `verify_backup_inner(file_name: String, state: &DiaryState) -> Result<SnapshotMeta, String>`, `delete_backup_inner(file_name: String, state: &DiaryState) -> Result<(), String>`. Move each command's existing body into its `_inner` function; the `#[tauri::command]` wrappers become one-line calls into them (`create_backup_now(state) -> create_backup_now_inner(&state)`, etc.), exactly as `restore_backup` already delegates to `restore_backup_inner`.
  4. Acquire `state.backup_ops.lock()` at the top of each of the four `_inner` functions (`create_backup_now_inner`, `verify_backup_inner`, `delete_backup_inner`, `restore_backup_inner`), **before** acquiring `state.db`, and hold the guard for the entire filesystem-mutating portion of each. Map a poisoned lock to `"Journal state lock failed"` (the existing canonical string) for consistency with `journal_paths`.
- Validation:
  - Add tests to `src-tauri/src/commands/backup.rs`'s existing `tests` module (which already constructs `DiaryState` directly via `make_state`/`seeded`, avoiding the `State<T>`-cannot-be-constructed-outside-Tauri problem the existing tests already work around): a shared `assert_serializes_on_backup_ops` helper spawns a thread that holds `state.backup_ops`, signals acquisition, then runs the probe **on its own thread** and proves it blocks structurally — the probe must not complete within a bounded window while the holder still has the lock (a probe that skips the lock completes almost instantly, well inside that window), and must complete promptly once the holder releases. (An earlier boolean-flag-based version of this helper was empirically a false pass: `create_backup_now_inner`'s own I/O routinely took longer than the flag-set window regardless of whether the lock was held, so the assertion passed even with the lock acquisition deleted — caught by deliberately removing the lock and confirming the test failed, then fixed to the block/release structural check.) Covers all **four** commands (`create_backup_now_inner`, `verify_backup_inner`, `delete_backup_inner`, `restore_backup_inner`), not just the two named above.
  - Confirm `restore_backup_inner`'s existing tests still pass unmodified (it already existed; only its lock-acquisition order changes).
  - `cargo test --manifest-path src-tauri/Cargo.toml`, then full `cargo test --workspace`.
- Notes: Affected files: `src-tauri/src/commands/auth/mod.rs`, `src-tauri/src/commands/backup.rs`. This lock is additive — it does not replace the existing `state.db` locking, which still governs whether the journal is unlocked. **Residual gap closed by Task F3:** at the time this task shipped, a lock/unlock/destructive-trigger snapshot (`backup_triggers.rs`) could still filesystem-race with a concurrent `create_backup_now`/`verify_backup`/`delete_backup`/`restore_backup` call, since those triggers intentionally stayed outside `backup_ops` per step 1 above. Task F3 (Milestone F) closed that gap by restructuring the trigger paths to acquire `backup_ops` before `db` (reordering, not just adding, their internal lock nesting) and by giving the detached lock/shutdown worker its own `Arc`-cloned guard, acquired immediately before it writes, since a `MutexGuard` cannot move onto a spawned thread. All backup-directory mutations — the four IPC commands and every trigger path — now serialize on the same `backup_ops` lock, acquired in the same order everywhere.

#### Task A3: Panel-wide frontend mutation lock

- Status: COMPLETED
- Objective: `BackupsPanel.tsx` cannot have two destructive/mutating actions in flight at once from the UI, and a second click while one is in flight never reaches IPC.
- Steps:
  1. In `src/components/backups/BackupsPanel.tsx`, replace the `busyAction`/`busyFile` pair's role in gating with a single `const [panelBusy, setPanelBusy] = createSignal(false)` signal (keep `busyAction`/`busyFile` for their existing label-rendering purpose, e.g. "Restoring…" vs "Verifying…", but they no longer solely gate `disabled`).
  2. Set `panelBusy(true)` at the start of `handleBackUpNow`, `handleVerify`, `handleDelete`, and `handleRestore` (right where each already sets `busyAction`), and `panelBusy(false)` in each `finally` block (or after `load()` completes for `handleRestore`, matching its existing post-refresh sequencing) — `handleDelete` currently has no `finally`; add one.
  3. Change every action button's `disabled` prop (`backups-create-button`, `backups-reveal-button` stays enabled per the report, verify/restore/delete buttons, and the `backups-restore-entries-button` inspect-open button) to also check `panelBusy()`, replacing the per-row `busyFile() === snapshot.file_name` comparisons where they currently under-cover (verify/restore/delete rows must be disabled panel-wide, not just for the acted-on row).
  4. Guard `setInspecting` (the entry point for `BackupInspectDialog`) behind `!panelBusy()` too, since inspection opens a second decrypted connection that should not start while a mutation is in flight.
- Validation:
  - New component test file/section in `BackupsPanel.test.tsx` (or extend the existing suite) using deferred promises: start `handleRestore` (mock `tauri.restoreBackup` with an unresolved promise), then attempt `handleDelete` on a *different* row and assert `tauri.deleteBackup` was never called; repeat for `handleBackUpNow` and `handleVerify` attempted mid-restore.
  - Run `cmd.exe /c bun run test:run` for the affected test file.
- Notes: Affected file: `src/components/backups/BackupsPanel.tsx` and its test file. Coordinate with Milestone D's Task D1 (latest-wins loading) — both touch `load()`'s call sites, but do not conflict: this task changes button `disabled` gating, D1 changes what `load()` does with its result.

#### Task A4: Return immutable safety-snapshot display metadata from restore

- Status: COMPLETED
- Objective: A successful restore's success message always names the safety snapshot's timestamp, even if the subsequent list refresh fails.
- Steps:
  1. In `src-tauri/src/commands/backup.rs`, change `RestoreSummary` (`:180-187`) to add `pub safety_snapshot_created_at: Option<String>` (an ISO timestamp, mirroring `SnapshotMeta::created_at`).
  2. In `restore_backup_inner` (`:262-271`), populate the new field from `outcome.safety_snapshot.as_ref().map(|s| s.created_at.clone())` alongside the existing `safety_snapshot` filename field.
  3. Update the frontend typed wrapper in `src/lib/tauri/backup.ts` (`RestoreSummary` interface) to add the new field.
  4. In `src/components/backups/BackupsPanel.tsx`'s `handleRestore` (`:218-230`), stop deriving `safetySnapshot` by searching `snapshots()`; render the success message directly from `result.safety_snapshot_created_at` when present, falling back to the generic message only when it is genuinely absent (an aborted-before-safety-snapshot case), not merely when the list refresh fails.
- Validation:
  - Add a Rust test in `src-tauri/src/commands/backup.rs`'s test module asserting `restore_backup_inner`'s returned `RestoreSummary.safety_snapshot_created_at` is `Some` and matches the safety snapshot's actual `created_at` after a successful restore.
  - Add a frontend test in `BackupsPanel.test.tsx`: mock `tauri.restoreBackup` to resolve successfully (with `safety_snapshot_created_at` set) and mock the subsequent `tauri.listBackups`/`tauri.getBackupHealth` (invoked by `load()`) to reject; assert the rendered success message still names the safety snapshot's timestamp.
  - `cargo test --workspace`; `cmd.exe /c bun run test:run` for the affected frontend files.
- Notes: Affected files: `src-tauri/src/commands/backup.rs`, `src/lib/tauri/backup.ts`, `src/components/backups/BackupsPanel.tsx`, both test suites.

### Milestone B: Journal And Backup Relocation Integrity

- Status: COMPLETED
- Purpose: Moving a journal with its backups is atomic in the failure windows the report identifies, and relocation never silently discards a differing snapshot based on filename alone. Addresses Findings 2 and 3.
- Exit Criteria: A database-copy or backup-relocation failure during `change_diary_directory` never leaves `backups_dir_slot` pointing at a deleted directory while the source journal is still at its old location; a same-named-but-content-differing snapshot collision during relocation aborts the move with both copies intact rather than discarding one. `cargo test --workspace` passes.

#### Task B1: Stage and verify the destination database copy before relocating backups

- Status: COMPLETED
- Objective: `change_diary_directory_inner` never deletes the old backups directory (via `relocate_backups`) before the destination database copy exists and is verified, closing the failure window where a database-copy failure leaves the journal at its old location with its backup history already moved.
- Steps:
  1. In `src-tauri/src/commands/auth/auth_directory.rs::change_diary_directory_inner`, reorder the operation: (a) keep the existing collision check first (unchanged — it has no side effects and must stay first per the existing regression test and comment at `:41-52`); (b) if `current_db_path.exists()`, copy it to a staged temporary path inside `new_dir_path` (e.g. `new_db_path.with_extension("db.staging")`) and verify the copied byte length matches the source's (same pattern `relocate_backups` already uses for snapshot copies); (c) only after the staged copy is verified, call `relocate_backups` (if `move_backups`); (d) then finalize: rename the staged file to `new_db_path` and remove `current_db_path`; (e) persist config and update `db_path_slot`/`backups_dir_slot` last, as today.
  2. On failure at step (b) (copy or verification fails), remove any partial staged file and return the error — nothing else has been touched, so this is unconditionally safe to retry.
  3. On failure at step (c) (`relocate_backups` fails), remove the staged database file and return the error — the old `diary.db` is still in place and the old backups directory is untouched (per `relocate_backups`'s own atomicity: it does not remove `old_dir` until every file is copied and verified), so this is also safe to retry.
  4. On failure at step (d) (rename or old-file removal fails), this is the one step with a manual-recovery message already used elsewhere in the codebase for similar cases (see `RestoreOutcome::unrecoverable`'s pattern) — return a clear error stating the destination now holds a valid copy of the journal at `new_db_path`, backups have already moved (if requested), and the user should verify the destination and manually remove the stale source before retrying, rather than silently leaving ambiguous state.
- Validation:
  - Add `test_change_diary_directory_leaves_everything_untouched_when_the_staged_db_copy_fails`: force the destination copy to fail (e.g. write a blocking non-directory file at the staged path's parent, or make the destination read-only where portable) and assert the old `diary.db` still exists unchanged, the old backups directory (if any) still exists unchanged, and `db_path_slot`/`backups_dir_slot` still point at the original locations.
  - Add `test_change_diary_directory_leaves_the_old_db_and_backups_untouched_when_relocation_fails_after_staging`: force `relocate_backups` to fail after the database has been successfully staged (reuse the existing "destination cannot be created" trick from `relocate.rs`'s own tests, applied to the backups destination) and assert the old `diary.db` still exists at its original path, the old backups directory still exists with its original snapshots, and state still points at the original locations (no staged artifacts left behind in the new directory either).
  - Confirm all pre-existing tests in `auth_directory.rs`'s `tests` module (`test_change_diary_directory_moves_file`, `test_change_diary_directory_both_have_diary_returns_err`, `test_change_diary_directory_no_diary_yet_updates_path`, `test_change_diary_directory_auto_locks_and_moves_file`, `test_change_directory_moves_backups_when_requested`, `test_change_directory_leaves_backups_behind_when_declined`, `test_change_directory_does_not_relocate_backups_when_the_destination_already_has_a_diary`) still pass unmodified — they assert end-state, not intermediate ordering, so the reorder should not require changing their assertions.
  - `cargo test --manifest-path src-tauri/Cargo.toml`, then full `cargo test --workspace`.
- Notes: Affected file: `src-tauri/src/commands/auth/auth_directory.rs`. Keep the existing doc comment's rationale for why the collision check runs first; add a new comment explaining the stage-then-relocate-then-finalize ordering and which failure window it closes.

#### Task B2: Compare colliding backup filenames by content during relocation

- Status: COMPLETED
- Objective: `relocate_backups` never silently discards a same-named-but-content-differing source snapshot; a genuine collision aborts the relocation with both the source and destination copies intact.
- Steps:
  1. In `crates/mini-diarium-core/src/backup/relocate.rs`, in the copy loop (`:56-76`), when `dest.exists()`: instead of unconditionally `continue`-ing, compare `source` and `dest` content. Byte-length mismatch is a fast pre-check (already need `snapshot.byte_size` for the copy verification). If lengths match, compare content via **chunked streaming** (buffered `Read` in fixed-size chunks, e.g. 64KB, comparing as you go and returning on the first mismatch) rather than a full `fs::read` of both files — snapshots are whole SQLite database files, and `src-tauri/CLAUDE.md` gotcha #6 already notes an image-heavy journal can run to hundreds of MB, so a same-name collision between two such snapshots could otherwise mean holding up to ~1GB in memory for one comparison.
  2. If content is identical, keep the existing behavior: `continue` (skip the redundant copy; the destination's manifest record is equally valid since the bytes match).
  3. If content differs, return an `Err` immediately from `relocate_backups` — before the `remove_dir_all(old_dir)` call at `:84`, which only runs after the copy loop completes successfully, so returning early here already guarantees the source directory is left untouched. The error message must name the colliding file and state that the move was aborted to avoid discarding either snapshot.
  4. Rename the existing test `test_relocate_backups_skips_a_same_name_collision_at_the_destination` to `test_relocate_backups_aborts_on_a_same_name_different_content_collision` and update its assertions: `relocate_backups` now returns `Err`; the source directory (`seeded.backups_dir`) still exists with the original snapshot content intact; the destination file's original (different) content is unchanged.
  5. Add a new test `test_relocate_backups_skips_a_same_name_identical_content_collision`: seed a source snapshot, copy that exact file (byte-for-byte, same name) into the destination directory before calling `relocate_backups`, and assert the call succeeds, the source directory is fully removed, and the destination retains the (correct, identical) snapshot.
- Validation:
  - Both new/updated tests pass.
  - `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml`, then full `cargo test --workspace`.
- Notes: Affected file: `crates/mini-diarium-core/src/backup/relocate.rs`. Update the module doc comment (`:14-34`) — it currently states collisions are silently skipped; correct it to describe the content-comparison behavior.

### Milestone C: Lock-State Security

- Status: COMPLETED
- Purpose: A poisoned path mutex cannot silently drop the live database connection while leaving the frontend showing an unlocked screen. Addresses Finding 5.
- Exit Criteria: `take_connection_and_snapshot` never removes the connection from `DiaryState` unless the paths needed to snapshot it were read successfully; a poisoned `db_path`/`backups_dir` mutex surfaces as an explicit error to the caller instead of being silently mapped to "already locked". `cargo test --workspace` passes.

#### Task C1: Read paths before removing the connection; propagate state-lock errors

- Status: COMPLETED
- Objective: `take_connection_and_snapshot` reads `db_path` and `backups_dir` before taking the connection out of `state.db`, and any lock failure (db, db_path, or backups_dir) is returned as an explicit error rather than collapsed into the "already locked" `None` case.
- Steps:
  1. In `src-tauri/src/commands/backup_triggers.rs`, change `take_connection_and_snapshot`'s signature from `-> Option<mpsc::Receiver<()>>` to `-> Result<Option<mpsc::Receiver<()>>, String>`.
  2. Reorder its body: clone `db_path` and `backups_dir` first (mapping a poisoned lock to an explicit `Err("Journal state lock failed".to_string())`), and only then lock `state.db` and `.take()` the connection. `Ok(None)` still means "nothing to snapshot, journal was already locked" (the `Option` was already `None`); `Err(_)` now means a state lock was poisoned and the connection's fate must not be decided silently.
  3. In `src-tauri/src/commands/auth/mod.rs::lock_diary_inner_with` (`:65-97`), update the call site: remove the current "distinguish already-locked from poisoned" workaround block (`:72-84`, including the `debug_assert!`) since the new signature makes it unnecessary — propagate the `Result` with `?` directly. `Ok(None)` continues to the existing `Ok(false)` no-op-lock path; `Ok(Some(done))` continues to the existing snapshot-wait path; `Err(e)` now bubbles straight up as an `Err` from `lock_diary_inner_with` itself.
  4. Verify (do not assume) that every caller of `lock_diary_inner_with`/`lock_diary_inner`/`auto_lock_diary_if_unlocked` already propagates its `Result` correctly to the frontend as an IPC error — read each call site during this task rather than trusting the existing `Result<bool, String>` signature was already being surfaced everywhere.
- Validation:
  - Add `test_take_connection_and_snapshot_does_not_drop_the_connection_when_db_path_is_poisoned` and `test_take_connection_and_snapshot_does_not_drop_the_connection_when_backups_dir_is_poisoned` in `backup_triggers.rs`'s test module: poison the relevant mutex (spawn a thread that locks it and panics inside the lock, then `.join()` and discard the panic — the standard `std::sync::Mutex` poisoning trick), call `take_connection_and_snapshot`, assert it returns `Err(_)`, and assert `state.db.lock().unwrap().is_some()` is still true afterward (the connection was never taken).
  - Add `test_lock_diary_surfaces_a_poisoned_path_mutex_as_an_error_not_a_silent_lock` in `auth/mod.rs`'s test module: same poisoning setup, call `lock_diary_inner`, assert it returns `Err(_)`.
  - Confirm the existing `test_taking_the_connection_locks_the_journal_before_the_snapshot_finishes` and `test_taking_the_connection_of_a_locked_journal_is_a_no_op` still pass with the new `Result`-wrapped signature (update their call sites to unwrap the `Ok(...)` layer).
  - `cargo test --manifest-path src-tauri/Cargo.toml`, then full `cargo test --workspace`.
- Notes: Affected files: `src-tauri/src/commands/backup_triggers.rs`, `src-tauri/src/commands/auth/mod.rs`, and any other call site of `take_connection_and_snapshot`/`lock_diary_inner_with` touched by the signature change (search with `rg "take_connection_and_snapshot|lock_diary_inner"` under `src-tauri/src/commands/` before starting). Preserve the existing auto-lock event contract (`journal-locking`/`journal-locked`) for the success path — this task only changes the failure path. **User-visible behavior change:** `change_diary_directory_with_auto_lock_inner` (`auth_directory.rs:122`) calls `lock_diary_inner_with(..., LockCompletion::AwaitFileRelease)` and propagates its `Result` with `?`. Previously, a poisoned `db_path`/`backups_dir` mutex there silently dropped the live connection but reported "already locked" (`Ok(false)`), so `change_diary_directory` proceeded with the file move anyway (harmlessly, since the connection really was gone by then). After this fix, the same poisoned-mutex case now surfaces as an `Err` and aborts `change_diary_directory` before any file is touched — correct and desirable, but worth calling out explicitly: a journal-directory change can now fail with a state-lock error in a case where it previously (accidentally) succeeded. **Additional call site found during implementation, not listed above:** `src-tauri/src/lib.rs`'s `on_window_event(CloseRequested)` shutdown handler calls `take_connection_and_snapshot` directly (not through `lock_diary_inner_with`) to take the exit-time snapshot. Updated to `match` on the new `Result`, logging `warn!("Failed to take the exit snapshot: {error}")` on `Err` and proceeding to `window.destroy()` regardless — shutdown must never hang or abort on a poisoned mutex.

### Milestone D: Backup UI State And Inspection Clarity

- Status: COMPLETED
- Purpose: The Backups panel always presents current status, and snapshot inspection meets the approved UX-1 requirement. Addresses Findings 6 and 8.
- Exit Criteria: A slow, stale `load()` response can never overwrite a newer one in `BackupsPanel.tsx`; `BackupInspectDialog.tsx` renders the inspected snapshot's entry count (or an explicit unknown-state fallback) beside its date. `cmd.exe /c bun run test:run` passes for both affected component test suites.

#### Task D1: Latest-wins loading in BackupsPanel

- Status: COMPLETED
- Objective: `load()` in `BackupsPanel.tsx` ignores the result of a stale in-flight call, so a slow initial load cannot overwrite the result of a more recent create/delete/restore refresh (or vice versa).
- Steps:
  1. In `src/components/backups/BackupsPanel.tsx`, add a module-scope-per-instance monotonic counter, e.g. `let loadGeneration = 0;` captured in a closure variable at component scope (not a signal — it does not need to be reactive).
  2. In `load()`, increment and capture `const myGeneration = ++loadGeneration;` at the start, before the `await`. After each `await` resolves (success or error), check `if (myGeneration !== loadGeneration) return;` before calling `setSnapshots`/`setHealth`/`setError`/`setIsLoading(false)` — a newer call has already started, so this response is stale and must not touch state.
- Validation:
  - Add a component test using two deferred promises: start `load()` once (visibility effect), let it stall on an unresolved promise; trigger a second `load()` via a mutation handler (e.g. `handleBackUpNow`) whose promise resolves and completes first; then resolve the *first* (stale) promise with different data; assert the panel's rendered list/health reflects the second (more recently started) call's result, not the first's.
  - Run `cmd.exe /c bun run test:run` for `BackupsPanel.test.tsx`.
- Notes: Affected file: `src/components/backups/BackupsPanel.tsx`. Does not need to coordinate with Task A3's `panelBusy` signal — they solve different problems (button gating vs. stale-response ordering) and can land independently, though both touch the same file so should be reviewed together for merge conflicts if worked in parallel. Implemented with an independent `finally` guard (not a shared early-`return`) so only the current generation clears `isLoading`. Four tests added under `describe('latest-wins loading (Task D1)', ...)` in `BackupsPanel.test.tsx`, one per guard: the two per-branch guards (non-reduced `Promise.all` branch and the `reduced`/pre-auth `listBackupsUnauthenticated` branch — the latter driven by toggling `isVisible` rather than a mutation button, since reduced mode disables every mutation control), the `catch` guard (a stale rejection must not paint an error banner over a fresher successful render), and the `finally` guard (a stale resolution must not clear `isLoading` while a fresher call is still in flight). The shared `deferred<T>()` helper was relocated to module scope (it previously lived nested inside the Task A3 describe block) and extended to expose `reject` alongside `resolve`. Per the plan's mandatory guard-deletion check, each of the four guards was individually deleted and confirmed to fail its own dedicated test (not just the batch of tests as a whole), then restored. All 47 tests in `BackupsPanel.test.tsx` pass. Manually verified in the real dev app (`tauri-agent-dev` skill): taking a backup via "Back up now" (a single sequential create against a fast local backend) correctly refreshed the list with no stale-data artifact. This did not exercise the concurrent stale-vs-fresh race itself — that scenario relies on deferred-promise timing the manual dev app can't easily reproduce, and remains covered by the component tests above plus Milestone E's Task E.3 scenario (c) for a real end-to-end rehearsal.

#### Task D2: Render entry count in snapshot inspection

- Status: COMPLETED
- Objective: `BackupInspectDialog.tsx` shows the inspected snapshot's entry count beside its date, satisfying UX-1 (`docs/backup-system-redesign-plan.md:77-80`: "Panel clearly shows... its date and entry count").
- Steps:
  1. In `src/components/backups/BackupInspectDialog.tsx`'s `entries` phase section (around `:413-421`), add a line rendering `props.snapshot.entry_count` next to or below the existing date line, using the same `entryCount_one`/`entryCount_other` i18n pattern already used in `BackupsPanel.tsx:440-447`, with `'—'` (or an equivalent existing fallback string) when `entry_count` is `null`.
  2. Add `data-testid="backup-inspect-entry-count"` to the new element.
  3. Register the new `data-testid` in the canonical table in `src/CLAUDE.md` under `BackupInspectDialog.tsx`, per root `CLAUDE.md`'s context-files rule ("New `data-testid` used by E2E tests → add to the canonical table in `src/CLAUDE.md`").
- Validation:
  - Add component tests in `BackupInspectDialog.test.tsx`: one asserting the entry count renders correctly for a populated snapshot (`entry_count: 5` renders the pluralized count), one for an empty snapshot (`entry_count: 0`), and one for `entry_count: null` rendering the fallback.
  - Run `cmd.exe /c bun run test:run` for `BackupInspectDialog.test.tsx`.
- Notes: Affected files: `src/components/backups/BackupInspectDialog.tsx`, its test file, `src/CLAUDE.md`. No backend change needed — `SnapshotMeta.entry_count` already exists and is already passed to this component as `props.snapshot`. Implemented exactly as planned; no new i18n keys needed (`entryCount_one`/`entryCount_other` already existed in every locale file). All 11 tests in `BackupInspectDialog.test.tsx` pass. Manually verified in the real dev app: the inspect dialog's entries phase now shows "1 entry" beneath the "Viewing entries from..." line for a snapshot with one entry. Per root `CLAUDE.md`'s docs-sync rule, also updated `website/docs-src/09-backups.md` (per-entry restore section) to mention the dialog now names the snapshot's date and entry count before listing entries, and regenerated the static site (`bun run website:build-static`) so `website/docs/backups/index.html`, `website/docs/index.html`, and `website/sitemap.xml` picked up the change.

### Milestone E: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts, every workstream's own tests pass together, and the full backup recovery rehearsal the report calls for is performed manually.
- Exit Criteria: Intermediate artifacts are removed, all final verification (automated and manual) passes, and the plan status is COMPLETED.

#### Task E.1: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation across Milestones A–D.
- Steps:
  1. Inspect the worktree diff for any temporary debug output, scratch test fixtures, or stray files left over from constructing the mutex-poisoning tests (Task C1) or the failure-injection tests (Tasks A1, B1, B2).
  2. Remove anything not part of the intended final change; keep every test added by this plan (they are permanent regression coverage, not scratch artifacts).
  3. Add a `CHANGELOG.md` entry (or the project's current latest-changelog location) summarizing the fix: restore now preserves a recoverable pre-migration copy across a failed post-restore migration; backup-directory mutations (create/verify/delete/restore) are now serialized in both backend and UI; journal relocation no longer discards a differing same-named backup snapshot or strands backup history ahead of a failed database copy; a poisoned lock during auto-lock no longer silently drops the live connection; the Backups panel no longer shows stale data after a slow refresh; snapshot inspection now shows its entry count.
- Validation: `git status`/`git diff` shows only the intended final changes across all four milestones plus the CHANGELOG entry.
- Notes: Re-confirmed at the start of Milestone E (not re-searched from scratch — this was already verified before the plan was written): `git status` is clean and `git diff 95dd5a7..fd33ee2 --stat` (the span covering exactly Milestones A–D) shows only files the plan's own tasks name, plus one undocumented but legitimate hardening change to `.githooks/pre-commit` (PATH fallback + a clearer error when `bunx` is missing) — not a stray/debug artifact. Nothing to remove. `CHANGELOG.md`'s `[0.7.0]` → `Fixed` section had entries only for Findings 1, 4, 7 (Milestone A); added 5 new bullets for Findings 2, 3, 5, 6, 8 (Milestones B, C, D), each sourced from its own task's Notes in this plan and matching the existing bullets' voice/style. This plan did not originate from a `docs/todo/TODO.md` item, so there is no TODO checkbox to close.

#### Task E.2: Full Automated Verification

- Status: COMPLETED
- Objective: Every workstream's changes pass together, not just in isolation.
- Steps:
  1. Run the full backend test suite.
  2. Run the full frontend test/type-check/lint suite.
  3. Fix any interaction failures between milestones (e.g. a Milestone A test relying on `RestoreSummary`'s old shape that Milestone A itself already updated — should not occur if each task's own validation passed, but confirm here).
- Validation: `cargo test --workspace` passes with zero failures; `cmd.exe /c bun run test:run` passes; `cmd.exe /c bun run type-check` passes; `cmd.exe /c bun run lint` passes.
- Notes: Ran the full Pre-flight Checks list (broader than this task's own Validation line), all green, no cross-milestone interaction failures found:
  - `cargo clippy --workspace --all-targets`: zero warnings.
  - `cargo test --workspace`: 757 passed, 0 failed (261 app crate `mini_diarium_lib` + 454 `mini-diarium-core` + 42 `mini-diarium-crypto`; includes `test_lock_diary_surfaces_a_poisoned_path_mutex_as_an_error_not_a_silent_lock` from Task C1 and the Task A1/B1/B2 tests all present and passing).
  - `cmd.exe /c bun run type-check`: clean (`tsc --noEmit`, no output).
  - `cmd.exe /c bun run lint`: clean (`eslint src --ext .ts,.tsx`, no output).
  - `cmd.exe /c bun run build`: succeeded (`vite build`, 8.24s; pre-existing >500kB chunk-size warning is unrelated to this plan).
  - `cmd.exe /c bun run format`: every file reported `(unchanged)` — no diff produced.
  - `cmd.exe /c bun run test:run`: 964 passed across 94 test files, 0 failed.
  - `backup-inspect-entry-count` confirmed present in `src/CLAUDE.md:187`'s canonical testid table (Task D2).
  - `cmd.exe /c bun run validate:locales`: all 6 non-English locale files OK at 649 keys each, matching `en.ts` — no new i18n keys were introduced beyond the pre-existing `entryCount_one`/`entryCount_other`.
  - No interaction failures found between milestones; each task's own validation held under the combined run.

#### Task E.3: Manual Backup Recovery Rehearsal

- Status: COMPLETED
- Objective: Perform the report's recommended post-implementation rehearsal in the real dev app, since Findings 4 and 6 are UI-timing bugs that unit tests only approximate.
- Steps:
  1. Using the `tauri-agent-dev` skill (or an equivalent manual dev-app session), exercise: (a) a whole-journal restore from an older-schema (pre-migration) snapshot, confirming the success message names the safety snapshot and the journal is on the current schema afterward; (b) a per-entry restore via `BackupInspectDialog`, confirming the entry count now shows; (c) attempting a second destructive backup action (delete, verify, another restore) while a restore is in flight, confirming the UI blocks it rather than queuing a stale-consent action; (d) a relocation failure/retry — e.g. force a backup-relocation failure via a blocked destination directory and confirm the journal and its backups remain usable at the original location, then retry successfully; (e) all three auto-lock paths (idle timer, OS session lock, focus loss) still correctly lock and emit `journal-locked` in the normal (non-poisoned) case.
  2. Record the outcome of each scenario (pass/fail plus any follow-up needed) in this task's Notes before marking it COMPLETED.
- Validation: Manual self-check — each of the 5 scenarios above observed to behave as described, with no regression versus pre-fix behavior for the non-poisoned/non-collision happy paths.
- Notes:
  - **(a) Pre-migration-snapshot restore: not agent-driven.** The running dev app has no user-facing way to produce a pre-migration (pre-`SCHEMA_VERSION`) backup snapshot — every snapshot the live app takes is already on the current schema. Per your decision, this scenario is recorded as covered by Task A1's own automated tests instead of attempting an out-of-band fixture injection: `test_restore_migrates_a_pre_migration_snapshot_to_the_current_schema` and `test_restore_of_a_pre_migration_snapshot_preserves_it_if_the_migration_fails_afterward` (`crates/mini-diarium-core/src/backup/restore.rs`), both passing under the Task E.2 `cargo test --workspace` run. **Not independently re-verified in the live dev app.**
  - **(b) Per-entry restore entry count: PASS, agent-verified.** In the dev app: created a journal, wrote one entry ("Milestone E Rehearsal Entry"), took a manual backup, opened it via **Restore entries…**, entered the credential. The dialog rendered `Viewing entries from Aug 17, 2026, 9:30 PM` followed by `1 entry` (the `backup-inspect-entry-count` element), matching the panel's own "1 entry" count. Confirms Task D2 in the live app, not just its component tests.
  - **(c) Second destructive action blocked mid-restore: PASS, agent-verified.** Clicked **Restore** on one backup row, then — in the same synchronous script tick, before any await could yield — read every mutating control's `disabled` state. Result: `backups-create-button` (Back up now) was disabled, and **every** row's Check/Restore/Delete/Restore entries… buttons were disabled, including the row *not* being restored — confirming Task A3's panel-wide `panelBusy` gate, not just per-row gating. (Tested via disabled-state assertion at the moment of click, per the advisor's suggested cheap-but-honest method, rather than a second click that would only prove the button was inert.) As a side effect, this also re-confirmed Task A4 twice: both restores in this session produced a success message naming the safety snapshot's exact timestamp directly (e.g. "Journal restored to the backup from Aug 17, 2026, 9:30 PM. Your previous state was saved as a new backup from Aug 17, 2026, 9:31 PM...").
  - **(d) Relocation failure/retry: not agent-driven.** A permission-based blocked-destination-directory test is unreliable on Windows against the same user account running the dev app (may silently pass without proving anything). Per your decision, recorded as covered by Task B1's own automated tests instead: `test_change_diary_directory_leaves_everything_untouched_when_the_staged_db_copy_fails` and `test_change_diary_directory_leaves_the_old_db_and_backups_untouched_when_relocation_fails_after_staging` (`src-tauri/src/commands/auth/auth_directory.rs`), both passing under Task E.2's `cargo test --workspace`. **Not independently re-verified in the live dev app.**
  - **(e) Auto-lock paths — idle timer: PASS, agent-verified.** Set **Lock after inactivity** to the minimum (5s) via the real Preferences → Security UI (confirmed the live `preferences` signal updated, not just `localStorage`), then waited 9 seconds issuing **no** CDP calls at all (per the `tauri-agent-dev` skill's own warning that `eval` calls don't count as activity and would falsely suppress the timer). The app correctly returned to the unlock screen — the idle-timer auto-lock path fires correctly in the non-poisoned case.
  - **(e) Auto-lock paths — OS session lock and focus loss: PASS, user-verified.** Handed off with the dev app running, unlocked, `autoLockTimeout` at 900s, `autoLockOnFocusLoss` enabled. User confirmed both: (1) Win+L → unlock Windows again → Mini Diarium showed its own lock screen; (2) minimize/alt-tab away and back → the journal had locked. Both auto-lock paths fire correctly in the normal (non-poisoned) case.
  - **Environment note (not a product bug):** the dev app's Vite server twice reported itself `ready` while its HTTP port silently stopped responding (TCP connections established, no request ever completed) — a stale dependency-optimizer cache issue. Fixed by stopping the session, deleting `node_modules/.vite`, and restarting. Not raised as a finding since it's a local dev-server cache artifact, not application behavior.

### Milestone F: Post-Implementation Recovery Hardening

- Status: COMPLETED
- Purpose: Close the recovery-integrity gaps found after Milestones A–E: incomplete verification, non-retryable partial relocation, and trigger-path snapshot races.
- Exit Criteria: A snapshot cannot be marked verified unless every supported encrypted field can be decrypted; an interrupted relocation leaves only hidden temporary files or complete final snapshots and retries successfully; no trigger or IPC path can mutate one journal's backups directory concurrently; all new fault-injection tests and the full backend suite pass.

#### Task F1: Verify Complete Snapshot Content

- Status: COMPLETED
- Objective: A successful `verify_snapshot` proves that every encrypted value in a supported snapshot can be read with the live master key, while preserving support for empty journals and older supported schemas.
- Steps:
  1. Read the current schema DDL and the read paths for entries, tags, images, metadata, previews, and thumbnail fields before changing verification. Record the supported-schema column matrix in a concise comment near `verify_snapshot`; do not query a column that a pre-migration snapshot cannot contain.
  2. Replace `verify_key_decrypts` in `crates/mini-diarium-core/src/backup/store.rs` with a full read-only verifier. Require the `entries` table for v3+ snapshots, iterate every entry row, and decrypt `title_encrypted` and `text_encrypted`; when their columns exist and are non-NULL, also decrypt `entry_metadata_encrypted` and `preview_enc` using their normal encryption contexts.
  3. When supported tables exist, iterate and decrypt every `tags.name_encrypted`, `images.data_encrypted`, and non-NULL `images.thumbnail_data` value with the same contexts used by the normal database read helpers. Structural query failures must return verification failure, not be converted into the empty-journal case. Keep the existing auth-slot and schema-version checks.
  4. Preserve the valid empty-journal case only when the expected tables exist but contain no encrypted rows. Keep verification read-only and do not expose ciphertext, key material, entry content, or filesystem paths in errors or logs.
- Validation:
  - Add `test_verification_rejects_corruption_in_a_non_first_encrypted_entry_field` after snapshot creation and prove `verify_snapshot` fails.
  - Add `test_verification_checks_tags_metadata_previews_images_and_thumbnails` when the relevant schema columns/tables exist.
  - Add `test_verification_rejects_a_missing_required_entries_table` and prove verification fails rather than passing as an empty journal.
  - Keep `test_verification_accepts_a_journal_with_no_encrypted_content` passing.
  - Run `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml backup::store` and `cargo test --workspace`.
- Notes: Affected files: `crates/mini-diarium-core/src/backup/store.rs` (verifier rewrite + 3 new tests), `crates/mini-diarium-core/src/backup/restore_entries.rs` (`has_table` promoted from private to `pub(crate)`, moved beside `has_column`'s sibling doc reference). Corrected against current source before implementation: the images table's encrypted-bytes column is `images.data`, not `images.data_encrypted` (no such column exists) — used `data` per the column matrix now documented in `verify_key_decrypts`'s doc comment. Reused `crate::backup::inspect::has_column` and the newly-promoted `has_table` rather than re-deriving `sqlite_master`/`PRAGMA table_info` queries; reused `crate::format::decrypt_utf8`/`decrypt_bytes` (no new cryptography). `verify_key_decrypts` is not part of the public API surface (only `verify_snapshot_file` is documented in `crates/mini-diarium-core/API.md`), so no API-contract update was needed. All 4 named tests added and passing: `test_verification_rejects_corruption_in_a_non_first_encrypted_entry_field`, `test_verification_checks_tags_metadata_previews_images_and_thumbnails` (covers metadata/preview/tags/image-data/thumbnail via per-column corruption of a real snapshot with all fields populated), `test_verification_rejects_a_missing_required_entries_table`, and the pre-existing `test_verification_accepts_a_journal_with_no_encrypted_content` kept green. `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml backup::store`: 21 passed, 0 failed. `cargo test --workspace`: all green (see Task F4 for the final combined count).

#### Task F2: Make Relocation Crash-Safe And Retryable

- Status: COMPLETED
- Objective: A power loss, I/O failure, or interrupted relocation cannot leave a partial `backup-*.db` at the destination or make a retry fail on a false content collision.
- Steps:
  1. In `crates/mini-diarium-core/src/backup/relocate.rs`, replace direct `fs::copy(source, dest)` with a per-file staged copy in `new_dir` using a name that cannot pass the snapshot listing filter, such as `relocating-{file_name}.tmp`. Remove a stale temporary for that file only after confirming it is not a final snapshot.
  2. After copying, compare the staged file against the source using the existing chunked comparison, fsync the staged file, atomically rename it to the final `backup-*.db` name, then fsync the destination directory where supported. Move or expose narrowly scoped store helpers instead of duplicating platform-specific fsync logic.
  3. On a copy, comparison, sync, or rename failure, remove only the staged temporary and return an error. Do not delete source snapshots, destination final snapshots, or either manifest. A crash before final rename leaves a non-listed temporary; a crash after final rename leaves a complete file that a retry recognizes as byte-identical.
  4. Keep the existing differing-content collision behavior: a complete final file with the same name but different bytes aborts the relocation and preserves both copies. Do not merge or save manifests until every source snapshot has a complete destination counterpart.
  5. Update the relocation module documentation to state the exact retry guarantees and the treatment of stale temporary files.
- Validation:
  - Add a deterministic failure-injection seam for the copy/finalize phases if direct filesystem faults cannot reliably reach each phase on all platforms. The seam must be test-only or private to the core crate.
  - Add `test_relocate_backups_failed_staged_copy_leaves_no_final_file_and_retries`: source remains untouched, no final destination snapshot exists, and a retry succeeds.
  - Add `test_relocate_backups_resumes_from_a_complete_final_file_before_manifest_save`: retry recognizes the file as identical, completes the relocation, and preserves its manifest metadata.
  - Add `test_relocate_backups_ignores_and_replaces_stale_temporary_files`.
  - Keep the existing same-name identical and differing-content collision tests passing.
  - Run `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml backup::relocate` and `cargo test --workspace`.
- Notes: Affected files: `crates/mini-diarium-core/src/backup/relocate.rs` (new `relocate_one_file` staged-copy helper, `RELOCATE_TEMP_PREFIX`/`RELOCATE_TEMP_SUFFIX` constants, updated module doc), `crates/mini-diarium-core/src/backup/store.rs` (`fsync_file`/`fsync_dir` widened from private to `pub(crate)` and reused directly — no duplicated Windows/Unix branching). `manifest.json` privacy rules and `manifest::save` itself were left untouched, exactly as scoped; only *when* it's called changed (already true pre-F2 — confirmed unchanged). No test-only fault-injection seam was needed: all 3 new tests use real filesystem faults (a directory occupying the staged temp name) or real prior-state reconstruction (pre-placing a byte-identical final file / a stale garbage temp file), matching the existing collision tests' own style, per the plan's own preference for real faults over a new seam. All 3 named tests added and passing: `test_relocate_backups_failed_staged_copy_leaves_no_final_file_and_retries`, `test_relocate_backups_resumes_from_a_complete_final_file_before_manifest_save` (redesigned during implementation from directly pre-placing a manifest-less final file — which, given the existing dest-wins-on-collision manifest-merge semantics, legitimately downgrades the entry to `Adopted` and is not a bug — to simulating a crash *after* a first fully successful relocation, recreating `old_dir` with byte-identical content, so the resumed retry's manifest-preservation assertions test a scenario the design actually guarantees), `test_relocate_backups_ignores_and_replaces_stale_temporary_files`. All pre-existing same-name collision tests kept passing. `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml backup::relocate`: 9 passed, 0 failed. `cargo test --workspace`: all green.

#### Task F3: Serialize Trigger-Path Snapshots

- Status: COMPLETED
- Objective: Backup snapshots triggered by unlock, lock, shutdown, and destructive operations cannot race create, verify, delete, or restore operations for the same journal.
- Steps:
  1. Before editing, inspect every caller of `snapshot_after_unlock`, `snapshot_before_destructive`, `take_connection_and_snapshot`, and `snapshot_detached`, and document the resulting lock order in `backup_triggers.rs`. Confirm that no path holds `db` while waiting for `backup_ops`.
  2. Change synchronous trigger paths so they acquire `backup_ops` before acquiring `db`, retain it through `create_snapshot`, and use the canonical poisoned-lock error or warning behavior appropriate to their existing failure semantics. Do not change the intentional rule that failed non-migration snapshots are logged and do not block the user operation.
  3. In `take_connection_and_snapshot`, acquire `backup_ops` before taking `db`, then release it after the connection is removed. In the detached worker, acquire `backup_ops` immediately before calling `create_snapshot` and retain it until the snapshot completes. This makes a pending IPC operation fail its unlocked-state check after the lock path takes the connection, while the worker waits for any already-running IPC filesystem mutation to finish.
  4. Keep `backup_ops` before `db` in every IPC command and trigger path. Do not hold `db_path` or `backups_dir` mutexes across another `DiaryState` mutex; retain the poisoned-path fix from Milestone C.
  5. Remove the accepted-residual-gap wording from Task A2's notes and update the relevant backend guidance to state that all backup-directory mutations are serialized.
- Validation:
  - Extend the structural `backup_ops` blocking test helper with `test_backup_ops_serializes_unlock_and_destructive_triggers` and `test_backup_ops_serializes_detached_lock_snapshot`, proving each waits while another operation owns `backup_ops`.
  - Add `test_lock_snapshot_waits_for_delete_after_the_unlocked_check`: pause `delete_backup_inner` after its unlocked check, request a lock snapshot, then prove the snapshot starts only after delete releases `backup_ops`, with no manifest corruption or deadlock.
  - Add `test_trigger_and_ipc_backup_ops_lock_order_completes_after_release` using bounded channels/timeouts.
  - Run `cargo test --manifest-path src-tauri/Cargo.toml commands::backup commands::backup_triggers` and `cargo test --workspace`.
- Notes: Affected files: `src-tauri/src/commands/auth/mod.rs` (`backup_ops` widened from `Mutex<()>` to `Arc<Mutex<()>>` so the detached worker can clone a handle onto its own thread; field doc comment rewritten to drop the residual-gap wording; `assert_serializes_on_backup_ops` moved here into `test_helpers`, shared with `commands::backup`'s own Task A2 tests, since Task F3's tests needed the exact same structural helper against the same lock), `src-tauri/src/commands/backup_triggers.rs` (module doc extended with the lock-order rule; `snapshot_after_unlock`/`snapshot_before_destructive` reordered to acquire `backup_ops` before their existing `db` lock — a real nesting change, not just an added line; `take_connection_and_snapshot` acquires `backup_ops` before its `db_path`→`backups_dir`→`db` sequence and drops it once the connection is out of `state.db`; `snapshot_detached` gained a `backup_ops: Arc<Mutex<()>>` parameter and acquires its own guard immediately before `create_snapshot`, poisoned-lock case logged and skipped per the existing best-effort asymmetry), `src-tauri/src/commands/backup.rs` (removed its private copy of `assert_serializes_on_backup_ops`, now calls the shared one). `docs/backup-adversarial-review-fixes-plan.md` Task A2's Notes updated to record the gap as closed (see Task A2 above) instead of accepted.
  - Call-site audit (step 1) confirmed empirically, not just by inspection: all 8 call sites of the 3 non-internal trigger functions (`auth_core.rs:257,554` for `snapshot_after_unlock`; `auth_core.rs:408`, `auth_directory.rs:159`, `auth_slots.rs:202`, `plugin.rs:43` for `snapshot_before_destructive`; `auth/mod.rs:85`, `lib.rs:121` for `take_connection_and_snapshot`) hold zero `DiaryState` locks at the call — the two `snapshot_after_unlock` sites explicitly `drop(db_state)` first (`auth_core.rs:249`, `:546`), and every other site never held one to begin with. `snapshot_detached` is only ever called internally from `take_connection_and_snapshot`. No path holds `db` while waiting for `backup_ops`.
  - All 4 named tests added and passing: `test_backup_ops_serializes_unlock_and_destructive_triggers`, `test_backup_ops_serializes_detached_lock_snapshot` (calls `snapshot_detached` directly rather than through `take_connection_and_snapshot`, so it isolates the detached worker's *own* guard acquisition from the synchronous hand-off's — the two turned out not to be interchangeable, see the verification note below), `test_lock_snapshot_waits_for_delete_after_the_unlocked_check` (uses a manually-held `backup_ops` guard as a deterministic stand-in for "`delete_backup_inner`, past its unlocked check", then performs the real `crate::backup::delete_snapshot` call while still holding it, rather than adding a production pause hook to `delete_backup_inner`), `test_trigger_and_ipc_backup_ops_lock_order_completes_after_release` (plain, unscoped `thread::spawn` + bounded `recv_timeout`, not a scoped join, so a real lock-order regression would fail the test instead of hanging the process).
  - **Verification per the user's request:** each of the 4 new `backup_ops` acquisitions (`snapshot_after_unlock`, `snapshot_before_destructive`, `take_connection_and_snapshot`'s synchronous guard, `snapshot_detached`'s own guard) was individually removed and confirmed to fail its dedicated test, then restored. One false-pass was caught and fixed during this process, mirroring Task A2's own precedent: removing `take_connection_and_snapshot`'s synchronous guard alone did **not** fail `test_backup_ops_serializes_detached_lock_snapshot` as originally written, because that test drove the whole pipeline through `take_connection_and_snapshot`, and the still-present detached-worker lock alone was sufficient to make the probe wait — the synchronous guard's own removal was invisible to it. Fixed by rewriting that test to call `snapshot_detached` directly, which isolates the detached worker's guard from the synchronous hand-off and does fail when *its own* lock is removed (confirmed). A second, unrelated flaw surfaced in `test_lock_snapshot_waits_for_delete_after_the_unlocked_check`'s original final assertion (checking that the deleted file's *name* was not relisted): same-second snapshot naming can legitimately reuse a just-deleted name regardless of lock correctness, so the assertion was replaced with a manifest-readability + count check that does not depend on name identity.
  - `cargo test --manifest-path src-tauri/Cargo.toml commands::backup commands::backup_triggers`: 38 passed, 0 failed (run as two separate substring-filtered invocations; `commands::backup` alone already includes `commands::backup_triggers` and `commands::backup_inspect` as prefix matches). `cargo test --workspace`: all green.
  - `MutexGuard` was indeed impossible to move into the detached thread (confirmed by the compiler when first attempted); the worker acquires its own guard via `Arc::clone`. The per-journal mutex was not replaced with a global lock — `backup_ops` remains one field on the per-journal `DiaryState`.

#### Task F4: Cleanup And Final Verification

- Status: COMPLETED
- Objective: Leave no test seams, stale documentation, or unverified recovery claims after Milestone F.
- Steps:
  1. Inspect the final diff and remove only temporary fault-injection code, fixtures, logs, and generated artifacts that are not permanent regression coverage.
  2. Update `CHANGELOG.md` with the completed hardening behavior. Update `website/docs-src/09-backups.md` only if the user-visible verification or recovery behavior changes; regenerate static documentation when it does.
  3. Update this plan's status ledger, Task A2 residual-gap note, Milestone F task statuses, and final verification notes with exact command results. Do not mark the plan complete until all validations pass.
- Validation:
  - `cargo clippy --workspace --all-targets`
  - `cargo test --workspace`
  - `cmd.exe /c bun run type-check`
  - `cmd.exe /c bun run lint`
  - `cmd.exe /c bun run test:run`
  - `cmd.exe /c bun run validate:locales`
  - `git diff --check` and `git status --short`
- Notes:
  - **Step 1 (fault-injection inspection):** none of F1–F3's new tests use a test-only fault-injection seam — every one drives a real filesystem fault (a directory occupying a temp/staged path) or reconstructs a real prior-state scenario (a pre-placed byte-identical final file, a stale garbage temp file, a manually-held real lock guard performing a real deletion). Nothing to remove.
  - **Step 2 (docs):** `CHANGELOG.md` gained 3 new `[0.7.0] - Unreleased` → `### Fixed` bullets for F1/F2/F3 under the existing TODO-0098 heading, following the same "(post-implementation review of TODO-0098, Milestone F)" citation style the earlier adversarial-review bullets use. `website/docs-src/09-backups.md`'s **Check** bullet was updated — F1 changes what re-checking an existing "verified" backup can now report (previously-undetected corruption in a non-title/tag field now surfaces as a failed check), which is user-visible — then regenerated via `bun run website:build-static` (run through the PowerShell tool per root `CLAUDE.md`); `git diff website/docs/backups/index.html` confirmed only the intended paragraph changed, everything else in the full rebuild reproduced byte-identical.
  - **Step 3 (status ledger):** Task A2's Notes and Milestone F's own task statuses updated above; this Task F4 entry and the pre-flight checklist below are the final piece.
  - **Final verification, all green:**
    - `cargo clippy --workspace --all-targets`: zero warnings (one `clippy::type_complexity` warning surfaced on `verify_key_decrypts`'s new query row type during this pass and was fixed with a named `EntryVerificationRow` type alias in `store.rs`, then reconfirmed clean).
    - `cargo fmt --check`: clean after running `cargo fmt` once (F1–F3's new code had several long lines `rustfmt` wanted reflowed — applied, then re-verified `--check` passes and `cargo clippy`/`cargo test` were rerun on the reformatted code).
    - `cargo test --workspace`: 767 passed, 0 failed (265 app crate `mini_diarium_lib` + 460 `mini-diarium-core` + 42 `mini-diarium-crypto`), rerun a final time after the `cargo fmt` pass — still all green.
    - `cmd.exe /c bun run type-check`: clean (`tsc --noEmit`, no output).
    - `cmd.exe /c bun run lint`: clean (`eslint src --ext .ts,.tsx`, no output).
    - `cmd.exe /c bun run build`: succeeded (`vite build`, 34.67s; the pre-existing >500kB chunk-size warning is unrelated to this plan).
    - `cmd.exe /c bun run format`: every `src/**/*.{ts,tsx,css}` file reported `(unchanged)` — this milestone touched no frontend source.
    - `cmd.exe /c bun run test:run`: 964 passed across 94 test files, 0 failed — matching Milestone E's own baseline, confirming no frontend regression from Rust-only changes.
    - `PreferencesOverlay.integration.test.tsx` (the previously-flaky file the frontend suite had a history of timing out in): re-ran once in isolation after the full suite — 2 passed, 0 failed, no timeout. Not flaky this round.
    - `cmd.exe /c bun run validate:locales`: all 6 non-English locale files OK at 649 keys each, matching `en.ts` — Milestone F introduced no new i18n keys.
    - `git diff --check`: exit 0 (only pre-existing LF→CRLF line-ending advisories on the 3 touched Rust files, not whitespace errors).
    - `git status --short`: exactly the 10 files this milestone touched (`CHANGELOG.md`, `docs/backup-adversarial-review-fixes-plan.md`, `crates/mini-diarium-core/src/backup/{relocate,restore_entries,store}.rs`, `src-tauri/src/commands/{auth/mod,backup,backup_triggers}.rs`, `website/docs-src/09-backups.md`, `website/docs/backups/index.html`); a transient untracked `crates/mini-diarium-core/test_legacy_backups_migration_v1_v3/` directory observed once during the test-suite churn was gone by the next `git status` check and is not part of this diff.

## Approval Gate

Milestone F implementation must not start until the user approves this updated plan. **Satisfied 2026-08-18**: the user directly instructed execution of this plan's Milestone F (with 13 corrections to the plan text verified against current source first); see Metadata.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [x] `cargo clippy --workspace` passes with zero warnings
- [x] `cargo test --workspace` passes with zero failures
- [x] `cmd.exe /c bun run type-check` passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run build` succeeds
- [x] `cmd.exe /c bun run format` succeeds
- [x] New `data-testid` (`backup-inspect-entry-count`) added to `src/CLAUDE.md`'s canonical table (Task D2)
- [x] No new i18n keys need adding beyond reusing `entryCount_one`/`entryCount_other` (confirm during Task D2 — add to every locale file via `bun run validate:locales` if any new key was actually introduced)
- [x] Milestone F verification commands pass and the plan status is updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions (none were needed — the report's suggested fixes and this plan's assumptions cover every design choice).
- [x] Tasks are grouped into milestones matching the report's four independent workstreams, the original cleanup/verification milestone, and the pending post-implementation hardening milestone.
- [x] Every task has concrete steps (file paths, function names, line-anchored where the code was read) and validation (named tests plus the exact test commands).
- [x] Every milestone has exit criteria broader than a single task.
- [x] Cleanup and final verification are included for the pending work (Task F4).
- [x] The plan avoids vague actions — every task names the exact function/file/lines and the exact new test names to add.
- [x] The plan can be executed by a coding agent without reading the original conversation — the Finding Verification section reproduces the necessary evidence inline.
- [x] Not a dialog/interaction *feature* requiring a fresh UX-GATE sign-off — this plan fixes bugs in already-approved UX-1/UX-2 flows (`docs/backup-system-redesign-plan.md`'s Milestone 4 UX Gate) without changing their approved interaction shape, so no new UX-GATE sign-off is required. Task D2 explicitly implements the wording of an already-signed-off requirement (UX-1) rather than proposing new UI.
- [x] No new Tauri WebView navigation/link/new-window behavior is introduced, so no PLATFORM-VERIFY step is needed.
- [x] Milestone F has no unanswered design questions. The chosen staged-copy design preserves the prior differing-content collision safeguard, and its explicit `backup_ops` order resolves the residual race without a global lock.
- [x] Milestone F adds no dialog, interaction, WebView navigation, capability, network, cryptography, or schema behavior. UX-GATE and PLATFORM-VERIFY are not required.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes, including the specific named tests listed in each task's Validation section — a green `cargo test --workspace` alone does not confirm those specific tests were added; check by name.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Completed historical order: Milestones A, B, C, D, E, then F (F1, F2, F3, F4 in sequence). F1 and F2 were core-only and independent of each other; F3 followed its own lock-order inspection as its first step, per plan.
