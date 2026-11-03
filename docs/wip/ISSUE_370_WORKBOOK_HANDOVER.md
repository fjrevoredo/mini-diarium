# Issue #370 handover: reproduce the Flatpak 0.7.6 → 0.8.0 journal-list loss on Workbook

Status: **OPEN — waiting for the Workbook run.**
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

- Flatpak version:
- Pre-existing install / data (and backup path):
- 0.7.6 commit used:
- 0.8.0 commit used:

### 0.7.6 state (after journal creation)

### 0.8.0 state (after update)

### Variants tried

### Open Existing error text in 0.8.0

### Conclusion

- Reproduced: yes / no
- Observed cause (facts only):
- Open questions for the main-desktop session:
