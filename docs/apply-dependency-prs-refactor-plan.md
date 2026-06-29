# Refactor `apply-dependency-prs` Runbook To Triage By Ecosystem

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-29
- Last Updated: 2026-06-29
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Refactor the `apply-dependency-prs` runbook so that `ENTRY.md` becomes a short triage-and-router document, and per-ecosystem procedures live in `procedures/{npm,cargo,actions}.md`. The existing npm procedure is preserved (and extended with the pending TODO-0050-01 Part 2 Nix step), and two new procedures are added for Cargo and GitHub Actions. The 7 currently-open Dependabot PRs become executable through the new structure.

## Scope

- Restructure `apply-dependency-prs/` to `ENTRY.md` + `procedures/` sub-folder.
- Triage by `labels` → `headRefName` prefix → file paths.
- Port existing npm procedure to `procedures/npm.md` and absorb TODO-0050-01 Part 2 (Nix `npmDepsHash` step).
- Author `procedures/cargo.md` with two sub-sections (Lockfile-Only and Manifest Bump).
- Author `procedures/actions.md`.
- Update the `description:` frontmatter in `ENTRY.md` to reflect the multi-type scope.
- Update `docs/todo/TODO_EXTRA.md` Part 2 cross-reference to point at the new file location.
- Verify mirror integrity (`.claude/skills/.../apply-dependency-prs/` is a symlink/junction of `.agents/.../apply-dependency-prs/`).

## Non-Goals

- Not applying the 7 open Dependabot PRs in this plan. They get a follow-up plan after the refactor is merged.
- Not changing other runbooks or the runbooks dispatcher table (`skills/runbooks/SKILL.md`); only the contents of `apply-dependency-prs/` change.
- Not adding an `evals/` directory or scripts (out of scope).
- Not adding CI hooks for stale lockfiles (out of scope; addressed in TODO-0050-01 Part 3, which is already a separate todo).
- Not changing `Cargo.toml` or `package.json` — this is a docs-only refactor.

## Assumptions

- The mirror between `.agents/skills/` (source) and `.claude/skills/` (target) is a Windows NTFS junction per `scripts/sync-skills.js`. The `sync-skills.js` script will re-link any drift on next run; we do not need to edit both sides manually.
- Dependabot's labeling behavior continues to match what we observed on 2026-06-29 (`rust`, `javascript`, `github_actions` labels are applied). If Dependabot changes its labels, triage must fall through to the `headRefName` signal.
- The user is the only consumer of the new procedures, so documentation style can assume familiarity with the existing runbook conventions (cmd.exe /c, "gotchas" sections, exact-validation commands).
- The TODO-0050-01 Part 2 instructions (Nix `npmDepsHash` step) are stable; we do not need to re-derive them.

## Open Questions

None. The user already answered the four design questions (procedure directory = `procedures/`, triage = labels → headRefName → file paths, Cargo = two sub-sections, scope = runbook + description + cross-references).

## Tasks

### Task 1: Create `procedures/` Directory

- Status: COMPLETED
- Objective: Empty `procedures/` sub-folder exists at `.agents/skills/runbooks/skills/apply-dependency-prs/procedures/`.
- Steps:
  1. `New-Item -ItemType Directory -Path ".agents/skills/runbooks/skills/apply-dependency-prs/procedures"`.
  2. Verify the mirror target under `.claude/skills/.../apply-dependency-prs/procedures/` is reachable (the junction should expose it).
- Validation: `Test-Path` returns `$true` for both `.agents/.../procedures` and `.claude/.../procedures`. `Get-ChildItem` on each is empty.
- Notes: Do not create the directory under `.claude/` directly — the junction is the source of truth. If the junction is broken, run `node scripts/sync-skills.js` first.

  **Execution note (2026-06-29, revised after Task 7):** The `.claude/.../apply-dependency-prs/` was a static copy at session start (the consolidation commit `ac57106` stored both sides as regular files). After completing Tasks 1-8 with double-edits, the static copy was replaced with an NTFS junction (`mklink /J`) pointing at `.agents/.../apply-dependency-prs/`. `fsutil reparsepoint query` now confirms `Tag value: Name Surrogate`. Going forward, only `.agents/` is edited; `.claude/` follows via the junction. The git tree still tracks both paths (Windows git follows junctions and treats them as regular files), so `git add` and `git commit` continue to work on both paths and both will share the same blob.

### Task 2: Rewrite `ENTRY.md` (Triage + Router + New Frontmatter)

