//! Where snapshots are taken from, and on which thread.
//!
//! The engine itself lives in `mini-diarium-core`; this module is the app-side wiring that
//! decides *when* it runs. Three rules shape everything here:
//!
//! 1. **A snapshot precedes the risky write, it does not follow it.** Destructive commands
//!    snapshot before they touch the journal, and the schema migration snapshot is taken
//!    inside `db::schema::open` before `apply_pending`.
//! 2. **A snapshot never blocks the UI.** `VACUUM INTO` scales with journal size, and an
//!    image-heavy journal is hundreds of megabytes. Anything on the lock or shutdown path
//!    runs on a background thread.
//! 3. **Every path here serializes on `state.backup_ops`, acquired before `db`.** The same
//!    lock the four IPC backup commands (`commands/backup.rs`) take, in the same order, so a
//!    trigger-path snapshot and an IPC-reachable backup operation can never mutate one
//!    journal's backups directory at the same time. The synchronous triggers
//!    (`snapshot_after_unlock`, `snapshot_before_destructive`) hold the guard for their whole
//!    call. `take_connection_and_snapshot` holds it only for the synchronous hand-off — long
//!    enough to guarantee no IPC command's directory mutation is in flight when it removes the
//!    connection from `state.db` — then releases it; the detached worker
//!    (`snapshot_detached`) acquires its own guard, cloned via `Arc`, immediately before
//!    `create_snapshot` runs, since a `MutexGuard` cannot move onto a spawned thread. No path
//!    here ever holds `db` while waiting for `backup_ops` — see Task F3 in
//!    `docs/backup-adversarial-review-fixes-plan.md` for the call-site audit that established
//!    this is safe.
//!
//! Failure semantics are deliberately asymmetric. A failed snapshot is logged and ignored
//! everywhere except before a schema migration, where the core aborts the migration instead
//! — a missing backup is recoverable, a half-migrated journal is not.

use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use log::{info, warn};

use crate::backup::{BackupContext, SnapshotTrigger};
use crate::commands::auth::DiaryState;
use crate::db::DatabaseConnection;

/// How long shutdown waits for the on-exit snapshot before letting the app close.
///
/// Exceeding it is not a failure to report: the process exits, the in-flight `VACUUM INTO`
/// dies with it leaving only a `.tmp` file (swept on the next run), and the pre-existing
/// snapshot set is untouched. Delaying shutdown further would be the worse outcome.
pub(crate) const SHUTDOWN_SNAPSHOT_BUDGET: Duration = Duration::from_secs(5);

/// Takes a snapshot on the calling thread, logging rather than propagating failure.
///
/// Use this for triggers that must complete *before* the operation continues — the
/// destructive commands. The cost is bounded by the fact that these are rare, explicit,
/// user-initiated actions that already show progress.
pub(crate) fn snapshot_blocking(
    db: &DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
    trigger: SnapshotTrigger,
) {
    let ctx = BackupContext {
        db_path,
        backups_dir,
        app_version: Some(env!("CARGO_PKG_VERSION")),
    };
    match crate::backup::create_snapshot(db, &ctx, trigger.clone()) {
        Ok(outcome) => {
            if let Some(meta) = outcome.created() {
                info!(
                    "Snapshot taken before {:?} ({} bytes)",
                    trigger, meta.byte_size
                );
            }
        }
        // Never blocks the operation: the user asked for it, and refusing to proceed
        // because a backup could not be written would strand them.
        Err(e) => warn!("Failed to take a snapshot before {:?}: {}", trigger, e),
    }
}

