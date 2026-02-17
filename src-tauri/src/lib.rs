pub mod auth;
pub mod backup;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod export;
pub mod import;
pub mod menu;

use commands::auth::DiaryState;
use log::info;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("mini_diarium_lib=info"),
    )
    .init();
    info!("Mini Diarium starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get app data directory and create diary path
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("diary.db");
            let backups_dir = app_dir.join("backups");

            // Set up state
            app.manage(DiaryState::new(db_path, backups_dir));

            // Build and set application menu
            menu::build_menu(app.handle())?;

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
            commands::auth::change_password,
            commands::auth::reset_diary,
            // Auth - method management
            commands::auth::verify_password,
            commands::auth::list_auth_methods,
            commands::auth::generate_keypair,
            commands::auth::write_key_file,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