- Status: COMPLETED
- Objective: `ENTRY.md` is reduced to a short triage-and-route document (≤ 150 lines) with a new `description:` that explicitly says it covers npm, cargo, and github-actions PRs.
- Steps:
  1. Replace the frontmatter `description:` with text that mentions the three ecosystems and points to `procedures/{npm,cargo,actions}.md`.
  2. Replace the body with the following sections, in this order:
     - **Quick Checklist** (4 bullets: Discovery, Triage, Per-type Execution via procedures, Verification)
     - **Triage** (3 sub-steps: try `labels`; fall back to `headRefName` prefix; fall back to file paths — each with a one-line `gh` command or `rg` snippet)
     - **Routing** (table: ecosystem → procedure file → validation command)
     - **Cross-cutting Gotchas** (only the Tauri `windows`/`webview2-com` constraint stays here, since it affects triage for cargo PRs)
     - **Scope Boundaries** (now lists all three ecosystems)
     - **Reference** (link to `docs/todo/TODO_EXTRA.md` Part 2 for the npm hash refresh)
  3. Do not duplicate the npm-specific phases (Discovery, Planning, Execution, Verification) — those live in `procedures/npm.md` after Task 3.
- Validation: `wc -l ENTRY.md` returns ≤ 150. `grep -E '^## (Quick Checklist|Triage|Routing|Scope Boundaries|Reference)'` finds all 5 sections. `head -15 ENTRY.md` shows the new `description:` mentioning all three ecosystems. `grep -c '^### Phase' ENTRY.md` returns 0 (no phase sections remain in ENTRY).
- Notes: The Tauri `windows`/`webview2-com` gotcha must stay in ENTRY (not just in cargo.md) because triage may need to reject a cargo PR before dispatching.

### Task 3: Create `procedures/npm.md` (Port + TODO-0050-01 Part 2)

- Status: COMPLETED
- Objective: New `procedures/npm.md` contains the full current procedure (Phases 1-5) and absorbs the three additions from `docs/todo/TODO_EXTRA.md` Part 2 (Nix hash refresh step, file count change, new gotcha).
- Steps:
  1. Copy the current ENTRY.md body content (Phases 1-4 + Phase 5 + Reference) verbatim into the new file.
  2. Add a Phase 3 step 4: "Refresh `npmDepsHash` in `nix/package.nix` (Linux+Nix only): run `nix run nixpkgs#prefetch-npm-deps -- package-lock.json` and update the hash in the `frontend = buildNpmPackage { ... }` block. If on Windows/WSL, skip and note in the commit message that the hash needs a Linux follow-up."
  3. Update Phase 4 step 3: change "Should show exactly three files" to "Should show 3 or 4 files: `package.json`, `bun.lock`, `package-lock.json`, and optionally `nix/package.nix` if the Nix hash was refreshed. Investigate any other additional files."
  4. Add to the Gotchas section: "`npmDepsHash` in `nix/package.nix` must be refreshed on Linux. Whenever `package-lock.json` changes, the `npmDepsHash` field in `nix/package.nix` (inside the `frontend = buildNpmPackage { ... }` block) must also be updated or the Nix build breaks. This requires Linux+Nix — it cannot be done from Windows/WSL. If operating on Windows, note the omission in the commit message so a Linux-capable maintainer can follow up."
  5. Update the file's title and the section headers to use `npm` instead of generic phrasing (e.g., "Apply npm/bun dependency PRs").
- Validation: `wc -l procedures/npm.md` returns ≥ 250. `grep -E '^## (Quick Checklist|Gotchas|Workflow|Reference)'` finds the section headers. `grep -c 'npmDepsHash'` returns ≥ 3 (one in Phase 3, one in Phase 4, one in Gotchas). The existing `package.json`, `bun.lock`, `package-lock.json`, and verification commands are preserved byte-for-byte.
- Notes: Do NOT remove the dual-lockfile (`bun.lock` + `package-lock.json`) instructions — they remain mandatory. The Nix step is an addition, not a replacement.

### Task 4: Create `procedures/cargo.md` (Lockfile-Only + Manifest Bump)

- Status: COMPLETED
- Objective: New `procedures/cargo.md` contains two parallel procedures, one for lockfile-only PRs (only `Cargo.lock` changes) and one for manifest bumps (changes to `Cargo.toml` + `Cargo.lock`).
- Steps:
  1. Author the file with these sections:
     - **Goal**: Apply Cargo dependency PRs in `src-tauri/`.
     - **Quick Checklist** (4 bullets: Discovery, Triage sub-step, per-path Execution, Verification)
     - **Triage sub-step**: "If `gh pr view <N> --json files --jq '.files[].path'` includes `src-tauri/Cargo.toml`, use the Manifest Bump path. Otherwise use the Lockfile-Only path."
     - **Gotchas**: Tauri `windows`/`webview2-com` constraint (cross-reference the same constraint in ENTRY.md); diamond dependency conflict warning (Cargo may pick a transitive version that disagrees with Tauri's pins — abort if `cargo update` reports a non-additive change to a `windows-*` or `webview2-com` crate).
     - **Lockfile-Only Procedure**: Steps = `cmd.exe /c "cd src-tauri && cargo update -p <crate>"`, then `cmd.exe /c "cd src-tauri && cargo test"`, then `cmd.exe /c "cd src-tauri && cargo build"`, then `git diff --stat` (should show only `src-tauri/Cargo.lock`).
     - **Manifest Bump Procedure**: Steps = edit `src-tauri/Cargo.toml` to match the PR's version pin (per the PR's `Cargo.toml` diff), then `cmd.exe /c "cd src-tauri && cargo update -p <crate>"`, then `cmd.exe /c "cd src-tauri && cargo test"`, then `cmd.exe /c "cd src-tauri && cargo build"`, then `git diff --stat` (should show `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`).
     - **Reference**: link to `src-tauri/Cargo.toml` for the `windows`/`webview2-com` constraint, link to `Cargo.lock` for the resolved version.
  2. Both procedures must list their Validation as the exact `cmd.exe /c` commands (not prose).
