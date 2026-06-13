---
title: FAQ
slug: faq
description: Answers to common questions about Mini Diarium: password recovery, encryption model, cross-device sync, Docker runtime, key files, authentication slots, and mobile support.
order: 11
updated: 2026-06-13
tags: FAQ, troubleshooting, encryption, privacy, data
---

## I forgot my password. Can I recover my entries?

No — unless you registered a key file as an authentication method. If you have a key file, you can still unlock your journal using the "Key File" tab on the unlock screen. If you have neither your password nor your key file, your entries cannot be recovered. This is by design: the encryption key is derived from your password, and no backup of it is stored anywhere.

## Where is my data stored?

Locally on your machine in an SQLite database. See the [Backups](../backups/) section for the exact default path on your operating system.

## Does Mini Diarium connect to the internet?

Never. Mini Diarium makes no network requests, collects no analytics, sends no telemetry, and does not check for updates automatically. All data stays on your device. If you choose the Docker runtime, the container accepts a localhost-only GUI connection from your browser, but the Mini Diarium process still makes no outbound network requests.

Release notes for each version are bundled with the app itself and displayed in the **notification center** (bell icon in the header). No network call is made — the notes ship as a local file inside the application bundle.

## Can I sync across devices?

Not directly. Mini Diarium is local-only by design. You could manually copy the `diary.db` file to another device, but simultaneous access from multiple devices is not supported and could corrupt the database. If you want cloud backup, place your journal directory inside a synced folder (Dropbox, OneDrive, iCloud Drive) and only open it from one device at a time.

## Can I run Mini Diarium in Docker?

Yes. The supported Docker runtime runs the native Linux desktop build inside a container and renders it in your browser at `http://127.0.0.1:6080`. It is still the same encrypted local-first app, not a web rewrite.

Use Docker only if you specifically want a containerized runtime. Flatpak remains the simpler Linux desktop install. In Docker mode, enable idle auto-lock and keep the runtime bound to `127.0.0.1` only.

## I used Mini Diary before. Can I migrate?

Yes. Export your journal from Mini Diary as JSON, then import it in Mini Diarium from **Journal → Import...** using the Mini Diary JSON format. All entries are imported with their original dates.

## How does the encryption work?

Mini Diarium encrypts each journal entry using AES-256-GCM with a random master key. The master key is never stored in plaintext — it is wrapped (encrypted) by a key derived from your password using Argon2id, and only the wrapped version is saved to disk. When you unlock, your password re-derives the wrapping key, which decrypts the master key in memory. The master key is held only in RAM and discarded when you lock.

## Can I use multiple passwords or unlock methods?

Yes. Mini Diarium supports multiple authentication slots. You can register a password and one or more key files. Each method independently wraps the same master key. You can add or remove methods in **Preferences → Authentication Methods** without re-encrypting your entries. At least one method must remain active.

For stronger security, you can enable **Require All Authentication Methods** in **Preferences → Security**. When active, every registered method must be provided at unlock — for example, both your password AND your key file. This prevents access even if one credential is compromised.

## What is a key file?

A key file is a private key stored as a file on disk (or a USB drive, or a password manager). It plays the same role as a password but is a file you present instead of something you type. Key files use X25519 ECDH internally. Generate one from **Preferences → Authentication Methods → Add Key File**, then keep the `.key` file somewhere safe.

## What happens if I delete or lose my key file?

If you have another authentication method (a password, or another key file) still registered, you can still unlock your journal. If the key file was your only method, the journal is permanently inaccessible. Always register at least two authentication methods if you rely on key files.

## Is there a mobile app?

Not currently. Mini Diarium is a desktop app for Windows, macOS, and Linux. A mobile version is in our long-term vision if there is enough demand, but it is a significant development and maintenance effort. We are currently focused on keeping the desktop experience at the highest quality standards.

## Where can I report a security issue?

See the [Security Policy](https://github.com/fjrevoredo/mini-diarium/blob/master/SECURITY.md) in the repository. Do not open a public GitHub issue for security vulnerabilities.
