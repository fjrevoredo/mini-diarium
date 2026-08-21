# RCA: `bun tauri dev` intermittent multi-minute startup stall

> **ARCHIVED — closed 2026-08-21.** Root cause identified, proven by controlled A/B
> measurement, fixed, and verified by the user on the real app. Nothing here is
> outstanding. This is historical reference only; the live rules it produced now live in
> the code itself:
>
> | Where the rule lives now | What it says |
> |---|---|
> | `vite.config.ts` → `server.watch.ignored` | `'**/target/**'` must stay in the list, and why |
> | `vite.config.test.ts` | regression test asserting that entry |
> | `vitest.config.ts` → `server.watch.ignored` | same exclusion for `bun run test` watch mode |
> | `CONTRIBUTING.md` → Troubleshooting (Windows) | what to check if dev startup is ever slow again |
>
> Read this document only if you need the *evidence* — the measurements, the ruled-out
> hypotheses, or the two factual claims the investigation itself got wrong and later
> refuted (Section 3, kept deliberately so nobody re-derives them).

- **Investigated**: 2026-08-20 → 2026-08-21 (three sessions)
- **Fixed and verified**: 2026-08-21
- **Symptom**: `bun tauri dev` opens the app window quickly, then the WebView sits on
  "Loading Mini Diarium…" for roughly 5-10 minutes. Fixed three times before this
  investigation; each fix appeared to work for about a day, then the stall returned.

---

## 1. Root cause

**Vite's dev-server file watcher walks — and holds watch handles over — the 40 GB Cargo
`target/` tree at the repo root.**

Vite hands chokidar **the repo root** to watch
(`node_modules/vite/dist/node/chunks/node.js:26340`; `experimental.bundledDev` defaults
to `false`, so `[root]` is passed). `resolveChokidarOptions` then ignores only:

```
**/.git/**   **/node_modules/**   **/test-results/**   <cacheDir>/**   <outDir>/**
```

plus whatever `server.watch.ignored` adds. Verified live by printing the resolved
chokidar `ignored` array from inside a `configureServer` hook:

```
["**/.git/**","**/node_modules/**","**/test-results/**",
 "D:/Repos/mini-diarium/node_modules/.vite/**",
 "**/src-tauri/**","**/.agent-dev/**",
 "D:\\Repos\\mini-diarium\\dist/**"]
```

**`target/` appears in none of them.** Since the open-core M1 workspace split moved the
Cargo workspace `target/` to the repo root, that directory is **40 GB / 56,598 files** —
and it is precisely the directory `cargo` writes into continuously during `bun tauri dev`.

Two consequences, both measured:

1. **Startup cost.** The initial walk registers ~61 k entries. It takes ~30 s with
   `target/`'s directory metadata in the OS cache, and 55 s+ when it is cold (e.g. the
   first dev run of the day). Every other thing the Vite server does — the dependency
   scan, module transforms, serving `/` — queues behind that filesystem storm.
2. **Ongoing cost and an outright crash.** Once ~61 k entries are registered, every
   cargo write into `target/` fires watcher events. Worse, chokidar tries to open a
   watch handle on files the linker is mid-write, and the resulting `EBUSY` is emitted
   as an unhandled `error` event that **kills the whole Vite process**.

### Why the window opens fast but the page never loads

`src-tauri/tauri.conf.json` sets `beforeDevCommand: "bun run dev"` (plain `vite`) and
`devUrl: http://localhost:1420`. The real sequence is:

1. The Tauri CLI starts Vite. Its watcher begins walking `target/`.
2. The Tauri CLI then runs `cargo build`, writing thousands of files into the very tree
   being walked — flooding the watcher and racing it for I/O.
3. The Rust side is fast (measured: under 1 s from `main()` to `win.show()` — see
   Appendix A), so the window appears almost immediately. The WebView then requests
   `devUrl`, and the page loads only once the storm subsides — minutes later.

