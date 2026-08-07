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
fn test_journal_dir_name_keeps_an_ordinary_name() {
    assert_eq!(journal_dir_name("Work"), "Work");
    assert_eq!(journal_dir_name("  Travel   Diary  "), "Travel Diary");
    assert_eq!(
        journal_dir_name("Jon's Journal (2026)"),
        "Jon's Journal (2026)"
    );
}

/// The load-bearing case: a separator would escape the parent folder the caller chose.
#[test]
fn test_journal_dir_name_strips_path_separators_and_control_characters() {
    let name = journal_dir_name("../../etc/passwd");
    assert!(!name.contains('/'), "produced a path, not a name: {name}");
    assert!(!name.contains('\\'), "produced a path, not a name: {name}");
    assert_eq!(name, "....etcpasswd");

    assert_eq!(journal_dir_name("C:\\Users\\jon"), "CUsersjon");
    assert_eq!(journal_dir_name("we\u{0}ird\n"), "weird");
}

#[test]
fn test_journal_dir_name_sidesteps_reserved_device_names() {
    assert_eq!(journal_dir_name("CON"), "CON_");
    assert_eq!(journal_dir_name("nul"), "nul_");
    assert_eq!(journal_dir_name("COM9"), "COM9_");
    assert_eq!(journal_dir_name("LPT1.notes"), "LPT1.notes_");
    // Only whole components are reserved — do not mangle names that merely start with one.
    assert_eq!(journal_dir_name("Console"), "Console");
    assert_eq!(journal_dir_name("COM10"), "COM10");
}

#[test]
fn test_journal_dir_name_trims_trailing_dots_and_spaces() {
    // Windows drops these silently, so "Work." and "Work" would resolve to one folder.
    assert_eq!(journal_dir_name("Work."), "Work");
    assert_eq!(journal_dir_name("Work..."), "Work");
    assert_eq!(journal_dir_name("Work "), "Work");
}

#[test]
fn test_journal_dir_name_falls_back_when_nothing_survives() {
    assert_eq!(journal_dir_name(""), "Journal");
    assert_eq!(journal_dir_name("///"), "Journal");
    assert_eq!(journal_dir_name("   "), "Journal");
    assert_eq!(journal_dir_name("..."), "Journal");
}

#[test]
fn test_journal_dir_name_caps_the_length_without_splitting_a_character() {
    let long = "é".repeat(200);

    let name = journal_dir_name(&long);

    assert_eq!(name.chars().count(), 64);
    assert!(name.chars().all(|c| c == 'é'));
}
