# Integrate second Dependabot batch and Tauri 2.12 upgrade

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master` at `4dfe0b6` (the first dependency batch, already pushed; local and `origin/master` match).
- Governing runbook: `.agents/skills/runbooks/skills/apply-dependency-prs/` (`ENTRY.md`, `procedures/npm.md`, `procedures/cargo.md`). Multi-ecosystem order: npm → cargo. The runbook commits locally and does **not push**.
- This is the second batch. After the first push, Dependabot opened a new set of PRs against the new master. All six are based on `4dfe0b6` (`git merge-base master pr-N` for N in 317..322).
- Stack: SolidJS + TypeScript frontend (bun + dual lockfiles); Rust Cargo workspace (app `src-tauri`, `crates/mini-diarium-core`, `crates/mini-diarium-crypto`) with repo-root `Cargo.lock`; Tauri v2.
- Exact commands:
  - Type-check: `cmd.exe /c bun run type-check`
  - Lint: `cmd.exe /c bun run lint`
  - Frontend tests: `cmd.exe /c bun run test:run`
  - Backend tests: `cargo test --workspace`
  - Backend build: `cargo build -p mini-diarium --features custom-protocol`
  - Workflow lint: `cmd.exe /c actionlint .github/workflows/ci.yml`
  - Diagram freshness: `cmd.exe /c bun run diagrams:check`
  - Local E2E: `cmd.exe /c bun run test:e2e:local`

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Open dependency PRs | npm: #321, #320, #319, #318, #317; cargo: #322; stale: #285 | `gh pr list --state open` |
| #322 cargo group | tauri 2.11.6→2.12.0; tauri-plugin-opener 2.5.5→2.6.0; tauri-plugin-dialog 2.7.3→2.8.0; tauri-plugin-window-state 2.4.1→2.5.0; tauri-build 2.6.3→2.7.1; `Cargo.lock` only | `gh pr view 322 --json files`; `git diff master...pr-322 -- Cargo.lock` |
| #322 transitive impact | tao 0.37.1, wry 0.57.0, windows 0.62.2, webview2-com 0.39.1 enter the lock; windows-sys stays at 0.61.2 (21 refs) plus the existing single 0.60.2 (rfd) | `git diff master...pr-322 -- Cargo.lock`; ref counts |
| #322 CI | Test failed on exactly one test: `wayland_titlebar::tests::tao_version_still_needs_the_workaround` ("tao 0.37.1 >= 0.36 ... Complete TODO-0097"); 868/869 backend tests passed; Build jobs skipped | `gh run view 37230681103 --log-failed` |
| Windows pins (must move) | `src-tauri/Cargo.toml:99-108`: `windows-sys = "0.61"`, `webview2-com = "0.38.2"`, `windows = { version = "0.61" }` | Manifest read |
| COM handler | `src-tauri/src/webview_security/windows.rs:17-21` imports `webview2_com::…` and `windows::core::{w, Interface, PWSTR}`; these types must match Tauri's versions | File read; `src-tauri/Cargo.toml:106-108` comment |
| Workaround to delete | `src-tauri/src/wayland_titlebar.rs` (module + guard test); `mod` + call site `src-tauri/src/lib.rs:14,366-368`; `gtk = "0.18"` dep `src-tauri/Cargo.toml:119-125`; CLAUDE.md Gotcha #11; CI xvfb `ci.yml:140-143,200-207` | Greps; `src-tauri/CLAUDE.md` Gotcha #11 |
| TODO-0097 | Open in `docs/todo/TODO.md:56`; acceptance = delete module/mod+call site/gtk dep/guard test/gotcha; drop CI xvfb-run if unused; KDE Plasma 6 / Wayland re-verification | `Select-String docs/todo/TODO.md` |
| Workaround behavior | Under tao ≥ 0.36 the module self-disables (no `EventBox` → `TitlebarFix::None`), so deletion is behavior-preserving | `wayland_titlebar.rs:21-27,55-60` |
| #321 npm dev group | `@mermaid-js/mermaid-cli` 11.17.0→12.0.0; `@types/node` ^26.5.1→^26.6.3; `@vitest/coverage-v8` ^5.0.0→^5.0.2; `typescript-eslint` ^8.70.0→^8.70.1; `vite` ^8.3.0→^8.3.1 | `git diff master...pr-321 -- package.json` |
| #320 npm prod group | `@tauri-apps/api` ^2.11.1→^2.12.0; `@tauri-apps/plugin-dialog` ^2.7.3→^2.8.0; `@tauri-apps/plugin-opener` ^2.5.5→^2.6.0; `browserslist` ^4.28.9→^4.29.1; `dompurify` ^3.4.15→^3.4.16; `marked` ^18.0.13→^18.0.14 | `git diff master...pr-320 -- package.json` |
| #317 | `dompurify` 3.4.15→3.4.16 — fully contained in #320 (superseded) | `git diff master...pr-317 -- package.json` |
| #319 | `ip-address` 10.7.0→10.7.3 lockfile-only; the `^10.5.0` override already allows it (`package.json:61`) | `git diff master...pr-319 -- package-lock.json` |
| #318 | `brace-expansion` 5.0.6→5.0.12; `glob`-nested 2.1.4→2.1.7; `mocha`-nested 2.1.1→2.1.7 (lockfile-only) | `git diff master...pr-318 -- package-lock.json` |
| mermaid-cli 12 breaking flags | Not used by `scripts/render-diagrams.mjs` (uses `-i`, `-o`, `-p`, `--backgroundColor`); requires Node ≥ 22.13 (local: v24.21.0) and Puppeteer ≥ 25 (bun.lock has puppeteer 25.3.0 as the mermaid-cli peer) | `render-diagrams.mjs:94-110`; `node --version`; `bun.lock` |
| mermaid rendering works here | v11 smoke render to a temp file exited 0 (18 KB SVG) | `bun run mmdc -- -i docs/diagrams/context.mmd -o <temp> -p <temp config>` |
| Dependabot PR CI failures on npm PRs | Expected dual-lockfile state (bun.lock and Nix `npmDepsHash` are not updated by Dependabot) | `gh pr checks 317..321`; runbook gotcha |
| Flatpak sources | `cargo-sources.json` / `node-sources.json` are NOT committed; CI generates them from the lockfiles (`.github/workflows/ci.yml:391-395`) | `ci.yml`; `docs/FLATPAK_MAINTENANCE.md:328` |
| Nix hash | Only `npmDepsHash` (`nix/package.nix:62`); no cargo hash | `nix/package.nix` |
| #285 | Already applied as `860c040`; still open because Dependabot never re-evaluated it | `git merge-base --is-ancestor 860c040 master`; `.opencode/package-lock.json:399-401` |

### Hard constraints

1. Do not push — the runbook commits locally only; the user pushes.
2. `windows` / `webview2-com` crates are Tauri-bound: the Tauri 2.12 upgrade dictates `webview2-com 0.39.1` / `windows 0.62`; the pins in `src-tauri/Cargo.toml` must move with it or `webview_security/windows.rs` stops compiling (`procedures/cargo.md` gotcha).
3. Never hand-edit lockfiles; regenerate with the runbook commands. The #322 lockfile is applied from the PR because it is the Tauri upgrade's own resolution (the previous batch's precedent and DEC-003 rationale).
4. The npm command is exactly `npm install --package-lock-only --legacy-peer-deps`; targeted refreshes add `npm update <pkg> --package-lock-only --legacy-peer-deps`.
5. Both npm lockfiles must end aligned; Dependabot only updates `package-lock.json`.
6. `nix/package.nix` `npmDepsHash` cannot refresh on Windows; note it in the commit message (Nix CI patches it on push).
7. Deleting `wayland_titlebar.rs` requires removing every reference: module file, `mod`, call site, `gtk` dep, guard test (inside the module), CLAUDE.md gotcha (with renumbering), CI xvfb, and stale doc references.
8. Commit with the user's real git identity; no LLM co-author.
9. Project tool commands run through `cmd.exe /c`; `cargo` runs bare from the repo root.

## Goal

Integrate the second Dependabot batch (npm #317–#321, cargo #322) into local `master`, including the Tauri 2.12.0 upgrade and the mandated removal of the temporary Wayland title-bar workaround (TODO-0097). Both npm lockfiles stay aligned; the backend compiles and tests on Windows with the Tauri-dictated `windows`/`webview2-com` versions; CI loses only the now-unneeded xvfb plumbing; one `Dependency Update` commit records the batch; #285 is closed as already applied. Nothing is pushed.

## Scope

- PRs #317, #318, #319, #320, #321, #322; cleanup of stale #285.
- Files: `package.json`, `bun.lock`, `package-lock.json`, `Cargo.lock`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/wayland_titlebar.rs` (delete), `.github/workflows/ci.yml`, `src-tauri/CLAUDE.md`, root `CLAUDE.md`, `docs/KNOWN_ISSUES.md`, `docs/decisions/2026-09-schema-forward-compatibility.md`, `docs/archive/backup-adversarial-review-fixes-plan.md`, `docs/todo/TODO.md`, `docs/todo/TODO_ARCHIVE.md`, `CHANGELOG.md`.
- Local commits on `master`; no push.

