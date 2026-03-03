/// Returns the raw bytes of a local image file.
///
/// Only `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, and `.bmp` extensions are
/// permitted; any other path returns an error to limit this command's reach.
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let allowed = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !allowed.contains(&ext.as_str()) {
        return Err(format!("'{}' is not an allowed image extension", ext));
    }
    std::fs::read(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_non_image_extensions() {
        assert!(read_file_bytes("diary.db".to_string()).is_err());
        assert!(read_file_bytes("config.json".to_string()).is_err());
        assert!(read_file_bytes("script.sh".to_string()).is_err());
    }

    #[test]
    fn rejects_missing_image_file() {
        // Extension is valid but the file doesn't exist
        let result = read_file_bytes("/tmp/nonexistent_test_image_12345.png".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn reads_valid_image_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        // Rename to give it a .png extension
        let path = tmp.path().to_path_buf().with_extension("png");
        let _moved = tmp.persist(&path);
        std::fs::write(&path, b"fake-png-data").unwrap();

        let result = read_file_bytes(path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), b"fake-png-data");

        let _ = std::fs::remove_file(&path);
    }
}
