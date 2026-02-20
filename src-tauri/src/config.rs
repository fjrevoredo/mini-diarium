use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Default, Serialize, Deserialize)]
struct AppConfig {
    diary_dir: Option<String>,
}

/// Reads the saved diary directory from `{app_data_dir}/config.json`.
/// Returns `None` if the file doesn't exist, is unreadable, or has no `diary_dir` set.
pub fn load_diary_dir(app_data_dir: &Path) -> Option<PathBuf> {
    let content = std::fs::read_to_string(app_data_dir.join(CONFIG_FILE)).ok()?;
    let config: AppConfig = serde_json::from_str(&content).ok()?;
    config.diary_dir.map(PathBuf::from)
}

/// Persists the chosen diary directory to `{app_data_dir}/config.json`.
/// Merges with any existing config keys so future fields are preserved.
pub fn save_diary_dir(app_data_dir: &Path, diary_dir: &Path) -> Result<(), String> {
    let config_path = app_data_dir.join(CONFIG_FILE);
    let mut config: AppConfig = std::fs::read_to_string(&config_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    config.diary_dir = Some(
        diary_dir
            .to_str()
            .ok_or("Path is not valid UTF-8")?
            .to_string(),
    );
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, json).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
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
        let diary_dir = PathBuf::from("/some/path/to/diary");
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
        let first = PathBuf::from("/first/path");
        let second = PathBuf::from("/second/path");
        save_diary_dir(&dir, &first).unwrap();
        save_diary_dir(&dir, &second).unwrap();
        let loaded = load_diary_dir(&dir).expect("Should load updated dir");
        assert_eq!(loaded, second);
        cleanup(&dir);
    }
}
