# Tauri Best Practices

Durable rules and diagnostic habits for Mini Diarium's Tauri v2 boundary. These focus on command registration, IPC validation, error sanitization, WebView security, and capability checks.

This is not a full Tauri tutorial. Use the official Tauri v2 docs for general setup, packaging, and plugin APIs. This document captures the practices that keep this app's frontend/backend boundary secure and diagnosable.

## Core Rules

### Keep Command Registration Complete And Typed

New commands need registration and a typed frontend wrapper:

- module export/declaration under `src-tauri/src/commands/` when a new module or public command is added
- `tauri::generate_handler![]` in `src-tauri/src/lib.rs`
- wrapper in the matching command-category sub-file under `src/lib/tauri/`

Frontend wrappers must use the exact command name and argument shape expected by Tauri. Prefer owned Rust argument types (`String`, `Vec<T>`, structs) for command input, especially for async commands.

Diagnostic checks:

```powershell
rg -n "generate_handler|tauri::command|invoke\\(" src-tauri/src src/lib/tauri/
```

If frontend invocation fails with "command not found," inspect `generate_handler![]` first.

### Treat The IPC Boundary As Hostile

The frontend may send malformed, duplicated, missing, or out-of-order data.

- Rust commands must validate every security-sensitive invariant.
- Frontend-derived arrays need backend duplicate and coverage checks.
- Do not rely on disabled buttons, hidden controls, or UI slot ordering for security.
- Command argument DTOs should make invalid shapes harder, but DTOs are not enough.

Current multi-auth example:

`unlock_diary_all_methods` receives a credential vector. The backend verifies that every non-auto auth slot is satisfied by a distinct credential, not only that enough credentials were sent.

### Sanitize Every User-Facing Tauri Error

Raw backend errors can contain paths, SQLite messages, OS details, or crypto internals.

Rules:

- In UI components, pass caught Tauri errors through `mapTauriError(err, t)` before display.
- In state modules that cannot access `t`, use `mapTauriError(err)` before setting global error state or rethrowing for UI display.
- Local logs may include operational error context, but user-facing banners and alerts must be sanitized.
- Do not use `setError(String(err))`, `setError(err.message)`, or indirect variants with a raw `message` variable.

Guard command:

```powershell
cmd.exe /c bun run check:ui-errors
```

Project check:

```powershell
cmd.exe /c bun run check
```

When adding a new user-visible error path, add or update a test with a deliberately leaky raw string and assert it is not rendered.

### Treat Mapped Error Strings As API Surface

`mapTauriError()` matches backend error text. If Rust command errors change, update frontend mapping and tests in the same change.

Examples of canonical backend strings:

- `Journal must be unlocked`
- `Journal state lock failed`
- `Incorrect password`
- `Cannot remove the last authentication method`
- `Failed to read key file`
- `Failed to write key file`

Rule:

If a backend string is user-facing or matched by `mapTauriError`, treat it as API surface.

### Keep Command Helpers Small And Policy-Aware

Use shared command helpers for repeated mechanics, but do not hide policy differences.

- Use `with_unlocked_db` for commands that only need the active DB connection.
- Keep mixed-state commands explicit if they also need `app_data_dir`, `db_path`, backup directories, registry locks, or custom logs.
- Keep policy-exception paths separate and documented.

Bad smell:

A helper takes a boolean such as `check_multi_auth: bool`.

Better:

Use a typed enum or separate function so each mode is explicit.

### Put Behavior In Testable Command Cores

Prefer stable command-core helpers for important behavior. A full Tauri app harness is useful for integration coverage, but command policy should also be testable without window/runtime setup.

Patterns:

- Tauri command: thin wrapper that extracts `State`/`AppHandle`.
- Inner function: takes `&DiaryState`, `&DatabaseConnection`, or typed arguments.
- Tests call the inner function and production query/auth code.

This gives meaningful unit coverage and keeps any Tauri harness focused on serialization, registration, and runtime behavior.

### What jsdom Cannot Test

These Tauri/WebView behaviors fire at the platform level before JavaScript and cannot be validated by Vitest or jsdom:

- `target="_blank"` → WebView new-window handoff (fires before the JS event loop)
- `on_navigation` / `on_new_window` guards
- OS-level screen-lock / session events (Windows `WM_WTSSESSION_CHANGE`, macOS `com.apple.screenIsLocked`)
- WebView2 `WebResourceRequested` handler
- Any behavior that depends on the actual Tauri runtime rather than the mocked `@tauri-apps/api`

For any test that covers code adjacent to these behaviors, add a comment explaining what requires manual in-app verification:

```ts
// PLATFORM-VERIFY: <describe what must be manually verified in the running app>
```

Include an explicit `PLATFORM-VERIFY` manual-verification step in the plan's exit criteria whenever a plan step touches Tauri WebView interactions (link clicks, navigation, new-window).

### Keep WebView Security Platform Code Isolated

Platform WebView security handlers are part of the app's network-isolation defense.

