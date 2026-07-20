use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v5 → v6: Add `db_settings` table for journal-level settings.
///
/// `require_all_auth` moves from `config.json` into the database so it travels
/// with the diary file and cannot be stripped by config manipulation.
pub(super) fn migrate_v5_to_v6(db: &DatabaseConnection) -> Result<(), String> {
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(5);

    if version < 6 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE IF NOT EXISTS db_settings (
                     key   TEXT PRIMARY KEY,
                     value TEXT NOT NULL
                 );
                 UPDATE schema_version SET version = 6;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v5→v6 failed: {}", e))?;
        info!("Migrated database from v5 to v6 (added db_settings table)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v5_to_v6;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_migrate_v5_to_v6_creates_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (5);
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
             );",
        )
        .unwrap();
        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        let before: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='db_settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(before, 0);

        migrate_v5_to_v6(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 6);

        let after: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='db_settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            after, 1,
            "db_settings table must exist after v5→v6 migration"
        );

        // Migration is idempotent
        migrate_v5_to_v6(&db).unwrap();
        let version2: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 6);
    }
}
