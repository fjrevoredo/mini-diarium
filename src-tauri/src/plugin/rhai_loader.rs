use super::registry::PluginRegistry;
use super::{ExportPlugin, ImportPlugin, PluginInfo};
use crate::db::queries::DiaryEntry;
use log::{info, warn};
use rhai::{Array, Dynamic, Engine, Map, Scope, AST};
use std::path::Path;

const PLUGINS_README: &str = r#"# Mini Diarium Plugins

Place `.rhai` script files in this directory to add custom import/export formats.

## Import Plugin Template

```rhai
// @name: My Format
// @type: import
// @extensions: json

fn parse(content) {
    let data = parse_json(content);
    let entries = [];
    for item in data {
        entries += #{
            date: "2024-01-01",
            title: "Entry title",
            text: "<p>HTML content</p>",
        };
    }
    entries
}
```

## Export Plugin Template

```rhai
// @name: My Export Format
// @type: export
// @extensions: txt

fn format_entries(entries) {
    let output = "";
    for entry in entries {
        output += entry.date + " - " + entry.title + "\n";
        output += entry.text + "\n\n";
    }
    output
}
```

Note: Export scripts use `format_entries` (not `export`) because `export` is a reserved keyword in Rhai.

## Available Functions

- `parse_json(string)` — Parse JSON string into a map/array
- `count_words(string)` — Count words in a string
- `now_rfc3339()` — Current timestamp in RFC 3339 format
- `html_to_markdown(string)` — Convert HTML to Markdown (useful for exports)

## Rules

- Scripts run in a sandbox: no file system access, no network
- The `date` field must be in YYYY-MM-DD format
- The `text` field should contain HTML (the editor uses TipTap)
- Import scripts must define `fn parse(content)` returning an array of entries
- Export scripts must define `fn format_entries(entries)` returning a string
"#;

/// Metadata parsed from the comment header of a .rhai script.
struct ScriptMeta {
    name: String,
    plugin_type: String, // "import" or "export"
    extensions: Vec<String>,
}

/// Parse `// @key: value` lines from the top of a script.
fn parse_metadata(source: &str) -> Option<ScriptMeta> {
    let mut name = None;
    let mut plugin_type = None;
    let mut extensions = None;

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue; // skip blank lines in header
        }
        if !trimmed.starts_with("//") {
            break; // stop at first non-comment, non-blank line
        }
        let comment = trimmed.trim_start_matches("//").trim();
        if let Some(val) = comment.strip_prefix("@name:") {
            name = Some(val.trim().to_string());
        } else if let Some(val) = comment.strip_prefix("@type:") {
            plugin_type = Some(val.trim().to_lowercase());
        } else if let Some(val) = comment.strip_prefix("@extensions:") {
            extensions = Some(
                val.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>(),
            );
        }
    }

    Some(ScriptMeta {
        name: name?,
        plugin_type: plugin_type?,
        extensions: extensions.unwrap_or_default(),
    })
}

/// Create a sandboxed Rhai engine with host-provided helper functions.
fn create_sandboxed_engine() -> Engine {
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

        entries.push(DiaryEntry {
            word_count: crate::db::queries::count_words(&text),
            date_created: now.clone(),
            date_updated: now.clone(),
            date,
            title,
            text,
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
            Dynamic::from(map)
        })
        .collect()
}

// --- Wrapper structs ---

struct RhaiImportPlugin {
    info: PluginInfo,
    script: AST,
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

struct RhaiExportPlugin {
    info: PluginInfo,
    script: AST,
}

// Safety: Same rationale as RhaiImportPlugin above.
unsafe impl Send for RhaiExportPlugin {}
unsafe impl Sync for RhaiExportPlugin {}

impl ExportPlugin for RhaiExportPlugin {
    fn info(&self) -> PluginInfo {
        self.info.clone()
    }

