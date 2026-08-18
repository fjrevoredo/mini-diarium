# Backup System Assessment and Redesign Options

**Date:** 2026-08-04 · **Scope:** the whole backup lifecycle — creation, retention, storage, discovery, verification, and restore — across `crates/mini-diarium-core/src/backup.rs`, the unlock path in `src-tauri/src/commands/auth/`, the schema migration path, the export/import round trip, and the user-facing documentation.
**Trigger:** the entry-content-loss regression fixed in 0.6.4 (30-07-2026) — `CHANGELOG.md`, "Entry content loss when navigating quickly". Users lost data; the recovery experience exposed that the backup system is a copy loop, not a product.
**Audience:** the maintainer, and coding agents implementing whichever option is chosen.
**Status:** assessment and options. No implementation, no TODO entries created, no commits. Every claim below was verified against the working tree at `2efb0716` (see [Verification log](#verification-log)).

---

## 1. Executive summary

The current system does exactly one thing: it `fs::copy`s `diary.db` into a sibling folder every time a journal unlocks, and deletes the oldest file when the count passes 30. That primitive is sound in isolation — the copies are ciphertext, no key material moves, no plaintext is ever written — and it is 84 lines of dependency-free, well-tested Rust. Everything around it is missing.

The three findings that matter most, in the order they hurt during the 0.6.2–0.6.4 incident:

1. **Retention has no time floor.** Thirty flat FIFO slots, one consumed per unlock, and no deduplication. A user who reopens the app repeatedly while trying to understand what happened destroys their own pre-incident history. This is not hypothetical: every affected user's backup set contained only the damaged state by the time it was inspected.
2. **There is no backup surface in the product.** Not one Tauri command in `generate_handler!` touches backups. The word "backup" appears in exactly one frontend string, and it is about custom fonts. Users do not know backups exist, cannot find them, cannot tell whether they are healthy, and cannot restore from them without file archaeology and shell commands.
3. **Snapshots are taken after the risky operation, not before.** The unlock-time backup runs *after* `open_database` has already executed and committed every pending schema migration. A destructive migration is therefore unrecoverable from the app's own backups.

The recommended direction is **Option A — First-class local snapshots** (Section 6.1): keep the "encrypted file copy" primitive (it is the right one, and it is the reason the current system is not worse than it is), replace the trigger model, retention policy, and write primitive, and put a real Backups panel in front of it with two restore granularities — whole-journal rollback and per-entry cherry-pick from inside a snapshot. Per-entry restore from a snapshot is what removes the "export to plaintext and re-import" step from the recovery path, which is currently the only way to salvage a single entry and which writes decrypted journal content to disk.

Entry-level revision history (Option B) is the right *second* milestone and the natural boundary for a premium tier, following the Standard Notes precedent (short history free, long history paid). A deduplicating snapshot repository (Option C) is rejected: it buys little over Option A for a single-file journal and spends the "Simple is Good" and "Boring Security" budget in the wrong place.

---

## 2. How the current system works

### 2.1 The primitive

`crates/mini-diarium-core/src/backup.rs`, 84 lines of logic plus tests:

| Function | Behavior |
|---|---|
| `create_backup(diary_path, backups_dir)` (`:14`) | `create_dir_all`, then `fs::copy` to `backup-%Y-%m-%d-%Hh%M.db` (`:22-32`) |
| `rotate_backups(backups_dir)` (`:39`) | Lists files matching `backup-*.db`, sorts lexicographically (equals chronological by filename design), deletes the oldest until 30 remain (`:60-73`) |
| `backup_and_rotate(...)` (`:80`) | The two in sequence |
| `MAX_BACKUPS` (`:10`) | `30`. Lowered from 50 in v0.4.6 (08-03-2026) |

No dependencies beyond `std::fs` and `chrono`. No `rusqlite`. No Tauri. It is the cleanest module in the backend, which is part of why it has never been revisited.

### 2.2 Where it is called

Exactly two call sites, both in the unlock path:

- `src-tauri/src/commands/auth/auth_core.rs:248` — after any password / key-file / all-methods unlock
- `src-tauri/src/commands/auth/auth_core.rs:523` — after a local-only (auto-key) unlock

Both are best-effort: a failure logs `warn!("Failed to create backup: {}", e)` and the unlock proceeds. Nothing else in the app ever creates a backup.

### 2.3 Where backups live

`src-tauri/src/lib.rs:187`:

```rust
let backups_dir = diary_dir.join("backups").join(stem);
```

So the real path is `{journal_dir}/backups/{db_filename_stem}/`, namespaced per database file since the "Open Existing Journal uses a file picker" change (v0.5.x). The path is recomputed on `switch_journal` (`auth_journals.rs:180`), `remove_journal` (`:105`), and `change_diary_directory` (`auth_directory.rs:62`).

### 2.4 What reads backups

One thing: the debug dump. `src-tauri/src/commands/debug.rs:378` (`read_backup_stats`) reports count, oldest, newest, and total bytes, alongside `MAX_BACKUPS`. That is the entire read side, and it is only reachable from Preferences → Advanced, which lives behind the unlock screen.

### 2.5 What the user is told

- `website/docs-src/09-backups.md` — accurate on rotation (30) and encryption, stale on path (says `backups/`, not `backups/{stem}/`), silent on restore.
- `docs/USER_GUIDE.md:341` — says **50** most recent. Stale since v0.4.6 lowered the constant, i.e. for about five months.
- `website/index.html:570` — the homepage feature card says the app keeps **"the last 5"**. Wrong by a factor of six, on the most-read page the project has.
- `README.md:127` — "Automatic backups: backup on unlock with rotation", unqualified.
- `docs/KNOWN_ISSUES.md:89` — asserts "Backups are taken at unlock time, before any writes occur in the new session". Not true; see [B-3](#b-3).

No document tells the user how to restore. There is no restore procedure written down anywhere in the repository.

---

## 3. Findings

Severity reflects impact on data safety and on the user's ability to recover, not implementation cost.

| ID | Sev | Area | Summary |
|---|---|---|---|
| [B-1](#b-1) | High | UX | No backup surface exists in the app: no command, no UI, no notification |
| [B-2](#b-2) | High | Retention | Flat 30-slot FIFO with no time floor and no dedup; panic-unlocks erase pre-incident history |
| [B-3](#b-3) | High | Ordering | The unlock backup runs *after* schema migrations have already committed |
| [B-4](#b-4) | High | Triggers | No snapshot before any destructive operation (`reset_diary`, directory move, auth-method removal) |
| [B-5](#b-5) | High | Restore | No restore path in the product; the documented workaround writes plaintext to disk and loses tags |
| [B-6](#b-6) | Med | UX | Inspecting a backup contaminates the backup set |
| [B-7](#b-7) | Med | Storage | No deduplication and no storage budget: 31× journal size, even for read-only sessions |
| [B-8](#b-8) | Med | Integrity | Non-atomic write, no fsync, no verification; a truncated copy counts as a valid backup |
| [B-9](#b-9) | Med | Recovery | Local-only journals: the wrapping key is not in the backup, and an ADR claims otherwise |
| [B-10](#b-10) | Med | Correctness | `fs::copy` is the wrong SQLite primitive; `VACUUM INTO` is one statement away |
| [B-11](#b-11) | Med | Security/UX | A password change or auth-method removal silently desynchronizes the backups |
| [B-12](#b-12) | Low | Naming | Minute-resolution filenames collide and overwrite silently |
| [B-13](#b-13) | Low | Lifecycle | Backups do not move with the journal |
| [B-14](#b-14) | Low | Observability | No sidecar metadata: nothing records what is inside a snapshot |
| [B-15](#b-15) | Low | Docs | Retention is published as 5, 30, and 50; three further claims are wrong or misleading |
| [B-16](#b-16) | Low | Storage | Backups multiply the cost of the cloud-sync setup the docs recommend |
| [B-17](#b-17) | Info | — | What is working and must be preserved |

---

### B-1: No backup surface exists in the app {#b-1}

**Files:** `src-tauri/src/lib.rs` (`generate_handler!` block), `src/i18n/locales/en.ts`

`generate_handler!` registers command groups for auth, entries, files, search, nav, stats, export, plugin, debug, menu, spellcheck, fonts, tags, and images. There is no backup group. Grepping the entire `src/` tree for "backup" returns a single hit — `en.ts:441`, a sentence about custom fonts increasing the size of your journal file *and backups*.

Consequences, all observed during the incident:

- Users did not know backups existed. The feature is advertised on the website and in the README but never surfaces in the running app.
- There is no "last backup" indicator, so a silently failing backup (the `warn!` path at `auth_core.rs:249`) is invisible. If `create_dir_all` or `fs::copy` has been failing for six months — a read-only journal directory, a full disk, a cloud-sync client holding a lock — the user finds out when they need the backup.
- Locating the folder requires knowing the journal path, then knowing to look for `backups/{stem}/`. The docs give the wrong path.

---

### B-2: Retention has no time floor {#b-2}

**Files:** `crates/mini-diarium-core/src/backup.rs:10,60-73`, `auth_core.rs:248`

The policy is: one snapshot per unlock, keep the newest 30, delete by filename order. Two properties combine badly.

**No dedup.** Opening a journal to read one entry and locking again produces a full snapshot identical to the previous one. Nothing compares content.

**No time dimension.** Retention is measured in *events*, not in *days*. The docs assume roughly one unlock per day and conclude "30 backups ≈ 30 days". That assumption breaks precisely when it matters. During a suspected data-loss event, the user's instinct is to open the journal repeatedly to check whether the entries are back. Combined with [B-12](#b-12) (minute-resolution filenames), the observed rate is up to one new snapshot per minute of investigation. **Thirty minutes of anxious checking overwrites the entire backup history with copies of the damaged database.**

This is what happened to the reporting users: by the time their backup sets were inspected, every one of the 30 files contained the post-damage state.

Any redesign must guarantee time depth independently of unlock frequency. This is the single most important change in the whole assessment.

---

### B-3: The unlock backup runs after migrations commit {#b-3}

**Files:** `src-tauri/src/commands/auth/auth_core.rs:172,248`, `crates/mini-diarium-core/src/db/schema/open.rs:33-35,112,119,169,171`

The unlock sequence is:

```
auth_core.rs:172   open_database(&db_path, password, &backups_dir)
                     └─ open.rs:33  open_v3_with_password(...)
                     └─ open.rs:34  apply_pending(&db)   ← runs & commits v3→v4…v12→v13
auth_core.rs:248   backup::backup_and_rotate(&db_path, &backups_dir)
```

The snapshot captures the database *after* every pending migration has been applied and committed. If a migration is faulty — the exact class of bug that most warrants a pre-flight snapshot — the app's own backups contain only migrated data.

Worse, the design *intended* otherwise and the wiring was never completed. `open_database`, `open_database_with_keypair`, and `open_database_auto` all take a `backups_dir` parameter. Only the legacy v1→v2 and v2→v3 paths use it (`open.rs:52,55`). For every modern path the parameter is explicitly discarded:

```rust
// open.rs:112 (keypair) and open.rs:171 (auto)
let _ = backups_dir;
// open.rs:179 (password, v3+)
fn open_v3_with_password(conn: Connection, password: String, _backups_dir: &Path)
```

This was a deliberate decision, and the reasoning is stated in the code (`migrations/v4_to_v5.rs:13-17`): the migration runs in a single transaction, so a crash rolls it back and leaves the database unchanged — in explicit contrast to `migrate_v2_to_v3`, which re-encrypts every entry non-atomically and therefore *does* take a backup first. The `CHANGELOG.md` "Backend assessment follow-up (Task 71)" entry records the same conclusion for `v3→v4` and `v4→v5`.

**On its own terms that argument is correct**, and it holds for the eight further migrations up to v13, which are all additive `ALTER TABLE … ADD COLUMN` statements. Transactional atomicity is a complete defence against a *crash* mid-migration — `run_migration_transaction` wraps each one in `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` (`migrations/mod.rs:45-72`).

**It is not a defence against a migration that successfully commits the wrong thing**, which is the failure mode a pre-migration snapshot exists for, and the one this project just demonstrated it is capable of shipping. `migrate_v4_to_v5` is the shape where that matters most (`v4_to_v5.rs:27-40`):

```sql
CREATE TABLE entries_new (...);
INSERT INTO entries_new (date, title_encrypted, text_encrypted, ...) SELECT ... FROM entries;
DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;
```

A projection-based rebuild over every diary entry, with the source table dropped in the same transaction. A wrong column list commits cleanly and the original is already gone. That migration is correct today — `entry_metadata_encrypted` only arrives at v8→v9, so the v4 projection is complete — but nothing structural guaranteed it, and the next rebuild-shaped migration inherits the same absence of a net.

---

### B-4: No snapshot before destructive operations {#b-4}

**Files:** `auth_core.rs:390-407` (`reset_diary`), `auth_directory.rs`, `auth_slots.rs:194`, `db/queries/entries/delete.rs:21`, `commands/plugin.rs:29-75`

`reset_diary` locks the journal and calls `std::fs::remove_file(&db_path)` with no snapshot first (`auth_core.rs:403`). Existing backups survive because they live in a sibling directory, but this is luck, not design, and the user is not told that a recovery path still exists.

Nothing takes a safety snapshot before:

- `reset_diary` — deletes the database file
- `change_diary_directory` — physically moves `diary.db` to a new location
- `remove_auth_method` (`auth_slots.rs:194`) — can permanently remove the only usable credential
- `delete_entry` / `delete_entry_if_empty` — `DELETE FROM entries WHERE id = ?1` (`delete.rs:21`); no trash, no tombstone, no undo
- `run_import_plugin` (`commands/plugin.rs:29-75`) — parses the file, then calls `import_entries` straight into the unlocked live journal. A wrong file or a wrong format merges irreversibly
- `change_password` — see [B-11](#b-11)

The general principle every mature local-first app follows (KeePassXC's pre-save backup, Obsidian's pre-write snapshot) is: snapshot *before* the risky write, not on a schedule that happens to be nearby.

---

### B-5: There is no restore path {#b-5}

**Files:** `crates/mini-diarium-core/src/export/json.rs:38`, `crates/mini-diarium-core/src/import/minidiary.rs:45-54`, `src-tauri/src/commands/export.rs:48,83,96`, `website/docs-src/09-backups.md`

No command restores anything. The documentation does not describe a restore procedure. The recovery path that was actually used during the incident, walked by hand with each affected user, is:

1. Find `{journal_dir}/backups/{stem}/` in a file manager.
2. Guess which `backup-YYYY-MM-DD-HHhMM.db` predates the damage — nothing records what any of them contains ([B-14](#b-14)).
3. Copy it somewhere, rename it, register it as a second journal, unlock it — which registers it in `config.json` and starts backing *it* up ([B-6](#b-6)).
4. Either swap the file wholesale (losing every entry written since that snapshot) or export to JSON/Markdown and re-import.

Step 4 has two hard problems.

**The export route writes plaintext to disk.** `export_json` and `export_markdown` `std::fs::write` fully decrypted journal content to a user-chosen path (`commands/export.rs:48,83`), and the Markdown exporter additionally writes decoded image files into an assets directory (`:96`). For an app whose central promise is "plaintext never touches disk", telling a user in distress that the recovery procedure is "decrypt your journal to a file" is the wrong answer. It is also the answer they will reach for, because it is the only one available.

**The JSON round trip is lossy.** `export_entries_to_json` emits a `tags` array per entry (`json.rs:38`). The importer's entry struct has no `tags` field:

```rust
// import/minidiary.rs:45-54
struct MiniDiariumEntry {
    pub id: i64, pub date: String, pub title: String, pub text: String,
    #[serde(rename = "dateUpdated", default)] pub date_updated: String,
    #[serde(default)] pub metadata: Option<EntryMetadata>,
}
```

What survives an export → import round trip: entry dates, titles, bodies, `dateUpdated`, entry metadata, and **images** (the import path normalizes `data:` URLs back into the content-addressed store via `insert_entry_with_images`). What does not: **all tags**, and the `locked` flag (schema v13), which is absent from the export format and hardcoded to `false` on the import path. Entries also come back with **new IDs**, since import inserts fresh `AUTOINCREMENT` rows and ignores the exported `id`. A user who round-trips their journal to recover one entry silently loses their entire tag graph.

**What is actually needed** is per-entry restore *from inside a snapshot*, in-app, with the decrypted content never leaving the process. Since a backup is a complete database encrypted with the same master key, the app can open it read-only, list its entries, diff against the live journal, and copy selected entries across — without a single byte of plaintext touching the filesystem. That capability does not exist today and is the highest-value single feature in this whole assessment.

---

### B-6: Inspecting a backup contaminates the backup set {#b-6}

**Files:** `src-tauri/src/commands/auth/auth_journals.rs:29-75` (`add_journal`), `auth_core.rs:248`

To look inside a backup, the user must register it as a journal ("Open Existing Journal" takes a `.db` file picker). Doing so:

- writes a permanent `JournalConfig` entry into `config.json`, which the user must later clean up manually;
- creates `{backup_location}/backups/{backup_stem}/` and starts producing backups *of the backup*;
- consumes a rotation slot in the *original* journal every time the user switches back to it to compare.

The mental model the user needs during recovery — "let me look at yesterday's copy" — is a read-only inspection. The app only offers "adopt this file as a live journal".

---

### B-7: No deduplication and no storage budget {#b-7}

**Files:** `backup.rs:32`

Each snapshot is a full copy of the database, including the `images` BLOB store and `custom_fonts` BLOBs. Nothing compares against the previous snapshot, so unchanged sessions still produce full copies. Nothing caps total size.

For a text-only journal this is negligible: a few megabytes × 31. For a journal with embedded images — a documented, supported feature — the database is routinely hundreds of megabytes, so the backup folder is 30× that, sitting in the user's Documents or a cloud-synced folder, with no in-app indication that it exists ([B-1](#b-1)) let alone how big it is.

This directly conflicts with the retention fix in [B-2](#b-2): naively extending time depth makes the storage problem worse. Deduplication is what makes both solvable at once — an unchanged database needs no new bytes.

---

### B-8: Non-atomic write, no verification {#b-8}

**Files:** `backup.rs:32`, `backup.rs:49-56`

`fs::copy` writes directly to the destination filename. It is not atomic and is not fsynced. An interrupted copy — power loss, disk full, the process being killed, an AV scanner holding a handle (a documented reality on Windows in this repo, see the fingerprinting script's retry logic) — leaves a truncated file *named* `backup-*.db`. That file:

- matches the rotation filter (`:54`) and counts toward the 30-file limit,
- can therefore evict a good snapshot,
- is indistinguishable from a valid backup in the folder listing, in the debug dump's `backup_count`, and to the user.

Nothing ever opens a backup to confirm it is a valid SQLite file, that its schema version is readable, or that the master key still unwraps. An unverified backup is a hypothesis, not a backup.

The standard fix is write-to-temp + fsync + atomic rename, plus a post-write open-and-check.

---

### B-9: Local-only journals do not back up their key {#b-9}

**Files:** `crates/mini-diarium-core/src/config.rs:7-18`, `src-tauri/src/commands/auth/mod.rs:12-14`, `docs/decisions/2026-04-passwordless-journal.md:32`

A passwordless (local-only) journal wraps its master key with a random 32-byte `auto_key`, stored hex-encoded in `JournalConfig.auto_key` inside `{app_data_dir}/config.json`. `DiaryState.app_data_dir` is documented as "always the fixed system location" and never follows the journal directory.

The backups directory contains only `diary.db` copies. **It never contains `config.json`.** A user who copies their journal folder (including `backups/`) to a new machine, or whose app-data directory is lost to an OS reinstall or profile reset, has a folder full of files that nothing on earth can decrypt.

The passwordless ADR states the opposite:

> `docs/decisions/2026-04-passwordless-journal.md:32` — "Backups (copy of the diary directory) remain self-contained — you back up `diary.db` and `config.json` together."

That is true of a *user-performed* backup of both locations. It is not true of the backups the application itself creates, and the ADR reads as though it is. Either the backup system must include the wrapping key material for auto-key journals (with the obvious security implication that the backup then becomes self-decrypting, which must be a documented, deliberate choice), or the discrepancy must be corrected in the ADR and surfaced prominently to local-only users.

---

### B-10: `fs::copy` is the wrong SQLite primitive {#b-10}

**Files:** `backup.rs:26-32`, `docs/KNOWN_ISSUES.md` KI-9

The code comment is honest about this and already documents the exit:

> `fs::copy` on an open SQLite file is safe under the default journal mode (DELETE) … If WAL mode were ever adopted this approach could produce an inconsistent backup; prefer `sqlite3_backup_init` / the Online Backup API in that case.

The reasoning mostly holds today: no `journal_mode` pragma is set anywhere in the workspace, so the database is in rollback-journal mode, and the backup is taken before the *user's* session writes begin. Note that it is **not** taken before all writes — pending migrations have already run and committed by then ([B-3](#b-3)), which is precisely what `docs/KNOWN_ISSUES.md:89` claims does not happen. The arrangement is also fragile:

- It silently couples the backup module's correctness to a pragma set nowhere, documented in a code comment two crates away. Anyone enabling WAL for write performance breaks backups without a failing test.
- It forecloses the obvious future trigger improvements — a snapshot on lock, on idle, or before a destructive op ([B-4](#b-4)) — all of which happen while the connection is live and writes are possible.

SQLite's own guidance is the Online Backup API for routine backups, or `VACUUM INTO` when compaction is also wanted. `VACUUM INTO 'path'` is a single statement, available directly through the existing `rusqlite` connection, produces a defragmented and typically smaller file, and is correct regardless of journal mode. For a journal database that accumulates deleted image BLOBs, the compaction is a real secondary win.

---

### B-11: Password changes silently desynchronize the backups {#b-11}

**Files:** `auth_core.rs:350` (`change_password`), `auth_slots.rs:194` (`remove_auth_method`), `backup.rs:32`

`change_password` is O(1) by design: it re-wraps the master key in the live `auth_slots` row and does not re-encrypt entries. A backup is a byte copy of the database *including* `auth_slots`, so every pre-existing snapshot still carries the **old** wrapped key.

Two consequences, neither surfaced anywhere:

**Usability.** After changing their password, a user's own backups require the previous password. Nothing records which credential a given snapshot needs. A user who changed their password three months ago and reaches for a four-month-old backup will conclude the file is corrupt.

**Security.** Removing an authentication method — the documented response to a key file being lost or a password being compromised — does not revoke it in the 30 existing backups. Anyone with filesystem access and the removed credential can open any snapshot taken before the removal. This is inherent to snapshot-of-ciphertext backups and is not a defect in itself, but it is currently undocumented, and `remove_auth_method` gives no warning. `PHILOSOPHY.md`'s "Honest threat documentation" non-negotiable applies directly.

---

### B-12: Minute-resolution filenames collide {#b-12}

**Files:** `backup.rs:22-24,32`

`backup-%Y-%m-%d-%Hh%M.db` gives one distinct filename per minute. `fs::copy` to an existing path overwrites it. Two unlocks in the same minute silently replace the earlier snapshot rather than creating a second one, so the number of backups can be lower than the number of unlocks with no indication. Combined with [B-2](#b-2), the practical worst case is one rotation slot consumed per minute.

---

### B-13: Backups do not move with the journal {#b-13}

**Files:** `auth_directory.rs:62`, `website/docs-src/09-backups.md:34-36`

`change_diary_directory` physically moves `diary.db` and repoints `backups_dir` at the new location. Existing backups stay behind. This is documented in the website docs but not surfaced in the UI at the moment of the move, which is the only moment it matters. A user who moves their journal and then deletes the old folder has silently destroyed their entire backup history.

---

### B-14: No sidecar metadata {#b-14}

A snapshot's filename is its only metadata. Nothing records:

- entry count, or the date range of entries inside
- the app version and schema version that produced it
- what triggered it (unlock, manual, pre-migration, pre-restore)
- file size, or a content hash for dedup and integrity
- which authentication slot types it contains (relevant to [B-11](#b-11))

This is what made incident triage slow. Answering "which of these 30 files has your data" required opening each one. A small sidecar — a `manifest.json` in the backups directory, or a `.meta.json` next to each snapshot — makes the Backups panel of [B-1](#b-1) possible without opening anything, and makes "your newest backup contains 4 entries but the one from 12 days ago contains 431" visible at a glance.

Note the privacy constraint: the manifest sits next to the encrypted database and must contain no entry content, no titles, no tag names. Counts, dates, sizes, and versions are the correct level of detail — the same bar the debug dump already meets and enforces with a test.

---

### B-15: Documentation drift {#b-15}

| Location | Says | Actual |
|---|---|---|
| `website/index.html:570` | "keeping the last **5** automatically" | 30 (`backup.rs:10`). Wrong by 6×, on the homepage |
| `docs/USER_GUIDE.md:341` | "the **50** most recent backups" | 30. Stale since v0.4.6 |
| `docs/USER_GUIDE.md:327`, `website/docs-src/09-backups.md:16` | `{journal_dir}/backups/` | `{journal_dir}/backups/{db_stem}/` (`lib.rs:187`) |
| `docs/KNOWN_ISSUES.md:89` | "Backups are taken at unlock time, **before any writes occur** in the new session" | Migrations write and commit first ([B-3](#b-3)) |
| `docs/decisions/2026-04-passwordless-journal.md:32` | backups are self-contained | see [B-9](#b-9) |
| `README.md:127` | "Automatic backups: backup on unlock with rotation" | true but unqualified; no mention of retention or restore |

Three separate numbers are in circulation for one constant — 5 on the homepage, 30 in the docs site, 50 in the user guide. That, on its own, is a fair summary of how much attention this subsystem has had.

Per the root `CLAUDE.md` rule that `website/docs-src/` is the authoritative user reference, whichever option is implemented must land with `09-backups.md` rewritten in the same task, and the other five locations corrected with it.

---

### B-16: Backups multiply the cost of the recommended cloud-sync setup {#b-16}

**Files:** `website/docs-src/09-backups.md:38-42`, `src-tauri/src/sync_detect.rs`

The documentation actively recommends placing the journal directory inside Dropbox/OneDrive/iCloud Drive to get an off-site copy, and the debug dump ships a `sync_detect` module precisely because sync clients are a known source of trouble here. The `backups/{stem}/` folder sits *inside* that synced directory, so:

- every unlock uploads a fresh full copy of the database, 30 of which are retained remotely as well as locally — 31× the storage and, for an image-heavy journal, potentially gigabytes of upload per week for a user who changed one paragraph;
- there is no way to exclude backups from sync without moving the journal out of the synced folder entirely, which forfeits the off-site copy the docs recommended in the first place;
- a sync client holding a handle on `diary.db` mid-copy is a plausible trigger for the truncated-snapshot case in [B-8](#b-8), on exactly the platform (Windows) where the repo already documents AV/indexer handle contention.

Deduplication ([B-7](#b-7)) fixes most of this by itself: an unchanged database produces no new file, so a quiet week costs nothing to sync. Worth stating explicitly as a design goal, because it is the difference between "put your journal in Dropbox" being good advice and being expensive advice.

---

### B-17: What is working, and must be preserved {#b-17}

Not everything here is broken. These properties are load-bearing and any redesign must keep them:

- **Backups are ciphertext by construction.** A snapshot is a byte copy of an already-encrypted database. There is no separate backup key, no re-encryption step, no window in which plaintext exists. This is the single best property of the current design and the reason a rewrite should stay in the "copy the encrypted file" family rather than inventing a backup format.
- **Zero key handling.** `backup.rs` never sees a key, a password, or a decrypted byte. Its entire dependency surface is `std::fs` and `chrono`. That is why it has never been a source of security defects.
- **Failure is non-fatal.** A failed backup logs and lets the unlock proceed (`auth_core.rs:248-250`). Correct: the user must never be locked out of their journal because a disk was full.
- **Rotation is conservative.** Only `backup-*.db` is ever considered for deletion (`:49-56`); anything else the user puts in the folder is untouched. The debug dump's `backup_count` was corrected in TODO-0090 to use the same filter.
- **Chronological order is derived from filenames, not mtime.** Immune to cloud-sync clients and file managers rewriting modification times — a real hazard given the documented Dropbox/OneDrive use case.
- **The module is Tauri-free and filesystem-only**, so it is trivially testable and already sits in `mini-diarium-core` on the right side of the open-core split.

---

## 4. Prior art

### 4.1 How comparable products solve this

| Product | Model | Trigger | Retention | Restore UX | Notes |
|---|---|---|---|---|---|
| **Obsidian** (File recovery core plugin) | Full per-file snapshots | Every ~5 min per changed file | 7 days, both intervals configurable | Command palette → "Open local history" → per-file version list, restore in place | Snapshots stored in **global settings, outside the vault**, deliberately, so vault-level loss does not take the snapshots with it. Explicitly documented as "not a complete backup solution" |
| **Joplin** (revision service) | Per-note revisions in the same database | New revision when a note has had none for 10 min, or was recently modified but had no revision for 7 days | 90 days default (`revisionService.oldNoteInterval`) | Note → history sidebar, preview, restore | Revisions sync across devices, which makes retention effectively global: the *minimum* setting across devices wins |
| **Standard Notes** | Per-note revision history, encrypted | Continuous | **3 days free, unlimited on paid plans** | In-note history browser with preview and one-click restore | The clearest precedent for the open-core split: history depth is the paid axis, not history existence. Also ships a nightly encrypted email backup |
| **Day One** | Sync-based, plus export | Continuous (sync); manual (JSON/text export) | Service-side | Restore from sync; exports are manual re-import | Notably: **only sync backups are encrypted; text and JSON exports are not**. Same plaintext-export hazard as [B-5](#b-5), acknowledged in their docs |
| **KeePassXC** | Pre-save copy of the database file | **Before every save** | Configurable destination with `{DB_FILENAME}`/`{TIME}` placeholders | Manual file swap | Closest structural analogue to Mini Diarium: single encrypted file, local-first, no server. Its trigger is the operation, not the session |
| **Apple Time Machine** | Snapshot chain | Hourly | GFS thinning: hourly for 24h, daily for a month, weekly until disk full | Browse-in-time UI, restore file or whole system | The reference implementation of "time depth survives event frequency", and of a browse UI over snapshots |

### 4.2 What the pattern says

Three observations run across all six.

**Nobody triggers only on session start.** Obsidian and Joplin trigger on *edit*, KeePassXC on *save*, Time Machine on a *clock*. Mini Diarium is alone in triggering on unlock, which is the one moment that correlates with neither risk nor change. It is also the moment a user in distress generates most frequently ([B-2](#b-2)).

**Everyone separates "undo" from "disaster recovery".** Obsidian ships File recovery *and* tells you to back up separately. Joplin ships revisions *and* sync. Standard Notes ships revisions *and* nightly encrypted email backups. These are two different products solving two different failure modes: fine-grained recovery of *this note I just broke*, versus recovery of *the whole store*. Mini Diarium has only the second layer, implemented badly, and is trying to make it serve the first.

**Restore is always in-app and always granular.** Not one of them asks the user to find a file, swap it, and lose everything since. Obsidian, Joplin, and Standard Notes all restore a single note from a version list. That is the shape of [B-5](#b-5)'s fix.

### 4.3 General backup practice

Standard practice worth importing, with the local-first, single-machine, no-network constraints applied:

- **Tiered / GFS retention** (grandfather-father-son). Keep many recent snapshots, thinning to fewer as they age: typically dailies for 7–14 days, weeklies for 4–6 weeks, monthlies beyond. Time Machine is the consumer-facing instance. This is the direct answer to [B-2](#b-2): it guarantees depth regardless of how many snapshots are taken.
- **3-2-1** (three copies, two media, one off-site). The core cannot satisfy this without network access, and should not try. What it *can* do is make the local layer trustworthy and make it easy for the user to satisfy the rest — which is exactly the honest framing for the premium tier boundary (Section 7).
- **A backup is not a backup until it has been restored.** Verification (open it, check the schema, check the key unwraps) and a low-friction restore rehearsal are the difference between a backup system and a copy loop. See [B-8](#b-8).
- **Immutability / append-only** protects against the failure mode where the backup process itself propagates the damage. In a local single-user app this reduces to: never let routine activity delete the deepest snapshot, and never overwrite a snapshot in place ([B-12](#b-12)).
- **Snapshot before the risky write, not on a schedule.** KeePassXC's pre-save copy, and every database migration tool's pre-migration dump. See [B-3](#b-3), [B-4](#b-4).
- **Observability.** "When did the last backup succeed, how big is the set, is it healthy" is a first-class part of every backup product and entirely absent here ([B-1](#b-1)).
- **SQLite specifics.** Use the Online Backup API or `VACUUM INTO`, not a file copy; both handle locking and journal/WAL contents correctly, and the source is only read-locked while being read, so a live database stays usable ([B-10](#b-10)).

---

## 5. Design constraints

Any option must satisfy all of these. They are drawn from `PHILOSOPHY.md`, the five non-negotiables, and `docs/OPEN_CORE_STRATEGY.md`.

1. **No network, ever, in the core.** Off-device backup is not a core feature. It may be a + feature.
2. **No plaintext on disk.** This disqualifies "export to JSON as the recovery path" as the *primary* answer, and it means per-entry restore must happen in-process.
3. **No custom cryptography.** Reuse the existing master key and the existing encrypted-row format. Do not invent a backup container format with its own crypto.
4. **No feature gating in the core.** Per `OPEN_CORE_STRATEGY.md` §11, the open core must be fully functional standalone. The free backup story has to be genuinely good, not a teaser.
5. **Simple is Good.** `backup.rs` is currently 84 lines of logic over `std::fs`, `chrono`, and `log`. A tenfold increase needs to buy a tenfold improvement in outcomes.
6. **Portability of the mechanism.** `OPEN_CORE_STRATEGY.md` §8 already flags `backup.rs` as "desktop-flavored" — filesystem-shaped code a hosted or browser tier would replace. Keep the *policy* (which snapshots to keep, when to take one) pure and testable, and the *filesystem access* behind a thin boundary, so the policy is reusable and the storage is swappable.
7. **Honest documentation.** Whatever ships, `website/docs-src/09-backups.md` states exactly what is protected and what is not, including [B-9](#b-9) and [B-11](#b-11).

---

## 6. Three options

### 6.1 Option A — First-class local snapshots {#option-a}

*Keep the encrypted-file-copy primitive. Replace the trigger model, the retention policy, and the write primitive. Put a real UI in front of it, with two restore granularities.*

**Storage.** Still one encrypted database file per snapshot, in `{journal_dir}/backups/{stem}/`, plus a `manifest.json` sidecar recording per-snapshot metadata (created-at, trigger, entry count, entry date range, schema version, app version, byte size, content hash, auth-slot types). No entry content, titles, or tag names in the manifest — the same privacy bar the debug dump already enforces with a test.

**Write primitive.** `VACUUM INTO` through the live connection, into a temp name, fsync, atomic rename, then reopen the result and verify (valid SQLite, readable `schema_version`, master key unwraps). A snapshot that fails verification is deleted and logged, never counted. Fixes [B-8](#b-8), [B-10](#b-10).

**Triggers.** Replace "on unlock" with:
- **before** applying any pending schema migration (fixes [B-3](#b-3) — this alone would have made the migration class of incident recoverable);
- **before** every destructive operation: `reset_diary`, journal directory move, auth-method removal, import, and restore itself (fixes [B-4](#b-4));
- **on lock / on app exit, only if the content hash changed** since the last snapshot (fixes [B-7](#b-7) and most of [B-2](#b-2) — a read-only session produces nothing);
- **manually**, from the Backups panel, with an optional user label;
- **at most one automatic snapshot per configurable interval** (default 1 hour), so a busy day cannot flood the set.

**Retention.** Tiered, time-guaranteed, GFS-shaped. Illustrative default: keep the last 10 snapshots regardless of age, plus one per day for 14 days, one per week for 8 weeks, one per month for 12 months. Deduplication means unchanged periods cost nothing. Crucially, **the oldest tier is never evicted by new activity** — no amount of panic-unlocking can consume the 3-month-old snapshot. Fixes [B-2](#b-2). A storage budget (default e.g. 2 GB or 3× journal size, whichever is larger) thins the newest tiers first when exceeded, and the panel says so.

**Implementation note on dedup.** "Has the journal changed" should not be answered by hashing a 500 MB file on every lock. Cheapest correct approach: keep a monotonic change counter in `db_settings`, bumped by the same write paths that already touch `date_updated`, and record it in each snapshot's manifest entry — an integer comparison, no I/O. Hashing (size + content hash) then serves integrity verification of the written snapshot, not change detection. This detail matters: getting it wrong turns the storage fix into a performance regression on the lock path.

**UI — the Backups panel** (Preferences → a new Backups tab, plus an entry point from the unlock screen so it is reachable when the journal will not open — the same pre-auth entry point TODO-0094 already needs for the debug dump, and worth building once for both):
- list of snapshots with date, age, trigger, entry count, size, and health (verified / unverified / failed);
- last-backup-succeeded indicator, and a visible warning when the last N attempts failed (fixes the silent-failure half of [B-1](#b-1));
- "Back up now", "Reveal in folder", "Delete", "Verify";
- **Inspect** — opens a snapshot read-only, in-process, without registering it as a journal (fixes [B-6](#b-6));
- **Restore whole journal** — takes a safety snapshot of the current state first, then swaps, then reopens;
- **Restore selected entries** — inside Inspect, list the snapshot's entries side by side with the live journal, flag entries that are missing or shorter in the live journal, and copy selected ones across. Plaintext never leaves the process. This is the fix for [B-5](#b-5) and the answer to "users should be able to easily restore entries from a backup".

**Also in scope:** offer to move the backups folder when the journal moves ([B-13](#b-13)); include the `auto_key` question for local-only journals as an explicit, documented decision ([B-9](#b-9)); warn on password change and auth-method removal that existing snapshots keep the old credential ([B-11](#b-11)); second-resolution filenames ([B-12](#b-12)); rewrite `09-backups.md` and fix `USER_GUIDE.md` ([B-15](#b-15)).

**Pros**
- Fixes every High finding and all but one Medium.
- Keeps the property that makes the current system safe: snapshots are ciphertext, no key handling, no new crypto, no new format. Non-negotiables 2 and 3 are satisfied by construction.
- Restore is in-app at both granularities, and no recovery path requires writing plaintext to disk.
- Retention policy is pure logic over a snapshot list — trivially unit-testable, and reusable by a browser tier with a different storage backend (constraint 6).
- Protects against whole-file failure modes (corruption, bad migration, accidental delete, disk error), which entry-level history cannot.
- Deduplication makes deeper history *cheaper* than the current flat 30, not more expensive — a plausible net storage reduction for most users.

**Cons**
- Largest UI surface of the three options: a new Preferences tab, an inspect mode, a two-pane entry restore view, plus localization into all shipped locales.
- Restore-whole-journal is a genuinely dangerous operation and needs careful design (safety snapshot, explicit confirmation, correct behavior when the snapshot needs an older password per [B-11](#b-11)).
- Granularity floor is the snapshot interval. It cannot recover "the paragraph I deleted twenty minutes ago" — only entry-level state as of the last snapshot.
- Inspect mode means holding two open database connections with two potentially different keys. Contained, but it touches the unlock path, which is the most security-sensitive code in the app.
- `backup.rs` goes from ~84 lines to plausibly 600–900 across a few modules. Real, but justified, and the policy/IO split keeps each piece small.

---

### 6.2 Option B — In-journal entry history and trash {#option-b}

*Add versioning inside the encrypted database. Every entry save writes an encrypted prior version; deletes go to a trash instead of vanishing. The file-copy layer stays as-is (or gets only the cheap fixes) and becomes purely disaster recovery.*

**Storage.** New schema version: `entry_revisions (id, entry_id, date, title_enc, text_enc, preview_enc, word_count, created_at, reason)` and a soft-delete column or `entries_trash` table. Reuses the existing master key and the existing `mini_diarium_crypto::format` row codec — no new crypto (constraint 3).

**Write path.** `update_entry` writes the *previous* row into `entry_revisions` before overwriting, subject to a coalescing rule in the Joplin style (no new revision if one was written for this entry in the last N minutes). `delete_entry` marks trashed rather than deleting; a purge job removes trashed entries after a retention window. Retention: keep revisions for D days (default 30–90), plus a per-entry cap.

**UI.** A history sidebar in the editor: version list with timestamps, preview, diff against current, restore. A Trash view listing deleted entries with restore and permanent-delete.

**Pros**
- Directly targets the *observed* incident class. The 0.6.2 bug overwrote entry bodies through the normal save path, so every damaged entry's prior body would have been sitting in `entry_revisions`, recoverable per entry in two clicks with no file archaeology at all.
- Finest possible granularity: minutes, not sessions. Recovers "I broke this entry an hour ago" — the everyday case that snapshots structurally cannot serve.
- Restore is inherently in-app and per-entry: never any plaintext on disk, no lossy round trip, no tag loss.
- Revisions are encrypted with the same key in the same file — no new key management, no new file format, no new discovery problem, and it travels with the journal automatically (fixes the [B-13](#b-13) class by construction).
- Maps cleanly onto the clearest premium precedent in the space: short history free, long history paid (Standard Notes).
- Aligns with the strongest prior art. Obsidian, Joplin, and Standard Notes all made this their primary recovery mechanism.

**Cons**
- **Does not protect the file.** Corruption, a bad migration, an accidental delete, a disk failure, or a `reset_diary` takes the revisions with it. It is an *undo* layer, not a backup, and it leaves every High finding except [B-5](#b-5) untouched. Shipping only this while leaving `backup.rs` as-is would be a marketing problem as much as an engineering one.
- Grows the live database, on the hot path. Every save writes a second encrypted copy of the body. For image-heavy entries (base64 in the body, resolved to `image-id://` references before storage — so revisions store references, not image bytes, which mitigates but does not eliminate this) it still meaningfully increases write volume and file size.
- A schema migration on the `entries` write path — the exact area that just produced a data-loss incident. Needs unusually careful review and, ironically, a working pre-migration snapshot ([B-3](#b-3)) before it should ship.
- The coalescing heuristic is fiddly to get right and easy to get subtly wrong (Joplin has open issues about revisions not being created and not being pruned). It is a source of "why is my history empty" bug reports.
- Purge is a new destructive background process operating on user data. It must be conservative and observable.

---

### 6.3 Option C — Deduplicating snapshot repository {#option-c}

*A small content-addressed backup engine: chunk the database, store encrypted chunks in an append-only repository, snapshots are manifests referencing chunks. Restic/Borg, scoped down.*

**Storage.** `{journal_dir}/backups/{stem}/repo/` containing content-addressed encrypted chunks plus per-snapshot manifests. Because SQLite pages change sparsely, consecutive snapshots share the vast majority of their chunks. Retention thinning is manifest deletion plus chunk garbage collection. Restore reassembles a database file from a manifest.

**Pros**
- Best storage efficiency by a wide margin. Hundreds of snapshots of a 500 MB image-heavy journal could cost a small multiple of the journal size rather than hundreds of times it.
- Makes very deep history (a year of daily snapshots) genuinely cheap, which is the strongest possible answer to [B-2](#b-2).
- Content-addressing gives integrity verification for free: a chunk's hash is its name.
- Append-only structure is naturally resistant to a damaged live database propagating into the archive.
- Would be a genuinely differentiated feature; nothing in this product category ships it.

**Cons**
- **Directly conflicts with two philosophy principles.** "Boring Security": a bespoke chunked encrypted container is a new format with its own crypto envelope, nonce management, and integrity story, however carefully assembled from standard primitives. "Simple is Good": this is the largest, most stateful, most failure-mode-rich subsystem in the app, in service of a feature no user has asked for.
- **Breaks the property that makes today's backups trustworthy.** Right now a backup is *a Mini Diarium database*. Any user, any SQLite tool, and any future version of the app can open it. A chunk repository is readable only by the exact code that wrote it. That is vendor lock-in of the recovery path, in an app whose stated non-negotiables include "if Mini Diarium becomes unmaintained, users can decrypt and migrate with standard tools". Restore then depends on the very software that may be the thing that failed.
- Garbage collection over a chunk store is a class of bug that silently deletes data. It is precisely the wrong risk to take on in the aftermath of a data-loss incident.
- Solves a problem the product does not really have. The storage pressure in [B-7](#b-7) comes from *no dedup at all*; whole-file content-hash dedup (Option A) captures most of the benefit for a fraction of the complexity. Sub-file chunking only pays off when snapshots are both frequent and huge.
- Largest effort by far, with the least user-visible benefit per unit of work: it improves an axis (bytes on disk) that no affected user complained about, while the axes they did complain about (can't find it, can't read it, can't restore from it) need Option A's work anyway.

---

## 7. Recommendation

**Ship Option A. Sequence Option B behind it. Reject Option C.**

### Rationale

**Option A is the only one that addresses the actual failure.** Re-reading the incident: users lost entries, could not tell whether backups existed, could not find them, could not tell which one had their data, could not open one without making things worse, and had no restore path that did not involve either losing recent work or decrypting their journal to a file. Exactly one of those six problems is a versioning problem. The other five are backup-lifecycle and product-surface problems, and Option A is what fixes them.

**Option A's retention change is the highest-value single item in this document.** Time-guaranteed tiered retention plus content-hash dedup means the specific mechanism that destroyed these users' recovery data — anxious re-opening consuming rotation slots — stops existing. That change alone, shipped standalone, would have preserved every affected user's data.

**Option A preserves the good property; Option C destroys it.** Backups being ordinary encrypted Mini Diarium databases is what makes the current system recoverable at all, is what let each affected user be walked through recovery by hand, and is what satisfies "no vendor lock-in" for the recovery path. Option A keeps that and adds a manifest; Option C trades it for disk savings.

**Option B is better than Option A at one thing and worse at everything else.** Its granularity is genuinely superior for the everyday case, and its restore UX is the best of the three. But it protects nothing against file-level loss, and it requires a migration on the `entries` write path — which is where the incident originated. Shipping it *after* Option A means it lands on top of a working pre-migration snapshot ([B-3](#b-3)), which is exactly the safety net a schema change to the entries table should have.

**Against Option A, honestly:** it is the biggest UI investment of the three, and restore-whole-journal is a dangerous operation that must be designed carefully. Both are real costs. Neither outweighs the fact that it is the only option that makes "automatic backups" a true statement about a product rather than about a `for` loop.

### Suggested sequencing

Each stage is independently shippable and independently valuable.

| Stage | Content | Findings closed | Rationale |
|---|---|---|---|
| **0** | Retention + dedup + pre-migration snapshot + atomic write + `VACUUM INTO` + second-resolution filenames. Backend only, no UI. | B-2, B-3, B-7, B-8, B-10, B-12, B-16 | Stops the bleeding. Small, testable, no UI or i18n work, and it makes every future incident recoverable. Ship it first and alone. |
| **0b** | Correct the five wrong or misleading documentation claims. No code. | B-15 | Ten minutes of work; the homepage currently understates retention by 6×. Do it immediately, independently of everything else. |
| **1** | Manifest sidecar, verification, Backups panel (list, health, last-backup indicator, manual snapshot, reveal, delete), doc rewrite. | B-1, B-14 | Makes the system visible and honest. Read-only UI; low risk. |
| **2** | Inspect a snapshot read-only; restore whole journal with a safety snapshot; restore selected entries into the live journal. | B-5, B-6 | The recovery product. Highest value, highest care required. |
| **3** | Destructive-op snapshots, backups-follow-the-journal, `auto_key` decision and warnings, password-change/auth-removal warnings. | B-4, B-9, B-11, B-13 | Loose ends, each small. |
| **4** | Option B: entry revisions + trash. | Adds granularity below the snapshot interval | Lands on a working pre-migration snapshot from Stage 0. |

---

## 8. Open-core fit

`OPEN_CORE_STRATEGY.md` §11 is unambiguous: the open core stays fully functional standalone, premium value is additive and never subtractive. So the split cannot be "free gets a worse backup". It has to be an axis where the premium capability is something the core *structurally cannot do* — which, given the no-network non-negotiable, is a clean and honest line.

**Stays in the open core, permanently, and must be excellent:**

- Everything in Option A: tiered time-guaranteed retention, dedup, verified atomic snapshots, pre-migration and pre-destructive triggers, the Backups panel, snapshot inspection, whole-journal restore, and per-entry restore from a snapshot.
- A useful default of entry revision history if Option B ships — the Standard Notes free tier is 3 days; something in the 30-day range is more generous and still leaves room above.
- All of it local, offline, on-device, with no capability withheld.

**Natural MiniDiarium+ territory** — every item requires either a network or a second device, which the core is forbidden from having:

- **Off-device backup.** The core can satisfy "one copy"; only + can satisfy 3-2-1. Server-side encrypted snapshot storage is precisely the Tier 1 architecture in `OPEN_CORE_STRATEGY.md` §4, and snapshots are already ciphertext, so this needs no new cryptography — the zero-knowledge property holds trivially.
- **Multi-device backup and restore.** Restore a snapshot taken on the desktop into the web tier, or onto a new machine.
- **Unbounded revision history.** The clearest precedent in the market. Free keeps a useful window; + keeps everything.
- **Backup health across devices**, scheduled off-device snapshots, and retention policies spanning machines.
- **Point-in-time browse with diff** across a long horizon — the Time Machine-style UI is far more valuable over a year of server-side history than over a local tiered set.

**Architectural implications to respect while building Option A**, so none of the above is foreclosed:

1. Keep retention policy pure. A function from `Vec<SnapshotMeta>` + policy + now → keep/evict decisions, with no filesystem access. It is then unit-testable, and reusable verbatim by a + tier over remote snapshot metadata.
2. Put filesystem access behind a narrow trait. `OPEN_CORE_STRATEGY.md` §8 already flags `backup.rs` as desktop-flavored; a snapshot store trait (list / write / read / delete / stat) lets + supply a remote implementation without forking the policy.
3. Keep the manifest format documented and stable, in the same spirit as `crates/mini-diarium-core/API.md`. It is the interchange point between core and any future tier.
4. Never let the manifest carry content. Counts, dates, sizes, versions, hashes. If a + tier ever uploads manifests, they must be as safe to transmit as the debug dump is to email.

---

## Verification log

Every claim was verified against the working tree at `2efb0716` on 2026-08-04, then re-verified line by line in a second pass. The second pass corrected four line references (`export/json.rs:37`→`:38`, `import/minidiary.rs:43-52`→`:45-54`, `config.rs:60-72`→`:4,61`, `MAX_BACKUPS` 50→30 attributed to v0.4.6 rather than "v0.4.x"), softened the version attribution of the triggering regression to what the CHANGELOG actually states, and added three findings that the first pass missed: the homepage retention number, the false claim in KI-9, and [B-16](#b-16).

| Claim | Verified by |
|---|---|
| `MAX_BACKUPS = 30`, `fs::copy`, minute-resolution filenames, rotation filter | Read `crates/mini-diarium-core/src/backup.rs` in full |
| Backups called only from two unlock sites | `Grep "backup_and_rotate\|create_backup\|rotate_backups"` across `src-tauri/**/*.rs` and `crates/**/*.rs` |
| Backup runs after `apply_pending` | Read `auth_core.rs:150-260,470-530` and `db/schema/open.rs` in full; `apply_pending` called at `open.rs:34,119,169` |
| `backups_dir` discarded on modern unlock paths | `open.rs:112` and `:171` (`let _ = backups_dir;`), `:179` (`_backups_dir`) |
| Migration list v3→v13 | `db/schema/migrations/mod.rs:25-37` |
| Backups path is `backups/{stem}/` | `src-tauri/src/lib.rs:187`; same construction at `auth_journals.rs:108,182`, `auth_directory.rs:64` |
| No backup command registered | Read the full `generate_handler!` block in `src-tauri/src/lib.rs` |
| One frontend mention of "backup" | `Grep -i "backup"` across `src/**/*.{ts,tsx}` → `src/i18n/locales/en.ts:441` only |
| Only the debug dump reads backups | `commands/debug.rs:257,346-350,371-378` |
| `reset_diary` deletes without a snapshot | `auth_core.rs:390-407` |
| `change_password` / `remove_auth_method` locations | `Grep "pub fn change_password\|pub fn remove_auth_method"` → `auth_core.rs:350`, `auth_slots.rs:194` |
| Export emits tags, import ignores them | `export/json.rs:38` vs `import/minidiary.rs:45-54` |
| Export writes plaintext to disk | `commands/export.rs:48,83` (`std::fs::write`), `:96` (image assets) |
| Import inserts fresh rows, images survive, `locked` does not | `commands/import.rs:37-59` — "Always insert a new row — AUTOINCREMENT assigns the id", via `insert_entry_with_images` (which normalizes `data:` URLs into the image store); `import/minidiary.rs:109,145` hardcodes `locked: false` |
| `delete_entry` is a hard delete | `db/queries/entries/delete.rs:21` — `DELETE FROM entries WHERE id = ?1` |
| Import runs straight into the live journal | `commands/plugin.rs:29-75` → `commands/import.rs:37` `import_entries(db, entries)` |
| `migrate_v4_to_v5` rebuilds the entries table | `migrations/v4_to_v5.rs:27-40` — `CREATE`/`INSERT … SELECT`/`DROP`/`RENAME`; its no-backup rationale is stated at `:13-17` |
| The other modern migrations are additive | `v5_to_v6`…`v12_to_v13` inspected: `ALTER TABLE … ADD COLUMN` only; the `CREATE TABLE entries` hits in `v11_to_v12`/`v12_to_v13` are inside `mod tests` |
| v4→v5's projection is complete for a v4 schema | `entry_metadata_encrypted` is introduced by `v8_to_v9.rs:14`, after v4→v5 |
| `auto_key` lives in `{app_data_dir}/config.json` | `config.rs:7-18` (`JournalConfig.auto_key`), `config.rs:4,61` (`app_data_dir.join(CONFIG_FILE)`); `commands/auth/mod.rs:12-14` |
| ADR claims self-contained backups | `docs/decisions/2026-04-passwordless-journal.md:32` |
| No `journal_mode` pragma anywhere | `Grep "journal_mode\|synchronous"` across `crates/` and `src-tauri/` → no hits |
| `USER_GUIDE.md` says 50, homepage says 5 | `docs/USER_GUIDE.md:341`; `website/index.html:570` ("keeping the last 5 automatically") |
| KI-9's "before any writes" claim is false | `docs/KNOWN_ISSUES.md:84-89` read against `open.rs:33-34` |
| `MAX_BACKUPS` 50→30 landed in v0.4.6 | `CHANGELOG.md:463` sits inside the `## [0.4.6] — 08-03-2026` section (452–466) |
| Incident description and date | `CHANGELOG.md:49` — `## [0.6.4] - 30-07-2026`, "Entry content loss when navigating quickly". The CHANGELOG does not state which earlier releases carried the regression, so the report does not either |
| `sync_detect` module exists | `src-tauri/src/sync_detect.rs`; cloud-sync guidance at `website/docs-src/09-backups.md:38-42` |

### External sources

- [Obsidian — File recovery core plugin](https://github.com/chrisblifeos-pixel/Obsidian-Official-Documentation/blob/master/en/Plugins/File%20recovery.md)
- [Joplin — Note history specification](https://joplinapp.org/help/dev/spec/history/)
- [Standard Notes — Features (revision history tiers)](https://standardnotes.com/features)
- [Day One — Data loss and recovery options](https://dayoneapp.com/guides/troubleshooting/data-loss-and-recovery-options/)
- [Day One — Backups in Day One Android](https://dayoneapp.com/guides/day-one-for-android/backups-in-day-one-android/)
- [KeePassXC — Database operations (backup before saving)](https://github.com/keepassxreboot/keepassxc/blob/develop/docs/topics/DatabaseOperations.adoc)
- [SQLite — Online Backup API](https://sqlite.org/backup.html)
- [Backup strategies for SQLite in production — Oldmoe's blog](https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/)
- [Backblaze — Grandfather-Father-Son backup scheme](https://www.backblaze.com/blog/better-backup-practices-what-is-the-grandfather-father-son-approach/)
- [Nakivo — GFS retention policy explained](https://www.nakivo.com/blog/gfs-retention-policy-explained/)
