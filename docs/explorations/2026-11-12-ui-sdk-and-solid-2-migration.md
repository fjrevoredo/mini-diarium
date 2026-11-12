# Exploration Output: UI SDK (vercel-labs/ui) and a Solid 2 migration

> Artifact type: **Decision Record** (with a short plan for later).
>
> This artifact contains no implementation code. Only prose, tables and references.

## Context

- **Why this exploration started**: The user asked if [vercel-labs/ui](https://github.com/vercel-labs/ui) ("UI SDK") is useful for Fenmark. The first finding was that its Solid adapter needs Solid 2. The user then asked if a migration to Solid 2 makes sense.
- **Date**: 2026-11-12
- **Sources consulted**:
  - UI SDK: repo README, `packages/solid/package.json` (through `gh api`), npm metadata for `@ui-sdk/solid` and `@ui-sdk/core`, a scan of the `@ui-sdk/core@0.1.0-beta.1` tarball.
  - Solid 2: [`documentation/solid-2.0/MIGRATION.md`](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md) (branch `next`), GitHub releases of `solidjs/solid`, npm dist-tags and peer dependencies of `solid-js`, `@solidjs/web`, `@kobalte/core`, `@solidjs/testing-library`, `vite-plugin-solid`, `@solidjs/vite-plugin`, `@solid-primitives/i18n`.
  - Secondary: [InfoQ: SolidJS 2 async](https://www.infoq.com/news/2026/05/solidjs-2-async/), [v2.0.0-beta.0 release notes](https://github.com/solidjs/solid/releases/tag/v2.0.0-beta.0).
  - Fenmark: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/` (API usage counts), `docs/todo/TODO_EXTRA.md`.

## Questions & Assumptions

- **Open questions raised**:
  - Can Fenmark use UI SDK today? **No.** `@ui-sdk/solid` needs `solid-js >=2.0.0-rc.14 <3` and `@solidjs/web`.
  - Is Solid 2 stable? **No.** npm `latest` is `solid-js@1.9.19` (2026-11-10). `next` is `2.0.0-rc.21` (2026-11-04). There were 22 release candidates in about 12 weeks (rc.0 on 2026-08-12).
  - Is the Solid 2 ecosystem that Fenmark needs ready? **Partly, and only as prereleases.** See Findings.
- **Assumptions made**:
  - The API usage counts are from `grep` over non-test files in `src/`. They are approximate and give only the size of the work.
  - The size of the test work is an estimate. I did not run Solid 2 against the test suite.
- **What we asked the user**: nothing. The request was clear.

## Findings

### UI SDK (`@ui-sdk/*`)

- It is a headless behavior library: keyboard navigation, focus, selection, dismissal, popups, drag and drop, and ARIA. It has adapters for React, Vue, Svelte, Solid and Web Components, and an agent skill. License: Apache-2.0.
- The repo started on 2026-10-26. The only real version is `0.1.0-beta.1` (2026-11-12). It is under the Vercel beta terms, so the API can change.
- `@ui-sdk/core` has no runtime dependencies. Its `dist` has no `fetch`, XHR, beacon or WebSocket calls. It agrees with the Fenmark rule "no network".
- It has prebuilt parts that agree with Fenmark widgets: dialog, alert-dialog, menu, combobox, command, listbox, calendar, date-picker, tooltip.
- Fenmark uses Kobalte only for `dialog` (18 imports) and `dropdown-menu` (1), in 21 files. A known problem is that Kobalte `DismissableLayer` adds a document listener that runs after `handleGlobalEsc` (`docs/todo/TODO_EXTRA.md`, line 555).
- About 18 components have hand-made keyboard or ARIA code. Examples: `Calendar.tsx`, `SearchResults.tsx`, `EntryTags.tsx`, `TagManager.tsx`, `GoToDateOverlay.tsx`, `JournalPicker.tsx`.

### Solid 2: what changes

From the official migration guide:

- **Batching**: a setter does not change what a read returns until the microtask batch flushes, or until `flush()`. This is the most important behavior change.
- **Effects**: `createEffect` splits into a compute function and an apply function. Cleanup is the return value of the apply function. The `initialValue` argument of `createEffect` and `createMemo` is removed.
- **Lifecycle**: `onMount` becomes `onSettled`.
- **Async**: `createResource` is removed (use async computations and `<Loading>`). `Suspense` becomes `Loading`. `ErrorBoundary` becomes `Errored`.
- **Removed**: `batch`, the `on` helper, `createComputed`, `produce`, `createMutable`, `startTransition`, `useTransition`, `use:` directives.
- **Renamed**: `classList` becomes `class` (object or array forms). `Context.Provider` becomes the context itself. `mergeProps`/`splitProps` become `merge`/`omit`.
- **Imports and types**: `solid-js/web` becomes `@solidjs/web`. `jsxImportSource` changes from `solid-js` to `@solidjs/web`.
- **Ownership**: a nested `createRoot` is now owned by its parent. Ref callbacks are not owned, so `onCleanup` in a ref callback does not work.

### Solid 2: Fenmark usage that must change (approximate, non-test `src/`)

| 1.x API | Count | Effort |
|---|---|---|
| `createEffect(` (each needs a split) | 46 | Medium. Each needs a review, not only a rewrite. |
| `onCleanup(` (some inside effects) | 18 | Low to medium |
| `onMount(` | 12 | Low (rename, check timing) |
| `createResource(` | 7 | Medium (new async model) |
| `batch(` | 6 | Low, but must check the new read timing |
| `classList=` | 7 | Low |
| `on(` helper | 3 | Low |
| `solid-js/web` imports | 2 | Low |
| `Context.Provider` | 2 | Low |
| `<Suspense>` | 1 | Low |
| `<Index>`, `produce`, `reconcile`, `solid-js/store`, `use:` | 0 | None |
| Kobalte components (dialog, dropdown-menu) | 21 files | Medium to high (Kobalte 2 is alpha) |

Other scope: about 19,500 lines of application code in `src/`, 116 test files (47 `.test.tsx` component tests, 12 uses of `createRoot` in tests), `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`.

### Solid 2: dependency readiness (2026-11-12)

| Dependency | Fenmark today | Solid 2 version | State |
|---|---|---|---|
| `solid-js` | `^1.9.18` | `2.0.0-rc.21` (`next`) | RC, many releases each month |
| `@solidjs/web` | (part of `solid-js`) | `2.0.0-rc.21` | RC |
| `@kobalte/core` | `^0.13.14` | `2.0.0-alpha.4` | **Alpha. Peer is pinned to exactly `solid-js 2.0.0-rc.16`.** It depends on many `@solid-primitives/*@next` packages. |
| `@solid-primitives/i18n` | `^2.2.1` | `3.0.0-next.4` | Prerelease |
| `@solidjs/testing-library` | `^0.8.10` | `1.0.0-rc.2` | RC |
| `vite-plugin-solid` | `^2.11.15` | `3.0.0-next.27`, a wrapper for `@solidjs/vite-plugin` | Prerelease (supports Vite 8) |
| `@tiptap/*` | `3.32.2` | (no Solid dependency) | No effect. Fenmark uses `@tiptap/core` directly. |

## Options Compared

| Option | How it works | Pros | Cons | Fit for context |
|--------|--------------|------|------|-----------------|
| A. Migrate to Solid 2 now | Move to `2.0.0-rc.x`, Kobalte 2 alpha, all `next` packages | Gets the new async model and UI SDK access early | Every UI dependency is a prerelease. The Kobalte peer is an exact RC pin. RCs still change often. No user-facing gain. | **Poor.** Too much risk for an encrypted app that auto-locks. |
| B. Wait for stable, then migrate in steps | Watch for the triggers below. Then migrate on a branch: imports, types, effects, lifecycle, async, tests. | Stable APIs, migration tools (the guide names a planned `solid-migration-assistant`), and ecosystem releases with peer ranges | Fenmark stays on 1.x for some months. Kobalte 0.13 gets no new features. | **Good.** |
| C. Stay on 1.x and replace Kobalte with own code | Write the dialog and menu behaviors in Fenmark | Fixes the Escape-order problem now. Removes one blocker for a later migration. | More code to own. Accessibility risk if it is not done well. | Possible, but only if the Escape-order problem becomes urgent |
| D. Use UI SDK on 1.x through its Web Components adapter | Register custom elements from `@ui-sdk/web` | Does not need Solid 2 | Custom elements in Solid JSX make typing and events harder. The beta API can change. | **Poor.** Too much friction for a small gain. |

## Risks & Unknowns

- **Batching change and security-sensitive flows**: In Solid 2 a setter is not visible to a read until a flush. The three auto-lock paths (idle timer in `App.tsx`, `screen_lock.rs` events, focus-loss lock in `src/lib/focus-lock.ts`), the save path and the dialog guard can read state right after they set it. A migration must check each of these reads. An error here can leave a journal unlocked or lose an entry.
- **Test suite**: Tests that set a signal and then assert at once can fail or, worse, pass for the wrong reason. Expect many `flush()` additions and some test rewrites.
- **Kobalte 2 timing**: The Kobalte 2 alpha pins one exact Solid RC. Until it uses a peer range, Fenmark cannot move Solid and Kobalte apart.
- **Unknown**: The real number of effects that read a value right after a setter in the same tick. Only a test run against Solid 2 shows this.
- **Suggested investigation** (later, outside exploration mode): a time-boxed spike on a throwaway branch. Install the Solid 2 packages, run `type-check` and `test:run`, and count the failures. Do not merge it. This gives a real effort number in place of the estimate above.

## Recommended Direction

- **Do not migrate to Solid 2 now, and do not adopt UI SDK now.** No user-facing feature needs Solid 2. The packages that Fenmark needs are prereleases, and Kobalte 2 is alpha with an exact RC pin.
- **Start the migration when all of these are true:**
  1. `solid-js@2.0.0` (or later) is on the npm `latest` tag.
  2. `@kobalte/core` 2.x is beta or stable, and its peer dependency is a range, not an exact RC.
  3. `@solidjs/testing-library@1.0.0` and a stable `vite-plugin-solid`/`@solidjs/vite-plugin` 3.x are released.
  4. Optional: the official migration assistant is released.
- **Effort when it starts**: medium. Most edits are mechanical. The real cost is the review of 46 effects, 7 resources and the batching change in the lock, save and dialog flows, plus the test updates.
- **Then look at UI SDK again**, if it is out of beta. Good first targets are the hand-made widgets (Calendar, SearchResults, TagManager, EntryTags) and perhaps the Kobalte dialog and menu, if the Escape-order problem still exists.
- **Until then**, the UI SDK behaviors (dismissal layers, typeahead, focus recovery) are a useful reference design for the hand-made widgets. Read them; do not copy them.

## Next Steps

- [ ] Optional: add a TODO that watches the four triggers above (use the `todo-manager` skill).
- [ ] When the triggers are true: run the spike in "Risks & Unknowns" to get a real effort number.
- [ ] Then capture a migration plan with the `manual-planning` skill. Give a separate step to the lock, save and dialog flows.
- [ ] Keep exploring: compare Kobalte 2, UI SDK and corvu as the Solid 2 dialog and menu layer.
