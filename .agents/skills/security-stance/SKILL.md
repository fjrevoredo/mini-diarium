---
name: security-stance
description: "Mini Diarium's opinionated security, encryption, and privacy stance. Load when touching crypto (crates/mini-diarium-crypto/src/crypto/), auth (crates/mini-diarium-core/src/auth/, commands/auth/), IPC boundaries (src/lib/errors.ts, tauri.ts), auto-lock (screen_lock.rs, App.tsx idle timer), database schema/migrations (db/schema.rs), backups (backup.rs), config.json / JournalConfig, import/export, plugin sandbox (Rhai), search (intentionally stubbed), debug dump, Tauri capabilities (src-tauri/capabilities/) or CSP (tauri.conf.json), E2E isolation env vars, or anything involving passwords, keys, nonces, zeroization, or entry persistence. Also load when reviewing or proposing new features to judge against the six PHILOSOPHY.md principles and five non-negotiables."
compatibility: Designed for Claude Code. Applies to Mini Diarium only.
---

# Mini Diarium — Security Stance

The opinionated, repo-specific security/privacy/encryption stance for Mini Diarium. Use this skill alongside (not instead of) `/security-review`. This document is **passive context** that loads whenever security-adjacent work appears; `/security-review` is a one-shot review command.

The authoritative sources are `PHILOSOPHY.md` and `SECURITY.md`. This skill distills the operational details: invariants, file:line anchors, footguns, and what-breaks-if-you-change-this. **When this document and an authoritative source disagree, the source wins** — file an update to this skill.

---

## 1. When to load this skill

Load when work touches any of:

- Crypto: `crates/mini-diarium-crypto/src/crypto/cipher.rs`, `crates/mini-diarium-crypto/src/crypto/password.rs`
- Auth: `crates/mini-diarium-core/src/auth/mod.rs` (composed slot ops + `AuthMethodInfo`), `crates/mini-diarium-crypto/src/auth/{password,keypair,auto_key}.rs` (the pure wrapping methods), `src-tauri/src/commands/auth/`
- IPC contract: `src/lib/tauri/`, `src/lib/errors.ts`, any new `#[tauri::command]`
- Auto-lock paths: `src/App.tsx` idle timer, `src-tauri/src/screen_lock.rs`, `src/lib/focus-lock.ts`, `src-tauri/src/window_focus.rs`, `src/lib/dialog.ts`
- DB schema / migrations: `crates/mini-diarium-core/src/db/schema/mod.rs` (`SCHEMA_VERSION` at line 32), `crates/mini-diarium-core/src/db/schema/migrations/`
- Backups & rotation: `crates/mini-diarium-core/src/backup.rs`
- Journal config: `crates/mini-diarium-core/src/config.rs` (`JournalConfig`, `auto_key`, `require_all_auth`)
- Import / export: `src-tauri/src/commands/import.rs`, `commands/export.rs`, `import/*.rs`, `export/*.rs`
- Plugin sandbox: `crates/mini-diarium-core/src/plugin/rhai_loader/` (`runtime.rs` = engine + limits, `metadata.rs`, `mod.rs` = loader), `plugin/registry.rs`, `plugin/builtins.rs`
- Search interface (preserved stub): `src-tauri/src/commands/search.rs`, `src/state/search.ts`, `src/components/search/`
- Debug dump: `src-tauri/src/commands/debug.rs`
- File-read commands & allowlists: `src-tauri/src/commands/files.rs`
- Tauri capabilities: `src-tauri/capabilities/*.json`
- CSP: `src-tauri/tauri.conf.json` (`security.csp`, `dangerousDisableAssetCspModification`)
- Network isolation: `src-tauri/src/lib.rs` (init script, `on_navigation`, `on_new_window`, Windows COM handler, macOS WKContentRuleList handler); `src/lib/network-isolation-script.ts` (TS copy — must stay in sync with Rust)
- E2E env-var isolation: `src-tauri/src/lib.rs` (`MINI_DIARIUM_E2E*`)
- Sanitization of imported HTML/Markdown: `src/lib/markdown.ts` (DOMPurify)
- Anything involving passwords, keys, nonces, zeroization, or persistence of entry content

**Examples**
- Adding a new Tauri command that touches entries / files / auth / plugins → **load**
- Pure CSS-only change, i18n string addition, README typo → **do not load**
- Reviewing/proposing new features → **load** to apply the six principles + five non-negotiables

---

## 2. The five non-negotiables (absolute invariants)

From `PHILOSOPHY.md:165-169`. These are not preferences — they are red lines.

| # | Rule | Enforcement / Where it shows up first |
|---|------|---------------------------------------|
| 1 | **No network access.** Mini Diarium never initiates any network connection. OS-opener links (About screen, Onboarding) hand a URL to the system browser — the app makes no network call itself. | None of the three crate manifests — `src-tauri/Cargo.toml` (app crate), `crates/mini-diarium-core/Cargo.toml` (business layer), or `crates/mini-diarium-crypto/Cargo.toml` (crypto crate) — contains `reqwest`, `hyper`, `socket2`, `ureq`, etc. (`PHILOSOPHY.md:225`). Capabilities allowlist (`src-tauri/capabilities/default.json`) has no `http:*`. CI static check `scripts/check-no-network.ps1` (globs and scans all crate manifests) enforces this on every push. Adding a network crate or capability is the visible violation. |
| 2 | **No custom cryptography.** Standard algorithms and established libraries only. | Code review: any homegrown MAC, KDF, cipher mode, nonce scheme, or "encryption helper" is the violation. We use `aes-gcm`, `argon2`, `x25519-dalek`, `hkdf`, `zeroize`. |
| 3 | **No password recovery.** If credentials are lost, data is gone. Mitigation = register a second auth method. | Refusing to add a "reset password without old password" path. The only re-wrap is `change_password` (requires current creds). `remove_auth_method` refuses to delete the last slot. |
| 4 | **No vendor lock-in.** Users must be able to export and migrate freely. | JSON + Markdown exports remain plaintext, with documented schema (`PHILOSOPHY.md:82-87`). Removing or proprietizing an export format is the violation. |
| 5 | **Honest threat documentation.** Document what IS protected and what IS NOT. Never overstate. | `SECURITY.md` table is the contract. Adding sync, sharing, or "encrypted by your account" without updating the threat model is the violation. |

