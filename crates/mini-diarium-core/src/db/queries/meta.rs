//! Small read-only introspection queries used by stats and the debug dump.
//!
//! These exist so callers never need a raw `rusqlite::Connection` handle to read
//! the schema version, engine facts, or per-entry (date, word_count) rows.

use crate::db::schema::DatabaseConnection;
use serde::Serialize;

/// Per-feature row counts for the debug dump.
///
/// Every field is a plain `SELECT COUNT(*)` over plaintext columns — **nothing is
/// decrypted**, so no entry text, tag name, or image byte is ever materialised. That is
/// deliberate: `get_all_tags` decrypts every tag name and `list_image_summaries_filtered`
/// decrypts every image BLOB, which is both wasteful and exactly the kind of plaintext
/// handling a diagnostics path should avoid.
#[derive(Debug, Serialize)]
pub struct ContentCounts {
    pub tags: i64,
    pub entry_tag_links: i64,
    pub images: i64,
    pub entry_image_links: i64,
    /// Images still awaiting the v11 lazy thumbnail backfill (`thumbnail_data IS NULL`).
    pub images_missing_thumbnail: i64,
    pub custom_font_families: i64,
    pub custom_font_rows: i64,
    /// Entries with the v13 "lock against accidental edits" flag set.
    pub locked_entries: i64,
    pub entries_with_metadata: i64,
    /// Entries still awaiting the v12 preview backfill (`preview_enc IS NULL`).
    pub entries_missing_preview: i64,
}

/// Reads per-feature row counts for the debug dump.
///
/// See [`ContentCounts`] — counts only, no decryption.
pub fn read_content_counts(db: &DatabaseConnection) -> Result<ContentCounts, String> {
    let conn = db.conn();
    let count = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |row| row.get(0))
            .map_err(|e| format!("Failed to read content counts: {}", e))
    };

    Ok(ContentCounts {
        tags: count("SELECT COUNT(*) FROM tags")?,
        entry_tag_links: count("SELECT COUNT(*) FROM entry_tags")?,
        images: count("SELECT COUNT(*) FROM images")?,
        entry_image_links: count("SELECT COUNT(*) FROM entry_images")?,
        images_missing_thumbnail: count(
            "SELECT COUNT(*) FROM images WHERE thumbnail_data IS NULL",
        )?,
        custom_font_families: count("SELECT COUNT(DISTINCT family) FROM custom_fonts")?,
        custom_font_rows: count("SELECT COUNT(*) FROM custom_fonts")?,
        locked_entries: count("SELECT COUNT(*) FROM entries WHERE locked = 1")?,
        entries_with_metadata: count(
            "SELECT COUNT(*) FROM entries WHERE entry_metadata_encrypted IS NOT NULL",
        )?,
        entries_missing_preview: count("SELECT COUNT(*) FROM entries WHERE preview_enc IS NULL")?,
    })
}

/// Reads the stored schema version from the `schema_version` table.
pub fn read_schema_version(db: &DatabaseConnection) -> Result<i32, String> {
    db.conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read schema version: {}", e))
}

/// Returns `(PRAGMA user_version, sqlite_version())` for diagnostics (debug dump).
///
/// Both values are best-effort engine facts; failures fall back to `-1` /
/// `"unknown"` at the call site, so this returns the raw values without masking.
pub fn read_engine_versions(db: &DatabaseConnection) -> (i32, String) {
    let conn = db.conn();
    let user_version: i32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(-1);
    let sqlite_version: String = conn
        .query_row("SELECT sqlite_version()", [], |r| r.get(0))
        .unwrap_or_else(|_| "unknown".to_string());
    (user_version, sqlite_version)
}