## Non-Goals

- Pushing to origin; merging GitHub PRs (the user pushes; Dependabot closes superseded PRs afterwards).
- Refreshing `nix/package.nix` `npmDepsHash` (Linux+Nix only; Nix CI patches on push).
- Regenerating the committed diagram SVGs (mermaid 12 changes default themes/layouts; sources are unchanged and `diagrams:check` is hash-based). A smoke render proves the CLI still works.
- Any `flake.nix` / `nix/package.nix` edits.
- Fixing unrelated pre-existing defects.

## Assumptions

- One combined commit matches the repo's convention for multi-ecosystem dependency batches (`24f9af1`, `ee942ad`).
- #317 is fully superseded by #320; Dependabot will close it after the push. It is not applied separately.
- The KDE Plasma 6 / Wayland manual re-verification in TODO-0097 cannot run on this Windows machine; the workaround already self-disabled under tao ≥ 0.36, so removal is behavior-preserving, and the archive entry records the pending Linux verification.
- The local E2E run is required for this batch: a Tauri core + plugin upgrade can affect IPC behavior (Post-Task Best Practices E2E rule).
- Resolved versions may be newer than the PR target when a newer release satisfies the range ("take the highest version"); any such case is recorded in the Decision Log.
- The plan file stays untracked in `docs/plans/` (locally excluded) and is not committed.

