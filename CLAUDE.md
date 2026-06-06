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

This repo is commonly worked on from a WSL shell over a Windows checkout. In that setup, the reliable path is the Windows toolchain, not the WSL one.

Operational rule for agents in this environment:

- Prefer `cmd.exe /c ...` for project commands unless you have explicitly verified a Linux-native setup.
- Do not start with bare `bun`, `vite`, `vitest`, or `tauri` from WSL in this repo. (`cargo` is fine bare — use `--manifest-path src-tauri/Cargo.toml` from the repo root.)
- For Rust commands under `src-tauri`, use `--manifest-path` to run from the repo root:
  - `cargo test --manifest-path src-tauri/Cargo.toml`
- Use repo-local Tauri CLI through `cmd.exe /c bun run tauri ...`; do not assume `cargo tauri` is globally installed.
- Treat generic shell snippets in docs as human-oriented unless they already say "Run from this Codex shell".

Commands verified to work from this shell via Windows:

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cmd.exe /c bun run test:e2e`
- `cmd.exe /c bun run tauri info`
- `cmd.exe /c bun run diagrams:check`
- `cmd.exe /c bun run validate:locales`

Commands with side effects:

- `bun run website:build-static` rewrites generated files under `website/` — use the **PowerShell tool** directly (not Bash + cmd.exe, which may return empty output for this command)
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
│              Signal-based state modules (src/state/ — one module per domain)              │
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

All Tauri commands are registered in `src-tauri/src/lib.rs` (`generate_handler![]`). Frontend wrappers with typed signatures live in `src/lib/tauri.ts`. Rust names use `snake_case`; wrappers use `camelCase`.

Command groups: `auth` (journal lifecycle, auth slots, multi-auth), `entries`, `files`, `search` (stub — see Gotcha #1), `nav`, `stats`, `export`, `plugin`, `debug`, `menu`, `fonts`, `tags`, `images`.

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
All menu event names are prefixed `menu-`. See `menu.rs` for the full list.

## Verification Commands

```bash
# Backend
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml <module>

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
cargo bench --manifest-path src-tauri/Cargo.toml
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
5. **Before implementing any plan step that configures a third-party extension, framework, or WebView behavior, open the installed source or relevant backend source to verify the step's assumptions.** If the source contradicts the plan, halt and surface the discrepancy before proceeding.
6. **Keep implementation commits scoped.** Each commit should contain one logical change. If a task touches unrelated files (e.g. an opportunistic refactor during a feature task), put those changes in a separate commit.
7. **Follow [`docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`](docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md) when editing any CLAUDE.md.** Prefer pointers over copies; update gotchas, security rules, and conventions when behavior changes; do not reintroduce file trees or command tables. Specific triggers:
   - New `data-testid` used by E2E tests → add to the canonical table in `src/CLAUDE.md`.
   - New schema migration → bump schema version description in `src-tauri/CLAUDE.md` Gotcha #1 and update the migration range comment.
   - New Tauri command group → add the group name to the Command Registry paragraph in root `CLAUDE.md`.

## Common Task Checklists

### Updating the App Logo / Icons

Use the `update-app-icons` skill. Source SVG: `public/logo-transparent.svg` (1024×1024).

### Updating Dependencies (npm/bun)

Use the `sync-lockfiles` skill. Both `bun.lock` and `package-lock.json` must be committed
together after any `package.json` change. Also refresh `npmDepsHash` in
[nix/package.nix](nix/package.nix) whenever `package-lock.json` changes — compute it with
`nix run nixpkgs#prefetch-npm-deps -- package-lock.json` (or copy the `got:` hash from a
failing `nix build .#default`).

### Creating a Release

See [docs/RELEASING.md](docs/RELEASING.md) for the full process. From this shell, route project commands through `cmd.exe /c ...`. Version bump script: `./bump-version.sh X.Y.Z`.

## Docs Maintenance

When behavior or conventions change:

1. Update the code first.
2. Update the most specific `CLAUDE.md` file that owns the domain.
3. Update the relevant file under `docs/best-practices/` when the change creates a durable frontend, Rust, Tauri, or CI rule.
4. Update this root `CLAUDE.md` only for cross-cutting, agent-relevant guidance.

`AGENTS.md` files are compatibility symlinks to sibling `CLAUDE.md` files. Do not edit them directly.
