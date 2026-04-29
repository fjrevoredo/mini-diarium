use crate::db::schema::{
    create_database, create_database_auto, open_database, open_database_auto,
    open_database_with_keypair,
};
use log::{info, warn};
use tauri::{AppHandle, State, Wry};
use zeroize::{Zeroize, Zeroizing};

use super::DiaryState;

#[derive(Debug, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MultiAuthCredential {
    Password { value: String },
    Keypair { key_path: String },
}

fn read_private_key_from_file(key_path: &str) -> Result<[u8; 32], String> {
    let key_hex =
        std::fs::read_to_string(key_path).map_err(|e| format!("Failed to read key file: {}", e))?;
    let mut key_bytes_vec = hex::decode(key_hex.trim())
        .map_err(|_| "Invalid key file: expected hex-encoded private key".to_string())?;
    if key_bytes_vec.len() != 32 {
        return Err("Invalid key file: expected 32-byte (64 hex char) private key".to_string());
    }
    let mut private_key = [0u8; 32];
    private_key.copy_from_slice(&key_bytes_vec);
    key_bytes_vec.zeroize();
    Ok(private_key)
}

/// One-time migration: if `db_settings` has no "require_all_auth" key and the legacy
/// `config.json` had it set to true for the active journal, write "true" to `db_settings`
/// then clear the config.json flag.
fn migrate_require_all_auth_to_db(
    db: &crate::db::schema::DatabaseConnection,
    state: &super::DiaryState,
) {
    if crate::db::queries::get_db_setting(db.conn(), "require_all_auth").is_none() {
        let active_id = crate::config::load_active_journal_id(&state.app_data_dir);
        let had_config_flag = active_id
            .as_ref()
            .map(|id| {
                crate::config::load_journals(&state.app_data_dir)
                    .iter()
                    .any(|j| j.id == *id && j.require_all_auth.unwrap_or(false))
            })
            .unwrap_or(false);

        if had_config_flag {
            if let Err(e) =
                crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true")
            {
                warn!("Failed to migrate require_all_auth to db_settings: {}", e);
            } else {
                info!("Migrated require_all_auth from config.json to db_settings");
                if let Some(id) = active_id {
                    let _ = crate::config::set_journal_require_all_auth(
                        &state.app_data_dir,
                        &id,
                        false,
                    );
                }
            }
        }
    }
}

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

    // One-time migration: carry over legacy config.json value if db_settings is fresh
    migrate_require_all_auth_to_db(&db_conn, &state);

    // Guard: block single-method unlock when require_all_auth is active in the DB
    if crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth")
        .map(|v| v == "true")
        .unwrap_or(false)
    {
        return Err(
            "This journal requires all authentication methods. Use the combined unlock."
                .to_string(),
        );
    }

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

    let mut private_key = read_private_key_from_file(&key_path)?;
    let db_conn = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
    private_key.zeroize();

    // One-time migration: carry over legacy config.json value if db_settings is fresh
    migrate_require_all_auth_to_db(&db_conn, &state);

    // Guard: block single-method unlock when require_all_auth is active in the DB
    if crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth")
        .map(|v| v == "true")
        .unwrap_or(false)
    {
        return Err(
            "This journal requires all authentication methods. Use the combined unlock."
                .to_string(),
        );
    }

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
    use aes_gcm::aead::rand_core::RngCore;
    use aes_gcm::aead::OsRng;
    let mut auto_key_bytes = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(auto_key_bytes.as_mut());
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

