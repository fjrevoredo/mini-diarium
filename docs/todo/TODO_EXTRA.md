# TODO Extra Detail

Implementation detail and structured notes for specific TODO items in [`TODO.md`](TODO.md). Each section uses a `TODO-XXXX-YY` ID linking back to its parent TODO entry (e.g. `TODO-0011-01` belongs to `TODO-0011`). Items without a parent TODO are not retained in this file.

---

## TODO-0050-01: Skill and CI updates for Nix npmDepsHash maintenance

Parent: [`TODO-0050: Update dep-update skills for Nix npmDepsHash step`](TODO.md)

**Context**: PR #159 added a Nix flake (`flake.nix`, `nix/package.nix`). The `npmDepsHash` field in the `frontend = buildNpmPackage { ... }` block of `nix/package.nix` is a SHA-256 hash of the npm dependency tree. It must be kept in sync with `package-lock.json` or `nix build .#default` fails with a hash mismatch. This can only be done on Linux with Nix installed — not from the Windows/WSL environment this project normally uses.

**Refresh command** (Linux+Nix only):
```bash
nix run nixpkgs#prefetch-npm-deps -- package-lock.json
# Or: copy the "got:" hash from the error output of a failing nix build .#default
```

---

### Part 1 — Update `sync-lockfiles` skill

File: `.agents/skills/sync-lockfiles/SKILL.md`

Add `nix/package.nix` as a fourth row to the lockfiles table:

| File | Used by |
|------|---------|
| `bun.lock` | Dev workflow |
| `package-lock.json` | Flathub `flatpak-node-generator` (offline Linux build) |
| `nix/package.nix` (`npmDepsHash`) | Nix flake build — Linux+Nix required to refresh |

Add a step 4 after the existing steps:

> **4. Refresh `npmDepsHash` in `nix/package.nix`** (Linux+Nix only): run `nix run nixpkgs#prefetch-npm-deps -- package-lock.json` and update the hash in the `frontend = buildNpmPackage { ... }` block. If working on Windows/WSL, note in the commit message that the Nix hash needs a follow-up from a Linux environment.

Add to the Gotcha section:

> If `package-lock.json` changes and `npmDepsHash` is not updated, `nix build .#default` will fail with a hash mismatch. This step cannot be done from Windows/WSL.

---

### Part 2 — Update `apply-dependency-prs` skill

File: `.agents/skills/runbooks/skills/apply-dependency-prs/procedures/npm.md`

**Status (2026-06-29):** Completed during the runbook refactor that moved the
npm procedure into `procedures/npm.md` (see
`docs/apply-dependency-prs-refactor-plan.md`). The three changes below were
applied to that file in the same commit.

**Phase 3 — add step after `npm install`:**

> **4. Refresh `npmDepsHash` in `nix/package.nix`** (Linux+Nix only): run `nix run nixpkgs#prefetch-npm-deps -- package-lock.json` and update the `npmDepsHash` field in the `frontend = buildNpmPackage { ... }` block. If in a Windows/WSL environment, skip and note in the commit message that the hash needs a Linux follow-up.

**Phase 4 Step 3 — change the file count assertion:**

Old: "Should show exactly three files: `package.json`, `bun.lock`, and `package-lock.json`."

New: "Should show 3 or 4 files: `package.json`, `bun.lock`, `package-lock.json`, and optionally `nix/package.nix` if the Nix hash was refreshed. Investigate any other additional files."

**Gotchas section — add:**

> **`npmDepsHash` in `nix/package.nix` must be refreshed on Linux.** Whenever `package-lock.json` changes, the `npmDepsHash` field in `nix/package.nix` (inside the `frontend = buildNpmPackage { ... }` block) must also be updated or the Nix build breaks. This requires Linux+Nix — it cannot be done from Windows/WSL. If operating on Windows, note the omission in the commit message so a Linux-capable maintainer can follow up.

---

### Part 3 — CI (optional but recommended)

Add a path-filtered GitHub Actions job that only runs when `package-lock.json` or `nix/package.nix` changes. This catches stale hashes from human contributors who bypass the skills.

Suggested workflow addition to `.github/workflows/ci.yml` or a new `nix.yml`:

