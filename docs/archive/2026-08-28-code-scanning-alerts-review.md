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

No fixed version is released (2.0.1 is latest on npm; advisory GHSA-jmr9-qjv8-65gv has no patched range). Options when it ships: bump `@puppeteer/browsers` when it raises its `extract-zip` requirement, or add an `overrides` entry. Risk is low in practice: the zips extract-zip handles come from trusted browser CDNs, and the package is dev-only. Not dismissed, pending the upstream fix.

**Status:** 8 of 9 open alerts become `fixed` automatically once the changes land on the default branch; #51 remains open awaiting upstream. Dependabot security updates (PRs) were intentionally not auto-applied for this session.