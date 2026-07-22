//! Sandboxed Rhai engine, entry ↔ Rhai marshalling, and the plugin wrapper structs.

use crate::db::queries::{DiaryEntry, EntryMetadata};
use crate::plugin::{ExportOutput, ExportPlugin, ImportPlugin, PluginInfo};
use rhai::{Array, Dynamic, Engine, Map, Scope, AST};
use std::collections::HashMap;

/// Create a sandboxed Rhai engine with host-provided helper functions.
pub(super) fn create_sandboxed_engine() -> Engine {
    let mut engine = Engine::new();

    // Safety limits
    engine.set_max_operations(1_000_000);
    engine.set_max_call_levels(32);
    engine.set_max_string_size(100 * 1024 * 1024); // 100 MB

    // Host functions
    engine.register_fn(
        "parse_json",
        |s: &str| -> Result<Dynamic, Box<rhai::EvalAltResult>> {
            serde_json::from_str::<Dynamic>(s)
                .map_err(|e| format!("parse_json failed: {}", e).into())
        },
    );

    engine.register_fn("count_words", |s: &str| -> i64 {
        crate::db::queries::count_words(s) as i64
    });

    engine.register_fn("now_rfc3339", || -> String {
        chrono::Utc::now().to_rfc3339()
    });

    engine.register_fn("html_to_markdown", |s: &str| -> String {
        crate::export::markdown::html_to_markdown(s)
    });

    engine
}

/// Convert a Rhai array of maps into `Vec<DiaryEntry>`.
fn convert_to_entries(arr: Array) -> Result<Vec<DiaryEntry>, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut entries = Vec::with_capacity(arr.len());
    for (i, item) in arr.into_iter().enumerate() {
        let map: Map = item
            .try_cast::<Map>()
            .ok_or_else(|| format!("Entry at index {} is not a map", i))?;

        let date = map
            .get("date")
            .and_then(|v| v.clone().into_string().ok())
            .ok_or_else(|| format!("Entry at index {} missing 'date' string field", i))?;
        let title = map
            .get("title")
            .and_then(|v| v.clone().into_string().ok())
            .unwrap_or_default();
        let text = map
            .get("text")
            .and_then(|v| v.clone().into_string().ok())
            .unwrap_or_default();
        let font_family = map
            .get("font_family")
            .and_then(|v| v.clone().into_string().ok());
        let font_size = map
            .get("font_size")
            .and_then(|v| v.clone().try_cast::<f64>());
        let metadata = if font_family.is_some() || font_size.is_some() {
            Some(EntryMetadata {
                font_family,
                font_size,
            })
        } else {
            None
        };

        entries.push(DiaryEntry {
            id: 0,
            word_count: crate::db::queries::count_words(&text),
            date_created: now.clone(),
            date_updated: now.clone(),
            date,
            title,
            text,
            metadata,
            locked: false,
        });
    }
    Ok(entries)
}

/// Convert `Vec<DiaryEntry>` into a Rhai-compatible array of maps.
fn entries_to_rhai_array(entries: Vec<DiaryEntry>) -> Array {
    entries
        .into_iter()
        .map(|e| {
            let mut map = Map::new();
            map.insert("date".into(), Dynamic::from(e.date));
            map.insert("title".into(), Dynamic::from(e.title));
            map.insert("text".into(), Dynamic::from(e.text));
            map.insert("word_count".into(), Dynamic::from(e.word_count as i64));
            map.insert("date_created".into(), Dynamic::from(e.date_created));
            map.insert("date_updated".into(), Dynamic::from(e.date_updated));
            if let Some(ref meta) = e.metadata {
                if let Some(ref ff) = meta.font_family {
                    map.insert("font_family".into(), Dynamic::from(ff.clone()));
                }
                if let Some(fs) = meta.font_size {
                    map.insert("font_size".into(), Dynamic::from(fs));
                }
            }
            Dynamic::from(map)
        })
        .collect()
}

// --- Wrapper structs ---

pub(super) struct RhaiImportPlugin {
    pub(super) info: PluginInfo,
    pub(super) script: AST,
}

