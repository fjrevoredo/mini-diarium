//! Shared test fixtures for the `markdown` submodules. Compiled only under `cfg(test)`.

use crate::db::queries::DiaryEntry;
use std::collections::HashMap;

/// A canonical single-entry fixture (id 1) used across the markdown writer tests.
pub fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
    DiaryEntry {
        id: 1,
        date: date.to_string(),
        title: title.to_string(),
        text: text.to_string(),
        word_count: crate::db::queries::count_words(text),
        date_created: "2024-01-01T12:00:00Z".to_string(),
        date_updated: "2024-01-01T12:00:00Z".to_string(),
        metadata: None,
        locked: false,
    }
}

/// [`create_test_entry`] with an explicit id — needed by the tag-lookup tests,
/// which key the tag map by entry id.
pub fn entry_with_id(id: i64, date: &str, title: &str, text: &str) -> DiaryEntry {
    DiaryEntry {
        id,
        ..create_test_entry(date, title, text)
    }
}

pub fn empty_tags() -> HashMap<i64, Vec<String>> {
    HashMap::new()
}

/// Minimal valid 1×1 white PNG encoded as base64 (67 bytes)
pub const TINY_PNG_B64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==";

/// An `<img>` tag embedding [`TINY_PNG_B64`] as a data URI.
pub fn tiny_png_img_tag() -> String {
    format!(
        r#"<img src="data:image/png;base64,{}" alt="">"#,
        TINY_PNG_B64
    )
}