```yaml
nix-build:
  name: Nix build check
  runs-on: ubuntu-latest
  if: github.event_name == 'push' || github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - uses: cachix/install-nix-action@v27
      with:
        nix_path: nixpkgs=channel:nixos-unstable
    - name: Check flake and build
      run: nix build .#default --no-link
```

Add a path filter so it only triggers on:
- `package-lock.json`
- `nix/**`
- `flake.nix`
- `flake.lock`

Without a Cachix cache, this job will be slow (10–20 min) on first run. Consider adding `cachix/cachix-action` if build times become a problem. `nix flake check` alone is not sufficient — it evaluates the flake but does not verify the `npmDepsHash` against the actual deps.

---

## TODO-0038-01: Legacy `require_all_auth` Config Removal

Parent: [`TODO-0038: Remove legacy require_all_auth config migration`](TODO.md)

**Approval gate**: requires maintainer sign-off on the release boundary before any code is deleted. Do not execute this task speculatively.

**Background**: the `require_all_auth` setting was migrated from `config.json` (`JournalConfig.require_all_auth`) to `db_settings` in schema v6 (2026-05-settings-storage-taxonomy decision). The live DB-settings-backed path already works. The legacy config field and its migration function (`migrate_require_all_auth_to_db`) are kept until the release boundary is confirmed so users upgrading from older versions are not stranded.

**Steps**:

1. Get maintainer approval for the exact release boundary (which version this ships in) and the CHANGELOG wording.
2. **Red**: add a regression test that loads a legacy `config.json` containing `require_all_auth: true`, performs an unlock, and asserts the value was migrated to `db_settings` — confirm this test passes *before* any deletion.
3. Remove `JournalConfig.require_all_auth` and `JournalInfo.require_all_auth` from the Rust structs.
4. Remove `set_journal_require_all_auth` and its call sites.
5. Remove `migrate_require_all_auth_to_db` and its call sites (check all open paths in `schema/open.rs`).
6. Remove the corresponding frontend type field from `src/lib/tauri.ts` and any reference in `JournalPicker.test.tsx`.
7. Remove the temporary regression test from step 2 only if it is no longer meaningful after deletion; keep any replacement test that validates the DB-backed policy.
8. Update CHANGELOG with the cleanup note.

**Validation**:
```
cargo test auth
bun run test:run
bun run type-check
```

---

## TODO-0011-01: Deferred — Per-post OG Images (P4-F)

Parent: [`TODO-0011: Website SEO/GEO follow-up backlog`](TODO.md)

**Reference**: [`docs/seo-geo-implementation-plan.md`](../seo-geo-implementation-plan.md) — Task 4.4

Unique per-post OG images would require a design step and an image generation pipeline not present in the current static site. Out of scope for the current static website architecture.

---

## TODO-0012-01: PDF Export

Parent: [`TODO-0012: PDF export`](TODO.md)

**Priority**: Low | **Complexity**: High | **File**: `src-tauri/src/export/pdf.rs`

Export journal entries as PDF (A4 page size).

**Requirements**:
- Convert: HTML → PDF (entries are stored as HTML via TipTap)
- Library options: chromiumoxide or Tauri webview printing
- Command: `export_pdf()` in `src-tauri/src/commands/export.rs`
- UI: Add to ExportOverlay dropdown
- Menu: Include in Export menu

**Dependencies**: JSON/Markdown export (Tasks 40-41) ✅ Complete

**Testing**: Manual only (PDF generation hard to test automatically)

**Rationale for deferral**: Complex implementation, low user priority for v0.1.0

---

## TODO-0013-01: Text Input Extension Point

Parent: [`TODO-0013: Text input extension point`](TODO.md)

**Priority**: Medium | **Complexity**: High | **Files**: TBD (see `docs/text-input-extension-design.md`)

Allow users to augment text entry with pluggable text-generation sources: LLM endpoints (Ollama, OpenAI-compatible APIs), dictation (Web Speech API), and custom Rhai scripts.

