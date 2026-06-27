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
- Entries are stored encrypted in SQLite. Each entry has a unique integer `id` (PRIMARY KEY AUTOINCREMENT) and can have a unique date. Multiple entries per date are supported (schema v6). Full-text search is implemented as an in-memory scan over decrypted entries (`commands/search.rs`); the old plaintext `entries_fts` table was removed in schema v4.
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

All Tauri commands are registered in `src-tauri/src/lib.rs` (`generate_handler![]`). Frontend wrappers with typed signatures live in `src/lib/tauri/` (one sub-file per command category, re-exported from the barrel `index.ts`). Rust names use `snake_case`; wrappers use `camelCase`.

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

# Coverage — local mirror of Codecov's patch check (≥80% of new/changed lines vs origin/master)
cmd.exe /c bun run coverage:diff            # gate existing lcov files (see Gotcha #6)
cmd.exe /c bun run coverage:check           # generate coverage (--generate), then gate
cmd.exe /c bun run coverage:self-test       # parser self-test
# `bun run pre-commit` runs the gate too (step 9, --working-tree) after generating both lcov files.
```

## Gotchas and Pitfalls

1. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for search — do not remove them. Search is now wired into the app shell via `SearchOverlay.tsx` (triggered by the Header search button and Cmd/Ctrl+F); the backend decrypts entries in memory per query and never persists a plaintext index.

2. **JSON export format (breaking change in v0.5.0)**: JSON export now outputs an array under the `"entries"` key with each entry including its `id` field, instead of a date-keyed object. Example: `{ "entries": [{ "id": 1, "date": "2024-01-15", "title": "...", "text": "...", "word_count": 0, "date_created": "...", "date_updated": "..." }] }`.

3. **Skill sync requires plugin exclusion list**: Project skills live in `.agents/skills/` and are linked into `.claude/skills/` via `cmd.exe /c bun run sync-skills`. Skills already provided by a Claude Code plugin must be listed in `PLUGIN_SKILLS` inside `scripts/sync-skills.js` — otherwise duplicates appear and trigger ambiguity arises. **When installing a new plugin that ships skills, check its skill names and add them to that list.**
   Low-frequency manual workflows now live under the `runbooks` dispatcher. Mirror only `.agents/skills/runbooks` into `.claude/skills/runbooks`; its nested library entries load from `ENTRY.md` and are not mirrored as standalone top-level skills.

4. **Auto-lock fires from two independent paths** — any change to the lock/unlock flow must account for both:
   - **Frontend idle timer** (`App.tsx`): tracks user activity events (mousemove, keydown, click, scroll, touchstart). After `autoLockTimeout` seconds of inactivity, calls `lockJournal()`. Controlled by `autoLockEnabled` + `autoLockTimeout` preferences.
   - **Backend OS events** (`screen_lock.rs`): listens for OS-level session lock, logoff, or system suspend (Windows: `WM_WTSSESSION_CHANGE`, `WM_POWERBROADCAST`; macOS: screen-sleep and `com.apple.screenIsLocked` notifications). Immediately calls `auto_lock_diary_if_unlocked()` and emits `'journal-locked'` event. Fires even when the app is in the background.

5. **SonarCloud quality gate failure — read the API, don't guess**: When the "SonarCloud Code Analysis" check fails on a PR, the PR comment gives only a summary. To find which files are responsible, use the public API directly — no login required:

   ```bash
   # Which condition failed and by how much
   curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=fjrevoredo_mini-diarium&pullRequest=<PR>" | jq .

   # Per-file breakdown (replace metric key as needed: new_duplicated_lines_density, new_coverage, etc.)
   curl -s "https://sonarcloud.io/api/measures/component_tree?component=fjrevoredo_mini-diarium&pullRequest=<PR>&metricKeys=new_duplicated_lines_density,new_duplicated_lines&strategy=leaves&ps=50" | jq '.components[] | select(.measures[].value != "0.0") | {name: .name, measures: .measures}'
   ```

   Common failures and their usual causes:
   - **`new_duplicated_lines_density` > 3%**: copy-pasted test helpers or fixture objects — extract to a shared constant/function in the same file.
   - **`new_coverage` < threshold**: new logic in a file that `generatePdfFromElement`-style functions (html2canvas/jsPDF) can't be tested in JSDOM — mock the module boundary instead.

6. **Codecov patch check — mirror it locally before pushing**: CI uploads `coverage/lcov.info` (frontend) and `src-tauri/lcov.info` (backend) to Codecov, which enforces `patch ≥ 80%` (new/changed lines) and `project: auto` (no total regression) per `codecov.yml`. The Vitest thresholds in `vitest.config.ts` are a coarse frontend-only global floor and do **not** catch patch/project failures — you can pass locally and still fail Codecov. Run the local mirror: `cmd.exe /c bun run coverage:diff` (`scripts/check-diff-coverage.mjs`) consumes the same lcov files + `git diff origin/master`, fails below 80%, and lists every uncovered new line as `file:line`. This mirrors the **patch** check (the most common CI failure); the **project** total-regression check needs a base-branch coverage baseline and is not replicated locally. The gate now also runs as step 9 of `bun run pre-commit` (via `--working-tree`, so it checks not-yet-committed changes against `origin/master`); that run generates both lcov files by running the frontend/backend tests with coverage. Frontend lcov comes from `bun run test:coverage`; backend lcov requires `cargo-llvm-cov` + `cargo-nextest` (`cargo install cargo-llvm-cov cargo-nextest --locked`) via `cargo llvm-cov nextest --lcov --output-path lcov.info` from `src-tauri/`. Flags: `--generate` (run both), `--base <ref>`, `--fail-under <pct>`, `--no-fail`, `--frontend`/`--backend`. See [CI Best Practices → Coverage Gating](docs/best-practices/CI_BEST_PRACTICES.md#coverage-gating).

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

1. **Validate after each completed task.** Run the relevant test/type-check/lint command immediately after finishing a task, before moving to the next one. This catches bugs at the point of introduction and keeps diagnosis trivial.
2. **Format after changes.** A Git pre-commit hook (`.githooks/pre-commit`, installed automatically by `bun install` via the `postinstall` lifecycle) runs Prettier on staged `src/**/*.{ts,tsx,css}` files and `cargo fmt` on staged `src-tauri/**/*.rs` files before every commit, so style violations never reach the repository. Manual `cmd.exe /c bun run format` is still available for full-tree sweeps after refactors. Bypass the hook with `git commit --no-verify` when needed.
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

## Docs Maintenance

When behavior or conventions change:

1. Update the code first.
2. Update the most specific `CLAUDE.md` file that owns the domain.
3. Update the relevant file under `docs/best-practices/` when the change creates a durable frontend, Rust, Tauri, or CI rule.
4. Update this root `CLAUDE.md` only for cross-cutting, agent-relevant guidance.

`AGENTS.md` files are compatibility symlinks to sibling `CLAUDE.md` files. Do not edit them directly.
