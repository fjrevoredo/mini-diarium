# Review Remediation Plan — High-Impact Slice + Low-Hanging Fruit

## Metadata

- Plan Status: COMPLETED (local; CI-green on push pending — see Task 5.2; `.pi/skills` follow-up resolved — see Task 5.3)
- Created: 2026-07-06
- Last Updated: 2026-07-06
- Owner: Coding agent
- Approval: APPROVED (user, 2026-07-06)
- Source: [`docs/reports/2026-07-06-project-review.md`](../reports/2026-07-06-project-review.md) — finding IDs (SK-1, CI-1, …) refer to that report.

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Eliminate the two High-severity skill-infrastructure defects (SK-1 mirror drift, SK-2 missing canonical source), fix the two stale agent definitions (SK-3, SK-4), close the CI supply-chain pinning gap (CI-1), and land the cheap quick wins (HY-1, PF-1 doc fix, CI-3 gap note, SK-6 trims, CF-1 allowlist prune). After this plan, the skill sync is drift-proof, agent definitions match the current repo, and all third-party GitHub Actions are SHA-pinned.

## Scope

- Skill sync integrity: SK-2 then SK-1 (canonical sources, `sync-skills.js` hardening, mirror tracking policy).
- Agent definition fixes: SK-3 (`docs-sync-guardian`), SK-4 (`github-issue-tracker`).
- CI supply chain: CI-1 (SHA-pin all third-party actions in all 8 workflows).
- Quick wins: HY-1 (junk files), PF-1 action 1 (doc clarification), CI-3 (E2E gap statement), SK-6 (skill description trims), CF-1 (permission allowlist prune — pending Q2).

## Non-Goals

- CI-2 (path-filtering heavy PR jobs) — needs a separate maintainer tradeoff discussion.
- SK-5 (vendored rust-skills pack review) — needs maintainer usage judgment; not mechanical.
- SE-1 (clippy `unwrap_used` gate) — triage effort is unbounded until a first clippy run sizes it; plan separately.
- SE-2 (NSIS install mode), CI-4 (composite action), HY-2 (ESLint scope), HY-3 (CLAUDE.md WSL section), CF-2 (PostToolUse hooks) — deferred; CF-2 and HY-3 are candidates for the next batch.
- Any product (src/, src-tauri/) code changes. This plan touches only scripts, docs, agent/skill definitions, workflows, and git tracking state.
- No `CHANGELOG.md` entry — nothing here is user-facing.

## Assumptions

- Node's `lstatSync().isSymbolicLink()` returns `true` for NTFS junctions (Node treats junctions as symlinks) — required by Task 1.2. Verify at implementation time with a one-liner against an existing junction (e.g. `.claude/skills/tiptap`).
- The executing agent has `gh` available and network access to resolve action tag → commit SHA (Task 3.x).
- The maintainer reviews and performs all commits; the agent only prepares changes and proposes commit messages (per project rule: no autonomous commits).
- `docs/reports/2026-07-06-project-review.md` findings were verified against the working tree on 2026-07-06; if execution starts much later, re-verify SK-1/SK-2 state first (`ls -la .claude/skills`).

## Open Questions

None — all four resolved by the maintainer on 2026-07-06:

1. **SK-1 mirror strategy** → **Option A**: untrack `.claude/skills/`, gitignore it, auto-run `sync-skills` on postinstall.
2. **CF-1 allowlist posture** → **Curate ~25 entries**: delete blanket allows and junk; promote stable verification-command allows into tracked `.claude/settings.json`.
3. **HY-1 `.codex`** → **Delete it** (`git rm .codex`).
4. **PF-1 scope** → **Doc sentence only**; no script rename.

## Milestones

### Milestone 1: Skill Mirror Integrity (SK-2, SK-1)

- Status: COMPLETED — all mirrors are links; drift test failed loudly as designed; postinstall chain verified (`bun run postinstall` runs install-hooks then sync-skills); lockfiles untouched. Fresh-session skill load to be confirmed in the user's next Claude Code session (junction pattern identical to previously-working skills).
- Purpose: Make `.agents/skills/` the enforced single source of truth and make the `.claude/skills/` mirror mechanically incapable of silent drift.
- Exit Criteria: `security-stance` exists canonically in `.agents/skills/` and loads in Claude Code; `bun run sync-skills` produces links (never silent stale copies) for every non-plugin skill; a contrived drifted real-dir mirror is detected (repaired or hard-failed, per Q1 answer); root `CLAUDE.md` gotcha #3 describes the new mechanism; `git status` shows the intended tracking state only.

