//! Markdown export.
//!
//! The public writers live here; the conversion pipeline is split by responsibility:
//! [`convert`] (stage tables + driver), [`blocks`] (lists, code blocks, blockquotes),
//! [`links`] (`<a>` → `[label](url)`), and [`assets`] (embedded `<img>` data URIs).

use super::attachments::{
    markdown_metadata_only, markdown_with_asset_links, AttachmentAsset, AttachmentsMap,
};
use crate::db::queries::DiaryEntry;
use std::collections::HashMap;

mod assets;
mod blocks;
mod convert;
mod links;

#[cfg(test)]
mod test_support;

pub(crate) use convert::html_to_markdown;

use assets::{extract_and_replace_with_assets, inline_replace_images};

/// Exports diary entries to a Markdown-formatted string
///
/// Entries are grouped by date. If a date has multiple entries, each entry
/// gets a `### Title` (or `### Entry N` if title is empty) sub-heading.
///
/// Format (single entry per day):
/// ```markdown
/// # Mini Diarium
///
/// ## 2024-01-15
/// **My Title**
/// Entry content here...
/// ```
///
/// Format (multiple entries per day):
/// ```markdown
/// # Mini Diarium
///
/// ## 2024-01-15
/// ### Morning Entry
/// Content...
///
/// ### Entry 2
/// More content...
/// ```
///
/// HTML content from TipTap is converted to Markdown.
///
/// Image-free plain-Markdown export. Production paths use
/// [`export_entries_to_markdown_with_assets`] / [`export_entries_to_markdown_inline`]
/// (which handle embedded images); this simpler form is retained as a unit-test entry
/// point for the shared `html_to_markdown` conversion, hence `#[cfg(test)]`.
#[cfg(test)]
fn export_entries_to_markdown(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
) -> String {
    walk_date_groups(&entries, tags, |entry| html_to_markdown(&entry.text))
}

// --- Shared walker ---

fn group_entries_by_date(entries: &[DiaryEntry]) -> Vec<(&str, Vec<&DiaryEntry>)> {
    let mut date_groups: Vec<(&str, Vec<&DiaryEntry>)> = Vec::new();
    for entry in entries {
        if let Some((last_date, group)) = date_groups.last_mut() {
            if *last_date == entry.date.as_str() {
                group.push(entry);
                continue;
            }
        }
        date_groups.push((entry.date.as_str(), vec![entry]));
    }
    date_groups
}

fn walk_date_groups<F>(
    entries: &[DiaryEntry],
    tags: &HashMap<i64, Vec<String>>,
    mut render_entry_text: F,
) -> String
where
    F: FnMut(&DiaryEntry) -> String,
{
    let mut output = String::from("# Mini Diarium\n");
    for (date, group) in group_entries_by_date(entries) {
        output.push_str(&format!("\n## {}\n", date));
        let multi = group.len() > 1;
        for (i, entry) in group.iter().enumerate() {
            if multi {
                let heading = if entry.title.is_empty() {
                    format!("Entry {}", i + 1)
                } else {
                    entry.title.clone()
                };
                output.push_str(&format!("### {}\n", heading));
            } else if !entry.title.is_empty() {
                output.push_str(&format!("**{}**\n", entry.title));
            }
            let entry_tags = tags.get(&entry.id).map(|t| t.as_slice()).unwrap_or(&[]);
            if !entry_tags.is_empty() {
                output.push_str(&format!("*Tags: {}*\n", entry_tags.join(", ")));
            }
            let text = render_entry_text(entry);
            if !text.is_empty() {
                output.push_str(&text);
                if !text.ends_with('\n') {
                    output.push('\n');
                }
            }
            if multi && i + 1 < group.len() {
                output.push('\n');
            }
        }
    }
    output
}

/// Appends an entry's `*Attachments:*` section (if any) after its converted text.
fn with_attachments_section(text: String, section: String) -> String {
    if section.is_empty() {
        return text;
    }
    if text.is_empty() {
        return section;
    }
    format!("{}\n\n{}", text.trim_end_matches('\n'), section)
}

