//! The one way core runs a multi-step write as an atomic unit.

use crate::db::schema::DatabaseConnection;

/// Savepoint name for a nested write unit. SQLite allows the same name to be stacked;
/// `ROLLBACK TO` / `RELEASE` always target the newest savepoint with that name, so each
/// nesting level addresses its own savepoint.
const SAVEPOINT_NAME: &str = "md_write";

/// Runs `f` as one atomic write unit and nests safely inside a larger unit.
///
/// - No transaction open: `BEGIN IMMEDIATE`, run `f`, `COMMIT`; `ROLLBACK` on error.
/// - A transaction already open: `SAVEPOINT md_write`, run `f`, `RELEASE md_write`; on
///   error, `ROLLBACK TO md_write` then `RELEASE md_write`, so only this unit's work is
///   undone and the outer unit stays usable.
///
/// A drop guard performs the rollback, so a panic inside `f` also leaves the connection
/// with no half-open transaction or savepoint. When SQLite has already rolled back the
/// whole transaction itself (for example on `SQLITE_FULL` or `SQLITE_IOERR`), the
/// connection is back in autocommit mode; the guard then issues nothing and the original
/// error is returned unchanged.
///
/// Callers must propagate an error from a nested unit. SQLite has then discarded the outer
/// transaction too, so code that swallows the error and keeps writing would write in
/// autocommit mode; the outer unit's `COMMIT` reports "no transaction is active".
pub(crate) fn with_write_transaction<T>(
    db: &DatabaseConnection,
    f: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let nested = !db.conn().is_autocommit();
    if nested {
        db.conn()
            .execute_batch(&format!("SAVEPOINT {}", SAVEPOINT_NAME))
            .map_err(|e| format!("SAVEPOINT failed: {}", e))?;
    } else {
        db.conn()
            .execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| format!("BEGIN failed: {}", e))?;
    }

    let guard = RollbackGuard {
        db,
        nested,
        armed: true,
    };
    let value = f()?;
    guard.commit()?;
    Ok(value)
}

/// Rolls back the unit it guards unless [`RollbackGuard::commit`] succeeded.
struct RollbackGuard<'a> {
    db: &'a DatabaseConnection,
    nested: bool,
    armed: bool,
}

impl RollbackGuard<'_> {
    /// Commits (outermost) or releases (nested) the unit. On failure the guard stays armed,
    /// so dropping it rolls the unit back.
    fn commit(mut self) -> Result<(), String> {
        let conn = self.db.conn();
        if self.nested {
            conn.execute_batch(&format!("RELEASE {}", SAVEPOINT_NAME))
                .map_err(|e| format!("RELEASE failed: {}", e))?;
        } else {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("COMMIT failed: {}", e))?;
        }
        self.armed = false;
        Ok(())
    }
}

impl Drop for RollbackGuard<'_> {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        let conn = self.db.conn();
        // SQLite already rolled back the whole transaction: nothing is left to undo, and a
        // `ROLLBACK TO` would only fail with "no such savepoint".
        if conn.is_autocommit() {
            return;
        }
        // Errors are ignored: this runs on an error or panic path whose original cause is
        // what the caller must see, and a drop cannot return an error.
        if self.nested {
            let _ = conn.execute_batch(&format!(
                "ROLLBACK TO {name}; RELEASE {name}",
                name = SAVEPOINT_NAME
            ));
        } else {
            let _ = conn.execute_batch("ROLLBACK");
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
            insert(&db, 3)?;
            Ok(())
        })
        .unwrap();
        assert_eq!(values(&db), vec![1, 3]);
        assert!(db.conn().is_autocommit());
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
            Ok(())
        })
        .unwrap();
        assert_eq!(values(&db), vec![10]);
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
        assert!(values(&db).is_empty());
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
        other.execute_batch("ROLLBACK").unwrap();
        assert!(values(&db).is_empty());
    }
}
