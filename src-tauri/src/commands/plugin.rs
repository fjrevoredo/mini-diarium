use crate::commands::auth::{with_same_session, DiaryState};
use crate::commands::export::ExportResult;
use crate::commands::import::ImportResult;
use crate::commands::run_blocking;
use crate::export::AttachmentAsset;
use crate::plugin::{PluginInfo, PluginRegistry};
use log::{debug, error, info};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroizing;

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

    // An import writes an unbounded number of entries and has no undo. Snapshot before
    // parsing so a malformed file that half-imports is recoverable.
    crate::commands::backup_triggers::snapshot_before_destructive(&state, "run_import_plugin");

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
        let err = "Journal must be unlocked to import entries";
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
        "Plugin import complete: {} imported, {} skipped",
        result.entries_imported, result.entries_skipped
    );
    Ok(result)
}

/// Exports entries with an export plugin to `file_path`, plus a Markdown export's `assets/`.
///
/// `async`: formatting, writing, and decrypting each attachment asset runs off the WebView
/// event thread (see [`run_blocking`]).
#[tauri::command]
pub async fn run_export_plugin(
    plugin_id: String,
    file_path: String,
    date_from: Option<String>,
    date_to: Option<String>,
    app: AppHandle,
) -> Result<ExportResult, String> {
    run_blocking(app, move |app| {
        run_export_plugin_inner(
            plugin_id,
            file_path,
            date_from,
            date_to,
            &app.state::<DiaryState>(),
            &app.state::<Mutex<PluginRegistry>>(),
        )
    })
    .await
}

/// Reads a planned attachment asset, only from the journal session the export read.
///
/// The DB lock is released for formatting and re-taken per attachment. The asset plan holds
/// entry and attachment ids of that session; ids repeat across journals and across a
/// replaced file, so after a lock, switch, or reopen the same ids could name another
/// journal's files. The session check and the read share one guard; the file write that
/// follows runs without it.
fn read_asset_in_session(
    state: &DiaryState,
    session: u64,
) -> impl FnMut(&AttachmentAsset) -> Result<Zeroizing<Vec<u8>>, String> + '_ {
    move |asset| {
        with_same_session(
            state,
            session,
            "The journal changed during the export",
            |db| super::export::read_attachment_asset(db, asset),
        )
    }
}

