use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalConfig {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_key: Option<String>, // hex-encoded 32-byte random key; None for password journals
    #[serde(skip_serializing_if = "Option::is_none")]
    pub db_filename: Option<String>, // e.g. "diary.db"; defaults to "diary.db" when absent
    // TODO: deprecated — migrated to db_settings (v6). Keep for the migration window in unlock_diary.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub require_all_auth: Option<bool>,
}

/// Frontend-facing DTO — safe to send over IPC (raw key never included)
#[derive(Debug, Clone, Serialize)]
pub struct JournalInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub auto_protected: bool, // true if auto_key is set; key itself is never sent
    pub require_all_auth: bool,
    pub db_filename: String, // always populated, defaults to "diary.db" when absent in config
}

impl From<&JournalConfig> for JournalInfo {
    fn from(j: &JournalConfig) -> Self {
        JournalInfo {
            id: j.id.clone(),
            name: j.name.clone(),
            path: j.path.clone(),
            auto_protected: j.auto_key.is_some(),
            require_all_auth: j.require_all_auth.unwrap_or(false),
            db_filename: j
                .db_filename
                .clone()
                .unwrap_or_else(|| "diary.db".to_string()),
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct AppConfig {
    diary_dir: Option<String>,
    journals: Option<Vec<JournalConfig>>,
    active_journal_id: Option<String>,
}

/// Generates a random 16-char hex string for use as a journal ID.
pub fn generate_journal_id() -> String {
    let bytes: [u8; 8] = rand::random();
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
                auto_key: None,
                db_filename: None,
                require_all_auth: None,
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

/// The folder a brand-new journal should be created in when the user has not picked one.
///
/// Exists so Flatpak's dialog-free create form always has a known-good starting point without
/// ever touching a folder chooser. On Flatpak the chooser opens the XDG document portal for
/// anything outside the sandbox, and the `/run/user/*/doc/` handle it hands back is per-grant:
/// stored as a journal's permanent location it stops resolving later. Everywhere else this is
/// only the pre-filled `defaultPath` of a native save dialog the user still sees and can
/// redirect; `add_journal` separately refuses portal handles regardless of how a path arrived.
///
/// `documents_dir` is a parameter rather than being resolved here so this stays pure and
/// directly testable — the caller supplies the platform lookup.
pub fn default_journal_dir(app_data_dir: &Path, documents_dir: Option<&Path>) -> PathBuf {
    match documents_dir {
        Some(docs) => docs.join("Mini Diarium"),
        None => app_data_dir.join("journals"),
    }
}

/// Longest journal database filename accepted, in UTF-8 bytes.
///
/// File systems cap one name at 255 units: bytes on ext4 and APFS, UTF-16 code units on NTFS.
/// A name's UTF-8 length is never smaller than its UTF-16 length, so a byte cap holds on
/// every platform. The database also gets sibling files named after it — SQLite's
/// `-journal`/`-wal`/`-shm`, the restore stage `.restoring.tmp`, the directory-move stage
/// `.staging` — so the cap leaves room for the longest of those suffixes, with a margin.
const MAX_DB_FILENAME_BYTES: usize = 200;

/// Windows device names. A path component matching one of these — with or without an
/// extension — cannot be created on Windows at all.
const RESERVED_DEVICE_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// The error `validate_db_filename` returns. It must not start with `"Failed to"`: the
/// frontend maps that prefix to a filesystem-permissions message.
const ERR_INVALID_DB_FILENAME: &str = "Invalid journal filename";

/// Checks that `name` is usable as a journal's database filename, without changing it.
///
/// The filename comes from a native file dialog or from the Flatpak create form's free-text
/// Filename field. The picker checks the exact path it will register, so this only accepts or
/// refuses: a rewritten name would register a different file than the one the user picked.
///
/// Refused everywhere: an empty name, `.` and `..`, the separators `/` and `\` (either would
/// escape the chosen folder on some platform, and a config.json may move between platforms),
/// control characters, and names longer than [`MAX_DB_FILENAME_BYTES`] UTF-8 bytes. Refused on
/// Windows only, where the filesystem cannot hold them: the reserved characters
/// `< > : " | ? *`, trailing dots and spaces (Windows drops them, so `"Work."` and `"Work"`
/// would be one file), and the device names (`CON`, `NUL`, `COM1`…). These are legal names on
/// Linux and macOS, so a file the user picked there is not refused.
///
/// The rules are this host's, so a `config.json` written on another OS is checked again when
/// it is used — see [`journal_db_paths`].
pub fn validate_db_filename(name: &str) -> Result<(), String> {
    if is_valid_db_filename(name, cfg!(windows)) {
        Ok(())
    } else {
        Err(ERR_INVALID_DB_FILENAME.to_string())
    }
}

/// The rules behind [`validate_db_filename`], with the Windows set as a parameter so tests
/// cover both rule sets on every platform.
fn is_valid_db_filename(name: &str, windows_rules: bool) -> bool {
    if name.is_empty() || name == "." || name == ".." {
        return false;
    }
    if name.len() > MAX_DB_FILENAME_BYTES {
        return false;
    }
    if name
        .chars()
        .any(|ch| ch == '/' || ch == '\\' || ch.is_control())
    {
        return false;
    }
    if !windows_rules {
        return true;
    }

    if name
        .chars()
        .any(|ch| matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
    {
        return false;
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return false;
    }
    let stem = name.split('.').next().unwrap_or(name);
    !RESERVED_DEVICE_NAMES
        .iter()
        .any(|reserved| stem.eq_ignore_ascii_case(reserved))
}

/// The database path and backups folder of a journal stored in `dir` as `db_filename`
/// (`None` means `diary.db`).
///
/// Every live database path built from saved config goes through here. `config.json` can be
/// copied from another OS, where a name such as `..\other.db` or `C:x.db` is one ordinary
/// component; joined on this host it would leave `dir`. So the filename is checked with this
/// host's [`validate_db_filename`] rules and refused, never rewritten or redirected.
pub fn journal_db_paths(
    dir: &Path,
    db_filename: Option<&str>,
) -> Result<(PathBuf, PathBuf), String> {
    let db_filename = db_filename.unwrap_or("diary.db");
    validate_db_filename(db_filename)?;
    let stem = Path::new(db_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("diary");
    Ok((dir.join(db_filename), dir.join("backups").join(stem)))
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

/// Saves the auto_key hex for a specific journal. Pass `None` to clear it.
pub fn save_journal_auto_key(
    app_data_dir: &Path,
    journal_id: &str,
    auto_key_hex: Option<&str>,
) -> Result<(), String> {
    let mut config = load_config(app_data_dir);
    if let Some(journals) = config.journals.as_mut() {
        if let Some(j) = journals.iter_mut().find(|j| j.id == journal_id) {
            j.auto_key = auto_key_hex.map(|s| s.to_string());
        }
    }
    save_config(app_data_dir, &config)
}

/// Sets or clears the `require_all_auth` flag for a specific journal.
/// Pass `enabled = true` to require all auth methods; `false` clears the flag.
pub fn set_journal_require_all_auth(
    app_data_dir: &Path,
    journal_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let mut config = load_config(app_data_dir);
    if let Some(journals) = config.journals.as_mut() {
        if let Some(j) = journals.iter_mut().find(|j| j.id == journal_id) {
            j.require_all_auth = if enabled { Some(true) } else { None };
        }
    }
    save_config(app_data_dir, &config)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests;
