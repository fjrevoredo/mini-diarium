use crate::db::schema::{create_database, open_database, DatabaseConnection};
use log::{info, warn};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Shared state for the database connection
pub struct DiaryState {
    pub db: Mutex<Option<DatabaseConnection>>,
    pub db_path: Mutex<PathBuf>,
    pub backups_dir: Mutex<PathBuf>,
}

impl DiaryState {
    pub fn new(db_path: PathBuf, backups_dir: PathBuf) -> Self {
        Self {
            db: Mutex::new(None),
            db_path: Mutex::new(db_path),
            backups_dir: Mutex::new(backups_dir),
        }
    }
}

/// Creates a new encrypted diary database
#[tauri::command]
pub fn create_diary(password: String, state: State<DiaryState>) -> Result<(), String> {
    let db_path = state.db_path.lock().unwrap().clone();

    // Check if database already exists
    if db_path.exists() {
        return Err("Diary already exists".to_string());
    }

    // Create the database
    let db_conn = create_database(&db_path, password)?;

    // Store in state
    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(db_conn);

    info!("Diary created");
    Ok(())
}

/// Unlocks (opens) an existing diary with a password
#[tauri::command]
pub fn unlock_diary(password: String, state: State<DiaryState>) -> Result<(), String> {
    let db_path = state.db_path.lock().unwrap().clone();
    let backups_dir = state.backups_dir.lock().unwrap().clone();

    // Check if database exists
    if !db_path.exists() {
        return Err("No diary found. Please create one first.".to_string());
    }

    // Open the database (migrations run automatically if needed)
    let db_conn = open_database(&db_path, password, &backups_dir)?;

    // Store in state
    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(db_conn);

    info!("Diary unlocked");

    // Create backup after successful unlock
    // Failures in backup should not prevent unlocking, so we just log errors
    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    Ok(())
}

/// Locks the diary (closes the database connection)
#[tauri::command]
pub fn lock_diary(state: State<DiaryState>) -> Result<(), String> {
    let mut db_state = state.db.lock().unwrap();

    if db_state.is_none() {
        return Err("Diary is not unlocked".to_string());
    }

    // Clear the database connection
    *db_state = None;

    info!("Diary locked");
    Ok(())
}

/// Checks if a diary file exists
#[tauri::command]
pub fn diary_exists(state: State<DiaryState>) -> Result<bool, String> {
    let db_path = state.db_path.lock().unwrap();
    Ok(db_path.exists())
}

/// Checks if the diary is currently unlocked
#[tauri::command]
pub fn is_diary_unlocked(state: State<DiaryState>) -> Result<bool, String> {
    let db_state = state.db.lock().unwrap();
    Ok(db_state.is_some())
}

/// Gets the current diary file path
#[tauri::command]
pub fn get_diary_path(state: State<DiaryState>) -> Result<String, String> {
    let db_path = state.db_path.lock().unwrap();
    db_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid diary path".to_string())
}

