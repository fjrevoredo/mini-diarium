//! Reading a snapshot without adopting it.
//!
//! A snapshot is an ordinary encrypted journal, which is exactly what makes inspecting one
//! dangerous: the obvious way to look inside is to open it as a journal, and that writes to
//! it — `update_slot_last_used` alone is enough to modify the restore point the user was
//! reaching for. (That is [KI-11]: **+ Open Existing** accepted a `backup-*.db` and destroyed
//! it, and the app now refuses those paths outright.)
//!
//! Everything here therefore holds three properties that the normal open path deliberately
//! does not:
//!
//! 1. **The connection is `SQLITE_OPEN_READ_ONLY`.** Not a convention — SQLite refuses the
//!    write. A snapshot is evidence, and evidence that changes when you look at it is not
//!    evidence.
//! 2. **No migration runs.** A pre-migration snapshot is, by definition, an older schema
//!    version than the app expects; migrating it here would destroy the one copy taken
//!    because the migration was the risk. [`list_snapshot_entries`] adapts to the schema it
//!    finds instead.
//! 3. **Nothing is registered.** No `config.json` entry, no `DiaryState`, no backup trigger.
//!    The caller owns the returned connection and is responsible for dropping it, which
//!    zeroizes the master key.
//!
//! [KI-11]: ../../../../docs/KNOWN_ISSUES.md

use std::path::Path;

use rusqlite::Connection;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::crypto::cipher;
use crate::db::schema::{open_connection_readonly, DatabaseConnection};

/// The credential offered to a snapshot, mirroring the three ways a journal unlocks.
///
/// Taken by value and zeroized on drop: a snapshot may need a *different* credential than
/// the live journal (see [`compare_snapshot_credentials`]), so this is frequently a password
/// the user typed once, for one snapshot, and which nothing else should retain.
#[derive(Zeroize, ZeroizeOnDrop)]
pub enum SnapshotCredential {
    Password(String),
    /// Raw X25519 private key bytes, as read from a key file.
    PrivateKey([u8; 32]),
    /// The device-bound auto key from `config.json` (local-only journals).
    AutoKey([u8; 32]),
}

impl std::fmt::Debug for SnapshotCredential {
    /// Prints the variant only. Key material must never reach a log line.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            SnapshotCredential::Password(_) => "Password",
            SnapshotCredential::PrivateKey(_) => "PrivateKey",
            SnapshotCredential::AutoKey(_) => "AutoKey",
        };
        write!(f, "SnapshotCredential::{name}(<redacted>)")
    }
}

/// One entry as the inspector shows it.
///
/// Deliberately the same four fields as [`crate::db::TimelineRow`] minus `locked`: title and
/// a short preview, never the full entry text. The inspector is a browsing surface, and
/// sending whole decrypted entries across an IPC boundary to render a list would put far
/// more plaintext on the wire than the screen ever shows.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct SnapshotEntry {
    pub id: i64,
    pub date: String,
    pub title: String,
    pub preview: String,
}

/// Whether a snapshot still accepts the credentials the live journal accepts.
///
/// The interesting case is finding B-11: a password change re-wraps the master key in the
/// live journal only. Every snapshot taken beforehand keeps the **old** wrapped key and
/// therefore still opens with the **old** password — which the user has by then been trained
/// to think of as wrong. Telling them that before they type is the whole point (scenario
/// UX-3); discovering it through a failed unlock reads as a corrupt backup.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct SnapshotCredentialReport {
    /// Slot types the snapshot accepts, e.g. `["password"]`. Types only — labels are
    /// user-chosen text and are excluded here for the same reason the manifest excludes
    /// them.
    pub snapshot_slot_types: Vec<String>,
    /// Slot types the live journal accepts.
    pub live_slot_types: Vec<String>,
    /// `true` when the snapshot's slots are not byte-identical to the live journal's, so the
    /// credential that opens the journal today may not open this snapshot.
    pub differs_from_live: bool,
    /// `false` when the live journal could not be read at all, which makes
    /// `differs_from_live` meaningless rather than merely negative.
    pub compared: bool,
}

