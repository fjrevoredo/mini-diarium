//! Filesystem-backed snapshot storage — the only place in the backup engine that touches
//! `std::fs`.
//!
//! The write primitive is deliberately not a file copy. `fs::copy` of a live SQLite file
//! can capture a torn page image, produces no proof that the result is openable, and leaves
//! a half-written file that looks exactly like a good backup. Instead:
//!
//! 1. `VACUUM INTO` a `.tmp` name — SQLite builds a fresh, internally consistent database.
//! 2. `fsync` the file (and, where the platform supports it, the directory).
//! 3. `rename` into place — atomic, so a `backup-*.db` never exists in a partial state.
//! 4. Re-open the result read-only and prove it is a valid database that the live master
//!    key can still decrypt. On any failure the file is deleted and an error returned.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local, NaiveDateTime, TimeZone, Utc};
use log::debug;

use crate::crypto::cipher;
use crate::db::schema::open_connection_readonly;
use crate::db::DatabaseConnection;

/// Prefix every snapshot file carries. Unchanged from the pre-upgrade format so files
/// written by older versions are still recognised.
pub(crate) const SNAPSHOT_PREFIX: &str = "backup-";
/// Suffix every snapshot file carries.
pub(crate) const SNAPSHOT_SUFFIX: &str = ".db";
/// Prefix for in-flight writes. Never matches the listing filter, so an interrupted write
/// can never be mistaken for a snapshot.
const TEMP_PREFIX: &str = "snapshot-";
const TEMP_SUFFIX: &str = ".tmp";

/// Second-resolution timestamp format. Lexicographic order still equals chronological
/// order, which the debug dump's oldest/newest scan relies on.
const NAME_FORMAT: &str = "%Y-%m-%d-%Hh%Mm%S";
/// The pre-upgrade minute-resolution format, still parsed so legacy files are adopted.
const LEGACY_NAME_FORMAT: &str = "%Y-%m-%d-%Hh%M";

// ── Store boundary ────────────────────────────────────────────────────────────────────

/// A snapshot file as it exists on disk, before the manifest describes it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredSnapshot {
    pub file_name: String,
    pub byte_size: u64,
}

/// The narrow boundary between the backup engine and its storage.
///
/// Kept as a trait so the policy and manifest layers stay storage-agnostic (open-core
/// constraint, `OPEN_CORE_STRATEGY.md` §8) — a future consumer can back snapshots with
/// something other than a local directory without touching retention.
pub trait SnapshotStore {
    /// Lists snapshot files present in the store. In-flight `.tmp` writes are excluded.
    fn list(&self) -> Result<Vec<StoredSnapshot>, String>;

    /// Writes a verified snapshot of `db` under `file_name`, returning its size in bytes.
    ///
    /// Either a complete, verified snapshot exists under `file_name` afterwards, or nothing
    /// does and an `Err` is returned. There is no third outcome.
    fn write(&self, db: &DatabaseConnection, file_name: &str) -> Result<u64, String>;

    /// Resolves `file_name` to a readable location, erroring if it is absent.
    fn read(&self, file_name: &str) -> Result<PathBuf, String>;

    /// Deletes `file_name`. A file that is already gone is not an error.
    fn delete(&self, file_name: &str) -> Result<(), String>;

    /// Returns the size of `file_name` in bytes.
    fn stat(&self, file_name: &str) -> Result<u64, String>;
}

/// A snapshot store backed by a local directory.
#[derive(Debug, Clone)]
pub struct FsSnapshotStore {
    dir: PathBuf,
}

