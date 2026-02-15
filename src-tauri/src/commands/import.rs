use crate::commands::auth::DiaryState;
use crate::db::queries;
use crate::db::schema::DatabaseConnection;
use crate::import::{dayone, dayone_txt, jrnl, merge, minidiary};
use tauri::State;

/// Import result containing the number of entries imported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub entries_imported: usize,
    pub entries_merged: usize,
    pub entries_skipped: usize,
}

/// Imports Mini Diary JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_minidiary_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    eprintln!("[Import] Starting import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or_else(|| {
            let err = "Diary must be unlocked to import entries";
            eprintln!("[Import] Error: {}", err);
            err.to_string()
        })?;

    // Read file
    eprintln!("[Import] Reading file...");
    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| {
            let err = format!("Failed to read file: {}", e);
            eprintln!("[Import] Error: {}", err);
            err
        })?;

    // Parse JSON
    eprintln!("[Import] Parsing JSON...");
    let entries = minidiary::parse_minidiary_json(&json_content)
        .map_err(|e| {
            eprintln!("[Import] Parse error: {}", e);
            e
        })?;
    eprintln!("[Import] Parsed {} entries", entries.len());

    // Import entries with merge handling
    eprintln!("[Import] Importing entries...");
    let result = import_entries(db, entries)
        .map_err(|e| {
            eprintln!("[Import] Import error: {}", e);
            e
        })?;

    // Rebuild FTS index after import
    eprintln!("[Import] Rebuilding FTS index...");
    rebuild_fts_index(db)
        .map_err(|e| {
            eprintln!("[Import] FTS rebuild error: {}", e);
            e
        })?;

    eprintln!("[Import] Success: {} imported, {} merged",
        result.entries_imported, result.entries_merged);
    Ok(result)
}

/// Imports Day One JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_dayone_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    eprintln!("[Import] Starting Day One import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or_else(|| {
            let err = "Diary must be unlocked to import entries";
            eprintln!("[Import] Error: {}", err);
            err.to_string()
        })?;

    // Read file
    eprintln!("[Import] Reading file...");
    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| {
            let err = format!("Failed to read file: {}", e);
            eprintln!("[Import] Error: {}", err);
            err
        })?;

    // Parse JSON
    eprintln!("[Import] Parsing Day One JSON...");
    let entries = dayone::parse_dayone_json(&json_content)
        .map_err(|e| {
            eprintln!("[Import] Parse error: {}", e);
            e
        })?;
    eprintln!("[Import] Parsed {} entries", entries.len());

    // Import entries with merge handling
    eprintln!("[Import] Importing entries...");
    let result = import_entries(db, entries)
        .map_err(|e| {
            eprintln!("[Import] Import error: {}", e);
            e
        })?;

    // Rebuild FTS index after import
    eprintln!("[Import] Rebuilding FTS index...");
    rebuild_fts_index(db)
        .map_err(|e| {
            eprintln!("[Import] FTS rebuild error: {}", e);
            e
        })?;

    eprintln!("[Import] Success: {} imported, {} merged",
        result.entries_imported, result.entries_merged);
    Ok(result)
}

/// Imports jrnl JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_jrnl_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    eprintln!("[Import] Starting jrnl import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or_else(|| {
            let err = "Diary must be unlocked to import entries";
            eprintln!("[Import] Error: {}", err);
            err.to_string()
        })?;

    // Read file
    eprintln!("[Import] Reading file...");
    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| {
            let err = format!("Failed to read file: {}", e);
            eprintln!("[Import] Error: {}", err);
            err
        })?;

    // Parse JSON
    eprintln!("[Import] Parsing jrnl JSON...");
    let entries = jrnl::parse_jrnl_json(&json_content)
        .map_err(|e| {
            eprintln!("[Import] Parse error: {}", e);
            e
        })?;
    eprintln!("[Import] Parsed {} entries", entries.len());

    // Import entries with merge handling
    eprintln!("[Import] Importing entries...");
    let result = import_entries(db, entries)
        .map_err(|e| {
            eprintln!("[Import] Import error: {}", e);
            e
        })?;

    // Rebuild FTS index after import
    eprintln!("[Import] Rebuilding FTS index...");
    rebuild_fts_index(db)
        .map_err(|e| {
            eprintln!("[Import] FTS rebuild error: {}", e);
            e
        })?;

    eprintln!("[Import] Success: {} imported, {} merged",
        result.entries_imported, result.entries_merged);
    Ok(result)
}

/// Imports Day One TXT format
///
/// # Arguments
/// * `file_path` - Path to the TXT file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_dayone_txt(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    eprintln!("[Import] Starting Day One TXT import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or_else(|| {
            let err = "Diary must be unlocked to import entries";
            eprintln!("[Import] Error: {}", err);
            err.to_string()
        })?;

    // Read file
    eprintln!("[Import] Reading file...");
    let txt_content = std::fs::read_to_string(&file_path)
        .map_err(|e| {
            let err = format!("Failed to read file: {}", e);
            eprintln!("[Import] Error: {}", err);
            err
        })?;

    // Parse TXT
    eprintln!("[Import] Parsing Day One TXT...");
    let entries = dayone_txt::parse_dayone_txt(&txt_content)
        .map_err(|e| {
            eprintln!("[Import] Parse error: {}", e);
            e
        })?;
    eprintln!("[Import] Parsed {} entries", entries.len());

    // Import entries with merge handling
    eprintln!("[Import] Importing entries...");
    let result = import_entries(db, entries)
        .map_err(|e| {
            eprintln!("[Import] Import error: {}", e);
            e
        })?;

    // Rebuild FTS index after import
    eprintln!("[Import] Rebuilding FTS index...");
    rebuild_fts_index(db)
        .map_err(|e| {
            eprintln!("[Import] FTS rebuild error: {}", e);
            e
        })?;

    eprintln!("[Import] Success: {} imported, {} merged",
        result.entries_imported, result.entries_merged);
    Ok(result)
}

