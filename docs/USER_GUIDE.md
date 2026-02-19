# Mini Diarium User Guide

## Getting Started

### First Launch

When you open Mini Diarium for the first time, you'll be asked to create a password. This password encrypts your entire diary using AES-256-GCM encryption.

**There is no password recovery.** If you forget your password, your entries cannot be recovered. Choose something memorable and keep it safe.

### Locking and Unlocking

Your diary is encrypted whenever it's locked. When you launch the app, enter your password to unlock it. The diary locks when you close the app.

As an alternative to your password, you can register a key file in Preferences → Authentication Methods. Once registered, use the "Key File" tab on the unlock screen and select your `.key` file to unlock without typing your password.

## Writing Entries

### The Editor

Mini Diarium uses a rich text editor with support for:

- Bold and italic text
- Headings (levels 1-3)
- Bullet lists and numbered lists
- Blockquotes
- Code blocks
- Links

The toolbar above the editor provides buttons for each formatting option. Standard keyboard shortcuts also work (Ctrl+B for bold, Ctrl+I for italic, etc.).

### Titles

Each entry can have an optional title. If you prefer a cleaner look, hide titles in Preferences.

### Auto-Save

Entries save automatically as you type with a short debounce delay. If you clear out an entry completely (empty title and empty content), it gets automatically deleted.

### Word Count

A live word count is displayed below the editor.

## Navigating Your Diary

### Calendar

The sidebar shows a monthly calendar. Days with entries are marked with a dot indicator. Click any date to jump to that day's entry.

### Keyboard Navigation

| Action | Shortcut |
|--------|----------|
| Previous day with an entry | `Ctrl+Left` |
| Next day with an entry | `Ctrl+Right` |
| Go to today | `Ctrl+T` |
| Go to a specific date | `Ctrl+G` |
| Previous month | `Ctrl+Shift+Left` |
| Next month | `Ctrl+Shift+Right` |

On macOS, use `Cmd` instead of `Ctrl`.

### Go to Date

Press `Ctrl+G` to open the date picker and jump directly to any date.

## Searching

Full-text search is not available in this version. It will be added in a future release.

## Import

Open the import dialog with `Ctrl+Shift+I`.

**Supported formats:**

- **Mini Diary JSON**: the native export format from Mini Diary
- **Day One JSON**: use the JSON export option in Day One

When importing, Mini Diarium merges entries with your existing diary. If an imported entry falls on a date that already has content, the merge logic combines them rather than overwriting.

## Export

Export your diary with `Ctrl+Shift+E`:

- **JSON**: machine-readable, can be re-imported into Mini Diarium
- **Markdown**: one file per entry, organized by date

## Preferences

Open with `Ctrl+,`:

| Setting | Description |
|---------|-------------|
| Theme | Light or dark mode |
| First day of week | Sunday, Monday, or auto-detect from locale |
| Allow future entries | Write entries for dates that haven't happened yet |
| Hide titles | Remove the title field for a minimal look |
| Spellcheck | Toggle browser spellcheck in the editor |
| Change password | Re-encrypt your diary with a new password |
| Authentication Methods | View registered unlock methods; add a new key file or remove existing ones |
| At least one method must remain | removing the last is blocked |
| Reset diary | Delete all data and start fresh (irreversible) |

## Statistics

Open with `Ctrl+I`:

- **Total entries** and **total words**
- **Average words per entry**
- **Longest streak** and **current streak** (consecutive days with entries)
- **Entries by weekday**

## Backups

Mini Diarium automatically backs up your database periodically, with older backups rotated out.

Database location by OS:

- **Windows**: `%APPDATA%\com.minidiarium.app\`
- **macOS**: `~/Library/Application Support/com.minidiarium.app/`
- **Linux**: `~/.local/share/com.minidiarium.app/`

## FAQ

**I forgot my password. Can I recover my entries?**
No — unless you registered a key file as an authentication method. If you have a key file, you can still unlock using it. If you have neither your password nor your key file, your entries cannot be recovered. This is by design.

**Where is my data stored?**
Locally on your machine in an SQLite database. See Backups above for the path.

**Does Mini Diarium connect to the internet?**
Never. No network requests, no analytics, no telemetry, no automatic updates.

**Can I sync across devices?**
Not directly. Mini Diarium is local-only by design. You could manually copy the database file, but simultaneous access from multiple devices is not supported.

**I used Mini Diary before. Can I migrate?**
Yes. Export from Mini Diary as JSON, then import in Mini Diarium with `Ctrl+Shift+I` using the Mini Diary JSON format.