impl FsSnapshotStore {
    pub fn new<P: AsRef<Path>>(dir: P) -> Self {
        Self {
            dir: dir.as_ref().to_path_buf(),
        }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Deletes leftover `.tmp` files from writes interrupted by a crash or a kill.
    ///
    /// Safe to call at any time: a `.tmp` name is only ever live inside a single `write`,
    /// which holds no lock across process boundaries, so any `.tmp` found at startup is by
    /// definition abandoned.
    pub fn sweep_temp_files(&self) -> Result<usize, String> {
        let Ok(entries) = fs::read_dir(&self.dir) else {
            return Ok(0);
        };
        let mut swept = 0;
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            if name.starts_with(TEMP_PREFIX)
                && name.ends_with(TEMP_SUFFIX)
                && fs::remove_file(entry.path()).is_ok()
            {
                swept += 1;
            }
        }
        Ok(swept)
    }
}

impl SnapshotStore for FsSnapshotStore {
    fn list(&self) -> Result<Vec<StoredSnapshot>, String> {
        let Ok(entries) = fs::read_dir(&self.dir) else {
            // A backups directory that does not exist yet holds no snapshots. That is a
            // normal first-run state, not an error.
            return Ok(Vec::new());
        };

        let mut snapshots = Vec::new();
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !is_snapshot_file_name(name) {
                continue;
            }
            snapshots.push(StoredSnapshot {
                file_name: name.to_string(),
                byte_size: entry.metadata().map(|m| m.len()).unwrap_or(0),
            });
        }
        snapshots.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        Ok(snapshots)
    }

    fn write(&self, db: &DatabaseConnection, file_name: &str) -> Result<u64, String> {
        self.write_atomic(db, file_name, |path| verify_snapshot(path, db.key()))
    }

    fn read(&self, file_name: &str) -> Result<PathBuf, String> {
        let path = self.dir.join(file_name);
        if !path.is_file() {
            return Err("Snapshot not found".to_string());
        }
        Ok(path)
    }

    fn delete(&self, file_name: &str) -> Result<(), String> {
        let path = self.dir.join(file_name);
        match fs::remove_file(&path) {
            Ok(()) => {
                debug!("Snapshot deleted: {file_name}");
                Ok(())
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("Failed to delete snapshot: {e}")),
        }
    }

    fn stat(&self, file_name: &str) -> Result<u64, String> {
        fs::metadata(self.dir.join(file_name))
            .map(|m| m.len())
            .map_err(|e| format!("Failed to stat snapshot: {e}"))
    }
}

impl FsSnapshotStore {
    /// The atomic write, with only the checks a pre-v3 journal can satisfy.
    ///
    /// v1/v2 journals have no `auth_slots` table and no wrapped master key, so the full
    /// [`verify_snapshot`] cannot apply to them. This keeps the atomicity guarantee — the
    /// part that stops a torn write from masquerading as a backup — and verifies only that
    /// the result opens as a database whose schema version reads.
    pub(crate) fn write_openable_only(
        &self,
        db: &DatabaseConnection,
        file_name: &str,
    ) -> Result<u64, String> {
        self.write_atomic(db, file_name, |path| {
            let conn = open_connection_readonly(path)
                .map_err(|e| format!("Snapshot verification failed to open the file: {e}"))?;
            conn.query_row("SELECT version FROM schema_version", [], |row| {
                row.get::<_, i32>(0)
            })
            .map_err(|e| format!("Snapshot verification could not read the schema version: {e}"))?;
            Ok(())
        })
    }

    /// `VACUUM INTO` a temp name → fsync → rename → `verify`, deleting everything on failure.
    fn write_atomic<F>(
        &self,
        db: &DatabaseConnection,
        file_name: &str,
        verify: F,
    ) -> Result<u64, String>
    where
        F: FnOnce(&Path) -> Result<(), String>,
    {
        if !is_snapshot_file_name(file_name) {
            return Err(format!(
                "Refusing to write invalid snapshot name: {file_name}"
            ));
        }

        fs::create_dir_all(&self.dir)
            .map_err(|e| format!("Failed to create backups directory: {e}"))?;

        let final_path = self.dir.join(file_name);
        let temp_path = self
            .dir
            .join(format!("{TEMP_PREFIX}{file_name}{TEMP_SUFFIX}"));

        // `VACUUM INTO` refuses to overwrite an existing target, so a leftover temp from an
        // interrupted write would otherwise poison every subsequent attempt.
        let _ = fs::remove_file(&temp_path);

        let result = (|| -> Result<u64, String> {
            vacuum_into(db, &temp_path)?;
            fsync_file(&temp_path)?;
            fsync_dir(&self.dir);

            fs::rename(&temp_path, &final_path)
                .map_err(|e| format!("Failed to finalize snapshot: {e}"))?;
            fsync_dir(&self.dir);

            verify(&final_path)?;

            fs::metadata(&final_path)
                .map(|m| m.len())
                .map_err(|e| format!("Failed to stat snapshot: {e}"))
        })();

        if result.is_err() {
            // Leave nothing behind that could be mistaken for a usable backup.
            let _ = fs::remove_file(&temp_path);
            let _ = fs::remove_file(&final_path);
        }

        result
    }
}

