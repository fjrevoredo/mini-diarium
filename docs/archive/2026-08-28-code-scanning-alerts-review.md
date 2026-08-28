# Code Scanning Alerts Review — 2026-08-28

**Date:** 2026-08-28
**Scope:** All open GitHub code scanning alerts on `fjrevoredo/mini-diarium` (CodeQL, default setup) plus the open Dependabot advisories (same review session).
**Validation performed:** full alert inventory via `gh api` (432 total alerts, 215 open), line-level inspection of every rule category in the local checkout; Dependabot inventory via `gh api` (47 total, 9 open), lockfile chain tracing, npm registry version checks, and post-fix verification (`diagrams:check`, `diagrams`, `bun install`, `npm install --package-lock-only`).

## Summary

All **215 open alerts are false positives**. No alert points at a real vulnerability in shipped code. The alerts were largely re-emitted by a CodeQL re-scan on 2026-08-27 (alert batch 310+); the rest accumulated since 2026-07-28. They were bulk-dismissed with reason `false positive` on 2026-08-28.

## Inventory

| Rule | Open | State after review |
|------|------|--------------------|
| `rust/hard-coded-cryptographic-value` | 209 | Dismissed — test-only dummy passwords |
| `rust/cleartext-logging` | 3 | Dismissed — `assert!` messages in leak-detection tests |
| `js/shell-command-injection-from-environment` | 1 | Dismissed — dev-only script, no shell used |
| `js/incomplete-multi-character-sanitization` | 2 | Dismissed — test-only editor mocks |

History: 432 total (215 open, 35 fixed, 182 previously dismissed).

## Per-rule findings

### `rust/hard-coded-cryptographic-value` (209)

Every alert is inside a `#[test]` / `#[cfg(test)]` block. CodeQL does not honour `cfg(test)` gating and flags fixture strings passed to password-parameterised helpers (`create_database(path, "test")`, `hash_password("my_secure_password_123", …)`, `add_password_slot(…, "second-pass")`, …). Locations span all three crates (`mini-diarium-crypto/src/crypto/password.rs`, `auth/password.rs`, `mini-diarium-core/src/db/*`, `auth/*`, `backup/*`, `search/*`, `src-tauri/src/commands/*`). No production key, salt, or IV is hard-coded — the real crypto constants are random (`generate_salt()`, `generate_keypair()`).

### `rust/cleartext-logging` (3)

- `crates/mini-diarium-core/src/backup/manifest.rs:420`
- `crates/mini-diarium-core/src/backup/restore_entries.rs:497`
- `src-tauri/src/commands/backup.rs:452`

All three are the failure messages of the project's own **leak-detection self-tests** — tests that assert user-chosen secrets never appear in `manifest.json`, backups, or pre-auth IPC payloads. The "cleartext" is the interpolation of the test secret into the `assert!` panic message so a regression is diagnosable. This is a deliberate security feature, not a leak.

### `js/shell-command-injection-from-environment` (1)

`scripts/render-diagrams.mjs:61` — `spawnSync` receives an argv element derived from `process.env.MMDC_PUPPETEER_CONFIG`. The call uses no shell (`shell: true` is explicitly avoided per the in-file comment), so the value cannot be shell-interpreted. The script is a dev-only diagram generator, never shipped.

### `js/incomplete-multi-character-sanitization` (2)

- `src/components/layout/EditorPanel.integration.test.tsx:122`
- `src/components/layout/editor-panel/useEntryPersistence.test.ts:40`

Both are Vitest **mock editors** whose `getText()` strips HTML tags (`replace(/<[^>]*>/g, '')`). Test fixtures only; no user data passes through them.

## Action taken

- 215 alerts dismissed via `gh api` PATCH with `state=dismissed`, `dismissed_reason=false positive`, comment referencing this record.
- No code changes required. If future scans re-flag the same locations, consider a `codeql.yml` config or `// codeql-disable` comments at the test fixtures to reduce noise.

---

# Dependabot Alerts Review — 2026-08-28 (same session)

**Scope:** All open Dependabot alerts on `fjrevoredo/mini-diarium` (47 total: 9 open, 30 fixed, 3 dismissed, 5 auto-dismissed).

## Summary

All 9 open advisories are **development-scope only** (`package-lock.json` / `bun.lock`, nothing shipped — no runtime dependency of the app or website is affected). 8 of 9 had released fixes and were resolved by dependency bumps; 1 (`extract-zip`) has **no upstream fix published** and stays open.

## Open alerts