/// Changes the diary password
#[tauri::command]
pub fn change_password(
    old_password: String,
    new_password: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let db_path = state.db_path.lock().unwrap().clone();
    let backups_dir = state.backups_dir.lock().unwrap().clone();

    // Verify old password by opening database
    let _db = open_database(&db_path, old_password, &backups_dir)?;

    // Export all entries
    let entries = {
        let db_state = state.db.lock().unwrap();
        let db = db_state
            .as_ref()
            .ok_or("Diary must be unlocked to change password")?;

        // Get all entries
        let dates = crate::db::queries::get_all_entry_dates(db)?;
        let mut all_entries = Vec::new();
        for date in dates {
            if let Some(entry) = crate::db::queries::get_entry(db, &date)? {
                all_entries.push(entry);
            }
        }
        all_entries
    };

    // Close current connection
    lock_diary(state.clone())?;

    // Backup old database
    let backup_path = db_path.with_extension("db.backup");
    std::fs::copy(&db_path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;

    // Delete old database
    std::fs::remove_file(&db_path).map_err(|e| format!("Failed to remove old database: {}", e))?;

    // Create new database with new password
    let new_db = create_database(&db_path, new_password)?;

    // Re-insert all entries
    for entry in &entries {
        crate::db::queries::insert_entry(&new_db, entry)?;
    }

    // Update state with new connection
    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(new_db);

    // Remove backup if successful
    let _ = std::fs::remove_file(&backup_path);

    info!("Password changed successfully");
    Ok(())
}

/// Resets the diary (deletes the database file)
/// WARNING: This permanently deletes all data!
#[tauri::command]
pub fn reset_diary(state: State<DiaryState>) -> Result<(), String> {
    // Lock the diary first
    let _ = lock_diary(state.clone());

    let db_path = state.db_path.lock().unwrap().clone();

    if !db_path.exists() {
        return Err("No diary found to reset".to_string());
    }

    // Delete the database file
    std::fs::remove_file(&db_path).map_err(|e| format!("Failed to delete diary: {}", e))?;

    info!("Diary reset");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_db_path(name: &str) -> PathBuf {
        PathBuf::from(format!("test_auth_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
        let backup = path.with_extension("db.backup");
        let _ = fs::remove_file(backup);
    }

    #[test]
    fn test_create_and_open_database() {
        let db_path = temp_db_path("basic");
        let backups_dir = PathBuf::from("test_backups_basic");
        cleanup_db(&db_path);

        // Create database
        let db1 = create_database(&db_path, "password".to_string()).unwrap();
        assert!(db_path.exists());
        drop(db1);

        // Open database with correct password
        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        drop(db2);

        cleanup_db(&db_path);
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_open_with_wrong_password() {
        let db_path = temp_db_path("wrong_pw");
        let backups_dir = PathBuf::from("test_backups_wrong_pw");
        cleanup_db(&db_path);

        create_database(&db_path, "correct".to_string()).unwrap();

        let result = open_database(&db_path, "wrong".to_string(), &backups_dir);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Incorrect password"));

        cleanup_db(&db_path);
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_diary_state_create() {
        let db_path = temp_db_path("state_create");
        let backups_dir = PathBuf::from("test_backups");
        cleanup_db(&db_path);

        let state = DiaryState::new(db_path.clone(), backups_dir);

        // Initially no connection
        {
            let db = state.db.lock().unwrap();
            assert!(db.is_none());
        }

        // Create database manually
        let db_conn = create_database(&db_path, "test".to_string()).unwrap();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(db_conn);
        }

        // Now connection exists
        {
            let db = state.db.lock().unwrap();
            assert!(db.is_some());
        }

        cleanup_db(&db_path);
    }

    #[test]
    fn test_password_change_workflow() {
        let db_path = temp_db_path("pw_change");
        let backups_dir = PathBuf::from("test_backups_pw_change");
        cleanup_db(&db_path);

        // Create database
        let db = create_database(&db_path, "old_password".to_string()).unwrap();

        // Add test entry
        let entry = crate::db::queries::DiaryEntry {
            date: "2024-01-01".to_string(),
            title: "Test Entry".to_string(),
            text: "Test content".to_string(),
            word_count: 2,
            date_created: "2024-01-01T00:00:00Z".to_string(),
            date_updated: "2024-01-01T00:00:00Z".to_string(),
        };
        crate::db::queries::insert_entry(&db, &entry).unwrap();
        drop(db);

        // Simulate password change: export, delete, recreate
        let db_old = open_database(&db_path, "old_password".to_string(), &backups_dir).unwrap();
        let entries: Vec<_> = {
            let dates = crate::db::queries::get_all_entry_dates(&db_old).unwrap();
            dates
                .iter()
                .filter_map(|date| crate::db::queries::get_entry(&db_old, date).unwrap())
                .collect()
        };
        drop(db_old);

        // Create backup, delete, recreate
        let backup_path = db_path.with_extension("db.backup");
        std::fs::copy(&db_path, &backup_path).unwrap();
        std::fs::remove_file(&db_path).unwrap();

        let db_new = create_database(&db_path, "new_password".to_string()).unwrap();
        for e in &entries {
            crate::db::queries::insert_entry(&db_new, e).unwrap();
        }
        drop(db_new);

        // Verify new password works
        let db_verify = open_database(&db_path, "new_password".to_string(), &backups_dir).unwrap();
        let retrieved = crate::db::queries::get_entry(&db_verify, "2024-01-01")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, "Test Entry");

        cleanup_db(&db_path);
        let _ = fs::remove_file(backup_path);
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_reset_workflow() {
        let db_path = temp_db_path("reset_wf");
        cleanup_db(&db_path);

        create_database(&db_path, "password".to_string()).unwrap();
        assert!(db_path.exists());

        // Reset = delete file
        std::fs::remove_file(&db_path).unwrap();
        assert!(!db_path.exists());

        cleanup_db(&db_path);
    }
}
