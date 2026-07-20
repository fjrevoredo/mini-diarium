use crate::crypto::cipher;

pub mod auth_slots;
pub mod db_settings;
pub mod entries;
pub mod images;
pub mod tags;

pub use auth_slots::*;
pub use db_settings::*;
pub use entries::*;
pub use images::*;
pub use tags::*;

// Shared crypto helpers used by all query sub-modules.
// Private items in a parent module are visible to all child modules in Rust.
fn encrypt_for_storage(
    key: &cipher::Key,
    plaintext: &[u8],
    label: &str,
) -> Result<Vec<u8>, String> {
    cipher::encrypt(key, plaintext).map_err(|e| format!("Failed to encrypt {}: {}", label, e))
}

fn decrypt_utf8(key: &cipher::Key, ciphertext: &[u8], label: &str) -> Result<String, String> {
    let bytes = cipher::decrypt(key, ciphertext)
        .map_err(|e| format!("Failed to decrypt {}: {}", label, e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in {}: {}", label, e))
}

fn decrypt_bytes(key: &cipher::Key, ciphertext: &[u8], label: &str) -> Result<Vec<u8>, String> {
    cipher::decrypt(key, ciphertext).map_err(|e| format!("Failed to decrypt {}: {}", label, e))
}