/// Opens a snapshot read-only with `credential`, returning a connection the caller owns.
///
/// Does not migrate, does not touch `last_used`, and does not register anything. Errors are
/// written for a user looking at a backup they may need urgently, not for a developer.
pub fn open_snapshot_readonly(
    path: &Path,
    credential: SnapshotCredential,
) -> Result<DatabaseConnection, String> {
    if !path.is_file() {
        return Err("This backup is no longer in the backups folder.".to_string());
    }

    let conn = open_connection_readonly(path)
        .map_err(|_| "This backup could not be opened for reading.".to_string())?;

    let version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .map_err(|_| "This backup is not a readable Mini Diarium journal.".to_string())?;

    // Auth slots arrived in v3. Older snapshots keep their key in the legacy `metadata`
    // table, and reading them means migrating them — which this module must never do.
    // Whole-journal restore (`backup::restore`) refuses the same snapshots for the same
    // reason: `apply_pending` only covers v3 onward, so there is no in-app path that opens
    // one of these without the original password to redo the v1/v2→v3 migration by hand.
    if version < 3 {
        return Err(
            "This backup uses a journal format older than version 3, which this app can \
             neither inspect nor restore automatically."
                .to_string(),
        );
    }

    let encryption_key = unwrap_master_key(&conn, &credential)?;

    // Same wrapper the live journal uses, so every existing read query works against a
    // snapshot unchanged. What makes it read-only is the connection inside it, not the type.
    Ok(DatabaseConnection {
        conn,
        encryption_key,
    })
}

/// Lists a snapshot's entries, newest first, adapting to the schema version it was taken at.
///
/// `preview_enc` arrived in v12 and `locked` in v13, so a pre-migration snapshot — the most
/// valuable kind — has neither. Querying columns that do not exist would fail on exactly the
/// snapshots that matter most, so the column set is read first and the query built to match.
pub fn list_snapshot_entries(db: &DatabaseConnection) -> Result<Vec<SnapshotEntry>, String> {
    let conn = db.conn();
    let has_preview = has_column(conn, "entries", "preview_enc")?;

    // `rowid` rather than `id`: v5 introduced `id INTEGER PRIMARY KEY AUTOINCREMENT`, which
    // *is* the rowid, so this reads correctly on both sides of that migration.
    let sql = if has_preview {
        // Transfer the (potentially large) text blob only for rows with no stored preview.
        "SELECT rowid, date, title_encrypted, \
                CASE WHEN preview_enc IS NOT NULL THEN NULL ELSE text_encrypted END, \
                preview_enc \
         FROM entries ORDER BY date DESC, rowid DESC"
    } else {
        "SELECT rowid, date, title_encrypted, text_encrypted, NULL \
         FROM entries ORDER BY date DESC, rowid DESC"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|_| "This backup's entries could not be read.".to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Option<Vec<u8>>>(3)?,
                row.get::<_, Option<Vec<u8>>>(4)?,
            ))
        })
        .map_err(|_| "This backup's entries could not be read.".to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "This backup's entries could not be read.".to_string())?;

    rows.into_iter()
        .map(|(id, date, title_enc, text_enc, preview_enc)| {
            let title = decrypt_field(db.key(), &title_enc)?;
            let preview = match preview_enc {
                Some(enc) => decrypt_field(db.key(), &enc)?,
                None => match text_enc {
                    Some(enc) => {
                        crate::db::queries::preview_from_html(&decrypt_field(db.key(), &enc)?)
                    }
                    None => String::new(),
                },
            };
            Ok(SnapshotEntry {
                id,
                date,
                title,
                preview,
            })
        })
        .collect()
}

/// Compares a snapshot's auth slots against the live journal's, without any key.
///
/// The slot columns are plaintext — only row *content* is encrypted — so this answers UX-3
/// before the user is asked for anything. The comparison is over `(type, public_key,
/// wrapped_key)`: a re-wrap produces a fresh nonce and ciphertext, so a password change is
/// visible as a byte difference even though the slot type is unchanged.
pub fn compare_snapshot_credentials(
    snapshot_path: &Path,
    live_db_path: &Path,
) -> Result<SnapshotCredentialReport, String> {
    let snapshot_slots = read_slot_fingerprints(snapshot_path)
        .ok_or_else(|| "This backup's credentials could not be read.".to_string())?;

    // A live journal that cannot be read is not evidence of drift. Saying "this backup needs
    // a different password" because the journal file is missing would be a guess presented
    // as a finding.
    let Some(live_slots) = read_slot_fingerprints(live_db_path) else {
        return Ok(SnapshotCredentialReport {
            snapshot_slot_types: slot_types(&snapshot_slots),
            live_slot_types: Vec::new(),
            differs_from_live: false,
            compared: false,
        });
    };

    Ok(SnapshotCredentialReport {
        snapshot_slot_types: slot_types(&snapshot_slots),
        live_slot_types: slot_types(&live_slots),
        differs_from_live: snapshot_slots != live_slots,
        compared: true,
    })
}

