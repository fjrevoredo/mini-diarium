use super::{count_words, get_all_entries};
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Outcome of a full-journal word-count recalculation pass.
#[derive(Debug, Clone, Copy, PartialEq, Default, serde::Serialize)]
pub struct WordCountRecalculationResult {
    pub scanned: i64,
    pub updated: i64,
    pub skipped_locked: i64,
}

/// Recomputes `word_count` for every entry in the journal, skipping locked entries.
///
/// A targeted `UPDATE ... SET word_count` only — never touches `title_encrypted`,
/// `text_encrypted`, `date_updated`, `entry_metadata_encrypted`, or `preview_enc`, so this
/// is not a content edit. Locked entries are counted in `skipped_locked` and left
/// untouched, consistent with the invariant that a locked row is only ever changed via
/// `set_entry_locked`. Wraps the writes in `BEGIN IMMEDIATE` / `COMMIT` with an explicit
/// `ROLLBACK` on failure, mirroring `update_entry_with_images`.
pub fn recalculate_all_word_counts(
    db: &DatabaseConnection,
) -> Result<WordCountRecalculationResult, String> {
    let entries = get_all_entries(db)?;

    let result: Result<WordCountRecalculationResult, String> = (|| {
        db.conn()
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|e| format!("BEGIN failed: {}", e))?;

        let mut outcome = WordCountRecalculationResult::default();
        for entry in &entries {
            outcome.scanned += 1;
            if entry.locked {
                outcome.skipped_locked += 1;
                continue;
            }
            let recomputed = count_words(&entry.text);
            if recomputed != entry.word_count {
                db.conn()
                    .execute(
                        "UPDATE entries SET word_count = ?1 WHERE id = ?2",
                        params![recomputed, entry.id],
                    )
                    .map_err(|e| format!("Failed to update word count: {}", e))?;
                outcome.updated += 1;
            }
        }

        db.conn()
            .execute("COMMIT", [])
            .map_err(|e| format!("COMMIT failed: {}", e))?;
        Ok(outcome)
    })();

    if result.is_err() {
        let _ = db.conn().execute("ROLLBACK", []);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_recalculate_fixes_stale_word_count() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry = create_test_entry("2024-10-01");
        entry.word_count = 999; // deliberately stale
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let result = recalculate_all_word_counts(&db).unwrap();
        assert_eq!(result.scanned, 1);
        assert_eq!(result.updated, 1);
        assert_eq!(result.skipped_locked, 0);

        let fixed = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(fixed.word_count, count_words(&fixed.text));
    }

    #[test]
    fn test_recalculate_skips_locked_entry() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry = create_test_entry("2024-10-02");
        entry.word_count = 999;
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();
        set_entry_locked(&db, id, true).unwrap();

        let result = recalculate_all_word_counts(&db).unwrap();
        assert_eq!(result.scanned, 1);
        assert_eq!(result.updated, 0);
        assert_eq!(result.skipped_locked, 1);

        let untouched = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(
            untouched.word_count, 999,
            "locked entry must not be rewritten"
        );
    }

    #[test]
    fn test_recalculate_already_correct_reports_no_update() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-10-03");
        let correct_count = count_words(&entry.text);
        let mut entry = entry;
        entry.word_count = correct_count;
        insert_entry(&db, &entry).unwrap();

        let result = recalculate_all_word_counts(&db).unwrap();
        assert_eq!(result.scanned, 1);
        assert_eq!(result.updated, 0);
        assert_eq!(result.skipped_locked, 0);
    }

    #[test]
    fn test_recalculate_empty_journal() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = recalculate_all_word_counts(&db).unwrap();
        assert_eq!(result, WordCountRecalculationResult::default());
    }

    #[test]
    fn test_recalculate_leaves_date_updated_unchanged() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let mut entry = create_test_entry("2024-10-04");
        entry.word_count = 999;
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();
        let before = get_entry_by_id(&db, id).unwrap().unwrap();

        recalculate_all_word_counts(&db).unwrap();

        let after = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(after.date_updated, before.date_updated);
    }
}
