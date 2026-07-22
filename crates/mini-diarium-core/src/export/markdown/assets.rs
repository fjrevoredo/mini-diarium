//! Embedded-image handling for the Markdown writers.
//!
//! Two strategies share the same `<img>` scanner: extract each data URI to a
//! sibling `assets/` file, or keep it inline as a data URI.

use super::convert::find_tag_end;
use base64::{engine::general_purpose, Engine as _};

/// Scans HTML for `<img src="data:image/…;base64,…">` tags.
/// Each match is decoded, assigned a sequential filename (`image-N.ext`),
/// and replaced with `![Image N](assets/image-N.ext)`.
/// Non-data-URI `<img>` tags are dropped.
/// Returns `(processed_html, Vec<(filename, bytes)>)`.
pub(super) fn extract_and_replace_with_assets(
    html: &str,
    counter: &mut usize,
) -> (String, Vec<(String, Vec<u8>)>) {
    let mut result = String::new();
    let mut assets: Vec<(String, Vec<u8>)> = Vec::new();
    let mut remaining = html;

    while let Some(img_start) = remaining.find("<img") {
        let after_name = &remaining[img_start + 4..];
        // Must be followed by whitespace, `>`, or `/` to be a real <img tag
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

        match find_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];

                if let Some((mime, b64_data)) = extract_src_data_uri(tag) {
                    match general_purpose::STANDARD.decode(&b64_data) {
                        Ok(bytes) => {
                            *counter += 1;
                            let ext = mime_type_to_ext(&mime);
                            let filename = format!("image-{}.{}", counter, ext);
                            result.push_str(&format!("![Image {}](assets/{})", counter, filename));
                            assets.push((filename, bytes));
                        }
                        Err(_) => {
                            // Corrupted base64 — drop the image silently
                        }
                    }
                }
                // Non-data-URI <img> tags (e.g. http://) are dropped
            }
            None => {
                // Malformed tag — emit '<' and continue
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);
    (result, assets)
}

/// Scans HTML for `<img src="data:image/…;base64,…">` tags and replaces each
/// with an inline Markdown image reference that preserves the full data URI:
/// `![Image N](data:image/TYPE;base64,DATA)`.
/// Non-data-URI `<img>` tags are dropped.
pub(super) fn inline_replace_images(html: &str, counter: &mut usize) -> String {
    let mut result = String::new();
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

        match find_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];

                if let Some((mime, b64_data)) = extract_src_data_uri(tag) {
                    *counter += 1;
                    let data_uri = format!("data:{};base64,{}", mime, b64_data);
                    result.push_str(&format!("![Image {}]({})", counter, data_uri));
                }
                // Non-data-URI <img> tags are dropped
            }
            None => {
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);
    result
}

/// Extracts `(mime_type, base64_data)` from an `<img>` tag whose `src` attribute
/// holds a `data:image/TYPE;base64,DATA` URI. Handles both `"` and `'` quoting.
/// Returns `None` for non-data-URI src values.
fn extract_src_data_uri(tag: &str) -> Option<(String, String)> {
    for &quote in &['"', '\''] {
        let pattern = format!("src={}data:image/", quote);
        if let Some(pos) = tag.find(&pattern) {
            let after = &tag[pos + pattern.len()..];
            // after: "jpeg;base64,DATA..."
            let semi = after.find(';')?;
            let mime_subtype = &after[..semi];
            let rest = &after[semi + 1..];
            // rest: "base64,DATA..."
            let b64_start = rest.strip_prefix("base64,")?;
            let q_end = b64_start.find(quote)?;
            let b64_data = &b64_start[..q_end];
            return Some((format!("image/{}", mime_subtype), b64_data.to_string()));
        }
    }
    None
}

