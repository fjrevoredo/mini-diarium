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
const SCHEMA_VERSION: i32 = 2;

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

    let db_conn = DatabaseConnection {
        conn,
        encryption_key,
    };

    // Run migrations if needed
    run_migrations(&db_conn)?;

    Ok(db_conn)
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
        -- Note: This is a standalone FTS5 table (not external content)
        -- so it stores its own plaintext data for searching
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
            date UNINDEXED,
            title,
            text
        );
        "#,
    )
    .map_err(|e| format!("Failed to create schema: {}", e))?;

    // Insert schema version (must be separate because execute_batch doesn't support parameters)
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

/// Runs database migrations to upgrade schema
fn run_migrations(db: &DatabaseConnection) -> Result<(), String> {
    // Get current schema version
    let current_version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1); // Default to version 1 if not found

    if current_version == SCHEMA_VERSION {
        // Already at latest version
        return Ok(());
    }

    eprintln!("[Migration] Upgrading database from version {} to {}", current_version, SCHEMA_VERSION);

    // Run migrations in order
    if current_version < 2 {
        migrate_v1_to_v2(db)?;
    }

    // Update schema version
    db.conn()
        .execute(
            "INSERT OR REPLACE INTO schema_version (version) VALUES (?1)",
            [SCHEMA_VERSION],
        )
        .map_err(|e| format!("Failed to update schema version: {}", e))?;

    eprintln!("[Migration] Successfully upgraded to version {}", SCHEMA_VERSION);
    Ok(())
}

/// Migration from v1 to v2: Fix FTS table (external content → standalone)
fn migrate_v1_to_v2(db: &DatabaseConnection) -> Result<(), String> {
    eprintln!("[Migration v1→v2] Fixing FTS table schema");

    // Drop old FTS table and its triggers
    db.conn()
        .execute_batch(
            r#"
            DROP TRIGGER IF EXISTS entries_ai;
            DROP TRIGGER IF EXISTS entries_ad;
            DROP TRIGGER IF EXISTS entries_au;
            DROP TABLE IF EXISTS entries_fts;
            "#,
        )
        .map_err(|e| format!("Failed to drop old FTS table: {}", e))?;

    // Create new standalone FTS table
    db.conn()
        .execute_batch(
            r#"
            CREATE VIRTUAL TABLE entries_fts USING fts5(
                date UNINDEXED,
                title,
                text
            );
            "#,
        )
        .map_err(|e| format!("Failed to create new FTS table: {}", e))?;

    // Rebuild FTS index from existing entries
    eprintln!("[Migration v1→v2] Rebuilding FTS index");

    // Get all entry dates
    let mut stmt = db
        .conn()
        .prepare("SELECT date FROM entries ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let dates: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query dates: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;

    // For each entry, decrypt and add to FTS
    for date in dates {
        let result = db.conn().query_row(
            "SELECT title_encrypted, text_encrypted FROM entries WHERE date = ?1",
            [&date],
            |row| {
                let title_enc: Vec<u8> = row.get(0)?;
                let text_enc: Vec<u8> = row.get(1)?;
                Ok((title_enc, text_enc))
            },
        );

        if let Ok((title_enc, text_enc)) = result {
            // Decrypt title and text
            use crate::crypto::cipher;

            let title_bytes = cipher::decrypt(db.key(), &title_enc)
                .map_err(|e| format!("Failed to decrypt title for {}: {}", date, e))?;
            let text_bytes = cipher::decrypt(db.key(), &text_enc)
                .map_err(|e| format!("Failed to decrypt text for {}: {}", date, e))?;

            let title = String::from_utf8(title_bytes)
                .map_err(|e| format!("Invalid UTF-8 in title for {}: {}", date, e))?;
            let text = String::from_utf8(text_bytes)
                .map_err(|e| format!("Invalid UTF-8 in text for {}: {}", date, e))?;

            // Insert into FTS
            db.conn()
                .execute(
                    "INSERT INTO entries_fts (date, title, text) VALUES (?1, ?2, ?3)",
                    rusqlite::params![&date, &title, &text],
                )
                .map_err(|e| format!("Failed to rebuild FTS for {}: {}", date, e))?;
        }
    }

    eprintln!("[Migration v1→v2] Successfully migrated FTS table");
    Ok(())
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
        if let Err(e) = &result {
            eprintln!("Error opening database: {}", e);
        }
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
