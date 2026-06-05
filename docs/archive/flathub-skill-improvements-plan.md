# Flathub Skill & Tooling Improvements

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-09
- Last Updated: 2026-05-09
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Improve the flathub-maintenance skill with lessons learned from the v0.4.21 vorarbeiter build failure (ENOTCACHED due to stale `package-lock.json`), add a `flatpak/check-node-sources.mjs` gap-detection utility, and integrate lockfile integrity checks into the pre-release skill.

## Scope

- Rewrite the ENOTCACHED diagnosis section in the flathub-maintenance skill (dual-repo fix, lockfile chain)
- Add "Stale package-lock.json" as a dedicated failure entry
- Add documentation for `generate-node-sources.mjs` behavior, requirements, and fallbacks
- Add a `flatpak/check-node-sources.mjs` script that finds all packages in `package-lock.json` missing from `node-sources.json`
- Wire `check-node-sources.mjs` into the flathub-maintenance diagnosis workflow
- Update the "When logs are behind GitHub login" section to make `gh` CLI the primary path with a `question`-tool fallback
- Add lockfile integrity check and regeneration steps to the pre-release skill

## Non-Goals

- Changing the Flathub publish workflow itself (it already generates sources correctly from a healthy lockfile)
- Adding lockfile checks to CI (delegated to pre-release skill)
- Modifying `cargo-sources.json` handling (not involved in this failure)
- Creating a local flatpak-builder validation setup
- Modifying `generate-node-sources.mjs` (no clear improvement found — the script works correctly when the lockfile is healthy and network is available; our timeout was an environmental/WSL networking issue, not a script bug)

## Assumptions

- The `gh` CLI is available and authenticated in the agent's execution environment
- The pre-release skill at `.agents/skills/pre-release/SKILL.md` uses numbered steps and can accept a new step insertion

## Open Questions

None — all design decisions resolved in prior conversation.

## Milestones

### Milestone 1: Flathub-Maintenance Skill Improvements

- Status: TO BE DONE
- Purpose: Update the skill to reflect the full ENOTCACHED diagnosis/fix flow discovered in the v0.4.21 failure, and make log access more agent-friendly.
- Exit Criteria:
  - The flathub-maintenance SKILL.md contains all 5 rewritten/added sections
  - The skill file passes a manual read-through for clarity and completeness
  - No contradictions with `docs/FLATPAK_MAINTENANCE.md`

#### Task 1.1: Rewrite ENOTCACHED section with dual-repo fix and lockfile chain

- Status: TO BE DONE
- Objective: Section 2 of the skill now documents: (a) the lockfile → node-sources.json dependency chain, (b) why the fix must land in BOTH repos for a tagged release, (c) a step-by-step repair flow including `check-node-sources.mjs`.
- Steps:
  1. Read the current Section 2 (lines ~152-163) of `.agents/skills/flathub-maintenance/SKILL.md`.
  2. Rewrite the body to explain that `node-sources.json` is generated from `package-lock.json` — if the lockfile is stale, the generated sources will be incomplete.
  3. Add the two-part fix flow:
     - **Main repo:** regenerate lockfile with `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`, commit, push (prevents recurrence).
     - **Flathub repo:** run `node flatpak/check-node-sources.mjs <lockfile> <node-sources.json>` to discover ALL missing packages. Either re-run the publish workflow (if the lockfile fix is in the tagged commit) or manually patch `node-sources.json` and force-push to the PR branch.
  4. Include the `bot, build` trigger step explicitly.
  5. Keep the original symptom line `npm ERR! ENOTCACHED` as the trigger.
- Validation: Read the rewritten section; confirm it mentions both repos, the lockfile chain, `check-node-sources.mjs`, and the full fix flow.
- Notes: Affects lines ~152-163 in the skill file.

#### Task 1.2: Add "Stale package-lock.json" as a dedicated failure entry

