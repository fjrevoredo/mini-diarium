# Open-Core Strategy

_Standalone assessment. Not an architecture decision record. The decision remains open and belongs to the maintainer._

## 1. Purpose and scope

This document does two things:

1. Defines, conceptually, what a separate premium product ("MiniDiarium+") could be.
2. Explores and defines the incremental changes needed to turn today's Mini Diarium into a proper open core that a separate product can consume as a dependency.

It is a strategy and reference document, not an approval and not an implementation plan with tracked milestones. If a direction is chosen, the Part 2 steps should be re-expressed as tracked TODO items via the `todo-manager` skill.

Related: [`PHILOSOPHY.md`](../PHILOSOPHY.md) (the non-negotiables that scope what the open core may do).

## 2. Positioning and brand model

Two distinct products, communicated explicitly as distinct:

- **Mini Diarium** (the open core): MIT-licensed, local-only, the five `PHILOSOPHY.md` non-negotiables hold absolutely. Nothing in this document weakens that. The open core stays fully functional standalone; it is never crippled to push the premium product.
- **MiniDiarium+** (separate product): its own brand, its own repository, its own honestly-documented threat model. It depends on the open core but is not "Mini Diarium with network turned on." Any place its guarantees differ from the core is stated plainly, on its own security page.

**The moat is the brand, not the license.** MIT covers the code: anyone may fork it, but no one else may ship it as "Mini Diarium" or "MiniDiarium+". The name is what gates the premium tier, so the trademark is the asset worth protecting early if the commercial track matters. The single-copyright-holder position (Francisco J. Revoredo) keeps relicensing and dual-licensing options open.

## Part 1: What MiniDiarium+ could be (conceptual)

## 3. Product thesis

The offering is a ladder of three tiers along a single axis: **how much the user has to manage**. At one end the user runs everything themselves; at the other the service handles all the chores. Convenience rises as you move up the ladder, but the guarantee stays end-to-end encrypted at every rung. Each tier targets a different user, and the user chooses the tier that matches how much they want to manage.

MiniDiarium+ is the paid web product and offers the two service-side tiers as **two modes of one web app**. The third tier is the existing free desktop app, which is not part of + at all. Two rules hold the ladder together and keep + from decaying into a generic journal app:

- **Every tier stays zero-knowledge on content.** The convenience budget is spent only on removing technical chores (install, dependencies, file handling, sync setup), never on the encryption guarantee. Zero-knowledge is the product identity, not a feature toggle. A managed tier that could read entries would just be another journal SaaS; one that provably cannot is the whole differentiator.
- **Every tier can export its `.db` down to the tier below** (Section 6), so no tier is a trap and no tier locks the user in.

What separates the tiers is therefore not "who can read your journal" (nobody but you can, at any tier) but "how much the user personally has to hold and operate," which is what actually gates the non-technical audience.

## 4. The three-tier custody ladder

| | Tier 1: Managed | Tier 2: Web (bring your own `.db`) | Tier 3: Desktop (free, today) |
|---|---|---|---|
| Product | MiniDiarium+ (managed mode) | MiniDiarium+ (web mode) | Mini Diarium (open core) |
| Who holds the `.db` | The service (ciphertext only) | The user (provided per session) | The user |
| Who holds the key | The user (password-derived, client-side) | The user (entered per session) | The user |
| Where decryption runs | The browser (client-side) | The browser (client-side) | Native desktop process |
| Account recovery | User-held backup factors only (recovery code / second device); no server-side reset | Not applicable (user holds file and key) | Not applicable |
| Guarantee | Zero-knowledge on content; server stores ciphertext only; web residuals (Section 6) | Zero-knowledge on content; server ideally never stores the file; web residuals | Strongest; nothing leaves the device, no served code |
| Chores the user handles | None beyond a one-time recovery-code save | Bring the `.db` each session, keep the updated copy | Install, updates, file location, sync setup |
| Target user | Non-technical; "create an account and that is it" | Wants web reach but keeps custody of the file | Technical; wants the hardest guarantee |

**Tier 1 (Managed), zero-knowledge.** The user creates an account and does nothing else: no install, no dependencies, no file handling, no sync setup. The convenience is entirely in removing technical chores; it is not bought by weakening the guarantee. Encryption stays client-side and the server stores only ciphertext, so the service cannot read entries. Signup is still just email and password: the password is derived client-side into two separate values, an authentication verifier the server checks and an encryption key the server never sees. The one zero-knowledge-visible onboarding moment is a single prompt to save a recovery factor (Section 6), because zero-knowledge means the service cannot reset a forgotten password on the user's behalf.

