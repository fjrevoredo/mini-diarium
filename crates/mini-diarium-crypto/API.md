# `mini-diarium-crypto` — Public API

This crate is the **reusable, `rusqlite`-free cryptographic layer** of Mini Diarium: the
AES-256-GCM cipher, Argon2id password hashing, and the X25519/HKDF master-key wrapping used by
the auth methods. It was carved out of `mini-diarium-core` in open-core **M3a (TODO-0082)** so
the universal cryptographic code compiles **without the desktop SQLite binding in its
dependency graph**, keeping the WASM/browser door open for a future tier
([`docs/OPEN_CORE_STRATEGY.md`](../../docs/OPEN_CORE_STRATEGY.md) §8, §10).

`mini-diarium-core` **depends on this crate and re-exports** `crypto` (as
`mini_diarium_core::crypto`) and the pure auth surface (as `mini_diarium_core::auth`), so the
curated core façade (`crates/mini-diarium-core/API.md`), the app crate, and the benches see an
unchanged surface. Direct dependents reach the same names one module deeper, e.g.
`mini_diarium_crypto::crypto::cipher` — the mild nesting matches ecosystem precedent (e.g.
`rustls::crypto`).

---

## Contract & compatibility

### Status: pre-1.0, internal

Version `0.1.0`, consumed **only** as a path dependency by `mini-diarium-core` in this
repository. Until open-core **M4** decides distribution, **any item listed here may change
without notice** — no deprecation window, no semver promise. This is not an external stability
promise. The same [Contract & compatibility](../mini-diarium-core/API.md#contract--compatibility)
rules the core documents apply here; the points below are the ones specific to this crate.

### No `rusqlite`, no storage engine

The acceptance invariant of this crate: `cargo tree -p mini-diarium-crypto` must show **no
`rusqlite`** (and no other SQLite/storage binding). The dependency set is deliberately limited
to `serde`, `argon2`, `aes-gcm`, `zeroize`, `rand`, `rand_core`, `hex`, `x25519-dalek`, `hkdf`,
and `sha2`. Adding a storage or network dependency here is a contract violation.

### MSRV / edition

Rust **1.95**, edition **2021** — inherited from the workspace `rust-toolchain.toml`.

### Error policy

Every fallible function returns either a typed error (`CipherError`, `PasswordError`) or
`Result<_, String>`. As in core, the `String` text is a **display value, not a branch key**.
The one phrase a consumer keys on is `"Incorrect password"`, produced by
`PasswordMethod::unwrap_master_key` and regex-matched by `src/lib/errors.ts` — renaming it is a
contract change (see the core `API.md` error table).

### Secrets

`SecretBytes` zeroizes on drop; `cipher::Key`, `PasswordMethod`, and `PrivateKeyMethod` derive
`ZeroizeOnDrop`. Wrapping keys are zeroized on every path (including error paths). No API logs,
prints, or serializes key material.

### Serde guarantees

Only `KeypairFiles` is serde-visible, and its field names are **frozen** (mirrored by the
frontend TypeScript):

| Type | Serialized fields |
|---|---|
| `KeypairFiles` | `public_key_hex`, `private_key_hex` |

---

## `crypto` — cipher & password hashing

Reached at `crypto::cipher` / `crypto::password` (re-exported by core; also used by benches).

- `cipher::{Key, encrypt, decrypt, CipherError, tag_name_fingerprint, image_fingerprint}`
- `password::{hash_password, verify_password, derive_key_from_phc_hash, generate_salt, PasswordError}`

The cipher is AES-256-GCM (12-byte random nonce prepended to the ciphertext). The fingerprint
helpers are keyed HKDF-SHA256 outputs (hex-encoded), used by core for tag/image dedup without
leaking plaintext to an offline attacker. Password hashing is Argon2id (m=64 MiB, t=3, p=4).

---

## `auth` — master-key wrapping methods & value types

The `auth::{auto_key, keypair, password}` sub-modules stay `pub` so `mini-diarium-core` can
re-export them as `pub(crate)` and keep its `crate::auth::{password, keypair, auto_key}::…`
paths resolving.

### Types
`SecretBytes`, `KeypairFiles`, `PasswordMethod`, `KeypairMethod`, `PrivateKeyMethod`,
`AutoKeyMethod`.

### Functions & methods
- `generate_keypair`, `derive_public_key`
- `PasswordMethod::{new, wrap_master_key, unwrap_master_key}` (Argon2id + AES-256-GCM)
- `KeypairMethod::wrap_master_key`, `PrivateKeyMethod::unwrap_master_key` (X25519 ECIES)
- `AutoKeyMethod::{wrap_master_key, unwrap_master_key}` (device-bound 32-byte key, no KDF)

The `wrapped_key` blob formats are documented in each method's source. **These are pure
functions over byte slices — they never touch a database.** The composed slot operations that
persist a wrapped key (`auth::add_password_slot` / `add_keypair_slot`) and the
`AuthMethodInfo` DTO stay in `mini-diarium-core` because they need the `rusqlite`-backed
`DatabaseConnection`.
