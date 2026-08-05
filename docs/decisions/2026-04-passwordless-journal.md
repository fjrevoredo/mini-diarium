# ADR: Passwordless (Local-Only) Journals

**Status:** Accepted (as-shipped)
**Date:** 2026-04-21
**Related:** GitHub discussion #83; `crates/mini-diarium-crypto/src/auth/auto_key.rs`; `src-tauri/src/commands/auth/auth_core.rs:create_diary_auto`; `crates/mini-diarium-core/src/config.rs:JournalConfig`; `src/components/auth/PasswordCreation.tsx` (user warning).

## Context

Several users (issue/discussion #83) asked for a no-password journal mode. The stated motivation was friction — casual users who just want to start writing without being prompted for a password, particularly when the journal is on a device they already treat as single-user and lockable (laptop with OS login, personal phone, etc.).

This request is in direct tension with a core PHILOSOPHY.md principle: *entries on disk must be encrypted.* Removing encryption was never on the table. The question was: **where should the wrapping key live?**

## Options considered

- **Option A — No encryption at all.** Plaintext SQLite. **Rejected.** Violates the PHILOSOPHY.md non-negotiable "no plaintext diary content in any unencrypted form on disk".
- **Option B — Password derived from a stable device identifier (MAC, hostname, machine GUID).** **Rejected.** Device IDs are not secrets — they are readable by any local process, exfiltrable, and remain predictable across backups. This is security theatre, not protection.
- **Option C — OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service / kwallet / gnome-keyring).** **Deferred.** Correct from a security standpoint, but requires platform-specific code on all three OSes, a third-party crate (e.g. `keyring` or `keyring-rs`), handling of keychain-unavailable cases on Linux headless systems, and careful migration testing. Scope too large for the immediate user request.
- **Option B-prime (shipped) — Device-bound random key stored in `config.json`.** Generate a cryptographically-random 32-byte key at journal creation, hex-encode it, and store it in `{app_data_dir}/config.json` under the journal's `JournalConfig.auto_key` field. Wrap the master key with it via a normal `AutoKeyMethod` auth slot (AES-256-GCM, no KDF since the key is already 32 bytes of entropy).

## Decision

Ship **Option B-prime**. `auto_key` is an `Option<String>` on `JournalConfig`; `None` for password journals, `Some(hex)` for local-only journals. `auth_slots` still wraps the master key the normal way — the only difference is that this particular slot's wrapping key lives next to the DB file rather than being derived from a user passphrase.

The UI in `PasswordCreation.tsx` explicitly surfaces the trade-off: a warning checkbox the user must acknowledge, listing that the journal is readable by anyone with access to this OS account.

## Consequences

### What this buys
- Zero platform-specific code. Works identically on Windows, macOS, Linux.
- No keychain prompts, no keychain-unavailable edge cases on headless Linux.
- Migration to Option C later is straightforward: move the `auto_key` hex out of `config.json` and into the OS keychain, keeping `auth_slots` unchanged. Entries never need re-encryption.
- Migration is not blocked by backups: snapshots are ordinary encrypted databases, so an `auto` slot survives a restore unchanged.

> **Correction (2026-08-04, TODO-0098).** This section previously claimed that "backups (copy of the diary directory) remain self-contained — you back up `diary.db` and `config.json` together." **That was wrong.** `config.json` lives in the **app data directory**, not the journal directory, and app-created snapshots go to `{journal dir}/backups/{db_stem}/`. A local-only journal's backups therefore carry no key material and **cannot be restored on another machine** without also copying `config.json` by hand. This is deliberate — no key is ever written into the backups folder, and a test asserts it — but it is a real limitation, closed by disclosure rather than by shipping the key. See the plan's Assumption 2 and `website/docs-src/09-backups.md`.

### What this costs
- **OS-account compromise = journal compromise.** If someone has read access to the user's home directory, they have the key. This is no worse than "a passphrase written on a sticky note on the laptop," but it is measurably weaker than a password-protected journal.
- The cost of backups sitting in cloud sync (Dropbox, OneDrive) is that anyone who compromises the cloud account also gets both the DB and the wrapping key. Users should know this. The in-app warning handles disclosure.

### What this is *not*
- This is **not** a violation of the PHILOSOPHY.md non-negotiable on encryption at rest. Entries are still AES-256-GCM encrypted on disk. The wrapping mechanism is weaker; the encryption is not.
- This is **not** a cryptographic weakness. AES-256-GCM with a 32-byte random key is exactly as strong as it would be otherwise. The threat model shifts from "cryptographic attack" to "access-control attack on the filesystem," which is a different problem class.

## Future reversibility

Migrating from B-prime to Option C (OS keychain) requires:
1. New auth method `KeychainKeyMethod` wrapping the same 32-byte key mechanics.
2. Migration step: for every journal with `auto_key: Some(hex)`, move the hex into the platform keychain under a per-journal key name, then set `auto_key: None` and add a flag marking the auth slot as keychain-backed.
3. UI: no change for end users — the auto-unlock flow is identical.

Cost estimated at 1–2 days of work per platform plus test coverage. Worth doing when a user explicitly asks for it; not worth front-running.

## References

- `crates/mini-diarium-crypto/src/auth/auto_key.rs` — `AutoKeyMethod` implementation (wrap_master_key / unwrap_master_key).
- `crates/mini-diarium-core/src/config.rs` — `JournalConfig.auto_key: Option<String>` field + `save_journal_auto_key()` helper.
- `src-tauri/src/commands/auth/auth_core.rs:create_diary_auto` — journal creation path.
- `src-tauri/src/commands/auth/auth_core.rs:unlock_diary_auto` — silent unlock path.
- `src/components/auth/PasswordCreation.tsx` — user-facing warning + acknowledgement checkbox.
- GitHub discussion #83 — original user request thread.
