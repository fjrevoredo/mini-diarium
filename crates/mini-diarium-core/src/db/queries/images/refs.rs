//! Rewriting between inline data-URI `<img>` tags and stored `image-id://N` refs.
//!
//! Entries are persisted with `image-id://N` so the same bytes are stored once;
//! export paths resolve them back to data URIs before leaving the app.

use super::storage::{get_images_for_entry, image_exists, upsert_image};
use crate::db::schema::DatabaseConnection;

/// Substitutes `image-id://N` references with data URLs in a batch of entries.
///
/// Entries without `image-id://` refs are returned unchanged (no DB query for them).
/// Used by all export paths to ensure exported content never contains `image-id://` refs.
pub fn resolve_image_refs_in_entries(
    db: &DatabaseConnection,
    entries: Vec<crate::db::queries::DiaryEntry>,
) -> Result<Vec<crate::db::queries::DiaryEntry>, String> {
    entries
        .into_iter()
        .map(|mut entry| {
            if entry.text.contains("image-id://") {
                let images = get_images_for_entry(db, entry.id)?;
                for img in &images {
                    for quote in ['"', '\''] {
                        let pattern = format!("image-id://{}{}", img.id, quote);
                        let replacement =
                            format!("data:{};base64,{}{}", img.mime_type, img.data_base64, quote);
                        entry.text = entry.text.replace(&pattern, &replacement);
                    }
                }
            }
            Ok(entry)
        })
        .collect()
}

/// Scans HTML for data-URL `<img>` tags and `image-id://` refs.
///
/// For each `data:image/TYPE;base64,DATA` src found:
/// - decodes the base64 bytes
/// - calls `upsert_image` to store/deduplicate
/// - replaces the src with `image-id://ID`
///
/// Existing `image-id://N` refs are collected only from `<img src=...>` attributes,
/// never from arbitrary text. Invalid refs (nonexistent image IDs) are silently dropped
/// rather than passed to `replace_entry_image_links` where they would trigger a FK error.
/// Returns `(rewritten_html, all_image_ids)`.
pub fn extract_and_replace_image_refs(
    html: &str,
    db: &DatabaseConnection,
) -> Result<(String, Vec<i64>), String> {
    use base64::{engine::general_purpose, Engine as _};

    let mut result = String::new();
    let mut image_ids: Vec<i64> = Vec::new();
    let mut remaining = html;

    while let Some(img_start) = remaining.find("<img") {
        let after_name = &remaining[img_start + 4..];
        match after_name.chars().next() {
            Some(c) if c.is_ascii_whitespace() || c == '>' || c == '/' => {}
            _ => {
                result.push_str(&remaining[..img_start + 4]);
                remaining = after_name;
                continue;
            }
        }

        result.push_str(&remaining[..img_start]);
        remaining = &remaining[img_start..];

        match find_img_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];

                if let Some((mime, b64_data)) = extract_src_data_uri(tag) {
                    let bytes = general_purpose::STANDARD
                        .decode(&b64_data)
                        .map_err(|_| "Invalid embedded image data".to_string())?;

                    let image_id = upsert_image(db, &mime, &bytes)?;
                    if !image_ids.contains(&image_id) {
                        image_ids.push(image_id);
                    }
                    // Replace the entire src="data:..." attribute with image-id ref.
                    let new_tag = replace_data_src(tag, image_id);
                    result.push_str(&new_tag);
                } else {
                    // Non-data-URI src. If it's an image-id:// ref collect it, but only
                    // if the image actually exists (prevents FK failures on invalid refs).
                    if let Some(id) = extract_src_image_ref(tag) {
                        if !image_ids.contains(&id) && image_exists(db, id)? {
                            image_ids.push(id);
                        }
                    }
                    result.push_str(tag);
                }
            }
            None => {
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);

    Ok((result, image_ids))
}

/// Rewrites the `src` of every `<img src="image-id://N">` tag through `f`.
///
/// `f` receives `N` and returns `Some(new_src)` to replace only the src value, or `None` to
/// drop the whole tag. Other `<img>` tags and all text outside them stay byte-identical, so a
/// plain-text `image-id://N` mention is never touched.
pub(crate) fn rewrite_image_id_srcs<F>(html: &str, mut f: F) -> Result<String, String>
where
    F: FnMut(i64) -> Result<Option<String>, String>,
{
    let mut result = String::with_capacity(html.len());
    let mut remaining = html;

    while let Some(img_start) = remaining.find("<img") {
        let after_name = &remaining[img_start + 4..];
        match after_name.chars().next() {
            Some(c) if c.is_ascii_whitespace() || c == '>' || c == '/' => {}
            _ => {
                result.push_str(&remaining[..img_start + 4]);
                remaining = after_name;
                continue;
            }
        }

        result.push_str(&remaining[..img_start]);
        remaining = &remaining[img_start..];

        match find_img_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];
                match find_src_image_ref(tag) {
                    Some((id, value)) => {
                        if let Some(new_src) = f(id)? {
                            // Splice at the exact span the id was read from, so the src that
                            // is replaced is always the one that was resolved.
                            result.push_str(&tag[..value.start]);
                            result.push_str(&new_src);
                            result.push_str(&tag[value.end..]);
                        }
                    }
                    None => result.push_str(tag),
                }
            }
            None => {
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);

    Ok(result)
}

