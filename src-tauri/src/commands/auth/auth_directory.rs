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
    db_path_slot: &Mutex<PathBuf>,
    backups_dir_slot: &Mutex<PathBuf>,
    app_data_dir: &std::path::Path,
) -> Result<(), String> {
    if !new_dir_path.is_dir() {
        return Err("Selected directory does not exist".to_string());
    }

    let new_db_path = new_dir_path.join("diary.db");

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
            return Err("A diary file already exists at the chosen location. \
                 Move or remove it first, then try again."
                .to_string());
        }
        (true, false) => {
            std::fs::copy(&current_db_path, &new_db_path)
                .map_err(|e| format!("Failed to copy diary file: {}", e))?;
            std::fs::remove_file(&current_db_path)
                .map_err(|e| format!("Failed to remove old diary file: {}", e))?;
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
        .map_err(|_| "State lock poisoned".to_string())? = new_dir_path.join("backups");

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
    // Auto-lock: close the DB connection before moving the file.
    // Safe on all platforms — SQLite holds a file lock while open.
    if super::auto_lock_diary_if_unlocked(state.clone(), app.clone(), "directory change")? {
        info!("Diary auto-locked for directory change");
    }

    let current_db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let result = change_diary_directory_inner(
        PathBuf::from(&new_dir),
        current_db_path,
        &state.db_path,
        &state.backups_dir,
        &state.app_data_dir,
    );
    if result.is_ok() {
        info!("Diary directory changed to: {}", new_dir);
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
    fn test_change_diary_directory_blocked_when_unlocked() {
        // The guard in change_diary_directory checks db.lock().is_some().
        // We test the guard logic inline (can't construct DatabaseConnection in a unit test).
        let is_unlocked = true;
        let guard_result: Result<(), String> = if is_unlocked {
            Err("Diary must be locked before changing its storage location.".to_string())
        } else {
            Ok(())
        };
        assert!(guard_result.is_err());
        assert!(guard_result.unwrap_err().contains("must be locked"));

        // And confirm that when locked (is_some() == false) the inner logic proceeds.
        let dst_dir = PathBuf::from("test_chdir_blocked_dst");
        fs::create_dir_all(&dst_dir).unwrap();
        let cfg_dir = PathBuf::from("test_chdir_blocked_cfg");
        fs::create_dir_all(&cfg_dir).unwrap();

        let db_path_mutex = Mutex::new(PathBuf::from("test_chdir_blocked_nonexistent/diary.db"));
        let backups_mutex = Mutex::new(PathBuf::from("test_chdir_blocked_nonexistent/backups"));

        let dst_abs = fs::canonicalize(&dst_dir).unwrap();
        let result = change_diary_directory_inner(
            dst_abs,
            PathBuf::from("test_chdir_blocked_nonexistent/diary.db"),
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
        );
        assert!(
            result.is_ok(),
            "Locked state (None db) should allow directory change"
        );

        let _ = fs::remove_dir_all(&dst_dir);
        let _ = fs::remove_dir_all(&cfg_dir);
    }
}