#### Task 1.1: Relocate `security-stance` canonical source (SK-2)

- Status: COMPLETED
- Objective: `security-stance` lives in `.agents/skills/security-stance/` and `.claude/skills/security-stance` is a generated link to it.
- Steps:
  1. `git mv .claude/skills/security-stance .agents/skills/security-stance`
  2. Run `cmd.exe /c bun run sync-skills` — expect `link security-stance` (destination no longer exists after the move).
- Validation: `ls .agents/skills/security-stance/SKILL.md` exists; `ls -la .claude/skills/` shows `security-stance` as a link; the skill still appears in a fresh Claude Code session's available-skills list.
- Notes: Must complete before Task 1.3 (untracking would otherwise orphan the only copy). Report finding SK-2.

#### Task 1.2: Harden `sync-skills.js` against silent drift (SK-1)

- Status: COMPLETED
- Objective: A `.claude/skills/<name>` destination that exists as a **real directory** while a canonical `.agents/skills/<name>` source exists is never silently skipped.
- Steps:
  1. First verify the junction assumption: `node -e "console.log(require('fs').lstatSync('.claude/skills/tiptap').isSymbolicLink())"` must print `true`. If `false`, junction detection needs `stats.isDirectory() && readlink` probing — adapt before proceeding.
  2. In `scripts/sync-skills.js` `syncSkills()`, replace the unconditional skip-if-exists branch (`readPathStat(destination)` → `skip`): when the destination `lstat` is a symlink/junction → keep current `skip` behavior; when it is a real directory and the canonical source exists → compare contents recursively; if identical, remove the dir and create the link (log `repair <name>`); if different, throw with a message naming both paths and instructing to reconcile manually (log `DRIFT <name>`).
  3. Keep the `runbooks` nested-library behavior unchanged (only the top-level `runbooks` dir is mirrored).
  4. Test the drift path manually: replace one linked skill with a modified real copy, run sync, confirm the hard failure; restore, confirm `repair`/`link`.
- Validation: `cmd.exe /c bun run sync-skills` on the current tree converts the pre-existing real dirs (`runbooks`, `solidjs`, `sync-lockfiles`, `tauri-v2`, and `security-stance` if not already linked by Task 1.1) into links, printing `repair`/`link` for each; the contrived-drift test from step 4 fails loudly; a second run prints `skip` for all links.
- Notes: The four real-dir mirrors are byte-identical to their sources as of 2026-07-06, so `repair` is safe today. Affected file: `scripts/sync-skills.js`. Report finding SK-1 (Option B behavior — needed under **either** Q1 answer, since fresh checkouts materialize real dirs until Option A lands, and even after Option A a stale local checkout still has them).

#### Task 1.3: Untrack the mirror tree and sync on install (SK-1, Option A per Q1)

- Status: COMPLETED
- Objective: `.claude/skills/` is no longer tracked in git and is regenerated automatically by `bun install`.
- Steps:
  1. `git rm -r --cached .claude/skills`
  2. Add `.claude/skills/` to `.gitignore` (under the existing "Claude Code local settings" block).
  3. Change `package.json` `postinstall` to `node scripts/install-hooks.js && node scripts/sync-skills.js`.
  4. Run `cmd.exe /c bun install` once to confirm the postinstall chain works.
- Validation: `git ls-files .claude/skills` is empty; `git status` clean after sync; `cmd.exe /c bun install` exits 0 and prints sync output.
- Notes: Depends on Tasks 1.1 and 1.2.

#### Task 1.4: Update root `CLAUDE.md` gotcha #3 (SK-1)

- Status: COMPLETED
- Objective: Gotcha #3 accurately describes the post-change sync mechanism.
- Steps:
  1. Rewrite the gotcha to state: canonical source `.agents/skills/`; mirror is generated by `sync-skills` (now auto-run on install if Option A); real-dir mirrors are repaired or rejected, never silently kept; `PLUGIN_SKILLS` maintenance rule unchanged; runbooks nested-library rule unchanged.
- Validation: The gotcha's described behavior matches an actual `bun run sync-skills` run output; no reference to manually mirroring individual skills remains.
- Notes: Keep the edit within gotcha #3; follow `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md` (pointers over copies).