**Design**: Fully documented in [`docs/text-input-extension-design.md`](../text-input-extension-design.md). Two-tier architecture: Tier 1 (Rhai scripts via existing plugin system, `@type: text-input`), Tier 2 (frontend JS built-ins for LLM endpoint + dictation).

**Deferred because**: Too large for current release; design work preserved for future implementation.

**Privacy constraints**: All network calls are opt-in and user-configured; no implicit telemetry; LLM endpoint URL/key stored only in `localStorage` preferences.

**Key requirements**:
- Rhai tier: `fn generate(prompt)` / `fn generate(prompt, context)` → string; opt-in `@permissions: read-context`
- Built-in LLM tier: OpenAI-compatible HTTP POST to user-specified URL; supports Ollama and cloud APIs
- Built-in dictation tier: Web Speech API (no network)
- UI: Toolbar button in EditorToolbar → TextInputOverlay; Preferences section for LLM config
- 2 new Tauri commands: `list_text_input_plugins`, `run_text_input_plugin`

**Testing**: Rhai unit tests; frontend overlay tests; LLM tier mock tests; dictation manual-only

---

## TODO-0058-01: Pre-commit hook design

Parent: [`TODO-0058: Pre-commit hook for frontend and backend formatting`](TODO.md)

**File layout**

- `.githooks/pre-commit` — bash hook, executable. Activated by `core.hooksPath .githooks` (set by the install script).
- `scripts/install-hooks.js` — idempotent installer (no-op on CI or non-git context). Exposes a pure `computeInstallActions({ isCI, hasGitDir, hasHookFile, platform })` helper for tests.
- `scripts/install-hooks.test.js` — `node:test` unit tests for `computeInstallActions`.
- `package.json` — `postinstall` runs the installer; `hooks:install` is the manual escape hatch.

**Hook behavior** (`.githooks/pre-commit`)

- Reads staged paths via `git diff --cached --name-only --diff-filter=ACMR` (added, copied, modified, renamed — not deleted).
- **Frontend**: filters to `src/.*\.(ts|tsx|css)$`, runs `bunx prettier --write <files>`, then `git add <files>`.
- **Backend**: filters to `src-tauri/.*\.rs$`. When any match, runs `(cd src-tauri && cargo fmt)` and re-stages the Rust files. Cargo is invoked with `command -v` guard; missing cargo prints a warning to stderr and skips (commit still succeeds).
- Skips silently when no relevant files are staged.
- Always exits 0 on success; formatting failures propagate via `set -e`.

**Scoped-to-staged decision**

Prettier operates on working-tree files (not the staged blob) and re-stages via `git add`. If a file has both staged and unstaged changes, Prettier may format the entire file and the unstaged changes appear in the re-staged diff. This matches the behavior of husky/lefthook and is acceptable: the dev sees the diff before the commit completes. Stashing the unstaged changes was rejected as too complex for the speed budget.

**Cargo fmt scope**

`cargo fmt` formats the entire `src-tauri/` crate, even when only one staged file triggers it. Stable `cargo fmt -- <file>` is a no-op, so partial-scope formatting is not achievable without nightly. Whole-crate format takes ~1-2s and is acceptable.

**Auto-install via postinstall**

`scripts/install-hooks.js` runs on every `bun install` via `package.json#postinstall`. It sets `git config core.hooksPath .githooks` (writes to per-clone `.git/config`) and chmods the hook to `0o755` on non-Windows. CI is detected via `process.env.CI === 'true'` and skips all side effects; missing `.git` directory is detected via `existsSync('.git')` and skips too. Manual reinstall: `bun run hooks:install`.

**Bypass**

`git commit --no-verify` skips the hook for a single commit (standard Git behavior). Documented in `CLAUDE.md`, `CONTRIBUTING.md`, and `scripts/README.md`.

**Cross-platform**

The hook is a bash script. Git for Windows bundles bash and uses it for hook execution regardless of the developer's preferred shell. `chmodSync` is skipped on Windows because Git Bash executes hook scripts via shebang even without the executable bit.

**CI**

GitHub Actions does **not** run the local hook. `.github/workflows/ci.yml` already runs `bun run format:check` and `cargo fmt --check` on every push and PR — same checks, but read-only / fail-on-drift mode.