/// Size of a file in bytes, or `None` if it cannot be read.
///
/// Lives here rather than at the call site because this module owns every `std::fs` call in
/// the backup engine.
pub(crate) fn file_size(path: &Path) -> Option<u64> {
    fs::metadata(path).map(|m| m.len()).ok()
}

// ── Naming ────────────────────────────────────────────────────────────────────────────

/// Whether `name` is a snapshot file this engine owns.
pub(crate) fn is_snapshot_file_name(name: &str) -> bool {
    name.starts_with(SNAPSHOT_PREFIX) && name.ends_with(SNAPSHOT_SUFFIX)
}

/// Builds the snapshot file name for `at`, avoiding collisions with existing files.
///
/// Timestamps are formatted in **local** time so the name means something to the user
/// reading their backups folder; the manifest stores the authoritative UTC instant.
pub(crate) fn snapshot_file_name(dir: &Path, at: DateTime<Local>) -> String {
    let stamp = at.format(NAME_FORMAT).to_string();
    let base = format!("{SNAPSHOT_PREFIX}{stamp}{SNAPSHOT_SUFFIX}");
    if !dir.join(&base).exists() {
        return base;
    }
    // Two snapshots inside the same second. Chronological order is undefined at this
    // resolution anyway, so a plain counter is enough to keep the names distinct.
    for n in 1..1000 {
        let candidate = format!("{SNAPSHOT_PREFIX}{stamp}-{n}{SNAPSHOT_SUFFIX}");
        if !dir.join(&candidate).exists() {
            return candidate;
        }
    }
    format!(
        "{SNAPSHOT_PREFIX}{stamp}-{}{SNAPSHOT_SUFFIX}",
        at.timestamp()
    )
}

/// Recovers the creation instant of a snapshot from its file name.
///
/// Accepts both the current second-resolution form and the pre-upgrade minute-resolution
/// form, which is what makes adopting an existing backups directory possible. Names are in
/// local time, so the result is converted to UTC.
pub(crate) fn parse_snapshot_timestamp(file_name: &str) -> Option<DateTime<Utc>> {
    let stamp = file_name
        .strip_prefix(SNAPSHOT_PREFIX)?
        .strip_suffix(SNAPSHOT_SUFFIX)?;

    let parse = |s: &str| {
        NaiveDateTime::parse_from_str(s, NAME_FORMAT)
            .or_else(|_| NaiveDateTime::parse_from_str(s, LEGACY_NAME_FORMAT))
            .ok()
    };

    // Try the whole stamp first; only then treat a trailing `-N` as a collision counter,
    // since the legacy format itself ends in a `-`-separated field.
    let naive = parse(stamp).or_else(|| parse(stamp.rsplit_once('-')?.0))?;

    Local
        .from_local_datetime(&naive)
        .earliest()
        .map(|dt| dt.with_timezone(&Utc))
}

// ── SQLite header change counter (plan Assumption 3) ──────────────────────────────────

