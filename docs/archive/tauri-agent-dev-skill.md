# tauri-agent-dev Skill

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-22
- Last Updated: 2026-05-22 (sandbox journal config + WebView storage isolation added; full smoke test completed)
- Owner: Coding agent
- Approval: APPROVED

## Implementation Status

- **2026-05-22**: Self-check completed. Plan revised to drop Milestone 3 (Playwright fallback) after confirming `agent-browser connect <port|url>` is available. Script runner convention pinned to `npx tsx`. The initial assumption that `MINI_DIARIUM_DATA_DIR` alone would avoid sandbox config seeding was later disproven during smoke testing and corrected in the final implementation.
- **2026-05-22**: Attempted Milestone 1 CDP smoke probe. Blocked: port 1420 (Vite dev server) was already held by an active `tauri dev` session belonging to the user (node PID 19076). User chose to pause all implementation work rather than have the agent kill their running session. No files written; one scratch log file (`.agent-dev-probe.log`) created at repo root from the failed probe attempt and pending cleanup.
- **2026-05-22**: User asked to continue. Pre-resume check found no listeners on ports 1420/1421/9222/9223, so the original Milestone 1 blocker is cleared and the CDP smoke probe can proceed.
- **2026-05-22**: Milestone 1 completed. Running `tauri dev` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` exposed `http://localhost:9222/json/version` and `http://localhost:9222/json`; the page target URL was `http://localhost:1420/`. Teardown via `taskkill /F /T` succeeded and left ports 1420/1421/9222/9223 unbound.
- **2026-05-22**: Task 2.1 completed. `npx tsx scripts/agent-dev/start.ts --timeout 180` launched a sandboxed `tauri dev`, wrote `.agent-dev/state.json`, and exposed the expected CDP browser/page websocket URLs for `http://localhost:1420/`.
- **2026-05-22**: Task 2.2 completed after hardening the process model. On Windows, the initial launcher PID exits early, so `start.ts` now records the two durable child roots (`cmd /S /C "bun run dev"` and `cargo run ...`) as `managed_pids`. `stop.ts` kills every recorded root, verifies port 9222 is closed, and only then removes sandbox/state.
- **2026-05-22**: Task 2.3 completed. `npx tsx scripts/agent-dev/probe.ts` reports one-line JSON health for a live sandboxed session and correctly resolves the page target even when startup first reaches the browser CDP endpoint before `/json` exposes the app page.
- **2026-05-22**: Task 2.4 completed. `bun run agent:dev:start --help`, `bun run agent:dev:stop --help`, and `bun run agent:dev:probe --help` all execute through `package.json`.
- **2026-05-22**: Task 2.5 completed and Milestone 2 exit criteria satisfied. A full `bun run agent:dev:start` → `bun run agent:dev:probe` → `bun run agent:dev:stop` cycle succeeded, and `git status --short` did not surface `.agent-dev/`.
- **2026-05-22**: Task 4.1 completed. `skill-creator` initialized `.agents/skills/tauri-agent-dev/`; the draft `SKILL.md` was replaced with a repo-specific Windows-only workflow, validated with `quick_validate.py`, and `agents/openai.yaml` was corrected to keep the literal `$tauri-agent-dev` prompt.
- **2026-05-22**: Tasks 4.3 and 4.4 completed. `tauri-agent-dev` is not in `PLUGIN_SKILLS`, `bun run sync-skills` linked it into `.claude/skills/tauri-agent-dev`, and the linked `SKILL.md` resolves correctly.
- **2026-05-22**: Task 4.2 completed. The drafted skill was exercised in a real session, adjusted to document sandbox journal config seeding and WebView storage isolation, and no further wording changes were requested before continuing implementation.
- **2026-05-22**: Follow-up hardening after the first smoke attempts: `start.ts` now seeds `sandbox/app/config.json` with one active journal because `initializeAuth()` still depends on journal metadata even when `MINI_DIARIUM_DATA_DIR` overrides the backend DB path.
- **2026-05-22**: Follow-up hardening after the first smoke attempts: agent-dev sandboxing now isolates browser-side state too. `start.ts` sets `MINI_DIARIUM_WEBVIEW_DATA_DIR`, and `src-tauri/src/lib.rs` applies `WebviewWindowBuilder::data_directory(...)`, so fresh sandboxes no longer inherit stale `localStorage` preferences such as aggressive auto-lock timers.
- **2026-05-22**: Milestone 5 completed. Real UI smoke test succeeded against a live sandboxed dev app: created a password journal, opened Preferences → Security, enabled **Lock after inactivity**, clicked Save, verified `JSON.parse(localStorage.getItem('preferences')).autoLockEnabled === true`, reopened Preferences → Security, confirmed the checkbox remained checked, and captured a screenshot at `.agent-dev/smoke-autolock-preferences.png`.
- **2026-05-22**: Task 5.2 completed after a delayed recheck. An immediate process/port sample raced the shutdown, but the follow-up verification showed no live `bun`/`cargo`/`mini-diarium` processes, only `TIME_WAIT` sockets, and `bun run agent:dev:probe` correctly returned `{"running":false,"reason":"no state file"}`.

