use super::timeline::preview_from_html;
use super::{count_words, encrypt_metadata, get_entry_by_id, update_entry, DiaryEntry};
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Inserts a new entry into the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry to insert (id field is ignored; AUTOINCREMENT assigns it)
pub fn insert_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    let title_encrypted =
        crate::db::queries::encrypt_for_storage(db.key(), entry.title.as_bytes(), "title")?;
    let text_encrypted =
        crate::db::queries::encrypt_for_storage(db.key(), entry.text.as_bytes(), "text")?;
    let metadata_encrypted = encrypt_metadata(db, &entry.metadata)?;
    let preview = preview_from_html(&entry.text);
    let preview_enc =
        crate::db::queries::encrypt_for_storage(db.key(), preview.as_bytes(), "entry_preview")?;

    // Insert into database (id is handled by AUTOINCREMENT)
    db.conn()
        .execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated, entry_metadata_encrypted, preview_enc)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &entry.date,
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_created,
                &entry.date_updated,
                &metadata_encrypted,
                &preview_enc,
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

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;
    use rusqlite::params;

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

    #[test]
    fn test_insert_entry_with_images_extracts_and_returns_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry = create_test_entry("2024-10-01");
        entry.text = tiny_png_html();
        let id = insert_entry_with_images(&db, &entry).unwrap();
        assert!(id > 0, "returned id must be a valid rowid");

        let stored = get_entry_by_id(&db, id).unwrap().unwrap();
        assert!(
            stored.text.contains("image-id://"),
            "stored text must contain image-id:// ref"
        );
        assert!(
            !stored.text.contains("data:image"),
            "stored text must not contain data URL"
        );
        // word_count must be recomputed against the rewritten text.
        assert_eq!(stored.word_count, count_words(&stored.text));

        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count, 1, "one image row must exist");

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
    fn test_insert_entry_with_images_no_images_unchanged() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry = create_test_entry("2024-10-02");
        entry.text = "<p>Just text, no images.</p>".to_string();
        let id = insert_entry_with_images(&db, &entry).unwrap();
        assert!(id > 0, "returned id must be a valid rowid");

        let stored = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(stored.text, "<p>Just text, no images.</p>");

        let img_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            img_count, 0,
            "no images should be stored for text-only entries"
        );
    }
}