// ── Internals ─────────────────────────────────────────────────────────────────────────

/// A slot reduced to what can be compared without a key.
type SlotFingerprint = (String, Option<Vec<u8>>, Vec<u8>);

fn slot_types(slots: &[SlotFingerprint]) -> Vec<String> {
    let mut types: Vec<String> = slots.iter().map(|(kind, _, _)| kind.clone()).collect();
    types.dedup();
    types
}

/// Reads every auth slot's comparable fields, or `None` if the file cannot be read as a
/// journal at all.
fn read_slot_fingerprints(path: &Path) -> Option<Vec<SlotFingerprint>> {
    if !path.is_file() {
        return None;
    }
    let conn = open_connection_readonly(path).ok()?;
    let mut stmt = conn
        .prepare("SELECT type, public_key, wrapped_key FROM auth_slots ORDER BY type ASC, id ASC")
        .ok()?;
    let slots = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<Vec<u8>>>(1)?,
                row.get::<_, Vec<u8>>(2)?,
            ))
        })
        .ok()?
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    Some(slots)
}

fn unwrap_master_key(
    conn: &Connection,
    credential: &SnapshotCredential,
) -> Result<cipher::Key, String> {
    let master_key_bytes = match credential {
        SnapshotCredential::Password(password) => {
            let wrapped = wrapped_key_for(conn, "password", None).ok_or_else(|| {
                "This backup has no password to open it with. It was taken from a journal \
                 that used a different way of unlocking."
                    .to_string()
            })?;
            crate::auth::password::PasswordMethod::new(password.clone())
                .unwrap_master_key(&wrapped)
                .map_err(|_| {
                    "That password does not open this backup. A backup taken before you \
                     changed your password still needs the password you used then."
                        .to_string()
                })?
        }
        SnapshotCredential::PrivateKey(private_key) => {
            let static_secret = x25519_dalek::StaticSecret::from(*private_key);
            let public_key = x25519_dalek::PublicKey::from(&static_secret);
            let wrapped = wrapped_key_for(conn, "keypair", Some(public_key.as_bytes()))
                .ok_or_else(|| {
                    "This key file does not match any key in this backup.".to_string()
                })?;
            crate::auth::keypair::PrivateKeyMethod {
                private_key: *private_key,
            }
            .unwrap_master_key(&wrapped)
            .map_err(|_| "That key file does not open this backup.".to_string())?
        }
        SnapshotCredential::AutoKey(auto_key) => {
            let wrapped = wrapped_key_for(conn, "auto", None).ok_or_else(|| {
                "This backup was not taken from a journal that opens without a password."
                    .to_string()
            })?;
            crate::auth::auto_key::AutoKeyMethod {
                auto_key_bytes: auto_key,
            }
            .unwrap_master_key(&wrapped)
            .map_err(|_| {
                "This device's key does not open this backup. A journal without a password \
                 can only be opened on the device that created it."
                    .to_string()
            })?
        }
    };

    cipher::Key::from_slice(&master_key_bytes)
        .ok_or_else(|| "This backup's stored key is not the expected size.".to_string())
}

/// Returns the wrapped master key of the first slot of `slot_type`, optionally matching a
/// public key.
fn wrapped_key_for(
    conn: &Connection,
    slot_type: &str,
    public_key: Option<&[u8]>,
) -> Option<Vec<u8>> {
    match public_key {
        Some(pubkey) => conn
            .query_row(
                "SELECT wrapped_key FROM auth_slots WHERE type = ?1 AND public_key = ?2 LIMIT 1",
                rusqlite::params![slot_type, pubkey],
                |row| row.get(0),
            )
            .ok(),
        None => conn
            .query_row(
                "SELECT wrapped_key FROM auth_slots WHERE type = ?1 ORDER BY id ASC LIMIT 1",
                rusqlite::params![slot_type],
                |row| row.get(0),
            )
            .ok(),
    }
}

/// Shared with [`super::restore_entries`], which needs the same schema-adaptive read for a
/// single full entry that this module needs for the preview list.
pub(crate) fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|_| "This backup's structure could not be read.".to_string())?;
    let found = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|_| "This backup's structure could not be read.".to_string())?
        .filter_map(Result::ok)
        .any(|name| name == column);
    Ok(found)
}

