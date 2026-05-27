# CLAUDE.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app (SolidJS + Rust/Tauri v2 + SQLite). All diary entries are AES-256-GCM encrypted at rest; plaintext never touches disk.

**Core principles:** privacy-first (no network), incremental dev, clean architecture, TypeScript strict + Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `docs/todo/TODO_EXTRA.md` for structured roadmap items and `docs/todo/TODO.md` for the working backlog.

## Domain Guides

For domain-specific conventions, gotchas, and checklists, see:
- [Frontend (src/)](src/CLAUDE.md) — SolidJS, state, i18n, testing, TipTap, theme
- [Backend (src-tauri/)](src-tauri/CLAUDE.md) — Tauri commands, Rust patterns, plugins, security, search implementation
- [E2E (e2e/)](e2e/CLAUDE.md) — WebdriverIO, tauri-driver, viewport rules, E2E mode contracts
- [Benchmarks (benchmarks/)](benchmarks/CLAUDE.md) — criterion, Vitest bench, CI tracking, gotchas
- [Website (website/)](website/CLAUDE.md) — blog post workflow, generator script, content strategy, file layout
- [Best practices](docs/best-practices/README.md) — durable frontend, Rust, Tauri, and CI rules for code quality and regression diagnosis

## Execution Environment

This repo is commonly worked on from a WSL shell over a Windows checkout (`/mnt/d/Repos/mini-diarium` <-> `D:\Repos\mini-diarium`). In that setup, the reliable path is the Windows toolchain, not the WSL one.

Operational rule for agents in this environment:

- Prefer `cmd.exe /c ...` for project commands unless you have explicitly verified a Linux-native setup.
- Do not start with bare `bun`, `cargo`, `vite`, `vitest`, or `tauri` from WSL in this repo.
- For Rust commands under `src-tauri`, switch drives explicitly:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- Use repo-local Tauri CLI through `cmd.exe /c bun run tauri ...`; do not assume `cargo tauri` is globally installed.
- Treat generic shell snippets in docs as human-oriented unless they already say "Run from this Codex shell".

Commands verified to work from this shell via Windows:

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run build`
- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- `cmd.exe /c bun run test:e2e`
- `cmd.exe /c bun run tauri info`
- `cmd.exe /c bun run diagrams:check`
- `cmd.exe /c bun run validate:locales`

Commands with side effects:

- `cmd.exe /c bun run website:build-static` rewrites generated files under `website/`
- `cmd.exe /c bun run diagrams` regenerates SVG outputs

## Architecture

**Visual diagrams**:
- [System context](docs/diagrams/context.mmd) - High-level local-only data flow (Mermaid)
- [Unlock flow](docs/diagrams/unlock.mmd) - Password/key-file unlock flow through DB open, backup rotation, and unlocked session (Mermaid)
- [Save-entry flow](docs/diagrams/save-entry.mmd) - Multi-entry editor persistence flow with create/save/delete and date refresh (Mermaid)
- [Layered architecture](docs/diagrams/architecture.svg) - Presentation/state/backend/data layers including journals, config, and plugins (D2)

**Regenerate diagrams:** `cmd.exe /c bun run diagrams` — regenerates all `docs/diagrams/` SVGs; `.mmd` sources via mmdc, `.d2` sources via d2.

Quick reference (ASCII art):

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                         │
│                    (SolidJS Components)                       │
│  ┌──────────┐ ┌────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐ │
│  │ Journals │ │  Auth  │ │ MainLayout │ │ Search │ │ Overlays │ │
│  └──────────┘ └────────┘ └────────────┘ └────────┘ └──────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ Reactive Signals
┌────────────────────────────┴────────────────────────────────────┐
│                       STATE LAYER                               │
│ auth.ts · entries.ts · journals.ts · search.ts · ui.ts · preferences.ts │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoke() / listen()
┌────────────────────────────┴────────────────────────────────────┐
│                      BACKEND (Rust)                             │
│ Cmds: auth · entries · search · nav · stats · import/export · plugin │
│ Biz: crypto/ · db/ · import/ · export/ · plugin/ · menu.rs · config.rs│
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌──────────┬──────────────┬─────────────┬──────────────┐
           │ diary.db │ config.json  │ backups/    │ plugins/     │
           │ encrypted│ journals     │ rotated     │ Rhai scripts │
           └──────────┴──────────────┴─────────────┴──────────────┘
```

