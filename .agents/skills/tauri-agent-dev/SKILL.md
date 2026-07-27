---
name: tauri-agent-dev
description: |
  Spawn, probe, and stop Mini Diarium's live Windows Tauri dev app with WebView2 CDP enabled, then hand control to agent-browser for real UI inspection. Use this whenever the user wants to manually test the real desktop UI, drive the dev app, verify a bug or preference in the actual window, inspect localStorage, take a real screenshot, or "actually try it in the app" instead of relying only on unit tests or WDIO. Triggers: manually test the UI, drive the dev app, verify in the real UI, agent dev mode, spawn the dev app, open the running app and check, inspect the live Tauri window.
---

# Tauri Agent Dev

## Platform Support

- Use this skill on Windows only.
- Do not use it on macOS or Linux. WebView2 CDP is the mechanism here; the other Tauri webviews do not match this flow.

## Start A Session

Run everything from the repo root with the Windows toolchain.

**Use the PowerShell tool, not Bash + `cmd.exe`, for every command in this skill.** `agent:dev:start`,
`agent:dev:probe`, `agent:dev:stop`, and `agent-browser connect` are exactly the kind of
background-spawning / long-running commands where Bash piped through `cmd.exe` reliably returns
only the `cmd.exe` banner with no real output — the same failure mode root `CLAUDE.md` calls out
for `website:build-static`, but it is not specific to that one script. If a command run this way
returns nothing but the banner, that is the signature of this issue, not a sign the command failed
— retry it through the PowerShell tool before concluding anything is wrong.

**`agent:dev:start` does not return to you — always launch it with `run_in_background: true`.**
The script itself is written to exit once CDP is up (it spawns `tauri dev`, polls, prints
`Tauri dev running.`, and falls off the end of `main()`), but through this tool chain the call stays
attached to the live process tree and is only reported as complete when you later run
`agent:dev:stop`. Waiting on it in the foreground burns the entire tool timeout and teaches you
nothing: a foreground call with a 400 s timeout will be force-backgrounded at 400 s even though the
app window opened ~60 s in. Launch it backgrounded and use `probe` as the readiness signal:

```bash
# 1. Launch — run_in_background: true, do NOT wait on this call
bun run agent:dev:start

# 2. Readiness — this one DOES return, in well under a second
bun run agent:dev:probe
```

The same applies to `agent-browser connect <port>`: it does not return either. Launch it
backgrounded (or simply issue it and move on) and treat the first successful
`agent-browser snapshot` as proof the connection is live — `snapshot` returns normally.

Useful flags:

```bash
bun run agent:dev:start -- --port 9223
bun run agent:dev:start -- --timeout 180
bun run agent:dev:start -- --use-real-config
```

What start does:

- launches `tauri dev`
- enables WebView2 remote debugging
- defaults to a sandbox under `.agent-dev/sandbox/`
- seeds `.agent-dev/sandbox/app/config.json` on first run so the frontend auto-selects the sandbox journal
- isolates WebView storage under `.agent-dev/sandbox/webview/` so `localStorage` does not leak across runs
- writes runtime state to `.agent-dev/state.json`
- writes logs to `.agent-dev/dev.log`

**Detecting readiness:** don't grep the raw `start` output for guessed keywords ("ready", "listening",
etc.) — per the note above, `start` never hands its output back, so its stdout is not a readiness
signal at all through this tool chain. `agent:dev:probe` is the purpose-built readiness check and
returns structured JSON (`{"running":true,...}`) the moment the CDP target is live. Poll it directly
instead of building an ad hoc log-watcher:

```bash
# Poll probe every few seconds until it reports running, instead of waiting on a fixed
# timer or grepping dev.log for inferred markers.
until bun run agent:dev:probe 2>&1 | grep -q '"running":true'; do sleep 3; done
```

Cold builds take 30-90 seconds; pass `--timeout 180` if a Rust rebuild is expected. If the app window
is already visibly open (the user can see it), trust that over a probe/log timeout — the window
appearing means the session is up even if a polling loop hasn't caught up yet.

After start succeeds, connect the separate browser-driving layer:

```bash
agent-browser connect 9222
```

If you changed the port, connect to that port instead.

## Drive The UI

After `agent-browser connect`, use the normal browser-driving loop:

1. `agent-browser snapshot`
2. click or fill controls
3. re-snapshot after meaningful UI transitions
4. use eval for DOM or `localStorage` reads
5. take screenshots when the user needs proof

