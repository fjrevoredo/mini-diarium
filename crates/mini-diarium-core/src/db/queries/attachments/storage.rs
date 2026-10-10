//! Attachment validation and row-level CRUD against the `attachments` /
//! `entry_attachments` tables.

use super::{mime_for_extension, AttachmentSummary};
use crate::crypto::cipher;
use crate::db::queries::entries::lock::ensure_entry_unlocked;
use crate::db::queries::{with_write_transaction, MAX_STORED_BLOB_BYTES};
use crate::db::schema::DatabaseConnection;
use rusqlite::{params, OptionalExtension};
use std::collections::HashMap;
use zeroize::Zeroizing;

/// Longest accepted attachment file name, in characters.
const MAX_ATTACHMENT_NAME_CHARS: usize = 255;

fn validate_attachment_bytes(plaintext_bytes: &[u8]) -> Result<(), String> {
    if plaintext_bytes.is_empty() {
        return Err("Attachment file is empty".to_string());
    }
    if plaintext_bytes.len() > MAX_STORED_BLOB_BYTES {
        return Err(format!(
            "Attachment is too large. Maximum supported size is {} MB.",
            MAX_STORED_BLOB_BYTES / 1_048_576
        ));
    }
    Ok(())
}

/// The name must be a bare file name: callers pass only the basename of the source path.
fn validate_attachment_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Attachment name is empty".to_string());
    }
    if name.chars().count() > MAX_ATTACHMENT_NAME_CHARS {
        return Err("Attachment name is too long".to_string());
    }
    if name.contains(['/', '\\']) {
        return Err("Attachment name must be a file name, not a path".to_string());
    }
    // Linux allows newlines etc. in file names; in a name they would break the line-based
    // Markdown export list and forge its structure.
    if name.chars().any(char::is_control) {
        return Err("Attachment name contains control characters".to_string());
    }
    Ok(())
}

/// Stores an attachment blob (or returns the existing one if identical bytes are already
/// stored). Does not open a transaction — callers compose it with [`link_attachment`].
///
/// Returns the id of the existing or newly inserted `attachments` row.
pub(crate) fn upsert_attachment_blob(
    db: &DatabaseConnection,
    plaintext_bytes: &[u8],
    mime_type: &str,
) -> Result<i64, String> {
    validate_attachment_bytes(plaintext_bytes)?;

    // Same keyed fingerprint as images; the separate table keeps the two id spaces apart.
    let fingerprint = cipher::image_fingerprint(db.key(), plaintext_bytes);
    let encrypted = super::super::encrypt_for_storage(db.key(), plaintext_bytes, "attachment")?;
    let now = chrono::Utc::now().to_rfc3339();

    db.conn()
        .execute(
            "INSERT OR IGNORE INTO attachments (fingerprint, mime_type, byte_size, data, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &fingerprint,
                mime_type,
                plaintext_bytes.len() as i64,
                &encrypted,
                &now
            ],
        )
        .map_err(|e| format!("Failed to upsert attachment: {}", e))?;

    db.conn()
        .query_row(
            "SELECT id FROM attachments WHERE fingerprint = ?1",
            params![&fingerprint],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to fetch attachment id: {}", e))
}

/// Links an attachment blob to an entry under `name`. Does not open a transaction.
///
/// Does not check the entry lock: its one caller, per-entry restore, links only to the
/// entry it has just inserted, which is never locked.
///
/// If the entry already links this attachment (same bytes added twice), the existing link
/// is kept unchanged — including its first name — and returned.
pub(crate) fn link_attachment(
    db: &DatabaseConnection,
    entry_id: i64,
    attachment_id: i64,
    name: &str,
) -> Result<AttachmentSummary, String> {
    validate_attachment_name(name)?;

    let name_encrypted =
        super::super::encrypt_for_storage(db.key(), name.as_bytes(), "attachment name")?;
    let now = chrono::Utc::now().to_rfc3339();

    db.conn()
        .execute(
            "INSERT OR IGNORE INTO entry_attachments (entry_id, attachment_id, name_encrypted, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![entry_id, attachment_id, &name_encrypted, &now],
        )
        .map_err(|e| format!("Failed to link attachment: {}", e))?;

    get_entry_attachment(db, entry_id, attachment_id)?
        .ok_or_else(|| "Failed to read linked attachment".to_string())
}

