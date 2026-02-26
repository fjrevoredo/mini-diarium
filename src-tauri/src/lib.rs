pub mod auth;
pub mod backup;
pub mod commands;
pub mod config;
pub mod crypto;
pub mod db;
pub mod export;
pub mod import;
pub mod menu;
pub mod plugin;
pub mod screen_lock;

use commands::auth::DiaryState;
use log::{info, warn};
use std::path::{Path, PathBuf};
use tauri::Manager;

const LEGACY_APP_IDENTIFIER_DIR: &str = "com.minidiarium.app";

fn has_legacy_app_state(dir: &Path) -> bool {
    dir.join("config.json").is_file() || dir.join("diary.db").is_file()
}

fn resolve_app_data_dir(app_dir: PathBuf) -> PathBuf {
    if has_legacy_app_state(&app_dir) {
        return app_dir;
    }

    if let Some(parent) = app_dir.parent() {
        let legacy_dir = parent.join(LEGACY_APP_IDENTIFIER_DIR);
        if has_legacy_app_state(&legacy_dir) {
            return legacy_dir;
        }
    }

    app_dir
}

fn is_e2e_mode() -> bool {
    matches!(std::env::var("MINI_DIARIUM_E2E").as_deref(), Ok("1"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("mini_diarium_lib=info"),
    )
    .init();
    info!("Mini Diarium starting");

    let is_e2e = is_e2e_mode();
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    if is_e2e {
        info!("E2E mode detected (MINI_DIARIUM_E2E=1): window-state persistence disabled");
    } else {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .setup(|app| {
            // Get app data directory and create diary path
            let system_app_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    warn!(
                        "Could not determine app data directory ({}), using CWD as fallback",
                        e
                    );
                    PathBuf::from(".")
                }
            };

            let app_dir = resolve_app_data_dir(system_app_dir.clone());
            if app_dir != system_app_dir {
                info!(
                    "Using legacy app data directory for compatibility: {}",
                    app_dir.display()
                );
            }
            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                warn!(
                    "Failed to create app directory '{}': {}",
                    app_dir.display(),
                    e
                );
            }

            let diary_dir = if let Ok(test_dir) = std::env::var("MINI_DIARIUM_DATA_DIR") {
                // E2E test isolation — bypass journal config entirely
                PathBuf::from(test_dir)
            } else {
                let journals = crate::config::load_journals(&app_dir);
                if !journals.is_empty() {
                    // Use active journal, or first journal as fallback
                    let active_id = crate::config::load_active_journal_id(&app_dir);
                    let active =
                        active_id.and_then(|id| journals.iter().find(|j| j.id == id).cloned());
                    let journal = active.or_else(|| journals.first().cloned());
                    journal
                        .map(|j| PathBuf::from(&j.path))
                        .filter(|p| p.is_dir())
                        .unwrap_or_else(|| app_dir.clone())
                } else {
                    // Fresh install or legacy without migration trigger
                    crate::config::load_diary_dir(&app_dir)
                        .filter(|p| p.is_dir())
                        .unwrap_or_else(|| app_dir.clone())
                }
            };

            let db_path = diary_dir.join("diary.db");
            let backups_dir = diary_dir.join("backups");

            // Set up state
            app.manage(DiaryState::new(db_path, backups_dir, app_dir));

            // Initialize plugin registry
            let plugins_dir = diary_dir.join("plugins");
            let mut registry = plugin::registry::PluginRegistry::new();
            plugin::builtins::register_all(&mut registry);
            plugin::rhai_loader::load_plugins(&plugins_dir, &mut registry);
            app.manage(std::sync::Mutex::new(registry));

            // Build and set application menu
            let lockable = menu::build_menu(app.handle())?;
            app.manage(lockable);

            if let Err(error) = screen_lock::init(app.handle()) {
                warn!("Screen-lock listener initialization failed: {}", error);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth - core
            commands::auth::create_diary,
            commands::auth::unlock_diary,
            commands::auth::unlock_diary_with_keypair,
            commands::auth::lock_diary,
            commands::auth::diary_exists,
            commands::auth::is_diary_unlocked,
            commands::auth::get_diary_path,
            commands::auth::change_diary_directory,
            commands::auth::change_password,
            commands::auth::reset_diary,
            // Auth - journals
            commands::auth::list_journals,
            commands::auth::get_active_journal_id,
            commands::auth::add_journal,
            commands::auth::remove_journal,
            commands::auth::rename_journal,
            commands::auth::switch_journal,
            // Auth - method management
            commands::auth::verify_password,
            commands::auth::list_auth_methods,
            commands::auth::generate_keypair,
            commands::auth::write_key_file,
            commands::auth::register_password,
            commands::auth::register_keypair,
            commands::auth::remove_auth_method,
            // Entries
            commands::entries::save_entry,
            commands::entries::get_entry,
            commands::entries::delete_entry_if_empty,
            commands::entries::get_all_entry_dates,
            // Search
            commands::search::search_entries,
            // Navigation
            commands::navigation::navigate_previous_day,
            commands::navigation::navigate_next_day,
            commands::navigation::navigate_to_today,
            commands::navigation::navigate_previous_month,
            commands::navigation::navigate_next_month,
            // Stats
            commands::stats::get_statistics,
            // Import
            commands::import::import_minidiary_json,
            commands::import::import_dayone_json,
            commands::import::import_dayone_txt,
            commands::import::import_jrnl_json,
            // Export
            commands::export::export_json,
            commands::export::export_markdown,
            // Plugins
            commands::plugin::list_import_plugins,
            commands::plugin::list_export_plugins,
            commands::plugin::run_import_plugin,
            commands::plugin::run_export_plugin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