### Milestone 2: Agent Definition Accuracy (SK-3, SK-4)

- Status: COMPLETED — all named paths verified to exist; `OPEN_TASKS` grep = 0; banned-content claims removed.
- Purpose: Stop the two project agents from acting on a repo layout that no longer exists.
- Exit Criteria: Both agent files reference only files that exist in the repo today; `docs-sync-guardian` cannot instruct reintroducing banned CLAUDE.md content; `grep -c OPEN_TASKS .claude/agents/github-issue-tracker.md` returns 0.

#### Task 2.1: Rewrite `docs-sync-guardian` documentation map (SK-3)

- Status: COMPLETED — map rewritten to 16 areas (count updated accordingly); downstream sections (routing rules, sync auditing, format enforcement, audit methodology, dependency map, quality standards) also referenced banned content and were fixed in the same pass.
- Objective: The agent's doc-ownership map matches the current documentation architecture.
- Steps:
  1. Read the full `.claude/agents/docs-sync-guardian.md` and inventory every file/section claim against the real files.
  2. Rewrite the root-`CLAUDE.md` entry: cross-cutting guidance only — remove "Full file structure", "Complete command registry table", "State management module table", "test counts per module".
  3. Add entries for the domain guides (`src/CLAUDE.md`, `src-tauri/CLAUDE.md`, `e2e/CLAUDE.md`, `benchmarks/CLAUDE.md`, `website/CLAUDE.md`), `docs/best-practices/` (durable rules), `docs/decisions/` (ADRs), and `website/docs-src/` (authoritative user-facing reference; regenerate via `bun run website:build-static`).
  4. Add the hard rule: "Never add file trees, command tables, or exact test counts to any CLAUDE.md — see `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`."
  5. Fix the "13 files/areas" count to match the rewritten map.
- Validation: Every path named in the agent file exists (`while read p; do test -e "$p" || echo "MISSING $p"; done` over extracted paths, or manual inspection); the four banned-content claims are gone; the CONTEXT_FILES rule is present verbatim.
- Notes: Affected file: `.claude/agents/docs-sync-guardian.md` (keep frontmatter `model: haiku`, `memory: project` unchanged). Report finding SK-3.

#### Task 2.2: Fix `github-issue-tracker` routing (SK-4)

- Status: COMPLETED — discovered additional staleness beyond the plan (dead `OT-N` numbering in the entry template, step 5, and memory guidance; real format is `TODO-XXXX-YY` with a `Parent:` line) and fixed it in-task per the discovered-issues rule.
- Objective: The agent routes exclusively to files that exist and defers TODO IDs to `todo-manager`.
- Steps:
  1. Replace all 4 `OPEN_TASKS.md` references (description line 3, scope-table line 29, workflow rules lines 90 and 106) with `docs/todo/TODO_EXTRA.md`.
  2. Add to its workflow rules: "For `docs/todo/TODO.md` entries, invoke the `todo-manager` skill — never hand-assign TODO IDs."
- Validation: `grep -c OPEN_TASKS .claude/agents/github-issue-tracker.md` → 0; `grep -c todo-manager .claude/agents/github-issue-tracker.md` → ≥1.
- Notes: Affected file: `.claude/agents/github-issue-tracker.md`. Report finding SK-4.

### Milestone 3: CI Supply-Chain Pinning (CI-1)

- Status: COMPLETED (local) — all 8 workflows SHA-pinned and parse under js-yaml; `grep -Pn "uses:\s*\S+@(?![0-9a-f]{40})"` returns nothing. CI-green confirmation pending the maintainer's branch push (Task 5.2).
- Purpose: Remove mutable-tag exposure from all workflows, starting with the ones holding write permissions or publishing artifacts.
- Exit Criteria: `grep -E "uses:.*@" .github/workflows/*.yml` shows every third-party action pinned to a 40-char commit SHA with a `# vX.Y.Z` comment; the next CI run on a branch is green.

#### Task 3.1: Pin `release.yml` and `benchmark.yml`