**If an agent proposes a change that visibly conflicts with any non-negotiable: STOP. Surface the conflict to the user. Do not implement, even partially.**

---

## 3. Threat model at a glance

Compact form of `SECURITY.md:30-43`. This is the "what can I honestly promise?" cheat sheet.

| Threat | Protected? | By what mechanism | Where documented |
|---|---|---|---|
| Offline file access (stolen device, dumped backup, raw `diary.db`) | YES | AES-256-GCM per field, fresh random 12-byte nonce from `OsRng` per write | `SECURITY.md:32`, `crypto/cipher.rs:70-74` |
| Password guessing at rest | YES | Argon2id m=64 MiB, t=3, p=4 (exceeds OWASP 2023 minimums) | `SECURITY.md:33`, `crypto/password.rs:8-10` |
| Weak-credential key-file attack | YES | X25519 ECDH + HKDF-SHA256 — strength = 256-bit curve regardless of file location/name | `SECURITY.md:34`, `auth/keypair.rs:8` |
| Multi-credential compromise (revoke one, others unaffected) | YES | Each auth method wraps its own copy of the master key in `auth_slots` | `SECURITY.md:35` |
| In-memory key leakage after lock | YES | Lock drops DB connection, clears keys; `SecretBytes`/`Key` use `ZeroizeOnDrop`; explicit `.zeroize()` on success and error paths | `SECURITY.md:36`, `crates/mini-diarium-crypto/src/auth/mod.rs:21-53`, `crypto/cipher.rs:14-22`, `crypto/password.rs:60,103` |
| Running session on the device (unlocked) | NO | Out of scope — content lives in process memory; mitigated by locking | `SECURITY.md:40` |
| Malicious software on the device (keylogger, screen-cap, ptrace) | NO | Out of scope — protect the device first | `SECURITY.md:41` |
| Cloud-sync provider compromise of the DB file alone | PARTIAL | Sees only ciphertext. **If the same provider also holds the key file or `config.json` with `auto_key`, the journal is compromised.** | `SECURITY.md:42`, `docs/decisions/2026-04-passwordless-journal.md` |
| Coercion / credential theft from an unlocked device | NO | Out of scope — encryption cannot defend against an attacker who can observe or compel | `SECURITY.md:43` |

---

## 4. Crypto invariants (concrete numbers, not principles)

| Invariant | Value / shape | File:line | What breaks if changed |
|---|---|---|---|
| AES-GCM key size | 32 bytes (AES-256) | `crates/mini-diarium-crypto/src/crypto/cipher.rs:9` | Incompatible with all existing ciphertext |
| AES-GCM nonce size | 12 bytes | `crates/mini-diarium-crypto/src/crypto/cipher.rs:12` | AES-GCM spec violation; existing blobs unparseable |
| AES-GCM nonce generation | Random per encrypt via `OsRng.fill_bytes` | `crates/mini-diarium-crypto/src/crypto/cipher.rs:70-74` | Nonce reuse → catastrophic keystream-XOR leak |
| Ciphertext blob layout | `[nonce(12) ‖ ciphertext ‖ tag(16)]` | `crates/mini-diarium-crypto/src/crypto/cipher.rs:83-104` | All existing entries unrecoverable |
| Argon2id memory | 65536 KiB (64 MB) | `crates/mini-diarium-crypto/src/crypto/password.rs:8` | Weakening = faster offline crack; strengthening = slow unlock on older hardware. Either way: schema migration + CHANGELOG Security entry. |
| Argon2id iterations | 3 | `crates/mini-diarium-crypto/src/crypto/password.rs:9` | Same — migration class change |
| Argon2id parallelism | 4 | `crates/mini-diarium-crypto/src/crypto/password.rs:10` | Same — migration class change |
| X25519 HKDF info string | `b"mini-diarium-v1"` (constant) | `crates/mini-diarium-crypto/src/auth/keypair.rs:8` | All existing keypair slots unrecoverable |
| Wrapped-key blob (keypair) | `[eph_pub(32) ‖ nonce(12) ‖ ciphertext(32) ‖ tag(16)] = 92 bytes` for a 32-byte master key | `crates/mini-diarium-crypto/src/auth/keypair.rs:12-14` | Existing keypair slots unparseable |
| `SecretBytes` | `#[derive(ZeroizeOnDrop)]`; Debug shows `SecretBytes([REDACTED; N])` | `crates/mini-diarium-crypto/src/auth/mod.rs:21-53` | Keys linger in heap; `Debug` would leak bytes |
| `Key` struct | `#[derive(Zeroize, ZeroizeOnDrop)]`; Debug shows `[REDACTED]` | `crates/mini-diarium-crypto/src/crypto/cipher.rs:14-22` | Same leak class |
| Master-key generation | 32 random bytes from `aes_gcm::aead::OsRng.fill_bytes`, raw bytes zeroized after wrap | `crates/mini-diarium-core/src/db/schema/create.rs` | Predictable / reused master key would be catastrophic |
| Schema version | `pub const SCHEMA_VERSION: i32 = 7;` | `crates/mini-diarium-core/src/db/schema/mod.rs:32` | Bump on every breaking schema change |
| Max import file size | 100 MB (`MAX_IMPORT_FILE_SIZE`) | `src-tauri/src/commands/import.rs:5` | Too high → memory DoS; too low → legitimate imports fail |
| Max text file read | 1 MiB (`MAX_TEXT_FILE_BYTES`) | `src-tauri/src/commands/files.rs:19` | Same DoS class |
| Backup retention policy | tiered: 10 recent + 1/day × 14 d + 1/week × 8 w + 1/month × 12 mo; storage budget `max(2 GiB, 3 × journal size)` | `crates/mini-diarium-core/src/backup/policy.rs:25-37` | Disk-use guarantee, not a crypto invariant; changing it is a user-facing policy change |