    fn export(&self, entries: Vec<DiaryEntry>) -> Result<String, String> {
        let engine = create_sandboxed_engine();
        let mut scope = Scope::new();
        let arr = entries_to_rhai_array(entries);
        // "export" is a reserved keyword in Rhai, so scripts use "format_entries" instead
        let result: String = engine
            .call_fn(&mut scope, &self.script, "format_entries", (arr,))
            .map_err(|e| format!("Rhai script error: {}", e))?;
        Ok(result)
    }
}

/// Ensure the plugins directory exists and contains a README.md.
pub fn ensure_plugins_dir(plugins_dir: &Path) {
    if let Err(e) = std::fs::create_dir_all(plugins_dir) {
        warn!(
            "Failed to create plugins directory '{}': {}",
            plugins_dir.display(),
            e
        );
        return;
    }
    let readme_path = plugins_dir.join("README.md");
    if !readme_path.exists() {
        if let Err(e) = std::fs::write(&readme_path, PLUGINS_README) {
            warn!("Failed to write plugins README: {}", e);
        }
    }
}

/// Scan `plugins_dir` for `.rhai` files and register them with the registry.
pub fn load_plugins(plugins_dir: &Path, registry: &mut PluginRegistry) {
    ensure_plugins_dir(plugins_dir);

    let entries = match std::fs::read_dir(plugins_dir) {
        Ok(e) => e,
        Err(e) => {
            warn!("Failed to read plugins directory: {}", e);
            return;
        }
    };

    let engine = create_sandboxed_engine();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("rhai") {
            continue;
        }

        let source = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to read plugin '{}': {}", path.display(), e);
                continue;
            }
        };

        let meta = match parse_metadata(&source) {
            Some(m) => m,
            None => {
                warn!(
                    "Plugin '{}' missing required @name and @type metadata, skipping",
                    path.display()
                );
                continue;
            }
        };

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");
        let plugin_id = format!("rhai:{}", file_stem);

        let ast = match engine.compile(&source) {
            Ok(ast) => ast,
            Err(e) => {
                warn!("Failed to compile plugin '{}': {}", path.display(), e);
                continue;
            }
        };

        let info = PluginInfo {
            id: plugin_id,
            name: meta.name,
            file_extensions: meta.extensions,
            builtin: false,
        };

        match meta.plugin_type.as_str() {
            "import" => {
                info!(
                    "Loaded Rhai import plugin '{}' from {}",
                    info.name,
                    path.display()
                );
                registry.register_importer(Box::new(RhaiImportPlugin { info, script: ast }));
            }
            "export" => {
                info!(
                    "Loaded Rhai export plugin '{}' from {}",
                    info.name,
                    path.display()
                );
                registry.register_exporter(Box::new(RhaiExportPlugin { info, script: ast }));
            }
            other => {
                warn!(
                    "Plugin '{}' has unknown @type '{}', skipping",
                    path.display(),
                    other
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_metadata_complete() {
        let source =
            "// @name: My Plugin\n// @type: import\n// @extensions: json, txt\nfn parse(c) { [] }";
        let meta = parse_metadata(source).unwrap();
        assert_eq!(meta.name, "My Plugin");
        assert_eq!(meta.plugin_type, "import");
        assert_eq!(meta.extensions, vec!["json", "txt"]);
    }

    #[test]
    fn test_parse_metadata_missing_name() {
        let source = "// @type: import\nfn parse(c) { [] }";
        assert!(parse_metadata(source).is_none());
    }

    #[test]
    fn test_parse_metadata_missing_type() {
        let source = "// @name: Test\nfn parse(c) { [] }";
        assert!(parse_metadata(source).is_none());
    }

    #[test]
    fn test_parse_metadata_no_extensions() {
        let source = "// @name: Test\n// @type: export\nfn format_entries(e) { \"\" }";
        let meta = parse_metadata(source).unwrap();
        assert!(meta.extensions.is_empty());
    }

    #[test]
    fn test_parse_metadata_with_blank_lines() {
        let source = "// @name: Test\n\n// @type: import\n// @extensions: json\nfn parse(c) { [] }";
        let meta = parse_metadata(source).unwrap();
        assert_eq!(meta.name, "Test");
        assert_eq!(meta.plugin_type, "import");
        assert_eq!(meta.extensions, vec!["json"]);
    }

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
            date: "2024-06-15".into(),
            title: "My Day".into(),
            text: "<p>content</p>".into(),
            word_count: 1,
            date_created: "2024-06-15T00:00:00Z".into(),
            date_updated: "2024-06-15T00:00:00Z".into(),
        }];

        let result = plugin.export(entries).unwrap();
        assert_eq!(result, "2024-06-15: My Day\n");
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
    fn test_load_plugins_from_dir() {
        let dir = tempfile::tempdir().unwrap();

        // Write a valid import plugin
        let script = "// @name: Temp Plugin\n// @type: import\n// @extensions: txt\nfn parse(content) { [] }";
        std::fs::write(dir.path().join("test_plugin.rhai"), script).unwrap();

        // Write a non-.rhai file (should be ignored)
        std::fs::write(dir.path().join("readme.txt"), "not a plugin").unwrap();

        let mut registry = PluginRegistry::new();
        load_plugins(dir.path(), &mut registry);

        assert_eq!(registry.list_importers().len(), 1);
        assert_eq!(registry.list_importers()[0].id, "rhai:test_plugin");
        assert_eq!(registry.list_importers()[0].name, "Temp Plugin");

        // README.md should be created
        assert!(dir.path().join("README.md").exists());
    }
}
