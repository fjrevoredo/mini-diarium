//! Support diagnostics: a single JSON file describing the app, the active journal's
//! shape, and the recent log records — with an explicit boundary on what it never holds.
//!
//! # What this file must never contain
//!
//! Passwords, encryption keys, the `auto_key` wrapper, decrypted entry content, entry
//! titles, tag names, auth-slot labels, journal names, or **any filesystem path**. That
//! boundary is enforced by [`tests::test_build_debug_dump_leaks_nothing_sensitive`], not
//! by convention — add a field and the test decides whether it may stay.
//!
//! Three consequences shape the code below:
//!
//! - Journals are summarised through a dedicated [`JournalSummary`]. Neither
//!   `JournalConfig` (carries `auto_key`) nor `JournalInfo` (carries `path` and the
//!   user-chosen `name`) may be serialised into the dump.
//! - Auth slots report type and timestamps only — never `label` or `public_key_hex`.
//! - Log records arrive already redacted from [`crate::log_capture`], and the UI records
//!   the frontend supplies get the same treatment on the way in.

use crate::commands::auth::DiaryState;
use crate::db::{self, ContentCounts, DatabaseConnection, SCHEMA_VERSION};
use crate::log_capture::{self, CapturedRecord};
use crate::plugin::PluginRegistry;
use crate::spellcheck::SpellcheckStatus;
use crate::sync_detect;
use chrono::Utc;
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DebugDumpResult {
    pub file_path: String,
    pub generated_at: String,
}

/// The browser-side half of the dump, supplied by `src/lib/debug-dump-payload.ts`.
///
/// `#[serde(default)]` on every field keeps the historical resilience of
/// `unwrap_or(Value::Null)` — a missing or malformed key degrades to `null` rather than
/// discarding the whole envelope. The JS envelope is camelCase.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientState {
    pub preferences: Value,
    pub theme_preference: Value,
    pub theme_overrides: Value,
    pub feature_flags: Value,
    pub recent_ui_logs: Value,
}

#[derive(Debug, Serialize)]
struct AuthMethodSummary {
    slot_type: String,
    created_at: String,
    last_used: Option<String>,
}

/// Per-journal facts that carry no path, no name, and no key material.
#[derive(Debug, Serialize)]
struct JournalSummary {
    id_prefix: String,
    auto_protected: bool,
    db_filename_is_default: bool,
}

/// A registered import/export plugin.
///
/// `id` is the only user-influenced string in the dump: for a Rhai user plugin it is
/// derived from the script filename. A broken user plugin is a likely bug source and a
/// deliberately installed script filename is not journal content, so it earns its place.
/// The `// @name` header is user-authored prose and is deliberately omitted.
#[derive(Debug, Serialize)]
struct PluginSummary {
    id: String,
    kind: &'static str,
    builtin: bool,
}

#[derive(Debug, Serialize)]
struct DebugDumpContent {
    generated_at: String,
    app_version: String,
    tauri_version: String,
    build_type: String,
    os: String,
    os_version: String,
    arch: String,
    webview_version: Option<String>,
    /// The version actually stored in this database.
    db_schema_version: i32,
    /// The version this build expects. A mismatch is a failed or pending migration.
    app_expected_schema_version: i32,
    sqlite_version: String,
    db_file_size_bytes: Option<u64>,
    journal_count: usize,
    active_journal_id_prefix: String,
    journals: Vec<JournalSummary>,
    active_journal_require_all_auth: bool,
    /// Whether the **active** journal still carries the deprecated `config.json` copy of
    /// the flag above — i.e. whether the TODO-0038 migration to `db_settings` has run.
    legacy_require_all_auth_in_config: bool,
    active_journal_in_synced_dir: bool,
    detected_sync_tool: Option<&'static str>,
    total_entries: i64,
    total_distinct_days: i64,
    total_words: i64,
    first_entry_date: Option<String>,
    last_entry_date: Option<String>,
    content_counts: ContentCounts,
    auth_methods: Vec<AuthMethodSummary>,
    backup_count: usize,
    backup_max: usize,
    oldest_backup: Option<String>,
    newest_backup: Option<String>,
    backups_total_bytes: u64,
    plugin_file_count: usize,
    plugins: Vec<PluginSummary>,
    /// `None` on Windows and macOS, which delegate spell checking to the OS.
    spellcheck: Option<SpellcheckStatus>,
    preferences: Value,
    theme_preference: Value,
    theme_overrides: Value,
    feature_flags: Value,
    recent_logs: Vec<CapturedRecord>,
    recent_ui_logs: Value,
}

