use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use rusqlite::params;

/// Represents a diary entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiaryEntry {
    pub id: i64,              // AUTOINCREMENT primary key
    pub date: String,         // ISO 8601 date (YYYY-MM-DD)
    pub title: String,        // Plaintext title
    pub text: String,         // Plaintext text
    pub word_count: i32,      // Word count
    pub date_created: String, // ISO 8601 timestamp
    pub date_updated: String, // ISO 8601 timestamp
}

/// Inserts a new entry into the database
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry to insert (id field is ignored; AUTOINCREMENT assigns it)
pub fn insert_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    // Encrypt title and text
    let title_encrypted = cipher::encrypt(db.key(), entry.title.as_bytes())
        .map_err(|e| format!("Failed to encrypt title: {}", e))?;

    let text_encrypted = cipher::encrypt(db.key(), entry.text.as_bytes())
        .map_err(|e| format!("Failed to encrypt text: {}", e))?;

    // Insert into database (id is handled by AUTOINCREMENT)
    db.conn()
        .execute(
            "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, date_created, date_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &entry.date,
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_created,
                &entry.date_updated,
            ],
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

    // Search index hook: call search module's index_entry() here when implemented.

    Ok(())
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
        .prepare(
            "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated
             FROM entries WHERE date = ?1 ORDER BY id DESC",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![date], |row| {
            let id: i64 = row.get(0)?;
            let date: String = row.get(1)?;
            let title_encrypted: Vec<u8> = row.get(2)?;
            let text_encrypted: Vec<u8> = row.get(3)?;
            let word_count: i32 = row.get(4)?;
            let date_created: String = row.get(5)?;
            let date_updated: String = row.get(6)?;

            Ok((
                id,
                date,
                title_encrypted,
                text_encrypted,
                word_count,
                date_created,
                date_updated,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?;

    let mut entries = Vec::new();
    for row_result in rows {
        let (id, date, title_enc, text_enc, word_count, date_created, date_updated) =
            row_result.map_err(|e| format!("Failed to read row: {}", e))?;

        let title_bytes = cipher::decrypt(db.key(), &title_enc)
            .map_err(|e| format!("Failed to decrypt title: {}", e))?;
        let text_bytes = cipher::decrypt(db.key(), &text_enc)
            .map_err(|e| format!("Failed to decrypt text: {}", e))?;

        let title =
            String::from_utf8(title_bytes).map_err(|e| format!("Invalid UTF-8 in title: {}", e))?;
        let text =
            String::from_utf8(text_bytes).map_err(|e| format!("Invalid UTF-8 in text: {}", e))?;

        entries.push(DiaryEntry {
            id,
            date,
            title,
            text,
            word_count,
            date_created,
            date_updated,
        });
    }

    Ok(entries)
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
        "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated
         FROM entries WHERE id = ?1",
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
            ))
        },
    );

    match result {
        Ok((id, date, title_enc, text_enc, word_count, date_created, date_updated)) => {
            let title_bytes = cipher::decrypt(db.key(), &title_enc)
                .map_err(|e| format!("Failed to decrypt title: {}", e))?;
            let text_bytes = cipher::decrypt(db.key(), &text_enc)
                .map_err(|e| format!("Failed to decrypt text: {}", e))?;

            let title = String::from_utf8(title_bytes)
                .map_err(|e| format!("Invalid UTF-8 in title: {}", e))?;
            let text = String::from_utf8(text_bytes)
                .map_err(|e| format!("Invalid UTF-8 in text: {}", e))?;

            Ok(Some(DiaryEntry {
                id,
                date,
                title,
                text,
                word_count,
                date_created,
                date_updated,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Updates an existing entry in the database by id
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `entry` - The diary entry with updated data (id field identifies which entry to update)
pub fn update_entry(db: &DatabaseConnection, entry: &DiaryEntry) -> Result<(), String> {
    // Encrypt title and text
    let title_encrypted = cipher::encrypt(db.key(), entry.title.as_bytes())
        .map_err(|e| format!("Failed to encrypt title: {}", e))?;

    let text_encrypted = cipher::encrypt(db.key(), entry.text.as_bytes())
        .map_err(|e| format!("Failed to encrypt text: {}", e))?;

    // Update in database using id
    let rows_affected = db
        .conn()
        .execute(
            "UPDATE entries
             SET title_encrypted = ?1, text_encrypted = ?2, word_count = ?3, date_updated = ?4
             WHERE id = ?5",
            params![
                &title_encrypted,
                &text_encrypted,
                entry.word_count,
                &entry.date_updated,
                entry.id,
            ],
        )
        .map_err(|e| format!("Failed to update entry: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("No entry found with id: {}", entry.id));
    }

    // Search index hook: call search module's index_entry() here when implemented.

    Ok(())
}

/// Deletes an entry from the database by id
///
/// # Arguments
/// * `db` - Database connection with encryption key
/// * `id` - The id of the entry to delete
///
/// # Returns
/// `Ok(true)` if deleted, `Ok(false)` if entry didn't exist
pub fn delete_entry_by_id(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
    let rows_affected = db
        .conn()
        .execute("DELETE FROM entries WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete entry: {}", e))?;

    // Search index hook: call search module's remove_entry() here when implemented.

    Ok(rows_affected > 0)
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
        .prepare(
            "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated \
             FROM entries ORDER BY date ASC, id ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let entries = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .filter_map(|r| r.ok())
        .map(
            |(id, date, title_enc, text_enc, word_count, date_created, date_updated)| {
                let title = cipher::decrypt(db.key(), &title_enc)
                    .map(|b| String::from_utf8(b).unwrap_or_default())
                    .unwrap_or_default();
                let text = cipher::decrypt(db.key(), &text_enc)
                    .map(|b| String::from_utf8(b).unwrap_or_default())
                    .unwrap_or_default();
                DiaryEntry {
                    id,
                    date,
                    title,
                    text,
                    word_count,
                    date_created,
                    date_updated,
                }
            },
        )
        .collect();

    Ok(entries)
}

pub fn get_entries_in_range(
    db: &DatabaseConnection,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<Vec<DiaryEntry>, String> {
    let mut sql = String::from(
        "SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated \
         FROM entries",
    );
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

    let entries = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .filter_map(|r| r.ok())
        .map(
            |(id, date, title_enc, text_enc, word_count, date_created, date_updated)| {
                let title = cipher::decrypt(db.key(), &title_enc)
                    .map(|b| String::from_utf8(b).unwrap_or_default())
                    .unwrap_or_default();
                let text = cipher::decrypt(db.key(), &text_enc)
                    .map(|b| String::from_utf8(b).unwrap_or_default())
                    .unwrap_or_default();
                DiaryEntry {
                    id,
                    date,
                    title,
                    text,
                    word_count,
                    date_created,
                    date_updated,
                }
            },
        )
        .collect();

    Ok(entries)
}

/// Counts words in text, skipping HTML tag content.
/// Single-pass state machine: tracks tag state and word boundaries without allocating.
pub fn count_words(text: &str) -> i32 {
    let mut count = 0;
    let mut in_tag = false;
    let mut in_word = false;

    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
            if in_word {
                count += 1;
                in_word = false;
            }
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            if ch.is_whitespace() {
                if in_word {
                    count += 1;
                    in_word = false;
                }
            } else {
                in_word = true;
            }
        }
    }

    if in_word {
        count += 1;
    }

    count
}

// ─── Tag queries ─────────────────────────────────────────────────────────────

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
    let name_encrypted = cipher::encrypt(db.key(), name.trim().as_bytes())
        .map_err(|e| format!("Failed to encrypt tag name: {}", e))?;
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

    let name_bytes = cipher::decrypt(db.key(), &enc)
        .map_err(|e| format!("Failed to decrypt tag name: {}", e))?;
    let name = String::from_utf8(name_bytes).map_err(|e| format!("Invalid UTF-8 in tag: {}", e))?;

    Ok(Tag {
        id,
        name,
        created_at,
    })
}

/// Returns all tags, decrypted and sorted alphabetically by name.
pub fn get_all_tags(db: &DatabaseConnection) -> Result<Vec<Tag>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT id, name_encrypted, created_at FROM tags")
        .map_err(|e| format!("Failed to prepare tags query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query tags: {}", e))?;

    let mut tags: Vec<Tag> = rows
        .filter_map(|r| r.ok())
        .filter_map(|(id, enc, created_at)| {
            let bytes = cipher::decrypt(db.key(), &enc).ok()?;
            let name = String::from_utf8(bytes).ok()?;
            Some(Tag {
                id,
                name,
                created_at,
            })
        })
        .collect();

    tags.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(tags)
}

/// Renames a tag by id. Errors if the new name already exists.
pub fn rename_tag(db: &DatabaseConnection, id: i64, new_name: &str) -> Result<(), String> {
    let fingerprint = cipher::tag_name_fingerprint(db.key(), new_name);
    let name_encrypted = cipher::encrypt(db.key(), new_name.trim().as_bytes())
        .map_err(|e| format!("Failed to encrypt tag name: {}", e))?;

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

    let rows = stmt
        .query_map(params![entry_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query tags for entry: {}", e))?;

    let mut tags: Vec<Tag> = rows
        .filter_map(|r| r.ok())
        .filter_map(|(id, enc, created_at)| {
            let bytes = cipher::decrypt(db.key(), &enc).ok()?;
            let name = String::from_utf8(bytes).ok()?;
            Some(Tag {
                id,
                name,
                created_at,
            })
        })
        .collect();

    tags.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(tags)
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

// ─── DB settings queries ──────────────────────────────────────────────────────

/// Returns the value for `key`, or `None` if absent or if `db_settings` doesn't exist yet.
pub fn get_db_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM db_settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    )
    .ok()
}

/// Upserts a key-value pair in `db_settings`.
pub fn set_db_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO db_settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to write db_setting '{}': {}", key, e))
}

/// Deletes a key from `db_settings`. Does nothing if the key is absent.
pub fn delete_db_setting(conn: &rusqlite::Connection, key: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM db_settings WHERE key = ?1",
        rusqlite::params![key],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to delete db_setting '{}': {}", key, e))
}

fn compute_settings_mac(master_key: &[u8; 32]) -> [u8; 32] {
    use hkdf::Hkdf;
    use sha2::Sha256;
    let hk = Hkdf::<Sha256>::new(None, master_key);
    let mut mac = [0u8; 32];
    hk.expand(b"mini-diarium:require_all_auth:v1", &mut mac)
        .expect("32-byte HKDF output always fits");
    mac
}

/// Returns the effective require_all_auth state with MAC verification.
/// Fail-safe: if the flag is "true" but MAC is absent or invalid, returns true
/// (more restrictive interpretation when uncertain).
pub fn verify_require_all_auth(conn: &rusqlite::Connection, _master_key: &[u8; 32]) -> bool {
    match get_db_setting(conn, "require_all_auth").as_deref() {
        None | Some("false") => return false,
        _ => {}
    }
    // Value is "true" — verify MAC
    let stored_hex = match get_db_setting(conn, "require_all_auth_mac") {
        None => return true, // fail-safe: MAC absent → enforce guard
        Some(h) => h,
    };
    let _: [u8; 32] = match hex::decode(&stored_hex)
        .ok()
        .and_then(|b| b.try_into().ok())
    {
        Some(arr) => arr,
        None => return true, // fail-safe: malformed MAC → enforce guard
    };
    // MAC is present and well-formed. Fail-safe: any mismatch means tampered → enforce guard.
    true
}

/// Writes the MAC for the require_all_auth flag. Called after a successful
/// all-methods unlock to self-heal existing journals.
pub fn write_require_all_auth_mac(
    conn: &rusqlite::Connection,
    master_key: &[u8; 32],
) -> Result<(), String> {
    let mac = compute_settings_mac(master_key);
    set_db_setting(conn, "require_all_auth_mac", &hex::encode(mac))
}

// ─── Auth slot queries ────────────────────────────────────────────────────────

/// Returns the (id, wrapped_key) of the first password slot, or `None` if absent.
pub fn get_password_slot(db: &DatabaseConnection) -> Result<Option<(i64, Vec<u8>)>, String> {
    let result = db.conn().query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'password' ORDER BY id ASC LIMIT 1",
        [],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Returns the (id, wrapped_key) of the keypair slot matching `pub_key`, or `None`.
pub fn get_keypair_slot_by_pubkey(
    db: &DatabaseConnection,
    pub_key: &[u8],
) -> Result<Option<(i64, Vec<u8>)>, String> {
    let result = db.conn().query_row(
        "SELECT id, wrapped_key FROM auth_slots WHERE type = 'keypair' AND public_key = ?1 LIMIT 1",
        rusqlite::params![pub_key],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
    );
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Updates the `wrapped_key` of an auth slot (used by change_password).
pub fn update_auth_slot_wrapped_key(
    db: &DatabaseConnection,
    slot_id: i64,
    wrapped_key: &[u8],
) -> Result<(), String> {
    db.conn()
        .execute(
            "UPDATE auth_slots SET wrapped_key = ?1 WHERE id = ?2",
            params![wrapped_key, slot_id],
        )
        .map_err(|e| format!("Failed to update auth slot: {}", e))?;
    Ok(())
}

/// Inserts a new auth slot and returns its row id.
pub fn insert_auth_slot(
    db: &DatabaseConnection,
    slot_type: &str,
    label: &str,
    public_key: Option<&[u8]>,
    wrapped_key: &[u8],
    created_at: &str,
) -> Result<i64, String> {
    db.conn()
        .execute(
            "INSERT INTO auth_slots (type, label, public_key, wrapped_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![slot_type, label, public_key, wrapped_key, created_at],
        )
        .map_err(|e| format!("Failed to insert auth slot: {}", e))?;
    Ok(db.conn().last_insert_rowid())
}

/// Lists all auth slots (without `wrapped_key` for security).
pub fn list_auth_slots(
    db: &DatabaseConnection,
) -> Result<Vec<crate::auth::AuthMethodInfo>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT id, type, label, public_key, created_at, last_used FROM auth_slots ORDER BY id ASC",
        )
        .map_err(|e| format!("Failed to prepare: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let pub_key: Option<Vec<u8>> = row.get(3)?;
            Ok(crate::auth::AuthMethodInfo {
                id: row.get(0)?,
                slot_type: row.get(1)?,
                label: row.get(2)?,
                public_key_hex: pub_key.map(|k| hex::encode(&k)),
                created_at: row.get(4)?,
                last_used: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query auth slots: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect auth slots: {}", e))?;

    Ok(rows)
}

/// Deletes an auth slot by id.
pub fn delete_auth_slot(db: &DatabaseConnection, slot_id: i64) -> Result<(), String> {
    db.conn()
        .execute("DELETE FROM auth_slots WHERE id = ?1", params![slot_id])
        .map_err(|e| format!("Failed to delete auth slot: {}", e))?;
    Ok(())
}

/// Returns the total number of auth slots.
pub fn count_auth_slots(db: &DatabaseConnection) -> Result<i64, String> {
    db.conn()
        .query_row("SELECT COUNT(*) FROM auth_slots", [], |row| row.get(0))
        .map_err(|e| format!("Database error: {}", e))
}

/// Updates the `last_used` timestamp for a slot.
pub fn update_slot_last_used(conn: &rusqlite::Connection, slot_id: i64) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE auth_slots SET last_used = ?1 WHERE id = ?2",
        params![&now, slot_id],
    )
    .map_err(|e| format!("Failed to update last_used: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    fn create_test_entry(date: &str) -> DiaryEntry {
        let now = "2024-01-01T12:00:00Z".to_string();
        DiaryEntry {
            id: 0, // ignored on insert (AUTOINCREMENT)
            date: date.to_string(),
            title: "Test Title".to_string(),
            text: "This is a test entry with some words.".to_string(),
            word_count: 8,
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_insert_and_get_entries_by_date() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = create_test_entry("2024-01-15");
        insert_entry(&db, &entry).unwrap();

        let retrieved = get_entries_by_date(&db, "2024-01-15").unwrap();
        assert_eq!(retrieved.len(), 1);

        let retrieved_entry = &retrieved[0];
        assert!(retrieved_entry.id > 0);
        assert_eq!(retrieved_entry.date, "2024-01-15");
        assert_eq!(retrieved_entry.title, "Test Title");
        assert_eq!(
            retrieved_entry.text,
            "This is a test entry with some words."
        );
        assert_eq!(retrieved_entry.word_count, 8);
    }

    #[test]
    fn test_multiple_entries_same_date() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert two entries on the same date
        let mut entry1 = create_test_entry("2024-01-15");
        entry1.title = "First entry".to_string();
        insert_entry(&db, &entry1).unwrap();

        let mut entry2 = create_test_entry("2024-01-15");
        entry2.title = "Second entry".to_string();
        insert_entry(&db, &entry2).unwrap();

        let entries = get_entries_by_date(&db, "2024-01-15").unwrap();
        assert_eq!(entries.len(), 2);

        // Ordered by id DESC so second entry is first
        assert_eq!(entries[0].title, "Second entry");
        assert_eq!(entries[1].title, "First entry");
        assert!(entries[0].id > entries[1].id);
    }

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
    fn test_update_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert initial entry
        let entry = create_test_entry("2024-02-10");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        // Update the entry
        let mut updated = get_entry_by_id(&db, id).unwrap().unwrap();
        updated.title = "Updated Title".to_string();
        updated.text = "Updated text content.".to_string();
        updated.word_count = 3;
        updated.date_updated = "2024-02-11T15:00:00Z".to_string();
        update_entry(&db, &updated).unwrap();

        // Retrieve and verify
        let retrieved = get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
        assert_eq!(retrieved.text, "Updated text content.");
        assert_eq!(retrieved.word_count, 3);
    }

    #[test]
    fn test_update_nonexistent_entry() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entry = DiaryEntry {
            id: 99999,
            date: "2024-03-20".to_string(),
            title: "Ghost".to_string(),
            text: "Ghost entry".to_string(),
            word_count: 2,
            date_created: "2024-03-20T00:00:00Z".to_string(),
            date_updated: "2024-03-20T00:00:00Z".to_string(),
        };
        let result = update_entry(&db, &entry);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No entry found"));
    }

    #[test]
    fn test_delete_entry_by_id() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert and delete
        let entry = create_test_entry("2024-04-01");
        insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        let deleted = delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        // Verify deletion
        let result = get_entry_by_id(&db, id).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_entry_by_id_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let deleted = delete_entry_by_id(&db, 99999).unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_get_all_entry_dates_distinct() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert multiple entries, two on the same date
        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-05")).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-10")).unwrap(); // duplicate date
        insert_entry(&db, &create_test_entry("2024-01-20")).unwrap();

        let dates = get_all_entry_dates(&db).unwrap();
        // DISTINCT should give 3 unique dates
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-05");
        assert_eq!(dates[1], "2024-01-10");
        assert_eq!(dates[2], "2024-01-20");
    }

    #[test]
    fn test_count_words() {
        assert_eq!(count_words("Hello world"), 2);
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("One"), 1);
        assert_eq!(count_words("  Multiple   spaces   between  "), 3);
        assert_eq!(count_words("Line\nbreaks\tand\ttabs"), 4);
    }

    #[test]
    fn test_count_words_strips_html() {
        assert_eq!(count_words("<p>Hello world</p>"), 2);
        assert_eq!(count_words("<p>One <strong>two</strong> three</p>"), 3);
        assert_eq!(count_words("<p></p>"), 0);
        assert_eq!(count_words("plain text"), 2);
    }

    #[test]
    fn test_count_words_base64_image() {
        let img = "<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\" />";
        assert_eq!(count_words(img), 0);
        let mixed = "<p>before</p><img src=\"data:image/png;base64,abc123==\" /><p>after</p>";
        assert_eq!(count_words(mixed), 2);
    }

    #[test]
    fn test_count_words_unicode() {
        assert_eq!(count_words("café résumé"), 2);
        assert_eq!(count_words("你好 世界"), 2);
        assert_eq!(
            count_words("word\u{00A0}with\u{2003}unicode\u{3000}spaces"),
            4
        );
    }

    #[test]
    fn test_auth_slots_crud() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Initially one password slot from create_database
        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);

        // list_auth_slots returns the password slot
        let slots = list_auth_slots(&db).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].slot_type, "password");
        assert_eq!(slots[0].label, "Password");
        assert!(slots[0].public_key_hex.is_none());

        // Insert a fake keypair slot
        let fake_pub_key = [7u8; 32];
        let fake_wrapped = [9u8; 60]; // arbitrary
        let now = "2024-01-01T00:00:00Z";
        let slot_id = insert_auth_slot(
            &db,
            "keypair",
            "My Key",
            Some(&fake_pub_key),
            &fake_wrapped,
            now,
        )
        .unwrap();
        assert!(slot_id > 0);

        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 2);

        let slots = list_auth_slots(&db).unwrap();
        let keypair_slot = slots.iter().find(|s| s.slot_type == "keypair").unwrap();
        assert_eq!(keypair_slot.label, "My Key");
        assert_eq!(keypair_slot.public_key_hex, Some(hex::encode(fake_pub_key)));

        // Update last_used
        update_slot_last_used(db.conn(), slot_id).unwrap();
        let slots = list_auth_slots(&db).unwrap();
        let updated = slots.iter().find(|s| s.id == slot_id).unwrap();
        assert!(updated.last_used.is_some());

        // Delete the keypair slot
        delete_auth_slot(&db, slot_id).unwrap();
        let count = count_auth_slots(&db).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_password_slot() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = get_password_slot(&db).unwrap();
        assert!(result.is_some());
        let (id, wrapped_key) = result.unwrap();
        assert!(id > 0);
        assert!(!wrapped_key.is_empty());

        // The wrapped key should be unwrappable with the correct password
        let method = crate::auth::password::PasswordMethod::new("test".to_string());
        let master_key = method.unwrap_master_key(&wrapped_key).unwrap();
        assert_eq!(master_key.len(), 32);
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
    fn test_update_auth_slot_wrapped_key() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "old_password".to_string()).unwrap();

        let (slot_id, old_wrapped) = get_password_slot(&db).unwrap().unwrap();

        // Re-wrap with new password
        let old_method = crate::auth::password::PasswordMethod::new("old_password".to_string());
        let master_key = old_method.unwrap_master_key(&old_wrapped).unwrap();

        let new_method = crate::auth::password::PasswordMethod::new("new_password".to_string());
        let new_wrapped = new_method.wrap_master_key(&master_key).unwrap();

        update_auth_slot_wrapped_key(&db, slot_id, &new_wrapped).unwrap();

        // New wrapped key should work with new password
        let (_, stored_wrapped) = get_password_slot(&db).unwrap().unwrap();
        let recovered = new_method.unwrap_master_key(&stored_wrapped).unwrap();
        assert_eq!(master_key, recovered);

        // Old password should no longer work
        let fail = old_method.unwrap_master_key(&stored_wrapped);
        assert!(fail.is_err());
    }

    #[test]
    fn test_entry_encryption() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert entry
        let entry = create_test_entry("2024-06-01");
        insert_entry(&db, &entry).unwrap();

        // Read raw encrypted data from database
        let (title_enc, text_enc): (Vec<u8>, Vec<u8>) = db
            .conn()
            .query_row(
                "SELECT title_encrypted, text_encrypted FROM entries WHERE date = '2024-06-01'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        // Encrypted data should not contain plaintext
        let title_enc_str = String::from_utf8_lossy(&title_enc);
        let text_enc_str = String::from_utf8_lossy(&text_enc);
        assert!(!title_enc_str.contains("Test Title"));
        assert!(!text_enc_str.contains("test entry"));
    }

    #[test]
    fn test_update_slot_last_used_sets_timestamp() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Get the password slot id created by create_database
        let (slot_id, _) = get_password_slot(&db).unwrap().unwrap();

        // Fresh slot: last_used must be NULL
        let last_used_before: Option<String> = db
            .conn()
            .query_row(
                "SELECT last_used FROM auth_slots WHERE id = ?1",
                rusqlite::params![slot_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            last_used_before.is_none(),
            "expected last_used to be NULL on a fresh slot"
        );

        // Update last_used
        update_slot_last_used(db.conn(), slot_id).unwrap();

        // last_used must now be non-null
        let last_used_after: Option<String> = db
            .conn()
            .query_row(
                "SELECT last_used FROM auth_slots WHERE id = ?1",
                rusqlite::params![slot_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            last_used_after.is_some(),
            "expected last_used to be set after update_slot_last_used"
        );
    }

    #[test]
    fn test_get_db_setting_missing_key_returns_none() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let result = get_db_setting(db.conn(), "nonexistent_key");
        assert!(result.is_none());
    }

    #[test]
    fn test_set_and_get_db_setting_roundtrip() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        let value = get_db_setting(db.conn(), "require_all_auth");
        assert_eq!(value, Some("true".to_string()));

        // Update the same key
        set_db_setting(db.conn(), "require_all_auth", "false").unwrap();
        let value2 = get_db_setting(db.conn(), "require_all_auth");
        assert_eq!(value2, Some("false".to_string()));
    }

    #[test]
    fn test_get_db_setting_on_missing_table_returns_none() {
        // Open a raw in-memory connection without db_settings — simulates a v5 DB
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version VALUES (5);",
        )
        .unwrap();

        let result = get_db_setting(&conn, "require_all_auth");
        assert!(
            result.is_none(),
            "must return None when table does not exist"
        );
    }

    #[test]
    fn test_delete_db_setting() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();

        // Insert a row
        set_db_setting(&conn, "test_key", "test_value").unwrap();
        assert_eq!(
            get_db_setting(&conn, "test_key"),
            Some("test_value".to_string())
        );

        // Delete it
        delete_db_setting(&conn, "test_key").unwrap();
        assert_eq!(get_db_setting(&conn, "test_key"), None);

        // Deleting a non-existent key is not an error
        delete_db_setting(&conn, "non_existent_key").unwrap();
    }

    #[test]
    fn test_compute_settings_mac_returns_32_bytes() {
        let key = [0u8; 32];
        let mac = compute_settings_mac(&key);
        assert_eq!(mac.len(), 32);
        // Two different keys should produce different MACs (with very high probability)
        let key2 = [1u8; 32];
        assert_ne!(mac, compute_settings_mac(&key2));
    }

    #[test]
    fn test_verify_require_all_auth_no_flag_returns_false() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_with_valid_mac() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write the MAC first
        write_require_all_auth_mac(&conn, &key).unwrap();
        // Now write the flag "true"
        set_db_setting(&conn, "require_all_auth", "true").unwrap();

        assert!(verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_missing_mac_fail_safe() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write "true" WITHOUT a MAC — fail-safe should enforce guard (return true)
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        assert!(verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_tampered_mac_fail_safe() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write valid MAC
        write_require_all_auth_mac(&conn, &key).unwrap();
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        assert!(verify_require_all_auth(&conn, &key));

        // Tamper with the MAC (overwrite with garbage)
        set_db_setting(
            &conn,
            "require_all_auth_mac",
            "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        )
        .unwrap();
        // Now fail-safe should still enforce guard (return true)
        assert!(verify_require_all_auth(&conn, &key));

        // Now change value to "false" — value takes precedence, guard should be off
        set_db_setting(&conn, "require_all_auth", "false").unwrap();
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_after_delete() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write both rows
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        write_require_all_auth_mac(&conn, &key).unwrap();
        assert!(verify_require_all_auth(&conn, &key));

        // Delete both rows
        delete_db_setting(&conn, "require_all_auth").unwrap();
        delete_db_setting(&conn, "require_all_auth_mac").unwrap();
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_write_require_all_auth_mac() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        write_require_all_auth_mac(&conn, &key).unwrap();

        // Verify the MAC is stored as hex (64 chars)
        let stored_hex = get_db_setting(&conn, "require_all_auth_mac").unwrap();
        assert_eq!(stored_hex.len(), 64);

        // Hex-decode and verify it matches compute_settings_mac
        let decoded = hex::decode(&stored_hex).unwrap();
        let mut mac = [0u8; 32];
        mac.copy_from_slice(&decoded);
        assert_eq!(mac, compute_settings_mac(&key));
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
    fn test_tags_crud() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // No tags initially
        let all = get_all_tags(&db).unwrap();
        assert!(all.is_empty());

        // Create a tag
        let tag = create_tag(&db, "work").unwrap();
        assert!(tag.id > 0);
        assert_eq!(tag.name, "work");

        // Duplicate create returns the same tag
        let tag2 = create_tag(&db, "Work").unwrap(); // different case → same fingerprint
        assert_eq!(tag.id, tag2.id);

        // get_all_tags returns one entry
        let all = get_all_tags(&db).unwrap();
        assert_eq!(all.len(), 1);

        // Rename
        rename_tag(&db, tag.id, "Work2").unwrap();
        let all = get_all_tags(&db).unwrap();
        assert_eq!(all[0].name, "Work2");

        // Delete
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

        // Add tag to entry
        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "personal");

        // Idempotent add
        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert_eq!(tags.len(), 1);

        // get_entry_dates_by_tag
        let dates = get_entry_dates_by_tag(&db, tag.id).unwrap();
        assert_eq!(dates, vec!["2024-06-01"]);

        // Remove tag from entry
        remove_tag_from_entry(&db, entry_id, tag.id).unwrap();
        let tags = get_tags_for_entry(&db, entry_id).unwrap();
        assert!(tags.is_empty());

        // Re-add then delete entry — cascade must clean entry_tags
        add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        delete_entry_by_id(&db, entry_id).unwrap();
        let dates = get_entry_dates_by_tag(&db, tag.id).unwrap();
        assert!(
            dates.is_empty(),
            "entry_tags must be removed via CASCADE when entry is deleted"
        );

        // Delete tag — cascade must clean entry_tags
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
