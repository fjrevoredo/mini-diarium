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
- [Best practices](docs/best-practices/README.md) — durable frontend, Rust, Tauri, CI, and agent-hook rules for code quality and regression diagnosis

## Execution Environment

This repo is commonly worked on from a WSL shell over a Windows checkout. In that setup, the reliable path is the Windows toolchain, not the WSL one.

Operational rule for agents in this environment:

- Prefer `cmd.exe /c ...` for project commands unless you have explicitly verified a Linux-native setup.
- Do not start with bare `bun`, `vite`, `vitest`, or `tauri` from WSL in this repo. (`cargo` is fine bare.)
- **Workspace layout:** the backend is a Cargo **workspace** (root `Cargo.toml`) with three members, layered bottom-up: (1) `crates/mini-diarium-crypto/` (`mini-diarium-crypto`: the `rusqlite`-free cryptographic base — cipher/password-hashing/master-key-wrapping); (2) `crates/mini-diarium-core/` (`mini-diarium-core`: the Tauri-free SQLite business layer — db/import/export/plugin/backup/config/search — which **depends on and re-exports** `crypto`/`auth` from the crypto crate); (3) the app crate at `src-tauri/` (`mini-diarium`: `commands/*`, OS shell), which depends on core. `Cargo.lock` and `target/` live at the repo root.
- For Rust commands, run `cargo` bare from the repo root. `--manifest-path src-tauri/Cargo.toml` targets **only the app crate**; `--workspace` targets **all three crates** (required for "run all backend tests" — without it the core and crypto module tests silently stop running):
  - `cargo test --workspace` — all backend tests (all three crates)
  - `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml` — core crate only
  - `cargo test --manifest-path crates/mini-diarium-crypto/Cargo.toml` — crypto crate only
  - `cargo test --manifest-path src-tauri/Cargo.toml` — app crate only
- Use repo-local Tauri CLI through `cmd.exe /c bun run tauri ...`; do not assume `cargo tauri` is globally installed.
- Treat generic shell snippets in docs as human-oriented unless they already say "Run from this Codex shell".
- **Git Bash/MSYS caveat:** if the agent's Bash tool is Git Bash/MSYS (not PowerShell or WSL), `cmd.exe /c "..."` silently no-ops — MSYS path-conversion rewrites the literal `/c` argument into a Windows path before `cmd.exe` sees it, so the command never runs and `cmd.exe` just prints its banner and exits 0. That is a false pass indistinguishable from a silently-successful tool. Use `MSYS_NO_PATHCONV=1 cmd.exe /c "..."`, or run the verified commands below from the PowerShell tool instead.

