use crate::db::schema::{
    create_database, create_database_auto, open_database, open_database_auto,
    open_database_with_keypair,
};
use log::{info, warn};
use tauri::{AppHandle, State, Wry};
use zeroize::{Zeroize, Zeroizing};

use super::DiaryState;

/// Creates a new encrypted diary database
#[tauri::command]
pub fn create_diary(
    password: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if db_path.exists() {
        return Err("Journal already exists".to_string());
    }

    let db_conn = create_database(&db_path, password)?;

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Journal created");
    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

/// Unlocks (opens) an existing diary with a password
#[tauri::command]
pub fn unlock_diary(
    password: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if !db_path.exists() {
        return Err("No journal found. Please create one first.".to_string());
    }

    let db_conn = open_database(&db_path, password, &backups_dir)?;

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Journal unlocked");

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

/// Unlocks an existing diary using an X25519 private key file
#[tauri::command]
pub fn unlock_diary_with_keypair(
    key_path: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if !db_path.exists() {
        return Err("No journal found. Please create one first.".to_string());
    }

    // Read private key hex from file
    let key_hex = std::fs::read_to_string(&key_path)
        .map_err(|e| format!("Failed to read key file: {}", e))?;
    let mut key_bytes_vec = hex::decode(key_hex.trim())
        .map_err(|_| "Invalid key file: expected hex-encoded private key".to_string())?;

    if key_bytes_vec.len() != 32 {
        return Err("Invalid key file: expected 32-byte (64 hex char) private key".to_string());
    }

    let mut private_key = [0u8; 32];
    private_key.copy_from_slice(&key_bytes_vec);
    key_bytes_vec.zeroize();

    let db_conn = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
    private_key.zeroize();

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Journal unlocked with key file");

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

/// Locks the diary (closes the database connection)
#[tauri::command]
pub fn lock_diary(state: State<DiaryState>, app: AppHandle<Wry>) -> Result<(), String> {
    if !super::lock_diary_inner(&state)? {
        return Err("Journal is not unlocked".to_string());
    }

    info!("Journal locked");
    crate::menu::update_menu_lock_state(&app, true);
    super::emit_diary_locked(&app, "manual");
    Ok(())
}

/// Stateless check — returns true if `{dir}/diary.db` exists on disk.
/// Used by the frontend to validate a picked folder before adding it as a journal.
#[tauri::command]
pub fn check_diary_path(dir: String) -> Result<bool, String> {
    let path = std::path::PathBuf::from(&dir);
    Ok(path.join("diary.db").exists())
}

/// Checks if a diary file exists
#[tauri::command]
pub fn diary_exists(state: State<DiaryState>) -> Result<bool, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    Ok(db_path.exists())
}

/// Checks if the diary is currently unlocked
#[tauri::command]
pub fn is_diary_unlocked(state: State<DiaryState>) -> Result<bool, String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    Ok(db_state.is_some())
}

/// Gets the current diary file path
#[tauri::command]
pub fn get_diary_path(state: State<DiaryState>) -> Result<String, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    db_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid journal path".to_string())
}

