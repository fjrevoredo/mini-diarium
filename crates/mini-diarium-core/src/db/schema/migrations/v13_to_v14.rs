use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v13 → v14: Add `attachments` and `entry_attachments` tables.
///
/// `attachments` is a content-addressed encrypted store for non-image files, one physical
/// row per unique file (same HKDF fingerprint scheme as `images`). `entry_attachments`
/// links entries to attachments and carries the per-entry encrypted file name, so the same
/// bytes attached to two entries are stored once but can have different names.
///
/// `entry_attachments.entry_id` is `ON DELETE RESTRICT`, not `CASCADE`. Older apps do not know
/// attachments, so they can treat an attachment-only entry as empty and delete it. With
/// RESTRICT that delete fails and the entry keeps its files; `delete_entry_by_id` removes the
/// links explicitly.
pub(super) fn migrate_v13_to_v14(db: &DatabaseConnection) -> Result<(), String> {
    let version = super::read_schema_version(db)?;

    if version < 14 {
        super::run_migration_transaction(db, "Migration v13→v14", |conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS attachments (
                     id          INTEGER PRIMARY KEY AUTOINCREMENT,
                     fingerprint TEXT    NOT NULL UNIQUE,
                     mime_type   TEXT    NOT NULL,
                     byte_size   INTEGER NOT NULL,
                     data        BLOB    NOT NULL,
                     created_at  TEXT    NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS entry_attachments (
                     entry_id       INTEGER NOT NULL,
                     attachment_id  INTEGER NOT NULL,
                     name_encrypted BLOB    NOT NULL,
                     created_at     TEXT    NOT NULL,
                     PRIMARY KEY (entry_id, attachment_id),
                     -- No cascade: an older app must not delete an entry that has files.
                     FOREIGN KEY (entry_id)      REFERENCES entries(id)     ON DELETE RESTRICT,
                     FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE RESTRICT
                 );
                 CREATE INDEX IF NOT EXISTS idx_entry_attachments_attachment_id
                     ON entry_attachments(attachment_id);",
            )
            .map_err(|e| format!("Migration v13→v14 failed: {}", e))?;
            conn.execute("UPDATE schema_version SET version = 14", [])
                .map_err(|e| format!("Migration v13→v14 failed: {}", e))?;
            Ok(())
        })?;
        info!("Migrated database from v13 to v14 (added attachments and entry_attachments tables)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v13_to_v14;
    use crate::crypto::cipher;
    use crate::db::schema::create::open_connection_in_memory;
    use crate::db::schema::DatabaseConnection;

    fn setup_v13_db() -> DatabaseConnection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (13);
             CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
                 title_encrypted BLOB, text_encrypted BLOB, word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL, date_updated TEXT NOT NULL,
                 entry_metadata_encrypted BLOB, preview_enc BLOB,
                 locked INTEGER NOT NULL DEFAULT 0);",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    fn table_exists(db: &DatabaseConnection, name: &str) -> bool {
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [name],
                |row| row.get(0),
            )
            .unwrap();
        count == 1
    }

    fn version(db: &DatabaseConnection) -> i32 {
        db.conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn test_migrate_v13_to_v14_creates_tables() {
        let db = setup_v13_db();
        migrate_v13_to_v14(&db).unwrap();

        assert_eq!(version(&db), 14);
        assert!(table_exists(&db, "attachments"));
        assert!(table_exists(&db, "entry_attachments"));
        let on_delete: String = db
            .conn()
            .query_row(
                "SELECT on_delete FROM pragma_foreign_key_list('entry_attachments') \
                 WHERE \"from\" = 'entry_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(on_delete, "RESTRICT");
    }

    #[test]
    fn test_migrate_v13_to_v14_is_idempotent() {
        let db = setup_v13_db();

        migrate_v13_to_v14(&db).unwrap();
        migrate_v13_to_v14(&db).unwrap();

        assert_eq!(version(&db), 14);
    }

    #[test]
    fn test_migrate_v13_to_v14_rolls_back_after_statement_failure() {
        let db = setup_v13_db();
        // A table with the index's name makes CREATE INDEX fail mid-batch.
        db.conn()
            .execute(
                "CREATE TABLE idx_entry_attachments_attachment_id (id INTEGER PRIMARY KEY)",
                [],
            )
            .unwrap();

        let err = migrate_v13_to_v14(&db).unwrap_err();
        assert!(err.contains("Migration v13→v14 failed"), "got: {}", err);
        assert_eq!(version(&db), 13, "version must stay at 13 after rollback");
        assert!(
            !table_exists(&db, "attachments"),
            "attachments must be rolled back with the failed batch"
        );

        db.conn().execute("BEGIN IMMEDIATE", []).unwrap();
        db.conn().execute("ROLLBACK", []).unwrap();
    }

    #[test]
    fn test_migrate_v13_to_v14_errors_on_malformed_schema_version() {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version TEXT PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES ('oops');",
        )
        .unwrap();
        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        let err = migrate_v13_to_v14(&db).unwrap_err();
        assert!(
            err.contains("Failed to read schema version"),
            "got: {}",
            err
        );
    }
}
