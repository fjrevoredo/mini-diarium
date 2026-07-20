//! `mini-diarium-core` — the Tauri-free business layer of Mini Diarium.
//!
//! This crate holds the framework-independent domain logic: cryptography, auth,
//! the encrypted SQLite database layer, import/export, the plugin runtime, backup
//! rotation, and journal configuration. It has no dependency on Tauri or any OS
//! shell, so it can be consumed by the desktop app (`mini-diarium`), a future
//! separate product, and eventually a WASM browser tier.
//!
//! See `docs/OPEN_CORE_STRATEGY.md` for the open-core roadmap.

pub mod auth;
pub mod backup;
pub mod config;
pub mod crypto;
pub mod db;
pub mod export;
pub mod import;
pub mod plugin;
