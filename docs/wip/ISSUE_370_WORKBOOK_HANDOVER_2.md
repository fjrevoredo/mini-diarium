# Issue #370 handover 2: document-portal behaviour on Workbook

Status: **Workbook run done (2026-11-03), including T3 (iv) reboot and T6 — results below.**
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

- Machine: `machine.workbook`, Linux Mint 22.1, Cinnamon on X11 (`XDG_CURRENT_DESKTOP=X-Cinnamon`, `XDG_SESSION_TYPE=x11`), uid 1000.
- Flatpak 1.14.6. Host packages: `xdg-desktop-portal 1.20.0+ds-2ubuntu1`, `xdg-desktop-portal-gtk 1.15.1-1build2`, `xdg-desktop-portal-xapp 1.1.0+xia`. The file chooser window comes from `xdg-desktop-portal-gtk` (pid 3137).
- App: `io.github.fjrevoredo.mini-diarium//stable` 0.8.0, commit `b2c8eac27cf7…`, runtime `org.gnome.Platform/x86_64/50`. Before the run the `test` branch (0.6.6) was current. I made `stable` current for the run.
- `flatpak override --user --show` was empty at the start.
- Backup: `~/issue370-backup2-20261103-150116`.

```
$ busctl --user get-property org.freedesktop.portal.Documents /org/freedesktop/portal/documents org.freedesktop.portal.Documents version
u 5
$ busctl --user get-property org.freedesktop.portal.Desktop /org/freedesktop/portal/desktop org.freedesktop.portal.FileChooser version
u 4
```

Note: `flatpak documents` in Flatpak 1.14.6 has no `--app=` option. The app ID is a positional argument:
`flatpak documents --columns=id,origin,path,permissions io.github.fjrevoredo.mini-diarium`.

Document store **before** the tests (old grants from earlier work on this machine; all `read write grant-permissions`):

```
f4d50bff  $HOME/issue370-outside/diary.db
5a584563  $HOME/aaa+
5dcb6075  $HOME/Desktop/test1
c096c9e9  $HOME/Downloads
e81d571f  $HOME                <- a folder grant for all of $HOME already exists
```

How the GUI steps were done: the user did T1, T2 and the T3 re-pick. For T4 (fresh items) and T5 I drove the app with
`agent-desktop` 1.0.2 (npm, AT-SPI): X11 clicks at screen coordinates for Fenmark (its WebKitGTK tree does not show on
the AT-SPI bus through the Flatpak proxy) and accessibility refs for the GTK file chooser (host process). I checked
each step with a screenshot.

### Sandbox tool used

The 0.8.0 runtime has both tools. No SDK install was necessary.

```
$ flatpak run --command=python3 io.github.fjrevoredo.mini-diarium -c "import sqlite3; print('ok', sqlite3.sqlite_version)"
ok 3.50.4
$ flatpak run --command=sh io.github.fjrevoredo.mini-diarium -c 'command -v getfattr python3 sqlite3'
/usr/bin/getfattr
/usr/bin/python3
/usr/bin/sqlite3
```

I used `python3` in the sandbox (`flatpak run --branch=stable --command=python3 io.github.fjrevoredo.mini-diarium -c "<probe>" <P>`).
The probe does steps (a)–(f) as written above. For (c) it opens with `isolation_level=None`, reads `pragma journal_mode`,
then runs `begin immediate; insert into t values (1); commit`. For (f) it reads the xattr on `P` and on the folder of `P`.

Test data: `~/issue370-portal/file/test.db`, `~/issue370-portal/dir/test.db` (made with the given command), and
`~/issue370-portal/dir/diary.db` (a copy of the handover-1 main-run 0.8.0 journal). I did not record a password: the user
typed it in handover 1 and it is not in the notes.

### T1 — file grant

- Pick: **+ Open Existing** → `~/issue370-portal/file/test.db` (the user did it).
- Folder path in the form before confirm: **not noted** (the user did not note it). In T4 the same form showed
  `/run/user/1000/doc/760845c` for this file, so the value is probably the same; this is not confirmed for T1.
- Message after confirm (UI in Spanish): "Esa carpeta solo se comparte con Fenmark de forma temporal, así que un diario
  guardado ahí dejaría de abrirse más adelante. Usa la ubicación predeterminada."
