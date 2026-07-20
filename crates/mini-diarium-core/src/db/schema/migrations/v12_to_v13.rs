use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v12 → v13: add plaintext `locked` column to the entries table.
///
/// The `locked` flag is a per-entry UX affordance against accidental edits — it is
/// **not** a security boundary and is non-sensitive entry metadata (like `word_count`
/// or `date`), so it is stored as a plaintext INTEGER column rather than encrypted.
/// Existing rows default to `0` (unlocked).
pub(super) fn migrate_v12_to_v13(db: &DatabaseConnection) -> Result<(), String> {
    let version = super::read_schema_version(db)?;

    if version < 13 {
        super::run_migration_transaction(db, "Migration v12→v13", |conn| {
            conn.execute_batch("ALTER TABLE entries ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;")
                .map_err(|e| format!("Migration v12→v13 failed: {}", e))?;
            conn.execute("UPDATE schema_version SET version = 13", [])
                .map_err(|e| format!("Migration v12→v13 failed: {}", e))?;
            Ok(())
        })?;
        info!("Migrated database from v12 to v13 (added locked column to entries)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v12_to_v13;
    use crate::crypto::cipher;
    use crate::db::schema::create::open_connection_in_memory;
    use crate::db::schema::DatabaseConnection;

    fn setup_v12_db() -> DatabaseConnection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (12);
             CREATE TABLE entries (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 date TEXT NOT NULL,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL,
                 entry_metadata_encrypted BLOB,
                 preview_enc BLOB
             );",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v12_to_v13_adds_locked_column() {
        let db = setup_v12_db();

        migrate_v12_to_v13(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);

        let col_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('entries') WHERE name = 'locked'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(col_exists, 1, "locked column must exist after migration");
    }

    #[test]
    fn test_migrate_v12_to_v13_is_idempotent() {
        let db = setup_v12_db();

        migrate_v12_to_v13(&db).unwrap();
        migrate_v12_to_v13(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);
    }

    #[test]
    fn test_migrate_v12_to_v13_rolls_back_on_failure() {
        let db = setup_v12_db();
        // Pre-add the column to force a failure when the migration tries to add it again.
        db.conn()
            .execute(
                "ALTER TABLE entries ADD COLUMN locked INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .unwrap();

        let err = migrate_v12_to_v13(&db).unwrap_err();
        assert!(err.contains("Migration v12→v13 failed"), "got: {}", err);

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 12, "version must stay at 12 after rollback");
    }
}
