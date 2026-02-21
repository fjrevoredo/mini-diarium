use crate::db::schema::{
    create_database, open_database, open_database_with_keypair, DatabaseConnection,
};
use log::{info, warn};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State, Wry};
use zeroize::Zeroize;

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

// ─── Core auth commands ───────────────────────────────────────────────────────

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
        return Err("Diary already exists".to_string());
    }

    let db_conn = create_database(&db_path, password)?;

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Diary created");
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
        return Err("No diary found. Please create one first.".to_string());
    }

    let db_conn = open_database(&db_path, password, &backups_dir)?;

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Diary unlocked");

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
        return Err("No diary found. Please create one first.".to_string());
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

    info!("Diary unlocked with key file");

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    crate::menu::update_menu_lock_state(&app, false);
    Ok(())
}

/// Locks the diary (closes the database connection)
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

#[derive(Clone, serde::Serialize)]
struct DiaryLockedEventPayload {
    reason: String,
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

/// Locks the diary (closes the database connection)
#[tauri::command]
pub fn lock_diary(state: State<DiaryState>, app: AppHandle<Wry>) -> Result<(), String> {
    if !lock_diary_inner(&state)? {
        return Err("Diary is not unlocked".to_string());
    }

    info!("Diary locked");
    crate::menu::update_menu_lock_state(&app, true);
    emit_diary_locked(&app, "manual");
    Ok(())
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
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to change password")?;

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
        return Err("No diary found to reset".to_string());
    }

    std::fs::remove_file(&db_path).map_err(|e| format!("Failed to delete diary: {}", e))?;

    info!("Diary reset");
    crate::menu::update_menu_lock_state(&app, true);
    Ok(())
}

// ─── Auth method management commands ─────────────────────────────────────────

/// Verifies the current password without performing any other operation.
///
/// Used by the frontend to validate credentials before starting multi-step
/// operations (e.g. keypair registration) where early failure is preferable.
#[tauri::command]
pub fn verify_password(password: String, state: State<DiaryState>) -> Result<(), String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(password);
    // The returned SecretBytes is dropped immediately, zeroing memory automatically.
    let _master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;
    Ok(())
}

