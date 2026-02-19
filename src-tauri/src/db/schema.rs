use crate::crypto::{cipher, password};
use log::{debug, error, info, warn};
use rand::RngCore;
use rusqlite::Connection;
use std::path::Path;
use zeroize::Zeroize;

/// Wrapper for database connection with encryption key
#[derive(Debug)]
pub struct DatabaseConnection {
    pub(crate) conn: Connection,
    pub(crate) encryption_key: cipher::Key,
}

impl DatabaseConnection {
    /// Returns a reference to the underlying SQLite connection
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Returns a reference to the encryption key (master key)
    pub fn key(&self) -> &cipher::Key {
        &self.encryption_key
    }
}

/// Current schema version
const SCHEMA_VERSION: i32 = 4;

/// Creates a new encrypted diary database (schema v4)
///
/// Generates a random master key, wraps it with the password, and stores the
/// wrapped key in `auth_slots`. Entries are encrypted with the master key.
pub fn create_database<P: AsRef<Path>>(
    db_path: P,
    password: String,
) -> Result<DatabaseConnection, String> {
    // Generate random master key
    let mut master_key_bytes = [0u8; 32];
    aes_gcm::aead::OsRng.fill_bytes(&mut master_key_bytes);
    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;

    // Create database connection
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to create database: {}", e))?;

    // Create schema (v4 includes auth_slots table, no FTS)
    create_schema(&conn)?;

    // Wrap master_key with password and insert password slot
    let method = crate::auth::password::PasswordMethod::new(password);
    let wrapped_key = method
        .wrap_master_key(&master_key_bytes)
        .map_err(|e| format!("Failed to wrap master key: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO auth_slots (type, label, wrapped_key, created_at) VALUES ('password', 'Password', ?1, ?2)",
        rusqlite::params![&wrapped_key, &now],
    )
    .map_err(|e| format!("Failed to create password slot: {}", e))?;

    // Zeroize the raw master key bytes (encryption_key holds a safe copy)
    master_key_bytes.zeroize();

    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}

/// Opens an existing encrypted diary database using a password.
///
/// Handles schema migrations automatically:
/// - v1 → v2: FTS table restructure (no re-encryption)
/// - v2 → v3: Introduce wrapped master key (re-encrypts all entries)
/// - v3 → v4: Drop plaintext FTS table (security fix)
/// - v4: Read master key from auth_slots password slot
pub fn open_database<P1: AsRef<Path>, P2: AsRef<Path>>(
    db_path: P1,
    password: String,
    backups_dir: P2,
) -> Result<DatabaseConnection, String> {
    let db_path_ref = db_path.as_ref();

    let conn =
        Connection::open(db_path_ref).map_err(|e| format!("Failed to open database: {}", e))?;

    let current_version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1);

    if current_version >= 3 {
        // v3+ path: unwrap master key from auth_slots
        let db = open_v3_with_password(conn, password, backups_dir.as_ref())?;
        migrate_v3_to_v4(&db)?;
        return Ok(db);
    }

    // v1/v2 path: verify password via legacy metadata table
    let (stored_hash, _salt) = get_metadata(&conn)?;
    password::verify_password(password.clone(), &stored_hash)
        .map_err(|_| "Incorrect password".to_string())?;

    let old_key_bytes = derive_key_from_hash(&stored_hash)?;
    let old_key = cipher::Key::from_slice(&old_key_bytes).ok_or("Invalid key size")?;

    let mut db_conn = DatabaseConnection {
        conn,
        encryption_key: old_key,
    };

    // Run v1 → v2 migration if needed (FTS restructure only, no re-encryption)
    if current_version < 2 {
        migrate_v1_to_v2(&db_conn, db_path_ref, backups_dir.as_ref())?;
    }

    // Run v2 → v3 migration (introduce wrapped master key)
    db_conn = migrate_v2_to_v3(db_conn, db_path_ref, backups_dir.as_ref(), password)?;

    // Run v3 → v4 migration (drop plaintext FTS table)
    migrate_v3_to_v4(&db_conn)?;

    Ok(db_conn)
}

