mod v10_to_v11;
mod v11_to_v12;
mod v1_to_v2;
mod v2_to_v3;
mod v3_to_v4;
mod v4_to_v5;
mod v5_to_v6;
mod v6_to_v7;
mod v7_to_v8;
mod v8_to_v9;
mod v9_to_v10;

pub(crate) use v1_to_v2::migrate_v1_to_v2;
pub(crate) use v2_to_v3::migrate_v2_to_v3;

use crate::db::schema::DatabaseConnection;
use rusqlite::Connection;

/// Applies all pending DDL-only migrations (v3→v4 through v11→v12) in order.
///
/// This covers the idempotent, transactionally-safe migrations. The v1→v2 and
/// v2→v3 migrations have different signatures (require paths and password) and
/// are called explicitly from the v1/v2 open path in `open.rs`.
pub(crate) fn apply_pending(db: &DatabaseConnection) -> Result<(), String> {
    v3_to_v4::migrate_v3_to_v4(db)?;
    v4_to_v5::migrate_v4_to_v5(db)?;
    v5_to_v6::migrate_v5_to_v6(db)?;
    v6_to_v7::migrate_v6_to_v7(db)?;
    v7_to_v8::migrate_v7_to_v8(db)?;
    v8_to_v9::migrate_v8_to_v9(db)?;
    v9_to_v10::migrate_v9_to_v10(db)?;
    v10_to_v11::migrate_v10_to_v11(db)?;
    v11_to_v12::migrate_v11_to_v12(db)?;
    Ok(())
}

pub(super) fn read_schema_version(db: &DatabaseConnection) -> Result<i32, String> {
    db.conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read schema version: {}", e))
}

pub(super) fn run_migration_transaction<T, F>(
    db: &DatabaseConnection,
    label: &str,
    action: F,
) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let result = (|| {
        db.conn()
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|e| format!("{} BEGIN failed: {}", label, e))?;

        let value = action(db.conn())?;

        db.conn()
            .execute("COMMIT", [])
            .map_err(|e| format!("{} COMMIT failed: {}", label, e))?;

        Ok(value)
    })();

    if result.is_err() {
        let _ = db.conn().execute("ROLLBACK", []);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::apply_pending;
    use crate::crypto::cipher;
    use crate::db::schema::DatabaseConnection;
    use rusqlite::Connection;

    #[test]
    fn test_apply_pending_advances_v3_to_v12() {
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
        assert_eq!(version, 12, "apply_pending must advance schema to v12");

        let table_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN \
                 ('db_settings','tags','entry_tags','custom_fonts','images','entry_images')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            table_count, 6,
            "db_settings, tags, entry_tags, custom_fonts, images, and entry_images must all exist after apply_pending"
        );

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
            "entry_metadata_encrypted must exist after apply_pending"
        );

        let thumb_col_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('images')
                 WHERE name IN ('thumbnail_data','thumbnail_mime_type','width','height','byte_size','thumbnail_version')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            thumb_col_count, 6,
            "all thumbnail metadata columns must exist after apply_pending"
        );

        let preview_col_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('entries') WHERE name='preview_enc'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            preview_col_exists, 1,
            "preview_enc must exist on entries after apply_pending"
        );
    }
}