Commands verified to work from this shell via Windows:

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run`
- `cmd.exe /c bun run build`
- `cargo test --workspace`
- `cmd.exe /c bun run test:e2e`
- `cmd.exe /c bun run tauri info`
- `cmd.exe /c bun run diagrams:check`
- `cmd.exe /c bun run validate:locales`

Commands with side effects:

- `bun run website:build-static` rewrites generated files under `website/` — use the **PowerShell tool** directly (not Bash + cmd.exe, which may return empty output for this command). The run is byte-reproducible across platforms and rewrites nothing when no source changed; the one exception is `website/sitemap.xml`, whose `lastmod` stamps are set to the current date by the generators
- `cmd.exe /c bun run diagrams` regenerates SVG outputs

## Architecture

**Visual diagrams**:
- [System context](docs/diagrams/context.mmd) - High-level local-only data flow (Mermaid)
- [Unlock flow](docs/diagrams/unlock.mmd) - Password/key-file unlock flow through DB open, backup rotation, and unlocked session (Mermaid)
- [Save-entry flow](docs/diagrams/save-entry.mmd) - Multi-entry editor persistence flow with create/save/delete and date refresh (Mermaid)
- [Layered architecture](docs/diagrams/architecture.svg) - Presentation/state/backend/data layers including journals, config, and plugins (D2)

**Regenerate diagrams:** `cmd.exe /c bun run diagrams` — regenerates all `docs/diagrams/` SVGs; `.mmd` sources via mmdc, `.d2` sources via d2.

**Key relationships:**
- Entries are stored encrypted in SQLite. Each entry has a unique integer `id` (PRIMARY KEY AUTOINCREMENT) and can have a unique date. Multiple entries per date are supported (schema v6). Full-text search is implemented as an in-memory scan over decrypted entries — the scan core lives in `crates/mini-diarium-core/src/search/` (`search_entries` in `mod.rs`; the DB-free matching/snippet helpers in `text.rs`), with a thin `commands/search.rs` Tauri wrapper; the old plaintext `entries_fts` table was removed in schema v4.
- Menu events flow: Rust `app.emit("menu-*")` → frontend `listen()` in `MainLayout.tsx` or overlay components. Since TODO-0065 the native menu holds only Preferences + Quit, so `menu-preferences` is the sole event; all other app shortcuts are JS `keydown` handlers in `src/lib/keyboard-shortcuts.ts`.
- Preferences use `localStorage` (not Tauri store plugin).
- Multiple journals are tracked in `{app_data_dir}/config.json` via `JournalConfig` entries. Each journal maps to a directory containing its own `diary.db`. `DiaryState` holds a single connection; switching journals updates `db_path`/`backups_dir` and auto-locks. Legacy single-diary configs are auto-migrated on first `load_journals()` call.

## Website (`website/`)

Static marketing site — plain HTML/CSS/JS. Deploy via Coolify using `website/docker-compose.yml`.
**Version sync:** `bump-version.sh` updates `<span class="app-version">` in `website/index.html`. Always commit it alongside version files.
**Blog posts:** Write `posts-src/YYYY-MM-DD-slug.md`, then run `cmd.exe /c bun run website:blog`. Never hand-craft HTML in `blog/`. See [website/CLAUDE.md](website/CLAUDE.md) for the full workflow.
**Docs pages:** Edit `docs-src/NN-slug.md`, then run `cmd.exe /c bun run website:build-static`. Never hand-craft HTML in `docs/` — all files there are generated output.
**Docs are the authoritative user reference:** `website/docs-src/` is the primary source of truth for how every user-facing feature works — for both users and agents auditing feature behavior. After adding, changing, or removing any user-facing feature, update the relevant `docs-src/` file in the same task. Stale docs are a bug.
**SEO/GEO + growth:** strategy, keyword map, status, action plan, and growth/distribution material live in `docs/seo/` (start at [docs/seo/README.md](docs/seo/README.md)).

## Command Registry

All Tauri commands are registered in `src-tauri/src/lib.rs` (`generate_handler![]`). The command handlers live in the app crate (`src-tauri/src/commands/*`) and delegate to the Tauri-free business layer in the `mini-diarium-core` crate (`crates/mini-diarium-core/`); `lib.rs` re-exports the core modules (`pub use mini_diarium_core::{auth, backup, config, crypto, db, export, import, plugin, search};`) so `crate::db::…`-style paths in commands resolve. As of open-core **M2 (TODO-0077)** the commands reach core only through its **curated façade** — each module root re-exports the stable API and seals its internals (`db::queries`/`db::schema` and the `auth`/`export`/`import`/`plugin` sub-modules are `pub(crate)`; `DatabaseConnection::conn()`/`key()` never leave the crate). The contract is [`crates/mini-diarium-core/API.md`](crates/mini-diarium-core/API.md). Frontend wrappers with typed signatures live in `src/lib/tauri/` (one sub-file per command category, re-exported from the barrel `index.ts`). Rust names use `snake_case`; wrappers use `camelCase`.

Command groups: `auth` (journal lifecycle, auth slots, multi-auth), `entries`, `files`, `search` (stub — see Gotcha #1), `nav`, `stats`, `export`, `plugin`, `backup` (snapshot listing, health, manual snapshot, verify/delete, reveal folder, plus read-only snapshot inspection in `commands/backup_inspect.rs`), `debug`, `menu`, `spellcheck`, `fonts`, `tags`, `images`.

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
menu.rs:        app.emit("menu-preferences", ())
MainLayout.tsx: listen("menu-preferences", handler)
```
Menu event names are prefixed `menu-`. TODO-0065 reduced the native menu to Preferences + Quit, so this is now the **only** such event; keyboard shortcuts other than `CmdOrCtrl+,` are JS `keydown` handlers in `src/lib/keyboard-shortcuts.ts`, not OS accelerators.

## Verification Commands

For the per-task completion checklist (scope assessment, tests, type-check, formatting, CHANGELOG, TODO, summary template), see [Post-Task Completion Best Practices](docs/best-practices/POST_TASK_BEST_PRACTICES.md). The commands below cover broader verification needs not specific to a single task.

```bash
# Manual UI verification (agent, Windows-only)
# See .agents/skills/tauri-agent-dev/SKILL.md

# Diagrams
cmd.exe /c bun run diagrams:check       # Verification-only
cmd.exe /c bun run diagrams             # Regenerate all docs/diagrams/ SVGs

# Coverage — local mirror of Codecov's patch check (≥80% of new/changed lines vs origin/master)
cmd.exe /c bun run coverage:diff            # gate existing lcov files (see Gotcha #6)
cmd.exe /c bun run coverage:check           # generate coverage (--generate), then gate
cmd.exe /c bun run coverage:self-test       # parser self-test
# `bun run pre-commit` runs the gate too (step 9, --working-tree) after generating both lcov files.
```

## Gotchas and Pitfalls

1. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for search — do not remove them. Search is now wired into the app shell via `SearchOverlay.tsx` (triggered by the Header search button and Cmd/Ctrl+F); the backend decrypts entries in memory per query and never persists a plaintext index.

2. **JSON export format (breaking change in v0.5.0)**: JSON export now outputs an array under the `"entries"` key with each entry including its `id` field, instead of a date-keyed object. Example: `{ "entries": [{ "id": 1, "date": "2024-01-15", "title": "...", "text": "...", "word_count": 0, "date_created": "...", "date_updated": "..." }] }`.

3. **`.claude/skills/` and `.pi/skills/` are generated mirrors — never edit or commit them**: Canonical skill sources live in `.agents/skills/`. Both mirrors are gitignored and regenerated as links by `cmd.exe /c bun run sync-skills` (auto-run by `bun install` via postinstall); `.pi/skills/` receives the full set (the pi runtime has no plugin system, so `PLUGIN_SKILLS` exclusion applies only to `.claude/skills/`). If a mirror entry exists as a real directory (e.g. materialized by an old checkout), sync repairs it into a link when contents match the canonical source and **fails loudly with a `DRIFT` error** when they differ — reconcile into `.agents/skills/`, delete the `.claude` copy, and re-run. Skills already provided by a Claude Code plugin must be listed in `PLUGIN_SKILLS` inside `scripts/sync-skills.js` — otherwise duplicates appear and trigger ambiguity arises. **When installing a new plugin that ships skills, check its skill names and add them to that list.**
   Low-frequency manual workflows live under the `runbooks` dispatcher (`.agents/skills/runbooks`); its nested library entries load from `ENTRY.md` and are not top-level skills.

4. **Auto-lock fires from three independent paths** — any change to the lock/unlock flow must account for all three. See the `security-stance` skill (Section 6) for full detail on event names, the dialog-guard, and platform specifics:
   - **Frontend idle timer** (`App.tsx`): user-activity-based, controlled by `autoLockEnabled`/`autoLockTimeout`.
   - **Backend OS events** (`screen_lock.rs`): OS session lock/logoff/suspend; fires even while the app is in the background.
   - **Frontend focus-loss lock** (`src/lib/focus-lock.ts` + `src-tauri/src/window_focus.rs`): debounced lock (`FOCUS_LOSS_DEBOUNCE_MS`, default 3s) on OS-level focus loss (minimize, alt-tab, Cmd+H), controlled by `autoLockOnFocusLoss`. Any code that opens a native dialog must import `open`/`save`/`confirm` from `src/lib/dialog.ts`, never `@tauri-apps/plugin-dialog` directly — see `src/CLAUDE.md` gotcha #10.

5. **SonarCloud PR comments only summarize — they never name the offending files.** When the "SonarCloud Code Analysis" check fails, query the public SonarCloud API for the per-file breakdown instead of guessing. Recipes: `ci-gate-diagnosis` skill.

6. **Codecov patch check — the Vitest thresholds in `vitest.config.ts` do NOT catch it**: they are a coarse frontend-only global floor, so you can pass locally and still fail Codecov's `patch ≥ 80%` on new/changed lines. Mirror the gate before pushing with `cmd.exe /c bun run coverage:diff` (also step 9 of `bun run pre-commit`). Full mechanics, lcov generation, and flags: `ci-gate-diagnosis` skill.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks

See [Backend guide](src-tauri/CLAUDE.md) for the full auth architecture and per-command security requirements.

### Architecture decision records

- [`docs/decisions/2026-04-passwordless-journal.md`](docs/decisions/2026-04-passwordless-journal.md) — Local-only (passwordless) journals: why Option B-prime (device-bound key in `config.json`) shipped over Option C (OS keychain), threat model, and the migration path if keychain support is ever built.
- [`docs/decisions/2026-05-settings-storage-taxonomy.md`](docs/decisions/2026-05-settings-storage-taxonomy.md) — Settings storage taxonomy: decision flowchart for where each type of setting belongs (`localStorage` vs. `config.json` vs. `db_settings` vs. in-memory), full inventory of current settings, and why `require_all_auth` was migrated from `config.json` to `db_settings` in schema v6.
- [`docs/decisions/2026-06-feature-flags.md`](docs/decisions/2026-06-feature-flags.md) — Feature flag strategy: two-tier model (build-time `experimental` Cargo feature + `VITE_EXPERIMENTAL` Vite define vs. deferred runtime opt-in), why Tier 2 is not built speculatively, worked example with `search_entries`, and the `generate_handler!` inner-attribute discovery.

## Known Issues / Technical Debt

- **Frontend test coverage is still incomplete**: coverage has improved substantially, but `Calendar.tsx`, `Sidebar.tsx`, most overlays, and broader editor workflows still lack direct tests.
- **No Tauri integration tests**: All backend tests use direct DB connections, not the Tauri command layer.
- **No error boundary components**: Unhandled errors in components crash the app.

## Agent Workflow Rules

1. **Complete every task with the post-task checklist.** Run the [post-task completion checklist](docs/best-practices/POST_TASK_BEST_PRACTICES.md) — tests green, formatting clean, CHANGELOG entry, originating TODO closed — before reporting a task as done, and present the result using its summary template. Catches bugs at the point of introduction and keeps diagnosis trivial.
2. **Format after changes.** A Git pre-commit hook (`.githooks/pre-commit`, installed automatically by `bun install` via the `postinstall` lifecycle) runs Prettier on staged `src/**/*.{ts,tsx,css}` files and `cargo fmt` on staged `src-tauri/**/*.rs` files before every commit, so style violations never reach the repository. Manual `cmd.exe /c bun run format` is still available for full-tree sweeps after refactors. Bypass the hook with `git commit --no-verify` when needed. Note: the git hook **formats staged files only** — the full quality gate is the separate manual command `bun run pre-commit` (its steps also run in CI); it is not wired to `git commit` despite the shared name.
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

Use `$runbooks update-app-icons` in Codex or `/runbooks update-app-icons` in Claude Code. Source SVG: `public/logo-transparent.svg` (1024×1024).

### Updating Dependencies (npm/bun)

Use the `sync-lockfiles` skill. Both `bun.lock` and `package-lock.json` must be committed
together after any `package.json` change. Also refresh `npmDepsHash` in
[nix/package.nix](nix/package.nix) whenever `package-lock.json` changes — compute it with
`nix run nixpkgs#prefetch-npm-deps -- package-lock.json` (or copy the `got:` hash from a
failing `nix build .#default`).
For applying GitHub dependency PRs, use `$runbooks apply-dependency-prs` in Codex or `/runbooks apply-dependency-prs` in Claude Code.