**Key relationships:**
- Entries are stored encrypted in SQLite. Each entry has a unique integer `id` (PRIMARY KEY AUTOINCREMENT) and can have a unique date. Multiple entries per date are supported (schema v6). Full-text search is not currently implemented; `entries_fts` has been removed (schema v4). See `commands/search.rs` for the stub and interface contract.
- Menu events flow: Rust `app.emit("menu-*")` → frontend `listen()` in `shortcuts.ts` or overlay components.
- Preferences use `localStorage` (not Tauri store plugin).
- Multiple journals are tracked in `{app_data_dir}/config.json` via `JournalConfig` entries. Each journal maps to a directory containing its own `diary.db`. `DiaryState` holds a single connection; switching journals updates `db_path`/`backups_dir` and auto-locks. Legacy single-diary configs are auto-migrated on first `load_journals()` call.

## Website (`website/`)

Static marketing site — plain HTML/CSS/JS. Deploy via Coolify using `website/docker-compose.yml`.
**Version sync:** `bump-version.sh` updates `<span class="app-version">` in `website/index.html`. Always commit it alongside version files.
**Blog posts:** Write `posts-src/YYYY-MM-DD-slug.md`, then run `cmd.exe /c bun run website:blog`. Never hand-craft HTML in `blog/`. See [website/CLAUDE.md](website/CLAUDE.md) for the full workflow.
**Docs pages:** Edit `docs-src/NN-slug.md`, then run `cmd.exe /c bun run website:build-static`. Never hand-craft HTML in `docs/` — all files there are generated output.
**Docs are the authoritative user reference:** `website/docs-src/` is the primary source of truth for how every user-facing feature works — for both users and agents auditing feature behavior. After adding, changing, or removing any user-facing feature, update the relevant `docs-src/` file in the same task. Stale docs are a bug.

## Command Registry

All 65 registered Tauri commands (source: `lib.rs`). Rust names use `snake_case`; frontend wrappers in `src/lib/tauri.ts` use `camelCase`.

