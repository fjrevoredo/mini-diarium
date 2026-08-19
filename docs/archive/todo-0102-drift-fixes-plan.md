# Plan: TODO-0102 — Fix three docs/tooling drift findings from closing TODO-0098

- **Status:** APPROVED
- **Source:** [TODO-0102](../docs/todo/TODO.md)
- **Date:** 2026-08-19
- **Tasks:** 6 (simple plan, no milestones)

## Goal

Close the three drift findings surfaced while closing out TODO-0098's Milestone 6:

1. `.agents/skills/security-stance/SKILL.md:98` still references `MAX_BACKUPS`, removed from
   `crates/mini-diarium-core/src/backup/` in the backup redesign.
2. Root `CLAUDE.md`'s "Commands verified to work from this shell via Windows" list does not
   document the MSYS path-conversion caveat that makes `cmd.exe /c "..."` silently no-op from a
   Git Bash/MSYS agent shell.
3. `scripts/` may still contain `spawnSync`/`execFileSync` calls whose first argument is a bare
   command name (a Windows `.cmd` shim) — audit and fix any found.

## Scope

- Skill table row correction (replace with the tiered retention policy — user's choice over
  removal).
- Root `CLAUDE.md` Execution Environment MSYS caveat.
- `scripts/` audit + the one remaining unfixed instance (`scripts/run-e2e.js` spawning `wdio`).
- CHANGELOG `[0.7.0]` Internal entries; TODO-0102 checkbox closed.

## Non-goals

- No behavior change to the backup engine, retention policy, or E2E scenarios.
- No CI changes.
- No changes to `docs/best-practices/` (no durable new rule emerged; this is a correction of
  existing guidance).

## Assumptions

- `execSync`/`exec` calls are shell-routed on Windows, so `.cmd` shims resolve there — the bug
  class is only no-shell spawns (`spawnSync`, `spawn` without `shell`, `execFileSync`) of bare
  command names.
- `git`, `cargo`, and `taskkill` are native executables, not `.cmd` shims — they resolve via
  `spawnSync`/`execFileSync` on Windows.
- The MSYS caveat is for agents whose Bash tool is Git Bash/MSYS; on this machine the Bash tool
  is PowerShell, where `cmd.exe /c` works as written.

## Open Questions

None (the single question — replace vs. remove the skill row — was answered by the user:
**replace** with the tiered policy).

---

## Task 1 — Correct the skill table row

- **Status:** COMPLETED
- **Objective:** No `MAX_BACKUPS` reference remains in `.agents/skills/security-stance/SKILL.md`.
- **Steps:**
  1. Replace the line-98 table row with the current tiered policy, referencing
     `crates/mini-diarium-core/src/backup/policy.rs:25-37` (the constants block) and keeping the
     "disk-use guarantee, not a crypto invariant" framing.
- **Validation:** `rg "MAX_BACKUPS" .agents/skills/security-stance/SKILL.md` returns nothing; the
  row's numbers match the `RECENT_SNAPSHOTS`/`DAILY_DAYS`/`WEEKLY_WEEKS`/`MONTHLY_MONTHS`/
  `MIN_STORAGE_BUDGET_BYTES`/`STORAGE_BUDGET_JOURNAL_MULTIPLE` constants.
- **Notes:** `CHANGELOG.md:526` and `crates/mini-diarium-core/API.md:300-301` mention
  `MAX_BACKUPS` historically/correctly and were confirmed out of scope by the plan file for the
  backup redesign.

## Task 2 — Document the MSYS `cmd.exe /c` caveat in root `CLAUDE.md`

- **Status:** COMPLETED
- **Objective:** An agent whose Bash tool is Git Bash/MSYS learns that `cmd.exe /c "..."`
  silently no-ops there, before trusting the verified-commands list.
- **Steps:**
  1. Add a bullet to the "Operational rule for agents" list (after the "Treat generic shell
     snippets…" bullet) stating the failure mode (MSYS path-conversion rewrites `/c` into a
     Windows path → cmd.exe prints its banner and exits 0 → false pass), the workaround
     (`MSYS_NO_PATHCONV=1 cmd.exe /c "..."`), and the alternative (use the PowerShell tool).
- **Validation:** Section read-back; bullet present; the "Commands verified…" list itself
  unchanged.
- **Notes:** Only the root `CLAUDE.md` needs this; `src/CLAUDE.md` and `src-tauri/CLAUDE.md` do
  not carry shell-command guidance of this shape.

## Task 3 — Fix `scripts/run-e2e.js` wdio spawn + record the audit

- **Status:** COMPLETED
- **Objective:** `spawnSync('wdio', …)` no longer fails with ENOENT on Windows (the last
  remaining instance of the `.cmd`-shim bug class).
- **Steps:**
  1. Apply the established pattern from `scripts/render-diagrams.mjs` (`runOrExit`) and
     `scripts/check-diff-coverage.mjs` (`generateCoverage`): an `IS_WIN` gate; on Windows
     `cmd.exe /d /s /c wdio run wdio.conf.ts …`, otherwise `wdio` directly. Keep the `env`
     (E2E_MODE) and `stdio: 'inherit'` unchanged.
  2. Record the audit result of every `scripts/*.mjs` and `scripts/*.js` file in the plan notes.
