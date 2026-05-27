use base64::{engine::general_purpose, Engine as _};
use rusqlite::OptionalExtension;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::schema::DatabaseConnection;

fn resolve_font_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        let flatpak_dir = PathBuf::from("/app/share/fonts");
        log::debug!(
            "[fonts] checking Flatpak path: {} (exists: {})",
            flatpak_dir.display(),
            flatpak_dir.is_dir()
        );
        if flatpak_dir.is_dir() {
            return Ok(flatpak_dir);
        }
    }

    // Dev mode: env var takes priority so new fonts appear immediately without rebuild.
    // Production: env var is unset, falls through to bundled resources.
    if let Ok(dir) = std::env::var("MINI_DIARIUM_FONTS_DIR") {
        let dev_path = PathBuf::from(&dir);
        log::debug!(
            "[fonts] using env override: {} (exists: {})",
            dev_path.display(),
            dev_path.is_dir()
        );
        if dev_path.is_dir() {
            return Ok(dev_path);
        }
    } else {
        log::debug!("[fonts] MINI_DIARIUM_FONTS_DIR not set");
    }

    let resolved = app_handle
        .path()
        .resolve("../fonts", BaseDirectory::Resource)
        .map_err(|e| format!("Cannot resolve fonts directory: {e}"))?;
    log::debug!(
        "[fonts] resolved via Tauri: {} (exists: {})",
        resolved.display(),
        resolved.is_dir()
    );
    if resolved.is_dir() {
        return Ok(resolved);
    }

    log::debug!(
        "[fonts] returning resolved path as fallback: {}",
        resolved.display()
    );
    Ok(resolved)
}

fn list_fonts_in_dir(dir: &Path) -> Result<Vec<String>, String> {
    let mut families: Vec<String> = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot read fonts directory '{}': {}", dir.display(), e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let ext = path.extension()?.to_str()?.to_lowercase();
            if ext != "ttf" && ext != "otf" {
                return None;
            }
            let stem = path.file_stem()?.to_str()?;
            Some(family_from_stem(stem))
        })
        .collect();

    families.sort();
    families.dedup();
    Ok(families)
}

#[tauri::command]
pub fn list_bundled_fonts(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let fonts_dir = resolve_font_dir(&app_handle)?;
    log::debug!("[fonts] reading from: {}", fonts_dir.display());

    let families = list_fonts_in_dir(&fonts_dir)?;
    log::debug!("[fonts] found {} families: {:?}", families.len(), &families);
    Ok(families)
}

fn family_from_stem(stem: &str) -> String {
    let suffixes = [
        "-Regular",
        "-Bold",
        "-Italic",
        "-BoldItalic",
        "-Light",
        "-LightItalic",
        "-Medium",
        "-MediumItalic",
        "-SemiBold",
        "-SemiBoldItalic",
        "-ExtraBold",
        "-ExtraBoldItalic",
        "-Black",
        "-BlackItalic",
        "-Thin",
        "-ThinItalic",
        "-ExtraLight",
        "-ExtraLightItalic",
        "-Hairline",
        "-Roman",
        "-Oblique",
    ];

    let base = suffixes
        .iter()
        .find_map(|s| stem.strip_suffix(s))
        .unwrap_or(stem);

    base.replace('-', " ")
}

fn stem_from_family(family: &str) -> String {
    family.replace(' ', "")
}

#[derive(serde::Serialize)]
pub struct FontFaceData {
    family: String,
    regular: String,
    bold: String,
    bold_synthesized: bool,
}

#[derive(serde::Serialize)]
pub struct CustomFontSummary {
    family: String,
    has_regular: bool,
    has_bold: bool,
}

fn list_custom_fonts_impl(db: &DatabaseConnection) -> Result<Vec<CustomFontSummary>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT family, weight FROM custom_fonts ORDER BY family, weight")
        .map_err(|e| format!("Failed to prepare list_custom_fonts query: {e}"))?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query custom_fonts: {e}"))?
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Failed to read custom_fonts row: {e}"))?;

    let mut map: BTreeMap<String, CustomFontSummary> = BTreeMap::new();
    for (family, weight) in rows {
        let entry = map.entry(family.clone()).or_insert(CustomFontSummary {
            family,
            has_regular: false,
            has_bold: false,
        });
        match weight.as_str() {
            "Regular" => entry.has_regular = true,
            "Bold" => entry.has_bold = true,
            _ => {}
        }
    }

    Ok(map.into_values().collect())
}

