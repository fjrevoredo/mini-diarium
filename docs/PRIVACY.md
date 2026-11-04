# Privacy

Fenmark is built around a simple principle: your journal is yours alone.

## Data Collection

None. Fenmark collects no data of any kind.

## Network Access

None. The app makes zero network requests. There is no telemetry, no analytics, no crash reporting, and no update checking. The app works fully offline and contains no HTTP client code.

## File Access (Flathub build)

The Flathub build runs in the Flatpak sandbox. It has read and write access to your home folder and to the mount folders `/run/media`, `/media` and `/mnt` (removable and manually mounted drives). The app needs this access to open a journal in place in a folder that you choose, and to make its backups and working files next to the journal.

The app reads and writes only its own data folder, the journals that you add and the backups next to them, and the files that you pick (for example imports, exports, images, attachments, fonts and key files). Import and export plugins (Rhai scripts) cannot read or write files themselves: the app gives them the file contents as text.

The sandbox has no network permission, so the app cannot send any of these files anywhere. The cost of this access: the sandbox does not limit what a compromised app could read or change in these folders. The full reasons are in the decision record `docs/decisions/2026-11-flatpak-static-filesystem-permission.md`.

## Data Storage

All journal entries are encrypted with AES-256-GCM before being written to a local SQLite database on your machine. A random 256-bit master key is generated when the journal is created and never stored in plaintext. Each authentication method stores its own encrypted copy of the master key in the `auth_slots` table: password slots use Argon2id + AES-256-GCM wrapping; key file slots use X25519 ECIES.

Full-text search decrypts entries in memory to run a query and discards them immediately — no plaintext copy of your entries is ever stored outside the encrypted entries table.

User preferences (theme, first day of week, etc.) are stored in the Tauri WebView's localStorage. These contain no sensitive data.

Automatic database backups are stored in a local directory alongside the main database file.

## Password Handling

Your password is never stored in plaintext. The master key is wrapped using a key derived from your password via Argon2id (a memory-hard key derivation function). At unlock time, the wrapping key is derived and used to recover the master key in memory only. There is no password recovery mechanism. This is intentional.

**Key file authentication:** If you register a key file, your private key is stored only in the `.key` file on your machine — Fenmark never stores or transmits it. The public key is registered in the journal and used to wrap the master key via X25519 ECIES. Keep your key file backed up and secure. Losing both your password and your key file means losing access to your journal.

## Third Parties

Fenmark does not integrate with, send data to, or receive data from any external service.

## Open Source

The full source code is publicly available for review and audit.
