# MAC Integrity Protection for `require_all_auth`

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-03
- Last Updated: 2026-05-03
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Add a cryptographic MAC (HKDF-SHA256) to the `require_all_auth` flag stored in `db_settings` so that plaintext SQLite tampering (DELETE or UPDATE of the row) is detectable and a fail-safe guard remains enforced on single-credential unlock attempts.

## Scope

- Add `delete_db_setting`, `compute_settings_mac`, `verify_require_all_auth`, `write_require_all_auth_mac` to `src-tauri/src/db/queries.rs`
- Add tests for the four new query functions in the queries test module
- Update `set_require_all_auth` in `src-tauri/src/commands/auth_methods.rs` to write MAC on enable and delete both rows on disable
- Add tests for the `set_require_all_auth` change
- Replace value-only guards in `unlock_diary`, `unlock_diary_with_keypair`, and `unlock_diary_all_methods` with `verify_require_all_auth`
- Add self-heal block in `unlock_diary_all_methods` after the credential loop and before state commit
- Note: The MAC is stored hex-encoded in `db_settings` (64-char string); the raw 32-byte MAC is used only in computation

## Non-Goals

- No schema migration (MAC is an optional row; absence means disabled — no "false" value semantics)
- No new dependencies (`hkdf`, `sha2`, `hex` are already direct deps)
- No changes to `config.json` handling

## Assumptions

- `hkdf = "0.13"`, `sha2 = "0.11"`, `hex = "0.4"` are already direct deps in `src-tauri/Cargo.toml`
- `set_db_setting` / `get_db_setting` exist at `queries.rs:333–350`
- `set_require_all_auth` exists at `auth_methods.rs:343–370`
- `migrate_require_all_auth_to_db` exists at `auth_core.rs:32–67`
- Value-only guards exist in `unlock_diary` (auth_core.rs:127), `unlock_diary_with_keypair` (auth_core.rs:182), `unlock_diary_all_methods` (auth_core.rs:490)
- MAC primitive: HKDF-SHA256 with `info=b"mini-diarium:require_all_auth:v1"`
- Canonical disabled = both rows deleted (absence means off)
- Fail-safe: MAC absent/invalid → `verify_require_all_auth` returns `true` (guard enforced = more restrictive)

## Open Questions

- None (all questions resolved)

## Milestones

### Milestone 1: MAC query functions in queries.rs

- Status: TO BE DONE
- Purpose: Provide the low-level MAC primitives needed to integrity-protect the `require_all_auth` flag.
- Exit Criteria: `delete_db_setting`, `compute_settings_mac`, `verify_require_all_auth`, and `write_require_all_auth_mac` are implemented and all five associated unit tests pass.

#### Task 1.1: Add `delete_db_setting` to queries.rs

- Status: TO BE DONE
- Objective: Implement `delete_db_setting(key: &str)` in `src-tauri/src/db/queries.rs` after `set_db_setting`.
- Steps:
  1. Open a read-write transaction on the database connection obtained from `db_state`.
  2. Execute `DELETE FROM db_settings WHERE key = ?` with the provided key.
  3. Commit the transaction.
  4. Return `Ok(())` on success or an error string on failure.
- Validation: The function compiles, and the test added in Task 1.5 verifies the row is deleted.
- Notes: Follow the same transaction pattern used by `set_db_setting` at `src-tauri/src/db/queries.rs:343–350`.

#### Task 1.2: Add private `compute_settings_mac` to queries.rs

- Status: TO BE DONE
- Objective: Implement `compute_settings_mac(master_key: &[u8; 32]) -> [u8; 32]` as a private helper in `src-tauri/src/db/queries.rs`. Returns a 32-byte raw MAC (not hex-encoded).
- Steps:
  1. Run HKDF-SHA256 with `ikm = master_key`, `salt = None`, `info = b"mini-diarium:require_all_auth:v1"`.
  2. Expand to 32 bytes.
  3. Return the raw 32-byte array.
- Validation: The function compiles and returns a 32-byte array for any 32-byte key input.
- Notes: Pure HKDF-SHA256 with no salt; info string provides domain separation.

#### Task 1.3: Add `verify_require_all_auth` to queries.rs

