use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v8 → v9: Add nullable `entry_metadata_encrypted` BLOB column to `entries`.
///
/// This column stores per-entry font defaults (family and size) encrypted with the
/// journal master key using context `"entry_metadata"`. NULL means no entry override.
pub(super) fn migrate_v8_to_v9(db: &DatabaseConnection) -> Result<(), String> {
    let version = super::read_schema_version(db)?;

    if version < 9 {
        super::run_migration_transaction(db, "Migration v8→v9", |conn| {
            conn.execute(
                "ALTER TABLE entries ADD COLUMN entry_metadata_encrypted BLOB",
                [],
            )
            .map_err(|e| format!("Migration v8→v9 failed: {}", e))?;
            conn.execute("UPDATE schema_version SET version = 9", [])
                .map_err(|e| format!("Migration v8→v9 failed: {}", e))?;
            Ok(())
        })?;
        info!("Migrated database from v8 to v9 (added entry_metadata_encrypted column)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v8_to_v9;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    fn setup_v8_db() -> DatabaseConnection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (8);
             CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE auth_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
                 label TEXT NOT NULL, public_key BLOB, wrapped_key BLOB NOT NULL,
                 created_at TEXT NOT NULL, last_used TEXT);
             CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
                 title_encrypted BLOB, text_encrypted BLOB, word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL, date_updated TEXT NOT NULL);
             CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name_encrypted BLOB NOT NULL, name_fingerprint TEXT NOT NULL UNIQUE,
                 created_at TEXT NOT NULL);
             CREATE TABLE entry_tags (entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
                 PRIMARY KEY (entry_id, tag_id));
             CREATE TABLE custom_fonts (id INTEGER PRIMARY KEY AUTOINCREMENT, family TEXT NOT NULL,
                 weight TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL,
                 UNIQUE(family, weight));",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v8_to_v9_adds_column() {
        let db = setup_v8_db();

        // Insert a row before migration to verify existing rows survive with NULL metadata
        db.conn()
            .execute(
                "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
                 VALUES ('2024-01-01', x'aabb', x'ccdd', 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')",
                [],
            )
            .unwrap();

        migrate_v8_to_v9(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 9);

        // Column must exist
        let col_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('entries') WHERE name='entry_metadata_encrypted'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            col_exists, 1,
            "entry_metadata_encrypted column must exist after migration"
        );

        // Existing row has NULL metadata
        let meta_null: Option<Vec<u8>> = db
            .conn()
            .query_row(
                "SELECT entry_metadata_encrypted FROM entries LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            meta_null.is_none(),
            "existing rows must have NULL metadata after migration"
        );
    }

    #[test]
    fn test_migrate_v8_to_v9_is_idempotent() {
        let db = setup_v8_db();

        migrate_v8_to_v9(&db).unwrap();
        migrate_v8_to_v9(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 9,
            "version must remain 9 after second migration call"
        );
    }

    #[test]
    fn test_migrate_v8_to_v9_rolls_back_after_statement_failure() {
        let db = setup_v8_db();
        db.conn()
            .execute(
                "ALTER TABLE entries ADD COLUMN entry_metadata_encrypted BLOB",
                [],
            )
            .unwrap();

        let err = migrate_v8_to_v9(&db).unwrap_err();
        assert!(err.contains("Migration v8→v9 failed"), "got: {}", err);

        db.conn().execute("BEGIN IMMEDIATE", []).unwrap();
        db.conn().execute("ROLLBACK", []).unwrap();
    }

    #[test]
    fn test_migrate_v8_to_v9_errors_on_malformed_schema_version() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version TEXT PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES ('oops');
             CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
                 title_encrypted BLOB, text_encrypted BLOB, word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL, date_updated TEXT NOT NULL);",
        )
        .unwrap();

        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        let err = migrate_v8_to_v9(&db).unwrap_err();
        assert!(
            err.contains("Failed to read schema version"),
            "got: {}",
            err
        );
    }
}
