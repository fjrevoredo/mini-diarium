---
name: apply-dependency-prs
description: >
  Use this skill whenever the user asks you to apply dependency update PRs
  from GitHub — Dependabot bumps or version updates in package.json,
  Cargo.toml, or .github/workflows/*.yml. The skill triages each PR by
  type (npm, cargo, or github-actions) using labels → headRefName prefix →
  file paths, then dispatches to the matching procedure in procedures/.
---

# Apply Dependency PRs

Triage and apply dependency update PRs from GitHub across all three
Dependabot ecosystems (npm, cargo, github-actions). The entry point is a
short router; the per-ecosystem procedures live in `procedures/`.

## Quick Checklist

- [ ] **Discovery**: fetch PR diffs (`gh pr view <N> --json files`) and confirm clean worktree
- [ ] **Triage**: classify each PR by ecosystem using the Triage section
- [ ] **Per-type Execution**: dispatch to the matching procedure in `procedures/`
- [ ] **Verification**: run the validation steps from the chosen procedure

## Triage

For each PR, classify it by ecosystem using the **first** signal that matches:

1. **PR `labels`** (most reliable when Dependabot labels PRs):
   ```bash
   gh pr view <N> --json labels --jq '.labels[].name'
   ```
   - `rust` → cargo (`procedures/cargo.md`)
   - `javascript` → npm (`procedures/npm.md`)
   - `github_actions` → actions (`procedures/actions.md`)

2. **`headRefName` prefix** (fallback when labels are missing):
   ```bash
   gh pr view <N> --json headRefName --jq '.headRefName'
   ```
   - `dependabot/cargo/...` → cargo
   - `dependabot/npm_and_yarn/...` → npm
   - `dependabot/github_actions/...` → actions

3. **File paths** (final fallback):
   ```bash
   gh pr view <N> --json files --jq '.files[].path'
   ```
   - `package.json` / `package-lock.json` / `bun.lock` → npm
   - `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` → cargo
   - `.github/workflows/*.yml` → actions

If a PR matches multiple ecosystems (unusual but possible for grouped
Dependabot PRs), apply each procedure in order: npm → cargo → actions.

## Routing

| Ecosystem   | Procedure File          | Primary Validation                                 |
|-------------|-------------------------|----------------------------------------------------|
| npm         | `procedures/npm.md`     | `cmd.exe /c bun run type-check`                    |
| cargo       | `procedures/cargo.md`   | `cmd.exe /c cargo test --manifest-path src-tauri/Cargo.toml` |
| actions     | `procedures/actions.md` | `actionlint` on the changed workflows              |

## Cross-Cutting Gotchas

- **`windows` / `webview2-com` Cargo crates are tied to the Tauri version.**
  Tauri's transitive deps (wry, tao, tauri-runtime-wry) own the `windows`
  and `webview2-com` types passed to our code. A version mismatch causes
  type-level incompatibilities (e.g. `PCWSTR`/`Interface`/
  `COREWEBVIEW2_WEB_RESOURCE_CONTEXT` from different `windows-core`
  versions won't unify). If a cargo PR touches these crates, **reject the
  PR and let the Tauri upgrade dictate the new version**. See
  `procedures/cargo.md` for the full gotcha and the abort condition.
- **All project commands need `cmd.exe /c`.** This repo is worked on from
  WSL over a Windows checkout. Bare `bun`/`npm`/`cargo` from WSL may fail.

## Scope Boundaries

- **Covers:** npm (`package.json` + `bun.lock` + `package-lock.json`),
  Cargo (`src-tauri/Cargo.toml` + `src-tauri/Cargo.lock`), and GitHub
  Actions (`.github/workflows/*.yml`).
- **Out of scope for this skill:** direct edits to other ecosystem files
  (e.g., `flake.nix`, `nix/package.nix`). The npm procedure includes a
  Linux-only `npmDepsHash` refresh step for `nix/package.nix`; that is
  the only Nix file touched from within this skill.
- **E2E tests are out of scope** for dependency bumps. Running `test:e2e`
  is not required unless the bumped dependency is a Tauri API or plugin
  that could affect IPC behavior.

## Reference

- For full details on the dual-lockfile requirement and the Flatpak pipeline: `docs/FLATPAK_MAINTENANCE.md`
- For the `npmDepsHash` refresh step: `docs/todo/TODO_EXTRA.md` Part 2 (referenced by `procedures/npm.md`)
- For the original (pre-refactor) full procedure: see git history at the commit that introduced the `procedures/` sub-folder
