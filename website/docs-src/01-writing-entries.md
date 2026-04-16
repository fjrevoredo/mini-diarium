---
title: Writing Entries
slug: writing-entries
description: How to create, edit, format, and delete journal entries using the rich text editor.
order: 2
updated: 2026-04-16
tags: editor, formatting, entries, writing
---

## The Editor

Mini Diarium uses a rich text editor with support for a full set of formatting options:

- Bold and italic text
- Headings (levels 1–3)
- Bullet lists and numbered lists
- Blockquotes
- Inline code and code blocks
- Strikethrough and underline
- Horizontal rules
- Links
- Images (drag-drop, paste, or file picker)

The toolbar above the editor provides buttons for each formatting option. Standard keyboard shortcuts also work — `Ctrl+B` for bold, `Ctrl+I` for italic, and so on. On macOS, use `Cmd` instead of `Ctrl`.

## Titles

Each entry can have an optional title. If you prefer a cleaner look without titles, hide them in **Preferences → General → Hide Titles**.

## Multiple Entries Per Day

Each date can contain multiple separate entries. This is useful for writing at different times of day or keeping different threads of thought separate.

- When a date has more than one entry, an entry navigation bar appears above the editor.
- Use `←` and `→` to move between entries for the selected date.
- Use `+` to create a new blank entry on the same date.
- Use `−` to delete the current entry.
- If a day has only one entry, the navigation bar stays hidden.

## Auto-Save

Entries save automatically as you type with a short debounce delay. You do not need to manually save anything. If you clear out an entry completely — emptying both the title and the body — it is automatically deleted after the debounce completes.

## Word Count

A live word count is displayed below the editor and updates as you write.

## Inserting Images

You can add images to your entries in three ways:

- **Drag and drop** an image file from your file manager into the editor.
- **Paste** an image from the clipboard.
- Use the **Insert Image** button in the advanced toolbar to pick a file.

Images are embedded directly into the entry as base64 data and are stored encrypted alongside your text. Supported formats are JPG, PNG, GIF, WebP, and BMP. Images are automatically resized to a maximum of 1200×1200 pixels before embedding.

## Importing a Markdown File

The advanced toolbar includes an **Import Markdown** button. This lets you import a `.md` file from disk into the active entry. If the entry is empty, the imported content replaces it. If the entry already has content, the Markdown is appended after a horizontal rule separator. File size is capped at 1 MB.