PowerShell notes:

- Quote `@eNNN` refs. Use `agent-browser click '@e5'`, not `agent-browser click @e5`.

- **Pass every non-trivial `eval` script as a single-quoted here-string, never as an inline
  double-quoted argument.** PowerShell eats backslash-escaped quotes inside a `"…"` argument, so JS
  containing quoted selectors arrives at the browser mangled. This call:

  ```powershell
  agent-browser eval "(function(){ document.querySelectorAll('a[aria-label^=\"Open entry\"]') })()"
  ```

  fails with `'a[aria-label^= Open entry]' is not a valid selector` — the inner quotes were stripped,
  not escaped. The failure looks like a bad selector, so it sends you rewriting correct JS. Use:

  ```powershell
  $js = @'
  (function(){
    const rows = Array.from(document.querySelectorAll('li button'))
      .filter(b => (b.getAttribute('aria-label') || '').startsWith('Open entry'));
    return { count: rows.length };
  })()
  '@
  agent-browser eval $js
  ```

  The `@'…'@` form is literal — no `$`, backtick, or quote interpretation — so the JS reaches the
  browser byte-for-byte. The closing `'@` **must** be at column 0 on its own line. As a bonus,
  `startsWith`/`includes` filtering in JS avoids CSS attribute-selector quoting entirely.

**Stale ref warning**: `@eNNN` refs are assigned at snapshot time. Any DOM mutation (tab switch,
scroll, dialog open/close) can reassign refs so an old ref silently targets a different element.
For controls inside scrollable panels or dialogs, prefer CSS selectors or JS eval with label-text
matching over bare `@eNNN` refs. Always re-snapshot after a meaningful transition before clicking
a ref from a previous snapshot.

**`type` requires the selector and text in the same call**: `agent-browser type <sel> <text>` takes
both arguments together — e.g. `agent-browser type '@e15' 'some text'`. Calling `click '@e15'` and
then `type` with only the text string (no selector) is a **silent no-op**: it returns success but
nothing is typed, and there is no error to signal the mistake. If `eval`'d editor/input content comes
back empty after a `type` call, check this first before assuming a focus or timing problem.

**Don't burn a full wakeup/turn-cycle on a sub-second wait**: known short timers (e.g. the 500ms
autosave debounce) don't need `ScheduleWakeup` or a minute-long pause — that wastes a conversation
turn per check. Use a short shell-level wait (`sleep 1-2` inline before the next command, or a tight
`Monitor` poll loop) so the verification stays in the same turn.

## Stable Selectors

Prefer the app's documented `data-testid` hooks where they exist. Do not invent new ones.

**The canonical list is the `data-testid` table in [`src/CLAUDE.md`](../../../src/CLAUDE.md) — read it
there rather than trusting a copy.** It is maintained as E2E contract and grows whenever a new
testid ships; a duplicated list here goes stale silently and sends you hunting by text for controls
that already have a stable hook. The ones you reach for most in this workflow:

| Purpose | testid |
|---|---|
| Journal creation | `password-create-input`, `password-repeat-input`, `create-journal-button` |
| Journal unlock | `password-unlock-input`, `unlock-journal-button` |
| Header | `toggle-sidebar-button`, `lock-journal-button`, `search-button`, `timeline-toggle-button`, `header-date-title`, `header-prev-day-button`, `header-next-day-button` |
| Overflow menu | `header-more-menu-trigger`, then `header-more-menu-{preferences,statistics,import,export}-item` |
| Overlays (assert open) | `preferences-overlay`, `stats-overlay`, `import-overlay`, `export-overlay`, `search-overlay` |
| Onboarding | `onboarding-next-btn` |
| Editor | `title-input`, `entry-nav-bar`, `entry-{prev,next,add,delete,lock}-button`, `entry-number-button-{N}` |
| Calendar | `calendar-day-YYYY-MM-DD` |

Preferences has no `data-testid`s, but it does have stable `id` attributes — use those, not visible
text (text matching breaks under a non-English `language` preference):

- Tabs: `#pref-tab-general`, `#pref-tab-writing`, `#pref-tab-security`, `#pref-tab-data`,
  `#pref-tab-advanced`. Note `writing` and `security` render **only while unlocked**
  (`PreferencesOverlay.tsx`), so unlock before reaching for them.
