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
    let was_unlocked = state.db.lock().map_err(|_| "State lock poisoned".to_string())?.is_some();
    let result = change_diary_directory_with_auto_lock_inner(&new_dir, &state);
    // Emit regardless of move outcome — the DB is already locked at this point if was_unlocked.
    if was_unlocked {
        super::emit_diary_locked(&app, "directory change");
        crate::menu::update_menu_lock_state(&app, true);
    }
    result
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_change_diary_directory_same_dir_is_noop() {
        let cur_dir = std::env::current_dir().unwrap();
        let db_path = cur_dir.join("test_chdir_same.db");
        fs::write(&db_path, b"fake db").unwrap();

        let db_path_mutex = Mutex::new(db_path.clone());
        let backups_mutex = Mutex::new(cur_dir.join("test_chdir_same_backups"));
        let cfg_dir = PathBuf::from(".");

        let result = change_diary_directory_inner(
            cur_dir.clone(),
            db_path.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(result.is_ok());
        // File should still exist at original location
        assert!(db_path.exists());

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_change_diary_directory_moves_file() {
        let src_dir = PathBuf::from("test_chdir_src");
        let dst_dir = PathBuf::from("test_chdir_dst");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&dst_dir).unwrap();

        let src_db = src_dir.join("diary.db");
        fs::write(&src_db, b"fake db content").unwrap();

        let cfg_dir = PathBuf::from("test_chdir_cfg");
        fs::create_dir_all(&cfg_dir).unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src_dir.join("backups"));

        let dst_abs = fs::canonicalize(&dst_dir).unwrap();
        let result = change_diary_directory_inner(
            dst_abs.clone(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert!(!src_db.exists(), "Source file should be removed");
        assert!(
            dst_abs.join("diary.db").exists(),
            "Destination file should exist"
        );

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dst_dir);
        let _ = fs::remove_dir_all(&cfg_dir);
    }

    #[test]
    fn test_change_diary_directory_both_have_diary_returns_err() {
        let src_dir = PathBuf::from("test_chdir_both_src");
        let dst_dir = PathBuf::from("test_chdir_both_dst");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&dst_dir).unwrap();

        fs::write(src_dir.join("diary.db"), b"src db").unwrap();
        fs::write(dst_dir.join("diary.db"), b"dst db").unwrap();

        let cfg_dir = PathBuf::from("test_chdir_both_cfg");
        fs::create_dir_all(&cfg_dir).unwrap();

        let db_path_mutex = Mutex::new(src_dir.join("diary.db"));
        let backups_mutex = Mutex::new(src_dir.join("backups"));

        let dst_abs = fs::canonicalize(&dst_dir).unwrap();
        let result = change_diary_directory_inner(
            dst_abs,
            src_dir.join("diary.db"),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dst_dir);
        let _ = fs::remove_dir_all(&cfg_dir);
    }

    #[test]
    fn test_change_diary_directory_no_diary_yet_updates_path() {
        let dst_dir = PathBuf::from("test_chdir_nodiary_dst");
        fs::create_dir_all(&dst_dir).unwrap();

        let cfg_dir = PathBuf::from("test_chdir_nodiary_cfg");
        fs::create_dir_all(&cfg_dir).unwrap();

        // db_path doesn't exist yet (fresh install scenario)
        let db_path_mutex = Mutex::new(PathBuf::from("test_chdir_nodiary_src/diary.db"));
        let backups_mutex = Mutex::new(PathBuf::from("test_chdir_nodiary_src/backups"));

        let dst_abs = fs::canonicalize(&dst_dir).unwrap();
        let result = change_diary_directory_inner(
            dst_abs.clone(),
            PathBuf::from("test_chdir_nodiary_src/diary.db"),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        // db_path slot should be updated to new location
        assert_eq!(*db_path_mutex.lock().unwrap(), dst_abs.join("diary.db"));

        let _ = fs::remove_dir_all(&dst_dir);
        let _ = fs::remove_dir_all(&cfg_dir);
    }

    #[test]
    fn test_change_diary_directory_auto_locks_and_moves_file() {
        use crate::db::schema::create_database;

        let src_dir = PathBuf::from("test_autolock_src");
        let dst_dir = PathBuf::from("test_autolock_dst");
        let cfg_dir = PathBuf::from("test_autolock_cfg");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&dst_dir).unwrap();
        fs::create_dir_all(&cfg_dir).unwrap();

        let src_db = src_dir.join("diary.db");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();
        let dst_abs = fs::canonicalize(&dst_dir).unwrap();

        let state = DiaryState::new(
            src_db.clone(),
            src_dir.join("backups"),
            cfg_dir.clone(),
        );
        *state.db.lock().unwrap() = Some(db);
        assert!(state.db.lock().unwrap().is_some(), "should start unlocked");

        let result =
            change_diary_directory_with_auto_lock_inner(dst_abs.to_str().unwrap(), &state);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        assert!(state.db.lock().unwrap().is_none(), "DB should be locked after move");
        assert!(!src_db.exists(), "source file should be gone");
        assert!(dst_abs.join("diary.db").exists(), "file should be at destination");

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dst_dir);
        let _ = fs::remove_dir_all(&cfg_dir);
    }
}
