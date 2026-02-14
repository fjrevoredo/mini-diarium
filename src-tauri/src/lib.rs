pub mod commands;
pub mod crypto;
pub mod db;

use commands::auth::DiaryState;
use std::path::PathBuf;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get app data directory and create diary path
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("diary.db");

            // Set up state
            app.manage(DiaryState::new(db_path));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::auth::create_diary,
            commands::auth::unlock_diary,
            commands::auth::lock_diary,
            commands::auth::diary_exists,
            commands::auth::is_diary_unlocked,
            commands::auth::change_password,
            commands::auth::reset_diary,
            commands::entries::save_entry,
            commands::entries::get_entry,
            commands::entries::delete_entry_if_empty,
            commands::entries::get_all_entry_dates,
            commands::search::search_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