**Rule for any change to a row in this table:**

1. Schema migration with `SCHEMA_VERSION` bump in `db/schema/mod.rs`.
2. Explicit `### Security` section in the next CHANGELOG entry, plus user-facing notes.
3. `SECURITY.md` update if the threat model shifts.
4. Stop and confirm with the user before silently "upgrading" parameters.

---

## 5. Auth architecture

A random **256-bit master key** is generated at journal creation (`db/schema/create.rs`). It encrypts every entry field with AES-256-GCM. The master key itself is **never** stored in plaintext — it is wrapped per registered auth slot in the `auth_slots` table (schema v3+). See `SECURITY.md:47-69`.

Three wrap methods exist:

| Method | File | Wrap mechanism | Stores |
|---|---|---|---|
| `PasswordMethod` | `crates/mini-diarium-crypto/src/auth/password.rs` | Argon2id-derived key + AES-256-GCM | PHC hash + AES-GCM blob |
| `KeypairMethod` | `crates/mini-diarium-crypto/src/auth/keypair.rs` | X25519 ECIES + HKDF-SHA256 + AES-256-GCM | X25519 public key + 92-byte ECIES blob |
| `AutoKeyMethod` | `crates/mini-diarium-crypto/src/auth/auto_key.rs` | 32-byte device-bound random key + AES-256-GCM (no KDF — already 32 bytes of entropy) | Wrapping key hex lives in `config.json`, **not** in the DB |

Hard rules:

- **`change_password` is O(1)**: re-wraps the master key only. **Never re-encrypt entries on password change** — that conversation always ends in a production bug. See `SECURITY.md:61`.
- **`remove_auth_method` refuses to delete the last slot.** That guard lives at `src-tauri/src/commands/auth/auth_methods.rs:197+`. Never remove or weaken it. Removing the only auth method = unrecoverable journal.
- **`require_all_auth` (per journal)** forces `unlock_diary_all_methods`. Single-method unlock paths must keep the guard. The guard lives in `commands/auth/auth_core.rs:80-90` and again at `:136-146` (one per single-method unlock path). When adding a new single-method unlock path, add the guard there too.
- **Passwordless (`AutoKeyMethod`)** is accepted per `docs/decisions/2026-04-passwordless-journal.md`. Trade-off: OS-account compromise = journal compromise. The UI surfaces this via an explicit acknowledgement checkbox in `PasswordCreation.tsx`. The `auto_key` hex **must** stay in `config.json` — moving it into the DB creates a decryption circularity (you would need the key to decrypt the key).
- **Master-key returns** travel as `SecretBytes` (`crates/mini-diarium-crypto/src/auth/mod.rs:21-53`) so they zeroize on drop even if the caller forgets.
- **Both success and error paths zeroize.** Wrong-password code paths must also call `.zeroize()` on derived wrapping keys. See `crypto/password.rs:60` (success) and `:103` (error).

---

## 6. Auto-lock: all three paths must fire

Auto-lock is a triple-path mechanism. **A change to one path is implicitly a change to all three** — the agent must verify the other two still work.

### Path A — Frontend idle timer (`src/App.tsx:20-55`)

- Tracks user activity events: `mousemove`, `keydown`, `click`, `touchstart`, `scroll` (`App.tsx:22`).
- After `autoLockTimeout` seconds of inactivity, calls `lockJournal()` (`App.tsx:42`).
- Cleanup in `onCleanup` removes listeners and clears the timer (`App.tsx:48-54`).
- Controlled by `autoLockEnabled` + `autoLockTimeout` preferences.

### Path B — Backend OS events (`src-tauri/src/screen_lock.rs`)

- Windows: `WM_WTSSESSION_CHANGE` (lock/logoff) + `WM_POWERBROADCAST` (suspend) via Win32 subclass (`screen_lock.rs:1-100`).
- macOS: screen-sleep + `com.apple.screenIsLocked` notifications.
- Both call `commands::auth::auto_lock_diary_if_unlocked(...)` (`screen_lock.rs:79`, `:208`) and emit `'journal-locked'`.
- **Fires even when the app is in the background.**

### Path C — Frontend focus-loss lock (`src/lib/focus-lock.ts` + `src-tauri/src/window_focus.rs`, wired in `App.tsx`)

