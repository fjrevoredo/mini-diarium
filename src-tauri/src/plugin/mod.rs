pub mod builtins;
pub mod registry;
pub mod rhai_loader;

use crate::db::queries::DiaryEntry;

/// Metadata about a plugin, returned to the frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub file_extensions: Vec<String>,
    pub builtin: bool,
}

/// A plugin that can parse file content into diary entries for import.
pub trait ImportPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String>;
}

/// A plugin that can export diary entries to a string format.
pub trait ExportPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn export(&self, entries: Vec<DiaryEntry>) -> Result<String, String>;
}
