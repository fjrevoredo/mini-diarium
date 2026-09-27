//! Attachment handling shared by the exporters (TODO-0114).
//!
//! Exporters never see attachment bytes. They get each entry's [`AttachmentSummary`] list
//! and render metadata; the Markdown-with-assets writer additionally returns an
//! [`AttachmentAsset`] plan that the caller (which holds the DB handle) resolves into
//! decrypted files under `assets/`.

use crate::db::queries::attachments::rewrite_attachment_refs;
use crate::db::queries::AttachmentSummary;
use std::collections::HashMap;

/// Per-entry attachment lists keyed by entry id (see `db::get_attachments_map`).
pub type AttachmentsMap = HashMap<i64, Vec<AttachmentSummary>>;

/// One attachment file the caller must decrypt and write to `assets/{filename}`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentAsset {
    pub entry_id: i64,
    pub attachment_id: i64,
    pub filename: String,
}

/// Longest sanitized name part of an asset file name, in characters.
const MAX_ASSET_NAME_CHARS: usize = 100;

/// Builds `attachment-{n}-{sanitized name}`: only ASCII alphanumerics, `.`, `-`, `_` survive,
/// so the file name is safe on every OS and needs no escaping in a Markdown link.
pub(crate) fn attachment_asset_filename(n: usize, name: &str) -> String {
    let mut sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = sanitized.trim_matches(|c| c == '.' || c == '_').to_string();
    sanitized = if trimmed.is_empty() {
        "file".to_string()
    } else {
        trimmed
    };
    if sanitized.chars().count() > MAX_ASSET_NAME_CHARS {
        // Keep the tail so the extension survives truncation.
        let skip = sanitized.chars().count() - MAX_ASSET_NAME_CHARS;
        sanitized = sanitized.chars().skip(skip).collect();
    }
    format!("attachment-{}-{}", n, sanitized)
}