- Backend log (`~/issue370-h2-t1.log`): only `Fenmark starting` and GTK locale warnings. No line for the refusal.
- New document: `760845c  $HOME/issue370-portal/file/test.db  /run/user/1000/doc/760845c/test.db  read write grant-permissions`.

Sandbox probe on `P=/run/user/1000/doc/760845c/test.db`:

```
[a] ls -la /run/user/1000/doc/760845c
drwx------ 2 francisco francisco    0 Jan  1  1970 .
dr-x------ 2 francisco francisco    0 Jan  1  1970 ..
-rw-r--r-- 1 francisco francisco 8192 Nov  3 15:01 test.db
[a] ls -la /run/user/1000/doc/
dr-x------ 2 ... 5a584563
dr-x------ 2 ... 5dcb6075
drwx------ 2 ... 760845c        <- file-grant doc dir is writable (drwx)
dr-x------ 2 ... c096c9e9
dr-x------ 2 ... e81d571f
drwx------ 2 ... f4d50bff
[b read] OK count=1
[c write] OK journal_mode=delete rows=1
[d new.db] OK /run/user/1000/doc/760845c/new.db
[e backups/] FAIL PermissionError: [Errno 1] Operation not permitted: '/run/user/1000/doc/760845c/backups'
[f xattr file] OK b'$HOME/issue370-portal/file/test.db'
[f xattr dir] OK b'$HOME/issue370-portal/file'
[after] ls -la /run/user/1000/doc/760845c
-rw-r--r-- 1 francisco francisco 8192 Nov  3 15:03 new.db
-rw-r--r-- 1 francisco francisco 8192 Nov  3 15:03 test.db
```

Host side after the probe:

```
$ ls -la ~/issue370-portal/file/
-rw-r--r-- 1 francisco francisco 8192 Nov  3 15:03 test.db
-rw-r--r-- 1 francisco francisco 8192 Nov  3 15:03 .xdp-new.db-SVb1Pv
$ python3 -c "...select count(*) from t" test.db     -> (1,)      # the write in (c) reached the host file
$ python3 -c "...select * from n" .xdp-new.db-SVb1Pv -> [(1,)]    # new.db exists on the host only as a hidden temp file
```

Facts:
- Read and rollback-journal write on the granted file work. The commit reached the host file.
  (`test.db-journal` was not visible after the commit; I did not see where the portal put it during the transaction.)
- A new file next to the granted file (`new.db`) is visible in the sandbox, but on the host it is only
  `.xdp-new.db-<random>`. It is **not** `new.db` on the host.
- `mkdir` next to the granted file fails with `EPERM` ("Operation not permitted"). So a `backups/` folder cannot be made.
- See T3 (ii): the sandbox `new.db` is gone after a portal restart.

### T2 — directory grant

- Pick: **+ Create New Journal** → **Browse…** → folder `~/issue370-portal/dir/` (the user did it).
- Location path in the form: `/run/user/1000/doc/7b1a970b/dir` (exact, as the user read it). Then Cancel.
- New document: `7b1a970b  $HOME/issue370-portal/dir  /run/user/1000/doc/7b1a970b/dir`.

Sandbox probe on `P=/run/user/1000/doc/7b1a970b/dir/test.db`:

```
[a] ls -la /run/user/1000/doc/7b1a970b/dir
drwxrwxr-x 2 francisco francisco   4096 Nov  3 15:01 .
dr-x------ 2 francisco francisco      0 Jan  1  1970 ..
-rw-r--r-- 1 francisco francisco 118784 Nov  3 14:02 diary.db
-rw-r--r-- 1 francisco francisco   8192 Nov  3 15:01 test.db
[b read] OK count=1
[c write] OK journal_mode=delete rows=1
[d new.db] OK /run/user/1000/doc/7b1a970b/dir/new.db
[e backups/] OK /run/user/1000/doc/7b1a970b/dir/backups
[f xattr file] OK b'$HOME/issue370-portal/dir/test.db'
[f xattr dir] OK b'$HOME/issue370-portal/dir'
[after] ls -la /run/user/1000/doc/7b1a970b/dir
drwxr-xr-x 2 francisco francisco   4096 Nov  3 15:05 backups
-rw-r--r-- 1 francisco francisco 118784 Nov  3 14:02 diary.db
-rw-r--r-- 1 francisco francisco   8192 Nov  3 15:05 new.db
-rw-r--r-- 1 francisco francisco   8192 Nov  3 15:05 test.db
```

