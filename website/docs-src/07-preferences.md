---
title: Preferences
slug: preferences
description: How to configure Mini Diarium: themes, auto-lock, editor settings, and more.
order: 8
updated: 2026-04-16
tags: preferences, settings, theme, auto-lock, configuration
---

## Opening Preferences

Press `Ctrl+,` (or `Cmd+,` on macOS) to open the Preferences dialog, or use the gear icon in the header.

## General Settings

| Setting | Description |
|---------|-------------|
| Theme | Light, dark, or follow system (auto) |
| Language | Interface language: English, Spanish, or German |
| First day of week | Sunday, Monday, or auto-detect from locale |
| Allow future entries | Write entries for dates that have not happened yet |
| Hide titles | Remove the title field for a minimal, distraction-free look |
| Spellcheck | Toggle browser spellcheck in the editor |
| Advanced toolbar | Show the full formatting toolbar with alignment and image options |
| Editor font size | Adjust the body text size in the editor |
| Show entry timestamps | Display creation and last-updated timestamps on each entry |

## Security Settings

| Setting | Description |
|---------|-------------|
| Auto-Lock | Lock automatically after a configurable idle timeout |
| Change password | Re-encrypt your journal with a new password |
| Authentication Methods | View registered unlock methods; add a new key file or remove existing ones |

At least one authentication method must remain registered — removing the last one is blocked.

## Storage Settings

You can change your journal's storage location from Preferences. The `diary.db` file will be physically moved to the new location, and future backups will go into `{new location}/backups/`.

## Theme Overrides (Advanced)

Advanced users can customize the app's color palette by overriding individual CSS theme tokens.

Open **Preferences → General**, scroll to the **Theme Overrides** section. Enter a JSON object with `light` and/or `dark` keys, each mapping CSS variable names to color values:

```json
{
  "light": {
    "--bg-primary": "#fffde0",
    "--text-primary": "#1a1a1a"
  },
  "dark": {
    "--bg-primary": "#0d1117",
    "--text-primary": "#c9d1d9"
  }
}
```

Click **Apply Overrides** to apply immediately. Click **Reset to Default** to remove all overrides and restore the built-in theme.

Overrides are saved and re-applied automatically every time you open the app. They layer on top of the selected built-in theme.

### Supported Token Families

| Family | Example tokens |
|--------|---------------|
| Background | `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`, `--bg-active` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--text-inverse` |
| Border | `--border-primary`, `--border-secondary`, `--border-focus` |
| Interactive | `--interactive-primary`, `--interactive-primary-hover`, `--interactive-secondary`, `--interactive-secondary-hover` |
| Buttons | `--btn-primary-bg`, `--btn-primary-text`, `--btn-destructive-bg`, `--btn-destructive-text` |
| Editor | `--editor-body-text`, `--editor-heading-text`, `--editor-placeholder-text`, `--editor-blockquote-border`, `--editor-link-color` |
| Status | `--status-success-bg`, `--status-error-bg`, `--status-warning-bg`, `--status-info-bg` |

Only documented token names are accepted; unrecognized names are silently ignored. Auth and pre-unlock screens are not affected by theme overrides.

## Reset Journal

**Preferences → Reset Journal** deletes all entries and recreates the database. This is irreversible. Use export to make a backup before resetting.
