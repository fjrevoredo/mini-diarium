# Mini Diarium

[![CI Status](https://github.com/fjrevoredo/mini-diarium/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/fjrevoredo/mini-diarium/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/fjrevoredo/mini-diarium/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/fjrevoredo/mini-diarium#installation)

An encrypted, local cross-platform journaling app

Mini Diarium keeps your journal private. Every entry is encrypted with AES-256-GCM before it touches disk, the app never connects to the internet, and your data never leaves your machine. Built with Tauri, SolidJS, and Rust.

<p align="center">
  <img src="public/demo.gif" alt="Demo" width="768" />
</p>

## Background

Mini Diarium is a spiritual successor to [Mini Diary](https://github.com/samuelmeuli/mini-diary) by Samuel Meuli. I loved the original tool. It was simple, private, and did exactly what a journal app should do. Unfortunately, it's been unmaintained for years and its dependencies have aged out. I initially thought about forking it and modernizing the stack, but turned out impractical. So I started over from scratch, keeping the same core philosophy (encrypted, local-only, minimal) while rebuilding completely with Tauri 2, SolidJS, and Rust. The result is a lighter, faster app with stronger encryption and a few personal touches.

## Features

- **Key file authentication**: unlock your diary with an X25519 private key file instead of (or alongside) your password — like SSH keys for your journal. Register multiple key files; manage all auth methods from Preferences. See [Key File Authentication](#key-file-authentication) for details.
- **AES-256-GCM encryption**: all entries are encrypted with a random master key. Each auth method holds its own wrapped copy of that key, so adding or removing a method is O(1) — no re-encryption of your entries ever.
- **Rich text editor**
- **Calendar navigation**
- **Import**: Mini Diary JSON and Day One JSON with merge conflict resolution
- **Export**: JSON and Markdown formats
- **Themes**
- **Automatic backups**: periodic database backups with rotation
- **Statistics**
- **Preferences**: first day of week, future entries toggle, title visibility, spellcheck, password change, authentication method management
- **Cross-platform**: Windows, macOS, and Linux
- **Zero network access**: no telemetry, no analytics, no update checks

# Architecture

# Unlock Model

Mini Diarium uses a wrapped master key design.

- A random master key encrypts all entries using AES-256-GCM
- Authentication methods wrap the master key
- Unlocking unwraps the master key into memory for the session

## Unlock Flow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/unlock-dark.svg">
  <img alt="Unlock Flow Diagram" src="docs/diagrams/unlock-light.svg">
</picture>

### Password Unlock

- Argon2 key derivation
- AES-GCM unwrap of master key

### Key File Unlock

- X25519 key pair
- ECDH followed by HKDF
- AES-GCM unwrap of master key

The master key is never stored in plaintext.

---

## System Context

Everything runs locally on the user's machine.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/context-dark.svg">
  <img alt="System Context Diagram" src="docs/diagrams/context-light.svg">
</picture>

### Properties

- The UI communicates with the Rust backend via Tauri `invoke()`
- The backend reads and writes to local SQLite
- No HTTP clients
- No background sync
- No telemetry

---

# Saving an Entry

When saving an entry:

1. The content is encrypted using the master key.
2. The encrypted content is stored in the `entries` table.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/save-entry-dark.svg">
    <img 
      alt="Save Entry Flow Diagram" 
      src="docs/diagrams/save-entry-light.svg"
      width="600"
    >
  </picture>
</p>


---

# Layered Architecture

Mini Diarium follows a layered structure.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/architecture-dark.svg">
  <img alt="Layered Architecture Diagram" src="docs/diagrams/architecture-light.svg">
</picture>

## Installation

Download the latest release for your platform:

| Platform | Format                                               |
| -------- | ---------------------------------------------------- |
| Windows  | `.msi` or `.exe` (NSIS installer, no admin required) |
| macOS    | `.dmg`                                               |
| Linux    | `.AppImage` or `.deb`                                |

### Installation Notes

**Windows**

On first launch, Windows SmartScreen may show a warning ("Windows protected your PC"). This is expected for unsigned applications. Click "More info" then "Run anyway" to proceed. Mini Diarium is open source and builds are reproducible from source.

**macOS**

macOS Gatekeeper may block the app on first launch. Right-click the app icon and select "Open" to bypass the warning. Once opened, subsequent launches work normally.

**Linux**

No code signing is required. For security, verify the SHA256 checksum against `checksums-linux.txt` from the release before installation:

```bash
sha256sum Mini-Diarium-*.AppImage
# Compare with checksums-linux.txt
```

## Quick Start

1. Launch Mini Diarium
2. Create a password (this encrypts your diary; there is no recovery if forgotten)
3. Write your first entry. It auto-saves as you type
4. Navigate between days with `Ctrl+Left` / `Ctrl+Right` or click dates on the calendar
5. Lock your diary when you're done

## Key File Authentication

Most journal apps only offer a password. Mini Diarium also lets you unlock with an **X25519 private key file** — a small `.key` file that acts like an SSH key for your diary. You can use a key file instead of your password, or register both and use whichever is convenient.

### Why use a key file?

| Scenario | How a key file helps |
|----------|----------------------|
| **Physical second factor** | Keep the `.key` file on a USB drive. The diary can only be unlocked when the drive is plugged in — no app, no phone, no OTP codes. |
| **Password manager integration** | Store the `.key` file as a secure attachment. Unlock without memorizing a passphrase at all. |
| **Multiple machines** | Register one key file per machine. Revoke access to a single machine by removing that slot without touching your password or re-encrypting any entries. |
| **Shared account, separate keys** | Register several key files under different labels. Each is independent — removing one doesn't affect the others. |

### How it works

Each auth method stores its own encrypted copy of a random **master key** that encrypts all diary entries. For key files, this wrapping uses **X25519 ECIES**:

1. A 256-bit master key is generated once when you create the diary and never changes.
2. You generate an X25519 keypair in Preferences. The app saves the **private key** to a `.key` file (64-character hex string) and retains only the **public key**.
3. The public key is used to wrap the master key: an ephemeral DH key exchange produces a one-time secret, HKDF-SHA256 derives a wrapping key from it, and AES-256-GCM encrypts the master key. The resulting blob is stored in the `auth_slots` table alongside your password slot.
4. To unlock, Mini Diarium reads the `.key` file, performs the same ECDH derivation in reverse, and unwraps the master key — your password is never required.

The private key never enters the database. The public key stored in the database cannot unlock the diary. A wrong or tampered key file is rejected by AES-GCM authentication.

### Setting up a key file

1. Open **Preferences → Authentication Methods**
2. Click **Generate Key File**
3. Save the `.key` file somewhere only you control — a USB drive, a password manager's secure notes, or an encrypted folder
4. Enter your current password to authorize the registration
5. Give the slot a label (e.g. "USB drive" or "laptop")

From that point you can unlock via **File → Open Key File** on the login screen, or by passing the key file path. To remove a key file, open Preferences → Authentication Methods and delete its slot (the last remaining method is always protected from deletion).

> **Backup your key file.** Like an SSH private key, it cannot be regenerated. If you lose both your password slot and all key files, there is no recovery path.

---

## Keyboard Shortcuts

| Action         | Shortcut           |
| -------------- | ------------------ |
| Previous Day   | `Ctrl+Left`        |
| Next Day       | `Ctrl+Right`       |
| Go to Today    | `Ctrl+T`           |
| Go to Date     | `Ctrl+G`           |
| Previous Month | `Ctrl+Shift+Left`  |
| Next Month     | `Ctrl+Shift+Right` |
| Preferences    | `Ctrl+,`           |
| Statistics     | `Ctrl+I`           |
| Import         | `Ctrl+Shift+I`     |
| Export         | `Ctrl+Shift+E`     |

On macOS, use `Cmd` instead of `Ctrl`.

## Building from Source

**Prerequisites:** Rust 1.75+, Bun 1.x, and [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/fjrevoredo/mini-diarium.git
cd mini-diarium
bun install
bun run tauri build
```

Artifacts will be in `src-tauri/target/release/bundle/`.

## Tech Stack

- [Tauri 2](https://v2.tauri.app/): desktop app framework (Rust backend, web frontend)
- [SolidJS](https://www.solidjs.com/): reactive UI framework
- [Rust](https://www.rust-lang.org/): backend logic, encryption, database
  - `x25519-dalek`, `hkdf`, `sha2`: X25519 ECIES key wrapping for key file authentication
- [SQLite](https://www.sqlite.org/): local database with FTS5 full-text search
- [TipTap](https://tiptap.dev/): rich text editor
- [UnoCSS](https://unocss.dev/): utility-first CSS
- [Kobalte](https://kobalte.dev/): accessible UI primitives

## Known Issues
- Most keyboard shortcuts are broken

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development workflow, and conventions.

## Releasing

For maintainers: See [RELEASING.md](RELEASING.md) for step-by-step release instructions.

## Security

See [SECURITY.md](SECURITY.md) for the security model and how to report vulnerabilities.

## Credits

Made with love by [Francisco J. Revoredo](https://github.com/fjrevoredo) (with a little help from Claude Code).
