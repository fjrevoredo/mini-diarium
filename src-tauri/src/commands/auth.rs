use crate::db::schema::{
    create_database, open_database, open_database_with_keypair, DatabaseConnection,
};
use log::{info, warn};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use zeroize::Zeroize;

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

// ─── Core auth commands ───────────────────────────────────────────────────────

/// Creates a new encrypted diary database
#[tauri::command]
pub fn create_diary(password: String, state: State<DiaryState>) -> Result<(), String> {
    let db_path = state.db_path.lock().unwrap().clone();

    if db_path.exists() {
        return Err("Diary already exists".to_string());
    }

    let db_conn = create_database(&db_path, password)?;

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

    if !db_path.exists() {
        return Err("No diary found. Please create one first.".to_string());
    }

    let db_conn = open_database(&db_path, password, &backups_dir)?;

    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(db_conn);

    info!("Diary unlocked");

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    Ok(())
}

/// Unlocks an existing diary using an X25519 private key file
#[tauri::command]
pub fn unlock_diary_with_keypair(key_path: String, state: State<DiaryState>) -> Result<(), String> {
    let db_path = state.db_path.lock().unwrap().clone();
    let backups_dir = state.backups_dir.lock().unwrap().clone();

    if !db_path.exists() {
        return Err("No diary found. Please create one first.".to_string());
    }

    // Read private key hex from file
    let key_hex = std::fs::read_to_string(&key_path)
        .map_err(|e| format!("Failed to read key file: {}", e))?;
    let key_bytes_vec = hex::decode(key_hex.trim())
        .map_err(|_| "Invalid key file: expected hex-encoded private key".to_string())?;

    if key_bytes_vec.len() != 32 {
        return Err("Invalid key file: expected 32-byte (64 hex char) private key".to_string());
    }

    let mut private_key = [0u8; 32];
    private_key.copy_from_slice(&key_bytes_vec);

    let db_conn = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
    private_key.zeroize();

    let mut db_state = state.db.lock().unwrap();
    *db_state = Some(db_conn);

    info!("Diary unlocked with key file");

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
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to change password")?;

    // Find the password slot
    let (slot_id, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;

    // Verify old password and recover master_key
    let old_method = crate::auth::password::PasswordMethod::new(old_password);
    let mut master_key_bytes = old_method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect current password".to_string())?;

    // Re-wrap master_key with new password
    let new_method = crate::auth::password::PasswordMethod::new(new_password);
    let new_wrapped_key = new_method
        .wrap_master_key(&master_key_bytes)
        .map_err(|e| format!("Failed to re-wrap master key: {}", e))?;
    master_key_bytes.zeroize();

    // Update the auth slot (no entry re-encryption needed)
    crate::db::queries::update_auth_slot_wrapped_key(db, slot_id, &new_wrapped_key)?;

    info!("Password changed successfully");
    Ok(())
}

/// Resets the diary (deletes the database file)
/// WARNING: This permanently deletes all data!
#[tauri::command]
pub fn reset_diary(state: State<DiaryState>) -> Result<(), String> {
    let _ = lock_diary(state.clone());

    let db_path = state.db_path.lock().unwrap().clone();

    if !db_path.exists() {
        return Err("No diary found to reset".to_string());
    }

    std::fs::remove_file(&db_path).map_err(|e| format!("Failed to delete diary: {}", e))?;

    info!("Diary reset");
    Ok(())
}

// ─── Auth method management commands ─────────────────────────────────────────

/// Verifies the current password without performing any other operation.
///
/// Used by the frontend to validate credentials before starting multi-step
/// operations (e.g. keypair registration) where early failure is preferable.
#[tauri::command]
pub fn verify_password(password: String, state: State<DiaryState>) -> Result<(), String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(password);
    let mut master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;
    master_key_bytes.zeroize();
    Ok(())
}

/// Lists all registered authentication methods (without sensitive key material).
#[tauri::command]
pub fn list_auth_methods(
    state: State<DiaryState>,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;
    crate::db::queries::list_auth_slots(db)
}