/// Escapes text for insertion into entry HTML before conversion (the converter decodes
/// these entities back).
pub(crate) fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Escapes a Markdown link label.
fn escape_md_label(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

/// Human-readable size (`1.2 MB`, `340 KB`, `12 B`).
pub(crate) fn format_size(bytes: i64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    let b = bytes as f64;
    if b >= MB {
        format!("{:.1} MB", b / MB)
    } else if b >= KB {
        format!("{:.0} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

fn entry_attachments(attachments: &AttachmentsMap, entry_id: i64) -> &[AttachmentSummary] {
    attachments
        .get(&entry_id)
        .map(|v| v.as_slice())
        .unwrap_or(&[])
}

/// Replaces ref spans in `html` using the entry's attachment list; refs to attachments the
/// entry no longer links are dropped.
fn rewrite_refs_by_summary<F>(html: &str, list: &[AttachmentSummary], mut render: F) -> String
where
    F: FnMut(&AttachmentSummary) -> String,
{
    rewrite_attachment_refs(html, |id| {
        list.iter()
            .find(|a| a.id == id)
            .map(&mut render)
            .unwrap_or_default()
    })
}

/// Markdown with assets: plans one asset per attachment, rewrites ref spans to links, and
/// returns `(html_with_links, attachments_section_markdown, assets)`.
pub(crate) fn markdown_with_asset_links(
    entry_id: i64,
    html: &str,
    attachments: &AttachmentsMap,
    counter: &mut usize,
) -> (String, String, Vec<AttachmentAsset>) {
    let list = entry_attachments(attachments, entry_id);
    let mut assets = Vec::with_capacity(list.len());
    let mut filenames: HashMap<i64, String> = HashMap::new();
    for a in list {
        *counter += 1;
        let filename = attachment_asset_filename(*counter, &a.name);
        filenames.insert(a.id, filename.clone());
        assets.push(AttachmentAsset {
            entry_id,
            attachment_id: a.id,
            filename,
        });
    }

    let link = |a: &AttachmentSummary| {
        format!(
            "[{}](assets/{})",
            escape_md_label(&a.name),
            filenames.get(&a.id).map(String::as_str).unwrap_or_default()
        )
    };
    let html = rewrite_refs_by_summary(html, list, |a| escape_html(&link(a)));
    let section = markdown_section(list, |a| link(a));
    (html, section, assets)
}

/// Markdown without assets: ref spans become `📎 name`, the section lists names and sizes.
pub(crate) fn markdown_metadata_only(
    entry_id: i64,
    html: &str,
    attachments: &AttachmentsMap,
) -> (String, String) {
    let list = entry_attachments(attachments, entry_id);
    let html = rewrite_refs_by_summary(html, list, |a| escape_html(&format!("📎 {}", a.name)));
    let section = markdown_section(list, |a| {
        format!(
            "{} ({})",
            escape_md_label(&a.name),
            format_size(a.byte_size)
        )
    });
    (html, section)
}

fn markdown_section<F>(list: &[AttachmentSummary], item: F) -> String
where
    F: Fn(&AttachmentSummary) -> String,
{
    if list.is_empty() {
        return String::new();
    }
    let mut out = String::from("*Attachments:*\n");
    for a in list {
        out.push_str(&format!("- {}\n", item(a)));
    }
    out
}

/// Print/HTML: ref spans become an inline `📎 name` label.
pub(crate) fn print_rewrite_refs(
    entry_id: i64,
    html: &str,
    attachments: &AttachmentsMap,
) -> String {
    let list = entry_attachments(attachments, entry_id);
    rewrite_refs_by_summary(html, list, |a| {
        format!(
            r#"<span class="md-print-attachment-ref">📎 {}</span>"#,
            escape_html(&a.name)
        )
    })
}

/// Names of the entry's attachments, in link order.
pub(crate) fn attachment_names(entry_id: i64, attachments: &AttachmentsMap) -> Vec<&str> {
    entry_attachments(attachments, entry_id)
        .iter()
        .map(|a| a.name.as_str())
        .collect()
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;

    pub fn summary(id: i64, name: &str, byte_size: i64) -> AttachmentSummary {
        AttachmentSummary {
            id,
            name: name.to_string(),
            mime_type: crate::db::queries::mime_for_extension(name).to_string(),
            byte_size,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    pub fn empty_attachments() -> AttachmentsMap {
        HashMap::new()
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::summary;
    use super::*;

    #[test]
    fn test_attachment_asset_filename_sanitizes_and_keeps_extension() {
        assert_eq!(
            attachment_asset_filename(1, "Report.pdf"),
            "attachment-1-Report.pdf"
        );
        assert_eq!(
            attachment_asset_filename(2, "my notes (v2).docx"),
            "attachment-2-my_notes__v2_.docx"
        );
        assert_eq!(
            attachment_asset_filename(3, "../../etc"),
            "attachment-3-etc"
        );
        assert_eq!(attachment_asset_filename(4, "日本"), "attachment-4-file");
        let long = format!("{}.pdf", "a".repeat(300));
        let name = attachment_asset_filename(5, &long);
        assert!(name.ends_with(".pdf"));
        assert!(name.len() <= "attachment-5-".len() + MAX_ASSET_NAME_CHARS);
    }

    #[test]
    fn test_markdown_with_asset_links_plans_assets_and_rewrites_refs() {
        let map = HashMap::from([(
            7i64,
            vec![summary(1, "a [x].pdf", 10), summary(2, "b.txt", 20)],
        )]);
        let mut counter = 0;
        let html = r#"<p>See <span data-attachment-ref="2"></span> and <span data-attachment-ref="99"></span></p>"#;
        let (out, section, assets) = markdown_with_asset_links(7, html, &map, &mut counter);

        assert_eq!(counter, 2);
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].filename, "attachment-1-a__x_.pdf");
        assert_eq!(assets[1].attachment_id, 2);
        assert_eq!(out, "<p>See [b.txt](assets/attachment-2-b.txt) and </p>");
        assert!(section.contains("- [a \\[x\\].pdf](assets/attachment-1-a__x_.pdf)"));
    }

    #[test]
    fn test_markdown_metadata_only_lists_names_and_sizes() {
        let map = HashMap::from([(1i64, vec![summary(5, "clip.mp4", 2 * 1024 * 1024)])]);
        let (out, section) =
            markdown_metadata_only(1, r#"<p><span data-attachment-ref="5"></span></p>"#, &map);
        assert_eq!(out, "<p>📎 clip.mp4</p>");
        assert_eq!(section, "*Attachments:*\n- clip.mp4 (2.0 MB)\n");
    }

    #[test]
    fn test_print_rewrite_escapes_names() {
        let map = HashMap::from([(1i64, vec![summary(5, "<b>.txt", 1)])]);
        let out = print_rewrite_refs(1, r#"<span data-attachment-ref="5"></span>"#, &map);
        assert!(out.contains("📎 &lt;b&gt;.txt"), "got: {}", out);
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(12), "12 B");
        assert_eq!(format_size(2048), "2 KB");
        assert_eq!(format_size(3 * 1024 * 1024 / 2), "1.5 MB");
    }
}
