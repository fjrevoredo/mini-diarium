//! Restoring individual entries out of an open snapshot, without touching anything else in
//! the live journal.
//!
//! Two things this module exists to get right that a naive "copy the row across" would not:
//!
//! 1. **Entry ids are not stable across databases.** Each database assigns its own
//!    AUTOINCREMENT sequence, so a snapshot's entry id 7 and the live journal's entry id 7 are
//!    unrelated. [`list_snapshot_entries_with_status`] therefore matches by date + title
//!    (falling back to "another blank-titled entry on the same date" when the title itself is
//!    blank on both sides) to decide whether a snapshot entry is missing from, or shorter
//!    than, its live counterpart — the flag scenario UX-4 asks for.
//! 2. **A snapshot entry's `image-id://N` refs name rows in the *snapshot's* `images` table,
//!    not the live journal's.** [`restore_entries_from_snapshot`] resolves them back to
//!    `data:` URIs against the snapshot connection before the text ever reaches the live
//!    database, so [`crate::db::insert_entry_with_images`] re-extracts and stores fresh image
//!    rows there instead of dropping the reference or colliding with an unrelated live image
//!    that happens to share the id.
//!
//! Nothing here writes a file: every intermediate value (resolved HTML, decrypted tag names)
//! lives in memory only, on its way from one encrypted connection to another.

use std::collections::{HashMap, HashSet};

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{
    add_tag_to_entry, create_tag, get_entries_by_date, get_tags_for_entry,
    insert_entry_with_images, resolve_image_refs_in_entries, DatabaseConnection, DiaryEntry,
    EntryMetadata,
};

use super::inspect::{has_column, list_snapshot_entries};

/// Whether a snapshot entry's counterpart exists in the live journal, and how it compares.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryMatchStatus {
    /// No live entry shares this snapshot entry's date and title.
    Missing,
    /// A matching live entry exists but holds fewer words.
    ShorterInLive,
    /// A matching live entry exists and holds at least as many words.
    Present,
}

/// One snapshot entry as the restore picker shows it: the same fields
/// [`super::SnapshotEntry`] carries, plus the [`EntryMatchStatus`] that drives the
/// missing/shorter flag. Kept as its own type rather than a field added to `SnapshotEntry` —
/// that struct is Task 4.1's contract, and every existing caller of
/// [`list_snapshot_entries`] stays unaware that a live-journal comparison ever happens.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct SnapshotEntryDiff {
    pub id: i64,
    pub date: String,
    pub title: String,
    pub preview: String,
    pub status: EntryMatchStatus,
}

/// What one call to [`restore_entries_from_snapshot`] did.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct RestoreEntriesOutcome {
    /// How many of the requested entries were added.
    pub added_count: usize,
}

/// Compares the open snapshot's entries against the live journal and attaches
/// [`EntryMatchStatus`] to each, newest first (the order [`list_snapshot_entries`] already
/// returns).
///
/// Matching is date + title, falling back to "another blank-titled live entry on the same
/// date" when the snapshot entry's title is itself blank. `word_count` — already an
/// unencrypted column — stands in for "how much content survived", so the comparison costs no
/// decryption beyond what listing the snapshot and reading the live day's entries already do.
pub fn list_snapshot_entries_with_status(
    snapshot_db: &DatabaseConnection,
    live_db: &DatabaseConnection,
) -> Result<Vec<SnapshotEntryDiff>, String> {
    let entries = list_snapshot_entries(snapshot_db)?;
    let word_counts = read_word_counts(snapshot_db.conn())?;

    let distinct_dates: HashSet<String> = entries.iter().map(|e| e.date.clone()).collect();
    let mut live_by_date: HashMap<String, Vec<DiaryEntry>> = HashMap::new();
    for date in distinct_dates {
        let live_entries = get_entries_by_date(live_db, &date)?;
        live_by_date.insert(date, live_entries);
    }

    Ok(entries
        .into_iter()
        .map(|entry| {
            let word_count = word_counts.get(&entry.id).copied().unwrap_or(0);
            let candidates = live_by_date
                .get(&entry.date)
                .map(Vec::as_slice)
                .unwrap_or(&[]);
            let title = entry.title.trim();
            let matched = if title.is_empty() {
                candidates.iter().find(|c| c.title.trim().is_empty())
            } else {
                candidates.iter().find(|c| c.title.trim() == title)
            };
            let status = match matched {
                None => EntryMatchStatus::Missing,
                Some(live) if live.word_count < word_count => EntryMatchStatus::ShorterInLive,
                Some(_) => EntryMatchStatus::Present,
            };
            SnapshotEntryDiff {
                id: entry.id,
                date: entry.date,
                title: entry.title,
                preview: entry.preview,
                status,
            }
        })
        .collect())
}