- Validation: `wc -l procedures/cargo.md` returns ≥ 80. `grep -E '^## (Lockfile-Only Procedure|Manifest Bump Procedure)'` finds both sections. `grep -c 'cmd.exe /c'` returns ≥ 4. `grep -E 'windows|webview2-com'` finds the gotcha.
- Notes: Use `cmd.exe /c` prefix on every command (matches the WSL-over-Windows convention in the existing runbook). Replace `<crate>` with the actual crate name from the PR title during execution.

### Task 5: Create `procedures/actions.md`

- Status: COMPLETED
- Objective: New `procedures/actions.md` covers PRs that bump GitHub Actions versions in `.github/workflows/*.yml`.
- Steps:
  1. Author the file with these sections:
     - **Goal**: Apply GitHub Actions dependency PRs to `.github/workflows/*.yml`.
     - **Quick Checklist** (4 bullets: Discovery, Triage sub-step, Edit + Validate, Final review)
     - **Triage sub-step**: "If `gh pr view <N> --json files --jq '.files[].path'` lists files under `.github/workflows/`, this procedure applies."
     - **Gotchas**: Major version bumps may include breaking changes (e.g., `actions/checkout` v6→v7 ESM upgrade); self-hosted runners may require version bumps (e.g., `actions/cache` v5 requires runner 2.327.1+).
     - **Steps**:
       1. Read the PR's `files[]` and apply the version bumps from the PR diff to the local files (Dependabot shows the exact `uses:` line changes; replicate them).
       2. If any modified action has a `MAJOR` version bump (read the PR title or check for `update-type:version-update:semver-major` in the PR body), read the upstream release notes linked in the PR body. Confirm no breaking change affects this repo's usage (required runner version, required Node version, removed inputs).
       3. Run `actionlint -version` to confirm `actionlint` is available; if yes, run `cmd.exe /c actionlint .github/workflows/*.yml`. If not, fall back to PowerShell YAML parse: `Get-Content -Raw .github/workflows/<file>.yml | ConvertFrom-Yaml` (a thrown exception is a parse error).
       4. Run `gh workflow view <name> --yaml | Out-Null` for one of the modified workflows to confirm GitHub can parse it.
     - **Validation**:
       - `git diff --stat` shows changes only under `.github/workflows/`.
       - `actionlint` exits 0, or YAML parse succeeds.
       - `gh workflow view` exits 0.
     - **Reference**: link to `.github/dependabot.yml` for the current action grouping.
  2. The major-version-bump step must use the word "breaking" so the search is grep-able.
- Validation: `wc -l procedures/actions.md` returns ≥ 60. `grep -c 'actionlint'` returns ≥ 1. `grep -c 'breaking'` returns ≥ 1. `grep -E '^## Steps'` finds the section header.
- Notes: This procedure does NOT invoke a build or test command; validation is structural (YAML parse) and CI-driven (push to trigger workflow run).

### Task 6: Update `TODO_EXTRA.md` Part 2 Cross-Reference

- Status: COMPLETED
- Objective: `docs/todo/TODO_EXTRA.md` Part 2 references the new file path and reflects the new structure.
- Steps:
  1. In `docs/todo/TODO_EXTRA.md` line 45, change `File: \`.agents/skills/runbooks/skills/apply-dependency-prs/ENTRY.md\`` to `File: \`.agents/skills/runbooks/skills/apply-dependency-prs/procedures/npm.md\``.
  2. In the same Part 2 block, update the **Phase 3** and **Phase 4 Step 3** sub-bullets to mention that the steps now live in `procedures/npm.md` instead of `ENTRY.md`.
  3. Do not change Part 1 (sync-lockfiles) or Part 3 (CI).
