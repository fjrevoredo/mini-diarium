use crate::crypto::{cipher, password};
use rusqlite::Connection;
use std::path::Path;

/// Wrapper for database connection with encryption key
#[derive(Debug)]
pub struct DatabaseConnection {
    conn: Connection,
    encryption_key: cipher::Key,
}

impl DatabaseConnection {
    /// Returns a reference to the underlying SQLite connection
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Returns a reference to the encryption key
    pub fn key(&self) -> &cipher::Key {
        &self.encryption_key
    }
}

/// Schema version for migrations
const SCHEMA_VERSION: i32 = 1;

/// Creates a new encrypted diary database
///
/// # Arguments
/// * `db_path` - Path where the database file will be created
/// * `password` - Master password for encryption
///
/// # Returns
/// A `DatabaseConnection` with the encryption key derived from the password
pub fn create_database<P: AsRef<Path>>(
    db_path: P,
    password: String,
) -> Result<DatabaseConnection, String> {
    // Generate salt for password hashing
    let salt = password::generate_salt();

    // Hash the password to create encryption key
    let password_hash =
        password::hash_password(password, &salt).map_err(|e| e.to_string())?;

    // Derive 32-byte encryption key from password hash
    let key_bytes = derive_key_from_hash(&password_hash)?;
    let encryption_key =
        cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

    // Create database connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to create database: {}", e))?;

    // Create schema
    create_schema(&conn)?;

    // Store metadata (password hash and salt)
    store_metadata(&conn, &password_hash, salt.as_str(), &encryption_key)?;

    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}

/// Opens an existing encrypted diary database
///
/// # Arguments
/// * `db_path` - Path to the existing database file
/// * `password` - Master password for decryption
///
/// # Returns
/// A `DatabaseConnection` if the password is correct
pub fn open_database<P: AsRef<Path>>(
    db_path: P,
    password: String,
) -> Result<DatabaseConnection, String> {
    // Open database connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Retrieve stored password hash and salt
    let (stored_hash, _salt_str) = get_metadata(&conn)?;

    // Verify password
    password::verify_password(password.clone(), &stored_hash)
        .map_err(|_| "Incorrect password".to_string())?;

    // Derive encryption key from password hash
    let key_bytes = derive_key_from_hash(&stored_hash)?;
    let encryption_key =
        cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}

/// Creates the database schema
fn create_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        -- Schema version table
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );

        -- Metadata table (stores password hash, salt)
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Entries table (encrypted data)
        CREATE TABLE IF NOT EXISTS entries (
            date TEXT PRIMARY KEY,
            title_encrypted BLOB,
            text_encrypted BLOB,
            word_count INTEGER DEFAULT 0,
            date_created TEXT NOT NULL,
            date_updated TEXT NOT NULL
        );

        -- Full-text search virtual table
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
            date UNINDEXED,
            title,
            text,
            content='entries',
            content_rowid='rowid'
        );

        -- Trigger to keep FTS index in sync on INSERT
        CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
            INSERT INTO entries_fts(rowid, date, title, text)
            VALUES (new.rowid, new.date, '', '');
        END;

        -- Trigger to keep FTS index in sync on DELETE
        CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
            INSERT INTO entries_fts(entries_fts, rowid, date, title, text)
            VALUES('delete', old.rowid, old.date, '', '');
        END;

        -- Trigger to keep FTS index in sync on UPDATE
        CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
            INSERT INTO entries_fts(entries_fts, rowid, date, title, text)
            VALUES('delete', old.rowid, old.date, '', '');
            INSERT INTO entries_fts(rowid, date, title, text)
            VALUES (new.rowid, new.date, '', '');
        END;

        -- Insert schema version
        INSERT OR REPLACE INTO schema_version (version) VALUES (?1);
        "#,
    )
    .map_err(|e| format!("Failed to create schema: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO schema_version (version) VALUES (?1)",
        [SCHEMA_VERSION],
    )
    .map_err(|e| format!("Failed to set schema version: {}", e))?;

    Ok(())
}

/// Stores metadata (password hash and salt) in the database
fn store_metadata(
    conn: &Connection,
    password_hash: &str,
    salt: &str,
    _key: &cipher::Key,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO metadata (key, value) VALUES ('password_hash', ?1)",
        [password_hash],
    )
    .map_err(|e| format!("Failed to store password hash: {}", e))?;

    conn.execute(
        "INSERT INTO metadata (key, value) VALUES ('salt', ?1)",
        [salt],
    )
    .map_err(|e| format!("Failed to store salt: {}", e))?;

    Ok(())
}

/// Retrieves metadata (password hash and salt) from the database
fn get_metadata(conn: &Connection) -> Result<(String, String), String> {
    let password_hash: String = conn
        .query_row(
            "SELECT value FROM metadata WHERE key = 'password_hash'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to retrieve password hash: {}", e))?;

    let salt: String = conn
        .query_row(
            "SELECT value FROM metadata WHERE key = 'salt'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to retrieve salt: {}", e))?;

    Ok((password_hash, salt))
}

/// Derives a 32-byte encryption key from a password hash
fn derive_key_from_hash(password_hash: &str) -> Result<Vec<u8>, String> {
    use argon2::password_hash::PasswordHash;

    // Parse the full PHC string
    let parsed = PasswordHash::new(password_hash)
        .map_err(|e| format!("Failed to parse password hash: {}", e))?;

    // Extract the hash bytes
    let hash_value = parsed.hash.ok_or("No hash in password hash string")?;
    let hash_bytes = hash_value.as_bytes().to_vec();

    // Take first 32 bytes for AES-256 key
    if hash_bytes.len() < 32 {
        return Err("Hash too short for key derivation".to_string());
    }

    Ok(hash_bytes[..32].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_{}.db", name)
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_create_database() {
        let db_path = temp_db_path("create");
        cleanup_db(&db_path);

        let password = "test_password_123".to_string();
        let result = create_database(&db_path, password);

        assert!(result.is_ok());

        // Verify schema was created
        let db = result.unwrap();
        let table_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        // Should have: schema_version, metadata, entries
        assert!(table_count >= 3);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_open_database_correct_password() {
        let db_path = temp_db_path("open_correct");
        cleanup_db(&db_path);

        let password = "secure_password_456".to_string();
        create_database(&db_path, password.clone()).unwrap();

        let result = open_database(&db_path, password);
        assert!(result.is_ok());

        cleanup_db(&db_path);
    }

    #[test]
    fn test_open_database_wrong_password() {
        let db_path = temp_db_path("open_wrong");
        cleanup_db(&db_path);

        let password = "correct_password".to_string();
        let wrong_password = "wrong_password".to_string();

        create_database(&db_path, password).unwrap();

        let result = open_database(&db_path, wrong_password);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Incorrect password");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_schema_version() {
        let db_path = temp_db_path("schema_version");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();

        assert_eq!(version, SCHEMA_VERSION);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_fts_table_exists() {
        let db_path = temp_db_path("fts");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Check that FTS table exists
        let fts_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entries_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(fts_count, 1);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_metadata_storage() {
        let db_path = temp_db_path("metadata");
        cleanup_db(&db_path);

        let password = "test_meta".to_string();
        create_database(&db_path, password.clone()).unwrap();

        // Reopen and verify metadata can be retrieved
        let db = open_database(&db_path, password).unwrap();
        let (hash, salt) = get_metadata(db.conn()).unwrap();

        assert!(hash.starts_with("$argon2id$"));
        assert!(!salt.is_empty());

        cleanup_db(&db_path);
    }
}
