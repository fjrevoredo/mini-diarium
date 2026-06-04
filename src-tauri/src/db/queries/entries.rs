use crate::db::schema::DatabaseConnection;
use rusqlite::params;

// Shared column projection for all entry queries.
const ENTRY_SELECT: &str =
    "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated, \
     entry_metadata_encrypted FROM entries";

type EntryRow = (
    i64,
    String,
    Vec<u8>,
    Vec<u8>,
    i32,
    String,
    String,
    Option<Vec<u8>>,
);

fn encrypt_metadata(
    db: &DatabaseConnection,
    metadata: &Option<EntryMetadata>,
) -> Result<Option<Vec<u8>>, String> {
    // Normalize here so every writer (insert, update, import, plugin) gets the
    // same validated invariants regardless of call site.
    let metadata = normalize_metadata(metadata.clone());
    match metadata {
        Some(m) => {
            let json = serde_json::to_string(&m)
                .map_err(|e| format!("Failed to serialize entry metadata: {}", e))?;
            Ok(Some(super::encrypt_for_storage(
                db.key(),
                json.as_bytes(),
                "entry_metadata",
            )?))
        }
        None => Ok(None),
    }
}

fn row_to_entry(db: &DatabaseConnection, row: EntryRow) -> Result<DiaryEntry, String> {
    let (id, date, title_enc, text_enc, word_count, date_created, date_updated, metadata_enc) = row;
    let title = super::decrypt_utf8(db.key(), &title_enc, "title")?;
    let text = super::decrypt_utf8(db.key(), &text_enc, "text")?;
    let metadata = match metadata_enc {
        Some(enc) => {
            let json = super::decrypt_utf8(db.key(), &enc, "entry_metadata")?;
            Some(
                serde_json::from_str::<EntryMetadata>(&json)
                    .map_err(|e| format!("Failed to parse entry metadata: {}", e))?,
            )
        }
        None => None,
    };
    Ok(DiaryEntry {
        id,
        date,
        title,
        text,
        word_count,
        date_created,
        date_updated,
        metadata,
    })
}

/// Per-entry font defaults (optional override of app-level defaults)
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct EntryMetadata {
    #[serde(rename = "fontFamily", skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(rename = "fontSize", skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
}

/// Normalizes entry metadata: trims empty family strings to None, clamps font size to 12–24 px.
/// Returns None when both fields are None (no override).
pub fn normalize_metadata(meta: Option<EntryMetadata>) -> Option<EntryMetadata> {
    let mut m = meta?;
    if let Some(ref f) = m.font_family {
        let trimmed = f.trim().to_string();
        m.font_family = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        };
    }
    if let Some(size) = m.font_size {
        m.font_size = Some(size.clamp(12.0, 24.0));
    }
    if m.font_family.is_none() && m.font_size.is_none() {
        None
    } else {
        Some(m)
    }
}

/// Represents a diary entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiaryEntry {
    pub id: i64,              // AUTOINCREMENT primary key
    pub date: String,         // ISO 8601 date (YYYY-MM-DD)
    pub title: String,        // Plaintext title
    pub text: String,         // Plaintext text
    pub word_count: i32,      // Word count
    pub date_created: String, // ISO 8601 timestamp
    pub date_updated: String, // ISO 8601 timestamp
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<EntryMetadata>,
}

/// Inserts a new entry into the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry to insert (id field is ignored; AUTOINCREMENT assigns it)
pub fn insert_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    let title_encrypted = super::encrypt_for_storage(db.key(), entry.title.as_bytes(), "title")?;
    let text_encrypted = super::encrypt_for_storage(db.key(), entry.text.as_bytes(), "text")?;
    let metadata_encrypted = encrypt_metadata(db, &entry.metadata)?;

    // Insert into database (id is handled by AUTOINCREMENT)
    db.conn()
        .execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated, entry_metadata_encrypted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &entry.date,
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_created,
                &entry.date_updated,
                &metadata_encrypted,
            ],
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

    // Search index hook: call search module's index_entry() here when implemented.

    Ok(())
}