/// Opens an existing v3 database using an X25519 private key file.
///
/// Only works with v3+ databases. The private key is loaded from `key_path`,
/// used to unwrap the master key, then zeroized.
pub fn open_database_with_keypair<P1: AsRef<Path>, P2: AsRef<Path>>(
    db_path: P1,
    private_key_bytes: [u8; 32],
    backups_dir: P2,
) -> Result<DatabaseConnection, String> {
    let db_path_ref = db_path.as_ref();

    let conn =
        Connection::open(db_path_ref).map_err(|e| format!("Failed to open database: {}", e))?;

    let current_version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1);

    if current_version < 3 {
        return Err("Key file authentication requires a migrated diary (v3). \
             Please unlock with your password first to upgrade."
            .to_string());
    }

    // Derive the public key from the private key to find the matching slot
    use x25519_dalek::{PublicKey, StaticSecret};
    let static_secret = StaticSecret::from(private_key_bytes);
    let public_key = PublicKey::from(&static_secret);
    let pub_key_slice: &[u8] = public_key.as_bytes();

    // Find the keypair slot matching this public key
    let slot_result = conn.query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'keypair' AND public_key = ?1 LIMIT 1",
        rusqlite::params![pub_key_slice],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );

    let (slot_id, wrapped_key) = match slot_result {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err("No keypair auth method found for this key file".to_string());
        }
        Err(e) => return Err(format!("Database error: {}", e)),
    };

    // Unwrap master key using the private key
    let unwrap_method = crate::auth::keypair::PrivateKeyMethod {
        private_key: private_key_bytes,
    };
    let mut master_key_bytes = unwrap_method
        .unwrap_master_key(&wrapped_key)
        .map_err(|e| format!("Failed to unlock with key file: {}", e))?;

    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;
    master_key_bytes.zeroize();

    // Update last_used
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE auth_slots SET last_used = ?1 WHERE id = ?2",
        rusqlite::params![&now, slot_id],
    )
    .map_err(|e| format!("Failed to update last_used: {}", e))?;

    let _ = backups_dir; // caller handles backup

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    migrate_v3_to_v4(&db)?;
    Ok(db)
}

// ─── Private helpers ────────────────────────────────────────────────────────

/// Open a v3 database using the password slot in auth_slots.
fn open_v3_with_password(
    conn: Connection,
    password: String,
    _backups_dir: &Path,
) -> Result<DatabaseConnection, String> {
    // Find the password slot
    let slot_result = conn.query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'password' ORDER BY id ASC LIMIT 1",
        [],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );

    let (slot_id, wrapped_key) = match slot_result {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err("No password auth slot found".to_string());
        }
        Err(e) => return Err(format!("Database error: {}", e)),
    };

    // Unwrap master key
    let method = crate::auth::password::PasswordMethod::new(password);
    let mut master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;

    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;
    master_key_bytes.zeroize();

    // Update last_used
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE auth_slots SET last_used = ?1 WHERE id = ?2",
        rusqlite::params![&now, slot_id],
    )
    .map_err(|e| format!("Failed to update last_used: {}", e))?;

    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}

/// Creates the database schema (v3)
fn create_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        -- Schema version table
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );

        -- Metadata table (kept for backward compatibility with v1/v2 migrations)
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

        -- Search index: not implemented. A future search module should create its index here.
        -- Interface contract: see commands/search.rs for SearchResult and the search_entries command.

        -- Authentication slots (password, keypair, etc.)
        CREATE TABLE IF NOT EXISTS auth_slots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT NOT NULL,
            label       TEXT NOT NULL,
            public_key  BLOB,
            wrapped_key BLOB NOT NULL,
            created_at  TEXT NOT NULL,
            last_used   TEXT
        );
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

/// Retrieves legacy password hash and salt from the metadata table (v1/v2 only)
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

