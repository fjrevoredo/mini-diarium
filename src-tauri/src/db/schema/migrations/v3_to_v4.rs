use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v3 → v4: Drop the plaintext FTS table.
///
/// `entries_fts` stored diary content in plaintext, exposing it to anyone with
/// raw file access. This migration drops the table, purging the leaked data.
/// `DROP TABLE IF EXISTS` makes the migration idempotent.
pub(super) fn migrate_v3_to_v4(db: &DatabaseConnection) -> Result<(), String> {
    // No pre-migration backup is created: this migration is DDL-only and runs
    // inside a single IMMEDIATE transaction. If it fails, SQLite rolls it back
    // automatically, leaving the database unchanged. Contrast with
    // migrate_v2_to_v3, which re-encrypts every entry (not transactionally
    // atomic) and therefore requires a backup before starting.
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(3);

    if version < 4 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 DROP TABLE IF EXISTS entries_fts;
                 UPDATE schema_version SET version = 4;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v3→v4 failed: {}", e))?;
        info!("Migrated database from v3 to v4 (removed plaintext FTS table)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v3_to_v4;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_migrate_v3_to_v4_removes_fts_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (3);
             CREATE TABLE entries (
                 date TEXT PRIMARY KEY,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL
             );
             CREATE VIRTUAL TABLE entries_fts USING fts5(
                 title, text, content='entries', content_rowid='rowid'
             );",
        )
        .unwrap();
        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        migrate_v3_to_v4(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);

        let fts_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entries_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            fts_count, 0,
            "entries_fts should be removed by the v3→v4 migration"
        );
    }
}
