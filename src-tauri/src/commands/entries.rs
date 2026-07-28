use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::{self, DiaryEntry, EntryMetadata};
use log::debug;
use serde::Serialize;
use tauri::State;

/// A lightweight, read-only row for the timeline list view.
///
/// Carries only the date, title, and a short plaintext preview — never the full
/// decrypted entry text. Serialized directly to the frontend via IPC.
#[derive(Debug, Clone, Serialize)]
pub struct TimelineEntry {
    pub id: i64,
    pub date: String,
    pub title: String,
    pub preview: String,
    pub locked: bool,
}

/// Creates a new blank diary entry for the given date and returns it with its assigned id
#[tauri::command]
pub fn create_entry(date: String, state: State<DiaryState>) -> Result<DiaryEntry, String> {
    with_unlocked_db(&state, |db| {
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: date.clone(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let new_id = db::insert_entry(db, &entry)?;
        debug!("Created entry id={} for {}", new_id, date);
        let created = db::get_entry_by_id(db, new_id)?
            .ok_or_else(|| format!("Failed to retrieve newly created entry for {}", date))?;
        Ok(created)
    })
}

/// Pure inner of `save_entry` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn save_entry_inner(
    id: i64,
    title: &str,
    text: &str,
    metadata: Option<EntryMetadata>,
    state: &DiaryState,
) -> Result<(), String> {
    with_unlocked_db(state, |db| {
        // Defense-in-depth: reject content saves for locked entries. The UI already
        // gates editing, so this is a safety net (e.g. against a raced autosave).
        if db::is_entry_locked(db, id)? {
            return Err("entry is locked".to_string());
        }
        db::update_entry_with_images(db, id, title, text, metadata)?;
        debug!("Saved entry id={}", id);
        Ok(())
    })
}

/// Saves (updates) a diary entry by id
#[tauri::command]
pub fn save_entry(
    id: i64,
    title: String,
    text: String,
    metadata: Option<EntryMetadata>,
    state: State<DiaryState>,
) -> Result<(), String> {
    save_entry_inner(id, &title, &text, metadata, &state)
}

/// Gets all diary entries for a specific date, newest-first
#[tauri::command]
pub fn get_entries_for_date(
    date: String,
    state: State<DiaryState>,
) -> Result<Vec<DiaryEntry>, String> {
    with_unlocked_db(&state, |db| db::get_entries_by_date(db, &date))
}

/// Tags that carry content even though they contribute no text — an entry that is only
/// an image or a rule is not blank and must never be auto-deleted.
const NON_TEXT_CONTENT_TAGS: [&str; 6] = ["<img", "<hr", "<video", "<audio", "<iframe", "<table"];

/// Returns true when an editor HTML fragment carries no user-visible content.
///
/// The editor persists an "empty" document as an HTML shell (`<p></p>`, `<p><br></p>`,
/// sometimes with `&nbsp;`), so a byte-level `trim().is_empty()` would refuse to
/// auto-delete entries the user considers blank. Anything else — a single character, an
/// image, a table — counts as content and vetoes the delete.
///
/// This is the backend half of the TODO-0089 guard: the frontend now sends the real body
/// instead of `""`, and this function is what makes that submission meaningful.
fn is_blank_html(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }

    let lowered = trimmed.to_ascii_lowercase();
    if NON_TEXT_CONTENT_TAGS
        .iter()
        .any(|tag| lowered.contains(tag))
    {
        return false;
    }

    // Strip tags, then normalise the entities the editor emits for a blank line.
    let mut stripped = String::with_capacity(lowered.len());
    let mut in_tag = false;
    for ch in lowered.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => stripped.push(c),
            _ => {}
        }
    }

    stripped
        .replace("&nbsp;", " ")
        .replace("&#160;", " ")
        .replace("&#xa0;", " ")
        .replace('\u{a0}', " ")
        .trim()
        .is_empty()
}

/// Pure inner of `delete_entry_if_empty` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn delete_entry_if_empty_inner(
    id: i64,
    title: &str,
    text: &str,
    state: &DiaryState,
) -> Result<bool, String> {
    with_unlocked_db(state, |db| {
        // The title stays a plain-text check: it is not HTML, and running it through the
        // tag stripper would read a literal title like "<3" as blank.
        if title.trim().is_empty() && is_blank_html(text) {
            debug!("Deleting empty entry id={}", id);
            db::delete_entry_by_id(db, id)
        } else {
            debug!("Refusing to delete non-empty entry id={}", id);
            Ok(false)
        }
    })
}

/// Deletes an entry by id if both title and text are empty/whitespace
///
/// Returns true if the entry was deleted, false otherwise
#[tauri::command]
pub fn delete_entry_if_empty(
    id: i64,
    title: String,
    text: String,
    state: State<DiaryState>,
) -> Result<bool, String> {
    delete_entry_if_empty_inner(id, &title, &text, &state)
}

