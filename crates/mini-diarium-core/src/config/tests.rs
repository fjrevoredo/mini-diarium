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
            auto_key: None,
            db_filename: None,
            require_all_auth: None,
        },
        JournalConfig {
            id: "eeff00112233aabb".to_string(),
            name: "Work".to_string(),
            path: std::env::temp_dir()
                .join("j2")
                .to_str()
                .unwrap()
                .to_string(),
            auto_key: None,
            db_filename: None,
            require_all_auth: None,
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
            auto_key: None,
            db_filename: None,
            require_all_auth: None,
        },
        JournalConfig {
            id: "bbbb".to_string(),
            name: "B".to_string(),
            path: std::env::temp_dir()
                .join("jb")
                .to_str()
                .unwrap()
                .to_string(),
            auto_key: None,
            db_filename: None,
            require_all_auth: None,
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

#[test]
fn test_save_journal_auto_key_roundtrip() {
    let dir = temp_dir("auto_key_roundtrip");
    let journals = vec![JournalConfig {
        id: "testid1234567890".to_string(),
        name: "Auto Journal".to_string(),
        path: std::env::temp_dir()
            .join("aj")
            .to_str()
            .unwrap()
            .to_string(),
        auto_key: None,
        db_filename: None,
        require_all_auth: None,
    }];
    save_journals(&dir, &journals, "testid1234567890").unwrap();

    save_journal_auto_key(&dir, "testid1234567890", Some("deadbeef")).unwrap();
    let loaded = load_journals(&dir);
    assert_eq!(loaded[0].auto_key.as_deref(), Some("deadbeef"));

    cleanup(&dir);
}

#[test]
fn test_set_journal_require_all_auth_roundtrip() {
    let dir = temp_dir("require_all_auth_rt");
    let journals = vec![JournalConfig {
        id: "testid1234567890".to_string(),
        name: "Test Journal".to_string(),
        path: std::env::temp_dir()
            .join("raj")
            .to_str()
            .unwrap()
            .to_string(),
        auto_key: None,
        db_filename: None,
        require_all_auth: None,
    }];
    save_journals(&dir, &journals, "testid1234567890").unwrap();

    // Enable require_all_auth
    set_journal_require_all_auth(&dir, "testid1234567890", true).unwrap();
    let loaded = load_journals(&dir);
    assert_eq!(loaded[0].require_all_auth, Some(true));

    // Disable (clears to None, which omits from JSON)
    set_journal_require_all_auth(&dir, "testid1234567890", false).unwrap();
    let loaded2 = load_journals(&dir);
    assert!(loaded2[0].require_all_auth.is_none());

    cleanup(&dir);
}

#[test]
fn test_save_journal_auto_key_clear() {
    let dir = temp_dir("auto_key_clear");
    let journals = vec![JournalConfig {
        id: "testid1234567890".to_string(),
        name: "Auto Journal".to_string(),
        path: std::env::temp_dir()
            .join("aj2")
            .to_str()
            .unwrap()
            .to_string(),
        auto_key: Some("deadbeef".to_string()),
        db_filename: None,
        require_all_auth: None,
    }];
    save_journals(&dir, &journals, "testid1234567890").unwrap();

    save_journal_auto_key(&dir, "testid1234567890", None).unwrap();
    let loaded = load_journals(&dir);
    assert!(loaded[0].auto_key.is_none());

    cleanup(&dir);
}

#[test]
fn test_default_journal_dir_prefers_documents() {
    let app_data = PathBuf::from("/app-data");
    let documents = PathBuf::from("/home/jon/Documents");

    let dir = default_journal_dir(&app_data, Some(&documents));

    assert_eq!(dir, documents.join("Mini Diarium"));
}

#[test]
fn test_default_journal_dir_falls_back_to_app_data() {
    let app_data = PathBuf::from("/app-data");

    let dir = default_journal_dir(&app_data, None);

    assert_eq!(dir, app_data.join("journals"));
}

#[test]
fn test_db_filename_accepts_ordinary_names_on_every_platform() {
    for windows_rules in [false, true] {
        assert!(is_valid_db_filename("diary.db", windows_rules));
        assert!(is_valid_db_filename(
            "Jon's Journal (2026).db",
            windows_rules
        ));
        // Only whole stems are device names; a name that merely starts with one is fine.
        assert!(is_valid_db_filename("Console.db", windows_rules));
        assert!(is_valid_db_filename("COM10.db", windows_rules));
    }
    assert!(validate_db_filename("diary.db").is_ok());
}

/// The three names the old sanitizer rewrote: each must now pass unchanged.
#[test]
fn test_db_filename_accepts_names_the_old_sanitizer_rewrote() {
    let long = format!("{}.db", "a".repeat(65));
    for windows_rules in [false, true] {
        assert!(is_valid_db_filename(&long, windows_rules));
        assert!(is_valid_db_filename("work  notes.db", windows_rules));
    }
    // `:` is legal on Linux and macOS, and reserved on Windows.
    assert!(is_valid_db_filename("work:notes.db", false));
    assert!(!is_valid_db_filename("work:notes.db", true));
}

/// The load-bearing case: a separator would escape the folder the caller chose.
#[test]
fn test_db_filename_rejects_separators_and_control_characters_everywhere() {
    for windows_rules in [false, true] {
        for name in [
            "../../etc/passwd.db",
            "sub/diary.db",
            "we\u{0}ird.db",
            "line\nbreak.db",
            "",
            ".",
            "..",
        ] {
            assert!(
                !is_valid_db_filename(name, windows_rules),
                "accepted {name:?}"
            );
        }
    }
    // A backslash is a separator on Windows, and a config.json can move between platforms, so
    // it is refused everywhere. On Linux and macOS the picker keeps it in the filename, and the
    // user gets this refusal instead of a different file.
    for windows_rules in [false, true] {
        assert!(!is_valid_db_filename("C:\\Users\\jon.db", windows_rules));
        assert!(!is_valid_db_filename("back\\slash.db", windows_rules));
        assert!(!is_valid_db_filename("..\\outside.db", windows_rules));
    }
}

/// A saved filename is joined only after this host's rules accept it.
#[test]
fn test_journal_db_paths_refuses_a_name_that_leaves_the_folder() {
    let dir = PathBuf::from("journal-dir");
    let mut names = vec!["..\\outside.db", "..", "sub/outside.db", ""];
    if cfg!(windows) {
        names.extend(["C:outside.db", "diary.db:stream"]);
    }

    for name in names {
        assert_eq!(
            journal_db_paths(&dir, Some(name)).unwrap_err(),
            "Invalid journal filename",
            "accepted {name:?}"
        );
    }
}

#[test]
fn test_journal_db_paths_joins_a_valid_name_unchanged() {
    let dir = PathBuf::from("journal-dir");

    assert_eq!(
        journal_db_paths(&dir, None).unwrap(),
        (dir.join("diary.db"), dir.join("backups").join("diary"))
    );
    assert_eq!(
        journal_db_paths(&dir, Some("Work  Notes.DB")).unwrap(),
        (
            dir.join("Work  Notes.DB"),
            dir.join("backups").join("Work  Notes")
        )
    );
}

#[test]
fn test_db_filename_rejects_windows_reserved_names_only_on_windows() {
    for name in [
        "CON",
        "nul.db",
        "COM9.db",
        "LPT1.notes.db",
        "a?.db",
        "a*.db",
        "a|b.db",
    ] {
        assert!(!is_valid_db_filename(name, true), "accepted {name:?}");
        assert!(is_valid_db_filename(name, false), "refused {name:?}");
    }
}

#[test]
fn test_db_filename_rejects_trailing_dots_and_spaces_on_windows() {
    // Windows drops these silently, so "Work." and "Work" would resolve to one file.
    for name in ["Work.", "Work...", "Work "] {
        assert!(!is_valid_db_filename(name, true), "accepted {name:?}");
        assert!(is_valid_db_filename(name, false), "refused {name:?}");
    }
}

/// Names exactly `len` UTF-8 bytes long, one ASCII and one made of 2-byte characters.
fn names_of_byte_length(len: usize) -> [String; 2] {
    let ascii = format!("{}.db", "a".repeat(len - 3));
    // 'é' is 2 bytes; the ".db" suffix is 3, so pad an odd remainder with one ASCII letter.
    let wide_len = len - 3;
    let wide = format!(
        "{}{}.db",
        "é".repeat(wide_len / 2),
        "a".repeat(wide_len % 2)
    );
    [ascii, wide]
}

#[test]
fn test_db_filename_caps_the_length_in_bytes() {
    for windows_rules in [false, true] {
        for name in names_of_byte_length(MAX_DB_FILENAME_BYTES) {
            assert_eq!(name.len(), MAX_DB_FILENAME_BYTES);
            assert!(
                is_valid_db_filename(&name, windows_rules),
                "refused {name:?}"
            );
        }
        for name in names_of_byte_length(MAX_DB_FILENAME_BYTES + 1) {
            assert!(
                !is_valid_db_filename(&name, windows_rules),
                "accepted {name:?}"
            );
        }
    }
}

/// The cap must leave room for the files SQLite and the app create next to the database: a
/// name at the limit has to survive creation and a write, which needs the `-journal` file.
#[test]
fn test_a_database_at_the_filename_limit_can_be_created_and_written() {
    use crate::db::{create_database_auto, insert_entry, DiaryEntry};

    let tmp = tempfile::tempdir().unwrap();
    // On Windows this yields a `\\?\` path, so the test measures the per-name limit, not the
    // separate 260-character total path limit.
    let dir = tmp.path().canonicalize().unwrap();

    for name in names_of_byte_length(MAX_DB_FILENAME_BYTES) {
        validate_db_filename(&name).unwrap();
        let (db_path, _) = journal_db_paths(&dir, Some(&name)).unwrap();

        let db = create_database_auto(&db_path, &[7u8; 32])
            .unwrap_or_else(|e| panic!("could not create {name:?}: {e}"));
        let entry = DiaryEntry {
            id: 0,
            date: "2026-10-10".to_string(),
            title: "Limit".to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: "2026-10-10T00:00:00Z".to_string(),
            date_updated: "2026-10-10T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        };
        insert_entry(&db, &entry).unwrap_or_else(|e| panic!("could not write {name:?}: {e}"));
        drop(db);

        // The longest sibling name the app itself creates must also fit.
        let staged = dir.join(format!("{name}.restoring.tmp"));
        std::fs::write(&staged, b"x").unwrap();
        std::fs::remove_file(&staged).unwrap();
    }
}

#[test]
fn test_db_filename_error_is_not_in_the_filesystem_bucket() {
    let err = validate_db_filename("a/b.db").unwrap_err();

    assert_eq!(err, "Invalid journal filename");
    // mapTauriError maps "Failed to …" to a permissions message, which would be wrong here.
    assert!(!err.starts_with("Failed to"));
}
