use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Represents a diary entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiaryEntry {
    pub date: String,         // ISO 8601 date (YYYY-MM-DD)
    pub title: String,        // Plaintext title
    pub text: String,         // Plaintext text
    pub word_count: i32,      // Word count
    pub date_created: String, // ISO 8601 timestamp
    pub date_updated: String, // ISO 8601 timestamp
}

/// Inserts a new entry into the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry to insert
pub fn insert_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    // Encrypt title and text
    let title_encrypted = cipher::encrypt(db.key(), entry.title.as_bytes())
        .map_err(|e| format!("Failed to encrypt title: {}", e))?;

    let text_encrypted = cipher::encrypt(db.key(), entry.text.as_bytes())
        .map_err(|e| format!("Failed to encrypt text: {}", e))?;

    // Insert into database
    db.conn()
        .execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &entry.date,
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_created,
                &entry.date_updated,
            ],
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

    // Update FTS index with decrypted data
    update_fts_index(db, &entry.date, &entry.title, &entry.text)?;

    Ok(())
}

/// Retrieves an entry from the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `date` - The date of the entry to retrieve (YYYY-MM-DD)
///
/// # Returns
/// `Some(DiaryEntry)` if found, `None` otherwise
pub fn get_entry(db: &DatabaseConnection, date: &str) -> Result<Option<DiaryEntry>, String> {
    let result = db.conn().query_row(
        "SELECT date, title_encrypted, text_encrypted, word_count, date_created, date_updated
         FROM entries WHERE date = ?1",
        params![date],
        |row| {
            let date: String = row.get(0)?;
            let title_encrypted: Vec<u8> = row.get(1)?;
            let text_encrypted: Vec<u8> = row.get(2)?;
            let word_count: i32 = row.get(3)?;
            let date_created: String = row.get(4)?;
            let date_updated: String = row.get(5)?;

            Ok((
                date,
                title_encrypted,
                text_encrypted,
                word_count,
                date_created,
                date_updated,
            ))
        },
    );

    match result {
        Ok((date, title_enc, text_enc, word_count, date_created, date_updated)) => {
            // Decrypt title and text
            let title_bytes = cipher::decrypt(db.key(), &title_enc)
                .map_err(|e| format!("Failed to decrypt title: {}", e))?;

            let text_bytes = cipher::decrypt(db.key(), &text_enc)
                .map_err(|e| format!("Failed to decrypt text: {}", e))?;

            let title = String::from_utf8(title_bytes)
                .map_err(|e| format!("Invalid UTF-8 in title: {}", e))?;

            let text = String::from_utf8(text_bytes)
                .map_err(|e| format!("Invalid UTF-8 in text: {}", e))?;

            Ok(Some(DiaryEntry {
                date,
                title,
                text,
                word_count,
                date_created,
                date_updated,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Updates an existing entry in the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry with updated data
pub fn update_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    // Encrypt title and text
    let title_encrypted = cipher::encrypt(db.key(), entry.title.as_bytes())
        .map_err(|e| format!("Failed to encrypt title: {}", e))?;

    let text_encrypted = cipher::encrypt(db.key(), entry.text.as_bytes())
        .map_err(|e| format!("Failed to encrypt text: {}", e))?;

    // Update in database
    let rows_affected = db
        .conn()
        .execute(
            "UPDATE entries
             SET title_encrypted = ?1, text_encrypted = ?2, word_count = ?3, date_updated = ?4
             WHERE date = ?5",
            params![
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_updated,
                &entry.date,
            ],
        )
        .map_err(|e| format!("Failed to update entry: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("No entry found for date: {}", entry.date));
    }

    // Update FTS index with decrypted data
    update_fts_index(db, &entry.date, &entry.title, &entry.text)?;

    Ok(())
}

/// Deletes an entry from the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `date` - The date of the entry to delete (YYYY-MM-DD)
///
/// # Returns
/// `Ok(true)` if deleted, `Ok(false)` if entry didn't exist
pub fn delete_entry(db: &DatabaseConnection, date: &str) -> Result<bool, String> {
    // Delete from entries table
    let rows_affected = db
        .conn()
        .execute("DELETE FROM entries WHERE date = ?1", params![date])
        .map_err(|e| format!("Failed to delete entry: {}", e))?;

    if rows_affected > 0 {
        // Also delete from FTS table
        db.conn()
            .execute("DELETE FROM entries_fts WHERE date = ?1", params![date])
            .map_err(|e| format!("Failed to delete from FTS: {}", e))?;
    }

    Ok(rows_affected > 0)
}

/// Retrieves all dates that have entries
///
/// # Arguments
/// * `db` - Database connection
///
/// # Returns
/// A vector of date strings (YYYY-MM-DD) sorted chronologically
pub fn get_all_entry_dates(db: &DatabaseConnection) -> Result<Vec<String>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT date FROM entries ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let dates = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query dates: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;

    Ok(dates)
}

/// Updates the FTS index for a specific entry
///
/// Note: This is called after insert/update to populate the FTS table with decrypted data
/// Since the FTS table is standalone (not external content), we manage it manually
fn update_fts_index(
    db: &DatabaseConnection,
    date: &str,
    title: &str,
    text: &str,
) -> Result<(), String> {
    // Check if an FTS entry already exists for this date
    let exists: bool = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM entries_fts WHERE date = ?1",
            params![date],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .map_err(|e| format!("Failed to check FTS existence: {}", e))?;

    if exists {
        // Update existing FTS entry
        db.conn()
            .execute(
                "UPDATE entries_fts SET title = ?1, text = ?2 WHERE date = ?3",
                params![title, text, date],
            )
            .map_err(|e| format!("Failed to update FTS: {}", e))?;
    } else {
        // Insert new FTS entry
        db.conn()
            .execute(
                "INSERT INTO entries_fts (date, title, text) VALUES (?1, ?2, ?3)",
                params![date, title, text],
            )
            .map_err(|e| format!("Failed to insert into FTS: {}", e))?;
    }

    Ok(())
}

/// Counts words in text (simple whitespace-based count)
pub fn count_words(text: &str) -> i32 {
    text.split_whitespace().count() as i32
}

// ─── Auth slot queries ────────────────────────────────────────────────────────

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
pub fn update_slot_last_used(db: &DatabaseConnection, slot_id: i64) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    db.conn()
        .execute(
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
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_queries_{}.db", name)
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn create_test_entry(date: &str) -> DiaryEntry {
        let now = "2024-01-01T12:00:00Z".to_string();
        DiaryEntry {
            date: date.to_string(),
            title: "Test Title".to_string(),
            text: "This is a test entry with some words.".to_string(),
            word_count: 8,
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_insert_and_get_entry() {
        let db_path = temp_db_path("insert_get");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let entry = create_test_entry("2024-01-15");
        insert_entry(&db, &entry).unwrap();

        let retrieved = get_entry(&db, "2024-01-15").unwrap();
        assert!(retrieved.is_some());

        let retrieved_entry = retrieved.unwrap();
        assert_eq!(retrieved_entry.date, "2024-01-15");
        assert_eq!(retrieved_entry.title, "Test Title");
        assert_eq!(
            retrieved_entry.text,
            "This is a test entry with some words."
        );
        assert_eq!(retrieved_entry.word_count, 8);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_get_nonexistent_entry() {
        let db_path = temp_db_path("get_none");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let result = get_entry(&db, "2024-12-31").unwrap();
        assert!(result.is_none());

        cleanup_db(&db_path);
    }

    #[test]
    fn test_update_entry() {
        let db_path = temp_db_path("update");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert initial entry
        let mut entry = create_test_entry("2024-02-10");
        insert_entry(&db, &entry).unwrap();

        // Update the entry
        entry.title = "Updated Title".to_string();
        entry.text = "Updated text content.".to_string();
        entry.word_count = 3;
        entry.date_updated = "2024-02-11T15:00:00Z".to_string();
        update_entry(&db, &entry).unwrap();

        // Retrieve and verify
        let retrieved = get_entry(&db, "2024-02-10").unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
        assert_eq!(retrieved.text, "Updated text content.");
        assert_eq!(retrieved.word_count, 3);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_update_nonexistent_entry() {
        let db_path = temp_db_path("update_none");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let entry = create_test_entry("2024-03-20");
        let result = update_entry(&db, &entry);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No entry found"));

        cleanup_db(&db_path);
    }

    #[test]
    fn test_delete_entry() {
        let db_path = temp_db_path("delete");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert and delete
        let entry = create_test_entry("2024-04-01");
        insert_entry(&db, &entry).unwrap();

        let deleted = delete_entry(&db, "2024-04-01").unwrap();
        assert!(deleted);

        // Verify deletion
        let result = get_entry(&db, "2024-04-01").unwrap();
        assert!(result.is_none());

        cleanup_db(&db_path);
    }

    #[test]
    fn test_delete_nonexistent_entry() {
        let db_path = temp_db_path("delete_none");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let deleted = delete_entry(&db, "2024-05-15").unwrap();
        assert!(!deleted);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_get_all_entry_dates() {
        let db_path = temp_db_path("all_dates");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert multiple entries
        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-05")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();

        let dates = get_all_entry_dates(&db).unwrap();
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-05");
        assert_eq!(dates[1], "2024-01-10");
        assert_eq!(dates[2], "2024-01-20");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_count_words() {
        assert_eq!(count_words("Hello world"), 2);
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("One"), 1);
        assert_eq!(count_words("  Multiple   spaces   between  "), 3);
        assert_eq!(count_words("Line\nbreaks\tand\ttabs"), 4);
    }

    #[test]
    fn test_auth_slots_crud() {
        let db_path = temp_db_path("auth_slots");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

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
        assert_eq!(
            keypair_slot.public_key_hex,
            Some(hex::encode(&fake_pub_key))
        );

        // Update last_used
        update_slot_last_used(&db, slot_id).unwrap();
        let slots = list_auth_slots(&db).unwrap();
        let updated = slots.iter().find(|s| s.id == slot_id).unwrap();
        assert!(updated.last_used.is_some());

        // Delete the keypair slot
        delete_auth_slot(&db, slot_id).unwrap();
        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_get_password_slot() {
        let db_path = temp_db_path("pw_slot");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        let result = get_password_slot(&db).unwrap();
        assert!(result.is_some());
        let (id, wrapped_key) = result.unwrap();
        assert!(id > 0);
        assert!(!wrapped_key.is_empty());

        // The wrapped key should be unwrappable with the correct password
        let method = crate::auth::password::PasswordMethod::new("test".to_string());
        let master_key = method.unwrap_master_key(&wrapped_key).unwrap();
        assert_eq!(master_key.len(), 32);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_update_auth_slot_wrapped_key() {
        let db_path = temp_db_path("update_slot");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "old_password".to_string()).unwrap();

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

        cleanup_db(&db_path);
    }

    #[test]
    fn test_entry_encryption() {
        let db_path = temp_db_path("encryption");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert entry
        let entry = create_test_entry("2024-06-01");
        insert_entry(&db, &entry).unwrap();

        // Read raw encrypted data from database
        let (title_enc, text_enc): (Vec<u8>, Vec<u8>) = db
            .conn()
            .query_row(
                "SELECT title_encrypted, text_encrypted FROM entries WHERE date = '2024-06-01'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        // Encrypted data should not contain plaintext
        let title_enc_str = String::from_utf8_lossy(&title_enc);
        let text_enc_str = String::from_utf8_lossy(&text_enc);
        assert!(!title_enc_str.contains("Test Title"));
        assert!(!text_enc_str.contains("test entry"));

        cleanup_db(&db_path);
    }
}
