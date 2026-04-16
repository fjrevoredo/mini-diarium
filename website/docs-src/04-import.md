---
title: Importing Data
slug: import
description: How to import entries from Mini Diary, Day One, jrnl, and other formats.
order: 5
updated: 2026-04-16
tags: import, migration, Mini Diary, Day One, jrnl
---

## Opening the Import Dialog

Open the import dialog from **Journal → Import...** in the app menu.

## Built-In Import Formats

Mini Diarium can import entries from several popular journaling apps:

| Format | Source App | How to Export |
|--------|-----------|---------------|
| Mini Diary JSON | Mini Diary | Use the built-in export feature in Mini Diary |
| Day One JSON | Day One | Use "Export → JSON" in Day One |
| Day One TXT | Day One | Use the plain-text export option in Day One |
| jrnl JSON | jrnl | Run `jrnl --export json > export.json` |

## How Imports Work

Imports are **additive**. If an imported entry falls on a date that already has entries in Mini Diarium, the imported content is added as an additional entry for that date rather than merging or replacing existing content.

This means you can safely import without worrying about overwriting your existing writing.

## Migrating from Mini Diary

Mini Diary users can migrate all their entries to Mini Diarium:

1. Open Mini Diary and export your journal as JSON.
2. Open Mini Diarium and go to **Journal → Import...**.
3. Select **Mini Diary JSON** from the format dropdown.
4. Choose the exported file.

All your entries will be imported with their original dates preserved.

## Custom Import Formats via Plugins

If your source application is not in the built-in list, you can write a custom Rhai import plugin. See the [Plugins](../plugins/) section for details.
