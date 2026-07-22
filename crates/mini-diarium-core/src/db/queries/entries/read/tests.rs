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
