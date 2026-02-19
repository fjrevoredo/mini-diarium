pub mod keypair;
pub mod password;

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
