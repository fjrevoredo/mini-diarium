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
    let password_hash = password::hash_password(password, &salt).map_err(|e| e.to_string())?;

    // Derive 32-byte encryption key from password hash
    let key_bytes = derive_key_from_hash(&password_hash)?;
    let encryption_key = cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

    // Create database connection
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to create database: {}", e))?;

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
/// * `backups_dir` - Directory for storing migration backups
///
/// # Returns
/// A `DatabaseConnection` if the password is correct
pub fn open_database<P1: AsRef<Path>, P2: AsRef<Path>>(
    db_path: P1,
    password: String,
    backups_dir: P2,
) -> Result<DatabaseConnection, String> {
    let db_path_ref = db_path.as_ref();

    // Open database connection
    let conn =
        Connection::open(db_path_ref).map_err(|e| format!("Failed to open database: {}", e))?;

    // Retrieve stored password hash and salt
    let (stored_hash, _salt_str) = get_metadata(&conn)?;

    // Verify password
    password::verify_password(password.clone(), &stored_hash)
        .map_err(|_| "Incorrect password".to_string())?;

    // Derive encryption key from password hash
    let key_bytes = derive_key_from_hash(&stored_hash)?;
    let encryption_key = cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

    let db_conn = DatabaseConnection {
        conn,
        encryption_key,
    };

    // Run migrations if needed
    run_migrations(&db_conn, db_path_ref, backups_dir.as_ref())?;

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
        .query_row("SELECT value FROM metadata WHERE key = 'salt'", [], |row| {
            row.get(0)
        })
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
fn run_migrations(
    db: &DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
) -> Result<(), String> {
    // Get current schema version
    let current_version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1); // Default to version 1 if not found

    if current_version == SCHEMA_VERSION {
        // Already at latest version
        return Ok(());
    }

    eprintln!(
        "[Migration] Upgrading database from version {} to {}",
        current_version, SCHEMA_VERSION
    );

    // Run migrations in order
    if current_version < 2 {
        migrate_v1_to_v2(db, db_path, backups_dir)?;
    }

    // Update schema version (inside the last migration's transaction)
    eprintln!(
        "[Migration] Successfully upgraded to version {}",
        SCHEMA_VERSION
    );
    Ok(())
}