- Status: COMPLETED — `dtolnay/rust-toolchain` pinned to the `stable`-branch SHA with explicit `toolchain: stable` input added at every site (required once SHA-pinned, since the action derives the toolchain from its ref).
- Objective: The two highest-risk workflows (artifact publishing; `contents: write`) use only SHA-pinned third-party actions.
- Steps:
  1. For each `uses: owner/repo@tag`, resolve the SHA: `gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha` (dereference annotated tags via `gh api repos/<owner>/<repo>/git/tags/<sha> --jq .object.sha` when `.object.type == "tag"`); for branch-style refs like `dtolnay/rust-toolchain@stable`, use `gh api repos/dtolnay/rust-toolchain/commits/stable --jq .sha`.
  2. Rewrite each `uses:` as `owner/repo@<sha> # <tag>` matching the existing style on `cache-apt-pkgs-action`.
  3. For `dtolnay/rust-toolchain@stable`: pin the SHA and add `with: toolchain: stable` if not already implied — check the action's README for the input name before assuming.
- Validation: `grep -nE "uses:" .github/workflows/release.yml .github/workflows/benchmark.yml` — every third-party ref is 40-hex; YAML still parses (`node -e` with a YAML parser or push to a branch and let CI validate).
- Notes: Do not touch first-party `actions/*` if the maintainer prefers, but pinning them too is cheaper than deciding — pin everything. Dependabot (`.github/dependabot.yml`, github-actions ecosystem) keeps SHA pins updated. Report finding CI-1.

#### Task 3.2: Pin remaining workflows

- Status: COMPLETED — first-party `actions/*` pinned too (cheaper than deciding per-action, per plan note).
- Objective: `ci.yml`, `flathub-publish.yml`, `homebrew-cask.yml`, `winget-publish.yml`, `indexnow.yml`, `nix.yml` use only SHA-pinned actions.
- Steps:
  1. Same resolution + rewrite procedure as Task 3.1 for every remaining mutable ref (`actions/checkout@v7.0.0`, `oven-sh/setup-bun@v2`, `Swatinem/rust-cache@v2`, `tauri-apps/tauri-action@v0.6.2`, `actions/setup-node@v6`, `actions/cache@v5.0.5`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `flatpak/flatpak-github-actions/flatpak-builder@v6`, `actions/setup-python@v6.2.0`, `softprops/action-gh-release@v3` occurrences outside release.yml, etc.).
  2. Leave the three already-SHA-pinned actions untouched.
- Validation: `grep -PnE "uses:\s*[^#\s]+@(?![0-9a-f]{40})" .github/workflows/*.yml` returns no third-party matches; a branch push runs CI green.
- Notes: ~25 `uses:` sites total across 8 files. CI green is the authoritative validation — local YAML lint is a smoke check only.

### Milestone 4: Quick Wins (HY-1, PF-1, CI-3, SK-6, CF-1)

- Status: COMPLETED — each finding landed as an isolated change; per-finding verify lines pass (see task notes).
- Purpose: Land the independent low-effort fixes from the report in isolated, per-finding commits.
- Exit Criteria: Each included finding's own Verify line from the report passes; `git status` shows no unrelated changes; every change is a separate proposed commit.

#### Task 4.1: Remove junk files (HY-1)

- Status: COMPLETED
- Objective: Repo root contains no stray logs/stackdumps; `.codex` fate matches Q3 answer.
- Steps:
  1. Delete `D:Reposmini-diarium_testout.log`, `test_output.log`, `bash.exe.stackdump` (all untracked).
  2. `git rm .codex` (Q3: maintainer confirmed deletion).
- Validation: `ls` of repo root shows none of the four files; `git status` reflects only the `.codex` removal; `grep -rn "\.codex" --exclude-dir=node_modules --exclude-dir=.git .` shows no dangling references.
- Notes: None.

#### Task 4.2: Clarify the pre-commit naming collision (PF-1)

- Status: COMPLETED
- Objective: Root `CLAUDE.md` states unambiguously that the git hook formats only and the full gate is manual.
- Steps:
  1. In root `CLAUDE.md` Agent Workflow Rule 2, add one sentence: "Note: the installed git hook only formats staged files; the full quality gate is the separate manual command `bun run pre-commit` (its steps also run in CI) — it is not wired to `git commit`."
- Validation: `grep -n "formats staged" CLAUDE.md` (or equivalent phrasing) hits; the sentence sits inside Rule 2 and does not contradict gotcha #6.
- Notes: Q4 resolved as doc-only — no script rename. Report finding PF-1 action 1.

#### Task 4.3: Document the CI E2E platform gap (CI-3)