// Safety: AST is immutable after compilation. Engine is created fresh per call_fn()
// invocation, so no shared mutable state exists across threads.
unsafe impl Send for RhaiImportPlugin {}
unsafe impl Sync for RhaiImportPlugin {}

impl ImportPlugin for RhaiImportPlugin {
    fn info(&self) -> PluginInfo {
        self.info.clone()
    }

    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String> {
        let engine = create_sandboxed_engine();
        let mut scope = Scope::new();
        let result: Array = engine
            .call_fn(&mut scope, &self.script, "parse", (content.to_string(),))
            .map_err(|e| format!("Rhai script error: {}", e))?;
        convert_to_entries(result)
    }
}

pub(super) struct RhaiExportPlugin {
    pub(super) info: PluginInfo,
    pub(super) script: AST,
}

// Safety: Same rationale as RhaiImportPlugin above.
unsafe impl Send for RhaiExportPlugin {}
unsafe impl Sync for RhaiExportPlugin {}

impl ExportPlugin for RhaiExportPlugin {
    fn info(&self) -> PluginInfo {
        self.info.clone()
    }

    fn export(
        &self,
        entries: Vec<DiaryEntry>,
        _tags: &HashMap<i64, Vec<String>>,
    ) -> Result<ExportOutput, String> {
        let engine = create_sandboxed_engine();
        let mut scope = Scope::new();
        let arr = entries_to_rhai_array(entries);
        // "export" is a reserved keyword in Rhai, so scripts use "format_entries" instead
        let content: String = engine
            .call_fn(&mut scope, &self.script, "format_entries", (arr,))
            .map_err(|e| format!("Rhai script error: {}", e))?;
        Ok(ExportOutput {
            content,
            assets: vec![],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rhai_import_plugin_basic() {
        let source = r#"
// @name: Test
// @type: import
// @extensions: json

fn parse(content) {
    let entries = [];
    entries += #{
        date: "2024-01-01",
        title: "Hello",
        text: "<p>World</p>",
    };
    entries
}
"#;
        let engine = create_sandboxed_engine();
        let ast = engine.compile(source).unwrap();
        let plugin = RhaiImportPlugin {
            info: PluginInfo {
                id: "test:rhai".into(),
                name: "Test".into(),
                file_extensions: vec!["json".into()],
                builtin: false,
            },
            script: ast,
        };

        let entries = plugin.parse("ignored").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-01-01");
        assert_eq!(entries[0].title, "Hello");
        assert_eq!(entries[0].text, "<p>World</p>");
    }

    #[test]
    fn test_rhai_export_plugin_basic() {
        let source = r#"
// @name: Test Export
// @type: export
// @extensions: txt

fn format_entries(entries) {
    let out = "";
    for e in entries {
        out += e.date + ": " + e.title + "\n";
    }
    out
}
"#;
        let engine = create_sandboxed_engine();
        let ast = engine.compile(source).unwrap();
        let plugin = RhaiExportPlugin {
            info: PluginInfo {
                id: "test:rhai-export".into(),
                name: "Test Export".into(),
                file_extensions: vec!["txt".into()],
                builtin: false,
            },
            script: ast,
        };

        let entries = vec![DiaryEntry {
            id: 1,
            date: "2024-06-15".into(),
            title: "My Day".into(),
            text: "<p>content</p>".into(),
            word_count: 1,
            date_created: "2024-06-15T00:00:00Z".into(),
            date_updated: "2024-06-15T00:00:00Z".into(),
            metadata: None,
            locked: false,
        }];

        let result = plugin.export(entries, &HashMap::new()).unwrap();
        assert_eq!(result.content, "2024-06-15: My Day\n");
    }

    #[test]
    fn test_rhai_parse_json_host_function() {
        let source = r#"
// @name: JSON Test
// @type: import
// @extensions: json

fn parse(content) {
    let data = parse_json(content);
    let entries = [];
    for item in data {
        entries += #{
            date: item.date,
            title: item.title,
            text: item.text,
        };
    }
    entries
}
"#;
        let engine = create_sandboxed_engine();
        let ast = engine.compile(source).unwrap();
        let plugin = RhaiImportPlugin {
            info: PluginInfo {
                id: "test:json-parse".into(),
                name: "JSON Test".into(),
                file_extensions: vec!["json".into()],
                builtin: false,
            },
            script: ast,
        };

        let input = r#"[{"date":"2024-03-01","title":"Test","text":"<p>Hi</p>"}]"#;
        let entries = plugin.parse(input).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-03-01");
    }

    #[test]
    fn test_rhai_export_plugin_html_to_markdown_with_link() {
        // Any Rhai export plugin that calls the `html_to_markdown` host function
        // automatically gets the named-link → `[label](url)` conversion for free
        // once the Rust converter understands `<a>` tags. This test locks in
        // that contract so the host function never regresses.
        let source = r#"
// @name: Link Test Export
// @type: export
// @extensions: md

fn format_entries(entries) {
    let out = "";
    for e in entries {
        out += html_to_markdown(e.text) + "\n";
    }
    out
}
"#;
        let engine = create_sandboxed_engine();
        let ast = engine.compile(source).unwrap();
        let plugin = RhaiExportPlugin {
            info: PluginInfo {
                id: "test:rhai-link".into(),
                name: "Link Test Export".into(),
                file_extensions: vec!["md".into()],
                builtin: false,
            },
            script: ast,
        };

        let entries = vec![DiaryEntry {
            id: 1,
            date: "2024-06-15".into(),
            title: "Title".into(),
            text: r#"<p>See <a href="https://example.com">Visit site</a> please</p>"#.into(),
            word_count: 4,
            date_created: "2024-06-15T00:00:00Z".into(),
            date_updated: "2024-06-15T00:00:00Z".into(),
            metadata: None,
            locked: false,
        }];

        let result = plugin.export(entries, &HashMap::new()).unwrap();
        assert!(
            result.content.contains("[Visit site](https://example.com)"),
            "expected link in Rhai plugin output: {}",
            result.content
        );
    }

    #[test]
    fn test_entries_to_rhai_array_includes_metadata_fields() {
        let entries = vec![DiaryEntry {
            id: 1,
            date: "2024-01-01".into(),
            title: "Styled".into(),
            text: "<p>Content</p>".into(),
            word_count: 1,
            date_created: "2024-01-01T00:00:00Z".into(),
            date_updated: "2024-01-01T00:00:00Z".into(),
            metadata: Some(crate::db::queries::EntryMetadata {
                font_family: Some("Georgia".to_string()),
                font_size: Some(16.0),
            }),
            locked: false,
        }];
        let arr = entries_to_rhai_array(entries);
        let map = arr[0].clone().try_cast::<Map>().unwrap();
        assert_eq!(
            map.get("font_family")
                .and_then(|v| v.clone().into_string().ok())
                .as_deref(),
            Some("Georgia")
        );
        assert_eq!(
            map.get("font_size")
                .and_then(|v| v.clone().try_cast::<f64>()),
            Some(16.0)
        );
    }

    #[test]
    fn test_convert_to_entries_reads_metadata_fields() {
        let mut map = Map::new();
        map.insert("date".into(), Dynamic::from("2024-01-01".to_string()));
        map.insert("title".into(), Dynamic::from("T".to_string()));
        map.insert("text".into(), Dynamic::from("<p>X</p>".to_string()));
        map.insert(
            "font_family".into(),
            Dynamic::from("Times New Roman".to_string()),
        );
        map.insert("font_size".into(), Dynamic::from(14.0f64));
        let arr: Array = vec![Dynamic::from(map)];

        let entries = convert_to_entries(arr).unwrap();
        let meta = entries[0].metadata.as_ref().unwrap();
        assert_eq!(meta.font_family.as_deref(), Some("Times New Roman"));
        assert_eq!(meta.font_size, Some(14.0));
    }

    #[test]
    fn test_convert_to_entries_without_metadata_is_none() {
        let mut map = Map::new();
        map.insert("date".into(), Dynamic::from("2024-01-01".to_string()));
        map.insert("text".into(), Dynamic::from("<p>X</p>".to_string()));
        let arr: Array = vec![Dynamic::from(map)];

        let entries = convert_to_entries(arr).unwrap();
        assert!(entries[0].metadata.is_none());
    }
}
