//! `format` — the reusable at-rest encrypted-row field codec.
//!
//! These three helpers are the **only** plaintext↔ciphertext transform used by every
//! encrypted row Mini Diarium writes and reads: entry title/text/preview/metadata, tag
//! names, and image bytes/thumbnails. Each is keyed by a bare [`cipher::Key`] and returns
//! a display-only `String` error tagged with a caller-supplied `label`, so the codec is
//! callable **without a live `rusqlite` handle** — the desktop SQLite layer
//! (`mini-diarium-core`) merely passes `db.key()` and binds the resulting bytes as SQL
//! params.
//!
//! This is deliberately a thin wrapper over [`cipher`], not the raw AEAD: it fixes the
//! at-rest field convention (nonce-prepended AES-256-GCM blobs, UTF-8 decode for text
//! fields, labelled errors) that the storage adapter depends on, while keeping that
//! convention in the `rusqlite`-free kernel where a future WASM/browser tier can reuse it
//! against a different SQLite substitute. The on-disk blob format is identical to the raw
//! `cipher::encrypt` output — moving this codec here (open-core M3b / TODO-0083) changes
//! no bytes on disk.

use crate::crypto::cipher;

/// Encrypts `plaintext` for storage in an encrypted row column.
///
/// `label` names the field for error messages only; it is not stored or authenticated.
pub fn encrypt_for_storage(
    key: &cipher::Key,
    plaintext: &[u8],
    label: &str,
) -> Result<Vec<u8>, String> {
    cipher::encrypt(key, plaintext).map_err(|e| format!("Failed to encrypt {}: {}", label, e))
}

/// Decrypts a stored column back to a UTF-8 `String` (title, text, metadata JSON, preview).
pub fn decrypt_utf8(key: &cipher::Key, ciphertext: &[u8], label: &str) -> Result<String, String> {
    let bytes = cipher::decrypt(key, ciphertext)
        .map_err(|e| format!("Failed to decrypt {}: {}", label, e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in {}: {}", label, e))
}

/// Decrypts a stored column back to raw bytes (image data / thumbnails).
pub fn decrypt_bytes(key: &cipher::Key, ciphertext: &[u8], label: &str) -> Result<Vec<u8>, String> {
    cipher::decrypt(key, ciphertext).map_err(|e| format!("Failed to decrypt {}: {}", label, e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::cipher::Key;

    fn test_key() -> Key {
        Key::from_slice(&[42u8; 32]).unwrap()
    }

    fn other_key() -> Key {
        Key::from_slice(&[7u8; 32]).unwrap()
    }

    #[test]
    fn encrypt_for_storage_utf8_round_trip() {
        let key = test_key();
        let plaintext = "Dear diary, today was a good day.";
        let encrypted = encrypt_for_storage(&key, plaintext.as_bytes(), "text").unwrap();
        let decrypted = decrypt_utf8(&key, &encrypted, "text").unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_for_storage_bytes_round_trip() {
        let key = test_key();
        let plaintext = vec![0u8, 1, 2, 3, 255, 128, 64];
        let encrypted = encrypt_for_storage(&key, &plaintext, "image").unwrap();
        let decrypted = decrypt_bytes(&key, &encrypted, "image").unwrap();
        assert_eq!(decrypted, plaintext);
    }

    /// Encrypts and decrypts the full set of fields a single entry row carries,
    /// proving the row-format field codec round-trips **without any `rusqlite` handle**.
    #[test]
    fn entry_row_fields_round_trip() {
        let key = test_key();

        let title = "A title with unicode: café ☕";
        let text = "<p>Body text with <strong>markup</strong> and emoji 🎉</p>";
        let metadata_json = r#"{"fontFamily":"Georgia","fontSize":18}"#;
        let preview = "A title with unicode: café ☕ — Body text…";
        let image_bytes: Vec<u8> = (0u16..512).map(|b| b as u8).collect();

        // UTF-8 fields (mirrors row_to_entry / timeline reads).
        let title_enc = encrypt_for_storage(&key, title.as_bytes(), "title").unwrap();
        let text_enc = encrypt_for_storage(&key, text.as_bytes(), "text").unwrap();
        let meta_enc =
            encrypt_for_storage(&key, metadata_json.as_bytes(), "entry_metadata").unwrap();
        let preview_enc = encrypt_for_storage(&key, preview.as_bytes(), "entry_preview").unwrap();
        // Raw-byte field (image storage).
        let image_enc = encrypt_for_storage(&key, &image_bytes, "image").unwrap();

        assert_eq!(decrypt_utf8(&key, &title_enc, "title").unwrap(), title);
        assert_eq!(decrypt_utf8(&key, &text_enc, "text").unwrap(), text);
        assert_eq!(
            decrypt_utf8(&key, &meta_enc, "entry_metadata").unwrap(),
            metadata_json
        );
        assert_eq!(
            decrypt_utf8(&key, &preview_enc, "entry_preview").unwrap(),
            preview
        );
        assert_eq!(
            decrypt_bytes(&key, &image_enc, "image").unwrap(),
            image_bytes
        );
    }

    #[test]
    fn ciphertext_differs_from_plaintext() {
        let key = test_key();
        let plaintext = b"secret at rest";
        let encrypted = encrypt_for_storage(&key, plaintext, "text").unwrap();
        // The stored blob must not contain the plaintext verbatim.
        assert_ne!(&encrypted[..], &plaintext[..]);
        assert!(encrypted
            .windows(plaintext.len())
            .all(|w| w != &plaintext[..]));
    }

    #[test]
    fn decrypt_with_wrong_key_fails() {
        let key = test_key();
        let wrong = other_key();
        let encrypted = encrypt_for_storage(&key, b"private", "text").unwrap();

        let utf8_err = decrypt_utf8(&wrong, &encrypted, "text").unwrap_err();
        assert!(utf8_err.contains("Failed to decrypt text"));

        let bytes_err = decrypt_bytes(&wrong, &encrypted, "image").unwrap_err();
        assert!(bytes_err.contains("Failed to decrypt image"));
    }

    #[test]
    fn decrypt_utf8_rejects_invalid_utf8() {
        let key = test_key();
        // Encrypt bytes that are valid ciphertext but not valid UTF-8 when decrypted.
        let invalid_utf8 = vec![0xff, 0xfe, 0xfd];
        let encrypted = encrypt_for_storage(&key, &invalid_utf8, "title").unwrap();
        let err = decrypt_utf8(&key, &encrypted, "title").unwrap_err();
        assert!(err.contains("Invalid UTF-8 in title"));
    }

    #[test]
    fn empty_input_round_trips() {
        let key = test_key();
        let empty_enc = encrypt_for_storage(&key, b"", "text").unwrap();
        assert_eq!(decrypt_utf8(&key, &empty_enc, "text").unwrap(), "");
        assert_eq!(
            decrypt_bytes(&key, &empty_enc, "image").unwrap(),
            Vec::<u8>::new()
        );
    }
}