/// Stores `plaintext_bytes` and links them to `entry_id` under `name`, atomically.
///
/// The MIME type is derived from `name`'s extension. See [`link_attachment`] for the
/// same-bytes-twice behavior. A locked entry is read-only, including its attachments:
/// refuses it with `Err(ERR_ENTRY_LOCKED)` and stores nothing.
pub fn add_attachment_to_entry(
    db: &DatabaseConnection,
    entry_id: i64,
    name: &str,
    plaintext_bytes: &[u8],
) -> Result<AttachmentSummary, String> {
    validate_attachment_name(name)?;
    validate_attachment_bytes(plaintext_bytes)?;

    with_write_transaction(db, || {
        ensure_entry_unlocked(db, entry_id)?;
        let attachment_id = upsert_attachment_blob(db, plaintext_bytes, mime_for_extension(name))?;
        link_attachment(db, entry_id, attachment_id, name)
    })
}

type SummaryRow = (i64, Vec<u8>, String, i64, String);

fn read_summary_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SummaryRow> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get(3)?,
        row.get(4)?,
    ))
}

fn decrypt_summary(db: &DatabaseConnection, row: SummaryRow) -> Result<AttachmentSummary, String> {
    let (id, name_encrypted, mime_type, byte_size, created_at) = row;
    Ok(AttachmentSummary {
        id,
        name: super::super::decrypt_utf8(db.key(), &name_encrypted, "attachment name")?,
        mime_type,
        byte_size,
        created_at,
    })
}

const SUMMARY_COLUMNS: &str = "a.id, ea.name_encrypted, a.mime_type, a.byte_size, ea.created_at \
     FROM entry_attachments ea JOIN attachments a ON a.id = ea.attachment_id";

fn get_entry_attachment(
    db: &DatabaseConnection,
    entry_id: i64,
    attachment_id: i64,
) -> Result<Option<AttachmentSummary>, String> {
    let row = db
        .conn()
        .query_row(
            &format!(
                "SELECT {} WHERE ea.entry_id = ?1 AND ea.attachment_id = ?2",
                SUMMARY_COLUMNS
            ),
            params![entry_id, attachment_id],
            read_summary_row,
        )
        .optional()
        .map_err(|e| format!("Failed to read attachment: {}", e))?;
    row.map(|r| decrypt_summary(db, r)).transpose()
}

/// Returns the attachments linked to an entry, oldest link first.
pub fn list_entry_attachments(
    db: &DatabaseConnection,
    entry_id: i64,
) -> Result<Vec<AttachmentSummary>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!(
            "SELECT {} WHERE ea.entry_id = ?1 ORDER BY ea.created_at ASC, ea.rowid ASC",
            SUMMARY_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare list_entry_attachments: {}", e))?;

    let rows = stmt
        .query_map(params![entry_id], read_summary_row)
        .map_err(|e| format!("Failed to query attachments: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read attachment row: {}", e))?;

    rows.into_iter().map(|r| decrypt_summary(db, r)).collect()
}

/// Returns every entry's attachments, keyed by entry id (oldest link first per entry).
/// Used by exporters, same shape as `get_tags_names_map`.
pub fn get_attachments_map(
    db: &DatabaseConnection,
) -> Result<HashMap<i64, Vec<AttachmentSummary>>, String> {
    let mut stmt = db
        .conn()
        .prepare(&format!(
            "SELECT ea.entry_id, {} ORDER BY ea.entry_id, ea.created_at ASC, ea.rowid ASC",
            SUMMARY_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare attachments map query: {}", e))?;

    let rows: Vec<(i64, SummaryRow)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                (
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ),
            ))
        })
        .map_err(|e| format!("Failed to query attachments map: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read attachments map row: {}", e))?;

    let mut map: HashMap<i64, Vec<AttachmentSummary>> = HashMap::new();
    for (entry_id, row) in rows {
        map.entry(entry_id)
            .or_default()
            .push(decrypt_summary(db, row)?);
    }
    Ok(map)
}