(b) on `/run/user/1000/doc/7b1a970b/dir/diary.db`: `[b read] OK count=26`; xattr gives `$HOME/issue370-portal/dir/diary.db`.

Host side: `~/issue370-portal/dir/` has real `new.db`, a real `backups/` folder and `backups/probe.txt` (content `probe`).

Facts: in a folder grant, read, rollback-journal write, a new database next to the file, and `mkdir backups` + a file in
it all work. The results are real files on the host.

### T3 — persistence

Check in a new sandbox (`flatpak run --branch=stable --command=ls … -la <path>` and a `select count(*) from t` with python3), no new pick:

| Step | `/run/user/1000/doc/760845c/` (file grant) | `/run/user/1000/doc/7b1a970b/dir/` (folder grant) | `flatpak documents` |
|---|---|---|---|
| (i) app quit, new sandbox | `test.db` (rows=1) and `new.db` visible | `backups/`, `diary.db`, `new.db`, `test.db`; rows=1 | `760845c` and `7b1a970b` listed |
| (ii) `systemctl --user restart xdg-document-portal.service` (`is-active` → `active`) | `test.db` (rows=1) visible; **`new.db` gone** | same 4 entries; rows=1 | `760845c` and `7b1a970b` listed |
| (iii) logout and login (see note) | `test.db` (rows=1) visible | same 4 entries; rows=1 | all 4 test entries listed, same IDs |
| (iv) reboot (see note) | **broken**: `test.db` shows as `-?????????`, `ls: cannot access '/run/user/1000/doc/760845c/test.db': No such file or directory` | **broken**: `ls: cannot access '/run/user/1000/doc/7b1a970b/dir/': No such file or directory` | all entries still listed, same IDs |

Note on (iii): the user logged out and in at about 15:22. This did **not** restart the portal:
`xdg-document-portal` (pid 1305009) still has the start time `15:05:32` (my restart in (ii)), and
`systemctl --user show xdg-document-portal.service -p ActiveEnterTimestamp` gives `15:05:32`. The reason:
`loginctl show-user francisco` gives `Linger=yes` (and other sessions stayed open). With linger, systemd keeps the user
manager, the portal and `/run/user/1000` through a logout. So on this machine (iii) is the same as "no restart", and only a
reboot tests a new user manager. The store is on disk: `~/.local/share/flatpak/db/documents` (mtime 15:14, it changed when
T4 added entries). Raw output: `~/issue370-h2-t3-relogin.log`.

Note on (iv): the user rebooted. Boot time `2026-11-03 15:27:03`, `xdg-document-portal` pid 3105 started `15:27:31`.
Raw output: `~/issue370-h2-t3-reboot.log`.

```
$ ~/issue370-portal/t3check.sh "T3(iv) after reboot"
-- /run/user/1000/doc/760845c/
ls: cannot access '/run/user/1000/doc/760845c/test.db': No such file or directory
drwx------ 2 francisco francisco 0 Jan  1  1970 .
dr-x------ 2 francisco francisco 0 Jan  1  1970 ..
-????????? ? ?         ?         ?            ? test.db
-- /run/user/1000/doc/7b1a970b/dir/
ls: cannot access '/run/user/1000/doc/7b1a970b/dir/': No such file or directory
sqlite3.OperationalError: unable to open database file
```

- The host files are not changed (`~/issue370-portal/file/test.db`, `~/issue370-portal/dir/{test.db,diary.db,new.db,backups/}`).
- The same failure is in the host view of the FUSE mount (`ls -la /run/user/1000/doc/760845c/` on the host).
- **All** entries in the store fail in the same way after the reboot, also the old ones from before today:
  file entries (`760845c`, `68256b8f`, `f4d50bff`) show the file as `-?????????`; folder entries (`7b1a970b`, `727f6870`,
  `5a584563`, `5dcb6075`, `c096c9e9` Downloads, `e81d571f` $HOME) show an empty `dr-x------` doc folder.
- The portal journal for this boot has only the start lines and `Ignoring invalid max threads value 4294967295 > max (100000).`
  No error for the lookups.
