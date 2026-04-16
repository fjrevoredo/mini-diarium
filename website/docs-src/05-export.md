---
title: Exporting Data
slug: export
description: How to export your journal to JSON, Markdown, and other formats for backup or portability.
order: 6
updated: 2026-04-16
tags: export, backup, JSON, Markdown, portability
---

## Opening the Export Dialog

Open the export dialog from **Journal → Export...** in the app menu.

## Built-In Export Formats

### JSON Export

The JSON format is the primary structural export. It outputs an array of entries under the `"entries"` key:

```json
{
  "entries": [
    {
      "id": 1,
      "date": "2024-01-15",
      "title": "My Entry",
      "text": "<p>Entry content as HTML...</p>",
      "word_count": 5,
      "date_created": "2024-01-15T10:00:00Z",
      "date_updated": "2024-01-15T10:05:00Z"
    }
  ]
}
```

This format preserves entry IDs and timestamps and can be re-imported back into Mini Diarium.

### Markdown Export

The Markdown export produces a human-readable text file, grouped by date. If a day has multiple entries, each appears under its own sub-heading.

Markdown is a best-effort conversion of the stored HTML editor content. Complex formatting (tables, images) may not convert perfectly, but the text is always readable.

## Why Export?

- **Backup**: Export a copy of your entries for safekeeping before changing devices or reinstalling.
- **Migration**: Move your writing to another app or format.
- **Archiving**: Create a readable offline archive of your journal.
- **Processing**: Use JSON for programmatic processing of your entries.

Note that exported files are not encrypted. Store them securely if they contain sensitive content.

## Custom Export Formats via Plugins

If you need a specific export format not covered by the built-in options, you can write a custom Rhai export plugin. See the [Plugins](../plugins/) section for details.