#[tauri::command]
pub fn list_custom_fonts(state: State<DiaryState>) -> Result<Vec<CustomFontSummary>, String> {
    with_unlocked_db(&state, list_custom_fonts_impl)
}

const MAX_FONT_BYTES: usize = 20 * 1024 * 1024; // 20 MB

fn validate_font_input(family: &str, weight: &str, bytes: &[u8]) -> Result<(), String> {
    if weight != "Regular" && weight != "Bold" {
        return Err(format!(
            "Invalid weight '{}': must be 'Regular' or 'Bold'",
            weight
        ));
    }
    if family.is_empty() {
        return Err("Font family name must not be empty".to_string());
    }
    if bytes.len() > MAX_FONT_BYTES {
        return Err(format!(
            "Font file is too large ({} MB). Maximum is 20 MB.",
            bytes.len() / (1024 * 1024)
        ));
    }
    if mime_from_bytes(bytes).is_none() {
        return Err(
            "Invalid font file. Only TTF, OTF, WOFF, and WOFF2 files are accepted.".to_string(),
        );
    }
    Ok(())
}

fn import_custom_font_impl(
    family: &str,
    weight: &str,
    bytes: &[u8],
    now: &str,
    db: &DatabaseConnection,
) -> Result<(), String> {
    if weight == "Bold" {
        let has_regular: bool = db
            .conn()
            .query_row(
                "SELECT 1 FROM custom_fonts WHERE family = ?1 AND weight = 'Regular' LIMIT 1",
                rusqlite::params![family],
                |_row| Ok(()),
            )
            .optional()
            .map_err(|e| format!("Failed to verify existing Regular weight: {e}"))?
            .is_some();
        if !has_regular {
            return Err("Import the Regular weight before importing Bold.".to_string());
        }
    }
    db.conn()
        .execute(
            "INSERT OR REPLACE INTO custom_fonts (family, weight, data, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![family, weight, bytes, now],
        )
        .map(|_| ())
        .map_err(|e| format!("Failed to store font: {e}"))
}

#[tauri::command]
pub fn import_custom_font(
    family: String,
    weight: String,
    path: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let family = family.trim().to_string();
    let bytes = std::fs::read(&path).map_err(|e| format!("Cannot read font file: {e}"))?;
    validate_font_input(&family, &weight, &bytes)?;
    let now = chrono::Utc::now().to_rfc3339();
    with_unlocked_db(&state, |db| {
        import_custom_font_impl(&family, &weight, &bytes, &now, db)
    })
}

fn delete_custom_font_family_impl(family: &str, db: &DatabaseConnection) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM custom_fonts WHERE family = ?1",
            rusqlite::params![family],
        )
        .map(|_| ())
        .map_err(|e| format!("Failed to delete custom font '{}': {e}", family))
}

#[tauri::command]
pub fn delete_custom_font_family(family: String, state: State<DiaryState>) -> Result<(), String> {
    let family = family.trim().to_string();
    if family.is_empty() {
        return Err("Font family name must not be empty".to_string());
    }
    with_unlocked_db(&state, |db| delete_custom_font_family_impl(&family, db))
}

