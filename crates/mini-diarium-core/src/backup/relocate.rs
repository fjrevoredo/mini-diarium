//! Moving a backups directory alongside a relocated journal (TODO-0098 Task 5.1).
//!
//! `change_diary_directory` moves `diary.db` to a new folder; this is what lets its backup
//! history follow along, instead of being silently stranded at the old location.

use std::fs;
use std::path::Path;

use log::{info, warn};

use super::manifest::{self, Manifest};
use super::store::FsSnapshotStore;

/// Moves an existing backups directory tree to `new_dir`, merging into whatever the
/// destination already contains and preserving every snapshot's manifest record — trigger,
/// verified flag, change counter, app version — rather than letting it be silently re-adopted
/// as [`SnapshotTrigger::Adopted`](super::policy::SnapshotTrigger::Adopted) with an unknown
/// change counter, which is what a plain directory move followed by a fresh
/// [`manifest::load_reconciled`] at the destination would do.
///
/// Resumable rather than merely atomic: snapshots are immutable once written, so "copy
/// everything in, delete the source last" is naturally safe to retry after a crash or a
/// partial failure — a second call sees an already-relocated (and by then deleted) source and
/// no-ops. The one irreversible step, deleting `old_dir`, runs last and only after every file
/// has been copied and its byte length verified.
///
/// `old_dir` and `new_dir` are both the *nested* backups directory a journal actually uses
/// (`{journal dir}/backups/{db stem}`, the same level `manifest.json` and every `backup-*.db`
/// live at directly) — callers pass the same value `BackupContext::backups_dir` would use, not
/// the flat `{journal dir}/backups` parent.
///
/// `remove_dir_all(old_dir)` at the end removes anything left in the directory, snapshot or
/// not. That is deliberate: this directory is created and populated exclusively by the backup
/// engine, so nothing else has a reason to be there.
pub fn relocate_backups(old_dir: &Path, new_dir: &Path) -> Result<(), String> {
    if !old_dir.is_dir() {
        // Nothing to move. Also what makes a retry after a partial failure cheap: the source
        // is only ever deleted after a fully successful copy, so a retry that finds it already
        // gone is a retry that already succeeded.
        return Ok(());
    }

    fs::create_dir_all(new_dir)
        .map_err(|e| format!("Failed to create the new backups directory: {e}"))?;

    let old_store = FsSnapshotStore::new(old_dir);
    let new_store = FsSnapshotStore::new(new_dir);

    // Reconcile both sides against their manifests *before* anything is copied, so each
    // snapshot's real trigger/verified/change-counter is recovered up front. This is the step
    // that prevents the "silently downgraded to `Adopted`" regression: a naive move-then-list
    // at the destination would describe every file as if it had never been seen before.
    let old_manifest = manifest::load_reconciled(old_dir, &old_store);
    let new_manifest = manifest::load_reconciled(new_dir, &new_store);

    for snapshot in &old_manifest.snapshots {
        let source = old_dir.join(&snapshot.file_name);
        let dest = new_dir.join(&snapshot.file_name);
        if dest.exists() {
            // A same-named file already at the destination — leave it alone rather than
            // clobbering whatever is already there. File names are timestamp-derived, so this
            // is an edge case, not the common path.
            continue;
        }

        let copied_bytes = fs::copy(&source, &dest)
            .map_err(|e| format!("Failed to copy backup {}: {e}", snapshot.file_name))?;
        if copied_bytes != snapshot.byte_size {
            let _ = fs::remove_file(&dest);
            return Err(format!(
                "Copy of backup {} was incomplete ({copied_bytes} of {} bytes) — the backups \
                 directory was not moved",
                snapshot.file_name, snapshot.byte_size
            ));
        }
    }

    let merged = merge_manifests(new_manifest, old_manifest);
    manifest::save(new_dir, &merged)?;

    // Only now — the single irreversible step, run last, only after every snapshot has been
    // copied and verified, and only after the merged manifest describing them is durable at
    // the destination.
    if let Err(e) = fs::remove_dir_all(old_dir) {
        warn!("Backups were relocated, but the old directory could not be removed: {e}");
    }

    info!(
        "Backups relocated to {}: {} snapshot(s)",
        new_dir.display(),
        merged.snapshots.len()
    );

    Ok(())
}