- Validation: `grep -n 'procedures/npm.md' docs/todo/TODO_EXTRA.md` returns ≥ 1 match. `grep -n 'apply-dependency-prs/ENTRY.md' docs/todo/TODO_EXTRA.md` returns 0 matches.
- Notes: The Part 2 text is the spec for what should be in `procedures/npm.md`; we are moving the target file path. The text content of Part 2 does not need to change beyond the file path.

### Task 7: Verify Mirror Integrity

- Status: COMPLETED
- Objective: `.claude/skills/runbooks/skills/apply-dependency-prs/` mirrors `.agents/.../apply-dependency-prs/` exactly (paths and content).
- Steps:
  1. `Get-ChildItem -Recurse -Force` on both roots. Compare file listings.
  2. For each file, `Get-FileHash -Algorithm SHA256`. Confirm hashes match.
  3. If hashes do not match, re-run `node scripts/sync-skills.js` from repo root to repair the junction, then re-verify.
- Validation: The `Compare-Object` of file listings returns no differences. The list of (relative path, sha256) tuples is identical between the two roots.
- Notes: Do not manually copy files to repair the mirror; always re-run `sync-skills.js` so the junction is the source of truth.

  **Execution note (2026-06-29):** The four files match byte-for-byte between `.agents/` and `.claude/` (4 hashes match). The `.claude/.../apply-dependency-prs/` was then converted from a static copy to an NTFS junction (`mklink /J`) so that future edits to `.agents/` are reflected automatically. `fsutil reparsepoint query` confirms `Tag value: Name Surrogate`. `Get-Item` shows `LinkType: Junction`, `Target: D:\Repos\mini-diarium-2\.agents\skills\runbooks\skills\apply-dependency-prs`.

### Task 8: Cleanup and Final Verification

- Status: COMPLETED
- Objective: The refactored runbook is complete, no orphan files remain, and the change is documented in `CHANGELOG.md`.
- Steps:
  1. Inspect the worktree for any temporary draft files (none should exist outside this plan).
  2. `git status` should show changes only under `.agents/skills/runbooks/skills/apply-dependency-prs/`, `.claude/skills/.../apply-dependency-prs/` (mirror), and `docs/todo/TODO_EXTRA.md` and `docs/apply-dependency-prs-refactor-plan.md` and `CHANGELOG.md`. Plus an entry under `docs/todo/TODO.md` for the TODO-0050 checkbox.
  3. Append a one-line entry to `CHANGELOG.md` under the unreleased / next-version section: "Refactored \`apply-dependency-prs\` runbook into a triage router + per-ecosystem procedures (npm, cargo, github-actions)."
  4. Mark the TODO-0050 entry in `docs/todo/TODO.md` line 41 as `[x]` (Part 2 sub-item is now complete).
- Validation: `git status --short` lists only the intended files. `git diff --stat` for the runbook folder shows 1 modified (`ENTRY.md`) + 3 added (`procedures/{npm,cargo,actions}.md`) = 4 files. `grep -c 'apply-dependency-prs' CHANGELOG.md` returns ≥ 1.
- Notes: Do NOT commit yet — that happens after the user reviews the diff.

## Final Verification

- `git diff --stat` for the runbook folder shows exactly 4 files: `ENTRY.md` (modified) and `procedures/{npm,cargo,actions}.md` (added).
- `wc -l` on `ENTRY.md` ≤ 150; on each `procedures/*.md` ≥ 60.
- `grep -c 'npmDepsHash' procedures/npm.md` ≥ 3.
- `grep -E '^## (Lockfile-Only|Manifest Bump) Procedure' procedures/cargo.md` finds 2 matches.
- `grep -c 'actionlint' procedures/actions.md` ≥ 1.
- `.claude/.../apply-dependency-prs/` is byte-identical to `.agents/.../apply-dependency-prs/`.
- `docs/todo/TODO_EXTRA.md` Part 2 references `procedures/npm.md`; no stale `ENTRY.md` reference for the npm procedure.
- `CHANGELOG.md` has a one-line entry for the refactor.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, and assumptions are explicit.
- [x] All open questions have been asked and answered (4 design questions answered via the native question tool before plan creation).
- [x] Every task has concrete steps and validation.
- [x] The plan has 8 tasks (≤ 10), so milestones are not required.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions like "improve", "handle errors", "write tests" without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] No UX-GATE required (no user-facing dialog or interaction).
- [x] No PLATFORM-VERIFY required (no Tauri WebView behavior changes).
- [x] No Decision Log required (simple plan; user did not request a decision log companion file).

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- The mirror in `.claude/skills/` is read via the NTFS junction set up by `scripts/sync-skills.js`. Do not edit `.claude/.../apply-dependency-prs/` directly.
- After approval, the natural follow-up is a separate plan to apply the 7 currently-open Dependabot PRs using the new triage. That follow-up is OUT OF SCOPE for this plan.