**Tier 2 (Web, bring your own `.db`).** The user provides their `.db` and password each session and then uses the journal from a browser. The file is decrypted client-side, the password never leaves the browser, and the server ideally never persists the plaintext, the key, or the file. The user keeps custody of the file (they bring it, they take the updated one away). It buys web reach without handing the journal to a server, and needs no account.

**Tier 3 (Desktop, free).** Today's app, unchanged. Strongest guarantee, most technical to run. The reference point the other tiers are measured against.

## 5. Feature inventory per tier

The custody ladder (Section 4) describes the tiers by *who holds what*. This section describes them by *what the user can do* — the concrete capability set. The organizing principle mirrors the product thesis: **Tier 3 is the full feature baseline that every tier inherits, and the higher tiers are additive** (they change the operating environment and add service conveniences, never subtract journaling capability). This keeps the two ladder rules visible: capability is not what gates the tiers (custody and chores are), and nothing higher up is missing from the tier below.

### 5.1 The Tier 3 baseline (today's app; inherited by every tier)

Everything below already ships in the free desktop app and defines the journaling capability every tier must preserve. Grouped by area:

**Writing and content**
- Encrypted rich-text entries (TipTap editor), AES-256-GCM at rest; plaintext never touches disk.
- Multiple entries per date, each with a stable integer `id`.
- Multiple journals, each an independent encrypted `.db`; switching journals auto-locks.
- Embedded images with encrypted thumbnail metadata.
- Tags (`tags` / `entry_tags`).
- Per-entry lock against accidental edits (plaintext flag; not a security boundary).
- Per-entry word count and aggregate statistics.

**Navigation and retrieval**
- Calendar-based navigation and a timeline with encrypted per-entry previews.
- Go-to-date.
- Full-text search implemented as an in-memory decrypt-and-scan; no plaintext index is ever persisted.

**Security and authentication**
- Password authentication (Argon2id) and key-file authentication (X25519 ECIES), tracked as wrapping slots in `auth_slots`.
- Multiple auth methods per journal, with an optional "require all" mode.
- O(1) password change (re-wraps the master key only; no entry re-encryption).
- Auto-lock from three independent paths: frontend idle timer, OS session lock/logoff/suspend, and OS focus-loss.
- Rotated, encrypted local backups.
- Memory zeroization on all exit paths; no network access of any kind.

**Portability and extensibility**
- Import: Mini Diary JSON, Day One JSON, Day One TXT, jrnl JSON.
- Export: JSON (structural, with entry IDs), Markdown (readable HTML-to-Markdown), plus PDF and print.
- Local Rhai plugin scripting for custom import/export pipelines (offline, user-controlled, auto-discovered from `<diary_dir>/plugins/`).

**Presentation and platform**
- Themes, configurable fonts, and localized UI (en / es / de) with a native OS menu.
- Cross-platform desktop: Windows, macOS, Linux.

### 5.2 What makes Tier 2 special (Web, bring your own `.db`)

Tier 2 is the Tier 3 journaling feature set relocated into the browser. Its distinguishing value is *where and how it runs*, not new journaling power:

**Adds**
- Runs entirely in the browser — no install, no updates to manage, reachable from any device by URL.
- Client-side crypto compiled to WebAssembly and a WebAssembly SQLite substitute (sql.js / wa-sqlite) that reads and writes the same encrypted-row format.
- Zero account and zero server custody: the user brings the file and password, and takes the updated file away.

**Honest deltas versus Tier 3** (features that do not carry over cleanly, and must be documented rather than implied):
- The served-code residual: the browser runs code the server delivers on every visit (Section 6), which the desktop binary avoids.
- OS-integrated behaviors have no direct browser equivalent: native menu, OS session-lock and focus-loss auto-lock, and native file dialogs are replaced by web-shaped equivalents or dropped.
- Local Rhai plugin discovery (a filesystem scan of `<diary_dir>/plugins/`) has no browser filesystem to scan; a plugin surface for the web tier is a separate, deferred question.
- Rotated local backups become the user's responsibility, since they hold and manage the file directly.

Everything else — entries, journals, images, tags, search, import/export, statistics, i18n — is the same capability operating on a user-supplied file.

### 5.3 What makes Tier 1 special (Managed)

Tier 1 is Tier 2 plus a zero-knowledge backend. It keeps every Tier 2 capability and removes the last chore — holding the file — without letting the server read content:

