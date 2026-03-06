use crate::commands::auth::DiaryState;
use crate::db::schema::{DatabaseConnection, SCHEMA_VERSION};
use chrono::Utc;
use log::info;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DebugDumpResult {
    pub file_path: String,
    pub generated_at: String,
}

#[derive(Debug, Serialize)]
struct AuthMethodSummary {
    slot_type: String,
}

#[derive(Debug, Serialize)]
struct DebugDumpContent {
    generated_at: String,
    app_version: String,
    tauri_version: String,
    build_type: String,
    os: String,
    arch: String,
    db_schema_version: i32,
    db_user_version: i32,
    sqlite_version: String,
    db_file_size_bytes: Option<u64>,
    journal_count: usize,
    active_journal_id_prefix: String,
    total_entries: i64,
    total_distinct_days: i64,
    total_words: i64,
    first_entry_date: Option<String>,
    last_entry_date: Option<String>,
    auth_methods: Vec<AuthMethodSummary>,
    backup_count: usize,
    plugin_file_count: usize,
    preferences: serde_json::Value,
    log_capture: String,
}

#[tauri::command]
pub fn generate_debug_dump(
    file_path: String,
    preferences_json: String,
    state: State<DiaryState>,
) -> Result<DebugDumpResult, String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state
        .as_ref()
        .ok_or("Journal must be unlocked to generate a debug dump")?;

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

    let preferences: serde_json::Value =
        serde_json::from_str(&preferences_json).unwrap_or(serde_json::Value::Null);

    let content = build_debug_dump(db, &db_path, &backups_dir, &state.app_data_dir, preferences)?;
    let json = serde_json::to_string_pretty(&content)
        .map_err(|e| format!("Failed to serialize dump: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write dump: {}", e))?;
    info!("Debug dump written to: {}", file_path);

    Ok(DebugDumpResult {
        file_path,
        generated_at: content.generated_at,
    })
}

fn build_debug_dump(
    db: &DatabaseConnection,
    db_path: &std::path::Path,
    backups_dir: &std::path::Path,
    app_data_dir: &std::path::Path,
    preferences: serde_json::Value,
) -> Result<DebugDumpContent, String> {
    let generated_at = Utc::now().to_rfc3339();
    let conn = db.conn();

    let db_user_version: i32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(-1);

    let sqlite_version: String = conn
        .query_row("SELECT sqlite_version()", [], |r| r.get(0))
        .unwrap_or_else(|_| "unknown".to_string());

    let total_entries: i64 = conn
        .query_row("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
        .unwrap_or(0);
    let total_distinct_days: i64 = conn
        .query_row("SELECT COUNT(DISTINCT date) FROM entries", [], |r| r.get(0))
        .unwrap_or(0);
    let total_words: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(word_count), 0) FROM entries",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let first_entry_date: Option<String> = conn
        .query_row("SELECT MIN(date) FROM entries", [], |r| r.get(0))
        .ok()
        .flatten();
    let last_entry_date: Option<String> = conn
        .query_row("SELECT MAX(date) FROM entries", [], |r| r.get(0))
        .ok()
        .flatten();

    let mut stmt = conn
        .prepare("SELECT \"type\" FROM auth_slots ORDER BY id ASC")
        .map_err(|e| format!("Failed to prepare auth_slots query: {}", e))?;
    let auth_methods: Vec<AuthMethodSummary> = stmt
        .query_map([], |row| {
            Ok(AuthMethodSummary {
                slot_type: row.get(0)?,
            })
        })
        .map_err(|e| format!("Failed to query auth slots: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect auth slots: {}", e))?;

    let journals = crate::config::load_journals(app_data_dir);
    let journal_count = journals.len();
    let active_journal_id_prefix = crate::config::load_active_journal_id(app_data_dir)
        .map(|id| id.chars().take(8).collect::<String>())
        .unwrap_or_else(|| "none".to_string());

    let db_file_size_bytes = std::fs::metadata(db_path).ok().map(|m| m.len());

    let backup_count = std::fs::read_dir(backups_dir)
        .map(|entries| entries.count())
        .unwrap_or(0);

    let plugin_file_count = db_path
        .parent()
        .map(|dir| {
            std::fs::read_dir(dir.join("plugins"))
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("rhai"))
                        .count()
                })
                .unwrap_or(0)
        })
        .unwrap_or(0);

    Ok(DebugDumpContent {
        generated_at,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        build_type: if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        }
        .to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        db_schema_version: SCHEMA_VERSION,
        db_user_version,
        sqlite_version,
        db_file_size_bytes,
        journal_count,
        active_journal_id_prefix,
        total_entries,
        total_distinct_days,
        total_words,
        first_entry_date,
        last_entry_date,
        auth_methods,
        backup_count,
        plugin_file_count,
        preferences,
        log_capture: "not available (stdout/stderr only)".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::{insert_entry, DiaryEntry};
    use crate::db::schema::create_database;
    use std::fs;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::path::PathBuf::from(format!("test_debug_{}", name));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_entry(date: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "T".to_string(),
            text: "hello world".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_build_debug_dump_empty_db() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_empty");
        let backups = temp_dir("debug_empty_bk");

        let result =
            build_debug_dump(&db, tmp.path(), &backups, &app_dir, serde_json::Value::Null).unwrap();
        assert_eq!(result.total_entries, 0);
        assert_eq!(result.total_words, 0);
        assert!(result.first_entry_date.is_none());
        assert!(!result.app_version.is_empty());

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_build_debug_dump_with_entries() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        insert_entry(&db, &sample_entry("2024-01-01")).unwrap();
        insert_entry(&db, &sample_entry("2024-01-02")).unwrap();
        let app_dir = temp_dir("debug_entries");
        let backups = temp_dir("debug_entries_bk");

        let result =
            build_debug_dump(&db, tmp.path(), &backups, &app_dir, serde_json::Value::Null).unwrap();
        assert_eq!(result.total_entries, 2);
        assert_eq!(result.total_words, 4);
        assert_eq!(result.first_entry_date, Some("2024-01-01".to_string()));
        assert_eq!(result.last_entry_date, Some("2024-01-02".to_string()));

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_build_debug_dump_writes_file() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_write");
        let backups = temp_dir("debug_write_bk");
        let out = app_dir.join("dump.json");

        let content =
            build_debug_dump(&db, tmp.path(), &backups, &app_dir, serde_json::Value::Null).unwrap();
        let json = serde_json::to_string_pretty(&content).unwrap();
        fs::write(&out, &json).unwrap();

        let written = fs::read_to_string(&out).unwrap();
        assert!(written.contains("app_version"));
        assert!(written.contains("total_entries"));
        assert!(!written.contains("encryption_key"));
        assert!(!written.contains("wrapped_key"));
        // "password" may appear as a slot_type label — ensure no raw key material leaks
        assert!(!written.contains("master_key"));
        assert!(!written.contains("private_key"));

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_build_debug_dump_auth_methods_only_type() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_auth");
        let backups = temp_dir("debug_auth_bk");

        let result =
            build_debug_dump(&db, tmp.path(), &backups, &app_dir, serde_json::Value::Null).unwrap();
        assert_eq!(result.auth_methods.len(), 1);
        assert_eq!(result.auth_methods[0].slot_type, "password");

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }
}
