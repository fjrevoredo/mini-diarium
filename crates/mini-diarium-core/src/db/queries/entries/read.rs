use super::{DiaryEntry, EntryMetadata};
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

// Shared column projection for all entry queries.
const ENTRY_SELECT: &str =
    "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated, \
     entry_metadata_encrypted, locked FROM entries";

type EntryRow = (
    i64,
    String,
    Vec<u8>,
    Vec<u8>,
    i32,
    String,
    String,
    Option<Vec<u8>>,
    bool,
);

fn row_to_entry(db: &DatabaseConnection, row: EntryRow) -> Result<DiaryEntry, String> {
    let (
        id,
        date,
        title_enc,
        text_enc,
        word_count,
        date_created,
        date_updated,
        metadata_enc,
        locked,
    ) = row;
    let title = crate::db::queries::decrypt_utf8(db.key(), &title_enc, "title")?;
    let text = crate::db::queries::decrypt_utf8(db.key(), &text_enc, "text")?;
    let metadata = match metadata_enc {
        Some(enc) => {
            let json = crate::db::queries::decrypt_utf8(db.key(), &enc, "entry_metadata")?;
            Some(
                serde_json::from_str::<EntryMetadata>(&json)
                    .map_err(|e| format!("Failed to parse entry metadata: {}", e))?,
            )
        }
        None => None,
    };
    Ok(DiaryEntry {
        id,
        date,
        title,
        text,
        word_count,
        date_created,
        date_updated,
        metadata,
        locked,
    })
}

/// Retrieves all entries for a given date, newest-first (ORDER BY id DESC)
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `date` - The date of the entries to retrieve (YYYY-MM-DD)
///
/// # Returns
/// A vector of DiaryEntry (possibly empty if no entries exist for this date)
pub fn get_entries_by_date(db: &DatabaseConnection, date: &str) -> Result<Vec<DiaryEntry>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!(
            "{} WHERE date = ?1 ORDER BY id DESC",
            ENTRY_SELECT
        ))
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map(params![date], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
                row.get::<_, bool>(8)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

/// Retrieves a single entry by its id
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `id` - The id of the entry to retrieve
///
/// # Returns
/// `Some(DiaryEntry)` if found, `None` otherwise
pub fn get_entry_by_id(db: &DatabaseConnection, id: i64) -> Result<Option<DiaryEntry>, String> {
    let result = db.conn().query_row(
        &format!("{} WHERE id = ?1", ENTRY_SELECT),
        params![id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
                row.get::<_, bool>(8)?,
            ))
        },
    );

    match result {
        Ok(row) => Ok(Some(row_to_entry(db, row)?)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Retrieves all dates that have entries (distinct)
///
/// # Arguments
/// * `db` - Database connection
///
/// # Returns
/// A vector of date strings (YYYY-MM-DD) sorted chronologically
pub fn get_all_entry_dates(db: &DatabaseConnection) -> Result<Vec<String>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT DISTINCT date FROM entries ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let dates = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query dates: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;

    Ok(dates)
}

/// Retrieves and decrypts all diary entries in a single query (avoids N+1)
///
/// # Arguments
/// * `db` - Database connection with encryption key
///
/// # Returns
/// A vector of all diary entries sorted chronologically (date ASC, id ASC)
pub fn get_all_entries(db: &DatabaseConnection) -> Result<Vec<DiaryEntry>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!("{} ORDER BY date ASC, id ASC", ENTRY_SELECT))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
                row.get::<_, bool>(8)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

