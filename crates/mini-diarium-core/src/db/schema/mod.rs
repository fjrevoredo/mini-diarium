use crate::crypto::cipher;
use rusqlite::Connection;

mod create;
mod legacy;
pub(crate) mod migrations;
mod open;

pub use create::{create_database, create_database_auto};
pub use open::{open_database, open_database_auto, open_database_with_keypair};

// `mod create` is private to `schema`, so siblings under `db` (e.g. `db::peek`) and the
// backup engine cannot reach the mandatory FK-pragma connection helpers without this
// re-export.
pub(crate) use create::{open_connection, open_connection_readonly};

/// Wrapper for database connection with encryption key
#[derive(Debug)]
pub struct DatabaseConnection {
    pub(crate) conn: Connection,
    pub(crate) encryption_key: cipher::Key,
}

impl DatabaseConnection {
    /// Returns a reference to the underlying SQLite connection.
    ///
    /// Intentionally **`pub(crate)`** — the raw handle never escapes the crate (open-core
    /// M2 / TODO-0077). External consumers reach the database only through the curated `db`
    /// façade (see `crates/mini-diarium-core/API.md`).
    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Returns a reference to the encryption key (master key).
    ///
    /// Intentionally **`pub(crate)`** — key material never escapes the crate. Auth-slot
    /// operations that need to wrap the master key are exposed as composed functions
    /// (`auth::add_password_slot` / `auth::add_keypair_slot`) instead.
    pub(crate) fn key(&self) -> &cipher::Key {
        &self.encryption_key
    }

    /// Test-only constructor: assembles a `DatabaseConnection` from a raw
    /// connection and key. The fields stay `pub(crate)` in production; this
    /// gated constructor lets *dependent* crates (e.g. the app crate's font
    /// tests) build fixtures without exposing internals. Never compiled into
    /// release builds — see the `test-support` feature in Cargo.toml.
    #[cfg(any(test, feature = "test-support"))]
    pub fn from_parts(conn: Connection, encryption_key: cipher::Key) -> Self {
        Self {
            conn,
            encryption_key,
        }
    }
}

/// Current schema version
pub const SCHEMA_VERSION: i32 = 13;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_schema_backups_{}", name))
    }

    fn cleanup_backups_dir(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_create_database() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let result = create_database(
            tmp.path().to_str().unwrap(),
            "test_password_123".to_string(),
        );
        assert!(result.is_ok(), "Error: {:?}", result.err());

        let db = result.unwrap();

        let table_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            table_count >= 4,
            "Expected at least 4 tables, got {}",
            table_count
        );

        let slot_count: i32 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM auth_slots", [], |row| row.get(0))
            .unwrap();
        assert_eq!(slot_count, 1);
    }

    #[test]
    fn test_open_database_correct_password() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let backups_dir = temp_backups_dir("open_correct");
        cleanup_backups_dir(&backups_dir);

        let password = "secure_password_456".to_string();
        create_database(tmp.path().to_str().unwrap(), password.clone()).unwrap();

        let result = open_database(tmp.path().to_str().unwrap(), password, &backups_dir);
        assert!(result.is_ok(), "Error opening database: {:?}", result.err());

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_database_wrong_password() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let backups_dir = temp_backups_dir("open_wrong");
        cleanup_backups_dir(&backups_dir);

        create_database(tmp.path().to_str().unwrap(), "correct_password".to_string()).unwrap();

        let result = open_database(
            tmp.path().to_str().unwrap(),
            "wrong_password".to_string(),
            &backups_dir,
        );
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Incorrect password");

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_schema_version() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();

        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(SCHEMA_VERSION, 13);
    }

    #[test]
    fn test_auth_slots_table_exists() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='auth_slots'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_open_v3_is_idempotent() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("v3_idempotent");
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        create_database(&db_path, password.to_string()).unwrap();

        let db1 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();
        let version1: i32 = db1
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version1, 13);
        drop(db1);

        let backup_count_before = std::fs::read_dir(&backups_dir)
            .map(|d| d.count())
            .unwrap_or(0);

        let db2 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();
        let version2: i32 = db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 13);

        let backup_count_after = std::fs::read_dir(&backups_dir)
            .map(|d| d.count())
            .unwrap_or(0);
        assert_eq!(
            backup_count_before, backup_count_after,
            "No new backup should be created for v13→v13"
        );

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_with_keypair() {
        use crate::auth::keypair::{generate_keypair, KeypairMethod};

        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups_dir = temp_backups_dir("keypair_open");
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        let db = create_database(&db_path, password.to_string()).unwrap();

        let kp = generate_keypair().unwrap();
        let pub_key_bytes = hex::decode(&kp.public_key_hex).unwrap();
        let priv_key_bytes_vec = hex::decode(&kp.private_key_hex).unwrap();

        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_key_bytes);
        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(&priv_key_bytes_vec);

        let (_, wrapped_key) = db
            .conn()
            .query_row(
                "SELECT id, wrapped_key FROM auth_slots WHERE type = 'password' LIMIT 1",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
            )
            .unwrap();

        let method = crate::auth::password::PasswordMethod::new(password.to_string());
        let master_key_bytes = method.unwrap_master_key(&wrapped_key).unwrap();

        let keypair_method = KeypairMethod {
            public_key: pub_key,
        };
        let keypair_wrapped = keypair_method.wrap_master_key(&master_key_bytes).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        db.conn()
            .execute(
                "INSERT INTO auth_slots (type, label, public_key, wrapped_key, created_at) VALUES ('keypair', 'Test Key', ?1, ?2, ?3)",
                rusqlite::params![&pub_key_bytes, &keypair_wrapped, &now],
            )
            .unwrap();
        drop(db);

        let db2 = open_database_with_keypair(&db_path, priv_key, &backups_dir).unwrap();

        let version: i32 = db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 13);

        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_create_and_auto_unlock() {
        use rand_core::OsRng;
        use rand_core::RngCore;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_path_buf();
        drop(tmp);

        let mut auto_key = [0u8; 32];
        OsRng.fill_bytes(&mut auto_key);

        let db = create_database_auto(&db_path, &auto_key).unwrap();

        let entry = crate::db::queries::DiaryEntry {
            id: 0,
            date: "2024-06-01".to_string(),
            title: "Auto Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: "2024-06-01T00:00:00Z".to_string(),
            date_updated: "2024-06-01T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        };
        crate::db::queries::insert_entry(&db, &entry).unwrap();
        drop(db);

        let db2 = open_database_auto(&db_path, &auto_key, std::path::Path::new(".")).unwrap();
        let entries = crate::db::queries::get_entries_by_date(&db2, "2024-06-01").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Auto Test");
    }

    #[test]
    fn test_auto_unlock_wrong_key_fails() {
        use rand_core::OsRng;
        use rand_core::RngCore;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_path_buf();
        drop(tmp);

        let mut auto_key = [0u8; 32];
        let mut wrong_key = [0u8; 32];
        OsRng.fill_bytes(&mut auto_key);
        OsRng.fill_bytes(&mut wrong_key);

        create_database_auto(&db_path, &auto_key).unwrap();

        let result = open_database_auto(&db_path, &wrong_key, std::path::Path::new("."));
        assert!(result.is_err());
    }
}
