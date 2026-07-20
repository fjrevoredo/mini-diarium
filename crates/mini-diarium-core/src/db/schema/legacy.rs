use crate::crypto::password;
use rusqlite::Connection;

/// Retrieves legacy password hash and salt from the metadata table (v1/v2 only).
pub(crate) fn get_metadata(conn: &Connection) -> Result<(String, String), String> {
    let password_hash: String = conn
        .query_row(
            "SELECT value FROM metadata WHERE key = 'password_hash'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to retrieve password hash: {}", e))?;

    let salt: String = conn
        .query_row("SELECT value FROM metadata WHERE key = 'salt'", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to retrieve salt: {}", e))?;

    Ok((password_hash, salt))
}

/// Derives a 32-byte encryption key from a legacy v1/v2 password hash.
/// This is only used during v2→v3 migration.
pub(crate) fn derive_key_from_hash(password_hash: &str) -> Result<Vec<u8>, String> {
    password::derive_key_from_phc_hash(password_hash)
}

#[cfg(test)]
mod tests {
    use super::derive_key_from_hash;
    use crate::crypto::cipher;
    use rusqlite::Connection;
    use std::fs;
    use std::path::PathBuf;

    fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_legacy_backups_{}", name))
    }

    fn cleanup_backups_dir(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    fn create_v1_database(db_path: &str, pw: &str) -> Result<(), String> {
        use crate::crypto::password as pwd;

        let salt = pwd::generate_salt();
        let password_hash = pwd::hash_password(pw.to_string(), &salt).map_err(|e| e.to_string())?;

        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to create v1 database: {}", e))?;

        conn.execute_batch(
            r#"
            CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
            INSERT INTO schema_version (version) VALUES (1);

            CREATE TABLE metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE entries (
                date TEXT PRIMARY KEY,
                title_encrypted BLOB,
                text_encrypted BLOB,
                word_count INTEGER DEFAULT 0,
                date_created TEXT NOT NULL,
                date_updated TEXT NOT NULL
            );

            CREATE VIRTUAL TABLE entries_fts USING fts5(
                title,
                text,
                content='entries',
                content_rowid='rowid'
            );
            "#,
        )
        .map_err(|e| format!("Failed to create v1 schema: {}", e))?;

        conn.execute(
            "INSERT INTO metadata (key, value) VALUES ('password_hash', ?1)",
            [&password_hash],
        )
        .map_err(|e| format!("Failed to store password hash: {}", e))?;

        conn.execute(
            "INSERT INTO metadata (key, value) VALUES ('salt', ?1)",
            [salt.as_str()],
        )
        .map_err(|e| format!("Failed to store salt: {}", e))?;

        Ok(())
    }

    fn add_legacy_entry(db_path: &str, date: &str, title: &str, text: &str) -> Result<(), String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open legacy database: {}", e))?;

        let password_hash: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = 'password_hash'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get password hash: {}", e))?;

        let key_bytes = derive_key_from_hash(&password_hash)?;
        let encryption_key = cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

        let title_encrypted = cipher::encrypt(&encryption_key, title.as_bytes())
            .map_err(|e| format!("Failed to encrypt title: {}", e))?;
        let text_encrypted = cipher::encrypt(&encryption_key, text.as_bytes())
            .map_err(|e| format!("Failed to encrypt text: {}", e))?;

        let now = chrono::Utc::now().to_rfc3339();
        let word_count = text.split_whitespace().count() as i32;

        conn.execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![date, title_encrypted, text_encrypted, word_count, &now, &now],
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

        let rowid = conn.last_insert_rowid();
        let _ = conn.execute(
            "INSERT INTO entries_fts(rowid, title, text) VALUES (?1, ?2, ?3)",
            rusqlite::params![rowid, title, text],
        );

        Ok(())
    }

    #[test]
    fn test_migration_v1_to_v3_success() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("migration_v1_v3");
        cleanup_backups_dir(&backups_dir);

        let password = "test_migration_password";

        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-01-01", "First Entry", "First entry content").unwrap();
        add_legacy_entry(
            &db_path,
            "2024-01-02",
            "Second Entry",
            "Searchable content here",
        )
        .unwrap();
        add_legacy_entry(&db_path, "2024-01-03", "Third Entry", "Third entry content").unwrap();

        let db = crate::db::schema::open_database(&db_path, password.to_string(), &backups_dir)
            .expect("Migration should succeed");

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13, "Should be at version 13 after migration");

        let slot_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM auth_slots WHERE type = 'password'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(slot_count, 1);

        for date in &["2024-01-01", "2024-01-02", "2024-01-03"] {
            let (title_enc, text_enc): (Vec<u8>, Vec<u8>) = db
                .conn()
                .query_row(
                    "SELECT title_encrypted, text_encrypted FROM entries WHERE date = ?1",
                    [date],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();

            let title = cipher::decrypt(db.key(), &title_enc).expect("Title should decrypt");
            let text = cipher::decrypt(db.key(), &text_enc).expect("Text should decrypt");
            assert!(!title.is_empty());
            assert!(!text.is_empty());
        }

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v2_to_v3_with_entries() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("migration_v2_v3");
        cleanup_backups_dir(&backups_dir);

        let password = "v2_to_v3_password";

        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-06-01", "June Entry", "June content").unwrap();

        let db =
            crate::db::schema::open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);

        let entries = crate::db::queries::get_entries_by_date(&db, "2024-06-01").unwrap();
        assert_eq!(entries.len(), 1);
        let e = &entries[0];
        assert_eq!(e.title, "June Entry");
        assert_eq!(e.text, "June content");

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v1_to_v3_rollback_on_decrypt_error() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("migration_rollback");
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-01-01", "Valid Entry", "This entry is fine").unwrap();

        {
            let conn = Connection::open(&db_path).unwrap();
            let wrong_key = cipher::Key::from_slice(&[0u8; 32]).unwrap();
            let corrupted_title = cipher::encrypt(&wrong_key, b"Corrupted").unwrap();
            let corrupted_text = cipher::encrypt(&wrong_key, b"This is corrupted data").unwrap();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params!["2024-01-02", corrupted_title, corrupted_text, 4, &now, &now],
            )
            .unwrap();
        }

        let result = crate::db::schema::open_database(&db_path, password.to_string(), &backups_dir);
        assert!(result.is_err());

        let error_msg = result.unwrap_err();
        assert!(
            error_msg.contains("Migration") || error_msg.contains("migration"),
            "Error should mention migration: {}",
            error_msg
        );

        // v1→v2 succeeds; v2→v3 fails on the corrupted entry and rolls back to v2
        let conn = Connection::open(&db_path).unwrap();
        let version: i32 = conn
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 2,
            "Database should be at v2 after v1→v2 success and v2→v3 rollback"
        );

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_creates_backup() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("migration_backup");
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-01-01", "Test Entry", "Test content").unwrap();

        let _db =
            crate::db::schema::open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        let backup_count = std::fs::read_dir(&backups_dir).unwrap().count();
        assert!(backup_count >= 1, "At least one backup should be created");

        cleanup_backups_dir(&backups_dir);
    }
}
