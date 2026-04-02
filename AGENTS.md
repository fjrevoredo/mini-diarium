# AGENTS.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app built with SolidJS, Rust/Tauri v2, and SQLite. Diary entries are AES-256-GCM encrypted at rest; plaintext must never be written to disk.

**Core principles:** privacy-first, no network access, incremental development, clean architecture, TypeScript strict mode, and Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `docs/OPEN_TASKS.md` for structured roadmap items and `docs/TODO.md` for the working backlog.

## Domain Guides

For subsystem-specific conventions, use these as the detailed references:

- [Frontend (src/)](src/CLAUDE.md) — SolidJS state, i18n, TipTap, themes, testing, `data-testid` inventory
- [Backend (src-tauri/)](src-tauri/CLAUDE.md) — Tauri commands, auth architecture, plugins, search hook points, Rust patterns
- [E2E (e2e/)](e2e/CLAUDE.md) — WebdriverIO, tauri-driver, viewport rules, E2E mode contracts
- [Benchmarks (benchmarks/)](benchmarks/CLAUDE.md) — Criterion, Vitest bench, CI tracking

This file is the concise, cross-cutting guide for agents. The domain guides above carry most implementation detail.

## Architecture

**Visual diagrams:**

- [System context](docs/diagrams/context.mmd) - High-level local-only data flow
- [Unlock flow](docs/diagrams/unlock.mmd) - Password/key-file unlock through DB open, backup rotation, and unlocked session
- [Save-entry flow](docs/diagrams/save-entry.mmd) - Multi-entry editor persistence flow
- [Layered architecture](docs/diagrams/architecture.svg) - Presentation/state/backend/data layers

**Regenerate diagrams from this shell:**

```bash
cmd.exe /c bun run diagrams
```

Quick reference:

```text
Presentation (SolidJS components)
  -> State signals
  -> Tauri invoke()/listen()
  -> Rust backend commands/business logic
  -> Local files only: diary.db, config.json, backups/, plugins/
```

**Key relationships:**

- Entries are encrypted in SQLite. The `entries` table uses `id INTEGER PRIMARY KEY AUTOINCREMENT`, so multiple entries per date are supported.
- Search is intentionally stubbed. The old plaintext FTS table was removed; the interface remains in place for future secure search.
- Journals are tracked in `{app_data_dir}/config.json`. Each journal points to its own directory containing `diary.db`.
- `DiaryState` holds a single active connection. Switching journals updates `db_path` and `backups_dir`, then auto-locks the active session.
- Preferences are stored in `localStorage`, not via a Tauri store plugin.

## Execution Environment

This repo is commonly worked on from a WSL shell over a Windows checkout (`/mnt/d/Repos/mini-diarium` <-> `D:\Repos\mini-diarium`). In that setup, the reliable path is the Windows toolchain, not the WSL one.

**Operational rule for agents in this environment:**

- Prefer `cmd.exe /c ...` for project commands unless you have explicitly verified a Linux-native setup.
- Do not start with bare `bun`, `cargo`, `vite`, `vitest`, or `tauri` from WSL in this repo.
- For Rust commands under `src-tauri`, switch drives explicitly:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- Use repo-local Tauri CLI through `bun run tauri ...`; do not assume `cargo tauri` is globally installed.
- Treat generic shell snippets in docs as human-oriented unless they already say "Run from this Codex shell".