/// Reads the SQLite file-header change counter (bytes 24–27, big-endian) of `db_path`.
///
/// This is the deduplication signal: it increments once per write transaction and is
/// untouched by a read-only open. It **must** be read from the live database and persisted
/// in the manifest — a `VACUUM INTO` copy is a rebuilt database whose counter bears no
/// relation to the source's, so reading it back from a snapshot silently breaks dedup.
/// `test_vacuum_into_resets_the_change_counter` is the permanent guard for that.
///
/// Returns `None` for a missing or truncated file, which callers treat as "assume changed".
pub(crate) fn read_change_counter(db_path: &Path) -> Option<u32> {
    let mut file = File::open(db_path).ok()?;
    let mut header = [0u8; 28];
    file.read_exact(&mut header).ok()?;
    Some(u32::from_be_bytes([
        header[24], header[25], header[26], header[27],
    ]))
}

// ── Write primitive ───────────────────────────────────────────────────────────────────

fn vacuum_into(db: &DatabaseConnection, target: &Path) -> Result<(), String> {
    let target_str = target
        .to_str()
        .ok_or_else(|| "Backups directory path is not valid UTF-8".to_string())?;

    db.conn()
        .execute("VACUUM INTO ?1", [target_str])
        .map_err(|e| format!("Failed to write snapshot: {e}"))?;
    Ok(())
}

/// Flushes the snapshot's own bytes to stable storage.
///
/// The handle must be opened for **write**: Windows rejects `FlushFileBuffers` (what
/// `sync_all` calls) on a read-only handle with `ERROR_ACCESS_DENIED`.
fn fsync_file(path: &Path) -> Result<(), String> {
    let file = fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| format!("Failed to reopen snapshot for sync: {e}"))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync snapshot to disk: {e}"))
}

/// Flushes the directory entry so the rename itself survives a power loss.
///
/// Best-effort by design: only Unix lets a directory be opened as a file. On Windows
/// `File::open` on a directory fails, and NTFS metadata journaling covers the rename, so
/// there is nothing to do and nothing to report.
fn fsync_dir(dir: &Path) {
    #[cfg(unix)]
    {
        if let Ok(handle) = File::open(dir) {
            let _ = handle.sync_all();
        }
    }
    #[cfg(not(unix))]
    {
        let _ = dir;
    }
}

// ── Verification ──────────────────────────────────────────────────────────────────────

/// Proves a written snapshot is a usable backup, not merely a file that exists.
///
/// Three checks, cheapest first:
///
/// 1. It opens read-only as a valid SQLite database and its schema version reads.
/// 2. It carries at least one auth slot — a snapshot with none can never be unlocked.
/// 3. The live master key decrypts content inside it.
///
/// **Note on check 3.** The plan phrases this as "the master key unwraps an auth slot",
/// which is not achievable: a slot's `wrapped_key` is unwrapped *by a credential*
/// (Argon2id-derived password key, X25519 private key, or the device auto key) to *produce*
/// the master key — holding the master key does not let you reverse that. Decrypting an
/// encrypted row instead proves the property that actually matters, and proves it against
/// the same key the entries were written with. A journal with no encrypted content yet has
/// nothing to check, so checks 1–2 stand alone in that case.
fn verify_snapshot(path: &Path, key: &cipher::Key) -> Result<(), String> {
    let conn = open_connection_readonly(path)
        .map_err(|e| format!("Snapshot verification failed to open the file: {e}"))?;

    let _version: i32 = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .map_err(|e| format!("Snapshot verification could not read the schema version: {e}"))?;

    let slot_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM auth_slots", [], |row| row.get(0))
        .map_err(|e| format!("Snapshot verification could not read auth slots: {e}"))?;
    if slot_count == 0 {
        return Err(
            "Snapshot verification failed: no auth slots, the snapshot could never \
                    be unlocked"
                .to_string(),
        );
    }

    verify_key_decrypts(&conn, key)
}