/// Imports a list of entries into the database
///
/// Handles merging when entries with the same date already exist
fn import_entries(
    db: &DatabaseConnection,
    entries: Vec<queries::DiaryEntry>,
) -> Result<ImportResult, String> {
    let mut entries_imported = 0;
    let mut entries_merged = 0;
    let entries_skipped = 0;

    for entry in entries {
        // Check if entry already exists
        let existing = queries::get_entry(db, &entry.date)?;

        if let Some(existing_entry) = existing {
            // Entry exists - merge it
            let merged = merge::merge_entries(existing_entry, entry);
            queries::update_entry(db, &merged)?;
            entries_merged += 1;
        } else {
            // New entry - insert it
            queries::insert_entry(db, &entry)?;
            entries_imported += 1;
        }
    }

    Ok(ImportResult {
        entries_imported,
        entries_merged,
        entries_skipped,
    })
}

/// Rebuilds the full-text search index
///
/// This is necessary after bulk imports to ensure search works correctly
fn rebuild_fts_index(db: &DatabaseConnection) -> Result<(), String> {
    eprintln!("[FTS] Clearing existing FTS index...");

    // Use FTS5 'delete-all' command to clear the index
    // This is the correct way to clear an FTS5 virtual table
    db.conn()
        .execute("INSERT INTO entries_fts(entries_fts) VALUES('delete-all')", [])
        .map_err(|e| format!("Failed to clear FTS index: {}", e))?;

    eprintln!("[FTS] Getting all entry dates...");
    // Get all entries
    let dates = queries::get_all_entry_dates(db)?;
    let total_entries = dates.len();
    eprintln!("[FTS] Found {} entries to index", total_entries);

    // Rebuild index for each entry
    for date in dates {
        if let Some(entry) = queries::get_entry(db, &date)? {
            // Get rowid for this entry
            let rowid: i64 = db
                .conn()
                .query_row(
                    "SELECT rowid FROM entries WHERE date = ?1",
                    [&date],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Failed to get rowid for {}: {}", date, e))?;

            // Insert into FTS index using the proper FTS5 format
            db.conn()
                .execute(
                    "INSERT INTO entries_fts (rowid, date, title, text) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![rowid, &entry.date, &entry.title, &entry.text],
                )
                .map_err(|e| format!("Failed to rebuild FTS for {}: {}", date, e))?;
        }
    }

    eprintln!("[FTS] Successfully rebuilt FTS index for {} entries", total_entries);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_import_{}.db", name)
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_import_new_entries() {
        let db_path = temp_db_path("new_entries");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let entries = vec![
            create_test_entry("2024-01-01", "Entry 1", "Text 1"),
            create_test_entry("2024-01-02", "Entry 2", "Text 2"),
        ];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 2);
        assert_eq!(result.entries_merged, 0);
        assert_eq!(result.entries_skipped, 0);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_import_with_merge() {
        let db_path = temp_db_path("merge");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert existing entry
        let existing = create_test_entry("2024-01-01", "Morning", "Had breakfast");
        crate::db::queries::insert_entry(&db, &existing).unwrap();

        // Import entry with same date
        let entries = vec![create_test_entry("2024-01-01", "Evening", "Had dinner")];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_merged, 1);

        // Verify merge happened
        let merged = crate::db::queries::get_entry(&db, "2024-01-01")
            .unwrap()
            .unwrap();
        assert!(merged.title.contains("Morning"));
        assert!(merged.title.contains("Evening"));

        cleanup_db(&db_path);
    }

    #[test]
    fn test_rebuild_fts_index() {
        let db_path = temp_db_path("fts_rebuild");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert entries
        crate::db::queries::insert_entry(
            &db,
            &create_test_entry("2024-01-01", "Test", "Content here"),
        )
        .unwrap();

        // Clear FTS manually using the proper FTS5 delete-all command
        // (Regular DELETE doesn't work on content-synced FTS5 tables)
        db.conn()
            .execute("INSERT INTO entries_fts(entries_fts) VALUES('delete-all')", [])
            .unwrap();

        // Rebuild index
        rebuild_fts_index(&db).unwrap();

        // Verify FTS works by searching for content we know exists
        // (Can't use SELECT COUNT(*) on content-synced FTS5 tables directly)
        let count: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entries_fts WHERE entries_fts MATCH ?1",
                ["Content"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(count, 1);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_import_empty_list() {
        let db_path = temp_db_path("empty");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let result = import_entries(&db, vec![]).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_merged, 0);
        assert_eq!(result.entries_skipped, 0);

        cleanup_db(&db_path);
    }
}