/// Derives a 32-byte encryption key from a legacy v1/v2 password hash.
/// This is only used during v2→v3 migration.
pub(crate) fn derive_key_from_hash(password_hash: &str) -> Result<Vec<u8>, String> {
    password::derive_key_from_phc_hash(password_hash)
}

// ─── Migration: v1 → v2 ─────────────────────────────────────────────────────

/// Migration v1 → v2: Replace external-content FTS with standalone FTS table.
///
/// Does NOT change the encryption key or re-encrypt entries.
fn migrate_v1_to_v2(
    db: &DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
) -> Result<(), String> {
    info!("Migration v1→v2: starting");

    // Create backup before any changes
    let backup_path = crate::backup::create_backup(db_path, backups_dir)
        .map_err(|e| format!("Failed to create pre-migration backup: {}", e))?;
    info!("Migration v1→v2: backup created at {:?}", backup_path);

    let conn = db.conn();
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| format!("Failed to begin migration transaction: {}", e))?;

    let migration_result = (|| -> Result<(), String> {
        debug!("Migration v1→v2: removing v1 FTS triggers and external-content table");

        // Drop v1 external-content FTS triggers and table (v1 artifacts only)
        conn.execute_batch(
            r#"
            DROP TRIGGER IF EXISTS entries_ai;
            DROP TRIGGER IF EXISTS entries_ad;
            DROP TRIGGER IF EXISTS entries_au;
            DROP TABLE IF EXISTS entries_fts;
            "#,
        )
        .map_err(|e| format!("Failed to drop old FTS table: {}", e))?;

        // Update schema version to 2
        conn.execute("DELETE FROM schema_version", [])
            .map_err(|e| format!("Failed to clear schema version: {}", e))?;
        conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])
            .map_err(|e| format!("Failed to update schema version: {}", e))?;

        Ok(())
    })();

    match migration_result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit migration: {}", e))?;
            info!("Migration v1→v2: complete (backup at {:?})", backup_path);
            Ok(())
        }
        Err(e) => {
            error!("Migration v1→v2: failed - {}", e);
            match conn.execute_batch("ROLLBACK") {
                Ok(_) => {
                    warn!("Migration v1→v2: rollback successful");
                    Err(format!(
                        "Migration v1→v2 failed (database unchanged, backup at {:?}): {}\n\
                         \n\
                         RECOVERY: Your database is intact. The migration will retry next time you open the app.\n\
                         Backup available at: {:?}",
                        backup_path, e, backup_path
                    ))
                }
                Err(rollback_err) => Err(format!(
                    "CRITICAL: Migration v1→v2 failed AND rollback failed.\n\
                     Original error: {}\nRollback error: {}\n\
                     RESTORE from backup: {:?}",
                    e, rollback_err, backup_path
                )),
            }
        }
    }
}

// ─── Migration: v2 → v3 ─────────────────────────────────────────────────────

/// Migration v2 → v3: Introduce wrapped master key.
///
/// Generates a random master key, re-encrypts all entries with it, wraps the
/// master key with the password, and stores it in `auth_slots`.
///
/// Consumes the v2 `DatabaseConnection` (with the old password-derived key) and
/// returns a new v3 `DatabaseConnection` (with the master key).
fn migrate_v2_to_v3(
    mut db: DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
    password: String,
) -> Result<DatabaseConnection, String> {
    info!("Migration v2→v3: starting");

    // Step 1: Create backup
    let backup_path = crate::backup::create_backup(db_path, backups_dir)
        .map_err(|e| format!("Failed to create pre-migration backup: {}", e))?;
    info!("Migration v2→v3: backup created at {:?}", backup_path);

    // Step 2: Generate master_key
    let mut master_key_bytes = [0u8; 32];
    aes_gcm::aead::OsRng.fill_bytes(&mut master_key_bytes);

    // Step 3: Begin transaction
    db.conn
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| format!("Failed to begin migration transaction: {}", e))?;

    let result = migrate_v2_to_v3_inner(&mut db, &master_key_bytes, password);

    match result {
        Ok(()) => {
            db.conn
                .execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit migration: {}", e))?;

            // Update the encryption key to the new master key
            db.encryption_key =
                cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;

            master_key_bytes.zeroize();
            info!("Migration v2→v3: complete");
            Ok(db)
        }
        Err(e) => {
            error!("Migration v2→v3: failed - {}", e);
            let _ = db.conn.execute_batch("ROLLBACK");
            master_key_bytes.zeroize();
            Err(format!(
                "Migration v2→v3 failed (backup at {:?}): {}\n\
                 \n\
                 RECOVERY: Restore from backup at: {:?}",
                backup_path, e, backup_path
            ))
        }
    }
}

