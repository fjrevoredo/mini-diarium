use tauri::State;

use super::{with_unlocked_db, DiaryState};

// The peek result types are core-owned (open-core M2 façade). Re-exported here so the
// command signature and existing `commands::auth::…` paths keep resolving — same pattern
// as `commands/search.rs` re-exporting `SearchResult`.
pub use crate::db::{AuthSlotPeek, JournalPeek};

/// Verifies the current password without performing any other operation.
///
/// Used by the frontend to validate credentials before starting multi-step
/// operations (e.g. keypair registration) where early failure is preferable.
#[tauri::command]
pub fn verify_password(password: String, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        let (_, wrapped_key) =
            crate::db::get_password_slot(db)?.ok_or("No password auth method found")?;
        let method = crate::auth::PasswordMethod::new(password);
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
    with_unlocked_db(state, crate::db::list_auth_slots)
}

/// Lists all registered authentication methods (without sensitive key material).
#[tauri::command]
pub fn list_auth_methods(
    state: State<DiaryState>,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    list_auth_methods_inner(&state)
}

/// Pure inner of `peek_auth_slot_types` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn peek_auth_slot_types_inner(state: &DiaryState) -> Result<JournalPeek, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    crate::db::peek_auth_slot_types(db_path)
}

/// Reads auth slot types and labels from a locked journal (no key required).
///
/// Thin wrapper over `mini_diarium_core::db::peek_auth_slot_types`, which owns the
/// missing-file, `auto`-slot-exclusion, and pre-v6 `db_settings` semantics. Never exposes
/// `wrapped_key` or `public_key`.
#[tauri::command]
pub fn peek_auth_slot_types(state: State<DiaryState>) -> Result<JournalPeek, String> {
    peek_auth_slot_types_inner(&state)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::super::test_helpers::*;
    use crate::db::create_database;

    #[test]
    fn test_peek_auth_slot_types_reads_journal_through_the_facade() {
        let (_fixture, state, db_path, _) = make_state("peek_slots");

        // No journal yet — the façade short-circuits without creating the file.
        let empty = super::peek_auth_slot_types_inner(&state).unwrap();
        assert!(empty.slots.is_empty());
        assert!(!empty.require_all_auth);

        create_database(&db_path, "test".to_string()).unwrap();

        let peek = super::peek_auth_slot_types_inner(&state).unwrap();
        assert_eq!(peek.slots.len(), 1);
        assert_eq!(peek.slots[0].slot_type, "password");
        assert!(!peek.require_all_auth);
    }

    #[test]
    fn test_list_auth_methods_locked_returns_error() {
        let (_fixture, state, _, _) = make_state("list_methods_locked");
        let err = super::list_auth_methods_inner(&state).unwrap_err();
        assert!(err.contains("unlocked"), "got: {}", err);
    }

    #[test]
    fn test_list_auth_methods() {
        use crate::auth::generate_keypair;

        let (_fixture, _, db_path, _) = make_state("list_methods");

        let db = create_database(&db_path, "password".to_string()).unwrap();

        let slots = crate::db::list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].slot_type, "password");

        // Add keypair slot
        let kp = generate_keypair().unwrap();
        let pub_key_vec = hex::decode(&kp.public_key_hex).unwrap();
        let fake_wrapped = [0u8; 92];
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&pub_key_vec),
            &fake_wrapped,
            &now,
        )
        .unwrap();

        let slots = crate::db::list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 2);
        assert!(slots.iter().any(|s| s.slot_type == "keypair"));
        // Wrapped key is NOT in the returned structs (security)
        for slot in &slots {
            // AuthMethodInfo doesn't have wrapped_key field
            let _ = &slot.id;
        }
    }
}
