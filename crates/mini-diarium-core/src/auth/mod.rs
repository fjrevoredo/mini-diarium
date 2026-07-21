pub(crate) mod auto_key;
pub(crate) mod keypair;
pub(crate) mod password;

// Curated public façade (see crates/mini-diarium-core/API.md): the auth-method types and
// keypair helpers are re-exported at the `auth` root; the sub-modules seal to `pub(crate)`.
pub use auto_key::AutoKeyMethod;
pub use keypair::{derive_public_key, generate_keypair, KeypairMethod, PrivateKeyMethod};
pub use password::PasswordMethod;

use zeroize::ZeroizeOnDrop;

/// Wrapper for heap-allocated secret bytes that zeroes memory on drop.
///
/// Use this instead of a bare `Vec<u8>` for sensitive key material so that
/// memory is reliably overwritten even when the caller forgets to call
/// `.zeroize()` explicitly.
#[derive(ZeroizeOnDrop)]
pub struct SecretBytes(pub Vec<u8>);

impl std::ops::Deref for SecretBytes {
    type Target = [u8];
    fn deref(&self) -> &[u8] {
        &self.0
    }
}

impl std::fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SecretBytes([REDACTED; {}])", self.0.len())
    }
}

impl PartialEq<Vec<u8>> for SecretBytes {
    fn eq(&self, other: &Vec<u8>) -> bool {
        self.0 == *other
    }
}

impl PartialEq<SecretBytes> for Vec<u8> {
    fn eq(&self, other: &SecretBytes) -> bool {
        *self == other.0
    }
}

impl PartialEq<SecretBytes> for SecretBytes {
    fn eq(&self, other: &SecretBytes) -> bool {
        self.0 == other.0
    }
}

/// Information about a registered auth method (returned to frontend)
#[derive(Debug, serde::Serialize)]
pub struct AuthMethodInfo {
    pub id: i64,
    pub slot_type: String,
    pub label: String,
    /// X25519 public key fingerprint (hex-encoded), None for password slots
    pub public_key_hex: Option<String>,
    pub created_at: String,
    pub last_used: Option<String>,
}

/// Result of generating a new X25519 keypair
#[derive(Debug, serde::Serialize)]
pub struct KeypairFiles {
    pub public_key_hex: String,
    pub private_key_hex: String,
}

/// Wraps the current session's master key with a new password and stores it as a
/// `password` auth slot, returning the new slot's row id.
///
/// The master key is read from the open connection (`db.key()`), wrapped with a fresh
/// Argon2id-derived key, and inserted — the wrap→insert order mirrors the historical
/// `register_password` path. Callers own the identity gate, empty-password check, and
/// duplicate-slot check; this performs only the master-key wrap and the insert.
pub fn add_password_slot(
    db: &crate::db::DatabaseConnection,
    label: &str,
    password: &str,
) -> Result<i64, String> {
    let method = password::PasswordMethod::new(password.to_string());
    let wrapped_key = method
        .wrap_master_key(db.key().as_bytes())
        .map_err(|e| format!("Failed to wrap master key: {}", e))?;
    let now = chrono::Utc::now().to_rfc3339();
    crate::db::insert_auth_slot(db, "password", label, None, &wrapped_key, &now)
}

/// Wraps the current session's master key for `public_key` (X25519 ECIES) and stores it
/// as a `keypair` auth slot, returning the new slot's row id.
///
/// The master key is read from the open connection (`db.key()`), wrapped for the given
/// public key, and inserted — the wrap→insert order mirrors the historical
/// `register_keypair` path. Callers own the identity gate, hex decode, and duplicate-key
/// check; this performs only the master-key wrap and the insert.
pub fn add_keypair_slot(
    db: &crate::db::DatabaseConnection,
    label: &str,
    public_key: [u8; 32],
) -> Result<i64, String> {
    let method = keypair::KeypairMethod { public_key };
    let wrapped_key = method
        .wrap_master_key(db.key().as_bytes())
        .map_err(|e| format!("Failed to wrap master key for keypair: {}", e))?;
    let now = chrono::Utc::now().to_rfc3339();
    crate::db::insert_auth_slot(db, "keypair", label, Some(&public_key), &wrapped_key, &now)
}

#[cfg(test)]
mod slot_tests {
    use crate::db::schema::create_database;

    #[test]
    fn test_add_password_slot_wraps_and_unlocks() {
        use crate::db::schema::open_database;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups = tempfile::tempdir().unwrap();

        // Create with an initial password, then remove that slot so the only path
        // back in is the newly added one.
        let db = create_database(&db_path, "original".to_string()).unwrap();
        let (orig_id, _) = crate::db::get_password_slot(&db).unwrap().unwrap();
        let new_id = super::add_password_slot(&db, "Password", "second-pass").unwrap();
        assert!(new_id > 0);
        crate::db::delete_auth_slot(&db, orig_id).unwrap();
        drop(db);

        // Unlock with the newly wrapped password.
        let db2 = open_database(&db_path, "second-pass".to_string(), backups.path()).unwrap();
        assert_eq!(crate::db::count_auth_slots(&db2).unwrap(), 1);
    }

    #[test]
    fn test_add_keypair_slot_wraps_and_unlocks() {
        use crate::db::schema::open_database_with_keypair;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db_path = tmp.path().to_str().unwrap().to_string();
        let backups = tempfile::tempdir().unwrap();

        let db = create_database(&db_path, "original".to_string()).unwrap();
        let kp = crate::auth::keypair::generate_keypair().unwrap();
        let mut pub_key = [0u8; 32];
        pub_key.copy_from_slice(&hex::decode(&kp.public_key_hex).unwrap());
        let mut priv_key = [0u8; 32];
        priv_key.copy_from_slice(&hex::decode(&kp.private_key_hex).unwrap());

        let slot_id = super::add_keypair_slot(&db, "My Key", pub_key).unwrap();
        assert!(slot_id > 0);
        drop(db);

        let db2 = open_database_with_keypair(&db_path, priv_key, backups.path()).unwrap();
        assert_eq!(crate::db::count_auth_slots(&db2).unwrap(), 2);
    }
}