/// Decrypts one encrypted field with `key`, if the snapshot has any.
fn verify_key_decrypts(conn: &rusqlite::Connection, key: &cipher::Key) -> Result<(), String> {
    // Entry titles first (the common case), tag names as the fallback for a journal that
    // holds tags but no entries.
    let sample: Option<Vec<u8>> = conn
        .query_row(
            "SELECT title_encrypted FROM entries WHERE title_encrypted IS NOT NULL LIMIT 1",
            [],
            |row| row.get(0),
        )
        .or_else(|_| {
            conn.query_row(
                "SELECT name_encrypted FROM tags WHERE name_encrypted IS NOT NULL LIMIT 1",
                [],
                |row| row.get(0),
            )
        })
        .ok();

    let Some(ciphertext) = sample else {
        // Nothing encrypted in the journal yet — checks 1 and 2 are the whole guarantee.
        return Ok(());
    };

    crate::format::decrypt_utf8(key, &ciphertext, "snapshot verification sample").map_err(
        |_| {
            "Snapshot verification failed: the journal's master key does not decrypt the \
         snapshot's content"
                .to_string()
        },
    )?;
    Ok(())
}

// ── Key-less description ──────────────────────────────────────────────────────────────

/// The descriptive fields readable from a snapshot **without** a master key.
///
/// `entries.date` and the auth-slot `type` column are plaintext — the SQLite container is
/// not encrypted, only the row *content* is — so an adopted or unverified snapshot is still
/// fully describable. This is what lets `verified: false` mean "the key has not been
/// confirmed against it", not "we do not know what is inside".
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SnapshotDescription {
    pub db_schema_version: Option<i32>,
    pub entry_count: Option<i64>,
    pub entry_date_range: Option<(String, String)>,
    pub auth_slot_types: Vec<String>,
}

