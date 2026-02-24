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
struct DiaryLockedEventPayload {
    reason: String,
}

fn lock_diary_inner(state: &DiaryState) -> Result<bool, String> {
    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "Failed to access diary state".to_string())?;

    if db_state.is_none() {
        return Ok(false);
    }

    *db_state = None;
    Ok(true)
}

fn emit_diary_locked(app: &AppHandle<Wry>, reason: &str) {
    if let Err(error) = app.emit(
        "diary-locked",
        DiaryLockedEventPayload {
            reason: reason.to_string(),
        },
    ) {
        warn!("Failed to emit diary-locked event: {}", error);
    }
}

pub(crate) fn auto_lock_diary_if_unlocked(
    state: State<DiaryState>,
    app: AppHandle<Wry>,
    reason: &str,
) -> Result<bool, String> {
    let did_lock = lock_diary_inner(&state)?;

    if did_lock {
        info!("Diary auto-locked ({})", reason);
        crate::menu::update_menu_lock_state(&app, true);
        emit_diary_locked(&app, reason);
    }

    Ok(did_lock)
}

mod auth_core;
mod auth_directory;
mod auth_journals;
mod auth_methods;

pub use auth_core::*;
pub use auth_directory::*;
pub use auth_journals::*;
pub use auth_methods::*;

#[cfg(test)]
pub(crate) mod test_helpers {
    use super::*;
    use std::fs;

    pub fn temp_db_path(name: &str) -> PathBuf {
        PathBuf::from(format!("test_auth_cmd_{}.db", name))
    }

    pub fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_auth_cmd_backups_{}", name))
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
