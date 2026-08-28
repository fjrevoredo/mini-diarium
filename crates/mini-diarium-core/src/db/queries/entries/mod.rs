use crate::db::schema::DatabaseConnection;

pub mod delete;
pub mod insert;
pub mod lock;
pub mod read;
pub mod timeline;
pub mod update;

pub use delete::*;
pub use insert::*;
pub use lock::*;
pub use read::*;
pub use timeline::*;
pub use update::*;

#[cfg(test)]
mod test_support;

/// Per-entry font defaults (optional override of app-level defaults)
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct EntryMetadata {
    #[serde(rename = "fontFamily", skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(rename = "fontSize", skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
}

/// Represents a diary entry
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct DiaryEntry {
    pub id: i64,              // AUTOINCREMENT primary key
    pub date: String,         // ISO 8601 date (YYYY-MM-DD)
    pub title: String,        // Plaintext title
    pub text: String,         // Plaintext text
    pub word_count: i32,      // Word count
    pub date_created: String, // ISO 8601 timestamp
    pub date_updated: String, // ISO 8601 timestamp
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<EntryMetadata>,
    /// UX-only "locked to prevent accidental edits" flag (non-sensitive plaintext column).
    /// Not a security boundary — see TODO-0071 / migration v12→v13.
    #[serde(default)]
    pub locked: bool,
}

/// Normalizes entry metadata: trims empty family strings to None, clamps font size to 12–24 px.
/// Returns None when both fields are None (no override).
pub fn normalize_metadata(meta: Option<EntryMetadata>) -> Option<EntryMetadata> {
    let mut m = meta?;
    if let Some(ref f) = m.font_family {
        let trimmed = f.trim().to_string();
        m.font_family = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        };
    }
    if let Some(size) = m.font_size {
        m.font_size = Some(size.clamp(12.0, 24.0));
    }
    if m.font_family.is_none() && m.font_size.is_none() {
        None
    } else {
        Some(m)
    }
}

/// Mirrors `isCjkCodePoint` in `src/lib/cjk.ts`. Korean (Hangul, U+AC00–U+D7A3) is
/// deliberately excluded — see TODO-0110-01.
#[inline]
fn is_cjk(ch: char) -> bool {
    matches!(ch,
        '\u{4E00}'..='\u{9FFF}' // Han
        | '\u{3400}'..='\u{4DBF}' // Han Ext A
        | '\u{F900}'..='\u{FAFF}' // Han Compatibility
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{31F0}'..='\u{31FF}' // Katakana Phonetic Ext
    )
}

/// Counts words in text, skipping HTML tag content.
/// Single-pass state machine: tracks tag state and word boundaries without allocating.
/// Each Han/Hiragana/Katakana character counts as its own word (no spaces between CJK
/// words), never merging with an adjacent CJK character — see TODO-0110-01.
pub fn count_words(text: &str) -> i32 {
    let mut count = 0;
    let mut in_tag = false;
    let mut in_word = false;

    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
            if in_word {
                count += 1;
                in_word = false;
            }
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            if is_cjk(ch) {
                if in_word {
                    count += 1;
                    in_word = false;
                }
                count += 1;
            } else if ch.is_whitespace() {
                if in_word {
                    count += 1;
                    in_word = false;
                }
            } else {
                in_word = true;
            }
        }
    }

    if in_word {
        count += 1;
    }

    count
}