- Status: TO BE DONE
- Objective: A new failure entry (placed as subsection 2a or new section after ENOTCACHED) that explains the dual-lockfile pitfall: `bun.lock` can be correct while `package-lock.json` drifts, and the publish workflow only reads the npm lockfile.
- Steps:
  1. Insert a new subsection after the ENOTCACHED section. Title: "Stale `package-lock.json` (dual lockfile pitfall)".
  2. Symptom: `package-lock.json` missing packages that exist in `bun.lock` or `package.json`. Build passes locally (bun resolves them) but Flathub fails with ENOTCACHED (npm reads the stale lockfile).
  3. Diagnosis: run `node flatpak/check-node-sources.mjs package-lock.json <node-sources.json>` and compare.
  4. Fix: regenerate lockfile with `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`, then regenerate vendored sources.
  5. Cross-reference: mention that the pre-release skill now includes a lockfile integrity guard.
- Validation: Read the new entry; confirm it mentions `bun.lock` vs `package-lock.json` divergence and the `check-node-sources.mjs` script.
- Notes: This is the root cause of the v0.4.21 failure.

#### Task 1.3: Add generate-node-sources.mjs documentation

- Status: TO BE DONE
- Objective: A short reference section explaining what the script does, its requirements, known failure modes, and fallback strategies.
- Steps:
  1. Add a new section after the "Vendored sources" explanation (~line 110). Title: "The `generate-node-sources.mjs` script".
  2. Document: input args (`<lockfile> <output> <npm-cache-dir>`), output format, `archMap` for esbuild binaries.
  3. Document the HTTP HEAD/GET fallback: the script tries HEAD for content-length; if npm registry omits it, it falls back to a full GET download. This can be slow when many packages are missing from the cache.
  4. Document the fallback workflow when generation fails:
     - Use `check-node-sources.mjs` to find gaps.
     - Manually construct entries using the known format (content entry + index entry for each missing package).
     - Insert into `node-sources.json` in URL-sorted order.
  5. Cross-reference `flatpak/check-node-sources.mjs` as the gap-discovery companion.
- Validation: Read the new section; confirm it explains HEAD→GET fallback, timeout risk, and the manual entry format with an explicit example.
- Notes: The manual format should show one content entry and one index entry for a sample package.

#### Task 1.4: Wire check-node-sources.mjs into diagnosis workflow

- Status: TO BE DONE
- Objective: The diagnosis workflow and ENOTCACHED section both reference `flatpak/check-node-sources.mjs` as the first diagnostic step — run it to discover ALL missing packages at once instead of iterating through `npm ci` failures.
- Steps:
  1. In the rewritten ENOTCACHED section (Task 1.1), include: "Run `node flatpak/check-node-sources.mjs <package-lock.json> <node-sources.json>` to list all missing packages."
  2. In the "Diagnosis Workflow" section at the bottom of the skill (~line 337), add the same reference as step 4a: "If ENOTCACHED: run `check-node-sources.mjs` to find all gaps at once."
- Validation: Search the skill file for `check-node-sources.mjs`; confirm it appears in both the ENOTCACHED section and the diagnosis workflow.
- Notes: This script is created in Task 2.1.

#### Task 1.5: Rewrite log access section — `gh` CLI primary, user-prompt fallback

- Status: TO BE DONE
- Objective: Replace the current "When logs are behind GitHub login" section (~line 349-353) with a `gh` CLI-first approach, including a structured user-prompt fallback using the `question` tool.
- Steps:
  1. Replace the current section with a new subsection: "Accessing Vorarbeiter Build Logs".
  2. Primary path (preferred):
     - List jobs: `gh api repos/flathub-infra/vorarbeiter/actions/runs/<id>/jobs --jq '.jobs[] | select(.name | startswith("build")) | {name, id, conclusion}'`
     - Fetch logs: `gh run view <id> --repo flathub-infra/vorarbeiter --log --job <job-id>`
  3. If `gh` is unavailable or unauthenticated, use the `question` tool to ask: "The `gh` CLI is not available. Would you like to configure it, or should I fall back to you pasting the error logs manually?"
     - Option A: "Configure gh CLI" → guide through `gh auth login`
     - Option B: "I'll paste the logs" → ask for the specific failing job's log content
  4. Keep the local `flatpak-builder` reproduction as a last-resort option only.
