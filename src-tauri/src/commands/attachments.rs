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
use std::path::Path;
use tauri::State;
use zeroize::Zeroizing;

const ERR_ENTRY_LOCKED: &str = "entry is locked";
const ERR_NOT_FOUND: &str = "Attachment not found";

fn ensure_entry_unlocked(db: &db::DatabaseConnection, entry_id: i64) -> Result<(), String> {
    // A locked entry is read-only, including its attachment links (TODO-0071).
    if db::is_entry_locked(db, entry_id)? {
        return Err(ERR_ENTRY_LOCKED.to_string());
    }
    Ok(())
}

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
    let bytes =
        Zeroizing::new(std::fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?);
    Ok((name, bytes))
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
    with_unlocked_db(state, |db| {
        ensure_entry_unlocked(db, entry_id)?;
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
    with_unlocked_db(state, |db| {
        ensure_entry_unlocked(db, entry_id)?;
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
    use crate::db::{create_database, DiaryEntry};
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