## Self-Check Findings (2026-05-22)

Empirical verifications performed before approval:

- **`agent-browser connect <port|url>` is a real, documented command.** Verified via `agent-browser --help` and `agent-browser skills get electron`. The electron skill explicitly documents the launch-with-remote-debugging-port + connect pattern, which is exactly what we need. **Milestone 3 (Playwright fallback wrapper) is now SKIPPED.**
- **Backend DB path override is only half the story.** `MINI_DIARIUM_DATA_DIR` makes the backend use `<dir>/diary.db` directly (`src-tauri/src/lib.rs:142-147`), but frontend startup still depends on `list_journals()` / `active_journal_id` from `config.json` (`src/state/auth.ts`). So sandbox mode must seed `sandbox/app/config.json` with one active journal. Fresh sandbox then lands on PasswordCreation; a reused sandbox lands on PasswordPrompt.
- **`bun run tauri` → `bun scripts/tauri-dev.js` → `bun x tauri dev`**, spreading `process.env`. Our env vars (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, `MINI_DIARIUM_DATA_DIR`, `MINI_DIARIUM_APP_DIR`) propagate cleanly.
- **Script runner: `npx tsx`** is the project convention for `.ts` scripts (used by `validate-locales.ts` and `sync-languages.ts`). Use it here too.
- **`sync-skills.js`** links via NTFS junction on Windows from `.agents/skills/<name>/` to `.claude/skills/<name>/`. `tauri-agent-dev` is not in `PLUGIN_SKILLS` — no collision.
- **Vite HMR risk overblown.** Vite swaps modules within a stable page target; CDP target ID does not change. Retry-on-disconnect was over-engineering. Drop it from the plan; add only if M5 smoke test surfaces a real issue.
- **WebView state needs its own sandbox too.** Without a dedicated WebView data dir, `localStorage` leaks across runs and can re-enable old preferences such as a 5-second auto-lock timer. Final implementation sets `MINI_DIARIUM_WEBVIEW_DATA_DIR` and uses `WebviewWindowBuilder::data_directory(...)` to keep browser-side state inside `.agent-dev/sandbox/webview/`.
- **PowerShell `@`-ref gotcha** — agent-browser's own SKILL.md documents that `@e174` must be single-quoted in PowerShell. Surface this in our SKILL.md (user is on Windows).

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Give the coding agent a reliable, repeatable way to spawn the Mini Diarium Tauri v2 dev binary, drive its UI programmatically (click/type/eval/screenshot/inspect `localStorage`), and tear it down cleanly — so that UI bug verification ("does the auto-lock toggle actually persist?") can be done by the agent end-to-end without the human in the loop. Targets Windows-only for v1 because that's where the WebView2-CDP path works; macOS and Linux are out of scope.

This complements — does not replace — the existing `tauri-driver` + WebdriverIO E2E harness, which remains the CI/regression layer. This skill is for ad-hoc manual-style probing during a coding session.

## Scope