- Validation: Read the rewritten section; confirm the `gh` commands use correct syntax, the `question` tool fallback is explicit, and the user-prompt text includes actionable instructions (which job URL, which step to expand).
- Notes: Must reference the actual `question` tool available in the agent harness.

### Milestone 2: Repo Artifacts and Pre-Release Integration

- Status: TO BE DONE
- Purpose: Create the gap-detection utility and integrate lockfile checks into the pre-release workflow.
- Exit Criteria:
  - `flatpak/check-node-sources.mjs` exists and produces correct output
  - The pre-release skill contains lockfile integrity and regeneration steps
  - All new scripts pass manual execution tests

#### Task 2.1: Create flatpak/check-node-sources.mjs

- Status: TO BE DONE
- Objective: A standalone Node.js script that reads `package-lock.json` and `node-sources.json`, compares them, and reports all missing packages. Exits non-zero if gaps found.
- Steps:
  1. Create `flatpak/check-node-sources.mjs` in the main repo.
  2. Accept two positional args: `<package-lock.json> <node-sources.json>`.
  3. Read and parse both files.
  4. Extract all packages from `lock.packages` — filter for `node_modules/` prefix, require `resolved` + `integrity` fields.
  5. Build a `Set` of all URLs from `node-sources.json` entries that have a `url` field.
  6. For each lockfile package not in the URL set, print `name@version URL` to stdout.
  7. Exit code 1 if any missing, exit code 0 if clean. Print a summary line: "N packages missing" or "All packages accounted for."
  8. Handle missing/invalid files gracefully with a clear error message.
- Validation sequence:
  1. Run `node flatpak/check-node-sources.mjs package-lock.json <path-to-fixed-node-sources>` → exit 0, "All packages accounted for."
  2. Run `node flatpak/check-node-sources.mjs package-lock.json /nonexistent` → clear error, exit 1.
  3. Run `node flatpak/check-node-sources.mjs` (no args) → usage message, exit 1.
- Notes: Use ES module syntax (`import fs from 'node:fs'`) matching the existing `generate-node-sources.mjs` style. The file goes in `flatpak/` alongside `generate-node-sources.mjs`.

#### Task 2.2: Add lockfile integrity check to pre-release skill

- Status: TO BE DONE
- Objective: The pre-release skill gains a new step that verifies `package-lock.json` health before the release is tagged, catching stale lockfiles before they reach Flathub CI.
- Steps:
  1. Read `.agents/skills/pre-release/SKILL.md` to confirm current structure (7 steps, numbered 1-7).
  2. Insert a new step between Step 3 (version file consistency) and Step 4 (archive TODOs). Title: "Step 3b — Lockfile integrity check".
  3. The step checks two things:
     - **(a) Every `node_modules/` entry in `lock.packages` has `resolved` and `integrity` fields.** Command: `node -e "const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); const m=Object.entries(l.packages||{}).filter(([k,v])=>k.startsWith('node_modules/')&&(!v.resolved||!v.integrity)); if(m.length){console.error('Stale lockfile — missing resolved/integrity:',m.map(([k])=>k).join(', '));process.exit(1)}else console.log('OK')"`
     - **(b) No `package.json` dependency is absent from the lockfile.** Command: `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); const pkgs=l.packages||{}; const all=Object.assign({},p.dependencies||{},p.devDependencies||{},p.peerDependencies||{}); const missing=Object.keys(all).filter(d=>!pkgs['node_modules/'+d]); if(missing.length){console.error('Packages in package.json but not in lockfile:',missing.join(', '));process.exit(1)}else console.log('All deps accounted for')"`
  4. If either check fails → **STOP** and instruct the user to run: `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`
  5. Follow the skill's existing STOP pattern (stop immediately, report the issue).
  6. Update the Completion Report (final section) to mention whether this check passed.
  7. Update the Error Reference table with a row for lockfile integrity failure.
  8. **Do not renumber existing steps** — use "Step 3b" naming to avoid breaking references.
