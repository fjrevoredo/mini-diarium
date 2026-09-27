//! Extension → MIME lookup for attachments.
//!
//! Attachment content is opaque bytes: it is never rendered or executed in the app, so the
//! MIME type is informational only (chip icon, export metadata). It is derived from the
//! file extension, never from the bytes.

/// Fallback MIME type for unknown or missing extensions.
pub const DEFAULT_ATTACHMENT_MIME: &str = "application/octet-stream";

/// Returns the MIME type for a file name's extension (case-insensitive), or
/// [`DEFAULT_ATTACHMENT_MIME`] when the extension is unknown or missing.
pub fn mime_for_extension(file_name: &str) -> &'static str {
    let ext = match std::path::Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
    {
        Some(ext) => ext.to_ascii_lowercase(),
        None => return DEFAULT_ATTACHMENT_MIME,
    };

    match ext.as_str() {
        // Documents
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "odt" => "application/vnd.oasis.opendocument.text",
        "ods" => "application/vnd.oasis.opendocument.spreadsheet",
        "odp" => "application/vnd.oasis.opendocument.presentation",
        "rtf" => "application/rtf",
        "epub" => "application/epub+zip",
        // Text
        "txt" | "log" => "text/plain",
        "md" | "markdown" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "xml" => "application/xml",
        "html" | "htm" => "text/html",
        // Archives
        "zip" => "application/zip",
        "7z" => "application/x-7z-compressed",
        "gz" => "application/gzip",
        "tar" => "application/x-tar",
        // Video
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        // Audio
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        // Images (attached as files, not embedded)
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "heic" => "image/heic",
        "svg" => "image/svg+xml",
        _ => DEFAULT_ATTACHMENT_MIME,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mime_for_extension_known_types_case_insensitive() {
        assert_eq!(mime_for_extension("report.pdf"), "application/pdf");
        assert_eq!(mime_for_extension("REPORT.PDF"), "application/pdf");
        assert_eq!(mime_for_extension("clip.MP4"), "video/mp4");
        assert_eq!(
            mime_for_extension("notes.docx"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
    }

    #[test]
    fn test_mime_for_extension_falls_back_for_unknown_or_missing() {
        assert_eq!(mime_for_extension("data.xyz"), DEFAULT_ATTACHMENT_MIME);
        assert_eq!(mime_for_extension("README"), DEFAULT_ATTACHMENT_MIME);
        assert_eq!(mime_for_extension(".hidden"), DEFAULT_ATTACHMENT_MIME);
    }
}
