use crate::db::schema::DatabaseConnection;
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
}

impl DiaryState {
    pub fn new(db_path: PathBuf, backups_dir: PathBuf, app_data_dir: PathBuf) -> Self {
        Self {
            db: Mutex::new(None),
            db_path: Mutex::new(db_path),
            backups_dir: Mutex::new(backups_dir),
            app_data_dir,
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct JournalLockedEventPayload {
    reason: String,
}

fn lock_diary_inner(state: &DiaryState) -> Result<bool, String> {
    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "Failed to access journal state".to_string())?;

    if db_state.is_none() {
        return Ok(false);
    }

    *db_state = None;
    Ok(true)
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
        crate::menu::update_menu_lock_state(&app, true);
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
    use crate::db::schema::create_database;

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