- Keep them in `src-tauri/src/webview_security/`.
- Preserve `unsafe` blocks and `SAFETY` comments during moves.
- Keep `lib.rs` setup readable: call `webview_security::install_platform_handlers(&win)`.
- Validate WebView/network-isolation behavior in E2E or CI when platform handler logic changes. A move-only refactor can use build/test validation plus a documented E2E deferral.

Diagnostic check:

```powershell
rg -n "install_platform_handlers|on_navigation|on_new_window|WebResourceRequested|ContentRuleList" src-tauri/src
```

### Capabilities And Plugins Need Explicit Checks

Tauri v2 denies by default. When using or adding a plugin:

- confirm the plugin is configured in Rust
- confirm the matching frontend package/API is used
- confirm `src-tauri/capabilities/` grants the required permissions
- add a small smoke test or manual validation path

Common diagnosis:

If a dialog, opener, file-system, or shell operation works in dev but fails in packaged mode, inspect capabilities before changing business logic.

### Keep Local-Only And Password/Keypair Journals Distinct

Local-only journals use an auto key from `config.json`; password/keypair journals use user credentials and auth slots.

Rules:

- `unlock_diary_auto` intentionally bypasses `require_all_auth`.
- Multi-auth UI and backend checks apply to non-auto auth slots.
- If a future feature allows mixing auto slots with user auth slots, revisit the policy before coding.
- Policy decisions must be documented near the command and in backend docs.

### Keep Frontend State And Backend State Responsibilities Separate

Frontend state is for UI flow and user feedback. Backend state is for durable policy and data integrity.

- Preferences that affect only UI behavior can stay in frontend/local storage.
- Security enforcement flags must live with the database or backend state that enforces them.
- When moving a setting between storage locations, write an idempotent migration and keep compatibility fields until the release boundary is approved.

### Keep Tauri Boundary Files Navigable

Tauri boundary files are high-traffic diagnosis points. They should stay easy to scan during command-not-found, capability, and raw-error investigations.

Soft limits trigger a split review:

- `src-tauri/src/lib.rs`: 350 lines
- individual command modules: 400 lines
- each frontend Tauri wrapper sub-file under `src/lib/tauri/` (one per command category): 350 lines
- capability files: 250 lines

Hard limits require an explicit justification in the PR or a split plan:

- `src-tauri/src/lib.rs`: 500 lines
- individual command modules: 650 lines
- each frontend Tauri wrapper sub-file under `src/lib/tauri/`: 500 lines (the barrel `index.ts` stays trivially small — just `export *` lines)
- capability files: 400 lines

Prefer splits that preserve diagnosis:

- keep `lib.rs` as setup and command registration, not business logic
- split command modules by user workflow or security boundary
- keep typed frontend wrappers grouped by command category as sub-files under `src/lib/tauri/`, re-exported from the barrel `index.ts`
- split large capability files by feature only when the resulting permission model stays obvious

Generated files and platform-specific WebView security code may exceed these limits when splitting would make platform behavior harder to audit. Document that exception near the file or PR.

## Frontend/Tauri Diagnostic Playbook

### Command Not Found

1. Check `src-tauri/src/lib.rs` `generate_handler![]`.
2. Check command module exports in `src-tauri/src/commands/`.
3. Check wrapper name and argument casing in `src/lib/tauri/` (the matching command-category sub-file).

### Raw Error Appears In UI

1. Run `cmd.exe /c bun run check:ui-errors`.
2. Search for raw message extraction:

   ```powershell
   rg -n "err\\.message|String\\(err\\)|set[A-Za-z]*Error\\(" src
   ```

3. Confirm whether the error was already sanitized by a state helper before rethrow.
4. Convert genuinely user-visible raw paths to `mapTauriError(err, t)`.
5. Add a leak-prevention component test.

### Multi-auth Unlock Misbehaves

1. Inspect `peek_auth_slot_types` output shape.
2. Verify frontend sends one credential per slot.
3. Verify backend rejects duplicate satisfied slot IDs.
4. Verify backend compares satisfied slot IDs to all non-auto auth slot IDs.
5. Run focused auth tests:

   ```powershell
   cargo test --manifest-path src-tauri/Cargo.toml auth
   ```

### WebView Security Regression

1. Inspect `webview_security/` platform handlers.
2. Confirm handler installation still happens in `lib.rs` setup.
3. Run build and available E2E/network-isolation checks.
4. On CI-only issues, compare platform-specific handler code and capabilities.

## Required Validation

For Tauri boundary changes:

```powershell
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run check:ui-errors
cmd.exe /c bun run test:run
cargo test --manifest-path src-tauri/Cargo.toml
cmd.exe /c bun run build
```

For UI/WebView behavior changes, also run E2E when the environment supports it:

```powershell
cmd.exe /c bun run test:e2e
```

If E2E is skipped, record the concrete environment blocker and the residual risk.

## Review Checklist

- Are command registration, command wrappers, and capabilities still easy to scan?
- Is any Tauri boundary file past the soft limit, and if so, does the current grouping improve diagnosis rather than hide responsibilities?
