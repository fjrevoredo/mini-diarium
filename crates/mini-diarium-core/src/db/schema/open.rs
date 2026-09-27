use super::compat::ensure_journal_readable;
use super::create::open_connection;
use super::legacy::{derive_key_from_hash, get_metadata};
use super::migrations::{apply_pending, migrate_v1_to_v2, migrate_v2_to_v3};
use super::{DatabaseConnection, SCHEMA_VERSION};
use crate::backup::{self, BackupContext, SnapshotTrigger};
use crate::crypto::{cipher, password};
use crate::db::queries;
use log::info;
use rusqlite::Connection;
use std::path::Path;
use x25519_dalek::{PublicKey, StaticSecret};

/// Takes a verified snapshot before `apply_pending` runs, then migrates.
///
/// **This is the one place where a failed snapshot blocks the operation.** Everywhere else
/// a backup failure is logged and swallowed, because a missing backup is better than a
/// journal the user cannot open. A migration is the opposite case: it rewrites the journal
/// in place, so proceeding without a recoverable copy is the unrecoverable outcome. A
/// journal that is already at the current schema version needs no snapshot — nothing is
/// about to be rewritten — so the common unlock path is untouched.
pub(crate) fn migrate_with_pre_migration_snapshot(
    db: &DatabaseConnection,
    db_path: &Path,
    backups_dir: &Path,
) -> Result<(), String> {
    // Defense in depth: every open path already calls the guard before its first write, but
    // this is the single choke point every writer passes through, so a future open path that
    // forgets still refuses a too-new journal before `apply_pending` runs.
    ensure_journal_readable(db.conn())?;

    let stored_version: i32 = db
        .conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(SCHEMA_VERSION);

    if stored_version < SCHEMA_VERSION {
        info!(
            "Schema migration pending (v{} -> v{}); taking a pre-migration snapshot",
            stored_version, SCHEMA_VERSION
        );
        let ctx = BackupContext {
            db_path,
            backups_dir,
            app_version: None,
        };
        backup::create_snapshot(db, &ctx, SnapshotTrigger::Migration).map_err(|e| {
            format!(
                "Migration aborted: the pre-migration backup could not be created ({}). \
                 Your journal has not been modified. Free up disk space in the backups \
                 folder and reopen the app to retry.",
                e
            )
        })?;
    }

    apply_pending(db)
}

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

    let conn = open_connection(db_path_ref)?;
    // Before any write (`update_slot_last_used`) and before the KDF: a journal written by a
    // newer app must stay byte-for-byte untouched.
    ensure_journal_readable(&conn)?;

    let current_version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .unwrap_or(1);

    if current_version >= 3 {
        let db = open_v3_with_password(conn, password, backups_dir.as_ref())?;
        migrate_with_pre_migration_snapshot(&db, db_path_ref, backups_dir.as_ref())?;
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
        migrate_v1_to_v2(&db_conn, backups_dir.as_ref())?;
    }

    db_conn = migrate_v2_to_v3(db_conn, backups_dir.as_ref(), password)?;
    migrate_with_pre_migration_snapshot(&db_conn, db_path_ref, backups_dir.as_ref())?;

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

    let conn = open_connection(db_path_ref)?;
    // Before any write (`update_slot_last_used`) and before the KDF: a journal written by a
    // newer app must stay byte-for-byte untouched.
    ensure_journal_readable(&conn)?;

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

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    queries::update_slot_last_used(&db, slot_id)?;
    migrate_with_pre_migration_snapshot(&db, db_path_ref, backups_dir.as_ref())?;
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
    let conn = open_connection(db_path.as_ref())?;
    ensure_journal_readable(&conn)?;

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

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    queries::update_slot_last_used(&db, slot_id)?;
    migrate_with_pre_migration_snapshot(&db, db_path.as_ref(), backups_dir.as_ref())?;

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

    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    queries::update_slot_last_used(&db, slot_id)?;
    Ok(db)
}

#[cfg(test)]
mod pre_migration_snapshot_tests {
    use super::*;
    use crate::backup::{list_snapshots, SnapshotTrigger};
    use crate::db::{insert_entry, DiaryEntry};

    fn entry(title: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: "2024-01-15".to_string(),
            title: title.to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: "2024-01-15T00:00:00Z".to_string(),
            date_updated: "2024-01-15T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        }
    }

