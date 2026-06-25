---
name: review-external-pr
description: >
  Review an incoming pull request from an external or first-time contributor to Mini Diarium.
  Covers correctness, PHILOSOPHY.md alignment (all 6 principles), project best-practices
  compliance, and technical quality. Produces two artifacts: an internal analysis report
  and a ready-to-post draft response, both written in plain human prose.

  Use this skill whenever someone asks you to review, assess, evaluate, or respond to a
  GitHub pull request — especially from external contributors. Triggers on phrases like
  "review this PR", "what do you think of this PR", "should we merge this", "respond to
  this contributor", "analyse this pull request", or when a GitHub PR URL or number is
  mentioned alongside a review intent.
compatibility: Requires gh CLI authenticated to the repo.
---

# Review External PR

This is a collaborative process. The agent handles the mechanical parts (diff fetch, claim
verification, supply chain scan, best-practices checks, test run). The maintainer makes all
judgement calls. The agent presents a recommendation with rationale at the pause point;
the maintainer confirms or overrides.

Two output files — read `assets/analysis-template.md` and `assets/response-template.md`
before writing either:

- `docs/pr-{number}-analysis.md` — internal report, not published
- `docs/pr-{number}-response-draft.md` — draft GitHub comment, written after the maintainer
  clears the analysis

---

## Steps

### Step 1 — Fetch PR data

```bash
gh pr view <number> --json title,body,author,baseRefName,headRefName,state,additions,deletions,changedFiles,labels --repo fjrevoredo/mini-diarium
gh pr diff <number> --repo fjrevoredo/mini-diarium
```

Note the author, whether this is their first contribution, and what the PR claims to fix.

---

### Step 2 — Scope and supply chain audit

**Do this before any technical review.** AI-assisted or malicious PRs increasingly bundle
unrelated changes alongside a legitimate fix, sometimes camouflaged in a noisy diff.

#### 2a — File scope check

```bash
gh pr diff <number> --repo fjrevoredo/mini-diarium --name-only
```

Compare every changed file against what the PR claims to touch. Stop and raise a scope
concern for any of these:

- `.github/workflows/` — CI can exfiltrate secrets or modify the release pipeline
- `package.json` scripts (`prepare`, `postinstall`, `preinstall`) — run automatically on install
- Lockfile additions not backed by `package.json` changes — can smuggle dependencies
- `src-tauri/capabilities/` or `tauri.conf.json` security section — expands OS-level permissions
- `src-tauri/src/crypto/` or auth code unrelated to the stated fix
- `CHANGELOG.md`, version fields, or release scripts touched by a non-maintainer

#### 2b — Diff content scan

Read the added lines with these patterns in mind:

- Network calls: `fetch(`, `axios`, `XMLHttpRequest`, `WebSocket`, `reqwest`, `hyper`, `ureq`
- Obfuscated payloads: `atob(`, `btoa(`, `eval(`, `Function(`, `fromCharCode`
- CI secret exfiltration: `process.env.`, `std::env::var` reads in unexpected places
- New hardcoded external URLs (anything not `localhost`, `example.com`, or `github.com/fjrevoredo`)

#### 2c — If anything fires

Write the internal analysis with a "Scope concern" verdict and stop. The draft response
asks the contributor to explain the out-of-scope change; it does not accuse. The maintainer
decides whether to close the PR.

---

### Step 3 — Read the affected source files

Read the current `master` version of every changed file for full context. Also check
related files not touched: if a component changed, did its test file get updated? If
`package.json` changed, are both lockfiles regenerated?

---

### Step 4 — Verify factual claims in the PR description

| Claim type | How to verify |
|---|---|
| "Library X bundles extension Y" | `grep -i "Y" node_modules/@scope/X/dist/index.js` |
| "These tests fail for everyone" | `cmd.exe /c bun run test:run` — read the actual count |
| "This flag is required by Node/tool" | Search the codebase; check tool docs |
| "Frontend-only, no Rust touched" | Scan the diff for `src-tauri/` paths |
| "Behaviour is unchanged" | Confirm the feature still works via the alternative code path |

Note any claim that is wrong. The correction goes in both artifacts.

---

### Step 5 — Dependency hygiene

When an `import` is removed, verify nothing else in `src/` still uses that package:

```bash
grep -r "from 'the-package'" src/ --include="*.ts" --include="*.tsx"
```

If unused, the entry in `package.json` should be removed. This project requires both
lockfiles to be regenerated whenever a dep is added or removed:

```bash
bun install
npm install --package-lock-only --legacy-peer-deps
```

`--legacy-peer-deps` is always required: `eslint-plugin-solid` declares a peer of
`eslint@^9` but the project uses `eslint@10`.

