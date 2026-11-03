# Issue #370 handover: reproduce the Flatpak 0.7.6 → 0.8.0 journal-list loss on Workbook

Status: **Step 1 DONE on Workbook (2026-11-03) — results below.**
Created: 2026-11-03 on `machine.main-desktop`. Branch: `handover/issue-370-flatpak-repro`.

## Prompt for the agent on Workbook

You are on `machine.workbook` (Linux Mint, Flatpak installed, logged-in desktop session).
Do **Step 1** of the issue #370 plan below and **write the results back into this file**,
in the "Results" section at the end. The main-desktop session continues from your results.

Rules:

- Use `flatpak --user` only. Hermes owns the system flatpaks; do not touch them.
- Do not change the code in this repo. Do not post on GitHub. Only edit this file.
- Never print or copy `auto_key` values from `config.json` (they are device keys). Use
  `jq 'del(.journals[]?.auto_key)'` for every view of that file.
- Do not guess a cause. Record what you saw. If something does not reproduce, say so and list
  the variants you tried.
- When you finish: commit **only this file** to the `handover/issue-370-flatpak-repro` branch
  and push it. No `Co-Authored-By`, no Claude attribution lines in the commit message.
- Write in ASD-STE100 Simplified Technical English.

## Background

Reporter (Flathub build) updated 0.7.6 → 0.8.0 (Flathub PR #28, merged 2026-11-02). After the
update the journal picker shows "No journals yet". "Open Existing" on their `.db` then fails with
`errors.portalPathRejected`: the Flatpak file chooser returns a `/run/user/<uid>/doc/…` path and
`check_journal_location` (`src-tauri/src/commands/auth/auth_journals.rs:127`) refuses it (KI-10).

Static analysis of v0.7.6..v0.8.0 found **no cause**:

- Tauri `identifier` is still `com.minidiarium`, so `config.json` must be at
  `~/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/config.json`.
- The Flathub manifest diff is only the source commit. Flatpak ID, `command`, `finish-args`,
  runtime 50 and build commands did not change.
- `load_journals` / `list_journals` / `JournalConfig` / the portal check did not change. The only
  path change is the default folder for *new* journals (`config::default_journal_dir`,
  `Documents/Fenmark` with a legacy fallback).

So we need an empirical reproduction.

## Step 1 — tasks

1. Check if `io.github.fjrevoredo.mini-diarium` is installed (`flatpak list --app`, both
   installations) and if `~/.var/app/io.github.fjrevoredo.mini-diarium/` exists. If it has data,
   back up that folder first (`cp -a … ~/issue370-backup-<date>`) and record the backup path.
2. Find the 0.7.6 commit: `flatpak remote-info --user --log flathub io.github.fjrevoredo.mini-diarium`
   (add the flathub remote for `--user` if it is missing). Install with `--user`, then
   `flatpak update --user --commit=<0.7.6 commit> io.github.fjrevoredo.mini-diarium`.
   Confirm with `flatpak info --user io.github.fjrevoredo.mini-diarium`.
3. Snapshot the tree: `find ~/.var/app/io.github.fjrevoredo.mini-diarium -printf '%M %s %TY-%Tm-%Td %TT %p\n' | sort -k5`.
4. Launch 0.7.6 on the Workbook display (`flatpak run io.github.fjrevoredo.mini-diarium`).
   Create a **password** journal in the default location, add one entry, quit.
   If you cannot drive the GUI, ask the user to do the clicks and tell you when they finish.
5. Record: the tree again (same `find`), and `jq 'del(.journals[]?.auto_key)' …/config.json`.
6. Update to the latest Flathub build: `flatpak update --user io.github.fjrevoredo.mini-diarium`
   (must be 0.8.0; confirm with `flatpak info`). Launch with
   `RUST_LOG=debug flatpak run io.github.fjrevoredo.mini-diarium 2> ~/issue370-080.log`.
7. Record: does the picker list the journal? The tree again, the `config.json` view again, and the
   relevant lines of `~/issue370-080.log` (config load, journal list, any error). Diff the trees:
   did anything move between `data/`, `config/`, `cache/`? Did a new `data/<other-id>/` appear?
8. If it does **not** reproduce, try these variants and record each one:
   - a **passwordless** (local-only, auto-key) journal created in 0.7.6;
   - a journal created by a **0.6.x** build (before the v0.6.6 portal guard), then 0.6.x → 0.7.6 → 0.8.0
     and 0.6.x → 0.8.0 directly;
   - a journal added with **Open Existing** from a folder outside the sandbox (with and without a
     `flatpak override --user --filesystem=<folder>` grant), then update.
9. Also check (cheap, useful for Step 4): in 0.8.0, use "Open Existing" on a `.db` outside the
   sandbox without a grant and record the exact error text shown in the UI.
10. Cleanup: leave the app installed. Restore the backup from task 1 if you made one, and record that.

Exit: a reproduced failure with the observed cause, or a recorded "does not reproduce" with the
variants tried.

## Results

<!-- Workbook agent: write here. Keep raw command output in fenced blocks, redact auto_key. -->

### Environment

- Date: 2026-11-03, `machine.workbook`, Linux Mint 22.1, X11 session (`DISPLAY=:0`).
- Flatpak version: 1.14.6 (`flatpak 1.14.6-1ubuntu0.1`). Host portals: `xdg-desktop-portal 1.20.0+ds-2ubuntu1`,
  `xdg-desktop-portal-gtk 1.15.1-1build2`, `xdg-desktop-portal-xapp 1.1.0+xia`.
- Pre-existing install / data (and backup path):
  - Installed before the test: only `io.github.fjrevoredo.mini-diarium//test` 0.6.6, `--user`, origin
    `mini-diarium-origin` (`https://dl.flathub.org/build-repo/309120`), commit `dd7a9cb9…` "Update to 0.6.6
    (79bd7f7fcf5a)". There was no `stable` branch. There was no system install.
  - `~/.var/app/io.github.fjrevoredo.mini-diarium/` had data. Backup: `~/issue370-backup-2026-11-03` (`cp -a`).
  - The pre-existing `config.json` has a `diary_dir` and an **empty** `journals` array. The journal folder that
    `diary_dir` points to exists and has a `diary.db` (2026-08-08). See variant V1.

    ```json
    {
      "diary_dir": "/home/francisco/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals/igpibhjk",
      "journals": [],
      "active_journal_id": ""
    }
    ```

- 0.7.6 commit used: `895d0dcf7e7c942c18f870eb2a5d2b39f703f17b77e53f0e40d97c8afdd34ad7`
  ("Merge pull request #27 from flathub/update-0.7.6", 2026-10-26).
- 0.8.0 commit used: `b2c8eac27cf7936be805883273d52ef89c3ba92aad23b0e97c5aba194f3c9656`
  ("Merge pull request #28 from flathub/update-0.8.0", 2026-11-02).
- Method: `flatpak install --user flathub …//stable`, then `flatpak update --user --commit=<0.7.6>`, then
  `flatpak make-current --user … stable`. Every run starts from an empty data folder, except where a variant says
  otherwise. Every launch used `RUST_LOG=debug`. The user did the GUI clicks. Logs are in `~/issue370-*.log`.
  The data folder of each run is kept in `~/issue370-run-*` (these copies contain `auto_key` values, so keep them local).
- Note: `flatpak remote-info --log` shows `Version: 0.4.22` for the 0.8.0 and 0.7.2 commits. `flatpak info` after
  install shows the correct versions (0.7.6, 0.8.0). This is display metadata only; it had no effect on the test.
- Note: Flathub pruned old stable commits. The parent of 0.7.2 (`3057e275…`) gives `Server returned status 404`.
  Thus no 0.6.x or 0.7.0/0.7.1 **stable** build is available. For 0.6.x I used the installed 0.6.6 `test` build.

### 0.7.6 state (after journal creation)

Password journal, default location, one entry, then quit. Before the first launch, the data folder did not exist
(task 3 snapshot was empty).

Tree (`~APP` = `~/.var/app/io.github.fjrevoredo.mini-diarium`; `cache/`, `WebKitCache/`, `storage/` left out):

```text
drwxr-xr-x 4096 2026-11-03 14:01:11 ~APP/config/com.minidiarium
-rw-r--r-- 208 2026-11-03 14:01:11 ~APP/config/com.minidiarium/.window-state.json
drwx------ 4096 2026-11-03 14:00:24 ~APP/config/enchant  (en_US.dic, en_US.exc)
drwx------ 4096 2026-11-03 14:00:23 ~APP/config/ibus/bus
drwxr-xr-x 4096 2026-11-03 14:00:46 ~APP/data/com.minidiarium
-rw------- 8 2026-11-03 14:00:23 ~APP/data/com.minidiarium/CacheStorage/salt
-rw-r--r-- 351 2026-11-03 14:00:46 ~APP/data/com.minidiarium/config.json
-rw-r--r-- 12288 2026-11-03 14:00:23 ~APP/data/com.minidiarium/hsts-storage.sqlite
-rw-r--r-- 118784 2026-11-03 14:01:11 ~APP/data/com.minidiarium/journals/backups/diary/backup-2026-11-03-14h01m11.db
-rw-r--r-- 519 2026-11-03 14:01:11 ~APP/data/com.minidiarium/journals/backups/diary/manifest.json
-rw-r--r-- 118784 2026-11-03 14:01:05 ~APP/data/com.minidiarium/journals/diary.db
-rw-r--r-- 12288 2026-11-03 14:01:11 ~APP/data/com.minidiarium/localstorage/tauri_localhost_0.localstorage (+ -shm, -wal)
-rw------- 8 2026-11-03 14:00:23 ~APP/data/com.minidiarium/mediakeys/v1/salt
-rw-r--r-- 5703 2026-11-03 14:00:23 ~APP/data/com.minidiarium/plugins/README.md
```

`config.json` (`jq 'del(.journals[]?.auto_key)'`):

```json
{
  "diary_dir": "/home/francisco/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals",
  "journals": [
    {
      "id": "5b0950bb26e80e5a",
      "name": "bdfdfhfhgfh",
      "path": "/home/francisco/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals"
    }
  ],
  "active_journal_id": "5b0950bb26e80e5a"
}
```

Log (`~/issue370-076.log`, relevant lines):

```text
[2026-11-03T13:00:23Z INFO  mini_diarium_lib] Mini Diarium starting
[2026-11-03T13:00:46Z INFO  mini_diarium_lib::commands::auth::auth_journals] Journal added: 5b0950bb26e80e5a
[2026-11-03T13:00:46Z INFO  mini_diarium_lib::commands::auth::auth_journals] Switched to journal: 5b0950bb26e80e5a
[2026-11-03T13:00:53Z INFO  mini_diarium_lib::commands::auth::auth_core] Journal created
[2026-11-03T13:01:02Z DEBUG mini_diarium_lib::commands::entries] Created entry id=1 for 2026-11-03
[2026-11-03T13:01:11Z INFO  mini_diarium_core::backup] Snapshot created (118784 bytes, trigger Lock)
```

### 0.8.0 state (after update)

- `flatpak update --user` to `b2c8eac2…`, `flatpak info` shows `Version: 0.8.0`.
- The update alone did not change the data tree (the snapshot before the first 0.8.0 launch is identical).
- **The picker listed the journal `bdfdfhfhgfh`.** The user unlocked it and the entry was there.
- `config.json` after the 0.8.0 run: identical to the 0.7.6 view above (same id, name, path, active id).
- Tree diff 0.7.6-after → 0.8.0-after: only mtimes of `journals/diary.db`, `journals/backups/diary/manifest.json`,
  `localstorage/*` and `.ld.so/*` changed. Nothing moved between `data/`, `config/` and `cache/`. No new
  `data/<other-id>/` or `config/<other-id>/` folder appeared (`data/` has only `com.minidiarium`).

Log (`~/issue370-080.log`, relevant lines):

```text
[2026-11-03T13:01:31Z INFO  mini_diarium_lib] Fenmark starting
[2026-11-03T13:01:54Z INFO  mini_diarium_lib::commands::auth::auth_core] Journal unlocked
[2026-11-03T13:01:54Z DEBUG mini_diarium_core::backup] Snapshot skipped (TooSoon, trigger Unlock)
[2026-11-03T13:02:47Z DEBUG mini_diarium_lib::commands::entries] Saved entry id=1
[2026-11-03T13:02:47Z INFO  mini_diarium_lib::commands::auth::auth_core] Journal locked
```

The log has no explicit "config loaded" or "journal list" line at debug level.

### Variants tried

| # | Variant | Result in 0.8.0 |
|---|---|---|
| Main | 0.7.6 password journal, default location → 0.8.0 | Listed, unlocks. **Does not reproduce.** |
| V1 | Pre-existing real data from the 0.6.6 `test` build (`journals: []` + `diary_dir` set, see Environment) → 0.8.0 | **"No journals yet".** `config.json` not changed by 0.8.0. |
| V2 | 0.7.6 **passwordless** journal, default location → 0.8.0 | Listed, auto-unlocks (`Local-only journal unlocked`), entry there. Does not reproduce. |
| V3a | 0.6.6 `test` build password journal → 0.7.6 → 0.8.0 | Listed and unlocks in 0.7.6 and in 0.8.0. Does not reproduce. |
| V3b | 0.6.6 `test` build password journal → 0.8.0 direct | Listed, unlocks. Does not reproduce. |
| V4 | Open Existing on `~/issue370-outside/diary.db`, with `flatpak override --user --filesystem=/home/francisco/issue370-outside` | Refused in **0.7.6 and in 0.8.0** with the portal-path message. The journal was never added, so the "then update" step was not possible. |

Details:

- V1: before the test, I made a copy of the pre-existing data and ran 0.8.0 on it. The picker showed "No journals yet".
  The code reads this config shape in this way: `load_journals`
  (`crates/mini-diarium-core/src/config.rs:104`) returns the `journals` array as it is when the key is present. The
  legacy migration from `diary_dir` runs only when the key is **absent**. Thus `"journals": []` gives an empty list in
  every version. `git log v0.7.6..v0.8.0 -- crates/mini-diarium-core/src/config.rs` shows only `fe622848` (legacy
  default-folder fallback) and `25e6f81f` (display name). I do not know which action wrote this config in August.
  The pre-existing folder is `journals/igpibhjk/`; 0.6.6 also makes `journals/<journal name>/` (see V3).
- V3: 0.6.6 puts a new journal in `journals/<journal name>/` (here `journals/jhbhjb/`). 0.7.6 and 0.8.0 put it in
  `journals/` directly. Both `config.json` files were correct. On first unlock, 0.7.6 logged
  `Migrated database from v13 to v14 (added attachments and entry_attachments tables)`.

  0.6.6 `config.json`:

  ```json
  {
    "diary_dir": "/home/francisco/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals/jhbhjb",
    "journals": [
      {
        "id": "1724e15fcf69139e",
        "name": "jhbhjb",
        "path": "/home/francisco/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals/jhbhjb"
      }
    ],
    "active_journal_id": "1724e15fcf69139e"
  }
  ```

- V2: 0.7.6 `config.json` had one journal (`id 65af3344e1f9c13c`, `name "diary"`, path `…/data/com.minidiarium/journals`)
  with an `auto_key` field present (value not shown).
- V4: inside the sandbox, `ls -la /home/francisco/issue370-outside` shows `diary.db`, so the grant worked. The UI
  still refused the file. The backend wrote no log line for the refusal in 0.7.6 or 0.8.0. I did not see the path
  that the file chooser returned, so it is not confirmed that it was a `/run/user/1000/doc/…` path; the message is the
  portal-path message. The variant "without a grant" is task 9 (same result).
- Not tried: a 0.6.x build **before** the v0.6.6 portal guard. Flathub has no such stable commit now (404), and I did
  not build one from source.

### Open Existing error text in 0.8.0

On `~/issue370-outside/diary.db`, no grant (0.8.0 build `b2c8eac2…`, before commit `3a20013` that changes this text):

```text
That folder is only shared with Fenmark temporarily, so a journal saved there would stop opening later. Use the default location instead.
```

0.7.6 with the grant shows the same text with "Mini Diarium" in place of "Fenmark". 0.8.0 with the grant shows the
Fenmark text again.

### Conclusion

- Reproduced: **no** for the 0.7.6 → 0.8.0 update path (main, V2, V3a, V3b all keep the journal list).
  **Yes** for the symptom "No journals yet" with an existing journal on disk, but only with a pre-existing
  `config.json` that already had `"journals": []` (V1). That config existed before this test (`config.json` mtime
  2026-08-08 16:14; the installed 0.6.6 `test` commit is dated 2026-08-08 14:01). The 0.8.0 update did not write it.
- Observed cause (facts only):
  - The 0.8.0 update did not move, rewrite or delete `config.json` or any journal file in any variant.
  - A `config.json` with `"journals": []` and `diary_dir` set gives "No journals yet" in 0.8.0; the legacy migration
    does not run because the `journals` key is present.
  - "Open Existing" is refused for a `.db` outside the sandbox, also when the folder has a `--filesystem` grant
    (0.7.6 and 0.8.0). So the reporter cannot recover with Open Existing, with or without a grant.
- Open questions for the main-desktop session:
  1. Ask the reporter for their `config.json` (with `auto_key` removed) and the list of
     `~/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/`. Is `journals` empty while `diary_dir`
     is set (the V1 shape)? Was the journal list already empty before the update (did they see it in 0.7.6)?
  2. Which action writes `journals: []` with a non-empty `diary_dir`? (Remove-journal, a failed add, or a 0.6.x
     path?) Not tested here.
  3. Should `load_journals` recover when `journals` is empty and `diary_dir` points at an existing `diary.db`?
  4. Why does the file chooser not return the real path for a folder that has a `--filesystem` grant on this portal
     version (`xdg-desktop-portal 1.20.0`)? Log the returned path to confirm it is `/run/user/<uid>/doc/…`.

### Cleanup

- `flatpak override --user --reset io.github.fjrevoredo.mini-diarium` (the V4 grant is removed; `--show` is empty).
- The original data folder is back in `~/.var/app/io.github.fjrevoredo.mini-diarium/`. `diff -r` against
  `~/issue370-backup-2026-11-03` shows no difference.
- Both branches stay installed (`--user`): `stable` 0.8.0 (`b2c8eac2…`) and `test` 0.6.6. `test` is current
  again, as before the test.
- Kept in `~`: the backup, `~/issue370-outside/`, `~/issue370-state-066/`, `~/issue370-run-*`, `~/issue370-*.log`.
