# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting Vulnerabilities

If you discover a security vulnerability, **please do not open a public issue**. Instead, report it privately to the project maintainer via email.

**Expected response timeline:**
- Acknowledgment within 48 hours
- Assessment and fix plan within 7 days for critical issues
- Patch release as soon as a fix is verified

## Security Model

Mini Diarium is designed as a privacy-first, offline-only journaling app.

- **Encryption**: all diary entries are encrypted at rest using AES-256-GCM. The encryption key is derived from your password via Argon2id.
- **Password storage**: only an Argon2id hash of your password is stored, never the plaintext password or raw key material.
- **No network access**: the app makes zero network requests. No telemetry, no analytics, no update checks. No data leaves your machine.
- **Local storage only**: data lives in a local SQLite database and localStorage for preferences. Backups are stored in a local directory.

## Known Limitations

- **FTS index**: The full-text search index (`entries_fts`) stores plaintext entry content inside the SQLite database file to enable search. The database file itself is local-only.
- **Memory during unlock**: While the diary is unlocked, decrypted content exists in process memory. Locking the diary drops the database connection and clears the state.
- **No password recovery**: if you forget your password, there is no way to recover your entries. This is by design.
