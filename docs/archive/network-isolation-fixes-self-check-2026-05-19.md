# Network Isolation Fixes Self-Check (2026-05-19)

## Scope

This follow-up audit verifies that the fixes requested from `docs/network-isolation-implementation-self-check-2026-05-19.md` were actually applied in code, tests, scripts, and docs.

## Executive Result

Status: **Most requested fixes applied successfully**.

- The Windows WebView2 handler now actively blocks external HTTP(S) requests with a synthetic `403` response.
- NSIS hooks now use Tauri-documented `NSIS_HOOK_*` macros.
- Static network policy checks now include external `fetch(...)` detection.
- Runtime network-isolation E2E coverage now includes `navigator.serviceWorker` and `navigator.connection`.
- Documentation was aligned with real implementation and current validation state.

Two items remain blocked by environment/manual validation gates (see "Remaining Blockers").

## Applied Fixes

1. **Windows request blocking is now enforced (not only logged)**
   - Updated: `src-tauri/src/lib.rs`
   - Change: `WebResourceRequested` callback now creates a `403 Forbidden` response via `CreateWebResourceResponse(...)` and sets it with `SetResponse(...)` for disallowed external HTTP(S) URLs.
   - Result: `cargo test` and `cargo clippy --all-targets -- -D warnings` pass after this change.

2. **NSIS installer hooks now follow Tauri's contract**
   - Updated: `src-tauri/nsis/installer.nsh`
   - Change: replaced raw `Section` blocks with `!macro NSIS_HOOK_POSTINSTALL` / `!macro NSIS_HOOK_POSTUNINSTALL`.
   - Result: configuration is now consistent with Tauri's documented hook mechanism.

3. **Policy script now checks external `fetch` usage**
   - Updated: `scripts/check-no-network.ps1`
   - Change: added explicit external-fetch pattern checks (`https?://` and protocol-relative `//`) while still allowing local asset fetches.
   - Result: `pwsh scripts/check-no-network.ps1` passes on current codebase.

4. **E2E navigator coverage now matches nullification script**
   - Updated: `e2e/specs/network-isolation.spec.ts`
   - Change: added `navigator.serviceWorker` and `navigator.connection` assertions (in addition to `sendBeacon`).

5. **Documentation accuracy fixes**
   - Updated: `src-tauri/CLAUDE.md` (Windows handler now documented as `SetResponse` 403 behavior).
   - Updated: `docs/network-isolation-plan.md`:
     - Plan status changed to `IN PROGRESS`.
     - Milestone 4 and Milestone 8 status corrected to `IN PROGRESS`.
     - Task 4.1b and 8.2 marked `BLOCKED` (manual/verification gates not yet closed).
     - E2E spec path corrected to `e2e/specs/network-isolation.spec.ts`.
     - Task 0.2 script expectations updated to include external `fetch` checks.

## Validation Commands

Passed:

- `cmd.exe /c pwsh scripts/check-no-network.ps1`
- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run test:run`
- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo clippy --all-targets -- -D warnings"`

Failed:

- `cmd.exe /c bun run test:e2e:local -- --spec e2e/specs/network-isolation.spec.ts`
  - Current failure occurs earlier in auth flow (`no such element` for password selectors), so the network-isolation assertions are not reached in this environment.

## Remaining Blockers

1. **Task 4.1b manual WebView2 attribution proof** is still pending.
   - Needs real install/runtime firewall log verification and process attribution capture.

2. **Final E2E gate in Task 8.2** is still blocked by current E2E harness/auth-screen instability in this environment.

## Trusted Sources

- Tauri official installer docs (NSIS hook names and `installMode: perMachine` behavior):  
  https://v2.tauri.app/distribute/windows-installer/
- Microsoft WebView2 docs (`put_Response` / request completion with custom response):  
  https://learn.microsoft.com/microsoft-edge/webview2/reference/win32/icorewebview2webresourcerequestedeventargs

Local evidence sources:

- `src-tauri/src/lib.rs`
- `src-tauri/nsis/installer.nsh`
- `scripts/check-no-network.ps1`
- `e2e/specs/network-isolation.spec.ts`
- `src-tauri/CLAUDE.md`
- `docs/network-isolation-plan.md`
