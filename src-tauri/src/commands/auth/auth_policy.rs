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
        let methods = crate::db::list_auth_slots(db)?;
        let non_auto = methods.iter().filter(|m| m.slot_type != "auto").count();
        if non_auto < 2 {
            return Err(
                "Require-all-auth needs at least two non-auto authentication methods.".to_string(),
            );
        }
    }

    if enabled {
        crate::db::set_db_setting(db, "require_all_auth", "true")?;
        crate::db::write_require_all_auth_mac(db)?;
    } else {
        crate::db::delete_db_setting(db, "require_all_auth")?;
        crate::db::delete_db_setting(db, "require_all_auth_mac")?;
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
    use crate::db::create_database;

    #[test]
    fn test_set_require_all_auth_true_writes_valid_mac() {
        let (_fixture, state, db_path, _backups_dir) = make_state("require_all_auth_enable");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Add a second non-auto auth slot (required for enabling)
        crate::auth::add_password_slot(&db, "Second Password", "second_password").unwrap();

        // Enable require_all_auth using the internal db query functions
        {
            let mut db_state = state.db.lock().unwrap();
            *db_state = Some(db);
        }
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::set_db_setting(db_ref, "require_all_auth", "true").unwrap();
            crate::db::write_require_all_auth_mac(db_ref).unwrap();
        }

        // Verify "true" flag is set
        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert_eq!(
            crate::db::get_db_setting(db_ref, "require_all_auth").unwrap(),
            "true"
        );

        // Verify MAC is present (64-char hex string)
        let mac_hex = crate::db::get_db_setting(db_ref, "require_all_auth_mac").unwrap();
        assert_eq!(mac_hex.len(), 64);

        // Verify the MAC is valid by checking verify_require_all_auth returns true
        assert!(crate::db::verify_require_all_auth(db_ref));

        drop(db_guard);
    }

    #[test]
    fn test_set_require_all_auth_false_deletes_both_rows() {
        let (_fixture, state, db_path, _backups_dir) = make_state("require_all_auth_disable");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        // Add a second non-auto auth slot
        crate::auth::add_password_slot(&db, "Second Password", "second_password").unwrap();

        // Enable first via internal db query functions
        {
            let mut db_state = state.db.lock().unwrap();
            *db_state = Some(db);
        }
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::set_db_setting(db_ref, "require_all_auth", "true").unwrap();
            crate::db::write_require_all_auth_mac(db_ref).unwrap();
        }

        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert_eq!(
            crate::db::get_db_setting(db_ref, "require_all_auth").unwrap(),
            "true"
        );
        assert!(crate::db::get_db_setting(db_ref, "require_all_auth_mac").is_some());
        drop(db_guard);

        // Disable using internal db query functions
        {
            let db_guard = state.db.lock().unwrap();
            let db_ref = db_guard.as_ref().unwrap();
            crate::db::delete_db_setting(db_ref, "require_all_auth").unwrap();
            crate::db::delete_db_setting(db_ref, "require_all_auth_mac").unwrap();
        }

        // Both rows must be deleted
        let db_guard = state.db.lock().unwrap();
        let db_ref = db_guard.as_ref().unwrap();
        assert!(crate::db::get_db_setting(db_ref, "require_all_auth").is_none());
        assert!(crate::db::get_db_setting(db_ref, "require_all_auth_mac").is_none());
        drop(db_guard);
    }
}