- Validation: Read the updated pre-release skill; confirm the new step exists with both commands, the STOP behavior, the fix instruction, and the error reference entry.
- Notes: The step is a guard, not a fixer — it detects the problem but doesn't auto-fix.

#### Task 2.3: Add lockfile regeneration step to pre-release skill

- Status: TO BE DONE
- Objective: The pre-release skill includes a step to regenerate `package-lock.json` with real npm before the Flathub publish workflow runs against the tagged commit.
- Steps:
  1. In the pre-release skill, add a new step after the lockfile integrity check (Step 3b) and before TODO archiving (Step 4). Title: "Step 3c — Regenerate lockfile with npm".
  2. The step runs: `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`
  3. Note: npm may say "up to date" but still modify the file if packages were added via bun since the last npm run.
  4. After running, re-run the Step 3b checks to confirm the lockfile is now healthy.
  5. If the lockfile was modified: note it in the completion report and include `package-lock.json` in the final `git add` command.
  6. Update the Completion Report section to mention lockfile status.
  7. Update the Error Reference table.
- Validation: Read the updated pre-release skill; confirm step 3c exists with the npm command and the re-check loop.
- Notes: This step ensures the tagged commit always ships a healthy lockfile. Combined with 3b (integrity check), it forms a complete guard → fix → verify loop.

### Milestone 3: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure all artifacts are intentional, final verification passes, and the plan is marked complete.
- Exit Criteria: No intermediate artifacts remain, all scripts pass their validation, plan status is COMPLETED.

#### Task 3.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove any temporary files created during implementation.
- Steps:
  1. Inspect the worktree for temporary scripts, test outputs, or scratch files under `flatpak/`, `.agents/`, and the repo root.
  2. Remove only artifacts not part of the intended final state.
  3. Keep: `flatpak/check-node-sources.mjs`, modified skill files (`.agents/skills/flathub-maintenance/SKILL.md`, `.agents/skills/pre-release/SKILL.md`).
- Validation: `git status` shows only deliberate file changes/additions.
- Notes: None.

#### Task 3.2: Final Verification

- Status: TO BE DONE
- Objective: Run comprehensive validation on all changed files.
- Steps:
  1. Run `node flatpak/check-node-sources.mjs package-lock.json D:/Repos/io.github.fjrevoredo.mini-diarium/node-sources.json` and confirm exit 0 (zero gaps after the fix from earlier in the session).
  2. Run `node flatpak/check-node-sources.mjs` (no args) to confirm usage message and exit 1.
  3. Run `node -c flatpak/check-node-sources.mjs` to syntax-check the script.
  4. Run `cmd.exe /c bun run format` to ensure all new/modified files are formatted.
  5. Read through the modified skill files to confirm no broken formatting, Markdown syntax errors, or contradictions between the two skills.
- Validation: All checks pass with zero errors.
- Notes: No `cargo` or `bun run lint` steps needed — changed files are Markdown and standalone Node.js scripts.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Not applicable for this plan — no Rust, TypeScript, or i18n changes. The plan modifies Markdown skill files and creates one Node.js utility script.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions — all questions asked and answered via `question` tool.
- [x] 10 tasks total, grouped into 3 milestones (milestones required since > 10... wait). Re-count: M1=5 tasks, M2=3 tasks, M3=2 tasks = 10 total. Milestones still used for logical grouping.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
