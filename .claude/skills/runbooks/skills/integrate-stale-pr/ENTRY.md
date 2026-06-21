---
name: integrate-stale-pr
description: >
  Manually integrate a stale external pull request that cannot be auto-merged
  due to conflicts or contributor inactivity. Covers fetching the diff via gh
  CLI, applying new files and patches with reviewer fixes, adapting content to
  Mini Diarium conventions (README one-liner, INSTALLATION.md for detail,
  CHANGELOG [Unreleased] block), updating downstream skills and docs, closing
  the PR with a credit comment, and resolving post-push CI failures (fixed-output
  hash drift, SonarCloud S7637 SHA pinning).

  Use this skill whenever asked to "integrate a PR", "apply a stale PR",
  "manually merge a PR with conflicts", or "the contributor hasn't responded —
  can we just apply it?" Triggers on any mention of a PR with merge conflicts,
  an abandoned contributor PR, or integrating upstream work manually.
compatibility: Requires git and gh CLI authenticated to the repo.
---

# Integrate Stale PR

Use this workflow when a PR has merge conflicts with master or the contributor
is unresponsive. Never attempt `gh pr merge` on a conflicting PR — apply the
diff manually.

---

## Phase 1 — Read the PR

```bash
gh pr view <N>
gh pr diff <N>
```

From the diff, separate the changeset into:
- **New files** — apply verbatim
- **Modified files** — apply with care; check for trailing-newline issues (see Gotchas)
- **Reviewer comments** — note any open review threads; these are fixes you own

Also check the PR's CI results to understand what was already validated upstream.

---

## Phase 2 — Inventory before touching anything

Before writing a single file, identify:

1. **Reviewer-flagged issues** the contributor never addressed. These become
   your fixes during integration.

2. **Convention gaps** — compare the PR against existing project patterns:
   - Read a few existing files of the same type the PR touches to calibrate
     expected style, verbosity, and placement.
   - CI workflow files: check whether existing workflows pin actions to full
     commit SHAs; if so, any new actions in the PR must be pinned too (see Gotchas).
   - New CI workflow jobs should have `timeout-minutes` matching existing jobs.

3. **Stale content** — the PR was written against an older repo state. Any
   hash, pinned version, or generated value may have drifted. Flag these: most
   can be left for CI to surface and fix in a follow-up commit.

---

## Phase 3 — Apply changes

### New files
Write them verbatim from the diff. Create parent directories first if needed.

### Modified files
Use the Edit tool. `old_string` must match what is *currently* in the file,
not what the diff context shows — read the current file first (see Gotchas).

### Fixes applied on top
Fold reviewer fixes into the same application pass rather than applying PR
content first and then patching. One coherent application is cleaner.

---

## Phase 4 — Adapt to project conventions

### README (`## Download` section)
Each install method gets exactly one bullet with the shortest useful command:

```markdown
- Platform / Tool: `<one-line install command>`
```

Full setup detail (multiple options, configuration, caveats) goes in a new
section in `docs/INSTALLATION.md`, following the heading style of the existing
Windows / Homebrew / Flatpak sections there. Do not add subsections or code
blocks to the README itself.

### CHANGELOG
Add an `[Unreleased]` block immediately below `# Versions` if one doesn't
exist. Keep the entry to one sentence per feature. Never stamp it with a date —
that is the pre-release skill's job.

```markdown
## [Unreleased]

### Added
- **Feature name**: what it does and how to use it.
```

### Downstream skills and docs
Search `.agents/skills/` for any skill whose instructions reference the area
changed by the PR. If the PR changes a workflow those skills describe (e.g., a
new step that belongs in an existing checklist, a new gotcha for an existing
process), add a targeted note — not a rewrite.

---

## Phase 5 — Verify locally

```
cmd.exe /c bun run type-check
cmd.exe /c bun run validate:locales
```

Also confirm:
- All files that should end with a newline do (`git diff` shows no
  `\ No newline at end of file`)
- New directories contain all expected files
- Any new CI workflow actions are pinned to commit SHAs (see Gotchas)

---

## Phase 6 — Close the PR with a credit comment

GitHub will not auto-close a PR you applied manually. After pushing:

```bash
gh pr close <N> --comment "Thanks for this, @<contributor> — <one sentence on what the PR adds>. Since the PR had merge conflicts and hadn't received a response in a while, I applied the changes manually (with <brief list of fixes applied>). Closing as implemented in <short-sha>."
```

---

## Phase 7 — Watch for post-push CI failures

Two failures are common after integrating a stale PR.

### Fixed-output hash drift
When a file the PR depends on (a lockfile, a manifest, a dependency list) has
changed since the PR was opened, any hash the PR hardcodes for that file will
be wrong. The CI build will fail with a message of the form:

```
hash mismatch:
  expected: sha256-<OLD_HASH>
       got: sha256-<CORRECT_HASH>
```

Copy the `got:` value and update the hash in the relevant source file. This is
the authoritative correct value — do not compute it locally.

### SonarCloud S7637 — action not pinned to commit SHA
Any new GitHub Actions step using a mutable tag (`@v2`, `@v31`) instead of a
full commit SHA is flagged as a VULNERABILITY by SonarCloud. To pin correctly:

```bash
# Step 1: resolve the tag to a tag-object SHA
gh api repos/<owner>/<action-repo>/git/ref/tags/<tag> --jq '.object.sha'

# Step 2: dereference the tag object to get the actual commit SHA
gh api repos/<owner>/<action-repo>/git/tags/<tag-object-sha> --jq '.object.sha'
```

Use the commit SHA from step 2, keeping the tag as a comment:

```yaml
- uses: <owner>/<action-repo>@<commit-sha> # <tag>
```

---

## Gotchas

**The PR's diff context may not match master**
When a PR has merge conflicts, the `@@` context lines in the diff often no
longer exist verbatim in the current file. Do not use the diff context as your
`old_string` — read the current file and reconstruct the equivalent edit.

**Trailing newline trap in the Edit tool**
If the PR diff ends with `\ No newline at end of file` and your `old_string`
does not capture the file's existing trailing `\n`, that `\n` is left as a
suffix and produces an extra blank line. The git diff will show a spurious `+`
(empty line added). Fix: include the trailing blank in `old_string` so your
replacement fully controls the file ending.

**Annotated tags require two API calls to dereference**
`gh api .../git/ref/tags/<tag>` returns the SHA of the *tag object*, not the
commit. A second call to `.../git/tags/<tag-object-sha>` gives the actual
commit SHA. Pinning the tag object SHA instead of the commit SHA is silently
wrong.

**Stale hashes are expected — let CI surface the correct value**
Do not attempt to compute content hashes locally. The CI workflow exists to
catch drift. When it fails, the `got:` line in the build log is the correct
value to use.
