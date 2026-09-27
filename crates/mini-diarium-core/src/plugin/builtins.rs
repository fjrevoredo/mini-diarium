use super::{ExportOutput, ExportPlugin, ImportPlugin, PluginInfo};
use crate::db::queries::DiaryEntry;
use crate::export::{json, markdown, AttachmentsMap};
use crate::import::{dayone, dayone_txt, jrnl, minidiary};
use crate::plugin::registry::PluginRegistry;
use std::collections::HashMap;

// --- Import plugins ---

pub struct MiniDiaryImporter;

impl ImportPlugin for MiniDiaryImporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:minidiary-json".into(),
            name: "Mini Diary JSON".into(),
            file_extensions: vec!["json".into()],
            builtin: true,
        }
    }

    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String> {
        minidiary::parse_minidiary_json(content)
    }
}

pub struct DayOneJsonImporter;

impl ImportPlugin for DayOneJsonImporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:dayone-json".into(),
            name: "Day One JSON".into(),
            file_extensions: vec!["json".into()],
            builtin: true,
        }
    }

    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String> {
        dayone::parse_dayone_json(content)
    }
}

pub struct DayOneTxtImporter;

impl ImportPlugin for DayOneTxtImporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:dayone-txt".into(),
            name: "Day One TXT".into(),
            file_extensions: vec!["txt".into()],
            builtin: true,
        }
    }

    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String> {
        dayone_txt::parse_dayone_txt(content)
    }
}

pub struct JrnlImporter;

impl ImportPlugin for JrnlImporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:jrnl-json".into(),
            name: "jrnl JSON".into(),
            file_extensions: vec!["json".into()],
            builtin: true,
        }
    }

    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String> {
        jrnl::parse_jrnl_json(content)
    }
}

// --- Export plugins ---

pub struct JsonExporter;

impl ExportPlugin for JsonExporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:json".into(),
            name: "Mini Diary JSON".into(),
            file_extensions: vec!["json".into()],
            builtin: true,
        }
    }

    fn export(
        &self,
        entries: Vec<DiaryEntry>,
        tags: &HashMap<i64, Vec<String>>,
        attachments: &AttachmentsMap,
    ) -> Result<ExportOutput, String> {
        let content = json::export_entries_to_json(entries, tags, attachments)?;
        Ok(ExportOutput {
            content,
            ..Default::default()
        })
    }
}

pub struct MarkdownExporter;

impl ExportPlugin for MarkdownExporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:markdown".into(),
            name: "Markdown".into(),
            file_extensions: vec!["md".into()],
            builtin: true,
        }
    }

    fn export(
        &self,
        entries: Vec<DiaryEntry>,
        tags: &HashMap<i64, Vec<String>>,
        attachments: &AttachmentsMap,
    ) -> Result<ExportOutput, String> {
        let (content, assets, attachment_assets) =
            markdown::export_entries_to_markdown_with_assets(entries, tags, attachments);
        Ok(ExportOutput {
            content,
            assets,
            attachment_assets,
        })
    }
}

pub struct MarkdownInlineExporter;

impl ExportPlugin for MarkdownInlineExporter {
    fn info(&self) -> PluginInfo {
        PluginInfo {
            id: "builtin:markdown-inline".into(),
            name: "Markdown (inline images)".into(),
            file_extensions: vec!["md".into()],
            builtin: true,
        }
    }

    fn export(
        &self,
        entries: Vec<DiaryEntry>,
        tags: &HashMap<i64, Vec<String>>,
        attachments: &AttachmentsMap,
    ) -> Result<ExportOutput, String> {
        Ok(ExportOutput {
            content: markdown::export_entries_to_markdown_inline(entries, tags, attachments),
            ..Default::default()
        })
    }
}

/// Register all built-in import and export plugins.
pub fn register_all(registry: &mut PluginRegistry) {
    registry.register_importer(Box::new(MiniDiaryImporter));
    registry.register_importer(Box::new(DayOneJsonImporter));
    registry.register_importer(Box::new(DayOneTxtImporter));
    registry.register_importer(Box::new(JrnlImporter));
    registry.register_exporter(Box::new(JsonExporter));
    registry.register_exporter(Box::new(MarkdownExporter));
    registry.register_exporter(Box::new(MarkdownInlineExporter));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_importer_info() {
        let plugin = MiniDiaryImporter;
        let info = plugin.info();
        assert_eq!(info.id, "builtin:minidiary-json");
        assert!(info.builtin);
        assert_eq!(info.file_extensions, vec!["json"]);
    }

    #[test]
    fn test_builtin_exporter_info() {
        let plugin = JsonExporter;
        let info = plugin.info();
        assert_eq!(info.id, "builtin:json");
        assert!(info.builtin);
    }

    #[test]
    fn test_register_all() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);
        assert_eq!(registry.list_importers().len(), 4);
        assert_eq!(registry.list_exporters().len(), 3);
    }

    fn entry_with_ref() -> DiaryEntry {
        DiaryEntry {
            id: 1,
            date: "2024-01-15".into(),
            title: "T".into(),
            text: r#"<p>See <span data-attachment-ref="5"></span></p>"#.into(),
            word_count: 1,
            date_created: "2024-01-15T00:00:00Z".into(),
            date_updated: "2024-01-15T00:00:00Z".into(),
            metadata: None,
            locked: false,
        }
    }

    fn one_attachment() -> AttachmentsMap {
        HashMap::from([(
            1i64,
            vec![crate::export::attachments::test_support::summary(
                5,
                "Report.pdf",
                10,
            )],
        )])
    }

    #[test]
    fn test_markdown_exporter_plans_attachment_assets() {
        let output = MarkdownExporter
            .export(vec![entry_with_ref()], &HashMap::new(), &one_attachment())
            .unwrap();
        assert_eq!(output.attachment_assets.len(), 1);
        assert_eq!(output.attachment_assets[0].attachment_id, 5);
        assert!(output
            .content
            .contains("[Report.pdf](assets/attachment-1-Report.pdf)"));
    }

    #[test]
    fn test_markdown_inline_exporter_lists_attachments_without_assets() {
        let output = MarkdownInlineExporter
            .export(vec![entry_with_ref()], &HashMap::new(), &one_attachment())
            .unwrap();
        assert!(output.attachment_assets.is_empty());
        assert!(output.assets.is_empty());
        assert!(output.content.contains("📎 Report.pdf"));
        assert!(output
            .content
            .contains("*Attachments:*\n- Report.pdf (10 B)"));
    }
}
