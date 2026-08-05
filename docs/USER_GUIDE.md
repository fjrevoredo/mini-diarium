# Mini Diarium User Guide

> For the best reading experience, see the [online documentation](https://mini-diarium.com/docs/).
> This file is the plain-text source and is kept for technical users and GitHub readers.

## Getting Started

### First Launch

When you open Mini Diarium, the app starts at the **Journal Picker**. From there you can create a new journal or open an existing `diary.db`.

If you create a new journal, you'll be asked to create a password. This password encrypts your entire journal using AES-256-GCM encryption.

**There is no password recovery.** If you forget your password, your entries cannot be recovered. Choose something memorable and keep it safe.

### Locking and Unlocking

Your journal is encrypted whenever it's locked. After selecting a journal, enter your password to unlock it. The journal locks when you close the app, and you can also lock it manually from the header.

As an alternative to your password, you can register a key file in Preferences → Authentication Methods. Once registered, use the "Key File" tab on the unlock screen and select your `.key` file to unlock without typing your password.

You can also enable **idle auto-lock** in Preferences → Security → Auto-Lock. When enabled, Mini Diarium locks automatically after the configured period of inactivity.

### Multiple Journals

You can maintain separate journals for different purposes (personal, work, travel, etc.). Each journal is an independent encrypted file in its own folder.

**Adding a journal:** Use the Journal Picker's add actions. You can create a new journal in a chosen folder or add an existing `diary.db`.

**Switching journals:** Open the Journal Picker, choose the journal you want, and then unlock it. On a shared device, this lets each person select their own journal before any authentication prompt appears.

**Removing a journal:** Remove a journal entry from the Journal Picker. This only removes it from the configured list; the journal files on disk are not deleted. Removing the last configured journal is allowed and leaves the picker in an empty state.

If you only have one journal, the Journal Picker simply shows that single journal as the only choice.

## Writing Entries

### The Editor

Mini Diarium uses a rich text editor with support for:

- Bold and italic text
- Headings (levels 1-3)
- Bullet lists and numbered lists
- Blockquotes
- Inline code and code blocks
- Strikethrough and underline
- Horizontal rules
- Links

The toolbar above the editor provides buttons for each formatting option. Standard keyboard shortcuts also work (Ctrl+B for bold, Ctrl+I for italic, etc.).

### Titles

Each entry can have an optional title. If you prefer a cleaner look, hide titles in Preferences.

### Multiple Entries Per Day

Each date can contain multiple separate entries.

- When a date has more than one entry, an entry navigation bar appears above the editor.
- Use `←` and `→` to move between entries for the selected date.
- Use `+` to create a new blank entry on that same date.
- If a day has only one entry, the navigation bar stays hidden.

### Auto-Save

Entries save automatically as you type with a short debounce delay. If you clear out an entry completely (empty title and empty content), it gets automatically deleted.

### Word Count

A live word count is displayed below the editor.

## Navigating Your Journal

### Calendar

The sidebar shows a monthly calendar. Days with entries are marked with a dot indicator. Click any date to jump to that day's entries.

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

Open the search overlay from the magnifier button in the header, or press **Ctrl+F** (Cmd+F on macOS). Type a few words; matching entries appear newest-first with the matching text highlighted in a short snippet. Search is case- and accent-insensitive (typing "cafe" matches "Café") and uses AND semantics across words. Clicking a result opens that entry in the editor.

Search decrypts entries in memory to run each query and never writes a plaintext index to disk.

## Import

Click the **⋮** menu in the header and select **Import...**.

**Built-in formats:**

- **Mini Diary JSON**: the native export format from Mini Diary
- **Day One JSON**: use the JSON export option in Day One
- **Day One TXT**: the plain-text export from Day One
- **jrnl JSON**: the JSON export from jrnl

Imports are additive. If an imported entry falls on a date that already has entries, Mini Diarium creates another entry for that date instead of merging content heuristically.

## Export

Click the **⋮** menu in the header and select **Export...**:

- **Mini Diary JSON**: machine-readable, can be re-imported into Mini Diarium
- **Markdown**: human-readable, grouped by date; if a day has multiple entries, each appears under its own sub-heading

JSON is the structural export format and preserves entry IDs. Markdown is a readable, best-effort conversion of the stored HTML editor content.

## Custom Import/Export Plugins

You can add custom import and export formats by writing Rhai scripts and placing them in the `plugins/` folder inside your journal directory.

An official example script is included in the repository at `docs/user-plugins/plain-text-timeline.rhai`.

### Where is the plugins folder?

The `plugins/` folder is created automatically next to your `diary.db` file:

- **Windows**: `%APPDATA%\com.minidiarium\plugins\`
- **macOS**: `~/Library/Application Support/com.minidiarium/plugins/`
- **Linux**: `~/.local/share/com.minidiarium/plugins/`

If you have changed your journal location, the plugins folder is `{your chosen directory}/plugins/`.

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

Reversible settings apply immediately. The dialog is close-only (no Save/Cancel footer).

| Setting | Description |
|---------|-------------|
| Theme | Light, dark, or follow system (auto) |
| Language | Choose app language |
| ESC key action | Do nothing or quit the app on Escape |
| First day of week | Sunday, Monday, or auto-detect from locale |
| Allow future entries | Write entries for dates that haven't happened yet |
| Hide titles | Remove the title field for a minimal look |
| Spellcheck | Toggle browser spellcheck in the editor |
| Show entry timestamps | Show created/updated times below entry title |
| Toolbar items | Enable/disable and reorder optional editor toolbar controls |
| Editor font and size | Set editor body typography |
| Auto-Lock | Lock automatically after a configurable idle timeout |
| Theme Overrides | Advanced: override individual color tokens (see below) |
| Custom fonts | Upload/remove editor font families |
| Generate Debug Dump | Export a privacy-safe diagnostics JSON file (see below) |
| Change password | Re-encrypt your journal with a new password |
| Authentication Methods | View registered unlock methods; add a new key file or remove existing ones |
| At least one method must remain | removing the last is blocked |
| Reset journal | Delete all data and start fresh (irreversible) |

### Debug dump (Advanced)

**Preferences → Advanced → Diagnostics → Generate Debug Dump** writes a single JSON file
you can attach to a bug report. Your journal must be unlocked, because most of what the
file describes is read from the open database.

**What it contains:**

| Group | Fields |
|-------|--------|
| App and platform | App version, Tauri version, debug/release build, OS, OS version, CPU architecture, WebView version |
| Database | Stored schema version, the schema version this build expects, SQLite version, database file size |
| Journals | How many journals are configured, an 8-character prefix of the active journal's id, and per journal: whether it is passwordless and whether it uses the default `diary.db` filename |
| Security settings | Whether the active journal requires all unlock methods, and whether a deprecated copy of that flag is still in `config.json` |
| Storage location | Whether the journal appears to sit inside a cloud-sync folder, and which tool it looks like (a name only — never the folder) |
| Entry statistics | Entry count, distinct days written, total words, first and last entry dates |
| Feature counts | Number of tags, tag links, images, image links, images without a thumbnail, custom font families and files, locked entries, entries with metadata, entries without a stored preview |
| Unlock methods | For each: its type (password or key file), when it was created, when it was last used |
| Backups | How many backups exist, the retention limit, the oldest and newest backup filenames, total size on disk |
| Plugins | Number of `.rhai` script files, and each registered plugin's id, whether it imports or exports, and whether it is built in |
| Spell checking | On Linux only: the resolved dictionary language and whether it is installed |
| Your settings | Your preferences, theme choice, theme overrides, and experimental flags |
| Recent activity | The last 200 app log records and the last 200 in-app log records |

**What it never contains:** your password, any encryption key, the device key for a
passwordless journal, diary entry content, entry titles, tag names, unlock-method labels,
journal names, or any file or folder path. Paths are stripped from log records before they
are written, and the app deliberately does not record entry-level detail at the log levels
that end up in the file.

Open the file in any text editor before sending it if you want to check it yourself — it is
plain, readable JSON.

### Theme Overrides (Advanced)

Advanced users can customize the app's color palette by overriding individual theme tokens.

Open **Preferences → Advanced**, then edit the **Theme Overrides** JSON. Enter an object
with `light` and/or `dark` keys, each mapping CSS variable names to color values:

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

Valid JSON applies immediately and is saved in `localStorage`. Invalid JSON shows an inline
error and keeps the last valid saved overrides active. Use **Reset to Default** to clear
overrides immediately. Saved overrides are re-applied automatically every time you open the app
and layer on top of the selected built-in theme (light, dark, or auto-resolved).

**Supported tokens** — only CSS variable names from the documented token contract are
accepted. Unrecognised names are silently ignored. The supported families are:

| Family | Example tokens |
|--------|---------------|
| Background | `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`, `--bg-active` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--text-inverse` |
| Border | `--border-primary`, `--border-secondary`, `--border-focus` |
| Interactive | `--interactive-primary`, `--interactive-primary-hover`, `--interactive-secondary`, `--interactive-secondary-hover` |
| Buttons | `--btn-primary-bg`, `--btn-primary-bg-hover`, `--btn-primary-text`, `--btn-primary-ring`, `--btn-destructive-bg`, `--btn-destructive-bg-hover`, `--btn-destructive-text`, `--btn-destructive-ring`, `--btn-active-bg`, `--btn-active-text` |
| Editor | `--editor-body-text`, `--editor-heading-text`, `--editor-placeholder-text`, `--editor-blockquote-border`, `--editor-blockquote-text`, `--editor-rule-color`, `--editor-code-bg`, `--editor-code-block-bg`, `--editor-code-block-text`, `--editor-link-color`, `--editor-highlight-color`, `--editor-selection-outline` |
| Status | `--status-success-bg/border/text`, `--status-error-bg/border/text`, `--status-warning-bg/border/text`, `--status-info-bg/border/text` |
| Other | `--spinner-color`, `--overlay-bg`, `--shadow-sm`, `--shadow-md`, `--shadow-lg` |

**To reset:** click **Reset to Default** to remove all overrides and restore the built-in theme instantly.

**Notes:**
- The JSON must be valid — any syntax error will show an inline error message and leave the current overrides unchanged.
- Auth and pre-unlock screens are not affected by theme overrides (they use a fixed light-mode style sheet loaded before the app initialises).
- For the full token reference with light/dark values, see `docs/DESIGN_SYSTEM.md`.

## Statistics

Click the **⋮** menu in the header and select **Statistics...**:

- **Total entries** and **total words**
- **Average words per entry**
- **Longest streak** and **current streak** (consecutive days with entries)
- **Entries by weekday**

## Backups

> The authoritative user-facing reference is [the Backups documentation page](https://mini-diarium.com/docs/backups/). This section is the summary.

### What a backup is

A backup is a **snapshot**: a complete Mini Diarium database, encrypted with the same key as your live journal. There is no separate backup format. Snapshots are written with SQLite's `VACUUM INTO`, moved into place atomically, then reopened and verified — a snapshot that exists is one that works.

### When backups are created

- **Before a schema migration** — whenever a new version needs to upgrade your journal's internal format. If this snapshot cannot be written, the migration is refused and your journal is left untouched.
- **Before a destructive action** — resetting a journal, importing a file, removing an authentication method, or moving the journal.
- **On unlock, lock, and app exit** — only if the journal actually changed, and at most once per hour for these automatic triggers. Opening your journal just to read produces no new snapshot.

### Backup location

Snapshots are stored in a `backups/{journal name}/` subfolder **inside the same directory as your `diary.db`**, where `{journal name}` is the database filename without its extension (`diary` by default). Each journal gets its own folder. The default journal directory by OS:

- **Windows**: `%APPDATA%\com.minidiarium\` (legacy: `%APPDATA%\com.minidiarium.app\`)
- **macOS**: `~/Library/Application Support/com.minidiarium/` (legacy: `~/Library/Application Support/com.minidiarium.app/`)
- **Linux**: `~/.local/share/com.minidiarium/` (legacy: `~/.local/share/com.minidiarium.app/`)

If you have changed your journal location (see *Preferences → Storage Location*), snapshots are created in `{your chosen directory}/backups/{journal name}/` instead.

### Backup filenames

Each snapshot is named `backup-YYYY-MM-DD-HHhMMmSS.db` (for example, `backup-2026-08-04-14h30m07.db`). The timestamp reflects local time at the moment the snapshot was taken. A `manifest.json` beside them records each snapshot's time, trigger, size, and entry count — never entry text, titles, tag names, or journal names.

### Retention

Retention is tiered, so how much history you have does not depend on how often you open the app:

- the **10 most recent** snapshots, whatever their age
- **one per day** for the last 14 days
- **one per week** for the last 8 weeks
- **one per month** for the last 12 months

A storage budget of 2 GB (or three times your journal's size, whichever is larger) caps the total; when it is exceeded, the *most recent* tier is thinned first so older history is preserved. Only files matching the `backup-*.db` naming pattern are managed; anything else in the folder is left untouched. Snapshots from earlier versions of Mini Diarium are adopted, not discarded.

### Restoring

In-app restore is not available yet. To restore today, close Mini Diarium, copy the snapshot over your `diary.db`, and reopen the app. Keep a copy of the file you replace until you have confirmed the snapshot has what you expected.

### Custom journal locations

When you move your journal to a different folder via Preferences, `diary.db` is physically moved to the new location and all future snapshots go into `{new location}/backups/{journal name}/`.

**Existing snapshots in the old folder are not moved.** If you want to keep your history, copy the old `backups/` folder to the new journal directory before or after the move.

### Cloud-synced and external locations

If you place your journal directory inside a cloud-synced folder (Dropbox, OneDrive, iCloud Drive, etc.), both `diary.db` and the `backups/` subfolder will be included in the sync, giving you off-site backup on top of local snapshots. Keep in mind that Mini Diarium does not coordinate concurrent access — **do not open the same journal from two devices at the same time**.

### Limits worth knowing before you need them

- **A snapshot keeps the credentials it was taken with.** After a password change, older snapshots still need the **old** password.
- **Removing an authentication method does not revoke it retroactively.** A removed key file still unlocks snapshots taken while it was registered.
- **Local-only journals need this device.** A passwordless journal's key lives in `config.json` in the app data directory, which is *not* part of the backups folder. Copying the backups folder to another machine is not enough to restore it there.

## FAQ

**I forgot my password. Can I recover my entries?**
No — unless you registered a key file as an authentication method. If you have a key file, you can still unlock your journal using it. If you have neither your password nor your key file, your entries cannot be recovered. This is by design.

**Where is my data stored?**
Locally on your machine in an SQLite database. See Backups above for the path.

**Does Mini Diarium connect to the internet?**
Never. No network requests, no analytics, no telemetry, no automatic updates.

**Can I sync across devices?**
Not directly. Mini Diarium is local-only by design. You could manually copy the journal file, but simultaneous access from multiple devices is not supported.

**I used Mini Diary before. Can I migrate?**
Yes. Export from Mini Diary as JSON, then import in Mini Diarium from **Journal → Import...** using the Mini Diary JSON format.
