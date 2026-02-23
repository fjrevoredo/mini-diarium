use crate::commands::auth::DiaryState;
use crate::commands::export::ExportResult;
use crate::commands::import::ImportResult;
use crate::plugin::registry::PluginRegistry;
use crate::plugin::PluginInfo;
use log::{debug, error, info};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_import_plugins(
    registry: State<Mutex<PluginRegistry>>,
) -> Result<Vec<PluginInfo>, String> {
    let reg = registry
        .lock()
        .map_err(|_| "Registry lock poisoned".to_string())?;
    Ok(reg.list_importers())
}

#[tauri::command]
pub fn list_export_plugins(
    registry: State<Mutex<PluginRegistry>>,
) -> Result<Vec<PluginInfo>, String> {
    let reg = registry
        .lock()
        .map_err(|_| "Registry lock poisoned".to_string())?;
    Ok(reg.list_exporters())
}

#[tauri::command]
pub fn run_import_plugin(
    plugin_id: String,
    file_path: String,
    state: State<DiaryState>,
    registry: State<Mutex<PluginRegistry>>,
) -> Result<ImportResult, String> {
    info!(
        "Running import plugin '{}' on file: {}",
        plugin_id, file_path
    );

    debug!("Reading file...");
    let content = super::import::read_import_file(&file_path)?;

    // Parse with registry lock only (no DB lock needed for parsing)
    let entries = {
        let reg = registry
            .lock()
            .map_err(|_| "Registry lock poisoned".to_string())?;
        let plugin = reg
            .find_importer(&plugin_id)
            .ok_or_else(|| format!("Import plugin '{}' not found", plugin_id))?;

        debug!("Parsing with plugin '{}'...", plugin_id);
        plugin.parse(&content).map_err(|e| {
            error!("Plugin parse error: {}", e);
            e
        })?
    };
    debug!("Parsed {} entries", entries.len());

    // Import with DB lock only (registry lock released)
    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to import entries";
        error!("{}", err);
        err.to_string()
    })?;

    debug!("Importing entries...");
    let result = super::import::import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Plugin import complete: {} imported, {} merged",
        result.entries_imported, result.entries_merged
    );
    Ok(result)
}

#[tauri::command]
pub fn run_export_plugin(
    plugin_id: String,
    file_path: String,
    state: State<DiaryState>,
    registry: State<Mutex<PluginRegistry>>,
) -> Result<ExportResult, String> {
    info!(
        "Running export plugin '{}' to file: {}",
        plugin_id, file_path
    );

    // Fetch entries with DB lock only
    let entries = {
        let db_state = state
            .db
            .lock()
            .map_err(|_| "State lock poisoned".to_string())?;
        let db = db_state.as_ref().ok_or_else(|| {
            let err = "Diary must be unlocked to export entries";
            error!("{}", err);
            err.to_string()
        })?;
        super::export::fetch_all_entries(db)?
    };
    let entries_exported = entries.len();
    debug!(
        "Exporting {} entries with plugin '{}'...",
        entries_exported, plugin_id
    );

    // Format with registry lock only (DB lock released)
    let output = {
        let reg = registry
            .lock()
            .map_err(|_| "Registry lock poisoned".to_string())?;
        let plugin = reg
            .find_exporter(&plugin_id)
            .ok_or_else(|| format!("Export plugin '{}' not found", plugin_id))?;

        plugin.export(entries).map_err(|e| {
            error!("Plugin export error: {}", e);
            e
        })?
    };

    std::fs::write(&file_path, &output).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        error!("{}", err);
        err
    })?;

    info!(
        "Plugin export complete: {} entries exported to {}",
        entries_exported, file_path
    );
    Ok(ExportResult {
        entries_exported,
        file_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::plugin::builtins;

    #[test]
    fn test_list_import_plugins_returns_builtins() {
        let mut registry = PluginRegistry::new();
        builtins::register_all(&mut registry);
        let list = registry.list_importers();
        assert_eq!(list.len(), 4);
        assert!(list.iter().all(|p| p.builtin));
    }

    #[test]
    fn test_list_export_plugins_returns_builtins() {
        let mut registry = PluginRegistry::new();
        builtins::register_all(&mut registry);
        let list = registry.list_exporters();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|p| p.builtin));
    }

    #[test]
    fn test_run_import_via_registry() {
        let mut registry = PluginRegistry::new();
        builtins::register_all(&mut registry);

        let plugin = registry.find_importer("builtin:minidiary-json").unwrap();
        let json = r#"{"metadata":{"version":"3.3.0"},"entries":{"2024-01-01":{"title":"Test","text":"Hello","dateUpdated":"2024-01-01T00:00:00Z"}}}"#;
        let entries = plugin.parse(json).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Test");
    }

    #[test]
    fn test_run_export_via_registry() {
        let mut registry = PluginRegistry::new();
        builtins::register_all(&mut registry);

        let plugin = registry.find_exporter("builtin:json").unwrap();
        let entries = vec![DiaryEntry {
            date: "2024-01-01".into(),
            title: "Test".into(),
            text: "Hello".into(),
            word_count: 1,
            date_created: "2024-01-01T00:00:00Z".into(),
            date_updated: "2024-01-01T00:00:00Z".into(),
        }];
        let output = plugin.export(entries).unwrap();
        assert!(output.contains("Test"));
        assert!(output.contains("2024-01-01"));
    }
}
