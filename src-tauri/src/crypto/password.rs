use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use zeroize::Zeroize;

/// Argon2id parameters: m=64MB (65536 KiB), t=3, p=4
const MEMORY_SIZE_KIB: u32 = 65536; // 64 MB
const ITERATIONS: u32 = 3;
const PARALLELISM: u32 = 4;

/// Error type for password operations
#[derive(Debug)]
pub enum PasswordError {
    HashingFailed(String),
    VerificationFailed(String),
    InvalidHash(String),
}

impl std::fmt::Display for PasswordError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PasswordError::HashingFailed(msg) => write!(f, "Password hashing failed: {}", msg),
            PasswordError::VerificationFailed(msg) => {
                write!(f, "Password verification failed: {}", msg)
            }
            PasswordError::InvalidHash(msg) => write!(f, "Invalid password hash: {}", msg),
        }
    }
}

impl std::error::Error for PasswordError {}

/// Generates a cryptographically secure random salt
pub fn generate_salt() -> SaltString {
    SaltString::generate(&mut OsRng)
}

/// Hashes a password using Argon2id with specified parameters
///
/// # Arguments
/// * `password` - The password to hash (will be zeroized after use)
/// * `salt` - The salt to use for hashing
///
/// # Returns
/// The password hash in PHC string format
pub fn hash_password(mut password: String, salt: &SaltString) -> Result<String, PasswordError> {
    // Create Argon2id instance with our parameters
    let params = Params::new(MEMORY_SIZE_KIB, ITERATIONS, PARALLELISM, None)
        .map_err(|e| PasswordError::HashingFailed(format!("Invalid parameters: {}", e)))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // Hash the password
    let password_hash = argon2
        .hash_password(password.as_bytes(), salt)
        .map_err(|e| PasswordError::HashingFailed(e.to_string()))?;

    // Zeroize the password from memory
    password.zeroize();

    Ok(password_hash.to_string())
}

/// Verifies a password against a stored hash
///
/// # Arguments
/// * `password` - The password to verify (will be zeroized after use)
/// * `hash_string` - The stored password hash in PHC string format
///
/// # Returns
/// `Ok(())` if the password matches, `Err` otherwise
pub fn verify_password(mut password: String, hash_string: &str) -> Result<(), PasswordError> {
    // Parse the stored hash
    let parsed_hash = PasswordHash::new(hash_string)
        .map_err(|e| PasswordError::InvalidHash(e.to_string()))?;

    // Create Argon2 instance
    let argon2 = Argon2::default();

    // Verify the password
    let result = argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|e| PasswordError::VerificationFailed(e.to_string()));

    // Zeroize the password from memory
    password.zeroize();

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_salt() {
        let salt1 = generate_salt();
        let salt2 = generate_salt();

        // Salts should be different
        assert_ne!(salt1.as_str(), salt2.as_str());

        // Salts should be the expected length (22 characters in base64)
        assert_eq!(salt1.as_str().len(), 22);
        assert_eq!(salt2.as_str().len(), 22);
    }

    #[test]
    fn test_hash_password_success() {
        let password = "my_secure_password_123".to_string();
        let salt = generate_salt();

        let result = hash_password(password, &salt);
        assert!(result.is_ok());

        let hash = result.unwrap();
        // Hash should start with $argon2id$ prefix
        assert!(hash.starts_with("$argon2id$"));
        // Hash should contain our parameters
        assert!(hash.contains("m=65536"));
        assert!(hash.contains("t=3"));
        assert!(hash.contains("p=4"));
    }

    #[test]
    fn test_hash_password_deterministic() {
        let password1 = "same_password".to_string();
        let password2 = "same_password".to_string();
        let salt = generate_salt();

        let hash1 = hash_password(password1, &salt).unwrap();
        let hash2 = hash_password(password2, &salt).unwrap();

        // Same password and salt should produce the same hash
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_password_different_salts() {
        let password1 = "same_password".to_string();
        let password2 = "same_password".to_string();
        let salt1 = generate_salt();
        let salt2 = generate_salt();

        let hash1 = hash_password(password1, &salt1).unwrap();
        let hash2 = hash_password(password2, &salt2).unwrap();

        // Same password with different salts should produce different hashes
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_verify_password_correct() {
        let password = "correct_password".to_string();
        let salt = generate_salt();
        let hash = hash_password(password.clone(), &salt).unwrap();

        let result = verify_password(password, &hash);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_password_incorrect() {
        let password = "correct_password".to_string();
        let wrong_password = "wrong_password".to_string();
        let salt = generate_salt();
        let hash = hash_password(password, &salt).unwrap();

        let result = verify_password(wrong_password, &hash);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            PasswordError::VerificationFailed(_)
        ));
    }

    #[test]
    fn test_verify_password_invalid_hash() {
        let password = "some_password".to_string();
        let invalid_hash = "not_a_valid_hash";

        let result = verify_password(password, invalid_hash);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PasswordError::InvalidHash(_)));
    }

    #[test]
    fn test_verify_password_empty() {
        let password = "".to_string();
        let salt = generate_salt();
        let hash = hash_password(password.clone(), &salt).unwrap();

        let result = verify_password(password, &hash);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_password_unicode() {
        let password = "пароль🔐密码".to_string();
        let salt = generate_salt();
        let hash = hash_password(password.clone(), &salt).unwrap();

        let result = verify_password(password, &hash);
        assert!(result.is_ok());
    }

    #[test]
    fn test_hash_long_password() {
        let password = "a".repeat(1000);
        let salt = generate_salt();

        let result = hash_password(password, &salt);
        assert!(result.is_ok());
    }
}
