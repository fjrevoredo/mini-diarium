# PHILOSOPHY.md

This document defines the guiding principles for Mini Diarium. Every feature decision, architectural choice, and contribution must align with these values. When in doubt, refer back here.

## Core Principles

### 1. Small and Extensible Core

Mini Diarium is built around a minimal, hardened core focused on **safety and performance**. The core handles encryption, data storage, and authentication—nothing more.

**What this means:**
- Core features must be essential to the primary use case: writing and protecting diary entries
- Experimental features, integrations, and UI enhancements belong in extensions
- Extensions can fail, be removed, or become unmaintained without compromising the core
- The attack surface remains small and auditable

**When considering a new feature, ask:**
- Does this belong in the core, or could it be an extension?
- Would removing this feature break the fundamental purpose of the app?
- Does this increase the security surface we must defend?

### 2. Boring Security

We use **battle-tested, industry-standard security practices**. No custom cryptography, no experimental protocols, no clever inventions.

**What this means:**
- AES-256-GCM for encryption (not a custom cipher)
- Argon2id for password derivation (OWASP-compliant parameters)
- X25519 ECDH for key files (widely deployed, well-analyzed)
- Established libraries: `x25519-dalek`, `aes-gcm`, `argon2`, `zeroize`
- Memory zeroization on all exit paths
- No network access, no remote sync, no cloud features

**Security decisions prioritize:**
1. Known-good solutions over novel approaches
2. Conservative parameters over aggressive optimization
3. Simplicity over flexibility when they conflict

### 3. Testing Pyramid

Testing follows the classic pyramid: many unit tests, some integration tests, a couple end-to-end tests.

**Rationale:**
- Unit tests are fast, isolated, and catch regressions early
- Integration tests verify component boundaries (crypto ↔ storage, UI ↔ backend)
- E2E tests confirm critical user flows work end-to-end (create diary, unlock, write entry, lock)

**Guidelines:**
- Every encryption/decryption function must have unit tests
- Every Tauri command should have an integration test
- Core user flows (unlock → write → lock → unlock again) need E2E coverage
- Tests must not require network access or external services

### 4. Easy In, Easy Out

Users should feel safe adopting Mini Diarium, knowing they can leave whenever they want with their data intact.

**Import:**
- Support common journal formats: Mini Diary JSON, Day One JSON/TXT, jrnl JSON
- Provide clear migration paths from other tools
- Handle merge conflicts gracefully when importing
- Make onboarding frictionless—no account creation, no server setup. Set your password and you are good to go.

**Export:**
- Support portable formats: JSON (structured), Markdown (human-readable)
- Provide an extension point for custom exporters
- Allow users to script their own export pipelines
- Never lock features behind proprietary formats

**No lock-in:**
- Data stays in a documented SQLite schema
- Encryption is standard (AES-256-GCM, Argon2id, X25519)
- If Mini Diarium becomes unmaintained, users can decrypt and migrate with standard tools
- Users should stay because they want to, not because they're trapped

### 5. Focused Scope

Mini Diarium serves one purpose exceptionally well: **private, encrypted journaling**. We don't try to accommodate every possible use case.

**What we do:**
- Encrypted diary entries with rich-support and statistics
- Calendar-based navigation
- Multiple authentication methods (password, key files)
- Import/export
- Cross-platform desktop support

**What we don't do:**
- Social features (sharing, comments, collaboration)
- Cloud sync (by design—offline only, but you can put the .db in any cloud service you like)
- Task management, habit tracking, goal setting
- Media galleries beyond basic embedded images
- Plugin marketplaces or app stores

**When evaluating feature requests:**
- Does this serve the core journaling use case?
- Would this expand the threat model?
- Could this be an extension instead?
- Are we the right tool for this, or should the user find a specialized app?

**"Your tool doesn't do X, I'll use Y instead."**  
→ Then go use Y. We'd rather excel at journaling than be mediocre at everything.

### 6. Simple is Good

Simplicity is a feature, not a limitation. Every line of code is a maintenance burden and a potential attack vector.

**Prefer:**
- Direct solutions over abstraction layers
- Explicit code over clever shortcuts
- Fewer dependencies over feature-rich frameworks
- Clear naming over terse abbreviations
- Flat structures over deep hierarchies

**Simplicity in practice:**
- No magic configuration files with 50 options
- No deep inheritance trees or trait-heavy designs
- No microservices when a single binary works
- No premature optimization

**When complexity is justified:**
- Security (e.g., memory zeroization requires careful handling)
- Cross-platform support (Tauri abstracts OS differences)
- Cryptographic correctness (using established libraries is simpler than rolling our own)

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
- **No custom cryptography.** Use standard algorithms and libraries.
- **No password recovery.** If you lose your credentials, your data is gone. This is intentional.
- **No vendor lock-in.** Users must be able to export and migrate freely.

---

## Closing Thoughts

Mini Diarium is intentionally small. It does one thing well: keeping your journal private, secure, and portable. If a feature doesn't serve that goal, it doesn't belong here.

