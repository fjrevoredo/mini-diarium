use super::timeline::preview_from_html;
use super::{count_words, encrypt_metadata, get_entry_by_id, DiaryEntry, EntryMetadata};
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

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
    let title_encrypted =
        crate::db::queries::encrypt_for_storage(db.key(), entry.title.as_bytes(), "title")?;
    let text_encrypted =
        crate::db::queries::encrypt_for_storage(db.key(), entry.text.as_bytes(), "text")?;
    let metadata_encrypted = encrypt_metadata(db, &entry.metadata)?;
    let preview = preview_from_html(&entry.text);
    let preview_enc =
        crate::db::queries::encrypt_for_storage(db.key(), preview.as_bytes(), "entry_preview")?;

    // Update in database using id
    let rows_affected = db
        .conn()
        .execute(
            "UPDATE entries
             SET title_encrypted = ?1, text_encrypted = ?2, word_count = ?3, date_updated = ?4,
                 entry_metadata_encrypted = ?5, preview_enc = ?6
             WHERE id = ?7",
            params![
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_updated,
                &metadata_encrypted,
                &preview_enc,
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

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;
    use rusqlite::params;

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

    /// Two distinct images in one entry must both end up in entry_images and both be
    /// resolved to data URLs by resolve_image_refs_in_entries.
    #[test]
    fn test_entry_with_two_images_both_resolved_in_print() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2025-01-01");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        // HTML with two different images embedded as data URLs (simulates editor save)
        let b1 = tiny_png_base64();
        let b2 = tiny_png_base64_other();
        let html = format!(
            r#"<p>Text</p><img src="data:image/png;base64,{}" alt=""><img src="data:image/png;base64,{}" alt="">"#,
            b1, b2
        );
        update_entry_with_images(&db, id, "T", &html, None).unwrap();

        // entry_images must have 2 rows
        let link_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entry_images WHERE entry_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(link_count, 2, "both images must be linked in entry_images");

        // resolve_image_refs_in_entries must replace both refs with data URLs
        let saved = get_entry_by_id(&db, id).unwrap().unwrap();
        assert!(
            saved.text.contains("image-id://"),
            "saved text must use image-id:// refs before resolution"
        );
        let resolved_entries =
            crate::db::queries::images::resolve_image_refs_in_entries(&db, vec![saved]).unwrap();
        let resolved_text = &resolved_entries[0].text;

        assert!(
            !resolved_text.contains("image-id://"),
            "after resolution, no image-id:// refs must remain: {}",
            resolved_text
        );
        let data_url_count = resolved_text.matches("data:image/png;base64,").count();
        assert_eq!(
            data_url_count, 2,
            "both images must be resolved to data URLs; resolved HTML: {}",
            resolved_text
        );
    }

    /// Two images wrapped in <figure class="image-container"> (TipTap AlignableImage format)
    /// must both resolve correctly after being stored and retrieved.
    #[test]
    fn test_two_figure_wrapped_images_both_resolved() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2025-02-01");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let b1 = tiny_png_base64();
        let b2 = tiny_png_base64_other();
        // AlignableImage wraps each <img> in <figure class="image-container">
        let html = format!(
            r#"<p>Text</p><figure class="image-container" style="text-align: left;"><img src="data:image/png;base64,{}" alt=""></figure><figure class="image-container"><img src="data:image/png;base64,{}" alt=""></figure>"#,
            b1, b2
        );
        update_entry_with_images(&db, id, "T", &html, None).unwrap();

        let link_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entry_images WHERE entry_id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            link_count, 2,
            "both figure-wrapped images must be linked in entry_images"
        );

        let saved = get_entry_by_id(&db, id).unwrap().unwrap();
        let resolved =
            crate::db::queries::images::resolve_image_refs_in_entries(&db, vec![saved]).unwrap();
        let text = &resolved[0].text;

        assert!(
            !text.contains("image-id://"),
            "no image-id:// refs must remain after resolution"
        );
        assert_eq!(
            text.matches("data:image/png;base64,").count(),
            2,
            "both images must be resolved to data URLs"
        );
    }
}
