use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v11 → v12: add encrypted preview column to the entries table.
///
/// Lazy approach: existing rows keep `preview_enc = NULL` and fall back to
/// full-text decryption in `get_entries_for_timeline` until they are next saved.
pub(super) fn migrate_v11_to_v12(db: &DatabaseConnection) -> Result<(), String> {
    let version = super::read_schema_version(db)?;

    if version < 12 {
        super::run_migration_transaction(db, "Migration v11→v12", |conn| {
            conn.execute_batch("ALTER TABLE entries ADD COLUMN preview_enc BLOB;")
                .map_err(|e| format!("Migration v11→v12 failed: {}", e))?;
            conn.execute("UPDATE schema_version SET version = 12", [])
                .map_err(|e| format!("Migration v11→v12 failed: {}", e))?;
            Ok(())
        })?;
        info!("Migrated database from v11 to v12 (added preview_enc column to entries)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v11_to_v12;
    use crate::crypto::cipher;
    use crate::db::schema::create::open_connection_in_memory;
    use crate::db::schema::DatabaseConnection;

    fn setup_v11_db() -> DatabaseConnection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (11);
             CREATE TABLE entries (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 date TEXT NOT NULL,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL,
                 entry_metadata_encrypted BLOB
             );",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v11_to_v12_adds_preview_enc_column() {
        let db = setup_v11_db();

        migrate_v11_to_v12(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 12);

        let col_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('entries') WHERE name = 'preview_enc'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            col_exists, 1,
            "preview_enc column must exist after migration"
        );
    }

    #[test]
    fn test_migrate_v11_to_v12_is_idempotent() {
        let db = setup_v11_db();

        migrate_v11_to_v12(&db).unwrap();
        migrate_v11_to_v12(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 12);
    }

    #[test]
    fn test_migrate_v11_to_v12_rolls_back_on_failure() {
        let db = setup_v11_db();
        // Pre-add the column to force a failure when the migration tries to add it again.
        db.conn()
            .execute("ALTER TABLE entries ADD COLUMN preview_enc BLOB", [])
            .unwrap();

        let err = migrate_v11_to_v12(&db).unwrap_err();
        assert!(err.contains("Migration v11→v12 failed"), "got: {}", err);

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 11, "version must stay at 11 after rollback");
    }
}
