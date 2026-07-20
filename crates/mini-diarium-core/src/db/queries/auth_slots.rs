use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Returns the (id, wrapped_key) of the first password slot, or `None` if absent.
pub fn get_password_slot(db: &DatabaseConnection) -> Result<Option<(i64, Vec<u8>)>, String> {
    let result = db.conn().query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'password' ORDER BY id ASC LIMIT 1",
        [],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Returns the (id, wrapped_key) of the keypair slot matching `pub_key`, or `None`.
pub fn get_keypair_slot_by_pubkey(
    db: &DatabaseConnection,
    pub_key: &[u8],
) -> Result<Option<(i64, Vec<u8>)>, String> {
    let result = db.conn().query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'keypair' AND public_key = ?1 LIMIT 1",
        params![pub_key],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Updates the `wrapped_key` of an auth slot (used by change_password).
pub fn update_auth_slot_wrapped_key(
    db: &DatabaseConnection,
    slot_id: i64,
    wrapped_key: &[u8],
) -> Result<(), String> {
    db.conn()
        .execute(
            "UPDATE auth_slots SET wrapped_key = ?1 WHERE id = ?2",
            params![wrapped_key, slot_id],
        )
        .map_err(|e| format!("Failed to update auth slot: {}", e))?;
    Ok(())
}

/// Inserts a new auth slot and returns its row id.
pub fn insert_auth_slot(
    db: &DatabaseConnection,
    slot_type: &str,
    label: &str,
    public_key: Option<&[u8]>,
    wrapped_key: &[u8],
    created_at: &str,
) -> Result<i64, String> {
    db.conn()
        .execute(
            "INSERT INTO auth_slots (type, label, public_key, wrapped_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![slot_type, label, public_key, wrapped_key, created_at],
        )
        .map_err(|e| format!("Failed to insert auth slot: {}", e))?;
    Ok(db.conn().last_insert_rowid())
}

/// Lists all auth slots (without `wrapped_key` for security).
pub fn list_auth_slots(
    db: &DatabaseConnection,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT id, type, label, public_key, created_at, last_used FROM auth_slots ORDER BY id ASC",
        )
        .map_err(|e| format!("Failed to prepare: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let pub_key: Option<Vec<u8>> = row.get(3)?;
            Ok(crate::auth::AuthMethodInfo {
                id: row.get(0)?,
                slot_type: row.get(1)?,
                label: row.get(2)?,
                public_key_hex: pub_key.map(|k| hex::encode(&k)),
                created_at: row.get(4)?,
                last_used: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query auth slots: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect auth slots: {}", e))?;

    Ok(rows)
}

/// Deletes an auth slot by id.
pub fn delete_auth_slot(db: &DatabaseConnection, slot_id: i64) -> Result<(), String> {
    db.conn()
        .execute("DELETE FROM auth_slots WHERE id = ?1", params![slot_id])
        .map_err(|e| format!("Failed to delete auth slot: {}", e))?;
    Ok(())
}

/// Returns the total number of auth slots.
pub fn count_auth_slots(db: &DatabaseConnection) -> Result<i64, String> {
    db.conn()
        .query_row("SELECT COUNT(*) FROM auth_slots", [], |row| row.get(0))
        .map_err(|e| format!("Database error: {}", e))
}

/// Updates the `last_used` timestamp for a slot.
pub fn update_slot_last_used(conn: &rusqlite::Connection, slot_id: i64) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE auth_slots SET last_used = ?1 WHERE id = ?2",
        params![&now, slot_id],
    )
    .map_err(|e| format!("Failed to update last_used: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_auth_slots_crud() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Initially one password slot from create_database
        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);

        // list_auth_slots returns the password slot
        let slots = list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].slot_type, "password");
        assert_eq!(slots[0].label, "Password");
        assert!(slots[0].public_key_hex.is_none());

        // Insert a fake keypair slot
        let fake_pub_key = [7u8; 32];
        let fake_wrapped = [9u8; 60]; // arbitrary
        let now = "2024-01-01T00:00:00Z";
        let slot_id = insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&fake_pub_key),
            &fake_wrapped,
            now,
        )
        .unwrap();
        assert!(slot_id > 0);

        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 2);

        let slots = list_auth_slots(&db).unwrap();
        let keypair_slot = slots.iter().find(|s| s.slot_type == "keypair").unwrap();
        assert_eq!(keypair_slot.label, "My Key");
        assert_eq!(keypair_slot.public_key_hex, Some(hex::encode(fake_pub_key)));

        // Update last_used
        update_slot_last_used(db.conn(), slot_id).unwrap();
        let slots = list_auth_slots(&db).unwrap();
        let updated = slots.iter().find(|s| s.id == slot_id).unwrap();
        assert!(updated.last_used.is_some());

        // Delete the keypair slot
        delete_auth_slot(&db, slot_id).unwrap();
        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_password_slot() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_password_slot(&db).unwrap();
        assert!(result.is_some());
        let (id, wrapped_key) = result.unwrap();
        assert!(id > 0);
        assert!(!wrapped_key.is_empty());

        // The wrapped key should be unwrappable with the correct password
        let method = crate::auth::password::PasswordMethod::new("test".to_string());
        let master_key = method.unwrap_master_key(&wrapped_key).unwrap();
        assert_eq!(master_key.len(), 32);
    }

    #[test]
    fn test_update_auth_slot_wrapped_key() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "old_password".to_string()).unwrap();

        let (slot_id, old_wrapped) = get_password_slot(&db).unwrap().unwrap();

        // Re-wrap with new password
        let old_method = crate::auth::password::PasswordMethod::new("old_password".to_string());
        let master_key = old_method.unwrap_master_key(&old_wrapped).unwrap();

        let new_method = crate::auth::password::PasswordMethod::new("new_password".to_string());
        let new_wrapped = new_method.wrap_master_key(&master_key).unwrap();

        update_auth_slot_wrapped_key(&db, slot_id, &new_wrapped).unwrap();

        // New wrapped key should work with new password
        let (_, stored_wrapped) = get_password_slot(&db).unwrap().unwrap();
        let recovered = new_method.unwrap_master_key(&stored_wrapped).unwrap();
        assert_eq!(master_key, recovered);

        // Old password should no longer work
        let fail = old_method.unwrap_master_key(&stored_wrapped);
        assert!(fail.is_err());
    }

    #[test]
    fn test_update_slot_last_used_sets_timestamp() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Get the password slot id created by create_database
        let (slot_id, _) = get_password_slot(&db).unwrap().unwrap();

        // Fresh slot: last_used must be NULL
        let last_used_before: Option<String> = db
            .conn()
            .query_row(
                "SELECT last_used FROM auth_slots WHERE id = ?1",
                rusqlite::params![slot_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            last_used_before.is_none(),
            "expected last_used to be NULL on a fresh slot"
        );

        // Update last_used
        update_slot_last_used(db.conn(), slot_id).unwrap();

        // last_used must now be non-null
        let last_used_after: Option<String> = db
            .conn()
            .query_row(
                "SELECT last_used FROM auth_slots WHERE id = ?1",
                rusqlite::params![slot_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            last_used_after.is_some(),
            "expected last_used to be set after update_slot_last_used"
        );
    }
}
