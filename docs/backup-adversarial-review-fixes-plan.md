# Backup System Adversarial Review — Fixes

## Metadata

- Plan Status: IN PROGRESS
- Created: 2026-08-16
- Last Updated: 2026-08-17
- Owner: Coding agent
- Approval: Approved by user to start Milestone A (2026-08-16)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Close all 8 findings from `docs/reports/2026-08-16-backup-system-redesign-adversarial-review.md` (TODO-0098 backup-system redesign). Every finding was independently re-verified against the current source on `todo-0098-backups-panel` before this plan was written — see the "Finding Verification" section below. The plan mirrors the report's four independent workstreams (A–D) so each can be committed separately, per the report's own "Implementation Organization" guidance.

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

## Non-Goals

- No new backup features (retention policy changes, new snapshot triggers, new UI surfaces beyond what each finding requires).
- No rename/restructuring of the backup subsystem beyond what each fix needs.
- Not building a generic optimistic-concurrency framework — the mutation lock is scoped to the Backups panel and its backend commands only.
- Not addressing anything in the report explicitly excluded from its own findings (the report already excluded low-priority documentation/wording issues).

## Assumptions

- The four workstreams (A: Restore Integrity, B: Relocation Integrity, C: Lock-State Security, D: UI State & Inspection Clarity) are implemented and committed in the report's recommended order: A, B, C, D, then the final rehearsal — because A and D share the mutation-lock/UI surface and B/C are independent backend-only changes.
- `cargo test --workspace` and the frontend test/lint/type-check suite are the primary automated gates; the manual rehearsal in the Final Verification section is required in addition because several findings (4, 6) are concurrency/timing bugs that unit tests approximate with deferred promises but a real dev-app run is the only way to see the panel behave correctly end to end.
- Fixing Finding 3 by aborting relocation on a genuine content-differing collision (rather than allocating a unique destination filename) is preferred: it is the simpler, safer of the report's two suggested fixes, and same-name collisions are already documented as a rare edge case (interrupted move / manual recovery), so aborting the whole relocation with a clear error is an acceptable UX cost for a case expected to happen close to never.
- Fixing Finding 2 by staging the destination database copy (verify byte-for-byte, keep the source until the copy is verified) is preferred over a fully resumable multi-step protocol, because it removes the specific failure window the finding identifies (relocated backups + un-copied database) without introducing new persisted "resume" state.

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
- Notes: Affected files: `src-tauri/src/commands/auth/mod.rs`, `src-tauri/src/commands/backup.rs`. This lock is additive — it does not replace the existing `state.db` locking, which still governs whether the journal is unlocked. **Accepted residual gap:** a lock/unlock/destructive-trigger snapshot (`backup_triggers.rs`) can still filesystem-race with a concurrent `create_backup_now`/`verify_backup`/`delete_backup`/`restore_backup` call, since those triggers intentionally stay outside `backup_ops` per step 1. This is a narrower fix than "no two backup-directory-mutating operations can ever race" — it closes the concrete window Finding 4 identifies (the Backups panel's own four actions racing each other), not every theoretical racer. Folding the trigger paths in would require a separate task that first resolves the lock-ordering conflict (e.g. by having the triggers acquire `backup_ops` without holding `db`, which likely requires restructuring `snapshot_before_destructive`/`snapshot_after_unlock` to release `db` before the snapshot call — out of scope here).

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

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts, every workstream's own tests pass together, and the full backup recovery rehearsal the report calls for is performed manually.
- Exit Criteria: Intermediate artifacts are removed, all final verification (automated and manual) passes, and the plan status is COMPLETED.

#### Task E.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation across Milestones A–D.
- Steps:
  1. Inspect the worktree diff for any temporary debug output, scratch test fixtures, or stray files left over from constructing the mutex-poisoning tests (Task C1) or the failure-injection tests (Tasks A1, B1, B2).
  2. Remove anything not part of the intended final change; keep every test added by this plan (they are permanent regression coverage, not scratch artifacts).
  3. Add a `CHANGELOG.md` entry (or the project's current latest-changelog location) summarizing the fix: restore now preserves a recoverable pre-migration copy across a failed post-restore migration; backup-directory mutations (create/verify/delete/restore) are now serialized in both backend and UI; journal relocation no longer discards a differing same-named backup snapshot or strands backup history ahead of a failed database copy; a poisoned lock during auto-lock no longer silently drops the live connection; the Backups panel no longer shows stale data after a slow refresh; snapshot inspection now shows its entry count.
- Validation: `git status`/`git diff` shows only the intended final changes across all four milestones plus the CHANGELOG entry.
- Notes: This plan did not originate from a `docs/todo/TODO.md` item, so there is no TODO checkbox to close. If the user wants this remediation tracked as a TODO going forward, that is a separate follow-up, not part of this cleanup task.

#### Task E.2: Full Automated Verification

- Status: TO BE DONE
- Objective: Every workstream's changes pass together, not just in isolation.
- Steps:
  1. Run the full backend test suite.
  2. Run the full frontend test/type-check/lint suite.
  3. Fix any interaction failures between milestones (e.g. a Milestone A test relying on `RestoreSummary`'s old shape that Milestone A itself already updated — should not occur if each task's own validation passed, but confirm here).
- Validation: `cargo test --workspace` passes with zero failures; `cmd.exe /c bun run test:run` passes; `cmd.exe /c bun run type-check` passes; `cmd.exe /c bun run lint` passes.
- Notes: None.

#### Task E.3: Manual Backup Recovery Rehearsal

- Status: TO BE DONE
- Objective: Perform the report's recommended post-implementation rehearsal in the real dev app, since Findings 4 and 6 are UI-timing bugs that unit tests only approximate.
- Steps:
  1. Using the `tauri-agent-dev` skill (or an equivalent manual dev-app session), exercise: (a) a whole-journal restore from an older-schema (pre-migration) snapshot, confirming the success message names the safety snapshot and the journal is on the current schema afterward; (b) a per-entry restore via `BackupInspectDialog`, confirming the entry count now shows; (c) attempting a second destructive backup action (delete, verify, another restore) while a restore is in flight, confirming the UI blocks it rather than queuing a stale-consent action; (d) a relocation failure/retry — e.g. force a backup-relocation failure via a blocked destination directory and confirm the journal and its backups remain usable at the original location, then retry successfully; (e) all three auto-lock paths (idle timer, OS session lock, focus loss) still correctly lock and emit `journal-locked` in the normal (non-poisoned) case.
  2. Record the outcome of each scenario (pass/fail plus any follow-up needed) in this task's Notes before marking it COMPLETED.
- Validation: Manual self-check — each of the 5 scenarios above observed to behave as described, with no regression versus pre-fix behavior for the non-poisoned/non-collision happy paths.
- Notes: None yet — fill in after the rehearsal is run.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] `cargo clippy --workspace` passes with zero warnings
- [ ] `cargo test --workspace` passes with zero failures
- [ ] `cmd.exe /c bun run type-check` passes
- [ ] `cmd.exe /c bun run lint` passes
- [ ] `cmd.exe /c bun run build` succeeds
- [ ] `cmd.exe /c bun run format` succeeds
- [ ] New `data-testid` (`backup-inspect-entry-count`) added to `src/CLAUDE.md`'s canonical table (Task D2)
- [ ] No new i18n keys need adding beyond reusing `entryCount_one`/`entryCount_other` (confirm during Task D2 — add to every locale file via `bun run validate:locales` if any new key was actually introduced)
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions (none were needed — the report's suggested fixes and this plan's assumptions cover every design choice).
- [x] Tasks are grouped into milestones matching the report's four independent workstreams, plus a final cleanup/verification milestone.
- [x] Every task has concrete steps (file paths, function names, line-anchored where the code was read) and validation (named tests plus the exact test commands).
- [x] Every milestone has exit criteria broader than a single task.
- [x] Cleanup and final verification are included (Milestone E).
- [x] The plan avoids vague actions — every task names the exact function/file/lines and the exact new test names to add.
- [x] The plan can be executed by a coding agent without reading the original conversation — the Finding Verification section reproduces the necessary evidence inline.
- [x] Not a dialog/interaction *feature* requiring a fresh UX-GATE sign-off — this plan fixes bugs in already-approved UX-1/UX-2 flows (`docs/backup-system-redesign-plan.md`'s Milestone 4 UX Gate) without changing their approved interaction shape, so no new UX-GATE sign-off is required. Task D2 explicitly implements the wording of an already-signed-off requirement (UX-1) rather than proposing new UI.
- [x] No new Tauri WebView navigation/link/new-window behavior is introduced, so no PLATFORM-VERIFY step is needed.
- [x] Reviewed by `advisor` before approval. Four blocking issues were found and fixed in this version: (1) Task A2 originally risked a lock-ordering deadlock between the new `backup_ops` lock and `backup_triggers.rs`'s existing `db`-holding snapshot paths — fixed by scoping `backup_ops` to the four IPC commands only and narrowing Milestone A's exit criteria accordingly, with the residual gap recorded explicitly in Task A2's Notes. (2) Task A1's original failure-injection method (an out-of-range schema version) was self-contradictory with `migrate_with_pre_migration_snapshot`'s own guard condition — replaced with a deterministic duplicate-column `ALTER TABLE` failure, mirroring the file's existing `roll_back`-direct-call precedent. (3) Task A1 originally said to "extend" an existing test assertion that asserts the opposite of this task's own behavior change — fixed to explicitly delete and invert it, plus updated the corresponding note in `docs/backup-system-redesign-plan.md`. (4) Task A2's originally-specified test called `#[tauri::command]` functions directly, which cannot be constructed outside a Tauri app (the file's own existing tests already document this constraint) — fixed by extracting `_inner` functions mirroring the existing `restore_backup_inner` pattern. Two non-blocking suggestions were also incorporated: B2 uses chunked streaming comparison instead of a full-file read (snapshots can run to hundreds of MB), and C1 documents the user-visible behavior change where a poisoned path mutex now correctly aborts `change_diary_directory` instead of silently proceeding.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes, including the specific named tests listed in each task's Validation section — a green `cargo test --workspace` alone does not confirm those specific tests were added; check by name.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Recommended execution order: Milestone A, then B, then C, then D, then E — matching the report's "Recommended Order" section. B and C have no dependency on A and could be reordered ahead of A if useful, but do not start D before A, since D's exit criteria assumes A3's `panelBusy` groundwork exists in the same file it edits (coordinate to avoid merge conflicts even though the two tasks are logically independent).
