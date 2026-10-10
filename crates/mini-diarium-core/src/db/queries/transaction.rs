//! The one way core runs a multi-step write as an atomic unit.

use crate::db::schema::DatabaseConnection;
use log::warn;

/// Savepoint name for a nested write unit. SQLite allows the same name to be stacked;
/// `ROLLBACK TO` / `RELEASE` always target the newest savepoint with that name, so each
/// nesting level addresses its own savepoint.
const SAVEPOINT_NAME: &str = "md_write";

/// Returned when a transaction is open that no write unit on this connection opened.
pub(crate) const ERR_UNOWNED_TRANSACTION: &str = "write refused: an unexpected transaction is open";

/// Returned when the enclosing write unit can no longer commit: SQLite rolled back the whole
/// transaction under it, or a nested unit could not undo its own work.
pub(crate) const ERR_WRITE_UNIT_LOST: &str =
    "write refused: the enclosing write unit was rolled back";

/// Runs `f` as one atomic write unit and nests safely inside a larger unit.
///
/// - No unit open: `BEGIN IMMEDIATE`, run `f`, `COMMIT`; `ROLLBACK` on error.
/// - A unit this helper opened is still open: `SAVEPOINT md_write`, run `f`,
///   `RELEASE md_write`; on error, `ROLLBACK TO md_write` then `RELEASE md_write`, so only
///   this unit's work is undone and the outer unit stays usable.
///
/// The connection counts the units it has open (`write_depth`), because SQLite's
/// autocommit flag says only that *a* transaction is open, not who opened it. Two states
/// where the count and SQLite disagree are refused before any SQL runs:
///
/// - No unit open, but a transaction is open: something outside this helper opened it, and
///   work nested in it would not be durable when the unit reports success. The call returns
///   [`ERR_UNOWNED_TRANSACTION`] and leaves the foreign transaction alone.
/// - A unit open, but no transaction: SQLite rolled back the whole transaction (for example
///   on `SQLITE_FULL`, `SQLITE_IOERR` or `RAISE(ROLLBACK)`). A new `BEGIN` here would make
///   writes durable while the outer unit reports failure, so the call returns
///   [`ERR_WRITE_UNIT_LOST`] instead.
///
/// The second state, and a nested rollback that fails, also poison the outermost unit: it
/// never commits. An error from its closure is returned unchanged; a closure that returns
/// `Ok` gets [`ERR_WRITE_UNIT_LOST`], and the unit rolls back.
///
/// A drop guard attempts the rollback on an error return and during an unwinding panic
/// inside `f`. If a nested rollback fails, the outermost unit is poisoned. If the outermost
/// rollback fails and leaves the transaction open, later helper writes are refused (no unit
/// owns that transaction) until the connection is dropped. When SQLite has already rolled
/// back the whole transaction itself, the guard issues nothing and the original error is
/// returned unchanged.
///
/// Callers must still propagate an error from a nested unit. The refusals above cover
/// later calls to this helper only; raw SQL that a closure runs after it swallowed the
/// error still executes in autocommit mode.
pub(crate) fn with_write_transaction<T>(
    db: &DatabaseConnection,
    f: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let depth = db.write_depth.get();
    let nested = match (depth, db.conn().is_autocommit()) {
        (0, true) => {
            db.conn()
                .execute_batch("BEGIN IMMEDIATE")
                .map_err(|e| format!("BEGIN failed: {}", e))?;
            db.write_poisoned.set(false);
            false
        }
        (0, false) => {
            warn!("write unit refused: a transaction this helper did not open is active");
            return Err(ERR_UNOWNED_TRANSACTION.to_string());
        }
        (_, false) => {
            db.conn()
                .execute_batch(&format!("SAVEPOINT {}", SAVEPOINT_NAME))
                .map_err(|e| format!("SAVEPOINT failed: {}", e))?;
            true
        }
        (_, true) => {
            db.write_poisoned.set(true);
            warn!("write unit refused: SQLite rolled back the enclosing write unit");
            return Err(ERR_WRITE_UNIT_LOST.to_string());
        }
    };
    db.write_depth.set(depth + 1);

    let guard = RollbackGuard {
        db,
        nested,
        armed: true,
    };
    let value = f()?;
    guard.commit()?;
    Ok(value)
}

