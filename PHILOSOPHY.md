# PHILOSOPHY.md

_Last updated: 2026-02-23, applies to v0.4.0+_

This document defines the guiding principles for Mini Diarium. Every feature decision, architectural choice, and contribution must align with these values. When in doubt, refer back here.

---

## Part I: Philosophy

### 1. Small and Extensible Core

Mini Diarium is built around a minimal, hardened core focused on **safety and performance**. The core handles encryption, data storage, and authentication. Nothing more.

**What this means:**
- Core features must be essential to the primary use case: writing and protecting diary entries
- Experimental features, integrations, and UI enhancements belong in extensions
- Extensions can fail, be removed, or become unmaintained without compromising the core
- The attack surface remains small and auditable

**When considering a new feature, ask:**
- Does this belong in the core, or could it be an extension?
- Would removing this feature break the fundamental purpose of the app?
- Does this increase the security surface we must defend?

---

### 2. Boring Security

We use **battle-tested, industry-standard security practices**. No custom cryptography, no experimental protocols, no clever inventions.

**What this means:**
- AES-256-GCM for symmetric encryption
- Argon2id for password derivation (OWASP-compliant parameters)
- X25519 ECDH for key-file authentication
- Established, audited libraries only
- Memory zeroization on all exit paths (both success and error branches)
- No network access, no remote sync, no cloud features

**Security decisions prioritize:**
1. Known-good solutions over novel approaches
2. Conservative parameters over aggressive optimization
3. Simplicity over flexibility when they conflict

---

### 3. Testing Pyramid

Testing follows the classic pyramid: many unit tests, some integration tests, a couple of end-to-end tests.

**Rationale:**
- Unit tests are fast, isolated, and catch regressions early
- Integration tests verify component boundaries (crypto vs. storage, UI vs. backend)
- E2E tests confirm critical user flows work end-to-end

**Guidelines:**
- Every encryption/decryption function must have unit tests
- Every Tauri command should have an integration test
- Core user flows (unlock, write, lock, unlock again) need E2E coverage
- Tests must not require network access or external services

---

### 4. Easy In, Easy Out

Users should feel safe adopting Mini Diarium, knowing they can leave whenever they want with their data intact.

**Import:**
- Support common journal formats from other tools
- Handle merge conflicts gracefully when importing
- Make onboarding frictionless: no account creation, no server setup

**Export:**
- Support portable, human-readable formats
- Provide an extension point for custom exporters
- Allow users to script their own export pipelines
- Never lock features behind proprietary formats

**No lock-in:**
- Data stays in a documented, open schema
- Encryption uses standard algorithms with no proprietary wrapping
- If Mini Diarium becomes unmaintained, users can decrypt and migrate with standard tools
- Users should stay because they want to, not because they're trapped

---

### 5. Focused Scope

Mini Diarium serves one purpose exceptionally well: **private, encrypted journaling**. We don't try to accommodate every possible use case.

**What we do:**
- Encrypted diary entries with rich-text support and statistics
- Calendar-based navigation
- Multiple authentication methods (password, key files)
- Import/export and local extensibility
- Cross-platform desktop support

**What we don't do:**
- Social features (sharing, comments, collaboration)
- Cloud sync (by design; offline only, but you can put the `.db` in any cloud-synced folder)
- Task management, habit tracking, goal setting
- Media galleries beyond basic embedded images
- Plugin marketplaces or distribution platforms

**When evaluating feature requests:**
- Does this serve the core journaling use case?
- Would this expand the threat model?
- Could this be an extension instead?
- Are we the right tool for this, or should the user find a specialized app?

**"Your tool doesn't do X, I'll use Y instead."**
→ Then go use Y. We'd rather excel at journaling than be mediocre at everything.

---

### 6. Simple is Good

Simplicity is a feature, not a limitation. Every line of code is a maintenance burden and a potential attack vector.

**Prefer:**
- Direct solutions over abstraction layers
- Explicit code over clever shortcuts
- Fewer dependencies over feature-rich frameworks
- Clear naming over terse abbreviations
- Flat structures over deep hierarchies

**Avoid:**
- Magic configuration files with dozens of options
- Deep inheritance trees or trait-heavy designs
- Microservices when a single binary works
- Premature optimization

