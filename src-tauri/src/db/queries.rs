use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Represents a diary entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiaryEntry {
    pub date: String,          // ISO 8601 date (YYYY-MM-DD)
    pub title: String,         // Plaintext title
    pub text: String,          // Plaintext text
    pub word_count: i32,       // Word count
    pub date_created: String,  // ISO 8601 timestamp
    pub date_updated: String,  // ISO 8601 timestamp
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
        assert_eq!(retrieved_entry.text, "This is a test entry with some words.");
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
