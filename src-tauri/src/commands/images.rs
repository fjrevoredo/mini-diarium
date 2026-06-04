use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries::images::ImageData;
use tauri::State;

/// Returns all decrypted images associated with a specific entry.
#[tauri::command]
pub fn get_entry_images(entry_id: i64, state: State<DiaryState>) -> Result<Vec<ImageData>, String> {
    with_unlocked_db(&state, |db| {
        crate::db::queries::images::get_images_for_entry(db, entry_id)
    })
}

/// Returns all decrypted images stored in the journal, newest-first.
#[tauri::command]
pub fn list_journal_images(state: State<DiaryState>) -> Result<Vec<ImageData>, String> {
    with_unlocked_db(&state, crate::db::queries::images::list_all_images)
}
