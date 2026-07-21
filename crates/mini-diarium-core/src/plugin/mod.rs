pub(crate) mod builtins;
pub(crate) mod registry;
pub mod rhai_loader;

// Curated public façade (see crates/mini-diarium-core/API.md): the registry type and the
// builtin-registration entry point are re-exported at the `plugin` root; the concrete
// builtin plugin structs stay `pub(crate)`.
pub use builtins::register_all;
pub use registry::PluginRegistry;

use crate::db::DiaryEntry;
use std::collections::HashMap;

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

/// Output from an export plugin: the formatted text content plus optional binary asset files.
///
/// Most plugins return only `content`. The built-in Markdown exporter additionally
/// returns `assets` — a list of `(filename, bytes)` pairs to be written to a
/// sibling `assets/` directory alongside the main output file.
pub struct ExportOutput {
    pub content: String,
    pub assets: Vec<(String, Vec<u8>)>,
}

/// A plugin that can export diary entries to a formatted output.
pub trait ExportPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn export(
        &self,
        entries: Vec<DiaryEntry>,
        tags: &HashMap<i64, Vec<String>>,
    ) -> Result<ExportOutput, String>;
}