- **Validation:** `node --check scripts/run-e2e.js`; `cmd.exe /d /s /c wdio --version` resolves
  (proves the routing pattern works on this machine); audit table complete in this plan.
- **Notes:** Audit result (all other files clean):

  | File | Call | Verdict |
  |---|---|---|
  | `render-diagrams.mjs` | `runOrExit('bun'/'d2', …)` | already fixed via `cmd.exe /d /s /c` |
  | `check-diff-coverage.mjs` | `generateCoverage()` bun | already fixed via `cmd.exe /d /s /c` |
  | `check-diff-coverage.mjs` | `git`, `cargo` | native exes — OK |
  | `run-e2e.js` | `wdio` | **BUG — fixed by this task** |
  | `tauri-dev.js` | `spawn('bun', …, {shell: win})` | shell-routed on Windows — OK |
  | `tauri-dev.js` | `taskkill` | native exe — OK |
  | `install-hooks.js` | `git` | native exe — OK |
  | `check-donation-addresses.js` | `git` (execFileSync) | native exe — OK |
  | `check-stale-build-paths.js` | `git` (execFileSync) | native exe — OK |
  | `pre-commit.js`, `quick-check.js`, `e2e-local.js`, `check-ui-error-sanitization.js` | `execSync` | shell-routed — OK |
  | `verify-diagrams.mjs`, `sync-skills.js`, `enrich-winget-manifest.mjs`, `fingerprint-website-assets.mjs`, `generate-website-blog.mjs`, `generate-website-docs.mjs`, `submit-indexnow.mjs`, `website-generator-utils.mjs`, `validate-locales.ts`, `sync-languages.ts` | — | no subprocess calls |

## Task 4 — CHANGELOG entries under `[0.7.0]` Internal

- **Status:** COMPLETED
- **Objective:** The `run-e2e.js` fix and the two doc-drift corrections are visible in
  `CHANGELOG.md`'s unreleased section.
- **Steps:**
  1. Add one Internal bullet for the `run-e2e.js` fix, matching the style of the existing
     `render-diagrams.mjs` (line 65) and `check-diff-coverage.mjs` (line 72) bullets.
  2. Add one short Internal bullet for the skill row + CLAUDE.md corrections.
- **Validation:** Bullets read cleanly and link the same bug class; no duplication with lines
  65/72.
- **Notes:** The two existing bullets are the pattern to copy; this is a docs/tooling-only task,
  so no `### Fixed` (user-facing) entry.

## Task 5 — Verification pass

- **Status:** COMPLETED
- **Objective:** Nothing regressed by the tooling changes.
- **Steps:**
  1. `cmd.exe /c bun run lint`
  2. `cmd.exe /c bun run type-check`
  3. `cmd.exe /c bun run validate:locales`
  4. `cmd.exe /c bun run diagrams:check`
  5. `node --check scripts/run-e2e.js` and `cmd.exe /d /s /c wdio --version` (from Task 3)
- **Validation:** All commands exit 0.
- **Notes:** `bun run test:run` and `cargo test --workspace` are unaffected by docs-only + one
  JS change; skipped deliberately to keep the task cheap (no Rust/TS source changed).

## Task 6 — Cleanup + TODO closure

- **Status:** COMPLETED
- **Objective:** TODO-0102 marked done; no scratch artifacts remain.
- **Steps:**
  1. Mark `- [x]` on TODO-0102 in `docs/todo/TODO.md` (no archive-date convention applies to an
     open-backlog checkbox; the item is archived by the normal archive operation later).
  2. Move this plan file to `docs/archive/` (repo precedent:
     `docs/archive/backup-system-redesign-plan.md`).
- **Validation:** `rg "TODO-0102" docs/todo/TODO.md` shows `[x]`; plan file present in
  `docs/archive/` and absent from `docs/`.
- **Notes:** No intermediate artifacts were created (no scratch scripts, no temp files), so the
  cleanup is just the TODO checkbox + plan-file move.

---

## Final Verification

- `rg "MAX_BACKUPS" .agents/skills/security-stance/SKILL.md` → no hits
- `git status --short` shows only the intended files: `docs/todo-0102-drift-fixes-plan.md` (moved
  to `docs/archive/`), `.agents/skills/security-stance/SKILL.md`, `CLAUDE.md`, `scripts/run-e2e.js`,
  `CHANGELOG.md`, `docs/todo/TODO.md`
- All Task-5 commands exit 0

## Self-check (before approval)

- [x] Plan location follows the default rule (`docs/`)
- [x] Status lifecycle respected
- [x] Scope/non-goals/assumptions explicit
- [x] Open question asked via the question tool and answered (replace row) — recorded above
- [x] No UX-GATE, no Tauri WebView interaction, no TipTap interaction
- [x] Every task has concrete steps + deterministic validation
- [x] ≤10 tasks — no milestones needed
- [x] Cleanup + final verification included
- [x] Executable without the original conversation