**Starvation (steps 1-2) is the load-bearing mechanism.** It accounts for every
previously-unexplained observation:

| Observation | Explained by |
|---|---|
| Rust/Tauri/WebView2 window creation under 1 s, stall entirely after `win.show()` | The stall is in the dev server, not the app |
| Dev server logs `ready`, accepts TCP, but `GET /` times out | `ready` fires ~10 ms in, while the watcher walk runs for another 30 s+ |
| Near-idle CPU (18%), 10 GB RAM free, zero disk-queue length during the stall | Serialized watch-handle syscalls paying a fixed per-file latency — not CPU or throughput contention |
| Intermittent; "fixed for a day, then back" | `target/` grows as you build. Right after a `cargo clean` the walk is cheap; a day of dev/test/llvm-cov builds later it is 40 GB |

### Why three prior fixes missed it

All three passes targeted **Vite's dependency optimizer** — `optimizeDeps.entries`
(commit `4d489846`), `optimizeDeps.force` (commit `7ac1714`), and `holdUntilCrawlEnd`.
The optimizer was never the problem: measured cold and isolated, it costs ~13 s
(Section 3). The **file watcher** is a different subsystem that no fix ever touched.

`4d489846` is genuinely relevant history and remains correct — an older Vite defaulted
its dependency-scan entry discovery to a `**/*.html` crawl of the repo root, which swept
in `target/`. Pinning `optimizeDeps.entries: ['index.html']` fixed *that* path, and made
the optimizer's `target/` problem disappear in a way that looked like the whole `target/`
problem had been solved.

---

## 2. The evidence

All measurements: plain `vite` (no Tauri, no WebView2), same machine, same session.
`D:` is a Samsung SSD 980 PRO NVMe.

### 2.1 What the watcher registers (`server.watcher.getWatched()`)

Warm filesystem, minimal config with no app plugins so the watcher is the only variable.
One thing changed between runs: whether `'**/target/**'` is appended to
`server.watch.ignored`.

| | Control (as shipped) | `**/target/**` ignored |
|---|---|---|
| watched directories | **5,857** | 1,339 |
| watched entries | **66,968** | 5,852 |
| entries under `target/` | **61,115 (91%)** | 0 |
| walk still growing at t=25 s | yes (plateaus ~30 s) | no — plateaued before t=5 s |

**91% of everything Vite's dev server watches in this repo is Cargo build output.**

Note that chokidar's `ready` event is misleading here: it fired at 9-11 ms in *both*
runs while the walk continued in the background for another ~30 s. Any reasoning that
treats "Vite says ready" as evidence the watcher is done is wrong.

### 2.2 What a concurrent `cargo build` does

With each server still running, `src-tauri/src/lib.rs` was touched and
`cargo build --manifest-path src-tauri/Cargo.toml` run — a 7-13 s incremental build of
one crate, far smaller than a real cold `tauri dev` build.

**Control (`target/` watched):** in the ~9 seconds before it died, the watcher processed

```
add: 781   change: 514   unlink: 267   addDir: 5   unlinkDir: 1
— 1,568 events, 100% of them under target/ —
```

and then **the Vite dev server process crashed outright**, exit code 1:

```
node:internal/fs/watchers:323
Error: EBUSY: resource busy or locked, watch
  'D:\Repos\mini-diarium\target\debug\deps\mini_diarium_lib.dll'
    at createFsWatchInstance (…/vite/dist/node/chunks/node.js:9408:16)
    at NodeFsHandler._handleFile (…/vite/dist/node/chunks/node.js:9609:24)
Emitted 'error' event on FSWatcher instance
```

chokidar tried to open a watch handle on the `.dll` cargo's linker was in the middle of
writing. Vite attaches no `error` handler, so it takes the whole Node process down.

**Treatment (`**/target/**` ignored):** same touch, same build.

```
add: 0   change: 0   unlink: 0   addDir: 0   unlinkDir: 0
server alive; GET / -> 200 in 17 ms
```

