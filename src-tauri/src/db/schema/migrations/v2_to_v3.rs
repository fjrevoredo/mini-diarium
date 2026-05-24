use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use aes_gcm::aead::rand_core::RngCore;
use log::{debug, error, info};
use rusqlite;
use std::path::Path;
use zeroize::Zeroize;

/// Migration v2 → v3: Introduce wrapped master key.
///
/// Generates a random master key, re-encrypts all entries with it, wraps the
/// master key with the password, and stores it in `auth_slots`.
///
/// Consumes the v2 `DatabaseConnection` (with the old password-derived key) and
/// returns a new v3 `DatabaseConnection` (with the master key).
pub(crate) fn migrate_v2_to_v3(
    mut db: DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
    password: String,
) -> Result<DatabaseConnection, String> {
    info!("Migration v2→v3: starting");

    let backup_path = crate::backup::create_backup(db_path, backups_dir)
        .map_err(|e| format!("Failed to create pre-migration backup: {}", e))?;
    info!("Migration v2→v3: backup created at {:?}", backup_path);

    let mut master_key_bytes = [0u8; 32];
    aes_gcm::aead::OsRng.fill_bytes(&mut master_key_bytes);

    db.conn
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| format!("Failed to begin migration transaction: {}", e))?;

    let result = migrate_v2_to_v3_inner(&mut db, &master_key_bytes, password);

    match result {
        Ok(()) => {
            db.conn
                .execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit migration: {}", e))?;

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

fn migrate_v2_to_v3_inner(
    db: &mut DatabaseConnection,
    master_key_bytes: &[u8],
    password: String,
) -> Result<(), String> {
    let conn = &db.conn;

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

        let title_plain = cipher::decrypt(&db.encryption_key, &title_enc)
            .map_err(|e| format!("Failed to decrypt title for {}: {}", date, e))?;
        let text_plain = cipher::decrypt(&db.encryption_key, &text_enc)
            .map_err(|e| format!("Failed to decrypt text for {}: {}", date, e))?;

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

    conn.execute("DELETE FROM schema_version", [])
        .map_err(|e| format!("Failed to clear schema version: {}", e))?;
    conn.execute("INSERT INTO schema_version (version) VALUES (3)", [])
        .map_err(|e| format!("Failed to update schema version: {}", e))?;

    Ok(())
}