**Adds**
- Accounts: signup with email and password, the password split client-side into a server-checked authentication verifier and a client-only encryption key.
- Server-side encrypted storage: the service holds per-user ciphertext blobs, wrapped-key slots, and the auth verifier, and never the plaintext or the key.
- Multi-device sync of that ciphertext.
- Recovery without server reset: additional wrapping slots enrolled at signup (a device passkey or biometric for convenient re-unlock, and a one-time recovery code), reusing the core's existing per-slot master-key wrapping.
- Optionally, a client-generated high-entropy account key (the 1Password Secret Key pattern) to harden at-rest ciphertext against weak user passwords.

**Inherits the same Tier 2 deltas** versus desktop (served-code residual, no OS-integrated auto-lock, web plugin question), plus the metadata a server unavoidably observes: that an account exists, login and sync timing, ciphertext sizes, device count. It never observes entry content. This is why Tier 1 is documented as "zero-knowledge on content, with web-side residuals," not "identical to Tier 3."

## 6. Threat-model discipline (non-negotiable-driven)

- **Every tier ships its own honest threat statement.** `PHILOSOPHY.md`'s "Honest threat documentation" non-negotiable applies to + as strictly as to the core. Each tier states what it protects and what it does not, and no tier is allowed to imply it inherits the tier below's guarantee.
- **Tier 1 stays zero-knowledge, and the existing auth model already supports it.** The service never holds the key or plaintext; the browser derives the key from the account password and decrypts locally. Recovery is the only real friction, and it is solved without server custody by reusing the core's existing design: the master key is already wrapped per authentication slot in `auth_slots` (a password slot, a keypair slot). A managed tier enrolls additional wrapping slots at signup, a device passkey or biometric for convenient re-unlock and a one-time recovery code, so a realistic user is not locked out by a forgotten password, yet the service still can never reset it. This needs no new cryptography and inherits the core's existing "no password recovery, register a backup factor instead" stance. To defend the at-rest ciphertext against weak user passwords (a real risk with a non-technical audience), consider mixing in a client-generated high-entropy account key stored on the device and printed in the recovery material, the 1Password Secret Key pattern.
- **What "close to" zero-knowledge concedes.** Client-side crypto keeps content private, but a web tier is still not identical to the desktop guarantee, and the difference must be stated rather than glossed. The server serves the client code on every visit (the served-code caveat below), and it observes metadata it cannot avoid: that an account exists, login and sync timing, ciphertext sizes, device count. It never sees entry content. This is why Tier 1 is "zero-knowledge on content, with documented web-side residuals," not "identical to Tier 3."
- **The web served-code caveat (Tiers 1 and 2).** Any browser tier runs code the server delivers on every visit. Even with fully client-side crypto, a compromised or malicious server could serve JavaScript that captures the password at decrypt time. Desktop (Tier 3) avoids this because the user installs one versioned, auditable binary. The limit is inherent to the web; narrow it with reproducible and signed web builds, subresource integrity, a published client source, and third-party audits, but it cannot be fully erased in a browser.
- **No custom cryptography** still holds everywhere. All tiers use established constructions (AES-256-GCM, Argon2id, the existing X25519/HKDF slot-wrapping stack). A premium price tag is not license to invent protocols.
- **Export down the ladder is the trust anchor.** Every tier lets the user export the raw `.db` and drop to the tier below, including all the way to the zero-trust desktop app. This satisfies the "No vendor lock-in" non-negotiable directly and is the strongest honesty signal the product has: even the most managed tier cannot trap the user's data.
- The open core's public messaging ("zero network access," "no hidden network behavior") stays true precisely because + is a separately-named product. Reusing the base name buys brand equity but imports the expectation, so the "different security model" message has to be loud wherever + is presented.

## Part 2: Making the current app a proper open core (incremental)

## 7. Where we stand today (grounded findings)

The codebase is already well-positioned. Verified against the current tree:

- **The core is already Tauri-free.** `crypto/`, `auth/`, `db/`, `import/`, `export/`, `plugin/`, `backup.rs`, and `config.rs` contain zero `tauri::` references, zero `State<>` / `AppHandle` / `emit` usage, and no upward dependency into `commands/`. The shared domain types (`DiaryEntry` in `db/queries/entries/mod.rs`, `DatabaseConnection` in `db/schema/mod.rs`) live in that Tauri-free layer.
- **The Tauri coupling is confined to the shell.** Only `commands/*`, `lib.rs`, `main.rs`, `menu.rs`, `screen_lock.rs`, `window_focus.rs`, and `webview_security/*` reference Tauri. `DiaryState` (the unlocked-connection holder) correctly lives in the shell at `commands/auth/mod.rs`.
- **Licensing is clean.** MIT, single copyright holder. No legal restructuring required to build a proprietary layer on top.