| # | Severity | Package | Installed | First patched | Chain |
|---|----------|---------|-----------|---------------|-------|
| 42 | high | `ip-address` | 10.2.0 | 10.3.1 | `@puppeteer/browsers` → `proxy-agent` → `socks` → `ip-address` (WDIO/E2E browser downloads) |
| 33 | medium | `ip-address` | 10.2.0 | 10.2.2 | same |
| 32 | medium | `ip-address` | 10.2.0 | 10.2.1 | same |
| 51 | high | `extract-zip` | 2.0.1 | **none** | `@puppeteer/browsers` → `extract-zip` (symlink traversal while unzipping browser binaries; GHSA-jmr9-qjv8-65gv) |
| 47 | medium | `mermaid` | 11.15.0 | 11.16.1 | direct devDependency, pinned via npm `overrides` (diagram rendering) |
| 46 | low | `mermaid` | 11.15.0 | 11.16.1 | same |
| 45 | medium | `mermaid` | 11.15.0 | 11.16.1 | same |
| 44 | medium | `mermaid` | 11.15.0 | 11.16.1 | same |
| 43 | medium | `mermaid` | 11.15.0 | 11.16.1 | same |

Context: `mermaid` is a dev-only dependency of the diagram toolchain (`bun run diagrams` / `diagrams:check`); `ip-address` and `extract-zip` are transitive dev-only deps of `@puppeteer/browsers`, used only to download browser binaries for E2E runs. None of the three packages appear in `dependencies` or reach the shipped app, website, or installers.

## Remediation applied

1. `package.json` `overrides` changed:
   - `"mermaid": "11.15.0"` → `"mermaid": "11.16.1"` (clears alerts 43–47)
   - added `"ip-address": "^10.5.0"` (clears alerts 32, 33, 42)
2. Lockfiles resynced per `sync-lockfiles` skill: `bun install` (bun.lock) + `npm install --package-lock-only --legacy-peer-deps` (package-lock.json). Verified both resolve `mermaid@11.16.1` and `ip-address@10.5.0`.
3. Diagram toolchain verified with the new mermaid: `bun run diagrams` re-rendered all 6 mermaid SVGs successfully (renderer output diffs expected), `diagrams:check` passes. D2 SVGs unchanged.
4. `nix/package.nix` `npmDepsHash` was **not** refreshed — nix is unavailable on this machine; a nix build will surface the new hash (or it can be computed with `nix run nixpkgs#prefetch-npm-deps -- package-lock.json`).

## Remaining: `extract-zip` (high, #51)

**Advisory (CVE-2026-56876, GHSA-jmr9-qjv8-65gv):** unvalidated symlink path traversal (CWE-22) when extracting a malicious zip — an archive containing a symlink like `../../../../etc/passwd` can make extract-zip read or write arbitrary files. CVSS 3.1 = **8.1**, CVSS 4.0 = **8.6**. Both vectors require **user interaction** (the victim must process an attacker-supplied archive). EPSS ≈ **0.004%** — no meaningful active exploitation.

**Upstream status — effectively unmaintained, fix will never come:** npm last published 2023-03-04 (2.0.1 is the final release), GitHub repo (`maxogden/extract-zip`) last pushed 2022-02-06, 60 open issues. There is no maintainer releasing fixes; `first_patched_version` is empty and will likely stay empty.

**Exposure assessment (why it is not critical for this project):**
1. **Dev-only, never shipped** — absent from the app, website, and installers.
2. **Single reachable path:** `@puppeteer/browsers@2.13.2` (via WebdriverIO) extracts browser binaries during `bun run test:e2e*`. The archives come from official Chrome/Firefox/Edge CDNs over HTTPS with pinned URLs — an attacker would need to compromise those CDNs or MITM the developer's traffic to deliver a malicious zip.
3. **Half the consumers are already unaffected:** `puppeteer@25.3.0` (diagram rendering) uses `@puppeteer/browsers@3.0.6`, which dropped `extract-zip` in favour of `modern-tar`. Only the WDIO chain (`@wdio/utils` → `@puppeteer/browsers@2.13.2`) still pulls it.
4. Runs only on a developer machine during manual E2E runs; browsers are cached after the first download (`puppeteer.skipDownload: true`).

**Realistic mitigation paths (in order of preference):**
1. **Track WebdriverIO adoption of `@puppeteer/browsers` 3.x** — this is the only true fix, and it is upstream: today `@wdio/utils` pins `@puppeteer/browsers: ^2.2.0`, which cannot resolve to 3.x. When WDIO raises the requirement, the vulnerability disappears from the dependency tree without any `extract-zip` release.
2. **Override to a maintained fork** if a trustworthy patched fork appears; not recommended while option 1 is pending.
3. **Dismiss as `won't fix`** — justified given the zero realistic exposure above; the dismissal comment should cite this record.

**Decision taken:** keep the alert **open** as the tracking mechanism; do not dismiss and do not depend on `extract-zip` upstream. Revisit when WDIO bumps `@puppeteer/browsers`, or when Dependabot reports `first_patched_version` for extract-zip (unlikely). A `won't fix` dismissal remains defensible at any later point if the alert noise outweighs its tracker value.

**Status:** 8 of 9 open alerts become `fixed` automatically once the changes land on the default branch; #51 remains open pending WebdriverIO's `@puppeteer/browsers` upgrade (upstream fix for extract-zip itself will never come — the package is unmaintained). Dependabot security updates (PRs) were intentionally not auto-applied for this session.