#[tauri::command]
pub fn generate_debug_dump(
    file_path: String,
    client_state_json: String,
    state: State<DiaryState>,
    registry: State<Mutex<PluginRegistry>>,
) -> Result<DebugDumpResult, String> {
    // Registry before DB. `run_import_plugin`/`run_export_plugin` are careful never to
    // hold both at once, so no ordering is established by precedent — but this command
    // does hold both, so it fixes one: registry is the outer lock. Taking the DB first
    // here would be the inversion half of a deadlock the moment any future command holds
    // the registry across a DB access.
    let registry = registry
        .lock()
        .map_err(|_| "Plugin registry lock poisoned".to_string())?;

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

    let client: ClientState = serde_json::from_str(&client_state_json).unwrap_or_default();

    let content = build_debug_dump(
        db,
        &db_path,
        &backups_dir,
        &state.app_data_dir,
        &registry,
        client,
    )?;
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
    db_path: &Path,
    backups_dir: &Path,
    app_data_dir: &Path,
    registry: &PluginRegistry,
    client: ClientState,
) -> Result<DebugDumpContent, String> {
    let generated_at = Utc::now().to_rfc3339();

    let (_user_version, sqlite_version) = db::read_engine_versions(db);

    // Derive entry stats from the plaintext (date, word_count) columns — no decryption.
    // Rows are ordered by date ASC, so first/last give the date range and consecutive
    // dedup gives the distinct-day count.
    let date_word_counts = db::get_entry_date_word_counts(db)?;
    let total_entries = date_word_counts.len() as i64;
    let total_words: i64 = date_word_counts.iter().map(|(_, w)| *w as i64).sum();
    let mut distinct_dates: Vec<&str> = date_word_counts.iter().map(|(d, _)| d.as_str()).collect();
    distinct_dates.dedup();
    let total_distinct_days = distinct_dates.len() as i64;
    let first_entry_date = date_word_counts.first().map(|(d, _)| d.clone());
    let last_entry_date = date_word_counts.last().map(|(d, _)| d.clone());

    // Type and timestamps only — the slot label is user-supplied and the public key is
    // identifying, so neither leaves the backend.
    let auth_methods: Vec<AuthMethodSummary> = db::list_auth_slots(db)?
        .into_iter()
        .map(|m| AuthMethodSummary {
            slot_type: m.slot_type,
            created_at: m.created_at,
            last_used: m.last_used,
        })
        .collect();

    let journal_configs = crate::config::load_journals(app_data_dir);
    let journal_count = journal_configs.len();
    let active_journal_id = crate::config::load_active_journal_id(app_data_dir);
    let active_journal_id_prefix = active_journal_id
        .as_ref()
        .map(|id| id.chars().take(8).collect::<String>())
        .unwrap_or_else(|| "none".to_string());

    let journals: Vec<JournalSummary> = journal_configs
        .iter()
        .map(|j| JournalSummary {
            id_prefix: j.id.chars().take(8).collect(),
            auto_protected: j.auto_key.is_some(),
            // Absent means the default. Written as a match rather than `is_none_or`,
            // which is newer than this workspace's MSRV.
            db_filename_is_default: match j.db_filename.as_deref() {
                Some(name) => name.eq_ignore_ascii_case("diary.db"),
                None => true,
            },
        })
        .collect();

    // The MAC-verified database truth, not the config field. The config field is reported
    // separately so a stalled TODO-0038 migration is visible.
    let active_journal_require_all_auth = db::verify_require_all_auth(db);
    let legacy_require_all_auth_in_config = active_journal_id
        .as_ref()
        .and_then(|id| journal_configs.iter().find(|j| j.id == *id))
        .is_some_and(|j| j.require_all_auth.is_some());

    let detected_sync_tool = db_path.parent().and_then(sync_detect::detect_sync_tool);

    let db_file_size_bytes = std::fs::metadata(db_path).ok().map(|m| m.len());
    let backups = read_backup_stats(backups_dir);

    // `{app_data_dir}/plugins` — the central location `lib.rs` actually loads from. This
    // used to read `{journal_dir}/plugins`, the pre-migration per-journal location, so a
    // user with scripts installed normally saw `plugin_file_count: 0` next to their
    // plugin in `plugins[]`.
    let plugin_file_count = std::fs::read_dir(app_data_dir.join("plugins"))
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("rhai"))
                .count()
        })
        .unwrap_or(0);

    // `PluginInfo` has no `kind` field — it comes from which list the entry was in.
    let plugins: Vec<PluginSummary> = registry
        .list_importers()
        .into_iter()
        .map(|p| PluginSummary {
            id: p.id,
            kind: "import",
            builtin: p.builtin,
        })
        .chain(
            registry
                .list_exporters()
                .into_iter()
                .map(|p| PluginSummary {
                    id: p.id,
                    kind: "export",
                    builtin: p.builtin,
                }),
        )
        .collect();

    let ui_language = client
        .preferences
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("en");
    let spellcheck = crate::spellcheck::status(
        ui_language,
        crate::commands::spellcheck::system_locale().as_deref(),
    );

    let os = os_info::get();
    let os_version = match os.edition() {
        Some(edition) => format!("{} {}", edition, os.version()),
        None => os.version().to_string(),
    };

    // Second redaction pass: the frontend buffer is length-capped but not path-aware, and
    // a Tauri error string surfaced into a UI log can carry an absolute path.
    let mut recent_ui_logs = client.recent_ui_logs;
    redact_json_strings(&mut recent_ui_logs);

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
        os_version,
        arch: std::env::consts::ARCH.to_string(),
        webview_version: tauri::webview_version().ok(),
        db_schema_version: db::read_schema_version(db)?,
        app_expected_schema_version: SCHEMA_VERSION,
        sqlite_version,
        db_file_size_bytes,
        journal_count,
        active_journal_id_prefix,
        journals,
        active_journal_require_all_auth,
        legacy_require_all_auth_in_config,
        active_journal_in_synced_dir: detected_sync_tool.is_some(),
        detected_sync_tool,
        total_entries,
        total_distinct_days,
        total_words,
        first_entry_date,
        last_entry_date,
        content_counts: db::read_content_counts(db)?,
        auth_methods,
        backup_count: backups.count,
        backup_max: crate::backup::MAX_BACKUPS,
        oldest_backup: backups.oldest,
        newest_backup: backups.newest,
        backups_total_bytes: backups.total_bytes,
        plugin_file_count,
        plugins,
        spellcheck,
        preferences: client.preferences,
        theme_preference: client.theme_preference,
        theme_overrides: client.theme_overrides,
        feature_flags: client.feature_flags,
        recent_logs: log_capture::snapshot(),
        recent_ui_logs,
    })
}

