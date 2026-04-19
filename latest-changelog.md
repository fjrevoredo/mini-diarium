## What's Changed

Maintenance release fixing two recurring CI failures: Flathub builds were rejected because `metainfo.xml` was missing release entries for v0.4.16 and v0.4.17 (a Windows CRLF bug in `bump-version.sh`), and WinGet submissions were failing when the `winget-pkgs` fork drifted behind upstream.

### Fixed

- **Flathub CI: missing metainfo release entries**: `bump-version.sh` silently failed to prepend `<release>` entries to `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` on Windows because the file had CRLF line endings and the `sed` pattern didn't match. v0.4.16 and v0.4.17 entries are backfilled; `bump-version.sh` now strips `\r` before substituting; `.gitattributes` enforces `eol=lf` for `data/linux/*.xml` and `*.desktop` going forward.
- **WinGet CI: fork sync failure**: `wingetcreate submit` failed with "forked repository could not be synced" when the `fjrevoredo/winget-pkgs` fork had drifted behind upstream. The publish workflow now calls the GitHub API to sync the fork before submitting, preventing this recurring failure.