- Controls: e.g. `#pref-first-day`, `#pref-timeline-date-format`, `#show-timeline-preview`,
  `#hide-titles`, `#allow-future`, `#enable-spellcheck`, `#editor-font-size`.

## Common Recipes

### Create Or Unlock A Journal

For a fresh sandbox:

1. fill `password-create-input`
2. fill `password-repeat-input`
3. click `create-journal-button`

For an existing sandbox journal:

1. fill `password-unlock-input`
2. click `unlock-journal-button`

### Dismiss The Onboarding Tour (do this immediately after creating a journal)

**A fresh sandbox always lands in the onboarding tour, and its overlay swallows clicks aimed at the
header.** This is not an occasional annoyance — it fires on every first run, and the symptom is
misleading: `agent-browser click '[data-testid=header-more-menu-trigger]'` reports `✓ Done`, the menu
never opens, and the follow-up click on a menu item fails with `Element not found`. It reads like a
broken menu or a stale ref. Check for `onboarding-next-btn` in the DOM before believing that.

Don't step through the tour by hand and don't try to pre-seed its localStorage key — the key is
`onboarding-shown-{activeJournalId}` (`src/state/onboarding.ts`), and the journal id does not exist
until after creation. Click through to the end in one eval instead; the loop is id-agnostic and
survives the tour gaining or losing steps:

```powershell
$js = @'
(function(){
  let clicks = 0;
  for (let i = 0; i < 12; i++) {
    const b = document.querySelector('[data-testid=onboarding-next-btn]');
    if (!b) break;
    b.click(); clicks++;
  }
  return { clicks, stillThere: !!document.querySelector('[data-testid=onboarding-next-btn]') };
})()
'@
agent-browser eval $js
```

Expect `stillThere: false`. The final click calls `dismissOnboarding()`, which persists the key, so
the tour stays gone for the rest of the sandbox's life — including across reloads.

### Read Or Verify Preferences

Open Preferences via `header-more-menu-trigger` → `header-more-menu-preferences-item` (dismiss the
onboarding tour first — see above, or the trigger click silently does nothing), then click the tab
by id (`#pref-tab-writing`, etc.).

To inspect saved preferences directly:

```javascript
JSON.parse(localStorage.getItem('preferences') ?? '{}');
```

Typical checks:

- `autoLockEnabled`
- `autoLockTimeout`
- `language`
- `editorFontFamily`

**Auto-lock timer interference**: If `autoLockTimeout` is short (< 30 s), the journal will lock
between CDP roundtrips — `eval` calls do not dispatch DOM activity events and therefore do not
reset the idle timer. Patch the timeout in localStorage before starting a multi-step test:

```javascript
// Extend timeout so the journal stays unlocked during the session
(function() {
  const p = JSON.parse(localStorage.getItem('preferences') ?? '{}');
  p.autoLockTimeout = 600;
  localStorage.setItem('preferences', JSON.stringify(p));
})();
```

Run this eval immediately after unlocking, before taking the first snapshot. Restore the original
value when done if needed.

### Navigate A Scrollable Preferences Dialog

The Preferences dialog clips its content with a scrollable container — not the `[role="tabpanel"]`
element itself (which has `overflow: visible`). The actual scroller has class `.flex-1.overflow-y-auto`.

**Correct approach — scroll a specific element into view:**

```javascript
// Works: scrolls a target element into the visible area
document.querySelector('#some-element-id').scrollIntoView({behavior: 'instant', block: 'center'});

// Or find by label text:
Array.from(document.querySelectorAll('input[type="checkbox"]'))
  .find(el => el.labels?.[0]?.textContent?.trim() === 'Lock after inactivity')
  ?.scrollIntoView({behavior: 'instant', block: 'center'});
```

**Wrong approach — setting `scrollTop` on the tabpanel:**

```javascript
// Does NOT work: the tabpanel has overflow:visible
document.querySelector('[role="tabpanel"]').scrollTop = 400;
```

After `scrollIntoView`, take a screenshot to confirm the element is visible before clicking.

### Compound Eval for Atomic UI Chains

When multiple UI interactions must happen without a roundtrip gap (e.g., to avoid the auto-lock
timer or avoid stale refs), chain them in a single `eval` call:

