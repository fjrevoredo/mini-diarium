use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v10 → v11: add encrypted thumbnail and image metadata columns.
///
/// Existing image rows are left nullable so summaries can lazily backfill
/// thumbnails and dimensions without a blocking migration step.
pub(super) fn migrate_v10_to_v11(db: &DatabaseConnection) -> Result<(), String> {
    let version = super::read_schema_version(db)?;

    if version < 11 {
        super::run_migration_transaction(db, "Migration v10→v11", |conn| {
            conn.execute_batch(
                "ALTER TABLE images ADD COLUMN thumbnail_data BLOB;
                 ALTER TABLE images ADD COLUMN thumbnail_mime_type TEXT;
                 ALTER TABLE images ADD COLUMN width INTEGER;
                 ALTER TABLE images ADD COLUMN height INTEGER;
                 ALTER TABLE images ADD COLUMN byte_size INTEGER;
                 ALTER TABLE images ADD COLUMN thumbnail_version INTEGER;",
            )
            .map_err(|e| format!("Migration v10→v11 failed: {}", e))?;
            conn.execute("UPDATE schema_version SET version = 11", [])
                .map_err(|e| format!("Migration v10→v11 failed: {}", e))?;
            Ok(())
        })?;
        info!("Migrated database from v10 to v11 (added image thumbnail metadata columns)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v10_to_v11;
    use crate::crypto::cipher;
    use crate::db::schema::create::open_connection_in_memory;
    use crate::db::schema::DatabaseConnection;

    fn setup_v10_db() -> DatabaseConnection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (10);
             CREATE TABLE images (
                 id          INTEGER PRIMARY KEY AUTOINCREMENT,
                 fingerprint TEXT    NOT NULL UNIQUE,
                 mime_type   TEXT    NOT NULL,
                 data        BLOB    NOT NULL,
                 created_at  TEXT    NOT NULL
             );
             CREATE TABLE entries (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 date TEXT NOT NULL,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL,
                 entry_metadata_encrypted BLOB
             );
             CREATE TABLE entry_images (
                 entry_id INTEGER NOT NULL,
                 image_id INTEGER NOT NULL,
                 PRIMARY KEY (entry_id, image_id)
             );",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v10_to_v11_adds_thumbnail_columns() {
        let db = setup_v10_db();

        migrate_v10_to_v11(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 11);

        let column_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('images')
                 WHERE name IN ('thumbnail_data','thumbnail_mime_type','width','height','byte_size','thumbnail_version')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(column_count, 6);
    }

    #[test]
    fn test_migrate_v10_to_v11_is_idempotent() {
        let db = setup_v10_db();

        migrate_v10_to_v11(&db).unwrap();
        migrate_v10_to_v11(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 11);
    }

    #[test]
    fn test_migrate_v10_to_v11_rolls_back_on_failure() {
        let db = setup_v10_db();
        db.conn()
            .execute("ALTER TABLE images ADD COLUMN thumbnail_data BLOB", [])
            .unwrap();

        let err = migrate_v10_to_v11(&db).unwrap_err();
        assert!(err.contains("Migration v10→v11 failed"), "got: {}", err);

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 10);
    }
}
