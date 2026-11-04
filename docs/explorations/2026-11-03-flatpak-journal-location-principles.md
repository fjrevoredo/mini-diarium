# Flatpak Journal Locations: Findings, Data, and Principles (issue #370)

**Date:** 2026-11-03
**Status:** Exploration (no code changes). **Decision (2026-11-03, maintainer):** add a static filesystem permission (`home` + `/run/media` + `/media` + `/mnt`) to the Flathub manifest (see §7). Recorded in the ADR [2026-11-flatpak-static-filesystem-permission.md](../decisions/2026-11-flatpak-static-filesystem-permission.md). F12 is tracked as TODO-0164.
**Issue:** [#370](https://github.com/fjrevoredo/mini-diarium/issues/370), Flathub build: "Open Existing" refuses a `.db` file outside the sandbox.
**Evidence files:** [ISSUE_370_WORKBOOK_HANDOVER.md](../wip/ISSUE_370_WORKBOOK_HANDOVER.md) (run 1), [ISSUE_370_WORKBOOK_HANDOVER_2.md](../wip/ISSUE_370_WORKBOOK_HANDOVER_2.md) (run 2: T1 to T6), [CREATE_JOURNAL_FAILURE_2026-07-30.md](../wip/CREATE_JOURNAL_FAILURE_2026-07-30.md) (the July report that caused the v0.6.6 guard).

## Question

What must the app do with journal locations, what does the Flatpak sandbox model give, and where do the two not agree? This document records the facts first. It does not choose a fix.

## Summary

- The app treats a journal as **a folder that the app owns**: the database file plus sibling files (SQLite `-journal`, `.restoring.tmp`, `.staging`) plus a `backups/<stem>/` folder. The app stores the path in `config.json` and opens it again later, after restarts and reboots, with no user action.
- The Flatpak model gives an app **no access** outside its sandbox by default. Access comes from (1) static permissions (`finish-args`, or a user override) or (2) the document portal, which gives access to **the items that the user picked**, through a FUSE path `/run/user/<uid>/doc/<id>/…`.
- They do not agree in three places:
  1. **Scope.** A pick of one file gives access to that file only. The app needs the folder around it. (Upstream design. No fix is planned.)
  2. **Durability.** The portal records a grant by device and inode number. On ecryptfs, btrfs and LVM the device number can change after a reboot, and then every old grant fails. (Upstream bug, fixed in xdg-desktop-portal 1.21.2, May 2026. The Workbook has 1.20.0.)
  3. **Identity.** The path that the app gets is a portal path, not the real path. Users do not know it, and upstream calls it a bug to show it ([#973](https://github.com/flatpak/xdg-desktop-portal/issues/973)).
- The v0.6.6 guard has the correct symptom ("a portal path stops working later") but the wrong reason ("temporary"). The advice in commit `3a20013` (use Flatseal) did not work on the Workbook in run 2, because two branches were installed (F7). T7 (§7.5) shows that it works with one branch. So only the "temporarily" reason was wrong; it was corrected on 2026-11-04.

## 1. What the app wants (from the principles and the current design)

| ID | Requirement | Source |
|---|---|---|
| R1 | The user can put the journal file in any folder, for example a cloud-synced folder. | PHILOSOPHY.md §5: "you can put the `.db` in any cloud-synced folder" |
| R2 | The user can open an existing `.db` from any location ("easy in"). | PHILOSOPHY.md §4; the reporter of #370 expects this |
| R3 | A journal that works today works after an app restart and a reboot, with no user action. | Current design: `config.json` `JournalConfig` stores `path` + `db_filename` and opens them later |
| R4 | The app can make sibling files next to the database: SQLite `-journal`/`-wal`/`-shm` (always in the same folder as the DB, [SQLite tempfiles](https://www.sqlite.org/tempfiles.html)), `<name>.restoring.tmp`, `<name>.staging`. | `crates/mini-diarium-core/src/config.rs` (`MAX_DB_FILENAME_BYTES` comment) |
| R5 | The app can make and write `backups/<stem>/` next to the database. | `config.rs:324` (`dir.join("backups").join(stem)`) |
| R6 | The user sees the real location of the journal. | Usability; xdg-desktop-portal #973 |
| R7 | The app asks for the smallest access it needs. The threat model is honest. | PHILOSOPHY.md §2 "Boring Security", Non-negotiable "Honest threat documentation" |
| R8 | The solution is simple and testable. | PHILOSOPHY.md §3, §6 |
| R9 | The app never uses the network. | Non-negotiable (not affected by this issue) |

R1 to R5 come from one model: **a journal location is a path in a folder that the app controls.** This model is correct on Windows, macOS and native Linux.

## 2. The Flatpak model

### 2.1 Static permissions

- The manifest `finish-args` declare permanent access. Our Flathub manifest (`flatpak/io.github.fjrevoredo.mini-diarium.yml`) declares only `--socket=wayland`, `--socket=fallback-x11`, `--share=ipc`, `--device=dri`. **No filesystem access.**
- A user can add access with `flatpak override --user --filesystem=<path>` or with Flatseal. The grant must be persistent; `flatpak run --filesystem=` does not count for the portal ([flatpak #5413](https://github.com/flatpak/flatpak/issues/5413), maintainer comment).
- With a static grant, the sandbox sees the real path. The Workbook control test showed this: under the override the sandbox wrote `~/issue370-portal/fresh/fresh.db` and made `backups/` with the host path (handover 2, T4).

### 2.2 The FileChooser and Documents portals

- An app in the sandbox opens the file dialog through the FileChooser portal. Our stack: `tauri-plugin-dialog` 2.8.3 → `rfd` 0.16 (gtk3) → `gtk_file_chooser_native_new` → portal.
- The portal adds each picked item to the document store with the flags `REUSE_EXISTING | PERSISTENT | AS_NEEDED_BY_APP`, plus `DIRECTORY` for a folder ([`xdp-documents.c`](https://github.com/flatpak/xdg-desktop-portal/blob/main/src/desktop-portal/xdp-documents.c)).
- The app gets a path under the FUSE mount `/run/user/<uid>/doc/<id>/<name>`.
- **File grant** (`<id>/<file>`): the app can read and write that file in place. It cannot make other files in the folder. A new file appears on the host only as a hidden `.xdp-<name>-XXXXXX` file, on purpose, for atomic rename ([xdp #2000](https://github.com/flatpak/xdg-desktop-portal/issues/2000), maintainer comment). There is no portal for "a file plus its neighbours" ([xdp #463](https://github.com/flatpak/xdg-desktop-portal/issues/463), open since 2020; [flatpak #3842](https://github.com/flatpak/flatpak/issues/3842) closed in favour of it).
- **Folder grant** (`<id>/<folder>/…`): the app can read, write and make files and subfolders in the folder. The `directory` option exists since FileChooser v3 ([FileChooser docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html)).
- **`AS_NEEDED_BY_APP`:** if the app already has static access to the item, the portal returns the real path and adds no document. To check this, the portal runs `flatpak info --file-access=PATH APPID` with **no branch**. If that command fails, a fallback accepts only `host` and `home` grants (`document-portal.c`, `app_has_file_access` and `app_has_file_access_fallback`, tag 1.20.0).
- **Persistence (documented):** "Files added to the Documents portal by this portal stay accessible across sessions" (FileChooser docs).
- **Persistence (implementation):** each document entry stores the `st_dev` and `st_ino` of the item (or of its folder). Each access compares them with the live values. If they differ, the access fails with `ENOENT` (`document-portal-fuse.c` `verify_doc_dir_devino`; `document-portal.c` ~line 421). `st_dev` is not stable across reboots on btrfs, LVM and ecryptfs ([xdp #1362](https://github.com/flatpak/xdg-desktop-portal/issues/1362)). [PR #1950](https://github.com/flatpak/xdg-desktop-portal/pull/1950) replaces this with `name_to_handle_at` file handles and updates old entries. It was merged on 2026-05-05 and is in **1.21.2 and later**.
- **Host path:** `GetHostPaths` (Documents v5, [PR #1364](https://github.com/flatpak/xdg-desktop-portal/pull/1364), 1.19.0+) and the xattr `user.document-portal.host-path` give the real path of a document ([Documents docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Documents.html)).
- **SQLite on the FUSE mount:** before 1.19.0, SQLite fails there (`ELOOP` from `O_NOFOLLOW`, no `fcntl` locks: [xdp #1117](https://github.com/flatpak/xdg-desktop-portal/issues/1117)). [PR #1195](https://github.com/flatpak/xdg-desktop-portal/pull/1195) fixed it (merged 2023-11-15). By git ancestry it is in 1.19.0+, not in the 1.18.x tags. (Backports to 1.18.x not checked.) `flock` is still not supported ([PR #1353](https://github.com/flatpak/xdg-desktop-portal/pull/1353) closed without a merge); SQLite uses `fcntl` locks, so this does not affect us.
- **Store loss:** the documents database can become empty or corrupt ([xdp #627](https://github.com/flatpak/xdg-desktop-portal/issues/627), open). Then all grants are lost.

### 2.3 What the Flatpak model expects from an app

The model expects one of two app types:

- **Document apps** open what the user picks now, and they ask again next time (or keep a "recent" list that can break). A broken grant is a normal event.
- **Apps with a declared area** get static permissions (for example `xdg-documents`) and use real paths.

A "folder the app owns, at a location the user chose, that must open again with no user action" is not a first-class case in either type.

## 3. Comparison

| Requirement | Static permission (none now) | Portal: file grant | Portal: folder grant |
|---|---|---|---|
| R1 any folder | Only inside the declared area | Yes | Yes |
| R2 open existing `.db` | Only inside the area | Yes (pick the file) | The user must pick the folder, not the file |
| R3 survives restart | Yes | Yes (T3 i, ii) | Yes (T3 i, ii) |
| R3 survives reboot | Yes | **No** on ecryptfs/btrfs/LVM with portal < 1.21.2 (T3 iv) | **No**, same |
| R4 sibling files | Yes | **No** (T1: `.xdp-*` hidden file) | Yes (T2) |
| R5 `backups/` | Yes | **No** (T1: `EPERM` on `mkdir`) | Yes (T2) |
| R6 real path visible | Yes | Only through xattr / `GetHostPaths` (1.19.0+) | Same |
| R7 least access | Broad, permanent, also when the user did not pick | Narrow | Narrow, the folder only |
| R8 simple | Yes | No (R4, R5 fail) | Needs a re-pick path when a grant breaks |
| SQLite works | Yes | Portal 1.19.0+ only | Portal 1.19.0+ only |

No column meets all requirements on the portal versions that most users have now.

## 4. Findings and data

| ID | Finding | Evidence |
|---|---|---|
| F1 | The 0.7.6 → 0.8.0 update does not lose the journal list. | Run 1, all variants |
| F2 | "No journals yet" in the issue screenshot: Remove of the last journal writes `{"journals": [], "diary_dir": …}`. `load_journals` migrates `diary_dir` only when the `journals` key is absent. Not a 0.8.0 regression. | Run 2, T5 |
| F3 | Open Existing on any portal path is refused by `check_journal_location` (`src-tauri/src/commands/auth/auth_journals.rs`, `is_portal_path`). The refusal text says the folder is shared "temporarily". | Code; issue screenshot |
| F4 | File grant: read and in-place write work. `mkdir backups` → `PermissionError: [Errno 1] Operation not permitted`. A new file shows on the host only as `.xdp-<name>-XXXXXX` and is gone after a portal restart. | Run 2, T1; xdp #2000 |
| F5 | Folder grant: read, write, new DB, `mkdir backups` all work. The same doc ID after app restart, portal restart, logout/login (with linger) and a re-pick. | Run 2, T2, T3 i to iii |
| F6 | After a reboot, **every** document entry on the Workbook fails with `ENOENT`, in the sandbox and in the host FUSE view. Entries are still listed with the same IDs. Host files are unchanged. A re-pick makes a new ID (`4ec46c34`) that works. `$HOME` is ecryptfs. | Run 2, T3 iv; xdp #1362, PR #1950 |
| F7 | With `flatpak override --user --filesystem=$HOME/issue370-portal`, the chooser still returned portal paths. Cause: two branches (`stable`, `test`) are installed, so `flatpak info --file-access=… io.github.fjrevoredo.mini-diarium` fails ("Multiple branches available", exit 1). With a branch it returns `read-write`. A normal Flathub install has one branch; that case is not tested. | Run 2, T4 and T6; `document-portal.c` `app_has_file_access` |
| F8 | Run 1 V4: Open Existing with a `--filesystem` grant was refused in 0.7.6 and 0.8.0. Same cause as F7 (two branches). | Run 1, V4 |
| F9 | SQLite works on the portal mount on the Workbook (portal 1.20.0). | Run 2, T1, T2 |
| F10 | The host path is readable from `user.document-portal.host-path`. | Run 2, claim C4 |
| F11 | The July 2026 report ("journal stops opening later") fits F6. Not verified against the July data. | CREATE_JOURNAL_FAILURE_2026-07-30.md |

**Workbook versions:** xdg-desktop-portal 1.20.0, xdg-desktop-portal-gtk 1.15.1, Documents portal v5, FileChooser v4, Flatpak 1.14.6. App `io.github.fjrevoredo.mini-diarium//stable` 0.8.0 and `//test` 0.6.6 (user installation). Home on ecryptfs. Not tested: a home without ecryptfs, a single-branch install, a portal ≥ 1.21.2.

**Not known:** which portal version each target distro ships. Check this before any decision that depends on 1.19.0 or 1.21.2.

## 5. Committed work that is wrong (commit `3a20013`, branch `handover/issue-370-flatpak-repro`)

- `errors.portalPathRejected` (all locales): "temporarily". The grant is persistent by design; it breaks because of F6 and F4.
- `auth.picker.portalHelp`, `auth.picker.portalHelpLink`, and the portal-help block in `JournalPicker.tsx`: advise Flatseal. F7/F8: not proven to help; it did not help on the Workbook.
- The same advice in `website/docs-src/00-getting-started.md` (and generated output, `llms-full.txt`), `docs/KNOWN_ISSUES.md` KI-10, `CHANGELOG.md` [Unreleased], `docs/todo/TODO.md` TODO-0163.
- The reporter-comment drafts from the earlier session: do not post.

**Note (2026-11-04, after T7):** T7 (§7.5) proves that the Flatseal advice works when only one branch of the app is installed. The earlier failure (F7, F8) came from two installed branches. So the Flatseal advice stays; only the "temporarily" reason was wrong. The strings, docs, KI-10, CHANGELOG and TODO-0163 now give the real reasons (F4, F6), tell the user to restart the app after the Flatseal change, and KI-10 states the two-branch limit.

## 6. Questions to answer before a design

1. Must a journal **location** be durable on Flatpak (R3), or can the app treat a non-sandbox location as "re-pick when it breaks", like a document app?
2. Must the app **own a folder** (R4, R5), or can a journal outside the sandbox be only one file? (For example: backups always go into the sandbox, and SQLite uses a mode that makes no sibling file.) Each part has a cost: SQLite needs the `-journal` file for atomic commits.
3. Is a static permission acceptable under R7? If yes, which scope (`xdg-documents`, `home`, none)? Flathub review asks for a reason.
4. Must R2 (open a `.db` from any location) mean "use it in place", or is "import a copy into the app's area" sufficient?
5. Which portal versions must we support? (1.19.0 for SQLite, 1.21.2 for stable grants.)
6. What is the user flow when a stored location stops working (F6, xdp #627)?

## 7. Answers from the maintainer (2026-11-03) and what follows

| Question | Answer |
|---|---|
| 1. Durable with no user action? | **Yes, it must survive a reboot with no user action.** |
| 2. Own the folder? | Ideally yes. The app design moves to owning only the DB file. |
| 3. Static permission? | Possible. |
| 4. Open existing `.db`: in place or copy? | **In place.** |
| 5. Portal versions? | Not known. Researched below. |

### 7.1 Portal versions per distribution

Source: Repology API (`https://repology.org/api/v1/project/xdg-desktop-portal`), read on 2026-11-03. When a repository lists two versions, the higher one is normally from the updates channel.

| Distribution | xdg-desktop-portal | SQLite on portal (≥ 1.19.0) | Grants survive reboot on btrfs/ecryptfs/LVM (≥ 1.21.2) |
|---|---|---|---|
| Ubuntu 22.04 LTS | 1.14.4 | No | No |
| Ubuntu 24.04 LTS (and Linux Mint 22) | 1.18.4 | **No** | No |
| Ubuntu 25.10 | 1.20.3 | Yes | No |
| Ubuntu 26.04 LTS | 1.21.1 | Yes | **No** (one point release too old) |
| Debian 12 | 1.16.0 | No | No |
| Debian 13 | 1.20.3 | Yes | No |
| Fedora 43 (btrfs default) | 1.20.4 | Yes | No |
| Fedora 44 | 1.22.1 | Yes | Yes |
| openSUSE Leap 15.6 | 1.18.2 | No | No |
| openSUSE Tumbleweed, Arch, Void | 1.22.1 | Yes | Yes |
| RHEL 9 family (Alma, Rocky) | 1.12.6 | No | No |
| CentOS Stream 10 | 1.20.0 | Yes | No |

Ubuntu's encrypted install uses LVM, and Fedora uses btrfs, so the reboot bug can affect them. A plain ext4 install without LVM probably keeps `st_dev` stable. This is not tested.

### 7.2 Consequence for each mechanism

- **Portal only (file or folder grant):** fails answer 1 on almost all LTS and stable distributions. On Ubuntu 24.04, Debian 12 and the RHEL 9 family, SQLite does not work on the portal mount at all. When most users have portal 1.21.2 or later, this changes. With these versions, that will take years (Ubuntu 26.04 LTS has 1.21.1). This is true for every portal design, also for a design that owns only the DB file.
- **Static filesystem permission:** the sandbox sees real paths. These paths survive reboots and do not depend on the portal version. The app owns the folder and can make sibling files and `backups/`. The FileChooser returns the real path for items in the granted area (`AS_NEEDED_BY_APP`). It meets answers 1, 2 and 4 **inside the granted area**. Outside it, the chooser still returns a portal path.
- **Scope of a static permission:**
  - `xdg-documents`: only `~/Documents`. Cloud-sync folders such as `~/Dropbox` or `~/Nextcloud` are outside it.
  - `home`: all of `$HOME`, including synced folders. External drives (`/media`, `/run/media`, `/mnt`) are outside it.
  - `host`: everything except system folders. This is the broadest scope.

### 7.3 Flathub policy (docs read on 2026-11-03)

- [Requirements → Permissions](https://docs.flathub.org/docs/for-app-authors/requirements): "Static permissions must be kept to an absolute minimum." A portal is mandatory when it "exists, is supported across the ecosystem, and covers the application's use case". "Exceptions to this can be allowed on a case by case basis."
- [Linter](https://docs.flathub.org/docs/for-app-authors/linter): plain `--filesystem=home`, `--filesystem=host` and `xdg-documents` have no linter error ID. Moderators approve permissions separately.
- Our argument for an exception: on the ecosystem's current versions, the portal does not cover the use case (F4, F6, 7.1).
- Not checked: how software centres (GNOME Software, KDE Discover) show a `home` or `host` permission to users before they install.

### 7.4 Security cost (R7)

The app has no network access, which is a non-negotiable. So a static permission adds no new path for data to leave the machine. The sandbox then protects less against a compromised app or a malicious plugin that reads files under `$HOME`. Rhai plugins have no filesystem API (verified 2026-11-04; one gap: Rhai's default `FileModuleResolver` let a plugin `import` other `.rhai` scripts by path; closed with a `DummyModuleResolver`, see the ADR). The threat documentation (PRIVACY.md, KI-10) must state the permission honestly.

### 7.5 T7: static permission with one branch (Workbook, 2026-11-03)

Full output: [ISSUE_370_WORKBOOK_HANDOVER_2.md](../wip/ISSUE_370_WORKBOOK_HANDOVER_2.md), section "T7 single branch, static permission" (commits `3610431`, `a5310e0`). The `test` branch was uninstalled first, so only `stable` 0.8.0 was installed.

| Step | Result |
|---|---|
| `filesystems=home`: `flatpak info --file-access=$HOME/issue370-t7` | `read-write`, exit 0 (F7 is confirmed: the earlier failure came from two branches) |
| `home`: Create New → Browse → `~/issue370-t7/real` | Host path in the form and in `config.json`. `t7.db` and `backups/` are real host files. No document-store entry |
| `home`: Remove, then Open Existing → `t7.db` | Host path. **Accepted.** Unlock works |
| `home`: reboot, start, unlock with no new pick | **Works.** Answer 1 is met |
| `xdg-documents`: Open Existing → `~/Documents/issue370-t7/t7.db` | Host path. Accepted. Unlock works. `backups/` made on the host |
| `xdg-documents`: Open Existing → `~/issue370-t7/real/t7.db` (outside the grant) | Portal path `/run/user/1000/doc/3a4cb371`, new document entry. Refused with the portal message |

**F12 (new, not specific to Flatpak in its cause):** when a stored journal path cannot be reached (here: `flatpak info --file-access` = `hidden` after the scope changed to `xdg-documents`), 0.8.0 shows the **new-journal screen** ("Create a password to protect your journal") with no error. The log shows only "Switched to journal". Cause: `diary_exists` (`src-tauri/src/commands/auth/auth_core.rs:331`) returns `Path::exists()`, which is `false` for every error (`ENOENT`, `EACCES`, a broken portal grant). The user can think that the journal is lost. The same screen probably shows when a portal grant breaks after a reboot (F6), and on any platform when a removable drive or network share is not mounted. `create_diary` does not make missing folders, so a click on Create probably fails. But if the folder exists (for example an empty mount point), the app makes a new empty journal there. Not tested.

### 7.6 Will Flathub approve `home` + `/run/media` + `/media` + `/mnt`? (research, 2026-11-03)

**How the change gets reviewed.** The app is already on Flathub, so this is an update, not a new submission. An update that adds static permissions is reviewed by a moderator: the bot posts the permission diff on the PR (`flathub/permissions` status), "explain why the application needs the exact access in the pull request", and the official build "can be held for moderation if its permissions still need approval" ([Maintenance](https://docs.flathub.org/docs/for-app-authors/maintenance)). A moderator can approve, reject (flathubbot opens an issue in the app repo), or ask for more information. Passing the linter does not approve permissions ([Linter](https://docs.flathub.org/docs/for-app-authors/linter)).

**Linter.** `home` and `host` no longer have a linter error: `flatpak-builder-lint` commit `1d036a85` (2026-10-23, "Remove non-blocking permission checks") removed `finish-args-home-filesystem-access` and similar checks; review is now by moderators only. The rules that remain for us: `/run/media` must be the root, not a subfolder (`finish-args-absolute-run-media-path`, never excepted); `/media` and `/mnt` are not reserved paths (`finish_args.py`, reserved list). So the planned four lines pass the linter.

**Policy.** "Static permissions must be kept to an absolute minimum"; the portal is mandatory when it "exists, is supported across the ecosystem, and covers the application's use case"; "Exceptions … case by case" ([Requirements](https://docs.flathub.org/docs/for-app-authors/requirements)).

**What moderators did in comparable cases (flathub/flathub, 2025–2026):**

| PR | Request | Moderator response |
|---|---|---|
| [#10100](https://github.com/flathub/flathub/pull/10100) (file manager) | `host` | "We cannot give you host … would you be fine with only home and media access?" (teamcons, 2026-09-06). Home + media was the offered compromise. |
| [#10653](https://github.com/flathub/flathub/pull/10653) (photo viewer) | `home`, later `xdg-pictures` + mount points | "You can request access to a folder in its entirety … we will prefer you use the portal if at all possible." Leaning to reject for "heavy AI usage and concerns over future maintainability". Closed, not merged. |
| [#10856](https://github.com/flathub/flathub/pull/10856) (PDF tools) | `home` after a portal-only first try | Justification: the GNOME portal shares a picked folder read-only, so output cannot be written. Open, no decision yet. |

Existing apps in the same category, for reference only (many are grandfathered): Obsidian has exactly `home`, `/mnt`, `/run/media`, `/media`; Logseq and draw.io have `home`; KeePassXC has `host`; Joplin and Standard Notes have no broad access.

**Our case against the policy.** The portal exists, but it does not cover the use case on the current ecosystem:
- an SQLite journal needs sibling files (`-wal`, `-journal`) and a `backups/` folder next to the `.db`; a file grant cannot give them (F4);
- grants break after a reboot on portal < 1.21.2 (F6; all LTS distributions, §7.1), and a vfat USB drive has no stable inode numbers, so a grant on it is not expected to survive a replug (#370);
- SQLite fails on the portal mount with portal < 1.19.0 (Ubuntu 24.04, Debian 12, RHEL 9);
- the app has no network permission, so the added access gives no path for data to leave the machine (§7.4).
A folder grant (the moderator's suggestion in #10653) fixes F4 but not F6 or the SQLite version limit. The ADR must say this explicitly, because it is the first thing a moderator will suggest.

**Assessment (judgement, not a Flathub statement).** `home` + media mount roots is the scope that a moderator offered as acceptable in #10100, and our reasons are concrete and testable. Approval is likely but not certain. The weakest part is `/mnt` (a manual mount point, less common for a journal app); be ready to drop it if a moderator asks.

**Risk: Flathub generative-AI policy.** [Requirements](https://docs.flathub.org/docs/for-app-authors/requirements): "Flathub manifests must not contain AI-generated or AI-assisted content. Disclosure does not exempt manifests from this restriction." "AI tools or agents must not open or automate Flathub submission pull requests." "Any future update or modification … that would have affected the review outcome may trigger a re-review." Consequences: (1) the maintainer must write the `finish-args` lines in the manifest by hand, and the justification on the Flathub PR in their own words; (2) a held build makes a moderator look at the app, and #10653 shows that "heavy AI usage" can be a reason to reject. The policy does not apply retroactively, but a permission change is a new review point. Our `flathub-publish.yml` opens the Flathub PR by CI (not an AI agent); confirm with the maintainer that this stays acceptable.

## Sources

- FileChooser portal: <https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html>
- Documents portal: <https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Documents.html>
- SQLite temporary files: <https://www.sqlite.org/tempfiles.html>
- xdg-desktop-portal source, tag 1.20.0: `document-portal/document-portal.c`, `document-portal/document-portal-fuse.c`; `src/desktop-portal/xdp-documents.c` (main)
- xdg-desktop-portal issues and PRs: [#463](https://github.com/flatpak/xdg-desktop-portal/issues/463), [#627](https://github.com/flatpak/xdg-desktop-portal/issues/627), [#973](https://github.com/flatpak/xdg-desktop-portal/issues/973), [#1007](https://github.com/flatpak/xdg-desktop-portal/pull/1007), [#1117](https://github.com/flatpak/xdg-desktop-portal/issues/1117), [#1195](https://github.com/flatpak/xdg-desktop-portal/pull/1195), [#1269](https://github.com/flatpak/xdg-desktop-portal/pull/1269), [#1353](https://github.com/flatpak/xdg-desktop-portal/pull/1353), [#1362](https://github.com/flatpak/xdg-desktop-portal/issues/1362), [#1364](https://github.com/flatpak/xdg-desktop-portal/pull/1364), [#1950](https://github.com/flatpak/xdg-desktop-portal/pull/1950), [#2000](https://github.com/flatpak/xdg-desktop-portal/issues/2000)
- flatpak issues: [#3842](https://github.com/flatpak/flatpak/issues/3842), [#5413](https://github.com/flatpak/flatpak/issues/5413)
- Release ancestry checked with `gh api repos/flatpak/xdg-desktop-portal/compare/<merge-sha>...<tag>` on 2026-11-03.