fn get_custom_font_data(
    family: &str,
    db: &DatabaseConnection,
) -> Result<Option<FontFaceData>, String> {
    let regular_blob = db
        .conn()
        .query_row(
            "SELECT data FROM custom_fonts WHERE family = ?1 AND weight = 'Regular'",
            rusqlite::params![family],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read custom Regular font: {e}"))?;

    let Some(reg_bytes) = regular_blob else {
        return Ok(None);
    };

    let bold_blob = db
        .conn()
        .query_row(
            "SELECT data FROM custom_fonts WHERE family = ?1 AND weight = 'Bold'",
            rusqlite::params![family],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read custom Bold font: {e}"))?;

    let bold_synthesized = bold_blob.is_none();
    let bold_bytes = bold_blob.unwrap_or_else(|| reg_bytes.clone());
    let reg_mime = mime_from_bytes(&reg_bytes).unwrap_or("font/ttf");
    let bold_mime = mime_from_bytes(&bold_bytes).unwrap_or("font/ttf");
    let regular = format!(
        "data:{};base64,{}",
        reg_mime,
        general_purpose::STANDARD.encode(&reg_bytes)
    );
    let bold = format!(
        "data:{};base64,{}",
        bold_mime,
        general_purpose::STANDARD.encode(&bold_bytes)
    );
    Ok(Some(FontFaceData {
        family: family.to_string(),
        regular,
        bold,
        bold_synthesized,
    }))
}

#[tauri::command]
pub fn get_font_data(
    family: String,
    app_handle: AppHandle,
    state: State<DiaryState>,
) -> Result<FontFaceData, String> {
    let custom = with_unlocked_db(&state, |db| get_custom_font_data(&family, db))?;

    if let Some(data) = custom {
        return Ok(data);
    }

    let dir = resolve_font_dir(&app_handle)?;
    let stem = stem_from_family(&family);

    let regular = read_font_file(&dir, &stem, "Regular")?;
    let bold = read_font_file(&dir, &stem, "Bold")?;

    Ok(FontFaceData {
        family,
        regular,
        bold,
        bold_synthesized: false,
    })
}

fn read_font_file(dir: &Path, stem: &str, weight: &str) -> Result<String, String> {
    let filename = format!("{}-{}.ttf", stem, weight);
    let path = dir.join(&filename);

    if path.is_file() {
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("Cannot read font file '{}': {}", path.display(), e))?;
        let encoded = general_purpose::STANDARD.encode(&bytes);
        let mime = mime_from_bytes(&bytes).unwrap_or("font/ttf");
        Ok(format!("data:{};base64,{}", mime, encoded))
    } else {
        let otf = format!("{}-{}.otf", stem, weight);
        let otf_path = dir.join(&otf);
        if otf_path.is_file() {
            let bytes = std::fs::read(&otf_path)
                .map_err(|e| format!("Cannot read font file '{}': {}", otf_path.display(), e))?;
            let encoded = general_purpose::STANDARD.encode(&bytes);
            Ok(format!("data:font/otf;base64,{}", encoded))
        } else {
            Err(format!(
                "Font file not found for '{}' ({}) — tried {} and {}",
                family_colon(stem, weight),
                dir.display(),
                path.display(),
                otf_path.display()
            ))
        }
    }
}

fn mime_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 4 {
        return None;
    }
    match &bytes[0..4] {
        [0x00, 0x01, 0x00, 0x00] => Some("font/ttf"),
        [0x4F, 0x54, 0x54, 0x4F] => Some("font/otf"),
        [0x77, 0x4F, 0x46, 0x46] => Some("font/woff"),
        [0x77, 0x4F, 0x46, 0x32] => Some("font/woff2"),
        _ => None,
    }
}

fn family_colon(stem: &str, weight: &str) -> String {
    format!("{}-{}", stem, weight)
}

#[cfg(test)]
mod tests {
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
        // Filename stems with internal hyphens: "Fira-Mono-Regular" -> "Fira Mono"
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
        assert_eq!(stored, updated, "INSERT OR REPLACE must overwrite existing row");
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
        assert!(data.bold_synthesized, "no Bold row → bold_synthesized must be true");
        assert_eq!(data.family, "TestFont");
    }

    #[test]
    fn test_get_custom_font_data_bold_synthesized_false_when_both_weights_present() {
        let db = make_test_db();
        import_custom_font_impl("TestFont", "Regular", &ttf_bytes(), NOW, &db).unwrap();
        import_custom_font_impl("TestFont", "Bold", &ttf_bytes(), NOW, &db).unwrap();
        let data = get_custom_font_data("TestFont", &db).unwrap().unwrap();
        assert!(!data.bold_synthesized, "Bold row present → bold_synthesized must be false");
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
}
