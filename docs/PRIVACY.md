# Privacy

Mini Diarium is built around a simple principle: your journal is yours alone.

## Data Collection

None. Mini Diarium collects no data of any kind.

## Network Access

None. The app makes zero network requests. There is no telemetry, no analytics, no crash reporting, and no update checking. The app works fully offline and contains no HTTP client code.

## Data Storage

All diary entries are encrypted with AES-256-GCM before being written to a local SQLite database on your machine. A random 256-bit master key is generated when the diary is created and never stored in plaintext. Each authentication method stores its own encrypted copy of the master key in the `auth_slots` table: password slots use Argon2id + AES-256-GCM wrapping; key file slots use X25519 ECIES.

The full-text search index stores entry content in plaintext within the same local database file to support search functionality.

User preferences (theme, first day of week, etc.) are stored in the Tauri WebView's localStorage. These contain no sensitive data.

Automatic database backups are stored in a local directory alongside the main database file.

## Password Handling

Your password is never stored in plaintext. The master key is wrapped using a key derived from your password via Argon2id (a memory-hard key derivation function). At unlock time, the wrapping key is derived and used to recover the master key in memory only. There is no password recovery mechanism. This is intentional.

**Key file authentication:** If you register a key file, your private key is stored only in the `.key` file on your machine — Mini Diarium never stores or transmits it. The public key is registered in the diary and used to wrap the master key via X25519 ECIES. Keep your key file backed up and secure. Losing both your password and your key file means losing access to your diary.

## Third Parties

Mini Diarium does not integrate with, send data to, or receive data from any external service.

## Open Source

The full source code is publicly available for review and audit.
