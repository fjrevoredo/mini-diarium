use base64::{engine::general_purpose, Engine as _};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::{self, DatabaseConnection};

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
    let rows = db::list_custom_font_rows(db)?;

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
    if weight == "Bold" && !db::custom_font_has_weight(db, family, "Regular")? {
        return Err("Import the Regular weight before importing Bold.".to_string());
    }
    db::upsert_custom_font(db, family, weight, bytes, now)
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
    db::delete_custom_font_family(db, family)
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
    let Some(reg_bytes) = db::get_custom_font_weight_data(db, family, "Regular")? else {
        return Ok(None);
    };

    let bold_blob = db::get_custom_font_weight_data(db, family, "Bold")?;

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
mod tests;