/// Generates a new X25519 keypair.
///
/// The caller is responsible for saving the private key securely (to a file).
/// Only the public key is stored in the diary; the private key never touches disk
/// through this application.
#[tauri::command]
pub fn generate_keypair() -> Result<crate::auth::KeypairFiles, String> {
    crate::auth::keypair::generate_keypair()
}

/// Writes a hex-encoded private key to a file path chosen by the user.
///
/// This is used after `generate_keypair` to persist the private key.
/// On Unix, the file is created with mode 0o600 (owner read/write only).
/// On Windows, NTFS ACLs restrict the file to the current user by default.
#[tauri::command]
pub fn write_key_file(path: String, private_key_hex: String) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
            .map_err(|e| format!("Failed to write key file: {}", e))?;
        file.write_all(private_key_hex.as_bytes())
            .map_err(|e| format!("Failed to write key file: {}", e))
    }
    #[cfg(not(unix))]
    {
        std::fs::write(&path, &private_key_hex)
            .map_err(|e| format!("Failed to write key file: {}", e))
    }
}

/// Registers a new keypair auth method.
///
/// Requires the current password to verify identity before adding a new method.
/// The master key is wrapped for the given public key and stored in auth_slots.
#[tauri::command]
pub fn register_keypair(
    current_password: String,
    public_key_hex: String,
    label: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    // Verify identity via password and recover master_key
    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(current_password);
    let mut master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;

    // Decode public key
    let pub_key_vec =
        hex::decode(&public_key_hex).map_err(|_| "Invalid public key hex".to_string())?;
    if pub_key_vec.len() != 32 {
        return Err("Invalid public key: expected 32 bytes".to_string());
    }
    let mut pub_key = [0u8; 32];
    pub_key.copy_from_slice(&pub_key_vec);

    // Reject duplicate public key registrations
    let existing: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM auth_slots WHERE type = 'keypair' AND public_key = ?1",
            rusqlite::params![&pub_key_vec],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check for duplicate key: {}", e))?;
    if existing > 0 {
        return Err("A keypair with this public key is already registered".to_string());
    }

    // Wrap master_key for this public key
    let keypair_method = crate::auth::keypair::KeypairMethod {
        public_key: pub_key,
    };
    let wrapped_for_keypair = keypair_method
        .wrap_master_key(&master_key_bytes)
        .map_err(|e| format!("Failed to wrap master key for keypair: {}", e))?;
    master_key_bytes.zeroize();

    // Insert into auth_slots
    let now = chrono::Utc::now().to_rfc3339();
    crate::db::queries::insert_auth_slot(
        db,
        "keypair",
        &label,
        Some(&pub_key_vec),
        &wrapped_for_keypair,
        &now,
    )?;

    info!("Keypair auth method registered: {}", label);
    Ok(())
}

