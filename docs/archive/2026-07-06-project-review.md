# Project Review — Skills, Setup, CI, Performance, Security

**Date:** 2026-07-06 · **Scope:** agent/skill infrastructure, Claude Code config, CI workflows, performance, security posture, repo hygiene.
**Audience:** coding agents. Each finding is self-contained: ID, severity, files, problem, concrete actions, and a verification command. Findings are independent unless a dependency is stated. Do **not** commit anything autonomously — propose commits to the maintainer.
**Self-check:** every factual claim was re-verified against the working tree on 2026-07-06 (see the Verification log at the end). Corrections from that pass are already incorporated.

## Severity legend

- **High** — active correctness/drift risk; fix first.
- **Medium** — real cost (money, time, risk) with a clear fix.
- **Low** — worthwhile cleanup; batch opportunistically.
- **Info** — no action; context that prevents agents from "fixing" deliberate design.

## Findings index

| ID | Severity | Area | One-line summary |
|----|----------|------|------------------|
| [SK-1](#sk-1) | High | Skills | Skill mirror sync silently drifts: tracked real-dir copies + skip-if-exists sync |
| [SK-2](#sk-2) | High | Skills | `security-stance` has no canonical source in `.agents/skills/` |
| [SK-3](#sk-3) | Medium | Agents | `docs-sync-guardian` doc map is stale and instructs reintroducing banned content |
| [SK-4](#sk-4) | Medium | Agents | `github-issue-tracker` routes to nonexistent `OPEN_TASKS.md` |
| [CF-1](#cf-1) | Medium | Config | `settings.local.json` allowlist bloat, including blanket shell allows |
| [CI-1](#ci-1) | Medium | CI | Third-party actions inconsistently pinned (SHA vs mutable tags) |
| [CI-2](#ci-2) | Medium | CI | Every PR runs 3-OS release-profile builds + Flatpak |
| [PF-1](#pf-1) | Low | Perf/DX | `pre-commit` naming collision: hook is format-only, heavy gate is manual and serial |
| [SK-5](#sk-5) | Low | Skills | Vendored rust-skills pack (26 skills, 96 files) — value vs. noise unreviewed |
| [SK-6](#sk-6) | Low | Skills | Skill description scope trims (solidjs, seo-audit) |
| [CF-2](#cf-2) | Low | Config | PostToolUse hooks mutate files under the agent and run full type-check per edit |
| [CI-3](#ci-3) | Low | CI | E2E runs only on Linux/WebKitGTK; WebView2-class bugs untested in CI |
| [CI-4](#ci-4) | Low | CI | Duplicated setup steps across `lint`/`test` jobs |
| [SE-1](#se-1) | Low | Security | No clippy gate against `unwrap`/`expect` in production code paths |
| [SE-2](#se-2) | Low | Security | NSIS `perMachine` install requires admin elevation |
| [HY-1](#hy-1) | Low | Hygiene | Junk files at repo root; tracked empty `.codex` file |
| [HY-2](#hy-2) | Low | Hygiene | ESLint covers only `src/`; `scripts/` and `e2e/` unlinted |
| [HY-3](#hy-3) | Low | Docs | Root `CLAUDE.md` Execution Environment section is WSL-centric |
| [SE-3](#se-3) | Info | Security | Strengths inventory — deliberate design, do not "fix" |
| [PF-2](#pf-2) | Info | Perf | Search linear scan is a documented, benchmarked tradeoff |

---

## High

### SK-1: Skill mirror sync silently drifts {#sk-1}

**Files:** `scripts/sync-skills.js:152-160`, `.claude/skills/` (tracked in git), `.agents/skills/`

**Problem.** The documented architecture (root `CLAUDE.md` gotcha #3) is: canonical skills live in `.agents/skills/`, mirrored into `.claude/skills/` via junctions/symlinks. Reality:

1. `.claude/skills/**` is **tracked in git as 44 regular files** (`git ls-files -s .claude/skills` → all mode `100644`). On any fresh checkout, git materializes them as real directories.
2. `sync-skills.js` **skips any destination that already exists** (`readPathStat(destination)` → `skip`), so a materialized real dir is never replaced by a junction.
3. Current state confirms this: `runbooks`, `solidjs`, `sync-lockfiles`, `tauri-v2`, `security-stance` are real directories in `.claude/skills/`; the rest are links.

Contents are byte-identical **today** (`diff -rq` clean for all four duplicated dirs), but the next edit to a `.agents/skills/{solidjs,tauri-v2,runbooks,sync-lockfiles}` file will not propagate — Claude Code will keep loading the stale copy with no warning.

**Actions** (pick A, the cleanest; B if the maintainer wants mirrors to stay tracked):

- **Option A (recommended):**
  1. Stop tracking mirrors: `git rm -r --cached .claude/skills` **except** keep whatever has no canonical source elsewhere (see SK-2 first — move `security-stance` out before doing this).
  2. Add `.claude/skills/` to `.gitignore`.
  3. Chain sync into install: change `package.json` `postinstall` to `node scripts/install-hooks.js && node scripts/sync-skills.js`.
  4. Update root `CLAUDE.md` gotcha #3 (the "mirror only runbooks" sentence changes: the whole tree is now generated).
- **Option B:** keep tracking, but make `sync-skills.js` detect a non-link destination whose canonical source exists, and replace it with a link (fail loudly if contents differ instead of clobbering).
- **Either way:** add a drift check to CI or `pre-commit` — a ~10-line script that fails when a `.claude/skills/<name>` real dir differs from `.agents/skills/<name>`.

**Verify:** `cmd.exe /c bun run sync-skills` prints `link` (not `skip`) for previously-real dirs; `ls -la .claude/skills` shows links; skills still load in a fresh Claude Code session.

**Risk note:** confirm junctions survive the workflows that read `.claude/skills` (Claude Code follows NTFS junctions fine — the currently-linked skills like `flathub-maintenance` already load). On macOS/Linux checkouts, `sync-skills` creates dir symlinks; same behavior.

### SK-2: `security-stance` has no canonical source in `.agents/skills/` {#sk-2}

**Files:** `.claude/skills/security-stance/` (418-line SKILL.md, real dir, tracked), `.agents/skills/` (absent)

**Problem.** `security-stance` is the project's most safety-critical skill (root `CLAUDE.md` gotcha #4 references it for the auto-lock flows) and it exists **only** in `.claude/skills/`. This violates the documented invariant that `.agents/skills/` is canonical, and makes the skill invisible to Codex and any other agent runtime that reads `.agents/skills/`.

**Actions:**
1. `git mv .claude/skills/security-stance .agents/skills/security-stance`
2. Run `cmd.exe /c bun run sync-skills` to create the mirror link.
3. Do this **before** SK-1 Option A (otherwise the gitignore step would orphan it).

**Verify:** skill still triggers in Claude Code (`/security-stance` or crypto-file edit); `ls .agents/skills/security-stance/SKILL.md` exists.

---

## Medium

### SK-3: `docs-sync-guardian` agent doc map is stale — instructs reintroducing banned content {#sk-3}

**Files:** `.claude/agents/docs-sync-guardian.md`

**Problem.** The agent's system prompt ("You are the authoritative expert on these 13 files/areas", `.claude/agents/docs-sync-guardian.md:13`) claims root `CLAUDE.md` owns: "Full file structure for `src/`, `src-tauri/src/`, `e2e/`, `website/`", "Complete command registry table", "State management module table", and "Testing section (test counts per module)". All of that was removed in the CLAUDE.md domain split. Agent Workflow Rule 7 explicitly bans reintroducing file trees and command tables, and `CONTEXT_FILES_BEST_PRACTICES.md` classifies test counts as volatile metrics that must be pointers, not inlined content (its case study at line ~101 is literally the old CLAUDE.md file trees this agent still describes). The agent also predates `website/docs-src/` as the authoritative user-facing reference and never mentions it. A Haiku-powered agent following its own prompt literally will re-add banned sections and cite stale test counts on every invocation.

**Actions:**
1. Rewrite the agent's "Documentation Map" to match current reality: root `CLAUDE.md` = cross-cutting only; domain content in `src/CLAUDE.md`, `src-tauri/CLAUDE.md`, `e2e/CLAUDE.md`, `benchmarks/CLAUDE.md`, `website/CLAUDE.md`; durable rules in `docs/best-practices/`; user-facing behavior in `website/docs-src/`.
2. Add an explicit instruction: "Never add file trees, command tables, or test counts to any CLAUDE.md — see CONTEXT_FILES_BEST_PRACTICES.md."
3. Cross-check the rest of its file list against `docs/` (it predates `docs/decisions/`, `website/docs-src/` as authoritative user reference, and the todo-manager ID system).

**Verify:** read the updated agent file against `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`; optionally run the agent on a dummy "I added a command" prompt and confirm it doesn't propose a command-registry table.

### SK-4: `github-issue-tracker` routes to nonexistent `OPEN_TASKS.md` {#sk-4}

**Files:** `.claude/agents/github-issue-tracker.md` (lines 3, 29, 90, 106)

**Problem.** The file is internally inconsistent — a partial-rename leftover. Lines 28, 60, and 99 correctly route to `docs/todo/TODO_EXTRA.md`, but four other spots (description, scope-table row 3, and two workflow rules) still say `OPEN_TASKS.md`, which exists nowhere in the repo (`docs/todo/` contains `TODO.md`, `TODO_EXTRA.md`, `TODO_ARCHIVE.md`). Depending on which line the agent latches onto, it will create a stray `OPEN_TASKS.md` or stall. The file also never mentions the `todo-manager` skill, which Agent Workflow Rule 4 makes mandatory for TODO ID assignment.

**Actions:**
1. Replace every `OPEN_TASKS.md` reference with `docs/todo/TODO_EXTRA.md`.
2. Add: "For TODO.md entries, invoke the `todo-manager` skill — never hand-assign TODO IDs" (aligns with Agent Workflow Rule 4).

**Verify:** `grep -c OPEN_TASKS .claude/agents/github-issue-tracker.md` returns 0.

### CF-1: `settings.local.json` permission allowlist bloat {#cf-1}

**Files:** `.claude/settings.local.json` (167 allow entries; gitignored, machine-local), `.claude/settings.json` (3 allow entries; tracked)

**Problem.** The local allowlist has accreted months of one-off approvals. It contains:

- **Blanket allows that subsume everything else:** `Bash(cmd.exe *)`, `Bash(powershell -Command:*)`, `Bash(node -e:*)`, `Bash(curl:*)`, `Bash(python3:*)`, `Bash(bun run:*)`. With `cmd.exe *` allowed, any command can run unprompted — every narrower entry is dead weight and the prompt-on-dangerous-commands safety layer is effectively off for this repo.
- **Malformed junk** that can never match (e.g. `Bash(find D:Reposmini-diarium.claude -type f \\\\(-name *.json ...)`, `Bash(Out-Null)`, `Bash(Write-Host "Created")`, absolute-path bun.exe one-offs).

**Actions:**
1. Decide the posture: if the maintainer wants "allow everything," keep only `Bash(cmd.exe *)` + `Bash(powershell -Command:*)` and delete the rest; if not, delete the blanket entries and keep a curated ~25-entry list (cargo/bun/gh/git read-mostly commands).
2. Promote the stable, safe, team-relevant allows (e.g. `Bash(cargo test *)`, `Bash(cmd.exe /c bun run test:run *)`, `Bash(gh pr *)` read ops) into tracked `.claude/settings.json` so fresh clones and worktree agents inherit them.
3. The `/fewer-permission-prompts` skill can generate the curated list from transcripts.

**Verify:** JSON parses; a session still runs the CLAUDE.md verification commands without prompting.

### CI-1: Third-party actions inconsistently pinned {#ci-1}

**Files:** all of `.github/workflows/*.yml`

**Problem.** Three actions are SHA-pinned (`cache-apt-pkgs-action`, `codecov-action`, `install-nix-action`); the rest use mutable refs: `actions/checkout@v7.0.0`, `oven-sh/setup-bun@v2`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `tauri-apps/tauri-action@v0.6.2`, `softprops/action-gh-release@v3`, `benchmark-action/github-action-benchmark@v1`, `actions/setup-node@v6`, `flatpak/flatpak-github-actions@v6`. A tag can be re-pointed by a compromised upstream; for a privacy-branded project whose release workflow (`softprops/action-gh-release@v3`, publishing binaries) and benchmark workflow (`contents: write` on master) use mutable tags, this is the main supply-chain gap. Dependabot already watches `github-actions` weekly, so SHA pins stay current automatically.

**Actions:**
1. Pin every third-party `uses:` to a full commit SHA with a `# vX.Y.Z` trailing comment (match the existing style on `cache-apt-pkgs-action`).
2. `dtolnay/rust-toolchain@stable` is a special case (the tag *is* the toolchain selector) — pin the SHA and keep `toolchain: stable` as an input, or accept it and document why.
3. Priority order: `release.yml` and `benchmark.yml` (write perms / publishes artifacts) first, then `ci.yml`.

**Verify:** `grep -n "uses:" .github/workflows/*.yml` shows only SHA refs (40-char hex) for third-party actions; a PR run stays green.

### CI-2: Every PR runs 3-OS release-profile builds + Flatpak {#ci-2}

**Files:** `.github/workflows/ci.yml` — jobs `build-linux`, `build-other` (macOS + Windows matrix), `flatpak`

**Problem.** Each PR push compiles the full Tauri app in release profile on Ubuntu, macOS, and Windows (with `cache-targets: false`, so dependencies are recompiled each run), plus a privileged-container Flatpak build. The repo is **public**, so standard-runner minutes are free — the cost is not billing but **feedback latency** (the slowest platform build gates nothing but still runs on every push, and concurrent pushes queue on shared runners) and wasted compute on PRs that can't affect the builds (docs-only, website-only, skill-only). For code PRs, the Linux build + E2E already catch the overwhelming majority of regressions.

**Actions** (present to maintainer as a tradeoff — later detection of platform-specific build breaks vs. faster PR feedback):
1. Add `paths-ignore` (or a `dorny/paths-filter` gate job) so `build-other` and `flatpak` skip when the diff touches only `docs/**`, `website/**`, `.agents/**`, `.claude/**`, `*.md`.
2. Optionally restrict `build-other` to `push: master` + a `workflow_dispatch`/label opt-in for PRs that need it (`needs-platform-build` label). Keep `build-linux` on PRs — E2E depends on it.
3. Keep everything as-is on master pushes so platform breakage is caught within one merge.

**Verify:** open a docs-only draft PR and confirm heavy jobs are skipped while lint/test still run; confirm branch protection required checks are updated to match (a skipped required check blocks merging — use `paths-ignore` at job level with `if:` conditions rather than workflow-level `paths` to keep check names present).

---

## Low

### PF-1: `pre-commit` naming collision — hook is format-only, heavy gate is manual and serial {#pf-1}

**Files:** `scripts/pre-commit.js`, `.githooks/pre-commit`, root `CLAUDE.md` (Agent Workflow Rules 1 & 2, gotcha #6)

**Facts (verified).** Two different things share the "pre-commit" name:
- The **installed git hook** (`.githooks/pre-commit`) only Prettier-formats staged `src/**` files and `cargo fmt`s staged Rust files. It is fast and runs on every `git commit`. No tests, no gate.
- **`bun run pre-commit`** (`scripts/pre-commit.js`) is a *manual* 9-step full gate: type-check, ESLint, Prettier check, UI-error check, frontend tests with coverage, backend tests under cargo-llvm-cov, clippy, rustfmt, diff-coverage gate. Nothing wires it to `git commit`.

**Problem.** The name collision invites agents (and docs) to conflate them — CLAUDE.md gotcha #6's "`bun run pre-commit` runs the gate too (step 9)" reads as if it were the commit hook. An agent may either assume commits are fully gated (they aren't — only formatted) or assume every commit costs a multi-minute pipeline (it doesn't). Separately, the manual gate runs its 9 steps strictly serially.

**Actions:**
1. Add one clarifying sentence to root `CLAUDE.md` (Rule 2 or gotcha #6): "The git hook formats only; the full gate is the manual `bun run pre-commit` / CI." Optionally rename the script command to `bun run full-check` to kill the ambiguity.
2. Optional: add a `pre-push` hook that runs the full gate once per push, so the gate runs mechanically without taxing every commit.
3. Optional perf: inside `pre-commit.js`, run independent steps concurrently (type-check / lint / format:check; frontend and backend suites can overlap) — meaningful wall-time cut with no coverage loss.

**Verify:** `cmd.exe /c bun run pre-commit` still executes all 9 steps and fails correctly on a deliberate lint error; a plain `git commit` of a formatted file remains fast.

### SK-5: Vendored rust-skills pack — value vs. noise unreviewed {#sk-5}

**Files:** `.agents/skills/{m01..m15,rust-*,coding-guidelines,domain-web,unsafe-checker}/` (96 tracked files), `skills-lock.json`, `scripts/sync-skills.js` `PLUGIN_SKILLS`

**Problem.** 26 generic Rust-education skills are vendored (source: `actionbook/rust-skills`, hash-tracked in `skills-lock.json`). For Claude Code they're excluded (the plugin is authoritative) — they exist solely for other agent runtimes reading `.agents/skills/`. Several are clearly off-domain for this repo (`domain-web`: axum/actix web servers; `rust-daily`: Rust news; `rust-skill-creator`; `m14-mental-model`: learner-oriented), and their trigger keyword lists (including CJK terms) add matching noise to every Codex session. The LSP-based ones (`rust-call-graph`, `rust-refactor-helper`, etc.) require an LSP tool that may not exist in those runtimes.

**Action:** review with the maintainer which of the 26 have ever fired usefully; drop the off-domain ones (`domain-web`, `rust-daily`, `rust-skill-creator`, likely the LSP set if unusable in Codex), keep the error/anti-pattern/unsafe ones (`m01`, `m03`, `m06`, `m15`, `unsafe-checker`). Update `skills-lock.json` and `PLUGIN_SKILLS` in the same change.

**Verify:** `cmd.exe /c bun run sync-skills` still reports the expected plugin/link/skip set; no `.claude/skills` entries dangle.

### SK-6: Skill description scope trims {#sk-6}

**Files:** `.agents/skills/solidjs/SKILL.md`, `.agents/skills/seo-audit/SKILL.md`

**Problem.** Minor trigger-precision issues:
- `solidjs` description (and ~489-line body + references) covers Solid Router, SolidStart, SSR/SSG — none used in this repo (plain Vite SPA). An agent loading it for a component task pays for irrelevant content and may be nudged toward SolidStart idioms.
- `seo-audit` triggers on generic phrases ("page speed", "my traffic dropped") but is only meaningful for `website/`. It also cross-references skills (`programmatic-seo`, `schema-markup`, `ai-seo`) that don't exist in this repo.

**Action:** trim `solidjs` description/body to the subset used here (signals, stores, control flow, testing patterns) or add "This repo is a plain Vite SPA — ignore SolidStart/SSR sections." Add "applies to `website/` only" to `seo-audit`'s description and drop the dangling cross-references.

**Verify:** description text matches actual repo usage; skill still triggers on `createSignal`-type prompts.

### CF-2: PostToolUse hooks — file mutation under the agent + full type-check per edit {#cf-2}

**Files:** `.claude/settings.local.json` `hooks.PostToolUse`

**Problem.** Two hooks run after every `Write|Edit`:
1. `bun x eslint --fix <file>` (sync) — mutates the file right after the agent wrote it. Any subsequent `Edit` whose `old_string` was formulated from the pre-fix content will fail to match, costing a re-read cycle. Output is discarded (`Out-Null`), so unfixable errors are silent.
2. `bun run type-check` (async) — a full-project `tsc --noEmit` on **every** TS edit. On a multi-edit task this stacks N concurrent tsc processes; the value is marginal since the workflow rules already mandate a type-check after each completed task.

**Action:** keep the eslint fix but surface its non-autofixable errors as a `systemMessage` instead of discarding; drop the per-edit type-check (or move it to a `Stop` hook so it runs once per turn). Document in root `CLAUDE.md` that edits may be reformatted post-write so agents re-read before follow-up edits — or rely on Prettier at commit time (already installed) and delete hook 1 entirely.

**Verify:** edit a TS file with a deliberate lint error; confirm the behavior chosen above; confirm only one tsc process runs per turn.

### CI-3: E2E coverage is Linux/WebKitGTK only {#ci-3}

**Files:** `.github/workflows/ci.yml` `e2e` job, `e2e/CLAUDE.md`

**Problem.** All **CI** E2E runs use the Linux binary under WebKitGTK. WebView2 behavior *is* exercised, but only by local runs on the dev machine (`bun run test:e2e:local` — `e2e/CLAUDE.md`'s viewport gotchas are WebView2-specific, confirming local Windows coverage) and by manual `tauri-agent-dev` sessions. So Windows-only code paths (`WebResourceRequested` network blocking is `#[cfg(windows)]`; print image decode timing) regress silently for any contributor who merges on green CI without a local Windows run.

**Action:** no immediate change required; record it as an explicit known gap in `e2e/CLAUDE.md` ("CI E2E is Linux/WebKitGTK only; WebView2 coverage comes from local `test:e2e:local` runs and manual verification") so agents don't assume green CI covers platform WebView code. If Windows CI E2E is ever wanted, scope it to a smoke spec (unlock → write → lock) on `windows-latest`.

**Verify:** the gap statement exists in `e2e/CLAUDE.md`.

### CI-4: Duplicated setup steps across `lint` and `test` jobs {#ci-4}

**Files:** `.github/workflows/ci.yml`

**Problem.** ~40 lines of identical checkout/bun/rust/cache/apt setup are copy-pasted across `lint`, `test`, and partially the build jobs. Any toolchain change must be edited in 3–5 places (the `bun-version: 1.2` bump risk).

**Action:** extract a local composite action (`.github/actions/setup-toolchain/action.yml`) with inputs for which caches to enable; use it in `lint`/`test`/builds. Low urgency — do it next time the setup changes anyway.

**Verify:** CI green; `grep -c "setup-bun" ci.yml` drops to reuse sites only.

### SE-1: No clippy gate against `unwrap`/`expect` in production paths {#se-1}

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/**`

**Problem.** Clippy runs with `-D warnings`, but `clippy::unwrap_used` is allow-by-default. The codebase has heavy `unwrap()` usage; spot-checking suggests the bulk sits in `#[cfg(test)]` modules (fine), but there is no mechanical guarantee that new production code can't panic-crash the app on a poisoned mutex or malformed data (relevant given "no error boundary components" is a known issue — a backend panic surfaces as an opaque IPC failure).

**Action:** add to `src-tauri/Cargo.toml`:
```toml
[lints.clippy]
unwrap_used = "warn"
expect_used = "warn"
```
Then triage: `cargo clippy --all-targets` will flag test code too, so either bless test modules with `#[allow(clippy::unwrap_used)]` via a shared `#![cfg_attr(test, allow(...))]`, or run the lint only over `--lib --bins` in a dedicated CI step. Fix or `// why`-comment each production hit (matches the existing "every suppression needs a why" project rule). Escalate `warn` → `deny` once clean.

**Verify:** `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` clean; grep production modules for undocumented `unwrap(`.

### SE-2: NSIS `perMachine` install mode {#se-2}

**Files:** `src-tauri/tauri.conf.json` → `bundle.windows.nsis.installMode: "perMachine"`

**Problem.** Per-machine install requires UAC elevation and writes to Program Files. For a single-user privacy journal, `currentUser` install is lower-privilege and needs no admin (per Tauri v2 docs it is the NSIS default; confirm against the current config schema before changing). May be deliberate (winget/enterprise expectations) — treat as a question, not a defect.

**Action:** ask the maintainer whether perMachine is intentional; if changed, check winget manifest implications (install scope is declared there) and note the migration behavior for existing installs.

**Verify:** decision recorded (docs/decisions or a `// why` comment in the conf if kept).

### HY-1: Junk files at repo root; tracked empty `.codex` {#hy-1}

**Files:** `D:Reposmini-diarium_testout.log`, `test_output.log`, `bash.exe.stackdump` (untracked, ignored patterns), `.codex` (tracked, 0 bytes, introduced in commit 9519006 "flatpak fixes")

**Action:** delete the three local artifacts. Ask the maintainer what `.codex` is for; if it's an accidental add from the flatpak work, `git rm .codex`; if it's a marker file some tool needs, add a one-line comment file or note in CONTRIBUTING.md.

**Verify:** `git status` clean; nothing references `.codex` (`grep -rn "\.codex" --exclude-dir=node_modules .` → empty apart from gitignore if added).

### HY-2: ESLint covers only `src/` {#hy-2}

**Files:** `package.json` (`"lint": "eslint src ..."`), `eslint.config.js`, `scripts/*.{js,mjs,ts}` (~25 files incl. the coverage gate and sync-skills), `e2e/**`

**Problem.** The scripts powering CI gates and skill sync are unlinted and untested by the lint job; `eslint.config.js` already matches `**/*.{ts,tsx}` but the npm script restricts the path to `src`.

**Action:** extend to `eslint src scripts e2e --ext .ts,.tsx,.js,.mjs` (expect an initial cleanup pass; add per-dir overrides for node globals). Keep it out of the type-aware rules if that slows lint noticeably.

**Verify:** `cmd.exe /c bun run lint` green; CI lint job unchanged otherwise.

### HY-3: Root `CLAUDE.md` Execution Environment section is WSL-centric {#hy-3}

**Files:** `CLAUDE.md` "Execution Environment"

**Problem.** The section is written for "a WSL shell over a Windows checkout" and Codex; Claude Code sessions in this repo run native Windows (PowerShell primary). The `cmd.exe /c` guidance happens to work in both, so nothing is broken — but agents in native-Windows sessions burn context reconciling instructions that describe a different shell, and the section doesn't say which rules still apply outside WSL.

**Action:** reframe as two short subsections ("From WSL (Codex): …" / "From native Windows (Claude Code): use `cmd.exe /c` or PowerShell directly; same commands"). Keep the verified-commands list shared.

**Verify:** section reads unambiguously for both environments; no command guidance lost.

---

## Info — deliberate design, do not "fix"

### SE-3: Security strengths inventory {#se-3}

Agents reviewing this codebase should treat the following as **correct and intentional**, with rationale already documented:

- **Argon2id m=64 MiB, t=3, p=4** (`src-tauri/src/crypto/password.rs:8-10`) — exceeds OWASP minimums; do not lower for speed.
- **CSP** (`tauri.conf.json`) — deny-by-default with explicit `connect-src 'self' ipc: http://ipc.localhost`; `style-src 'unsafe-inline'` + `dangerousDisableAssetCspModification` is a known, contained concession to runtime-injected styles.
- **Capabilities** (`src-tauri/capabilities/default.json`) — minimal 5-permission set; `@tauri-apps/plugin-fs` deliberately absent (file writes go through the `write_key_file` Rust command).
- **7-layer network isolation stack** — documented in `src-tauri/CLAUDE.md`; CI enforces via `scripts/check-no-network.ps1`. The `opener` plugin exception is documented in PHILOSOPHY.md/SECURITY.md.
- **Auth-slot master-key wrapping**, O(1) password change, `require_all_auth` MAC-bound in `db_settings`, `unlock_diary_auto` multi-auth bypass — all covered by ADRs in `docs/decisions/`.
- **No FTS index** — see PF-2.
- **Codecov patch ≥ 80% + local mirror** (`scripts/check-diff-coverage.mjs`) — a genuinely good gate; keep lcov paths stable.

### PF-2: Search linear scan is a documented tradeoff {#pf-2}

`search_entries_impl` (`src-tauri/src/commands/search.rs`) decrypts all entries per query. This is **by design** (no plaintext index on disk — schema v4 removed FTS for this reason), debounced 500 ms client-side, capped at 200 results, and benchmarked under criterion (`src-tauri/benches/db_bench.rs:168`). Do not add caching or a persistent index without satisfying the two constraints listed at the bottom of `src-tauri/CLAUDE.md` (encrypted-at-rest index + schema migration). If profiling ever shows real pain at scale, the sanctioned direction is a **session-scoped in-memory index built at unlock**, not disk caching.

---

## Suggested execution order

1. **SK-2** (move `security-stance`) → **SK-1** (fix mirror sync + drift check) — one PR; these interlock.
2. **SK-3 + SK-4** (agent definition fixes) — one small PR, pure text.
3. **CI-1** (SHA-pin actions, release.yml/benchmark.yml first) — one PR; Dependabot keeps pins fresh.
4. **CF-1 + CF-2** (settings prune + hook tuning) — local-only, needs maintainer's posture decision.
5. **CI-2** — present the tradeoff to the maintainer before implementing.
6. Batch the Lows (PF-1, HY-1, HY-2, HY-3, SK-5, SK-6, SE-1, SE-2, CI-3, CI-4) opportunistically, one logical change per commit per Agent Workflow Rule 6.

---

## Verification log (self-check, 2026-07-06)

Every claim was re-checked against the working tree after the report was first drafted. Corrections applied as a result:

| Claim as first drafted | What verification showed | Resolution |
|---|---|---|
| PF-1 (was Medium): "multi-minute pipeline per commit" | `.githooks/pre-commit` only formats staged files; the 9-step gate (`scripts/pre-commit.js`) is manual, not wired to `git commit` | Rewritten as a Low naming-collision finding |
| CI-2: "macOS runners bill at 10× Linux minutes" | Repo is public (`gh repo view` → `PUBLIC`); standard-runner minutes are free | Cost argument reframed as feedback latency, not billing |
| SK-5: "~139 tracked files" | 139 is all of `.agents/skills/`; the vendored rust pack is 96 files | Count corrected |
| CF-1: "~180 allow entries" | `permissions.allow.length` = 167 | Count corrected |
| SK-4: "routing table sends large issues to OPEN_TASKS.md" | File is internally inconsistent: 4 `OPEN_TASKS.md` refs (lines 3, 29, 90, 106) vs. 3 correct `TODO_EXTRA.md` refs (28, 60, 99) | Sharpened to partial-rename diagnosis |
| CI-3: "WebView2-class bugs untested" | Local Windows E2E (`test:e2e:local`) does exercise WebView2; the gap is CI-only | Scoped to CI coverage |

Spot-checks that confirmed claims unchanged: `.claude/skills` = 44 tracked files all mode `100644`; five mirrors are real dirs, contents byte-identical to `.agents/skills` today; `security-stance` absent from `.agents/skills`; `sync-skills.js` skips existing destinations (lines 152-160); `docs-sync-guardian.md:13` "13 files/areas" + stale ownership list; Dependabot covers `github-actions` weekly; SHA-pin state per `grep "uses:"`; Argon2id m=65536/t=3/p=4 (`crypto/password.rs:8-10`); capabilities = 5 permissions; `scripts/check-no-network.ps1` exists and runs in CI lint job; search scan benchmarked at `db_bench.rs:168`; 500 ms debounce + 200-result cap per `src-tauri/CLAUDE.md`; toolchain 1.95 supports `[lints]` tables (SE-1); `.codex` is a tracked empty file from commit 9519006; `lint` script targets `src` only; no `@solidjs/router`/SolidStart in `package.json` (SK-6); `postinstall` runs `install-hooks.js` only (SK-1 action 3 valid).

One claim left deliberately hedged: SE-2's "currentUser is the Tauri NSIS default" comes from Tauri documentation, not from a repo artifact (`src-tauri/gen/schemas/desktop-schema.json` contains no `installMode` default to confirm against) — re-verify against current Tauri docs before acting.
