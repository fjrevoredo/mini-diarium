use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Sets the per-entry `locked` flag via a targeted UPDATE.
///
/// This deliberately touches only the `locked` column and never routes through the
/// content-save path, so toggling the lock does not re-encrypt title/text/preview and
/// cannot race the editor's autosave debounce.
///
/// Returns `Err("No entry found with id: {id}")` when no row matched.
pub fn set_entry_locked(db: &DatabaseConnection, id: i64, locked: bool) -> Result<(), String> {
    let rows_affected = db
        .conn()
        .execute(
            "UPDATE entries SET locked = ?1 WHERE id = ?2",
            params![locked, id],
        )
        .map_err(|e| format!("Failed to update entry lock: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("No entry found with id: {}", id));
    }
    Ok(())
}

/// Returns whether the entry with the given id is locked.
///
/// A missing entry is treated as not locked so callers (save/delete guards) fall
/// through to their own not-found handling rather than short-circuiting here.
pub fn is_entry_locked(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
    let result = db.conn().query_row(
        "SELECT locked FROM entries WHERE id = ?1",
        params![id],
        |row| row.get::<_, bool>(0),
    );

    match result {
        Ok(locked) => Ok(locked),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(format!("Failed to read entry lock: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_set_entry_locked_round_trips() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-05-01")).unwrap();
        let id = db.conn().last_insert_rowid();

        // Default is unlocked.
        assert!(!is_entry_locked(&db, id).unwrap());
        let fetched = get_entry_by_id(&db, id).unwrap().unwrap();
        assert!(!fetched.locked);

        set_entry_locked(&db, id, true).unwrap();
        assert!(is_entry_locked(&db, id).unwrap());
        let fetched = get_entry_by_id(&db, id).unwrap().unwrap();
        assert!(fetched.locked);

        set_entry_locked(&db, id, false).unwrap();
        assert!(!is_entry_locked(&db, id).unwrap());
    }

    #[test]
    fn test_set_entry_locked_missing_id_errors() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let err = set_entry_locked(&db, 9999, true).unwrap_err();
        assert!(err.contains("No entry found with id"), "got: {}", err);
    }

    #[test]
    fn test_is_entry_locked_missing_id_is_false() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        assert!(!is_entry_locked(&db, 9999).unwrap());
    }

    #[test]
    fn test_locked_preserved_across_content_save() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-05-02")).unwrap();
        let id = db.conn().last_insert_rowid();
        set_entry_locked(&db, id, true).unwrap();

        // A content update (via the normal path) must not clear the lock.
        let mut entry = get_entry_by_id(&db, id).unwrap().unwrap();
        entry.title = "Changed".to_string();
        entry.text = "New content".to_string();
        update_entry(&db, &entry).unwrap();

        assert!(
            is_entry_locked(&db, id).unwrap(),
            "content save must preserve the locked flag"
        );
    }
}
