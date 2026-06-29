# Apply GitHub Actions Dependency PRs

Apply GitHub Actions dependency update PRs from GitHub to
`.github/workflows/*.yml`. This is the per-ecosystem procedure dispatched
from `ENTRY.md` for PRs classified as **actions** by the Triage section.

GitHub Actions PRs only edit version pins (`uses: owner/repo@version`) in
workflow YAML files. There is no lockfile; the workflow file is the source
of truth.

## Quick Checklist

- [ ] Discovery: `gh pr view <N> --json files,title,body`
- [ ] Triage sub-step: PR files are all under `.github/workflows/`
- [ ] Apply the version bump from the PR diff to the local workflow files
- [ ] Major-bump review: read upstream release notes, confirm no breaking change
- [ ] Validate with `actionlint` and `gh workflow view`
- [ ] Verify the change set is only under `.github/workflows/`

## Triage Sub-Step

```bash
gh pr view <NUMBER> --repo <owner/repo> --json files --jq '.files[].path'
```

- If the output lists **only** files under `.github/workflows/` → this
  procedure applies.
- If the output lists files outside `.github/workflows/` (e.g., the
  Dependabot config in `.github/dependabot.yml`) → those changes are
  out of scope for this procedure. Apply only the workflow file changes
  and ask the user about the other files.
- If no files are under `.github/workflows/` → this procedure does not
  apply; re-classify the PR.

## Gotchas

- **Major version bumps may include breaking changes.** A `MAJOR` bump
  (e.g., `actions/checkout` v6→v7) often means more than a version
  string change: it may upgrade the action's internal module system
  (CommonJS → ESM), require a newer Actions Runner version, or remove
  inputs. Always read the upstream release notes linked in the PR body
  before applying. The PR body's `Release notes` section links to the
  upstream releases page.
- **Self-hosted runners may need version bumps.** Some major-version
  action upgrades require a minimum Actions Runner version on
  self-hosted runners. For example, `actions/cache` v5 requires runner
  `2.327.1+`. Mini Diarium uses GitHub-hosted runners in all current
  workflows, but if a self-hosted runner is added in the future, this
  must be revisited.
- **`actionlint` is the right validator for workflow files.** It catches
  shell-script errors, expression-syntax errors, and known action-input
  mistakes that a plain YAML parse would miss. If `actionlint` is not
  installed, fall back to a PowerShell YAML parse, but note that this
  is a weaker check.
- **Multiple actions in one PR.** A Dependabot PR can bump several
  distinct `uses:` references across several workflow files. The PR's
  `files[]` lists all touched workflows. Apply the version pin change
  to every `uses:` line that the PR's diff modifies.
- **Workflows are read by the Tauri release pipeline, not built locally.**
  This procedure does NOT invoke `cargo build` or `bun run test`. The
  final validation is the next CI run triggered by pushing the change.

## Steps

1. **Fetch the PR metadata and diff:**
   ```bash
   gh pr view <NUMBER> --repo <owner/repo> --json title,body,files
   gh pr diff <NUMBER> --repo <owner/repo>
   ```
   Note each `uses:` line that the PR changes and the new version.

2. **Identify whether the bump is MAJOR.** Read the PR title. If the
   version goes up by a major (e.g., `6.0.3` → `7.0.0`, or `5` → `5.0.5`
   is patch only), check the PR body's `Release notes` section for any
   **breaking** change mention.

3. **If a MAJOR bump has a breaking change that affects this repo's
   usage, STOP and ask the user.** The breaking change must be applied
   (e.g., update a removed input name) or the PR must be deferred until
   a follow-up PR handles the breaking change.

4. **Apply the version bump to each touched workflow file.** For each
   file in the PR's `files[]`, edit the `uses:` line(s) to match the
   PR's diff. Preserve all other content (indentation, comments,
   surrounding steps).

5. **Validate with `actionlint`:**
   ```bash
   cmd.exe /c actionlint -version
   cmd.exe /c actionlint .github/workflows/*.yml
   ```
   If `actionlint` is not installed, fall back to PowerShell:
   ```powershell
   Get-ChildItem .github/workflows/*.yml | ForEach-Object {
     $null = Get-Content -Raw $_.FullName | ConvertFrom-Yaml
   }
   ```
   A thrown exception indicates a parse error.

6. **Sanity-check one modified workflow via the GitHub API:**
   ```bash
   gh workflow view <workflow-file-name> --yaml | Out-Null
   ```
   This re-fetches the workflow YAML from GitHub and confirms the
   pushed content is parseable by GitHub's own parser. (Run after
   pushing the change, or use this as a final pre-push check if the
   workflow is already in master.)

7. **Verify the change set:**
   ```bash
   git diff --stat
   ```
   Expected: changes only under `.github/workflows/`. Investigate any
   other files.

## Validation

- `cmd.exe /c actionlint .github/workflows/*.yml` exits 0, OR the
  PowerShell YAML parse succeeds for every modified file.
- `git diff --stat` shows changes only under `.github/workflows/`.
- For MAJOR bumps: the upstream release notes have been read and any
  breaking change has been either applied or explicitly deferred by the
  user.
- The commit message names the action(s) bumped, e.g.,
  `Dependency Update: bump actions/checkout to 7.0.0, actions/cache to 5.0.5`.

## Reference

- `.github/dependabot.yml` — current Dependabot configuration for the
  `github-actions` ecosystem (groups, schedule, cooldown).
- `.github/workflows/*.yml` — the workflow files this procedure edits.
- For npm dependency updates, see `procedures/npm.md`.
- For Cargo dependency updates, see `procedures/cargo.md`.
