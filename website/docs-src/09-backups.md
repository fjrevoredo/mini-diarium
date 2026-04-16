---
title: Backups
slug: backups
description: How Mini Diarium automatically backs up your encrypted journal and how to manage backup files.
order: 10
updated: 2026-04-16
tags: backups, data safety, backup rotation, storage
---

## When Backups Are Created

A backup is created automatically each time you successfully unlock your journal, whether by password or key file. If the unlock fails — wrong password, missing key file — no backup is taken.

## Backup Location

Backups are stored in a `backups/` subfolder inside the same directory as your `diary.db`. Default journal directories by operating system:

- **Windows**: `%APPDATA%\com.minidiarium\backups\`
- **macOS**: `~/Library/Application Support/com.minidiarium/backups/`
- **Linux**: `~/.local/share/com.minidiarium/backups/`

If you have changed your journal location in Preferences, backups are created in `{your chosen directory}/backups/` instead.

## Backup Filenames

Each backup is named `backup-YYYY-MM-DD-HHhMM.db`, for example `backup-2024-01-15-14h30.db`. The timestamp reflects local time at the moment of unlock.

## Rotation

Mini Diarium keeps the **50 most recent backups**. When a new backup would push the count above 50, the oldest backups are deleted automatically. Only files matching the `backup-*.db` naming pattern are counted; any other files you place in the `backups/` folder are left untouched.

## Custom Journal Locations

When you move your journal to a different folder via Preferences, `diary.db` is physically moved to the new location and all future backups will go into `{new location}/backups/`.

**Existing backups in the old folder are not moved automatically.** If you want to keep your backup history, copy the old `backups/` folder to the new journal directory before or after the move.

## Cloud-Synced Locations

If you place your journal directory inside a cloud-synced folder — Dropbox, OneDrive, iCloud Drive, and so on — both `diary.db` and the `backups/` subfolder will be included in the sync, giving you off-site backup on top of local rotation.

Keep in mind that Mini Diarium does not coordinate concurrent access. **Do not open the same journal from two devices at the same time.** The encrypted database file is not designed for simultaneous multi-device write access.

## Backups Are Encrypted

Backup files are exact copies of `diary.db` at the moment of unlock. They are fully encrypted with the same password and key as your live journal. A backup without your password is unreadable.