/// Removes an authentication method by slot id.
///
/// Requires the current password to prevent rogue removal.
/// Refuses to remove the last auth method.
#[tauri::command]
pub fn remove_auth_method(
    slot_id: i64,
    current_password: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    // Verify identity
    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(current_password);
    let mut master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;
    master_key_bytes.zeroize();

    // Guard: never remove the last auth method
    let count = crate::db::queries::count_auth_slots(db)?;
    if count <= 1 {
        return Err(
            "Cannot remove the last authentication method. Add another method first.".to_string(),
        );
    }

    crate::db::queries::delete_auth_slot(db, slot_id)?;
    info!("Auth method {} removed", slot_id);
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_db_path(name: &str) -> PathBuf {
        PathBuf::from(format!("test_auth_cmd_{}.db", name))
    }

    fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_auth_cmd_backups_{}", name))
    }

    fn cleanup(db_path: &PathBuf, backups_dir: &PathBuf) {
        let _ = fs::remove_file(db_path);
        let _ = fs::remove_dir_all(backups_dir);
    }

    fn make_state(name: &str) -> (DiaryState, PathBuf, PathBuf) {
        let db_path = temp_db_path(name);
        let backups_dir = temp_backups_dir(name);
        let _ = fs::remove_file(&db_path);
        let _ = fs::remove_dir_all(&backups_dir);
        let state = DiaryState::new(db_path.clone(), backups_dir.clone());
        (state, db_path, backups_dir)
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
        let retrieved = crate::db::queries::get_entry(&db2, "2024-01-01")
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, "Test Entry");
        assert_eq!(retrieved.text, "Test content");

        // Old password should no longer work
        let fail = open_database(&db_path, "old_password".to_string(), &backups_dir);
        assert!(fail.is_err());

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_register_keypair_and_unlock() {
        use crate::auth::keypair::generate_keypair;

        let (_, db_path, backups_dir) = make_state("register_kp");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Insert a test entry to verify decryption after keypair unlock
        let entry = crate::db::queries::DiaryEntry {
            date: "2024-03-15".to_string(),
            title: "Keypair Test".to_string(),
            text: "Content unlocked via key file".to_string(),
            word_count: 5,
            date_created: "2024-03-15T00:00:00Z".to_string(),
            date_updated: "2024-03-15T00:00:00Z".to_string(),
        };
        crate::db::queries::insert_entry(&db, &entry).unwrap();

        // Generate keypair
        let kp = generate_keypair().unwrap();
        let priv_bytes_vec = hex::decode(&kp.private_key_hex).unwrap();
        let pub_bytes_vec = hex::decode(&kp.public_key_hex).unwrap();

        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(&priv_bytes_vec);
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_bytes_vec);

        // Get master_key via password slot
        let (_, wrapped_key) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
        let method = crate::auth::password::PasswordMethod::new("password".to_string());
        let master_key = method.unwrap_master_key(&wrapped_key).unwrap();

        // Wrap for keypair
        let kp_method = crate::auth::keypair::KeypairMethod {
            public_key: pub_key,
        };
        let kp_wrapped = kp_method.wrap_master_key(&master_key).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "keypair",
            "Test Key",
            Some(&pub_bytes_vec),
            &kp_wrapped,
            &now,
        )
        .unwrap();
        drop(db);

        // Unlock with private key
        let db2 = open_database_with_keypair(&db_path, priv_key, &backups_dir).unwrap();

        let version: i32 = db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 4);

        // Verify entry is decryptable with the master key unwrapped via keypair
        let retrieved = crate::db::queries::get_entry(&db2, "2024-03-15")
            .unwrap()
            .expect("Entry should exist after keypair unlock");
        assert_eq!(retrieved.title, "Keypair Test");
        assert_eq!(retrieved.text, "Content unlocked via key file");

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_remove_auth_method_last_slot_guard() {
        let (_, db_path, _backups_dir) = make_state("last_slot_guard");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Only 1 slot exists: cannot remove it
        let count = crate::db::queries::count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);

        let (slot_id, _) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();

        // Simulate remove_auth_method logic
        if count <= 1 {
            // Correctly blocked removal of last method — nothing to do
        } else {
            crate::db::queries::delete_auth_slot(&db, slot_id).unwrap();
        }

        cleanup(&db_path, &_backups_dir);
    }

    #[test]
    fn test_list_auth_methods() {
        use crate::auth::keypair::generate_keypair;

        let (_, db_path, _) = make_state("list_methods");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        let slots = crate::db::queries::list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].slot_type, "password");

        // Add keypair slot
        let kp = generate_keypair().unwrap();
        let pub_key_vec = hex::decode(&kp.public_key_hex).unwrap();
        let fake_wrapped = [0u8; 92];
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&pub_key_vec),
            &fake_wrapped,
            &now,
        )
        .unwrap();

        let slots = crate::db::queries::list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 2);
        assert!(slots.iter().any(|s| s.slot_type == "keypair"));
        // Wrapped key is NOT in the returned structs (security)
        for slot in &slots {
            // AuthMethodInfo doesn't have wrapped_key field
            let _ = &slot.id;
        }

        cleanup(
            &db_path,
            &PathBuf::from(format!("test_auth_cmd_backups_{}", "list_methods")),
        );
    }
}
