# Flathub PR #8283 — Feedback Analysis & Proposals

Source: https://github.com/flathub/flathub/pull/8283  
Reviewers: @CodedOre, @hfiguiere (Flathub contributor)

---

## Issue 1 — `.desktop` file should live upstream

**Reviewer:** @CodedOre  
**File:** `io.github.fjrevoredo.mini-diarium.desktop`  
**Quote:** "This file is not specific to Flatpak or Flathub, it should come with the source code from the upstream repository."

**Assessment:** Fix required — no argument. This is a hard Flathub policy. The `.desktop` file is a standard Linux integration file, not Flatpak-specific.

**Proposal:**
- Move `flatpak/io.github.fjrevoredo.mini-diarium.desktop` to `assets/linux/io.github.fjrevoredo.mini-diarium.desktop` (or similar) in the upstream `mini-diarium` repo.
- Commit it with the appropriate app-id name so it follows the reverse-DNS naming convention.
- In the Flathub manifest, remove `flatpak/io.github.fjrevoredo.mini-diarium.desktop` and reference the file from the upstream source directory (it will be at its path within the checked-out source tree).
- The manifest `build-commands` install line becomes:
  ```
  install -Dm644 assets/linux/io.github.fjrevoredo.mini-diarium.desktop \
      /app/share/applications/io.github.fjrevoredo.mini-diarium.desktop
  ```

---

## Issue 2 — `.metainfo.xml` file should live upstream

**Reviewer:** @CodedOre  
**File:** `io.github.fjrevoredo.mini-diarium.metainfo.xml`  
**Quote:** "This file is not specific to Flatpak or Flathub, it should come with the source code from the upstream repository."

**Assessment:** Fix required — same policy as Issue 1. AppStream metainfo is a desktop integration standard, not Flatpak-specific. It is also used by GNOME Software, KDE Discover, and other app stores on Linux.

**Proposal:**
- Move `flatpak/io.github.fjrevoredo.mini-diarium.metainfo.xml` to `assets/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` in the upstream repo.
- The `<releases>` block in the metainfo will need an update strategy: currently the automation comment says "Automation prepends a new `<release>` entry here on each publish via flathub-publish.yml". With the file living upstream, releases need to be added to the upstream file on each tagged release (e.g. via `bump-version.sh`).
- Update the manifest install line accordingly.

---

## Issue 3 — `--share=network` contradicts offline claim

**Reviewer:** @hfiguiere  
**File:** `io.github.fjrevoredo.mini-diarium.yml`, lines 15–17  
**Quote:** "I don't know why it needs proxy resolution since you claim it is 100% offline. But I'm gonna go and say that this submission can wait until this is fixed."

**Assessment:** Blocker flagged by hfiguiere. The justification in the manifest comment ("WebKitGTK requires network access for proxy resolution via the portal. The app itself never makes network requests.") is technically accurate for some WebKitGTK configurations, but hfiguiere is not accepting that argument without evidence, and has marked this as a reason to block the submission.

**Options:**

**A) Remove `--share=network` and test (preferred)**  
Drop the flag and verify that the Flatpak build runs correctly. WebKitGTK used in Tauri renders a local `tauri://localhost` custom protocol URI — it does not make outbound network calls. If proxy auto-detection is attempted at initialization but doesn't hard-fail when denied, removing the flag is safe. This is the cleanest path.

**B) Provide evidence and ask for the flag to be accepted**  
Find the upstream WebKitGTK or libsoup issue/documentation confirming the proxy resolution behavior and link it in the PR. This is a harder sell since hfiguiere has already expressed skepticism and threatened to block on it.

**Recommendation:** Try Option A first. Build and smoke-test without `--share=network`. If the app loads and operates normally, remove the flag and the comment, and update the PR.

---

## Issue 4 — `--filesystem=home` must use the FileChooser portal instead

**Reviewer:** @CodedOre, @hfiguiere  
**File:** `io.github.fjrevoredo.mini-diarium.yml`, line 21  
**Quotes:**
- @CodedOre: "For use-case like this the FileChooser portal, which does support folders, was made. So, this should use it instead of requesting unrestricted access to the home folder."
- @hfiguiere: "This is exactly what the document portal is for."

**Assessment:** Both reviewers are aligned. `--filesystem=home` is not acceptable on Flathub except in exceptional cases (file managers, terminals, etc.) — a journal app does not qualify. The correct solution is to use the XDG Desktop Portal FileChooser, which supports folder selection and grants sandbox-scoped access to the chosen path via the document portal.

**What needs to change in the app:**

The "Change Journal Directory" flow currently calls a Tauri command that uses a native Tauri dialog (which internally uses `rfd` or a similar crate). Under Flatpak, directory selection must go through the portal.

1. **Tauri's dialog plugin** (`@tauri-apps/plugin-dialog`) already supports the XDG portal on Linux when `--talk-name=org.freedesktop.portal.Desktop` is present in `finish-args`. Verify that Tauri v2's dialog plugin (or the underlying `rfd` crate) uses `org.freedesktop.portal.FileChooser` when running under Flatpak (it should, as of `rfd` 0.14+).

2. **Manifest change:** Replace `--filesystem=home` with:
   ```yaml
   - --talk-name=org.freedesktop.portal.Desktop
   - --talk-name=org.freedesktop.portal.FileChooser
   ```
   The document portal will grant transient read/write access to the selected folder path only.

