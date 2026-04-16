---
title: Search
slug: search
description: How to search your journal entries to find past writing quickly.
order: 4
updated: 2026-04-16
tags: search, find, full-text
---

## Current Status

Full-text search is not available in the current version of Mini Diarium. It will be added in a future release.

## Why Search Is Not Yet Available

Mini Diarium stores all entries encrypted at rest using AES-256-GCM. Building a search index that works without decrypting entries on disk requires a different architectural approach — one that is being designed carefully to avoid storing any searchable plaintext that could be read without your password.

The search interface (including the search bar and result display components) is already present in the UI and will be populated when the feature is complete.

## Finding Entries in the Meantime

Until full-text search is available, you can navigate to a specific date using the calendar or the **Go to Date** dialog (`Ctrl+G`). If you remember roughly when you wrote something, browsing the calendar is often sufficient.

You can also export your journal to Markdown or JSON and use your operating system's file search tools on the exported files. Exported files are not encrypted.
