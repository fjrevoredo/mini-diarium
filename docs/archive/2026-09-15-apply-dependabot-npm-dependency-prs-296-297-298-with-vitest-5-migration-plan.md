# Apply Dependabot npm dependency PRs 296 297 298 with Vitest 5 migration

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master`, clean at `87afa29` (`git status --porcelain` empty, `git log --oneline -1` → `87afa29 Add rebranding banner`).
- Remote: `fjrevoredo/mini-diarium`. All four open PRs are Dependabot branches on that repo.
- Shell: Windows PowerShell (win32). Project commands are wrapped in `cmd.exe /c ...` per root `CLAUDE.md` (Execution Environment); `cargo` runs bare from the repo root.
- Stack: SolidJS frontend (`package.json`, dual lockfiles `bun.lock` + `package-lock.json`); Rust/Tauri v2 Cargo workspace (no Cargo PR in this task). `.opencode/` is a separate npm-only sub-package.
- Local toolchain: Node `v24.21.0`, bun `1.4.2` (reports `process.versions.node` = `26.3.0`), npm `11.19.0`.
- Relevant runbook: `.agents/skills/runbooks/skills/apply-dependency-prs/ENTRY.md` → `procedures/npm.md` (all four PRs classify as npm).
- Precedent plan (same runbook, previous batch): `docs/plans/2026-09-07-apply-dependabot-dependency-prs-plan.md` — its `DEC-001`/`DEC-003` document the `@tiptap/*` monorepo caret-drift dance that Task 1.3/1.4 must repeat.

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Open PRs | #298, #297, #296, #285 | `gh pr list --repo fjrevoredo/mini-diarium --state open` |
| #298 (prod deps) ecosystem | npm; files `package.json`, `package-lock.json`; label `javascript` | `gh pr view 298 --json labels,files` |
| #297 (dev deps) ecosystem | npm; files `package.json`, `package-lock.json`; label `javascript` | `gh pr view 297 --json labels,files` |
| #296 ecosystem | npm; files `package-lock.json` only | `gh pr view 296 --json files` |
| #285 status | **Already applied**: `toml@4.3.0` is present in `master`'s `.opencode/package-lock.json:401`; PR diff is empty (`changed_files: 0`) | `gh api repos/fjrevoredo/mini-diarium/pulls/285`, `Select-String .opencode/package-lock.json 'toml-4'` |
| Current `@kobalte/core` | `^0.13.13` | `package.json:65` |
| Current `@tiptap/*` | `^3.30.6` (8 packages) + `3.30.6` exact (`extension-text-style`) | `package.json:71-79` |
| Current `browserslist` / `dompurify` / `lucide-solid` | `^4.28.8` / `^3.4.14` / `^1.34.0` | `package.json:80,81,84` |
| Current `@mermaid-js/mermaid-cli` | `11.16.0` (exact) | `package.json:90` |
| Current `@vitest/coverage-v8` / `@vitest/ui` / `vitest` | `^4.1.11` (all three) | `package.json:99,100,116` |
| Current `js-yaml` | `package-lock.json` 4.3.1 (line 10276-10278) but `bun.lock` 4.2.0 (line 1388) — **already inconsistent** | `Select-String` both lockfiles |
| `package-lock.json` root block `@tiptap/*` | exact `3.30.6` while `package.json` says `^3.30.6` — pre-existing drift | `package-lock.json:19` vs `package.json:71` |
| Vitest 5 published | `vitest@5.0.1`, `@vitest/coverage-v8@5.0.1`, `@vitest/ui@5.0.1` | `npm view <pkg>@5 version` |
| Vitest 5 requirements | Vite >= 6.4.0, Node >= 22.12.0 | https://vitest.dev/guide/migration/ |
| Frontend bench files using removed top-level `bench` import | `src/lib/markdown.bench.ts:1`, `src/lib/wordcount.bench.ts:1` | `rg "from 'vitest'" src/**/*.bench.ts` |
| `vi.mock`/`vi.hoisted` calls | 44, all at top level (0 indented matches) | `Select-String -Pattern '^\s+vi\.(mock\|unmock\|hoisted)\('` |
| `test.sequential` / unawaited `resolves`/`rejects` / Vitest browser mode | none found | `Select-String` over `src/**` and `vitest.config.ts` |
| CI test job runner | `bun run test:coverage` (no `actions/setup-node`) | `.github/workflows/ci.yml:190` |

### Hard constraints

1. Never hand-edit `bun.lock` or `package-lock.json` — regenerate with the documented commands (`procedures/npm.md` Phase 3 step 5); a hand-patch breaks the Flatpak `npm ci --offline` build and is unreviewable.
2. All `@tiptap/*` packages must resolve to the same version — a mixed set creates duplicate `node_modules` copies with incompatible types (`TS2322`), per `procedures/npm.md` gotcha.
3. Run project commands through `cmd.exe /c ...` — bare `bun`/`npm` from this shell is unreliable (`CLAUDE.md` Execution Environment).
4. Commit only intentionally changed files, with the user's real git identity (`git config user.name`/`user.email`), and do not push (`procedures/npm.md` Phase 4 step 6).
5. `nix/package.nix` `npmDepsHash` cannot be refreshed from Windows; leave it unchanged and note the omission in the commit message (`procedures/npm.md` Phase 3 step 4 / Phase 5).

## Goal

Apply the three applicable open Dependabot PRs (#298 prod deps, #297 dev deps incl. Vitest 5, #296 js-yaml) into `master` as one verified, scoped commit with both lockfiles regenerated and aligned, including the Vitest 5 migration work that #297 requires, leaving the frontend gates green.

## Scope

- `package.json` prod bumps from #298: `@kobalte/core` → `^0.13.14`, all `@tiptap/*` → `^3.31.3` (`extension-text-style` stays exact at `3.31.3`), `browserslist` → `^4.28.9`, `dompurify` → `^3.4.15`, `lucide-solid` → `^1.42.0`.
- `package.json` dev bumps from #297: `@mermaid-js/mermaid-cli` → `11.17.0`, `@testing-library/user-event` → `^14.6.7`, `@unocss/reset`/`@unocss/vite`/`unocss` → `^66.10.0`, `@vitest/coverage-v8`/`@vitest/ui`/`vitest` → `^5.0.0` (major), `@wdio/cli`/`@wdio/local-runner`/`@wdio/mocha-framework` → `^9.31.6`, `eslint` → `^10.10.0`, `happy-dom` → `^20.14.0`, `@playwright/test` → `^1.63.0`.
- Regeneration of `bun.lock` + `package-lock.json`.
- `js-yaml` 4.3.2 resolution in both lockfiles (#296).
- Vitest 5 migration: rewrite `src/lib/markdown.bench.ts` and `src/lib/wordcount.bench.ts` to the new `{ bench }` test-context fixture API, and fix any test breakage caused by Vitest 5 behavior changes (`clearMocks` default, unawaited async assertions).
- A `CHANGELOG.md` `### Internal` entry under `## [0.7.3] - Unreleased` (`CHANGELOG.md:37`), matching the dependency-bump convention at `CHANGELOG.md:53-54`.

## Non-Goals

- PR #285 (`.opencode` toml 4.3.0) — already present in `master`; no action. Dependabot will close the empty PR itself.
- E2E tests (`bun run test:e2e`) — out of scope for dependency bumps (`procedures/npm.md` Scope Boundaries). The `@wdio/*` bump is dev tooling only and no Tauri API/plugin changed.
- `nix/package.nix` `npmDepsHash` — requires Linux+Nix; CI auto-patches it on push (`procedures/npm.md` Phase 5).
- Adding a `.vitest/` entry to `.gitignore` — the Vitest 5 artifact directory is only used by reporters this repo does not configure (no html/json/junit/attachments); coverage output keeps its existing `coverage/` path.
- Vitest browser-mode changes (strict locators, `toHaveTextContent` strict equality) — the repo uses the `jsdom` environment only (`vitest.config.ts:13`) and has no browser mode.
- Backend/Cargo gates — no Rust file changes in this task.

## Assumptions

- Vitest 5 runs under bun 1.4.2's Node 26.3.0 runtime and Vite ^8.2.2, both above Vitest 5's minimums (verified by `bun -e console.log(process.versions.node)` and `package.json:114`).
- The three PRs are the intended set (user supplied the open-PRs URL and approved integrating Vitest 5).
- Non-major bumps (unocss, wdio, eslint, happy-dom, playwright, kobalte, browserslist, dompurify, lucide-solid, mermaid-cli) are non-breaking; the type-check/lint/test gates would turn the task `BLOCKED` if not.
- Dependabot's `^5.0.0` ranges resolve to the current latest 5.0.1 for the three Vitest packages.

## Open Questions

- Q1: How to handle PR #297's Vitest 4→5 major bump (breaks the two `*.bench.ts` files, changes mock/assertion defaults)? — **Resolved: integrate Vitest 5 and make the required migration fixes in this task.**
- Q2: PR #296's `package-lock.json` diff is stale (based on an older `master`, it reverts `@tiptap/*` root pins to caret and adds unrelated puppeteer/tailwind peer entries). Apply the raw diff? — **Resolved: do not apply the raw lockfile diff; instead regenerate both lockfiles from the updated `package.json` and force `js-yaml` to 4.3.2.** The lockfile is regenerated, not merged (`procedures/npm.md` Phase 1 step 2).

## Milestones

### Milestone 1: Root npm updates (#298 prod + #297 dev + #296 js-yaml)

- Status: COMPLETED
- Purpose: Apply both `package.json` groups and the js-yaml resolution, then regenerate and align both lockfiles.
- Exit Criteria: Both lockfiles resolve the bumped packages to the new versions (with all `@tiptap/*` at one version and `js-yaml` at 4.3.2); the Flatpak integrity check finds no missing `resolved`/`integrity` entries.

#### Task 1.1: Edit `package.json` `dependencies` (#298)

- Status: COMPLETED
- Depends On: none
- Objective: All 13 #298 version strings updated in `dependencies`; nothing else touched.
- Steps:
  1. In `dependencies` (`package.json:64-87`): `@kobalte/core` `^0.13.13`→`^0.13.14`; each of `@tiptap/core|extension-color|extension-highlight|extension-image|extension-placeholder|extension-text-align` `^3.30.6`→`^3.31.3`; `@tiptap/extension-text-style` `3.30.6`→`3.31.3` (exact, keep it exact); `@tiptap/pm|starter-kit` `^3.30.6`→`^3.31.3`; `browserslist` `^4.28.8`→`^4.28.9`; `dompurify` `^3.4.14`→`^3.4.15`; `lucide-solid` `^1.34.0`→`^1.42.0`.
  2. Preserve ordering and formatting; change only version strings (`procedures/npm.md` Phase 3 step 1).
- Validation: `git diff package.json` shows exactly the version-string edits above in the `dependencies` block and no other lines.
- Notes: `@oliveai`-style extra deps are not present; do not add anything.

#### Task 1.2: Edit `package.json` `devDependencies` (#297)

- Status: COMPLETED
- Depends On: none
- Objective: All 15 #297 version strings updated in `devDependencies`; nothing else touched.
- Steps:
  1. In `devDependencies` (`package.json:88-120`): `@mermaid-js/mermaid-cli` `11.16.0`→`11.17.0`; `@testing-library/user-event` `^14.6.6`→`^14.6.7`; `@unocss/reset` `^66.8.1`→`^66.10.0`; `@unocss/vite` `^66.8.1`→`^66.10.0`; `@vitest/coverage-v8` `^4.1.11`→`^5.0.0`; `@vitest/ui` `^4.1.11`→`^5.0.0`; `@wdio/cli` `^9.31.2`→`^9.31.6`; `@wdio/local-runner` `^9.31.2`→`^9.31.6`; `@wdio/mocha-framework` `^9.31.2`→`^9.31.6`; `eslint` `^10.9.0`→`^10.10.0`; `happy-dom` `^20.11.6`→`^20.14.0`; `unocss` `^66.8.1`→`^66.10.0`; `vitest` `^4.1.11`→`^5.0.0`; `@playwright/test` `^1.62.0`→`^1.63.0`.
  2. Leave `@wdio/spec-reporter`/`@wdio/types`/`webdriverio`/`jsdom`/`prettier`/`typescript`/`typescript-eslint`/`vite`/`vite-plugin-solid`/`undici`/`@solidjs/testing-library`/`@tauri-apps/cli`/`@types/*`/`@eslint/js`/`eslint-plugin-solid` at their current values (unchanged by the PR).
- Validation: `git diff package.json` shows exactly the version-string edits above in the `devDependencies` block and no other lines.
- Notes: `@vitest/*` and `vitest` must all move to `^5.0.0` together — Vitest packages peer-pin each other exactly.

#### Task 1.3: Regenerate `bun.lock`

- Status: COMPLETED
- Depends On: 1.1, 1.2
- Objective: `bun.lock` reflects the new versions with a single `@tiptap` resolution.
- Steps:
  1. Run `cmd.exe /c bun install`.
  2. Check `Select-String -Path bun.lock -Pattern '"@tiptap/core"'` — if `bun install` resolves the caret `^3.31.3` ranges to a version newer than 3.31.3 (or leaves `extension-text-style` at a different version than the rest), repeat the precedent plan's `DEC-001` dance: temporarily exact-pin **all** `@tiptap/*` to `3.31.3`, run `bun install`, then restore `package.json` to the Task 1.1 form (`^3.31.3`, exact `3.31.3` for `extension-text-style`).
- Validation: `Select-String -Path bun.lock -Pattern '@tiptap/core'` shows `3.31.3`; `@kobalte/core` shows `0.13.14`; `vitest` shows `5.0.1`; all nine `@tiptap/*` entries show one version.
- Notes: Dependabot never touches `bun.lock`; it is regenerated locally (`procedures/npm.md` gotcha). Record the exact-pin workaround in the Decision Log if used.

#### Task 1.4: Regenerate `package-lock.json`

- Status: COMPLETED
- Depends On: 1.3
- Objective: `package-lock.json` matches the new `package.json` (this also clears the pre-existing root-block drift at `package-lock.json:19`).
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"` (canonical command; `--legacy-peer-deps` is mandatory for the `eslint-plugin-solid` peer mismatch, `procedures/npm.md` gotcha).
- Validation: `Select-String -Path package-lock.json -Pattern '"version": "0.7.2"'` (project version) and the bumped packages resolve to `3.31.3` / `0.13.14` / `5.0.1` / etc.; the root `packages[""]` block (`package-lock.json:1-69`) matches `package.json`.
- Notes: `--package-lock-only` leaves `node_modules/` untouched. If Task 1.6 detects missing `resolved`/`integrity` fields, delete `node_modules/` and run a full `npm install --legacy-peer-deps` instead.

#### Task 1.5: Force `js-yaml` 4.3.2 in both lockfiles (#296)

- Status: COMPLETED
- Depends On: 1.4
- Objective: `js-yaml` resolves to 4.3.2 in both lockfiles (the PR's single intended change).
- Steps:
  1. Check `Select-String -Path bun.lock -Pattern 'js-yaml@'` and `Select-String -Path package-lock.json -Pattern 'js-yaml-4'`.
  2. If either is still below 4.3.2 (`bun.lock` was 4.2.0, `package-lock.json` was 4.3.1), run `cmd.exe /c bun update js-yaml` and `cmd.exe /c "npm update js-yaml --package-lock-only --legacy-peer-deps"`.
  3. Re-run the checks. Do not hand-edit either lockfile (Hard constraint 1).
- Validation: both lockfiles contain `js-yaml` `4.3.2` (and `bun.lock` no longer carries 4.2.0); no other package version churns beyond what Tasks 1.3/1.4 produced.
- Notes: `js-yaml` is transitive (required as `^4.1.0`), so the plain install commands may keep the old resolution — `update` is the fallback. PR #296's raw diff is deliberately not applied (Open Question Q2).

#### Task 1.6: Verify lockfiles and Flatpak integrity

- Status: COMPLETED
- Depends On: 1.5
- Objective: Both lockfiles carry the new versions and every `node_modules/*` entry has `resolved` + `integrity`.
- Steps:
  1. Grep both lockfiles for each bumped package/version listed in Tasks 1.1-1.2 and for `js-yaml` 4.3.2.
  2. Run the integrity count: `$pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages; ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count` and compare against the total `node_modules/*` key count.
- Validation: every bumped package/version appears in both lockfiles; the `resolved`+`integrity` count equals the total entry count.
- Notes: Missing fields break the Flatpak `npm ci --offline` build (`procedures/npm.md` gotcha); if found, use the full-install fallback from Task 1.4.

### Milestone 2: Vitest 5 migration

- Status: COMPLETED
- Purpose: Adapt the repo to Vitest 5's breaking changes so `bun run test:run` and `bun run bench` stay green.
- Exit Criteria: both bench files use the new `{ bench }` fixture API and execute; the test suite passes under Vitest 5 with no source behavior change beyond the migration.

#### Task 2.1: Rewrite `src/lib/markdown.bench.ts` to the Vitest 5 benchmark API

- Status: COMPLETED
- Depends On: 1.4
- Objective: The file no longer imports the removed top-level `bench` and runs under `vitest bench`.
- Steps:
  1. Replace `import { bench, describe } from 'vitest';` (`src/lib/markdown.bench.ts:1`) with `import { test } from 'vitest';`.
  2. Convert the `describe('parseMarkdownToHtml', ...)` block to `test('parseMarkdownToHtml', async ({ bench }) => { ... })` and call `await bench('<case name>', () => { ... }).run()` for each existing case (`short entry (~100 words)`, `long entry (~1000 words)`), preserving the existing bodies verbatim.
- Validation: `Select-String -Path src/lib/markdown.bench.ts -Pattern "import .* from 'vitest'"` shows only `{ test }`; `cmd.exe /c bun run bench markdown` exits 0 and prints a benchmark table.
- Notes: The fixture is only available in `*.bench.ts` files (`benchmark.include` default), which this file matches. Keep both cases as independent `bench().run()` calls, not `bench.compare()` — they measure the same operation at two sizes, not competing implementations.

#### Task 2.2: Rewrite `src/lib/wordcount.bench.ts` to the Vitest 5 benchmark API

- Status: COMPLETED
- Depends On: 1.4
- Objective: The file no longer imports the removed top-level `bench` and runs under `vitest bench`.
- Steps:
  1. Replace `import { bench, describe } from 'vitest';` (`src/lib/wordcount.bench.ts:1`) with `import { test } from 'vitest';`.
  2. Convert the two `describe(...)` blocks into two `test(...)` blocks, each `async ({ bench }) => { await bench('<case name>', () => { ... }).run(); }`, preserving the existing bodies (`countWordsFromText` `~500w plain prose`, `countWordsInHtml` `~600w TipTap HTML`).
- Validation: `Select-String -Path src/lib/wordcount.bench.ts -Pattern "import .* from 'vitest'"` shows only `{ test }`; `cmd.exe /c bun run bench wordcount` exits 0 and prints a benchmark table.
- Notes: Keep `concat(...)` and the fixture string constants unchanged.

#### Task 2.3: Fix test breakage from Vitest 5 behavior changes

- Status: COMPLETED
- Depends On: 2.1, 2.2
- Objective: The full suite passes under Vitest 5; any failure is traced to a documented Vitest 5 change, not silently masked.
- Steps:
  1. Run `cmd.exe /c bun run test:run` and collect failures.
  2. For each failure, classify it against the Vitest 5 migration list: `clearMocks` now `true` by default (mock call history reset per test), unawaited async assertions now fail, `vi.mock`/`vi.hoisted` must be top-level, removed deprecated entrypoints.
  3. Fix the test (e.g. make the assertion self-contained, add the missing `await`, move a hoisted call to top level) — do not add `clearMocks: false` to `vitest.config.ts` unless a failure is a genuine pre-existing reliance that the migration guide says must be opted out; record that decision.
- Validation: `cmd.exe /c bun run test:run` exits 0.
- Notes: Discovery found no `test.sequential`, no unawaited `resolves`/`rejects`, and no non-top-level `vi.mock` — the likely surface is `clearMocks`. `vitest.config.ts:12-38` is the config; keep changes minimal. **Executed 2026-09-15: `bun run test:run` passed on the first run under Vitest 5.0.1 (109 files / 1126 tests), so no test changes were required.**

#### Task 2.4: Verify the benchmark command

- Status: COMPLETED
- Depends On: 2.3
- Objective: `bun run bench` (i.e. `vitest bench`) executes the migrated bench files end to end.
- Steps:
  1. Run `cmd.exe /c bun run bench`.
- Validation: exit code 0 and a reported result for all four benchmark cases (2 in `markdown.bench.ts`, 2 in `wordcount.bench.ts`).
- Notes: Frontend benchmarks are not run in CI (`benchmarks/CLAUDE.md` Gotcha #9), but they are a repo contract and must not be left broken by the Vitest 5 bump.

### Milestone 3: Validation gates

- Status: COMPLETED
- Purpose: Prove the frontend is green under the new dependency set.
- Exit Criteria: type-check, lint, and test:run all exit 0.

#### Task 3.1: Type-check

- Status: COMPLETED
- Depends On: 1.6, 2.3
- Objective: TypeScript is clean under the new dependency set.
- Steps:
  1. Run `cmd.exe /c bun run type-check`.
- Validation: exit code 0.
- Notes: Primary risk is an `@tiptap` monorepo version split (`TS2322`). **Executed 2026-09-15: first run failed with 424 `TS2339` DOM-matcher errors caused by the Vitest 5 / `@testing-library/jest-dom` 7.0.1 type incompatibility; fixed by adding `src/test/jest-dom-vitest.d.ts` (see DEC-002). Second run exited 0.**

#### Task 3.2: Lint

- Status: COMPLETED
- Depends On: 1.6, 2.3
- Objective: ESLint passes with the bumped `eslint`/`eslint-plugin-solid` and migrated bench files.
- Steps:
  1. Run `cmd.exe /c bun run lint`.
- Validation: exit code 0.
- Notes: `lint` targets `src` only, so it also covers the two rewritten bench files.

#### Task 3.3: Frontend tests

- Status: COMPLETED
- Depends On: 2.3
- Objective: The Vitest 5 suite passes.
- Steps:
  1. Run `cmd.exe /c bun run test:run`.
- Validation: exit code 0.
- Notes: Same command as Task 2.3's fix loop; Task 3.3 is the frozen post-migration gate.

### Milestone 4: Finalize, commit, clean

- Status: COMPLETED
- Purpose: Review the full change set, record it in the changelog, commit with the user's identity, and close out the plan.
- Exit Criteria: `git status --porcelain` shows only intended changes; the commit exists; pre-flight checks pass; plan COMPLETED.

#### Task 4.1: Review the change set

- Status: COMPLETED
- Depends On: 3.1, 3.2, 3.3, 2.4
- Objective: The intended file set is the only thing changed.
- Steps:
  1. Run `git status --short` and `git diff --stat`.
  2. Confirm the set is exactly: `package.json`, `bun.lock`, `package-lock.json`, `src/lib/markdown.bench.ts`, `src/lib/wordcount.bench.ts`, any test file fixed in Task 2.3, and `CHANGELOG.md` (added in Task 4.2).
- Validation: no unexpected files appear; `git status --porcelain` lists no untracked artifacts (the plan directory is excluded via `.git/info/exclude`).
- Notes: This set is larger than the usual 3-4 lockfile files because the user approved the Vitest 5 migration (Open Question Q1). `nix/package.nix` is intentionally unchanged (Non-Goals).

#### Task 4.2: Add the CHANGELOG entry

- Status: COMPLETED
- Depends On: 4.1
- Objective: The dependency update and Vitest 5 migration are recorded under `## [0.7.3] - Unreleased` → `### Internal`.
- Steps:
  1. Add one `- **Dependency updates (Dependabot #296, #297, #298)**: ...` bullet under `### Internal` (`CHANGELOG.md:52-54`), naming the prod/dev bumps, the Vitest 5 major upgrade plus the bench-file migration, `js-yaml` 4.3.2, and the `nix/package.nix` `npmDepsHash` Linux follow-up.
- Validation: `git diff CHANGELOG.md` shows a single added bullet in the `0.7.3` Internal section, in the style of `CHANGELOG.md:53-54`.
- Notes: Keep it to one bullet so the change set stays reviewable.

#### Task 4.3: Commit

- Status: COMPLETED
- Depends On: 4.2
- Objective: One scoped commit with the user's identity, no push.
- Steps:
  1. Stage the intentionally changed files and commit with message `Dependency Update: bump prod and dev dependencies (Vitest 5, @tiptap 3.31.3, js-yaml 4.3.2)` or similar (`procedures/npm.md` Phase 4 step 6 format `Dependency Update: <short-summary>`).
  2. Use `git config user.name` / `git config user.email` via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` if not already set; no LLM author, no co-author trailer.
  3. Note the `npmDepsHash` refresh omission in the commit body (`procedures/npm.md` Phase 3 step 4).
- Validation: `git log --oneline -2` shows the new commit; `git status --porcelain` clean except the untracked (excluded) plan.
- Notes: One commit is correct here — the Vitest 5 migration is inseparable from the `package.json` bump it validates. Do not push.

#### Task 4.4: Cleanup intermediate artifacts

- Status: COMPLETED
- Depends On: 4.3
- Objective: No implementation-only artifacts remain.
- Steps:
  1. Delete scratch files created during discovery under `%TEMP%` (`pr298files.json`, `pr297files.json`, `pr285files.json`, `pr298.diff`) if present.
  2. Keep the plan file (untracked and locally excluded); it is the session's ledger.
- Validation: `git status --porcelain` shows no stray files; scratch temp files deleted.
- Notes: Do not remove user-provided files.

#### Task 4.5: Final verification

- Status: COMPLETED
- Depends On: 4.4
- Objective: The repository is green after all changes.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
- Validation: all pre-flight commands exit 0.
- Notes: None.

## Project Gates

- Frontend gates: `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run test:run` — all must exit 0.
- Benchmark gate: `cmd.exe /c bun run bench` — exit 0 (frontend benchmarks are not in CI; this is the local proof the Vitest 5 migration works).
- Backend gates: none — no Rust file changes in this task (`git diff --name-only` contains no `Cargo.*`/`src-tauri/` path).
- Bookkeeping: a `CHANGELOG.md` entry is required (repo has `CHANGELOG.md`; convention at `CHANGELOG.md:53-54`).
- No push; commit only. `nix/package.nix` hash handled by CI on push (Non-Goals).

## Pre-flight Checks

Run before the plan may reach `COMPLETED`. This is a named checklist of this project's actual
commands, distinct from per-task validation: per-task validation proves one task worked, these
prove the repository as a whole is in a shippable state.

- [x] [`cmd.exe /c bun run type-check`] — exit 0 (2026-09-15)
- [x] [`cmd.exe /c bun run lint`] — exit 0, 13 pre-existing `solid/reactivity` warnings
- [x] [`cmd.exe /c bun run test:run`] — exit 0, 109 files / 1126 tests passed
- [x] [`cmd.exe /c bun run bench`] — exit 0, 2 files / 4 benchmark cases reported
- [x] [`git status --porcelain` shows only intended final changes] — clean after commit `e8a13d1`

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what this plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

<!--
Once this section passes ~10 entries, move it to a companion
`YYYY-MM-DD-<name>-decisions.md` and leave a pointer here. `check-plan.py` warns (`W005`)
at that threshold.
-->

### DEC-001 — Vitest 5 benchmark getter warning left unsuppressed

- Date: 2026-09-15
- Task: 2.2
- Decision: Left the new Vitest 5 `Benchmark Warning: ... accessed module export getters too many times` (`src/lib/cjk.ts > isCjkCodePoint`) in place rather than suppressing it via `benchmark.suppressExportGetterWarnings` or restructuring `src/lib/wordcount.ts`. `bun run bench` still exits 0 and reports all cases.
- Rationale: The warning is advisory (module-runner getter overhead inflates the measured mean slightly) and does not affect correctness or any gate — frontend benchmarks are not run in CI (`benchmarks/CLAUDE.md` Gotcha #9). Suppressing it would hide a real measurement caveat, and hoisting `isCjkCodePoint` to a local const inside production code is a source change with no user-visible benefit. Recorded so a future benchmark-accuracy task can pick it up deliberately.

### DEC-002 — local Vitest 5 type shim for `@testing-library/jest-dom`

- Date: 2026-09-15
- Task: 3.1
- Decision: Added `src/test/jest-dom-vitest.d.ts`, which re-declares jest-dom's matcher types against Vitest 5's `Matchers<R, T>` interface, instead of downgrading `vitest`, switching the setup import, or leaving type-check red.
- Rationale: Vitest 5 changed `Assertion` to `Assertion<R, T>` and dropped `JestAssertion`'s inheritance from the global `jest.Matchers` namespace. `@testing-library/jest-dom` 7.0.1 (the latest release) augments only the old shapes, so its augmentation silently no-ops and all 424 DOM-matcher assertions failed `tsc --noEmit` with TS2339 (runtime was unaffected — the suite passed). `vitest.dev/guide/extending-matchers` documents `interface Matchers<R, T>` as the Vitest 5 extension point, and `Assertion` extends it. The shim is version-pinned by comment to be removed when jest-dom ships Vitest 5 support.

## Final Verification

Task 4.5 runs the `## Pre-flight Checks` list in full. The end-to-end checks are: the three frontend
gates, the benchmark command, and a clean `git status` showing exactly the intended file set
(`package.json`, `bun.lock`, `package-lock.json`, the two bench files, any test fixed in Task 2.3,
and `CHANGELOG.md`).

## Approval Gate

Approved by Francisco on 2026-09-15.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python scripts/check-plan.py docs/plans/2026-09-15-apply-dependabot-npm-dependency-prs-296-297-298-with-vitest-5-migration-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-09-15

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
- All project commands must be run via `cmd.exe /c ...` from the PowerShell shell.
