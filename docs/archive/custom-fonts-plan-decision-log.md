# Custom Fonts Plan — Decision Log

Decisions made during implementation that were not specified in the plan.
Each entry records what was decided and why, for post-implementation review.

---

## Decisions

*(entries added during implementation)*

### Decision 5 — Custom fonts management moved to Advanced tab

**When:** Post-launch bug fix  
**What:** The custom fonts management UI (`PreferencesCustomFontsSection`) was removed from the Writing tab and placed in the Advanced tab. A note was added below the font-family selector in the Writing tab pointing users there.  
**Decision:** The feature is intended for power users and adds unnecessary complexity to the Writing tab for typical users. The Writing tab should remain focused on day-to-day writing preferences.

---

### Decision 4 — Shared `customFontsVersion` counter signal for coordinated refetch

**When:** Post-launch bug fix  
**What:** Each of the three components that call `listCustomFonts` (`EditorToolbar`, `PreferencesFontFamilyField`, `PreferencesCustomFontsSection`) independently created a `createResource(listCustomFonts)` with no reactive source, so they each fetched exactly once on mount and never refetched when a sibling mutated the font list.  
**Decision:** Introduced `src/state/fonts.ts` with a shared `customFontsVersion` counter signal. All three components use it as the `createResource` source; incrementing the counter triggers a coordinated refetch in all of them. The alternative (a single shared `createResource` in a context/store) was rejected as over-engineering for three components.

---

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

