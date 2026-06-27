---
title: What Is an Encrypted Diary? Why Encryption at Rest Matters
slug: what-is-an-encrypted-diary
description: An encrypted diary encrypts entries before they are written to disk. It is not the same as a password-protected app. Here is what the term actually means and why it matters for private journaling.
date: 2026-05-08
updated: 2026-05-08
author: Francisco J. Revoredo
tags: encrypted diary, encrypted journal, private diary app, AES-256-GCM
excerpt: An encrypted diary encrypts entries before they touch disk. It's an architectural guarantee, not a login screen. Here's what that means in practice.
---

If you have searched for "encrypted diary" you are probably trying to answer a practical question: will my writing stay private, not just while I use the app but as long as the files exist on my machine?

The term is used loosely across apps and marketing pages. Some apps call themselves encrypted because they add a password screen. Others encrypt your connection to a server but store plaintext on the server itself. A genuine encrypted diary does something specific: it encrypts the entry before it reaches permanent storage. That distinction is what this article explains.

## What "encrypted diary" actually means

An encrypted diary encrypts journal entries before they are written to disk. The encryption happens at the application layer, using a key that only you control. When you write an entry and save it, the app transforms that text into ciphertext using an encryption algorithm like AES-256-GCM. Only someone with the correct key can decrypt it back into readable text.

The critical detail is *when* encryption happens. If an app encrypts entries before they touch disk, then even someone with direct access to your hard drive or database file cannot read your entries without the key. If an app writes plaintext first and encrypts later, or encrypts only the connection to a cloud server while storing plaintext on that server, the diary is not meaningfully encrypted at rest. The storage layer still holds readable content.

## Not the same as a password-protected app

A password lock screen is not encryption. Apps that ask for a password when you open them but store entries as plaintext inside an unprotected database are not encrypted diaries. The password protects launch access, not the data files themselves. Anyone who can locate the database file on your disk or on a cloud server can read every entry without knowing the password.

This is not a subtle distinction. A password screen can be bypassed by reading the underlying file. Encryption cannot. The file contains ciphertext, and without the key that ciphertext is mathematically meaningless.

## Encryption at rest vs. encryption in transit

Most cloud-connected apps use TLS to encrypt data while it travels between your device and the server. That protects the network connection but does not protect the data once it arrives. On the server, entries typically sit in a database as plaintext. The service operator can read them. Automated systems can process them. If the service changes its privacy policy, the new policy applies to already-stored plaintext.

Encryption at rest means the data is encrypted in storage regardless of how it got there. Even if the server is compromised, the stored data is unreadable without the key. For a local-first app, encryption at rest means the entry is encrypted before it reaches the SQLite database on your own device. No plaintext exists on disk at any point.

## How Mini Diarium implements this

Mini Diarium generates a random 256-bit master key when you create a journal. That key never changes and never leaves your device. Every entry is encrypted with AES-256-GCM using that master key before the bytes are written to the local SQLite database.

The master key itself is not stored in plaintext either. Each authentication method, either a password or key file, holds its own wrapped copy of the master key. Password slots use Argon2id key derivation plus AES-GCM wrapping. Key file slots use X25519 ECIES. Adding or removing an auth method never requires re-encrypting the entries themselves. Only the wrapped key is recreated.

This means that even with unrestricted access to your diary.db file, an attacker faces AES-256-GCM ciphertext with no path to the key without your password or physical key file. There is no cloud backend to subpoena, no server operator to compromise, and no sync service to leak plaintext. The app has no HTTP client, so it literally cannot send entries anywhere.

## Where Mini Diarium fits

Mini Diarium is built for people who want a desktop diary that encrypts entries at rest by default. It supports Windows, macOS, and Linux. You can import existing journals from Mini Diary, Day One, or jrnl, and export to JSON or Markdown at any time.

If you want the shorter product overview, start with the [encrypted journal guide](/encrypted-journal/). If you are comparing Mini Diarium to other journaling tools, the [comparison page](/compare/) covers Day One, Notion, Obsidian, Standard Notes, and Joplin side by side on encryption, cloud dependency, and data ownership.

For a deeper look at how architecture differs from policy when it comes to who can read your journal, read [encrypted journal apps vs cloud notes apps](/blog/encrypted-journal-vs-cloud-notes-app/).