- **Not** DOM `visibilitychange` — the original design, disproven by manual testing (TODO-0068): WebView2 does not reliably update `document.visibilityState` on window minimize (confirmed with the CDP debugger fully detached, ruling out an automation-tooling confound).
- Detection lives in Rust (`window_focus.rs`): `on_window_event` on `WindowEvent::Focused`, emitting `"window-unfocused"` (false) / `"window-focused"` (true). A single push-based event pair covers minimize, Alt+Tab/Cmd+Tab away, clicking another app's window, and (on macOS) Cmd+H "Hide" — all of these resign/regain the window's key/active status at the OS level: `WM_KILLFOCUS`/`WM_NCACTIVATE` (Windows), `windowDidResignKey` (macOS — its own doc comment in tao explicitly calls out the Cmd+Tab case), GTK `focus-out-event` (Linux, forwarded as a genuine `WindowEvent` unlike minimize/iconify, which GTK only tracks internally). No polling needed — this superseded an earlier `is_minimized()`-polling design once source inspection confirmed `Focused` is reliably forwarded on all three platforms.
- **Debounced, not immediate** (`FOCUS_LOSS_DEBOUNCE_MS`, `focus-lock.ts`, default 3000ms, parametrized as an `options.debounceMs` field so it's overridable in tests and easy to retune): user feedback after shipping the immediate-lock version reported that a misclick outside the window locked the journal instantly, which was too aggressive. `window-unfocused` now starts a `setTimeout` instead of locking; `window-focused` clears it. `isDialogOpen()` and `isUnlocked()` are (re-)checked when the timer actually fires, not at the initial event, since either can change during the debounce window.
- **Design iteration history**: (1) frontend-only `visibilitychange`/`blur` — disproven, WebView2 doesn't fire it reliably on minimize; (2) Rust `is_minimized()` polling + a macOS-specific `NSApplication.isHidden` poll for Cmd+H — replaced because it missed alt-tab/click-away entirely, which the user confirmed was undesired (intent is "lock on any focus loss"); (3) `WindowEvent::Focused(false)`-only, immediate lock — replaced after the user reported it was too aggressive (locks on a misclick); (4) current: `Focused(false)`/`Focused(true)` pair + debounce.
- Native dialogs (export/import/key-file save) also resign the main window's focus the same way real focus-loss does. `src/lib/dialog.ts` wraps `open`/`save`/`confirm` from `@tauri-apps/plugin-dialog` with a shared open-dialog counter (`isDialogOpen()`); `focus-lock.ts` checks it when the debounce fires. **Every dialog call site must import from `dialog.ts`, never the plugin directly** — src/CLAUDE.md gotcha #10 — or it reopens the false-positive gap. A dialog that closes within the debounce window also self-cancels via the `window-focused` event when focus returns to the main window.
- **Reschedule, not abandon, when the debounce fires while `isDialogOpen()` is true** (Task 3.5 of `docs/archive/project-support-overlay-plan.md`, 2026-08-21): the debounce check used to `return` outright when `isDialogOpen()` was true at fire time, which meant a dialog left open longer than the debounce window disabled the lock for the rest of that open period, however long. It now reschedules itself (`scheduleCheck`) and re-checks every `debounceMs` until `isDialogOpen()` returns `false`, at which point it locks if the window is still unfocused and the journal is still unlocked — the lock is delayed, not skipped. `dialog.ts`'s `openUrlSuppressingFocusLoss()` (added by the same task, used only by `ProjectSupportOverlay`'s external-link buttons) is a second, **time-bounded** producer of `isDialogOpen() === true`: it increments the same counter for a fixed `EXTERNAL_HANDOFF_SUPPRESS_MS` (3500ms, kept in `dialog.ts` and hand-synced to stay strictly greater than `FOCUS_LOSS_DEBOUNCE_MS` to avoid a circular import) rather than for a dialog's actual open/close lifetime, since `openUrl()` resolves immediately and there is no promise to await for the browser handoff itself.
- **Known gap**: the dialog guard only covers the app's own dialogs. It does not cover the native menu bar, OS notifications, or other focus-stealers outside the app's own dialog call sites. Closing that fully would need a "does the newly-focused window belong to our own process" check, which is unreliable on Linux/Wayland — the same class of problem that broke the `visibilitychange` design. Not attempted; flagged as a known limitation instead.
- Frontend (`focus-lock.ts`) listens for `"window-unfocused"`/`"window-focused"` via `@tauri-apps/api/event`'s `listen()` and calls `lockJournal()` when the debounce timer fires, `autoLockOnFocusLoss` is enabled (`preferences.ts`, default `false`), the journal is still unlocked, and `isDialogOpen()` is false.
- Guarded multiple ways: the wiring `createEffect` only registers both listeners while `enabled() && isUnlocked()` (cleaning up both unlisten fns and any pending debounce timer — including handling the case where disposal races the pending `listen()` promise — when either goes false); `window-focused` cancels a pending debounce as the primary "don't lock" path; `isDialogOpen()`/`isUnlocked()` are re-checked at fire time as defense-in-depth.
- The Rust handler runs for the app's lifetime regardless of the preference — it only emits events; the frontend decides whether to act on them. Keeps Rust free of preference/lock-state/timing awareness, consistent with `preferences.ts` being frontend/localStorage-only.

### Frontend listener (`src/state/auth.ts:240-263`)

- `setupAuthEventListeners()` listens for `'journal-locking'` (pre-lock cleanup) and `'journal-locked'` (post-lock state reset).
- Wired in `App.tsx` on mount.

**Checklist for any change here:**
- [ ] If you touched `App.tsx`, did backend OS lock (Path B) and the focus-loss lock (Path C) still result in a clean UI lock?
- [ ] If you touched `screen_lock.rs`, did the idle-timer path (Path A) and the focus-loss lock (Path C) still call `lockJournal` cleanly?
- [ ] If you touched `focus-lock.ts`, did the idle-timer path (Path A) and backend OS lock (Path B) still fire independently?
- [ ] Did the `'journal-locked'` event still propagate?
- [ ] Were the platform-specific Win32 / macOS code paths preserved?
- [ ] If you added a new native dialog call site, does it import `open`/`save`/`confirm` from `src/lib/dialog.ts` (not `@tauri-apps/plugin-dialog` directly)? A direct import reopens the false-positive-lock gap Path C's dialog guard exists to close.

---

## 7. The IPC / error sanitization boundary