Consequence: the expensive part of open-core extraction (decoupling business logic from the app framework) is essentially already done by the existing layering. What remains is packaging and API definition, not a rewrite.

## 8. Target architecture

A repo-root Cargo workspace with an explicit core crate:

- **`mini-diarium-core`** (new crate, Tauri-free `rlib`): `crypto/`, `auth/`, `db/`, `import/`, `export/`, `plugin/`, `backup.rs`, `config.rs`, and the shared types. No `tauri` dependency in its `Cargo.toml`.
- **`mini-diarium`** (the existing app, unchanged in behavior): keeps `commands/*` and the OS shell, depends on `mini-diarium-core`.
- **`minidiarium-plus`** (separate private repo): depends on `mini-diarium-core` as a versioned dependency. Never lives in this repo.

**Concrete layout.** A virtual workspace manifest at the repo root, the app left in place at `src-tauri/` (so Tauri config and bundling are untouched), and reusable crates under a neutral top-level `crates/` directory:

```
Cargo.toml              # [workspace] virtual manifest (new), members = ["src-tauri", "crates/*"]
src-tauri/              # app crate "mini-diarium" — unchanged location
  Cargo.toml
crates/
  mini-diarium-core/    # Tauri-free rlib
    Cargo.toml
    src/                # crypto, auth, db, import, export, plugin, backup, config, shared types
  # room for a future mini-diarium-kernel crate (see the M3 gradient below)
```

Rationale, driven by how the crate is consumed: git and crates.io dependencies resolve a package by name regardless of where it sits in the repo, so external consumption (`minidiarium-plus`) and publishing are layout-neutral. What *does* discriminate is that the reusable, Tauri-free, WASM-targeted code must not read as "owned" by a directory literally named `src-tauri/`; a neutral `crates/` home is the idiomatic Rust "library + app" workspace shape and scales cleanly to the later kernel/core sub-split (M3). Keeping the app at `src-tauri/` preserves the `--manifest-path src-tauri/Cargo.toml` convention baked into CI, coverage tooling, `nix/`, benchmarks, and the domain `CLAUDE.md` files.

A gradient exists inside the core worth naming: the truly universal reusable kernel is `crypto` + the `db` encrypted-row format and schema + `auth`. The filesystem-shaped parts (`backup.rs`, `config.rs`, absolute-path assumptions) are desktop-flavored; a hosted or mobile + may reuse the crypto and storage format while replacing the path and backup model. The extraction should not assume every core module is equally relevant to every + surface.

**A consequence of the zero-knowledge constraint.** Because Tier 1 must stay zero-knowledge, the server may never decrypt: it is a ciphertext-and-auth store, not a place that opens the `.db`. So the crypto runs client-side for both service tiers, and they share one foundation:

- The pure-Rust kernel (`crypto/`, and the X25519/HKDF slot-unwrapping in `auth/`) compiles to WebAssembly cleanly and runs in the browser for both tiers.
- The friction is `db/`: `rusqlite`'s bundled C SQLite does not target browser `wasm32` as-is, so both tiers need a WebAssembly SQLite substitute (sql.js / wa-sqlite) plus a re-expression of the encrypted-row read/write format against it. This is the main net-new engineering in the whole ladder, and it is shared, not unique to one tier.
- The server never runs the decrypt path. It stores per-user ciphertext blobs, the wrapped-key slots, and an auth verifier, and serves them to the client. Its reuse of `mini-diarium-core` is therefore minimal; the heavy reuse is client-side.

Tier 1 is then Tier 2 plus a backend: accounts, encrypted server storage, multi-device sync, and slot enrollment. That extra work is conventional web-backend engineering, not cryptography, which is why Tier 2 (the shared client-side foundation, with no backend) is the right thing to build first.

The façade API from Step 2 (Section 9) should therefore be defined so that the crypto-and-format kernel is usable independently of the `rusqlite` handle, so the browser tiers can reuse it without dragging in the desktop SQLite binding.

## 9. Incremental steps

Each step is independently shippable and behavior-preserving. Nothing here changes what the open core does; it changes how it is packaged.

