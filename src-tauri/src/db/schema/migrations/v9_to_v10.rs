use crate::db::schema::DatabaseConnection;
use log::info;

/// Migration v9 → v10: Add `images` and `entry_images` tables.
///
/// `images` is a content-addressed encrypted store; one physical row per unique image,
/// keyed by an HKDF-SHA256 fingerprint. `entry_images` is a junction table that
/// associates entries with images (reference counting for orphan cleanup).
pub(super) fn migrate_v9_to_v10(db: &DatabaseConnection) -> Result<(), String> {
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(9);

    if version < 10 {
        db.conn()
            .execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE IF NOT EXISTS images (
                     id          INTEGER PRIMARY KEY AUTOINCREMENT,
                     fingerprint TEXT    NOT NULL UNIQUE,
                     mime_type   TEXT    NOT NULL,
                     data        BLOB    NOT NULL,
                     created_at  TEXT    NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS entry_images (
                     entry_id  INTEGER NOT NULL,
                     image_id  INTEGER NOT NULL,
                     PRIMARY KEY (entry_id, image_id),
                     FOREIGN KEY (entry_id) REFERENCES entries(id)  ON DELETE CASCADE,
                     FOREIGN KEY (image_id) REFERENCES images(id)   ON DELETE RESTRICT
                 );
                 CREATE INDEX IF NOT EXISTS idx_entry_images_image_id ON entry_images(image_id);
                 UPDATE schema_version SET version = 10;
                 COMMIT;",
            )
            .map_err(|e| format!("Migration v9→v10 failed: {}", e))?;
        info!("Migrated database from v9 to v10 (added images and entry_images tables)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate_v9_to_v10;
    use crate::crypto::cipher;
    use crate::db::schema::create::open_connection_in_memory;
    use crate::db::schema::DatabaseConnection;

    fn setup_v9_db() -> DatabaseConnection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version (version) VALUES (9);
             CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE auth_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
                 label TEXT NOT NULL, public_key BLOB, wrapped_key BLOB NOT NULL,
                 created_at TEXT NOT NULL, last_used TEXT);
             CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
                 title_encrypted BLOB, text_encrypted BLOB, word_count INTEGER DEFAULT 0,
                 date_created TEXT NOT NULL, date_updated TEXT NOT NULL,
                 entry_metadata_encrypted BLOB);
             CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name_encrypted BLOB NOT NULL, name_fingerprint TEXT NOT NULL UNIQUE,
                 created_at TEXT NOT NULL);
             CREATE TABLE entry_tags (entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
                 PRIMARY KEY (entry_id, tag_id));
             CREATE TABLE custom_fonts (id INTEGER PRIMARY KEY AUTOINCREMENT, family TEXT NOT NULL,
                 weight TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL,
                 UNIQUE(family, weight));",
        )
        .unwrap();
        DatabaseConnection {
            conn,
            encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
        }
    }

    #[test]
    fn test_migrate_v9_to_v10_creates_tables() {
        let db = setup_v9_db();
        migrate_v9_to_v10(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 10);

        let images_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='images'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(images_exists, 1, "images table must exist after migration");

        let entry_images_exists: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entry_images'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            entry_images_exists, 1,
            "entry_images table must exist after migration"
        );
    }

    #[test]
    fn test_migrate_v9_to_v10_is_idempotent() {
        let db = setup_v9_db();

        migrate_v9_to_v10(&db).unwrap();
        migrate_v9_to_v10(&db).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 10,
            "version must remain 10 after second migration call"
        );
    }
}
