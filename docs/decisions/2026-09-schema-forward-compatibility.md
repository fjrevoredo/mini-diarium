# ADR: Schema Forward Compatibility — Refuse Newer Journals and Backups

**Status:** Accepted
**Date:** 2026-09-27
**Related:** TODO-0122 (this guard); TODO-0123 (v14 attachment links, the gap this guard cannot close); `crates/mini-diarium-core/src/db/schema/compat.rs` (guard and marker contract); `crates/mini-diarium-core/src/db/schema/open.rs`; `crates/mini-diarium-core/src/db/peek.rs`; `crates/mini-diarium-core/src/backup/{inspect,restore}.rs`; `src/lib/errors.ts`.

## Context

Every open path only handled `stored_version < SCHEMA_VERSION`. Each migration step is gated on `version < N`, so it is a no-op on a higher version. An older app therefore opened a newer journal silently, and wrote to it: every open path called `update_slot_last_used` before the migration check. An older app does not know the newer tables and columns, so it can break invariants it has never heard of (for v14: deleting an attachment-only entry as "empty").

The realistic trigger is two machines on one synced folder that run different app versions, not a manual downgrade.

This guard cannot protect versions that already shipped. Every version that ships **without** it can open any future schema, so it had to land in 0.7.4.

## Decision

**Hard refuse, with an opt-in compatibility marker.**

An app refuses a journal when `schema_version > SCHEMA_VERSION`, unless the optional `db_settings` row `min_reader_version` exists, parses as an integer, and is `<= SCHEMA_VERSION`.

- The check is read-only. It runs directly after the SQLite file is opened, before any write and before the KDF or the auth-slot lookup. A refused journal stays byte-for-byte unchanged, and a wrong credential gives the same message.
- It runs on every open path: password, key file, local-only (auto key), and the unlock-screen peek (`peek_auth_slot_types`), so the user sees the message before typing a credential. Journal switch only swaps paths and locks; the next unlock goes through the same guarded functions. `create_diary*` refuse an existing file, so there is no separate post-create open path.
- `migrate_with_pre_migration_snapshot` calls the guard again. It is the single choke point every writer passes through, so a future open path that forgets the guard still refuses before `apply_pending`.
- A missing or malformed `schema_version` counts as readable, so legacy and corrupt journals keep their existing, more specific errors.
- 0.7.4 never writes the marker.

### The marker contract

| Marker state | Meaning |
|---|---|
| absent | The oldest compatible reader is the app whose `SCHEMA_VERSION` equals the stored version. |
| `min_reader_version = N` | Any app with `SCHEMA_VERSION >= N` may open and write the journal. |
| unparsable | Refuse (fail safe). |

Rules for every `SCHEMA_VERSION` bump (the authoritative checklist is the module doc of `db/schema/compat.rs`):

1. **Decide.** Only a migration that an older app can ignore **while writing** (no new invariant, foreign key, or column the older writer must maintain) may keep older readers in, by writing `min_reader_version` = the oldest safe `SCHEMA_VERSION`. Anything else must delete the row. When in doubt, delete it: a locked-out older machine is an inconvenience; silent data loss is not recoverable.
2. **Write the state explicitly in the migration step**, inside its transaction (`INSERT OR REPLACE` or `DELETE`). Never rely on the value a previous migration left behind.
3. **Write the same state in `create_schema`.** Fresh journals never run migrations.
4. **Update the tripwire** (`MARKER_DECIDED_FOR_SCHEMA_VERSION`, `EXPECTED_MARKER` in the `compat.rs` tests). It fails on every bump until the decision is recorded, and a second test checks that fresh and migrated journals carry the same marker.
5. Values below 14 mean nothing: versions before 0.7.4 have no guard.

The v14 attachments migration does **not** qualify: an older app drops inline attachment references when it saves an entry, and it cannot maintain attachment links. The `ON DELETE RESTRICT` on `entry_attachments.entry_id` (TODO-0123) only stops an older app from deleting an attachment-only entry as empty, so files are not lost silently; it does not make v14 safe for older writers.

## Snapshots

Backup inspection, per-entry restore, and whole-journal restore **refuse** a snapshot with a newer schema, using the same rule and a backup-specific message. A newer snapshot may hold data this app cannot represent. Inspection and per-entry restore would silently drop it, and a whole-journal restore would swap in a journal the app then cannot open.

Whole-journal restore checks the **staged copy** before the `PreRestore` safety snapshot and before the swap, so a refusal leaves the live journal and the backups folder unchanged.

Listing, health, deletion, credential comparison, and on-demand verification of a snapshot are unchanged. They are read-only (or delete a file the user chose) and never interpret entry data beyond checking that it decrypts, so they stay available for a newer snapshot.

## User-facing messages

Two canonical backend strings, mapped by `mapTauriError` and translated in every locale:

- `This journal requires a newer version of the app. Update the app to open it.`
- `This backup requires a newer version of the app. Update the app to inspect or restore it.`

Neither contains a path or a journal name. Renaming either is a contract change (see `crates/mini-diarium-core/API.md`, *Error policy*).

## Options considered

- **Hard refuse only.** Simplest, but every future schema bump, even an additive one, would lock out an older app on a second machine. Rejected in favor of the opt-in marker, which costs one `db_settings` read.
- **Warn and open read-only.** Needs a read-only mode through the whole UI and still risks rendering partial data as complete. Rejected.
- **Marker as a new column in `schema_version`.** Changes a table every released version reads. `db_settings` already exists in every v6+ journal, and any too-new journal is v6+.

## Consequences

- Versions before 0.7.4 still open any newer journal silently. For v14 that gap is mitigated by TODO-0123 (`ON DELETE RESTRICT` on attachment links).
- Every schema bump must now decide and explicitly write or delete `min_reader_version`, in the migration step and in `create_schema` (see `src-tauri/CLAUDE.md`, Gotcha #13). A tripwire test enforces that the decision is made.