/// Copies `entry_ids` out of the open snapshot and into the live journal, in-process.
///
/// Never overwrites: every entry is a fresh `INSERT` (`insert_entry_with_images` ignores the
/// snapshot's own id), so a date that already holds live entries gets an additional one
/// alongside them — scenario UX-5 — rather than a replacement. A restored entry is never
/// locked, regardless of the snapshot's own `locked` flag: that flag is a plaintext "protect
/// me from accidental edits" marker the user sets deliberately, not something a recovery
/// action should reintroduce as a surprise.
///
/// Stops at the first error. Each entry's own insert already commits its own transaction
/// (`insert_entry_with_images`), so an error partway through leaves whatever was already
/// inserted in place rather than rolling it back — and restoring the same ids again is safe,
/// since it just adds those entries a second time, never overwrites the first attempt.
pub fn restore_entries_from_snapshot(
    live_db: &DatabaseConnection,
    snapshot_db: &DatabaseConnection,
    entry_ids: &[i64],
) -> Result<RestoreEntriesOutcome, String> {
    let restore_tags = has_table(snapshot_db.conn(), "tags")?;

    for &id in entry_ids {
        let entry = read_full_snapshot_entry(snapshot_db, id)?.ok_or_else(|| {
            "One of the selected entries no longer exists in this backup.".to_string()
        })?;

        // Resolve image-id refs against the snapshot's own image store before the text
        // crosses into the live database, where those ids name something else entirely.
        let mut resolved = resolve_image_refs_in_entries(snapshot_db, vec![entry])?;
        let to_insert = resolved.remove(0);

        let new_id = insert_entry_with_images(live_db, &to_insert)?;

        if restore_tags {
            for tag in get_tags_for_entry(snapshot_db, id)? {
                let live_tag = create_tag(live_db, &tag.name)?;
                add_tag_to_entry(live_db, new_id, live_tag.id)?;
            }
        }
    }

    Ok(RestoreEntriesOutcome {
        added_count: entry_ids.len(),
    })
}

/// Reads one full entry out of the snapshot, adapting to the schema it was written at — the
/// same reason [`list_snapshot_entries`] adapts: the most valuable snapshot is the
/// pre-migration one, which by definition lacks the newest columns.
fn read_full_snapshot_entry(
    db: &DatabaseConnection,
    id: i64,
) -> Result<Option<DiaryEntry>, String> {
    let conn = db.conn();
    let has_metadata = has_column(conn, "entries", "entry_metadata_encrypted")?;
    let metadata_col = if has_metadata {
        "entry_metadata_encrypted"
    } else {
        "NULL"
    };

    let sql = format!(
        "SELECT date, title_encrypted, text_encrypted, word_count, date_created, date_updated, \
         {metadata_col} FROM entries WHERE rowid = ?1"
    );

    let row = conn
        .query_row(&sql, params![id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<Vec<u8>>>(6)?,
            ))
        })
        .optional()
        .map_err(|e| format!("This backup's entry could not be read: {e}"))?;

    let Some((date, title_enc, text_enc, word_count, date_created, date_updated, metadata_enc)) =
        row
    else {
        return Ok(None);
    };

    let decrypt_error =
        || "This backup's content could not be read with that credential.".to_string();
    let title =
        crate::format::decrypt_utf8(db.key(), &title_enc, "title").map_err(|_| decrypt_error())?;
    let text =
        crate::format::decrypt_utf8(db.key(), &text_enc, "text").map_err(|_| decrypt_error())?;
    let metadata = match metadata_enc {
        Some(enc) => {
            let json = crate::format::decrypt_utf8(db.key(), &enc, "entry_metadata")
                .map_err(|_| decrypt_error())?;
            serde_json::from_str::<EntryMetadata>(&json).ok()
        }
        None => None,
    };

    Ok(Some(DiaryEntry {
        id,
        date,
        title,
        text,
        word_count,
        date_created,
        date_updated,
        metadata,
        locked: false,
    }))
}

