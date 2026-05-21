mod v1_to_v2;
mod v2_to_v3;
mod v3_to_v4;
mod v4_to_v5;
mod v5_to_v6;
mod v6_to_v7;

pub(crate) use v1_to_v2::migrate_v1_to_v2;
pub(crate) use v2_to_v3::migrate_v2_to_v3;

use crate::db::schema::DatabaseConnection;

/// Applies all pending DDL-only migrations (v3→v4 through v6→v7) in order.
///
/// This covers the idempotent, transactionally-safe migrations. The v1→v2 and
/// v2→v3 migrations have different signatures (require paths and password) and
/// are called explicitly from the v1/v2 open path in `open.rs`.
pub(crate) fn apply_pending(db: &DatabaseConnection) -> Result<(), String> {
    v3_to_v4::migrate_v3_to_v4(db)?;
    v4_to_v5::migrate_v4_to_v5(db)?;
    v5_to_v6::migrate_v5_to_v6(db)?;
    v6_to_v7::migrate_v6_to_v7(db)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::apply_pending;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_apply_pending_advances_v3_to_v7() {
        // Minimal v3 schema: schema_version=3, entries (old style), auth_slots
        // entries_fts is absent — migrate_v3_to_v4 uses DROP TABLE IF EXISTS
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (3);
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
        let db = DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        };

        apply_pending(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 7, "apply_pending must advance schema to v7");

        let table_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('db_settings','tags','entry_tags')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            table_count, 3,
            "db_settings, tags, and entry_tags must all exist after apply_pending"
        );
    }
}