/// Maps a MIME type to a file extension for exported image assets.
fn mime_type_to_ext(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        "image/svg+xml" => "svg",
        _ => "bin",
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{
        create_test_entry, empty_tags, tiny_png_img_tag, TINY_PNG_B64,
    };
    use super::super::{export_entries_to_markdown_inline, export_entries_to_markdown_with_assets};
    use super::*;

    #[test]
    fn test_extract_src_data_uri_jpeg() {
        let tag = r#"<img src="data:image/jpeg;base64,/9j/AAAA" alt="">"#;
        let result = extract_src_data_uri(tag);
        assert!(result.is_some(), "expected Some for jpeg data URI");
        let (mime, data) = result.unwrap();
        assert_eq!(mime, "image/jpeg");
        assert_eq!(data, "/9j/AAAA");
    }

    #[test]
    fn test_extract_src_data_uri_single_quote() {
        let tag = "<img src='data:image/png;base64,iVBOR' alt=''>";
        let result = extract_src_data_uri(tag);
        assert!(result.is_some(), "expected Some for single-quoted data URI");
        let (mime, data) = result.unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(data, "iVBOR");
    }

    #[test]
    fn test_extract_src_data_uri_non_data_uri() {
        let tag = r#"<img src="https://example.com/img.png" alt="">"#;
        assert!(extract_src_data_uri(tag).is_none());
    }

    #[test]
    fn test_mime_type_to_ext_variants() {
        assert_eq!(mime_type_to_ext("image/jpeg"), "jpg");
        assert_eq!(mime_type_to_ext("image/png"), "png");
        assert_eq!(mime_type_to_ext("image/gif"), "gif");
        assert_eq!(mime_type_to_ext("image/webp"), "webp");
        assert_eq!(mime_type_to_ext("image/bmp"), "bmp");
        assert_eq!(mime_type_to_ext("image/svg+xml"), "svg");
        assert_eq!(mime_type_to_ext("image/unknown"), "bin");
    }

    #[test]
    fn test_extract_assets_no_images() {
        let html = "<p>Just text</p>";
        let (processed, assets) = extract_and_replace_with_assets(html, &mut 0);
        assert_eq!(processed, html);
        assert!(assets.is_empty());
    }

    #[test]
    fn test_extract_assets_single_png() {
        let img_tag = tiny_png_img_tag();
        let html = format!("<p>Before</p>{}<p>After</p>", img_tag);
        let mut counter = 0usize;
        let (processed, assets) = extract_and_replace_with_assets(&html, &mut counter);

        assert_eq!(counter, 1);
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].0, "image-1.png");
        assert!(!assets[0].1.is_empty(), "decoded bytes should not be empty");
        assert!(
            processed.contains("![Image 1](assets/image-1.png)"),
            "expected markdown ref in: {}",
            processed
        );
        assert!(processed.contains("Before"));
        assert!(processed.contains("After"));
    }

    #[test]
    fn test_extract_assets_multiple_sequential() {
        let img_tag = tiny_png_img_tag();
        let html = format!("{}{}", img_tag, img_tag);
        let mut counter = 0usize;
        let (processed, assets) = extract_and_replace_with_assets(&html, &mut counter);

        assert_eq!(counter, 2);
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].0, "image-1.png");
        assert_eq!(assets[1].0, "image-2.png");
        assert!(processed.contains("![Image 1](assets/image-1.png)"));
        assert!(processed.contains("![Image 2](assets/image-2.png)"));
    }

    #[test]
    fn test_extract_assets_counter_continues_across_entries() {
        // Simulates two entries each with one image; counter carries over
        let img_tag = tiny_png_img_tag();
        let mut counter = 0usize;

        let (_, assets1) = extract_and_replace_with_assets(&img_tag, &mut counter);
        let (processed2, assets2) = extract_and_replace_with_assets(&img_tag, &mut counter);

        assert_eq!(counter, 2);
        assert_eq!(assets1[0].0, "image-1.png");
        assert_eq!(assets2[0].0, "image-2.png");
        assert!(processed2.contains("![Image 2](assets/image-2.png)"));
    }

    #[test]
    fn test_export_entries_with_assets() {
        let img_tag = tiny_png_img_tag();
        let entries = vec![create_test_entry(
            "2024-01-15",
            "My Entry",
            &format!("<p>Hello</p>{}", img_tag),
        )];
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries, &empty_tags());

        assert!(markdown.contains("## 2024-01-15"));
        assert!(markdown.contains("![Image 1](assets/image-1.png)"));
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].0, "image-1.png");
    }

    #[test]
    fn test_export_entries_with_assets_no_images() {
        let entries = vec![create_test_entry("2024-01-15", "Entry", "<p>Text only</p>")];
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries, &empty_tags());

        assert!(markdown.contains("Text only"));
        assert!(assets.is_empty());
    }

    #[test]
    fn test_inline_replace_images_embeds_data_uri() {
        let img_tag = tiny_png_img_tag();
        let html = format!("<p>Before</p>{}<p>After</p>", img_tag);
        let mut counter = 0usize;
        let processed = inline_replace_images(&html, &mut counter);

        assert_eq!(counter, 1);
        assert!(
            processed.contains(&format!(
                "![Image 1](data:image/png;base64,{})",
                TINY_PNG_B64
            )),
            "expected inline data URI ref in: {}",
            processed
        );
        assert!(processed.contains("Before"));
        assert!(processed.contains("After"));
    }

    #[test]
    fn test_inline_replace_images_no_images() {
        let html = "<p>No images here</p>";
        let mut counter = 0usize;
        let processed = inline_replace_images(html, &mut counter);
        assert_eq!(processed, html);
        assert_eq!(counter, 0);
    }

    #[test]
    fn test_export_entries_inline_embeds_data_uri() {
        let img_tag = tiny_png_img_tag();
        let entries = vec![create_test_entry(
            "2024-01-15",
            "",
            &format!("<p>Hi</p>{}", img_tag),
        )];
        let markdown = export_entries_to_markdown_inline(entries, &empty_tags());

        assert!(markdown.contains("## 2024-01-15"));
        assert!(
            markdown.contains(&format!(
                "![Image 1](data:image/png;base64,{})",
                TINY_PNG_B64
            )),
            "expected inline data URI in: {}",
            markdown
        );
    }

    #[test]
    fn test_export_entries_inline_no_images() {
        let entries = vec![create_test_entry("2024-01-15", "T", "<p>Text</p>")];
        let markdown = export_entries_to_markdown_inline(entries, &empty_tags());
        assert!(markdown.contains("Text"));
        // no data: URI in output
        assert!(!markdown.contains("data:"));
    }
}
