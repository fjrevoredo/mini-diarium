//! The `manifest.json` sidecar — per-snapshot metadata that cannot be recovered from the
//! snapshots themselves.
//!
//! The manifest exists because of one hard fact (plan Assumption 3): `VACUUM INTO` rebuilds
//! the database, so the SQLite change counter deduplication depends on is **destroyed** by
//! the act of snapshotting. It has to be recorded at write time or it is gone. Everything
//! else the manifest holds is a convenience; the change counter is a prerequisite.
//!
//! # Privacy
//!
//! This is a **plaintext** file sitting next to encrypted snapshots, so what it may contain
//! is a deliberate decision rather than an accident of convenience:
//!
//! - **May contain:** timestamps, trigger, byte size, change counter, schema version, app
//!   version, entry count, entry date range, auth-slot *types*, and a verified flag.
//! - **Must never contain:** entry content, entry titles, tag names, journal names,
//!   auth-slot *labels* (user-chosen), or any filesystem path.
//!
//! The counts and dates are not a new disclosure: `entries.date` is already a plaintext
//! column inside every snapshot, so anyone holding the backups folder can read the date
//! range with any SQLite tool. `test_manifest_contains_no_user_content` enforces the
//! boundary permanently.

use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use log::{debug, warn};
use serde::{Deserialize, Serialize};

use super::policy::{SnapshotMeta, SnapshotTrigger};
use super::store::{describe_snapshot, parse_snapshot_timestamp, SnapshotStore, StoredSnapshot};

/// File name of the sidecar inside the backups directory.
pub const MANIFEST_FILE: &str = "manifest.json";
/// Bumped when the on-disk manifest shape changes incompatibly.
pub const MANIFEST_SCHEMA_VERSION: u32 = 1;

const TEMP_MANIFEST_FILE: &str = "manifest.json.tmp";

/// The on-disk sidecar.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    pub schema_version: u32,
    pub snapshots: Vec<SnapshotMeta>,
}

impl Manifest {
    fn empty() -> Self {
        Self {
            schema_version: MANIFEST_SCHEMA_VERSION,
            snapshots: Vec::new(),
        }
    }

    /// Snapshots newest first.
    pub fn sorted(mut self) -> Self {
        self.snapshots.sort_by(|a, b| {
            b.created_at
                .cmp(&a.created_at)
                .then_with(|| b.file_name.cmp(&a.file_name))
        });
        self
    }
}

fn manifest_path(dir: &Path) -> PathBuf {
    dir.join(MANIFEST_FILE)
}

/// Reads the manifest, or `None` when it is absent, unreadable, or malformed.
///
/// A corrupt manifest is deliberately not an error: it is metadata *about* backups, and
/// losing it must never make the backups themselves unusable. Callers rebuild from a
/// directory scan instead — see [`load_reconciled`].
fn load(dir: &Path) -> Option<Manifest> {
    let raw = fs::read_to_string(manifest_path(dir)).ok()?;
    match serde_json::from_str::<Manifest>(&raw) {
        Ok(manifest) => Some(manifest),
        Err(e) => {
            warn!("Backup manifest is unreadable and will be rebuilt: {}", e);
            None
        }
    }
}

/// Writes the manifest atomically (temp file, then rename).
pub(crate) fn save(dir: &Path, manifest: &Manifest) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create backups directory: {e}"))?;

    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize backup manifest: {e}"))?;

    let temp = dir.join(TEMP_MANIFEST_FILE);
    fs::write(&temp, json).map_err(|e| format!("Failed to write backup manifest: {e}"))?;
    fs::rename(&temp, manifest_path(dir)).map_err(|e| {
        let _ = fs::remove_file(&temp);
        format!("Failed to finalize backup manifest: {e}")
    })?;
    Ok(())
}

/// Loads the manifest and reconciles it against what is actually on disk.
///
/// This is the only way the engine reads the manifest, and it is what makes three separate
/// situations behave identically:
///
/// - **First run against a pre-upgrade backups directory** — no manifest exists, so every
///   `backup-*.db` is adopted (plan Assumption 5 / Task 1.7).
/// - **Corrupt or truncated manifest** — treated as absent and rebuilt.
/// - **Files deleted outside the app** — stale records are dropped.
///
/// Adopted records carry `verified: false` and no change counter. `verified: false` means
/// "the master key has not been confirmed against this snapshot", *not* "the contents are
/// unknown" — the descriptive fields are read from the snapshot without a key.
pub(crate) fn load_reconciled(dir: &Path, store: &impl SnapshotStore) -> Manifest {
    let existing = load(dir).unwrap_or_else(Manifest::empty);
    let files = store.list().unwrap_or_default();

    let mut snapshots = Vec::with_capacity(files.len());
    for file in &files {
        match existing
            .snapshots
            .iter()
            .find(|s| s.file_name == file.file_name)
        {
            Some(known) => {
                // Trust the manifest for everything it alone knows; trust the filesystem
                // for the size, which is the one field that can drift.
                let mut record = known.clone();
                record.byte_size = file.byte_size;
                snapshots.push(record);
            }
            None => snapshots.push(adopt(store, file)),
        }
    }

    let adopted = snapshots.len().saturating_sub(existing.snapshots.len());
    if adopted > 0 {
        debug!(
            "Adopted {} pre-existing backup file(s) into the manifest",
            adopted
        );
    }

    Manifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        snapshots,
    }
    .sorted()
}