- New skill directory `.agents/skills/tauri-agent-dev/` with `SKILL.md` describing the workflow.
- Three new repo scripts under `scripts/agent-dev/`: `start.ts`, `stop.ts`, `probe.ts`.
- Optionally a fourth script `control.ts` only if the validation step in Milestone 1 confirms `agent-browser` cannot speak raw CDP. Decided at implementation time, not pre-committed.
- Three new package.json npm scripts: `agent:dev:start`, `agent:dev:stop`, `agent:dev:probe`.
- `.gitignore` entry for `.agent-dev/` (state file + sandbox dirs).
- Skill triggers on phrases like "manually test", "drive the dev app", "verify in the real UI", "agent dev mode", "spawn the dev app", "open the running app and check…".
- Reuse existing env-var sandbox: `MINI_DIARIUM_DATA_DIR`, `MINI_DIARIUM_APP_DIR`, and `MINI_DIARIUM_WEBVIEW_DATA_DIR` set to `.agent-dev/sandbox/` by default so DB/config/browser state all stay isolated. Opt-in `--use-real-config` flag for the rare case where a bug only repros against real state.
- Sync skill via `bun run sync-skills` (project's existing pipeline that links `.agents/skills/` into `.claude/skills/`).

## Non-Goals

- Do NOT add macOS or Linux support. WKWebView has no remote debugging; WebKitGTK uses a different protocol. Start scripts must exit early on these platforms with a clear message.
- Do NOT replace or modify the existing `wdio.conf.ts` E2E harness.
- Do NOT set `MINI_DIARIUM_E2E=1`. That env var forces an 800×660 viewport and disables `tauri-plugin-window-state` — wrong for interactive driving where the agent needs realistic UI sizing.
- Do NOT bundle or wrap the `agent-browser` skill. It's already a separate skill; this skill provides only the spawn/sandbox layer and points `agent-browser` at the CDP endpoint.
- Do NOT support production builds. Dev only.
- Do NOT implement recording/playback of agent sessions.
- Do NOT publish this skill outside the repo. Internal tooling only.

## Assumptions

- The user is on Windows 10/11 with WebView2 installed (confirmed: project's primary dev environment).
- WebView2 honors `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` and exposes a CDP endpoint at `http://localhost:<port>/json/version` once the webview is ready. (Standard Chromium flag pass-through; documented behavior.)
- `bun run tauri dev` is the canonical dev command (already wired in `package.json`).
- The existing env-var contract `MINI_DIARIUM_DATA_DIR` / `MINI_DIARIUM_APP_DIR` (read only in `src-tauri/src/lib.rs`) is sufficient for a clean sandboxed config — confirmed by the E2E setup in `wdio.conf.ts:254-270`.
- Port 9222 (default Chrome remote-debugging port) does not collide with any other dev tool the user runs. Configurable via env var or CLI flag for the edge case where it does.
- Port 4444 (tauri-driver) is reserved by E2E; we use 9222 to avoid stomping on it. Both can run simultaneously in principle.
- The `agent-browser` skill listed in this project's available skills can connect to a custom CDP endpoint (`connectOverCDP(http://localhost:9222)`). This is the central technical assumption — Milestone 1 validates it before any other work proceeds.
- Vite's HMR will occasionally tear down + reattach the CDP target on hot reload. The wrapper / usage docs note this and instruct the agent to retry on disconnect.
- `tsx` is available as a runtime for `.ts` scripts (already used by other repo scripts; confirm in package.json before relying on it).

## Open Questions

- None settled at plan-draft time. One discovery moment is Milestone 1 (agent-browser CDP support); the rest of the plan branches on its outcome.

## Milestones

### Milestone 1: Verify WebView2 CDP Exposure (Smoke Spike)

- Status: COMPLETED
- Purpose: Empirically confirm WebView2 honors `--remote-debugging-port` in this project's `tauri dev` setup. (Agent-browser CDP support already confirmed in self-check — no need to probe.)
- Exit Criteria: `curl http://localhost:9222/json/version` returns a CDP version JSON payload while `bun run tauri dev` is running with the env var set.

#### Task 1.1: One-shot CDP probe

- Status: COMPLETED
- Objective: Confirm WebView2 honors `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and exposes CDP.
- Steps:
  1. In PowerShell: `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"; bun run tauri dev` (run in background, redirect stdout).
  2. Wait ~30-90s for cold build to complete and the app window to appear.
  3. In another shell: `curl http://localhost:9222/json/version`.
  4. Expect JSON with `Browser`, `Protocol-Version`, `webSocketDebuggerUrl` fields.
  5. Also `curl http://localhost:9222/json` to see the list of page targets — confirm one of them has a URL matching `http://localhost:1420` (Vite dev) or similar Tauri-served URL.
  6. Stop the dev process (`taskkill /F /T /PID <pid>`).
- Validation: CDP version JSON returned successfully AND `/json` lists at least one page target on the expected URL. If either fails, the skill is blocked — escalate before proceeding.
- Notes: Single ~5 min spike. If this works, all of Milestone 2 onward is well-founded.

### Milestone 2: Build the Spawn / Stop / Probe Scripts

- Status: COMPLETED
- Purpose: Implement the three core scripts under `scripts/agent-dev/` that handle the dev process lifecycle.
- Exit Criteria: `bun run agent:dev:start` spawns dev with CDP + sandbox, `bun run agent:dev:probe` confirms it's reachable, `bun run agent:dev:stop` kills it and cleans up. All three scripts pass Pre-flight Checks.

#### Task 2.1: Implement `scripts/agent-dev/start.ts`

- Status: COMPLETED
- Objective: Spawn `bun run tauri dev` as a background child process with CDP enabled and a sandboxed config dir; poll the CDP endpoint until ready; persist process state.
- Steps:
  1. Create `scripts/agent-dev/` directory.
  2. Parse CLI flags: `--port <N>` (default 9222), `--use-real-config` (default false), `--timeout <seconds>` (default 120 — generous for cold Cargo builds).
  3. Refuse to run on non-Windows: `if (process.platform !== 'win32') { console.error('tauri-agent-dev is Windows-only for v1. macOS WKWebView has no CDP; Linux WebKitGTK uses a different protocol.'); process.exit(2); }`.
  4. Idempotency check: read `.agent-dev/state.json` if present. If a recorded PID is still alive AND `http://localhost:<port>/json/version` responds, print `reusing existing dev instance: pid=<...> port=<...>` and exit 0 without spawning.
  5. Unless `--use-real-config`, create `.agent-dev/sandbox/data/`, `.agent-dev/sandbox/app/`, and `.agent-dev/sandbox/webview/` (mkdirSync recursive). Seed `sandbox/app/config.json` with one active journal if it is missing or has no active journal, so the frontend auto-selects the sandbox journal instead of falling back to JournalPicker. The first time the app starts against an empty sandbox, the user lands on PasswordCreation; subsequent starts on PasswordPrompt.
  6. Spawn `bun run tauri dev` via `child_process.spawn` with:
     - `env`: `{ ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=<port>', MINI_DIARIUM_DATA_DIR: <sandbox/data>, MINI_DIARIUM_APP_DIR: <sandbox/app>, MINI_DIARIUM_WEBVIEW_DATA_DIR: <sandbox/webview> }` (omit the three MINI_DIARIUM_* vars if `--use-real-config`).
     - `stdio: ['ignore', <log file>, <log file>]` — write stdout/stderr to `.agent-dev/dev.log` for post-mortem.
     - `detached: false` so `taskkill /T` walks the tree cleanly.
     - `shell: true` (Windows needs this to resolve `bun`).
  7. Poll `http://localhost:<port>/json/version` every 500 ms for up to `--timeout` seconds. Use Node's built-in `fetch` (works in Node ≥18 and Bun).
  8. After version check passes, also fetch `http://localhost:<port>/json` and pick the first target whose URL starts with `http://localhost:1420` (Tauri dev URL — confirm port via `tauri.conf.json`). Store its `webSocketDebuggerUrl` as the page target. If no matching target, print a warning and fall back to the browser-level WS from `/json/version`.
  9. Write `.agent-dev/state.json`:
     ```json
     {
       "pid": <number>,
       "port": <number>,
       "cdp_http": "http://localhost:<port>",
       "cdp_browser_ws": "<from /json/version>",
       "cdp_page_ws": "<from /json target>",
       "page_url": "<the matched target URL>",
       "sandbox": { "data_dir": "<abs path>", "app_dir": "<abs path>" } | null,
       "started_at": "<ISO8601>"
     }
     ```
  10. Print a human-readable summary to stdout including the `agent-browser connect <port>` command to copy-paste:
      ```
      Tauri dev running.
      PID:  12345
      CDP:  http://localhost:9222
      Sandbox: D:\Repos\mini-diarium\.agent-dev\sandbox\
      Next:  agent-browser connect 9222
      Stop:  bun run agent:dev:stop
      ```
  11. On timeout or non-zero child exit during boot, kill the process tree (`spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)])`) and exit 1 with the last ~40 lines of `.agent-dev/dev.log`.
- Validation: `bun run agent:dev:start` exits 0 with state file written and `agent-browser connect <port> && agent-browser snapshot` succeeds. Re-running while alive prints "reusing" and exits 0.
- Notes: Run via `npx tsx scripts/agent-dev/start.ts` per project convention. The Tauri dev URL in step 8 is currently 1420 (Vite default for Tauri); verify against `vite.config.ts` before hardcoding.

#### Task 2.2: Implement `scripts/agent-dev/stop.ts`

- Status: COMPLETED
- Objective: Read state file, kill the dev process tree, clean up sandbox.
- Steps:
  1. Read `.agent-dev/state.json`. If missing, log "no dev instance recorded" and exit 0 (idempotent).
  2. Kill the process tree on Windows: `spawnSync('taskkill', ['/F', '/T', '/PID', String(state.pid)])`. Tolerate non-zero exit codes (process may have already died).
  3. Parse CLI: `--keep-sandbox` keeps `.agent-dev/sandbox/`; otherwise remove it (`rmSync` recursive). Also keep `.agent-dev/dev.log` (don't auto-delete — useful for post-mortem).
  4. Remove `.agent-dev/state.json`.
  5. Verify the port is no longer bound (best-effort: `await fetch(...)` should fail). Log the final state.
- Validation: After `bun run agent:dev:stop`, port 9222 has no listener, sandbox dirs are gone (unless `--keep-sandbox`), state file is gone.
- Notes: The dev process spawns several children (Vite, Cargo, Tauri host). `/T` is essential — without it, only `bun` dies and the rest orphan.

#### Task 2.3: Implement `scripts/agent-dev/probe.ts`

- Status: COMPLETED
- Objective: Quick sanity check for the agent. Is dev running? Is CDP reachable? Is it OUR dev (not a stray Chromium)?
- Steps:
  1. Read `.agent-dev/state.json`. If missing: print `{"running": false, "reason": "no state file"}` and exit 1.
  2. Check PID alive: `process.kill(pid, 0)` throws if dead. Catch → exit 1 with reason "pid not alive".
  3. Fetch `http://localhost:<port>/json/version` with a 2-second timeout. On failure → exit 1 with reason "cdp unreachable".
  4. Fetch `http://localhost:<port>/json` and confirm at least one target's URL starts with `http://localhost:1420` (the Tauri dev URL we recorded in state.page_url). This rules out the false-positive case where 9222 is held by an unrelated Chrome/Edge that happened to grab it.
  5. Print one-line JSON: `{"running": true, "pid": ..., "port": ..., "page_url": "...", "uptime_seconds": ...}` and exit 0. On any check failure, print `{"running": false, "reason": "..."}` and exit 1.
- Validation: Exit code 0 ⟺ dev is healthy AND CDP responds AND the target is our app. Useful both for the agent's pre-action check and for shell scripting.
- Notes: One-line JSON output is intentional — easy for the agent to parse with `| jq .running` or grep.

#### Task 2.4: Wire npm scripts in package.json

- Status: COMPLETED
- Objective: Expose the three scripts as `bun run` targets.
- Steps:
  1. Add to `package.json` scripts (matches `validate:locales` / `sync-languages` style):
     - `"agent:dev:start": "npx tsx scripts/agent-dev/start.ts"`
     - `"agent:dev:stop": "npx tsx scripts/agent-dev/stop.ts"`
     - `"agent:dev:probe": "npx tsx scripts/agent-dev/probe.ts"`
- Validation: `bun run agent:dev:start --help` runs and shows usage; same for stop/probe.
- Notes: Keep flag parsing minimal — `process.argv` slicing is fine; no need for `commander` or `yargs`. `npx tsx` resolves tsx on demand; no devDep change needed.

#### Task 2.5: Add `.gitignore` entry

- Status: COMPLETED
- Objective: Keep agent runtime state out of git.
- Steps:
  1. Append to `.gitignore`:
     ```
     # tauri-agent-dev runtime state + sandbox
     .agent-dev/
     ```
- Validation: `git status` after a `bun run agent:dev:start` shows no new tracked files.
- Notes: None.

### Milestone 3: ~~Build the Fallback `control.ts` Wrapper~~ (SKIPPED)

- Status: SKIPPED
- Reason: Self-check (2026-05-22) confirmed `agent-browser connect <port|url>` is a real, documented command (verified via `agent-browser --help` and `agent-browser skills get electron`). The electron-specialized skill explicitly documents the launch-with-remote-debugging-port + connect pattern — that's our exact use case. The Playwright fallback is not needed.
- Implication: No new dependency added. SKILL.md (Milestone 4) points directly at `agent-browser connect <port>` for all UI driving.

### Milestone 4: Author the Skill via `skill-creator`

- Status: COMPLETED
- Purpose: Use `skill-creator` as a *drafting assistant* for `SKILL.md` — leverage its anatomy/format/writing-style guidance and its description-field conventions. Do NOT run its full eval/iterate loop; we will judge skill performance organically the first time we use it for real (Milestone 5).
- Exit Criteria: `bun run sync-skills` links the skill into `.claude/skills/` and it loads without warnings. User has reviewed and approved the SKILL.md draft.

#### Task 4.1: Invoke `skill-creator` for SKILL.md drafting only

- Status: COMPLETED
- Objective: Hand skill-creator the intent + context so it produces a well-structured `SKILL.md` draft following its conventions for frontmatter, progressive disclosure, and triggering language. Skip the eval/test-prompts/iteration phases of skill-creator's full workflow.
- Steps:
  1. Tell skill-creator explicitly: "draft mode only — no eval loop, no benchmark, no test prompts. The user will judge it in real use."
  2. Pass it the finalized inputs:
     - **Purpose**: spawn Tauri dev, drive UI via agent-browser CDP, tear down. Windows-only v1.
     - **Triggers**: "manually test the UI", "drive the dev app", "verify in the real UI", "agent dev mode", "spawn the dev app", "open the running app and check…", "actually try it in the app".
     - **Script contract from Milestone 2**: `bun run agent:dev:start [--port N] [--use-real-config] [--timeout S]`, `bun run agent:dev:stop`, `bun run agent:dev:probe`. State file at `.agent-dev/state.json`.
     - **UI driving via agent-browser** (confirmed): `agent-browser connect <port>` then snapshot/click/fill/eval/screenshot.
     - **Canonical data-testids** from `src/CLAUDE.md` (do not invent): `password-create-input`, `password-repeat-input`, `create-journal-button`, `password-unlock-input`, `unlock-journal-button`, `title-input`, `calendar-day-YYYY-MM-DD`, `toggle-sidebar-button`, `lock-journal-button`, `entry-nav-bar`, `entry-prev-button`, `entry-next-button`, `entry-add-button`, `entry-delete-button`, `entry-number-button-{N}`.
     - **Powershell gotcha**: `@e174` refs must be single-quoted on Windows (e.g. `agent-browser click '@e5'`).
  3. Specify the required structural sections:
     - Platform support (Windows-only; why macOS/Linux fail)
     - Recipe: Start a session (start, probe, `agent-browser connect <port>`)
     - Recipe: Drive the UI (snapshot, click, fill, eval, screenshot)
     - Recipe: Common flows ((a) create+unlock journal, (b) navigate to Preferences → Security, (c) read/write `localStorage.getItem('preferences')`, (d) capture screenshot)
     - Recipe: End the session (`bun run agent:dev:stop`, non-optional)
     - Sandbox semantics (default sandboxed; opt-in `--use-real-config`)
     - Troubleshooting (port collision → `--port 9223`; first start 30-90s cold; PowerShell @-ref quoting; orphan check)
     - What this skill does NOT do (replace CI E2E, work on mac/linux, drive prod builds)
  4. Let skill-creator write the draft to `.agents/skills/tauri-agent-dev/SKILL.md`.
- Validation: SKILL.md exists with valid frontmatter, body under 500 lines, all required sections present. No `evals/` directory created.
- Notes: Skill-creator will likely ask clarifying questions during its "Capture Intent" step. Answer from this plan rather than re-deciding. If it insists on running the eval loop, refuse — the user has explicitly opted out.

#### Task 4.2: User review of the draft

- Status: COMPLETED
- Objective: Get the user's eyes on the SKILL.md draft before linking it into the active skill set. This replaces the formal eval loop with a quick read-through.
- Steps:
  1. Present the draft (path + key excerpts: frontmatter, recipe titles, trigger language).
  2. Apply any requested edits inline.
- Validation: User continues implementation after the draft is exercised and no wording changes are requested.
- Notes: Keep this fast — minutes, not iterations.

#### Task 4.3: Check PLUGIN_SKILLS exclusion list for name collision

- Status: COMPLETED
- Objective: Confirm `tauri-agent-dev` isn't already provided by a plugin (per CLAUDE.md gotcha #3).
- Steps:
  1. Read `scripts/sync-skills.js`'s `PLUGIN_SKILLS` list.
  2. Confirm no collision. If there is one, rename (e.g. `mini-diarium-agent-dev`) and update artifacts accordingly.
- Validation: `bun run sync-skills` runs without ambiguity warnings.
- Notes: Low risk — `tauri-agent-dev` is project-specific.

#### Task 4.4: Run `bun run sync-skills` and verify linkage

- Status: COMPLETED
- Objective: Link the skill into `.claude/skills/` so it's discoverable in the next session.
- Steps:
  1. `bun run sync-skills`.
  2. Verify `.claude/skills/tauri-agent-dev/SKILL.md` exists (or is symlinked).
- Validation: The skill appears in the next session's skill list.
- Notes: Performance / triggering accuracy will be judged during Milestone 5's first real use. If triggering is poor in practice, revisit skill-creator's description optimizer as a follow-up.

### Milestone 5: Smoke Test the Full Flow

- Status: COMPLETED
- Purpose: End-to-end exercise the skill against the live app to confirm it actually solves the original problem (the auto-lock bug verification from the conversation that triggered this work).
- Exit Criteria: The agent successfully spawns the dev app, drives it through the auto-lock toggle + Save + re-open flow, reads `localStorage` to confirm `autoLockEnabled: true`, and tears down — all without manual intervention.

#### Task 5.1: Run the autolock-verification recipe

- Status: COMPLETED
- Objective: Validate the skill against the actual scenario that motivated it.
- Steps:
  1. `bun run agent:dev:start` (with sandbox).
  2. Use agent-browser to:
     - Start from the seeded sandbox journal config and create a password journal in the real UI.
     - Open Preferences → Security tab.
     - Toggle "Lock after inactivity" on.
     - Click Save.
     - Read `localStorage.getItem('preferences')`.
     - Assert `autoLockEnabled` is `true`.
     - Re-open Preferences → Security and confirm the checkbox is still checked.
     - Take a screenshot.
  3. `bun run agent:dev:stop`.
- Validation: All assertions pass. Screenshot captured. No orphaned `bun.exe` / `cargo.exe` / `mini-diarium.exe` processes in Task Manager.
- Notes: The real session used DOM-driven `agent-browser eval` clicks for the onboarding overlay / Preferences flow when raw refs became stale across rerenders. This still exercised the mounted Solid handlers and persisted through the real UI.

#### Task 5.2: Tear-down verification

- Status: COMPLETED
- Objective: Confirm stop.ts leaves no orphans on the system.
- Steps:
  1. After Task 5.1, run `Get-Process -Name bun,cargo,mini-diarium -ErrorAction SilentlyContinue` in PowerShell.
  2. Expect empty output.
  3. Confirm port 9222 has no listener: `netstat -ano | findstr :9222`.
- Validation: No leftover processes after a delayed recheck. `bun run agent:dev:probe` returns `{"running":false,"reason":"no state file"}` and `netstat` shows at most `TIME_WAIT` sockets on 9222, not a listener.
- Notes: The first parallel process/port sample raced the shutdown; the follow-up recheck is the authoritative teardown result.

### Milestone 6: Documentation & Cleanup

- Status: COMPLETED
- Purpose: Update project docs so future contributors and agents know this skill exists and when to use it.
- Exit Criteria: Root CLAUDE.md and CHANGELOG reference the skill. Plan status is COMPLETED.

#### Task 6.1: Add a short reference to root CLAUDE.md

- Status: COMPLETED
- Objective: Make the skill discoverable from the root project doc.
- Steps:
  1. Add a one-liner under "Verification Commands" or as a new "Manual UI Verification" subsection: "Manual UI verification by the agent (Windows-only): see `.agents/skills/tauri-agent-dev/SKILL.md`."
- Validation: CLAUDE.md mentions the skill.
- Notes: Don't duplicate the SKILL.md content here.

#### Task 6.2: Update CHANGELOG.md under 0.5.0 → Added

- Status: COMPLETED
- Objective: Capture this as a tooling addition for the release.
- Steps:
  1. Add an entry: "Internal agent tooling: `tauri-agent-dev` skill lets the coding agent spawn the Tauri dev binary with WebView2 CDP enabled and isolated sandbox state, drive the UI via agent-browser, and tear it down cleanly. Windows-only for v1. Not user-facing."
- Validation: CHANGELOG entry present.
- Notes: This isn't a user-visible feature, but it's still a tracked change.

#### Task 6.3: Cleanup intermediate artifacts

- Status: COMPLETED
- Objective: Remove scratch / experimental files created during Milestone 1's CDP probe.
- Steps:
  1. Delete any temporary verification scripts used during Milestone 1.
  2. Confirm `git status` shows only the intended files: skill dir, three scripts (or four if `control.ts` exists), package.json, .gitignore, CLAUDE.md, CHANGELOG.md.
- Validation: Scratch `.agent-dev-probe.log` removed, stale smoke artifact removed, and `git status --short` shows only the intended tracked edits plus the new skill/scripts/plan paths.
- Notes: Keep the dev.log file pattern out of git (covered by `.agent-dev/` gitignore).

## Approval Gate

Implementation must not start until the user approves this plan AND Milestone 1 (the agent-browser CDP validation) returns a result so we know whether `control.ts` is in scope.

## Pre-flight Checks

Run these before marking the plan COMPLETED or requesting final approval:

1. `bun run type-check` — confirm all new .ts scripts compile.
2. `bun run lint` — no ESLint warnings.
3. `bun run format:check` — formatting clean.
4. `bun run test:run` — frontend tests pass (no regression from script additions).
5. `bun run sync-skills` — no skill-name ambiguity warnings.
6. Smoke test from Milestone 5.1 passes end-to-end.
7. Tear-down verification from Milestone 5.2 leaves no orphans.

## Open Risks

- **WebView2 CDP attach behavior under Vite HMR is empirically untested in this project.** If hot reload causes the CDP target ID to change on every reload, agent-browser / control.ts will need to re-discover the target each call rather than caching a handle. The retry wrapper should handle this, but worth flagging.
- **Sandbox seeding** (creating a journal from scratch via the JournalPicker UI) may be more involved than initial scripting allows. Fallback: pre-seed `sandbox/app/config.json` with a known journal pointing at a pre-encrypted DB fixture. This is a v1.1 problem if it bites.
- **Port collisions.** 9222 is a popular debug port; if the user has Chrome running with `--remote-debugging-port=9222`, the probe will succeed against the wrong target. Mitigation: store the WebView2 process PID in state.json and verify it in probe.ts (compare `tasklist` entries against `pid`).
