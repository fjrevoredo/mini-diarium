use base64::{engine::general_purpose, Engine as _};
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager};

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
}

#[tauri::command]
pub fn get_font_data(family: String, app_handle: AppHandle) -> Result<FontFaceData, String> {
    let dir = resolve_font_dir(&app_handle)?;
    let stem = stem_from_family(&family);

    let regular = read_font_file(&dir, &stem, "Regular")?;
    let bold = read_font_file(&dir, &stem, "Bold")?;

    Ok(FontFaceData {
        family,
        regular,
        bold,
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
}
