# Privacy

Mini Diarium is built around a simple principle: your journal is yours alone.

## Data Collection

None. Mini Diarium collects no data of any kind.

## Network Access

None. The app makes zero network requests. There is no telemetry, no analytics, no crash reporting, and no update checking. The app works fully offline and contains no HTTP client code.

## Data Storage

All diary entries are encrypted with AES-256-GCM before being written to a local SQLite database on your machine. The encryption key is derived from your password using Argon2id, a memory-hard key derivation function designed to resist brute-force attacks.

The full-text search index stores entry content in plaintext within the same local database file to support search functionality.

User preferences (theme, first day of week, etc.) are stored in the Tauri WebView's localStorage. These contain no sensitive data.

Automatic database backups are stored in a local directory alongside the main database file.

## Password Handling

Your password is never stored in plaintext. Only an Argon2id hash is kept for verification. The encryption key is derived at unlock time and held in memory only while the diary is open. There is no password recovery mechanism. This is intentional.

## Third Parties

Mini Diarium does not integrate with, send data to, or receive data from any external service.

## Open Source

The full source code is publicly available for review and audit.