| Module | Rust Command | Frontend Wrapper | Description |
|--------|-------------|-----------------|-------------|
| auth | `create_diary` | `createJournal(password)` | Create new encrypted DB |
| auth | `create_diary_auto` | `createJournalAuto()` | Create local-only journal (no password) |
| auth | `unlock_diary_auto` | `unlockJournalAuto()` | Auto-unlock local-only journal from config key |
| auth | `unlock_diary` | `unlockJournal(password)` | Decrypt and open DB |
| auth | `lock_diary` | `lockJournal()` | Close DB connection |
| auth | `diary_exists` | `journalExists()` | Check if DB file exists |
| auth | `check_diary_path` | `checkJournalPath(dir)` | Stateless check: true if `{dir}/diary.db` exists |
| auth | `is_diary_unlocked` | `isJournalUnlocked()` | Check unlock state |
| auth | `get_diary_path` | `getJournalPath()` | Return journal file path |
| auth | `change_diary_directory` | `changeJournalDirectory(newDir)` | Change journal directory (locked state only) |
| auth | `change_password` | `changePassword(old, new)` | Re-encrypt with new password |
| auth | `reset_diary` | `resetJournal()` | Delete and recreate DB |
| auth | `verify_password` | `verifyPassword(password)` | Validate password without side effects |
| auth | `unlock_diary_with_keypair` | `unlockJournalWithKeypair(keyPath)` | Open DB via private key file |
| auth | `list_auth_methods` | `listAuthMethods()` | List all registered auth slots |
| auth | `generate_keypair` | `generateKeypair()` | Generate X25519 keypair, return hex |
| auth | `write_key_file` | `writeKeyFile(path, privateKeyHex)` | Write private key hex to file |
| auth | `register_password` | `registerPassword(newPassword)` | Register a password auth slot (requires journal unlocked) |
| auth | `register_keypair` | `registerKeypair(currentPassword, publicKeyHex, label)` | Add keypair auth slot |
| auth | `remove_auth_method` | `removeAuthMethod(slotId, currentPassword)` | Remove auth slot (guards last) |
| auth | `unlock_diary_all_methods` | `unlockJournalAllMethods(credentials)` | Unlock with all auth methods simultaneously (multi-auth) |
| auth | `set_require_all_auth` | `setRequireAllAuth(enabled)` | Enable/disable require-all-auth for the active journal |
| auth | `peek_auth_slot_types` | `peekAuthSlotTypes()` | Read auth slot types from locked DB (no unlock required); used by multi-auth unlock form |
| auth | `list_journals` | `listJournals()` | List configured journals from config.json |
| auth | `get_active_journal_id` | `getActiveJournalId()` | Get active journal ID |
| auth | `add_journal` | `addJournal(name, path)` | Add a new journal entry to config |
| auth | `remove_journal` | `removeJournal(id)` | Remove journal (guards last); auto-locks if active |
| auth | `rename_journal` | `renameJournal(id, name)` | Rename a journal |
| auth | `switch_journal` | `switchJournal(id)` | Auto-lock, switch db_path/backups_dir, persist active |
| entries | `create_entry` | `createEntry(date)` | Create blank entry, returns DiaryEntry with assigned id |
| entries | `save_entry` | `saveEntry(id, title, text)` | Update entry by id (encrypts) |
| entries | `get_entries_for_date` | `getEntriesForDate(date)` | Fetch all entries for a date (newest-first) |
| entries | `delete_entry_if_empty` | `deleteEntryIfEmpty(id, title, text)` | Remove entry by id if content is empty |
| entries | `delete_entry` | `deleteEntry(id)` | Delete entry by id unconditionally |
| entries | `get_all_entry_dates` | `getAllEntryDates()` | List all dates with entries |
| files | `read_file_bytes` | `readFileBytes(path)` | Read local image file bytes (jpg/jpeg/png/gif/webp/bmp) |
| files | `read_text_file` | `readTextFile(path)` | Read local Markdown file as UTF-8 text (.md only, 1 MiB cap) |
| search | `search_entries` | `searchEntries(query)` | Stub — always returns `[]`; interface preserved for future secure search |
| nav | `navigate_previous_day` | `navigatePreviousDay(currentDate)` | Previous day with entry |
| nav | `navigate_next_day` | `navigateNextDay(currentDate)` | Next day with entry |
| nav | `navigate_to_today` | `navigateToToday()` | Today's date string |
| nav | `navigate_previous_month` | `navigatePreviousMonth(currentDate)` | Same day, previous month |
| nav | `navigate_next_month` | `navigateNextMonth(currentDate)` | Same day, next month |
| stats | `get_statistics` | `getStatistics()` | Aggregate stats (streaks, counts, words) |
| export | `export_json` | `exportJson(filePath)` | Export all entries as JSON |
| export | `export_markdown` | `exportMarkdown(filePath)` | Export all entries as Markdown |
| plugin | `list_import_plugins` | `listImportPlugins()` | List all import plugins (built-in + Rhai) |
| plugin | `list_export_plugins` | `listExportPlugins()` | List all export plugins (built-in + Rhai) |
| plugin | `run_import_plugin` | `runImportPlugin(pluginId, filePath)` | Run import via plugin registry |
| plugin | `run_export_plugin` | `runExportPlugin(pluginId, filePath)` | Run export via plugin registry |
| debug | `generate_debug_dump` | `generateDebugDump(filePath, preferencesJson)` | Write privacy-safe diagnostic JSON to file |
| menu | `update_menu_locale` | `updateMenuLocale(locale)` | Update all native menu item texts to the given locale; falls back to English |
| fonts | `list_bundled_fonts` | `listBundledFonts()` | List available bundled editor fonts |
| fonts | `get_font_data` | `getFontData(fontId)` | Get a font's base64 data URL; checks custom DB fonts first, falls back to bundled; sets `bold_synthesized: true` when Bold weight is absent |
| fonts | `list_custom_fonts` | `listCustomFonts()` | List all custom font families stored in the journal DB with per-weight flags |
| fonts | `import_custom_font` | `importCustomFont(family, weight, path)` | Store a font file BLOB in `custom_fonts`; validates magic bytes, size (≤20 MB), and requires Regular before Bold |
| fonts | `delete_custom_font_family` | `deleteCustomFontFamily(family)` | Remove all weight rows for a family from `custom_fonts` |
| tags | `create_tag` | `createTag(name)` | Create encrypted tag; returns `Tag` (deduplicates by HKDF fingerprint) |
| tags | `get_all_tags` | `getAllTags()` | Return all tags with decrypted names, sorted alphabetically |
| tags | `rename_tag` | `renameTag(id, name)` | Re-encrypt tag name and update HKDF fingerprint |
| tags | `delete_tag` | `deleteTag(id)` | Delete tag; cascades to remove all `entry_tags` associations |
| tags | `add_tag_to_entry` | `addTagToEntry(entryId, tagId)` | Associate an existing tag with an entry (idempotent) |
| tags | `remove_tag_from_entry` | `removeTagFromEntry(entryId, tagId)` | Remove tag association from an entry |
| tags | `get_tags_for_entry` | `getTagsForEntry(entryId)` | Return all tags on a specific entry (decrypted) |
| tags | `get_entry_dates_by_tag` | `getEntryDatesByTag(tagId)` | Return all entry dates (`YYYY-MM-DD`) associated with a tag |