- Status: COMPLETED — placed after the Verification Commands block in `e2e/CLAUDE.md`.
- Objective: `e2e/CLAUDE.md` states the CI coverage boundary explicitly.
- Steps:
  1. Add to `e2e/CLAUDE.md` (near its mode/CI description): "CI E2E runs Linux/WebKitGTK only. WebView2 (Windows) behavior is covered by local `bun run test:e2e:local` runs and manual `tauri-agent-dev` verification — green CI does not exercise `#[cfg(windows)]` paths like `WebResourceRequested` blocking or print image decode timing."
- Validation: `grep -n "WebKitGTK only" e2e/CLAUDE.md` hits; statement placement makes sense in context (manual read).
- Notes: Doc-only. Report finding CI-3.

#### Task 4.4: Trim skill description scope (SK-6)

- Status: COMPLETED — also removed seo-audit's "Related Skills" section (all six referenced skills don't exist in this repo), beyond the three cross-references the plan named. Updated descriptions hot-reloaded through the junction mirrors mid-session, confirming the M1 sync mechanism end-to-end.
- Objective: `solidjs` and `seo-audit` skills stop advertising content irrelevant to this repo.
- Steps:
  1. `.agents/skills/solidjs/SKILL.md`: add a scope note near the top of the body: "This repo is a plain Vite SPA (no Solid Router, no SolidStart, no SSR) — skip those sections and references." Remove SolidStart/SSR/routing bullets from the frontmatter `description`.
  2. `.agents/skills/seo-audit/SKILL.md`: prepend "Applies to the static marketing site under `website/` only." to the frontmatter description; delete the cross-references to `programmatic-seo`, `schema-markup`, `ai-seo` (skills that don't exist here).
- Validation: `grep -in "solidstart" .agents/skills/solidjs/SKILL.md` shows no frontmatter-description hit; `grep -c "programmatic-seo" .agents/skills/seo-audit/SKILL.md` → 0; both skills still list in a fresh session.
- Notes: Only descriptions/scope notes — do not rewrite skill bodies beyond the listed deletions. If Milestone 1 changed mirror mechanics, run `bun run sync-skills` after editing so mirrors reflect the change. Report finding SK-6.

#### Task 4.5: Prune the permission allowlist to a curated set (CF-1, per Q2)

- Status: COMPLETED — 167 → 35 curated entries (grouped: cargo, `cmd.exe /c bun run`, git/gh read ops, agent-browser, MCP/WebFetch research, 3 skills); hooks and enabledPlugins preserved untouched; backup saved to session scratchpad; 8 verification-command allows promoted into tracked `.claude/settings.json` (11 entries total incl. the 3 pre-existing).
- Objective: `.claude/settings.local.json` contains only intentional least-privilege entries; stable team-relevant allows live in tracked `.claude/settings.json`.
- Steps:
  1. Back up the current file to the session scratchpad (not the repo) before editing.
  2. Delete all malformed/dead entries and one-off absolute-path entries.
  3. Delete blanket entries (`Bash(cmd.exe *)`, `Bash(powershell -Command:*)`, `Bash(node -e:*)`, `Bash(curl:*)`, `Bash(python3:*)`, `Bash(bun run:*)`).
  4. Keep/add a curated list (~25): `cargo test/check/clippy/fmt/build *`, `cmd.exe /c bun run <named scripts>`, `gh pr/issue/run/api` read operations, `git log/show/diff *`, agent-browser commands, `bun install`; keep the MCP/WebFetch/Skill entries still in use.
  5. Promote the verification-command subset (type-check, lint, test:run, validate:locales, cargo test/check) into `.claude/settings.json` `permissions.allow`.
- Validation: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json'))"` exits 0; entry count ≈25; in a fresh session, each CLAUDE.md verification command runs without a permission prompt.
- Notes: `settings.local.json` is gitignored — only the `settings.json` promotion is committed. Expect occasional new prompts after this change; that is the accepted tradeoff. Report finding CF-1.

### Milestone 5: Cleanup And Final Verification

- Status: COMPLETED (Task 5.3 is a BLOCKED out-of-scope handoff, not a gate)
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, and the plan status is COMPLETED.

#### Task 5.1: Cleanup Intermediate Artifacts

- Status: COMPLETED — drift-test directory removed and `tiptap` re-linked during Task 1.2; settings backup lives in the session scratchpad (outside the repo, intentional); no scratch artifacts in the worktree.
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Remove any contrived drift-test directories from Task 1.2 step 4 and re-run `bun run sync-skills` to restore clean links.
  2. Inspect the worktree for scratch scripts, temporary files, or debug output created during execution; remove them.
  3. Confirm this plan file's statuses reflect final reality (no stale IN PROGRESS / pending phrases).
- Validation: `git status` shows only the intended final changes; `cmd.exe /c bun run sync-skills` prints `skip`/`plugin` only.
- Notes: This plan did not originate from a `docs/todo/TODO.md` item — no TODO checkbox to close. No CHANGELOG entry (no user-facing change).

#### Task 5.2: Final Verification

- Status: COMPLETED (local) — all Pre-flight Checks below pass. **CI-green on the pushed branch is still pending** (post-push, maintainer-driven); if the pinned-actions run fails, revisit Milestone 3.
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run the Pre-flight Checks listed below; fix failures and rerun until green, or record the blocker.
  2. After the maintainer pushes a branch: confirm the CI run is green (authoritative check for Milestone 3).
- Validation: All Pre-flight Checks pass locally; CI green on the pushed branch.
- Notes: CI validation happens post-push and is outside the local loop — record it as pending in the plan until observed.

#### Task 5.3: `.pi/skills/` tracked mirror (discovered issue — out of scope)

- Status: COMPLETED — maintainer chose the same untrack-and-regenerate treatment (2026-07-06). Done: `git rm -r --cached .pi/skills` (all 101 tracked files were under `skills/`), `.pi/skills/` added to `.gitignore`, `sync-skills.js` now syncs both targets (`.pi` gets the full set with an empty plugin-exclusion since pi has no plugin system — this **adds 10 project skills pi previously lacked**, incl. security-stance, todo-manager, runbooks), CLAUDE.md gotcha #3 updated. Validated: all 38 `.pi/skills` entries are links; second run is idempotent; `git ls-files .pi` empty.
- Objective: Decide whether `.pi/skills/` (a second junction mirror of `.agents/skills/` for the pi runtime, **101 files tracked in git through the junctions**) should get the same Option A treatment (untrack + gitignore + regenerate), since it carries the identical SK-1 drift hazard on fresh checkouts.
- Steps:
  1. Ask the maintainer whether the pi runtime is still in use.
  2. If yes: untrack `.pi/skills/`, gitignore it, and extend `sync-skills.js` (or a sibling script) to regenerate it. If no: remove `.pi/` entirely.
- Validation: `git ls-files .pi/skills` empty (or `.pi/` gone); pi runtime still resolves skills if kept.
- Notes: Discovered because the Task 4.4 edit to `seo-audit` surfaced as a `.pi/skills/seo-audit/SKILL.md` modification (git reads through the tracked junction). `.ocx/` and `.opencode/` were checked and do not have this pattern.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these before marking the plan COMPLETED. (Tailored: this plan changes no product code, so the heavy suites are smoke checks against accidental damage.)

- [x] `cmd.exe /c bun run sync-skills` prints only `plugin`/`skip`/`link` (no `DRIFT`)
- [x] `git ls-files .claude/skills` is empty (Option A untracking applied)
- [x] `grep -c OPEN_TASKS .claude/agents/github-issue-tracker.md` → 0
- [x] `grep -Pn "uses:\s*\S+@(?![0-9a-f]{40})" .github/workflows/*.yml` → no matches (all pinned, incl. first-party); all 8 files parse under js-yaml
- [x] `cmd.exe /c bun run type-check` passes (exit 0)
- [x] `cmd.exe /c bun run lint` passes (exit 0)
- [x] Both settings JSON files parse
- [x] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/wip/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions were surfaced via the question tool and answered by the user (2026-07-06); answers recorded in Open Questions.
- [x] Tasks are grouped into milestones (14 tasks > 10).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation (report is linked; finding IDs resolve there).
- [x] No dialog/interaction feature → UX-GATE not required.
- [x] No Tauri WebView behavior change → PLATFORM-VERIFY not required.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- **Commits:** the agent never runs `git commit`. Prepare changes per milestone (one logical change per commit, Agent Workflow Rule 6) and propose commit messages to the maintainer. Suggested split: M1 = 2 commits (skill move; sync hardening + policy + docs), M2 = 1, M3 = 2 (release/benchmark; rest), M4 = 1 per task.
- All Open Questions are resolved (see that section); no task is gated on user input anymore. If a new decision point emerges mid-execution, mark the task BLOCKED and ask — do not improvise.
