use crate::db::DatabaseConnection;
use log::{info, warn};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State, Wry};

/// Shared state for the database connection
pub struct DiaryState {
    pub db: Mutex<Option<DatabaseConnection>>,
    pub db_path: Mutex<PathBuf>,
    pub backups_dir: Mutex<PathBuf>,
    /// App data directory — always the fixed system location, used for config.json.
    /// Never changes after startup, so no Mutex needed.
    pub app_data_dir: PathBuf,
    /// A snapshot opened read-only for inspection — a **second** decrypted database with a
    /// **second** master key, held apart from `db` and never registered as a journal.
    ///
    /// It lives here rather than in its own managed state so that locking the journal tears
    /// it down automatically: every lock path funnels through [`lock_diary_inner_with`], and
    /// an invariant enforced by the call graph does not depend on a future caller
    /// remembering a second teardown.
    pub inspection: Mutex<Option<crate::commands::backup_inspect::InspectedSnapshot>>,
}

impl DiaryState {
    pub fn new(db_path: PathBuf, backups_dir: PathBuf, app_data_dir: PathBuf) -> Self {
        Self {
            db: Mutex::new(None),
            db_path: Mutex::new(db_path),
            backups_dir: Mutex::new(backups_dir),
            app_data_dir,
            inspection: Mutex::new(None),
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct JournalLockedEventPayload {
    reason: String,
}

/// How long a caller is willing to stay in `lock_diary_inner_with`.
pub(crate) enum LockCompletion {
    /// Return as soon as the journal is unreachable. The `Lock` snapshot finishes in the
    /// background. Correct for every user-facing lock, where responsiveness is the point.
    Detached,
    /// Additionally wait for the background snapshot to close the database file.
    ///
    /// Required by callers that touch `diary.db` on the filesystem immediately afterwards —
    /// moving it or deleting it. On Windows an open SQLite handle makes both fail outright
    /// (`os error 32`), so "locked" is not a strong enough guarantee for them: they need
    /// "closed".
    AwaitFileRelease,
}

/// Locks the journal, taking a `Lock`-triggered snapshot on the way out.
///
/// The connection is handed to a background thread rather than dropped, so the snapshot runs
/// against a handle no command can reach: `DiaryState.db` is `None` the moment the handle is
/// taken, which is what "locked" means to every other code path. The snapshot then finishes
/// and drops the connection, zeroizing the master key.
///
/// This covers all three auto-lock paths (idle timer, OS session lock, focus loss) because
/// every one of them funnels through here.
fn lock_diary_inner_with(state: &DiaryState, completion: LockCompletion) -> Result<bool, String> {
    // First, and unconditionally: a snapshot opened for inspection holds a decrypted database
    // and a master key of its own, and locking the journal while that stays open would leave
    // the app's content readable behind a locked screen. This runs before the early return
    // below, so it covers the already-locked case a journal switch produces.
    crate::commands::backup_inspect::close_inspection(state);

    let Some(done) = crate::commands::backup_triggers::take_connection_and_snapshot(
        state,
        crate::backup::SnapshotTrigger::Lock,
    ) else {
        // Distinguish "already locked" from "the state lock is poisoned", which the caller
        // must still see as an error.
        let db_state = state
            .db
            .lock()
            .map_err(|_| "Failed to access journal state".to_string())?;
        debug_assert!(db_state.is_none());
        return Ok(false);
    };

    if let LockCompletion::AwaitFileRelease = completion {
        // `recv` always returns: the worker sends on completion, and a panicking worker
        // drops the sender, which surfaces as `Err`. Either way the connection is gone.
        // In practice this returns immediately — these callers snapshot synchronously just
        // beforehand, so the `Lock` snapshot is deduplicated away.
        if done.recv().is_err() {
            warn!("The lock-time snapshot thread ended without reporting completion");
        }
    }

    Ok(true)
}

/// Locks the journal without waiting for the lock-time snapshot to finish.
fn lock_diary_inner(state: &DiaryState) -> Result<bool, String> {
    lock_diary_inner_with(state, LockCompletion::Detached)
}

fn emit_diary_locking(app: &AppHandle<Wry>, reason: &str) {
    if let Err(error) = app.emit("journal-locking", reason) {
        warn!("Failed to emit journal-locking event: {}", error);
    }
}

fn emit_diary_locked(app: &AppHandle<Wry>, reason: &str) {
    if let Err(error) = app.emit(
        "journal-locked",
        JournalLockedEventPayload {
            reason: reason.to_string(),
        },
    ) {
        warn!("Failed to emit journal-locked event: {}", error);
    }
}

pub(crate) fn auto_lock_diary_if_unlocked(
    state: State<DiaryState>,
    app: AppHandle<Wry>,
    reason: &str,
) -> Result<bool, String> {
    emit_diary_locking(&app, reason);
    let did_lock = lock_diary_inner(&state)?;

    if did_lock {
        info!("Journal auto-locked ({})", reason);
        emit_diary_locked(&app, reason);
    }

    Ok(did_lock)
}

/// Acquires the DB lock, checks that the journal is unlocked, then calls `f` with a
/// reference to the connection.  Centralises the 4-line preamble that every command
/// that reads or writes entries would otherwise repeat.
pub(crate) fn with_unlocked_db<F, T>(state: &DiaryState, f: F) -> Result<T, String>
where
    F: FnOnce(&DatabaseConnection) -> Result<T, String>,
{
    let db_state = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    let db = db_state.as_ref().ok_or("Journal must be unlocked")?;
    f(db)
}

mod auth_core;
mod auth_directory;
mod auth_identity;
mod auth_journals;
mod auth_policy;
mod auth_slots;

pub use auth_core::*;
pub use auth_directory::*;
pub use auth_identity::*;
pub use auth_journals::*;
pub use auth_policy::*;
pub use auth_slots::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_database;

    #[test]
    fn test_with_unlocked_db_locked_returns_error() {
        let (_fixture, state, _, _) = test_helpers::make_state("wudb_locked");
        let err = with_unlocked_db(&state, |_db| Ok(())).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }

    #[test]
    fn test_with_unlocked_db_unlocked_returns_inner_result() {
        let (_fixture, state, db_path, _) = test_helpers::make_state("wudb_unlocked");
        let db = create_database(&db_path, "test".to_string()).unwrap();
        *state.db.lock().unwrap() = Some(db);
        let result: Result<i32, String> = with_unlocked_db(&state, |_db| Ok(42));
        assert_eq!(result.unwrap(), 42);
    }
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use super::*;

    pub struct TestFixture {
        _temp_dir: tempfile::TempDir,
    }

    impl TestFixture {
        pub fn path(&self) -> &std::path::Path {
            self._temp_dir.path()
        }
    }

    pub fn make_state(name: &str) -> (TestFixture, DiaryState, PathBuf, PathBuf) {
        let temp_dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-auth-{name}-"))
            .tempdir()
            .unwrap();
        let db_path = temp_dir.path().join("diary.db");
        let backups_dir = temp_dir.path().join("backups");
        let app_data_dir = temp_dir.path().join("app-data");
        let state = DiaryState::new(db_path.clone(), backups_dir.clone(), app_data_dir.clone());
        let fixture = TestFixture {
            _temp_dir: temp_dir,
        };
        (fixture, state, db_path, backups_dir)
    }
}
