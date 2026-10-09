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
    /// Ids of the entry's tags. The frontend resolves names from its decrypted tag list.
    pub tag_ids: Vec<i64>,
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
        // Core refuses a locked entry with `db::ERR_ENTRY_LOCKED`. The UI already gates
        // editing, so this is the safety net against, for example, a raced autosave.
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

/// Pure inner of `delete_entry_if_empty` — takes `&DiaryState` so it can be tested without Tauri.
///
/// Deletes only when **both** the incoming arguments and the entry's currently-persisted
/// row are blank. The on-disk check is what protects against a stale or wrong-context
/// frontend flush that sends blank arguments for an entry that actually holds real content
/// (TODO-0104) — the argument check alone trusts the caller completely.
///
/// A locked entry is never deleted and returns `Ok(false)`, not an error: this runs on
/// auto-lock and app-close paths that cannot show an error (TODO-0132).
pub(crate) fn delete_entry_if_empty_inner(
    id: i64,
    title: &str,
    text: &str,
    state: &DiaryState,
) -> Result<bool, String> {
    with_unlocked_db(state, |db| {
        if !db::is_blank_entry_text(title, text) {
            debug!("Refusing to delete non-empty entry id={}", id);
            return Ok(false);
        }
        // The on-disk check includes attachments: an attachment-only entry is not empty.
        match db::entry_is_empty(db, id)? {
            None => return Ok(false),
            Some(false) => {
                debug!(
                    "Refusing to delete entry id={} — on-disk row still has content",
                    id
                );
                return Ok(false);
            }
            Some(true) => {}
        }
        debug!("Deleting empty entry id={}", id);
        match db::delete_entry_by_id(db, id) {
            Err(e) if e == db::ERR_ENTRY_LOCKED => {
                debug!("Refusing to delete locked entry id={}", id);
                Ok(false)
            }
            other => other,
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

/// Pure inner of `delete_entry` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn delete_entry_inner(id: i64, state: &DiaryState) -> Result<(), String> {
    with_unlocked_db(state, |db| {
        // Core refuses a locked entry with `db::ERR_ENTRY_LOCKED`. The frontend matches that
        // string exactly, so it passes through unwrapped; every other error gets context.
        let deleted = db::delete_entry_by_id(db, id).map_err(|e| {
            if e == db::ERR_ENTRY_LOCKED {
                e
            } else {
                format!("Failed to delete entry: {}", e)
            }
        })?;
        if !deleted {
            return Err("Entry not found".to_string());
        }
        Ok(())
    })
}

/// Deletes an entry by id
#[tauri::command]
pub fn delete_entry(id: i64, state: State<DiaryState>) -> Result<(), String> {
    delete_entry_inner(id, &state)
}

/// Pure inner of `entry_has_content` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn entry_has_content_inner(id: i64, state: &DiaryState) -> Result<bool, String> {
    with_unlocked_db(state, |db| {
        db::entry_is_empty(db, id)?
            .map(|empty| !empty)
            .ok_or_else(|| "Entry not found".to_string())
    })
}

/// Returns whether an entry's on-disk row currently holds real content.
///
/// Read-only — mutates nothing. Lets the frontend guard check before deciding whether to
/// show a confirm dialog, without trusting its own possibly-stale in-memory copy (TODO-0104).
#[tauri::command]
pub fn entry_has_content(id: i64, state: State<DiaryState>) -> Result<bool, String> {
    entry_has_content_inner(id, &state)
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

/// Pure inner of `recalculate_word_counts` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn recalculate_word_counts_inner(
    state: &DiaryState,
) -> Result<db::WordCountRecalculationResult, String> {
    with_unlocked_db(state, db::recalculate_all_word_counts)
}

/// Recomputes `word_count` for every entry in the journal, skipping locked entries.
///
/// Manual, on-demand only (TODO-0111) — no automatic/background recalculation.
#[tauri::command]
pub fn recalculate_word_counts(
    state: State<DiaryState>,
) -> Result<db::WordCountRecalculationResult, String> {
    recalculate_word_counts_inner(&state)
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
                tag_ids: r.tag_ids,
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

        // TODO-0104: blank incoming args alone are no longer sufficient — the on-disk row
        // still holds "Real content" at this point, so this must also be refused. This is
        // the exact silent-content-loss case Milestone 1 closes.
        let deleted = delete_entry_if_empty_inner(entry_id, "", "<p></p>", &state).unwrap();
        assert!(
            !deleted,
            "blank args must not delete an entry whose on-disk row still has content"
        );
        {
            let guard = state.db.lock().unwrap();
            assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
                .unwrap()
                .is_some());
        }

        // Once the on-disk row itself is actually blank, the same blank args do delete it.
        save_entry_inner(entry_id, "", "<p></p>", None, &state).unwrap();
        let deleted = delete_entry_if_empty_inner(entry_id, "", "<p></p>", &state).unwrap();
        assert!(
            deleted,
            "empty HTML shell must auto-delete once on-disk row is blank"
        );
        let guard = state.db.lock().unwrap();
        assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .is_none());
    }

    /// TODO-0104: a stale/blank frontend payload must not be able to delete an entry whose
    /// on-disk row still has real content — the argument check alone trusts the caller.
    #[test]
    fn test_delete_entry_if_empty_refuses_when_disk_row_still_has_content() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-01".to_string(),
            title: "Real title".to_string(),
            text: "<p>Real content</p>".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_disk_row_content.db"),
            PathBuf::from("test_delete_disk_row_content_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        // Simulate a stale/blank frontend payload for an entry that still has real content.
        let deleted = delete_entry_if_empty_inner(entry_id, "", "", &state).unwrap();
        assert!(
            !deleted,
            "must refuse when the on-disk row still has content"
        );

        let guard = state.db.lock().unwrap();
        assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .is_some());
    }

    /// Guards against a regression of the pre-existing "abandoned new entry" cleanup:
    /// a genuinely blank entry must still auto-delete.
    #[test]
    fn test_delete_entry_if_empty_still_allows_genuinely_blank_entry() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-02".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_genuinely_blank.db"),
            PathBuf::from("test_delete_genuinely_blank_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let deleted = delete_entry_if_empty_inner(entry_id, "", "", &state).unwrap();
        assert!(deleted, "a genuinely blank entry must still auto-delete");

        let guard = state.db.lock().unwrap();
        assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .is_none());
    }

    /// TODO-0114: an entry with only attachments is not empty — auto-delete would GC the
    /// attachment blobs along with it.
    #[test]
    fn test_attachment_only_entry_is_not_empty() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-05".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();
        db::add_attachment_to_entry(&db, entry_id, "doc.pdf", b"%PDF").unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_attachment_only_entry.db"),
            PathBuf::from("test_attachment_only_entry_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        assert!(entry_has_content_inner(entry_id, &state).unwrap());
        let deleted = delete_entry_if_empty_inner(entry_id, "", "", &state).unwrap();
        assert!(!deleted, "an attachment-only entry must not auto-delete");

        let guard = state.db.lock().unwrap();
        let db = guard.as_ref().unwrap();
        assert!(db::get_entry_by_id(db, entry_id).unwrap().is_some());
        assert_eq!(db::list_entry_attachments(db, entry_id).unwrap().len(), 1);
    }

    #[test]
    fn test_entry_has_content_true_for_entry_with_real_content() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-03".to_string(),
            title: "Has content".to_string(),
            text: "<p>Real content</p>".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_entry_has_content_true.db"),
            PathBuf::from("test_entry_has_content_true_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let has_content = entry_has_content_inner(entry_id, &state).unwrap();
        assert!(has_content);
    }

    #[test]
    fn test_entry_has_content_false_for_blank_entry() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-04".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_entry_has_content_false.db"),
            PathBuf::from("test_entry_has_content_false_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let has_content = entry_has_content_inner(entry_id, &state).unwrap();
        assert!(!has_content);
    }

    #[test]
    fn test_entry_has_content_errors_for_missing_entry() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_entry_has_content_missing.db"),
            PathBuf::from("test_entry_has_content_missing_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let err = entry_has_content_inner(9999, &state).unwrap_err();
        assert!(err.contains("Entry not found"), "got: {}", err);
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

    /// TODO-0132: blank-entry cleanup runs on auto-lock and app close, which cannot show an
    /// error. A locked blank entry must be refused with `Ok(false)` and stay.
    #[test]
    fn test_delete_entry_if_empty_refuses_locked_blank_entry_without_error() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-06".to_string(),
            title: String::new(),
            text: "<p></p>".to_string(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();
        db::set_entry_locked(&db, entry_id, true).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_if_empty_locked.db"),
            PathBuf::from("test_delete_if_empty_locked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let deleted = delete_entry_if_empty_inner(entry_id, "", "<p></p>", &state).unwrap();
        assert!(!deleted, "a locked blank entry must not be auto-deleted");

        let guard = state.db.lock().unwrap();
        let db = guard.as_ref().unwrap();
        assert!(db::get_entry_by_id(db, entry_id).unwrap().is_some());
        assert!(db::is_entry_locked(db, entry_id).unwrap());
    }

    /// The lock refusal must reach the frontend as exactly `entry is locked`
    /// (`src/lib/errors.ts` matches it with `^…$`), not wrapped as "Failed to delete entry: …".
    #[test]
    fn test_delete_entry_rejects_locked_entry_with_exact_lock_error() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-08-07".to_string(),
            title: "Keep me".to_string(),
            text: "<p>Real content</p>".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let entry_id = db::insert_entry(&db, &entry).unwrap();
        db::set_entry_locked(&db, entry_id, true).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_delete_locked.db"),
            PathBuf::from("test_delete_locked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        assert_eq!(
            delete_entry_inner(entry_id, &state).unwrap_err(),
            "entry is locked"
        );
        assert_eq!(
            delete_entry_inner(9999, &state).unwrap_err(),
            "Entry not found"
        );
        let guard = state.db.lock().unwrap();
        assert!(db::get_entry_by_id(guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .is_some());
    }

    #[test]
    fn test_recalculate_word_counts_locked_journal_errors() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let state = DiaryState::new(
            PathBuf::from("test_recalculate_locked_journal.db"),
            PathBuf::from("test_recalculate_locked_journal_backups"),
            PathBuf::from("."),
        );
        let err = recalculate_word_counts_inner(&state).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }

    #[test]
    fn test_recalculate_word_counts_delegates_and_returns_counts() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();

        // Stale entry — should be updated.
        let stale = DiaryEntry {
            id: 0,
            date: "2024-09-10".to_string(),
            title: "Stale".to_string(),
            text: "Some words here".to_string(),
            word_count: 999,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
            locked: false,
        };
        db::insert_entry(&db, &stale).unwrap();

        // Already-correct entry — should not be counted as updated.
        let correct = DiaryEntry {
            id: 0,
            date: "2024-09-11".to_string(),
            title: "Correct".to_string(),
            text: "Two words".to_string(),
            word_count: db::count_words("Two words"),
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
            locked: false,
        };
        db::insert_entry(&db, &correct).unwrap();

        // Locked entry with a stale count — should be skipped, not updated.
        let locked = DiaryEntry {
            id: 0,
            date: "2024-09-12".to_string(),
            title: "Locked".to_string(),
            text: "Locked content here".to_string(),
            word_count: 999,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        let locked_id = db::insert_entry(&db, &locked).unwrap();
        db::set_entry_locked(&db, locked_id, true).unwrap();

        let state = DiaryState::new(
            PathBuf::from("test_recalculate_delegates.db"),
            PathBuf::from("test_recalculate_delegates_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);

        let result = recalculate_word_counts_inner(&state).unwrap();
        assert_eq!(result.scanned, 3);
        assert_eq!(result.updated, 1);
        assert_eq!(result.skipped_locked, 1);
    }
}