/// Inserts a new entry and normalizes any embedded or referenced images atomically.
///
/// This preserves the low-level `insert_entry()` helper for tests and fixtures while giving
/// user-facing import paths the same image-store invariant as normal editor saves.
pub fn insert_entry_with_images(
    db: &DatabaseConnection,
    entry: &DiaryEntry,
) -> Result<i64, String> {
    let result: Result<i64, String> = (|| {
        db.conn()
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|e| format!("BEGIN failed: {}", e))?;

        insert_entry(db, entry)?;
        let entry_id = db.conn().last_insert_rowid();

        let (rewritten, image_ids) =
            crate::db::queries::images::extract_and_replace_image_refs(&entry.text, db)?;

        if rewritten != entry.text || !image_ids.is_empty() {
            let mut stored = get_entry_by_id(db, entry_id)?
                .ok_or_else(|| format!("No entry found with id: {}", entry_id))?;
            stored.text = rewritten;
            stored.word_count = count_words(&stored.text);
            stored.metadata = entry.metadata.clone();
            update_entry(db, &stored)?;
            crate::db::queries::images::replace_entry_image_links(db, entry_id, &image_ids)?;
            crate::db::queries::images::cleanup_orphaned_images(db)?;
        }

        db.conn()
            .execute("COMMIT", [])
            .map_err(|e| format!("COMMIT failed: {}", e))?;

        Ok(entry_id)
    })();

    if result.is_err() {
        let _ = db.conn().execute("ROLLBACK", []);
    }

    result
}

/// Retrieves all entries for a given date, newest-first (ORDER BY id DESC)
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `date` - The date of the entries to retrieve (YYYY-MM-DD)
///
/// # Returns
/// A vector of DiaryEntry (possibly empty if no entries exist for this date)
pub fn get_entries_by_date(db: &DatabaseConnection, date: &str) -> Result<Vec<DiaryEntry>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!(
            "{} WHERE date = ?1 ORDER BY id DESC",
            ENTRY_SELECT
        ))
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map(params![date], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

/// Retrieves a single entry by its id
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `id` - The id of the entry to retrieve
///
/// # Returns
/// `Some(DiaryEntry)` if found, `None` otherwise
pub fn get_entry_by_id(db: &DatabaseConnection, id: i64) -> Result<Option<DiaryEntry>, String> {
    let result = db.conn().query_row(
        &format!("{} WHERE id = ?1", ENTRY_SELECT),
        params![id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
            ))
        },
    );

    match result {
        Ok(row) => Ok(Some(row_to_entry(db, row)?)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Updates an entry and atomically extracts any embedded images.
///
/// Wraps the full update in `BEGIN IMMEDIATE / COMMIT` with an explicit `ROLLBACK`
/// on any failure so the long-lived DiaryState connection is never left in a half-open
/// transaction. `update_entry` is called internally (not a hand-rolled UPDATE) so
/// `entry_metadata_encrypted` is preserved correctly.
pub fn update_entry_with_images(
    db: &DatabaseConnection,
    id: i64,
    title: &str,
    text: &str,
    metadata: Option<EntryMetadata>,
) -> Result<(), String> {
    let result: Result<(), String> = (|| {
        db.conn()
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|e| format!("BEGIN failed: {}", e))?;

        let (rewritten, image_ids) =
            crate::db::queries::images::extract_and_replace_image_refs(text, db)?;
        crate::db::queries::images::replace_entry_image_links(db, id, &image_ids)?;
        crate::db::queries::images::cleanup_orphaned_images(db)?;

        let now = chrono::Utc::now().to_rfc3339();
        let word_count = count_words(&rewritten);
        let mut entry =
            get_entry_by_id(db, id)?.ok_or_else(|| format!("No entry found with id: {}", id))?;
        entry.title = title.to_string();
        entry.text = rewritten;
        entry.word_count = word_count;
        entry.date_updated = now;
        entry.metadata = metadata;
        update_entry(db, &entry)?;

        db.conn()
            .execute("COMMIT", [])
            .map_err(|e| format!("COMMIT failed: {}", e))?;
        Ok(())
    })();

    if result.is_err() {
        let _ = db.conn().execute("ROLLBACK", []);
    }
    result
}

/// Updates an existing entry in the database by id
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry with updated data (id field identifies which entry to update)
pub fn update_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    let title_encrypted = super::encrypt_for_storage(db.key(), entry.title.as_bytes(), "title")?;
    let text_encrypted = super::encrypt_for_storage(db.key(), entry.text.as_bytes(), "text")?;
    let metadata_encrypted = encrypt_metadata(db, &entry.metadata)?;

    // Update in database using id
    let rows_affected = db
        .conn()
        .execute(
            "UPDATE entries
             SET title_encrypted = ?1, text_encrypted = ?2, word_count = ?3, date_updated = ?4,
                 entry_metadata_encrypted = ?5
             WHERE id = ?6",
            params![
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_updated,
                &metadata_encrypted,
                entry.id,
            ],
        )
        .map_err(|e| format!("Failed to update entry: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("No entry found with id: {}", entry.id));
    }

    // Search index hook: call search module's index_entry() here when implemented.

    Ok(())
}

/// Deletes an entry from the database by id, removing any now-orphaned images.
///
/// The `ON DELETE CASCADE` on `entry_images.entry_id` removes association rows when the
/// entry is deleted (requires `PRAGMA foreign_keys = ON`, set by `configure_connection`).
/// `cleanup_orphaned_images` then removes any images with no remaining associations.
/// Both steps are wrapped in a `BEGIN IMMEDIATE / COMMIT` transaction.
///
/// # Returns
/// `Ok(true)` if deleted, `Ok(false)` if entry didn't exist
pub fn delete_entry_by_id(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
    let result: Result<bool, String> = (|| {
        db.conn()
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|e| format!("BEGIN failed: {}", e))?;

        let rows_affected = db
            .conn()
            .execute("DELETE FROM entries WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete entry: {}", e))?;

        // ON DELETE CASCADE removes entry_images rows; cleanup removes orphaned images.
        crate::db::queries::images::cleanup_orphaned_images(db)?;

        db.conn()
            .execute("COMMIT", [])
            .map_err(|e| format!("COMMIT failed: {}", e))?;

        // Search index hook: call search module's remove_entry() here when implemented.

        Ok(rows_affected > 0)
    })();

    if result.is_err() {
        let _ = db.conn().execute("ROLLBACK", []);
    }
    result
}

