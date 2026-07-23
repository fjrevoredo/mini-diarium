//! `mini-diarium-crypto` — the reusable cryptographic layer of Mini Diarium.
//!
//! This crate holds the truly universal, WASM-targetable primitives: the
//! AES-256-GCM cipher, Argon2id password hashing, and the X25519/HKDF
//! master-key wrapping used by the auth methods. It has **no** dependency on
//! `rusqlite` (or any storage engine), Tauri, or an OS shell, so it can be
//! consumed by the desktop business layer (`mini-diarium-core`), a future
//! separate product, and eventually a WASM browser tier.
//!
//! `mini-diarium-core` re-exports `crypto` and `auth` from this crate, so the
//! curated core façade (`crates/mini-diarium-core/API.md`), the app crate, and
//! the benches see an unchanged surface.
//!
//! The internal modules keep the names `crypto`/`auth` so the parent crate's
//! existing `crate::crypto::…` / `crate::auth::…` paths resolve with zero churn;
//! the mild `mini_diarium_crypto::crypto::cipher` nesting is only visible to
//! future direct dependents and matches ecosystem precedent (e.g. `rustls::crypto`).
//!
//! See `docs/OPEN_CORE_STRATEGY.md` for the open-core roadmap.

pub mod auth;
pub mod crypto;