- **Every** Tauri `invoke()` failure that reaches user-visible UI must go through `mapTauriError(err, t)` from `src/lib/errors.ts:13-51`.
- What it strips: filesystem paths, OS error codes (`os error N`), `rusqlite`/`sqlite`/`argon2` internals.
- What it passes through verbatim: already-user-friendly strings (`"file is too large"`, wrong-password messages — see the regex matches at `errors.ts:17-32`).
- Call sites that may **omit** the translator argument `t`: module-level state (e.g., `src/state/auth.ts`) where no i18n context is available — `mapTauriError` falls back to `defaultT` (English) per the JSDoc at `errors.ts:7-12`. Those errors go to an `error` signal, **not** raw display.

**Red flag patterns to grep for during review:**

```
catch { setError(err.toString()) }
catch { setError(err.message) }
catch (err) { setError(String(err)) }
```

Any of these without `mapTauriError` is a bug. Fix at the call site.

**Useful grep:**
```
invoke\(|from '@tauri-apps/api'
```
For each match, confirm the surrounding `catch` block routes through `mapTauriError`. See `src/CLAUDE.md` "Error Handling" for the canonical pattern.

---

## 8. Data-at-rest rules

| Surface | Encrypted? | Allowed contents | Forbidden contents |
|---|---|---|---|
| `diary.db` | YES — per-field AES-256-GCM | Encrypted entry title/body, `auth_slots` (wrapped master key copies), `db_settings` (schema v6: `require_all_auth` + HKDF-SHA256 MAC), schema metadata | Plaintext entry content; FTS index (removed in schema v4); plaintext title/body |
| `config.json` | NO — plaintext by design | Journal metadata (id, name, path), optional `auto_key` hex (32-byte random wrapping key), `active_journal_id` | Entry content; passwords; master key (plaintext); Argon2 PHC hashes; X25519 private keys; relative paths in journal entries (silently rejected — path-traversal guard); `require_all_auth` flag (moved to `diary.db` `db_settings` table in schema v6) |
| `backups/` | YES — direct file copies of `diary.db` | Up to 30 timestamped copies (`backup.rs:6`); inherit encryption | Anything not derived from a verbatim `fs::copy` of the live DB |
| Key files | N/A — owned by user | The X25519 private key (hex). Mode `0o600` on Unix; NTFS ACLs on Windows. App **never** keeps a copy. | App-side caching of the file or its contents. There is no "reveal key" UI — do not add one. |
| Exports (JSON / Markdown) | NO — **intentionally plaintext** | The portability contract from Principle 4 (`PHILOSOPHY.md:67-88`). UI must warn before write. | Encrypted-export formats. Don't add one without an explicit design review — conflicts with Easy In, Easy Out. |
| `localStorage` | NO | `'preferences'` (`autoLockEnabled`, `autoLockTimeout`, `hideTitles`, `enableSpellcheck`, etc.); `'theme-preference'` (`auto`/`light`/`dark`); `'theme-overrides'` (CSS token JSON). See `src/CLAUDE.md` Gotcha #6 for the three-key fan-out. | Entry content; passwords; master key; auth material; decrypted anything |
| Debug dump (`commands/debug.rs`) | NO — written to user-chosen path | Entry counts, distinct-day count, word totals, date range, plugin counts, schema version, OS info, build type, preferences JSON passed from frontend (`debug.rs:8-43`) | Entry titles or bodies; passwords; keys; auth material; filesystem paths beyond the diary directory root |

**Reconciliation: `auto_key` in `config.json` vs. "no plaintext on disk"**

The non-negotiable from `PHILOSOPHY.md:166` is about *diary content*, not wrapping keys. `auto_key` is a 32-byte random AES wrapping key; the entries it wraps remain AES-256-GCM ciphertext on disk. The ADR (`docs/decisions/2026-04-passwordless-journal.md:38-40`) makes this explicit. **Do not "fix" this by moving plaintext entries somewhere else, or by removing `auto_key`.** The trade-off is documented and acknowledged in the UI.

**WAL-mode caveat:** SQLite is in default journal mode (DELETE), not WAL. `fs::copy` is therefore safe (`backup.rs:22-28`). A backup taken mid-write could theoretically capture a partial transaction; documented in `SECURITY.md:87-88`. Switching to WAL requires switching backups to the SQLite Online Backup API at the same time.

---

## 9. Search: in-memory scan (no plaintext on disk)

FTS was removed in v0.2.0 (schema v4) because the plaintext `entries_fts` table defeated encryption at rest. Search was reintroduced as an in-memory scan: each query decrypts entries (same decrypt path as export/stats), matches case- and accent-folded terms, builds HTML-escaped `<mark>` snippets, and discards everything. Nothing searchable is written to disk. **Do not delete any of these:**

| Layer | Path | Purpose |
|---|---|---|
| Rust command | `src-tauri/src/commands/search.rs` | `SearchResult` struct + `search_entries` (in-memory decrypt + scan) |
| TS wrapper | `src/lib/tauri/search.ts` | `SearchResult` interface + `searchEntries(query)` |
| State | `src/state/search.ts` | `searchQuery`, `searchResults`, `isSearching` signals |
| UI | `src/components/search/SearchOverlay.tsx` (+ `SearchBar.tsx`, `SearchResults.tsx`) | Palette-style dialog mounted in `MainLayout` |
| Reindex anchors | `// Search index hook:` comments in `crates/mini-diarium-core/src/db/queries/entries.rs` (insert/update/delete) and `src-tauri/src/commands/import.rs` (bulk) | Unused today (in-memory scan needs no index); mark where a future encrypted index would plug in |

**Constraints for any future implementation (non-negotiable):**

