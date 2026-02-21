# Mini Diary — Comprehensive Requirements Document

> This document captures every functional and non-functional requirement of the Mini Diary desktop journaling application (v3.3.0), derived from a line-by-line analysis of the source code. It serves as the authoritative specification for building **mini-diarium**, a modern spiritual successor.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Functional Requirements](#2-functional-requirements)
   - 2.1 [Authentication & Encryption](#21-authentication--encryption)
   - 2.2 [Diary Entry Management](#22-diary-entry-management)
   - 2.3 [Rich Text Editing](#23-rich-text-editing)
   - 2.4 [Calendar & Date Navigation](#24-calendar--date-navigation)
   - 2.5 [Search](#25-search)
   - 2.6 [Statistics](#26-statistics)
   - 2.7 [Import](#27-import)
   - 2.8 [Export](#28-export)
   - 2.9 [Settings & Preferences](#29-settings--preferences)
   - 2.10 [Theming](#210-theming)
   - 2.11 [Overlay / Modal System](#211-overlay--modal-system)
   - 2.12 [Application Menu](#212-application-menu)
   - 2.13 [Auto-Update](#213-auto-update)
   - 2.14 [Backup System](#214-backup-system)
   - 2.15 [Data Migration](#215-data-migration)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Data Models & Schemas](#4-data-models--schemas)
5. [User Workflows](#5-user-workflows)
6. [UI/UX Patterns & Layout](#6-uiux-patterns--layout)
7. [Internationalization](#7-internationalization)
8. [Accessibility](#8-accessibility)
9. [Platform-Specific Behaviors](#9-platform-specific-behaviors)
10. [Edge Cases & Known Limitations](#10-edge-cases--known-limitations)

---

## 1. Product Overview

Mini Diary is a **local-first, privacy-focused, encrypted desktop journaling application**. Core value propositions:

- **Privacy**: All data is stored locally on the user's machine. No cloud sync, no telemetry, no accounts.
- **Encryption**: The diary file is encrypted at rest with AES-192-CBC; the user's password is never stored.
- **Simplicity**: One entry per day with an optional title and Markdown-formatted body text.
- **Cross-platform**: Runs on macOS, Windows, and Linux via Electron.

**Current technical stack** (for reference, not prescription):
- Electron 8.3.0, React 16.13.1, Redux 4.0.5, Draft.js 0.11.5, TypeScript 3.9, Webpack 4

---

## 2. Functional Requirements

### 2.1 Authentication & Encryption

#### FR-AUTH-1: Password Creation
- On first launch (no diary file exists), the user is presented with a password creation screen.
- Two fields: "Password" and "Repeat Password".
- Passwords must match; non-matching passwords display an error: the translated `passwords-no-match` string.
- On submission, an empty encrypted diary file is created at the configured directory.

#### FR-AUTH-2: Password Prompt (Unlock)
- When a diary file exists but is locked, the user sees a password prompt screen.
- A single password field with an "Unlock" button.
- Incorrect passwords show the translated `wrong-password` message.
- Other decryption errors show the translated `decryption-error` message with the error detail.

#### FR-AUTH-3: Password Hashing
- Passwords are hashed using **PBKDF2** with:
  - Digest: SHA-512
  - Iterations: 500,000
  - Key length: 64 bytes
  - Salt: A static 88-character Base64 string (hardcoded)
- The hashed password is held in application memory (Redux state) while the diary is unlocked. It is never written to disk in plain or hashed form.

#### FR-AUTH-4: File Encryption
- The diary file is encrypted/decrypted using **AES-192-CBC**.
- The hashed password serves as the cipher key.
- The `crypto.createCipher` / `crypto.createDecipher` APIs are used (deprecated in newer Node.js; noted as a limitation).

#### FR-AUTH-5: Diary Locking
- The diary can be locked via the "Lock Diary" menu item.
- Locking clears the hashed password and all entries from Redux state.
- Menu items that require an unlocked diary are disabled when locked.

#### FR-AUTH-6: Screen-Lock Auto-Lock
- On macOS and Windows, the diary locks automatically when the OS screen is locked (detected via Electron `powerMonitor` events: `lock-screen`).

#### FR-AUTH-7: Password Change
- Users can change their password via Settings.
- Fields: "New Password" and "Repeat New Password".
- The diary file is re-encrypted with the new hashed password.

#### FR-AUTH-8: Diary Reset
- Users can reset (delete) the diary file via Settings.
- A native OS warning dialog is shown with two buttons: a confirm button (`reset-diary-confirm` translation) and a cancel button (`no` translation). The cancel button is the default (index 1), preventing accidental resets.
- The dialog message uses the `reset-diary-msg` translation.
- After reset, the diary file is deleted from disk and the app returns to the password creation screen.
- The reset button is disabled if no diary file exists.

---

### 2.2 Diary Entry Management

#### FR-ENTRY-1: One Entry Per Day
- Each calendar day can have at most one diary entry.
- Entries are keyed by an **index date** in `YYYY-MM-DD` format (e.g., `"2024-03-15"`).

#### FR-ENTRY-2: Entry Structure
Each entry consists of:
- **Title** (optional, plain text, single line)
- **Text** (optional, Markdown-formatted body)
- **dateUpdated** (ISO timestamp string of the last modification)

#### FR-ENTRY-3: Auto-Save
- Entries are saved automatically after a **500 ms debounce** following any keystroke in either the title or text editor.
- Entries are also saved immediately on blur (editor loses focus) and on window `unload` (app closing).

#### FR-ENTRY-4: Empty Entry Deletion
- If both the title and text are empty (after trimming whitespace), the entry is automatically deleted from the data file and search index.

#### FR-ENTRY-5: Entry Persistence
- After every change, the entire diary (all entries + metadata) is serialized to JSON, encrypted, and written synchronously to disk, overwriting the previous file.

#### FR-ENTRY-6: Date Range
- Valid entry dates range from `1900-01-01` to `2099-12-31`.
- Date selection is clamped to this range.

---

### 2.3 Rich Text Editing

#### FR-EDIT-1: Markdown-Based Editor
- The editor uses Draft.js with `markdown-draft-js` for bidirectional Markdown ↔ Draft.js conversion.
- Content is stored as Markdown text in the diary file.
- On load, Markdown is converted to Draft.js `ContentState`; on save, Draft.js content is converted back to Markdown.

#### FR-EDIT-2: Formatting Support
The editor supports:
- **Bold** (Ctrl/Cmd+B)
- **Italic** (Ctrl/Cmd+I)
- **Unordered lists** (bullet points)
- **Ordered lists** (numbered lists)

#### FR-EDIT-3: Formatting Toolbar
- A toolbar is displayed below the editor content area.
- Toolbar buttons: Bold, Italic, Unordered List, Ordered List.
- Active formatting styles are visually indicated on toolbar buttons.

#### FR-EDIT-4: Title Editor
- The title is a separate Draft.js editor instance (plain text only, no formatting).
- Pressing Enter in the title editor moves focus to the text editor.
- The title can be hidden entirely via the "Hide Titles" preference.

#### FR-EDIT-5: Placeholder Text
- Title placeholder: translated `add-a-title` string.
- Text placeholder: translated `write-something` string followed by "…" (hidden when a list is active).

#### FR-EDIT-6: Spellcheck
- Spellcheck is toggled via the `enableSpellcheck` preference.
- Applied to both title and text editors via the HTML `spellCheck` attribute.

#### FR-EDIT-7: Word Count
- A word count is displayed in the editor toolbar area.
- Uses the `word-count` package on the combined title and text of the current entry.
- The word count reads from the persisted entry data in Redux state (not the live editor content), so it reflects the last saved version.

#### FR-EDIT-8: Date Display
- Above the editor, the full locale-formatted weekday and date is displayed (e.g., "Tuesday, January 1, 2019") using the `dddd, LL` Moment.js format.

---

### 2.4 Calendar & Date Navigation

#### FR-CAL-1: Calendar Widget
- A month-view calendar is displayed in the sidebar, rendered using the `react-day-picker` library with `MomentLocaleUtils`.
- Days with diary entries are visually highlighted via a `hasEntry` CSS modifier.
- The currently selected day is highlighted.
- Clicking a day selects it and loads its entry into the editor.
- The calendar caption (month/year header) is replaced by a custom `CalendarNav` component.

#### FR-CAL-2: Month/Year Navigation
- Arrow buttons navigate between months.
- The current month and year are displayed as a header (e.g., "January 2024").

#### FR-CAL-3: Future Date Restriction
- By default, future dates are disabled (cannot be selected) in the calendar.
- This behavior can be toggled via the `allowFutureEntries` preference.
- When future entries are disallowed:
  - "Next day" navigation stops at today.
  - "Next month" navigation clamps to today if the resulting date would be in the future.

#### FR-CAL-4: First Day of Week
- Configurable via preferences: Sunday (0) through Saturday (6), or `null` (system locale default).

#### FR-CAL-5: Keyboard/Menu Navigation
- **Next Day**: Menu item / keyboard shortcut
- **Previous Day**: Menu item / keyboard shortcut
- **Go To Today**: Menu item / keyboard shortcut, also available as a button in the search bar area
- **Next Month**: Menu item / keyboard shortcut
- **Previous Month**: Menu item / keyboard shortcut
- **Go To Date**: Opens a date picker overlay

#### FR-CAL-6: Go To Date Overlay
- A modal overlay with an HTML native `<input type="date">` element.
- The initial value is the currently selected date.
- The submit button is disabled when: the date is undefined (incomplete input), the date equals the currently selected date, or the date is in the future and future entries are disallowed.
- Selecting a date and submitting navigates to that date and closes the overlay.

---

### 2.5 Search

#### FR-SEARCH-1: Full-Text Search
- Uses the **MiniSearch** library for client-side full-text search.
- Searches both `title` and `text` fields.
- The search index is built when the diary is decrypted and updated incrementally as entries are added, modified, or deleted.

#### FR-SEARCH-2: Search Input
- A search bar is located in the sidebar above/below the calendar.
- Input is debounced at **500 ms** before executing the search.
- When the search input is cleared to an empty string, the search dispatches immediately (no debounce).
- A clear button (X icon) resets the search.
- A "Go to Today" button is displayed next to the search bar; it is disabled when today is already selected.

#### FR-SEARCH-3: Prefix Matching
- Search supports prefix matching (typing "hel" matches "hello").

#### FR-SEARCH-4: Tokenization
- A custom tokenizer splits on Unicode-aware space and punctuation characters.
- The `@` and `#` characters are excluded from the token separator list, so `@mentions` and `#tags` are treated as single tokens.

#### FR-SEARCH-5: Search Results
- Results are displayed as a list in the sidebar, replacing or overlaying the calendar view.
- Each result shows the entry date (formatted via `toDateString`) and title. If no title is present, a "No title" label is shown in a faded/italic style.
- Results are sorted by date, newest first.
- Clicking a result navigates to that date. The currently selected result is visually highlighted.
- If a search yields no results, a "No results" info banner is displayed.
- Stale results are filtered: if an entry was deleted after a search, it is excluded from the displayed results.

#### FR-SEARCH-6: Markdown Stripping
- Before indexing, Markdown syntax is stripped from entry text using `remark` + `strip-markdown`, converting to plain text.
- This ensures search matches content words, not Markdown formatting characters.

---

### 2.6 Statistics

#### FR-STATS-1: Statistics Overlay
A modal overlay showing:
- **Total entries**: Count of all diary entries.
- **Entries per week**: Average entries per week since the first entry.
- **Best streak**: Longest consecutive-day streak of entries.
- **Current streak**: Current consecutive-day streak (resets to 0 if no entry yesterday or today).
- **Total words**: Sum of word counts across all entries (title + text).
- **Words per entry**: Average word count per entry.

#### FR-STATS-2: Number Formatting
- Numbers are formatted with locale-appropriate thousands separators and at most 1 decimal digit.

#### FR-STATS-3: Streak Calculation
- A streak increments when consecutive entries are exactly 1 day apart.
- The current streak resets to 0 if the gap between the last entry date and today is greater than 1 day.

---

### 2.7 Import

#### FR-IMPORT-1: Import Overlay
- An overlay modal where users select the import format, see instructions, select a file, and start the import.

#### FR-IMPORT-2: Supported Import Formats

| Format | File Extension | Description |
|--------|---------------|-------------|
| Day One JSON | `.json` | Day One app's JSON export format |
| jrnl JSON | `.json` | jrnl CLI tool's JSON export format |
| Mini Diary JSON | `.json` | Mini Diary's own JSON export format |
| Day One TXT | `.txt` | Day One app's plain text export format |

#### FR-IMPORT-3: Day One JSON Parsing
- Reads `entries` array from `DayOneJson` format.
- Each entry uses `creationDate` for the date and `modifiedDate` for `dateUpdated`.
- The `text` field is split into title and body: the text before the first `\n\n` is the title; the rest is the body.
- Leading `# ` heading markers are stripped from titles.
- The `timeZone` field from Day One entries is used for date conversion.

#### FR-IMPORT-4: jrnl JSON Parsing
- Reads `entries` array from `JrnlJson` format.
- Each entry has `date` (used as index date directly), `title`, and `body` fields.
- `dateUpdated` is set to the current date/time.

#### FR-IMPORT-5: Mini Diary JSON Parsing
- Reads `entries` object from `MiniDiaryJson` format.
- Preserves `dateUpdated` if present; otherwise sets it to now.

#### FR-IMPORT-6: Day One TXT Parsing
- Splits content on `\tDate:\t` delimiters.
- Parses dates in `DD MMMM YYYY` format (e.g., "01 January 1980").
- First non-empty, non-metadata line becomes the title; remaining lines become the text.
- Invalid dates cause an error.

#### FR-IMPORT-7: Entry Merging on Import
- Imported entries are merged with existing diary entries.
- If an entry already exists for a given date:
  - **Titles** are concatenated with the separator `" | "`.
  - **Texts** are concatenated with the separator `"\n\n––––––––––\n\n"` (a horizontal rule of dashes).
- If no entry exists for the date, the imported entry is added directly.

#### FR-IMPORT-8: Import Error Handling
- Import errors are displayed in a native error dialog.
- Binary files are rejected with the message "Import file cannot be binary".

#### FR-IMPORT-9: Post-Import
- After a successful import, the search index is fully rebuilt.
- The import overlay closes automatically.

---

### 2.8 Export

#### FR-EXPORT-1: Export via Save Dialog
- All exports open a native "Save As" dialog.
- The default filename is `mini-diary-export.<ext>`.

#### FR-EXPORT-2: Supported Export Formats

| Format | File Extension | Description |
|--------|---------------|-------------|
| Mini Diary JSON | `.json` | App's native format with metadata |
| Markdown | `.md` | Human-readable Markdown document |
| PDF | `.pdf` | Formatted PDF with GitHub-style CSS |
| Day One TXT | `.txt` | Day One compatible plain text |

#### FR-EXPORT-3: JSON Export
- Outputs a `MiniDiaryJson` object with `metadata` (app name, version, date) and `entries` (sorted chronologically).
- Formatted with tab indentation for readability.

#### FR-EXPORT-4: Markdown Export
- Format: `# Mini Diary` heading, then for each entry: `## [Weekday, Date]`, optionally `**[Title]**`, and the text body.
- Entries are sorted chronologically.

#### FR-EXPORT-5: PDF Export
- Converts entries to Markdown first, then renders to PDF using `electron-md-to-pdf`.
- Styled with GitHub Markdown CSS.
- Page size: A4.

#### FR-EXPORT-6: Day One TXT Export
- Format: `\tDate:\t[Day One formatted date]`, followed by title and plain text (Markdown stripped).
- Entries are sorted chronologically.

#### FR-EXPORT-7: Export Progress Indicator
- A spinning/wait cursor is shown during export operations.

#### FR-EXPORT-8: Export Error Handling
- Export errors are displayed in a native error dialog.

---

### 2.9 Settings & Preferences

#### FR-PREF-1: Persistence
- Preferences are stored using the `electron-settings` library, which writes to a JSON file in the user data directory.

#### FR-PREF-2: Available Preferences

| Preference | Key | Type | Default | Description |
|-----------|-----|------|---------|-------------|
| Theme | `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` if native theme supported, else `'light'` | Color theme |
| First day of week | `firstDayOfWeek` | `0-6 \| null` | `null` (system locale) | Calendar week start day |
| Allow future entries | `allowFutureEntries` | `boolean` | `false` | Allow writing entries for future dates |
| Hide titles | `hideTitles` | `boolean` | `false` | Hide the title field in the editor |
| Enable spellcheck | `enableSpellcheck` | `boolean` | `true` | Enable browser spellcheck |
| File directory | `filePath` | `string` | Electron `userData` path | Directory for the diary file |

#### FR-PREF-3: Preferences Overlay
- A modal overlay with conditional sections based on lock state:
  - **Theme**: Always shown. Radio buttons for Auto, Light, Dark.
  - **First day of week**: Only shown when unlocked. Dropdown with weekday names + system locale option.
  - **Diary entries**: Only shown when unlocked. Checkboxes for "Allow future entries", "Hide titles", "Enable spellcheck".
  - **Diary file**: Always shown. Shows current file path; button to change/move directory; "Reset diary" button. The directory change button is hidden in Mac App Store builds due to sandboxing.
  - **Password**: Only shown when unlocked. Fields for new password and confirmation.

#### FR-PREF-4: Diary Directory Change
- **When unlocked (Move mode)**: Opens a native directory picker with a "Move file" button label. The diary file is moved from the old directory to the new one. If a file already exists at the destination, an error is thrown. On move failure, a native error dialog is shown.
- **When locked (Select mode)**: Opens a native directory picker with a "Select directory" button label. Simply updates the directory preference to point to the new location (no file is moved). After selection, the app checks whether a diary file exists in the new directory.
- The directory change UI is **hidden in Mac App Store builds** due to sandboxing restrictions (the app would not be able to reopen the file without showing an open dialog on every launch).

---

### 2.10 Theming

#### FR-THEME-1: Theme Options
Three options: **Auto** (follows OS), **Light**, **Dark**.

#### FR-THEME-2: Auto Theme Detection
- macOS: Supported on 10.14.0+ (Mojave).
- Windows: Supported on build 18362+ (Windows 10 1903).
- Other platforms: Falls back to "light" default; "auto" option is unavailable.
- OS theme changes are detected at runtime and the app updates immediately.

#### FR-THEME-3: Theme Application
- A CSS class `theme-light` or `theme-dark` is applied to the root container div.
- All component styles respond to this class for appropriate color schemes.

---

### 2.11 Overlay / Modal System

#### FR-OVERLAY-1: Overlay Types
Five overlay states: `none`, `go-to-date`, `import`, `preferences`, `statistics`.

#### FR-OVERLAY-2: Behavior
- Only one overlay can be open at a time.
- Overlays render on top of the main diary view.
- Overlays can be closed (returning to `none` state).
- Overlays are opened from the menu or other triggers.

---

### 2.12 Application Menu

#### FR-MENU-1: Menu Structure

**macOS** has a platform-specific app menu; **Windows/Linux** do not.

| Menu | Items |
|------|-------|
| **App** (macOS only) | About, Preferences, Hide, Hide Others, Show All, Quit |
| **File** | Lock Diary, Import ▸ (4 formats), Export ▸ (4 formats), Statistics, Preferences (Win/Linux only), Exit (Win/Linux) |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Select All, Speech (macOS only) |
| **View** | Go To Date, Go To Today, Previous Day, Next Day, Previous Month, Next Month |
| **Window** | Close, Minimize, Zoom, Bring All to Front (macOS) |
| **Help** | Website, Privacy Policy, License |

#### FR-MENU-2: Menu Item States
- Import, export, lock, statistics, and view navigation items are disabled when the diary is locked.
- They are re-enabled upon successful decryption.

#### FR-MENU-3: Keyboard Shortcuts
Specific accelerators defined in the menu:
- **Lock Diary**: `CmdOrCtrl+L`
- **Go To Today**: `CmdOrCtrl+T`
- **Go To Date**: `CmdOrCtrl+Shift+T`
- **Previous Day**: `Left` arrow key
- **Next Day**: `Right` arrow key
- **Previous Month**: `CmdOrCtrl+Left`
- **Next Month**: `CmdOrCtrl+Right`

---

### 2.13 Auto-Update

#### FR-UPDATE-1: Update Check
- On launch, the app checks for updates using `electron-updater` via `checkForUpdatesAndNotify()`.
- Updates are downloaded and the user is notified.
- The update check is **skipped in Mac App Store builds** (updates are handled by the App Store).
- Network errors (`net::ERR_INTERNET_DISCONNECTED`) are silently caught; all other errors are re-thrown.

---

### 2.14 Backup System

#### FR-BACKUP-1: Automatic Backups
- A backup of the encrypted diary file is created every time the diary is successfully decrypted (on unlock).
- Backups are stored in `<userData>/backups/` directory.
- Backup filenames follow the pattern: `backup-YYYY-MM-DD-HHhMM.txt`.

#### FR-BACKUP-2: Backup Rotation
- A maximum of **50** backup files are retained.
- Older backups (by filename sort order) are deleted when the limit is exceeded.

---

### 2.15 Data Migration

#### FR-MIGRATE-1: Version-Based Migration
- On decryption, the diary file's `metadata.version` is checked.
- If the version is less than `2.0.0`, a migration is performed:
  - All `\n` characters in entry text fields are replaced with `\n\n` (migration from plain text to Markdown paragraph formatting).

---

## 3. Non-Functional Requirements

### NFR-1: Privacy & Security
- **Local-only storage**: No network requests for data (only for update checks).
- **No telemetry or analytics**.
- **Encrypted at rest**: Diary file is AES-192-CBC encrypted.
- **Password never stored**: Only the PBKDF2 hash is kept in memory while unlocked.
- **Auto-lock on screen lock**: Prevents exposure if user walks away.

### NFR-2: Performance
- **Debounced auto-save** (500 ms): Prevents excessive disk writes during typing.
- **Debounced search** (500 ms): Prevents excessive search index queries during typing.
- **PureComponent throughout**: React components extend `PureComponent` for shallow-equality-based re-render skipping.
- **Async search index operations**: Index creation and updates use `Promise`-based async patterns.
- **Synchronous file I/O**: File reads and writes are synchronous (`fs.readFileSync`, `fs.writeFileSync`), which can block the renderer process for large files.

### NFR-3: Reliability
- **Automatic backups**: 50 rolling backup files protect against data corruption.
- **Save on blur and unload**: Entries are saved when the editor loses focus and when the window closes.
- **Entry merge on import**: Existing entries are never overwritten; conflicting entries are merged.

### NFR-4: Usability
- **Simple interface**: Two-panel layout (sidebar + editor) with minimal chrome.
- **Locale-aware dates**: All dates are displayed in the user's locale.
- **13 languages supported**.
- **Spellcheck integration**: Uses the browser's built-in spellchecker.

### NFR-5: Cross-Platform
- Targets **macOS**, **Windows**, and **Linux**.
- Platform-specific behaviors:
  - macOS: Hidden inset title bar, app menu, speech services, Mac App Store support.
  - Windows/Linux: Preferences in File menu.

### NFR-6: Offline Capability
- The application is fully functional offline.
- No internet connection is required for any core functionality.
- Update checks gracefully fail when offline.

---

## 4. Data Models & Schemas

### 4.1 Diary Entry

```typescript
interface DiaryEntry {
  dateUpdated: string;  // ISO date string of last modification
  title: string;        // Plain text, single line
  text: string;         // Markdown-formatted body text
}
```

### 4.2 Entries Collection

```typescript
type IndexDate = string;  // Format: "YYYY-MM-DD"
type Entries = Record<IndexDate, DiaryEntry>;
```

### 4.3 Diary File (on disk, after decryption)

```typescript
interface MiniDiaryJson {
  metadata: {
    application: string;   // e.g., "Mini Diary"
    version: string;       // e.g., "3.3.0" (semver)
    dateUpdated: string;   // ISO date string of last file write
  };
  entries: Entries;
}
```

### 4.4 Day One Import Types

```typescript
interface DayOneEntry {
  creationDevice: string;
  text: string;              // Combined title + body
  richText: string;
  uuid: string;
  modifiedDate: string;      // ISO date string
  creationDeviceType: string;
  starred: boolean;
  duration: number;
  creationDeviceModel: string;
  creationDate: string;      // ISO date string
  creationOSVersion: string;
  creationOSName: string;
  timeZone: string;          // IANA timezone identifier
}

interface DayOneJson {
  metadata: { version: string };
  entries: DayOneEntry[];
}
```

### 4.5 jrnl Import Types

```typescript
interface JrnlEntry {
  date: string;    // "YYYY-MM-DD" format
  title: string;
  body: string;
  [key: string]: string;  // Additional fields allowed
}

interface JrnlJson {
  tags: Record<string, string>;
  entries: JrnlEntry[];
}
```

### 4.6 Application State (Redux)

```typescript
// App preferences & UI state
interface AppState {
  allowFutureEntries: boolean;
  enableSpellcheck: boolean;
  firstDayOfWeek: Weekday | null;  // 0-6 or null
  hideTitles: boolean;
  overlay: OverlayType;            // 'none' | 'go-to-date' | 'import' | 'preferences' | 'statistics'
  theme: Theme;                    // 'light' | 'dark' (resolved)
  themePref: ThemePref;            // 'auto' | 'light' | 'dark' (user preference)
}

// Diary navigation state
interface DiaryState {
  dateSelected: Moment;
  searchKey: string;
  searchResults: string[];   // Array of IndexDate strings
}

// File/encryption state
interface FileState {
  entries: Entries;
  hashedPassword: string;
  fileExists: boolean;
  decryptStatus: Status;     // 'idle' | 'inProgress' | 'error'
  decryptErrorMsg: string;
  encryptStatus: Status;
  encryptErrorMsg: string;
}

// Export state
interface ExportState {
  exportStatus: Status;
  exportErrorMsg: string;
}

// Import state
interface ImportState {
  importFormat: ImportFormat;   // 'jsonDayOne' | 'jsonJrnl' | 'jsonMiniDiary' | 'txtDayOne'
  importStatus: Status;
  importErrorMsg: string;
}
```

### 4.7 Preferences File (electron-settings JSON)

```json
{
  "theme": "auto",
  "firstDayOfWeek": null,
  "allowFutureEntries": false,
  "hideTitles": false,
  "enableSpellcheck": true,
  "filePath": "/path/to/directory"
}
```

### 4.8 Encrypted File Format

- **Filename**: `mini-diary.txt`
- **On disk**: Raw AES-192-CBC encrypted binary data.
- **Decrypted content**: UTF-8 JSON string conforming to the `MiniDiaryJson` schema.

---

## 5. User Workflows

### 5.1 First-Time Setup
1. User launches the app for the first time.
2. No diary file exists → Password Creation screen is shown.
3. User enters and confirms a password.
4. An empty encrypted diary file is created.
5. The diary view (calendar + editor) is displayed.

### 5.2 Daily Journaling
1. User launches the app → Password Prompt screen.
2. User enters password → Diary is decrypted; search index is built; backup is created.
3. Today's date is selected by default.
4. User types in the title (optional) and text editor.
5. Content auto-saves after 500 ms of inactivity.
6. User can navigate to other dates via calendar, keyboard shortcuts, or search.

### 5.3 Searching Past Entries
1. User types a query in the search bar.
2. After 500 ms, search results appear in the sidebar.
3. Each result shows the date and title.
4. Clicking a result navigates to that entry.
5. Clearing the search returns to the calendar view.

### 5.4 Importing Data
1. User opens Import via File menu → selects a format.
2. Import overlay appears with format-specific instructions.
3. User selects a file → clicks "Start Import".
4. Entries are parsed, merged with existing data, and saved.
5. The search index is rebuilt.
6. The overlay closes automatically.

### 5.5 Exporting Data
1. User opens Export via File menu → selects a format.
2. A native "Save As" dialog appears.
3. The user chooses a destination.
4. Entries are converted and written to the chosen file.
5. A spinning cursor is shown during processing.

### 5.6 Changing Settings
1. User opens Preferences (Cmd/Ctrl+, or File menu).
2. Changes are applied immediately and persisted.
3. No "Save" button required.

---

## 6. UI/UX Patterns & Layout

### 6.1 Application Layout

```
┌─────────────────────────────────────────────────────┐
│ Title Bar (hidden inset on macOS, drag area)        │
├──────────────┬──────────────────────────────────────┤
│  SIDEBAR     │  EDITOR                              │
│              │                                      │
│  Calendar    │  Weekday, Full Date                  │
│  Navigation  │  [Title Field]                       │
│              │  [Text Editor]                       │
│  Search Bar  │                                      │
│  [Results]   │  ┌──────────────────────────────┐    │
│              │  │ Toolbar: B I • 1. | Word Count│    │
│              │  └──────────────────────────────┘    │
└──────────────┴──────────────────────────────────────┘
```

### 6.2 Window Properties
- **Initial size**: 1100 × 600 px
- **Minimum size**: 500 × 500 px
- **Title bar**: Hidden inset (macOS native), draggable header area.
- Double-clicking the header toggles window maximize/restore.

### 6.3 Loading States
- Initial load: A "Loading…" text is shown.
- Export/Import in progress: Wait cursor on the entire window.

### 6.4 Error Display
- Decryption errors: Inline within the password prompt form.
- Import/Export errors: Native OS error dialog boxes.

### 6.5 Overlay Pattern
- Overlays render as modal dialogs on top of the main content.
- Types: Preferences, Import, Go To Date, Statistics.

### 6.6 Icon System
- Uses **Feather Icons** SVG icon set.
- Icons are rendered inline as SVG with consistent size and stroke properties.

### 6.7 CSS Architecture
- **CSS Reset**: `minireset.css`.
- **Preprocessor**: SASS/SCSS.
- **Naming**: BEM-like convention.
- **Theming**: `.theme-light` and `.theme-dark` root class selectors.
- **No CSS modules**: Global styles.

### 6.8 Context Menu
- A context menu is enabled with default options.
- "Copy Image" and "Search with Google" options are explicitly disabled.

---

## 7. Internationalization

### 7.1 Supported Languages (13)

| Code | Language |
|------|----------|
| `en` | English |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `it` | Italian |
| `pt` | Portuguese |
| `tr` | Turkish |
| `el` | Greek |
| `is` | Icelandic |
| `uk` | Ukrainian |
| `no` / `nb` | Norwegian (Bokmål) |
| `zh` | Chinese (Simplified) |
| `zh-TW` | Chinese (Traditional) |

### 7.2 Language Detection
- The system language is detected automatically via `app.getLocale()`.
- The detection first checks the full locale (e.g., `zh-TW`), then the language without region (e.g., `zh`).
- If neither is found in the translation map, English is used as the fallback.
- Norwegian Bokmål (`nb`) is mapped to the `no` translation file.
- Regional translations (e.g., `zh-TW`) are merged on top of English defaults, same as base language translations.
- The full system locale (including region) is used for Moment.js date formatting even when only the base language translations are used.

### 7.3 Translation Architecture
- Translations are loaded in the main process and served to the renderer via synchronous IPC calls.
- Over **145 translation keys** cover: menu items, weekday names, theme labels, editor placeholders, search labels, preference labels, password dialogs, statistics labels, import/export messages, error messages, and general UI text.
- Translations support **named string substitution** (e.g., `"Import from {format}"` where `{format}` is replaced with the format name, or `"About {appName}"`).

### 7.4 Date Localization
- All date formatting uses the Moment.js locale system.
- The locale is set based on the detected system language.
- Date formats include: `YYYY-MM-DD` (storage), `LL` (display), `dddd, LL` (full weekday + date).

---

## 8. Accessibility

### 8.1 Current Accessibility Features
- **Keyboard navigation**: Menu items have keyboard shortcuts for date navigation and common actions.
- **Semantic HTML**: Form elements, headings, and table structures used in overlays.
- **Spellcheck**: Built-in browser spellcheck support.

### 8.2 Accessibility Gaps (for mini-diarium to address)
- No ARIA labels or roles on custom components.
- No skip-navigation links.
- No high-contrast mode.
- No screen reader testing documented.
- No focus management for overlay open/close.
- Calendar widget lacks keyboard navigation.
- No announcements for auto-save status.

---

## 9. Platform-Specific Behaviors

### 9.1 macOS
- Hidden inset title bar with drag area.
- App menu (About, Preferences, Hide, Quit) follows macOS conventions.
- Speech services (Start/Stop Speaking) in Edit menu.
- Window menu with Bring All to Front.
- Dark mode support on macOS 10.14+ (Mojave).
- Screen lock detection for auto-lock.
- Build targets: DMG, Mac App Store (MAS), ZIP.
- Hardened runtime and entitlements for MAS/notarization.

### 9.2 Windows
- Preferences item in File menu.
- Dark mode support on Windows 10 build 18362+ (1903).
- Screen lock detection for auto-lock.

### 9.3 Linux
- Preferences item in File menu.
- No native dark mode detection.
- No screen lock detection.

---

## 10. Edge Cases & Known Limitations

### 10.1 Security Limitations
- **Static salt**: The PBKDF2 salt is hardcoded, meaning all users share the same salt. This weakens password hashing against rainbow table attacks.
- **Deprecated crypto APIs**: Uses `crypto.createCipher`/`crypto.createDecipher` (deprecated since Node.js 10.0.0 in favor of `createCipheriv`/`createDecipheriv`). No initialization vector (IV) is used, reducing security.
- **In-memory password**: The hashed password is stored in Redux state (JavaScript heap), which could theoretically be extracted from a memory dump.

### 10.2 Data Limitations
- **One entry per day**: Cannot create multiple entries for the same date. Multiple entries imported for the same date are merged.
- **No attachments**: No support for images, files, or media.
- **No tags or categories**: Entries have no metadata beyond title, text, and dateUpdated.
- **Date range**: Limited to 1900-01-01 through 2099-12-31.

### 10.3 Performance Limitations
- **Synchronous file I/O**: All file operations (read, write, copy, move, delete) are synchronous, blocking the renderer process. This could cause UI freezes with large diary files.
- **Full file rewrite on every save**: The entire diary is serialized and encrypted on every entry change. Performance degrades with many entries.
- **No lazy loading**: All entries are loaded into memory at once on decryption.

### 10.4 Editor Limitations
- **Draft.js**: The project is no longer maintained (archived). The `markdown-draft-js` conversion has known limitations with complex Markdown.
- **Limited formatting**: Only bold, italic, and lists. No headings, links, images, code blocks, or other Markdown features in the toolbar (though they can be typed manually).

### 10.5 Other Limitations
- **No cloud sync**: Purely local storage.
- **No multi-device support**: No way to share diary data between devices.
- **No undo for diary reset**: Deleting the diary is permanent (though backups exist).
- **Electron overhead**: Large application size and memory footprint for a journaling app.
- **Project unmaintained**: Mini Diary v3.3.0 is the final version; dependencies are outdated.
