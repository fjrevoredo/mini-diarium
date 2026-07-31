# Handoff: user report — "A file operation failed" on Create Journal (Flatpak)

**Status:** diagnosis in progress, no code changed. Blocked on two validations.
**Date:** 2026-07-30
**Next action:** run the Windows reproduction in [§5](#5-validation-to-run-on-windows), and
ask the user for his `config.json` ([§6](#6-data-needed-from-the-user)).

---

## 1. The report

User (Jon, `smith.jon@gmx.co.uk`) cannot create a journal on the Flathub build. The Create
Journal screen shows **"A file operation failed. Check that you have the necessary
permissions."**

Confirmed sequence, from his follow-up email:

1. Install AppImage
2. Install Flatpak
3. Delete both versions
4. **Delete all journals**
5. Reinstall Flatpak
6. Cannot create a new journal

His words: *"I have deleted both, also the user file that I am requested to name. The journal
is locked… I am unable to set a password after Flatpak install."*

## 2. A wrong turn worth recording

An initial pass concluded the **Flatpak build was fundamentally unable to create a journal**
— reasoning from `finish-args` having no `--filesystem=*` entries plus a non-portal
in-sandbox GTK file chooser, so "no writable folder can be picked."

**That conclusion was wrong.** The maintainer has used the Flatpak for months and created
journals in it successfully. The sandbox *narrows* which directories work; it does not block
them. Empirical evidence that a feature works beats a static-analysis argument that it
cannot.

The sandbox findings are still real, but they are **contributing factors** ([§4](#4-contributing-factors-real-but-not-the-cause)),
not the cause.

## 3. What is provable from the code

### Bug 1 — removing all journals leaves the app on a stale directory and skips the picker

Platform-independent, and it matches step 4 of his sequence exactly.

| Step | Location | Behaviour |
|---|---|---|
| 1 | `src-tauri/src/commands/auth/auth_journals.rs:112` | Removing the last journal calls `save_journals(app_data_dir, &[], "")` → `active_journal_id: Some("")` |
| 2 | `crates/mini-diarium-core/src/config.rs:147-149` | `save_journals` refreshes `diary_dir` only when a journal matches `active_id`. An empty list never matches → **`diary_dir` keeps the removed journal's path** |
| 3 | `src-tauri/src/lib.rs:157-178` | `journals` is `Some([])` → empty branch runs `load_diary_dir(&app_dir).filter(\|p\| p.is_dir())` → app silently targets the abandoned directory (falls back to `app_dir` only if it no longer exists) |
| 4 | `src/state/auth.ts:80` | `initializeAuth` gates on `activeJournalId() !== null`, but the backend returned `""`. Not null → takes the "have an active journal" branch → no match → `refreshAuthState()` → `journalExists()` false → `'no-journal'` → **PasswordCreation, picker skipped** |

That `""` means "unset" is not an inference: `auth_journals.rs:57` already does
`load_active_journal_id(...).filter(|s| !s.is_empty())`. **The backend guards for the empty
string in one place and leaks it in another.**

### Bug 2 — the real cause is discarded, so this report cannot be diagnosed

- `create_diary` (`src-tauri/src/commands/auth/auth_core.rs:256-278`) propagates
  `create_database(...)?` with **no `log::error!`** — nothing reaches stderr or the
  `log_capture` ring buffer, so nothing reaches the debug dump.
- `mapTauriError` (`src/lib/errors.ts:58-60`) matches
  `/failed to (read|write|create|copy|open)/i` → `errors.fileOperationFailed`
  (`src/i18n/locales/en.ts:750`). **At least six distinct backend errors collapse into that
  one sentence.**
- Worse, the ordering mislabels non-permission failures:
  `"Failed to create schema: disk I/O error"` (`crates/mini-diarium-core/src/db/schema/create.rs:220`)
  hits the filesystem regex **before** the `/rusqlite|sqlite|argon2/` → `internalError`
  branch at `errors.ts:61`.

Net: the message provably originates at `create.rs:16` (`"Failed to open database: …"`) or
`create.rs:220` (`"Failed to create schema: …"`), but **which one, and the OS error, are
unknowable from what the app emits today.**

### Also: he is not trapped

`src/components/auth/PasswordCreation.tsx:190-198` has a **"Back to journals"** link. It
sits just below the crop of his screenshot. It returns him to the picker.

## 4. Contributing factors (real, but not the cause)

1. **No writability check.** `add_journal_inner` (`auth_journals.rs:36-41`) validates only
   `is_absolute()` and `is_dir()`. A visible-but-read-only directory is accepted; the
   `config.json` write then succeeds because that goes to the app data dir; the failure only
   surfaces two screens later as the generic message.
2. **First run requires a file dialog.** `JournalPicker.tsx:76,346` — both create paths open
   the folder dialog and Add stays disabled until a folder is set. No default location is
   ever offered.
3. **The picker is not portal-based.** `tauri-plugin-dialog` 2.7.1 is `default = ["gtk3"]`
   (verified in the vendored `Cargo.toml`), `src-tauri/Cargo.toml:35` takes defaults, and
   `ashpd` is absent from `Cargo.lock`. So it is an in-sandbox `GtkFileChooserDialog` — it
   cannot reach host paths and grants no document-portal access. `--filesystem=home` was
   dropped during Flathub review (`docs/archive/flatpak-pr-feedback.md:63-96`) and the
   documented portal follow-up was never built.
4. **A stale doc assumption enabled #3.** `docs/FLATPAK_MAINTENANCE.md:196` lists *"file
   picking still works through portals"* as a smoke-test item. It has never been true.

### Verified: the shipped Flatpak matches this source tree

The `flathub-maintenance` skill warns that the shipped build can diverge from our source —
the Flathub repo holds its own manifest copy and may carry build-time `patches/`. Checked
via `gh api` on `flathub/io.github.fjrevoredo.mini-diarium` (2026-07-30):

| Check | Result |
|---|---|
| Pinned source commit | `61b17f12b0a2aab55d8a8f434dc74815cf29a58f` — **one commit behind local HEAD** (`18c39176 dev setup cleanup`) |
| Diff of every traced file, `61b17f12..HEAD` | **empty** — `config.rs`, `auth_journals.rs`, `auth_core.rs`, `lib.rs`, `state/auth.ts`, `lib/errors.ts`, `components/auth/` all identical |
| `finish-args` in the live manifest | **identical** to `flatpak/io.github.fjrevoredo.mini-diarium.yml:10-14` — no permission divergence between repos |
| `patches/fix-metainfo-appstream.patch` | metainfo/AppStream only (`vcs-browser` URL + `developer id`); **not referenced anywhere in the live manifest**, so it is not applied at build time and cannot affect runtime |

**So the code traced in §3 is byte-identical to what the user is running.** The diagnosis
applies to his build; no version skew, no Flathub-only divergence, no runtime patch to
account for.

**Housekeeping found in passing (unrelated to this bug):** that patch is both orphaned *and*
stale — upstream `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml:31,33` already
contains the `vcs-browser` URL and `developer id="io.github.fjrevoredo"` it applies. The
skill's rule is "remove patches as soon as the upstream fix is merged." It is harmless today
only because nothing references it; delete it from the Flathub repo to avoid a future
build-time `patch` failure if someone re-wires it.

## 5. Validation to run on Windows

**Bug 1 reproduces without Linux.** This is the decisive experiment.

Via the `tauri-agent-dev` skill (or a normal `bun run tauri dev`):

1. Start with a clean app data dir (move `config.json` aside).
2. Create a journal in any folder; unlock it.
3. Return to the journal picker and **Remove** that journal (the only one).
4. Fully quit the app and relaunch.

**Expected on today's code (the bug):** you land on the **Create Journal** screen, not the
picker — and `config.json` still contains `"active_journal_id": ""` plus a `diary_dir`
pointing at the removed journal's folder.

**If instead you land on the journal picker,** Bug 1 does not reproduce as described and
§3 needs revisiting before any fix.

Also inspect after step 3:
`%APPDATA%\com.minidiarium\config.json` (or wherever `app_data_dir` resolves) — confirm
`active_journal_id` and `diary_dir`.

Optional second check — does the generic error appear when the target dir is unwritable?
Point a journal at a folder, then revoke write permission on it (or delete the folder but
leave a same-named read-only one) and try to create. Confirms the §4.1 path end to end.

## 6. Data needed from the user

Nothing in §3 identifies *his* specific failure. Ask for:

1. **`config.json`** — `cat ~/.var/app/io.github.fjrevoredo.mini-diarium/data/com.minidiarium/config.json`.
   This single file confirms or kills Bug 1: look for `"active_journal_id": ""` and a stale
   `diary_dir`.
2. **`ls -ld <that diary_dir>`** — existence and write permission.
3. **Terminal output** — `flatpak run io.github.fjrevoredo.mini-diarium`, then reproduce.
   Warn him the decisive line is probably **absent** on today's build (Bug 2), so 1 and 2
   matter more.

Immediate relief to offer him:

- The **"Back to journals"** link at the bottom of the Create Journal screen → picker → pick
  a different folder.
- `flatpak uninstall --delete-data io.github.fjrevoredo.mini-diarium`, then reinstall. A
  plain uninstall keeps `~/.var/app/<id>`, which is why his removed journal still influences
  the app.
- For a folder outside the sandbox:
  `flatpak override --user --filesystem=home io.github.fjrevoredo.mini-diarium` (or
  Flatseal), then fully quit and reopen.

## 7. Proposed fix (agreed scope, not yet started)

| # | Change | Files |
|---|---|---|
| 1 | Normalise the empty active id: `save_journals` clears `diary_dir` and writes `active_journal_id: None` when nothing matches; `load_active_journal_id` maps `Some("")` → `None`. Frontend treats `""` as absent so stale configs still route to the picker | `crates/mini-diarium-core/src/config.rs`, `auth_journals.rs`, `src/state/auth.ts:80` |
| 2 | `log::error!` the raw cause in `create_diary` (paths/names excluded per `src-tauri/CLAUDE.md` Gotcha #10) | `auth_core.rs:268` |
| 3 | Stop collapsing causes: add a `directory is not writable\|unable to open database file` branch, and move the `sqlite\|rusqlite\|argon2` check **above** the filesystem bucket | `src/lib/errors.ts` |
| 4 | `config::is_dir_writable(dir)` probe-file helper; guard `add_journal_inner` and the `change_diary_directory` copy. Error string deliberately not `Failed to …` | `config.rs`, `auth_journals.rs:39`, `auth_directory.rs:~47` |
| 5 | New `get_default_journal_dir` command + picker offers a pre-filled default location, so the file dialog leaves the critical path. Browse… stays | `auth_journals.rs`, `lib.rs` handler, `src/lib/tauri/journals.ts`, `JournalPicker.tsx` |
| 6 | "Missing" badge + disabled Open for journals whose `.db` is gone, via the existing `checkJournalPath` | `JournalPicker.tsx` |
| 7 | New locale keys: `errors.directoryNotWritable`, `auth.picker.useDefaultLocation`, `auth.picker.defaultLocationHint`, `auth.picker.missingBadge` | `src/i18n/locales/en.ts` |

**Key test (proves the fix):** in `config.rs` — add a journal, remove it, reload, assert
`load_active_journal_id()` is `None` **and** `load_diary_dir()` is `None`. Fails on today's
code.

Other tests: `is_dir_writable` (incl. `#[cfg(unix)]` read-only case); `add_journal_inner`
rejects unwritable; `errors.test.ts` ordering guard incl. `"Failed to create schema: disk I/O error"`
→ `internalError`; empty-string `activeJournalId` → `journal-select`; `JournalPicker`
default-prefill and Missing badge.

Separate, unrelated housekeeping (do not bundle into the fix commit): delete the orphaned,
now-stale `patches/fix-metainfo-appstream.patch` from the **Flathub** repo — see §4.

Docs: correct `docs/FLATPAK_MAINTENANCE.md:196`; `website/docs-src/` default-location +
Flatpak caveat (then `bun run website:build-static` via the **PowerShell tool**);
`docs/KNOWN_ISSUES.md`; `CHANGELOG.md`; `todo-manager` for the item + two follow-ups
(portal-based dialog; broader `config.json` self-heal).

## 8. Constraints to respect

- **A code fix only reaches Flathub users through a new tagged release** — the manifest pins
  a `type: git` commit, and `docs/FLATPAK_MAINTENANCE.md` checklist item 6 is explicit that
  post-tag fixes on `master` do not help that release's PR. The §6 workarounds are the only
  near-term relief.
- **Add no new crates.** Any `Cargo.lock` change forces `cargo-sources.json` regeneration
  (`FLATPAK_MAINTENANCE.md:146`) and stale vendored sources are the top Flathub build
  failure. Hence the probe filename reuses `generate_journal_id()`. Same reason the
  `xdg-portal` switch is deferred: it would add `ashpd`, `pollster`, `urlencoding`, and a
  tokio surface to the offline vendored build.
- **No `finish-args` change** → main-repo-only fix, no Flathub-repo edit, no
  `.agents/flathub-paths.md` needed (it does not exist today).

## 9. Open questions

1. Does Bug 1 reproduce on Windows as described in §5? *(decisive — run this first)*
2. Is Jon's failure Bug 1's stale directory, or a different `create_database` error?
   Only his `config.json` or a log line answers it. **Do not report the issue as resolved
   until one of them confirms which.**
3. Is a Flatpak sandbox's `$HOME` writable-but-ephemeral (tmpfs) or read-only? Unresolved,
   and it decides whether a journal created at the sandbox home silently vanishes on restart
   — a separate potential data-loss bug worth its own check.

## 10. Verification commands (for when the fix lands)

```
cargo test --workspace
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run test:run
cmd.exe /c bun run validate:locales
cmd.exe /c bun run coverage:diff
```

Optional Flatpak build (Linux only). Vendored sources are **not** in the repo even though
the local manifest lists them (`flatpak/io.github.fjrevoredo.mini-diarium.yml:85-86`), so
per `docs/FLATPAK_MAINTENANCE.md:181-190`:

```bash
python3 /path/to/flatpak-builder-tools/cargo/flatpak-cargo-generator.py Cargo.lock -o flatpak/cargo-sources.json
node flatpak/generate-node-sources.mjs package-lock.json flatpak/node-sources.json "$HOME/.npm"
flatpak-builder --user --install --force-clean build-dir flatpak/io.github.fjrevoredo.mini-diarium.yml
flatpak run io.github.fjrevoredo.mini-diarium
```
