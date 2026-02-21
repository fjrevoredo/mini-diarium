# Security Policy

> **Note**: Mini Diarium is a hobby project maintained in my spare time. While I take security seriously, I can't provide enterprise-level guarantees or rapid response times. Use this software at your own risk.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| 0.2.x   | No        |

## Reporting Vulnerabilities

If you discover a security vulnerability, **please do not open a public issue**. Instead, report it privately via:
- Email (check GitHub profile for contact)
- GitHub Security Advisories (https://github.com/fjrevoredo/mini-diarium/security/advisories/new)

**What to expect:**
This is a hobby project maintained in my spare time. I'll do my best to respond and fix security issues promptly, but I can't guarantee specific timelines. Critical vulnerabilities affecting user data will be prioritized. For non-critical issues, fixes may take longer depending on complexity and my availability.

If you don't hear back within a couple weeks, feel free to send a follow-up reminder.

---

## Threat Model

Mini Diarium is designed to protect diary content against a specific, well-defined threat: **an attacker who obtains a copy of your diary file** (e.g. from a stolen device, a compromised cloud sync folder, or a backup). In that scenario, the attacker sees only ciphertext.

### Protected against

- **Offline file access** — reading `diary.db` directly yields only encrypted bytes. Every entry field (title, body) is encrypted with AES-256-GCM using a fresh random nonce. The encryption key is never stored in plaintext anywhere on disk.
- **Password guessing at rest** — the key derivation uses Argon2id (memory=64 MiB, iterations=3, parallelism=4), which is deliberately expensive to brute-force. This exceeds OWASP 2023 minimums.
- **Weak-credential key-file attacks** — key-file slots use X25519 key exchange (ECDH) + HKDF-SHA256, so the wrapping key strength matches the 256-bit curve security level regardless of what the file is named or where it lives.
- **Multi-credential compromise** — each authentication method (password or key file) stores its own independently wrapped copy of the master key. Revoking one method does not affect others and does not require re-encrypting any diary content.
- **In-memory key leakage after lock** — locking the diary drops the database connection and clears all held key material. Auth structs are zeroized on drop; derived wrapping keys are zeroized on all exit paths, including wrong-credential error paths.

### Not protected against

- **A running session on your device** — while the diary is unlocked, decrypted content and the master key exist in process memory. An attacker with local code execution or physical access to an unlocked, running session can read diary content. Locking the diary mitigates this; full mitigation requires OS-level memory protection outside the app's control.
- **Malicious software on your device** — Mini Diarium does not defend against keyloggers, screen capture malware, or processes that can read another process's memory (e.g. via `ptrace`). Protect your device first.
- **Compromise of your sync provider** — if you store `diary.db` in a cloud-sync folder, the sync provider sees only the encrypted file. However, if the sync provider is also used to sync your key file or is an attack vector for modifying files on your device, that threat is outside the app's scope.
- **Coercion or credential theft** — if an attacker can observe you typing your password or steal your key file from an unlocked device, the encryption offers no protection.

---

## Cryptographic Architecture

Each diary is protected by a **random 256-bit master key** generated at creation time. The master key encrypts all entries and is itself never written to disk in plaintext. Instead, it is wrapped once per registered authentication method and stored in the `auth_slots` table.

### Entry encryption

Every entry title and body is encrypted separately with **AES-256-GCM**. Each encryption call draws a fresh 12-byte nonce from the OS random source (`OsRng`), so nonces are never reused across writes.

### Password authentication

Password slots derive a wrapping key via **Argon2id** (m=65536 KiB, t=3, p=4), then wrap the master key with AES-256-GCM. The password is never stored — only the Argon2id PHC hash (embedded in the slot blob for self-contained verification) and the resulting ciphertext.

Changing your password re-derives and re-wraps the master key only. Entry ciphertext is untouched.

### Key-file authentication

Key-file slots use **X25519 ECDH** with an ephemeral sender key, derive a wrapping key via **HKDF-SHA256**, and wrap the master key with AES-256-GCM. The private key never leaves your device; only the corresponding public key is stored in the database. Each wrap uses a fresh ephemeral keypair, so the stored blob is unlinkable across wrapping operations.

### Memory handling

Derived wrapping keys are stored only in Rust stack or heap memory and are **zeroized on all exit paths** — including wrong-credential error paths — using the `zeroize` crate. Auth structs holding credentials implement `ZeroizeOnDrop`. The master key returned from an unwrap operation is held in a `SecretBytes` wrapper that zeroes the backing memory when dropped.

---

## Operational Security

- **Offline only** — the app makes no network requests. No data is transmitted to any server at any point.
- **Local storage only** — diary content lives in a single SQLite file. Preferences are stored in `localStorage` (non-sensitive display settings only). Automatic backups are written to a local directory alongside the diary.
- **No plaintext search index** — the SQLite FTS5 table that stored entry content in plaintext was removed in v0.2.0 (schema v4). The migration drops the table on first unlock for any database upgraded from an older version.
- **No credential storage** — passwords are never stored. Key files are written to a location you choose and are never copied by the app.
- **Protected file permissions** — key files generated by the app are written with mode `0o600` (owner read/write only) on Unix.

---

## Known Security Limitations

- **Unlocked session exposure** — content in an active, unlocked session is not protected against other processes running under the same user account. Lock the diary when stepping away from your device.
- **No password recovery** — if you lose all registered credentials, there is no recovery path. This is intentional. Registering a key file as a backup credential is strongly recommended.
- **Backup file consistency** — backups are point-in-time SQLite file copies. They are encrypted identically to the live diary and safe from offline access, but a backup taken mid-write could theoretically capture a partially-written transaction. This is mitigated by SQLite's default journal mode; WAL mode is not currently used.