## Open Questions

None.

## Milestones

### Milestone 1: npm dependency updates (#317, #318, #319, #320, #321)

- Status: COMPLETED
- Purpose: Apply the prod/dev group bumps plus the two lockfile-only refreshes, and prove both lockfiles agree and the frontend suite passes.
- Exit Criteria: `package.json` carries the union of the #320/#321 bumps; `bun.lock` and `package-lock.json` resolve them, plus `ip-address` 10.7.3 and `brace-expansion` 5.0.12/2.1.7; Flatpak integrity check is complete; the mermaid-cli 12 smoke render exits 0; type-check, lint, and `test:run` exit 0.

#### Task 1.1: Apply package.json bumps (#320, #321; #317 superseded)

- Status: COMPLETED
- Depends On: none
- Objective: `package.json` contains exactly the union of the #320 and #321 range changes.
- Steps:
  1. Dependencies: `@tauri-apps/api` `^2.11.1`→`^2.12.0`; `@tauri-apps/plugin-dialog` `^2.7.3`→`^2.8.0`; `@tauri-apps/plugin-opener` `^2.5.5`→`^2.6.0`; `browserslist` `^4.28.9`→`^4.29.1`; `dompurify` `^3.4.15`→`^3.4.16`; `marked` `^18.0.13`→`^18.0.14`.
  2. DevDependencies: `@mermaid-js/mermaid-cli` `11.17.0`→`12.0.0`; `@types/node` `^26.5.1`→`^26.6.3`; `@vitest/coverage-v8` `^5.0.0`→`^5.0.2`; `typescript-eslint` `^8.70.0`→`^8.70.1`; `vite` `^8.3.0`→`^8.3.1`.
  3. Change only version strings; keep ordering and formatting.
