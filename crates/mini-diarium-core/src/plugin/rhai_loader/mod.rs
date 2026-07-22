//! Discovery and loading of user-authored `.rhai` plugins.
//!
//! Split by responsibility: [`metadata`] (script header parsing) and [`runtime`]
//! (sandboxed engine + plugin wrapper structs). The directory lifecycle and the
//! loader entry points the app crate calls stay here.

use super::registry::PluginRegistry;
use log::{info, warn};
use metadata::parse_metadata;
use runtime::{create_sandboxed_engine, RhaiExportPlugin, RhaiImportPlugin};
use std::path::{Path, PathBuf};

mod metadata;
mod runtime;

#[cfg(test)]
mod test_support;

use super::PluginInfo;

// Keep plugin docs in one place: the generated `{app_data_dir}/plugins/README.md`
// is a direct copy of this repository guide.
const PLUGINS_README: &str = include_str!("../../../../../docs/user-plugins/USER_PLUGIN_GUIDE.md");

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

/// One-time migration: copy .rhai plugin files from per-journal plugin directories
/// to the new central plugins directory. Originals are left in place.
pub fn migrate_journal_plugins(old_journal_dirs: &[PathBuf], new_plugins_dir: &Path) {
    if let Err(e) = std::fs::create_dir_all(new_plugins_dir) {
        warn!("Failed to create central plugins directory: {}", e);
        return;
    }
    for journal_dir in old_journal_dirs {
        let old_plugins = journal_dir.join("plugins");
        if !old_plugins.is_dir() {
            continue;
        }
        let entries = match std::fs::read_dir(&old_plugins) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("rhai") {
                continue;
            }
            let Some(filename) = path.file_name() else {
                continue;
            };
            let dest = new_plugins_dir.join(filename);
            if dest.exists() {
                continue;
            }
            match std::fs::copy(&path, &dest) {
                Ok(_) => info!(
                    "Migrated plugin '{}' to central plugins dir",
                    path.display()
                ),
                Err(e) => warn!("Failed to migrate plugin '{}': {}", path.display(), e),
            }
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
    use super::test_support::{sample_entries, PLAIN_TEXT_TIMELINE_FIXTURE};
    use super::*;
    use std::collections::HashMap;

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

    #[test]
    fn test_load_export_plugin_fixture_from_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("plain-text-timeline.rhai"),
            PLAIN_TEXT_TIMELINE_FIXTURE,
        )
        .unwrap();

        let mut registry = PluginRegistry::new();
        load_plugins(dir.path(), &mut registry);

        let exporters = registry.list_exporters();
        assert_eq!(exporters.len(), 1);
        assert_eq!(exporters[0].id, "rhai:plain-text-timeline");
        assert_eq!(exporters[0].name, "Plain Text Timeline");
        assert_eq!(exporters[0].file_extensions, vec!["txt"]);
        assert!(!exporters[0].builtin);
    }

    #[test]
    fn test_rhai_export_plugin_fixture_output() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("plain-text-timeline.rhai"),
            PLAIN_TEXT_TIMELINE_FIXTURE,
        )
        .unwrap();

        let mut registry = PluginRegistry::new();
        load_plugins(dir.path(), &mut registry);

        let plugin = registry.find_exporter("rhai:plain-text-timeline").unwrap();
        let output = plugin.export(sample_entries(), &HashMap::new()).unwrap();
        let expected = format!(
            "2024-01-01 | (untitled)\n{}\n---\n2024-01-02 | Second\n{}",
            crate::export::markdown::html_to_markdown("<p>First body</p>"),
            crate::export::markdown::html_to_markdown("<p>Second body</p>")
        );

        assert_eq!(output.content, expected);
    }
}
