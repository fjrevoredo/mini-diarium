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
| Previous day with an entry | `Ctrl+[` |
| Next day with an entry | `Ctrl+]` |
| Go to today | `Ctrl+T` |
| Go to a specific date | `Ctrl+G` |
| Previous month | `Ctrl+Shift+[` |
| Next month | `Ctrl+Shift+]` |

On macOS, use `Cmd` instead of `Ctrl`.

### Go to Date

Press `Ctrl+G` to open the date picker and jump directly to any date.

## Searching

Full-text search is not available in this version. It will be added in a future release.

## Import

Open the import dialog from **Diary → Import...** in the app menu.

**Built-in formats:**

- **Mini Diary JSON**: the native export format from Mini Diary
- **Day One JSON**: use the JSON export option in Day One
- **Day One TXT**: the plain-text export from Day One
- **jrnl JSON**: the JSON export from jrnl

When importing, Mini Diarium merges entries with your existing diary. If an imported entry falls on a date that already has content, the merge logic combines them rather than overwriting.

## Export

Open the export dialog from **Diary → Export...** in the app menu:

- **Mini Diary JSON**: machine-readable, can be re-imported into Mini Diarium
- **Markdown**: human-readable, one section per entry organized by date

## Custom Import/Export Plugins

You can add custom import and export formats by writing Rhai scripts and placing them in the `plugins/` folder inside your diary directory.

### Where is the plugins folder?

The `plugins/` folder is created automatically next to your `diary.db` file:

- **Windows**: `%APPDATA%\com.minidiarium\plugins\`
- **macOS**: `~/Library/Application Support/com.minidiarium/plugins/`
- **Linux**: `~/.local/share/com.minidiarium/plugins/`

If you have changed your diary location, the plugins folder is `{your chosen directory}/plugins/`.

A `README.md` file with templates and API documentation is auto-generated in the plugins folder on first launch.

### Writing a plugin

Each plugin is a single `.rhai` file with a metadata comment header and one entry-point function.

**Import plugin example** (`plugins/my-format.rhai`):

```rhai
// @name: My Custom Format
// @type: import
// @extensions: json

fn parse(content) {
    let data = parse_json(content);
    let entries = [];
    for item in data {
        entries += #{
            date: item.date,       // must be YYYY-MM-DD
            title: item.title,
            text: item.body,       // should be HTML
        };
    }
    entries
}
```

**Export plugin example** (`plugins/plain-text.rhai`):

```rhai
// @name: Plain Text
// @type: export
// @extensions: txt

fn format_entries(entries) {
    let output = "";
    for entry in entries {
        output += entry.date + " - " + entry.title + "\n";
        output += html_to_markdown(entry.text) + "\n\n";
    }
    output
}
```

### Available helper functions

| Function | Description |
|----------|-------------|
| `parse_json(string)` | Parse a JSON string into a map or array |
| `count_words(string)` | Count words in a string |
| `now_rfc3339()` | Current timestamp in RFC 3339 format |
| `html_to_markdown(string)` | Convert HTML to Markdown |

### Rules and limitations

- Import scripts must define `fn parse(content)` returning an array of entry maps
- Export scripts must define `fn format_entries(entries)` returning a string (`export` is a reserved word in Rhai)
- The `date` field must be in `YYYY-MM-DD` format
- The `text` field should contain HTML (the editor uses TipTap)
- Scripts run in a sandbox: no file system access, no network access
- Scripts are limited to 1,000,000 operations to prevent infinite loops
- Plugins appear in the Import/Export overlay dropdowns alongside built-in formats

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

Open from **Diary → Statistics...** in the app menu:

- **Total entries** and **total words**
- **Average words per entry**
- **Longest streak** and **current streak** (consecutive days with entries)
- **Entries by weekday**

## Backups

### When backups are created

A backup is created automatically each time you successfully unlock your diary, whether by password or key file. If the unlock fails (wrong password, missing key file), no backup is taken.

### Backup location

Backups are stored in a `backups/` subfolder **inside the same directory as your `diary.db`**. The default diary directory by OS:

- **Windows**: `%APPDATA%\com.minidiarium\` (legacy: `%APPDATA%\com.minidiarium.app\`)
- **macOS**: `~/Library/Application Support/com.minidiarium/` (legacy: `~/Library/Application Support/com.minidiarium.app/`)
- **Linux**: `~/.local/share/com.minidiarium/` (legacy: `~/.local/share/com.minidiarium.app/`)

If you have changed your diary location (see *Preferences → Storage Location*), backups are created in `{your chosen directory}/backups/` instead.

### Backup filenames

Each backup is named `backup-YYYY-MM-DD-HHhMM.db` (for example, `backup-2024-01-15-14h30.db`). The timestamp reflects local time at the moment of unlock.

### Rotation

Mini Diarium keeps the **50 most recent backups**. When a new backup would push the count above 50, the oldest backups are deleted automatically. Only files matching the `backup-*.db` naming pattern are counted; any other files you place in the `backups/` folder are left untouched.

### Custom diary locations

When you move your diary to a different folder via Preferences, `diary.db` is physically moved to the new location and all future backups will go into `{new location}/backups/`.

**Existing backups in the old `backups/` folder are not moved.** If you want to keep your backup history, copy the old `backups/` folder to the new diary directory before or after the move.

### Cloud-synced and external locations

If you place your diary directory inside a cloud-synced folder (Dropbox, OneDrive, iCloud Drive, etc.), both `diary.db` and the `backups/` subfolder will be included in the sync, giving you off-site backup on top of local rotation. Keep in mind that Mini Diarium does not coordinate concurrent access — **do not open the same diary from two devices at the same time**.

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
Yes. Export from Mini Diary as JSON, then import in Mini Diarium from **Diary → Import...** using the Mini Diary JSON format.
