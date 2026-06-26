# Rust Best Practices

Durable rules and diagnostic habits for Mini Diarium's Rust backend. These are project-specific where encryption, journaling, and Tauri IPC shape the code, but they follow normal Rust practice: type-driven control flow, small modules, explicit error handling, narrow lock scopes, and tests against production code.

This is not a full Rust style guide. Use `rustfmt`, Clippy, and the language's standard naming conventions for routine style. This document covers the rules most likely to prevent security, data-integrity, and maintainability regressions in this codebase.

## Core Rules

### Enforce Security Invariants At The Trust Boundary

Frontend flow can guide users, but Rust commands and database helpers must enforce the invariant. Anything crossing IPC or disk should be treated as untrusted input.

- Multi-auth must verify distinct satisfied auth slot IDs, not just credential count.
- "At least N credentials" is not the same as "all required slots were satisfied."
- Collections representing identities, auth methods, or policy requirements must be checked for duplicates and missing members.
- Policy exceptions must be documented near the code that enforces the exception.

Good current reference:

- `src-tauri/src/commands/auth/auth_core.rs`
- `verify_credentials_and_collect_slots`
- `check_require_all_auth_credential_count`

Diagnostic check:

```powershell
rg -n "verify_credentials_and_collect_slots|Duplicate credential|check_require_all_auth_credential_count" src-tauri/src/commands/auth
```

### Prefer Typed Modes Over Boolean Policy Flags

When a command has multiple behavior paths, use an enum instead of booleans.

- Use `UnlockMode::Password`, `UnlockMode::Keypair`, `UnlockMode::AllMethods`.
- Keep exceptional paths, such as `unlock_diary_auto`, separate if their policy differs.
- Put policy comments beside the exceptional code path, not only in external docs.

This is standard Rust design: make invalid or ambiguous states harder to express. It also prevents shared-helper refactors from applying the wrong policy to a path.

### Centralize Repeated Security-Sensitive Logic

Repeated low-level code should be moved behind a small helper when it touches:

- lock and unlocked-session checks
- encrypted row serialization
- row decryption and UTF-8 validation
- migration ordering
- auth credential verification

Current references:

- `with_unlocked_db` for command DB access
- `ENTRY_SELECT` and `row_to_entry` for entry reads
- `encrypt_for_storage` and `decrypt_utf8` for encrypted row format
- `migrations::apply_pending` for schema migration ordering

Rule:

If two call sites manually repeat decryption, MAC validation, migration ordering, or unlocked-session checks, consider a helper before adding a third. Keep the helper small and name the invariant it enforces.

### Do Not Swallow Corruption Or Decryption Failures

Encrypted data read failures are real errors, not empty fields.

- Return an error if ciphertext decrypts incorrectly.
- Return an error if decrypted bytes are not valid UTF-8.
- Do not use `filter_map(Result::ok)` for encrypted data reads.
- Do not replace unreadable encrypted fields with `""`.

Diagnostic check:

```powershell
rg -n "filter_map\\(|unwrap_or_default\\(|from_utf8" src-tauri/src/db/queries
```

Review every match in encrypted data paths.

### Keep Storage Format Helpers Near The Query Boundary

Application code should not know ciphertext blob layout or encryption error mapping.

- Entry and tag writes should call shared encryption helpers.
- Entry and tag reads should call shared decryption helpers.
- Keep labels in helper errors so failures identify the logical field, not just "decrypt failed."

Current references:

- `src-tauri/src/db/queries/mod.rs`
- `src-tauri/src/db/queries/entries/` (split into `insert.rs`, `update.rs`, `read.rs`, `timeline.rs`)
- `src-tauri/src/db/queries/tags.rs`

### Keep Migrations Linear And Auditable

Migration ordering has one owner.

- Add new migrations under `src-tauri/src/db/schema/migrations/`.
- Register each new pending migration in `apply_pending`.
- Open paths should call `apply_pending` instead of hand-listing every migration. Legacy bootstrap migrations may be exceptions, but the exception should be obvious and tested.
- Expensive or data-rewriting migrations need explicit rollback/back-up reasoning.
- DDL-only migrations can rely on SQLite transaction rollback only when this is documented.

