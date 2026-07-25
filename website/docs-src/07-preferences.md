---
title: Preferences
slug: preferences
description: Configure Mini Diarium from the Preferences panel: choose a theme, set auto-lock timeout, adjust editor font and size, manage authentication methods, and more.
order: 8
updated: 2026-07-25
tags: preferences, settings, theme, auto-lock, configuration
---

## Opening Preferences

Press `Ctrl+,` (or `Cmd+,` on macOS) to open the Preferences dialog, or click the **⋮** menu in the header and select Preferences.

Preferences are now **close-only**: there is no Save/Cancel footer. Reversible settings apply immediately as you change them.

## General Settings

| Setting | Description |
|---------|-------------|
| Theme | Light, dark, or follow system (auto) |
| Language | Interface language: English, French, German, Hindi, Italian, Portuguese (Brazil), or Spanish |
| ESC key action | Do nothing or quit the app when pressing Escape |

## Writing Settings

| Setting | Description |
|---------|-------------|
| First day of week | Sunday, Monday, another weekday, or auto-detect from locale |
| Allow future entries | Write entries for dates that have not happened yet |
| Hide titles | Remove the title field for a minimal, distraction-free look |
| Show entry timestamps | Display creation and last-updated timestamps on each entry |
| Spellcheck | Toggle spellcheck in the editor. The dictionary follows your interface language. See "Spell check on Linux" below if you are on Linux |
| Toolbar items | Configure which formatting controls appear in the editor toolbar and their order. Each of the 17 controls (Headings, Underline, Strikethrough, Text color, Highlight color, Blockquote, Inline code, Bullet list, Numbered list, Horizontal rule, Insert image, Import Markdown, Insert timestamp, Text direction, Alignment, Font family, Font size) can be enabled/disabled individually and reordered with ↑/↓ buttons. "Select all" and "Select none" toggle all controls at once. Bold and Italic are always present at the start of the toolbar and cannot be removed. Font family and Font size are disabled by default; enable them to get compact dropdown pickers directly in the toolbar. Note: when enabled, these dropdowns apply inline formatting to selected text (not changing this preference). To change the app-wide font default, use the "Editor font" setting below. |
| Editor font size | Adjust the app-wide default body text size in the editor (12–24 px). When an entry has an entry-specific font default or inline font formatting applied to the selection, those take precedence over this app default. |
| Editor font | Choose an app-wide default font family for the editor body from bundled options or uploaded custom fonts. When an entry has an entry-specific font default or inline font formatting applied to the selection, those take precedence over this app default. See Writing Entries for the full three-level font system. |

Timestamp format and precision are configured from the editor timestamp popup (clock button), not from Preferences.

### Spell check on Linux

Windows and macOS hand spell checking to the operating system, so the toggle is all you need. Linux checks against hunspell dictionary files instead, and which ones are available depends on how you installed Mini Diarium.

- **Flatpak**: dictionaries for all seven interface languages (English, Spanish, German, French, Italian, Portuguese (Brazil), and Hindi) ship inside the app. Nothing to install.
- **.deb, .rpm, AppImage, AUR**: Mini Diarium uses the dictionaries already installed on your system, under `/usr/share/hunspell`. Most distributions install the English one by default; install your language's `hunspell-<language>` package to get the rest.

To use a language that is not bundled, drop its `.aff` and `.dic` files into:

- Flatpak: `~/.var/app/io.github.fjrevoredo.mini-diarium/config/enchant/hunspell/`
- Everything else: `~/.config/enchant/hunspell/`

Name them after the locale you want checked, for example `nl_NL.aff` and `nl_NL.dic`.

## Security Settings

| Setting | Description |
|---------|-------------|
| Auto-Lock | Lock automatically after a configurable idle timeout |
| Lock when the window loses focus | Lock the journal a few seconds after the window loses focus — minimizing, switching to another app, or clicking another window — independent of the idle timeout. Off by default. A brief misclick outside the window doesn't trigger it if focus returns quickly, and opening a native file dialog from within Mini Diarium (export/import/key file) does not trigger this. |
| Change password | Re-encrypt your journal with a new password |
| Authentication Methods | View registered unlock methods; add a new key file or remove existing ones |

At least one authentication method must remain registered. Removing the last one is blocked.

## Data Settings

You can change your journal's storage location from Preferences. The `diary.db` file is moved to the new location, and future backups go into `{new location}/backups/`.

## Advanced Settings

| Setting | Description |
|---------|-------------|
| Theme Overrides | Advanced JSON-based CSS token overrides (see below) |
| Custom fonts | Upload/remove custom `.ttf`, `.otf`, `.woff`, or `.woff2` font families used by the editor |
| Generate Debug Dump | Export a privacy-safe diagnostic JSON file |

Custom font upload and delete stay explicit button-driven actions. If you delete the currently selected custom font, the editor font falls back to System Default immediately.

## Theme Overrides (Advanced)

Advanced users can customize the app's color palette by overriding individual CSS theme tokens.

Open **Preferences → Advanced**, then enter a JSON object with `light` and/or `dark` keys, each mapping CSS variable names to color values:

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

Valid JSON applies immediately and is saved automatically. If JSON is invalid, an inline error is shown and the last valid saved overrides remain active. **Reset to Default** clears overrides immediately.

Overrides are re-applied automatically every time you open the app. They layer on top of the selected built-in theme.

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

**Preferences → Data → Reset Journal** deletes all entries and recreates the database. This is irreversible. Use export to make a backup before resetting.