    /// A genuine v12 journal: build the current schema, then reverse the v12→v13 migration.
    ///
    /// Rolling the real schema back is more faithful than hand-writing v12 DDL — it keeps
    /// every other table exactly as the app produces it, so the snapshot under test is a
    /// real journal rather than a fixture that only resembles one.
    fn seeded_v12_journal(name: &str) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-premigration-{name}-"))
            .tempdir()
            .unwrap();
        let db_path = dir.path().join("diary.db");

        let db = crate::db::create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("Written before the migration")).unwrap();
        db.conn()
            .execute_batch(
                "ALTER TABLE entries DROP COLUMN locked;
                 UPDATE schema_version SET version = 12;",
            )
            .unwrap();
        drop(db);

        (dir, db_path)
    }

    #[test]
    fn test_migration_snapshot_exists_before_apply_pending() {
        let (dir, db_path) = seeded_v12_journal("exists");
        let backups_dir = dir.path().join("backups");

        let db = open_database(&db_path, "test_password".to_string(), &backups_dir).unwrap();

        // The migration ran.
        assert_eq!(crate::db::read_schema_version(&db).unwrap(), SCHEMA_VERSION);

        // And a snapshot of the *pre-migration* state exists.
        let snapshots = list_snapshots(&backups_dir).unwrap();
        assert_eq!(snapshots.len(), 1, "no pre-migration snapshot was taken");
        assert_eq!(snapshots[0].trigger, SnapshotTrigger::Migration);
        assert!(snapshots[0].verified);
        assert_eq!(
            snapshots[0].db_schema_version,
            Some(12),
            "the snapshot captured the post-migration state, not the pre-migration one — \
             it was taken after apply_pending"
        );
        assert_eq!(snapshots[0].entry_count, Some(1));
    }

    #[test]
    fn test_no_snapshot_is_taken_when_no_migration_is_pending() {
        // The common case: opening an up-to-date journal must not snapshot on this path.
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups");
        drop(crate::db::create_database(&db_path, "test_password".to_string()).unwrap());

        open_database(&db_path, "test_password".to_string(), &backups_dir).unwrap();

        assert!(
            list_snapshots(&backups_dir).unwrap().is_empty(),
            "an up-to-date journal triggered a pre-migration snapshot"
        );
    }

    #[test]
    fn test_failed_pre_migration_snapshot_aborts_migration() {
        // The one place a backup failure blocks the operation. Migrating without a
        // recoverable copy is the unrecoverable case, so it must not proceed.
        let (dir, db_path) = seeded_v12_journal("aborts");

        // Occupy the backups directory path with a file, so it can never be created.
        let backups_dir = dir.path().join("backups");
        std::fs::write(&backups_dir, b"not a directory").unwrap();

        let result = open_database(&db_path, "test_password".to_string(), &backups_dir);

        let err = result.expect_err("the migration should have been refused");
        assert!(
            err.contains("Migration aborted"),
            "expected an explicit abort, got: {err}"
        );

        // The journal is untouched: still v12, still openable once backups work again.
        let conn = open_connection(&db_path).unwrap();
        let version: i32 = conn
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 12,
            "the migration ran despite the pre-migration snapshot failing"
        );
    }
}

#[cfg(test)]
mod too_new_tests {
    use super::*;
    use crate::db::schema::compat::{JOURNAL_TOO_NEW, MIN_READER_VERSION_KEY};
    use std::path::PathBuf;

    const PASSWORD: &str = "test_password";

    /// Bumps `schema_version` past what this app knows, optionally writing the marker.
    fn bump_past_current(db_path: &Path, marker: Option<&str>) {
        let conn = open_connection(db_path).unwrap();
        conn.execute(
            "UPDATE schema_version SET version = ?1",
            [SCHEMA_VERSION + 1],
        )
        .unwrap();
        if let Some(m) = marker {
            crate::db::queries::db_settings::set_db_setting_conn(&conn, MIN_READER_VERSION_KEY, m)
                .unwrap();
        }
    }

    /// A password journal written "by a newer app", plus its backups directory.
    fn too_new_password_journal(marker: Option<&str>) -> (tempfile::TempDir, PathBuf, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        drop(crate::db::create_database(&db_path, PASSWORD.to_string()).unwrap());
        bump_past_current(&db_path, marker);
        let backups_dir = dir.path().join("backups");
        (dir, db_path, backups_dir)
    }

