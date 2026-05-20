# Network Isolation Implementation Self-Check (2026-05-19)

## Scope

This audit checks whether the implementation matches `docs/network-isolation-plan.md` and whether the completed status is technically accurate.

Checked artifacts include:

- Plan and docs: `docs/network-isolation-plan.md`, `CHANGELOG.md`, `SECURITY.md`, `PHILOSOPHY.md`, `src-tauri/CLAUDE.md`
- Runtime code/config: `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/nsis/installer.nsh`
- Tests/CI scripts: `src/lib/network-isolation-script.ts`, `src/lib/network-isolation.test.ts`, `e2e/specs/network-isolation.spec.ts`, `scripts/check-no-network.ps1`, `.github/workflows/ci.yml`

## Executive Result

Overall status: **PARTIALLY COMPLETE / NOT ACCURATE AS MARKED**

- A large part of the hardening is present and compiles.
- At least one core control is implemented incorrectly (Windows `WebResourceRequested` handler does not block requests).
- The plan is marked `COMPLETED` while key verification work is explicitly skipped/pending.
- Some documentation claims exceed what the code currently enforces.

## Findings (Ordered by Severity)

### 1. CRITICAL: Windows WebResourceRequested handler does not actually block external requests

Evidence:

- [src-tauri/src/lib.rs](D:/Repos/mini-diarium/src-tauri/src/lib.rs:368) comment says it blocks HTTP(S) external requests.
- Handler only logs external requests at [src-tauri/src/lib.rs](D:/Repos/mini-diarium/src-tauri/src/lib.rs:424).
- There is no response override (`put_Response`) in the callback, so the request is not intercepted to completion.
- Internal docs claim `SetHandled(true)` behavior at [src-tauri/CLAUDE.md](D:/Repos/mini-diarium/src-tauri/CLAUDE.md:134), but that call is not present in the current code.

Impact:

- The Windows engine-level blocking claim is currently not substantiated by implementation.
- Security/changelog claims that this layer is active are inaccurate.

Action:

1. Implement blocking by setting a custom response (`put_Response`) for disallowed requests.
2. Add a focused integration test or instrumentation proof showing disallowed URL requests are terminated.
3. Update `src-tauri/CLAUDE.md` and `CHANGELOG.md` only after behavior is verified.

### 2. HIGH: Plan completion is inconsistent with skipped/pending critical verification work

Evidence:

- Plan marked complete at [docs/network-isolation-plan.md](D:/Repos/mini-diarium/docs/network-isolation-plan.md:5), but approval still pending at [docs/network-isolation-plan.md](D:/Repos/mini-diarium/docs/network-isolation-plan.md:9).
- Task 4.1b is skipped at [docs/network-isolation-plan.md](D:/Repos/mini-diarium/docs/network-isolation-plan.md:406) and still explicitly pending in matrix notes at [docs/network-isolation-plan.md](D:/Repos/mini-diarium/docs/network-isolation-plan.md:593).

Impact:

- "Complete" status overstates actual verification closure for Windows subprocess attribution/firewall claims.

Action:

1. Change plan status to `IN PROGRESS` (or `COMPLETED WITH EXCEPTIONS`) until 4.1b is closed or formally deferred with explicit scope reduction.
2. Replace placeholder note in 4.1b with actual measurement evidence or explicit decision to drop that guarantee.

### 3. HIGH: Final verification claim does not match current E2E result in this environment

Executed command:

```powershell
cmd.exe /c bun run test:e2e
```

Result:

- **Failed** (`exit code 1`) with repeated `no such element`/session errors on auth selectors.

Impact:

- Plan task 8.2 states E2E passes including the new network isolation spec, but that is not currently reproducible here.

Action:

1. Re-run E2E in the same environment used for plan closure and attach run artifact/log summary.
2. If this is environmental/flaky, document that explicitly in task 8.2 notes rather than marking the task fully complete.

### 4. MEDIUM: `check-no-network.ps1` does not enforce all declared checks

Evidence:

- Plan objective includes guarding external `fetch(` patterns at [docs/network-isolation-plan.md](D:/Repos/mini-diarium/docs/network-isolation-plan.md:88).
- Script currently checks `WebSocket`, `EventSource`, `sendBeacon` only at [scripts/check-no-network.ps1](D:/Repos/mini-diarium/scripts/check-no-network.ps1:34), [scripts/check-no-network.ps1](D:/Repos/mini-diarium/scripts/check-no-network.ps1:36).
- No explicit `fetch(` rule exists.

Impact:

- A network-capable code path could be introduced via `fetch` and still pass this guard.

Action:

1. Add explicit `fetch(` detection with an allowlist for accepted local-only patterns if needed.
2. Keep the script aligned with the plan text to avoid drift.

### 5. MEDIUM: NSIS hook file format is unverified against hook contract behavior

Evidence:

- Installer config points to hooks file at [src-tauri/tauri.conf.json](D:/Repos/mini-diarium/src-tauri/tauri.conf.json:42).
- Hook file uses raw `Section` blocks at [src-tauri/nsis/installer.nsh](D:/Repos/mini-diarium/src-tauri/nsis/installer.nsh:11) and [src-tauri/nsis/installer.nsh](D:/Repos/mini-diarium/src-tauri/nsis/installer.nsh:16).
- Tauri hook mechanism is documented as `NSIS_HOOK_*` macros.