Diagnostic check:

```powershell
rg -n "migrate_v[0-9]_to_v[0-9]" src-tauri/src/db/schema src-tauri/src/db
```

Unexpected direct calls outside migration plumbing need review.

### Keep Lock Scope Small And Obvious

Mutex guards should be scoped so the reader can see when they are released.

- Clone path/config values out of state before opening databases or doing file I/O.
- Drop DB guards before backup rotation, menu updates, or event emission.
- Do not hold locks across async work.
- Avoid changing user-facing lock errors casually; frontend sanitization may map those strings.

Current DB-only command pattern:

```rust
with_unlocked_db(&state, |db| {
    // query or mutate db
    Ok(result)
})
```

### Preserve Secret Hygiene

Passwords, private keys, and master keys must not be logged, serialized, or stored in plaintext.

- Use `Zeroizing`, `ZeroizeOnDrop`, or explicit `zeroize()` for secret buffers where practical.
- Do not print raw crypto, SQLite, or path errors directly to user-facing UI.
- Keep plaintext diary content only in memory and encrypted at rest.
- Prefer local logs for operational context, not secret material.

### Prefer Pure Command Cores For Testability

Tauri command wrappers are integration glue. Important behavior should live in a production helper that can be tested without a full Tauri app harness.

Good examples:

- `lock_diary_inner`
- `remove_auth_method_inner`
- `list_auth_methods_inner`
- `verify_credentials_and_collect_slots`

Rule:

Do not test a reimplemented guard. Test the real helper or production query path.

### Treat Large Rust Files As Design Smells

Line count is not architecture, but very large Rust files usually mean too many responsibilities, hidden policy coupling, or tests that are hard to diagnose. Use file size as an early review signal.

Soft limits trigger a split review:

- normal production modules: 300 lines
- command, query, migration, import, export, or plugin modules: 400 lines
- focused test modules: 500 lines

Hard limits require an explicit justification in the PR or a split plan:

- normal production modules: 500 lines
- command, query, migration, import, export, or plugin modules: 650 lines
- focused test modules: 800 lines

Acceptable exceptions:

- generated files
- dense data fixtures
- compatibility migrations that are safer to keep as one auditable unit
- temporary refactor bridges with a documented removal gate

When a file crosses the soft limit, first look for a responsibility split that matches the domain boundary: command wrapper vs. command core, query helper vs. schema/migration, parser vs. formatter, registry vs. execution, or test fixture vs. assertions.

Diagnostic check:

```powershell
Get-ChildItem src-tauri\src -Recurse -Include *.rs |
  Where-Object { $_.FullName -notmatch '\\target\\|\\generated\\' } |
  ForEach-Object {
    $lines = (Get-Content $_.FullName).Count
    if ($lines -ge 300) { "{0,5} {1}" -f $lines, $_.FullName }
  } |
  Sort-Object -Descending
```

### Keep Compatibility Shims Explicit

Legacy migration shims and deprecated fields are acceptable when they protect existing users, but they need a removal gate.

- Document why the shim exists.
- Keep the migration idempotent.
- Add or keep a regression test for the legacy input shape.
- Record the release boundary before deleting compatibility code.

Current example: legacy `require_all_auth` config migration into `db_settings`.

## Regression Checklist

Run these before accepting Rust backend refactors:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
cmd.exe /c bun run check
```

For focused diagnosis:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml auth
cargo test --manifest-path src-tauri/Cargo.toml queries
cargo test --manifest-path src-tauri/Cargo.toml schema
```

## Review Questions

Ask these during Rust reviews:

- Does the backend enforce the invariant, or does it trust frontend shape?
- Does a helper check distinct identity where identity matters, not just count or type?
- Can a duplicated credential, duplicated row, or missing row bypass the intended rule?
- Does an encrypted read fail closed?
- Is migration ordering centralized?
- Are stale compatibility shims documented with a removal gate?
- Did a file move leave living docs pointing to dead paths?
- Are tests calling production helpers rather than copies of production logic?
- Is any Rust file past the soft limit, and if so, is the current responsibility boundary still defensible?
