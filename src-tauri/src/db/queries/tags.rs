use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use rusqlite::params;
use std::collections::HashMap;

/// A tag with its decrypted name (never stored as plaintext in the DB)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// Creates a tag (or returns the existing one if the normalized name already exists).
pub fn create_tag(db: &DatabaseConnection, name: &str) -> Result<Tag, String> {
    let fingerprint = cipher::tag_name_fingerprint(db.key(), name);
    let name_encrypted = super::encrypt_for_storage(db.key(), name.trim().as_bytes(), "tag name")?;
    let now = chrono::Utc::now().to_rfc3339();

    db.conn()
        .execute(
            "INSERT OR IGNORE INTO tags (name_encrypted, name_fingerprint, created_at) VALUES (?1, ?2, ?3)",
            params![&name_encrypted, &fingerprint, &now],
        )
        .map_err(|e| format!("Failed to insert tag: {}", e))?;

    // Fetch by fingerprint (handles both insert and existing-tag cases)
    let (id, enc, created_at): (i64, Vec<u8>, String) = db
        .conn()
        .query_row(
            "SELECT id, name_encrypted, created_at FROM tags WHERE name_fingerprint = ?1",
            params![&fingerprint],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Failed to retrieve tag: {}", e))?;

    let name = super::decrypt_utf8(db.key(), &enc, "tag name")?;

    Ok(Tag {
        id,
        name,
        created_at,
    })
}

/// Returns all tags, decrypted and sorted alphabetically by name (case-insensitive).
pub fn get_all_tags(db: &DatabaseConnection) -> Result<Vec<Tag>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT id, name_encrypted, created_at FROM tags")
        .map_err(|e| format!("Failed to prepare tags query: {}", e))?;

    let raw: Vec<(i64, Vec<u8>, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query tags: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read tag row: {}", e))?;

    let mut tags: Vec<Tag> = raw
        .into_iter()
        .map(|(id, enc, created_at)| {
            let name = super::decrypt_utf8(db.key(), &enc, "tag name")?;
            Ok(Tag {
                id,
                name,
                created_at,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    tags.sort_by_key(|a| a.name.to_lowercase());
    Ok(tags)
}

/// Renames a tag by id. Errors if the new name already exists.
pub fn rename_tag(db: &DatabaseConnection, id: i64, new_name: &str) -> Result<(), String> {
    let fingerprint = cipher::tag_name_fingerprint(db.key(), new_name);
    let name_encrypted =
        super::encrypt_for_storage(db.key(), new_name.trim().as_bytes(), "tag name")?;

    let rows = db
        .conn()
        .execute(
            "UPDATE tags SET name_encrypted = ?1, name_fingerprint = ?2 WHERE id = ?3",
            params![&name_encrypted, &fingerprint, id],
        )
        .map_err(|e| format!("Failed to rename tag: {}", e))?;

    if rows == 0 {
        return Err(format!("No tag found with id: {}", id));
    }
    Ok(())
}

/// Deletes a tag by id. Cascade removes its entry_tags rows.
pub fn delete_tag(db: &DatabaseConnection, id: i64) -> Result<(), String> {
    db.conn()
        .execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete tag: {}", e))?;
    Ok(())
}

/// Associates a tag with an entry (idempotent — INSERT OR IGNORE).
pub fn add_tag_to_entry(db: &DatabaseConnection, entry_id: i64, tag_id: i64) -> Result<(), String> {
    db.conn()
        .execute(
            "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?1, ?2)",
            params![entry_id, tag_id],
        )
        .map_err(|e| format!("Failed to add tag to entry: {}", e))?;
    Ok(())
}

/// Removes the association between a tag and an entry.
pub fn remove_tag_from_entry(
    db: &DatabaseConnection,
    entry_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM entry_tags WHERE entry_id = ?1 AND tag_id = ?2",
            params![entry_id, tag_id],
        )
        .map_err(|e| format!("Failed to remove tag from entry: {}", e))?;
    Ok(())
}

/// Returns all tags for a given entry, decrypted and sorted alphabetically.
pub fn get_tags_for_entry(db: &DatabaseConnection, entry_id: i64) -> Result<Vec<Tag>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT t.id, t.name_encrypted, t.created_at
             FROM tags t
             JOIN entry_tags et ON t.id = et.tag_id
             WHERE et.entry_id = ?1",
        )
        .map_err(|e| format!("Failed to prepare tags-for-entry query: {}", e))?;

    let raw: Vec<(i64, Vec<u8>, String)> = stmt
        .query_map(params![entry_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query tags for entry: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read tag row: {}", e))?;

    let mut tags: Vec<Tag> = raw
        .into_iter()
        .map(|(id, enc, created_at)| {
            let name = super::decrypt_utf8(db.key(), &enc, "tag name")?;
            Ok(Tag {
                id,
                name,
                created_at,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    tags.sort_by_key(|a| a.name.to_lowercase());
    Ok(tags)
}

/// Returns a map of entry_id → sorted decrypted tag names for all entries in the journal.
/// Entries with no tags are not included in the map.
pub fn get_tags_names_map(db: &DatabaseConnection) -> Result<HashMap<i64, Vec<String>>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT et.entry_id, t.name_encrypted
             FROM entry_tags et
             JOIN tags t ON t.id = et.tag_id",
        )
        .map_err(|e| format!("Failed to prepare tags map query: {}", e))?;

    let rows: Vec<(i64, Vec<u8>)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?))
        })
        .map_err(|e| format!("Failed to query tags map: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read tags map row: {}", e))?;

    let mut map: HashMap<i64, Vec<String>> = HashMap::new();
    for (entry_id, enc) in rows {
        let name = super::decrypt_utf8(db.key(), &enc, "tag name")?;
        map.entry(entry_id).or_default().push(name);
    }
    for names in map.values_mut() {
        names.sort_by_key(|n| n.to_lowercase());
    }
    Ok(map)
}

/// Returns the distinct entry dates (YYYY-MM-DD) associated with a given tag id.
pub fn get_entry_dates_by_tag(db: &DatabaseConnection, tag_id: i64) -> Result<Vec<String>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT DISTINCT e.date
             FROM entries e
             JOIN entry_tags et ON e.id = et.entry_id
             WHERE et.tag_id = ?1
             ORDER BY e.date ASC",
        )
        .map_err(|e| format!("Failed to prepare dates-by-tag query: {}", e))?;

    let dates = stmt
        .query_map(params![tag_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query dates by tag: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;

    Ok(dates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::{delete_entry_by_id, insert_entry, DiaryEntry};
    use crate::db::schema::create_database;

    fn create_test_entry(date: &str) -> DiaryEntry {
        let now = "2024-01-01T12:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "Test Title".to_string(),
            text: "This is a test entry with some words.".to_string(),
            word_count: 8,
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_get_tags_names_map() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-06-01");
        insert_entry(&db, &entry).unwrap();
        let entry_id = db.conn().last_insert_rowid();

        let tag1 = create_tag(&db, "work").unwrap();
        let tag2 = create_tag(&db, "zzz-last").unwrap();
        let tag3 = create_tag(&db, "aaa-first").unwrap();
        add_tag_to_entry(&db, entry_id, tag1.id).unwrap();
        add_tag_to_entry(&db, entry_id, tag2.id).unwrap();
        add_tag_to_entry(&db, entry_id, tag3.id).unwrap();

        let map = get_tags_names_map(&db).unwrap();
        let names = map.get(&entry_id).unwrap();
        assert_eq!(names, &["aaa-first", "work", "zzz-last"]);

        // Entry with no tags → not in map
        let entry2 = create_test_entry("2024-06-02");
        insert_entry(&db, &entry2).unwrap();
        let entry2_id = db.conn().last_insert_rowid();
        assert!(!map.contains_key(&entry2_id));
    }

    #[test]
    fn test_tags_crud() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let all = get_all_tags(&db).unwrap();
        assert!(all.is_empty());

        let tag = create_tag(&db, "work").unwrap();
        assert!(tag.id > 0);
        assert_eq!(tag.name, "work");

        let tag2 = create_tag(&db, "Work").unwrap();
        assert_eq!(tag.id, tag2.id);

        let all = get_all_tags(&db).unwrap();
        assert_eq!(all.len(), 1);

        rename_tag(&db, tag.id, "Work2").unwrap();
        let all = get_all_tags(&db).unwrap();
        assert_eq!(all[0].name, "Work2");

        delete_tag(&db, tag.id).unwrap();
        let all = get_all_tags(&db).unwrap();
        assert!(all.is_empty());
    }

    #[test]
    fn test_entry_tags_and_cascade() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-06-01");
        insert_entry(&db, &entry).unwrap();
        let entry_id = db.conn().last_insert_rowid();

        let tag = create_tag(&db, "personal").unwrap();

        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "personal");

        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert_eq!(tags.len(), 1);

        let dates = get_entry_dates_by_tag(&db, tag.id).unwrap();
        assert_eq!(dates, vec!["2024-06-01"]);

        remove_tag_from_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert!(tags.is_empty());

        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        delete_entry_by_id(&db, entry_id).unwrap();
        let dates = get_entry_dates_by_tag(&db, tag.id).unwrap();
        assert!(
            dates.is_empty(),
            "entry_tags must be removed via CASCADE when entry is deleted"
        );

        let entry2 = create_test_entry("2024-06-02");
        insert_entry(&db, &entry2).unwrap();
        let entry2_id = db.conn().last_insert_rowid();
        add_tag_to_entry(&db, entry2_id, tag.id).unwrap();
        delete_tag(&db, tag.id).unwrap();
        let tags2 = get_tags_for_entry(&db, entry2_id).unwrap();
        assert!(
            tags2.is_empty(),
            "entry_tags must be removed via CASCADE when tag is deleted"
        );
    }
}