/// Unlinks an attachment from an entry and removes the blob if no entry links it any
/// more, atomically. Returns `Ok(false)` when the entry did not link that attachment, and
/// `Err(ERR_ENTRY_LOCKED)` (nothing removed) when the entry is locked.
pub fn remove_attachment_from_entry(
    db: &DatabaseConnection,
    entry_id: i64,
    attachment_id: i64,
) -> Result<bool, String> {
    with_write_transaction(db, || {
        ensure_entry_unlocked(db, entry_id)?;
        let rows = db
            .conn()
            .execute(
                "DELETE FROM entry_attachments WHERE entry_id = ?1 AND attachment_id = ?2",
                params![entry_id, attachment_id],
            )
            .map_err(|e| format!("Failed to unlink attachment: {}", e))?;
        cleanup_orphaned_attachments(db)?;
        Ok(rows > 0)
    })
}

/// Returns the decrypted bytes of an attachment, **only** if `entry_id` links it.
///
/// Scoping the read to the entry's links means a caller that knows an attachment id but
/// not an entry that owns it cannot read it. Returns `Ok(None)` when not linked.
pub fn read_attachment_bytes(
    db: &DatabaseConnection,
    entry_id: i64,
    attachment_id: i64,
) -> Result<Option<Zeroizing<Vec<u8>>>, String> {
    let encrypted: Option<Vec<u8>> = db
        .conn()
        .query_row(
            "SELECT a.data FROM attachments a \
             JOIN entry_attachments ea ON ea.attachment_id = a.id \
             WHERE ea.entry_id = ?1 AND ea.attachment_id = ?2",
            params![entry_id, attachment_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read attachment data: {}", e))?;

    encrypted
        .map(|enc| super::super::decrypt_bytes(db.key(), &enc, "attachment").map(Zeroizing::new))
        .transpose()
}

/// Returns whether the entry has at least one attachment.
pub fn entry_has_attachments(db: &DatabaseConnection, entry_id: i64) -> Result<bool, String> {
    db.conn()
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM entry_attachments WHERE entry_id = ?1)",
            params![entry_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check entry attachments: {}", e))
}

/// Removes attachment blobs that no `entry_attachments` row references.
///
/// Safe to call after deleting entries or unlinking attachments.
/// Journal-wide: never call it between storing a blob and linking it in the same write unit
/// (see `with_write_transaction`).
pub(crate) fn cleanup_orphaned_attachments(db: &DatabaseConnection) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM attachments WHERE id NOT IN \
             (SELECT DISTINCT attachment_id FROM entry_attachments)",
            [],
        )
        .map_err(|e| format!("Failed to cleanup orphaned attachments: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::images::test_support::{insert_blank_entry, make_db};

    fn count(db: &DatabaseConnection, table: &str) -> i64 {
        db.conn()
            .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn test_add_attachment_stores_encrypted_bytes_and_metadata() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        let bytes = b"%PDF-1.4 fake pdf".to_vec();

        let summary = add_attachment_to_entry(&db, entry_id, "Report.pdf", &bytes).unwrap();
        assert_eq!(summary.name, "Report.pdf");
        assert_eq!(summary.mime_type, "application/pdf");
        assert_eq!(summary.byte_size, bytes.len() as i64);

        let stored: Vec<u8> = db
            .conn()
            .query_row("SELECT data FROM attachments", [], |r| r.get(0))
            .unwrap();
        assert!(
            !stored.windows(bytes.len()).any(|w| w == bytes.as_slice()),
            "attachment bytes must not be stored in plaintext"
        );
        let name_enc: Vec<u8> = db
            .conn()
            .query_row("SELECT name_encrypted FROM entry_attachments", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(!name_enc.windows(6).any(|w| w == b"Report"));

        let read = read_attachment_bytes(&db, entry_id, summary.id)
            .unwrap()
            .unwrap();
        assert_eq!(read.as_slice(), bytes.as_slice());
    }

    #[test]
    fn test_same_bytes_on_two_entries_dedup_blob_with_per_entry_names() {
        let (_tmp, db) = make_db();
        let entry_a = insert_blank_entry(&db);
        let entry_b = insert_blank_entry(&db);
        let bytes = b"shared bytes".to_vec();

        let a = add_attachment_to_entry(&db, entry_a, "a.txt", &bytes).unwrap();
        let b = add_attachment_to_entry(&db, entry_b, "b.txt", &bytes).unwrap();

        assert_eq!(a.id, b.id, "identical bytes must share one blob");
        assert_eq!(count(&db, "attachments"), 1);
        assert_eq!(
            list_entry_attachments(&db, entry_a).unwrap()[0].name,
            "a.txt"
        );
        assert_eq!(
            list_entry_attachments(&db, entry_b).unwrap()[0].name,
            "b.txt"
        );
    }

    #[test]
    fn test_same_bytes_twice_on_one_entry_keeps_first_link_and_name() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        let bytes = b"same".to_vec();

        let first = add_attachment_to_entry(&db, entry_id, "first.txt", &bytes).unwrap();
        let second = add_attachment_to_entry(&db, entry_id, "second.txt", &bytes).unwrap();

        assert_eq!(first, second);
        let list = list_entry_attachments(&db, entry_id).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "first.txt");
    }

    #[test]
    fn test_list_entry_attachments_in_link_order() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        add_attachment_to_entry(&db, entry_id, "one.txt", b"1").unwrap();
        add_attachment_to_entry(&db, entry_id, "two.txt", b"2").unwrap();
        add_attachment_to_entry(&db, entry_id, "three.txt", b"3").unwrap();

        let names: Vec<String> = list_entry_attachments(&db, entry_id)
            .unwrap()
            .into_iter()
            .map(|a| a.name)
            .collect();
        assert_eq!(names, vec!["one.txt", "two.txt", "three.txt"]);
    }

    #[test]
    fn test_add_attachment_rejects_empty_and_oversized() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);

        let err = add_attachment_to_entry(&db, entry_id, "empty.txt", b"").unwrap_err();
        assert!(err.contains("empty"), "got: {}", err);

        let big = vec![0u8; MAX_STORED_BLOB_BYTES + 1];
        let err = add_attachment_to_entry(&db, entry_id, "big.bin", &big).unwrap_err();
        assert!(err.contains("too large"), "got: {}", err);

        assert_eq!(count(&db, "attachments"), 0);
    }

    #[test]
    fn test_add_attachment_rejects_path_like_or_blank_names() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);

        for bad in ["", "   ", "dir/file.txt", "dir\\file.txt"] {
            assert!(
                add_attachment_to_entry(&db, entry_id, bad, b"x").is_err(),
                "name {:?} must be rejected",
                bad
            );
        }
        let long = "a".repeat(MAX_ATTACHMENT_NAME_CHARS + 1);
        assert!(add_attachment_to_entry(&db, entry_id, &long, b"x").is_err());
    }

    #[test]
    fn test_add_attachment_to_missing_entry_fails_and_rolls_back_blob() {
        let (_tmp, db) = make_db();
        let err = add_attachment_to_entry(&db, 9999, "x.txt", b"x").unwrap_err();
        assert!(err.contains("Failed to link attachment"), "got: {}", err);
        assert_eq!(
            count(&db, "attachments"),
            0,
            "blob insert must roll back with the failed link"
        );
    }

    #[test]
    fn test_read_attachment_bytes_refuses_cross_entry_read() {
        let (_tmp, db) = make_db();
        let owner = insert_blank_entry(&db);
        let other = insert_blank_entry(&db);
        let a = add_attachment_to_entry(&db, owner, "secret.txt", b"secret").unwrap();

        assert!(read_attachment_bytes(&db, other, a.id).unwrap().is_none());
        assert!(read_attachment_bytes(&db, owner, a.id).unwrap().is_some());
    }

    #[test]
    fn test_remove_attachment_deletes_orphaned_blob_only() {
        let (_tmp, db) = make_db();
        let entry_a = insert_blank_entry(&db);
        let entry_b = insert_blank_entry(&db);
        let shared = add_attachment_to_entry(&db, entry_a, "s.txt", b"shared").unwrap();
        add_attachment_to_entry(&db, entry_b, "s.txt", b"shared").unwrap();

        assert!(remove_attachment_from_entry(&db, entry_a, shared.id).unwrap());
        assert_eq!(count(&db, "attachments"), 1, "blob still linked by entry B");

        assert!(remove_attachment_from_entry(&db, entry_b, shared.id).unwrap());
        assert_eq!(
            count(&db, "attachments"),
            0,
            "orphaned blob must be removed"
        );

        assert!(!remove_attachment_from_entry(&db, entry_b, shared.id).unwrap());
    }

    #[test]
    fn test_entry_delete_removes_links_and_cleans_orphans() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        add_attachment_to_entry(&db, entry_id, "x.txt", b"x").unwrap();
        assert!(entry_has_attachments(&db, entry_id).unwrap());

        crate::db::queries::delete_entry_by_id(&db, entry_id).unwrap();

        assert_eq!(count(&db, "entry_attachments"), 0);
        assert_eq!(count(&db, "attachments"), 0);
        assert!(!entry_has_attachments(&db, entry_id).unwrap());
    }

    #[test]
    fn test_entry_delete_keeps_attachment_shared_with_other_entry() {
        let (_tmp, db) = make_db();
        let entry_a = insert_blank_entry(&db);
        let entry_b = insert_blank_entry(&db);
        let shared = add_attachment_to_entry(&db, entry_a, "a.txt", b"shared").unwrap();
        add_attachment_to_entry(&db, entry_b, "b.txt", b"shared").unwrap();

        assert!(crate::db::queries::delete_entry_by_id(&db, entry_a).unwrap());

        assert_eq!(count(&db, "attachments"), 1, "blob still linked by entry B");
        assert_eq!(count(&db, "entry_attachments"), 1);
        let remaining = list_entry_attachments(&db, entry_b).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, shared.id);
        assert_eq!(remaining[0].name, "b.txt");
    }

    #[test]
    fn test_fresh_schema_entry_attachments_entry_fk_is_restrict() {
        let (_tmp, db) = make_db();
        let on_delete: String = db
            .conn()
            .query_row(
                "SELECT on_delete FROM pragma_foreign_key_list('entry_attachments') \
                 WHERE \"from\" = 'entry_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(on_delete, "RESTRICT");
    }

    #[test]
    fn test_get_attachments_map_groups_by_entry() {
        let (_tmp, db) = make_db();
        let entry_a = insert_blank_entry(&db);
        let entry_b = insert_blank_entry(&db);
        let entry_c = insert_blank_entry(&db);
        add_attachment_to_entry(&db, entry_a, "a1.txt", b"a1").unwrap();
        add_attachment_to_entry(&db, entry_a, "a2.txt", b"a2").unwrap();
        add_attachment_to_entry(&db, entry_b, "b1.pdf", b"b1").unwrap();

        let map = get_attachments_map(&db).unwrap();
        let names = |id: i64| -> Vec<String> {
            map.get(&id)
                .map(|v| v.iter().map(|a| a.name.clone()).collect())
                .unwrap_or_default()
        };
        assert_eq!(names(entry_a), vec!["a1.txt", "a2.txt"]);
        assert_eq!(names(entry_b), vec!["b1.pdf"]);
        assert!(!map.contains_key(&entry_c));
    }
}
