# Issue #370 handover 2: document-portal behaviour on Workbook

Status: **OPEN — waiting for the Workbook run.**
Created: 2026-11-03 on `machine.main-desktop`. Branch: `handover/issue-370-flatpak-repro`.
Previous run: `docs/wip/ISSUE_370_WORKBOOK_HANDOVER.md` (read its Results first).

## Prompt for the agent on Workbook

You are on `machine.workbook`. Do the tests below and **write the results into the "Results"
section of this file**. The main-desktop session uses them to design the fix.

Rules (same as handover 1):

- `flatpak --user` only. Do not touch system flatpaks (Hermes owns them).
- Do not change code in this repo. Do not post on GitHub. Only edit this file.
- Never print or copy `auto_key` values. Use `jq 'del(.journals[]?.auto_key)'` for every view of `config.json`.
- Record what you see. Do not guess. If a step is not possible, say why and continue.
- Ask the user before you install anything large (for example `org.gnome.Sdk//50`, about 1 GB).
- Ask the user before each logout, login or reboot. The user does those and the GUI clicks.
- When you finish: commit **only this file** to `handover/issue-370-flatpak-repro` and push.
  No `Co-Authored-By`, no Claude attribution lines.
- Write in ASD-STE100 Simplified Technical English.

## Why this run

Handover 1 showed that the 0.7.6 → 0.8.0 update does not lose the journal list. The real problem is
that **+ Open Existing** on Flatpak refuses every `.db` outside the sandbox, even with a
`--filesystem` grant (V4). The refusal (`check_journal_location`,
`src-tauri/src/commands/auth/auth_journals.rs:127`) assumes that a `/run/user/<uid>/doc/…` path is
temporary. That assumption was never tested, and the official docs say the opposite. We want to fix
the regression **without any new Flatpak permission**. For that we need facts about the portal.

### Claims to check (official sources)

