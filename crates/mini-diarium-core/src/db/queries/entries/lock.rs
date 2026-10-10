use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// The error a lock-enforcing core write returns for a locked entry.
///
/// A contract string: the frontend's `mapTauriError` matches it exactly
/// (`/^entry is locked$/i` in `src/lib/errors.ts`), so callers must pass it through
/// unchanged, never wrapped in another message.
pub const ERR_ENTRY_LOCKED: &str = "entry is locked";

/// Returns `Err(ERR_ENTRY_LOCKED)` when entry `id` is locked.
///
/// A missing entry passes, so each write keeps its own not-found handling. Write
/// operations call this inside their write unit, so no other writer can lock the entry
/// between the check and the write.
pub(crate) fn ensure_entry_unlocked(db: &DatabaseConnection, id: i64) -> Result<(), String> {
    if is_entry_locked(db, id)? {
        return Err(ERR_ENTRY_LOCKED.to_string());
    }
    Ok(())
}

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

    /// A locked entry with a tag and an attachment, plus a second tag not yet on it.
    struct LockedFixture {
        _tmp: tempfile::NamedTempFile,
        db: DatabaseConnection,
        id: i64,
        tag_on_entry: i64,
        other_tag: i64,
        attachment_id: i64,
    }

    fn locked_fixture() -> LockedFixture {
        use crate::db::queries::attachments::add_attachment_to_entry;
        use crate::db::queries::tags::{add_tag_to_entry, create_tag};

        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let id = insert_entry(&db, &create_test_entry("2024-05-03")).unwrap();
        let tag_on_entry = create_tag(&db, "kept").unwrap().id;
        let other_tag = create_tag(&db, "other").unwrap().id;
        add_tag_to_entry(&db, id, tag_on_entry).unwrap();
        let attachment_id = add_attachment_to_entry(&db, id, "keep.txt", b"keep")
            .unwrap()
            .id;
        set_entry_locked(&db, id, true).unwrap();
        LockedFixture {
            _tmp: tmp,
            db,
            id,
            tag_on_entry,
            other_tag,
            attachment_id,
        }
    }

    impl LockedFixture {
        /// Everything a refused write must leave unchanged: the decrypted row, the tag ids,
        /// and the attachment names.
        fn state(&self) -> (String, String, i32, String, bool, Vec<i64>, Vec<String>) {
            let entry = get_entry_by_id(&self.db, self.id).unwrap().unwrap();
            let tags = crate::db::queries::tags::get_tags_for_entry(&self.db, self.id)
                .unwrap()
                .into_iter()
                .map(|t| t.id)
                .collect();
            let attachments =
                crate::db::queries::attachments::list_entry_attachments(&self.db, self.id)
                    .unwrap()
                    .into_iter()
                    .map(|a| a.name)
                    .collect();
            (
                entry.title,
                entry.text,
                entry.word_count,
                entry.date_updated,
                entry.locked,
                tags,
                attachments,
            )
        }
    }

    #[test]
    fn test_lock_refuses_update_entry_with_images() {
        let f = locked_fixture();
        let before = f.state();
        let err =
            update_entry_with_images(&f.db, f.id, "Changed", "<p>Changed</p>", None).unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
    }

    #[test]
    fn test_lock_refuses_delete_entry_by_id() {
        let f = locked_fixture();
        let before = f.state();
        let err = delete_entry_by_id(&f.db, f.id).unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
    }

    #[test]
    fn test_lock_refuses_add_tag_to_entry() {
        let f = locked_fixture();
        let before = f.state();
        let err = crate::db::queries::tags::add_tag_to_entry(&f.db, f.id, f.other_tag).unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
    }

    #[test]
    fn test_lock_refuses_remove_tag_from_entry() {
        let f = locked_fixture();
        let before = f.state();
        let err = crate::db::queries::tags::remove_tag_from_entry(&f.db, f.id, f.tag_on_entry)
            .unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
    }

    #[test]
    fn test_lock_refuses_add_attachment_to_entry() {
        let f = locked_fixture();
        let before = f.state();
        let err = crate::db::queries::attachments::add_attachment_to_entry(
            &f.db, f.id, "new.txt", b"new",
        )
        .unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
        let blobs: i64 =
            f.db.conn()
                .query_row("SELECT COUNT(*) FROM attachments", [], |r| r.get(0))
                .unwrap();
        assert_eq!(blobs, 1, "the refused attachment's blob must not be stored");
    }

    #[test]
    fn test_lock_refuses_remove_attachment_from_entry() {
        let f = locked_fixture();
        let before = f.state();
        let err = crate::db::queries::attachments::remove_attachment_from_entry(
            &f.db,
            f.id,
            f.attachment_id,
        )
        .unwrap_err();
        assert_eq!(err, ERR_ENTRY_LOCKED);
        assert_eq!(f.state(), before);
    }

    /// Each lock-enforcing write runs as a nested unit inside an outer write unit here, so
    /// a wrap on the nested error path (which the standalone tests above never reach) fails
    /// this test: the error must stay exactly `ERR_ENTRY_LOCKED` (the frontend matches it
    /// exactly).
    #[test]
    fn test_lock_error_is_exact_inside_an_outer_write_unit() {
        use crate::db::queries::attachments::{
            add_attachment_to_entry, remove_attachment_from_entry,
        };
        use crate::db::queries::tags::{add_tag_to_entry, remove_tag_from_entry};
        use crate::db::queries::with_write_transaction;

        type LockedWrite = fn(&LockedFixture) -> Result<(), String>;
        let writes: [(&str, LockedWrite); 6] = [
            ("update_entry_with_images", |f| {
                update_entry_with_images(&f.db, f.id, "Changed", "<p>Changed</p>", None).map(|_| ())
            }),
            ("delete_entry_by_id", |f| {
                delete_entry_by_id(&f.db, f.id).map(|_| ())
            }),
            ("add_tag_to_entry", |f| {
                add_tag_to_entry(&f.db, f.id, f.other_tag).map(|_| ())
            }),
            ("remove_tag_from_entry", |f| {
                remove_tag_from_entry(&f.db, f.id, f.tag_on_entry).map(|_| ())
            }),
            ("add_attachment_to_entry", |f| {
                add_attachment_to_entry(&f.db, f.id, "new.txt", b"new").map(|_| ())
            }),
            ("remove_attachment_from_entry", |f| {
                remove_attachment_from_entry(&f.db, f.id, f.attachment_id).map(|_| ())
            }),
        ];

        for (name, write) in writes {
            let f = locked_fixture();
            let before = f.state();
            let err = with_write_transaction(&f.db, || write(&f)).unwrap_err();
            assert_eq!(
                err, ERR_ENTRY_LOCKED,
                "{} inside an outer write unit must return the exact lock error",
                name
            );
            assert!(
                f.db.conn().is_autocommit(),
                "{}: the outer unit must roll back and leave no transaction open",
                name
            );
            assert_eq!(f.state(), before, "{}: the locked entry changed", name);
        }
    }

    /// The refusal is per entry: once unlocked, the same writes go through again.
    #[test]
    fn test_lock_released_entry_accepts_writes_again() {
        let f = locked_fixture();
        set_entry_locked(&f.db, f.id, false).unwrap();
        update_entry_with_images(&f.db, f.id, "Changed", "<p>Changed</p>", None).unwrap();
        crate::db::queries::tags::add_tag_to_entry(&f.db, f.id, f.other_tag).unwrap();
        assert!(delete_entry_by_id(&f.db, f.id).unwrap());
    }

    /// A missing entry is not "locked": each write keeps its own not-found result.
    #[test]
    fn test_lock_check_passes_missing_entry_through() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        assert!(ensure_entry_unlocked(&db, 9999).is_ok());
        assert!(!delete_entry_by_id(&db, 9999).unwrap());
    }
}