**When complexity is justified:**
- Security: some protections (e.g. memory zeroization) require careful, non-obvious handling
- Cross-platform support: OS differences sometimes require platform-specific code paths
- Cryptographic correctness: using established libraries is simpler than any alternative
- Core extensibility: the mechanism that enables extensions adds overhead, but it is the deliberate implementation of Principle 1

---

## Decision Framework

When proposing or reviewing changes, validate against all six principles:

1. **Core vs. Extension?** Does this belong in the core, or is it better as an extension?
2. **Security Impact?** Does this introduce new cryptographic assumptions or expand the attack surface?
3. **Test Coverage?** Can we write fast, deterministic tests for this?
4. **Data Portability?** Does this affect import/export or create lock-in?
5. **Scope Creep?** Does this align with focused journaling, or are we building a different app?
6. **Simplicity Cost?** Does this add complexity that outweighs the benefit?

If any principle is violated without strong justification, the proposal should be reconsidered.

---

## Non-Negotiables

Some principles are absolute:

- **No network access.** Mini Diarium will never connect to the internet.
- **No custom cryptography.** Use standard algorithms and established libraries only.
- **No password recovery.** Password recovery requires either storing the master key in recoverable form (weakening the encryption guarantee) or trusting a third-party service (violating the no-network principle). Neither is acceptable. If you lose all credentials, your data is inaccessible; this is the correct security outcome. To mitigate accidental lockout, register a second authentication method as a backup.
- **No vendor lock-in.** Users must be able to export and migrate their data freely at any time.
- **Honest threat documentation.** Security claims must be accurate and scoped. Document what IS protected (data at rest, no network leakage) and what is NOT (a compromised OS, physical access while unlocked, coercion). Never overstate the security model.

---

## Closing Thoughts

Mini Diarium is intentionally small. It does one thing well: keeping your journal private, secure, and portable. If a feature doesn't serve that goal, it doesn't belong here.

---
---

## Part II: Implementation Guide

This section explains how each principle from Part I translates into concrete decisions in the codebase. It is the "how" to Part I's "what and why". Keep this section updated as the architecture evolves.

---

### Principle 1: Extensions in Practice

"Extension" and "plugin" are used interchangeably in this codebase. The implementation lives in `src-tauri/src/plugin/`.

Extensions are defined as Rust traits:

```rust
// src-tauri/src/plugin/mod.rs
pub trait ImportPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn parse(&self, content: &str) -> Result<Vec<DiaryEntry>, String>;
}
pub trait ExportPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn export(&self, entries: Vec<DiaryEntry>) -> Result<String, String>;
}
```

Any extension that fails returns `Err(String)`; it cannot panic the core. Built-in formats (Mini Diary, Day One JSON/TXT, jrnl, JSON export, Markdown export) all implement the same traits as user-provided extensions, so there is no privileged "built-in" path.

User Rhai scripts placed in `<diary_dir>/plugins/` are auto-discovered at startup by `src-tauri/src/plugin/rhai_loader.rs` and registered alongside built-in plugins. This is the concrete mechanism behind "allow users to script their own export pipelines" (Principle 4).

Both `ImportOverlay.tsx` and `ExportOverlay.tsx` are wired to the plugin registry via `listImportPlugins`/`runImportPlugin` and `listExportPlugins`/`runExportPlugin`. Adding a new built-in or user-provided format requires no UI changes.

---

### Principle 2: Security Implementation

**Algorithms and libraries** (`src-tauri/Cargo.toml`):
- Symmetric encryption: `aes-gcm = "0.10"` (AES-256-GCM with per-entry random nonces, `src-tauri/src/crypto/cipher.rs`)
- Password KDF: `argon2` (Argon2id with m=65536 KiB / 64 MB, t=3, p=4, `src-tauri/src/crypto/password.rs:7-10`; these parameters exceed OWASP minimums)
- Key-file auth: `x25519-dalek = "2"` + `hkdf = "0.12"` (X25519 ECIES, `src-tauri/src/auth/keypair.rs`)
- Zeroization: `zeroize` crate with `ZeroizeOnDrop` derive macro

