# Handoff: Linux checks before the 0.8.0 release (temporary file)

Branch `rebrand/fenmark` (PR #361) is the 0.8.0 release, which renames Mini Diarium to Fenmark.
It is not merged and not tagged yet. Do two Linux checks:

1. **TODO-0161** in `docs/todo/TODO.md`: follow its steps, report the dock result and the real
   `wmclass`/`app` values for the Flathub install and the `.deb`. Change `StartupWMClass` in
   `data/linux/io.github.fjrevoredo.mini-diarium.desktop` only if the dock shows a second icon.
2. **TODO-0160**: follow "Refreshing the Flathub screenshots" in `docs/FLATPAK_MAINTENANCE.md`.
   Get the AppImage or `.deb` from the latest CI run on this branch
   (`gh run list --branch rebrand/fenmark`). Use a sample journal with made-up English entries.
   Commit the PNG files first, then commit the metainfo URL and size changes that point at that
   commit.

## Rules

- Commit only with my approval. No Claude attribution in commits. One logical change per commit.
- Do not change any app identifiers (Flatpak ID, `com.minidiarium`, binary name).
- After each change, add a line to the 0.8.0 CHANGELOG block (it is already dated 02-11-2026;
  do not add a new version) and copy the same change into `latest-changelog.md`.
- Close TODO-0160 and TODO-0161 with the `todo-manager` skill when their acceptance is met.
- Run `appstreamcli validate --no-net` and `desktop-file-validate` before you push.

## Cleanup

When both checks are done, delete this file (`HANDOFF-linux-checks.md`) in its own commit
(`chore: remove the Linux checks handoff`) and push. It must not reach `master`.
