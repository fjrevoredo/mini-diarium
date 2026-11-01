---
title: Mini Diarium Is Now Fenmark
slug: mini-diarium-is-now-fenmark
description: Mini Diarium has a new name: Fenmark. Why the name changed, why your journals and settings stay exactly where they are, and what moves over next.
date: 2026-11-01
updated: 2026-11-01
author: Francisco J. Revoredo
tags: fenmark, mini diarium, announcement, encrypted journal
excerpt: The app has a new name. Your journals, settings, and backups do not move, and you do not need to do anything.
draft: false
---

Mini Diarium has a new name: **Fenmark**. The app, this website, and the documentation now use it, and the site lives at [fenmark.app](https://fenmark.app/). Old links to mini-diarium.com keep working and forward to the new address.

Only the name changes. The app is the same [encrypted, offline journal](/encrypted-journal/) it was last week: every entry is encrypted with AES-256-GCM before it is written to disk, the app has no network access, and the code stays MIT-licensed. The [comparison with other journal apps](/compare/) still applies word for word.

## Why the name changed

In September, the developer of another journaling app contacted me. Both apps ship on Windows and macOS, in the same category, and they felt the names were close enough to confuse people. That concern was fair. Whether two names are confusing depends on how they look to someone choosing an app, not on where a name came from, and "Mini Diarium" came from Mini Diary, the app it replaced.

We agreed on a solution that works for both projects: every name you see changes, and the technical identifiers under the hood stay as they are. I announced the decision with a banner on this site in September and took the time to find a name that would not cause the same problem again. "Fenmark" is an invented word: a fen is a quiet, secluded place, and a mark is what you leave when you write. Both seemed right for a private journal.

## What stays the same

Everything that matters for your journals:

- Your journal files stay where they are. Nothing is moved, copied, or re-encrypted.
- Your settings, preferences, backups, and plugins stay in the same app data folder.
- The encryption, the file format, and the import and export formats do not change. An export from Mini Diarium imports into Fenmark.
- If you already have a `Mini Diarium` folder in your Documents folder, new journals still go there by default.

You do not need to do anything. When you install the next version, it opens your journals the same way the old one did.

## What you will notice

- The app window, the menus, and the welcome screen say Fenmark. For a while, the About screen also says "formerly Mini Diarium".
- On Windows, the new installer removes the old Mini Diarium program entry, so you end up with one app called Fenmark.
- On Linux, the Fenmark `.deb` and `.rpm` packages replace the old `mini-diarium` package in one step. The terminal command stays `mini-diarium` for now.
- On macOS, if you installed from the DMG, the new version installs as `Fenmark.app` next to `Mini Diarium.app`. Delete `Mini Diarium.app` after you install Fenmark. Your journals are not stored inside the app, so this is safe.

## What moves over later

Some names are tied to install commands and store listings, and changing them all at once would break things for people who already use them. They will move over gradually in the next releases:

- the Microsoft Store, WinGet, Homebrew, Flathub, and SourceForge listings,
- the install commands (`winget`, `brew`, `flatpak`) and the program file name,
- the GitHub repository name.

Until then, the current install commands keep working. Each change will be in the release notes.

Thank you to everyone who uses and supports this project. The name is new; the goal is the same: a journal that stays yours. You can [download Fenmark](/#platforms) or read the [documentation](/docs/).