1. **No plaintext on disk.** Encrypted index, or in-memory rebuilt at unlock, or SQLCipher-style encrypted FTS. Do not reintroduce a plaintext FTS5 table.
2. **Schema migration required.** Bump `SCHEMA_VERSION` in `db/schema/mod.rs:32` and add a migration step.
3. **All reindex hooks wired.** Every `// Search index hook:` site must call into the new module.
4. **UI placement is undecided.** Wire `SearchBar`/`SearchResults` into `Sidebar.tsx` or a new component; do not assume the old layout. See `src-tauri/CLAUDE.md` "Implementing Search" for the design constraints.

---

## 10. Plugin / Rhai sandbox

- User scripts live in `{diary_dir}/plugins/*.rhai`. No filesystem access, no network access, Rhai `set_max_operations` and other safety limits applied (`plugin/rhai_loader/runtime.rs:13-15`, inside `create_sandboxed_engine`).
- Built-ins and Rhai plugins share the same `ImportPlugin`/`ExportPlugin` traits (`plugin/mod.rs`). There is **no privileged built-in path** — built-ins implement the same interface as user-provided extensions (see `PHILOSOPHY.md:204`).
- The `unsafe impl Send for RhaiImportPlugin {}` / `unsafe impl Sync` (and the matching pair on `RhaiExportPlugin`) at `plugin/rhai_loader/runtime.rs:126-127,150-151` is **justified** because the AST is immutable after compilation and the Engine is created fresh per invocation. **Adding cached mutable engines, plugin state, or shared mutable AST invalidates the justification** — flag for redesign and update or remove the `unsafe` blocks accordingly. See `src-tauri/CLAUDE.md` Gotcha #7.
- Rhai's `export` is a reserved keyword → export scripts must define `fn format_entries(entries)` (not `fn export`). The `RhaiExportPlugin` wrapper calls `"format_entries"` internally. See `src-tauri/CLAUDE.md` Gotcha #6.
- The plugin registry is built **once at startup**; diary-directory changes require app restart. Do not add hot-reload without threat modelling — it opens a path for the plugin dir to swap underneath a running unlock. See `src-tauri/CLAUDE.md` Gotcha #5.
- `unsafe impl Send + Sync` should only ever appear on Rhai wrappers. Any new `unsafe impl` on a plugin type requires explicit review.

---

## 11. Import / export safety

- **Imports always create new entries.** There is **no date-conflict merge** (`PHILOSOPHY.md:73`). Re-import = duplicates; that is the correct behaviour.
- **File-size caps:**
  - Imports: 100 MB (`MAX_IMPORT_FILE_SIZE` at `src-tauri/src/commands/import.rs:5`).
  - Markdown single-file read: 1 MiB (`MAX_TEXT_FILE_BYTES` at `src-tauri/src/commands/files.rs:19`).
- **File-read allowlists** (no wildcards):
  - `read_file_bytes` accepts only `jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp` (`commands/files.rs:7`).
  - `read_text_file` accepts only `.md` (`commands/files.rs:27`).
  - **Any new file-read command must add an explicit extension allowlist and a size cap.** No exceptions.
- **HTML/Markdown sanitization on import:** Markdown imports go through DOMPurify in `src/lib/markdown.ts:18-21` before TipTap. **Do not bypass.** TipTap's own sanitization is not sufficient for untrusted markdown.
- **Export side:** JSON and Markdown are intentionally plaintext (Principle 4). Adding an "encrypted export" format requires explicit design review — it conflicts with Easy In, Easy Out (Principle 4 in `PHILOSOPHY.md:67-88`).
- The reindex hook in `commands/import.rs::import_entries` (`// Search index hook:`) must be preserved when refactoring imports — see Section 9.

---

## 12. Runtime boundaries (Tauri capabilities, CSP, E2E isolation)

### CSP (`src-tauri/tauri.conf.json:24`)

Current CSP:
```
default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; worker-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'none'
```

**Any broadening — external `script-src`, wildcard origins, `'unsafe-eval'`, remote `connect-src` — is a breaking security change.** Requires non-negotiable review and a `### Security` CHANGELOG entry.

### `dangerousDisableAssetCspModification: ["style-src"]` (`tauri.conf.json:25`)

**This flag is intentional. Do not remove because the name looks scary.**

Reason: Tauri injects a runtime nonce into every CSP directive. When a nonce is present in `style-src`, browsers ignore `'unsafe-inline'` per the CSP spec. This silently breaks TipTap's inline `style="text-align: X"` node-attribute rendering — alignment looks broken in production builds with no console error in dev. The flag disables nonce injection **only** for `style-src`; `script-src` remains nonce-protected.

See `src/CLAUDE.md` Gotcha #7 (issue #63). Do not remove or restructure without testing alignment in a **production build** (dev mode masks the bug).

### Tauri capabilities (`src-tauri/capabilities/default.json`)

Current allowlist:
```
core:default
core:window:allow-close
opener:default
dialog:default
window-state:default
```

**No network, no unrestricted fs, no shell, no updater.** Adding any of:
- `http:*`
- `fs:allow-*` without a tight scope
- `shell:*`
- `updater:*`

…is a security decision. Justify in the PR description and add to `SECURITY.md` Operational Security.

### E2E isolation env vars

`MINI_DIARIUM_E2E`, `MINI_DIARIUM_APP_DIR`, `MINI_DIARIUM_DATA_DIR` are read **only** in `src-tauri/src/lib.rs` (lines 40, 54, 92, 113) at setup time. Verified by `grep -rn 'MINI_DIARIUM_E2E\|MINI_DIARIUM_APP_DIR\|MINI_DIARIUM_DATA_DIR' src-tauri/src/` returning matches in `lib.rs` only.