/// Rolls back the unit it guards unless [`RollbackGuard::commit`] succeeded, and always
/// closes the unit in the connection's `write_depth` count.
struct RollbackGuard<'a> {
    db: &'a DatabaseConnection,
    nested: bool,
    armed: bool,
}

impl RollbackGuard<'_> {
    /// Commits (outermost) or releases (nested) the unit. On failure the guard stays armed,
    /// so dropping it rolls the unit back. A poisoned outermost unit is never committed.
    fn commit(mut self) -> Result<(), String> {
        let conn = self.db.conn();
        if self.nested {
            conn.execute_batch(&format!("RELEASE {}", SAVEPOINT_NAME))
                .map_err(|e| format!("RELEASE failed: {}", e))?;
        } else {
            if self.db.write_poisoned.get() {
                return Err(ERR_WRITE_UNIT_LOST.to_string());
            }
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("COMMIT failed: {}", e))?;
        }
        self.armed = false;
        Ok(())
    }
}

impl Drop for RollbackGuard<'_> {
    fn drop(&mut self) {
        let db = self.db;
        db.write_depth.set(db.write_depth.get().saturating_sub(1));
        if !self.armed {
            return;
        }
        let conn = db.conn();
        // SQLite already rolled back the whole transaction: nothing is left to undo, and a
        // `ROLLBACK TO` would only fail with "no such savepoint". The enclosing unit lost
        // its transaction too, so it must not commit.
        if conn.is_autocommit() {
            if self.nested {
                db.write_poisoned.set(true);
            }
            return;
        }
        // SQL errors are not returned: this runs on an error or panic path whose original
        // cause is what the caller must see, and a drop cannot return an error.
        if self.nested {
            let undone = conn.execute_batch(&format!(
                "ROLLBACK TO {name}; RELEASE {name}",
                name = SAVEPOINT_NAME
            ));
            // A savepoint left behind would make the enclosing unit's own RELEASE or
            // ROLLBACK TO target this level (same-name savepoints resolve to the newest),
            // so the outermost unit must roll back instead of committing.
            if undone.is_err() {
                db.write_poisoned.set(true);
            }
        } else if conn.execute_batch("ROLLBACK").is_err() && !conn.is_autocommit() {
            // The transaction stays open and no unit owns it, so later calls get the
            // unowned-transaction refusal until the connection is dropped, which rolls the
            // transaction back.
            warn!("write unit rollback failed; writes are refused until the journal locks");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::images::test_support::make_db;

    fn setup() -> (tempfile::NamedTempFile, DatabaseConnection) {
        let (tmp, db) = make_db();
        db.conn()
            .execute_batch("CREATE TABLE tx_probe (v INTEGER NOT NULL)")
            .unwrap();
        (tmp, db)
    }

    fn insert(db: &DatabaseConnection, v: i64) -> Result<(), String> {
        db.conn()
            .execute("INSERT INTO tx_probe (v) VALUES (?1)", [v])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    fn values(db: &DatabaseConnection) -> Vec<i64> {
        let mut stmt = db
            .conn()
            .prepare("SELECT v FROM tx_probe ORDER BY v")
            .unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<i64>, _>>()
            .unwrap()
    }

    /// Every path out of the helper must leave the unit count at zero.
    fn assert_no_unit_open(db: &DatabaseConnection) {
        assert_eq!(db.write_depth.get(), 0, "write_depth must return to 0");
    }

    #[test]
    fn test_transaction_is_autocommit_reports_open_transaction() {
        // Assumption the helper relies on to choose BEGIN vs SAVEPOINT.
        let (_tmp, db) = setup();
        assert!(db.conn().is_autocommit());
        db.conn().execute_batch("BEGIN IMMEDIATE").unwrap();
        assert!(!db.conn().is_autocommit());
        db.conn().execute_batch("SAVEPOINT md_write").unwrap();
        assert!(!db.conn().is_autocommit());
        db.conn().execute_batch("RELEASE md_write").unwrap();
        db.conn().execute_batch("ROLLBACK").unwrap();
        assert!(db.conn().is_autocommit());
    }

    #[test]
    fn test_transaction_refuses_unowned_open_transaction() {
        let (_tmp, db) = setup();
        db.conn().execute_batch("BEGIN").unwrap();
        insert(&db, 7).unwrap();

        let mut ran = false;
        let err = with_write_transaction(&db, || {
            ran = true;
            insert(&db, 1)
        })
        .unwrap_err();
        assert_eq!(err, ERR_UNOWNED_TRANSACTION);
        assert!(!ran, "the closure must not run");
        assert!(
            !db.conn().is_autocommit(),
            "the foreign transaction must stay open"
        );
        assert_eq!(values(&db), vec![7], "the foreign work must be untouched");
        assert_no_unit_open(&db);
        db.conn().execute_batch("ROLLBACK").unwrap();
        assert!(values(&db).is_empty());
    }

    #[test]
    fn test_transaction_commits_alone() {
        let (_tmp, db) = setup();
        let out = with_write_transaction(&db, || {
            insert(&db, 1)?;
            insert(&db, 2)?;
            Ok("done")
        })
        .unwrap();
        assert_eq!(out, "done");
        assert_eq!(values(&db), vec![1, 2]);
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_rolls_back_alone() {
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            Err("boom".to_string())
        })
        .unwrap_err();
        assert_eq!(err, "boom");
        assert!(values(&db).is_empty());
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_inner_failure_keeps_outer_usable() {
        let (_tmp, db) = setup();
        with_write_transaction(&db, || {
            insert(&db, 1)?;
            let inner = with_write_transaction(&db, || -> Result<(), String> {
                insert(&db, 2)?;
                Err("inner failed".to_string())
            });
            assert_eq!(inner.unwrap_err(), "inner failed");
            assert!(
                !db.conn().is_autocommit(),
                "outer transaction must stay open"
            );
            assert_eq!(db.write_depth.get(), 1, "only the outer unit is open");
            insert(&db, 3)?;
            Ok(())
        })
        .unwrap();
        assert_eq!(values(&db), vec![1, 3]);
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_outer_failure_rolls_back_released_inner_work() {
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            with_write_transaction(&db, || insert(&db, 2))?;
            Err("outer failed".to_string())
        })
        .unwrap_err();
        assert_eq!(err, "outer failed");
        assert!(values(&db).is_empty());
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_panic_rolls_back() {
        let (_tmp, db) = setup();
        let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = with_write_transaction(&db, || -> Result<(), String> {
                insert(&db, 1).unwrap();
                panic!("panic inside the unit");
            });
        }));
        assert!(caught.is_err());
        assert!(
            db.conn().is_autocommit(),
            "panic must not leave a transaction open"
        );
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());

        // A panic in a nested unit rolls back only that unit.
        with_write_transaction(&db, || {
            insert(&db, 10)?;
            let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = with_write_transaction(&db, || -> Result<(), String> {
                    insert(&db, 11).unwrap();
                    panic!("panic inside the nested unit");
                });
            }));
            assert!(caught.is_err());
            assert!(!db.conn().is_autocommit());
            assert_eq!(db.write_depth.get(), 1, "the nested unit closed on unwind");
            Ok(())
        })
        .unwrap();
        assert_eq!(values(&db), vec![10]);
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_two_levels_of_nesting() {
        // Also proves the stacked same-name savepoint assumption: the innermost
        // ROLLBACK TO md_write undoes only the innermost level.
        let (_tmp, db) = setup();
        with_write_transaction(&db, || {
            insert(&db, 1)?;
            with_write_transaction(&db, || {
                insert(&db, 2)?;
                let innermost = with_write_transaction(&db, || -> Result<(), String> {
                    insert(&db, 3)?;
                    Err("innermost failed".to_string())
                });
                assert!(innermost.is_err());
                insert(&db, 4)?;
                with_write_transaction(&db, || insert(&db, 5))
            })?;
            Ok(())
        })
        .unwrap();
        assert_eq!(values(&db), vec![1, 2, 4, 5]);
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
    }

    #[test]
    fn test_transaction_returns_original_error_after_sqlite_rolled_back_everything() {
        // Simulates SQLite answering an error (SQLITE_FULL, SQLITE_IOERR) by rolling back
        // the whole transaction: the nested guard must skip ROLLBACK TO / RELEASE and the
        // caller must see the original error, not "no such savepoint".
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            with_write_transaction(&db, || -> Result<(), String> {
                insert(&db, 2)?;
                db.conn().execute_batch("ROLLBACK").unwrap();
                Err("disk full".to_string())
            })
        })
        .unwrap_err();
        assert_eq!(err, "disk full");
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());
    }

    #[test]
    fn test_transaction_refuses_helper_call_after_parent_was_lost() {
        // The outer closure swallows the nested error and calls the helper again. Without
        // the depth check that call would see autocommit, BEGIN a new transaction and
        // commit it, although the outer unit then reports failure.
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            let nested = with_write_transaction(&db, || -> Result<(), String> {
                insert(&db, 2)?;
                db.conn().execute_batch("ROLLBACK").unwrap();
                Err("disk full".to_string())
            });
            assert_eq!(nested.unwrap_err(), "disk full");
            with_write_transaction(&db, || insert(&db, 3))
        })
        .unwrap_err();
        assert_eq!(err, ERR_WRITE_UNIT_LOST);
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());

        // The poison flag belongs to the lost unit only: a fresh unit commits.
        with_write_transaction(&db, || insert(&db, 4)).unwrap();
        assert_eq!(values(&db), vec![4]);
    }

    #[test]
    fn test_transaction_swallowed_loss_does_not_report_success() {
        // The outer closure swallows the nested error and returns Ok without calling the
        // helper again: the outermost unit must still report the loss.
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            let _ = with_write_transaction(&db, || -> Result<(), String> {
                db.conn().execute_batch("ROLLBACK").unwrap();
                Err("disk full".to_string())
            });
            Ok(())
        })
        .unwrap_err();
        assert_eq!(err, ERR_WRITE_UNIT_LOST);
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());
    }

    #[test]
    fn test_transaction_trigger_raise_rollback_loses_whole_unit() {
        // A real whole-transaction rollback from SQLite, not a simulated raw ROLLBACK.
        let (_tmp, db) = setup();
        db.conn()
            .execute_batch(
                "CREATE TRIGGER tx_probe_abort BEFORE INSERT ON tx_probe WHEN NEW.v = 99
                 BEGIN SELECT RAISE(ROLLBACK, 'probe abort'); END;",
            )
            .unwrap();

        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            let nested_err = with_write_transaction(&db, || insert(&db, 99)).unwrap_err();
            assert!(nested_err.contains("probe abort"), "got: {}", nested_err);
            assert!(db.conn().is_autocommit(), "SQLite rolled back everything");
            with_write_transaction(&db, || insert(&db, 3))
        })
        .unwrap_err();
        assert_eq!(err, ERR_WRITE_UNIT_LOST);
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());

        with_write_transaction(&db, || insert(&db, 4)).unwrap();
        assert_eq!(values(&db), vec![4]);
    }

    #[test]
    fn test_transaction_failed_nested_rollback_poisons_outer_unit() {
        // The nested closure removes its own savepoint with a raw RELEASE, so the guard's
        // ROLLBACK TO fails with "no such savepoint" while the outer transaction stays open.
        // The outer closure swallows the error and returns Ok: it must not commit.
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            let nested = with_write_transaction(&db, || -> Result<(), String> {
                insert(&db, 2)?;
                db.conn().execute_batch("RELEASE md_write").unwrap();
                Err("inner failed".to_string())
            });
            assert_eq!(nested.unwrap_err(), "inner failed");
            assert!(!db.conn().is_autocommit(), "the outer transaction is open");
            assert!(
                db.write_poisoned.get(),
                "the failed rollback poisons the unit"
            );
            Ok(())
        })
        .unwrap_err();
        assert_eq!(err, ERR_WRITE_UNIT_LOST);
        assert!(
            db.conn().is_autocommit(),
            "the poisoned unit was rolled back"
        );
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());
    }

    #[test]
    fn test_transaction_poisoned_unit_rolls_back_instead_of_committing() {
        // Policy test for a poisoned unit whose nested level released cleanly: the flag is
        // set directly, so only the outermost commit decision is under test.
        let (_tmp, db) = setup();
        let err = with_write_transaction(&db, || -> Result<(), String> {
            insert(&db, 1)?;
            with_write_transaction(&db, || {
                insert(&db, 2)?;
                db.write_poisoned.set(true);
                Ok(())
            })
        })
        .unwrap_err();
        assert_eq!(err, ERR_WRITE_UNIT_LOST);
        assert!(
            db.conn().is_autocommit(),
            "the poisoned unit was rolled back"
        );
        assert_no_unit_open(&db);
        assert!(values(&db).is_empty());
    }

    #[test]
    fn test_transaction_commit_failure_rolls_back() {
        // A reader holding a SHARED lock makes COMMIT fail with BUSY (rollback journal).
        let (_tmp, db) = setup();
        let mode: String = db
            .conn()
            .query_row("PRAGMA journal_mode = DELETE", [], |r| r.get(0))
            .unwrap();
        assert_eq!(mode, "delete");
        let path = db.conn().path().unwrap().to_string();
        let reader = crate::db::schema::open_connection(&path).unwrap();
        reader.execute_batch("BEGIN").unwrap();
        let _: i64 = reader
            .query_row("SELECT COUNT(*) FROM tx_probe", [], |r| r.get(0))
            .unwrap();
        db.conn()
            .busy_timeout(std::time::Duration::from_millis(0))
            .unwrap();

        let err = with_write_transaction(&db, || insert(&db, 1)).unwrap_err();
        assert!(err.starts_with("COMMIT failed:"), "got: {}", err);
        assert!(db.conn().is_autocommit());
        assert_no_unit_open(&db);
        reader.execute_batch("ROLLBACK").unwrap();
        let count: i64 = reader
            .query_row("SELECT COUNT(*) FROM tx_probe", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0, "the failed commit must not reach the database");
    }

    #[test]
    fn test_transaction_begin_failure_is_reported() {
        let (_tmp, db) = setup();
        // A second connection holding a write lock makes BEGIN IMMEDIATE fail with BUSY.
        let path = db.conn().path().unwrap().to_string();
        let other = crate::db::schema::open_connection(&path).unwrap();
        other.execute_batch("BEGIN IMMEDIATE").unwrap();
        db.conn()
            .busy_timeout(std::time::Duration::from_millis(0))
            .unwrap();

        let err = with_write_transaction(&db, || insert(&db, 1)).unwrap_err();
        assert!(err.starts_with("BEGIN failed:"), "got: {}", err);
        assert_no_unit_open(&db);
        other.execute_batch("ROLLBACK").unwrap();
        assert!(values(&db).is_empty());
    }
}
