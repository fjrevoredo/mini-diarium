use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v4 → v5: Add AUTOINCREMENT id to entries table.
///
/// The old `entries` table used `date TEXT PRIMARY KEY` (one entry per day).
/// The new table uses `id INTEGER PRIMARY KEY AUTOINCREMENT` with an index on
/// `date`, allowing multiple entries per day.
///
/// Existing entries are migrated preserving their content, ordered by
/// `date_created ASC` so the oldest entry on each date gets the lowest id.
pub(super) fn migrate_v4_to_v5(db: &DatabaseConnection) -> Result<(), String> {
    // No pre-migration backup is created: this migration is DDL-only and runs
    // inside a single IMMEDIATE transaction. If it fails, SQLite rolls it back
    // automatically, leaving the database unchanged. Contrast with
    // migrate_v2_to_v3, which re-encrypts every entry (not transactionally
    // atomic) and therefore requires a backup before starting.
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(4);

    if version < 5 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE entries_new (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     date TEXT NOT NULL,
                     title_encrypted BLOB,
                     text_encrypted BLOB,
                     word_count INTEGER DEFAULT 0,
                     date_created TEXT NOT NULL,
                     date_updated TEXT NOT NULL
                 );
                 INSERT INTO entries_new (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
                     SELECT date, title_encrypted, text_encrypted, word_count, date_created, date_updated
                     FROM entries ORDER BY date_created ASC;
                 DROP TABLE entries;
                 ALTER TABLE entries_new RENAME TO entries;
                 CREATE INDEX idx_entries_date ON entries(date);
                 UPDATE schema_version SET version = 5;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v4→v5 failed: {}", e))?;
        info!("Migrated database from v4 to v5 (added AUTOINCREMENT id to entries)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v4_to_v5;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_migrate_v4_to_v5_preserves_entries_in_order() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (4);
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
                 date TEXT PRIMARY KEY,
                 title_encrypted BLOB,
                 text_encrypted BLOB,
                 word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL,
                 date_updated TEXT NOT NULL
             );",
        )
        .unwrap();

        conn.execute(
            "INSERT INTO entries (date, word_count, date_created, date_updated)
             VALUES ('2024-03-01', 1, '2024-03-01T08:00:00Z', '2024-03-01T08:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO entries (date, word_count, date_created, date_updated)
             VALUES ('2024-01-01', 1, '2024-01-01T06:00:00Z', '2024-01-01T06:00:00Z')",
            [],
        )
        .unwrap();

        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        migrate_v4_to_v5(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);

        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        let rows: Vec<(i64, String)> = {
            let mut stmt = db
                .conn()
                .prepare("SELECT id, date_created FROM entries ORDER BY id ASC")
                .unwrap();
            stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };
        assert_eq!(rows.len(), 2);
        assert!(
            rows[0].1.starts_with("2024-01-01"),
            "entry with earlier date_created should get the lower id; got {}",
            rows[0].1
        );
        assert!(rows[1].1.starts_with("2024-03-01"));
    }
}