| # | Claim | Source |
|---|---|---|
| C1 | "Files added to the Documents portal by this portal stay accessible across sessions." | [FileChooser portal docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html) (interface v4) |
| C2 | The FileChooser `directory` option selects folders; added in FileChooser v3. | same page |
| C3 | Documents `AddFull` flags: `2 == persistent`, `4 == as-needed-by-app` ("only added to the document store if the application does not already have access"), `8 == export-directory` (Documents v4). | [Documents portal docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Documents.html) (interface v5) |
| C4 | `GetHostPaths` (Documents v5) gives the host path; it is also in the `user.document-portal.host-path` xattr. | same page |
| C5 | The file chooser registers documents with `REUSE_EXISTING \| PERSISTENT \| AS_NEEDED_BY_APP` (plus `DIRECTORY` for folders). | source: `flatpak/xdg-desktop-portal` `src/desktop-portal/xdp-documents.c:119` (main branch) |
| C6 | SQLite puts `<db>-journal` (and `-wal`/`-shm` in WAL mode) "always … in the same directory as the database file". The app uses the default rollback-journal mode. | [SQLite temporary files](https://www.sqlite.org/tempfiles.html) |
| C7 | The app's dialog is `tauri-plugin-dialog` 2.8.3 → `rfd` 0.16 gtk3 backend → `gtk_file_chooser_native_new`, so the dialog goes through the FileChooser portal under Flatpak. | `Cargo.lock`; `rfd` `src/backend/gtk3/file_dialog/dialog_ffi.rs:29` |

The docs do **not** say whether a process can create new files (like `diary.db-journal`) next to a
**single exported file**. Our hypothesis: a file grant gives access to that one file only, so SQLite
writes and the `backups/` folder fail, and this (not expiry) caused the July 2026 failures
(`docs/wip/CREATE_JOURNAL_FAILURE_2026-07-30.md`). But the July report also saw **create** fail in a
folder (directory) grant. The tests must settle both.

## Tests

Setup:

1. Back up `~/.var/app/io.github.fjrevoredo.mini-diarium/` again (`cp -a … ~/issue370-backup2-<time>`).
   Make the 0.8.0 `stable` branch current (`flatpak make-current --user io.github.fjrevoredo.mini-diarium stable`).
   Confirm `flatpak override --user --show io.github.fjrevoredo.mini-diarium` is empty.
2. Record the portal interface versions:
   ```
   busctl --user get-property org.freedesktop.portal.Documents /org/freedesktop/portal/documents org.freedesktop.portal.Documents version
   busctl --user get-property org.freedesktop.portal.Desktop /org/freedesktop/portal/desktop org.freedesktop.portal.FileChooser version
   ```
3. On the host, make test data with no personal content:
   - `~/issue370-portal/file/test.db` and `~/issue370-portal/dir/test.db`: create each with
     `python3 -c "import sqlite3; c=sqlite3.connect('<path>'); c.execute('create table t(x)'); c.commit()"`.
   - Also copy a real Fenmark test journal (from handover 1, for example the 0.8.0 run's `diary.db`) to
     `~/issue370-portal/dir/diary.db`. Record its password from handover 1 only if it is a test password.
4. Find a tool to run SQLite **inside the sandbox of this app ID** (the portal mount is per app):
   - First try `flatpak run --command=python3 io.github.fjrevoredo.mini-diarium -c "import sqlite3, os; print('ok')"`.
   - If the runtime has no python3, try `--command=sqlite3`.
   - If neither exists, ask the user to approve `flatpak install --user flathub org.gnome.Sdk//50` and use
     `flatpak run --runtime=org.gnome.Sdk//50 --command=python3 io.github.fjrevoredo.mini-diarium …`.
   Record which tool you used.

Define the **sandbox probe** for a path `P` (a file path inside `/run/user/<uid>/doc/…`), run inside the sandbox:

- (a) `ls -la` of the folder that holds `P`, and `ls -la /run/user/<uid>/doc/`.
- (b) Read: open `P`, `select count(*) from sqlite_master`.
- (c) Write in rollback-journal mode: `begin immediate; insert into t values (1); commit;` on `test.db`
  (this makes `test.db-journal`). Record the exact error text if it fails.
- (d) Create a new database next to `P` (`new.db`), create a table, commit.
- (e) `mkdir backups` next to `P` and write a small file inside it.
- (f) The host path: `os.getxattr(P, 'user.document-portal.host-path')` (or `getfattr`).

T1 — **File grant.** In 0.8.0, **+ Open Existing** → pick `~/issue370-portal/file/test.db`. The form shows the
folder path before you confirm: record it exactly. Confirm and record the message. Quit the app. Run the sandbox
probe on that path.

T2 — **Directory grant.** In 0.8.0, **+ Create New Journal** → **Browse…** → pick the folder `~/issue370-portal/dir/`.
Record the Location path exactly. Cancel. Run the sandbox probe on `<that path>/test.db`. Also run (b) on
`<that path>/diary.db`.

T3 — **Persistence.** For the T1 and T2 paths, check in a **new** sandbox, without picking again
(`flatpak run --command=ls io.github.fjrevoredo.mini-diarium -la <path>`):

- (i) after the app quits and starts again;
- (ii) after `systemctl --user restart xdg-document-portal.service`;
- (iii) after a logout and login (ask the user);
- (iv) optional: after a reboot (ask the user).

Also record `flatpak documents --app=io.github.fjrevoredo.mini-diarium` (host) after each step. Then pick the same
file and the same folder again in the app: is the doc ID the same as before (C5 `REUSE_EXISTING`)?

T4 — **With a filesystem grant.** `flatpak override --user --filesystem=$HOME/issue370-portal io.github.fjrevoredo.mini-diarium`.
Repeat the picks of T1 and T2. Record the paths: real host path or `/run/user/<uid>/doc/…`? (C3 `as-needed-by-app`
says a real path is expected.) Then `flatpak override --user --reset io.github.fjrevoredo.mini-diarium`.

T5 — **Which action writes `"journals": []` with `diary_dir` set.** In 0.8.0 on a clean data folder: create one
journal in the default location, quit, record `config.json`. Then **Remove** that journal in the picker, quit,
record `config.json` again.

Cleanup: reset the override, restore the backup from setup 1 (`diff -r` must show no difference), make the `test`
branch current again if it was current before, and record all of this.

## Results

<!-- Workbook agent: write here. Raw output in fenced blocks. Redact auto_key and any personal path parts other than $HOME. -->

### Environment and portal versions

### Sandbox tool used

### T1 — file grant

### T2 — directory grant

### T3 — persistence

### T4 — with a filesystem grant

### T5 — Remove and `journals: []`

### Check of claims C1–C7

| # | Confirmed / contradicted / not tested | Evidence |
|---|---|---|

### Conclusion

- Is a directory-grant path usable for open, write, new database and `backups/`?
- Does it stay valid across restart, portal restart, re-login (and reboot)?
- Is a file-grant path usable for writes? If not, the exact error.
- Open questions for the main-desktop session:

### Cleanup
