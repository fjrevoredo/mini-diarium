use crate::db::queries;
use crate::db::schema::DatabaseConnection;
use log::error;

const MAX_IMPORT_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100 MB

pub(crate) fn read_import_file(file_path: &str) -> Result<String, String> {
    let metadata = std::fs::metadata(file_path).map_err(|e| {
        let err = format!("Cannot access file: {}", e);
        error!("{}", err);
        err
    })?;
    if metadata.len() > MAX_IMPORT_FILE_SIZE {
        let err = format!(
            "File is too large ({} MB). Maximum supported size is 100 MB.",
            metadata.len() / 1_048_576
        );
        error!("{}", err);
        return Err(err);
    }
    std::fs::read_to_string(file_path).map_err(|e| {
        let err = format!("Failed to read file: {}", e);
        error!("{}", err);
        err
    })
}

/// Import result containing the number of entries imported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub entries_imported: usize,
    pub entries_skipped: usize,
}

/// Imports a list of entries into the database
///
/// Each entry always creates a new row (AUTOINCREMENT id). No merge logic.
pub(crate) fn import_entries(
    db: &DatabaseConnection,
    entries: Vec<queries::DiaryEntry>,
) -> Result<ImportResult, String> {
    let mut entries_imported = 0;
    let mut entries_skipped = 0;

    for entry in entries {
        // Skip entries with no meaningful content
        if entry.title.trim().is_empty() && entry.text.trim().is_empty() {
            entries_skipped += 1;
            continue;
        }
        // Always insert a new row — AUTOINCREMENT assigns the id
        queries::insert_entry(db, &entry)?;
        entries_imported += 1;
    }

    Ok(ImportResult {
        entries_imported,
        entries_skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        }
    }

    #[test]
    fn test_import_new_entries() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entries = vec![
            create_test_entry("2024-01-01", "Entry 1", "Text 1"),
            create_test_entry("2024-01-02", "Entry 2", "Text 2"),
        ];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 2);
        assert_eq!(result.entries_skipped, 0);
    }

    #[test]
    fn test_import_same_date_creates_duplicates() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert existing entry
        let existing = create_test_entry("2024-01-01", "Morning", "Had breakfast");
        crate::db::queries::insert_entry(&db, &existing).unwrap();

        // Import entry with same date — should create a second entry (no merge)
        let entries = vec![create_test_entry("2024-01-01", "Evening", "Had dinner")];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 1);
        assert_eq!(result.entries_skipped, 0);

        // Both entries should exist on the same date
        let all = crate::db::queries::get_entries_by_date(&db, "2024-01-01").unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_import_file_at_size_limit() {
        use std::io::{Seek, SeekFrom, Write};
        let tmp = tempfile::Builder::new().suffix(".txt").tempfile().unwrap();
        // Seek to exactly MAX_IMPORT_FILE_SIZE - 1, then write one newline byte.
        // The file is MAX_IMPORT_FILE_SIZE bytes with a sparse null-padded interior
        // (valid UTF-8). The size check is `> MAX_IMPORT_FILE_SIZE` (strict), so
        // this file passes.
        let mut f = tmp.reopen().unwrap();
        f.seek(SeekFrom::Start(MAX_IMPORT_FILE_SIZE - 1)).unwrap();
        f.write_all(b"\n").unwrap();
        drop(f);
        let result = read_import_file(tmp.path().to_str().unwrap());
        assert!(
            result.is_ok(),
            "file at exactly the size limit should be accepted"
        );
    }

    #[test]
    fn test_import_file_over_size_limit() {
        use std::io::{Seek, SeekFrom, Write};
        let tmp = tempfile::Builder::new().suffix(".txt").tempfile().unwrap();
        // One byte over the limit — read_import_file must reject it before reading.
        let mut f = tmp.reopen().unwrap();
        f.seek(SeekFrom::Start(MAX_IMPORT_FILE_SIZE)).unwrap();
        f.write_all(b"\n").unwrap();
        drop(f);
        let result = read_import_file(tmp.path().to_str().unwrap());
        assert!(
            result.is_err(),
            "file over the size limit should be rejected"
        );
        assert!(
            result.unwrap_err().contains("too large"),
            "error message should mention 'too large'"
        );
    }

    #[test]
    fn test_import_empty_list() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = import_entries(&db, vec![]).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_skipped, 0);
    }
}