1. **Introduce the workspace and move Tauri-free modules into `mini-diarium-core`.** Pure code-move plus `Cargo.toml` restructure; the app depends on the new crate. Verification: the full existing backend test suite passes unchanged. This is cheap, improves the codebase regardless of the premium track, and is the prerequisite for everything else.
2. **Define a core façade API.** Today `commands/*` reach directly into `db::queries::*` and friends. A consumer crate should not depend on internal module paths. Add a deliberate public API on `mini-diarium-core` (open/unlock, entry CRUD, search, import/export, auth-slot management) so both the Tauri app and + call the same surface. Treat everything else as internal. The surface stays explicitly **pre-1.0 and internal** until step 3 decides distribution — one curated list of names, not yet an external stability promise.
3. **Decide core-crate distribution.** Publish to crates.io (public, versioned, maximally in the open-source spirit) versus a git dependency or submodule (keeps versioning private). MIT permits either; this is a preference, not a constraint.
4. **Decide the frontend boundary (only if + reuses UI).** The SolidJS UI talks to the backend through the `invoke()` seam in `src/lib/tauri/*.ts`. A desktop-shaped + with sync could share most components and state; a hosted-web + needs a substantially different frontend and a JS/WASM layer replacing the Rust backend behind that seam. Defer this until the + surface is chosen, because the answer differs entirely by surface.
5. **Governance groundwork.** Add a CLA if there is any future intent to relicense the core itself (MIT already permits building proprietary layers over outside contributions, so a CLA is only needed for relicensing, not for open-core per se). Register or defend the trademark on the name. Add a short `CONTRIBUTING.md` note that premium features live in a separate product and repo.

## 10. Open-core extraction roadmap

This section sequences the Section 9 steps into concrete, ordered milestones for **completing the open-core packaging of Tier 3**. Scope is deliberately narrow: it is the engineering that turns today's app into a cleanly consumable open core, not new product features and not any + work. The service tiers (WASM SQLite, backend, sync) are explicitly out of scope here; they build on the finished core, not before it.

The roadmap remains a plan, not a commitment. Verification commands follow this repo's WSL-over-Windows convention (route project commands through `cmd.exe /c ...`; `cargo` runs bare with `--manifest-path`).

**Commitment status.** M0–M2 are complete: the baseline was recorded, the workspace split landed, and the core now exposes the documented, sealed pre-1.0 façade. The two M1/M2 review gaps were also closed on 2026-07-22: stale workspace-target documentation now has a regression guard, and the app's last bespoke `rusqlite` read was moved behind the core façade. **M3 and M4 are now approved for backlog tracking** (2026-07-23), while retaining their original sequencing and decision gates: M3 is split into the portable-kernel and desktop-adapter TODOs; M4 is split into distribution, contribution/relicensing, and brand-protection TODOs. Tracking these items does not authorize a + product, network code, or speculative browser storage implementation.

