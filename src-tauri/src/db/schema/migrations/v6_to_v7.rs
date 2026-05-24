use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v6 → v7: Add `tags` and `entry_tags` tables for encrypted tagging.
///
/// Tag names are stored as AES-256-GCM encrypted BLOBs. A HKDF-SHA256 keyed
/// fingerprint enforces UNIQUE deduplication at the DB level without revealing
/// the tag name. `ON DELETE CASCADE` keeps `entry_tags` clean automatically.
pub(super) fn migrate_v6_to_v7(db: &DatabaseConnection) -> Result<(), String> {
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(6);

    if version < 7 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE IF NOT EXISTS tags (
                     id                INTEGER PRIMARY KEY AUTOINCREMENT,
                     name_encrypted    BLOB    NOT NULL,
                     name_fingerprint  TEXT    NOT NULL UNIQUE,
                     created_at        TEXT    NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS entry_tags (
                     entry_id  INTEGER NOT NULL,
                     tag_id    INTEGER NOT NULL,
                     PRIMARY KEY (entry_id, tag_id),
                     FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
                     FOREIGN KEY (tag_id)   REFERENCES tags(id)    ON DELETE CASCADE
                 );
                 CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id);
                 UPDATE schema_version SET version = 7;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v6→v7 failed: {}", e))?;
        info!("Migrated database from v6 to v7 (added tags and entry_tags tables)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v6_to_v7;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_migrate_v6_to_v7_creates_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (6);
             CREATE TABLE auth_slots (
                 id          INTEGER PRIMARY KEY AUTOINCREMENT,
                 type        TEXT NOT NULL,
                 label       TEXT NOT NULL,
                 public_key  BLOB,
                 wrapped_key BLOB NOT NULL,
                 created_at  TEXT NOT NULL,
                 last_used   TEXT
             );
             CREATE TABLE entries (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 date TEXT NOT NULL,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL
             );
             CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        )
        .unwrap();
        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        let before: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('tags','entry_tags')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(before, 0);

        migrate_v6_to_v7(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 7);

        let after: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('tags','entry_tags')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            after, 2,
            "tags and entry_tags must exist after v6→v7 migration"
        );

        // Idempotent
        migrate_v6_to_v7(&db).unwrap();
        let version2: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 7);
    }
}