#[derive(Debug, Default)]
struct BackupStats {
    count: usize,
    oldest: Option<String>,
    newest: Option<String>,
    total_bytes: u64,
}

/// Counts and measures the rotated backups in `backups_dir`.
///
/// Matches `backup-*.db` exactly as `rotate_backups` does — counting every directory
/// entry is what previously reported 50 backups against a `MAX_BACKUPS` of 30. The
/// filenames are `backup-YYYY-MM-DD-HHhMM.db`, whose lexicographic order is chronological
/// (the property rotation itself relies on), so sorting gives the real oldest/newest.
/// Those stamps are non-sensitive by construction — they contain no user-chosen text.
fn read_backup_stats(backups_dir: &Path) -> BackupStats {
    let Ok(entries) = std::fs::read_dir(backups_dir) else {
        return BackupStats::default();
    };

    let mut names: Vec<String> = Vec::new();
    let mut total_bytes: u64 = 0;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !(name.starts_with("backup-") && name.ends_with(".db")) {
            continue;
        }
        total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
        names.push(name.to_string());
    }

    names.sort();
    BackupStats {
        count: names.len(),
        oldest: names.first().cloned(),
        newest: names.last().cloned(),
        total_bytes,
    }
}

/// Applies [`log_capture::redact`] to every string in a JSON tree, in place.
fn redact_json_strings(value: &mut Value) {
    match value {
        Value::String(text) => *text = log_capture::redact(text),
        Value::Array(items) => items.iter_mut().for_each(redact_json_strings),
        Value::Object(fields) => fields.values_mut().for_each(redact_json_strings),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_database, insert_entry, DiaryEntry};
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
            metadata: None,
            locked: false,
        }
    }

    fn empty_registry() -> PluginRegistry {
        PluginRegistry::new()
    }

    fn dump(
        db: &DatabaseConnection,
        db_path: &Path,
        backups: &Path,
        app_dir: &Path,
    ) -> DebugDumpContent {
        build_debug_dump(
            db,
            db_path,
            backups,
            app_dir,
            &empty_registry(),
            ClientState::default(),
        )
        .unwrap()
    }

    #[test]
    fn test_build_debug_dump_empty_db() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_empty");
        let backups = temp_dir("debug_empty_bk");

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.total_entries, 0);
        assert_eq!(result.total_words, 0);
        assert!(result.first_entry_date.is_none());
        assert!(!result.app_version.is_empty());
        assert!(!result.os_version.is_empty());
        assert_eq!(result.content_counts.tags, 0);
        assert_eq!(result.content_counts.images, 0);

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_build_debug_dump_with_entries() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        insert_entry(&db, &sample_entry("2024-01-01")).unwrap();
        let locked_id = insert_entry(&db, &sample_entry("2024-01-02")).unwrap();
        crate::db::set_entry_locked(&db, locked_id, true).unwrap();
        crate::db::create_tag(&db, "travel").unwrap();
        let app_dir = temp_dir("debug_entries");
        let backups = temp_dir("debug_entries_bk");

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.total_entries, 2);
        assert_eq!(result.total_words, 4);
        assert_eq!(result.first_entry_date, Some("2024-01-01".to_string()));
        assert_eq!(result.last_entry_date, Some("2024-01-02".to_string()));
        assert_eq!(result.content_counts.locked_entries, 1);
        assert_eq!(result.content_counts.tags, 1);
        // Counts only — the tag's name must not travel with them.
        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("travel"));

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

        let content = dump(&db, tmp.path(), &backups, &app_dir);
        let json = serde_json::to_string_pretty(&content).unwrap();
        fs::write(&out, &json).unwrap();

        let written = fs::read_to_string(&out).unwrap();
        assert!(written.contains("app_version"));
        assert!(written.contains("total_entries"));
        assert!(written.contains("content_counts"));
        assert!(written.contains("recent_logs"));

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_build_debug_dump_auth_methods_carry_no_label() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_auth");
        let backups = temp_dir("debug_auth_bk");

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.auth_methods.len(), 1);
        assert_eq!(result.auth_methods[0].slot_type, "password");
        assert!(!result.auth_methods[0].created_at.is_empty());

        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("\"label\""));
        assert!(!json.contains("public_key_hex"));

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    /// The dump's privacy boundary, as an executable assertion. If a new field makes this
    /// fail, the field is wrong — not the test.
    #[test]
    fn test_build_debug_dump_leaks_nothing_sensitive() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_leaks");
        let backups = temp_dir("debug_leaks_bk");

        // A journal with a name, a path, and an auto_key wrapper — every string the dump
        // must refuse to carry.
        let journal_dir = temp_dir("debug_leaks_journal");
        let journals = vec![crate::config::JournalConfig {
            id: "abcdef0123456789".to_string(),
            name: "Franciscos Secret Diary".to_string(),
            path: journal_dir.canonicalize().unwrap().display().to_string(),
            auto_key: Some("deadbeef".repeat(8)),
            db_filename: None,
            require_all_auth: Some(true),
        }];
        crate::config::save_journals(&app_dir, &journals, "abcdef0123456789").unwrap();

        insert_entry(&db, &sample_entry("2024-01-01")).unwrap();
        crate::db::create_tag(&db, "psychotherapy").unwrap();

        let content = dump(&db, tmp.path(), &backups, &app_dir);
        let json = serde_json::to_string_pretty(&content).unwrap();

        // Key material.
        for needle in [
            "encryption_key",
            "wrapped_key",
            "master_key",
            "private_key",
            "auto_key",
            "deadbeef",
        ] {
            assert!(!json.contains(needle), "dump leaked {}", needle);
        }
        // User-chosen strings.
        for needle in ["Franciscos Secret Diary", "psychotherapy", "hello world"] {
            assert!(!json.contains(needle), "dump leaked {}", needle);
        }
        // Filesystem paths, in any of the three shapes redaction recognises.
        for needle in ["Users\\", "/home/", "/Users/"] {
            assert!(!json.contains(needle), "dump leaked path shape {}", needle);
        }
        // The active journal id is truncated to a prefix.
        assert!(!json.contains("abcdef0123456789"));
        assert!(json.contains("abcdef01"));
        // …but the migration state it implies is still reported.
        assert!(content.legacy_require_all_auth_in_config);

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
        fs::remove_dir_all(&journal_dir).unwrap();
    }

    #[test]
    fn test_schema_version_reports_the_database_not_the_constant() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_schema");
        let backups = temp_dir("debug_schema_bk");

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.db_schema_version, SCHEMA_VERSION);
        assert_eq!(result.app_expected_schema_version, SCHEMA_VERSION);

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_backup_stats_ignore_non_backup_files() {
        let backups = temp_dir("debug_backup_stats");
        fs::write(backups.join("backup-2024-01-02-12h00.db"), "bb").unwrap();
        fs::write(backups.join("backup-2024-01-01-12h00.db"), "a").unwrap();
        // None of these is a rotated backup, and none may be counted — including the
        // directory, which matches the name pattern but is not a file.
        fs::write(backups.join("readme.txt"), "ignored").unwrap();
        fs::write(backups.join("diary.db"), "ignored").unwrap();
        fs::create_dir_all(backups.join("backup-2024-01-03-12h00.db")).unwrap();

        let stats = read_backup_stats(&backups);
        assert_eq!(stats.count, 2);
        assert_eq!(stats.oldest, Some("backup-2024-01-01-12h00.db".to_string()));
        assert_eq!(stats.newest, Some("backup-2024-01-02-12h00.db".to_string()));
        assert_eq!(stats.total_bytes, 3);

        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_journal_summary_flags_a_non_default_db_filename() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_dbname");
        let backups = temp_dir("debug_dbname_bk");

        let journals = vec![
            crate::config::JournalConfig {
                id: "1111111111111111".to_string(),
                name: "Default".to_string(),
                path: app_dir.display().to_string(),
                auto_key: None,
                db_filename: None,
                require_all_auth: None,
            },
            crate::config::JournalConfig {
                id: "2222222222222222".to_string(),
                name: "Renamed".to_string(),
                path: app_dir.display().to_string(),
                auto_key: None,
                db_filename: Some("work.db".to_string()),
                require_all_auth: None,
            },
        ];
        crate::config::save_journals(&app_dir, &journals, "1111111111111111").unwrap();

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.journal_count, 2);
        assert!(result.journals[0].db_filename_is_default);
        assert!(!result.journals[1].db_filename_is_default);
        // Ids are truncated to a prefix even for the non-active journals.
        assert_eq!(result.journals[1].id_prefix, "22222222");

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_plugin_file_count_reads_the_central_plugins_dir() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_pluginfiles");
        let backups = temp_dir("debug_pluginfiles_bk");

        // The central location `lib.rs` loads from, not the journal directory.
        let plugins = app_dir.join("plugins");
        fs::create_dir_all(&plugins).unwrap();
        fs::write(plugins.join("my-format.rhai"), "// @name Mine").unwrap();
        fs::write(plugins.join("other.rhai"), "// @name Other").unwrap();
        fs::write(plugins.join("notes.txt"), "not a plugin").unwrap();

        let result = dump(&db, tmp.path(), &backups, &app_dir);
        assert_eq!(result.plugin_file_count, 2);

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_backup_stats_on_missing_directory() {
        let stats = read_backup_stats(Path::new("test_debug_no_such_backups_dir"));
        assert_eq!(stats.count, 0);
        assert!(stats.oldest.is_none());
        assert_eq!(stats.total_bytes, 0);
    }

    #[test]
    fn test_client_state_survives_a_malformed_envelope() {
        // A broken envelope must degrade field-by-field, not discard the whole payload.
        let client: ClientState = serde_json::from_str(r#"{"preferences":{"language":"de"}}"#)
            .expect("partial envelope parses");
        assert_eq!(client.preferences["language"], "de");
        assert!(client.theme_preference.is_null());
        assert!(client.recent_ui_logs.is_null());
    }

    #[test]
    fn test_client_state_is_forwarded_and_ui_logs_redacted() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_client");
        let backups = temp_dir("debug_client_bk");

        let client: ClientState = serde_json::from_value(serde_json::json!({
            "preferences": { "language": "de" },
            "themePreference": "dark",
            "themeOverrides": { "--bg": "#000" },
            "featureFlags": { "someFlag": true },
            "recentUiLogs": [
                { "level": "error", "message": "failed to read /home/md_test_u/diary.db" }
            ],
        }))
        .unwrap();

        let result = build_debug_dump(
            &db,
            tmp.path(),
            &backups,
            &app_dir,
            &empty_registry(),
            client,
        )
        .unwrap();

        assert_eq!(result.theme_preference, "dark");
        assert_eq!(result.theme_overrides["--bg"], "#000");
        assert_eq!(result.feature_flags["someFlag"], true);
        assert_eq!(result.recent_ui_logs[0]["message"], "failed to read <path>");

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }

    #[test]
    fn test_plugins_report_kind_from_their_list() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let app_dir = temp_dir("debug_plugins");
        let backups = temp_dir("debug_plugins_bk");

        let mut registry = PluginRegistry::new();
        crate::plugin::register_all(&mut registry);
        let result = build_debug_dump(
            &db,
            tmp.path(),
            &backups,
            &app_dir,
            &registry,
            ClientState::default(),
        )
        .unwrap();

        assert!(!result.plugins.is_empty());
        assert!(result.plugins.iter().any(|p| p.kind == "import"));
        assert!(result.plugins.iter().any(|p| p.kind == "export"));
        assert!(result.plugins.iter().all(|p| p.builtin));

        fs::remove_dir_all(&app_dir).unwrap();
        fs::remove_dir_all(&backups).unwrap();
    }
}
