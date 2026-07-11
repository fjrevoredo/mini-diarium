# ADR: Settings Storage Taxonomy

**Status:** Accepted
**Date:** 2026-05-17
**Related:** `src/state/preferences.ts`; `src-tauri/src/config.rs`; `src-tauri/src/db/schema/migrations/` (migrate_v5_to_v6); `src-tauri/src/db/queries/db_settings.rs` (get_db_setting, set_db_setting, verify_require_all_auth, write_require_all_auth_mac); `src-tauri/src/commands/auth/auth_core.rs` (migrate_require_all_auth_to_db).

## Context

Mini Diarium has four locations where persistent state lives:

| Location | What it stores | Always accessible? | Encrypted? |
|---|---|---|---|
| `localStorage['preferences']` | 14-field `Preferences` interface | Yes | No |
| `localStorage['theme-preference']` | `'auto'\|'light'\|'dark'` | Yes | No |
| `localStorage['theme-overrides']` | CSS token override map | Yes | No |
| `localStorage['feature-flags']` | Runtime feature-flag map (open `Record<string, boolean>`) | Yes | No |
| `config.json` (`{app_data_dir}/`) | Journal registry, active journal ID, `auto_key`, legacy `diary_dir` | Yes | No |
| `db_settings` table in `diary.db` | `require_all_auth` + HKDF-SHA256 MAC | Requires unlock | Yes (integrity-protected) |
| In-memory signals (`src/state/`) | Session state: dates, overlays, tags, auth state | Requires unlock | N/A |

Without a documented policy, contributors make inconsistent choices. The canonical bad example is `require_all_auth`: it originally shipped in `config.json` (plaintext, per-app-install, strippable without touching the DB), then had to be migrated to `db_settings` in schema v6. That migration required a new `migrate_require_all_auth_to_db` function and a deprecation shim in `JournalConfig`. The cost was real; the root cause was avoidable.

This ADR provides an unambiguous decision flowchart so the right location is chosen the first time.

## Decision flowchart

Use these questions in order. Stop at the first branch that matches.

```
Q1: Does this value need to survive a lock/unlock cycle?
    ├─ No  → IN-MEMORY SIGNAL (src/state/)
    └─ Yes → Q2

Q2: Is this value specific to one journal, or shared across all journals?
    ├─ Shared across all journals → Q3
    └─ Per-journal               → Q4

Q3: What kind of shared value is this?
    ├─ Part of the journal registry or routing
    │   (journal paths, active journal, auto_key)  → CONFIG.JSON
    └─ UI/UX preference
       (theme, font, toolbar layout, language)      → LOCALSTORAGE

    ⚠ Note: db_settings is always per-journal. A shared setting cannot go there.

Q4: Must this value be readable BEFORE the journal is unlocked?
    ├─ Yes → CONFIG.JSON (as a field on JournalConfig)
    └─ No  → Q5

Q5: Is this a security enforcement setting or integrity-critical?
    ├─ Yes → DB_SETTINGS with HKDF-SHA256 MAC
    │         Written via write_require_all_auth_mac on unlock.
    │         Fail-safe: absent or malformed MAC enforces the guard.
    └─ No  → DB_SETTINGS without MAC
```

## Decision summary table

| Criterion | Storage location |
|---|---|
| Needed only while unlocked, reset on lock | In-memory signal (`src/state/`) |
| Shared across journals, registry/routing data | `config.json` |
| Shared across journals, UI/UX preference | `localStorage` |
| Per-journal, needed before unlock | `config.json` field on `JournalConfig` |
| Per-journal, security-enforcement, integrity-critical | `db_settings` with HKDF-SHA256 MAC |
| Per-journal, non-security app setting | `db_settings` without MAC |

## Full inventory of current settings

### `localStorage`

**Key: `'preferences'`** — `Preferences` interface (14 fields), managed by `src/state/preferences.ts`:

