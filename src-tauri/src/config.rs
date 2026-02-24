use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalConfig {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct AppConfig {
    diary_dir: Option<String>,
    journals: Option<Vec<JournalConfig>>,
    active_journal_id: Option<String>,
}

/// Generates a random 16-char hex string for use as a journal ID.
pub fn generate_journal_id() -> String {
    use rand::Rng;
    let bytes: [u8; 8] = rand::thread_rng().gen();
    hex::encode(bytes)
}

fn load_config(app_data_dir: &Path) -> AppConfig {
    std::fs::read_to_string(app_data_dir.join(CONFIG_FILE))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(app_data_dir: &Path, config: &AppConfig) -> Result<(), String> {
    let config_path = app_data_dir.join(CONFIG_FILE);
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, json).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

/// Reads the saved diary directory from `{app_data_dir}/config.json`.
/// Returns `None` if the file doesn't exist, is unreadable, or has no `diary_dir` set.
pub fn load_diary_dir(app_data_dir: &Path) -> Option<PathBuf> {
    let config = load_config(app_data_dir);
    config
        .diary_dir
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
}

/// Persists the chosen diary directory to `{app_data_dir}/config.json`.
/// Merges with any existing config keys so future fields are preserved.
pub fn save_diary_dir(app_data_dir: &Path, diary_dir: &Path) -> Result<(), String> {
    let mut config = load_config(app_data_dir);
    config.diary_dir = Some(
        diary_dir
            .to_str()
            .ok_or("Path is not valid UTF-8")?
            .to_string(),
    );
    save_config(app_data_dir, &config)
}

/// Loads the list of configured journals.
///
/// - If `journals` is present in config, returns it as-is.
/// - If `journals` is absent but `diary_dir` exists (legacy), auto-migrates by creating
///   a single journal named "My Journal" and persists the migration.
/// - If neither exists (fresh install), returns an empty vec.
pub fn load_journals(app_data_dir: &Path) -> Vec<JournalConfig> {
    let mut config = load_config(app_data_dir);

    if let Some(journals) = config.journals {
        return journals;
    }

    // Legacy migration: diary_dir set but no journals array
    if let Some(ref dir) = config.diary_dir {
        let path = PathBuf::from(dir);
        if path.is_absolute() {
            let id = generate_journal_id();
            let journal = JournalConfig {
                id: id.clone(),
                name: "My Journal".to_string(),
                path: dir.clone(),
            };
            let journals = vec![journal];
            config.journals = Some(journals.clone());
            config.active_journal_id = Some(id);
            let _ = save_config(app_data_dir, &config);
            return journals;
        }
    }

    Vec::new()
}

/// Persists the full journal list and active journal id.
/// Also updates `diary_dir` to match the active journal's path for downgrade compat.
pub fn save_journals(
    app_data_dir: &Path,
    journals: &[JournalConfig],
    active_id: &str,
) -> Result<(), String> {
    let mut config = load_config(app_data_dir);
    config.journals = Some(journals.to_vec());
    config.active_journal_id = Some(active_id.to_string());

    // Keep diary_dir in sync with active journal for backward compat
    if let Some(active) = journals.iter().find(|j| j.id == active_id) {
        config.diary_dir = Some(active.path.clone());
    }

    save_config(app_data_dir, &config)
}

/// Returns the active journal ID from config, if any.
pub fn load_active_journal_id(app_data_dir: &Path) -> Option<String> {
    load_config(app_data_dir).active_journal_id
}

/// Persists just the active journal ID (convenience for switch_journal).
pub fn save_active_journal_id(app_data_dir: &Path, id: &str) -> Result<(), String> {
    let mut config = load_config(app_data_dir);
    config.active_journal_id = Some(id.to_string());

    // Keep diary_dir in sync
    if let Some(journals) = &config.journals {
        if let Some(active) = journals.iter().find(|j| j.id == id) {
            config.diary_dir = Some(active.path.clone());
        }
    }

    save_config(app_data_dir, &config)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = PathBuf::from(format!("test_config_{}", name));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_load_no_config_returns_none() {
        let dir = temp_dir("no_config");
        // No config.json written
        let result = load_diary_dir(&dir);
        assert!(result.is_none());
        cleanup(&dir);
    }

    #[test]
    fn test_load_empty_diary_dir_returns_none() {
        let dir = temp_dir("empty_dir");
        // Config file exists but diary_dir is null
        fs::write(dir.join(CONFIG_FILE), r#"{"diary_dir": null}"#).unwrap();
        let result = load_diary_dir(&dir);
        assert!(result.is_none());
        cleanup(&dir);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = temp_dir("roundtrip");
        // Use a path derived from temp_dir() so it is absolute on all platforms.
        let diary_dir = std::env::temp_dir().join("mini-diarium-test-diary");
        save_diary_dir(&dir, &diary_dir).unwrap();
        let loaded = load_diary_dir(&dir).expect("Should load saved dir");
        assert_eq!(loaded, diary_dir);
        cleanup(&dir);
    }

    #[test]
    fn test_load_invalid_json_returns_none() {
        let dir = temp_dir("invalid_json");
        fs::write(dir.join(CONFIG_FILE), "not valid json {{{{").unwrap();
        let result = load_diary_dir(&dir);
        assert!(result.is_none());
        cleanup(&dir);
    }

    #[test]
    fn test_save_overwrites_existing_diary_dir() {
        let dir = temp_dir("overwrite");
        let base = std::env::temp_dir();
        let first = base.join("mini-diarium-first");
        let second = base.join("mini-diarium-second");
        save_diary_dir(&dir, &first).unwrap();
        save_diary_dir(&dir, &second).unwrap();
        let loaded = load_diary_dir(&dir).expect("Should load updated dir");
        assert_eq!(loaded, second);
        cleanup(&dir);
    }

    #[test]
    fn test_load_relative_path_rejected() {
        let dir = temp_dir("relative_path");
        fs::write(
            dir.join(CONFIG_FILE),
            r#"{"diary_dir": "../../etc/passwd"}"#,
        )
        .unwrap();
        let result = load_diary_dir(&dir);
        assert!(result.is_none(), "relative path should be rejected");
        cleanup(&dir);
    }

    // ─── Journal tests ───────────────────────────────────────────────────────

    #[test]
    fn test_load_journals_fresh_install_returns_empty() {
        let dir = temp_dir("journals_fresh");
        let journals = load_journals(&dir);
        assert!(journals.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn test_load_journals_legacy_migration() {
        let dir = temp_dir("journals_legacy");
        let diary_path = std::env::temp_dir().join("mini-diarium-legacy-test");
        fs::write(
            dir.join(CONFIG_FILE),
            format!(
                r#"{{"diary_dir": "{}"}}"#,
                diary_path.to_str().unwrap().replace('\\', "\\\\")
            ),
        )
        .unwrap();

        let journals = load_journals(&dir);
        assert_eq!(journals.len(), 1);
        assert_eq!(journals[0].name, "My Journal");
        assert_eq!(journals[0].path, diary_path.to_str().unwrap());
        assert_eq!(journals[0].id.len(), 16); // 8 bytes → 16 hex chars

        // Calling again should return the persisted list (not re-migrate)
        let journals2 = load_journals(&dir);
        assert_eq!(journals2.len(), 1);
        assert_eq!(journals2[0].id, journals[0].id);

        cleanup(&dir);
    }

    #[test]
    fn test_save_and_load_journals_roundtrip() {
        let dir = temp_dir("journals_roundtrip");
        let journals = vec![
            JournalConfig {
                id: "aabbccdd11223344".to_string(),
                name: "Personal".to_string(),
                path: std::env::temp_dir()
                    .join("j1")
                    .to_str()
                    .unwrap()
                    .to_string(),
            },
            JournalConfig {
                id: "eeff00112233aabb".to_string(),
                name: "Work".to_string(),
                path: std::env::temp_dir()
                    .join("j2")
                    .to_str()
                    .unwrap()
                    .to_string(),
            },
        ];
        save_journals(&dir, &journals, "aabbccdd11223344").unwrap();

        let loaded = load_journals(&dir);
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].name, "Personal");
        assert_eq!(loaded[1].name, "Work");

        let active = load_active_journal_id(&dir);
        assert_eq!(active, Some("aabbccdd11223344".to_string()));

        // diary_dir should be synced to active journal
        let diary_dir = load_diary_dir(&dir).unwrap();
        assert_eq!(diary_dir, std::env::temp_dir().join("j1"));

        cleanup(&dir);
    }

    #[test]
    fn test_save_active_journal_id_syncs_diary_dir() {
        let dir = temp_dir("journals_active_sync");
        let journals = vec![
            JournalConfig {
                id: "aaaa".to_string(),
                name: "A".to_string(),
                path: std::env::temp_dir()
                    .join("ja")
                    .to_str()
                    .unwrap()
                    .to_string(),
            },
            JournalConfig {
                id: "bbbb".to_string(),
                name: "B".to_string(),
                path: std::env::temp_dir()
                    .join("jb")
                    .to_str()
                    .unwrap()
                    .to_string(),
            },
        ];
        save_journals(&dir, &journals, "aaaa").unwrap();

        // Switch active to B
        save_active_journal_id(&dir, "bbbb").unwrap();
        let diary_dir = load_diary_dir(&dir).unwrap();
        assert_eq!(diary_dir, std::env::temp_dir().join("jb"));

        cleanup(&dir);
    }

    #[test]
    fn test_generate_journal_id_format() {
        let id = generate_journal_id();
        assert_eq!(id.len(), 16);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