/// Migration from v1 to v2: Fix FTS table (external content → standalone)
///
/// Safety features:
/// - Creates backup before migration
/// - Wraps all changes in a transaction (rollback on failure)
/// - Updates schema version atomically
fn migrate_v1_to_v2(
    db: &DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
) -> Result<(), String> {
    eprintln!("[Migration v1→v2] Starting safe migration");

    // STEP 1: Create backup before making any changes
    eprintln!("[Migration v1→v2] Creating backup before migration...");
    let backup_path = crate::backup::create_backup(db_path, backups_dir)
        .map_err(|e| format!("Failed to create pre-migration backup: {}", e))?;
    eprintln!("[Migration v1→v2] Backup created at: {:?}", backup_path);

    // STEP 2: Begin transaction for atomic migration
    let conn = db.conn();
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| format!("Failed to begin migration transaction: {}", e))?;

    // STEP 3: Perform migration (wrapped in closure for error handling)
    let migration_result = (|| -> Result<(), String> {
        eprintln!("[Migration v1→v2] Fixing FTS table schema");

        // Drop old FTS table and its triggers
        conn.execute_batch(
            r#"
            DROP TRIGGER IF EXISTS entries_ai;
            DROP TRIGGER IF EXISTS entries_ad;
            DROP TRIGGER IF EXISTS entries_au;
            DROP TABLE IF EXISTS entries_fts;
            "#,
        )
        .map_err(|e| format!("Failed to drop old FTS table: {}", e))?;

        // Create new standalone FTS table
        conn.execute_batch(
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
        let mut stmt = conn
            .prepare("SELECT date FROM entries ORDER BY date ASC")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let dates: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query dates: {}", e))?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| format!("Failed to collect dates: {}", e))?;

        let total_entries = dates.len();
        eprintln!(
            "[Migration v1→v2] Rebuilding FTS for {} entries",
            total_entries
        );

        // For each entry, decrypt and add to FTS
        for (i, date) in dates.iter().enumerate() {
            let result = conn.query_row(
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
                conn.execute(
                    "INSERT INTO entries_fts (date, title, text) VALUES (?1, ?2, ?3)",
                    rusqlite::params![&date, &title, &text],
                )
                .map_err(|e| format!("Failed to rebuild FTS for {}: {}", date, e))?;

                // Progress reporting for large migrations
                if (i + 1) % 100 == 0 || (i + 1) == total_entries {
                    eprintln!("[Migration v1→v2] Progress: {}/{}", i + 1, total_entries);
                }
            }
        }

        // Update schema version (part of the transaction)
        // Use DELETE + INSERT to ensure the version is updated correctly
        conn.execute("DELETE FROM schema_version", [])
            .map_err(|e| format!("Failed to clear schema version: {}", e))?;
        conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            [SCHEMA_VERSION],
        )
        .map_err(|e| format!("Failed to update schema version: {}", e))?;

        Ok(())
    })();

    // STEP 4: Commit or rollback based on result
    match migration_result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit migration transaction: {}", e))?;
            eprintln!(
                "[Migration v1→v2] Successfully migrated (backup: {:?})",
                backup_path
            );
            Ok(())
        }
        Err(e) => {
            eprintln!(
                "[Migration v1→v2] Migration failed, attempting rollback: {}",
                e
            );

            match conn.execute_batch("ROLLBACK") {
                Ok(_) => {
                    // Normal error path: rollback succeeded, database is unchanged
                    eprintln!("[Migration v1→v2] Rollback successful - database unchanged");
                    Err(format!(
                        "Migration v1→v2 failed (database unchanged, backup available at {:?}): {}\n\
                         \n\
                         RECOVERY: Your database is intact. The migration will retry next time you open the app.\n\
                         If the error persists, please report this issue with the error message above.\n\
                         Backup available at: {:?}",
                        backup_path, e, backup_path
                    ))
                }
                Err(rollback_err) => {
                    // Critical error path: both migration AND rollback failed
                    eprintln!("[Migration v1→v2] CRITICAL: Rollback failed!");
                    Err(format!(
                        "CRITICAL: Migration v1→v2 failed AND rollback failed. Database may be in an inconsistent state.\n\
                         \n\
                         Original migration error: {}\n\
                         Rollback error: {}\n\
                         \n\
                         IMMEDIATE ACTION REQUIRED:\n\
                         1. DO NOT modify the database\n\
                         2. Close this application immediately\n\
                         3. Restore from backup: {:?}\n\
                         4. Copy the backup file over your diary database file\n\
                         5. Reopen the application\n\
                         \n\
                         If you need help, please report this critical error with both error messages above.",
                        e, rollback_err, backup_path
                    ))
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_db_path(name: &str) -> String {
        format!("test_{}.db", name)
    }

    fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_backups_{}", name))
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn cleanup_backups_dir(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    /// Creates a v1 schema database (with external content FTS + triggers)
    fn create_v1_database(db_path: &str, password: &str) -> Result<(), String> {
        use crate::crypto::password as pwd;

        // Generate password hash and key
        let salt = pwd::generate_salt();
        let password_hash =
            pwd::hash_password(password.to_string(), &salt).map_err(|e| e.to_string())?;
        let _key_bytes = derive_key_from_hash(&password_hash)?;

        // Create database
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to create v1 database: {}", e))?;

        // Create v1 schema (SCHEMA_VERSION = 1, external content FTS)
        // Note: We don't create the actual v1 triggers here because they would reference
        // columns that don't exist in the test scenario. Instead, add_v1_entry() manually
        // populates the FTS table. The migration will drop any triggers that exist.
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

            -- V1 FTS: External content (references entries table)
            -- In production v1, this would have triggers, but we simulate them manually in tests
            CREATE VIRTUAL TABLE entries_fts USING fts5(
                title,
                text,
                content='entries',
                content_rowid='rowid'
            );
            "#,
        )
        .map_err(|e| format!("Failed to create v1 schema: {}", e))?;

        // Store metadata
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

    /// Adds an entry to a v1 database (for test data population)
    fn add_v1_entry(
        db_path: &str,
        _password: &str,
        date: &str,
        title: &str,
        text: &str,
    ) -> Result<(), String> {
        use crate::crypto::cipher;

        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open v1 database: {}", e))?;

        // Get stored hash and derive key
        let password_hash: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = 'password_hash'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get password hash: {}", e))?;

        let key_bytes = derive_key_from_hash(&password_hash)?;
        let encryption_key = cipher::Key::from_slice(&key_bytes).ok_or("Invalid key size")?;

        // Encrypt data
        let title_encrypted = cipher::encrypt(&encryption_key, title.as_bytes())
            .map_err(|e| format!("Failed to encrypt title: {}", e))?;
        let text_encrypted = cipher::encrypt(&encryption_key, text.as_bytes())
            .map_err(|e| format!("Failed to encrypt text: {}", e))?;

        let now = chrono::Utc::now().to_rfc3339();
        let word_count = text.split_whitespace().count() as i32;

        // Insert entry into entries table
        conn.execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![date, title_encrypted, text_encrypted, word_count, &now, &now],
        )
        .map_err(|e| format!("Failed to insert v1 entry: {}", e))?;

        // Get the rowid of the inserted entry
        let rowid: i64 = conn.last_insert_rowid();

        // Manually insert into FTS table (simulating what v1 triggers would do)
        // In v1, the external content FTS was synced via triggers
        conn.execute(
            "INSERT INTO entries_fts(rowid, title, text) VALUES (?1, ?2, ?3)",
            rusqlite::params![rowid, title, text],
        )
        .map_err(|e| format!("Failed to populate v1 FTS: {}", e))?;

        Ok(())
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
        let backups_dir = temp_backups_dir("open_correct");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "secure_password_456".to_string();
        create_database(&db_path, password.clone()).unwrap();

        let result = open_database(&db_path, password, &backups_dir);
        if let Err(e) = &result {
            eprintln!("Error opening database: {}", e);
        }
        assert!(result.is_ok());

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_database_wrong_password() {
        let db_path = temp_db_path("open_wrong");
        let backups_dir = temp_backups_dir("open_wrong");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "correct_password".to_string();
        let wrong_password = "wrong_password".to_string();

        create_database(&db_path, password).unwrap();

        let result = open_database(&db_path, wrong_password, &backups_dir);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Incorrect password");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
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
        let backups_dir = temp_backups_dir("metadata");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_meta".to_string();
        create_database(&db_path, password.clone()).unwrap();

        // Reopen and verify metadata can be retrieved
        let db = open_database(&db_path, password, &backups_dir).unwrap();
        let (hash, salt) = get_metadata(db.conn()).unwrap();

        assert!(hash.starts_with("$argon2id$"));
        assert!(!salt.is_empty());

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v1_to_v2_success() {
        let db_path = temp_db_path("migration_v1_v2_success");
        let backups_dir = temp_backups_dir("migration_v1_v2_success");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_migration_password";

        // Create v1 database with entries
        create_v1_database(&db_path, password).expect("Failed to create v1 database");
        add_v1_entry(
            &db_path,
            password,
            "2024-01-01",
            "First Entry",
            "This is the first test entry",
        )
        .unwrap();
        add_v1_entry(
            &db_path,
            password,
            "2024-01-02",
            "Second Entry",
            "This is the second test entry",
        )
        .unwrap();
        add_v1_entry(
            &db_path,
            password,
            "2024-01-03",
            "Third Entry",
            "This is searchable content",
        )
        .unwrap();

        // Verify v1 schema before migration
        {
            let conn = Connection::open(&db_path).unwrap();
            let version: i32 = conn
                .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(version, 1, "Database should be at version 1");

            // Verify v1 uses external content FTS
            let fts_schema: String = conn
                .query_row(
                    "SELECT sql FROM sqlite_master WHERE name='entries_fts'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(
                fts_schema.contains("content='entries'"),
                "V1 should use external content FTS"
            );
        }

        // Open database with new code (triggers migration)
        let db = open_database(&db_path, password.to_string(), &backups_dir)
            .expect("Migration should succeed");

        // Verify migration succeeded
        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2, "Database should be upgraded to version 2");

        // Verify v1 triggers were removed
        let trigger_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            trigger_count, 0,
            "V2 should have no triggers (standalone FTS)"
        );

        // Verify FTS schema changed to standalone
        let fts_schema: String = db
            .conn()
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name='entries_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            !fts_schema.contains("content="),
            "V2 FTS should not use external content"
        );
        assert!(
            fts_schema.contains("date UNINDEXED"),
            "V2 FTS should have date UNINDEXED"
        );

        // Verify search works (FTS was rebuilt)
        let search_result: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entries_fts WHERE text MATCH 'searchable'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            search_result, 1,
            "Search should find the entry with 'searchable'"
        );

        // Verify all entries are decryptable
        use crate::crypto::cipher;
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

            assert!(!title.is_empty(), "Decrypted title should not be empty");
            assert!(!text.is_empty(), "Decrypted text should not be empty");
        }

        // Verify backup was created
        let backup_files: Vec<_> = std::fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(
            backup_files.len(),
            1,
            "Should have created exactly one backup"
        );

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v1_to_v2_rollback_on_decrypt_error() {
        let db_path = temp_db_path("migration_rollback");
        let backups_dir = temp_backups_dir("migration_rollback");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        // Create v1 database
        create_v1_database(&db_path, password).unwrap();

        // Add valid entry
        add_v1_entry(
            &db_path,
            password,
            "2024-01-01",
            "Valid Entry",
            "This entry is fine",
        )
        .unwrap();

        // Add corrupted entry (encrypted with wrong key)
        {
            use crate::crypto::cipher;

            let conn = Connection::open(&db_path).unwrap();

            // Create a different encryption key (simulates corruption)
            let wrong_key = cipher::Key::from_slice(&[0u8; 32]).unwrap();
            let corrupted_title = cipher::encrypt(&wrong_key, b"Corrupted").unwrap();
            let corrupted_text = cipher::encrypt(&wrong_key, b"This is corrupted data").unwrap();

            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params!["2024-01-02", corrupted_title, corrupted_text, 4, &now, &now],
            ).unwrap();
        }

        // Attempt migration (should fail on decrypt)
        let result = open_database(&db_path, password.to_string(), &backups_dir);
        assert!(
            result.is_err(),
            "Migration should fail due to decryption error"
        );

        let error_msg = result.unwrap_err();
        assert!(
            error_msg.contains("Migration v1→v2 failed"),
            "Error should mention migration failure"
        );
        assert!(
            error_msg.contains("database unchanged"),
            "Error should confirm database unchanged"
        );
        assert!(
            error_msg.contains("backup available"),
            "Error should mention backup"
        );

        // Verify database is still at version 1 (rollback worked)
        {
            let conn = Connection::open(&db_path).unwrap();
            let version: i32 = conn
                .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(
                version, 1,
                "Database should still be at version 1 after rollback"
            );

            // Verify v1 FTS schema still uses external content
            let fts_schema: String = conn
                .query_row(
                    "SELECT sql FROM sqlite_master WHERE name='entries_fts'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(
                fts_schema.contains("content='entries'"),
                "V1 FTS should still use external content after rollback"
            );
        }

        // Verify backup was created despite failure
        let backup_files: Vec<_> = std::fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(
            backup_files.len(),
            1,
            "Backup should be created even if migration fails"
        );

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_creates_backup_before_changes() {
        let db_path = temp_db_path("migration_backup");
        let backups_dir = temp_backups_dir("migration_backup");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        // Create v1 database with data
        create_v1_database(&db_path, password).unwrap();
        add_v1_entry(
            &db_path,
            password,
            "2024-01-01",
            "Test Entry",
            "Test content",
        )
        .unwrap();

        // Get original file size
        let original_size = std::fs::metadata(&db_path).unwrap().len();

        // Trigger migration
        let _db = open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        // Verify backup exists
        let mut backup_files: Vec<_> = std::fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(backup_files.len(), 1, "Should have exactly one backup");

        // Verify backup is a complete copy
        let backup_path = backup_files.pop().unwrap().path();
        let backup_size = std::fs::metadata(&backup_path).unwrap().len();
        assert_eq!(
            backup_size, original_size,
            "Backup should be exact copy of original"
        );

        // Verify backup is a valid v1 database
        {
            let backup_conn = Connection::open(&backup_path).unwrap();
            let version: i32 = backup_conn
                .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(version, 1, "Backup should preserve v1 schema");

            let entry_count: i32 = backup_conn
                .query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))
                .unwrap();
            assert_eq!(entry_count, 1, "Backup should contain all entries");
        }

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_idempotent_v2_to_v2() {
        let db_path = temp_db_path("migration_idempotent");
        let backups_dir = temp_backups_dir("migration_idempotent");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        // Create v1 and migrate to v2
        create_v1_database(&db_path, password).unwrap();
        add_v1_entry(&db_path, password, "2024-01-01", "Test", "Content").unwrap();

        let _db1 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();
        drop(_db1);

        // Get backup count after first migration
        let backup_count_before = std::fs::read_dir(&backups_dir).unwrap().count();

        // Reopen (migration should NOT run again)
        let _db2 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        // Verify no new backup was created
        let backup_count_after = std::fs::read_dir(&backups_dir).unwrap().count();
        assert_eq!(
            backup_count_before, backup_count_after,
            "Should not create backup if already at v2"
        );

        // Verify still at v2
        let version: i32 = _db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2, "Should remain at version 2");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v1_to_v2_empty_database() {
        let db_path = temp_db_path("migration_empty");
        let backups_dir = temp_backups_dir("migration_empty");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        // Create v1 database with NO entries
        create_v1_database(&db_path, password).unwrap();

        // Trigger migration
        let db = open_database(&db_path, password.to_string(), &backups_dir)
            .expect("Empty database migration should succeed");

        // Verify migrated to v2
        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);

        // Verify FTS table exists (even though empty)
        let fts_count: i32 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM entries_fts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fts_count, 0, "FTS should be empty");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }
}
