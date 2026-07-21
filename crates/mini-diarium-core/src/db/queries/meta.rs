//! Small read-only introspection queries used by stats and the debug dump.
//!
//! These exist so callers never need a raw `rusqlite::Connection` handle to read
//! the schema version, engine facts, or per-entry (date, word_count) rows.

use crate::db::schema::DatabaseConnection;

/// Reads the stored schema version from the `schema_version` table.
pub fn read_schema_version(db: &DatabaseConnection) -> Result<i32, String> {
    db.conn()
        .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read schema version: {}", e))
}

/// Returns `(PRAGMA user_version, sqlite_version())` for diagnostics (debug dump).
///
/// Both values are best-effort engine facts; failures fall back to `-1` /
/// `"unknown"` at the call site, so this returns the raw values without masking.
pub fn read_engine_versions(db: &DatabaseConnection) -> (i32, String) {
    let conn = db.conn();
    let user_version: i32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(-1);
    let sqlite_version: String = conn
        .query_row("SELECT sqlite_version()", [], |r| r.get(0))
        .unwrap_or_else(|_| "unknown".to_string());
    (user_version, sqlite_version)
}

/// Returns `(date, word_count)` for every entry, ordered by date then id (ascending).
///
/// The plaintext `date` and `word_count` columns are not encrypted, so this needs no
/// decryption. Used by statistics and the debug dump to derive counts, totals, streaks,
/// and the entry date range.
pub fn get_entry_date_word_counts(db: &DatabaseConnection) -> Result<Vec<(String, i32)>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT date, word_count FROM entries ORDER BY date ASC, id ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect entries: {}", e))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::{create_database, SCHEMA_VERSION};
    use crate::db::{insert_entry, DiaryEntry};

    fn entry(date: &str, word_count: i32) -> DiaryEntry {
        let now = "2024-01-01T00:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "T".to_string(),
            text: "hello world".to_string(),
            word_count,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        }
    }

    #[test]
    fn test_read_schema_version_matches_constant() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        assert_eq!(read_schema_version(&db).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn test_read_engine_versions_returns_sqlite_version() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let (_user_version, sqlite_version) = read_engine_versions(&db);
        assert!(!sqlite_version.is_empty());
        assert_ne!(sqlite_version, "unknown");
    }

    #[test]
    fn test_get_entry_date_word_counts_orders_and_sums() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-02", 5)).unwrap();
        insert_entry(&db, &entry("2024-01-01", 3)).unwrap();
        insert_entry(&db, &entry("2024-01-01", 7)).unwrap();

        let rows = get_entry_date_word_counts(&db).unwrap();
        assert_eq!(rows.len(), 3);
        // Ordered by date ASC, then id ASC.
        assert_eq!(rows[0], ("2024-01-01".to_string(), 3));
        assert_eq!(rows[1], ("2024-01-01".to_string(), 7));
        assert_eq!(rows[2], ("2024-01-02".to_string(), 5));
        let total: i32 = rows.iter().map(|(_, w)| w).sum();
        assert_eq!(total, 15);
    }

    #[test]
    fn test_get_entry_date_word_counts_empty() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        assert!(get_entry_date_word_counts(&db).unwrap().is_empty());
    }
}