This is the **same failure class** `vite.config.ts` already documented for
`.agent-dev/**` ("Vite's fs watcher crashes the whole dev server with EBUSY the moment it
tries to watch that file"). The fix was simply never extended to `target/`.

### 2.3 Scope of the EBUSY crash — proven in isolation, not yet end-to-end

The crash is real and reproducible, but it should **not** be presented as the explanation
of the stuck spinner. Three caveats:

- In the controlled repro the walk had fully settled (5,857 dirs) ~57 s before cargo
  started, and the `.dll` chokidar died on was already registered. In a real
  `tauri dev`, cargo starts while the walk is still in flight — a different race.
- The Tauri CLI only opens the WebView after `devUrl` responds. A crash *before* that
  point means Tauri never gets a window at all, which is not the reported symptom; only
  a crash *after* the window opens would produce a permanently stuck spinner.
- `docs/logs.txt` (a full `-vv` capture of a run the user believed was slow, since
  deleted) was grepped for `EBUSY`, `FSWatcher`, `resource busy` and `node:internal` —
  **zero hits**. In that captured run, Vite stayed alive throughout and the delay was
  starvation, not a crash.

### 2.4 Supporting measurement: request latency tracks filesystem cache state

Both runs below used the shipped config with a **warm** optimizer cache (optimizer
provably skipped — `Hash is consistent`), so the optimizer is not a variable:

| Run | Vite `ready` | first `GET /` | first `GET /src/index.tsx` |
|---|---|---|---|
| First run of the session (coldest FS-metadata sample available) | 14,778 ms | **55,827 ms** | **33,243 ms** |
| Identical config, immediately afterwards (FS warm) | 526 ms | 3,475 ms | 823 ms |

Same code, same warm optimizer cache, ~16x difference. The variable is filesystem
metadata cache state — which is exactly what the `target/` walk consumes.

---

## 3. Superseded findings

Two claims made during the investigation were later refuted by direct measurement. They
are recorded here so they are not re-derived.

### 3.1 REFUTED — "a cold dependency scan costs 6-7 minutes on this machine"

The investigation measured a 6 min 12 s gap between Vite's
`[optimizer] scanning dependencies...` and `[optimizer] bundling dependencies...` log
lines and concluded the cold scan itself was ~40x more expensive than the ~10 s the
Aug 19 fix had assumed.

**Measured directly**, `bun x vite --force` with `DEBUG=vite:deps`, plain Vite (no Tauri,
no cargo, no WebView2), warm filesystem:

| Phase | Duration |
|---|---|
| `Scan completed` (rolldown dependency scan) | **3,459 ms** |
| `Dependencies bundled` | **8,884 ms** |
| Full forced cold optimize, invocation → `dependencies optimized` | **~13.1 s** |
| First `GET /` after that | 4.4 s |

25 dependencies discovered; entry correctly resolved to the single
`D:/Repos/mini-diarium/index.html`.

**The Aug 19 CHANGELOG's ~10-second assumption was approximately right.** The 6 min 12 s
gap is real as an observation, but it is not the intrinsic cost of the scan — it is that
scan being starved by the `target/` watcher walk racing cargo's writes.

A caution on phase-boundary inference, since it is what produced this error twice: with
`holdUntilCrawlEnd: false`, `runOptimizeDeps` starts while the scan is still resolving,
so work shifts freely between the "scan" and "bundle" phases. Two runs measured
3,459 ms + 8,884 ms and 11,281 ms + 1,170 ms — **12.3 s and 12.5 s total**. Reading the
phase split as a slowdown would have been wrong both times. Compare totals, not phases.

### 3.2 REFUTED — "our own `vite.config.ts` edit invalidated the optimizer cache"

The investigation assumed that restructuring `vite.config.ts`'s arrow function to add a
diagnostic `console.error` had changed Vite's `configHash`, and therefore that the
observed cold cache was self-inflicted (a confound blocking the whole RCA).

`getConfigHash()` (`node.js:32593`) does **not** hash the config file's text. It hashes a
fixed whitelist of *resolved* values:

- `define: process.env.NODE_ENV || config.mode`
- `root: config.root`
- `resolve: config.resolve`
- `assetsInclude: config.assetsInclude`
- `plugins: config.plugins.map((p) => p.name)`
- `optimizeDepsPluginNames`
- `optimizeDeps: { include, exclude, rolldownOptions }`

`optimizeDeps.entries` and `optimizeDeps.holdUntilCrawlEnd` are **not in that list**, and
neither are comments, `console.error` calls, or arrow-function body shape.

**Confirmed empirically**: `vite.config.ts` was modified at 00:30; the cached
`_metadata.json` was written at 00:29 — i.e. *before* the edit. Starting plain
`bun x vite` at 18:23 the next day with `DEBUG=vite:deps` printed
`vite:deps (client) Hash is consistent. Skipping.` The cache was warm despite the edit.
No confound existed.

### 3.3 Ruled out cleanly

- **`globEntries` / `optimizeDeps.entries` crawling `target/`**: reproduced Vite's exact
  `globEntries(['index.html'], …)` call against this repo with tinyglobby 0.2.17 —
  **5 ms**. tinyglobby short-circuits the literal pattern and never crawls `target/`.
  Commit `4d489846`'s pin is intact and is not a cost.
- **Slow disk**: `D:` is a Samsung SSD 980 PRO NVMe (`Get-PhysicalDisk`). Not an HDD.
- **Leftover/orphaned processes as the trigger**: no `node`, `bun`, `cargo`, or
  `mini-diarium.exe` processes were alive at the start of the deciding session.
- **The tauri-cli file-watcher's `ignore::walk` output** (~978 of 1056 lines in the
  captured `-vv` log): ~1,000 total stats. Arithmetic never supported minutes.