/// Deletes an entry by id
#[tauri::command]
pub fn delete_entry(id: i64, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        // Locked entries are protected from deletion as well as editing. The UI disables
        // the delete button when locked; this is the backend safety net.
        if db::is_entry_locked(db, id)? {
            return Err("entry is locked".to_string());
        }
        let deleted =
            db::delete_entry_by_id(db, id).map_err(|e| format!("Failed to delete entry: {}", e))?;
        if !deleted {
            return Err("Entry not found".to_string());
        }
        Ok(())
    })
}

/// Sets the per-entry `locked` flag (UX affordance against accidental edits).
///
/// Targeted UPDATE that never re-encrypts entry content — see `db::set_entry_locked`.
#[tauri::command]
pub fn set_entry_locked(id: i64, locked: bool, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        db::set_entry_locked(db, id, locked)?;
        debug!("Set entry id={} locked={}", id, locked);
        Ok(())
    })
}

/// Returns the distinct dates that have at least one locked entry (calendar indicator).
#[tauri::command]
pub fn get_locked_entry_dates(state: State<DiaryState>) -> Result<Vec<String>, String> {
    with_unlocked_db(&state, db::get_locked_entry_dates)
}

/// Gets all dates that have entries
///
/// Returns a sorted list of distinct dates in YYYY-MM-DD format
#[tauri::command]
pub fn get_all_entry_dates(state: State<DiaryState>) -> Result<Vec<String>, String> {
    with_unlocked_db(&state, db::get_all_entry_dates)
}