- Validation: `git diff -- package.json` equals the union of `git diff master...pr-320 -- package.json`, `git diff master...pr-321 -- package.json`, and `git diff master...pr-317 -- package.json` (the #317 dompurify line is already inside #320's diff).
- Notes: Do not apply #317 separately; it is redundant with #320.

#### Task 1.2: Regenerate bun.lock and refresh ip-address / brace-expansion

- Status: COMPLETED
- Depends On: 1.1
- Objective: `bun.lock` resolves the new ranges and the two targeted refreshes.
- Steps:
  1. `cmd.exe /c bun install`
  2. `cmd.exe /c bun update ip-address`
  3. `cmd.exe /c bun update brace-expansion`
- Validation: `Select-String -Path bun.lock -Pattern 'ip-address@10.7.3','brace-expansion@5.0.12','brace-expansion@2.1.7','dompurify@3.4.16','marked@18.0.14','vite@8.3.1','mermaid-cli@12.0.0' -SimpleMatch` finds each (a newer resolution is acceptable; record it in the Decision Log). Review `git diff bun.lock` for unexpected changes.
- Notes: bun resolves peer deps (puppeteer stays for mermaid-cli).

#### Task 1.3: Regenerate package-lock.json and refresh the same two packages

- Status: COMPLETED
- Depends On: 1.1
- Objective: `package-lock.json` resolves the new ranges and the two targeted refreshes.
- Steps:
  1. `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`
  2. `cmd.exe /c "npm update ip-address --package-lock-only --legacy-peer-deps"`
  3. `cmd.exe /c "npm update brace-expansion --package-lock-only --legacy-peer-deps"`
- Validation: `node -e "const p=require('./package-lock.json').packages; for (const n of ['@tauri-apps/api','@tauri-apps/plugin-dialog','@tauri-apps/plugin-opener','browserslist','dompurify','marked','@mermaid-js/mermaid-cli','@types/node','@vitest/coverage-v8','typescript-eslint','vite','ip-address']) console.log(n, p['node_modules/'+n]?.version); Object.entries(p).filter(([k])=>k.endsWith('brace-expansion')).forEach(([k,v])=>console.log(k, v.version)); console.log('root', p[''].version)"` shows each at or above target, `ip-address` 10.7.3, `brace-expansion` 5.0.12 and 2.1.7, and root version 0.7.3.
- Notes: `--legacy-peer-deps` stays mandatory (eslint-plugin-solid peers on eslint@^9).

#### Task 1.4: Lockfile integrity and mermaid-cli 12 smoke render

- Status: COMPLETED
- Depends On: 1.2, 1.3
- Objective: Flatpak lock integrity holds and the upgraded diagram tool renders.
- Steps:
  1. Flatpak check: `node -e "const p=require('./package-lock.json').packages; const keys=Object.keys(p).filter(k=>k.startsWith('node_modules/')); const missing=keys.filter(k=>!(p[k].resolved&&p[k].integrity)); console.log('total='+keys.length+' complete='+(keys.length-missing.length)); if(missing.length) console.log(missing.join('\n'))"`
  2. mermaid smoke: create a temp puppeteer config `{"args":["--no-sandbox","--disable-setuid-sandbox"]}` and run `cmd.exe /c bun run mmdc -- -i docs/diagrams/context.mmd -o <temp>.svg -p <temp-config>.json`; then delete the temp files.
- Validation: `complete` equals `total`; the smoke command exits 0 and the output SVG exists. If a field is missing, delete `node_modules/`, run `cmd.exe /c "npm install --legacy-peer-deps"`, then `cmd.exe /c bun install`, and repeat.
- Notes: The render uses the repo's existing diagram source; committed SVGs are not touched.

#### Task 1.5: Frontend validation suite

- Status: COMPLETED
- Depends On: 1.2, 1.3
- Objective: The frontend type-checks, lints, and passes tests with the new resolutions.
- Steps:
  1. `cmd.exe /c bun run type-check`
  2. `cmd.exe /c bun run lint`
  3. `cmd.exe /c bun run test:run`
- Validation: all three commands exit 0.
- Notes: mermaid-cli 12 changes only the diagram tool; no src code should be affected.

### Milestone 2: Tauri 2.12 upgrade (#322)

- Status: TO BE DONE
- Purpose: Apply the Tauri 2.12.0 stack, move the Windows pins to the dictated versions, and remove the Wayland workaround whose trigger has fired.
- Exit Criteria: `Cargo.lock` carries the Tauri 2.12 resolution plus a `mini-diarium` entry on `webview2-com 0.39.1` / `windows 0.62.2` with no `gtk`; every `wayland_titlebar` reference is gone; the backend suite (including the removed guard test) passes; the release-feature build passes on Windows; CI loses only the backend xvfb plumbing; E2E passes locally.

#### Task 2.1: Apply the #322 lockfile and update the Windows pins

- Status: COMPLETED
- Depends On: none
- Objective: The Tauri 2.12 resolution is in place and the app's direct Windows deps match it.
- Steps:
  1. `git restore --source=pr-322 --worktree -- Cargo.lock`
  2. In `src-tauri/Cargo.toml`, change `webview2-com = "0.38.2"` → `"0.39.1"` and `windows = { version = "0.61" }` → `{ version = "0.62" }`; keep `windows-sys = "0.61"` (Tauri still uses 0.61.2).
  3. Run `cargo tree -p mini-diarium --depth 1` to let cargo sync the lock, then inspect `git diff Cargo.lock`.
- Validation: `cargo tree -p mini-diarium --depth 1` shows `webview2-com v0.39.1` and `windows v0.62.2` and no `gtk`; `git diff Cargo.lock` contains the #322 changes plus the `mini-diarium` entry update, with exactly one reference to `windows-sys 0.60.2` (no dedupe churn).
- Notes: This mirrors the previous batch's DEC-003 approach: apply the upgrade's own lockfile rather than re-resolving locally. The `gtk` edge disappears only after Task 2.2 removes the dep; re-run the sync afterwards.

#### Task 2.2: Remove the Wayland title-bar workaround (TODO-0097)

- Status: COMPLETED
- Depends On: 2.1
- Objective: Every trace of the temporary workaround is gone, and its documentation is updated.
- Steps:
  1. Delete `src-tauri/src/wayland_titlebar.rs`.
  2. In `src-tauri/src/lib.rs`, remove `mod wayland_titlebar;` (line 14) and the call site plus its comment (lines ~366-368).
  3. In `src-tauri/Cargo.toml`, remove the `gtk = "0.18"` dependency and its comment block (lines ~119-125).
  4. In `src-tauri/CLAUDE.md`: remove the `wayland_titlebar.rs` row from the module table; delete Gotcha #11; renumber Gotchas #12→#11, #13→#12, #14→#13; update internal references (the backup module row "See Gotcha #12" becomes #11).
  5. Update external references: root `CLAUDE.md` (#14→#13), `docs/decisions/2026-09-schema-forward-compatibility.md` (#14→#13), `docs/archive/backup-adversarial-review-fixes-plan.md` (#12→#11), and fix `docs/KNOWN_ISSUES.md:196` (#11→#8, the Rhai unsafe-impl gotcha it actually means).
  6. Grep the repo for `wayland_titlebar`, `TODO-0097`, and `issue #238`; clean any remaining references (excluding git history).
- Validation: `grep -r "wayland_titlebar"` (excluding `.git`) finds nothing; `Select-String -Pattern 'Gotcha #1[1-4]'` across `*.md` shows only valid, updated references; `cargo tree -p mini-diarium --depth 1` shows no `gtk` after the re-sync.
- Notes: The module self-disabled under tao ≥ 0.36, so behavior is unchanged. The guard test lived inside the deleted file.

#### Task 2.3: Drop the backend xvfb plumbing from CI

- Status: COMPLETED
- Depends On: 2.2
- Objective: The backend Test job no longer installs or wraps xvfb (its only consumer was the deleted GTK test).
- Steps:
  1. In `.github/workflows/ci.yml`, remove the `# xvfb: …` comment and `xvfb` from the Linux system-dependency package list (lines ~140-143).
  2. Replace the xvfb-run comment (lines ~200-204) and change the run command to `cargo llvm-cov nextest --workspace --no-fail-fast --lcov --output-path lcov.info`; keep the `--no-fail-fast` comment.
  3. Leave the E2E job's own xvfb install and `xvfb-run` calls untouched.
- Validation: `cmd.exe /c actionlint .github/workflows/ci.yml` exits 0; `git diff .github/workflows/ci.yml` shows only the backend-job changes.
- Notes: The E2E job keeps its own xvfb install and wrappers; only the backend Test job loses them.

#### Task 2.4: Backend validation

- Status: COMPLETED
- Depends On: 2.2, 2.3
- Objective: The workspace compiles, tests, and lints on Windows with the upgraded Tauri stack and no workaround.
- Steps:
  1. `cargo tree -p mini-diarium --depth 1` (lock re-sync after the `gtk` removal)
  2. `cargo test --workspace`
  3. `cargo build -p mini-diarium --features custom-protocol`
  4. `cargo clippy --workspace --all-targets -- -D warnings`
  5. `cargo fmt --all --check`
- Validation: all commands exit 0; `git diff --stat` lists the expected files; the lock diff still shows no windows-sys dedupe.
- Notes: This is the decisive Windows compile check that the skipped Dependabot Build job could not provide.

#### Task 2.5: Local E2E run

- Status: COMPLETED
- Depends On: 2.4
- Objective: IPC and app-shell behavior survive the Tauri core + plugin upgrade.
- Steps:
  1. `cmd.exe /c bun run test:e2e:local`
- Validation: exit 0.
- Notes: Required by the Post-Task E2E rule for dependency updates that touch Tauri APIs/plugins. If the local harness cannot run, record a Decision Log entry and rely on CI.

### Milestone 3: Wrap-up

- Status: COMPLETED
- Purpose: Record the batch, retire the stale PR and TODO, and prove the final state.
- Exit Criteria: TODO-0097 archived; one `Dependency Update` commit with the expected files; #285 closed; `pr-*` branches gone; pre-flight checks pass; plan COMPLETED.

#### Task 3.1: Archive TODO-0097

- Status: COMPLETED
- Depends On: 2.2
- Objective: TODO-0097 is marked done and archived with the pending KDE verification noted.
- Steps:
  1. Load the `todo-manager` skill and follow its archive workflow for TODO-0097.
  2. Record in the archive entry that the KDE Plasma 6 / Wayland manual re-verification remains a follow-up on a Linux machine.
- Validation: `docs/todo/TODO.md` no longer lists TODO-0097; the archive entry exists.
- Notes: Never assign TODO IDs by hand; use the skill.

#### Task 3.2: CHANGELOG entry and combined commit

- Status: COMPLETED
- Depends On: 1.5, 2.5, 3.1
- Objective: A single local commit records the batch with the repo's conventions.
- Steps:
  1. Append to `CHANGELOG.md` under `## [0.7.4] - [Unreleased]` → `### Internal`:
     - `- **Dependency updates (Dependabot #317, #318, #319, #320, #321, #322)**: Frontend bumps for `@tauri-apps/api` (2.12.0), `@tauri-apps/plugin-dialog` (2.8.0), `@tauri-apps/plugin-opener` (2.6.0), `browserslist` (4.29.x), `dompurify` (3.4.16), `marked` (18.0.14), `@mermaid-js/mermaid-cli` (12.0.0, major), `@types/node` (26.6.x), `@vitest/coverage-v8` (5.0.x), `typescript-eslint` (8.70.x), and `vite` (8.3.x); targeted lockfile refreshes for `ip-address` (10.7.3) and `brace-expansion` (5.0.12 / 2.1.7). The Rust side upgrades to Tauri 2.12.0 (`tauri`, `tauri-build`, opener/dialog/window-state plugins) with the Windows pins moved to `webview2-com` 0.39.1 / `windows` 0.62; the workspace suite and the release-feature build pass. The `nix/package.nix` `npmDepsHash` needs a Linux-side refresh — the Nix CI workflow patches it automatically on push.`
     - `- **Wayland title-bar workaround removed (TODO-0097)**: Tauri 2.12 ships tao 0.37.1, which includes the upstream fix (tao#1218, issue #238). `src-tauri/src/wayland_titlebar.rs`, its module and call site, the Linux-only `gtk` dependency, its guard test, the CI xvfb plumbing it needed, and the matching CLAUDE.md gotcha are removed. The workaround already self-disabled under tao ≥ 0.36; KDE Plasma 6 / Wayland re-verification is a follow-up on a Linux machine.`
  2. Stage exactly the changed files (npm lockfiles, Cargo files, `src-tauri/src/lib.rs`, deleted `wayland_titlebar.rs`, `ci.yml`, the doc updates, `CHANGELOG.md`).
  3. Commit with the user's identity, no push; subject `Dependency Update: Tauri 2.12, prod/dev tooling, ip-address, brace-expansion; remove Wayland title-bar workaround (TODO-0097)`; body lists the PRs and the npmDepsHash note.
- Validation: `git log -1 --stat` lists exactly the expected files; `git show -s --format=%B HEAD` shows the message; `git status --porcelain` prints nothing.
- Notes: One combined commit follows `24f9af1`/`ee942ad`.

#### Task 3.3: Close the stale #285 PR

- Status: COMPLETED
- Depends On: none
- Objective: The already-applied PR is closed with an explanatory comment.
- Steps:
  1. `gh pr close 285 --comment "Already applied as 860c040; .opencode/package-lock.json resolves toml 4.3.0 on master."`
- Validation: `gh pr view 285 --json state --jq .state` prints `CLOSED`.
- Notes: Dependabot never re-evaluated this branch, so it stayed open after the earlier integration.

#### Task 3.4: Cleanup and final verification

- Status: COMPLETED
- Depends On: 3.2, 3.3
- Objective: Only intentional artifacts remain, and the plan closes accurately.
- Steps:
  1. Delete the inspection branches: `git branch -D pr-317 pr-318 pr-319 pr-320 pr-321 pr-322`.
  2. Verify `.git/info/exclude` contains exactly one `docs/plans/` line (remove duplicates the generator may have appended).
  3. Run every item in `## Pre-flight Checks` and `## Final Verification`.
  4. Set the plan and all tasks/milestones to COMPLETED.
- Validation: `git branch --list 'pr-*'` prints nothing; `git status --porcelain` prints nothing; all pre-flight commands exit 0; plan metadata shows COMPLETED.
- Notes: Keep the plan file (locally excluded execution ledger).

## Project Gates

- Runbook `apply-dependency-prs` governs: npm first, then cargo; npm uses exactly `npm install --package-lock-only --legacy-peer-deps`; the #322 lockfile is applied from the PR (upgrade-owned resolution).
- `windows`/`webview2-com` must follow the Tauri version (`procedures/cargo.md`); `windows-sys` stays 0.61 while Tauri uses 0.61.2.
- CHANGELOG entry required for dependency commits (repo convention: `24f9af1`, `ee942ad`, `8311612`).
- Commit with the user's git identity; no LLM co-author; no push.
- `nix/package.nix` `npmDepsHash` refresh is Linux+Nix only; the commit message notes it.
- E2E is required for this batch (Tauri core + plugins touch IPC); run `test:e2e:local` before the commit.
- TODO operations go through the `todo-manager` skill.

## Pre-flight Checks

Run before the plan may reach `COMPLETED`:

- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cargo test --workspace`
- [ ] `cargo build -p mini-diarium --features custom-protocol`
- [ ] `cmd.exe /c actionlint .github/workflows/ci.yml`
- [ ] `cmd.exe /c bun run diagrams:check`
- [ ] `git status --porcelain` prints nothing (clean worktree; the plan file is locally excluded)

## Decision Log

Write an entry **before moving to the next task**, never retrospectively. An entry is required when implementation diverges from what this plan specifies, when a validation failure forces the plan to adapt, when an unplanned problem is found, or when a validation is deliberately deferred. No entry is needed when execution matches the plan.

(No entries yet.)

### DEC-001 — npm resolutions exceed some PR targets

- Date: 2026-10-04
- Task: 1.2, 1.3
- Decision: Keep the latest versions allowed by the new ranges (`@tauri-apps/api` 2.12.1, `@types/node` 26.6.4, `@vitest/coverage-v8` 5.0.3, `typescript-eslint` 8.71.0, `vite` 8.3.2, `@tauri-apps/plugin-dialog` 2.8.1, `@tauri-apps/plugin-opener` 2.7.0, `browserslist` 4.29.3 — newer than the PR-target minimums).
- Rationale: `procedures/npm.md` Phase 1 step 5 (take the highest version). bun reported a peer warning (`@vitest/coverage-v8` 5.0.3 peers on vitest 5.0.3; installed vitest is 5.0.1); the suite passes and `test:run` does not use coverage, so the warning is accepted and will clear on the next vitest bump.

### DEC-002 — Tauri plugin pair mismatch fixed by pinning the JS opener to the Rust minor

- Date: 2026-10-04
- Task: 2.5
- Decision: Pin `@tauri-apps/plugin-opener` to `~2.6.0` (was `^2.6.0`, which resolved 2.7.0) so it pairs with the Rust `tauri-plugin-opener` 2.6.0 that PR #322 selected.
- Rationale: The Tauri CLI refuses to build when a plugin's JS and Rust versions differ in major/minor (`tauri-plugin-opener (v2.6.0) : @tauri-apps/plugin-opener (v2.7.0)`). The Rust side sits at the 7-day cooldown boundary from `.github/dependabot.yml` (2.7.0 published 2026-09-29); adopting 2.7.0 on the Rust side would violate that policy, so the JS side moves down instead. `tauri-plugin-dialog` (JS 2.8.1 / Rust 2.8.0) shares the same minor and passes the CLI check.

## Final Verification

Performed by Task 3.4:

- `git log -1 --stat` shows exactly the expected files (npm lockfiles, Cargo files, `lib.rs`, deleted `wayland_titlebar.rs`, `ci.yml`, doc updates, `CHANGELOG.md`, TODO archive).
- Resolved-version checks from Tasks 1.2, 1.3, 1.4, and 2.1 are re-run and pass.
- `git status --porcelain` prints nothing; `gh pr list --state open` shows no applied dependency PR still open except ones Dependabot will close on its next evaluation.
- All `## Pre-flight Checks` pass.

## Approval Gate

Approved by Francisco J. Revoredo on 2026-10-04.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python scripts/check-plan.py docs/plans/2026-10-04-integrate-second-dependabot-batch-and-tauri-2-12-upgrade-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-10-04

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