**Commands verified to work from this shell via Windows:**

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run build`
- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- `cmd.exe /c bun run test:e2e`
- `cmd.exe /c bun run tauri info`
- `cmd.exe /c bun run diagrams:check`

**Commands with side effects:**

- `cmd.exe /c bun run website:build-static` rewrites generated files under `website/`
- `cmd.exe /c bun run diagrams` regenerates SVG outputs

## Quick Reference

Most common agent tasks:

- Add a Tauri command: implement it in `src-tauri/src/commands/`, register it in `src-tauri/src/lib.rs`, add a typed wrapper in `src/lib/tauri.ts`
- Change frontend behavior: check `src/CLAUDE.md` first for SolidJS, i18n, and testing patterns
- Change backend behavior: check `src-tauri/CLAUDE.md` first for command patterns and security constraints
- Work on E2E or UI visibility defaults: audit `e2e/specs/` because the suite runs below the `lg` breakpoint
- Update diagrams: use `cmd.exe /c bun run diagrams:check` for verification-only, `cmd.exe /c bun run diagrams` to regenerate

## File Structure

High-level layout:

```text
website/     marketing site
src/         SolidJS frontend
e2e/         WebdriverIO + tauri-driver end-to-end tests
src-tauri/   Rust/Tauri backend
docs/        product, release, privacy, translation, diagram, and plugin docs
```

Notes:

- `website/` is plain HTML/CSS/JS and deploys via `website/docker-compose.yml`
- `src/state/session.ts` resets entries, search, and UI state on lock/session boundary
- `e2e/specs/` currently contains `diary-workflow.spec.ts` and `multi-entry.spec.ts`
- `src-tauri/src/commands/` includes auth, entries, files, search, navigation, stats, import, export, plugin, debug, and menu modules

## Command Registry

There are **51 registered Tauri commands** in `src-tauri/src/lib.rs`. Rust command names use `snake_case`; frontend wrappers in `src/lib/tauri.ts` use `camelCase`.

Current categories:

- Auth: journal creation/unlock/lock, password/keypair auth, journal management
- Entries: create/save/delete/list entry data and dates
- Files: `read_file_bytes`, `read_text_file`
- Search: `search_entries` stub preserved for future secure search
- Navigation: previous/next day, today, previous/next month
- Stats: aggregate statistics
- Import/Export: built-in formats plus plugin-based execution
- Plugin: list and run import/export plugins
- Debug/Menu: `generate_debug_dump`, `update_menu_locale`

Use the repo as source of truth:

- Command registration: `src-tauri/src/lib.rs`
- Typed wrappers: `src/lib/tauri.ts`

## State Management

Frontend state currently lives in seven signal modules under `src/state/`:

- `auth.ts`
- `entries.ts`
- `journals.ts`
- `search.ts`
- `session.ts`
- `ui.ts`
- `preferences.ts`

`Preferences` currently includes:

- `allowFutureEntries`
- `firstDayOfWeek`
- `hideTitles`
- `enableSpellcheck`
- `escAction`
- `autoLockEnabled`
- `autoLockTimeout`
- `advancedToolbar`
- `editorFontSize`
- `showEntryTimestamps`
- `language`

See `src/CLAUDE.md` for the full state inventory and testing patterns.

## Conventions

### SolidJS Reactivity

- Never destructure props
- Use `onMount` or `createResource` for async work, not top-level `await`
- Use `<Show>` and `<For>`, not ad hoc JS control-flow in JSX
- Wrap async handlers, for example `onClick={() => handleAsync()}`

### Backend Command Pattern

```rust
#[tauri::command]
pub fn my_command(arg: String, state: State<DiaryState>) -> Result<ReturnType, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Journal not unlocked")?;
    Ok(result)
}
```

All commands return `Result<T, String>`. Register new commands in both the command module tree and `generate_handler![]` in `src-tauri/src/lib.rs`.

### Error Handling

- Backend maps failures to `Result<T, String>`
- Frontend wraps `invoke()` calls with `try/catch`
- User-facing frontend errors should be sanitized through `mapTauriError()` from `src/lib/errors.ts`

### Naming

- Rust functions/variables: `snake_case`
- Rust types: `PascalCase`
- TypeScript functions/variables: `camelCase`
- Components: `PascalCase`
- Dates: `YYYY-MM-DD`

### Menu Events

Rust emits `menu-*` events and the frontend listens with `listen()` in `shortcuts.ts` or overlay components.

## Testing

Run from this Codex shell with the Windows toolchain:

```bash
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
cmd.exe /c bun run test:run
cmd.exe /c bun run test:e2e
```

Useful verification commands:

```bash
cmd.exe /c bun run dev
cmd.exe /c bun run tauri dev
cmd.exe /c bun run lint
cmd.exe /c bun run format:check
cmd.exe /c bun run type-check
cmd.exe /c bun run build
cmd.exe /c bun run test:e2e:local
cmd.exe /c bun run test:e2e:stateful
cmd.exe /c bun run diagrams:check
```

Current test shape:

- Backend tests live under `src-tauri` and cover auth, crypto, DB, import/export, plugin, and navigation behavior
- Frontend tests live under `src/` and include auth, editor, layout, i18n, markdown, theme, word count, and state/session coverage
- E2E currently uses two specs:
  - `e2e/specs/diary-workflow.spec.ts`
  - `e2e/specs/multi-entry.spec.ts`

**Key `data-testid` attributes used by E2E:**

- `password-create-input`
- `password-repeat-input`
- `create-journal-button`
- `password-unlock-input`
- `unlock-journal-button`
- `toggle-sidebar-button`
- `lock-journal-button`
- `title-input`
- `calendar-day-YYYY-MM-DD`
- `entry-nav-bar`
- `entry-prev-button`
- `entry-counter`
- `entry-next-button`
- `entry-delete-button`
- `entry-add-button`
- `journal-picker`
- `journal-open-button`

For the authoritative test-selector inventory and E2E rules, see `src/CLAUDE.md` and `e2e/CLAUDE.md`.

## Gotchas and Pitfalls

1. **No plaintext search index on disk:** `entries_fts` was removed because it stored plaintext. Search remains a stub by design.
2. **Search interface is preserved:** keep `search_entries`, `searchEntries`, `src/state/search.ts`, and the reserved search UI components even though search returns `[]`.
3. **Command registration has two parts:** add new commands to the module tree and `generate_handler![]`.
4. **Preferences live in `localStorage`:** not in a Tauri store plugin.
5. **TipTap stores HTML:** the entry `text` field is HTML, not Markdown.
6. **Auto-lock has two independent paths:** frontend idle timeout and backend OS lock/suspend handling both lock the journal.
7. **Plugin registry loads once at startup:** changing the journal directory does not reload plugins until app restart.
8. **Rhai export scripts must use `format_entries(entries)`:** `export` is a reserved keyword.
9. **Auth slots wrap one master key:** removing the last auth method is forbidden; changing password re-wraps the master key instead of re-encrypting entries.
10. **JSON export format changed in v0.5.0:** export is now `{ "entries": [...] }` with each entry carrying its `id`.
11. **Default E2E runs at 800x660:** this is below the `lg` breakpoint, so sidebar visibility defaults directly affect test reachability.
12. **UI visibility default changes require E2E review:** changing `isSidebarCollapsed`, overlay defaults, or session reset behavior can break the E2E suite.
13. **Raw Tauri errors should not be shown directly:** use `mapTauriError()` to avoid leaking paths, OS codes, or crypto internals.
14. **This shell is WSL over a Windows checkout:** WSL-native `bun`/Rust/Tauri commands may fail even when the Windows toolchain works.

## Security Rules

- Never log, print, or serialize passwords or encryption keys
- Never store plaintext diary content in any unencrypted form on disk
- Never send data over the network: no analytics, telemetry, or update checks
- All entry-accessing commands must reject locked state
- The master key is wrapped per auth slot; it is never stored in plaintext

See `src-tauri/CLAUDE.md` for the full auth and backend security details.

## Known Issues / Technical Debt

- Search is not implemented yet; the command remains a stub
- Frontend coverage is improved but still incomplete for some overlays and workflows
- There are no Tauri integration tests exercising the IPC layer directly
- The app still lacks frontend error boundary components
- Some non-critical SolidJS reactivity warnings remain in dev mode

See `docs/OPEN_TASKS.md`, `docs/TODO.md`, and `docs/KNOWN_ISSUES.md` for the living backlog.

## Common Task Checklists

### Updating the App Logo / Icons

The source logo is `public/logo-transparent.svg`.

- Frontend auth screens reference `/logo-transparent.svg`
- Tauri icons under `src-tauri/icons/` are generated from the same SVG

Regenerate icons from this shell with:

```bash
cmd.exe /c bun run tauri icon public/logo-transparent.svg
```

Commit the generated icon set together with the source SVG change.

### Adding a New Tauri Command

1. Implement it in the appropriate `src-tauri/src/commands/*.rs` module
2. Register it in `src-tauri/src/lib.rs`
3. Add the typed frontend wrapper in `src/lib/tauri.ts`

### Adding a New Import/Export Format

Built-in Rust formats:

1. Add the parser or formatter module under `src-tauri/src/import/` or `src-tauri/src/export/`
2. Add the command in `src-tauri/src/commands/import.rs` or `src-tauri/src/commands/export.rs`
3. Register the command in `src-tauri/src/lib.rs`
4. Add the frontend wrapper in `src/lib/tauri.ts`
5. Register the built-in plugin wrapper in `src-tauri/src/plugin/builtins.rs`

User-scriptable formats:

- Users can drop `.rhai` files into `{diary_dir}/plugins/`
- See `docs/user-plugins/USER_PLUGIN_GUIDE.md` and `src-tauri/CLAUDE.md`

### Implementing Search

Search was removed because SQLite FTS exposed plaintext. The interface remains so a secure design can be added later without breaking the frontend contract.

Before implementing search:

- preserve the existing command and frontend interfaces
- keep plaintext off disk
- add schema migration work
- wire updates into the `// Search index hook:` sites in backend code

The detailed design constraints and hook points live in `src-tauri/CLAUDE.md`.

### Creating a Release

See `docs/RELEASING.md` for the full process. From this shell, route project commands through `cmd.exe /c ...`.

## Docs Maintenance

When behavior or conventions change:

1. Update the code first
2. Update the most specific `CLAUDE.md` file that owns the domain
3. Update this root `AGENTS.md` only for cross-cutting, agent-relevant guidance

If `AGENTS.md` and `CLAUDE.md` disagree, treat the repo code as the source of truth and reconcile the docs.
