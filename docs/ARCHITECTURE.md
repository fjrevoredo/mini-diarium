# Architecture

This document describes Mini Diarium's high-level architecture and data flow.

- For principles and design philosophy, see [PHILOSOPHY.md](../PHILOSOPHY.md).
- For the full threat model and cryptographic details, see [SECURITY.md](../SECURITY.md).
- For a privacy overview, see [docs/PRIVACY.md](PRIVACY.md).

## Unlock Model

Mini Diarium uses a wrapped master key design.

- A random master key encrypts all entries using AES-256-GCM
- Authentication methods wrap the master key
- Unlocking unwraps the master key into memory for the session

## Unlock Flow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/unlock-dark.svg">
  <img alt="Unlock Flow Diagram" src="./diagrams/unlock.svg">
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
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/context-dark.svg">
  <img alt="System Context Diagram" src="./diagrams/context.svg">
</picture>

### Properties

- The UI communicates with the Rust backend via Tauri `invoke()`
- The backend reads and writes to local SQLite
- No HTTP clients
- No background sync
- No telemetry

---

## Saving an Entry

When saving an entry:

1. The content is encrypted using the master key.
2. The encrypted content is stored in the `entries` table.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./diagrams/save-entry-dark.svg">
    <img 
      alt="Save Entry Flow Diagram" 
      src="./diagrams/save-entry.svg"
      width="600"
    >
  </picture>
</p>

---

## Layered Architecture

Mini Diarium follows a layered structure.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/architecture-dark.svg">
  <img alt="Layered Architecture Diagram" src="./diagrams/architecture.svg">
</picture>

