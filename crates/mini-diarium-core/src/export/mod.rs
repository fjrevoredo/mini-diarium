pub(crate) mod html;
pub(crate) mod json;
pub(crate) mod markdown;

// Curated public façade (see crates/mini-diarium-core/API.md). The non-façade writers
// (`export_entries_to_markdown`, `_inline`, `html_to_markdown`) stay `pub(crate)` — only
// `plugin::builtins` uses them.
pub use html::{generate_print_html, PrintLabels};
pub use json::export_entries_to_json;
pub use markdown::export_entries_to_markdown_with_assets;