- **Gross system-wide resource contention**: measured during a stall at 18.8% CPU
  (16 logical cores), 10.6 GB RAM free, 0 disk-queue length.
- **[vitejs/vite#19316](https://github.com/vitejs/vite/issues/19316)** (`buildStart`
  hanging `vite optimize`): different command, fixed in Vite 6; we are on 8.2.1.
- **[vitejs/vite#22934](https://github.com/vitejs/vite/issues/22934)** (optimizer race on
  progressive dependency discovery): tested directly by flipping `holdUntilCrawlEnd` to
  `true` on a deliberately-cleared cache. The stall was unchanged (~7 min), so this race
  is not the mechanism.

---

## 4. The fix

Applied 2026-08-21, and confirmed by the user running the real app: `bun tauri dev`
starts normally.

1. **`vite.config.ts`** — `'**/target/**'` added to `server.watch.ignored`, alongside the
   existing `**/src-tauri/**` and `**/.agent-dev/**` entries, with a comment pointing
   here. Measured effect:

   | | before | after |
   |---|---|---|
   | watched entries | 66,968 | 5,852 |
   | walk completion | ~30 s (warm) / 55 s+ (cold) | under 5 s |
   | watcher events during a `cargo build` | 1,568 | 0 |
   | dev server survives that build | no — EBUSY crash | yes |

2. **`vite.config.test.ts`** — regression test asserting `server.watch.ignored` contains
   `'**/target/**'`, matching the existing `optimizeDeps` guard in the same file.

3. **`vitest.config.ts`** — same exclusion added. `vitest run` sets
   `viteConfig.server.watch = null` (verified in
   `node_modules/vitest/dist/chunks/cli-api.*.js`), so CI and `bun run test:run` were
   never exposed; `bun run test` in watch mode was.

### Follow-ups (not done, tracked separately)

- **Harden against the crash class**: attach a `server.watcher.on('error', …)` handler so
  a future EBUSY on some other path degrades instead of killing the dev server.