- `$HOME` is an **ecryptfs** mount: `/home/.ecryptfs/francisco/.Private on $HOME type ecryptfs (…)`.
  After the reboot: `stat` gives `dev=66` for `$HOME`, `ino=26501000` for `~/issue370-portal/dir`,
  `ino=26501001` for `~/issue370-portal/file/test.db`. I do not have the values from before the reboot.
- Re-pick after the reboot (0.8.0, no override, Create New → Browse… → `~/issue370-portal/dir`): the portal made a
  **new** entry `4ec46c34  $HOME/issue370-portal/dir  /run/user/1000/doc/4ec46c34/dir`. The old `7b1a970b` for the same
  host folder stays in the list and stays broken. The new path works in a new sandbox (4 entries, `select count(*) from t` = 1).
  So after the reboot `REUSE_EXISTING` did not reuse the old entry.

After (ii) the host still has the orphan file `~/issue370-portal/file/.xdp-new.db-SVb1Pv`.

Re-pick (the user, 0.8.0, no override): Open Existing → `file/test.db` (same refusal), and Create New → Browse… → `dir/`.
The Location field showed `/run/user/1000/doc/7b1a970b/` as the user read it. The document list after the re-pick has the
**same IDs** (`760845c`, `7b1a970b`) and no new entries. So the portal reused the existing documents.

### T4 — with a filesystem grant

```
$ flatpak override --user --filesystem=$HOME/issue370-portal io.github.fjrevoredo.mini-diarium
[Context]
filesystems=$HOME/issue370-portal;
```

| Pick (0.8.0, with the override) | Path in the form | Result |
|---|---|---|
| Open Existing → `file/test.db` (already in the store) | `/run/user/1000/doc/760845c` | same refusal text as T1 |
| Create New → Browse… → `dir/` (already in the store) | `/run/user/1000/doc/7b1a970b/dir` | (Cancel) |
| Open Existing → `fresh/fresh.db` (**new**, never picked before) | `/run/user/1000/doc/68256b8f` | same refusal text |
| Create New → Browse… → `freshdir/` (**new**, never picked before) | `/run/user/1000/doc/7…` (truncated in the form) | (Cancel) |

New documents made during T4, with the override active:

```
68256b8f  $HOME/issue370-portal/fresh/fresh.db  /run/user/1000/doc/68256b8f/fresh.db
727f6870  $HOME/issue370-portal/freshdir        /run/user/1000/doc/727f6870/freshdir
```

So with a `--filesystem` grant that covers the item, the file chooser **still** returned `/run/user/…/doc/…` paths, also for
items that were not in the store before. I did not see a real host path in any pick.

Control: in the same override, the sandbox can use the host path directly:

```
$ flatpak run --command=python3 io.github.fjrevoredo.mini-diarium -c "<insert into ~/issue370-portal/fresh/fresh.db; mkdir ~/issue370-portal/fresh/backups>"
direct write ok (1,)
mkdir ok
```

Then `flatpak override --user --reset io.github.fjrevoredo.mini-diarium`; `--show` is empty.

### T5 — Remove and `journals: []`

Clean data folder (I moved the live `~/.var/app/io.github.fjrevoredo.mini-diarium` away for this test), 0.8.0, no override.

1. Before the first create: `data/com.minidiarium/` has only WebKit folders. **No `config.json`.**
2. **+ Create New Journal**, name `t5`, default location, **Add**. `config.json` is written at this step, before the password step:

```json
{
  "diary_dir": "$HOME/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals",
  "journals": [
    { "id": "bb3744bc053eec5b", "name": "t5",
      "path": "$HOME/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals" }
  ],
  "active_journal_id": "bb3744bc053eec5b"
}
```

3. Password `t5` (test value), **Create Journal**, the editor opens. Quit. `config.json` is the same as in step 2.
   `journals/` has `diary.db` and `backups/`.
4. Start again → unlock screen → **← Back to Journals** → **Remove** on `t5`. Confirm dialog: "Remove this journal from
   the list? The journal file will not be deleted." → **OK**. `config.json` right after OK, and again after quit:

```json
{
  "diary_dir": "$HOME/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/journals",
  "journals": [],
  "active_journal_id": ""
}
```