/// `entry rowid -> word_count` for every row in one connection, in a single query.
fn read_word_counts(conn: &Connection) -> Result<HashMap<i64, i32>, String> {
    let mut stmt = conn
        .prepare("SELECT rowid, word_count FROM entries")
        .map_err(|_| "This backup's entries could not be read.".to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?)))
        .map_err(|_| "This backup's entries could not be read.".to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "This backup's entries could not be read.".to_string())?;
    Ok(rows.into_iter().collect())
}

/// Shared with [`super::store`], which needs the same schema-adaptive table check for
/// snapshot content verification.
pub(crate) fn has_table(conn: &Connection, table: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![table],
        |_| Ok(()),
    )
    .optional()
    .map(|found| found.is_some())
    .map_err(|e| format!("This backup's structure could not be read: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
    use crate::db::{
        create_database, create_tag as db_create_tag, get_entries_by_date, insert_entry,
    };
    use std::path::PathBuf;

    fn entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: text.split_whitespace().count() as i32,
            date_created: format!("{date}T00:00:00Z"),
            date_updated: format!("{date}T00:00:00Z"),
            metadata: None,
            locked: false,
        }
    }

    struct Fixture {
        _dir: tempfile::TempDir,
        db_path: PathBuf,
        backups_dir: PathBuf,
        live: DatabaseConnection,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            let dir = tempfile::Builder::new()
                .prefix(&format!("mini-diarium-restore-entries-{name}-"))
                .tempdir()
                .unwrap();
            let db_path = dir.path().join("diary.db");
            let backups_dir = dir.path().join("backups");
            let live = create_database(&db_path, "test_password".to_string()).unwrap();
            Self {
                _dir: dir,
                db_path,
                backups_dir,
                live,
            }
        }

        fn ctx(&self) -> BackupContext<'_> {
            BackupContext {
                db_path: &self.db_path,
                backups_dir: &self.backups_dir,
                app_version: Some("0.0.0-test"),
            }
        }

        /// Snapshots the live db's *current* content and opens the result read-only.
        fn snapshot_and_open(&self) -> DatabaseConnection {
            create_snapshot(&self.live, &self.ctx(), SnapshotTrigger::Manual).unwrap();
            let file_name = list_snapshots(&self.backups_dir).unwrap()[0]
                .file_name
                .clone();
            super::super::open_snapshot_file(
                &self.backups_dir,
                &file_name,
                super::super::SnapshotCredential::Password("test_password".to_string()),
            )
            .unwrap()
        }
    }

    #[test]
    fn test_restored_entry_is_added_not_overwritten() {
        let fixture = Fixture::new("added-not-overwritten");
        let deleted_id = insert_entry(
            &fixture.live,
            &entry("2024-01-15", "Lost entry", "gone words here"),
        )
        .unwrap();
        let snapshot = fixture.snapshot_and_open();

        // Simulate the loss the feature exists to recover from, and add an unrelated entry on
        // the same date so "restore" must add alongside it, never replace it.
        crate::db::delete_entry_by_id(&fixture.live, deleted_id).unwrap();
        insert_entry(
            &fixture.live,
            &entry("2024-01-15", "Kept entry", "still here"),
        )
        .unwrap();

        let outcome =
            restore_entries_from_snapshot(&fixture.live, &snapshot, &[deleted_id]).unwrap();
        assert_eq!(outcome.added_count, 1);

        let on_date = get_entries_by_date(&fixture.live, "2024-01-15").unwrap();
        assert_eq!(
            on_date.len(),
            2,
            "the existing entry must survive alongside the restored one"
        );
        assert!(on_date
            .iter()
            .any(|e| e.title == "Lost entry" && e.text == "gone words here"));
        assert!(on_date.iter().any(|e| e.title == "Kept entry"));
    }

    #[test]
    fn test_restore_entries_preserves_tags() {
        let fixture = Fixture::new("tags");
        let id = insert_entry(&fixture.live, &entry("2024-02-01", "Tagged", "body text")).unwrap();
        let tag = db_create_tag(&fixture.live, "vacation").unwrap();
        crate::db::add_tag_to_entry(&fixture.live, id, tag.id).unwrap();
        let snapshot = fixture.snapshot_and_open();

        crate::db::delete_entry_by_id(&fixture.live, id).unwrap();

        restore_entries_from_snapshot(&fixture.live, &snapshot, &[id]).unwrap();

        let restored = get_entries_by_date(&fixture.live, "2024-02-01").unwrap();
        assert_eq!(restored.len(), 1);
        let tags = get_tags_for_entry(&fixture.live, restored[0].id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "vacation");
    }

    #[test]
    fn test_restore_entries_resolves_image_refs_across_databases() {
        // The regression this test exists for: an `image-id://N` ref means something
        // different in every database. A live journal that already holds an unrelated image
        // (kept alive by a permanent anchor entry, so it is not merely absent) must not have
        // that image silently attached to the restored entry — the restored entry must carry
        // its own, distinct image bytes.
        let fixture = Fixture::new("images");

        let mut anchor = entry("2024-01-01", "Anchor", "");
        anchor.text = format!(
            r#"<p><img src="data:image/png;base64,{}" alt=""></p>"#,
            base64_of(&tiny_png_bytes())
        );
        let anchor_id = insert_entry_with_images(&fixture.live, &anchor).unwrap();
        let unrelated_image_id =
            crate::db::get_images_for_entry(&fixture.live, anchor_id).unwrap()[0].id;

        let mut with_image = entry("2024-03-01", "Has an image", "");
        with_image.text = format!(
            r#"<p><img src="data:image/png;base64,{}" alt=""></p>"#,
            base64_of(&distinct_png_bytes())
        );
        let source_id = insert_entry_with_images(&fixture.live, &with_image).unwrap();

        // The snapshot captures both entries and both images.
        let snapshot = fixture.snapshot_and_open();

        // Simulate the loss: delete only the image-bearing entry and its now-orphaned image.
        // The anchor entry, and the unrelated image it holds, survive untouched.
        crate::db::delete_entry_by_id(&fixture.live, source_id).unwrap();
        crate::db::queries::images::cleanup_orphaned_images(&fixture.live).unwrap();
        assert_eq!(
            crate::db::get_images_for_entry(&fixture.live, anchor_id)
                .unwrap()
                .len(),
            1,
            "fixture bug: the unrelated anchor image must survive cleanup"
        );

        restore_entries_from_snapshot(&fixture.live, &snapshot, &[source_id]).unwrap();

        let restored = get_entries_by_date(&fixture.live, "2024-03-01").unwrap();
        assert_eq!(restored.len(), 1);
        assert!(
            restored[0].text.contains("image-id://"),
            "restored text must reference a freshly stored live image, got: {}",
            restored[0].text
        );

        let restored_images =
            crate::db::get_images_for_entry(&fixture.live, restored[0].id).unwrap();
        assert_eq!(
            restored_images.len(),
            1,
            "restored entry must have exactly its own image linked"
        );
        assert_ne!(
            restored_images[0].id, unrelated_image_id,
            "must not silently reuse the unrelated live image"
        );
        assert_eq!(
            restored_images[0].data_base64,
            base64_of(&distinct_png_bytes()),
            "restored image bytes must match the snapshot's own image, not the unrelated live one"
        );
    }

    #[test]
    fn test_restore_entries_writes_no_plaintext_to_disk() {
        // SQLite writes rollback-journal files as part of the insert transaction, so "no new
        // files appear" is the wrong assertion even for a correct implementation — any file
        // that *does* appear must not carry the plaintext content in the clear. Covers both
        // the text path and the image path (image bytes go through a separate in-memory
        // decode/thumbnail step that a text-only entry would not exercise).
        let fixture = Fixture::new("no-plaintext");
        let secret_title = "SecretTitleForDiskScan";
        let secret_text = "SecretBodyTextForDiskScan";
        let mut with_image = entry("2024-04-01", secret_title, secret_text);
        let secret_image_bytes = distinct_png_bytes();
        with_image.text = format!(
            "<p>{secret_text}<img src=\"data:image/png;base64,{}\" alt=\"\"></p>",
            base64_of(&secret_image_bytes)
        );
        let id = insert_entry_with_images(&fixture.live, &with_image).unwrap();
        let snapshot = fixture.snapshot_and_open();
        crate::db::delete_entry_by_id(&fixture.live, id).unwrap();
        crate::db::queries::images::cleanup_orphaned_images(&fixture.live).unwrap();

        restore_entries_from_snapshot(&fixture.live, &snapshot, &[id]).unwrap();

        for path in [&fixture.db_path, &fixture._dir.path().to_path_buf()] {
            scan_for_plaintext(path, &[secret_title, secret_text]);
            scan_for_plaintext_bytes(path, &secret_image_bytes);
        }
    }

    fn scan_for_plaintext(root: &std::path::Path, secrets: &[&str]) {
        let mut stack = vec![root.to_path_buf()];
        while let Some(path) = stack.pop() {
            if path.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&path) {
                    for e in entries.flatten() {
                        stack.push(e.path());
                    }
                }
                continue;
            }
            let Ok(bytes) = std::fs::read(&path) else {
                continue;
            };
            for secret in secrets {
                assert!(
                    !contains_bytes(&bytes, secret.as_bytes()),
                    "plaintext {secret:?} found on disk in {}",
                    path.display()
                );
            }
        }
    }

    fn scan_for_plaintext_bytes(root: &std::path::Path, secret: &[u8]) {
        let mut stack = vec![root.to_path_buf()];
        while let Some(path) = stack.pop() {
            if path.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&path) {
                    for e in entries.flatten() {
                        stack.push(e.path());
                    }
                }
                continue;
            }
            let Ok(bytes) = std::fs::read(&path) else {
                continue;
            };
            assert!(
                !contains_bytes(&bytes, secret),
                "plaintext image bytes found on disk in {}",
                path.display()
            );
        }
    }

    fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
        haystack.windows(needle.len()).any(|w| w == needle)
    }

    #[test]
    fn test_read_full_snapshot_entry_adapts_to_an_older_schema() {
        // The pre-migration snapshot — the most valuable one — always lacks the newest
        // columns. Roll a real journal back to v8, before entry_metadata_encrypted (v9).
        let fixture = Fixture::new("old-schema");
        let id = insert_entry(
            &fixture.live,
            &entry("2024-05-01", "Old", "before metadata"),
        )
        .unwrap();
        fixture
            .live
            .conn()
            .execute_batch(
                "ALTER TABLE entries DROP COLUMN locked;
                 ALTER TABLE entries DROP COLUMN preview_enc;
                 ALTER TABLE entries DROP COLUMN entry_metadata_encrypted;
                 UPDATE schema_version SET version = 8;",
            )
            .unwrap();
        create_snapshot(&fixture.live, &fixture.ctx(), SnapshotTrigger::Migration).unwrap();
        let file_name = list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();
        let snapshot = super::super::open_snapshot_file(
            &fixture.backups_dir,
            &file_name,
            super::super::SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();

        let full = read_full_snapshot_entry(&snapshot, id).unwrap().unwrap();
        assert_eq!(full.title, "Old");
        assert_eq!(full.text, "before metadata");
        assert_eq!(full.metadata, None);
        assert!(!full.locked);
    }

    #[test]
    fn test_status_flags_missing_shorter_and_present_entries() {
        let fixture = Fixture::new("status");
        insert_entry(
            &fixture.live,
            &entry("2024-06-01", "Gone", "will be deleted"),
        )
        .unwrap();
        insert_entry(
            &fixture.live,
            &entry("2024-06-02", "Truncated", "one two three four five"),
        )
        .unwrap();
        insert_entry(
            &fixture.live,
            &entry("2024-06-03", "Whole", "unchanged content here"),
        )
        .unwrap();
        insert_entry(
            &fixture.live,
            &entry("2024-06-04", "", "blank title entry body"),
        )
        .unwrap();
        let snapshot = fixture.snapshot_and_open();

        // Delete "Gone" entirely; shrink "Truncated"; leave "Whole" and the blank-titled entry
        // untouched.
        let on_02 = get_entries_by_date(&fixture.live, "2024-06-02").unwrap();
        crate::db::delete_entry_by_id(&fixture.live, on_02[0].id).unwrap();
        let mut shorter = on_02[0].clone();
        shorter.text = "one".to_string();
        shorter.word_count = 1;
        insert_entry(&fixture.live, &shorter).unwrap();
        let on_01 = get_entries_by_date(&fixture.live, "2024-06-01").unwrap();
        crate::db::delete_entry_by_id(&fixture.live, on_01[0].id).unwrap();

        let diffs = list_snapshot_entries_with_status(&snapshot, &fixture.live).unwrap();

        let status_of = |title: &str| {
            diffs
                .iter()
                .find(|d| d.title == title)
                .unwrap_or_else(|| panic!("no diff entry titled {title:?}"))
                .status
        };
        assert_eq!(status_of("Gone"), EntryMatchStatus::Missing);
        assert_eq!(status_of("Truncated"), EntryMatchStatus::ShorterInLive);
        assert_eq!(status_of("Whole"), EntryMatchStatus::Present);

        let blank = diffs.iter().find(|d| d.date == "2024-06-04").unwrap();
        assert_eq!(
            blank.status,
            EntryMatchStatus::Present,
            "a blank-titled snapshot entry must match a blank-titled live entry on the same date"
        );
    }

    /// A tiny, genuinely valid PNG — encoded, not hand-written, so its checksums are correct.
    fn encode_png(pixel: image::Rgba<u8>) -> Vec<u8> {
        use image::{DynamicImage, RgbaImage};
        let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(1, 1, pixel));
        let mut cursor = std::io::Cursor::new(Vec::new());
        image
            .write_to(&mut cursor, image::ImageFormat::Png)
            .unwrap();
        cursor.into_inner()
    }

    fn tiny_png_bytes() -> Vec<u8> {
        encode_png(image::Rgba([32, 64, 128, 255]))
    }

    fn distinct_png_bytes() -> Vec<u8> {
        // A different pixel color, so it cannot collide by content with `tiny_png_bytes`'s
        // fingerprint.
        encode_png(image::Rgba([200, 10, 90, 255]))
    }

    fn base64_of(bytes: &[u8]) -> String {
        use base64::{engine::general_purpose, Engine as _};
        general_purpose::STANDARD.encode(bytes)
    }
}
