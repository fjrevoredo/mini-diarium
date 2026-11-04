# ADR: Flatpak Static Filesystem Permission for Journal Locations

**Status:** Accepted (decision 2026-11-03, maintainer). Implementation (the manifest change) is pending; it needs Flathub moderation.
**Date:** 2026-11-04
**Related:** [#370](https://github.com/fjrevoredo/mini-diarium/issues/370); TODO-0163 (the #370 work item); TODO-0164 (an unreachable journal path shows the create screen); [KI-10](../KNOWN_ISSUES.md); exploration [2026-11-03-flatpak-journal-location-principles.md](../explorations/2026-11-03-flatpak-journal-location-principles.md) (the evidence: findings F1 to F12, §7); Workbook handovers [ISSUE_370_WORKBOOK_HANDOVER.md](../wip/ISSUE_370_WORKBOOK_HANDOVER.md) and [ISSUE_370_WORKBOOK_HANDOVER_2.md](../wip/ISSUE_370_WORKBOOK_HANDOVER_2.md); `flatpak/io.github.fjrevoredo.mini-diarium.yml` (`finish-args`); `.github/workflows/flathub-publish.yml` (opens the Flathub PR); `src-tauri/src/commands/auth/auth_journals.rs` (`is_portal_path`, `check_journal_location`).

## Context

### The journal model

On every platform, the app treats a journal as a path in a folder that the app controls:

| ID | Requirement |
|---|---|
| R1 | The user can put the journal file in any folder, for example a cloud-synced folder. |
| R2 | The user can open an existing `.db` from any location, **in place** (not a copy). |
| R3 | A journal that works today works after an app restart and a reboot, with no user action. |
| R4 | The app can make sibling files next to the database: SQLite `-journal` (always in the same folder as the database), `<name>.restoring.tmp`, `<name>.staging`. |
| R5 | The app can make and write `backups/<stem>/` next to the database. |

The maintainer confirmed R2 (in place) and R3 (no user action after a reboot) on 2026-11-03 (exploration §7).

### The current Flathub build

The manifest `finish-args` are `--socket=wayland`, `--socket=fallback-x11`, `--share=ipc` and `--device=dri`. There is **no filesystem access** and no network access. Outside its own data folder, the app reaches a file only through the document portal: the file chooser returns a FUSE path under `/run/user/<uid>/doc/<id>/`.

Since v0.6.6 the app refuses such a path as a journal location (`is_portal_path`, KI-10). Without a static permission, a Flathub user can keep a journal only in the app's data folder.

### Why the portal does not meet the model

- **F4, scope.** A file grant gives read and in-place write of the picked file only. `mkdir backups` fails with `EPERM`, and a new file appears on the host only as a hidden `.xdp-<name>-XXXXXX` file. R4 and R5 fail. This is the upstream design; no portal gives "a file plus its neighbours" (xdg-desktop-portal #463, open since 2020).
- **F6, durability.** The portal stores each grant with the `st_dev` and `st_ino` of the item. On ecryptfs, btrfs and LVM, `st_dev` can change after a reboot; then every stored grant fails with `ENOENT`. On the Workbook (portal 1.20.0, ecryptfs home) all grants failed after a reboot. R3 fails. Upstream fixed this in xdg-desktop-portal **1.21.2** (PR #1950, May 2026).
- **SQLite limit.** Before xdg-desktop-portal **1.19.0**, SQLite fails on the portal FUSE mount (`ELOOP`, no `fcntl` locks; issue #1117, fixed by PR #1195).

Portal versions on target distributions (Repology, 2026-11-03; full table in exploration §7.1):

| Distribution | xdg-desktop-portal | SQLite on portal (≥ 1.19.0) | Grants survive a reboot (≥ 1.21.2) |
|---|---|---|---|
| Ubuntu 22.04 / 24.04 LTS | 1.14.4 / 1.18.4 | No | No |
| Ubuntu 26.04 LTS | 1.21.1 | Yes | No |
| Debian 12 / 13 | 1.16.0 / 1.20.3 | No / Yes | No |
| Fedora 43 / 44 | 1.20.4 / 1.22.1 | Yes | No / Yes |
| RHEL 9 family | 1.12.6 | No | No |
| Arch, Tumbleweed | 1.22.1 | Yes | Yes |

On most LTS and stable distributions, no portal design meets R3.

## Decision

Add these four lines to `finish-args` in the Flathub manifest:

```
--filesystem=home
--filesystem=/run/media
--filesystem=/media
--filesystem=/mnt
```

- Inside this scope the sandbox sees real paths. The file chooser returns the real path, because the portal does not add a document for an item that the app can already reach (`AS_NEEDED_BY_APP`).
- **Keep the portal-path refusal** (`is_portal_path`) for everything outside the scope. A portal path still has the F4 and F6 problems.
- The refusal message stays neutral: it gives the real reasons (access can stop after a restart; no backups there) and is true before and after the permission ships. The backend error string `Path is a temporary sandbox location` does not change, because `mapTauriError` matches on it and users never see it.

## Alternatives rejected

**Portal only.** A file grant fails R4 and R5 (F4). A folder grant (the user picks the folder, not the file) fixes F4: T2 showed a new database and `backups/` work in a granted folder. But a folder grant still fails R3 after a reboot on portal < 1.21.2 (F6), and SQLite fails on portal < 1.19.0. These limits apply to every portal design, also to a design where the app owns only the `.db` file. A moderator will probably suggest this first (as in flathub#10653), so the PR justification must answer it with F6 and the version table.

**`xdg-documents` only.** It covers only `~/Documents`. Cloud-sync folders such as `~/Dropbox` or `~/Nextcloud` are outside it, so R1 fails. T7b confirmed it: Open Existing outside `~/Documents` still returned a portal path and was refused.

**`host`.** It gives more than the app needs (everything except system folders). Moderators refused `host` for a file manager in flathub#10100 and offered home + media access as the compromise.

**Import a copy into the app's data folder.** This avoids any permission, but it breaks R2: the maintainer wants the user to open and use the journal in place, for example in a synced folder.

## Consequences

### Security cost (R7: smallest access, honest threat model)

- The app has no network permission (a non-negotiable, and no `--share=network` in the manifest). So the new access adds no path for data to leave the machine.
- The sandbox protects less against a compromised app: a compromised app could read and write files under `$HOME` and on mounted drives.
- **Rhai plugins (checked in the code on 2026-11-04).** `create_sandboxed_engine` (`crates/mini-diarium-core/src/plugin/rhai_loader/runtime.rs`) registers only `parse_json`, `count_words`, `now_rfc3339` and `html_to_markdown`. Rhai 1.26 has no built-in file or network functions, so a plugin cannot read or write files as data. The Rust host reads the import file and writes the export file; the plugin sees only strings. **One gap:** the engine is made with `Engine::new()`, which installs Rhai's default `FileModuleResolver` (`rhai-1.26.1/src/engine.rs`). So a plugin can `import` and run another `.rhai` script by path. With the `home` permission that path can be anywhere in `$HOME`. It loads code, not data, and plugins are already user-installed code. **Fixed 2026-11-04:** the engine now sets a `DummyModuleResolver`, so every `import` fails (`test_sandboxed_engine_refuses_to_import_a_script_from_disk`). The plugin surface stays the same under the wider scope.
- `docs/PRIVACY.md` and KI-10 must state the permission and this cost. Do this in the same change as the manifest.

### Behaviour inside and outside the scope (Workbook T7, one installed branch)

| Case | Result |
|---|---|
| `home`: Create New, Browse to a folder in `$HOME` | Real host path in the form and in `config.json`. The `.db` and `backups/` are real host files. No document-store entry. |
| `home`: Open Existing on a `.db` in `$HOME` | Real path, accepted, unlock works. |
| `home`: reboot, then start and unlock | Works with no new pick (R3 met). |
| Outside the scope (T7b: `xdg-documents`, file outside `~/Documents`) | Portal path, refused with the portal message. |

Two more facts from the evidence:

- With **two installed branches** (for example `stable` and `test`), the portal cannot check the grant (`flatpak info --file-access` fails with "Multiple branches available"), so the chooser still returns portal paths (F7, F8). A normal Flathub install has one branch. KI-10 states this limit.
- A stored path that becomes unreachable (for example after a scope change) shows the new-journal screen, not an error (F12). That is TODO-0164 and is independent of this decision.

### Re-test points

Use the Workbook T7 procedure in [ISSUE_370_WORKBOOK_HANDOVER_2.md](../wip/ISSUE_370_WORKBOOK_HANDOVER_2.md) ("T7 single branch, static permission"): one installed branch, the permission set, Create New and Open Existing inside the scope, a reboot with no new pick, and Open Existing outside the scope. Run it again on the first build that carries the new `finish-args`, and on a removable drive under `/run/media`.

## Flathub review and policy

### How the change gets reviewed

The app is already on Flathub, so this is an update. An update that adds static permissions is held for a moderator: the bot posts the permission diff on the PR, the PR must "explain why the application needs the exact access", and the build can be held until a moderator approves ([Maintenance](https://docs.flathub.org/docs/for-app-authors/maintenance)). The linter does not approve permissions. The four lines pass the linter: `/run/media` is the root, not a subfolder (`finish-args-absolute-run-media-path`), and `/media` and `/mnt` are not reserved paths.

The policy: "Static permissions must be kept to an absolute minimum"; a portal is mandatory when it "exists, is supported across the ecosystem, and covers the application's use case"; exceptions are "case by case" ([Requirements](https://docs.flathub.org/docs/for-app-authors/requirements)). Our case: the portal exists but does not cover the use case on the ecosystem's current versions (F4, F6, the version table), and the app has no network access.

### Comparable cases (flathub/flathub, 2025-2026)

| PR | Request | Moderator response |
|---|---|---|
| #10100 (file manager) | `host` | Refused `host`; offered home + media access. |
| #10653 (photo viewer) | `home`, later `xdg-pictures` + mount points | Preferred the portal; leaned to reject for "heavy AI usage". Closed, not merged. |
| #10856 (PDF tools) | `home` after a portal-only first try | Open, no decision yet. |

Obsidian has exactly `home`, `/mnt`, `/run/media` and `/media` (grandfathered; reference only).

**Assessment (judgement, not a Flathub statement):** approval is likely but not certain. If a moderator asks to reduce the scope, drop `--filesystem=/mnt` first; it is the least common location for a journal.

### Generative-AI policy

The full policy text and the rules for this repo are in [FLATPAK_MAINTENANCE.md → Flathub Generative-AI Policy](../FLATPAK_MAINTENANCE.md#flathub-generative-ai-policy). For this change:

- The maintainer writes the four `finish-args` lines in the manifest personally. The policy has no exception for mechanical lines.
- The maintainer writes the justification, and every reply to a moderator, on the Flathub PR in their own words. AI must not generate "commit messages, descriptions, review comments, or replies". This ADR gives the facts; it is not text to paste into the PR.
- Do not request an AI-agent review on the Flathub PR.
- **Disclosure (open, maintainer decision):** the policy requires a disclosure of AI-generated code and docs in the app or its packaging. The text does not say if this applies to an update. The permission change is held for a moderator, so decide before the release that carries it.
- **CI-opened PR (resolved 2026-11-04, maintainer):** `flathub-publish.yml` opens the Flathub PR from CI (a script, not an AI agent), and this stays acceptable. The workflow copies `flatpak/io.github.fjrevoredo.mini-diarium.yml` from this repo, so the hand-written `finish-args` lines must be committed here. The workflow PR body is only a generic "Automated update" line, so the maintainer adds the justification on that PR (edit the body or add a comment).

## Revisit when

Most target distributions ship xdg-desktop-portal **1.21.2 or later** (grants survive a reboot). Then a folder-grant design can meet R3 and can replace the static permission. Check the Repology table again at each new LTS release (Ubuntu, Debian, RHEL).