`journals/diary.db` and `journals/backups/` stay on disk.

Comparison: the V1 data from handover 1 and the user's live data (both before any test) have the same shape:
`diary_dir` = `…/com.minidiarium/journals/igpibhjk`, `"journals": []`, `"active_journal_id": ""`.
So **Remove** of the last journal writes exactly this shape. T5 does not show whether the user's data got the shape from a
Remove or from a different action.

### Check of claims C1–C7

| # | Confirmed / contradicted / not tested | Evidence |
|---|---|---|
| C1 | **Contradicted on this system across a reboot.** Confirmed for app restart, portal restart and logout/login (with `Linger=yes`) | T3 (iv): after the reboot every entry is listed but every path fails with `ENOENT`; a re-pick makes a new doc ID. `$HOME` is ecryptfs | T3 (i), (ii): same doc IDs, contents readable and writable in a new sandbox |
| C2 | Confirmed | T2/T4: the folder pick returned a doc path for the folder (`…/7b1a970b/dir`, `…/727f6870/freshdir`); FileChooser version is 4 |
| C3 | **Contradicted on this system** for `as-needed-by-app` | T4: with `--filesystem=$HOME/issue370-portal`, new picks under that folder still got new store entries and `/run/user/1000/doc/…` paths. (Note: the store also has an older grant for all of `$HOME`, `e81d571f`.) Flags 2/8 not tested directly |
| C4 | Confirmed | `GetHostPaths(['760845c','7b1a970b','68256b8f','727f6870'])` from the host returned the 4 host paths; the `user.document-portal.host-path` xattr in the sandbox gave the host path for files and for their doc folder |
| C5 | `REUSE_EXISTING` confirmed; other flags not tested directly | T3 re-pick and T4: re-picking the same file/folder gave the same doc IDs. `PERSISTENT` is consistent with T3 (ii) |
| C6 | Consistent | T1/T2 (c): `pragma journal_mode` = `delete` (the default rollback journal). Write works in both grant types. I did not see the `-journal` file during the transaction |
| C7 | Consistent | The dialog windows belong to `xdg-desktop-portal-gtk` on the host (titles "Seleccionar archivo de diario", "Elegir ubicación"); every pick made a document-store entry. I did not read `Cargo.lock` or `rfd` here |

### Conclusion

- **Is a directory-grant path usable for open, write, new database and `backups/`?** Yes. In T2 all of (b)–(e) work
  through `/run/user/1000/doc/7b1a970b/dir/…`, and the results are real files on the host.
- **Does it stay valid across restart, portal restart, re-login (and reboot)?** Restart, portal restart and logout/login: yes, same path and
  content. The logout did not stop the portal (`Linger=yes`).
  **Reboot: no.** After the reboot the old doc path fails with `ENOENT` (`ls: cannot access '/run/user/1000/doc/7b1a970b/dir/': No such file or directory`), and a re-pick gives a new doc ID. This is true for every entry in the store on this machine (`$HOME` is ecryptfs). I did not test a machine without ecryptfs.
- **Is a file-grant path usable for writes?** Writes to the granted file itself: yes (rollback-journal commit reached the host).
  New files next to it: no real file on the host (only a hidden `.xdp-<name>-<random>` temp file, lost from the sandbox
  view after a portal restart). New folders next to it: no, `mkdir` fails with
  `PermissionError: [Errno 1] Operation not permitted: '/run/user/1000/doc/760845c/backups'`.
- **Open questions for the main-desktop session:**
  - In 0.8.0 the refusal comes for every `/run/user/<uid>/doc/…` path, also for a folder grant that T2/T3 show to be
    writable and persistent. The backend writes no log line for it.
  - The chooser did not return host paths under a `--filesystem` grant (C3). A fix that depends on `as-needed-by-app`
    does not work on this system. Note the old `$HOME` folder grant `e81d571f` in the store; I did not test a store without it.
  - Open Existing gives a **file** grant. A file grant cannot make `backups/` and cannot make real new files next to the
    database. Where does the app write backups for a journal that is opened this way?
  - The user's live `config.json` has the T5 shape. Remove of the last journal is one action that writes it.

### Cleanup

