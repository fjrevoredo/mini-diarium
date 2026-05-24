use super::legacy::{derive_key_from_hash, get_metadata};
use super::migrations::{apply_pending, migrate_v1_to_v2, migrate_v2_to_v3};
use super::DatabaseConnection;
use crate::crypto::{cipher, password};
use crate::db::queries;
use rusqlite::Connection;
use std::path::Path;
use x25519_dalek::{PublicKey, StaticSecret};

/// Opens an existing encrypted diary database using a password.
///
/// Handles schema migrations automatically:
/// - v1 → v2: FTS table restructure (no re-encryption)
/// - v2 → v3: Introduce wrapped master key (re-encrypts all entries)
/// - v3 → v4: Drop plaintext FTS table (security fix)
/// - v4 → v5: Add AUTOINCREMENT id to entries table (multiple entries per day)
/// - v5: Read master key from auth_slots password slot
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
        let db = open_v3_with_password(conn, password, backups_dir.as_ref())?;
        apply_pending(&db)?;
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

    if current_version < 2 {
        migrate_v1_to_v2(&db_conn, db_path_ref, backups_dir.as_ref())?;
    }

    db_conn = migrate_v2_to_v3(db_conn, db_path_ref, backups_dir.as_ref(), password)?;
    apply_pending(&db_conn)?;

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

    let static_secret = StaticSecret::from(private_key_bytes);
    let public_key = PublicKey::from(&static_secret);
    let pub_key_slice: &[u8] = public_key.as_bytes();

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

    let unwrap_method = crate::auth::keypair::PrivateKeyMethod {
        private_key: private_key_bytes,
    };
    let master_key_bytes = unwrap_method
        .unwrap_master_key(&wrapped_key)
        .map_err(|e| format!("Failed to unlock with key file: {}", e))?;

    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;

    queries::update_slot_last_used(&conn, slot_id)?;

    let _ = backups_dir;

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    apply_pending(&db)?;
    Ok(db)
}

/// Opens an existing database using the device auto key.
///
/// Looks for an `auth_slots` row with `type = 'auto'` and unwraps the master key
/// using `auto_key_bytes` (loaded from config.json by the caller).
pub fn open_database_auto<P1: AsRef<Path>, P2: AsRef<Path>>(
    db_path: P1,
    auto_key_bytes: &[u8; 32],
    backups_dir: P2,
) -> Result<DatabaseConnection, String> {
    let conn = Connection::open(db_path.as_ref())
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let current_version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1);

    if current_version < 3 {
        return Err("Local-key authentication requires a v3+ journal. \
             Please unlock with your password first to upgrade."
            .to_string());
    }

    let slot_result = conn.query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'auto' ORDER BY id ASC LIMIT 1",
        [],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );

    let (slot_id, wrapped_key) = match slot_result {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err("No local-key auth slot found".to_string());
        }
        Err(e) => return Err(format!("Database error: {}", e)),
    };

    let method = crate::auth::auto_key::AutoKeyMethod { auto_key_bytes };
    let master_key_bytes = method.unwrap_master_key(&wrapped_key)?;

    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;

    queries::update_slot_last_used(&conn, slot_id)?;

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    apply_pending(&db)?;

    let _ = backups_dir;

    Ok(db)
}

fn open_v3_with_password(
    conn: Connection,
    password: String,
    _backups_dir: &Path,
) -> Result<DatabaseConnection, String> {
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

    let method = crate::auth::password::PasswordMethod::new(password);
    let master_key_bytes = method
        .unwrap_master_key(&wrapped_key)
        .map_err(|_| "Incorrect password".to_string())?;

    let encryption_key =
        cipher::Key::from_slice(&master_key_bytes).ok_or("Invalid master key size")?;

    queries::update_slot_last_used(&conn, slot_id)?;

    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}
