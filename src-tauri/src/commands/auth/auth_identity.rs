use tauri::State;

use super::{with_unlocked_db, DiaryState};

/// Verifies the current password without performing any other operation.
///
/// Used by the frontend to validate credentials before starting multi-step
/// operations (e.g. keypair registration) where early failure is preferable.
#[tauri::command]
pub fn verify_password(password: String, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        let (_, wrapped_key) =
            crate::db::queries::get_password_slot(db)?.ok_or("No password auth method found")?;
        let method = crate::auth::password::PasswordMethod::new(password);
        // The returned SecretBytes is dropped immediately, zeroing memory automatically.
        let _master_key_bytes = method
            .unwrap_master_key(&wrapped_key)
            .map_err(|_| "Incorrect password".to_string())?;
        Ok(())
    })
}

/// Pure inner of `list_auth_methods` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn list_auth_methods_inner(
    state: &DiaryState,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    with_unlocked_db(state, crate::db::queries::list_auth_slots)
}

/// Lists all registered authentication methods (without sensitive key material).
#[tauri::command]
pub fn list_auth_methods(
    state: State<DiaryState>,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    list_auth_methods_inner(&state)
}

/// Reads auth slot types and labels from a locked journal (no key required).
///
/// Opens the SQLite container with a plain connection — the container is not encrypted
/// at the SQLite level; only entry content is AES-256-GCM encrypted at the application
/// layer. Excludes `auto` slots (device-bound keys that never require user input).
/// Returns empty slots and `require_all_auth: false` if the DB file does not yet exist.
/// Does NOT expose wrapped_key or public_key.
#[tauri::command]
pub fn peek_auth_slot_types(state: State<DiaryState>) -> Result<JournalPeek, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if !db_path.exists() {
        return Ok(JournalPeek {
            slots: vec![],
            require_all_auth: false,
        });
    }

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Failed to open journal: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, type, label FROM auth_slots WHERE type != 'auto' ORDER BY id ASC")
        .map_err(|e| format!("Failed to prepare: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(AuthSlotPeek {
                id: row.get(0)?,
                slot_type: row.get(1)?,
                label: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect: {}", e))?;

    let require_all_auth = crate::db::queries::get_db_setting(&conn, "require_all_auth")
        .map(|v| v == "true")
        .unwrap_or(false);

    Ok(JournalPeek {
        slots: rows,
        require_all_auth,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct JournalPeek {
    pub slots: Vec<AuthSlotPeek>,
    pub require_all_auth: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct AuthSlotPeek {
    pub id: i64,
    pub slot_type: String,
    pub label: String,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::schema::create_database;
    use std::path::PathBuf;

    #[test]
    fn test_list_auth_methods_locked_returns_error() {
        let state = super::super::DiaryState::new(
            PathBuf::from("test_list_methods_locked.db"),
            PathBuf::from("test_list_methods_locked_backups"),
            PathBuf::from("."),
        );
        let err = super::list_auth_methods_inner(&state).unwrap_err();
        assert!(err.contains("unlocked"), "got: {}", err);
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