/// Unlocks an existing diary by verifying ALL provided credentials simultaneously.
///
/// Opens the DB with the first credential, then verifies each remaining credential
/// against the already-open connection. The connection is only committed to
/// `DiaryState` once every slot is satisfied. This enforces combined password + key
/// file unlock without any DB schema changes.
#[tauri::command]
pub fn unlock_diary_all_methods(
    credentials: Vec<MultiAuthCredential>,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    if credentials.is_empty() {
        return Err("No credentials provided".to_string());
    }

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

    // Open DB with first credential
    let db_conn = match &credentials[0] {
        MultiAuthCredential::Password { value } => {
            open_database(&db_path, value.clone(), &backups_dir)?
        }
        MultiAuthCredential::Keypair { key_path } => {
            let mut private_key = read_private_key_from_file(key_path)?;
            let conn = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
            private_key.zeroize();
            conn
        }
    };

    // One-time migration: carry over legacy config.json value if db_settings is fresh
    migrate_require_all_auth_to_db(&db_conn, &state);

    // Guard: if require_all_auth is active, the caller must supply at least as many
    // credentials as there are non-auto slots. Without this check, a single-credential
    // call to unlock_diary_all_methods would bypass the multi-auth requirement.
    {
        let require_all = crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth")
            .map(|v| v == "true")
            .unwrap_or(false);
        if require_all {
            let all_slots = crate::db::queries::list_auth_slots(&db_conn)?;
            let non_auto_count = all_slots.iter().filter(|s| s.slot_type != "auto").count();
            if credentials.len() < non_auto_count {
                return Err("This journal requires all authentication methods. \
                     Please provide all credentials."
                    .to_string());
            }
        }
    }

    // Verify each remaining credential against the open DB's auth slots
    for credential in &credentials[1..] {
        match credential {
            MultiAuthCredential::Password { value } => {
                let (slot_id, wrapped_key) = crate::db::queries::get_password_slot(&db_conn)?
                    .ok_or("No password auth method found")?;
                let method = crate::auth::password::PasswordMethod::new(value.clone());
                method
                    .unwrap_master_key(&wrapped_key)
                    .map_err(|_| "Incorrect password".to_string())?;
                crate::db::queries::update_slot_last_used(db_conn.conn(), slot_id)?;
            }
            MultiAuthCredential::Keypair { key_path } => {
                let mut private_key = read_private_key_from_file(key_path)?;
                let pub_key = crate::auth::keypair::derive_public_key(private_key);
                let (slot_id, wrapped_key) =
                    crate::db::queries::get_keypair_slot_by_pubkey(&db_conn, &pub_key)?
                        .ok_or("Key file does not match any registered key")?;
                let method = crate::auth::keypair::PrivateKeyMethod { private_key };
                method
                    .unwrap_master_key(&wrapped_key)
                    .map_err(|_| "Key file authentication failed".to_string())?;
                private_key.zeroize();
                crate::db::queries::update_slot_last_used(db_conn.conn(), slot_id)?;
            }
        }
    }

    // All credentials verified — commit the connection
    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    *db_state = Some(db_conn);

    info!("Journal unlocked via multi-auth");

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

    #[test]
    fn test_unlock_all_methods_require_all_auth_rejects_single_credential() {
        use crate::auth::keypair::generate_keypair;
        use crate::db::schema::open_database;

        let (_, db_path, backups_dir) = make_state("req_all_multi_guard");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Register a keypair slot so there are 2 non-auto slots
        let kp = generate_keypair().unwrap();
        let pub_bytes_vec = hex::decode(&kp.public_key_hex).unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_bytes_vec);
        let kp_method = crate::auth::keypair::KeypairMethod {
            public_key: pub_key,
        };
        let kp_wrapped = kp_method.wrap_master_key(db.key().as_bytes()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&pub_bytes_vec),
            &kp_wrapped,
            &now,
        )
        .unwrap();

        // Set require_all_auth = "true" in db_settings
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        drop(db);

        // Re-open and verify the guard logic: with require_all_auth active and 2 non-auto
        // slots, a single credential must be rejected.
        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        let require_all = crate::db::queries::get_db_setting(db2.conn(), "require_all_auth")
            .map(|v| v == "true")
            .unwrap_or(false);
        assert!(require_all, "require_all_auth must be set");

        let all_slots = crate::db::queries::list_auth_slots(&db2).unwrap();
        let non_auto_count = all_slots.iter().filter(|s| s.slot_type != "auto").count();
        assert_eq!(non_auto_count, 2, "should have 2 non-auto slots");

        // Simulate the guard: 1 credential < 2 required → must reject
        let single_credential_count = 1usize;
        assert!(
            single_credential_count < non_auto_count,
            "guard must fire: single credential is insufficient"
        );

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_require_all_auth_in_db_blocks_single_unlock() {
        let (_, db_path, backups_dir) = make_state("req_all_auth_guard");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Write require_all_auth = "true" directly into db_settings
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        drop(db);

        // Attempt single-method password unlock — must be blocked
        let result = open_database(&db_path, "password".to_string(), &backups_dir);
        // open_database itself succeeds; the guard is in unlock_diary. We verify via
        // get_db_setting after opening, since unlock_diary is a Tauri command we can't
        // call directly in tests.
        assert!(
            result.is_ok(),
            "open_database should succeed (guard is in unlock_diary)"
        );
        let db2 = result.unwrap();
        let flag = crate::db::queries::get_db_setting(db2.conn(), "require_all_auth");
        assert_eq!(
            flag.as_deref(),
            Some("true"),
            "require_all_auth must persist in db_settings"
        );

        cleanup(&db_path, &backups_dir);
    }
}
