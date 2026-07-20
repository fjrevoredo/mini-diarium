use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v7 → v8: Add `custom_fonts` table for user-uploaded font BLOBs.
///
/// Custom fonts are stored as raw BLOBs (unencrypted — font data is not sensitive).
/// Only Regular and Bold weights are supported. The `UNIQUE(family, weight)` constraint
/// supports `INSERT OR REPLACE` semantics in `import_custom_font`.
pub(super) fn migrate_v7_to_v8(db: &DatabaseConnection) -> Result<(), String> {
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(7);

    if version < 8 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE IF NOT EXISTS custom_fonts (
                     id         INTEGER PRIMARY KEY AUTOINCREMENT,
                     family     TEXT NOT NULL,
                     weight     TEXT NOT NULL CHECK(weight IN ('Regular','Bold')),
                     data       BLOB NOT NULL,
                     created_at TEXT NOT NULL,
                     UNIQUE(family, weight)
                 );
                 UPDATE schema_version SET version = 8;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v7→v8 failed: {}", e))?;
        info!("Migrated database from v7 to v8 (added custom_fonts table)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v7_to_v8;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    fn setup_v7_db() -> DatabaseConnection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (7);
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
                 PRIMARY KEY (entry_id, tag_id));",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v7_to_v8_creates_table() {
        let db = setup_v7_db();

        migrate_v7_to_v8(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 8);

        let exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='custom_fonts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            exists, 1,
            "custom_fonts table must exist after v7→v8 migration"
        );
    }

    #[test]
    fn test_migrate_v7_to_v8_is_idempotent() {
        let db = setup_v7_db();

        migrate_v7_to_v8(&db).unwrap();
        migrate_v7_to_v8(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 8,
            "version must remain 8 after second migration call"
        );
    }
}