| Field | Type | Default |
|---|---|---|
| `allowFutureEntries` | `boolean` | `false` |
| `firstDayOfWeek` | `number\|null` | `null` (system default) |
| `hideTitles` | `boolean` | `false` |
| `enableSpellcheck` | `boolean` | `true` |
| `escAction` | `'none'\|'quit'` | `'none'` |
| `autoLockEnabled` | `boolean` | `false` |
| `autoLockTimeout` | `number` (seconds) | `300` |
| `toolbarItems` | `ToolbarItem[]` (15 items, per-item enabled + order) | all enabled |
| `editorFontSize` | `number` (px, 12–24) | `16` |
| `editorFontFamily` | `string\|null` | `null` (system default) |
| `showEntryTimestamps` | `boolean` | `false` |
| `timestampFormat` | `'12h'\|'24h'` | `'12h'` |
| `timestampPrecision` | `'hm'\|'hms'` | `'hm'` |
| `language` | `string` | `'en'` |

**Key: `'theme-preference'`** — `'auto'|'light'|'dark'`, managed by `src/lib/theme.ts`.

**Key: `'theme-overrides'`** — JSON object of CSS token overrides per-theme, managed by `src/lib/theme-overrides.ts`.

**Key: `'feature-flags'`** — open `Record<string, boolean>` of runtime feature flags, managed by `src/state/feature-flags.ts`. Migration-free by design: unknown keys are dropped and absent flags fall back to defaults, so no `loadPreferences`-style migration block is ever needed. Not wiped by `resetPreferences` and not part of settings export (experimental flags are ephemeral, like the theme keys). See `docs/decisions/2026-06-feature-flags.md` (Tier 2).

### `config.json` (`{app_data_dir}/config.json`)

Managed by `src-tauri/src/config.rs`. The file contains an `AppConfig` struct:

| Field | Type | Purpose |
|---|---|---|
| `diary_dir` | `Option<String>` | Legacy single-journal path; kept for backward compat |
| `active_journal_id` | `Option<String>` | Which journal is currently selected |
| `journals` | `Option<Vec<JournalConfig>>` | Full journal registry |

Each `JournalConfig` entry:

| Field | Type | Purpose |
|---|---|---|
| `id` | `String` | 16-hex-char random ID |
| `name` | `String` | Display name |
| `path` | `String` | Directory containing `diary.db` |
| `auto_key` | `Option<String>` | Hex-encoded 32-byte device-bound key; `None` for password journals |
| `db_filename` | `Option<String>` | DB filename override; defaults to `"diary.db"` |
| `require_all_auth` | `Option<bool>` | **Deprecated** — migrated to `db_settings` in v6; kept for the migration window |

### `db_settings` table in `diary.db`

Key-value store introduced in schema v6. All reads go through `get_db_setting(conn, key)` in `queries.rs`.

| Key | Value type | Purpose |
|---|---|---|
| `require_all_auth` | `"true"` or `"false"` | Require all auth slots on unlock |
| `require_all_auth_mac` | hex-encoded 32-byte MAC | HKDF-SHA256 integrity check for the flag above |

### In-memory signals (`src/state/`)

All session state that is reset on lock via `resetSessionState()`. Includes:
- `auth.ts` — `authState`, `authMethods`
- `entries.ts` — `entryDates`, `isSaving`
- `journals.ts` — `journals`, `activeJournalId`, `isSwitching`
- `search.ts` — `searchQuery`, `searchResults`, `isSearching`
- `tags.ts` — `allTags`
- `ui.ts` — `selectedDate`, all overlay open states

## Why `require_all_auth` moved from `config.json` to `db_settings`

`require_all_auth` is a security enforcement flag: when set, **all** registered auth slots must be presented simultaneously to unlock the journal. It shipped in schema v5 as a `JournalConfig` field in `config.json`.

The problem: `config.json` is plaintext, readable without knowing the journal password, and stored separately from the database. An attacker with filesystem access could:

1. Edit `config.json` to set `require_all_auth: false` for the target journal.
2. Unlock the journal using only one valid auth method.
3. Gain full access, bypassing the multi-factor requirement entirely.

