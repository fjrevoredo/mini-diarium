use log::info;
use tauri::State;

use super::DiaryState;

/// Enables or disables the require-all-auth flag for the active journal.
///
/// When enabled, `unlock_diary` and `unlock_diary_with_keypair` are blocked; the
/// caller must use `unlock_diary_all_methods` instead. Requires at least two
/// non-auto auth methods to be registered. The flag is stored in `db_settings` inside
/// the database file (schema v6+) so it cannot be stripped by config manipulation.
#[tauri::command]
pub fn set_require_all_auth(enabled: bool, state: State<DiaryState>) -> Result<(), String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or("Journal must be unlocked")?;

    if enabled {
        let methods = crate::db::queries::list_auth_slots(db)?;
        let non_auto = methods.iter().filter(|m| m.slot_type != "auto").count();
        if non_auto < 2 {
            return Err(
                "Require-all-auth needs at least two non-auto authentication methods.".to_string(),
            );
        }
    }

    if enabled {
        crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true")?;
        crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes())?;
    } else {
        crate::db::queries::delete_db_setting(db.conn(), "require_all_auth")?;
        crate::db::queries::delete_db_setting(db.conn(), "require_all_auth_mac")?;
    }

    // Best-effort cleanup of legacy config.json value
    if let Some(active_id) = crate::config::load_active_journal_id(&state.app_data_dir) {
        let _ = crate::config::set_journal_require_all_auth(&state.app_data_dir, &active_id, false);
    }

    info!("require_all_auth set to {} in db_settings", enabled);
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_set_require_all_auth_true_writes_valid_mac() {
        let (state, db_path, backups_dir) = make_state("require_all_auth_enable");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Add a second non-auto auth slot (required for enabling)
        let method = crate::auth::password::PasswordMethod::new("second_password".to_string());
        let master_key_bytes = {
            let (_, wrapped_key) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
            crate::auth::password::PasswordMethod::new("password".to_string())
                .unwrap_master_key(&wrapped_key)
                .unwrap()
        };
        let wrapped = method.wrap_master_key(&master_key_bytes).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "password",
            "Second Password",
            None,
            &wrapped,
            &now,
        )
        .unwrap();

        // Enable require_all_auth using the internal db query functions
        {
            let mut db_state = state.db.lock().unwrap();
            *db_state = Some(db);
        }
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::queries::set_db_setting(db_ref.conn(), "require_all_auth", "true").unwrap();
            crate::db::queries::write_require_all_auth_mac(db_ref.conn(), db_ref.key().as_bytes())
                .unwrap();
        }

        // Verify "true" flag is set
        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert_eq!(
            crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth").unwrap(),
            "true"
        );

        // Verify MAC is present (64-char hex string)
        let mac_hex =
            crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth_mac").unwrap();
        assert_eq!(mac_hex.len(), 64);

        // Verify the MAC is valid by checking verify_require_all_auth returns true
        assert!(crate::db::queries::verify_require_all_auth(
            db_ref.conn(),
            db_ref.key().as_bytes()
        ));

        drop(db_guard);
        cleanup(&db_path, &backups_dir);
    }

    #[test]
    fn test_set_require_all_auth_false_deletes_both_rows() {
        let (state, db_path, backups_dir) = make_state("require_all_auth_disable");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Add a second non-auto auth slot
        let method = crate::auth::password::PasswordMethod::new("second_password".to_string());
        let master_key_bytes = {
            let (_, wrapped_key) = crate::db::queries::get_password_slot(&db).unwrap().unwrap();
            crate::auth::password::PasswordMethod::new("password".to_string())
                .unwrap_master_key(&wrapped_key)
                .unwrap()
        };
        let wrapped = method.wrap_master_key(&master_key_bytes).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::queries::insert_auth_slot(
            &db,
            "password",
            "Second Password",
            None,
            &wrapped,
            &now,
        )
        .unwrap();

        // Enable first via internal db query functions
        {
            let mut db_state = state.db.lock().unwrap();
            *db_state = Some(db);
        }
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::queries::set_db_setting(db_ref.conn(), "require_all_auth", "true").unwrap();
            crate::db::queries::write_require_all_auth_mac(db_ref.conn(), db_ref.key().as_bytes())
                .unwrap();
        }

        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert_eq!(
            crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth").unwrap(),
            "true"
        );
        assert!(
            crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth_mac").is_some()
        );
        drop(db_guard);

        // Disable using internal db query functions
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::queries::delete_db_setting(db_ref.conn(), "require_all_auth").unwrap();
            crate::db::queries::delete_db_setting(db_ref.conn(), "require_all_auth_mac").unwrap();
        }

        // Both rows must be deleted
        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert!(crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth").is_none());
        assert!(
            crate::db::queries::get_db_setting(db_ref.conn(), "require_all_auth_mac").is_none()
        );
        drop(db_guard);

        cleanup(&db_path, &backups_dir);
    }
}