/// Removes every `<img src="image-id://N">` tag from `html`.
///
/// For HTML that comes from outside the journal (an import file): its `image-id://N` refs
/// name images in some other database, and in this journal the same id could name an
/// unrelated image.
pub fn strip_image_id_refs(html: &str) -> String {
    // The closure never fails, so the error arm cannot run.
    rewrite_image_id_srcs(html, |_| Ok(None)).unwrap_or_else(|_| html.to_string())
}

/// Extracts an `image-id://N` image ID from the `src` attribute of an `<img>` tag.
///
/// Returns `None` if the tag has no `src=` matching this pattern (e.g. data-URI or
/// plain URL). Handles both single and double quotes.
fn extract_src_image_ref(tag: &str) -> Option<i64> {
    find_src_image_ref(tag).map(|(id, _)| id)
}

/// Like [`extract_src_image_ref`], plus the byte range of the src *value* inside `tag`
/// (`image-id://N`, without the quotes).
fn find_src_image_ref(tag: &str) -> Option<(i64, std::ops::Range<usize>)> {
    for quote in ['"', '\''] {
        let pattern = format!("src={}image-id://", quote);
        let Some(pos) = tag.find(&pattern) else {
            continue;
        };
        let digits_start = pos + pattern.len();
        let after = &tag[digits_start..];
        let digits_len = after.chars().take_while(|c| c.is_ascii_digit()).count();
        if digits_len == 0 {
            continue;
        }
        // Ensure the closing character is the same quote (guards against partial matches).
        if !matches!(after[digits_len..].chars().next(), Some(q) if q == quote) {
            continue;
        }
        let id = after[..digits_len].parse::<i64>().ok()?;
        let value_start = pos + "src=".len() + quote.len_utf8();
        return Some((id, value_start..digits_start + digits_len));
    }
    None
}

/// Replaces `src="data:image/..."` with `src="image-id://ID"` inside an `<img>` tag.
fn replace_data_src(tag: &str, image_id: i64) -> String {
    for &quote in &['"', '\''] {
        let data_pattern = format!("src={}data:", quote);
        if let Some(pos) = tag.find(&data_pattern) {
            let before = &tag[..pos];
            let after_prefix = &tag[pos + data_pattern.len()..];
            // find closing quote
            if let Some(end) = after_prefix.find(quote) {
                let after_src = &after_prefix[end + 1..];
                return format!(
                    "{}src={}image-id://{}{}{}",
                    before, quote, image_id, quote, after_src
                );
            }
        }
    }
    // Fallback: can't replace, return tag unchanged.
    tag.to_string()
}

/// Returns the index one past the closing `>` of an img tag, respecting quoted attributes.
fn find_img_tag_end(s: &str) -> Option<usize> {
    let mut in_quote = false;
    let mut quote_char = '"';
    for (i, ch) in s.char_indices() {
        match ch {
            '"' | '\'' if !in_quote => {
                in_quote = true;
                quote_char = ch;
            }
            c if in_quote && c == quote_char => {
                in_quote = false;
            }
            '>' if !in_quote => return Some(i + 1),
            _ => {}
        }
    }
    None
}