## Conventions

### Error Handling (IPC Contract)

- Backend returns `Result<T, String>`; frontend wraps `invoke()` calls with `try/catch` and sets error signals.
- User-facing frontend errors must be sanitized with `mapTauriError()`; backend commands must validate IPC input and security invariants themselves. See [Tauri best practices](docs/best-practices/TAURI_BEST_PRACTICES.md) and [Frontend best practices](docs/best-practices/FRONTEND_BEST_PRACTICES.md).

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| TS signals | `camelCase` + `set` prefix | `isLoading` / `setIsLoading` |
| CSS | UnoCSS utility classes | `class="flex items-center gap-2"` |
| Dates | `YYYY-MM-DD` string | `"2024-01-15"` |

### Menu Event Pattern

Rust emits → frontend listens (cross-layer coordination):
```
menu.rs:      app.emit("menu-navigate-previous-day", ())
shortcuts.ts: listen("menu-navigate-previous-day", handler)
```
All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list.

## Verification Commands

```bash
# Backend
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test <module>"

# Frontend
cmd.exe /c bun run test:run
cmd.exe /c bun run type-check

# E2E
cmd.exe /c bun run test:e2e:local
cmd.exe /c bun run test:e2e:local -- --skip-build

# Manual UI verification (agent, Windows-only)
# See .agents/skills/tauri-agent-dev/SKILL.md

# Diagrams
cmd.exe /c bun run diagrams:check       # Verification-only
cmd.exe /c bun run diagrams             # Regenerate all docs/diagrams/ SVGs

# Benchmarks
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo bench"
cmd.exe /c bun run bench
```

## Gotchas and Pitfalls

1. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for future secure search — do not remove them.

2. **JSON export format (breaking change in v0.5.0)**: JSON export now outputs an array under the `"entries"` key with each entry including its `id` field, instead of a date-keyed object. Example: `{ "entries": [{ "id": 1, "date": "2024-01-15", "title": "...", "text": "...", "word_count": 0, "date_created": "...", "date_updated": "..." }] }`.

3. **Skill sync requires plugin exclusion list**: Project skills live in `.agents/skills/` and are linked into `.claude/skills/` via `cmd.exe /c bun run sync-skills`. Skills already provided by a Claude Code plugin must be listed in `PLUGIN_SKILLS` inside `scripts/sync-skills.js` — otherwise duplicates appear and trigger ambiguity arises. **When installing a new plugin that ships skills, check its skill names and add them to that list.**

4. **Auto-lock fires from two independent paths** — any change to the lock/unlock flow must account for both:
   - **Frontend idle timer** (`App.tsx`): tracks user activity events (mousemove, keydown, click, scroll, touchstart). After `autoLockTimeout` seconds of inactivity, calls `lockJournal()`. Controlled by `autoLockEnabled` + `autoLockTimeout` preferences.
   - **Backend OS events** (`screen_lock.rs`): listens for OS-level session lock, logoff, or system suspend (Windows: `WM_WTSSESSION_CHANGE`, `WM_POWERBROADCAST`; macOS: screen-sleep and `com.apple.screenIsLocked` notifications). Immediately calls `auto_lock_diary_if_unlocked()` and emits `'journal-locked'` event. Fires even when the app is in the background.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks

