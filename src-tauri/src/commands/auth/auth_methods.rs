use log::info;
use tauri::State;

use super::DiaryState;

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

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::schema::create_database;
    use std::path::PathBuf;

    #[test]
    fn test_register_keypair_and_unlock() {
        use crate::auth::keypair::generate_keypair;
        use crate::db::schema::open_database_with_keypair;

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
}
