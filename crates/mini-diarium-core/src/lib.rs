//! `mini-diarium-core` — the Tauri-free SQLite business layer of Mini Diarium.
//!
//! This crate holds the framework-independent domain logic built on SQLite: the
//! encrypted database layer, import/export, the plugin runtime, backup rotation,
//! and journal configuration. The reusable, `rusqlite`-free cryptographic layer
//! (cipher, password hashing, master-key wrapping) lives in the sibling
//! `mini-diarium-crypto` crate, which this crate depends on and re-exports as
//! `crypto`/`auth` so consumers see one surface. It has no dependency on Tauri or
//! any OS shell, so it can be consumed by the desktop app (`mini-diarium`), a
//! future separate product, and eventually a WASM browser tier.
//!
//! See `docs/OPEN_CORE_STRATEGY.md` for the open-core roadmap.

pub mod auth;
pub mod backup;
pub mod config;
// The cryptographic layer lives in the rusqlite-free `mini-diarium-crypto` crate
// (open-core M3a / TODO-0082). Re-export it so `mini_diarium_core::crypto::…` and every
// in-core `crate::crypto::…` path resolve unchanged.
pub use mini_diarium_crypto::crypto;
// The encrypted-row field codec also lives in the rusqlite-free crypto crate (open-core M3b /
// TODO-0083). Re-export it so `mini_diarium_core::format::…` and every in-core
// `crate::format::…` path resolve unchanged.
pub use mini_diarium_crypto::format;
pub mod db;
pub mod export;
pub mod import;
pub mod plugin;
pub mod search;