fn run_export_plugin_inner(
    plugin_id: String,
    file_path: String,
    date_from: Option<String>,
    date_to: Option<String>,
    state: &DiaryState,
    registry: &Mutex<PluginRegistry>,
) -> Result<ExportResult, String> {
    info!(
        "Running export plugin '{}' to file: {}",
        plugin_id, file_path
    );

    // `session` pins the open journal session these entries come from, for the asset step.
    let (session, entries, tags, attachments) = {
        let db_state = state
            .db
            .lock()
            .map_err(|_| "State lock poisoned".to_string())?;
        let db = db_state.as_ref().ok_or_else(|| {
            let err = "Journal must be unlocked to export entries";
            error!("{}", err);
            err.to_string()
        })?;
        let entries = super::export::fetch_entries(db, date_from.as_deref(), date_to.as_deref())?;
        let entries = crate::db::resolve_image_refs_in_entries(db, entries)?;
        let tags = crate::db::get_tags_names_map(db)?;
        let attachments = crate::db::get_attachments_map(db)?;
        (db.session_id(), entries, tags, attachments)
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

        plugin.export(entries, &tags, &attachments).map_err(|e| {
            error!("Plugin export error: {}", e);
            e
        })?
    };

    std::fs::write(&file_path, &output.content).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        error!("{}", err);
        err
    })?;

    super::export::write_export_assets(
        &file_path,
        &output.assets,
        &output.attachment_assets,
        read_asset_in_session(state, session),
    )?;

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
    use crate::db::DiaryEntry;
    use crate::plugin::register_all;

    #[test]
    fn test_list_import_plugins_returns_builtins() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);
        let list = registry.list_importers();
        assert_eq!(list.len(), 4);
        assert!(list.iter().all(|p| p.builtin));
    }

    #[test]
    fn test_list_export_plugins_returns_builtins() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);
        let list = registry.list_exporters();
        assert_eq!(list.len(), 3);
        assert!(list.iter().all(|p| p.builtin));
    }

    /// A journal (password `test`) whose first entry has one attachment with `bytes`, so
    /// two of them share entry id 1 and attachment id 1.
    fn journal_with_attachment(bytes: &[u8]) -> (tempfile::NamedTempFile, AttachmentAsset) {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db =
            crate::db::create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry_id = crate::db::insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-15".into(),
                title: "Entry".into(),
                text: "<p>body</p>".into(),
                word_count: 1,
                date_created: "2024-01-15T00:00:00Z".into(),
                date_updated: "2024-01-15T00:00:00Z".into(),
                metadata: None,
                locked: false,
            },
        )
        .unwrap();
        let added = crate::db::add_attachment_to_entry(&db, entry_id, "notes.txt", bytes).unwrap();
        let asset = AttachmentAsset {
            entry_id,
            attachment_id: added.id,
            filename: "attachment-1-notes.txt".into(),
        };
        (tmp, asset)
    }

    fn open(path: &std::path::Path, backups: &std::path::Path) -> crate::db::DatabaseConnection {
        crate::db::open_database(path, "test".to_string(), backups).unwrap()
    }

    /// Runs the asset step of an export planned on journal A, after `switch` changed the open
    /// session, and returns its result plus every byte string written under `assets/`.
    fn export_asset_after(
        switch: impl FnOnce(&DiaryState, &std::path::Path, &std::path::Path, &std::path::Path),
    ) -> (Result<(), String>, Vec<Vec<u8>>) {
        let (_fixture, state, _db_path, backups) =
            crate::commands::auth::test_helpers::make_state("export_session");
        let (a, asset_a) = journal_with_attachment(b"journal A bytes");
        let (b, asset_b) = journal_with_attachment(b"journal B bytes");
        assert_eq!(
            (asset_a.entry_id, asset_a.attachment_id),
            (asset_b.entry_id, asset_b.attachment_id),
            "both journals must share the ids"
        );
        *state.db.lock().unwrap() = Some(open(a.path(), &backups));
        let session = state.db.lock().unwrap().as_ref().unwrap().session_id();

        let out_dir = tempfile::tempdir().unwrap();
        let md_path = out_dir.path().join("export.md");
        let mut read = read_asset_in_session(&state, session);
        let mut switch = Some(switch);
        let result = crate::commands::export::write_export_assets(
            md_path.to_str().unwrap(),
            &[],
            &[asset_a],
            |asset| {
                if let Some(switch) = switch.take() {
                    switch(&state, a.path(), b.path(), &backups);
                }
                read(asset)
            },
        );

        let written = std::fs::read_dir(out_dir.path().join("assets"))
            .map(|dir| {
                dir.map(|e| std::fs::read(e.unwrap().path()).unwrap())
                    .collect()
            })
            .unwrap_or_default();
        (result, written)
    }

    #[test]
    fn test_export_asset_reads_the_planned_session() {
        let (result, written) = export_asset_after(|_, _, _, _| {});
        result.unwrap();
        assert_eq!(written, vec![b"journal A bytes".to_vec()]);
    }

    #[test]
    fn test_export_asset_refuses_after_a_switch_to_another_journal() {
        let (result, written) = export_asset_after(|state, _a, b, backups| {
            *state.db.lock().unwrap() = Some(open(b, backups));
        });
        assert_eq!(result.unwrap_err(), "The journal changed during the export");
        assert!(written.is_empty(), "no attachment file may be written");
    }

    #[test]
    fn test_export_asset_refuses_after_a_switch_away_and_back() {
        let (result, written) = export_asset_after(|state, a, b, backups| {
            *state.db.lock().unwrap() = Some(open(b, backups));
            *state.db.lock().unwrap() = Some(open(a, backups));
        });
        assert_eq!(result.unwrap_err(), "The journal changed during the export");
        assert!(written.is_empty(), "no attachment file may be written");
    }

    #[test]
    fn test_run_import_via_registry() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);

        let plugin = registry.find_importer("builtin:minidiary-json").unwrap();
        let json = r#"{"metadata":{"version":"3.3.0"},"entries":{"2024-01-01":{"title":"Test","text":"Hello","dateUpdated":"2024-01-01T00:00:00Z"}}}"#;
        let entries = plugin.parse(json).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Test");
    }

    #[test]
    fn test_run_export_via_registry() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);

        let plugin = registry.find_exporter("builtin:json").unwrap();
        let entries = vec![DiaryEntry {
            id: 1,
            date: "2024-01-01".into(),
            title: "Test".into(),
            text: "Hello".into(),
            word_count: 1,
            date_created: "2024-01-01T00:00:00Z".into(),
            date_updated: "2024-01-01T00:00:00Z".into(),
            metadata: None,
            locked: false,
        }];
        let output = plugin
            .export(
                entries,
                &std::collections::HashMap::new(),
                &std::collections::HashMap::new(),
            )
            .unwrap();
        assert!(output.content.contains("Test"));
        assert!(output.content.contains("2024-01-01"));
    }

    #[test]
    fn test_run_export_plugin_inner_writes_markdown_and_attachment_asset() {
        let (_fixture, state, db_path, _backups) =
            crate::commands::auth::test_helpers::make_state("plugin_export_inner");
        let db = crate::db::create_database(&db_path, "test".to_string()).unwrap();
        let entry_id = crate::db::insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-15".into(),
                title: "With file".into(),
                text: "<p>body</p>".into(),
                word_count: 1,
                date_created: "2024-01-15T00:00:00Z".into(),
                date_updated: "2024-01-15T00:00:00Z".into(),
                metadata: None,
                locked: false,
            },
        )
        .unwrap();
        crate::db::add_attachment_to_entry(&db, entry_id, "notes.txt", b"attached bytes").unwrap();
        *state.db.lock().unwrap() = Some(db);
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);
        let registry = Mutex::new(registry);

        let out_dir = tempfile::tempdir().unwrap();
        let md_path = out_dir.path().join("export.md");
        let result = run_export_plugin_inner(
            "builtin:markdown".to_string(),
            md_path.to_string_lossy().to_string(),
            None,
            None,
            &state,
            &registry,
        )
        .unwrap();

        assert_eq!(result.entries_exported, 1);
        assert!(std::fs::read_to_string(&md_path)
            .unwrap()
            .contains("With file"));
        let asset = std::fs::read_dir(out_dir.path().join("assets"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(std::fs::read(asset).unwrap(), b"attached bytes");
    }

    #[test]
    fn test_import_plugin_not_found() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);

        // Mirrors the ok_or_else in run_import_plugin; use .err().unwrap() because
        // dyn ImportPlugin does not implement Debug (required by .unwrap_err())
        let plugin_id = "nonexistent-importer";
        let result = registry
            .find_importer(plugin_id)
            .ok_or_else(|| format!("Import plugin '{}' not found", plugin_id));
        assert!(result.is_err());
        assert_eq!(
            result.err().unwrap(),
            "Import plugin 'nonexistent-importer' not found"
        );
    }

    #[test]
    fn test_export_plugin_not_found() {
        let mut registry = PluginRegistry::new();
        register_all(&mut registry);

        // Mirrors the ok_or_else in run_export_plugin; use .err().unwrap() because
        // dyn ExportPlugin does not implement Debug (required by .unwrap_err())
        let plugin_id = "nonexistent-exporter";
        let result = registry
            .find_exporter(plugin_id)
            .ok_or_else(|| format!("Export plugin '{}' not found", plugin_id));
        assert!(result.is_err());
        assert_eq!(
            result.err().unwrap(),
            "Export plugin 'nonexistent-exporter' not found"
        );
    }
}
