//! File attachments on entries (TODO-0114).
//!
//! Attachment bytes never cross IPC: `add_entry_attachment` reads the source file here in
//! Rust, and `save_attachment_copy` decrypts straight to the destination file. The
//! frontend only sees ids and metadata ([`AttachmentSummary`]).
//!
//! Paths come from the frontend's native dialogs (`src/lib/dialog.ts`), same trust model as
//! `read_file_bytes` / `write_pdf_file` in `files.rs`; each command still validates what it
//! can on its own (regular file, size, extension match).

use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::{self, AttachmentSummary};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::State;
use zeroize::Zeroizing;

const ERR_NOT_FOUND: &str = "Attachment not found";

/// Lowercased extension of a file name/path, or `None` when it has none.
fn lower_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Validates the source path and reads it, rejecting non-files, empty files, and files over
/// the shared size cap **before** reading any bytes.
fn read_source_file(path: &Path) -> Result<(String, Zeroizing<Vec<u8>>), String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read file: {}", e))?;
    if !metadata.is_file() {
        return Err("Attachment path is not a file".to_string());
    }
    if metadata.len() == 0 {
        return Err("Attachment file is empty".to_string());
    }
    if metadata.len() > db::MAX_STORED_BLOB_BYTES as u64 {
        return Err(format!(
            "Attachment is too large. Maximum supported size is {} MB.",
            db::MAX_STORED_BLOB_BYTES / 1_048_576
        ));
    }

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Attachment file name is not valid".to_string())?
        .to_string();

    // Read at most one byte past the cap: the file can grow between the size check above and
    // this read, and an unbounded read would pull all of it into memory first.
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let mut bytes = Zeroizing::new(Vec::with_capacity(metadata.len() as usize));
    file.take(db::MAX_STORED_BLOB_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    // The core re-checks empty / too large on the bytes actually read.
    Ok((name, bytes))
}

const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";

/// Whether an existing file at `path` is a SQLite database (a journal, a backup snapshot).
fn is_sqlite_file(path: &Path) -> bool {
    let mut header = [0u8; 16];
    std::fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut header))
        .map(|_| header == SQLITE_HEADER)
        .unwrap_or(false)
}

/// `path` with its parent directory resolved, for comparing a destination that may not
/// exist yet. Lower-cased: a false match only refuses a save, a missed one could overwrite
/// the journal, so case-insensitive is the safe side on every OS.
fn normalized(path: &Path) -> Option<String> {
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty())?;
    let resolved: PathBuf = std::fs::canonicalize(parent).ok()?.join(path.file_name()?);
    Some(resolved.to_string_lossy().to_lowercase())
}

/// Refuses destinations where "save a copy" would destroy journal data: any existing SQLite
/// database (the open journal, another journal, a snapshot), the open journal's SQLite side
/// files, anything inside the backups directory, and the app's `config.json`. The save
/// dialog's "replace?" prompt is not enough: an attachment named `diary.db` saved into the
/// journal folder would silently replace the journal.
fn ensure_safe_destination(dest: &Path, state: &DiaryState) -> Result<(), String> {
    const ERR: &str = "This location is used by the journal and cannot be overwritten";
    if is_sqlite_file(dest) {
        return Err(ERR.to_string());
    }
    let Some(dest_norm) = normalized(dest) else {
        // An unresolvable parent cannot hold the journal; the write reports its own error.
        return Ok(());
    };

    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();

    if let Some(db_norm) = normalized(&db_path) {
        for suffix in ["", "-wal", "-shm", "-journal"] {
            if dest_norm == format!("{}{}", db_norm, suffix) {
                return Err(ERR.to_string());
            }
        }
    }
    if let Ok(backups) = std::fs::canonicalize(&backups_dir) {
        let backups_norm = backups.to_string_lossy().to_lowercase();
        let sep = std::path::MAIN_SEPARATOR;
        if dest_norm.starts_with(&format!("{}{}", backups_norm, sep)) {
            return Err(ERR.to_string());
        }
    }
    if normalized(&state.app_data_dir.join("config.json")).as_deref() == Some(dest_norm.as_str()) {
        return Err(ERR.to_string());
    }
    Ok(())
}