3. **Persistence problem:** After the user picks a folder and closes the app, the chosen path is stored in `config.json`. On next launch, the app opens that path directly without going through the portal again — but the sandbox won't have permission for it unless a persistent portal grant is obtained (org.freedesktop.portal.Documents). This needs investigation:
   - Use `org.freedesktop.portal.Documents.AddFolder` to get a persistent bookmark, then store the document portal path in config instead of the raw filesystem path.
   - OR limit journal directories to `xdg-documents` by default, which is already accessible via `--filesystem=xdg-documents`, and only use the portal for paths outside it.

**Minimum viable approach for the PR:**
- Replace `--filesystem=home` with `--filesystem=xdg-documents` as a default safe scope.
- Add portal talk-names for the directory picker.
- Document the limitation in the app's UI (e.g., "On Linux Flatpak, journals must be placed inside your Documents folder or a location you select via the folder picker").

**Longer-term approach:**
- Implement full document portal persistence (bookmark tokens) so the user can choose any path on first run and the sandbox honors it on subsequent launches. This is a larger Rust/Tauri change.

---

## Issue 5 — `package-lock.json` should come from upstream

**Reviewer:** @hfiguiere  
**File:** `io.github.fjrevoredo.mini-diarium.yml`, last source entry  
**Quote:** "the package-lock belong upstream."

**Assessment:** Fix required. The manifest uses:
```yaml
- type: file
  path: ../package-lock.json
```
This references the file from the local Flathub PR checkout. For the published Flathub manifest, sources must be self-contained or reference the upstream repo directly. The `package-lock.json` should be committed to the upstream `mini-diarium` repo (it likely already is since it's used by `npm ci`).

**Proposal:**
- Confirm `package-lock.json` is committed to the upstream repo (it should be, since `npm ci` requires it).
- Remove the explicit `type: file, path: ../package-lock.json` source entry from the manifest. Since the upstream source is fetched via `type: git`, the `package-lock.json` will already be present in the checked-out tree.
- The `npm ci` command will find it automatically in the working directory.

---

## Issue 6 — Remove self-explanatory inline comments in `finish-args`

**Reviewer:** @CodedOre  
**File:** `io.github.fjrevoredo.mini-diarium.yml`  
**Suggestions:**
- Remove `# Display` comment block before `--socket=wayland` (suggestion replaces with empty string — "This is self-explanatory.")
- Remove `# GPU rendering (WebKit2GTK requires hardware acceleration)` comment before `--device=dri` — "This is also self-explanatory."

**Assessment:** Cosmetic fix, straightforward to accept. Flathub manifests tend to avoid inline comments on standard flags. Accept both suggestions.

**Proposal:** Remove the two comment lines. The `# WebKitGTK requires network access for proxy resolution via the portal. The app itself never makes network requests.` comment above `--share=network` also becomes moot once that flag is removed (Issue 3).

---

## Issue 7 — `flathub-publish.yml` is running on every push to master

**Source:** Internal observation (not a Flathub reviewer comment)  
**Workflow:** `.github/workflows/flathub-publish.yml`

**Observed behavior:** `gh run list` confirms the workflow is being triggered by `push` events on master (e.g. run `24032833977`, triggered by commit `09b1c7b` "Update website. Add new blog post"). Every master push produces a failed run (conclusion: `failure`, elapsed: `0s`). The failure is immediate because `FLATHUB_TOKEN` is not yet set, so the "Verify FLATHUB_TOKEN secret is set" step exits 1.

**Root cause:** The workflow file (`on: release: types: [published]` + `workflow_dispatch`) has never had a `push` trigger in git history, but GitHub's internal workflow registry appears to have a stale trigger registration — a known GitHub Actions caching bug where removing or changing the `on:` block is not always reflected immediately in the registered workflow definition.

**Impact:** Harmless in isolation (exits in 0s), but it:
1. Pollutes the GitHub Actions tab with permanent red failures on every commit
2. Will silently attempt to run the full publish pipeline (clone Flathub repo, commit, open PR) on every push once `FLATHUB_TOKEN` is configured — likely opening unintended update PRs on the Flathub repo for non-release commits.

**Proposal:** Add an explicit `if:` guard at the job level so the job is a no-op for anything that is not a release or manual dispatch, regardless of what trigger GitHub fires it on:

```yaml
jobs:
  publish-flathub:
    if: github.event_name == 'release' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
```

This is the safest fix because it is immune to GitHub's trigger caching bugs — the guard is evaluated at runtime, not at workflow registration time. It also serves as defense-in-depth: even if a future maintainer accidentally adds a `push:` trigger, the job will never run for plain pushes.

---

## Summary Table

| # | Issue | Action | Effort |
|---|-------|--------|--------|
| 1 | `.desktop` file must be upstream | Move file to upstream repo, update manifest path | Low |
| 2 | `.metainfo.xml` file must be upstream | Move file to upstream repo, update release automation | Low–Medium |
| 3 | `--share=network` contradicts offline claim | Drop flag, test Flatpak build | Low |
| 4 | `--filesystem=home` must use portal | Replace with portal talk-names + scoped fs access; solve persistence | Medium–High |
| 5 | `package-lock.json` must come from upstream | Remove explicit source entry (it's already in the git checkout) | Low |
| 6 | Remove self-explanatory `finish-args` comments | Delete two comment lines | Trivial |
| 7 | `flathub-publish.yml` fires on every master push | Add job-level `if: github.event_name == 'release' \|\| ...` guard | Trivial |

**Blocking items (PR will not merge without these):** 1, 2, 3, 4, 5  
**Internal fixes (independent of the Flathub PR):** 7  
**Non-blocking cosmetic:** 6

The most complex work is Issue 4. Issues 1, 2, 5, 6, 7 are mechanical. Issue 3 is a quick test-and-remove.