Impact:

- Build succeeds, but execution semantics are not proven from source alone; rule installation/removal may be non-deterministic across template changes.

Action:

1. Convert hook file to documented `!macro NSIS_HOOK_POSTINSTALL` and `!macro NSIS_HOOK_POSTUNINSTALL` form.
2. Perform install/uninstall verification on Windows and capture firewall rule presence/removal proof.

### 6. MEDIUM: E2E network-isolation spec does not cover all nulled navigator APIs from the script

Evidence:

- Script nulls `serviceWorker`, `sendBeacon`, `connection` at [src/lib/network-isolation-script.ts](D:/Repos/mini-diarium/src/lib/network-isolation-script.ts:29).
- E2E spec checks only `sendBeacon` for navigator fields at [e2e/specs/network-isolation.spec.ts](D:/Repos/mini-diarium/e2e/specs/network-isolation.spec.ts:22).

Impact:

- Runtime coverage does not fully match declared defense surface.

Action:

1. Extend E2E assertions to include `navigator.serviceWorker` and `navigator.connection`.
2. Keep the static and runtime test target sets in sync.

## Verified Implemented Items

These items were confirmed present:

- CSP hardening directives in [src-tauri/tauri.conf.json](D:/Repos/mini-diarium/src-tauri/tauri.conf.json:15)
- `on_new_window(Deny)` in [src-tauri/src/lib.rs](D:/Repos/mini-diarium/src-tauri/src/lib.rs:248)
- init script registration + mirrored TS script:
  - [src-tauri/src/lib.rs](D:/Repos/mini-diarium/src-tauri/src/lib.rs:251)
  - [src/lib/network-isolation-script.ts](D:/Repos/mini-diarium/src/lib/network-isolation-script.ts:1)
- static test for script content at [src/lib/network-isolation.test.ts](D:/Repos/mini-diarium/src/lib/network-isolation.test.ts:1)
- direct platform deps in [src-tauri/Cargo.toml](D:/Repos/mini-diarium/src-tauri/Cargo.toml:89)
- devtools feature removed from `tauri` dependency in [src-tauri/Cargo.toml](D:/Repos/mini-diarium/src-tauri/Cargo.toml:24)
- Flatpak has no `--share=network` in [flatpak/io.github.fjrevoredo.mini-diarium.yml](D:/Repos/mini-diarium/flatpak/io.github.fjrevoredo.mini-diarium.yml:10)
- opener exception disclosed in docs and UI:
  - [PHILOSOPHY.md](D:/Repos/mini-diarium/PHILOSOPHY.md:165)
  - [SECURITY.md](D:/Repos/mini-diarium/SECURITY.md:76)
  - [src/components/overlays/AboutOverlay.tsx](D:/Repos/mini-diarium/src/components/overlays/AboutOverlay.tsx:91)

## Validation Commands Run

Passed:

```powershell
cmd.exe /c pwsh scripts/check-no-network.ps1
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run test:run
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo clippy --all-targets -- -D warnings"
cmd.exe /c bun run build
cmd.exe /c bun run tauri build --no-bundle
cmd.exe /c bun run tauri build --bundles nsis
cmd.exe /c bun run validate:locales
```

Failed:

```powershell
cmd.exe /c bun run test:e2e
```

Not validated in this environment:

- macOS-specific runtime behavior of `WKContentRuleList`
- Windows install/uninstall runtime proof that firewall rule is created/removed as intended
- Windows 4.1b attribution outcome for WebView2 subprocess traffic

## Milestone-by-Milestone Status

`Milestone 0` opener disclosure: **PASS** (implemented)

`Milestone 1` CSP hardening: **PASS** (implemented)

`Milestone 2` JS nullification + tests: **PARTIAL**

- static checks implemented
- runtime E2E exists but currently not green in this environment
- runtime navigator coverage incomplete

`Milestone 3` platform handlers: **PARTIAL / FAIL ON WINDOWS**

- popup blocking implemented
- Windows `WebResourceRequested` block behavior not actually enforced
- macOS handler present but not runtime-validated here

`Milestone 4` OS-level controls: **PARTIAL**

- Flatpak check implemented
- NSIS config present
- 4.1b explicitly skipped/pending

`Milestone 5` devtools gate: **PASS**

`Milestone 6` direct deps: **PASS**

`Milestone 7` docs/changelog updates: **PARTIAL** (present, but some claims are ahead of verified behavior)

`Milestone 8` final verification: **NOT SATISFIED** (E2E not currently passing; pending attribution task)

## Recommended Next Actions

1. Fix Windows request-blocking logic in `install_webresource_requested_handler` and prove blocked behavior with instrumentation.
2. Resolve Task 4.1b and update plan/matrix claims with measured evidence.
3. Convert NSIS hook file to `NSIS_HOOK_*` macros and verify install/uninstall rule lifecycle on a real install.
4. Extend `check-no-network.ps1` with `fetch(` checks and align the script with the current opener policy.
5. Expand E2E network-isolation spec to include all nulled navigator targets and stabilize E2E so task 8.2 can be truthfully marked complete.
