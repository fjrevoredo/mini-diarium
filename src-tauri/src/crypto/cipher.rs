use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Size of AES-256 key in bytes
const KEY_SIZE: usize = 32;

/// Size of GCM nonce in bytes
const NONCE_SIZE: usize = 12;

/// A cryptographic key that is automatically zeroized when dropped
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct Key([u8; KEY_SIZE]);

impl std::fmt::Debug for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Key").field("data", &"[REDACTED]").finish()
    }
}

impl Key {
    /// Creates a new key from a byte slice
    ///
    /// # Arguments
    /// * `bytes` - Must be exactly 32 bytes
    ///
    /// # Returns
    /// `Some(Key)` if the input is 32 bytes, `None` otherwise
    pub fn from_slice(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != KEY_SIZE {
            return None;
        }
        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(bytes);
        Some(Key(key))
    }

    /// Returns a reference to the key bytes
    pub fn as_bytes(&self) -> &[u8; KEY_SIZE] {
        &self.0
    }
}

/// Error type for cipher operations
#[derive(Debug)]
pub enum CipherError {
    EncryptionFailed(String),
    DecryptionFailed(String),
    InvalidKeySize,
    InvalidNonce,
}

impl std::fmt::Display for CipherError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CipherError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            CipherError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            CipherError::InvalidKeySize => write!(f, "Invalid key size: expected 32 bytes"),
            CipherError::InvalidNonce => write!(f, "Invalid nonce"),
        }
    }
}

impl std::error::Error for CipherError {}

/// Generates a random 12-byte nonce for GCM
fn generate_nonce() -> [u8; NONCE_SIZE] {
    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Encrypts plaintext using AES-256-GCM
///
/// # Arguments
/// * `key` - The 256-bit encryption key
/// * `plaintext` - The data to encrypt
///
/// # Returns
/// A vector containing [nonce (12 bytes) || ciphertext || tag (16 bytes)]
/// The nonce is prepended to allow for decryption
pub fn encrypt(key: &Key, plaintext: &[u8]) -> Result<Vec<u8>, CipherError> {
    // Create cipher instance
    let cipher = Aes256Gcm::new(key.as_bytes().into());

    // Generate random nonce
    let nonce_bytes = generate_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt the plaintext
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CipherError::EncryptionFailed(e.to_string()))?;

    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypts ciphertext using AES-256-GCM
///
/// # Arguments
/// * `key` - The 256-bit decryption key
/// * `ciphertext` - The encrypted data with prepended nonce [nonce || ciphertext || tag]
///
/// # Returns
/// The decrypted plaintext
pub fn decrypt(key: &Key, ciphertext: &[u8]) -> Result<Vec<u8>, CipherError> {
    // Ensure we have at least nonce + tag
    if ciphertext.len() < NONCE_SIZE + 16 {
        return Err(CipherError::DecryptionFailed(
            "Ciphertext too short".to_string(),
        ));
    }

    // Create cipher instance
    let cipher = Aes256Gcm::new(key.as_bytes().into());

    // Extract nonce from the first 12 bytes
    let nonce = Nonce::from_slice(&ciphertext[..NONCE_SIZE]);

    // Extract actual ciphertext (everything after the nonce)
    let encrypted_data = &ciphertext[NONCE_SIZE..];

    // Decrypt the data
    let plaintext = cipher
        .decrypt(nonce, encrypted_data)
        .map_err(|e| CipherError::DecryptionFailed(e.to_string()))?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_key() -> Key {
        let key_bytes = [42u8; KEY_SIZE];
        Key::from_slice(&key_bytes).unwrap()
    }

    #[test]
    fn test_key_from_slice_valid() {
        let bytes = [1u8; KEY_SIZE];
        let key = Key::from_slice(&bytes);
        assert!(key.is_some());
        assert_eq!(key.unwrap().as_bytes(), &bytes);
    }

    #[test]
    fn test_key_from_slice_invalid_size() {
        let bytes_short = [1u8; 16];
        assert!(Key::from_slice(&bytes_short).is_none());

        let bytes_long = [1u8; 64];
        assert!(Key::from_slice(&bytes_long).is_none());
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = create_test_key();
        let plaintext = b"Hello, World! This is a secret message.";

        let ciphertext = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ciphertext).unwrap();

        assert_eq!(plaintext, &decrypted[..]);
    }

    #[test]
    fn test_encrypt_produces_different_outputs() {
        let key = create_test_key();
        let plaintext = b"Same message";

        let ciphertext1 = encrypt(&key, plaintext).unwrap();
        let ciphertext2 = encrypt(&key, plaintext).unwrap();

        // Should produce different ciphertexts due to random nonces
        assert_ne!(ciphertext1, ciphertext2);

        // But both should decrypt to the same plaintext
        let decrypted1 = decrypt(&key, &ciphertext1).unwrap();
        let decrypted2 = decrypt(&key, &ciphertext2).unwrap();
        assert_eq!(decrypted1, decrypted2);
        assert_eq!(plaintext, &decrypted1[..]);
    }

    #[test]
    fn test_decrypt_with_wrong_key() {
        let key1 = create_test_key();
        let key2_bytes = [99u8; KEY_SIZE];
        let key2 = Key::from_slice(&key2_bytes).unwrap();

        let plaintext = b"Secret data";
        let ciphertext = encrypt(&key1, plaintext).unwrap();

        // Decryption with wrong key should fail
        let result = decrypt(&key2, &ciphertext);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CipherError::DecryptionFailed(_)));
    }

    #[test]
    fn test_decrypt_tampered_ciphertext() {
        let key = create_test_key();
        let plaintext = b"Original message";
        let mut ciphertext = encrypt(&key, plaintext).unwrap();

        // Tamper with a byte in the middle (after nonce)
        if ciphertext.len() > NONCE_SIZE + 5 {
            ciphertext[NONCE_SIZE + 5] ^= 0xFF;
        }

        // Decryption should fail due to authentication tag mismatch
        let result = decrypt(&key, &ciphertext);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CipherError::DecryptionFailed(_)));
    }

    #[test]
    fn test_decrypt_tampered_nonce() {
        let key = create_test_key();
        let plaintext = b"Original message";
        let mut ciphertext = encrypt(&key, plaintext).unwrap();

        // Tamper with the nonce
        ciphertext[0] ^= 0xFF;

        // Decryption should fail
        let result = decrypt(&key, &ciphertext);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CipherError::DecryptionFailed(_)));
    }

    #[test]
    fn test_decrypt_too_short() {
        let key = create_test_key();
        let short_data = [0u8; NONCE_SIZE + 10]; // Too short to contain nonce + tag

        let result = decrypt(&key, &short_data);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CipherError::DecryptionFailed(_)));
    }

    #[test]
    fn test_encrypt_empty_data() {
        let key = create_test_key();
        let plaintext = b"";

        let ciphertext = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ciphertext).unwrap();

        assert_eq!(plaintext, &decrypted[..]);
    }

    #[test]
    fn test_encrypt_large_data() {
        let key = create_test_key();
        let plaintext = vec![0xABu8; 10_000];

        let ciphertext = encrypt(&key, &plaintext).unwrap();
        let decrypted = decrypt(&key, &ciphertext).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_ciphertext_format() {
        let key = create_test_key();
        let plaintext = b"Test";

        let ciphertext = encrypt(&key, plaintext).unwrap();

        // Ciphertext should be: nonce (12) + encrypted data + tag (16)
        // So minimum size is 12 + plaintext.len() + 16
        assert!(ciphertext.len() >= NONCE_SIZE + plaintext.len() + 16);
    }
}
