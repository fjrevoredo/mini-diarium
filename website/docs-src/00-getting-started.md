---
title: Getting Started
slug: getting-started
description: How to create your first journal, set a password, and start writing in Mini Diarium.
order: 1
updated: 2026-04-16
tags: setup, password, first launch
---

## First Launch

When you open Mini Diarium, the app starts at the **Journal Picker**. From there you can create a new journal or open an existing `diary.db` file.

If you create a new journal, you will be asked to create a password. This password encrypts your entire journal using AES-256-GCM encryption.

**There is no password recovery.** If you forget your password, your entries cannot be recovered. Choose something memorable and keep it safe.

## Locking and Unlocking

Your journal is encrypted whenever it is locked. After selecting a journal, enter your password to unlock it. The journal locks automatically when you close the app, and you can also lock it manually from the header at any time.

As an alternative to your password, you can register a key file in **Preferences → Authentication Methods**. Once registered, use the "Key File" tab on the unlock screen and select your `.key` file to unlock without typing your password.

You can also enable **idle auto-lock** in **Preferences → Security → Auto-Lock**. When enabled, Mini Diarium locks automatically after the configured period of inactivity.

## Multiple Journals

You can maintain separate journals for different purposes — personal, work, travel, and so on. Each journal is an independent encrypted file in its own folder.

**Adding a journal:** Use the Journal Picker's add actions. You can create a new journal in a chosen folder or add an existing `diary.db`.

**Switching journals:** Open the Journal Picker, choose the journal you want, and then unlock it. On a shared device, this lets each person select their own journal before any authentication prompt appears.

**Removing a journal:** Remove a journal entry from the Journal Picker. This only removes it from the configured list; the journal files on disk are not deleted. Removing the last configured journal is allowed and leaves the picker in an empty state.

If you only have one journal, the Journal Picker simply shows that single journal as the only choice.

## Local-Only Journals (No Password)

When creating a new journal, you can choose the **Local-only** mode. Instead of a user-chosen password, the app generates a random key at creation time and stores it in the OS-managed app data directory. The journal auto-unlocks on each open without a password prompt.

This mode still encrypts your entries with AES-256-GCM. The protection trade-off is important to understand: copying only the `diary.db` file to another machine will not be readable there, but anyone with access to your OS account can open the journal without any additional authentication. A risk acknowledgment checkbox is shown before creation to confirm you understand this.

You can upgrade a local-only journal to password protection at any time using **Preferences → Authentication Methods**.