/// Builds a manifest record for a snapshot file the manifest does not know about.
fn adopt(store: &impl SnapshotStore, file: &StoredSnapshot) -> SnapshotMeta {
    let described = store
        .read(&file.file_name)
        .map(|path| describe_snapshot(&path))
        .unwrap_or_default();

    SnapshotMeta {
        created_at: adopted_creation_time(store, file),
        file_name: file.file_name.clone(),
        // The pre-upgrade engine recorded no trigger and had several, so inventing one
        // would be a fabrication. `Adopted` says exactly what is known.
        trigger: SnapshotTrigger::Adopted,
        byte_size: file.byte_size,
        // Unknown, never `Some` — an unknown counter must force the next snapshot decision
        // toward taking one, and `Some(anything)` risks matching the live value.
        sqlite_change_counter: None,
        db_schema_version: described.db_schema_version,
        app_version: None,
        entry_count: described.entry_count,
        entry_date_range: described.entry_date_range,
        auth_slot_types: described.auth_slot_types,
        verified: false,
    }
}

/// Recovers a creation time for an adopted file: its name first, its mtime as a fallback.
fn adopted_creation_time(store: &impl SnapshotStore, file: &StoredSnapshot) -> DateTime<Utc> {
    if let Some(parsed) = parse_snapshot_timestamp(&file.file_name) {
        return parsed;
    }
    store
        .read(&file.file_name)
        .ok()
        .and_then(|path| fs::metadata(path).ok())
        .and_then(|meta| meta.modified().ok())
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::store::FsSnapshotStore;
    use crate::db::{create_database, create_tag, insert_auth_slot, insert_entry, DiaryEntry};

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

    #[test]
    fn test_manifest_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = Manifest {
            schema_version: MANIFEST_SCHEMA_VERSION,
            snapshots: vec![SnapshotMeta {
                file_name: "backup-2026-08-04-12h00m00.db".to_string(),
                created_at: Utc::now(),
                trigger: SnapshotTrigger::destructive("reset_diary"),
                byte_size: 4096,
                sqlite_change_counter: Some(21),
                db_schema_version: Some(13),
                app_version: Some("0.6.4".to_string()),
                entry_count: Some(3),
                entry_date_range: Some(("2024-01-15".into(), "2024-03-20".into())),
                auth_slot_types: vec!["password".to_string()],
                verified: true,
            }],
        };

        save(dir.path(), &manifest).unwrap();
        assert_eq!(load(dir.path()).unwrap(), manifest);
    }

    #[test]
    fn test_corrupt_manifest_is_rebuilt_from_disk() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Title", "Body")).unwrap();

        let backups = dir.path().join("backups");
        let store = FsSnapshotStore::new(&backups);
        store.write(&db, "backup-2026-08-04-12h00m00.db").unwrap();

        // A manifest that is valid JSON but not a manifest, and one that is not JSON at all,
        // must both degrade to a rebuild rather than an error or a lost snapshot.
        for corrupt in [r#"{"totally": "wrong"}"#, "{{{ not json"] {
            fs::write(backups.join(MANIFEST_FILE), corrupt).unwrap();

            let manifest = load_reconciled(&backups, &store);

            assert_eq!(manifest.schema_version, MANIFEST_SCHEMA_VERSION);
            assert_eq!(manifest.snapshots.len(), 1, "rebuild lost the snapshot");
            let record = &manifest.snapshots[0];
            assert_eq!(record.file_name, "backup-2026-08-04-12h00m00.db");
            assert_eq!(record.entry_count, Some(1));
            assert_eq!(record.db_schema_version, Some(crate::db::SCHEMA_VERSION));
            assert!(
                !record.verified,
                "a rebuilt record cannot claim verification"
            );
            assert_eq!(record.sqlite_change_counter, None);
        }
    }

    #[test]
    fn test_reconcile_drops_records_for_files_deleted_outside_the_app() {
        let dir = tempfile::tempdir().unwrap();
        let backups = dir.path().join("backups");
        fs::create_dir_all(&backups).unwrap();
        let store = FsSnapshotStore::new(&backups);

        save(
            &backups,
            &Manifest {
                schema_version: MANIFEST_SCHEMA_VERSION,
                snapshots: vec![SnapshotMeta {
                    file_name: "backup-2026-08-04-12h00m00.db".to_string(),
                    created_at: Utc::now(),
                    trigger: SnapshotTrigger::Unlock,
                    byte_size: 4096,
                    sqlite_change_counter: Some(7),
                    db_schema_version: Some(13),
                    app_version: None,
                    entry_count: Some(1),
                    entry_date_range: None,
                    auth_slot_types: vec![],
                    verified: true,
                }],
            },
        )
        .unwrap();

        assert!(load_reconciled(&backups, &store).snapshots.is_empty());
    }

    #[test]
    fn test_legacy_backups_are_adopted_into_the_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "First", "Body")).unwrap();
        insert_entry(&db, &entry("2024-03-20", "Second", "Body")).unwrap();
        drop(db);

        // 30 files in the pre-upgrade minute-resolution naming scheme, each a real journal.
        let backups = dir.path().join("backups");
        fs::create_dir_all(&backups).unwrap();
        for day in 1..=30 {
            fs::copy(
                &db_path,
                backups.join(format!("backup-2026-06-{day:02}-12h00.db")),
            )
            .unwrap();
        }

        let store = FsSnapshotStore::new(&backups);
        let manifest = load_reconciled(&backups, &store);

        assert_eq!(
            manifest.snapshots.len(),
            30,
            "every legacy file must be listed"
        );
        for record in &manifest.snapshots {
            assert!(!record.verified, "adopted files are not key-verified");
            assert_eq!(
                record.sqlite_change_counter, None,
                "an adopted file's counter must stay unknown so the next snapshot is taken"
            );
            assert_eq!(record.trigger, SnapshotTrigger::Adopted);
            // Fully described despite never having been opened with a key (Assumption 5).
            assert_eq!(record.entry_count, Some(2));
            assert_eq!(
                record.entry_date_range,
                Some(("2024-01-15".to_string(), "2024-03-20".to_string()))
            );
            assert_eq!(record.auth_slot_types, vec!["password".to_string()]);
            assert!(record.byte_size > 0);
        }

        // Newest first, and the legacy timestamps were parsed rather than defaulted.
        assert_eq!(
            manifest.snapshots[0].file_name,
            "backup-2026-06-30-12h00.db"
        );
        assert!(manifest.snapshots[0].created_at > manifest.snapshots[29].created_at);
    }

    #[test]
    fn test_manifest_contains_no_user_content() {
        // Seed every category of user-chosen text the journal can hold, then assert none of
        // it reaches the plaintext sidecar.
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();

        let secrets = [
            "MyPrivateJournalName",
            "DearDiaryTitleSecret",
            "ConfessionBodyText",
            "TherapySessionTag",
            "GrandmasLaptopKeySlot",
        ];

        insert_entry(&db, &entry("2024-01-15", secrets[1], secrets[2])).unwrap();
        create_tag(&db, secrets[3]).unwrap();
        // A keypair slot with a user-chosen label — labels are the field most likely to be
        // leaked by a well-meaning "show which credential this needs" change.
        insert_auth_slot(
            &db,
            "keypair",
            secrets[4],
            Some(&[3u8; 32]),
            &[0u8; 92],
            &Utc::now().to_rfc3339(),
        )
        .unwrap();

        let backups = dir.path().join("backups");
        let store = FsSnapshotStore::new(&backups);
        store.write(&db, "backup-2026-08-04-12h00m00.db").unwrap();

        let mut manifest = load_reconciled(&backups, &store);
        // The journal name never enters the DB at all (it lives in config.json); assert the
        // manifest has no room for it either by checking the serialized form.
        manifest.snapshots[0].app_version = Some("0.6.4".to_string());
        save(&backups, &manifest).unwrap();

        let serialized = fs::read_to_string(backups.join(MANIFEST_FILE)).unwrap();

        for secret in secrets {
            assert!(
                !serialized.contains(secret),
                "manifest leaked user-chosen text: {secret}\n{serialized}"
            );
        }
        // Slot *types* are allowed and expected; labels are not.
        assert!(
            serialized.contains("keypair"),
            "slot types must be recorded"
        );
        assert!(serialized.contains("password"));
        // No filesystem path — only the generated file name.
        assert!(
            !serialized.contains(dir.path().to_str().unwrap()),
            "manifest leaked a filesystem path"
        );
    }
}