/// Changes the diary password.
///
/// In v3, this re-wraps the master key with the new password — no entry
/// re-encryption is needed, making it O(1) instead of O(n).
#[tauri::command]
pub fn change_password(
    old_password: String,
    new_password: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state
        .as_ref()
        .ok_or("Journal must be unlocked to change password")?;

    // Find the password slot
    let (slot_id, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;

    // Verify old password and recover master_key
    let old_method = crate::auth::password::PasswordMethod::new(old_password);
    let master_key_bytes = old_method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect current password".to_string())?;

    // Re-wrap master_key with new password
    let new_method = crate::auth::password::PasswordMethod::new(new_password);
    let new_wrapped_key = new_method
        .wrap_master_key(&master_key_bytes)
        .map_err(|e| format!("Failed to re-wrap master key: {}", e))?;
    // master_key_bytes zeroed automatically on drop (SecretBytes)

    // Update the auth slot (no entry re-encryption needed)
    crate::db::queries::update_auth_slot_wrapped_key(db, slot_id, &new_wrapped_key)?;

    info!("Password changed successfully");
    Ok(())
}

/// Resets the diary (deletes the database file)
/// WARNING: This permanently deletes all data!
#[tauri::command]
pub fn reset_diary(state: State<DiaryState>, app: AppHandle<Wry>) -> Result<(), String> {
    let _ = lock_diary(state.clone(), app.clone());

    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if !db_path.exists() {
        return Err("No journal found to reset".to_string());
    }

    std::fs::remove_file(&db_path).map_err(|e| format!("Failed to delete journal: {}", e))?;

    info!("Journal reset");
    crate::menu::update_menu_lock_state(&app, true);
    Ok(())
}

/// Creates a new local-only journal (no user password).
///
/// Generates a 32-byte random local key, saves it to the active JournalConfig
/// in config.json, and creates the database with an 'auto' auth slot.
#[tauri::command]
pub fn create_diary_auto(state: State<DiaryState>, app: AppHandle<Wry>) -> Result<(), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if db_path.exists() {
        return Err("Journal already exists".to_string());
    }

    // Generate a 32-byte random local key.
    // Zeroizing<T> auto-zeroizes on drop — ensures memory is wiped even on early return via `?`.
    use rand::RngCore;
    let mut auto_key_bytes = Zeroizing::new([0u8; 32]);
    rand::rngs::OsRng.fill_bytes(auto_key_bytes.as_mut());
    let auto_key_hex = hex::encode(auto_key_bytes.as_ref());

    // Persist the auto key to the active journal's config entry
    let active_id = crate::config::load_active_journal_id(&state.app_data_dir)
        .ok_or("No active journal configured")?;
    crate::config::save_journal_auto_key(&state.app_data_dir, &active_id, Some(&auto_key_hex))?;

    // Create the database. auto_key_bytes drops (and zeroizes) at end of scope regardless of outcome.
    let db_conn = create_database_auto(&db_path, &auto_key_bytes).map_err(|e| {
        // Roll back config change on failure
        let _ = crate::config::save_journal_auto_key(&state.app_data_dir, &active_id, None);
        e
    })?;
    // auto_key_bytes zeroizes here on drop (Zeroizing<T>)

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Local-only journal created");
    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

/// Unlocks an existing local-only journal.
///
/// Reads the auto key from the active JournalConfig in config.json and
/// uses it to unwrap the master key from the 'auto' auth slot.
#[tauri::command]
pub fn unlock_diary_auto(state: State<DiaryState>, app: AppHandle<Wry>) -> Result<(), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if !db_path.exists() {
        return Err("No journal found. Please create one first.".to_string());
    }

    // Load auto key from config
    let active_id = crate::config::load_active_journal_id(&state.app_data_dir)
        .ok_or("No active journal configured")?;
    let journals = crate::config::load_journals(&state.app_data_dir);
    let auto_key_hex = journals
        .iter()
        .find(|j| j.id == active_id)
        .and_then(|j| j.auto_key.as_deref())
        .ok_or("No local key found for this journal. Has it been set up as local-only?")?
        .to_string();

    // Decode hex → bytes, zeroizing on any exit path
    let auto_key_bytes_vec = Zeroizing::new(
        hex::decode(&auto_key_hex)
            .map_err(|_| "Local key in config is not valid hex".to_string())?,
    );
    if auto_key_bytes_vec.len() != 32 {
        return Err("Local key in config has wrong length".to_string());
    }
    let mut auto_key_bytes = Zeroizing::new([0u8; 32]);
    auto_key_bytes.copy_from_slice(&auto_key_bytes_vec);
    // auto_key_bytes_vec zeroizes here on drop

    let db_conn = open_database_auto(&db_path, &auto_key_bytes, &backups_dir)?;
    // auto_key_bytes zeroizes here on drop

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Local-only journal unlocked");

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::schema::{create_database, open_database};

    #[test]
    fn test_check_diary_path() {
        let tmp = std::env::temp_dir();
        // Temp dir exists but has no diary.db -- expect false
        assert!(!super::check_diary_path(tmp.to_str().unwrap().to_string()).unwrap());
    }

    #[test]
    fn test_create_and_unlock() {
        let (state, db_path, backups_dir) = make_state("create_unlock");

        let db_conn = create_database(&db_path, "password".to_string()).unwrap();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(db_conn);
        }
        assert!(db_path.exists());

        // Lock and reopen
        {
            let mut db = state.db.lock().unwrap();
            *db = None;
        }

        let db_conn2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(db_conn2);
        }

        let db = state.db.lock().unwrap();
        assert!(db.is_some());
        drop(db);

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_lock_diary_inner_locks_when_unlocked() {
        let (state, db_path, backups_dir) = make_state("lock_inner_unlocked");
        let db_conn = create_database(&db_path, "password".to_string()).unwrap();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(db_conn);
        }

        let did_lock = super::super::lock_diary_inner(&state).unwrap();
        assert!(did_lock);
        assert!(state.db.lock().unwrap().is_none());

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_lock_diary_inner_noop_when_already_locked() {
        let (state, db_path, backups_dir) = make_state("lock_inner_locked");

        let did_lock = super::super::lock_diary_inner(&state).unwrap();
        assert!(!did_lock);

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_wrong_password() {
        let (_, db_path, backups_dir) = make_state("wrong_pw");

        create_database(&db_path, "correct".to_string()).unwrap();

        let result = open_database(&db_path, "wrong".to_string(), &backups_dir);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Incorrect password"));

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_change_password_v3() {
        let (_, db_path, backups_dir) = make_state("change_pw_v3");

        // Create database
        let db = create_database(&db_path, "old_password".to_string()).unwrap();

        // Add a test entry
        let entry = crate::db::queries::DiaryEntry {
            id: 0,
            date: "2024-01-01".to_string(),
            title: "Test Entry".to_string(),
            text: "Test content".to_string(),
            word_count: 2,
            date_created: "2024-01-01T00:00:00Z".to_string(),
            date_updated: "2024-01-01T00:00:00Z".to_string(),
        };
        crate::db::queries::insert_entry(&db, &entry).unwrap();

        // Change password using v3 re-wrapping (no re-encryption)
        let (slot_id, wrapped_key) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
        let old_method = crate::auth::password::PasswordMethod::new("old_password".to_string());
        let master_key = old_method.unwrap_master_key(&wrapped_key).unwrap();
        let new_method = crate::auth::password::PasswordMethod::new("new_password".to_string());
        let new_wrapped = new_method.wrap_master_key(&master_key).unwrap();
        crate::db::queries::update_auth_slot_wrapped_key(&db, slot_id, &new_wrapped).unwrap();
        drop(db);

        // Open with new password — entry should still be accessible
        let db2 = open_database(&db_path, "new_password".to_string(), &backups_dir).unwrap();
        let entries = crate::db::queries::get_entries_by_date(&db2, "2024-01-01").unwrap();
        assert_eq!(entries.len(), 1);
        let retrieved = &entries[0];
        assert_eq!(retrieved.title, "Test Entry");
        assert_eq!(retrieved.text, "Test content");

        // Old password should no longer work
        let fail = open_database(&db_path, "old_password".to_string(), &backups_dir);
        assert!(fail.is_err());

        cleanup(&db_path, &backups_dir);
    }
}
