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

pub(crate) enum UnlockMode {
    Password(String),
    Keypair(String),
    AllMethods(Vec<MultiAuthCredential>),
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

/// Checks that the supplied credential count satisfies the require-all-auth policy.
///
/// Returns `Ok(())` if the policy is not active or the count is sufficient.
/// Returns `Err(...)` if require_all_auth is active and fewer credentials were provided
/// than there are non-auto auth slots.
pub(crate) fn check_require_all_auth_credential_count(
    credential_count: usize,
    db: &crate::db::schema::DatabaseConnection,
) -> Result<(), String> {
    let require_all = crate::db::queries::verify_require_all_auth(db.conn(), db.key().as_bytes());
    if require_all {
        let all_slots = crate::db::queries::list_auth_slots(db)?;
        let non_auto_count = all_slots.iter().filter(|s| s.slot_type != "auto").count();
        if credential_count < non_auto_count {
            return Err("This journal requires all authentication methods. \
                 Please provide all credentials."
                .to_string());
        }
    }
    Ok(())
}

/// Verifies every credential in `creds` against the already-open `conn`, rejects duplicate
/// slot IDs, and returns the set of satisfied slot IDs.
///
/// Extracted for independent testability — can be called directly without `AppHandle`/`State`.
/// Does not enforce `require_all_auth` slot-coverage policy; that check lives in `perform_unlock`.
pub(crate) fn verify_credentials_and_collect_slots(
    creds: &[MultiAuthCredential],
    conn: &crate::db::schema::DatabaseConnection,
) -> Result<std::collections::HashSet<i64>, String> {
    use std::collections::HashSet;
    let mut satisfied: HashSet<i64> = HashSet::new();

    for cred in creds {
        let slot_id = match cred {
            MultiAuthCredential::Password { value } => {
                let (slot_id, wrapped_key) = crate::db::queries::get_password_slot(conn)?
                    .ok_or("No password auth method found")?;
                let method = crate::auth::password::PasswordMethod::new(value.clone());
                method
                    .unwrap_master_key(&wrapped_key)
                    .map_err(|_| "Incorrect password".to_string())?;
                crate::db::queries::update_slot_last_used(conn.conn(), slot_id)?;
                slot_id
            }
            MultiAuthCredential::Keypair { key_path } => {
                let mut private_key = read_private_key_from_file(key_path)?;
                let pub_key = crate::auth::keypair::derive_public_key(private_key);
                let (slot_id, wrapped_key) =
                    crate::db::queries::get_keypair_slot_by_pubkey(conn, &pub_key)?
                        .ok_or("Key file does not match any registered key")?;
                let method = crate::auth::keypair::PrivateKeyMethod { private_key };
                method
                    .unwrap_master_key(&wrapped_key)
                    .map_err(|_| "Key file authentication failed".to_string())?;
                private_key.zeroize();
                crate::db::queries::update_slot_last_used(conn.conn(), slot_id)?;
                slot_id
            }
        };

        if !satisfied.insert(slot_id) {
            return Err(
                "Duplicate credential: the same auth slot was provided more than once".to_string(),
            );
        }
    }

    Ok(satisfied)
}

/// Opens the DB with the given credentials, runs the require-all-auth guard and migration,
/// installs the connection into `DiaryState`, triggers backup rotation, and updates the menu.
///
/// Shared by `unlock_diary`, `unlock_diary_with_keypair`, and `unlock_diary_all_methods`.
/// `unlock_diary_auto` routes through its own path (P20 policy — no multi-auth check for
/// local-only journals). See `docs/decisions/2026-04-passwordless-journal.md`.
pub(crate) fn perform_unlock(
    mode: UnlockMode,
    state: &DiaryState,
    app: &AppHandle<Wry>,
) -> Result<(), String> {
    // Early validation before acquiring any locks
    if let UnlockMode::AllMethods(ref creds) = mode {
        if creds.is_empty() {
            return Err("No credentials provided".to_string());
        }
    }

    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();

    if !db_path.exists() {
        return Err("No journal found. Please create one first.".to_string());
    }

    let (db_conn, label) = match mode {
        UnlockMode::Password(password) => {
            let conn = open_database(&db_path, password, &backups_dir)?;
            migrate_require_all_auth_to_db(&conn, state);
            if crate::db::queries::verify_require_all_auth(conn.conn(), conn.key().as_bytes()) {
                return Err(
                    "This journal requires all authentication methods. Use the combined unlock."
                        .to_string(),
                );
            }
            (conn, "Journal unlocked")
        }
        UnlockMode::Keypair(key_path) => {
            let mut private_key = read_private_key_from_file(&key_path)?;
            let conn = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
            private_key.zeroize();
            migrate_require_all_auth_to_db(&conn, state);
            if crate::db::queries::verify_require_all_auth(conn.conn(), conn.key().as_bytes()) {
                return Err(
                    "This journal requires all authentication methods. Use the combined unlock."
                        .to_string(),
                );
            }
            (conn, "Journal unlocked with key file")
        }
        UnlockMode::AllMethods(credentials) => {
            let conn = match &credentials[0] {
                MultiAuthCredential::Password { value } => {
                    open_database(&db_path, value.clone(), &backups_dir)?
                }
                MultiAuthCredential::Keypair { key_path } => {
                    let mut private_key = read_private_key_from_file(key_path)?;
                    let c = open_database_with_keypair(&db_path, private_key, &backups_dir)?;
                    private_key.zeroize();
                    c
                }
            };
            migrate_require_all_auth_to_db(&conn, state);
            check_require_all_auth_credential_count(credentials.len(), &conn)?;
            // Verify all credentials, reject duplicate slot IDs, collect satisfied slot IDs.
            let satisfied_slots = verify_credentials_and_collect_slots(&credentials, &conn)?;
            // When require_all_auth is active, every registered non-auto slot must be satisfied.
            if crate::db::queries::verify_require_all_auth(conn.conn(), conn.key().as_bytes()) {
                let all_slots = crate::db::queries::list_auth_slots(&conn)?;
                let non_auto_slot_ids: std::collections::HashSet<i64> = all_slots
                    .iter()
                    .filter(|s| s.slot_type != "auto")
                    .map(|s| s.id)
                    .collect();
                if satisfied_slots != non_auto_slot_ids {
                    return Err("This journal requires all authentication methods. \
                         Please provide all credentials."
                        .to_string());
                }
            }
            // Self-heal: write MAC for existing v6 journals that predate MAC support
            if crate::db::queries::get_db_setting(conn.conn(), "require_all_auth")
                .map(|v| v == "true")
                .unwrap_or(false)
                && crate::db::queries::get_db_setting(conn.conn(), "require_all_auth_mac").is_none()
            {
                if let Err(e) = crate::db::queries::write_require_all_auth_mac(
                    conn.conn(),
                    conn.key().as_bytes(),
                ) {
                    warn!("Failed to write require_all_auth MAC: {}", e);
                }
            }
            (conn, "Journal unlocked via multi-auth")
        }
    };

    let mut db_state = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    *db_state = Some(db_conn);
    drop(db_state);

    info!("{}", label);

    if let Err(e) = crate::backup::backup_and_rotate(&db_path, &backups_dir) {
        warn!("Failed to create backup: {}", e);
    }

    crate::menu::update_menu_lock_state(app, false);
    Ok(())
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
    perform_unlock(UnlockMode::Password(password), &state, &app)
}

/// Unlocks an existing diary using an X25519 private key file
#[tauri::command]
pub fn unlock_diary_with_keypair(
    key_path: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    perform_unlock(UnlockMode::Keypair(key_path), &state, &app)
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

/// Stateless check — returns true if the given file path exists on disk.
/// Used by the frontend to validate a picked `.db` file before adding it as a journal.
#[tauri::command]
pub fn check_diary_path(path: String) -> Result<bool, String> {
    let path = std::path::PathBuf::from(&path);
    Ok(path.is_file())
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
///
/// # Auto-Key Multi-Auth Policy (P20 — 2026-05-21 Position A)
///
/// `unlock_diary_auto` intentionally bypasses `require_all_auth` verification
/// and legacy `migrate_require_all_auth_to_db`. Local-only journals use a
/// device-bound key stored in `config.json` and have no user-facing credential
/// to combine with a second factor. The `require_all_auth` flag only applies to
/// password/keypair journals where the user explicitly registers multiple auth
/// slots. This is a deliberate design boundary: forcing a single-factor local
/// journal through a multi-auth check would always fail. See
/// `docs/refactoring-report-2026-05-21.md` §P20 and
/// `docs/decisions/2026-04-passwordless-journal.md` for the full rationale.
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
    perform_unlock(UnlockMode::AllMethods(credentials), &state, &app)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::schema::{create_database, open_database};

    #[test]
    fn test_check_diary_path() {
        let tmp = std::env::temp_dir();
        // Temp dir exists but is a directory, not a file -- expect false
        assert!(!super::check_diary_path(tmp.to_str().unwrap().to_string()).unwrap());

        // Create a temp file -- expect true
        let file_path = tmp.join("check_diary_test.db");
        std::fs::write(&file_path, b"test").unwrap();
        assert!(super::check_diary_path(file_path.to_str().unwrap().to_string()).unwrap());
        let _ = std::fs::remove_file(&file_path);
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
            metadata: None,
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
    fn test_open_database_auto_ignores_require_all_auth_flag() {
        // Bypass holds because (a) unlock_diary_auto doesn't route through perform_unlock
        // and (b) open_database_auto doesn't check the require_all_auth flag.
        use crate::db::schema::{create_database_auto, open_database_auto};

        let (_, db_path, backups_dir) = make_state("auto_bypass_req_all");
        let auto_key = [0x2au8; 32]; // arbitrary fixed key

        let db = create_database_auto(&db_path, &auto_key).unwrap();
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        drop(db);

        let result = open_database_auto(&db_path, &auto_key, &backups_dir);
        assert!(
            result.is_ok(),
            "auto unlock must not be blocked by require_all_auth: {:?}",
            result.err()
        );

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_check_require_all_auth_rejects_single_credential() {
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

        // Set require_all_auth flag + MAC (MAC is required for verify_require_all_auth)
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes()).unwrap();
        drop(db);

        // Re-open and call the real guard function
        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();

        // 1 credential < 2 non-auto slots → must reject
        let err = super::check_require_all_auth_credential_count(1, &db2).unwrap_err();
        assert!(
            err.contains("requires all authentication methods"),
            "got: {}",
            err
        );

        // 2 credentials == 2 non-auto slots → must pass
        super::check_require_all_auth_credential_count(2, &db2).unwrap();

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

    #[test]
    fn test_duplicate_password_credential_rejected() {
        use crate::auth::keypair::{generate_keypair, KeypairMethod};
        use crate::db::schema::{create_database, open_database};

        let (_, db_path, backups_dir) = make_state("dup_pw_cred");
        let db = create_database(&db_path, "password".to_string()).unwrap();

        let kp = generate_keypair().unwrap();
        let pub_bytes_vec = hex::decode(&kp.public_key_hex).unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_bytes_vec);
        let kp_method = KeypairMethod {
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
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes()).unwrap();
        drop(db);

        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        let creds = vec![
            super::MultiAuthCredential::Password {
                value: "password".to_string(),
            },
            super::MultiAuthCredential::Password {
                value: "password".to_string(),
            },
        ];
        let err = super::verify_credentials_and_collect_slots(&creds, &db2).unwrap_err();
        assert!(err.contains("Duplicate credential"), "got: {}", err);

        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_duplicate_keypair_credential_rejected() {
        use crate::auth::keypair::{generate_keypair, KeypairMethod};
        use crate::db::schema::{create_database, open_database};

        let (_, db_path, backups_dir) = make_state("dup_kp_cred");
        let db = create_database(&db_path, "password".to_string()).unwrap();

        let kp = generate_keypair().unwrap();
        let pub_bytes_vec = hex::decode(&kp.public_key_hex).unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_bytes_vec);
        let kp_method = KeypairMethod {
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
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes()).unwrap();
        drop(db);

        let key_file = std::env::temp_dir().join("test_dup_kp_cred.key");
        std::fs::write(&key_file, &kp.private_key_hex).unwrap();

        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        let key_path = key_file.to_str().unwrap().to_string();
        let creds = vec![
            super::MultiAuthCredential::Keypair {
                key_path: key_path.clone(),
            },
            super::MultiAuthCredential::Keypair {
                key_path: key_path.clone(),
            },
        ];
        let err = super::verify_credentials_and_collect_slots(&creds, &db2).unwrap_err();
        assert!(err.contains("Duplicate credential"), "got: {}", err);

        let _ = std::fs::remove_file(&key_file);
        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_valid_password_and_keypair_satisfies_all_slots() {
        use crate::auth::keypair::{generate_keypair, KeypairMethod};
        use crate::db::schema::{create_database, open_database};

        let (_, db_path, backups_dir) = make_state("valid_pw_kp_creds");
        let db = create_database(&db_path, "password".to_string()).unwrap();

        let kp = generate_keypair().unwrap();
        let pub_bytes_vec = hex::decode(&kp.public_key_hex).unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_bytes_vec);
        let kp_method = KeypairMethod {
            public_key: pub_key,
        };
        let kp_wrapped = kp_method.wrap_master_key(db.key().as_bytes()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let kp_slot_id = crate::db::queries::insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&pub_bytes_vec),
            &kp_wrapped,
            &now,
        )
        .unwrap();
        let (pw_slot_id, _) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes()).unwrap();
        drop(db);

        let key_file = std::env::temp_dir().join("test_valid_pw_kp.key");
        std::fs::write(&key_file, &kp.private_key_hex).unwrap();

        let db2 = open_database(&db_path, "password".to_string(), &backups_dir).unwrap();
        let creds = vec![
            super::MultiAuthCredential::Password {
                value: "password".to_string(),
            },
            super::MultiAuthCredential::Keypair {
                key_path: key_file.to_str().unwrap().to_string(),
            },
        ];
        let satisfied = super::verify_credentials_and_collect_slots(&creds, &db2).unwrap();
        assert_eq!(satisfied.len(), 2);
        assert!(satisfied.contains(&pw_slot_id));
        assert!(satisfied.contains(&kp_slot_id));

        let _ = std::fs::remove_file(&key_file);
        cleanup(&db_path, &backups_dir);
    }
}