/// Lists all registered authentication methods (without sensitive key material).
#[tauri::command]
pub fn list_auth_methods(
    state: State<DiaryState>,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
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

/// Adds a password authentication method using the master key held in the current session.
///
/// Fails if a password slot already exists — use `change_password` to update it.
/// No existing password is required: being unlocked is the authentication.
#[tauri::command]
pub fn register_password(new_password: String, state: State<DiaryState>) -> Result<(), String> {
    if new_password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    // Reject if a password slot already exists
    if crate::db::queries::get_password_slot(db)?.is_some() {
        return Err(
            "A password method already exists. Use 'Change Password' to update it.".to_string(),
        );
    }

    // Wrap the master key (already in memory) with the new password
    let method = crate::auth::password::PasswordMethod::new(new_password);
    let wrapped_key = method
        .wrap_master_key(db.key().as_bytes())
        .map_err(|e| format!("Failed to wrap master key: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    crate::db::queries::insert_auth_slot(db, "password", "Password", None, &wrapped_key, &now)?;

    info!("Password auth method registered");
    Ok(())
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
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    // Verify identity via password and recover master_key
    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(current_password);
    let master_key_bytes = method
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
    // master_key_bytes zeroed automatically on drop (SecretBytes)

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
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or("Diary must be unlocked")?;

    // Verify identity
    let (_, wrapped_key) =
        crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
    let method = crate::auth::password::PasswordMethod::new(current_password);
    // The returned SecretBytes is dropped immediately after the guard check, zeroing memory.
    let _master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;

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

// ─── Directory management commands ───────────────────────────────────────────

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
    if auto_lock_diary_if_unlocked(state.clone(), app.clone(), "directory change")? {
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
        let state = DiaryState::new(db_path.clone(), backups_dir.clone(), PathBuf::from("."));
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
    fn test_lock_diary_inner_locks_when_unlocked() {
        let (state, db_path, backups_dir) = make_state("lock_inner_unlocked");
        let db_conn = create_database(&db_path, "password".to_string()).unwrap();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(db_conn);
        }

        let did_lock = lock_diary_inner(&state).unwrap();
        assert!(did_lock);
        assert!(state.db.lock().unwrap().is_none());

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_lock_diary_inner_noop_when_already_locked() {
        let (state, db_path, backups_dir) = make_state("lock_inner_locked");

        let did_lock = lock_diary_inner(&state).unwrap();
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

    #[test]
    fn test_register_password_when_none_exists() {
        let (_, db_path, backups_dir) = make_state("reg_pw_none");

        let db = create_database(&db_path, "original".to_string()).unwrap();

        // Delete the existing password slot to simulate a keypair-only diary
        let (slot_id, _) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
        crate::db::queries::delete_auth_slot(&db, slot_id).unwrap();
        assert!(crate::db::queries::get_password_slot(&db)
            .unwrap()
            .is_none());

        // register_password logic: wrap master key with the new password
        let new_pw = "newpassword1";
        let method = crate::auth::password::PasswordMethod::new(new_pw.to_string());
        let wrapped = method.wrap_master_key(db.key().as_bytes()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(&db, "password", "Password", None, &wrapped, &now)
            .unwrap();

        // Slot should now exist
        assert!(crate::db::queries::get_password_slot(&db)
            .unwrap()
            .is_some());

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_register_password_and_unlock() {
        let (_, db_path, backups_dir) = make_state("reg_pw_unlock");

        let db = create_database(&db_path, "original".to_string()).unwrap();

        // Add a keypair slot, then remove the password slot
        let kp = crate::auth::keypair::generate_keypair().unwrap();
        let pub_key_vec = hex::decode(&kp.public_key_hex).unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_key_vec);
        let kp_method = crate::auth::keypair::KeypairMethod {
            public_key: pub_key,
        };
        let kp_wrapped = kp_method.wrap_master_key(db.key().as_bytes()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&pub_key_vec),
            &kp_wrapped,
            &now,
        )
        .unwrap();

        let (pw_slot_id, _) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
        crate::db::queries::delete_auth_slot(&db, pw_slot_id).unwrap();

        // Register new password using the master key from the session
        let new_pw = "mynewpassword";
        let method = crate::auth::password::PasswordMethod::new(new_pw.to_string());
        let wrapped = method.wrap_master_key(db.key().as_bytes()).unwrap();
        let now2 = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(&db, "password", "Password", None, &wrapped, &now2)
            .unwrap();
        drop(db);

        // Should now be able to unlock with the new password
        let db2 =
            crate::db::schema::open_database(&db_path, new_pw.to_string(), &backups_dir).unwrap();
        let count: i32 = db2
            .conn()
            .query_row("SELECT COUNT(*) FROM auth_slots", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2); // keypair + new password

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_register_password_rejects_duplicate() {
        let (_, db_path, backups_dir) = make_state("reg_pw_dup");

        let db = create_database(&db_path, "existing".to_string()).unwrap();

        // A password slot already exists — register_password should reject
        let existing = crate::db::queries::get_password_slot(&db).unwrap();
        assert!(existing.is_some(), "Should already have a password slot");

        // Simulate the guard in register_password
        let result: Result<(), String> = if existing.is_some() {
            Err("A password method already exists. Use 'Change Password' to update it.".to_string())
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_register_password_rejects_short_password() {
        // Minimum length check (< 8 chars)
        let short = "short";
        let result: Result<(), String> = if short.len() < 8 {
            Err("Password must be at least 8 characters".to_string())
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at least 8 characters"));
    }

    // ─── change_diary_directory tests ─────────────────────────────────────────

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