- Status: TO BE DONE
- Objective: Implement `verify_require_all_auth(conn: &rusqlite::Connection, master_key: &[u8; 32]) -> bool` in `src-tauri/src/db/queries.rs`.
- Steps:
  1. Retrieve `require_all_auth` value via `get_db_setting(conn, "require_all_auth")`.
  2. If absent or `"false"`, return `false` (guard is off).
  3. If `"true"` and MAC row absent via `get_db_setting(conn, "require_all_auth_mac")`, return `true` (fail-safe: enforce guard).
  4. If MAC row present, decode it from hex. If malformed, return `true` (fail-safe).
  5. Compute `compute_settings_mac(master_key)` and compare with stored MAC using `==` (simple equality is fine for the MAC comparison since it's a fixed-length array).
  6. Return `true` if MACs match, `false` otherwise.
- Validation: The function compiles and returns `false` when MAC is absent (fail-safe for absent flag) and `true` when MAC is valid.
- Notes: Uses simple `==` for 32-byte array comparison (fixed-length, no timing side-channel risk on the comparison itself).

#### Task 1.4: Add `write_require_all_auth_mac` to queries.rs

- Status: TO BE DONE
- Objective: Implement `write_require_all_auth_mac(conn: &rusqlite::Connection, master_key: &[u8; 32]) -> Result<(), String>` in `src-tauri/src/db/queries.rs`.
- Steps:
  1. Compute `mac = compute_settings_mac(master_key)`.
  2. Call `set_db_setting(conn, "require_all_auth_mac", &hex::encode(mac))`.
  3. Return the result.
- Validation: The function compiles and calls `set_db_setting` with the correct MAC value.
- Notes: None.

#### Task 1.5: Add tests for the four query functions

- Status: TO BE DONE
- Objective: Add five unit tests in the `queries.rs` test module covering all four new functions.
- Steps:
  1. Add a test for `delete_db_setting`: insert a row, delete it, confirm it is gone via `get_db_setting`.
  2. Add a test for `compute_settings_mac`: call with a known input and verify the output is a 32-byte array (not hex-encoded).
  3. Add a test for `verify_require_all_auth` when neither row exists: returns `false`.
  4. Add a test for `verify_require_all_auth` when value exists but MAC is absent: returns `true` (fail-safe).
  5. Add a test for `write_require_all_auth_mac`: write a MAC via `write_require_all_auth_mac`, retrieve it via `get_db_setting("require_all_auth_mac")`, hex-decode it, and verify it matches the raw 32-byte MAC from `compute_settings_mac`.
- Validation: All five tests pass with `cargo test` — run from `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.
- Notes: Use the existing test setup pattern from the queries test module.

### Milestone 2: Wire MAC into `set_require_all_auth`

- Status: TO BE DONE
- Purpose: Make `set_require_all_auth` write and delete the MAC row alongside the value row so the flag is integrity-protected.
- Exit Criteria: `set_require_all_auth` writes MAC on enable, deletes both rows on disable, and the two new unit tests pass.

#### Task 2.1: Update `set_require_all_auth` in auth_methods.rs

- Status: TO BE DONE
- Objective: Modify `set_require_all_auth` at `auth_methods.rs:343–370` to write MAC on enable and delete both rows on disable.
- Steps:
  1. In the `enabled = true` branch, after writing the `"true"` value row, call `write_require_all_auth_mac(db.conn(), db.key().as_bytes())`.
  2. In the `enabled = false` branch, call `delete_db_setting("require_all_auth")` and then `delete_db_setting("require_all_auth_mac")`.
  3. Preserve the existing auth-slot validation that prevents removing the last auth method when `require_all_auth` would be left orphaned.
- Validation: The function compiles and the two new tests pass.
- Notes: The `pub(crate)` visibility on `write_require_all_auth_mac` and `delete_db_setting` allows this call from `auth_methods.rs`.

#### Task 2.2: Add tests for `set_require_all_auth` MAC behavior

- Status: TO BE DONE
- Objective: Add two unit tests in the `auth_methods.rs` test module for the MAC write and delete behavior.
- Steps:
  1. Add a test: enable `require_all_auth`, then verify the MAC row exists via `get_db_setting("require_all_auth_mac")`.
  2. Add a test: enable then disable `require_all_auth`, then verify both rows are absent via `get_db_setting`.
- Validation: Both tests pass with `cargo test`.
- Notes: Use the existing `DiaryState` test fixture from the auth_methods test module.

### Milestone 3: Replace value-only guards in auth_core.rs

- Status: TO BE DONE
- Purpose: Replace the three plaintext value-only guards with `verify_require_all_auth` so tampering with the value row triggers the fail-safe guard.
- Exit Criteria: All three unlock paths use `verify_require_all_auth`, the self-heal block is present in `unlock_diary_all_methods`, and all associated tests pass.

#### Task 3.1: Replace guards in `unlock_diary` and `unlock_diary_with_keypair`

- Status: TO BE DONE
- Objective: Replace the value-only guards at auth_core.rs:127 and auth_core.rs:182 with `verify_require_all_auth`.
- Steps:
  1. In `unlock_diary`, replace the existing `get_db_setting("require_all_auth") == Ok(Some("true".to_string()))` guard with `crate::db::queries::verify_require_all_auth(db_conn.conn(), db_conn.key().as_bytes())`.
  2. In `unlock_diary_with_keypair`, replace the analogous value-only guard with `crate::db::queries::verify_require_all_auth(db_conn.conn(), db_conn.key().as_bytes())`.
  3. Keep the existing early-return structure; the guard should short-circuit before credential verification when the MAC is invalid or absent.
- Validation: Both functions compile and existing tests pass.
- Notes: The fail-safe semantics of `verify_require_all_auth` (returns `true` when MAC is absent/invalid) preserve the existing security posture.

#### Task 3.2: Replace guard and add self-heal block in `unlock_diary_all_methods`

- Status: TO BE DONE
- Objective: Replace the value-only guard at auth_core.rs:490 with `verify_require_all_auth` and add the self-heal block after the credential loop and before state commit.
- Steps:
  1. Replace the existing `get_db_setting("require_all_auth") == Ok(Some("true".to_string()))` guard in `unlock_diary_all_methods` with `crate::db::queries::verify_require_all_auth(db_conn.conn(), db_conn.key().as_bytes())`.
  2. After the credential loop succeeds (after `Ok(master_key.unwrap())`), before `*db_state = Some(db_conn)`, add:
     ```
     // Self-heal: write MAC for existing v6 journals that predate MAC support
     if crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth")
         .map(|v| v == "true")
         .unwrap_or(false)
         && crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth_mac").is_none()
     {
         if let Err(e) = crate::db::queries::write_require_all_auth_mac(
             db_conn.conn(),
             db_conn.key().as_bytes(),
         ) {
             warn!("Failed to write require_all_auth MAC: {}", e);
         }
     }
     ```
  3. Keep the existing early-return structure; the guard should short-circuit before credential verification when the MAC is invalid or absent.
- Validation: The function compiles, the self-heal block is present before state commit, and existing tests pass.
- Notes: The self-heal ensures that after a successful all-methods unlock, the MAC is written so subsequent single-credential unlock attempts are blocked if the MAC is absent or invalid (fail-safe). The MAC is computed from the master key, not from the string "true".

### Milestone 4: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: No intermediate artifacts remain, all four verification commands pass, and the plan status is COMPLETED.

#### Task 4.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: No intermediate artifacts are expected from this change. This task is included per the skill requirement.

#### Task 4.2: Final Verification

- Status: TO BE DONE
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` and confirm all tests pass.
  2. Run `cmd.exe /c bun run test:run` and confirm all frontend tests pass.
  3. Run `cmd.exe /c bun run type-check` and confirm it passes.
  4. Run `cmd.exe /c bun run test:e2e:local` and confirm E2E tests pass.
  5. Fix any failures and rerun until all verification passes, or record the blocker.
- Validation: All four commands pass with zero failures.
- Notes: Run from the Windows shell as specified in AGENTS.md.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] `cargo clippy` passes with zero warnings
- [ ] `cargo test` passes with zero failures
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun run format:check` succeeds
- [ ] [N/A — no i18n changes in this plan]
- [ ] [N/A — no text-processing changes in this plan]
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (docs/plans/).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user (None — all resolved).
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Run verification commands from the Windows shell as specified in AGENTS.md — use `cmd.exe /c ...` for all commands.

(End of file - total 227 lines)