/// Output of [`export_entries_to_markdown_with_assets`]: the Markdown text, the embedded
/// image files as `(filename, bytes)`, and the attachment files the caller must decrypt.
pub type MarkdownWithAssets = (String, Vec<(String, Vec<u8>)>, Vec<AttachmentAsset>);

// --- Image-aware export variants ---

/// Exports diary entries to Markdown, extracting embedded base64 images to
/// separate asset files.
///
/// Returns `(markdown_string, assets, attachment_assets)`:
/// - `assets` is a list of `(filename, bytes)` image pairs to be written to a sibling
///   `assets/` directory. Image references use `![Image N](assets/image-N.ext)`.
/// - `attachment_assets` names each attachment file the caller must decrypt into the same
///   `assets/` directory (this writer never sees attachment bytes). Inline attachment refs
///   become `[name](assets/attachment-N-name)` and each entry gets an `*Attachments:*` list.
pub fn export_entries_to_markdown_with_assets(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
    attachments: &AttachmentsMap,
) -> MarkdownWithAssets {
    let mut all_assets: Vec<(String, Vec<u8>)> = Vec::new();
    let mut attachment_assets: Vec<AttachmentAsset> = Vec::new();
    let mut image_counter: usize = 0;
    let mut attachment_counter: usize = 0;
    let markdown = walk_date_groups(&entries, tags, |entry| {
        // Refs first: the converter strips unknown spans, so a ref left in place vanishes.
        let (html, section, entry_attachment_assets) =
            markdown_with_asset_links(entry.id, &entry.text, attachments, &mut attachment_counter);
        attachment_assets.extend(entry_attachment_assets);
        let (processed_html, entry_assets) =
            extract_and_replace_with_assets(&html, &mut image_counter);
        all_assets.extend(entry_assets);
        with_attachments_section(html_to_markdown(&processed_html), section)
    });
    (markdown, all_assets, attachment_assets)
}

/// Exports diary entries to Markdown, embedding base64 images as inline data URIs.
///
/// Each `<img src="data:image/TYPE;base64,DATA">` becomes
/// `![Image N](data:image/TYPE;base64,DATA)` — readable by editors that support
/// embedded data URIs (e.g. Obsidian, VS Code preview). Produces a single file
/// with no external assets. Attachments are listed by name and size only (their bytes
/// are not exported); inline refs become `📎 name`.
pub fn export_entries_to_markdown_inline(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
    attachments: &AttachmentsMap,
) -> String {
    let mut image_counter: usize = 0;
    walk_date_groups(&entries, tags, |entry| {
        let (html, section) = markdown_metadata_only(entry.id, &entry.text, attachments);
        let processed_html = inline_replace_images(&html, &mut image_counter);
        with_attachments_section(html_to_markdown(&processed_html), section)
    })
}

#[cfg(test)]
mod tests {
    use super::test_support::{create_test_entry, empty_tags, entry_with_id};
    use super::*;
    use crate::export::attachments::test_support::{empty_attachments, summary};

    #[test]
    fn test_export_empty_list() {
        let result = export_entries_to_markdown(vec![], &empty_tags());
        assert_eq!(result, "# Mini Diarium\n");
    }

    #[test]
    fn test_export_single_entry_plaintext() {
        let entries = vec![create_test_entry("2024-01-15", "My Entry", "Hello world")];

        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(result.contains("# Mini Diarium"));
        assert!(result.contains("## 2024-01-15"));
        assert!(result.contains("**My Entry**"));
        assert!(result.contains("Hello world"));
    }

    #[test]
    fn test_export_multiple_entries_sorted() {
        let entries = vec![
            create_test_entry("2024-01-01", "First", "Content one"),
            create_test_entry("2024-01-02", "Second", "Content two"),
            create_test_entry("2024-01-03", "Third", "Content three"),
        ];

        let result = export_entries_to_markdown(entries, &empty_tags());
        let first_pos = result.find("## 2024-01-01").unwrap();
        let second_pos = result.find("## 2024-01-02").unwrap();
        let third_pos = result.find("## 2024-01-03").unwrap();

        assert!(first_pos < second_pos);
        assert!(second_pos < third_pos);
    }

