# Custom Fonts Plan — Decision Log

Decisions made during implementation that were not specified in the plan.
Each entry records what was decided and why, for post-implementation review.

---

## Decisions

*(entries added during implementation)*

### Decision 2 — `getByText('TestFont')` ambiguity in PreferencesWritingTab tests

**When:** Milestone 3, Task 3.5  
**What:** The test for "does not show missing-Bold warning when bold weight is present" used `screen.getByText('TestFont')` to wait for the font to load. With the new UI, 'TestFont' now appears in two places: the `<option>` inside the font-family dropdown AND the `<span>` in the custom fonts list. `getByText` expects exactly one match and throws when there are multiple.  
**Decision:** Changed to `screen.getAllByText('TestFont').length > 0` to assert that at least one instance of the text is present, which correctly verifies the component rendered without over-constraining DOM structure.

---

### Decision 3 — `auth_slots.rs` tests also asserted schema v7

**When:** Task 5.6 final verification  
**What:** Two tests in `src-tauri/src/commands/auth/auth_slots.rs` (`test_register_keypair_and_unlock` at line 307, `test_register_keypair_no_password_slot` at line 527) asserted the schema version was 7 after opening a database. Since `open_database_with_keypair` internally calls `apply_pending`, the resulting version is now 8.  
**Decision:** Updated both assertions from `7` to `8`. Same reasoning as Decision 1 — these tests verify that the DB is fully migrated, so they should track `SCHEMA_VERSION`.

---

### Decision 1 — Legacy migration tests also asserted schema v7

**When:** Milestone 1, Task 1.3  
**What:** `src-tauri/src/db/schema/legacy.rs` has two integration tests (`test_migration_v1_to_v3_success`, `test_migration_v2_to_v3_with_entries`) that open a legacy DB through `open_database`, which internally calls `apply_pending`. Both tests asserted the resulting version was 7, which is now 8 after the new migration step.  
**Decision:** Updated both assertions from `7` to `8`. These are not "v7 target" tests — they test that a legacy DB is fully migrated to the current schema version, so their expected value should always track `SCHEMA_VERSION`.

