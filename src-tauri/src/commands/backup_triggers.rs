//! Where snapshots are taken from, and on which thread.
//!
//! The engine itself lives in `mini-diarium-core`; this module is the app-side wiring that
//! decides *when* it runs. Two rules shape everything here:
//!
//! 1. **A snapshot precedes the risky write, it does not follow it.** Destructive commands
//!    snapshot before they touch the journal, and the schema migration snapshot is taken
//!    inside `db::schema::open` before `apply_pending`.
//! 2. **A snapshot never blocks the UI.** `VACUUM INTO` scales with journal size, and an
//!    image-heavy journal is hundreds of megabytes. Anything on the lock or shutdown path
//!    runs on a background thread.
//!
//! Failure semantics are deliberately asymmetric. A failed snapshot is logged and ignored
//! everywhere except before a schema migration, where the core aborts the migration instead
//! — a missing backup is recoverable, a half-migrated journal is not.

use std::path::Path;
use std::sync::mpsc;
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
/// Returns a receiver that fires when the snapshot finishes, so a caller with a deadline
/// (shutdown) can wait on it. Callers with no deadline drop it.
pub(crate) fn snapshot_detached(
    db: DatabaseConnection,
    db_path: std::path::PathBuf,
    backups_dir: std::path::PathBuf,
    trigger: SnapshotTrigger,
) -> mpsc::Receiver<()> {
    let (tx, rx) = mpsc::channel();

    std::thread::spawn(move || {
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
        // `db` drops here, closing the connection and zeroizing the master key.
        drop(db);
        let _ = tx.send(());
    });

    rx
}

/// Removes the journal handle from `state` and snapshots it on a background thread.
///
/// This is the lock/exit primitive. It returns `None` when the journal was already locked,
/// and otherwise a receiver that fires once the snapshot has finished and the connection has
/// been dropped.
pub(crate) fn take_connection_and_snapshot(
    state: &DiaryState,
    trigger: SnapshotTrigger,
) -> Option<mpsc::Receiver<()>> {
    let db = state.db.lock().ok()?.take()?;
    let db_path = state.db_path.lock().ok()?.clone();
    let backups_dir = state.backups_dir.lock().ok()?.clone();

    Some(snapshot_detached(db, db_path, backups_dir, trigger))
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
        assert!(take_connection_and_snapshot(&state, SnapshotTrigger::Lock).is_none());
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
}