**Zeroization layers** (defense-in-depth, not a single mechanism):
1. `SecretBytes` newtype in `src-tauri/src/auth/mod.rs`: `#[derive(ZeroizeOnDrop)]` ensures automatic cleanup on drop regardless of whether the caller remembers to zeroize
2. Explicit `.zeroize()` calls on password strings in `crypto/password.rs` on both the success path (line 60) and the error path (line 103)
3. `SecretBytes` implements `Debug` as `SecretBytes([REDACTED; N])`, preventing key material from leaking into logs

**No-network enforcement**: verified at the dependency level. `src-tauri/Cargo.toml` contains no `reqwest`, `hyper`, `socket2`, `ureq`, or equivalent crate. The constraint cannot be accidentally violated without a visible `Cargo.toml` change.

---

### Principle 3: Test Infrastructure

**Current coverage** (as of v0.4.0):

| Layer | Count | How to run |
|---|---|---|
| Backend unit + integration | 193 tests across 20 modules | `cd src-tauri && cargo test` |
| Frontend unit | 31 tests across 6 files | `bun run test:run` |
| E2E | 2 tests | `bun run test:e2e:local` |

**E2E stack**: WebdriverIO v9 + tauri-driver (official Tauri bridge) against the real compiled binary. Config: `wdio.conf.ts` (root). Specs: `e2e/specs/`. Test isolation: each run creates a fresh OS temp directory passed to the app via `MINI_DIARIUM_DATA_DIR`; `lib.rs` uses this as the diary path when set, with no effect on production builds. Run the full suite (build + run): `bun run test:e2e:local`. Run suite only (binary already built): `bun run test:e2e`.

**Known gap**: Frontend coverage is shallow. Auth screens, Calendar, all overlays, DiaryEditor, and Sidebar have no tests. Tracked in `docs/TODO.md`.

---

### Principle 4: Data Portability in Practice

**Import formats** (each in its own `src-tauri/src/import/` module):
- Mini Diary JSON (`minidiary.rs`), 8 tests
- Day One JSON (`dayone.rs`), 14 tests
- Day One TXT (`dayone_txt.rs`), 16 tests
- jrnl JSON (`jrnl.rs`), 12 tests
- Merge conflict resolution (`merge.rs`), 13 tests

**Export formats** (each in `src-tauri/src/export/`):
- JSON: Mini Diary-compatible structure, 6 tests
- Markdown: HTML-to-Markdown conversion, 12 tests

**Adding a new format** follows the Import Parser Pattern in `CLAUDE.md`: one `*.rs` parser module, one command in `commands/import.rs`, register in `lib.rs`, add wrapper in `src/lib/tauri.ts`. The UI (`ImportOverlay.tsx`) picks it up automatically via `listImportPlugins`; no UI change needed.

**Schema**: documented inline in `src-tauri/src/db/schema.rs` with full migration history. Current version: v4. AES-256-GCM with standard key derivation; decryptable with any standard crypto toolkit given the password.

---

### Principle 5: Scope Enforcement

The 20 components across `src/components/` cover: auth (2), calendar (1), editor (4), layout (5), overlays (5 + ExportOverlay), search (2). Nothing outside journaling scope exists. All features added from v0.1.0 through v0.4.0 pass the six Decision Framework questions.

The "no plugin marketplaces" rule means no distribution, discovery, or hosting of plugins. Local Rhai scripts in `<diary_dir>/plugins/` are supported because they are user-controlled, offline, and scope-neutral.

---

### Principle 6: Simplicity in Practice

- **State**: 5 signal modules (`src/state/`), averaging 3 signals each. No Redux, Zustand, derived-state middleware, or selector layers.
- **Database**: direct `rusqlite` queries in `src-tauri/src/db/queries.rs`. No ORM, no query builder, no migration framework beyond the inline schema version check.
- **Dependencies**: 17 direct runtime crates in `src-tauri/Cargo.toml` for a cryptographic desktop app (intentionally lean).
- **Justified complexity examples**: `src-tauri/src/screen_lock.rs` uses platform-specific Win32 event hooks (Windows) and equivalent macOS hooks for session-lock detection; this is necessary for auto-lock, not gold-plating. The Rhai scripting engine (`src-tauri/src/plugin/rhai_loader.rs`) adds binary size but is the only way to deliver user-scriptable extensions without requiring a recompile.