/// Returns `(date, word_count)` for every entry, ordered by date then id (ascending).
///
/// The plaintext `date` and `word_count` columns are not encrypted, so this needs no
/// decryption. Used by statistics and the debug dump to derive counts, totals, streaks,
/// and the entry date range.
pub fn get_entry_date_word_counts(db: &DatabaseConnection) -> Result<Vec<(String, i32)>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT date, word_count FROM entries ORDER BY date ASC, id ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect entries: {}", e))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::{create_database, SCHEMA_VERSION};
    use crate::db::{insert_entry, DiaryEntry};

    fn entry(date: &str, word_count: i32) -> DiaryEntry {
        let now = "2024-01-01T00:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "T".to_string(),
            text: "hello world".to_string(),
            word_count,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        }
    }

    #[test]
    fn test_read_schema_version_matches_constant() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        assert_eq!(read_schema_version(&db).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn test_read_engine_versions_returns_sqlite_version() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let (_user_version, sqlite_version) = read_engine_versions(&db);
        assert!(!sqlite_version.is_empty());
        assert_ne!(sqlite_version, "unknown");
    }

    #[test]
    fn test_get_entry_date_word_counts_orders_and_sums() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-02", 5)).unwrap();
        insert_entry(&db, &entry("2024-01-01", 3)).unwrap();
        insert_entry(&db, &entry("2024-01-01", 7)).unwrap();

        let rows = get_entry_date_word_counts(&db).unwrap();
        assert_eq!(rows.len(), 3);
        // Ordered by date ASC, then id ASC.
        assert_eq!(rows[0], ("2024-01-01".to_string(), 3));
        assert_eq!(rows[1], ("2024-01-01".to_string(), 7));
        assert_eq!(rows[2], ("2024-01-02".to_string(), 5));
        let total: i32 = rows.iter().map(|(_, w)| w).sum();
        assert_eq!(total, 15);
    }

    #[test]
    fn test_get_entry_date_word_counts_empty() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        assert!(get_entry_date_word_counts(&db).unwrap().is_empty());
    }

    #[test]
    fn test_read_content_counts_empty_db() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let counts = read_content_counts(&db).unwrap();
        assert_eq!(counts.tags, 0);
        assert_eq!(counts.entry_tag_links, 0);
        assert_eq!(counts.images, 0);
        assert_eq!(counts.entry_image_links, 0);
        assert_eq!(counts.images_missing_thumbnail, 0);
        assert_eq!(counts.custom_font_families, 0);
        assert_eq!(counts.custom_font_rows, 0);
        assert_eq!(counts.locked_entries, 0);
        assert_eq!(counts.entries_with_metadata, 0);
        assert_eq!(counts.entries_missing_preview, 0);
    }

    #[test]
    fn test_read_content_counts_seeded_db() {
        use crate::db::queries::fonts::upsert_custom_font;
        use crate::db::queries::tags::{add_tag_to_entry, create_tag};
        use crate::db::queries::EntryMetadata;
        use crate::db::set_entry_locked;

        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Two entries via the normal path (both get a preview_enc), one of them locked
        // and one carrying encrypted metadata.
        let plain_id = insert_entry(&db, &entry("2024-01-01", 2)).unwrap();
        let mut with_metadata = entry("2024-01-02", 2);
        with_metadata.metadata = Some(EntryMetadata {
            font_family: Some("Inter".to_string()),
            font_size: None,
        });
        let metadata_id = insert_entry(&db, &with_metadata).unwrap();
        set_entry_locked(&db, metadata_id, true).unwrap();

        // A pre-v12 entry: written straight to SQL so `preview_enc` stays NULL, which is
        // what the backfill-state count is meant to surface.
        db.conn()
            .execute(
                "INSERT INTO entries (date, word_count, date_created, date_updated)
                 VALUES ('2024-01-03', 0, '2024-01-03', '2024-01-03')",
                [],
            )
            .unwrap();

        let tag = create_tag(&db, "travel").unwrap();
        create_tag(&db, "work").unwrap();
        add_tag_to_entry(&db, plain_id, tag.id).unwrap();

        // Images inserted directly: `upsert_image` validates real image bytes, and one row
        // must deliberately lack a thumbnail to exercise the v11 backfill count.
        db.conn()
            .execute(
                "INSERT INTO images (fingerprint, mime_type, data, created_at, thumbnail_data)
                 VALUES ('fp-a', 'image/png', X'00', '2024-01-01', X'01')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO images (fingerprint, mime_type, data, created_at)
                 VALUES ('fp-b', 'image/png', X'00', '2024-01-01')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO entry_images (entry_id, image_id) VALUES (?1, 1)",
                [plain_id],
            )
            .unwrap();

        upsert_custom_font(&db, "MyFont", "Regular", &[1, 2, 3], "2024-01-01").unwrap();
        upsert_custom_font(&db, "MyFont", "Bold", &[1, 2, 3], "2024-01-01").unwrap();
        upsert_custom_font(&db, "OtherFont", "Regular", &[1, 2, 3], "2024-01-01").unwrap();

        let counts = read_content_counts(&db).unwrap();
        assert_eq!(counts.tags, 2);
        assert_eq!(counts.entry_tag_links, 1);
        assert_eq!(counts.images, 2);
        assert_eq!(counts.entry_image_links, 1);
        assert_eq!(counts.images_missing_thumbnail, 1);
        assert_eq!(counts.custom_font_families, 2);
        assert_eq!(counts.custom_font_rows, 3);
        assert_eq!(counts.locked_entries, 1);
        assert_eq!(counts.entries_with_metadata, 1);
        assert_eq!(counts.entries_missing_preview, 1);
    }
}
