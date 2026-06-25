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

/// Writes raw bytes to a `.pdf` file. Path must come from the frontend save dialog.
/// Extension is validated to limit blast radius of this command.
#[tauri::command]
pub fn write_pdf_file(file_path: String, bytes: Vec<u8>) -> Result<(), String> {
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if ext != "pdf" {
        return Err(format!(
            "'{}' is not an allowed extension for PDF export",
            ext
        ));
    }
    std::fs::write(&file_path, bytes).map_err(|e| format!("Failed to write PDF: {}", e))
}

const MAX_TEXT_FILE_BYTES: u64 = 1_048_576; // 1 MiB

/// Returns the UTF-8 contents of a local Markdown file.
///
/// Only `.md` is permitted; any other extension returns an error.
/// File size is capped at 1 MiB to prevent huge blobs in the editor.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let allowed = ["md"];
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !allowed.contains(&ext.as_str()) {
        return Err(format!("'{}' is not an allowed text extension", ext));
    }
    let metadata =
        std::fs::metadata(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))?;
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err("File is too large (max 1 MB)".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn write_pdf_file_rejects_non_pdf_extensions() {
        assert!(write_pdf_file("/tmp/test.txt".to_string(), vec![]).is_err());
        assert!(write_pdf_file("/tmp/test.json".to_string(), vec![]).is_err());
        assert!(write_pdf_file("/tmp/test".to_string(), vec![]).is_err());
    }

    #[test]
    fn write_pdf_file_roundtrip() {
        let tmp = tempfile::Builder::new().suffix(".pdf").tempfile().unwrap();
        let path = tmp.path().to_string_lossy().to_string();
        let data = vec![0x25u8, 0x50, 0x44, 0x46]; // %PDF
        write_pdf_file(path.clone(), data.clone()).unwrap();
        let read_back = std::fs::read(&path).unwrap();
        assert_eq!(read_back, data);
    }

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

    #[test]
    fn read_text_file_rejects_non_md() {
        assert!(read_text_file("diary.db".to_string()).is_err());
        assert!(read_text_file("export.json".to_string()).is_err());
        assert!(read_text_file("script.sh".to_string()).is_err());
        assert!(read_text_file("notes.txt".to_string()).is_err());
    }

    #[test]
    fn read_text_file_rejects_missing_file() {
        let result = read_text_file("/tmp/nonexistent_test_12345.md".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn read_text_file_rejects_oversized_file() {
        let tmp = tempfile::Builder::new().suffix(".md").tempfile().unwrap();
        let path = tmp.path().to_string_lossy().to_string();
        // Write 1 MiB + 1 byte — one byte over the limit
        std::fs::write(&path, vec![b'a'; 1_048_577]).unwrap();
        let result = read_text_file(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too large"));
    }

    #[test]
    fn read_text_file_reads_valid_md() {
        let tmp = tempfile::Builder::new().suffix(".md").tempfile().unwrap();
        let path = tmp.path().to_string_lossy().to_string();
        std::fs::write(&path, "# Hello\n").unwrap();
        let result = read_text_file(path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "# Hello\n");
    }
}
