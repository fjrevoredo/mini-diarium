use crate::commands::auth::DiaryState;
use crate::db::queries;
use crate::export::json;
use tauri::State;

/// Export result containing the number of entries exported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportResult {
    pub entries_exported: usize,
    pub file_path: String,
}

/// Exports all diary entries to a JSON file in Mini Diary-compatible format
///
/// # Arguments
/// * `file_path` - Path where the JSON file will be written
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ExportResult with count of exported entries and the file path
#[tauri::command]
pub fn export_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ExportResult, String> {
    eprintln!("[Export] Starting export to file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to export entries";
        eprintln!("[Export] Error: {}", err);
        err.to_string()
    })?;

    // Get all entry dates
    eprintln!("[Export] Getting all entry dates...");
    let dates = queries::get_all_entry_dates(db)?;
    eprintln!("[Export] Found {} entries to export", dates.len());

    // Fetch and decrypt all entries
    let mut entries = Vec::with_capacity(dates.len());
    for date in &dates {
        if let Some(entry) = queries::get_entry(db, date)? {
            entries.push(entry);
        }
    }

    let entries_exported = entries.len();

    // Convert to JSON
    eprintln!("[Export] Serializing {} entries to JSON...", entries_exported);
    let json_string = json::export_entries_to_json(entries)?;

    // Write to file
    eprintln!("[Export] Writing to file...");
    std::fs::write(&file_path, &json_string).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        eprintln!("[Export] Error: {}", err);
        err
    })?;

    eprintln!(
        "[Export] Success: {} entries exported to {}",
        entries_exported, file_path
    );
    Ok(ExportResult {
        entries_exported,
        file_path,
    })
}

#[cfg(test)]
mod tests {
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_export_{}.db", name)
    }

    fn cleanup(paths: &[&str]) {
        for path in paths {
            let _ = fs::remove_file(path);
        }
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
    fn test_export_json_writes_file() {
        let db_path = temp_db_path("writes_file");
        let export_path = "test_export_output.json";
        cleanup(&[&db_path, export_path]);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert entries
        crate::db::queries::insert_entry(
            &db,
            &create_test_entry("2024-01-01", "Entry 1", "Content one"),
        )
        .unwrap();
        crate::db::queries::insert_entry(
            &db,
            &create_test_entry("2024-01-02", "Entry 2", "Content two"),
        )
        .unwrap();

        // Export using the pure function (can't use Tauri State in unit tests)
        let dates = crate::db::queries::get_all_entry_dates(&db).unwrap();
        let mut entries = Vec::new();
        for date in &dates {
            if let Some(entry) = crate::db::queries::get_entry(&db, date).unwrap() {
                entries.push(entry);
            }
        }

        let json_string = crate::export::json::export_entries_to_json(entries).unwrap();
        fs::write(export_path, &json_string).unwrap();

        // Verify file exists and contains valid JSON
        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["entries"].as_object().unwrap().len(), 2);
        assert_eq!(parsed["entries"]["2024-01-01"]["title"], "Entry 1");
        assert_eq!(parsed["entries"]["2024-01-02"]["title"], "Entry 2");

        cleanup(&[&db_path, export_path]);
    }

    #[test]
    fn test_export_empty_diary() {
        let db_path = temp_db_path("empty");
        let export_path = "test_export_empty_output.json";
        cleanup(&[&db_path, export_path]);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Export empty diary
        let dates = crate::db::queries::get_all_entry_dates(&db).unwrap();
        assert_eq!(dates.len(), 0);

        let entries = Vec::new();
        let json_string = crate::export::json::export_entries_to_json(entries).unwrap();
        fs::write(export_path, &json_string).unwrap();

        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["entries"].as_object().unwrap().len(), 0);

        cleanup(&[&db_path, export_path]);
    }
}