### Creating a Release

Use `$runbooks pre-release` in Codex or `/runbooks pre-release` in Claude Code, then follow [docs/RELEASING.md](docs/RELEASING.md) for the full process. From this shell, route project commands through `cmd.exe /c ...`. Version bump script: `./bump-version.sh X.Y.Z`.

**Distribution channels** on each tagged release: GitHub Releases (installers) plus WinGet, Homebrew, Flathub, and the **Microsoft Store** (MSIX, Store-signed). The Store pipeline lives in [`msix/`](msix/README.md) + [`scripts/build-msix.ps1`](scripts/build-msix.ps1) + [`.github/workflows/msstore-publish.yml`](.github/workflows/msstore-publish.yml); the first Store submission is manual, updates are CI-dispatched (non-blocking) from `release.yml`. See [docs/RELEASING.md](docs/RELEASING.md) → "Microsoft Store (MSIX)".

## Docs Maintenance

When behavior or conventions change:

1. Update the code first.
2. Update the most specific `CLAUDE.md` file that owns the domain.
3. Update the relevant file under `docs/best-practices/` when the change creates a durable frontend, Rust, Tauri, or CI rule.
4. Update this root `CLAUDE.md` only for cross-cutting, agent-relevant guidance.

`AGENTS.md` files are compatibility symlinks to sibling `CLAUDE.md` files. Do not edit them directly.