---

### Step 6 — PHILOSOPHY.md alignment

Read `PHILOSOPHY.md`. Check all six principles:

| # | Principle | Key question |
|---|---|---|
| 1 | Small and extensible core | Does this belong in core, or could it be an extension? |
| 2 | Boring security | Does this touch crypto, auth, or the network surface? Standard approaches only? |
| 3 | Testing pyramid | Is every changed behaviour tested? New hot paths benchmarked? |
| 4 | Easy in, easy out | Does this affect import/export or create lock-in? |
| 5 | Focused scope | Does this serve private encrypted journaling, or is it scope creep? |
| 6 | Simple is good | Does the added complexity justify itself? |

---

### Step 7 — Best-practices checklist

Use `docs/best-practices/FRONTEND_BEST_PRACTICES.md` for `src/` changes and
`docs/best-practices/RUST_BEST_PRACTICES.md` for `src-tauri/` changes.

**Frontend checks:**

*Reactivity* — No prop destructuring at component scope. Signal reads inside async
callbacks (rAF, setTimeout) are plain untracked reads — correct, but confirm no
subscription is accidentally set up. When a `createEffect` schedules cancellable
async work, `onCleanup(() => cancel(id))` is more idiomatic than re-checking state
inside the callback. Flag as a suggestion if it applies.

*State* — Session-sensitive state resets on lock (`src/state/session.ts`). Module-level
signals in test files reset in `beforeEach`.

*IPC* — No raw `invoke()` outside `src/lib/tauri.ts`. User-facing backend errors through
`mapTauriError()`.

*Editor* — TipTap content stays HTML in all save paths. No load/save loops in editor
lifecycle effects. New extensions do not open XSS surfaces.

*Testing* — `renderWithI18n()` used, not bare `render()`. `waitFor` for async assertions.
No `data-testid` removed without updating `e2e/CLAUDE.md`.

*Accessibility* — Inputs have labels. Icon buttons have accessible names. Errors use
`role="alert"`.

*File sizes* — soft/hard limits (complex editor/layout: 350/550; test files: 450/750;
hooks/state: 220/350; overlay shells: 250/400; utilities: 250/400):

```powershell
Get-ChildItem src -Recurse -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object { $lines = (Get-Content $_.FullName).Count; if ($lines -ge 250) { "{0,5} {1}" -f $lines, $_.FullName } } |
  Sort-Object -Descending
```

---

### Step 8 — Run the test suite

```bash
cmd.exe /c bun run test:run
```

Record the pass/fail count. A failure on clean `master` is pre-existing and unrelated
to the PR.

---

### Step 9 — Write the internal analysis and pause

Write `docs/pr-{number}-analysis.md` using `assets/analysis-template.md`.

Then present this summary to the maintainer:

```
Analysis saved to docs/pr-{number}-analysis.md.

Recommendation: {Merge after fix / Merge as-is / Reject / Scope concern}

{2-3 sentences: what the PR gets right, what the key issue is if any.}

Decision points:
1. {Finding} — I suggest {X} because {Y}. Agree?

Scope/security: clean  /  concern: {specific file or pattern}

Say "go ahead" to proceed with the draft, or correct anything above.
```

Skip "Decision points" if all checks are unambiguous. Wait for the maintainer's reply
before writing the draft response.

---

### Step 10 — Write the draft response

Write `docs/pr-{number}-response-draft.md` using `assets/response-template.md`.

Use the "Normal review response" section unless Step 2 found an out-of-scope change,
in which case use the "Scope concern response" section.

#### Style rules for both artifacts

Follow [`docs/best-practices/WRITING_STYLE.md`](../../docs/best-practices/WRITING_STYLE.md) for shared rules (em dashes, emojis, filler phrases, voice). PR responses add these conventions:

- No commit-style prefixes (`fix(editor):`, `feat(auth):`).
- No generic openers ("Thanks for this PR!"). Say something specific about what the PR fixes or adds.
- No "I've reviewed / I found X issues" constructions. State findings directly.
- Prefer prose over bullet lists for fewer than four items.
- Be direct about blockers: "This can't merge without X" not "It would be ideal to also X."

#### Pre-save style scan (required before writing the file)

Before writing `docs/pr-{number}-response-draft.md`:

1. Read [`docs/best-practices/WRITING_STYLE.md`](../../docs/best-practices/WRITING_STYLE.md) in full.
2. Re-read the draft against every rule in that file.
3. Fix all violations before saving.

---

## Completion

Report to the maintainer: verdict, any philosophy violations, required vs optional count,
and paths to both files. Do not post to GitHub.