pub fn get_entries_in_range(
    db: &DatabaseConnection,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<Vec<DiaryEntry>, String> {
    let mut sql = String::from(ENTRY_SELECT);
    let mut param_values: Vec<String> = Vec::new();
    let mut has_where = false;

    if let Some(from) = date_from {
        sql.push_str(" WHERE date >= ?");
        param_values.push(from.to_string());
        has_where = true;
    }
    if let Some(to) = date_to {
        if has_where {
            sql.push_str(" AND");
        } else {
            sql.push_str(" WHERE");
        }
        sql.push_str(" date <= ?");
        param_values.push(to.to_string());
    }
    sql.push_str(" ORDER BY date ASC, id ASC");

    let params_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = db
        .conn()
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let raw: Vec<EntryRow> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<Vec<u8>>>(7)?,
                row.get::<_, bool>(8)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read row: {}", e))?;

    raw.into_iter().map(|row| row_to_entry(db, row)).collect()
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_get_entries_by_date_empty() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_entries_by_date(&db, "2024-12-31").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-02-10");
        insert_entry(&db, &entry).unwrap();
        let inserted_id = db.conn().last_insert_rowid();

        let retrieved = get_entry_by_id(&db, inserted_id).unwrap();
        assert!(retrieved.is_some());
        let e = retrieved.unwrap();
        assert_eq!(e.id, inserted_id);
        assert_eq!(e.date, "2024-02-10");
        assert_eq!(e.title, "Test Title");
    }

    #[test]
    fn test_get_entry_by_id_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_entry_by_id(&db, 99999).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_all_entry_dates_distinct() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-05")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();

        let dates = get_all_entry_dates(&db).unwrap();
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-05");
        assert_eq!(dates[1], "2024-01-10");
        assert_eq!(dates[2], "2024-01-20");
    }

    #[test]
    fn test_get_all_entries_returns_all_decrypted() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pw".to_string()).unwrap();
        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-01".into(),
                title: "A".into(),
                text: "<p>Hello</p>".into(),
                word_count: 1,
                date_created: "2024-01-01T00:00:00Z".into(),
                date_updated: "2024-01-01T00:00:00Z".into(),
                metadata: None,
                locked: false,
            },
        )
        .unwrap();
        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-02".into(),
                title: "B".into(),
                text: "<p>World</p>".into(),
                word_count: 1,
                date_created: "2024-01-02T00:00:00Z".into(),
                date_updated: "2024-01-02T00:00:00Z".into(),
                metadata: None,
                locked: false,
            },
        )
        .unwrap();
        let entries = get_all_entries(&db).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-01");
        assert_eq!(entries[0].title, "A");
        assert!(entries[0].id > 0);
    }

    #[test]
    fn test_get_all_entries_corrupted_title_returns_error() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pw".to_string()).unwrap();

        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-01-01".into(),
                title: "Test".into(),
                text: "<p>Content</p>".into(),
                word_count: 1,
                date_created: "2024-01-01T00:00:00Z".into(),
                date_updated: "2024-01-01T00:00:00Z".into(),
                metadata: None,
                locked: false,
            },
        )
        .unwrap();

        let id = db.conn().last_insert_rowid();

        db.conn()
            .execute(
                "UPDATE entries SET title_encrypted = x'deadbeef01020304' WHERE id = ?1",
                rusqlite::params![id],
            )
            .unwrap();

        let result = get_all_entries(&db);
        assert!(
            result.is_err(),
            "Expected Err when title_encrypted is corrupted, got Ok with entries: {:?}",
            result.ok()
        );
    }

    #[test]
    fn test_get_entries_in_range_no_filter() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, None, None).unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_get_entries_in_range_from_only() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-02-01"), None).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-02-15");
        assert_eq!(entries[1].date, "2024-03-20");
    }

    #[test]
    fn test_get_entries_in_range_to_only() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();

        let entries = get_entries_in_range(&db, None, Some("2024-02-28")).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-10");
        assert_eq!(entries[1].date, "2024-02-15");
    }

    #[test]
    fn test_get_entries_in_range_both_bounds() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();
        insert_entry(&db, &create_test_entry("2024-03-20")).unwrap();
        insert_entry(&db, &create_test_entry("2024-04-05")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-02-01"), Some("2024-03-31")).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-02-15");
        assert_eq!(entries[1].date, "2024-03-20");
    }

    #[test]
    fn test_get_entries_in_range_no_match() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-02-15")).unwrap();

        let entries = get_entries_in_range(&db, Some("2025-01-01"), Some("2025-12-31")).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_get_entries_in_range_inclusive_bounds() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-31")).unwrap();

        let entries = get_entries_in_range(&db, Some("2024-01-10"), Some("2024-01-31")).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].date, "2024-01-10");
        assert_eq!(entries[2].date, "2024-01-31");
    }
}