/// Gets a lightweight, newest-first list of all entries for the timeline view.
///
/// Decrypts only title and preview per entry — never the full entry text.
/// For legacy entries (saved before v12), falls back to full-text decryption.
#[tauri::command]
pub fn get_timeline_entries(state: State<DiaryState>) -> Result<Vec<TimelineEntry>, String> {
    with_unlocked_db(&state, |db| {
        let rows = db::get_entries_for_timeline(db)?;
        Ok(rows
            .into_iter()
            .map(|r| TimelineEntry {
                id: r.id,
                date: r.date,
                title: r.title,
                preview: r.preview,
                locked: r.locked,
            })
            .collect())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_database;

    // Note: Command-level tests would require Tauri test infrastructure
    // The workflow tests below verify the underlying logic

    #[test]
    fn test_create_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Create a blank entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let new_id = db::insert_entry(&db, &entry).unwrap();

        // Retrieve and verify
        let retrieved = db::get_entry_by_id(&db, new_id).unwrap();
        assert!(retrieved.is_some());
        let e = retrieved.unwrap();
        assert_eq!(e.id, new_id);
        assert_eq!(e.date, "2024-01-01");
        assert_eq!(e.title, "");
        assert_eq!(e.text, "");
    }

    #[test]
    fn test_save_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Create entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-01-01".to_string(),
            title: "Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let id = db::insert_entry(&db, &entry).unwrap();

        // Update via update_entry
        let mut updated = db::get_entry_by_id(&db, id).unwrap().unwrap();
        updated.title = "Updated Title".to_string();
        updated.text = "Updated Content".to_string();
        updated.word_count = 2;
        db::update_entry(&db, &updated).unwrap();

        // Verify update
        let retrieved = db::get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
    }

    #[test]
    fn test_get_entries_for_date_multiple() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let make_entry = |title: &str| DiaryEntry {
            id: 0,
            date: "2024-02-01".to_string(),
            title: title.to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
            locked: false,
        };

        db::insert_entry(&db, &make_entry("Morning")).unwrap();
        db::insert_entry(&db, &make_entry("Afternoon")).unwrap();
        db::insert_entry(&db, &make_entry("Evening")).unwrap();

        let entries = db::get_entries_by_date(&db, "2024-02-01").unwrap();
        assert_eq!(entries.len(), 3);
        // Newest first (highest id first)
        assert_eq!(entries[0].title, "Evening");
        assert_eq!(entries[1].title, "Afternoon");
        assert_eq!(entries[2].title, "Morning");
    }

    #[test]
    fn test_delete_entry_if_empty_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-02-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let id = db::insert_entry(&db, &entry).unwrap();

        // Delete empty entry
        let deleted = db::delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        // Verify deletion
        let retrieved = db::get_entry_by_id(&db, id).unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_is_blank_html_recognises_editor_empty_shells() {
        for blank in [
            "",
            "   ",
            "<p></p>",
            "<p><br></p>",
            "<p>&nbsp;</p>",
            "<p>\u{a0}</p>",
            "<p></p><p></p>",
        ] {
            assert!(is_blank_html(blank), "expected blank: {:?}", blank);
        }
        for content in ["<p>a</p>", "<p><img src=\"x\"></p>", "<hr>", "text"] {
            assert!(!is_blank_html(content), "expected non-blank: {:?}", content);
        }
    }

    /// The backend veto restored by TODO-0089: a delete request carrying real content
    /// must be refused, so a wrong-context frontend flush cannot erase a live entry.
    #[test]
    fn test_delete_entry_if_empty_refuses_non_empty_text() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-07-01".to_string(),
            title: String::new(),
            text: "<p>Real content</p>".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_if_empty.db"),
            PathBuf::from("test_delete_if_empty_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        // Blank title but a real body → refused.
        let deleted =
            delete_entry_if_empty_inner(entry_id, "", "<p>Real content</p>", &state).unwrap();
        assert!(!deleted, "non-empty text must not be deleted");
        {
            let guard = state.db.lock().unwrap();
            assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
                .unwrap()
                .is_some());
        }

        // An empty HTML shell with no title → deleted.
        let deleted = delete_entry_if_empty_inner(entry_id, "", "<p></p>", &state).unwrap();
        assert!(deleted, "empty HTML shell must auto-delete");
        let guard = state.db.lock().unwrap();
        assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .is_none());
    }

    #[test]
    fn test_delete_entry_if_empty_refuses_non_empty_title() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-07-02".to_string(),
            title: "Titled".to_string(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_if_empty_title.db"),
            PathBuf::from("test_delete_if_empty_title_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let deleted = delete_entry_if_empty_inner(entry_id, "Titled", "<p></p>", &state).unwrap();
        assert!(!deleted, "a titled entry must not be auto-deleted");
    }

    #[test]
    fn test_get_all_dates_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let make_entry = |date: &str| DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
            locked: false,
        };

        // Insert multiple entries, two on the same date
        db::insert_entry(&db, &make_entry("2024-01-01")).unwrap();
        db::insert_entry(&db, &make_entry("2024-01-15")).unwrap();
        db::insert_entry(&db, &make_entry("2024-01-15")).unwrap(); // second on same date
        db::insert_entry(&db, &make_entry("2024-02-01")).unwrap();

        let dates = db::get_all_entry_dates(&db).unwrap();
        // DISTINCT: only 3 unique dates
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-01");
        assert_eq!(dates[2], "2024-02-01");
    }

    #[test]
    fn test_word_count() {
        assert_eq!(db::count_words("Hello world"), 2);
        assert_eq!(db::count_words(""), 0);
        assert_eq!(db::count_words("One two three four five"), 5);
    }

    #[test]
    fn test_delete_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert an entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-03-01".to_string(),
            title: "To delete".to_string(),
            text: "Some content".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let id = db::insert_entry(&db, &entry).unwrap();

        // delete_entry_by_id returns Ok(true) when entry exists — mirrors command Ok(())
        let deleted = db::delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        // Entry is gone
        let retrieved = db::get_entry_by_id(&db, id).unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_delete_entry_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // delete_entry_by_id returns Ok(false) for a non-existent id — the command
        // maps this to Err("Entry not found")
        let deleted = db::delete_entry_by_id(&db, 9999).unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_save_entry_locked_returns_error() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let state = DiaryState::new(
            PathBuf::from("test_save_entry_locked.db"),
            PathBuf::from("test_save_entry_locked_backups"),
            PathBuf::from("."),
        );
        let err = save_entry_inner(1, "Title", "Text", None, &state).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }

    #[test]
    fn test_save_entry_unlocked_updates_content() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let blank = DiaryEntry {
            id: 0,
            date: "2024-05-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &blank).unwrap();
        let state = DiaryState::new(
            PathBuf::from("test_save_entry_unlocked.db"),
            PathBuf::from("test_save_entry_unlocked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);
        let result = save_entry_inner(entry_id, "My Title", "My content here", None, &state);
        assert!(result.is_ok(), "err: {:?}", result.err());
        let db_guard = state.db.lock().unwrap();
        let retrieved = db::get_entry_by_id(db_guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, "My Title");
        assert_eq!(retrieved.word_count, 3);
    }

    #[test]
    fn test_save_entry_rejects_locked_entry() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-06-01".to_string(),
            title: "Original".to_string(),
            text: "Original content".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();
        db::set_entry_locked(&db, entry_id, true).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_save_locked.db"),
            PathBuf::from("test_save_locked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let err = save_entry_inner(entry_id, "Hacked", "Hacked content", None, &state).unwrap_err();
        assert_eq!(err, "entry is locked");

        // Content must be unchanged.
        let db_guard = state.db.lock().unwrap();
        let retrieved = db::get_entry_by_id(db_guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, "Original");
    }
}