/// Decrypts one stored field, mapping every failure to the same user-facing sentence.
///
/// A per-field cause would say which column failed, which is closer to the content than the
/// inspector has any reason to report.
fn decrypt_field(key: &cipher::Key, ciphertext: &[u8]) -> Result<String, String> {
    crate::format::decrypt_utf8(key, ciphertext, "snapshot inspection")
        .map_err(|_| "This backup's content could not be read with that credential.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
    use crate::db::{create_database, create_database_auto, insert_entry, DiaryEntry};
    use std::path::PathBuf;

    fn entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: 1,
            date_created: format!("{date}T00:00:00Z"),
            date_updated: format!("{date}T00:00:00Z"),
            metadata: None,
            locked: false,
        }
    }

    /// A journal with one snapshot taken from it. Returns the temp dir, the journal path,
    /// and the snapshot path.
    fn journal_with_snapshot(name: &str) -> (tempfile::TempDir, PathBuf, PathBuf) {
        let dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-inspect-{name}-"))
            .tempdir()
            .unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups");

        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "First", "<p>hello world</p>")).unwrap();
        insert_entry(&db, &entry("2024-03-20", "Second", "<p>later</p>")).unwrap();

        let ctx = BackupContext {
            db_path: &db_path,
            backups_dir: &backups_dir,
            app_version: Some("0.0.0-test"),
        };
        create_snapshot(&db, &ctx, SnapshotTrigger::Manual).unwrap();
        drop(db);

        let snapshot = list_snapshots(&backups_dir).unwrap();
        let snapshot_path = backups_dir.join(&snapshot[0].file_name);
        (dir, db_path, snapshot_path)
    }

    #[test]
    fn test_inspect_lists_the_snapshot_entries_newest_first() {
        let (_dir, _db_path, snapshot_path) = journal_with_snapshot("lists");

        let db = open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();
        let entries = list_snapshot_entries(&db).unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-03-20");
        assert_eq!(entries[0].title, "Second");
        assert_eq!(entries[1].title, "First");
        assert_eq!(
            entries[1].preview, "hello world",
            "the preview should be plain text, with the editor's HTML stripped"
        );
    }

    #[test]
    fn test_inspect_refuses_the_wrong_password() {
        let (_dir, _db_path, snapshot_path) = journal_with_snapshot("wrong_password");

        let err = open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("not_the_password".to_string()),
        )
        .expect_err("a wrong password must not open the snapshot");

        assert!(
            err.contains("does not open this backup"),
            "the message should point at the credential, got: {err}"
        );
    }

    #[test]
    fn test_inspect_does_not_write_to_the_snapshot() {
        // The whole reason this module exists: opening a snapshot must leave it byte-identical.
        // The normal open path writes `last_used` into the auth slot it unlocked with.
        let (_dir, _db_path, snapshot_path) = journal_with_snapshot("readonly");
        let before = std::fs::read(&snapshot_path).unwrap();

        let db = open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();
        list_snapshot_entries(&db).unwrap();
        drop(db);

        assert_eq!(
            before,
            std::fs::read(&snapshot_path).unwrap(),
            "inspecting the snapshot modified it"
        );
    }

    #[test]
    fn test_inspect_does_not_register_a_journal() {
        // Inspection must not leave a trace in the app data directory: no config.json is
        // written, and nothing new appears next to the snapshot.
        let (dir, _db_path, snapshot_path) = journal_with_snapshot("no_register");
        let before = listing(dir.path());

        let db = open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();
        list_snapshot_entries(&db).unwrap();
        drop(db);

        assert_eq!(before, listing(dir.path()), "inspection created files");
    }

    fn listing(root: &Path) -> Vec<PathBuf> {
        let mut found = Vec::new();
        let mut stack = vec![root.to_path_buf()];
        while let Some(path) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&path) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path.clone());
                }
                found.push(path);
            }
        }
        found.sort();
        found
    }

    #[test]
    fn test_a_snapshot_taken_before_a_password_change_is_detected_as_needing_the_old_one() {
        // Finding B-11, scenario UX-3. The snapshot keeps the old wrapped key; the live
        // journal does not.
        let (_dir, db_path, snapshot_path) = journal_with_snapshot("drift");

        let same = compare_snapshot_credentials(&snapshot_path, &db_path).unwrap();
        assert!(
            !same.differs_from_live,
            "a snapshot of the current state must not be reported as drifted"
        );
        assert!(same.compared);
        assert_eq!(same.snapshot_slot_types, vec!["password".to_string()]);

        // Change the password on the live journal only — the same O(1) re-wrap the
        // `change_password` command performs.
        let db = crate::db::open_database(
            &db_path,
            "test_password".to_string(),
            db_path.parent().unwrap().join("backups"),
        )
        .unwrap();
        let (slot_id, _) = crate::db::get_password_slot(&db).unwrap().unwrap();
        let rewrapped = crate::auth::PasswordMethod::new("brand_new_password".to_string())
            .wrap_master_key(db.key().as_bytes())
            .unwrap();
        crate::db::update_auth_slot_wrapped_key(&db, slot_id, &rewrapped).unwrap();
        drop(db);

        let drifted = compare_snapshot_credentials(&snapshot_path, &db_path).unwrap();
        assert!(
            drifted.differs_from_live,
            "a snapshot taken before a password change must be flagged"
        );

        // And the old password is what actually opens it.
        assert!(open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("brand_new_password".to_string())
        )
        .is_err());
        assert!(open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("test_password".to_string())
        )
        .is_ok());
    }

    #[test]
    fn test_comparison_says_so_when_the_live_journal_cannot_be_read() {
        let (dir, db_path, snapshot_path) = journal_with_snapshot("no_live");
        std::fs::remove_file(&db_path).unwrap();

        let report = compare_snapshot_credentials(&snapshot_path, &db_path).unwrap();

        assert!(!report.compared);
        assert!(
            !report.differs_from_live,
            "a missing live journal is not evidence of credential drift"
        );
        assert_eq!(report.snapshot_slot_types, vec!["password".to_string()]);
        drop(dir);
    }

    #[test]
    fn test_inspect_opens_a_local_only_snapshot_with_the_device_key() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups");
        let auto_key = [9u8; 32];

        let db = create_database_auto(&db_path, &auto_key).unwrap();
        insert_entry(&db, &entry("2024-05-01", "Local only", "<p>body</p>")).unwrap();
        create_snapshot(
            &db,
            &BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: None,
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();
        drop(db);

        let snapshot_path = backups_dir.join(&list_snapshots(&backups_dir).unwrap()[0].file_name);

        let opened =
            open_snapshot_readonly(&snapshot_path, SnapshotCredential::AutoKey(auto_key)).unwrap();
        assert_eq!(
            list_snapshot_entries(&opened).unwrap()[0].title,
            "Local only"
        );

        // A different device's key must not open it — the disclosure in Assumption 2 made
        // concrete.
        assert!(
            open_snapshot_readonly(&snapshot_path, SnapshotCredential::AutoKey([1u8; 32])).is_err()
        );
    }

    #[test]
    fn test_inspect_reads_an_older_schema_snapshot() {
        // The most valuable snapshot is the pre-migration one, which is always an older
        // schema than the app expects. `preview_enc` (v12) and `locked` (v13) are absent
        // there, so a query written against the current schema would fail on exactly the
        // snapshots that matter most.
        let dir = tempfile::Builder::new()
            .prefix("mini-diarium-inspect-old-schema-")
            .tempdir()
            .unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups");

        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-02-02", "Old", "<p>ancient text</p>")).unwrap();
        // Roll the schema back to v11: drop both columns the current timeline query needs.
        db.conn()
            .execute_batch(
                "ALTER TABLE entries DROP COLUMN locked;
                 ALTER TABLE entries DROP COLUMN preview_enc;
                 UPDATE schema_version SET version = 11;",
            )
            .unwrap();
        create_snapshot(
            &db,
            &BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: None,
            },
            SnapshotTrigger::Migration,
        )
        .unwrap();
        drop(db);

        let snapshot_path = backups_dir.join(&list_snapshots(&backups_dir).unwrap()[0].file_name);
        let opened = open_snapshot_readonly(
            &snapshot_path,
            SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();

        let entries = list_snapshot_entries(&opened).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Old");
        assert_eq!(
            entries[0].preview, "ancient text",
            "with no preview_enc column the preview must fall back to the entry text"
        );
    }

    #[test]
    fn test_credential_debug_never_prints_key_material() {
        let credential = SnapshotCredential::Password("hunter2".to_string());
        let printed = format!("{credential:?}");
        assert!(!printed.contains("hunter2"), "the password was printed");

        let printed = format!("{:?}", SnapshotCredential::AutoKey([7u8; 32]));
        assert!(printed.contains("redacted"));
    }
}