See [Backend guide](src-tauri/CLAUDE.md) for the full auth architecture and per-command security requirements.

### Architecture decision records

- [`docs/decisions/2026-04-passwordless-journal.md`](docs/decisions/2026-04-passwordless-journal.md) — Local-only (passwordless) journals: why Option B-prime (device-bound key in `config.json`) shipped over Option C (OS keychain), threat model, and the migration path if keychain support is ever built.
- [`docs/decisions/2026-05-settings-storage-taxonomy.md`](docs/decisions/2026-05-settings-storage-taxonomy.md) — Settings storage taxonomy: decision flowchart for where each type of setting belongs (`localStorage` vs. `config.json` vs. `db_settings` vs. in-memory), full inventory of current settings, and why `require_all_auth` was migrated from `config.json` to `db_settings` in schema v6.

## Known Issues / Technical Debt

- **Frontend test coverage is still incomplete**: coverage has improved substantially, but `Calendar.tsx`, `Sidebar.tsx`, most overlays, and broader editor workflows still lack direct tests.
- **No Tauri integration tests**: All backend tests use direct DB connections, not the Tauri command layer.
- **No error boundary components**: Unhandled errors in components crash the app.

## Agent Workflow Rules

1. **Validate after each completed task.** Run the relevant test/type-check/lint command immediately after finishing a task, before moving to the next one. This catches bugs at the point of introduction and keeps diagnosis trivial.
2. **Format after changes.** Use `cmd.exe /c bun run format`. Prettier is configured for the full `src/` tree and only modifies files with style violations.
3. **Use `manual-planning` skill for any plan.** When asked to create a plan, roadmap, implementation checklist, or planning document, load the `manual-planning` skill and follow its template.
4. **Use `todo-manager` skill for TODO operations.** When adding, tracking, archiving, or validating TODO items in `docs/todo/TODO.md`, load the `todo-manager` skill. Never manually assign TODO IDs.

## Common Task Checklists

### Updating the App Logo / Icons

The source logo lives at `public/logo-transparent.svg` (1024×1024, dark background). It is used in two places:

**1. Frontend auth screens** — referenced as `/logo-transparent.svg` in:
- `src/components/auth/PasswordPrompt.tsx`
- `src/components/auth/PasswordCreation.tsx`

Replace the file and the change takes effect immediately on the next build.

**2. Tauri app icons** — all platform icon sizes in `src-tauri/icons/` are derived from the same SVG. Regenerate them with:
```bash
cmd.exe /c bun run tauri icon public/logo-transparent.svg
```
This overwrites every icon variant (ICO, ICNS, PNG at all sizes, Windows AppX, iOS, Android) in one command. Commit the updated `src-tauri/icons/` directory alongside any change to the source SVG.

### Updating Dependencies (npm/bun)

When bumping versions in `package.json`, two lockfiles must both be updated:

1. **`bun.lock`** — used by the dev workflow. Regenerate with:
   ```bash
   cmd.exe /c bun install
   ```

2. **`package-lock.json`** — required by Flathub's `flatpak-node-generator` to resolve npm dependencies at build time. Regenerate with:
   ```bash
   cmd.exe /c npm install --package-lock-only --legacy-peer-deps
   ```
   The `--legacy-peer-deps` flag is required because `eslint-plugin-solid` declares a peer of `eslint@^9` but the project uses `eslint@10`; bun resolves this silently, npm does not.

Both files are committed to the repo. Always commit them together after any `package.json` change.

### Creating a Release

See [docs/RELEASING.md](docs/RELEASING.md) for the full process. From this shell, route project commands through `cmd.exe /c ...`. Version bump script: `./bump-version.sh X.Y.Z`.

## Docs Maintenance

When behavior or conventions change:

1. Update the code first.
2. Update the most specific `CLAUDE.md` file that owns the domain.
3. Update the relevant file under `docs/best-practices/` when the change creates a durable frontend, Rust, Tauri, or CI rule.
4. Update this root `CLAUDE.md` only for cross-cutting, agent-relevant guidance.

`AGENTS.md` files are compatibility symlinks to sibling `CLAUDE.md` files. Do not edit them directly.