pub(crate) fn list_entry_attachments_inner(
    entry_id: i64,
    state: &DiaryState,
) -> Result<Vec<AttachmentSummary>, String> {
    with_unlocked_db(state, |db| db::list_entry_attachments(db, entry_id))
}

/// Lists an entry's attachments (metadata only), oldest first.
#[tauri::command]
pub fn list_entry_attachments(
    entry_id: i64,
    state: State<DiaryState>,
) -> Result<Vec<AttachmentSummary>, String> {
    list_entry_attachments_inner(entry_id, &state)
}

pub(crate) fn add_entry_attachment_inner(
    entry_id: i64,
    path: &str,
    state: &DiaryState,
) -> Result<AttachmentSummary, String> {
    // Core refuses a locked entry with `db::ERR_ENTRY_LOCKED` (TODO-0071). The source file
    // is read before core checks the lock, so a bad file on a locked entry reports the file
    // error, not the lock error (archived plan DEC-009, review W-05). This order is pinned by
    // `test_locked_entry_reports_file_error_before_lock_error`; TODO-0134 owns any change.
    // Do not add an app-side lock pre-check: it splits the check from core's write unit.
    with_unlocked_db(state, |db| {
        let (name, bytes) = read_source_file(Path::new(path))?;
        db::add_attachment_to_entry(db, entry_id, &name, &bytes)
    })
}

/// Encrypts the file at `path` into the journal and attaches it to the entry.
///
/// Only the basename is stored, as the per-entry attachment name.
#[tauri::command]
pub fn add_entry_attachment(
    entry_id: i64,
    path: String,
    state: State<DiaryState>,
) -> Result<AttachmentSummary, String> {
    add_entry_attachment_inner(entry_id, &path, &state)
}

pub(crate) fn remove_entry_attachment_inner(
    entry_id: i64,
    attachment_id: i64,
    state: &DiaryState,
) -> Result<(), String> {
    // Core refuses a locked entry with `db::ERR_ENTRY_LOCKED` (TODO-0071).
    with_unlocked_db(state, |db| {
        if !db::remove_attachment_from_entry(db, entry_id, attachment_id)? {
            return Err(ERR_NOT_FOUND.to_string());
        }
        Ok(())
    })
}

/// Detaches an attachment from the entry; the encrypted blob is deleted once no entry
/// links it any more.
#[tauri::command]
pub fn remove_entry_attachment(
    entry_id: i64,
    attachment_id: i64,
    state: State<DiaryState>,
) -> Result<(), String> {
    remove_entry_attachment_inner(entry_id, attachment_id, &state)
}

pub(crate) fn save_attachment_copy_inner(
    entry_id: i64,
    attachment_id: i64,
    dest_path: &str,
    state: &DiaryState,
) -> Result<(), String> {
    let dest = Path::new(dest_path);
    ensure_safe_destination(dest, state)?;
    // Decrypt under the DB lock, write after releasing it. Saving a copy is a read, so it
    // stays allowed on a locked entry.
    let bytes = with_unlocked_db(state, |db| {
        let summary = db::list_entry_attachments(db, entry_id)?
            .into_iter()
            .find(|a| a.id == attachment_id)
            .ok_or_else(|| ERR_NOT_FOUND.to_string())?;

        // Limits this command's reach: it can only write a file of the attachment's own type.
        let expected = lower_extension(Path::new(&summary.name));
        if lower_extension(dest) != expected {
            return Err(match expected {
                Some(ext) => format!("Destination file must have the .{} extension", ext),
                None => "Destination file must have no extension".to_string(),
            });
        }

        db::read_attachment_bytes(db, entry_id, attachment_id)?
            .ok_or_else(|| ERR_NOT_FOUND.to_string())
    })?;

    std::fs::write(dest, bytes.as_slice())
        .map_err(|e| format!("Failed to write attachment copy: {}", e))
}

