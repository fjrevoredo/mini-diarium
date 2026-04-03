use crate::auth::SecretBytes;
use crate::crypto::cipher;

/// Auth method that wraps/unwraps the master key using a device-generated random key.
///
/// Blob format stored in `auth_slots.wrapped_key`:
///   [nonce: 12 bytes][encrypted_master_key: 32 bytes][tag: 16 bytes]
///   Total: 60 bytes
///
/// No KDF is applied — the auto_key is already 32 bytes of random entropy.
pub struct AutoKeyMethod<'a> {
    pub auto_key_bytes: &'a [u8], // must be exactly 32 bytes
}

impl<'a> AutoKeyMethod<'a> {
    /// Wraps the master key for storage in auth_slots.
    pub fn wrap_master_key(&self, master_key: &[u8]) -> Result<Vec<u8>, String> {
        let wrap_key =
            cipher::Key::from_slice(self.auto_key_bytes).ok_or("Invalid auto key size")?;
        cipher::encrypt(&wrap_key, master_key)
            .map_err(|e| format!("Failed to wrap master key: {}", e))
    }

    /// Unwraps the master key from the stored blob.
    pub fn unwrap_master_key(&self, wrapped: &[u8]) -> Result<SecretBytes, String> {
        let wrap_key =
            cipher::Key::from_slice(self.auto_key_bytes).ok_or("Invalid auto key size")?;
        let master_key = cipher::decrypt(&wrap_key, wrapped)
            .map_err(|_| "Failed to decrypt with local key (key may have changed)".to_string())?;
        Ok(SecretBytes(master_key))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    fn random_key() -> [u8; 32] {
        let mut k = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut k);
        k
    }

    #[test]
    fn test_wrap_unwrap_roundtrip() {
        let auto_key = random_key();
        let master_key: Vec<u8> = random_key().to_vec();
        let method = AutoKeyMethod {
            auto_key_bytes: &auto_key,
        };

        let wrapped = method.wrap_master_key(&master_key).unwrap();
        let recovered = method.unwrap_master_key(&wrapped).unwrap();
        assert_eq!(*recovered, master_key);
    }

    #[test]
    fn test_wrong_key_fails() {
        let auto_key = random_key();
        let wrong_key = random_key();
        let master_key: Vec<u8> = random_key().to_vec();

        let wrapped = AutoKeyMethod {
            auto_key_bytes: &auto_key,
        }
        .wrap_master_key(&master_key)
        .unwrap();
        let result = AutoKeyMethod {
            auto_key_bytes: &wrong_key,
        }
        .unwrap_master_key(&wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_blob_fails() {
        let auto_key = random_key();
        let master_key: Vec<u8> = random_key().to_vec();
        let method = AutoKeyMethod {
            auto_key_bytes: &auto_key,
        };

        let mut wrapped = method.wrap_master_key(&master_key).unwrap();
        *wrapped.last_mut().unwrap() ^= 0xFF;
        assert!(method.unwrap_master_key(&wrapped).is_err());
    }
}
