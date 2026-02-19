use crate::crypto::{cipher, password as pwd};
use zeroize::Zeroize;

/// Auth method that wraps/unwraps the master key using a password (Argon2id + AES-256-GCM).
///
/// The `wrapped_key` blob format stored in `auth_slots.wrapped_key`:
///   [phc_hash_len: u32 LE (4 bytes)][phc_hash: phc_hash_len bytes][nonce: 12 bytes][ciphertext][tag: 16 bytes]
///
/// The PHC hash is embedded so that `unwrap_master_key` only needs the blob and the password.
pub struct PasswordMethod {
    pub password: String,
}

impl PasswordMethod {
    pub fn new(password: String) -> Self {
        Self { password }
    }

    /// Wraps the master key for storage. Returns the `wrapped_key` blob.
    pub fn wrap_master_key(&self, master_key: &[u8]) -> Result<Vec<u8>, String> {
        // Hash the password with a fresh salt
        let salt = pwd::generate_salt();
        let phc_hash =
            pwd::hash_password(self.password.clone(), &salt).map_err(|e| e.to_string())?;

        // Derive a 32-byte wrapping key from the phc hash
        let mut wrapping_key_bytes =
            pwd::derive_key_from_phc_hash(&phc_hash).map_err(|e| e.to_string())?;
        let wrap_key =
            cipher::Key::from_slice(&wrapping_key_bytes).ok_or("Invalid wrapping key size")?;

        // Encrypt master_key with the wrapping key
        let encrypted = cipher::encrypt(&wrap_key, master_key)
            .map_err(|e| format!("Failed to encrypt master key: {}", e))?;

        // Zeroize wrapping key bytes
        wrapping_key_bytes.zeroize();

        // Build blob: [4-byte phc_len][phc_hash_bytes][encrypted_master_key]
        let phc_bytes = phc_hash.as_bytes();
        let phc_len = phc_bytes.len() as u32;
        let mut result = Vec::with_capacity(4 + phc_bytes.len() + encrypted.len());
        result.extend_from_slice(&phc_len.to_le_bytes());
        result.extend_from_slice(phc_bytes);
        result.extend_from_slice(&encrypted);

        Ok(result)
    }

    /// Unwraps the master key from a `wrapped_key` blob using the password.
    ///
    /// Returns `Err("Incorrect password")` if the password is wrong.
    pub fn unwrap_master_key(&self, wrapped: &[u8]) -> Result<Vec<u8>, String> {
        if wrapped.len() < 4 {
            return Err("Invalid wrapped key: too short".to_string());
        }

        // Parse phc_hash length
        let phc_len = u32::from_le_bytes(
            wrapped[..4]
                .try_into()
                .map_err(|_| "Invalid wrapped key header".to_string())?,
        ) as usize;

        if wrapped.len() < 4 + phc_len {
            return Err("Invalid wrapped key: truncated phc hash".to_string());
        }

        let phc_hash = std::str::from_utf8(&wrapped[4..4 + phc_len])
            .map_err(|_| "Invalid wrapped key: non-UTF8 phc hash".to_string())?;

        let encrypted_master = &wrapped[4 + phc_len..];

        // Verify the password against the embedded phc hash
        pwd::verify_password(self.password.clone(), phc_hash)
            .map_err(|_| "Incorrect password".to_string())?;

        // Derive wrapping key from the phc hash
        let mut wrapping_key_bytes =
            pwd::derive_key_from_phc_hash(phc_hash).map_err(|e| e.to_string())?;
        let wrap_key =
            cipher::Key::from_slice(&wrapping_key_bytes).ok_or("Invalid wrapping key size")?;

        // Decrypt master_key
        let master_key = cipher::decrypt(&wrap_key, encrypted_master)
            .map_err(|_| "Incorrect password".to_string())?;

        wrapping_key_bytes.zeroize();

        Ok(master_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn random_master_key() -> Vec<u8> {
        use rand::RngCore;
        let mut key = vec![0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut key);
        key
    }

    #[test]
    fn test_wrap_unwrap_roundtrip() {
        let master_key = random_master_key();
        let method = PasswordMethod::new("my_secure_password".to_string());

        let wrapped = method.wrap_master_key(&master_key).unwrap();
        let recovered = method.unwrap_master_key(&wrapped).unwrap();

        assert_eq!(master_key, recovered);
    }

    #[test]
    fn test_wrong_password_fails() {
        let master_key = random_master_key();
        let method = PasswordMethod::new("correct_password".to_string());
        let wrapped = method.wrap_master_key(&master_key).unwrap();

        let wrong_method = PasswordMethod::new("wrong_password".to_string());
        let result = wrong_method.unwrap_master_key(&wrapped);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Incorrect password");
    }

    #[test]
    fn test_different_wraps_same_password() {
        let master_key = random_master_key();
        let method = PasswordMethod::new("password".to_string());

        let wrapped1 = method.wrap_master_key(&master_key).unwrap();
        let wrapped2 = method.wrap_master_key(&master_key).unwrap();

        // Different salts → different wrapped blobs
        assert_ne!(wrapped1, wrapped2);

        // But both unwrap to the same master_key
        let recovered1 = method.unwrap_master_key(&wrapped1).unwrap();
        let recovered2 = method.unwrap_master_key(&wrapped2).unwrap();
        assert_eq!(recovered1, master_key);
        assert_eq!(recovered2, master_key);
    }

    #[test]
    fn test_tampered_blob_fails() {
        let master_key = random_master_key();
        let method = PasswordMethod::new("password".to_string());

        let mut wrapped = method.wrap_master_key(&master_key).unwrap();
        // Tamper with the last byte (inside the ciphertext)
        *wrapped.last_mut().unwrap() ^= 0xFF;

        let result = method.unwrap_master_key(&wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_short_blob_fails() {
        let method = PasswordMethod::new("password".to_string());
        let result = method.unwrap_master_key(&[0u8; 3]);
        assert!(result.is_err());
    }
}