- `flatpak override --user --reset io.github.fjrevoredo.mini-diarium`; `--show` is empty.
- Live data: I moved the folder that T1–T4 used to `~/issue370-run-h2-t1t4` (it had a new window position, localStorage and
  `.ld.so` cache from the runs), and the T5 folder to `~/issue370-run-h2-t5`. Then
  `cp -a ~/issue370-backup2-20261103-150116 ~/.var/app/io.github.fjrevoredo.mini-diarium`.
  `diff -r` between the backup and the live folder: **no difference**.
- `flatpak make-current --user io.github.fjrevoredo.mini-diarium test` → current is `x86_64/test` again (as before). Both branches stay installed.
- Kept: `~/issue370-portal/` (test databases, plus the orphan `file/.xdp-new.db-SVb1Pv`), `~/issue370-run-h2-*`,
  `~/issue370-h2-*.log`, `~/issue370-backup2-20261103-150116`.
- Document store: I did not remove any entry. New entries from this run: `760845c`, `7b1a970b`, `68256b8f`, `727f6870`, and `4ec46c34` (re-pick after the reboot).
- Installed for this run: `agent-desktop@1.0.2` (npm global, Homebrew node prefix). State in `~/.agent-desktop`.

### T6 flatpak info probe

Request from the main-desktop session: `app_has_file_access` in the document portal runs `flatpak info --file-access=PATH APPID`
without a branch. Read-only probe, no install, no restart, no change to the doc store. Done after the reboot (2026-11-03 ~15:31).
Raw output: `~/issue370-h2-t6.log`.

```
$ flatpak list --app --columns=application,branch,installation | grep mini-diarium
io.github.fjrevoredo.mini-diarium	stable	user
io.github.fjrevoredo.mini-diarium	test	user
$ flatpak override --user --show io.github.fjrevoredo.mini-diarium
(empty)
$ flatpak override --user --filesystem=$HOME/issue370-portal io.github.fjrevoredo.mini-diarium
$ flatpak override --user --show io.github.fjrevoredo.mini-diarium
[Context]
filesystems=$HOME/issue370-portal;
$ flatpak info --file-access=$HOME/issue370-portal/dir io.github.fjrevoredo.mini-diarium; echo "exit=$?"
error: Multiple branches available for io.github.fjrevoredo.mini-diarium, you must specify one of: io.github.fjrevoredo.mini-diarium/x86_64/test, io.github.fjrevoredo.mini-diarium/x86_64/stable
exit=1
$ flatpak info --file-access=$HOME/issue370-portal/dir io.github.fjrevoredo.mini-diarium//stable; echo "exit=$?"
read-write
exit=0
$ flatpak info --file-access=$HOME/issue370-portal/dir io.github.fjrevoredo.mini-diarium/x86_64/stable; echo "exit=$?"
read-write
exit=0
$ flatpak info --file-access=$HOME/issue370-portal/dir io.github.fjrevoredo.mini-diarium//test; echo "exit=$?"
read-write
exit=0
$ flatpak info --file-access=$HOME/issue370-portal/dir io.github.fjrevoredo.mini-diarium/x86_64/test; echo "exit=$?"
read-write
exit=0
$ flatpak override --user --reset io.github.fjrevoredo.mini-diarium
$ flatpak override --user --show io.github.fjrevoredo.mini-diarium; echo "show-exit=$?"
(empty)
show-exit=0
```

Facts: with two branches installed, the command without a branch fails with exit 1. With a branch (`//stable`, `//test`) or the
full ref it gives `read-write` for the folder under the override. I did not test the portal with only one branch installed.

### T7 single branch, static permission

Request from the main-desktop session (the user approved the test there). I asked the user before the uninstall and before
the reboot. GUI steps: done by me with `agent-desktop` (X11 clicks on Fenmark, AT-SPI refs in the GTK chooser), each step
checked with a screenshot. Test password: `t7`.

#### Setup