/// Takes a snapshot for an unlocked journal without blocking the caller.
///
/// The connection is **moved** onto the worker thread rather than shared. That is what makes
/// this safe on the lock path: `lock_diary` takes the handle out of `DiaryState` first, so
/// the backend is already locked — no command can reach the journal — while the snapshot
/// finishes against the handle the worker now owns and drops.
///
/// `backup_ops` is a clone of `state.backup_ops`, not a borrow of `state` — a `MutexGuard`
/// cannot move onto this thread, so the worker acquires its own guard on the same underlying
/// lock immediately before `create_snapshot`, serializing against the four IPC backup
/// commands exactly as every other trigger path does.
///
/// Returns a receiver that fires when the snapshot finishes, so a caller with a deadline
/// (shutdown) can wait on it. Callers with no deadline drop it.
pub(crate) fn snapshot_detached(
    db: DatabaseConnection,
    db_path: std::path::PathBuf,
    backups_dir: std::path::PathBuf,
    trigger: SnapshotTrigger,
    backup_ops: Arc<Mutex<()>>,
) -> mpsc::Receiver<()> {
    let (tx, rx) = mpsc::channel();

    std::thread::spawn(move || {
        // Best-effort, like every other trigger path: a poisoned lock abandons only this
        // snapshot attempt (already logged as a warning), never the operation that triggered
        // it — which here has already returned to its caller by the time this thread runs.
        if let Ok(_backup_ops) = backup_ops.lock() {
            let ctx = BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some(env!("CARGO_PKG_VERSION")),
            };
            match crate::backup::create_snapshot(&db, &ctx, trigger.clone()) {
                Ok(outcome) => {
                    if let Some(meta) = outcome.created() {
                        info!("Snapshot taken on {:?} ({} bytes)", trigger, meta.byte_size);
                    }
                }
                Err(e) => warn!("Failed to take a snapshot on {:?}: {}", trigger, e),
            }
        } else {
            warn!("backup_ops lock poisoned; skipping the detached snapshot on {trigger:?}");
        }
        // `db` drops here, closing the connection and zeroizing the master key.
        drop(db);
        let _ = tx.send(());
    });

    rx
}

/// Removes the journal handle from `state` and snapshots it on a background thread.
///
/// This is the lock/exit primitive. `Ok(None)` means the journal was already locked.
/// `Err` means a state mutex was poisoned — the connection's fate was never decided, so it
/// is left in place rather than silently dropped. `Ok(Some(rx))` is the normal case: a
/// receiver that fires once the snapshot has finished and the connection has been dropped.
///
/// `backup_ops` is acquired **before** `db_path`, matching the order every IPC backup command
/// uses. Holding it through the connection hand-off guarantees no IPC command's directory
/// mutation is in flight the instant `state.db` goes to `None`; it is released as soon as the
/// hand-off is done; see the module-level doc for why the detached worker then acquires its
/// own clone of the same lock rather than receiving this guard.
///
/// Paths are read before the connection is taken so a poisoned path mutex cannot strand an
/// already-removed connection.
///
/// Each state guard below (other than `backup_ops`, held for the whole function) is a
/// temporary that drops at the end of its own statement, so this function never holds two
/// `DiaryState` state-content locks at once alongside `backup_ops`. That is what keeps its
/// `backup_ops` → `db_path` → `backups_dir` → `db` acquisition order safe alongside
/// `snapshot_after_unlock` / `snapshot_before_destructive`, which use the same
/// `backup_ops` → `db` order: reusing a guard here (e.g. to avoid the `.clone()`s) would hold
/// two state-content locks at once and open an ABBA deadlock against those two functions.
pub(crate) fn take_connection_and_snapshot(
    state: &DiaryState,
    trigger: SnapshotTrigger,
) -> Result<Option<mpsc::Receiver<()>>, String> {
    let backup_ops = state
        .backup_ops
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;

    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();

    let Some(db) = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .take()
    else {
        return Ok(None);
    };

    // The connection is already out of `state.db` — any IPC backup command still waiting on
    // `backup_ops` will now fail its own unlocked-state check instead of interleaving with the
    // detached snapshot below, so this guard's job is done.
    drop(backup_ops);

    Ok(Some(snapshot_detached(
        db,
        db_path,
        backups_dir,
        trigger,
        Arc::clone(&state.backup_ops),
    )))
}

