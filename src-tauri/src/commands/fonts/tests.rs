use super::*;
use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use rusqlite::Connection;

// --- family_from_stem ---

#[test]
fn family_from_stem_regular() {
    assert_eq!(family_from_stem("FiraMono-Regular"), "FiraMono");
}

#[test]
fn family_from_stem_bold() {
    assert_eq!(family_from_stem("FiraMono-Bold"), "FiraMono");
}

#[test]
fn family_from_stem_no_hyphen_in_base() {
    assert_eq!(family_from_stem("SourceSans3-Regular"), "SourceSans3");
}

#[test]
fn family_from_stem_bold_italic() {
    assert_eq!(
        family_from_stem("JetBrainsMono-BoldItalic"),
        "JetBrainsMono"
    );
}

#[test]
fn family_from_stem_no_known_suffix() {
    assert_eq!(family_from_stem("NoStem"), "NoStem");
}

#[test]
fn family_from_stem_roman_suffix() {
    assert_eq!(family_from_stem("SomeFont-Roman"), "SomeFont");
}

#[test]
fn family_from_stem_hyphenated_base() {
    assert_eq!(family_from_stem("Fira-Mono-Regular"), "Fira Mono");
}

#[test]
fn family_from_stem_amiri() {
    assert_eq!(family_from_stem("Amiri-Regular"), "Amiri");
    assert_eq!(family_from_stem("Amiri-Bold"), "Amiri");
}

#[test]
fn family_from_stem_tajawal() {
    assert_eq!(family_from_stem("Tajawal-Regular"), "Tajawal");
    assert_eq!(family_from_stem("Tajawal-Bold"), "Tajawal");
}

// --- stem_from_family ---

#[test]
fn stem_from_family_basic() {
    assert_eq!(stem_from_family("Fira Mono"), "FiraMono");
}

#[test]
fn stem_from_family_no_spaces() {
    assert_eq!(stem_from_family("SourceSans3"), "SourceSans3");
}

#[test]
fn stem_from_family_brains_mono() {
    assert_eq!(stem_from_family("JetBrains Mono"), "JetBrainsMono");
}

// --- mime_from_bytes ---

#[test]
fn mime_ttf() {
    assert_eq!(mime_from_bytes(&[0x00, 0x01, 0x00, 0x00]), Some("font/ttf"));
}

#[test]
fn mime_otf() {
    assert_eq!(mime_from_bytes(&[0x4F, 0x54, 0x54, 0x4F]), Some("font/otf"));
}

#[test]
fn mime_woff() {
    assert_eq!(
        mime_from_bytes(&[0x77, 0x4F, 0x46, 0x46]),
        Some("font/woff")
    );
}

#[test]
fn mime_woff2() {
    assert_eq!(
        mime_from_bytes(&[0x77, 0x4F, 0x46, 0x32]),
        Some("font/woff2")
    );
}

#[test]
fn mime_unknown_bytes() {
    assert_eq!(mime_from_bytes(&[0xFF, 0xFF, 0xFF, 0xFF]), None);
}

#[test]
fn mime_short_input() {
    assert_eq!(mime_from_bytes(&[0x00, 0x01]), None);
}

// --- list_fonts_in_dir ---

#[test]
fn list_fonts_in_dir_empty() {
    let dir = tempfile::TempDir::new().expect("temp dir");
    let result = list_fonts_in_dir(dir.path()).expect("list fonts");
    assert!(result.is_empty());
}

#[test]
fn list_fonts_in_dir_nonexistent() {
    let result = list_fonts_in_dir(Path::new("/nonexistent/fonts/dir"));
    assert!(result.is_err());
}

#[test]
fn list_fonts_in_dir_ignores_non_font_files() {
    let dir = tempfile::TempDir::new().expect("temp dir");
    std::fs::write(dir.path().join("README.txt"), b"hello").expect("write txt");
    std::fs::write(dir.path().join("FiraMono-Regular.ttf"), b"").expect("write ttf");
    let result = list_fonts_in_dir(dir.path()).expect("list fonts");
    assert_eq!(result, vec!["FiraMono"]);
}

#[test]
fn list_fonts_in_dir_sorts_and_deduplicates() {
    let dir = tempfile::TempDir::new().expect("temp dir");
    std::fs::write(dir.path().join("FiraMono-Bold.ttf"), b"").expect("write bold");
    std::fs::write(dir.path().join("NotoSans-Regular.ttf"), b"").expect("write noto");
    std::fs::write(dir.path().join("FiraMono-Regular.ttf"), b"").expect("write regular");
    let result = list_fonts_in_dir(dir.path()).expect("list fonts");
    assert_eq!(result, vec!["FiraMono", "NotoSans"]);
}

// --- DB helpers for command unit tests ---

fn make_test_db() -> DatabaseConnection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
         INSERT INTO schema_version VALUES (8);
         CREATE TABLE custom_fonts (
             id         INTEGER PRIMARY KEY AUTOINCREMENT,
             family     TEXT NOT NULL,
             weight     TEXT NOT NULL CHECK(weight IN ('Regular','Bold')),
             data       BLOB NOT NULL,
             created_at TEXT NOT NULL,
             UNIQUE(family, weight)
         );",
    )
    .unwrap();
    DatabaseConnection {
        conn,
        encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap(),
    }
}