- **Stop rust-analyzer sharing `target/`**: the VS Code extension runs with no
  `rust-analyzer.cargo.targetDir` override, so it shares `target/` with manual `cargo`
  invocations (confirmed via `.cargo-lock` files in `target/debug`, `target/release`,
  `target/llvm-cov-target/debug`). Pointing it at a separate directory removes a second
  source of churn in that tree.
- ~~**End-to-end confirmation**~~ — **done**. The user ran the real app with the fix
  applied and reported `bun tauri dev` starting normally, confirming the user-visible
  outcome the isolated A/B predicted.

### Still-open threads, now demoted

- **Orphaned WebView2 processes.** `msedgewebview2.exe` instances from dev sessions over
  a day old were observed surviving `taskkill /pid <pid> /t /f`. Unrelated to this root
  cause and still unexplained, but no longer a suspect: optimizer-cache staleness costs
  ~13 s, not minutes.
- **WebView2 outbound connection to `150.171.27.11:443`.** During a stall, WebView2's
  network-process child held an `Established` connection to a Microsoft-owned range
  alongside the expected `127.0.0.1:1420`; both closed on their own within ~90 s. This is
  outside the app's own network-isolation stack — `lib.rs`'s CSP and init-script block
  the *page's* JS, not what the WebView2 runtime itself does at the browser-engine level.
  Documented upstream in
  [MicrosoftEdge/WebView2Feedback#5093](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5093),
  with no known disable mechanism. Informational; it resolved well before the page did.

---

## Appendix A — Rust/Tauri-side timeline (rules out the backend)

Captured with temporary `[TIMING]` markers (since reverted) piped through a wall-clock
prefixer, during a live reproduction of the stall. **The numbers below were transcribed
from `docs/logs.txt`, a raw `-vv` capture that has since been deleted** — they cannot be
re-checked against the source, only re-measured. The same applies to the `ignore::walk`
line count cited in Section 3.3.

| Marker | Δ from previous |
|---|---|
| `tauri-dev.js` loaded → spawn `bun x tauri` | 2 ms |
| → `vite.config.ts` evaluated | 662 ms |
| → Vite reports "ready" | 2.06 s |
| → cargo `Finished` | 30.8 s (recompiled because of the instrumentation edits; an ordinary run finishes in 0.36 s with nothing to do) |
| → Rust `main()` start | 4.5 s (OS process load) |
| → `setup()` start → before `win_builder.build()` | 9 ms |
| → WebView2 `build()` (env + window creation) | **837 ms** |
| → `win.show()` | instant |
| **→ app window actually usable** | **~6 min** |

Every phase that can be instrumented on the Rust side is under 1 second from `main()` to
the window being shown. The entire stall is after `win.show()`, inside WebView2's page
load — invisible to `-vv` Tauri CLI output and to Rust-side instrumentation alike.

## Appendix B — how to re-measure

If the stall ever returns, these are the instruments that actually localized it:

- `DEBUG=vite:deps bun x vite --force` — prints `Scan completed in Nms` and
  `Dependencies bundled in Nms` directly, instead of inferring durations from the
  1-second-delayed `[optimizer] scanning dependencies...` log line. Run plain `vite`, not
  `tauri dev`, to remove cargo and WebView2 as variables.
- A throwaway `--config` file with a plugin whose `configureServer` hook polls
  `server.watcher.getWatched()` on an interval and tallies entries by prefix. Do **not**
  count `add`/`addDir` events for the initial walk — chokidar runs with
  `ignoreInitial: true`, so the walk emits none; and do not trust the `ready` event,
  which fires ~10 ms in while the walk continues for another 30 s.
- Never edit `vite.config.ts` itself to instrument it — use `--config`. Editing it in
  place created a phantom confound that blocked the RCA for a full session (Section 3.2).
- Compare **total** optimize cost, never the scan/bundle phase split (Section 3.1).
