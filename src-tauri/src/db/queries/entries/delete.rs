use crate::db::schema::DatabaseConnection;
use rusqlite::params;

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

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;

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
