# Handoff: user report — "A file operation failed" on Create Journal (Flatpak)

**Status:** **root cause identified** from user screenshots. It is neither Bug 1 nor a
permissions problem, and §4.3's central claim is falsified. See [§0](#0-status-update-2026-08-06).
**Date:** 2026-07-30 · **Last updated:** 2026-08-07
**Next action:** implement the portal-path guard ([§0.4](#04-what-must-change)). The §5
Windows run is now optional and no longer decisive.

---

## 0. Status update (2026-08-06)

### 0.1 The user's reply

1. **He updated to the latest release; the issue persisted.** Expected — `git log` on
   `crates/mini-diarium-core/src/config.rs`, `src-tauri/src/commands/auth/auth_journals.rs`,
   and `src/state/auth.ts` shows **none of the seven §7 changes were ever implemented**. No
   fix has shipped, so no release could have helped him.
2. **He has removed the Flatpak permanently and now runs the AppImage only.**
3. **He asked how to update the AppImage without losing data.** Answered: no self-updater
   on any platform (no updater plugin, no `updater` block, no updater artifacts in
   `tauri.conf.json:21`; "no update checks" is a `CLAUDE.md` security rule, stated publicly
   in `website/docs-src/10-faq.md`). Manual file swap; the journal folder and
   `~/.local/share/com.minidiarium/` both sit outside the AppImage.

### 0.2 The screenshots — root cause

He also sent six screenshots (taken 2026-07-31, reviewed 2026-08-06). **They identify the
cause, and it is not what §3 or §4 predicted.**

> **Evidence handling:** the screenshots are user-supplied and stay **out of the repo** —
> `docs/wip/` is tracked and this repository is public. They are gitignored at the root as
> `reminidiarium.zip`. Everything they prove is transcribed below, so the report does not
> depend on them.

| Screenshot | What it shows |
|---|---|
| `22-03-56` | Picker: journal **`diary`** at path **`/run/user/1000/doc/acaee348`** |
| `22-03-43` | Unlock screen for that journal → *"A file operation failed"* |
| `22-04-05` | Remove Journal confirmation |
| `22-04-11` | After removal: **"No journals yet"** empty-state picker |
| `22-05-27` | Create New Journal, Location prefilled **`/run/user/1000/doc/22c50e87/Diarys & Jou…`** |
| `22-06-35` | Password entered → *"A file operation failed"* on Create Journal |

**`/run/user/1000/doc/<hash>` is the XDG document-portal FUSE mount.** The Flatpak file
chooser hands back a portal document handle, and **the app persists that handle into
`config.json` as the journal's permanent location.** Two distinct failures follow from that
single cause, and Bug 2 (the collapsed error message) is why they look identical:

1. **Unlock fails in a later session.** `/run/user/1000` is a tmpfs and portal document
   handles are per-grant, per-session. The recorded path simply does not exist at the next
   login, so every file operation against it fails → `22-03-43`. The two different hashes
   in the screenshots (`acaee348`, `22c50e87`) for what is evidently the same physical
   folder are the portal minting a fresh id per grant.
2. **Creation fails even with a live grant** → `22-06-35`. Mechanism **probable, not
   proven**: the document-portal FUSE does not support the full set of operations SQLite
   needs to bring up a new database inside a directory grant (creating sidecar
   `-journal`/`-wal` files, the rename/fsync patterns). This should be confirmed on Linux
   before being written up as fact.

**The real backing folder is visible in the evidence.** Screenshot `22-05-27` shows
`/run/user/1000/doc/22c50e87/Diarys & Jou…`: the portal preserves the **basename of the
exported directory**, so the host folder is named something like `Diarys & Journals`. That
is where his data physically lives, not anywhere under `~/.var/app`. It also means the two
handles are grants over a real, persistent host directory rather than scratch space.

**Only the Flatpak is affected.** The AppImage, `.deb`, and Nix builds are unsandboxed, so
the GTK chooser returns real filesystem paths and no portal handle is ever stored. The bug
is specific to the Flathub build. This is why the user's platform switch incidentally
resolved his problem.

### 0.3 What this falsifies

- **§4.3 is wrong.** It states the picker "is not portal-based… it cannot reach host paths
  and grants no document-portal access." The screenshots show portal paths, so it plainly
  does. The lockfile facts in §4.3 are still accurate — `ashpd` is genuinely absent and
  `rfd 0.16.0` uses the gtk3 backend (both re-verified) — but the conclusion drawn from
  them does not hold: the portal is being reached **through GTK inside the sandbox**, not
  through a Rust-side portal crate. *The exact GTK mechanism has not been verified and
  should not be asserted without checking.*
- **§3 Bug 1's user-visible symptom did not reproduce.** After removing the last journal he
  landed on the **empty-state picker** (`22-04-11`), not the Create Journal screen — which
  is precisely the "Bug 1 does not reproduce as described" outcome §5 defines. Caveat:
  those screenshots may be from a single app session, and Bug 1's claim is about the *next
  launch*, so this weakens the routing claim without formally killing it. The underlying
  `config.json` defect (empty `active_journal_id`, stale `diary_dir`) is still real and
  still worth fixing — it is simply **not what broke his journal**.
- **This was never a permissions problem**, which is what the error text told him for two
  weeks. §4.1's writability check would not have caught it either: a live portal directory
  *is* writable at the moment it is probed.

### 0.4 What must change

Ranked by what actually fixes his bug:

| # | Change | Note |
|---|---|---|
| A | **Reject or resolve portal paths when a journal directory is chosen.** A path under `/run/user/*/doc/` must never be stored in `config.json` as a permanent location — either resolve it to the real backing path or refuse it with an explanatory error | **the fix**; new, not in §7 |
| B | Detect an already-stored portal path at load and surface a specific, actionable message instead of "A file operation failed" | recovery for existing installs |
| C | §7 items 2 and 3 (log the real cause; stop collapsing six errors into one sentence) | **why this took two weeks to diagnose** — highest value after A |
| D | §7 items 1, 4, 5, 6 | still real defects, no longer urgent |

**Data loss: probably none, not yet proven.** Three things point the same way. The document
portal is a passthrough over real host files rather than scratch storage; the grant's
basename resolves to a real host folder (`Diarys & Journals`); and his `diary` journal had
been created successfully at some earlier point, since it reached the *unlock* screen
rather than failing at creation. So a `diary.db` most likely sits in that folder right now,
encrypted and intact, orphaned only because `config.json` recorded the handle instead of
the path.

What is **not** established is whether a portal *directory* grant passes new-file writes
through to the backing directory. Until that is tested (§9 Q3), "his data survived" is a
strong prior, not a fact, and should not be stated to a user as certainty.

### 0.5 What the user has been told

Two emails sent 2026-08-06/07, in this order:

1. **AppImage updating.** No self-updater on any platform, manual file swap, journal folder
   and `~/.local/share/com.minidiarium/` both sit outside the AppImage so an update cannot
   touch them. Also suggested checking `~/.var/app/io.github.fjrevoredo.mini-diarium/` for
   surviving Flatpak data. **That pointer was wrong** and is retracted in the second email.
2. **The root cause,** framed as a second pass over his screenshots: the stored portal path,
   why it fails only after a logout, that the AppImage is unaffected, and where to actually
   look for his data (`find ~ -name 'diary.db'`, then **+ Open Existing**). Recovery worded
   as "probably still on your disk" to match the evidence, per §0.4.

He has **not** been told a fix is coming, and no timeline was given. Nothing in either
email needs correcting if §9 Q3 later shows the data did not survive; the wording already
allows for it.

### 0.6 Found in passing

`docs/INSTALLATION.md` documents updating for WinGet, Homebrew, and Flatpak, but has **no
AppImage update instructions** — which is why he had to ask. Worth an "Updating"
subsection in the Linux part. Unrelated to this bug; do not bundle it into the fix commit.

The `config.json` requested in §6 would still be useful confirmation but is **no longer
needed to diagnose** — the screenshots carry the path.

### 0.7 Not yet done

Deliberately left for a follow-up, so this handoff is not mistaken for a finished task:

- **No code changed.** Item A in §0.4 (the portal-path guard) is unimplemented.
- **No TODO item created** for the fix. Use `todo-manager`; do not hand-assign an ID.
- **No `docs/KNOWN_ISSUES.md` entry**, though this now warrants one: it affects every
  Flathub user who picks a folder through the file chooser, and the workaround
  (reopen the journal from its real path after each login) is worth documenting.
- **No CHANGELOG entry**, correctly, since nothing has been fixed yet.
- **§9 Q3 and Q4 untested** — both need a Linux box with a Flatpak build.

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

⚠️ **Not his bug — see [§0.3](#03-what-this-falsifies).** Screenshot `22-04-11` shows him
landing on the empty-state picker after removing the last journal, not the Create Journal
screen. The `config.json` defect described below is still real and still worth fixing; the
user-visible routing symptom in row 4 did not reproduce.

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
3. **The picker is not portal-based.** ⚠️ **FALSIFIED 2026-08-06 — see [§0.3](#03-what-this-falsifies).**
   The user's screenshots show `/run/user/1000/doc/<hash>` paths, which are document-portal
   mounts, so the picker *does* reach the portal (via GTK in-sandbox, not via a Rust crate).
   The lockfile facts below remain correct; the conclusion drawn from them does not. This
   inverted the whole diagnosis: the portal path is the **cause**, not a missing capability.
   `tauri-plugin-dialog` 2.7.1 is `default = ["gtk3"]`
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

> **Superseded by [§0](#0-status-update-2026-08-06) (2026-08-06).** He has uninstalled the
> Flatpak, so all three items below exist only if `~/.var/app/<id>` survived the uninstall.
> Requested, but treat as unlikely to arrive. The relief options at the end of this section
> are obsolete — he is on the AppImage now.

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
  near-term relief. *(Still true for other Flathub users; no longer relevant to Jon, who is
  on the AppImage — see §0.)*
- **Add no new crates.** Any `Cargo.lock` change forces `cargo-sources.json` regeneration
  (`FLATPAK_MAINTENANCE.md:146`) and stale vendored sources are the top Flathub build
  failure. Hence the probe filename reuses `generate_journal_id()`. Same reason the
  `xdg-portal` switch is deferred: it would add `ashpd`, `pollster`, `urlencoding`, and a
  tokio surface to the offline vendored build.
- **No `finish-args` change** → main-repo-only fix, no Flathub-repo edit, no
  `.agents/flathub-paths.md` needed (it does not exist today).

## 9. Open questions

> **Questions 1 and 2 are answered as of [§0](#0-status-update-2026-08-06).** Q1: Bug 1's
> symptom did not reproduce for him. Q2: his failure was neither — it was the stored
> document-portal path. Both are kept below for the record. Question 3 was the closest to
> the truth and is now the most urgent one.

1. ~~Does Bug 1 reproduce on Windows as described in §5?~~ Superseded — his screenshots show
   the empty-state picker, the §5 "does not reproduce" outcome. The §5 run is now optional.
2. ~~Is Jon's failure Bug 1's stale directory, or a different `create_database` error?~~
   **Neither.** It is a `/run/user/1000/doc/<hash>` portal path stored as the journal
   location (§0.2).
3. **Does a document-portal directory grant pass writes through to the real backing
   directory, or do they land on the tmpfs?** Now the decisive open question — it determines
   whether his entries still exist somewhere recoverable or are gone. Testable on Linux with
   a directory grant; does not need the user.
4. **What exactly does the portal FUSE reject when SQLite creates a new database?** Needed
   to write up §0.2 failure 2 as fact rather than a probable mechanism.

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
