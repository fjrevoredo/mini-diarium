use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries::{self, Tag};
use tauri::State;

#[tauri::command]
pub fn create_tag(name: String, state: State<DiaryState>) -> Result<Tag, String> {
    with_unlocked_db(&state, |db| queries::create_tag(db, &name))
}

#[tauri::command]
pub fn get_all_tags(state: State<DiaryState>) -> Result<Vec<Tag>, String> {
    with_unlocked_db(&state, queries::get_all_tags)
}

#[tauri::command]
pub fn rename_tag(id: i64, name: String, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| queries::rename_tag(db, id, &name))
}

#[tauri::command]
pub fn delete_tag(id: i64, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| queries::delete_tag(db, id))
}

#[tauri::command]
pub fn add_tag_to_entry(
    entry_id: i64,
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<(), String> {
    with_unlocked_db(&state, |db| queries::add_tag_to_entry(db, entry_id, tag_id))
}

#[tauri::command]
pub fn remove_tag_from_entry(
    entry_id: i64,
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        queries::remove_tag_from_entry(db, entry_id, tag_id)
    })
}

#[tauri::command]
pub fn get_tags_for_entry(entry_id: i64, state: State<DiaryState>) -> Result<Vec<Tag>, String> {
    with_unlocked_db(&state, |db| queries::get_tags_for_entry(db, entry_id))
}

#[tauri::command]
pub fn get_entry_dates_by_tag(
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<Vec<String>, String> {
    with_unlocked_db(&state, |db| queries::get_entry_dates_by_tag(db, tag_id))
}