/// Describes a snapshot without opening it for writing and without a key.
///
/// Every failure degrades to `None`/empty rather than erroring: a snapshot too damaged to
/// describe should still be *listed*, so the user can see it exists and that something is
/// wrong with it.
pub(crate) fn describe_snapshot(path: &Path) -> SnapshotDescription {
    let Ok(conn) = open_connection_readonly(path) else {
        return SnapshotDescription::default();
    };

    let db_schema_version = conn
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .ok();

    let (entry_count, entry_date_range) = conn
        .query_row(
            "SELECT COUNT(*), MIN(date), MAX(date) FROM entries",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .map(|(count, min, max)| (Some(count), min.zip(max)))
        .unwrap_or((None, None));

    // Types only. Auth-slot *labels* are user-chosen text and must never leave the
    // snapshot (plan Privacy Decision).
    let auth_slot_types = conn
        .prepare("SELECT DISTINCT type FROM auth_slots ORDER BY type")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()
        })
        .unwrap_or_default();

    SnapshotDescription {
        db_schema_version,
        entry_count,
        entry_date_range,
        auth_slot_types,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_database, insert_entry, DiaryEntry};

    fn seeded_entry(date: &str, title: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: format!("{date}T00:00:00Z"),
            date_updated: format!("{date}T00:00:00Z"),
            metadata: None,
            locked: false,
        }
    }

    /// A journal with two entries, plus the temp dir that owns it.
    fn seeded_journal(name: &str) -> (tempfile::TempDir, PathBuf, DatabaseConnection) {
        let dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-store-{name}-"))
            .tempdir()
            .unwrap();
        let db_path = dir.path().join("diary.db");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &seeded_entry("2024-01-15", "First")).unwrap();
        insert_entry(&db, &seeded_entry("2024-03-20", "Second")).unwrap();
        (dir, db_path, db)
    }

    // ── Task 1.1: the change-counter assumption, kept under permanent test ───────────

    #[test]
    fn test_change_counter_is_unchanged_by_a_read_only_open() {
        let (_dir, db_path, db) = seeded_journal("counter-readonly");
        drop(db);

        let before = read_change_counter(&db_path).unwrap();
        {
            let conn = open_connection_readonly(&db_path).unwrap();
            let _: i64 = conn
                .query_row("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
                .unwrap();
        }
        let after = read_change_counter(&db_path).unwrap();

        assert_eq!(
            before, after,
            "a read-only open must not advance the change counter, or every unlock would \
             look like a write"
        );
    }

    #[test]
    fn test_change_counter_increases_after_each_write_transaction() {
        let (_dir, db_path, db) = seeded_journal("counter-writes");

        let mut previous = read_change_counter(&db_path).unwrap();
        for i in 0..5 {
            insert_entry(&db, &seeded_entry("2024-06-01", &format!("Write {i}"))).unwrap();
            let current = read_change_counter(&db_path).unwrap();
            assert!(
                current > previous,
                "write {i} did not advance the change counter ({previous} -> {current})"
            );
            previous = current;
        }
    }

    #[test]
    fn test_vacuum_into_resets_the_change_counter() {
        // The regression guard for the single most tempting "simplification" in this
        // design: reading the dedup counter back from a snapshot instead of persisting it
        // in the manifest. A vacuumed database is *rebuilt*, not copied, so its counter
        // starts over and comparing it to the live one would skip needed snapshots.
        let (dir, db_path, db) = seeded_journal("counter-vacuum");

        let source_counter = read_change_counter(&db_path).unwrap();
        assert!(
            source_counter > 1,
            "fixture should have several writes behind it, got {source_counter}"
        );

        let copy_path = dir.path().join("vacuumed.db");
        vacuum_into(&db, &copy_path).unwrap();
        let copy_counter = read_change_counter(&copy_path).unwrap();

        assert_ne!(
            source_counter, copy_counter,
            "VACUUM INTO produced a copy whose change counter matches the source — the \
             manifest-persisted counter would no longer be required, and this test's \
             premise (plan Assumption 3) must be re-examined before relying on dedup"
        );
    }

    // ── Task 1.4: atomic, verified writes ────────────────────────────────────────────

    #[test]
    fn test_snapshot_is_verified_after_write() {
        let (dir, _db_path, db) = seeded_journal("verified");
        let store = FsSnapshotStore::new(dir.path().join("backups"));

        let size = store.write(&db, "backup-2026-08-04-12h00m00.db").unwrap();
        assert!(size > 0);

        let listed = store.list().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].file_name, "backup-2026-08-04-12h00m00.db");

        // The written file really is an openable journal carrying the same entries.
        let path = store.read("backup-2026-08-04-12h00m00.db").unwrap();
        let described = describe_snapshot(&path);
        assert_eq!(described.entry_count, Some(2));
        assert_eq!(
            described.entry_date_range,
            Some(("2024-01-15".to_string(), "2024-03-20".to_string()))
        );
        assert_eq!(described.auth_slot_types, vec!["password".to_string()]);
    }

    #[test]
    fn test_snapshot_write_is_atomic_on_failure() {
        let (dir, _db_path, db) = seeded_journal("atomic");
        let backups = dir.path().join("backups");
        let store = FsSnapshotStore::new(&backups);

        // Fault injection: occupy the final name with a directory, so the rename cannot
        // succeed after `VACUUM INTO` has already written a complete temp file.
        fs::create_dir_all(backups.join("backup-2026-08-04-12h00m00.db")).unwrap();

        let result = store.write(&db, "backup-2026-08-04-12h00m00.db");
        assert!(result.is_err(), "the write should have failed");

        // No `.tmp` survives, and nothing that `list` would report as a snapshot.
        let leftovers: Vec<_> = fs::read_dir(&backups)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .collect();
        assert!(
            leftovers.is_empty(),
            "an interrupted write left files behind: {:?}",
            leftovers.iter().map(|e| e.file_name()).collect::<Vec<_>>()
        );
    }

    #[test]
    fn test_verification_rejects_a_snapshot_the_master_key_cannot_decrypt() {
        let (dir, _db_path, db) = seeded_journal("wrong-key");
        let store = FsSnapshotStore::new(dir.path().join("backups"));
        store.write(&db, "backup-2026-08-04-12h00m00.db").unwrap();
        let path = store.read("backup-2026-08-04-12h00m00.db").unwrap();

        let foreign_key = cipher::Key::from_slice(&[9u8; 32]).unwrap();
        let result = verify_snapshot(&path, &foreign_key);

        assert!(
            result.is_err(),
            "verification passed with a key that cannot decrypt the snapshot"
        );
    }

    #[test]
    fn test_verification_accepts_a_journal_with_no_encrypted_content() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        let store = FsSnapshotStore::new(dir.path().join("backups"));

        // A brand-new journal has auth slots but no entries and no tags.
        store.write(&db, "backup-2026-08-04-12h00m00.db").unwrap();
        assert_eq!(store.list().unwrap().len(), 1);
    }

    #[test]
    fn test_temp_files_are_never_listed_as_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let backups = dir.path().join("backups");
        fs::create_dir_all(&backups).unwrap();
        fs::write(
            backups.join("snapshot-backup-2026-08-04-12h00m00.db.tmp"),
            "x",
        )
        .unwrap();
        fs::write(backups.join("backup-2026-08-04-12h00m00.db"), "x").unwrap();
        fs::write(backups.join("readme.txt"), "x").unwrap();

        let store = FsSnapshotStore::new(&backups);
        let listed = store.list().unwrap();

        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].file_name, "backup-2026-08-04-12h00m00.db");

        assert_eq!(store.sweep_temp_files().unwrap(), 1);
        assert!(!backups
            .join("snapshot-backup-2026-08-04-12h00m00.db.tmp")
            .exists());
        assert!(
            backups.join("readme.txt").exists(),
            "sweep must not touch unrelated files"
        );
    }

    // ── Naming ───────────────────────────────────────────────────────────────────────

    #[test]
    fn test_two_snapshots_in_the_same_minute_are_distinct() {
        let dir = tempfile::tempdir().unwrap();
        let at = Local
            .from_local_datetime(
                &NaiveDateTime::parse_from_str("2026-08-04-12h00m00", NAME_FORMAT).unwrap(),
            )
            .earliest()
            .unwrap();
        let later = at + chrono::Duration::seconds(30);

        let first = snapshot_file_name(dir.path(), at);
        fs::write(dir.path().join(&first), "x").unwrap();
        let second = snapshot_file_name(dir.path(), later);

        assert_ne!(
            first, second,
            "minute-resolution names collapsed two snapshots in the same minute"
        );
        assert!(first < second, "names must sort chronologically");
    }

    #[test]
    fn test_same_second_collision_gets_a_distinct_name() {
        let dir = tempfile::tempdir().unwrap();
        let at = Local
            .from_local_datetime(
                &NaiveDateTime::parse_from_str("2026-08-04-12h00m00", NAME_FORMAT).unwrap(),
            )
            .earliest()
            .unwrap();

        let first = snapshot_file_name(dir.path(), at);
        fs::write(dir.path().join(&first), "x").unwrap();
        let second = snapshot_file_name(dir.path(), at);

        assert_ne!(first, second);
        assert!(is_snapshot_file_name(&second));
        assert!(parse_snapshot_timestamp(&second).is_some());
    }

    #[test]
    fn test_parses_both_legacy_and_current_file_names() {
        // Legacy, minute resolution — written by every version before this engine.
        let legacy = parse_snapshot_timestamp("backup-2024-01-15-12h00.db").unwrap();
        // Current, second resolution.
        let current = parse_snapshot_timestamp("backup-2024-01-15-12h00m30.db").unwrap();
        // Collision-suffixed.
        let suffixed = parse_snapshot_timestamp("backup-2024-01-15-12h00m30-1.db").unwrap();

        assert!(legacy < current);
        assert_eq!(current, suffixed);
        assert_eq!(parse_snapshot_timestamp("readme.txt"), None);
        assert_eq!(parse_snapshot_timestamp("backup-not-a-date.db"), None);
    }

    #[test]
    fn test_change_counter_of_a_missing_file_is_unknown() {
        assert_eq!(
            read_change_counter(Path::new("definitely-not-a-file.db")),
            None
        );
    }
}