/// Serializes and encrypts entry metadata for storage.
///
/// Normalizes here so every writer (insert, update, import, plugin) gets the
/// same validated invariants regardless of call site. Shared by `insert` and `update`.
fn encrypt_metadata(
    db: &DatabaseConnection,
    metadata: &Option<EntryMetadata>,
) -> Result<Option<Vec<u8>>, String> {
    let metadata = normalize_metadata(metadata.clone());
    match metadata {
        Some(m) => {
            let json = serde_json::to_string(&m)
                .map_err(|e| format!("Failed to serialize entry metadata: {}", e))?;
            Ok(Some(super::encrypt_for_storage(
                db.key(),
                json.as_bytes(),
                "entry_metadata",
            )?))
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_words() {
        assert_eq!(count_words("Hello world"), 2);
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("One"), 1);
        assert_eq!(count_words("  Multiple   spaces   between  "), 3);
        assert_eq!(count_words("Line\nbreaks\tand\ttabs"), 4);
    }

    #[test]
    fn test_count_words_strips_html() {
        assert_eq!(count_words("<p>Hello world</p>"), 2);
        assert_eq!(count_words("<p>One <strong>two</strong> three</p>"), 3);
        assert_eq!(count_words("<p></p>"), 0);
        assert_eq!(count_words("plain text"), 2);
    }

    #[test]
    fn test_count_words_base64_image() {
        let img = "<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\" />";
        assert_eq!(count_words(img), 0);
        let mixed = "<p>before</p><img src=\"data:image/png;base64,abc123==\" /><p>after</p>";
        assert_eq!(count_words(mixed), 2);
    }

    #[test]
    fn test_count_words_unicode() {
        assert_eq!(count_words("café résumé"), 2);
        assert_eq!(count_words("你好 世界"), 4);
        assert_eq!(
            count_words("word\u{00A0}with\u{2003}unicode\u{3000}spaces"),
            4
        );
    }

    #[test]
    fn test_count_words_cjk_no_spaces() {
        // Pure Chinese, no spaces between words — each Han char is its own word.
        assert_eq!(count_words("我今天很开心"), 6);
    }

    #[test]
    fn test_count_words_cjk_mixed_kanji_hiragana_katakana() {
        // "私はコーヒーが好きです" — kanji/hiragana/katakana mixed, no spaces.
        assert_eq!(count_words("私はコーヒーが好きです"), 11);
    }

    #[test]
    fn test_count_words_cjk_and_latin_mixed() {
        assert_eq!(count_words("Hello 世界"), 3);
    }

    #[test]
    fn test_count_words_korean_not_split() {
        // Korean control (TODO-0110-01): Hangul is excluded from the CJK rule since it
        // already uses spaces between words — must NOT be split per-syllable.
        assert_eq!(count_words("안녕 하세요"), 2);
    }

    #[test]
    fn test_count_words_cjk_inside_html_tags() {
        assert_eq!(count_words("<p>你好</p><p>world</p>"), 3);
    }

    #[test]
    fn test_count_words_cjk_with_base64_image() {
        let html = "<p>你好</p><img src=\"data:image/png;base64,abc123==\" /><p>world</p>";
        assert_eq!(count_words(html), 3);
    }

    #[test]
    fn test_normalize_metadata_none_stays_none() {
        assert_eq!(normalize_metadata(None), None);
    }

    #[test]
    fn test_normalize_metadata_both_none_collapses() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: None,
        };
        assert_eq!(normalize_metadata(Some(meta)), None);
    }

    #[test]
    fn test_normalize_metadata_empty_family_collapses() {
        let meta = EntryMetadata {
            font_family: Some("  ".to_string()),
            font_size: None,
        };
        assert_eq!(normalize_metadata(Some(meta)), None);
    }

    #[test]
    fn test_normalize_metadata_trims_family() {
        let meta = EntryMetadata {
            font_family: Some("  Merriweather  ".to_string()),
            font_size: None,
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_family.as_deref(), Some("Merriweather"));
    }

    #[test]
    fn test_normalize_metadata_clamps_size_low() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: Some(8.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_size, Some(12.0));
    }

    #[test]
    fn test_normalize_metadata_clamps_size_high() {
        let meta = EntryMetadata {
            font_family: None,
            font_size: Some(48.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_size, Some(24.0));
    }

    #[test]
    fn test_normalize_metadata_valid_passthrough() {
        let meta = EntryMetadata {
            font_family: Some("Georgia".to_string()),
            font_size: Some(16.0),
        };
        let result = normalize_metadata(Some(meta)).unwrap();
        assert_eq!(result.font_family.as_deref(), Some("Georgia"));
        assert_eq!(result.font_size, Some(16.0));
    }
}
