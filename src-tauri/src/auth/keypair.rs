use crate::crypto::cipher;
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};
use zeroize::Zeroize;

const HKDF_INFO: &[u8] = b"mini-diarium-v1";

/// Wraps the master key for a given X25519 public key using ECIES.
///
/// `wrapped_key` blob format stored in `auth_slots.wrapped_key`:
///   [eph_pub: 32 bytes][nonce: 12 bytes][ciphertext: 32 bytes][tag: 16 bytes]
///   = 92 bytes total for a 32-byte master key
pub struct KeypairMethod {
    pub public_key: [u8; 32],
}

/// Unwraps the master key using an X25519 private key.
pub struct PrivateKeyMethod {
    pub private_key: [u8; 32],
}

impl KeypairMethod {
    /// Wraps `master_key` for this public key. Returns the `wrapped_key` blob.
    pub fn wrap_master_key(&self, master_key: &[u8]) -> Result<Vec<u8>, String> {
        use rand::rngs::OsRng;

        // Generate ephemeral keypair
        let eph_secret = EphemeralSecret::random_from_rng(OsRng);
        let eph_public = PublicKey::from(&eph_secret);

        // Compute ECDH shared secret
        let recipient_pub = PublicKey::from(self.public_key);
        let shared_secret = eph_secret.diffie_hellman(&recipient_pub);

        // Derive 32-byte wrapping key via HKDF-SHA256
        // salt = eph_pub bytes, IKM = shared_secret bytes
        let hk = Hkdf::<Sha256>::new(Some(eph_public.as_bytes()), shared_secret.as_bytes());
        let mut wrapping_key = [0u8; 32];
        hk.expand(HKDF_INFO, &mut wrapping_key)
            .map_err(|e| format!("HKDF expand failed: {}", e))?;

        // Encrypt master_key with wrapping key
        let wrap_key =
            cipher::Key::from_slice(&wrapping_key).ok_or("Invalid wrapping key size")?;
        let encrypted = cipher::encrypt(&wrap_key, master_key)
            .map_err(|e| format!("Failed to encrypt master key: {}", e))?;

        wrapping_key.zeroize();

        // Build blob: [eph_pub(32)][encrypted_master_key]
        // encrypted already contains [nonce(12)][ciphertext][tag(16)]
        let mut result = Vec::with_capacity(32 + encrypted.len());
        result.extend_from_slice(eph_public.as_bytes());
        result.extend_from_slice(&encrypted);

        Ok(result)
    }
}

impl PrivateKeyMethod {
    /// Unwraps the master key from a `wrapped_key` blob using this private key.
    pub fn unwrap_master_key(&self, wrapped: &[u8]) -> Result<Vec<u8>, String> {
        // Minimum size: eph_pub(32) + nonce(12) + tag(16) = 60 bytes
        if wrapped.len() < 60 {
            return Err("Invalid wrapped key: too short".to_string());
        }

        // Extract ephemeral public key
        let mut eph_pub_bytes = [0u8; 32];
        eph_pub_bytes.copy_from_slice(&wrapped[..32]);
        let eph_pub = PublicKey::from(eph_pub_bytes);

        // Compute ECDH shared secret with recipient's private key
        let private = StaticSecret::from(self.private_key);
        let shared_secret = private.diffie_hellman(&eph_pub);

        // Derive wrapping key
        let hk = Hkdf::<Sha256>::new(Some(eph_pub.as_bytes()), shared_secret.as_bytes());
        let mut wrapping_key = [0u8; 32];
        hk.expand(HKDF_INFO, &mut wrapping_key)
            .map_err(|e| format!("HKDF expand failed: {}", e))?;

        // Decrypt master_key
        let wrap_key =
            cipher::Key::from_slice(&wrapping_key).ok_or("Invalid wrapping key size")?;
        let encrypted_part = &wrapped[32..];
        let master_key = cipher::decrypt(&wrap_key, encrypted_part)
            .map_err(|_| "Failed to decrypt master key: wrong private key or corrupted data")?;

        wrapping_key.zeroize();

        Ok(master_key)
    }
}

/// Generates a new X25519 keypair for diary authentication.
///
/// The private key should be saved to a file by the user; the public key
/// is registered with the diary via `register_keypair`.
pub fn generate_keypair() -> Result<crate::auth::KeypairFiles, String> {
    use rand::rngs::OsRng;

    let private = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&private);

    Ok(crate::auth::KeypairFiles {
        public_key_hex: hex::encode(public.as_bytes()),
        private_key_hex: hex::encode(private.to_bytes()),
    })
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

    fn random_keypair() -> ([u8; 32], [u8; 32]) {
        use rand::rngs::OsRng;
        let private = StaticSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&private);
        (private.to_bytes(), *public.as_bytes())
    }

    #[test]
    fn test_wrap_unwrap_roundtrip() {
        let (priv_bytes, pub_bytes) = random_keypair();
        let master_key = random_master_key();

        let method = KeypairMethod { public_key: pub_bytes };
        let wrapped = method.wrap_master_key(&master_key).unwrap();

        let unwrap_method = PrivateKeyMethod { private_key: priv_bytes };
        let recovered = unwrap_method.unwrap_master_key(&wrapped).unwrap();

        assert_eq!(master_key, recovered);
    }

    #[test]
    fn test_wrong_private_key_fails() {
        let (_priv_bytes, pub_bytes) = random_keypair();
        let (wrong_priv, _wrong_pub) = random_keypair();
        let master_key = random_master_key();

        let method = KeypairMethod { public_key: pub_bytes };
        let wrapped = method.wrap_master_key(&master_key).unwrap();

        let wrong_method = PrivateKeyMethod { private_key: wrong_priv };
        let result = wrong_method.unwrap_master_key(&wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_wrapped_key_fails() {
        let (priv_bytes, pub_bytes) = random_keypair();
        let master_key = random_master_key();

        let method = KeypairMethod { public_key: pub_bytes };
        let mut wrapped = method.wrap_master_key(&master_key).unwrap();
        *wrapped.last_mut().unwrap() ^= 0xFF;

        let unwrap_method = PrivateKeyMethod { private_key: priv_bytes };
        let result = unwrap_method.unwrap_master_key(&wrapped);
        assert!(result.is_err());
    }

    #[test]
    fn test_different_ephemeral_keys_each_wrap() {
        let (_priv_bytes, pub_bytes) = random_keypair();
        let master_key = random_master_key();
        let method = KeypairMethod { public_key: pub_bytes };

        let wrapped1 = method.wrap_master_key(&master_key).unwrap();
        let wrapped2 = method.wrap_master_key(&master_key).unwrap();

        // Different ephemeral keys → different blobs
        assert_ne!(wrapped1, wrapped2);
    }

    #[test]
    fn test_too_short_blob_fails() {
        let (priv_bytes, _pub) = random_keypair();
        let method = PrivateKeyMethod { private_key: priv_bytes };
        let result = method.unwrap_master_key(&[0u8; 40]);
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_keypair() {
        let kp1 = generate_keypair().unwrap();
        let kp2 = generate_keypair().unwrap();

        // Each call generates a different keypair
        assert_ne!(kp1.private_key_hex, kp2.private_key_hex);
        assert_ne!(kp1.public_key_hex, kp2.public_key_hex);

        // Keys are hex-encoded 32 bytes = 64 hex chars
        assert_eq!(kp1.private_key_hex.len(), 64);
        assert_eq!(kp1.public_key_hex.len(), 64);
    }
}