```
$ flatpak list --app --columns=application,branch,origin,version,installation | grep mini-diarium
io.github.fjrevoredo.mini-diarium	stable	flathub	0.8.0	user
io.github.fjrevoredo.mini-diarium	test	mini-diarium-origin	0.6.6	user
$ flatpak info --user io.github.fjrevoredo.mini-diarium//test
         Ref: app/io.github.fjrevoredo.mini-diarium/x86_64/test
     Version: 0.6.6
      Origin: mini-diarium-origin
  Collection: org.flathub.Test.Build309120
      Commit: dd7a9cb90b18a995aec6cf46ab0d93667c782e974c9848385a515d09801ee430
     Subject: Update to 0.6.6 (79bd7f7fcf5a)
        Date: 2026-08-08 14:01:23 +0000
$ flatpak remotes --user --columns=name,url,options
flathub	https://dl.flathub.org/repo/
mini-diarium-origin	https://dl.flathub.org/build-repo/309120	no-enumerate
$ flatpak override --user --show io.github.fjrevoredo.mini-diarium
(empty)
```

- Current branch before T7: `x86_64/test`.
- `curl -sI https://dl.flathub.org/build-repo/309120/summary` → `HTTP/2 404`. The remote cannot reinstall the `test` build.
  Before the uninstall I exported it: `flatpak build-bundle ~/.local/share/flatpak/repo ~/issue370-t7-test-0.6.6.flatpak io.github.fjrevoredo.mini-diarium test`
  (17 581 648 bytes). Restore with `flatpak install --user ~/issue370-t7-test-0.6.6.flatpak` (not tested).
- Data backup: `cp -a ~/.var/app/io.github.fjrevoredo.mini-diarium ~/issue370-t7-data-backup`.
- The user approved the uninstall. `flatpak uninstall --user -y io.github.fjrevoredo.mini-diarium//test` → `Uninstall complete.`
  Now only `stable 0.8.0` stays, current = `x86_64/stable`. `~/.var/app/io.github.fjrevoredo.mini-diarium` is still there.
- Control:

```
$ flatpak override --user --filesystem=home io.github.fjrevoredo.mini-diarium
$ flatpak override --user --show io.github.fjrevoredo.mini-diarium
[Context]
filesystems=home;
$ flatpak info --file-access=$HOME/issue370-t7 io.github.fjrevoredo.mini-diarium; echo exit=$?
read-write
exit=0
```

#### T7a, scope `home`

Create (`mkdir -p ~/issue370-t7/real`; 0.8.0; Create New → Browse… → `~/issue370-t7/real`; name `t7`, filename `t7.db`):

- Location in the form: `/home/francisco/iss…` (truncated on screen). It is a **host path**, not `/run/user/…`.
- `flatpak documents … | grep t7` → no entry. The pick made **no** document-store entry.
- `config.json` right after **Añadir** (before the password step):

```json
{
  "diary_dir": "$HOME/issue370-t7/real",
  "journals": [
    { "id": "a880cc197b4b0813", "name": "t7", "path": "$HOME/issue370-t7/real", "db_filename": "t7.db" }
  ],
  "active_journal_id": "a880cc197b4b0813"
}
```

  Note: `diary_dir` changed from `…/com.minidiarium/journals/igpibhjk` (live data) to the new folder at this step.
- Password `t7` → **Crear diario** → editor. On the host: `~/issue370-t7/real/t7.db` (118784 bytes). I wrote the entry
  "t7 entry" ("2 palabras"), then locked. After the lock the host has `~/issue370-t7/real/backups/` with
  `backup-2026-11-03-16h00m03.db` and `manifest.json` (real files on the host).

Remove and Open Existing:

- Volver a los diarios → **Eliminar** → dialog "¿Eliminar este diario de la lista? El archivo del diario no se borrará." → OK.
  `config.json`: `{"diary_dir": "$HOME/issue370-t7/real", "journals": [], "active_journal_id": ""}`. `t7.db` and `backups/` stay.
- **+ Abrir existente** → pick `~/issue370-t7/real/t7.db`. The form shows `/home/francisco/issue370-t7/real`, name `t7`.
  No new document-store entry.
- **Abrir** → **accepted**, no refusal. The unlock screen "Desbloquear t7" opens. `config.json`:

```json
{
  "diary_dir": "$HOME/issue370-t7/real",
  "journals": [
    { "id": "369be2b62ff55840", "name": "t7", "path": "$HOME/issue370-t7/real", "db_filename": "t7.db" }
  ],
  "active_journal_id": "369be2b62ff55840"
}
```

- Unlock with `t7` → works; the entry "t7 entry" is there. Then lock and quit.

Reboot: PENDING (asked the user).