/// Decrypts an attachment straight to `dest_path` (chosen in the frontend save dialog).
/// No temporary plaintext file is created.
#[tauri::command]
pub fn save_attachment_copy(
    entry_id: i64,
    attachment_id: i64,
    dest_path: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    save_attachment_copy_inner(entry_id, attachment_id, &dest_path, &state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_database, DiaryEntry, ERR_ENTRY_LOCKED};
    use std::path::PathBuf;

    struct Fixture {
        _tmp: tempfile::NamedTempFile,
        dir: tempfile::TempDir,
        state: DiaryState,
        entry_id: i64,
    }

    fn fixture(name: &str) -> Fixture {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = "2024-01-01T00:00:00Z".to_string();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-06-01".to_string(),
            title: "T".to_string(),
            text: "<p>content</p>".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();
        let state = DiaryState::new(
            PathBuf::from(format!("test_attachments_{}.db", name)),
            PathBuf::from(format!("test_attachments_{}_backups", name)),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);
        Fixture {
            _tmp: tmp,
            dir: tempfile::tempdir().unwrap(),
            state,
            entry_id,
        }
    }

    impl Fixture {
        fn write_file(&self, name: &str, bytes: &[u8]) -> String {
            let path = self.dir.path().join(name);
            std::fs::write(&path, bytes).unwrap();
            path.to_string_lossy().to_string()
        }

        fn path(&self, name: &str) -> String {
            self.dir.path().join(name).to_string_lossy().to_string()
        }

        fn lock_entry(&self) {
            let guard = self.state.db.lock().unwrap();
            db::set_entry_locked(guard.as_ref().unwrap(), self.entry_id, true).unwrap();
        }
    }

    #[test]
    fn test_add_list_and_save_copy_round_trip() {
        let f = fixture("round_trip");
        let original = b"%PDF-1.7 some bytes".to_vec();
        let src = f.write_file("Report.pdf", &original);

        let added = add_entry_attachment_inner(f.entry_id, &src, &f.state).unwrap();
        assert_eq!(added.name, "Report.pdf", "only the basename is stored");
        assert_eq!(added.mime_type, "application/pdf");
        assert_eq!(added.byte_size, original.len() as i64);

        let list = list_entry_attachments_inner(f.entry_id, &f.state).unwrap();
        assert_eq!(list, vec![added.clone()]);

        // Extension check is case-insensitive.
        let dest = f.path("copy.PDF");
        save_attachment_copy_inner(f.entry_id, added.id, &dest, &f.state).unwrap();
        assert_eq!(std::fs::read(&dest).unwrap(), original);
    }

    #[test]
    fn test_add_rejects_directory_empty_and_missing_file() {
        let f = fixture("add_rejects");
        let dir = f.dir.path().to_string_lossy().to_string();
        let err = add_entry_attachment_inner(f.entry_id, &dir, &f.state).unwrap_err();
        assert_eq!(err, "Attachment path is not a file");

        let empty = f.write_file("empty.txt", b"");
        let err = add_entry_attachment_inner(f.entry_id, &empty, &f.state).unwrap_err();
        assert_eq!(err, "Attachment file is empty");

        let missing = f.path("missing.txt");
        let err = add_entry_attachment_inner(f.entry_id, &missing, &f.state).unwrap_err();
        assert!(err.starts_with("Failed to read file"), "got: {}", err);

        assert!(list_entry_attachments_inner(f.entry_id, &f.state)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn test_add_rejects_oversized_file_before_reading() {
        let f = fixture("oversized");
        let path = f.path("big.bin");
        let file = std::fs::File::create(&path).unwrap();
        // Sparse on most filesystems: sets the length without writing 20 MB.
        file.set_len(db::MAX_STORED_BLOB_BYTES as u64 + 1).unwrap();

        let err = add_entry_attachment_inner(f.entry_id, &path, &f.state).unwrap_err();
        assert!(err.contains("too large"), "got: {}", err);
    }

    #[test]
    fn test_locked_entry_rejects_add_and_remove_but_allows_save_copy() {
        let f = fixture("locked");
        let src = f.write_file("notes.txt", b"hello");
        let added = add_entry_attachment_inner(f.entry_id, &src, &f.state).unwrap();
        f.lock_entry();

        let other = f.write_file("other.txt", b"other");
        assert_eq!(
            add_entry_attachment_inner(f.entry_id, &other, &f.state).unwrap_err(),
            ERR_ENTRY_LOCKED
        );
        assert_eq!(
            remove_entry_attachment_inner(f.entry_id, added.id, &f.state).unwrap_err(),
            ERR_ENTRY_LOCKED
        );
        assert_eq!(
            list_entry_attachments_inner(f.entry_id, &f.state)
                .unwrap()
                .len(),
            1
        );

        let dest = f.path("copy.txt");
        save_attachment_copy_inner(f.entry_id, added.id, &dest, &f.state).unwrap();
        assert_eq!(std::fs::read(&dest).unwrap(), b"hello");
    }

    /// Characterization test (review W-05): the source file is read before core checks the
    /// lock, so a bad file on a locked entry reports the file error. TODO-0134 updates or
    /// replaces this test if it changes the order.
    #[test]
    fn test_locked_entry_reports_file_error_before_lock_error() {
        let f = fixture("locked_file_error");
        f.lock_entry();
        let empty = f.write_file("empty.txt", b"");

        let err = add_entry_attachment_inner(f.entry_id, &empty, &f.state).unwrap_err();
        assert_eq!(err, "Attachment file is empty");
        assert_ne!(err, ERR_ENTRY_LOCKED);
        // Control: the entry really is locked, so a valid file gets the lock error.
        let valid = f.write_file("valid.txt", b"x");
        assert_eq!(
            add_entry_attachment_inner(f.entry_id, &valid, &f.state).unwrap_err(),
            ERR_ENTRY_LOCKED
        );
        assert!(list_entry_attachments_inner(f.entry_id, &f.state)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn test_remove_detaches_and_reports_missing() {
        let f = fixture("remove");
        let src = f.write_file("a.txt", b"a");
        let added = add_entry_attachment_inner(f.entry_id, &src, &f.state).unwrap();

        remove_entry_attachment_inner(f.entry_id, added.id, &f.state).unwrap();
        assert!(list_entry_attachments_inner(f.entry_id, &f.state)
            .unwrap()
            .is_empty());
        assert_eq!(
            remove_entry_attachment_inner(f.entry_id, added.id, &f.state).unwrap_err(),
            ERR_NOT_FOUND
        );
    }

    #[test]
    fn test_save_copy_requires_matching_extension() {
        let f = fixture("ext_match");
        let pdf = f.write_file("doc.pdf", b"pdf");
        let added = add_entry_attachment_inner(f.entry_id, &pdf, &f.state).unwrap();

        for bad in ["copy.exe", "copy", "copy.pdf.exe"] {
            let err = save_attachment_copy_inner(f.entry_id, added.id, &f.path(bad), &f.state)
                .unwrap_err();
            assert_eq!(err, "Destination file must have the .pdf extension");
            assert!(!Path::new(&f.path(bad)).exists());
        }

        let bare = f.write_file("README", b"readme");
        let bare_added = add_entry_attachment_inner(f.entry_id, &bare, &f.state).unwrap();
        let err = save_attachment_copy_inner(f.entry_id, bare_added.id, &f.path("x.txt"), &f.state)
            .unwrap_err();
        assert_eq!(err, "Destination file must have no extension");
        save_attachment_copy_inner(f.entry_id, bare_added.id, &f.path("README-copy"), &f.state)
            .unwrap();
    }

    #[test]
    fn test_save_copy_refuses_attachment_of_another_entry() {
        let f = fixture("cross_entry");
        let src = f.write_file("s.txt", b"secret");
        let added = add_entry_attachment_inner(f.entry_id, &src, &f.state).unwrap();

        let err = save_attachment_copy_inner(f.entry_id + 1, added.id, &f.path("x.txt"), &f.state)
            .unwrap_err();
        assert_eq!(err, ERR_NOT_FOUND);
    }

    /// "Save a copy" must never overwrite journal data, even if the user confirms "replace?"
    /// in the save dialog: an attachment named `diary.db` saved into the journal folder
    /// would otherwise silently replace the journal.
    #[test]
    fn test_save_copy_refuses_journal_files_and_backups() {
        let mut f = fixture("protected_dest");
        let dir = f.dir.path().to_path_buf();
        let live_db = dir.join("diary.db");
        std::fs::write(&live_db, b"SQLite format 3\0live journal pages").unwrap();
        let other_journal = dir.join("other.sqlite");
        std::fs::write(&other_journal, b"SQLite format 3\0another journal").unwrap();
        let backups = dir.join("backups");
        std::fs::create_dir(&backups).unwrap();
        let open_db = f.state.db.lock().unwrap().take();
        f.state = DiaryState::new(live_db.clone(), backups.clone(), dir.clone());
        *f.state.db.lock().unwrap() = open_db;

        let db_file = f.write_file("diary.db", b"SQLite format 3\0live journal pages");
        let db_att = add_entry_attachment_inner(f.entry_id, &db_file, &f.state).unwrap();
        let wal = f.write_file("x.db-wal", b"not a real wal");
        let wal_att = add_entry_attachment_inner(f.entry_id, &wal, &f.state).unwrap();
        let sq = f.write_file("x.sqlite", b"sqlite-named bytes");
        let sq_att = add_entry_attachment_inner(f.entry_id, &sq, &f.state).unwrap();
        let json = f.write_file("x.json", b"{}");
        let json_att = add_entry_attachment_inner(f.entry_id, &json, &f.state).unwrap();

        let protected = [
            (db_att.id, live_db.clone()),
            // Only the file name varies in case: upper-casing the whole path would name a
            // temp directory that exists on case-insensitive Windows/macOS but not on Linux,
            // so the guard would never see the journal's parent there.
            (db_att.id, dir.join("DIARY.DB")),
            (wal_att.id, dir.join("diary.db-wal")),
            (sq_att.id, other_journal.clone()),
            (db_att.id, backups.join("new.db")),
            (json_att.id, dir.join("config.json")),
        ];
        for (id, dest) in &protected {
            let err =
                save_attachment_copy_inner(f.entry_id, *id, &dest.to_string_lossy(), &f.state)
                    .unwrap_err();
            assert_eq!(
                err,
                "This location is used by the journal and cannot be overwritten",
                "dest: {}",
                dest.display()
            );
        }
        assert_eq!(
            std::fs::read(&live_db).unwrap(),
            b"SQLite format 3\0live journal pages"
        );
        assert!(!backups.join("new.db").exists());

        // An ordinary destination next to the journal is still fine.
        save_attachment_copy_inner(
            f.entry_id,
            db_att.id,
            &dir.join("copy.db").to_string_lossy(),
            &f.state,
        )
        .unwrap();
    }

    #[test]
    fn test_add_rejects_control_characters_in_the_name() {
        let f = fixture("control_chars");
        if cfg!(windows) {
            return; // Windows file names cannot hold control characters at all.
        }
        let src = f.write_file("a\nb.txt", b"x");
        let err = add_entry_attachment_inner(f.entry_id, &src, &f.state).unwrap_err();
        assert_eq!(err, "Attachment name contains control characters");
    }

    #[test]
    fn test_commands_require_unlocked_journal() {
        let state = DiaryState::new(
            PathBuf::from("test_attachments_locked_journal.db"),
            PathBuf::from("test_attachments_locked_journal_backups"),
            PathBuf::from("."),
        );
        let err = list_entry_attachments_inner(1, &state).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }
}