/// Extracts `(mime_type, base64_data)` from an `<img>` tag with a data-URI src.
fn extract_src_data_uri(tag: &str) -> Option<(String, String)> {
    for &quote in &['"', '\''] {
        let pattern = format!("src={}data:image/", quote);
        if let Some(pos) = tag.find(&pattern) {
            let after = &tag[pos + pattern.len()..];
            let semi = after.find(';')?;
            let mime_subtype = &after[..semi];
            let rest = &after[semi + 1..];
            let b64_start = rest.strip_prefix("base64,")?;
            let q_end = b64_start.find(quote)?;
            let b64_data = &b64_start[..q_end];
            return Some((format!("image/{}", mime_subtype), b64_data.to_string()));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::super::storage::replace_entry_image_links;
    use super::super::test_support::{insert_blank_entry, make_db, valid_png_bytes};
    use super::*;
    use rusqlite::params;

    // --- Fix 1: single-quoted image-id:// refs must resolve ---

    #[test]
    fn test_resolve_image_refs_single_quoted() {
        let (_tmp, db) = make_db();
        let plaintext = valid_png_bytes();
        let img_id = upsert_image(&db, "image/png", &plaintext).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        // Simulate HTML stored with single-quoted attribute.
        let raw_text = format!("<img src='image-id://{}' alt=''>", img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "single-quoted ref must resolve to data URL"
        );
        assert!(
            !resolved[0].text.contains("image-id://"),
            "no unresolved image-id:// refs must remain"
        );
    }

    #[test]
    fn test_resolve_image_refs_double_quoted() {
        let (_tmp, db) = make_db();
        let plaintext = valid_png_bytes();
        let img_id = upsert_image(&db, "image/png", &plaintext).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let raw_text = format!(r#"<img src="image-id://{}" alt="">"#, img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "double-quoted ref must resolve to data URL"
        );
        assert!(!resolved[0].text.contains("image-id://"));
    }

    // --- Fix 2: existing image refs must only be collected from <img src=...> ---

    #[test]
    fn test_plain_text_image_id_ref_does_not_create_entry_images_row() {
        let (_tmp, db) = make_db();
        let img_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let entry_id = insert_blank_entry(&db);

        // Plain text mention of image-id:// — not inside an <img src=...> attribute.
        let html = format!("See image-id://{} for details", img_id);
        let (_, ids) = extract_and_replace_image_refs(&html, &db).unwrap();

        assert!(
            ids.is_empty(),
            "plain-text image-id:// must not be collected as an image reference"
        );
        // Simulate what save_entry does: only the returned ids become entry_images rows.
        replace_entry_image_links(&db, entry_id, &ids).unwrap();
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entry_images WHERE entry_id = ?1",
                params![entry_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "no entry_images row must be created for plain-text ref"
        );
    }

    #[test]
    fn test_invalid_img_src_image_id_ref_is_dropped() {
        let (_tmp, db) = make_db();
        // No images in the database — image ID 99999 does not exist.
        let html = r#"<img src="image-id://99999" alt="">"#;
        let (rewritten, ids) = extract_and_replace_image_refs(html, &db).unwrap();

        assert!(
            ids.is_empty(),
            "nonexistent image ID must be dropped from the id list"
        );
        // The tag must be preserved as-is (not corrupted).
        assert!(
            rewritten.contains("image-id://99999"),
            "tag must pass through unchanged"
        );
    }

    // --- Fix 3: export resolution tests ---

    #[test]
    fn test_resolve_image_refs_in_entries_replaces_stored_ref() {
        let (_tmp, db) = make_db();
        let img_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let raw_text = format!(r#"<p><img src="image-id://{}" alt=""></p>"#, img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "stored ref must be resolved to a data URL"
        );
        assert!(
            !resolved[0].text.contains("image-id://"),
            "no unresolved refs must remain in exported text"
        );
    }

    #[test]
    fn test_rewrite_image_id_srcs_replaces_src_in_both_quote_styles() {
        let html = r#"<p>a<img src="image-id://3" alt="x">b<img src='image-id://4' alt=''>c</p>"#;
        let out = rewrite_image_id_srcs(html, |id| Ok(Some(format!("new-{id}")))).unwrap();
        assert_eq!(
            out,
            r#"<p>a<img src="new-3" alt="x">b<img src='new-4' alt=''>c</p>"#
        );
    }

    #[test]
    fn test_rewrite_image_id_srcs_drops_tag_on_none_and_keeps_the_rest() {
        let html = concat!(
            r#"<p>see image-id://9 here<img src="image-id://9" alt="">"#,
            r#"<img src="data:image/png;base64,QUJD" alt=""><image-x></p>"#
        );
        let mut seen = Vec::new();
        let out = rewrite_image_id_srcs(html, |id| {
            seen.push(id);
            Ok(None)
        })
        .unwrap();
        assert_eq!(seen, vec![9], "only the img src ref reaches the closure");
        assert_eq!(
            out,
            concat!(
                r#"<p>see image-id://9 here"#,
                r#"<img src="data:image/png;base64,QUJD" alt=""><image-x></p>"#
            )
        );
    }

    #[test]
    fn test_rewrite_image_id_srcs_replaces_the_src_it_resolved() {
        // The double-quoted src is not a valid ref, so the id comes from the single-quoted
        // one; that is the src that must be replaced.
        let html = r#"<img src="image-id://x" src='image-id://7'>"#;
        let out = rewrite_image_id_srcs(html, |id| Ok(Some(format!("new-{id}")))).unwrap();
        assert_eq!(out, r#"<img src="image-id://x" src='new-7'>"#);
    }

    #[test]
    fn test_rewrite_image_id_srcs_propagates_closure_error() {
        let err = rewrite_image_id_srcs(r#"<img src="image-id://1">"#, |_| Err("boom".into()))
            .unwrap_err();
        assert_eq!(err, "boom");
    }

    #[test]
    fn test_strip_image_id_refs_removes_only_image_id_img_tags() {
        let html = concat!(
            r#"<p>Text image-id://5 <img src='image-id://5'>"#,
            r#"<img src="https://example.com/a.png"></p>"#
        );
        assert_eq!(
            strip_image_id_refs(html),
            r#"<p>Text image-id://5 <img src="https://example.com/a.png"></p>"#
        );
    }

    #[test]
    fn test_extract_src_image_ref_parses_double_and_single_quotes() {
        assert_eq!(
            extract_src_image_ref(r#"<img src="image-id://42" alt="">"#),
            Some(42)
        );
        assert_eq!(
            extract_src_image_ref("<img src='image-id://7' alt=''>"),
            Some(7)
        );
        assert_eq!(
            extract_src_image_ref(r#"<img src="data:image/png;base64,abc" alt="">"#),
            None
        );
        assert_eq!(
            extract_src_image_ref(r#"<img alt="image-id://5">"#),
            None,
            "must not match image-id:// outside src attribute"
        );
    }
}