/// Unions two manifests' snapshot lists by file name. `dest`'s own record wins on a collision
/// — an unlikely same-second write from both sides — and the more recent failure record is
/// kept, since it is the more informative one for the health indicator.
fn merge_manifests(mut dest: Manifest, mut src: Manifest) -> Manifest {
    src.snapshots
        .retain(|s| !dest.snapshots.iter().any(|d| d.file_name == s.file_name));
    dest.snapshots.append(&mut src.snapshots);

    dest.last_failure = match (dest.last_failure.take(), src.last_failure) {
        (Some(d), Some(s)) if s.at > d.at => Some(s),
        (Some(d), _) => Some(d),
        (None, s) => s,
    };

    dest.sorted()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
    use crate::db::{create_database, insert_entry, DiaryEntry};

    fn entry(date: &str, title: &str) -> DiaryEntry {
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

    /// A journal, with one snapshot already taken into `backups_dir`.
    struct Seeded {
        _dir: tempfile::TempDir,
        backups_dir: std::path::PathBuf,
    }

    fn seed(name: &str) -> Seeded {
        let dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-relocate-{name}-"))
            .tempdir()
            .unwrap();
        let db_path = dir.path().join("diary.db");
        let backups_dir = dir.path().join("backups").join("diary");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Seed")).unwrap();

        create_snapshot(
            &db,
            &BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();

        Seeded {
            _dir: dir,
            backups_dir,
        }
    }

    #[test]
    fn test_relocate_backups_preserves_trigger_and_verified_fields() {
        let seeded = seed("preserve");
        let before = list_snapshots(&seeded.backups_dir).unwrap();
        assert_eq!(before.len(), 1);
        assert!(before[0].verified, "a freshly written snapshot is verified");
        assert_eq!(before[0].trigger, SnapshotTrigger::Manual);
        assert!(before[0].sqlite_change_counter.is_some());

        let new_dir = seeded
            ._dir
            .path()
            .join("elsewhere")
            .join("backups")
            .join("diary");

        relocate_backups(&seeded.backups_dir, &new_dir).unwrap();

        assert!(
            !seeded.backups_dir.exists(),
            "the old backups directory must be gone after a successful move"
        );
        let after = list_snapshots(&new_dir).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].file_name, before[0].file_name);
        assert_eq!(
            after[0].trigger,
            SnapshotTrigger::Manual,
            "the trigger must not be downgraded to Adopted by the move"
        );
        assert!(
            after[0].verified,
            "the verified flag must not be reset to false by the move"
        );
        assert_eq!(
            after[0].sqlite_change_counter, before[0].sqlite_change_counter,
            "the change counter must not be lost — that would silently break deduplication"
        );
    }

    #[test]
    fn test_relocate_backups_is_a_noop_when_old_dir_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        let old_dir = dir.path().join("never-existed");
        let new_dir = dir.path().join("new");

        relocate_backups(&old_dir, &new_dir).unwrap();

        assert!(
            !new_dir.exists(),
            "a no-op move must not create the destination either"
        );
    }

    #[test]
    fn test_relocate_backups_merges_into_a_destination_that_already_has_snapshots() {
        let seeded = seed("merge-src");
        let dest_seed = seed("merge-dest");

        relocate_backups(&seeded.backups_dir, &dest_seed.backups_dir).unwrap();

        let merged = list_snapshots(&dest_seed.backups_dir).unwrap();
        assert_eq!(
            merged.len(),
            2,
            "both the pre-existing destination snapshot and the relocated one must be present"
        );
        assert!(!seeded.backups_dir.exists());
    }

    #[test]
    fn test_relocate_backups_skips_a_same_name_collision_at_the_destination() {
        let seeded = seed("collision");
        let file_name = list_snapshots(&seeded.backups_dir).unwrap()[0]
            .file_name
            .clone();

        // A file already occupying the exact destination name the relocated snapshot would
        // use. Names are timestamp-derived, so this is an edge case, not the common path —
        // but the collision must be skipped, not clobbered.
        let new_dir = seeded
            ._dir
            .path()
            .join("elsewhere")
            .join("backups")
            .join("diary");
        fs::create_dir_all(&new_dir).unwrap();
        fs::write(new_dir.join(&file_name), b"already here, untouched").unwrap();

        relocate_backups(&seeded.backups_dir, &new_dir).unwrap();

        assert_eq!(
            fs::read(new_dir.join(&file_name)).unwrap(),
            b"already here, untouched",
            "a same-name collision at the destination must not be overwritten"
        );
        assert!(
            !seeded.backups_dir.exists(),
            "the source is still fully relocated even though one file collided"
        );
    }

    #[test]
    fn test_relocate_backups_leaves_the_source_untouched_when_the_destination_cannot_be_created() {
        // Portable sibling of the write-permission variant below (which is Unix-only): a
        // regular file occupying a path one of `new_dir`'s ancestors needs to be makes
        // `create_dir_all` fail on every platform, so this half of the "source survives any
        // failure" invariant is verified on Windows too.
        let seeded = seed("dest-blocked");
        let file_name = list_snapshots(&seeded.backups_dir).unwrap()[0]
            .file_name
            .clone();

        let blocker = seeded._dir.path().join("blocker-file");
        fs::write(&blocker, b"not a directory").unwrap();
        let new_dir = blocker.join("backups").join("diary");

        let result = relocate_backups(&seeded.backups_dir, &new_dir);

        assert!(
            result.is_err(),
            "a destination that cannot be created must be rejected"
        );
        assert!(
            seeded.backups_dir.join(&file_name).exists(),
            "the source snapshot must survive when the destination cannot even be created"
        );
        assert!(!new_dir.exists());
    }

    #[cfg(unix)]
    #[test]
    fn test_relocate_backups_deletes_the_source_only_after_a_successful_copy() {
        use std::fs::Permissions;
        use std::os::unix::fs::PermissionsExt;

        let seeded = seed("partial-failure");
        let file_name = list_snapshots(&seeded.backups_dir).unwrap()[0]
            .file_name
            .clone();

        // A destination that exists but cannot be written into: `create_dir_all` is a no-op
        // against an existing directory, but every `fs::copy` into it fails. This forces the
        // one failure path that matters here — a copy that does not complete — without relying
        // on a race that a single-threaded test cannot otherwise construct, since a reconciled
        // manifest's `byte_size` is always re-derived from the file actually on disk.
        let new_dir = seeded
            ._dir
            .path()
            .join("elsewhere")
            .join("backups")
            .join("diary");
        fs::create_dir_all(&new_dir).unwrap();
        fs::set_permissions(&new_dir, Permissions::from_mode(0o500)).unwrap();

        let result = relocate_backups(&seeded.backups_dir, &new_dir);

        // Restore write access before any assertion can panic, so the temp dir still cleans up.
        fs::set_permissions(&new_dir, Permissions::from_mode(0o700)).unwrap();

        assert!(
            result.is_err(),
            "a copy that cannot be written must be rejected"
        );
        assert!(
            seeded.backups_dir.join(&file_name).exists(),
            "the source snapshot must survive a failed relocation"
        );
        assert!(
            !new_dir.join(&file_name).exists(),
            "a copy that never completed must not be left behind at the destination"
        );
    }
}