    #[test]
    fn test_export_entry_without_title() {
        let entries = vec![create_test_entry("2024-01-15", "", "Just text")];

        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(result.contains("## 2024-01-15"));
        assert!(!result.contains("****")); // No empty bold
        assert!(result.contains("Just text"));
    }

    #[test]
    fn test_export_markdown_entry_with_tags_shows_tags_line() {
        let entries = vec![entry_with_id(1, "2024-01-15", "My Entry", "<p>Content</p>")];
        let tags = HashMap::from([(1i64, vec!["travel".to_string(), "work".to_string()])]);
        let result = export_entries_to_markdown(entries, &tags);
        assert!(result.contains("*Tags: travel, work*"), "got: {}", result);
    }

    #[test]
    fn test_export_markdown_entry_without_tags_no_tags_line() {
        let entries = vec![entry_with_id(1, "2024-01-15", "My Entry", "<p>Content</p>")];
        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(!result.contains("*Tags:"), "got: {}", result);
    }

    #[test]
    fn test_export_markdown_with_assets_includes_tags() {
        let entries = vec![entry_with_id(2, "2024-01-15", "Title", "<p>Hi</p>")];
        let tags = HashMap::from([(2i64, vec!["journal".to_string()])]);
        let (markdown, _, _) =
            export_entries_to_markdown_with_assets(entries, &tags, &empty_attachments());
        assert!(markdown.contains("*Tags: journal*"), "got: {}", markdown);
    }

    #[test]
    fn test_export_markdown_with_assets_rewrites_attachment_refs_and_lists_files() {
        let entries = vec![entry_with_id(
            3,
            "2024-01-15",
            "Title",
            r#"<p>Read <span data-attachment-ref="11"></span> today.</p>"#,
        )];
        let attachments = HashMap::from([(
            3i64,
            vec![summary(11, "Report.pdf", 100), summary(12, "clip.mp4", 200)],
        )]);
        let (markdown, images, planned) =
            export_entries_to_markdown_with_assets(entries, &empty_tags(), &attachments);

        assert!(images.is_empty());
        assert!(
            markdown.contains("Read [Report.pdf](assets/attachment-1-Report.pdf) today."),
            "got: {}",
            markdown
        );
        assert!(
            markdown.contains(
                "*Attachments:*\n- [Report.pdf](assets/attachment-1-Report.pdf)\n- [clip.mp4](assets/attachment-2-clip.mp4)"
            ),
            "got: {}",
            markdown
        );
        assert_eq!(
            planned,
            vec![
                AttachmentAsset {
                    entry_id: 3,
                    attachment_id: 11,
                    filename: "attachment-1-Report.pdf".into()
                },
                AttachmentAsset {
                    entry_id: 3,
                    attachment_id: 12,
                    filename: "attachment-2-clip.mp4".into()
                },
            ]
        );
    }

    #[test]
    fn test_export_markdown_inline_lists_attachment_metadata_only() {
        let entries = vec![entry_with_id(
            3,
            "2024-01-15",
            "",
            r#"<p><span data-attachment-ref="11"></span></p>"#,
        )];
        let attachments = HashMap::from([(3i64, vec![summary(11, "Report.pdf", 2048)])]);
        let markdown = export_entries_to_markdown_inline(entries, &empty_tags(), &attachments);
        assert!(markdown.contains("📎 Report.pdf"), "got: {}", markdown);
        assert!(
            markdown.contains("- Report.pdf (2 KB)"),
            "got: {}",
            markdown
        );
        assert!(!markdown.contains("assets/"), "got: {}", markdown);
    }

    #[test]
    fn test_export_entries_markdown_with_link_round_trip() {
        let entries = vec![create_test_entry(
            "2024-01-15",
            "Title",
            r#"<p>See <a href="https://example.com">Visit site</a> please</p>"#,
        )];
        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(
            result.contains("[Visit site](https://example.com)"),
            "expected link in exported markdown: {}",
            result
        );
        assert!(result.contains("**Title**"), "expected entry title");
    }
}
