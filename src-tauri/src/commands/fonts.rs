use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub fn list_bundled_fonts() -> Result<Vec<String>, String> {
    let fonts_dir = font_directory()?;
    log::debug!("[fonts] reading from: {}", fonts_dir.display());

    let mut families: Vec<String> = std::fs::read_dir(&fonts_dir)
        .map_err(|e| {
            format!(
                "Cannot read fonts directory '{}': {}",
                fonts_dir.display(),
                e
            )
        })?
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
    log::debug!("[fonts] found {} families: {:?}", families.len(), &families);
    Ok(families)
}

fn font_directory() -> Result<std::path::PathBuf, String> {
    let installed = installed_font_dir()?;
    log::debug!(
        "[fonts] installed dir: {} (exists: {})",
        installed.display(),
        installed.is_dir()
    );

    if installed.is_dir() {
        return Ok(installed);
    }

    // Dev-mode fallback via env var (only consulted when installed path is missing).
    // Set MINI_DIARIUM_FONTS_DIR=../fonts before `tauri dev` so the command finds
    // the repo-level fonts/ directory.  The env var is never read in production
    // because the installed path always exists there.
    if let Ok(dir) = std::env::var("MINI_DIARIUM_FONTS_DIR") {
        let dev_path = std::path::PathBuf::from(&dir);
        log::debug!(
            "[fonts] trying env override: {} (exists: {})",
            dev_path.display(),
            dev_path.is_dir()
        );
        if dev_path.is_dir() {
            return Ok(dev_path);
        }
    } else {
        log::debug!("[fonts] MINI_DIARIUM_FONTS_DIR not set");
    }

    Ok(installed)
}

fn installed_font_dir() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        Ok(std::path::PathBuf::from("/app/share/fonts"))
    }

    #[cfg(target_os = "macos")]
    {
        let exe =
            std::env::current_exe().map_err(|e| format!("Cannot resolve executable path: {e}"))?;
        let bundle_root = exe
            .parent()
            .and_then(|p| p.parent())
            .ok_or_else(|| "Cannot determine app bundle root".to_string())?;
        Ok(bundle_root.join("Contents").join("Resources").join("fonts"))
    }

    #[cfg(target_os = "windows")]
    {
        let exe =
            std::env::current_exe().map_err(|e| format!("Cannot resolve executable path: {e}"))?;
        let exe_dir = exe
            .parent()
            .ok_or_else(|| "Cannot determine executable directory".to_string())?;
        Ok(exe_dir.join("fonts"))
    }
}

fn family_from_stem(stem: &str) -> String {
    // Strip known weight/style suffixes then convert hyphens to spaces.
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

// Reverse of family_from_stem: "Fira Mono" -> "FiraMono"
fn stem_from_family(family: &str) -> String {
    family.replace(' ', "")
}

#[derive(serde::Serialize)]
pub struct FontFaceData {
    family: String,
    regular: String, // data:font/ttf;base64,...
    bold: String,
}

#[tauri::command]
pub fn get_font_data(family: String) -> Result<FontFaceData, String> {
    let dir = font_directory()?;
    let stem = stem_from_family(&family);

    let regular = read_font_file(&dir, &stem, "Regular")?;
    let bold = read_font_file(&dir, &stem, "Bold")?;

    Ok(FontFaceData {
        family,
        regular,
        bold,
    })
}

fn read_font_file(dir: &std::path::Path, stem: &str, weight: &str) -> Result<String, String> {
    let filename = format!("{}-{}.ttf", stem, weight);
    let path = dir.join(&filename);

    if path.is_file() {
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("Cannot read font file '{}': {}", path.display(), e))?;
        let encoded = general_purpose::STANDARD.encode(&bytes);
        let mime = mime_from_bytes(&bytes).unwrap_or("font/ttf");
        Ok(format!("data:{};base64,{}", mime, encoded))
    } else {
        // Some fonts use .otf instead of .ttf
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
