use log::info;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State, Wry};

use super::DiaryState;

/// Core file-move logic for changing diary directory.  Separated so it can be
/// unit-tested without needing a live Tauri app handle.
fn change_diary_directory_inner(
    new_dir_path: PathBuf,
    current_db_path: PathBuf,
    db_filename: &str,
    db_path_slot: &Mutex<PathBuf>,
    backups_dir_slot: &Mutex<PathBuf>,
    app_data_dir: &std::path::Path,
) -> Result<(), String> {
    if !new_dir_path.is_dir() {
        return Err("Selected directory does not exist".to_string());
    }

    let new_db_path = new_dir_path.join(db_filename);
    let stem = std::path::Path::new(db_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("diary");

    // Same-directory no-op check using canonicalize when possible
    let cur_dir = current_db_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    let canon_cur = std::fs::canonicalize(&cur_dir).unwrap_or(cur_dir);
    let canon_new = std::fs::canonicalize(&new_dir_path).unwrap_or(new_dir_path.clone());
    if canon_cur == canon_new {
        return Ok(());
    }

    // Handle file presence matrix
    match (current_db_path.exists(), new_db_path.exists()) {
        (true, true) => {
            return Err("A journal file already exists at the chosen location. \
                 Move or remove it first, then try again."
                .to_string());
        }
        (true, false) => {
            std::fs::copy(&current_db_path, &new_db_path)
                .map_err(|e| format!("Failed to copy journal file: {}", e))?;
            std::fs::remove_file(&current_db_path)
                .map_err(|e| format!("Failed to remove old journal file: {}", e))?;
        }
        (false, _) => {
            // No existing diary to move — just update the path
        }
    }

    // Persist choice and update in-memory state
    crate::config::save_diary_dir(app_data_dir, &new_dir_path)?;
    *db_path_slot
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_db_path;
    *backups_dir_slot
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_dir_path.join("backups").join(stem);

    Ok(())
}

/// Pure inner for `change_diary_directory` — locks the DB then moves the file.
///
/// Separated from the Tauri command so the auto-lock + move sequence can be
/// unit-tested without needing an `AppHandle`. Does not emit events; the Tauri
/// command layer handles that.
pub(crate) fn change_diary_directory_with_auto_lock_inner(
    new_dir: &str,
    state: &DiaryState,
) -> Result<(), String> {
    // Auto-lock: close the DB connection before moving the file.
    // Safe on all platforms — SQLite holds a file lock while open.
    if super::lock_diary_inner(state)? {
        info!("Journal auto-locked for directory change");
    }

    let current_db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let db_filename = current_db_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("diary.db")
        .to_string();
    change_diary_directory_inner(
        PathBuf::from(new_dir),
        current_db_path,
        &db_filename,
        &state.db_path,
        &state.backups_dir,
        &state.app_data_dir,
    )?;

    // Sync journal config: update the active journal's path to match
    let journals = crate::config::load_journals(&state.app_data_dir);
    if let Some(active_id) = crate::config::load_active_journal_id(&state.app_data_dir) {
        let updated: Vec<_> = journals
            .into_iter()
            .map(|mut j| {
                if j.id == active_id {
                    j.path = new_dir.to_string();
                }
                j
            })
            .collect();
        let _ = crate::config::save_journals(&state.app_data_dir, &updated, &active_id);
    }

    info!("Journal directory changed to: {}", new_dir);
    Ok(())
}

/// Changes the directory where the diary file is stored.
///
/// The diary must be locked before calling this command. The file is moved
/// (copy + delete) to the new directory, and the choice is persisted in
/// `{app_data_dir}/config.json` so the app finds it on the next launch.
///
/// If both the current directory and the new directory already contain a
/// `diary.db`, the command refuses to proceed to avoid data loss.
#[tauri::command]
pub fn change_diary_directory(
    new_dir: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    // Capture lock state first; the inner locks before the file move.
    let was_unlocked = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .is_some();
    let result = change_diary_directory_with_auto_lock_inner(&new_dir, &state);
    // Emit regardless of move outcome — the DB is already locked at this point if was_unlocked.
    if was_unlocked {
        super::emit_diary_locked(&app, "directory change");
    }
    result
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_change_diary_directory_same_dir_is_noop() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        std::fs::write(&db_path, b"fake db").unwrap();

        let db_path_mutex = Mutex::new(db_path.clone());
        let backups_mutex = Mutex::new(dir.path().join("backups"));
        let cfg_dir = dir.path().to_path_buf();

        let result = change_diary_directory_inner(
            dir.path().to_path_buf(),
            db_path.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(result.is_ok());
        assert!(db_path.exists());
    }

    #[test]
    fn test_change_diary_directory_moves_file() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        std::fs::write(&src_db, b"fake db content").unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src.path().join("backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert!(!src_db.exists(), "Source file should be removed");
        assert!(
            dst.path().join("diary.db").exists(),
            "Destination file should exist"
        );
    }

    #[test]
    fn test_change_diary_directory_both_have_diary_returns_err() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        std::fs::write(src.path().join("diary.db"), b"src db").unwrap();
        std::fs::write(dst.path().join("diary.db"), b"dst db").unwrap();

        let db_path_mutex = Mutex::new(src.path().join("diary.db"));
        let backups_mutex = Mutex::new(src.path().join("backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src.path().join("diary.db"),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_change_diary_directory_no_diary_yet_updates_path() {
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        // db_path doesn't exist yet (fresh install scenario)
        let nonexistent = dst.path().join("nonexistent/diary.db");
        let db_path_mutex = Mutex::new(nonexistent.clone());
        let backups_mutex = Mutex::new(dst.path().join("nonexistent/backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            nonexistent,
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(*db_path_mutex.lock().unwrap(), dst.path().join("diary.db"));
    }

    #[test]
    fn test_change_diary_directory_auto_locks_and_moves_file() {
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();

        let state = DiaryState::new(
            src_db.clone(),
            src.path().join("backups"),
            cfg.path().to_path_buf(),
        );
        *state.db.lock().unwrap() = Some(db);
        assert!(state.db.lock().unwrap().is_some(), "should start unlocked");

        let result =
            change_diary_directory_with_auto_lock_inner(dst.path().to_str().unwrap(), &state);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        assert!(
            state.db.lock().unwrap().is_none(),
            "DB should be locked after move"
        );
        assert!(!src_db.exists(), "source file should be gone");
        assert!(
            dst.path().join("diary.db").exists(),
            "file should be at destination"
        );
    }
}