Moving the flag into `db_settings` inside `diary.db` removes the strippability problem: the setting now travels with the encrypted database. Tampering with the row does not help the attacker because the fail-safe in `verify_require_all_auth` treats an absent or malformed MAC as if the flag were `true` (most restrictive interpretation). The MAC is an HKDF-SHA256 digest derived from the master key with info string `"mini-diarium:require_all_auth:v1"`, so forging it requires knowing the master key — which is the secret the attacker is trying to bypass.

The migration (`migrate_require_all_auth_to_db` in `auth_core.rs`) runs once at first unlock after the v6 migration: it reads the `config.json` flag, writes it to `db_settings`, and clears the `config.json` field. The deprecated `require_all_auth` field on `JournalConfig` is kept with a `// TODO: deprecated` comment for the migration window.

**Lesson:** A security-enforcement setting must live inside the security boundary it protects (the encrypted DB), not outside it.

## Consequences

### What this buys

- First-time contributors have a deterministic flowchart. "Where does this setting go?" has an answer before any code is written.
- The inventory documents every current setting in one place, making audits and "reset all settings" features easier to implement correctly.
- The cautionary tale and the flowchart together prevent the class of mistake that produced the `require_all_auth` migration.

### What this costs

- The inventory in this document must be kept in sync with the code. A setting added without updating this ADR is a doc bug. The `Consequences` section of this ADR is load-bearing — treat it like a test.
- This ADR does not encode any automated enforcement; it relies on the contributor reading it. Future work could add a lint or checklist step.

## Open question: per-journal non-security UI preferences

The flowchart routes **per-journal, non-security** settings to `db_settings` without a MAC. No such settings exist yet. When the first one arises, two options are valid:

- **Option A — `db_settings`**: The setting travels with the journal, is encrypted at rest with all other DB content, and is trivially per-journal. Cost: inaccessible before unlock; requires a schema migration to add or rename keys.
- **Option B — `config.json` field on `JournalConfig`**: The setting is readable before unlock (useful for pre-auth UI decisions). Cost: plaintext on disk; not inside the encryption boundary.

The decision should be made at the time of the first real use case based on whether pre-unlock access is needed. **Do not silently put per-journal UI preferences in `localStorage`** — `localStorage` is shared across all journals, so the preference would not change when switching journals.

## Future reversibility

Every setting change that moves a value from one location to another requires a migration. Use `migrate_require_all_auth_to_db` in `auth_core.rs` as the reference pattern:

1. On the first unlock after a schema bump, check whether the setting already exists at the new location.
2. If not, read the legacy location, write to the new location, and clear the legacy location.
3. Keep the legacy field in the struct with a `// TODO: deprecated` comment for at least one release to support users who haven't upgraded yet.

Schema version bumps for `db_settings` changes must go through the normal migration path in `db/schema/` (bump `SCHEMA_VERSION` in `db/schema/mod.rs`, add a `migrate_vN_to_vN+1` function in `db/schema/migrations/`).

## References

- `src/state/preferences.ts` — `Preferences` interface and the `'preferences'` localStorage key.
- `src/lib/theme.ts` — `'theme-preference'` localStorage key management.
- `src/lib/theme-overrides.ts` — `'theme-overrides'` localStorage key management.
- `src/state/feature-flags.ts` — `'feature-flags'` localStorage key (migration-free runtime feature flags).
- `src-tauri/src/config.rs` — `JournalConfig`, `AppConfig`, all config.json helpers.
- `src-tauri/src/db/schema/migrations/` — `migrate_v5_to_v6` (adds `db_settings`); `src-tauri/src/db/schema/mod.rs` — `SCHEMA_VERSION`.
- `src-tauri/src/db/queries/db_settings.rs` — `get_db_setting`, `set_db_setting`, `verify_require_all_auth` (fail-safe checks MAC presence/well-formedness; `_master_key` param currently unused — does not recompute MAC at read time), `write_require_all_auth_mac` (HKDF-SHA256, info=`"mini-diarium:require_all_auth:v1"`).
- `src-tauri/src/commands/auth/auth_core.rs` — `migrate_require_all_auth_to_db` (reference migration pattern).
