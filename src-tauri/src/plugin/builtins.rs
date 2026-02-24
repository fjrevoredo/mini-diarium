use super::{ExportPlugin, ImportPlugin, PluginInfo};
use crate::db::queries::DiaryEntry;
use crate::export::{json, markdown};
use crate::import::{dayone, dayone_txt, jrnl, minidiary};
use crate::plugin::registry::PluginRegistry;

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

    fn export(&self, entries: Vec<DiaryEntry>) -> Result<String, String> {
        json::export_entries_to_json(entries)
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

    fn export(&self, entries: Vec<DiaryEntry>) -> Result<String, String> {
        Ok(markdown::export_entries_to_markdown(entries))
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
        assert_eq!(registry.list_exporters().len(), 2);
    }
}