**Never read these env vars in commands or business logic.** Doing so leaks test-only escape hatches into production builds (anyone setting the env var bypasses the protection). Any new reference outside `lib.rs` is a bug — move it back to `lib.rs` setup and pass the result through `State<>` if needed.

---

## 13. Concurrency & state-handling rules

- `DiaryState` = `Mutex<Option<DatabaseConnection>>`. `None` = locked, `Some(db)` = unlocked. See `src-tauri/CLAUDE.md` "Security Rules".
- Every entry-accessing command must check unlocked state:
  ```rust
  let db = db_state.as_ref().ok_or("Diary not unlocked")?;
  ```
  (This exact string — or one matched by `errors.ts:23` `journal (must be|is not) unlocked` — so `mapTauriError` can route it to `errors.journalNotUnlocked`.)
- **Mutex poisoning must not panic.** Commands must propagate a string error rather than letting a panic escape the Tauri boundary (a panic in a command aborts the process). For DB-only commands, use `with_unlocked_db` (canonical errors: `"Journal state lock failed"` / `"Journal must be unlocked"`). For commands that must open-code the preamble, use `.map_err(|_| "Journal state lock failed".to_string())`. **Do not** use `.unwrap()` on a Mutex — that converts a poisoned lock into a process abort.
- **Schema migrations** (`db/schema/migrations/`) must be idempotent and wrapped in a transaction. Historical v3→v4 and v4→v5 followed this; new migrations must too. Bump `SCHEMA_VERSION` (`db/schema/mod.rs:32`) and document the migration step inline.
- New commands must be registered in **two** places: `src-tauri/src/commands/mod.rs` (module) and `lib.rs` `generate_handler![]`. Missing either causes silent failure or compile error. Add the typed wrapper in the matching command-category sub-file under `src/lib/tauri/`. See `src-tauri/CLAUDE.md` "Adding a New Tauri Command".
- `unsafe` blocks outside crypto crates appear in four places: `screen_lock.rs` (Win32 subclass / WTS APIs), the two Rhai wrapper `Send + Sync` impls in `rhai_loader/runtime.rs:126-151`, and the two network-isolation platform handlers in `lib.rs` — `install_webresource_requested_handler` (Windows COM, `lib.rs:373+`) and `install_content_rule_list` (macOS ObjC2, `lib.rs:448+`). Each `unsafe` block has a `// SAFETY:` comment justifying it. **Any new `unsafe` block elsewhere requires explicit security review and a `SAFETY:` block matching that pattern.**

---

## Useful greps (canary searches for review)

Run these before merging anything that touched a Section 1 surface. A surprising result is usually a bug.

| Goal | Command |
|---|---|
| Network crates snuck into Cargo.toml | `grep -nE 'reqwest\|hyper\|socket2\|ureq' src-tauri/Cargo.toml crates/mini-diarium-core/Cargo.toml` |
| Raw error display without sanitization (frontend) | `grep -rnE "setError\((err\.toString\(\)\|err\.message\|String\(err\))" src/` |
| `invoke()` call sites that may need `mapTauriError` review | `grep -rn "invoke(" src/lib/tauri/` and audit downstream callers |
| `MINI_DIARIUM_E2E*` env vars leaking outside `lib.rs` | `grep -rn "MINI_DIARIUM_E2E\|MINI_DIARIUM_APP_DIR\|MINI_DIARIUM_DATA_DIR" src-tauri/src/` (must show `lib.rs` only) |
| `unwrap()` on the diary mutex (Mutex-poison panic risk) | `grep -rn "state.db.lock().unwrap" src-tauri/src/` |
| New `unsafe impl` blocks | `git grep -n "unsafe impl" -- src-tauri/src crates` (expect: 4 in `plugin/rhai_loader/runtime.rs` — `Send`/`Sync` for `RhaiImportPlugin` and `RhaiExportPlugin`; zero in `lib.rs` — the platform handlers use `unsafe {}` blocks, not `unsafe impl`) |
| New file-read commands without allowlist | `grep -rn "std::fs::read" src-tauri/src/commands/` and confirm extension/size guards |
| Plaintext logging of secret material | `grep -rnE "info!\|debug!\|println!\|eprintln!" crates/mini-diarium-core/src/auth/ crates/mini-diarium-crypto/src/auth/ crates/mini-diarium-crypto/src/crypto/` and confirm no secrets in format args |
| FTS reintroduction | `grep -rn "fts5\|entries_fts" src-tauri/src/` (must return empty) |

---

## A. Change-review checklist (use before proposing a diff)

Run through this list when modifying anything in Section 1's load-trigger surfaces.