**Ordering rationale.** M1 is the gate for everything (no crate, no façade). M2 depends on the crate existing. M3 depends on the façade existing (it constrains the façade's shape). M4 is decision/governance work that can proceed in parallel but is placed last because it is only meaningful once the crate is real. M1 and M2 each stand on their own merits and are worth doing even if MiniDiarium+ never ships.

Each milestone carries a **Checklist** of `- [ ]` items to tick off as the work lands, so this doc doubles as a live progress tracker alongside the `todo-manager` entries (TODO-0075–0077 cover M0–M2; TODO-0082–0086 split M3–M4). The prose above each checklist stays the source of intent; the checklist is the fillable acceptance list.

### Progress reassessment (2026-07-23)

| Milestone | Status | Evidence / remaining work |
|---|---|---|
| M0 — baseline lock | Complete | Green baseline recorded at `13c29e8`; retained as historical behavior-preserving evidence. |
| M1 — workspace split | Complete | `mini-diarium-core` is a workspace member with no Tauri dependency; the review's stale `src-tauri/target/` documentation gap is guarded by `bun run check:build-paths`. |
| M2 — façade API | Complete | `API.md`, sealed internal modules, and the façade-only app path are present; `peek_auth_slot_types` is now core-owned and the app no longer depends on `rusqlite`. |
| M3 — kernel / handle separation | Pending | The core crate still directly couples encrypted-row read/write code and migrations to `DatabaseConnection`/`rusqlite`; TODO-0082 and TODO-0083 separate the portable kernel from the desktop adapter. |
| M4 — distribution and governance | Pending | No distribution ADR, premium-boundary statement in `CONTRIBUTING.md`, or recorded trademark posture exists; TODO-0084 through TODO-0086 make those independently reviewable. |

### M0 — Baseline lock (precondition)

- **Goal:** a known-green starting point so every later milestone can prove it changed nothing behavioral.
- **Deliverables:** confirm the full suite passes on `master`; record the current backend/frontend/E2E green state as the behavior-preserving baseline.
- **Verification:** `cargo test --manifest-path src-tauri/Cargo.toml`, `cmd.exe /c bun run test:run`, `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run test:e2e`.
- **Exit criteria:** all green; no open behavioral regressions.
- **Checklist:**
  - [x] Backend suite green on `master` (`cargo test --manifest-path src-tauri/Cargo.toml`)
  - [x] Frontend green (`test:run`, `type-check`, `lint`)
  - [x] E2E green (`test:e2e`)
  - [x] Coverage gate green (`coverage:check`)
  - [x] Baseline recorded (commit SHA + green state noted as the reference point)
- **Baseline recorded:** master @ 13c29e8 — backend (522 tests) / frontend (test:run 756 tests + type-check + lint) / E2E (5 spec files, 10 tests) / coverage gate (no instrumented changes to gate; generation pipeline green) all green on 2026-07-20, no flakes or re-runs. This is the behavior-preserving reference for TODO-0076 (M1).

### M1 — Workspace split (Section 9, step 1)

- **Goal:** extract the Tauri-free layer into a standalone `mini-diarium-core` `rlib` the app depends on, in the repo-root workspace layout from Section 8.
- **Deliverables (code move):** a repo-root virtual workspace manifest (`Cargo.toml` with `members = ["src-tauri", "crates/*"]`); `crypto/`, `auth/`, `db/`, `import/`, `export/`, `plugin/`, `backup.rs`, `config.rs`, and shared types moved into `crates/mini-diarium-core/` (no `tauri` dependency in its `Cargo.toml`); the app stays at `src-tauri/`, keeps `commands/*` and the OS shell, and gains a path dependency on the new crate. Pure code-move plus `Cargo.toml` restructure — no logic changes.
- **Deliverables (mandatory tooling migration — a workspace split ripples beyond the code):** update every place that assumes a single crate at `src-tauri/` —
  - CI workflows under `.github/workflows/` (test, build, coverage, benchmarks) so they build/test the whole workspace where intended;
  - the coverage tooling (`cargo llvm-cov nextest`, `scripts/check-diff-coverage.mjs`, `codecov.yml`) so backend lcov covers the new crate — typically add `--workspace`;
  - `nix/package.nix` Cargo build inputs / manifest paths;
  - benchmark manifests under `benchmarks/` / `src-tauri/benches/` (both `[lib]` and `[[bin]]` still need `bench = false`; a new crate needs the same treatment);
  - the `--manifest-path src-tauri/Cargo.toml` references and command examples in `CLAUDE.md`, `src-tauri/CLAUDE.md`, and any runbooks, adding core-crate paths where needed.
- **Verification:** the entire existing backend suite passes unchanged (`cargo test --manifest-path src-tauri/Cargo.toml` for the app crate, plus `cargo test --workspace` from the root for both crates); `cmd.exe /c bun run build`, `cmd.exe /c bun run test:e2e`, and the coverage gate (`cmd.exe /c bun run coverage:check`) still green.
- **Exit criteria:** `mini-diarium-core` compiles with zero `tauri::` references; the app behaves identically; the full suite, E2E, and coverage gate pass; no stale single-crate assumptions remain in CI/nix/docs.
- **Note:** this is the single most valuable step and improves the codebase on its own merits regardless of the premium track.
- **Checklist:**
  - _Code move_
    - [x] Repo-root virtual workspace manifest (`Cargo.toml`, `members = ["src-tauri", "crates/*"]`)
    - [x] Tauri-free modules moved to `crates/mini-diarium-core/` (`crypto/`, `auth/`, `db/`, `import/`, `export/`, `plugin/`, `backup.rs`, `config.rs`, shared types)
    - [x] `mini-diarium-core/Cargo.toml` carries no `tauri` dependency
    - [x] App stays at `src-tauri/`, depends on the new crate by path; `commands/*` and OS shell unchanged (via a `pub use mini_diarium_core::{…}` re-export shim in `lib.rs`)
  - _Tooling migration_
    - [x] CI workflows (`.github/workflows/`) updated for the workspace (test/build/coverage/benchmarks); Dependabot cargo dir → repo root; release/flathub lockfile + `target/` paths
    - [x] Coverage tooling covers the new crate (`cargo llvm-cov nextest --workspace`; `scripts/check-diff-coverage.mjs` classifier; `codecov.yml` backend paths)
    - [x] `nix/package.nix` manifest paths / Cargo build inputs updated (`cargoRoot = "."`, `cargoLock = ../Cargo.lock`)
    - [x] Benchmark manifests updated (new crate gets `bench = false` on `[lib]`; benches stay in the app crate and resolve via the re-export shim)
    - [x] `--manifest-path src-tauri/Cargo.toml` references updated in `CLAUDE.md`, `src-tauri/CLAUDE.md`, best-practices, runbooks, `PHILOSOPHY.md`, security-stance, `bump-version.sh`/`.ps1`, `RELEASING.md`
  - _Acceptance_
    - [x] `mini-diarium-core` compiles with zero `tauri::` references
    - [x] Backend (both crates) + frontend suites green, app behaves identically; E2E/coverage gate unaffected (frontend untouched; release binary builds to `target/release/` with LTO preserved)
    - [x] No stale single-crate assumptions in active docs — _gap-filled 2026-07-22:_ the M1 commit left `README.md` and `.claude/agents/test-failure-analyst.md` pointing at the pre-workspace `src-tauri/target/` location; both corrected to the workspace-root `target/`, and `scripts/check-stale-build-paths.js` (`bun run check:build-paths`, wired into `quick-check` and `pre-commit`) now guards the regression.

### M2 — Stable façade API (Section 9, step 2)

- **Goal:** give consumers one deliberate public surface instead of reaching into internal module paths.
- **Deliverables:** a public API on `mini-diarium-core` covering open/unlock, entry CRUD, search, import/export, and auth-slot management; `commands/*` refactored to call only that façade; everything else marked internal (`pub(crate)` / private). A short `crates/mini-diarium-core/API.md` documenting that surface, its pre-1.0/internal status, and the compatibility, error, secret-handling, handle/transaction, and serde rules that go with it.
- **Boundary guard:** for now the boundary is enforced by module visibility (`pub` only on the façade, `pub(crate)`/private everywhere else) plus code review — sufficient while the app is the only consumer. An automated public-API regression guard (a `cargo-public-api` snapshot test in CI that fails when the surface drifts) is noted as a **deferred follow-up**, worth adding once `minidiarium-plus` actually exists and the contract needs teeth; building it now would be CI-maintenance cost with no external consumer to protect.
- **Verification:** app still compiles and passes the full suite against the façade only; a grep confirms `commands/*` no longer reference `db::queries::*` internals directly.
- **Exit criteria:** the Tauri app and a hypothetical second consumer would call the same surface; internals are sealed; `API.md` present.
- **Checklist:**
  - [x] Public façade covers open/unlock, entry CRUD, search, import/export, auth-slot management
  - [x] `commands/*` refactored to call only the façade (no direct `db::queries::*` access) — _gap-filled 2026-07-22:_ the M2 commit left `peek_auth_slot_types` opening its own `rusqlite::Connection` with bespoke SQL. Moved to `db::peek_auth_slot_types(path)` behind the façade; the command is now a thin wrapper and the app crate's `rusqlite` dependency is gone. `rg "rusqlite|db::queries::|db::schema::|\.conn\(\)|\.key\(\)" src-tauri/src` returns nothing.
  - [x] Internals sealed (`pub(crate)` / private everywhere outside the façade)
  - [x] `crates/mini-diarium-core/API.md` written as the contract — _extended 2026-07-22_ with the pre-1.0/internal status, MSRV/edition, error policy (including the two `mapTauriError`-coupled phrases), secret-handling, handle/transaction semantics, frozen serde fields, and the change rule.
  - [x] Full suite passes against the façade only
  - [x] `cargo-public-api` regression guard noted as a deferred follow-up (not built now)

### M3 — Kernel / handle separation (Section 8 gradient)

- **Goal:** make the crypto-and-format kernel usable without a live `rusqlite` handle, so a browser tier can later reuse it without dragging in the desktop SQLite binding. This is the open-core-side enabler that keeps the WASM door open; the WASM SQLite substitute itself is + work and stays out of scope.
- **Deliverables:** the façade (M2) shaped so `crypto/` and the X25519/HKDF slot-unwrapping in `auth/`, plus the encrypted-row read/write format, are callable independently of the `rusqlite` connection type; the desktop path continues to supply the `rusqlite`-backed storage as one implementation behind that boundary.
- **Verification:** the kernel portion compiles as a unit without the `rusqlite` feature/dependency in scope; existing tests still pass through the desktop path.
- **Exit criteria:** the storage binding is an injectable boundary, not a hard dependency of the crypto/format kernel.
- **Tracked as:** TODO-0082 (portable crypto/auth kernel) and TODO-0083 (encrypted-format boundary plus `rusqlite` adapter). These remain open-core work only; no browser SQLite implementation or + product code belongs in either item.
- **Checklist:**
  - [ ] `crypto/`, the X25519/HKDF slot-unwrapping, and the encrypted-row format callable independently of the `rusqlite` connection type
  - [ ] Desktop path supplies `rusqlite`-backed storage as one implementation behind the boundary
  - [ ] Kernel compiles without `rusqlite` in scope; existing tests still pass via the desktop path

### M4 — Distribution and governance groundwork (Section 9, steps 3 and 5)

- **Goal:** settle the open-questions that gate publishing and contribution, without blocking M1–M3.
- **Deliverables:** a decision on core-crate distribution (crates.io versus git dependency/submodule); trademark registration or defense for the name; a `CONTRIBUTING.md` note stating premium features live in a separate product and repo; a CLA only if future relicensing of the core is intended.
- **Verification:** decisions recorded (ideally as a short ADR under `docs/decisions/`); `CONTRIBUTING.md` present.
- **Exit criteria:** distribution stance chosen; brand and contribution posture documented.
- **Tracked as:** TODO-0084 (distribution ADR), TODO-0085 (contribution/relicensing posture), and TODO-0086 (trademark/name protection posture). The relevant maintainer decisions remain explicit acceptance gates; none is inferred merely by adding the TODOs.
- **Checklist:**
  - [ ] Distribution decided (crates.io vs git dependency/submodule)
  - [ ] Trademark registered or defended for the name
  - [ ] `CONTRIBUTING.md` note: premium features live in a separate product and repo
  - [ ] CLA added _only if_ future relicensing of the core is intended
  - [ ] Decisions recorded as a short ADR under `docs/decisions/`

### Definition of done for the open core

The open-core packaging is complete when: `mini-diarium-core` is a Tauri-free crate with a stable, documented façade; the desktop app consumes it with unchanged behavior and an unchanged test suite; the crypto/format kernel is usable independently of the desktop SQLite handle; and the distribution and governance stance is decided and written down. At that point Tier 3 is a proper open core, and any + surface (starting with Tier 2) can be built against it as a versioned dependency.

**Explicitly deferred (not part of open-core completion):** Section 9 step 4 (the frontend boundary) is a + decision that depends on which surface is chosen, and the WASM SQLite substitute plus the Tier 1 backend are + engineering. None of them belong in this roadmap; M3 only ensures the core does not foreclose them.

## 11. What must not change

- **No network in the open core.** The premium track never justifies adding a network dependency to `mini-diarium-core` or the `mini-diarium` app. Network-bearing code lives only in +.
- **No feature gating in the core.** The open core stays fully functional standalone. Premium value is additive in +, never subtractive from the core.
- **The non-negotiables stay intact for Mini Diarium.** They are scoped to the open-core product by brand separation, not diluted.

## 12. Risks and open questions

- **Brand-confusion risk.** Sharing the base name means some users will assume + inherits the local-only guarantee. Mitigation is explicit messaging, not architecture.
- **Maintenance surface.** A second product and repo is real ongoing cost (`PHILOSOPHY.md` Focused Scope and Simple is Good). The workspace split is cheap; the + product is not.
- **Which tier ships first?** Tier 2 (web, bring your own `.db`) is the shared client-side foundation both service tiers need and requires no backend, so it is the natural first build; it also forces the one hard technical question (browser SQLite, Section 8) early. Tier 1 adds the backend on top.
- **Tier 1 recovery model.** Which backup factors to enroll at signup (device passkey, recovery code, second device) to keep realistic users from lockout without any server-side reset, and whether to adopt a client-generated account key to harden against weak user passwords.
- **Served-code trust mitigations.** How far to go on reproducible and signed web builds, subresource integrity, a published client source, and third-party audits, to narrow the one residual gap versus the desktop guarantee.
- **Distribution stance for the core crate:** public crates.io versus private dependency.
- **Does + reuse the SolidJS frontend or start its own?** A browser tier needs a substantially different frontend and the WASM crypto+storage layer behind the `invoke()` seam; decide once a tier is chosen.