    fn assert_refused_and_untouched(
        result: Result<DatabaseConnection, String>,
        db_path: &Path,
        before: &[u8],
        backups_dir: &Path,
    ) {
        assert_eq!(result.unwrap_err(), JOURNAL_TOO_NEW);
        assert_eq!(
            std::fs::read(db_path).unwrap(),
            before,
            "a refused journal must stay byte-for-byte unchanged"
        );
        assert!(
            !backups_dir.exists(),
            "a refused open must not take a snapshot"
        );
    }

    #[test]
    fn test_password_open_refuses_a_newer_journal() {
        let (_dir, db_path, backups_dir) = too_new_password_journal(None);
        let before = std::fs::read(&db_path).unwrap();
        let result = open_database(&db_path, PASSWORD.to_string(), &backups_dir);
        assert_refused_and_untouched(result, &db_path, &before, &backups_dir);
    }

    #[test]
    fn test_password_open_refuses_a_newer_journal_before_checking_the_password() {
        // The same message for a wrong password proves the guard runs before the KDF.
        let (_dir, db_path, backups_dir) = too_new_password_journal(None);
        let before = std::fs::read(&db_path).unwrap();
        let result = open_database(&db_path, "wrong_password".to_string(), &backups_dir);
        assert_refused_and_untouched(result, &db_path, &before, &backups_dir);
    }

    #[test]
    fn test_keypair_open_refuses_a_newer_journal() {
        // No keypair slot exists: the guard must answer before the slot lookup does.
        let (_dir, db_path, backups_dir) = too_new_password_journal(None);
        let before = std::fs::read(&db_path).unwrap();
        let result = open_database_with_keypair(&db_path, [7u8; 32], &backups_dir);
        assert_refused_and_untouched(result, &db_path, &before, &backups_dir);
    }

    #[test]
    fn test_auto_open_refuses_a_newer_journal() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups");
        let auto_key = [5u8; 32];
        drop(crate::db::create_database_auto(&db_path, &auto_key).unwrap());
        bump_past_current(&db_path, None);
        let before = std::fs::read(&db_path).unwrap();

        let result = open_database_auto(&db_path, &auto_key, &backups_dir);
        assert_refused_and_untouched(result, &db_path, &before, &backups_dir);
    }

    #[test]
    fn test_peek_refuses_a_newer_journal() {
        let (_dir, db_path, _backups_dir) = too_new_password_journal(None);
        let before = std::fs::read(&db_path).unwrap();
        let err = crate::db::peek_auth_slot_types(&db_path).unwrap_err();
        assert_eq!(err, JOURNAL_TOO_NEW);
        assert_eq!(std::fs::read(&db_path).unwrap(), before);
    }

    #[test]
    fn test_migration_choke_point_refuses_a_newer_journal() {
        let (_dir, db_path, backups_dir) = too_new_password_journal(None);
        let db = DatabaseConnection {
            conn: open_connection(&db_path).unwrap(),
            encryption_key: cipher::Key::from_slice(&[1u8; 32]).unwrap(),
        };
        let err = migrate_with_pre_migration_snapshot(&db, &db_path, &backups_dir).unwrap_err();
        assert_eq!(err, JOURNAL_TOO_NEW);
    }

    #[test]
    fn test_compatible_marker_opens_without_migrating_or_downgrading() {
        let current = SCHEMA_VERSION.to_string();
        let (_dir, db_path, backups_dir) = too_new_password_journal(Some(&current));

        let db = open_database(&db_path, PASSWORD.to_string(), &backups_dir).unwrap();

        assert_eq!(
            crate::db::read_schema_version(&db).unwrap(),
            SCHEMA_VERSION + 1,
            "an opted-in newer journal must keep its version"
        );
        assert!(
            !backups_dir.exists(),
            "no migration snapshot for a journal ahead of the app"
        );
    }

    #[test]
    fn test_incompatible_or_garbage_marker_is_refused() {
        let too_high = (SCHEMA_VERSION + 1).to_string();
        for marker in [too_high.as_str(), "garbage"] {
            let (_dir, db_path, backups_dir) = too_new_password_journal(Some(marker));
            let before = std::fs::read(&db_path).unwrap();
            let result = open_database(&db_path, PASSWORD.to_string(), &backups_dir);
            assert_refused_and_untouched(result, &db_path, &before, &backups_dir);
        }
    }
}