/// Snapshots the journal just unlocked, on the calling thread.
///
/// Runs synchronously because the unlock command has already returned the journal to the
/// user's control by this point only in the backend sense — the frontend is still waiting on
/// the invoke. In practice the dedup and interval rules mean this does no work at all on the
/// overwhelming majority of unlocks, and when it does, it is the one moment where the user
/// is already expecting the journal to be busy.
///
/// A failure here is logged and swallowed: never block an unlock on a backup.
pub(crate) fn snapshot_after_unlock(state: &DiaryState) {
    let Ok(_backup_ops) = state.backup_ops.lock() else {
        warn!("Journal state lock failed; skipping the post-unlock snapshot");
        return;
    };

    let Ok(db_state) = state.db.lock() else {
        warn!("Journal state lock failed; skipping the post-unlock snapshot");
        return;
    };
    let Some(db) = db_state.as_ref() else { return };

    let (Ok(db_path), Ok(backups_dir)) = (state.db_path.lock(), state.backups_dir.lock()) else {
        warn!("State lock failed; skipping the post-unlock snapshot");
        return;
    };

    snapshot_blocking(db, &db_path, &backups_dir, SnapshotTrigger::Unlock);
}

/// Snapshots the currently unlocked journal, if any, before a destructive command runs.
///
/// A locked journal is not an error: there is nothing open to snapshot, and the destructive
/// command is free to proceed.
pub(crate) fn snapshot_before_destructive(state: &DiaryState, operation: &'static str) {
    let Ok(_backup_ops) = state.backup_ops.lock() else {
        warn!("Journal state lock failed; skipping the pre-{operation} snapshot");
        return;
    };

    let Ok(db_state) = state.db.lock() else {
        warn!("Journal state lock failed; skipping the pre-{operation} snapshot");
        return;
    };
    let Some(db) = db_state.as_ref() else { return };

    let (Ok(db_path), Ok(backups_dir)) = (state.db_path.lock(), state.backups_dir.lock()) else {
        warn!("State lock failed; skipping the pre-{operation} snapshot");
        return;
    };

    snapshot_blocking(
        db,
        &db_path,
        &backups_dir,
        SnapshotTrigger::destructive(operation),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::auth::test_helpers::make_state;
    use crate::db::{create_database, insert_entry, DiaryEntry};

    fn entry(title: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: "2024-01-15".to_string(),
            title: title.to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: "2024-01-15T00:00:00Z".to_string(),
            date_updated: "2024-01-15T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        }
    }

    #[test]
    fn test_taking_the_connection_locks_the_journal_before_the_snapshot_finishes() {
        let (_fixture, state, db_path, _backups) = make_state("snapshot_takes_conn");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);

        let done = take_connection_and_snapshot(&state, SnapshotTrigger::Lock)
            .unwrap()
            .expect("an unlocked journal yields a receiver");

        // The security-relevant assertion: the backend is locked the instant the call
        // returns, not once the snapshot completes.
        assert!(
            state.db.lock().unwrap().is_none(),
            "the journal must be unreachable to commands while the snapshot is in flight"
        );

        done.recv_timeout(Duration::from_secs(30)).unwrap();

        let backups_dir = state.backups_dir.lock().unwrap().clone();
        let snapshots = crate::backup::list_snapshots(&backups_dir).unwrap();
        assert_eq!(snapshots.len(), 1);
        assert!(snapshots[0].verified);
        assert_eq!(snapshots[0].trigger, SnapshotTrigger::Lock);
    }

    #[test]
    fn test_taking_the_connection_of_a_locked_journal_is_a_no_op() {
        let (_fixture, state, _db_path, _backups) = make_state("snapshot_locked");
        assert!(take_connection_and_snapshot(&state, SnapshotTrigger::Lock)
            .unwrap()
            .is_none());
    }

    fn poison<T: Send>(mutex: &std::sync::Mutex<T>) {
        let result = std::thread::scope(|scope| {
            scope
                .spawn(|| {
                    let _guard = mutex.lock().unwrap();
                    panic!("deliberately poisoning this mutex for a test");
                })
                .join()
        });
        assert!(result.is_err(), "the spawned thread should have panicked");
    }

    #[test]
    fn test_take_connection_and_snapshot_does_not_drop_the_connection_when_db_path_is_poisoned() {
        let (_fixture, state, db_path, _backups) = make_state("poison_db_path");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);

        poison(&state.db_path);

        assert!(take_connection_and_snapshot(&state, SnapshotTrigger::Lock).is_err());
        assert!(
            state.db.lock().unwrap().is_some(),
            "the connection must not be dropped when db_path is poisoned"
        );
    }

    #[test]
    fn test_take_connection_and_snapshot_does_not_drop_the_connection_when_backups_dir_is_poisoned()
    {
        let (_fixture, state, db_path, _backups) = make_state("poison_backups_dir");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);

        poison(&state.backups_dir);

        assert!(take_connection_and_snapshot(&state, SnapshotTrigger::Lock).is_err());
        assert!(
            state.db.lock().unwrap().is_some(),
            "the connection must not be dropped when backups_dir is poisoned"
        );
    }

    #[test]
    fn test_destructive_snapshot_runs_before_the_operation_and_is_verified() {
        let (_fixture, state, db_path, backups_dir) = make_state("snapshot_destructive");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Before reset")).unwrap();
        *state.db.lock().unwrap() = Some(db);

        snapshot_before_destructive(&state, "reset_diary");

        let snapshots = crate::backup::list_snapshots(&backups_dir).unwrap();
        assert_eq!(snapshots.len(), 1, "a destructive command took no snapshot");
        assert!(snapshots[0].verified);
        assert_eq!(snapshots[0].entry_count, Some(1));
        assert_eq!(
            snapshots[0].trigger,
            SnapshotTrigger::destructive("reset_diary")
        );
        assert_eq!(
            snapshots[0].app_version.as_deref(),
            Some(env!("CARGO_PKG_VERSION"))
        );
    }

    #[test]
    fn test_destructive_snapshot_on_a_locked_journal_is_a_no_op() {
        let (_fixture, state, _db_path, backups_dir) = make_state("snapshot_destructive_locked");
        snapshot_before_destructive(&state, "reset_diary");
        assert!(crate::backup::list_snapshots(&backups_dir)
            .unwrap()
            .is_empty());
    }

    // ── Task F3: trigger paths serialize on `backup_ops` alongside the four IPC commands ──

    #[test]
    fn test_backup_ops_serializes_unlock_and_destructive_triggers() {
        use crate::commands::auth::test_helpers::assert_serializes_on_backup_ops;

        let (_fixture, state, db_path, _backups) = make_state("trigger_ops_lock_unlock");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);

        assert_serializes_on_backup_ops(&state, || {
            snapshot_after_unlock(&state);
        });

        let (_fixture2, state2, db_path2, _backups2) = make_state("trigger_ops_lock_destructive");
        let db2 = create_database(&db_path2, "test".to_string()).unwrap();
        insert_entry(&db2, &entry("Seed")).unwrap();
        *state2.db.lock().unwrap() = Some(db2);

        assert_serializes_on_backup_ops(&state2, || {
            snapshot_before_destructive(&state2, "test_operation");
        });
    }

    #[test]
    fn test_backup_ops_serializes_detached_lock_snapshot() {
        use crate::commands::auth::test_helpers::assert_serializes_on_backup_ops;

        let (_fixture, state, db_path, backups_dir) = make_state("trigger_ops_lock_detached");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();

        // Calls `snapshot_detached` directly, bypassing `take_connection_and_snapshot`'s own
        // synchronous `backup_ops` gate entirely (that gate is proven separately by
        // `test_backup_ops_serializes_unlock_and_destructive_triggers`'s sibling coverage and
        // the two `take_connection_and_snapshot` poison tests above). By the time a real
        // caller's synchronous hand-off has returned, any concurrent IPC holder it raced
        // against is already gone — so isolating this call is what proves the *detached
        // worker's own* guard acquisition, not the synchronous hand-off, is what serializes
        // it against a holder that starts only after the hand-off finished.
        assert_serializes_on_backup_ops(&state, || {
            let rx = snapshot_detached(
                db,
                db_path,
                backups_dir,
                SnapshotTrigger::Lock,
                Arc::clone(&state.backup_ops),
            );
            rx.recv_timeout(Duration::from_secs(30))
                .expect("the detached snapshot never completed");
        });
    }

    #[test]
    fn test_lock_snapshot_waits_for_delete_after_the_unlocked_check() {
        let (_fixture, state, db_path, backups_dir) = make_state("lock_waits_for_delete");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        let file_name = {
            let ctx = crate::backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.0.0-test"),
            };
            crate::backup::create_snapshot(&db, &ctx, SnapshotTrigger::Manual)
                .unwrap()
                .created()
                .unwrap()
                .file_name
                .clone()
        };
        *state.db.lock().unwrap() = Some(db);

        let (holder_ready_tx, holder_ready_rx) = mpsc::channel::<()>();
        let (release_tx, release_rx) = mpsc::channel::<()>();
        let (probe_done_tx, probe_done_rx) = mpsc::channel::<()>();

        let state_ref = &state;
        let backups_dir_ref = &backups_dir;
        let delete_target = file_name.clone();

        std::thread::scope(|scope| {
            // Stands in for `delete_backup_inner` paused right after its own unlocked check:
            // it holds the *real* `backup_ops` lock and, once cued, performs the exact same
            // real deletion `delete_backup_inner` itself would — through the same core call —
            // rather than a synthetic timing delay.
            scope.spawn(move || {
                let _guard = state_ref.backup_ops.lock().unwrap();
                holder_ready_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                crate::backup::delete_snapshot(backups_dir_ref, &delete_target).unwrap();
            });

            holder_ready_rx
                .recv()
                .expect("the delete stand-in must signal it holds backup_ops");

            scope.spawn(move || {
                let rx = take_connection_and_snapshot(state_ref, SnapshotTrigger::Lock)
                    .unwrap()
                    .expect("an unlocked journal yields a receiver");
                rx.recv_timeout(Duration::from_secs(30))
                    .expect("the lock snapshot never completed");
                let _ = probe_done_tx.send(());
            });

            let completed_while_deleting = probe_done_rx.recv_timeout(Duration::from_millis(300));

            // Release before asserting, for the same reason `assert_serializes_on_backup_ops`
            // does: an unwinding panic here still joins the scoped threads, and a still-blocked
            // delete stand-in would hang the test instead of failing it.
            release_tx
                .send(())
                .expect("the delete stand-in must still be waiting to release");

            assert!(
                completed_while_deleting.is_err(),
                "the lock snapshot completed while the delete stand-in still held backup_ops"
            );

            probe_done_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("the lock snapshot never completed after backup_ops was released");
        });

        // No manifest corruption from the interleaving: the directory (and its manifest) are
        // still fully readable, and hold at most the one snapshot the lock-trigger may have
        // taken after the delete completed. This does not assert on the file *name*: a
        // same-second retry can legitimately reuse the just-deleted name (`snapshot_file_name`
        // only avoids collisions against files that currently exist), so name identity is not
        // itself proof of a corrupted or resurrected old snapshot.
        let listed = crate::backup::list_snapshots(&backups_dir)
            .expect("the manifest must still be readable after the interleaving");
        assert!(
            listed.len() <= 1,
            "expected at most one snapshot (the possible post-delete lock snapshot), found {}",
            listed.len()
        );
    }

    #[test]
    fn test_trigger_and_ipc_backup_ops_lock_order_completes_after_release() {
        let (_fixture, state, db_path, _backups) = make_state("trigger_ipc_lock_order");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);
        let state = Arc::new(state);

        // Race a trigger-path snapshot against an IPC-reachable one on independent, unscoped
        // threads. Both take `backup_ops` before `db`, in the same order, so however the
        // scheduler interleaves them, both must finish — a regression to the opposite order on
        // either side would deadlock instead. Plain `thread::spawn` (not a scoped join) is
        // what lets a bounded `recv_timeout` fail this test instead of hanging the process:
        // a scoped join would itself wait forever for a genuinely deadlocked thread.
        let (trigger_tx, trigger_rx) = mpsc::channel::<()>();
        let (ipc_tx, ipc_rx) = mpsc::channel::<()>();

        {
            let state = Arc::clone(&state);
            std::thread::spawn(move || {
                snapshot_before_destructive(&state, "test_operation");
                let _ = trigger_tx.send(());
            });
        }
        {
            let state = Arc::clone(&state);
            std::thread::spawn(move || {
                let _ = crate::commands::backup::create_backup_now_inner(&state);
                let _ = ipc_tx.send(());
            });
        }

        trigger_rx.recv_timeout(Duration::from_secs(5)).expect(
            "the trigger-path snapshot never completed — possible backup_ops/db lock-order \
                 regression",
        );
        ipc_rx.recv_timeout(Duration::from_secs(5)).expect(
            "the IPC snapshot never completed — possible backup_ops/db lock-order regression",
        );
    }
}
