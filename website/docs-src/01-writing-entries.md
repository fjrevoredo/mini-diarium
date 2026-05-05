---
title: Writing Entries
slug: writing-entries
description: How to create, edit, format, and delete journal entries using the rich text editor.
order: 2
updated: 2026-05-06
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
- Use `←` and `→` to step between entries, or click the **numbered buttons** (`1 2 3`) to jump directly to a specific entry. The active entry is shown in bold.
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

## Right-to-Left and Bidirectional Text

Mini Diarium supports right-to-left (RTL) writing in Arabic, Hebrew, Syriac, and other RTL scripts. Direction is handled per block — each paragraph and heading carries its own `dir` attribute — so you can freely mix RTL and LTR content in the same entry.

**Auto-detection**: as you type, the editor reads the first strongly-directional character in each paragraph or heading and sets the direction automatically. Arabic and Hebrew script trigger `dir="rtl"`; Latin script triggers `dir="ltr"`. Once a block's direction is set it is locked and will not change if you later add neutral characters (numbers, punctuation, emoji) to the same block.

**Manual override**: press `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS) to toggle the current block between RTL and LTR, or use the **¶R / ¶L toggle button** (pilcrow icon with directional arrow) in the advanced formatting toolbar. This is useful for paragraphs that start with neutral characters such as numbers or quotation marks that the auto-detector cannot classify. The button icon shows the current direction and the direction you will switch to when clicked.

**Alignment toolbar**: when the cursor is in an RTL paragraph, the alignment toolbar reflects the browser's actual rendering and shows **Right** as the active alignment (not Left). Clicking an alignment button writes an explicit `text-align` override as normal.

**Persistence**: the `dir` attribute is stored in the encrypted HTML content of each entry, so direction is preserved across save, export, and re-open cycles.

## Inserting the Current Time

The advanced toolbar includes a **clock button** that inserts the current time at the cursor position. Clicking the button opens a popup where you can choose between **12-hour** and **24-hour** format and select hours:minutes or hours:minutes:seconds precision. Both selections are remembered across sessions.

## Editor Font

You can change the font used in the editor body via **Preferences → Writing → Editor font**. Choose from five bundled open-source font families: Noto Sans, Source Sans 3, Noto Serif, JetBrains Mono, and Fira Mono. Fonts are loaded on demand and work fully offline — no network requests, no OS-level font enumeration.

## Importing a Markdown File

The advanced toolbar includes an **Import Markdown** button. This lets you import a `.md` file from disk into the active entry. If the entry is empty, the imported content replaces it. If the entry already has content, the Markdown is appended after a horizontal rule separator. File size is capped at 1 MB.