- [ ] Does this introduce a network dependency (crate, capability, fetch)? **STOP if yes.** Violates non-negotiable #1.
- [ ] Does this introduce custom crypto (homegrown MAC, KDF, nonce scheme, cipher mode)? **STOP if yes.** Violates non-negotiable #2.
- [ ] Does this add a code path where passwords / master key / `SecretBytes` are logged, printed, serialized into telemetry, or copied into an unzeroized buffer? **Fix before merging.**
- [ ] Does this add a new `invoke()` call? Is its error piped through `mapTauriError(err, t)`?
- [ ] Does this change crypto parameters (Argon2id m/t/p, AES key size, nonce length, HKDF info)? **Schema migration + CHANGELOG `### Security` + `SECURITY.md` review.**
- [ ] Does this persist anything new to disk? Is it ciphertext, or explicitly non-sensitive (prefs, paths, public keys)? Does it stay out of `localStorage` if it's sensitive?
- [ ] Does this touch auto-lock (App.tsx timer or screen_lock.rs)? Did I verify the **other** path still fires on Windows + macOS + Linux?
- [ ] Does this add/remove a Tauri command? Does it call `db_state.as_ref().ok_or("Diary not unlocked")?` where applicable? Does it handle `Mutex` poisoning **without panicking**? Is it registered in both `commands/mod.rs` and `generate_handler![]`?
- [ ] Does this touch search? Did I preserve the stub interface contract (Section 9)?
- [ ] Does this add a schema migration? Is it idempotent, transactional, and does it bump `SCHEMA_VERSION`?
- [ ] Does this change CSP or `dangerousDisableAssetCspModification`? Did I test text alignment in a **production build** (not dev)?
- [ ] Does this add a Tauri capability? Is it strictly necessary, scoped, and documented in `SECURITY.md`?
- [ ] Does this read `MINI_DIARIUM_E2E*` env vars **outside** `src-tauri/src/lib.rs` setup? Move the read to `lib.rs`.
- [ ] Does this add a new file-read command? Explicit extension allowlist + size cap?
- [ ] Does this touch import? Is DOMPurify still on the path for HTML/Markdown ingestion?
- [ ] Does this touch `remove_auth_method`? Is the last-slot guard still intact?
- [ ] Does this touch `require_all_auth` enforcement? Are **all** single-method unlock paths still guarded?
- [ ] Does this expand the threat model (sync, share, cloud feature)? **Update `SECURITY.md` *before* shipping.**

## B. New-feature decision framework (from `PHILOSOPHY.md:146-157`)

Six principle questions, plus two Mini-Diarium-specific ones. Answer all eight honestly.

1. **Core or extension?** (Principle 1 — `PHILOSOPHY.md:11-26`)
2. **Security impact / new crypto assumption?** (Principle 2 — `PHILOSOPHY.md:28-44`)
3. **Test coverage possible, fast, deterministic, offline?** (Principle 3 — `PHILOSOPHY.md:47-64`)
4. **Does it affect import/export or create lock-in?** (Principle 4 — `PHILOSOPHY.md:67-88`)
5. **Scope creep vs. focused journaling?** (Principle 5 — `PHILOSOPHY.md:92-117`)
6. **Simplicity cost vs. benefit?** (Principle 6 — `PHILOSOPHY.md:121-142`)
7. **Does this require a schema migration?** Plan it up-front; bump `SCHEMA_VERSION`; write the migration step.
8. **Does this expose anything to the frontend that was previously backend-only?** Audit `mapTauriError` coverage at every new call site.

If any principle is violated without strong justification → reconsider.

---

## C. Tests that must stay green for security-critical changes

Security-critical changes to the listed surfaces must keep these test suites green. If a test fails, **do not delete or weaken the test** — it is asserting an invariant. Fix the code instead.

| Suite | Command | What it asserts |
|---|---|---|
| Cipher round-trip + tamper | `cargo test --workspace crypto::cipher` | Encrypt/decrypt round-trip, ciphertext-uniqueness (per-call random nonce), tag-mismatch on tampered ciphertext, tag-mismatch on tampered nonce, wrong-key rejection (`crypto/cipher.rs:148-296`). |
| Password hash + verify | `cargo test --workspace crypto::password` | Argon2id parameter shape (`m=65536`, `t=3`, `p=4` literal in PHC string), hash determinism for same salt, salt uniqueness, unicode + empty-string passwords, wrong-password rejection (`crypto/password.rs:108-232`). |
| Auth slots round-trip | `cargo test --workspace auth` | Wrap/unwrap of master key for password, keypair, and auto-key methods; last-slot guard; `change_password` re-wraps without entry re-encryption. |
| File-read allowlists | `cargo test --workspace files` | `read_file_bytes` rejects non-image extensions; `read_text_file` rejects non-`.md` and oversized files (`commands/files.rs:44-110`). |
| Schema + migration | `cargo test --workspace db::schema` | Schema creation; v3→v4→v5→v6 migrations idempotent. |
| Frontend error mapping | `bun run test:run -- errors` | `mapTauriError` strips paths and OS codes; passes through user-friendly `"file is too large"` (see `errors.ts:30-32`). |
| E2E unlock + lock + re-unlock | `bun run test:e2e:local` | Critical user flow: create journal, lock, unlock again. End-to-end against the real binary. |

If a security change makes one of these assertions impossible to keep, that is a signal to **stop and discuss with the user** — not to delete the test. The benchmarks in `src-tauri/benches/cipher_bench.rs` are also a useful sanity check that performance hasn't degraded after a crypto-parameter change.

---

## References (deep-read map)

Compact pointers — do not duplicate content from these.

- `PHILOSOPHY.md` — six principles + non-negotiables (authoritative)
- `SECURITY.md` — threat model, crypto architecture, known limitations (authoritative)
- `docs/decisions/2026-04-passwordless-journal.md` — Option B-prime rationale; threat-model shift; future migration to OS keychain
- `CLAUDE.md` (root) — command registry, cross-cutting conventions, dual-path auto-lock note (Gotcha #3)
- `src-tauri/CLAUDE.md` — backend security rules; Tauri command pattern; FTS removal (Gotcha #1); auth slots (Gotcha #4); plugin registry init (Gotcha #5); Rhai reserved keyword (Gotcha #6); `unsafe impl Send + Sync` justification (Gotcha #7); search-implementation constraints
- `src/CLAUDE.md` — frontend error handling; `mapTauriError` pattern; base64 images in encrypted text field (Gotcha #5); three localStorage keys (Gotcha #6); `dangerousDisableAssetCspModification` (Gotcha #7)
- `docs/diagrams/unlock.mmd`, `docs/diagrams/architecture.svg` — visual walkthroughs of unlock flow and layered architecture
- `CHANGELOG.md` — `### Security` sections per release (v0.2.0 FTS removal; v0.3.0 zeroization; v0.4.19 mandatory multi-auth; etc.)
