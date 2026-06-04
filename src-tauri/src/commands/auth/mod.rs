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
    use std::path::PathBuf;

    #[test]
    fn test_with_unlocked_db_locked_returns_error() {
        let state = DiaryState::new(
            PathBuf::from("test_wudb_locked.db"),
            PathBuf::from("test_wudb_locked_backups"),
            PathBuf::from("."),
        );
        let err = with_unlocked_db(&state, |_db| Ok(())).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }

    #[test]
    fn test_with_unlocked_db_unlocked_returns_inner_result() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let state = DiaryState::new(
            PathBuf::from("test_wudb_unlocked.db"),
            PathBuf::from("test_wudb_unlocked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);
        let result: Result<i32, String> = with_unlocked_db(&state, |_db| Ok(42));
        assert_eq!(result.unwrap(), 42);
    }
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use super::*;
    use std::fs;

    pub fn temp_db_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("mini_diarium_test_{}.db", name))
    }

    pub fn temp_backups_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("mini_diarium_test_backups_{}", name))
    }

    pub fn cleanup(db_path: &PathBuf, backups_dir: &PathBuf) {
        let _ = fs::remove_file(db_path);
        let _ = fs::remove_dir_all(backups_dir);
    }

    pub fn make_state(name: &str) -> (DiaryState, PathBuf, PathBuf) {
        let db_path = temp_db_path(name);
        let backups_dir = temp_backups_dir(name);
        let _ = fs::remove_file(&db_path);
        let _ = fs::remove_dir_all(&backups_dir);
        let state = DiaryState::new(db_path.clone(), backups_dir.clone(), PathBuf::from("."));
        (state, db_path, backups_dir)
    }
}