fn ttf_bytes() -> Vec<u8> {
    vec![0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
}

const NOW: &str = "2026-01-01T00:00:00Z";

// --- validate_font_input ---

#[test]
fn test_validate_font_input_accepts_valid_ttf() {
    assert!(validate_font_input("MyFont", "Regular", &ttf_bytes()).is_ok());
}

#[test]
fn test_validate_font_input_rejects_invalid_weight() {
    let err = validate_font_input("MyFont", "Thin", &ttf_bytes()).unwrap_err();
    assert!(err.contains("Invalid weight"), "got: {err}");
}

#[test]
fn test_validate_font_input_rejects_empty_family() {
    let err = validate_font_input("", "Regular", &ttf_bytes()).unwrap_err();
    assert!(err.contains("empty"), "got: {err}");
}

#[test]
fn test_validate_font_input_rejects_invalid_magic_bytes() {
    let bad_bytes = vec![0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x00, 0x00, 0x00];
    let err = validate_font_input("MyFont", "Regular", &bad_bytes).unwrap_err();
    assert!(err.contains("Invalid font file"), "got: {err}");
}

// --- list_custom_fonts_impl ---

#[test]
fn test_list_custom_fonts_impl_empty() {
    let db = make_test_db();
    let result = list_custom_fonts_impl(&db).unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_list_custom_fonts_impl_aggregates_weights() {
    let db = make_test_db();
    import_custom_font_impl("FontA", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("FontA", "Bold", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("FontB", "Regular", &ttf_bytes(), NOW, &db).unwrap();

    let summaries = list_custom_fonts_impl(&db).unwrap();
    assert_eq!(summaries.len(), 2);
    let a = summaries.iter().find(|s| s.family == "FontA").unwrap();
    assert!(a.has_regular && a.has_bold);
    let b = summaries.iter().find(|s| s.family == "FontB").unwrap();
    assert!(b.has_regular && !b.has_bold);
}

// --- import_custom_font_impl ---

#[test]
fn test_import_custom_font_impl_inserts_regular() {
    let db = make_test_db();
    import_custom_font_impl("MyFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    let count: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM custom_fonts WHERE family='MyFont' AND weight='Regular'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn test_import_custom_font_impl_rejects_bold_before_regular() {
    let db = make_test_db();
    let err = import_custom_font_impl("MyFont", "Bold", &ttf_bytes(), NOW, &db).unwrap_err();
    assert!(err.contains("Regular weight"), "got: {err}");
}

#[test]
fn test_import_custom_font_impl_allows_bold_after_regular() {
    let db = make_test_db();
    import_custom_font_impl("MyFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("MyFont", "Bold", &ttf_bytes(), NOW, &db).unwrap();
    let count: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM custom_fonts WHERE family='MyFont'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 2);
}

#[test]
fn test_import_custom_font_impl_replace_updates_existing() {
    let db = make_test_db();
    let orig = vec![0x00, 0x01, 0x00, 0x00, 0xAA, 0xBB, 0x00, 0x00];
    let updated = vec![0x00, 0x01, 0x00, 0x00, 0xCC, 0xDD, 0x00, 0x00];
    import_custom_font_impl("MyFont", "Regular", &orig, NOW, &db).unwrap();
    import_custom_font_impl("MyFont", "Regular", &updated, NOW, &db).unwrap();
    let stored: Vec<u8> = db
        .conn()
        .query_row(
            "SELECT data FROM custom_fonts WHERE family='MyFont' AND weight='Regular'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        stored, updated,
        "INSERT OR REPLACE must overwrite existing row"
    );
}

// --- delete_custom_font_family_impl ---

#[test]
fn test_delete_custom_font_family_impl_removes_all_weights() {
    let db = make_test_db();
    import_custom_font_impl("DelFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("DelFont", "Bold", &ttf_bytes(), NOW, &db).unwrap();
    delete_custom_font_family_impl("DelFont", &db).unwrap();
    let count: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM custom_fonts WHERE family='DelFont'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0, "all weights must be deleted");
}

#[test]
fn test_delete_custom_font_family_impl_only_removes_target() {
    let db = make_test_db();
    import_custom_font_impl("DelFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("KeepFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    delete_custom_font_family_impl("DelFont", &db).unwrap();
    let keep_count: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM custom_fonts WHERE family='KeepFont'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(keep_count, 1, "other families must not be affected");
}

// --- get_custom_font_data ---

#[test]
fn test_get_custom_font_data_returns_none_for_unknown_family() {
    let db = make_test_db();
    let result = get_custom_font_data("Unknown", &db).unwrap();
    assert!(result.is_none());
}

#[test]
fn test_get_custom_font_data_bold_synthesized_true_when_regular_only() {
    let db = make_test_db();
    import_custom_font_impl("TestFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    let data = get_custom_font_data("TestFont", &db).unwrap().unwrap();
    assert!(
        data.bold_synthesized,
        "no Bold row → bold_synthesized must be true"
    );
    assert_eq!(data.family, "TestFont");
}

#[test]
fn test_get_custom_font_data_bold_synthesized_false_when_both_weights_present() {
    let db = make_test_db();
    import_custom_font_impl("TestFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    import_custom_font_impl("TestFont", "Bold", &ttf_bytes(), NOW, &db).unwrap();
    let data = get_custom_font_data("TestFont", &db).unwrap().unwrap();
    assert!(
        !data.bold_synthesized,
        "Bold row present → bold_synthesized must be false"
    );
}

#[test]
fn test_get_custom_font_data_encodes_regular_as_data_url() {
    let db = make_test_db();
    import_custom_font_impl("TestFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
    let data = get_custom_font_data("TestFont", &db).unwrap().unwrap();
    assert!(
        data.regular.starts_with("data:font/ttf;base64,"),
        "regular must be a base64 data URL"
    );
}