/// Retrieves all dates that have entries (distinct)
///
/// # Arguments
/// * `db` - Database connection
///
/// # Returns
/// A vector of date strings (YYYY-MM-DD) sorted chronologically
pub fn get_all_entry_dates(db: &DatabaseConnection) -> Result<Vec<String>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT DISTINCT date FROM entries ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let dates = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query dates: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;

    Ok(dates)
}

/// Retrieves and decrypts all diary entries in a single query (avoids N+1)
///
/// # Arguments
/// * `db` - Database connection with encryption key
///
/// # Returns
/// A vector of all diary entries sorted chronologically (date ASC, id ASC)
pub fn get_all_entries(db: &DatabaseConnection) -> Result<Vec<DiaryEntry>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!("{} ORDER BY date ASC, id ASC", ENTRY_SELECT))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

pub fn get_entries_in_range(
    db: &DatabaseConnection,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<Vec<DiaryEntry>, String> {
    let mut sql = String::from(ENTRY_SELECT);
    let mut param_values: Vec<String> = Vec::new();
    let mut has_where = false;

    if let Some(from) = date_from {
        sql.push_str(" WHERE date >= ?");
        param_values.push(from.to_string());
        has_where = true;
    }
    if let Some(to) = date_to {
        if has_where {
            sql.push_str(" AND");
        } else {
            sql.push_str(" WHERE");
        }
        sql.push_str(" date <= ?");
        param_values.push(to.to_string());
    }
    sql.push_str(" ORDER BY date ASC, id ASC");

    let params_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = db
        .conn()
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

/// Counts words in text, skipping HTML tag content.
/// Single-pass state machine: tracks tag state and word boundaries without allocating.
pub fn count_words(text: &str) -> i32 {
    let mut count = 0;
    let mut in_tag = false;
    let mut in_word = false;

    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
            if in_word {
                count += 1;
                in_word = false;
            }
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            if ch.is_whitespace() {
                if in_word {
                    count += 1;
                    in_word = false;
                }
            } else {
                in_word = true;
            }
        }
    }

    if in_word {
        count += 1;
    }

    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    fn create_test_entry(date: &str) -> DiaryEntry {
        let now = "2024-01-01T12:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "Test Title".to_string(),
            text: "This is a test entry with some words.".to_string(),
            word_count: 8,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        }
    }

    #[test]
    fn test_insert_and_get_entries_by_date() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-01-15");
        insert_entry(&db, &entry).unwrap();

        let retrieved = get_entries_by_date(&db, "2024-01-15").unwrap();
        assert_eq!(retrieved.len(), 1);

        let retrieved_entry = &retrieved[0];
        assert!(retrieved_entry.id > 0);
        assert_eq!(retrieved_entry.date, "2024-01-15");
        assert_eq!(retrieved_entry.title, "Test Title");
        assert_eq!(
            retrieved_entry.text,
            "This is a test entry with some words."
        );
        assert_eq!(retrieved_entry.word_count, 8);
    }

    #[test]
    fn test_multiple_entries_same_date() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry1 = create_test_entry("2024-01-15");
        entry1.title = "First entry".to_string();
        insert_entry(&db, &entry1).unwrap();

        let mut entry2 = create_test_entry("2024-01-15");
        entry2.title = "Second entry".to_string();
        insert_entry(&db, &entry2).unwrap();

        let entries = get_entries_by_date(&db, "2024-01-15").unwrap();
        assert_eq!(entries.len(), 2);

        // Ordered by id DESC so second entry is first
        assert_eq!(entries[0].title, "Second entry");
        assert_eq!(entries[1].title, "First entry");
        assert!(entries[0].id > entries[1].id);
    }

    #[test]
    fn test_get_entries_by_date_empty() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_entries_by_date(&db, "2024-12-31").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-02-10");
        insert_entry(&db, &entry).unwrap();
        let inserted_id = db.conn().last_insert_rowid();

        let retrieved = get_entry_by_id(&db, inserted_id).unwrap();
        assert!(retrieved.is_some());
        let e = retrieved.unwrap();
        assert_eq!(e.id, inserted_id);
        assert_eq!(e.date, "2024-02-10");
        assert_eq!(e.title, "Test Title");
    }

    #[test]
    fn test_get_entry_by_id_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_entry_by_id(&db, 99999).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_update_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-02-10");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let mut updated = get_entry_by_id(&db, id).unwrap().unwrap();
        updated.title = "Updated Title".to_string();
        updated.text = "Updated text content.".to_string();
        updated.word_count = 3;
        updated.date_updated = "2024-02-11T15:00:00Z".to_string();
        update_entry(&db, &updated).unwrap();

        let retrieved = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
        assert_eq!(retrieved.text, "Updated text content.");
        assert_eq!(retrieved.word_count, 3);
    }

    #[test]
    fn test_update_nonexistent_entry() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = DiaryEntry {
            id: 99999,
            date: "2024-03-20".to_string(),
            title: "Ghost".to_string(),
            text: "Ghost entry".to_string(),
            word_count: 2,
            date_created: "2024-03-20T00:00:00Z".to_string(),
            date_updated: "2024-03-20T00:00:00Z".to_string(),
            metadata: None,
        };
        let result = update_entry(&db, &entry);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No entry found"));
    }

    #[test]
    fn test_delete_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-04-01");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let deleted = delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        let result = get_entry_by_id(&db, id).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_entry_by_id_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let deleted = delete_entry_by_id(&db, 99999).unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_get_all_entry_dates_distinct() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-05")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();

        let dates = get_all_entry_dates(&db).unwrap();
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-05");
        assert_eq!(dates[1], "2024-01-10");
        assert_eq!(dates[2], "2024-01-20");
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
    fn test_count_words_strips_html() {
        assert_eq!(count_words("<p>Hello world</p>"), 2);
        assert_eq!(count_words("<p>One <strong>two</strong> three</p>"), 3);
        assert_eq!(count_words("<p></p>"), 0);
        assert_eq!(count_words("plain text"), 2);
    }

    #[test]
    fn test_count_words_base64_image() {
        let img = "<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\" />";
        assert_eq!(count_words(img), 0);
        let mixed = "<p>before</p><img src=\"data:image/png;base64,abc123==\" /><p>after</p>";
        assert_eq!(count_words(mixed), 2);
    }

    #[test]
    fn test_count_words_unicode() {
        assert_eq!(count_words("café résumé"), 2);
        assert_eq!(count_words("你好 世界"), 2);
        assert_eq!(
            count_words("word\u{00A0}with\u{2003}unicode\u{3000}spaces"),
            4
        );
    }

    #[test]
    fn test_get_all_entries_returns_all_decrypted() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pw".to_string()).unwrap();
        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-01".into(),
                title: "A".into(),
                text: "<p>Hello</p>".into(),
                word_count: 1,
                date_created: "2024-01-01T00:00:00Z".into(),
                date_updated: "2024-01-01T00:00:00Z".into(),
                metadata: None,
            },
        )
        .unwrap();
        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-02".into(),
                title: "B".into(),
                text: "<p>World</p>".into(),
                word_count: 1,
                date_created: "2024-01-02T00:00:00Z".into(),
                date_updated: "2024-01-02T00:00:00Z".into(),
                metadata: None,
            },
        )
        .unwrap();
        let entries = get_all_entries(&db).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-01");
        assert_eq!(entries[0].title, "A");
        assert!(entries[0].id > 0);
    }

    #[test]
    fn test_entry_encryption() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-06-01");
        insert_entry(&db, &entry).unwrap();

        let (title_enc, text_enc): (Vec<u8>, Vec<u8>) = db
            .conn()
            .query_row(
                "SELECT title_encrypted, text_encrypted FROM entries WHERE date = '2024-06-01'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        let title_enc_str = String::from_utf8_lossy(&title_enc);
        let text_enc_str = String::from_utf8_lossy(&text_enc);
        assert!(!title_enc_str.contains("Test Title"));
        assert!(!text_enc_str.contains("test entry"));
    }

    #[test]
    fn test_get_entries_in_range_no_filter() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, None, None).unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_get_entries_in_range_from_only() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-02-01"), None).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-02-15");
        assert_eq!(entries[1].date, "2024-03-20");
    }

    #[test]
    fn test_get_entries_in_range_to_only() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, None, Some("2024-02-28")).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-10");
        assert_eq!(entries[1].date, "2024-02-15");
    }

    #[test]
    fn test_get_entries_in_range_both_bounds() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();
        insert_entry(&db, &create_test_entry("2024-04-05")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-02-01"), Some("2024-03-31")).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-02-15");
        assert_eq!(entries[1].date, "2024-03-20");
    }

    #[test]
    fn test_get_entries_in_range_no_match() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();

        let entries = get_entries_in_range(&db, Some("2025-01-01"), Some("2025-12-31")).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_get_entries_in_range_inclusive_bounds() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-31")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-01-10"), Some("2024-01-31")).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].date, "2024-01-10");
        assert_eq!(entries[2].date, "2024-01-31");
    }

    #[test]
    fn test_get_all_entries_corrupted_title_returns_error() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pw".to_string()).unwrap();

        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-01".into(),
                title: "Test".into(),
                text: "<p>Content</p>".into(),
                word_count: 1,
                date_created: "2024-01-01T00:00:00Z".into(),
                date_updated: "2024-01-01T00:00:00Z".into(),
                metadata: None,
            },
        )
        .unwrap();

        let id = db.conn().last_insert_rowid();

        db.conn()
            .execute(
                "UPDATE entries SET title_encrypted = x'deadbeef01020304' WHERE id = ?1",
                rusqlite::params![id],
            )
            .unwrap();

        let result = get_all_entries(&db);
        assert!(
            result.is_err(),
            "Expected Err when title_encrypted is corrupted, got Ok with entries: {:?}",
            result.ok()
        );
    }

    // Storage-boundary normalization: insert_entry / update_entry must normalize via
    // encrypt_metadata regardless of how the DiaryEntry was constructed (import, plugin, etc.)

    #[test]
    fn test_insert_normalizes_whitespace_family_to_none() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-01".to_string(),
            title: "T".to_string(),
            text: "T".to_string(),
            word_count: 1,
            date_created: "2024-08-01T00:00:00Z".to_string(),
            date_updated: "2024-08-01T00:00:00Z".to_string(),
            metadata: Some(EntryMetadata {
                font_family: Some("   ".to_string()),
                font_size: None,
            }),
        };
        insert_entry(&db, &entry).unwrap();
        let retrieved = get_entries_by_date(&db, "2024-08-01").unwrap();
        assert_eq!(
            retrieved[0].metadata, None,
            "whitespace-only family must collapse to None"
        );
    }

    #[test]
    fn test_insert_normalizes_size_too_high() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-02".to_string(),
            title: "T".to_string(),
            text: "T".to_string(),
            word_count: 1,
            date_created: "2024-08-02T00:00:00Z".to_string(),
            date_updated: "2024-08-02T00:00:00Z".to_string(),
            metadata: Some(EntryMetadata {
                font_family: None,
                font_size: Some(99.0),
            }),
        };
        insert_entry(&db, &entry).unwrap();
        let retrieved = get_entries_by_date(&db, "2024-08-02").unwrap();
        assert_eq!(
            retrieved[0].metadata.as_ref().unwrap().font_size,
            Some(24.0),
            "font_size 99 must be clamped to 24"
        );
    }

    #[test]
    fn test_insert_normalizes_size_too_low() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-03".to_string(),
            title: "T".to_string(),
            text: "T".to_string(),
            word_count: 1,
            date_created: "2024-08-03T00:00:00Z".to_string(),
            date_updated: "2024-08-03T00:00:00Z".to_string(),
            metadata: Some(EntryMetadata {
                font_family: None,
                font_size: Some(4.0),
            }),
        };
        insert_entry(&db, &entry).unwrap();
        let retrieved = get_entries_by_date(&db, "2024-08-03").unwrap();
        assert_eq!(
            retrieved[0].metadata.as_ref().unwrap().font_size,
            Some(12.0),
            "font_size 4 must be clamped to 12"
        );
    }

    #[test]
    fn test_normalize_metadata_none_stays_none() {
        assert_eq!(normalize_metadata(None), None);
    }

    #[test]
    fn test_normalize_metadata_both_none_collapses() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: None,
        };
        assert_eq!(normalize_metadata(Some(meta)), None);
    }

    #[test]
    fn test_normalize_metadata_empty_family_collapses() {
        let meta = EntryMetadata {
            font_family: Some("  ".to_string()),
            font_size: None,
        };
        assert_eq!(normalize_metadata(Some(meta)), None);
    }

    #[test]
    fn test_normalize_metadata_trims_family() {
        let meta = EntryMetadata {
            font_family: Some("  Merriweather  ".to_string()),
            font_size: None,
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_family.as_deref(), Some("Merriweather"));
    }

    #[test]
    fn test_normalize_metadata_clamps_size_low() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: Some(8.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_size, Some(12.0));
    }

    #[test]
    fn test_normalize_metadata_clamps_size_high() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: Some(48.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_size, Some(24.0));
    }

    #[test]
    fn test_normalize_metadata_valid_passthrough() {
        let meta = EntryMetadata {
            font_family: Some("Georgia".to_string()),
            font_size: Some(16.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_family.as_deref(), Some("Georgia"));
        assert_eq!(result.font_size, Some(16.0));
    }

    #[test]
    fn test_metadata_encrypted_at_rest() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let secret_family = "SecretTestFontFamily";
        let entry = DiaryEntry {
            id: 0,
            date: "2024-07-01".to_string(),
            title: "Title".to_string(),
            text: "Text".to_string(),
            word_count: 1,
            date_created: "2024-07-01T00:00:00Z".to_string(),
            date_updated: "2024-07-01T00:00:00Z".to_string(),
            metadata: Some(EntryMetadata {
                font_family: Some(secret_family.to_string()),
                font_size: Some(16.0),
            }),
        };
        insert_entry(&db, &entry).unwrap();

        let raw: Vec<u8> = db
            .conn()
            .query_row(
                "SELECT entry_metadata_encrypted FROM entries WHERE date = '2024-07-01'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let raw_str = String::from_utf8_lossy(&raw);
        assert!(
            !raw_str.contains(secret_family),
            "raw metadata bytes must not contain plaintext font family"
        );

        // Round-trip decryption must recover the value
        let retrieved = get_entries_by_date(&db, "2024-07-01").unwrap();
        let meta = retrieved[0].metadata.as_ref().unwrap();
        assert_eq!(meta.font_family.as_deref(), Some(secret_family));
        assert_eq!(meta.font_size, Some(16.0));
    }

    // A minimal valid 1×1 PNG as base64 for image-related tests.
    const TINY_PNG_B64: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==";

    fn tiny_png_html() -> String {
        format!(
            r#"<p>Hi</p><img src="data:image/png;base64,{}" alt="">"#,
            TINY_PNG_B64
        )
    }

    #[test]
    fn test_save_entry_extracts_images_atomically() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-01");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let html = tiny_png_html();
        update_entry_with_images(&db, id, "Title", &html, None).unwrap();

        // Text must contain image-id:// and NOT data:
        let saved = get_entry_by_id(&db, id).unwrap().unwrap();
        assert!(
            saved.text.contains("image-id://"),
            "saved text must contain image-id:// ref"
        );
        assert!(
            !saved.text.contains("data:image"),
            "saved text must not contain data URL"
        );

        // images table must have 1 row
        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count, 1, "one image row must exist");

        // entry_images must have 1 row linked to the entry
        let link_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entry_images WHERE entry_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(link_count, 1, "one entry_images row must link to the entry");
    }

    #[test]
    fn test_save_entry_no_images_unchanged() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-02");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let text = "<p>Just text, no images.</p>";
        update_entry_with_images(&db, id, "Title", text, None).unwrap();

        let saved = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(saved.text, text);

        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            img_count, 0,
            "no images should be stored for text-only entries"
        );
    }

    #[test]
    fn test_save_entry_idempotent_same_image() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-03");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let html = tiny_png_html();
        update_entry_with_images(&db, id, "T", &html, None).unwrap();
        update_entry_with_images(&db, id, "T", &html, None).unwrap();

        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            img_count, 1,
            "re-saving same image must not create a second row"
        );
    }

    #[test]
    fn test_save_entry_remove_image() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-04");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        update_entry_with_images(&db, id, "T", &tiny_png_html(), None).unwrap();
        let img_count_before: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count_before, 1);

        // Re-save without the image
        update_entry_with_images(&db, id, "T", "<p>no image now</p>", None).unwrap();
        let img_count_after: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count_after, 0, "orphaned image must be deleted");
    }

    #[test]
    fn test_save_entry_metadata_preserved() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-05");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let meta = Some(EntryMetadata {
            font_family: Some("Merriweather".to_string()),
            font_size: Some(16.0),
        });
        update_entry_with_images(&db, id, "T", "<p>text</p>", meta).unwrap();

        let saved = get_entry_by_id(&db, id).unwrap().unwrap();
        let m = saved.metadata.as_ref().expect("metadata must be preserved");
        assert_eq!(m.font_family.as_deref(), Some("Merriweather"));
        assert_eq!(m.font_size, Some(16.0));
    }

    #[test]
    fn test_delete_entry_cleans_up_images() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-09-06");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        update_entry_with_images(&db, id, "T", &tiny_png_html(), None).unwrap();
        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count, 1);

        delete_entry_by_id(&db, id).unwrap();

        let img_after: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_after, 0, "images must be deleted after entry deletion");
    }

    #[test]
    fn test_delete_entry_keeps_shared_images() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Create two entries sharing the same image via the image store
        let e1 = create_test_entry("2024-09-07");
        insert_entry(&db, &e1).unwrap();
        let id1 = db.conn().last_insert_rowid();

        let e2 = DiaryEntry {
            date: "2024-09-08".to_string(),
            ..create_test_entry("2024-09-08")
        };
        insert_entry(&db, &e2).unwrap();
        let id2 = db.conn().last_insert_rowid();

        // Save the same image into both entries
        let html = tiny_png_html();
        update_entry_with_images(&db, id1, "T", &html, None).unwrap();
        // Entry 2 simulates picker reuse: load the stored data URL and re-embed it verbatim
        let images = crate::db::queries::images::get_images_for_entry(&db, id1).unwrap();
        assert_eq!(images.len(), 1);
        let img = &images[0];
        let data_url = format!("data:{};base64,{}", img.mime_type, img.data_base64);
        let html2 = format!(r#"<p>Entry B</p><img src="{}" alt="">"#, data_url);
        update_entry_with_images(&db, id2, "T", &html2, None).unwrap();

        // Both entries should share one physical image row
        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            img_count, 1,
            "picker reuse must share one physical image row"
        );

        // Delete entry 1 — image must still exist (entry 2 references it)
        delete_entry_by_id(&db, id1).unwrap();
        let img_after: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            img_after, 1,
            "shared image must survive deletion of one entry"
        );
    }
}