```javascript
(function() {
  // 1. Open a dialog
  const openBtn = document.querySelector('[data-testid=header-more-menu-preferences-item]');
  if (!openBtn) return {error: 'menu item not found — is the overflow menu open?'};
  openBtn.click();

  // 2. Navigate to a tab (by id — text matching breaks under a non-English language pref)
  const tab = document.querySelector('#pref-tab-security');
  if (!tab) return {error: 'tab not found — unlocked?'};
  tab.click();

  // 3. Read a UI control state
  const cb = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    .find(el => el.labels?.[0]?.textContent?.trim() === 'Lock after inactivity');
  if (!cb) return {error: 'checkbox not found'};
  cb.scrollIntoView({block: 'center'});
  return {checkboxChecked: cb.checked};
})()
```

Use this pattern when:
- The idle timer is short and would fire between steps
- You need to read state immediately after opening a dialog (before refs can go stale)
- You're verifying that a setting persisted after Save + re-open in one shot

### Capture A Screenshot

Use agent-browser's screenshot flow after the app is in the exact state the user cares about. Prefer this over describing the UI from memory.

## End The Session

Always stop the dev session before finishing the task (PowerShell tool, see note in "Start A Session"):

```bash
bun run agent:dev:stop
```

Optional:

```bash
bun run agent:dev:stop -- --keep-sandbox
```

Stopping is not optional cleanup. It kills both long-lived Windows process roots and removes sandbox state unless told otherwise.

If `agent:dev:stop` fails during sandbox deletion with a transient WebView file lock (`EBUSY` on a file under `.agent-dev/sandbox/webview/EBWebView/...`), immediately retry with `--keep-sandbox`. Treat that as the normal fallback: the important part is stopping the managed processes and closing the CDP port, not forcing one last WebView cache file to be deleted in the same step.

## Sandbox Semantics

- Default mode is sandboxed.
- Sandbox paths live under `.agent-dev/sandbox/`.
- Start seeds `config.json` with a single sandbox journal on first run, so the app does not fall back to the journal picker.
- `MINI_DIARIUM_DATA_DIR` points directly at the sandbox diary dir, while the seeded app config gives the frontend an active journal selection.
- WebView storage is isolated under the sandbox too, so preferences and other `localStorage` state start clean on a fresh sandbox.
- First launch against an empty sandbox lands on journal creation.
- Reusing the same sandbox lands on password unlock.
- Use `--use-real-config` only when the bug depends on the user's actual app state.

## Troubleshooting

- Start can take 30-90 seconds on a cold build. Use `--timeout 180` if Rust rebuilds are expected.
- **`agent:dev:start` or `agent-browser connect` "times out" / gets force-backgrounded**: expected — neither returns through this tool chain. Launch both with `run_in_background: true` and poll `bun run agent:dev:probe` for readiness. See "Start A Session".
- **Clicks report `✓ Done` but nothing happens, then the next selector is `Element not found`**: on a fresh sandbox this is the onboarding tour overlay intercepting the click, not a broken control. Check for `[data-testid=onboarding-next-btn]` and dismiss it — see "Dismiss The Onboarding Tour".
- **`eval` fails with `'…' is not a valid selector` on JS you know is correct**: PowerShell stripped the escaped inner quotes. Re-send the script as a `@'…'@` here-string — see the PowerShell notes under "Drive The UI".
- If port `9222` is already taken, restart with `--port 9223` and connect agent-browser to that port.
- If start succeeds but the page target is not immediately recorded, run `bun run agent:dev:probe` (poll it — see "Detecting readiness" above). Probe resolves the current page target from the live `/json` list.
- If probe says `cdp unreachable`, inspect `.agent-dev/dev.log`.
- If probe says the managed PIDs are not alive, the dev session is gone. Start a new one.
- If a stop attempt fails, do not delete `.agent-dev/state.json` by hand until you understand which root is still alive.
- If `agent:dev:stop` fails with `EBUSY` while deleting a WebView cache file, rerun `bun run agent:dev:stop -- --keep-sandbox`. Verify that the reported port is closed; if it is, the session shutdown is good enough for task cleanup.
- **Journal locks repeatedly during session**: If the app is configured with a short `autoLockTimeout` (< 30 s), the idle timer fires between CDP roundtrips. `eval` calls do not count as user activity. Patch `autoLockTimeout` to 600 in localStorage immediately after the first unlock (see "Read Or Verify Preferences" recipe above).

## What This Skill Does Not Do

- It does not replace WDIO or CI E2E coverage.
- It does not support production builds.
- It does not support macOS or Linux.
- It does not bundle browser automation itself; it relies on the separate `agent-browser` capability after startup.