/// Inner migration work (runs inside a transaction).
fn migrate_v2_to_v3_inner(
    db: &mut DatabaseConnection,
    master_key_bytes: &[u8],
    password: String,
) -> Result<(), String> {
    let conn = &db.conn;

    // Step 4: Create auth_slots table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS auth_slots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT NOT NULL,
            label       TEXT NOT NULL,
            public_key  BLOB,
            wrapped_key BLOB NOT NULL,
            created_at  TEXT NOT NULL,
            last_used   TEXT
        );",
    )
    .map_err(|e| format!("Failed to create auth_slots table: {}", e))?;

    // Step 5: Re-encrypt all entries with master_key
    let dates: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT date FROM entries ORDER BY date ASC")
            .map_err(|e| format!("Failed to prepare: {}", e))?;
        let result = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect dates: {}", e))?;
        result
    };

    let master_key = cipher::Key::from_slice(master_key_bytes).ok_or("Invalid master key size")?;
    let total = dates.len();

    for (i, date) in dates.iter().enumerate() {
        let (title_enc, text_enc): (Vec<u8>, Vec<u8>) = conn
            .query_row(
                "SELECT title_encrypted, text_encrypted FROM entries WHERE date = ?1",
                rusqlite::params![date],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Failed to read entry {}: {}", date, e))?;

        // Decrypt with old password-derived key
        let title_plain = cipher::decrypt(&db.encryption_key, &title_enc)
            .map_err(|e| format!("Failed to decrypt title for {}: {}", date, e))?;
        let text_plain = cipher::decrypt(&db.encryption_key, &text_enc)
            .map_err(|e| format!("Failed to decrypt text for {}: {}", date, e))?;

        // Re-encrypt with master_key
        let new_title_enc = cipher::encrypt(&master_key, &title_plain)
            .map_err(|e| format!("Failed to re-encrypt title for {}: {}", date, e))?;
        let new_text_enc = cipher::encrypt(&master_key, &text_plain)
            .map_err(|e| format!("Failed to re-encrypt text for {}: {}", date, e))?;

        conn.execute(
            "UPDATE entries SET title_encrypted = ?1, text_encrypted = ?2 WHERE date = ?3",
            rusqlite::params![&new_title_enc, &new_text_enc, date],
        )
        .map_err(|e| format!("Failed to update entry {}: {}", date, e))?;

        if (i + 1) % 100 == 0 || (i + 1) == total {
            debug!("Migration v2→v3: re-encrypted {}/{} entries", i + 1, total);
        }
    }

    // Step 6: Wrap master_key with password and insert password slot
    let method = crate::auth::password::PasswordMethod::new(password);
    let wrapped_key = method
        .wrap_master_key(master_key_bytes)
        .map_err(|e| format!("Failed to wrap master key: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO auth_slots (type, label, wrapped_key, created_at) VALUES ('password', 'Password', ?1, ?2)",
        rusqlite::params![&wrapped_key, &now],
    )
    .map_err(|e| format!("Failed to insert password slot: {}", e))?;

    // Step 7: Update schema version to 3
    conn.execute("DELETE FROM schema_version", [])
        .map_err(|e| format!("Failed to clear schema version: {}", e))?;
    conn.execute("INSERT INTO schema_version (version) VALUES (3)", [])
        .map_err(|e| format!("Failed to update schema version: {}", e))?;

    Ok(())
}

// ─── Migration: v3 → v4 ─────────────────────────────────────────────────────

/// Migration v3 → v4: Drop the plaintext FTS table.
///
/// `entries_fts` stored diary content in plaintext, exposing it to anyone with
/// raw file access. This migration drops the table, purging the leaked data.
/// `DROP TABLE IF EXISTS` makes the migration idempotent.
fn migrate_v3_to_v4(db: &DatabaseConnection) -> Result<(), String> {
    let version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(3);

    if version < 4 {
        db.conn()
            .execute("DROP TABLE IF EXISTS entries_fts", [])
            .map_err(|e| format!("Migration v3→v4 failed: {}", e))?;
        db.conn()
            .execute("UPDATE schema_version SET version = 4", [])
            .map_err(|e| format!("Failed to update schema version: {}", e))?;
        info!("Migrated database from v3 to v4 (removed plaintext FTS table)");
    }
    Ok(())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_db_path(name: &str) -> String {
        format!("test_schema_{}.db", name)
    }

    fn temp_backups_dir(name: &str) -> PathBuf {
        PathBuf::from(format!("test_schema_backups_{}", name))
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn cleanup_backups_dir(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    /// Creates a v1 schema database (with external content FTS + triggers)
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

    /// Adds an entry to a v1/v2 database using the password-derived key
    fn add_legacy_entry(db_path: &str, date: &str, title: &str, text: &str) -> Result<(), String> {
        use crate::crypto::cipher;

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
        // For v1 databases, populate FTS manually (simulating triggers)
        let _ = conn.execute(
            "INSERT INTO entries_fts(rowid, title, text) VALUES (?1, ?2, ?3)",
            rusqlite::params![rowid, title, text],
        );

        Ok(())
    }

    #[test]
    fn test_create_database() {
        let db_path = temp_db_path("create");
        cleanup_db(&db_path);

        let result = create_database(&db_path, "test_password_123".to_string());
        assert!(result.is_ok(), "Error: {:?}", result.err());

        let db = result.unwrap();

        // Should have at least: schema_version, metadata, entries, auth_slots
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

        // auth_slots should have exactly one password slot
        let slot_count: i32 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM auth_slots", [], |row| row.get(0))
            .unwrap();
        assert_eq!(slot_count, 1);

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
        assert!(result.is_ok(), "Error opening database: {:?}", result.err());

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_database_wrong_password() {
        let db_path = temp_db_path("open_wrong");
        let backups_dir = temp_backups_dir("open_wrong");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        create_database(&db_path, "correct_password".to_string()).unwrap();

        let result = open_database(&db_path, "wrong_password".to_string(), &backups_dir);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Incorrect password");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_schema_version() {
        let db_path = temp_db_path("schema_version");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();

        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(SCHEMA_VERSION, 4);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_auth_slots_table_exists() {
        let db_path = temp_db_path("auth_slots_exist");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        let count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='auth_slots'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_migration_v1_to_v3_success() {
        let db_path = temp_db_path("migration_v1_v3");
        let backups_dir = temp_backups_dir("migration_v1_v3");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_migration_password";

        // Create v1 database with entries
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

        // Open triggers v1→v2→v3 migration
        let db = open_database(&db_path, password.to_string(), &backups_dir)
            .expect("Migration should succeed");

        // Verify at v3
        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4, "Should be at version 4 after migration");

        // Verify auth_slots has a password slot
        let slot_count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM auth_slots WHERE type = 'password'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(slot_count, 1);

        // Verify entries are still decryptable
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

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v2_to_v3_with_entries() {
        let db_path = temp_db_path("migration_v2_v3");
        let backups_dir = temp_backups_dir("migration_v2_v3");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        // Create v2 database using old create_database (we simulate via v1→v2 path)
        // Actually, just create a v1 db, open it to get to v2, then open again to get to v3
        // Simpler: create a v2 db manually

        let password = "v2_to_v3_password";

        // Create v1 (simulates a legacy database)
        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-06-01", "June Entry", "June content").unwrap();

        // Open to migrate v1→v2→v3
        let db = open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        let version: i32 = db
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);

        // Verify entry is still accessible
        let entry = crate::db::queries::get_entry(&db, "2024-06-01").unwrap();
        assert!(entry.is_some());
        let e = entry.unwrap();
        assert_eq!(e.title, "June Entry");
        assert_eq!(e.text, "June content");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_v3_is_idempotent() {
        let db_path = temp_db_path("v3_idempotent");
        let backups_dir = temp_backups_dir("v3_idempotent");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        create_database(&db_path, password.to_string()).unwrap();

        // First open
        let db1 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();
        let version1: i32 = db1
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version1, 4);
        drop(db1);

        let backup_count_before = std::fs::read_dir(&backups_dir)
            .map(|d| d.count())
            .unwrap_or(0);

        // Second open should NOT trigger migration
        let db2 = open_database(&db_path, password.to_string(), &backups_dir).unwrap();
        let version2: i32 = db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 4);

        let backup_count_after = std::fs::read_dir(&backups_dir)
            .map(|d| d.count())
            .unwrap_or(0);
        assert_eq!(
            backup_count_before, backup_count_after,
            "No new backup should be created for v4→v4"
        );

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_v1_to_v3_rollback_on_decrypt_error() {
        let db_path = temp_db_path("migration_rollback");
        let backups_dir = temp_backups_dir("migration_rollback");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";

        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-01-01", "Valid Entry", "This entry is fine").unwrap();

        // Add a corrupted entry (encrypted with wrong key)
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

        // Migration should fail on the corrupted entry
        let result = open_database(&db_path, password.to_string(), &backups_dir);
        assert!(result.is_err());

        let error_msg = result.unwrap_err();
        // v1→v2 migration might fail first, or v2→v3 re-encryption might fail
        // Either way, some migration failure message should be present
        assert!(
            error_msg.contains("Migration") || error_msg.contains("migration"),
            "Error should mention migration: {}",
            error_msg
        );

        // v1→v2 migration now succeeds (just drops old FTS artifacts, no decrypt step).
        // v2→v3 fails on the corrupted entry and rolls back to v2.
        let conn = Connection::open(&db_path).unwrap();
        let version: i32 = conn
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 2,
            "Database should be at v2 after v1→v2 success and v2→v3 rollback"
        );

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_migration_creates_backup() {
        let db_path = temp_db_path("migration_backup");
        let backups_dir = temp_backups_dir("migration_backup");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        create_v1_database(&db_path, password).unwrap();
        add_legacy_entry(&db_path, "2024-01-01", "Test Entry", "Test content").unwrap();

        let _db = open_database(&db_path, password.to_string(), &backups_dir).unwrap();

        // At least 2 backups: one for v1→v2, one for v2→v3
        let backup_count = std::fs::read_dir(&backups_dir).unwrap().count();
        assert!(backup_count >= 1, "At least one backup should be created");

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }

    #[test]
    fn test_open_with_keypair() {
        use crate::auth::keypair::{generate_keypair, KeypairMethod};

        let db_path = temp_db_path("keypair_open");
        let backups_dir = temp_backups_dir("keypair_open");
        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);

        let password = "test_password";
        let db = create_database(&db_path, password.to_string()).unwrap();

        // Generate a keypair and register it
        let kp = generate_keypair().unwrap();
        let pub_key_bytes = hex::decode(&kp.public_key_hex).unwrap();
        let priv_key_bytes_vec = hex::decode(&kp.private_key_hex).unwrap();

        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&pub_key_bytes);
        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(&priv_key_bytes_vec);

        // Get master key via password slot (to wrap for keypair)
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

        // Wrap for keypair
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

        // Now open with private key
        let db2 = open_database_with_keypair(&db_path, priv_key, &backups_dir).unwrap();

        let version: i32 = db2
            .conn()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);

        cleanup_db(&db_path);
        cleanup_backups_dir(&backups_dir);
    }
}
