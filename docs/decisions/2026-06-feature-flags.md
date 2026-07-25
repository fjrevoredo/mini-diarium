# ADR: Feature Flag Strategy — Build-Time vs. Runtime Opt-In

**Status:** Accepted
**Date:** 2026-06-18 (Tier 2 adopted 2026-07-11)
**Related:** `src-tauri/Cargo.toml` (features); `src-tauri/src/commands/search.rs` (Tier 1 worked example); `src/state/feature-flags.ts` (Tier 2 store); `vite.config.ts` (define block); `CONTRIBUTING.md` (TBD workflow); `docs/decisions/2026-05-settings-storage-taxonomy.md` (runtime settings taxonomy).

## Context

Mini Diarium is moving toward trunk-based development: all work merges to `master` within one to two days. Without a flag mechanism, incomplete features can only land when they are complete enough to ship. This blocks the trunk integration model and pushes contributors toward long-lived branches (TBD gap B-2).

Two layers are needed:

1. **Backend (Rust):** A compile-time gate to exclude unfinished commands from production binaries.
2. **Frontend (Vite/SolidJS):** A build-time define to tree-shake unfinished UI components from production bundles.

A third layer — user-facing runtime opt-in — exists in principle but has no concrete use case yet and carries real implementation cost. Building it speculatively would be premature.

## Options Considered

**Tier 1 — Build-time only:** A Cargo `experimental` feature and a Vite `define` that are never set in production. Incomplete code lands in-tree and compiles out of production binaries transparently.

**Tier 2 — Runtime opt-in:** A user-facing beta toggle stored in `Preferences` (UI-only) or `config.json` (pre-unlock Rust reads). Lets specific users enable in-progress features without rebuilding.

**Both tiers, built speculatively:** All infrastructure for both tiers available from day one.

## Decision

**Tier 1 adopted immediately. Tier 2 deferred until a concrete use case requires it — that case arrived on 2026-07-11 (in-app menu migration), and Tier 2 is now adopted as a migration-free runtime store (see below).**

Building Tier 2 speculatively would add `config.json` parsing complexity, storage migration risk (see the `require_all_auth` migration in `docs/decisions/2026-05-settings-storage-taxonomy.md`), and UI surface area before any feature needs it.

### Tier 1 — Build-time

**Rust:** Add `experimental = []` to `[features]` in `src-tauri/Cargo.toml`. Gate incomplete commands with `#[cfg(feature = "experimental")]` on the function definition and on the `generate_handler![]` entry.

```rust
// src-tauri/src/commands/search.rs
#[cfg(feature = "experimental")]
use crate::commands::auth::DiaryState;
#[cfg(feature = "experimental")]
use tauri::State;

#[cfg(feature = "experimental")]
#[tauri::command]
pub fn search_entries(...) -> Result<Vec<SearchResult>, String> { ... }
```

```rust
// src-tauri/src/lib.rs — inside generate_handler![]
#[cfg(feature = "experimental")]
commands::search::search_entries,
```

The `generate_handler!` macro in Tauri 2.x parses outer attributes before each path entry (via `Attribute::parse_outer` in `tauri-macros/src/command/handler.rs`), so `#[cfg]` attributes on handler entries are valid.

Production builds never set `experimental`. CI and releases always build with the default feature set.

To activate during development:

```bash
cargo build --manifest-path src-tauri/Cargo.toml --features experimental
```

**Vite:** Add a `define` block in `vite.config.ts`:

```typescript
define: {
  'import.meta.env.VITE_EXPERIMENTAL': JSON.stringify(process.env.VITE_EXPERIMENTAL === 'true'),
},
```

Gate unfinished UI rendering with:

```tsx
<Show when={import.meta.env.VITE_EXPERIMENTAL}>
  <SearchBar />
</Show>
```

TypeScript sees `import.meta.env.VITE_EXPERIMENTAL` as `boolean`. When `false` (default), the bundler tree-shakes the guarded subtree. Activate for development:

```bash
VITE_EXPERIMENTAL=true bun run tauri dev
```

### Tier 2 — Runtime opt-in (adopted 2026-07-11)

The first concrete Tier 2 use case was the in-app menu migration (TODO-0062): Statistics/Import/Export moved off the native OS menu into the header `⋮` menu and needed to land on `master` but stay hidden from users until the whole migration completed (native-menu removal was the approval-gated TODO-0065). That flag has since graduated — see "Current runtime flags" below. A **build-time** `VITE_EXPERIMENTAL` gate would force a rebuild to flip; the desire here was a **runtime** toggle a maintainer can flip in-app without rebuilding.

**Chosen implementation — a migration-free open-map store in its own localStorage key (`src/state/feature-flags.ts`).** This supersedes the earlier suggestion above to "add fields to the `Preferences` interface":

- **Storage:** a dedicated `localStorage['feature-flags']` key holding an open `Record<string, boolean>`, separate from `localStorage['preferences']` (mirrors how theme keys live outside `preferences` — see `src/CLAUDE.md` Gotcha #7). It is **not** wiped by `resetPreferences` and **not** included in settings export; experimental flags are intentionally ephemeral.
- **No migration, ever.** `loadFlags()` keeps only boolean-valued entries; unknown/retired keys are silently dropped on the next load, and absent flags fall back to a `DEFAULTS` map (typically `false`). Adding a flag = extend the `FeatureFlag` union, `DEFAULTS`, and the `FEATURE_FLAGS` registry (which pairs each flag with its label's i18n key and drives the Advanced-tab UI). Retiring one = delete from all three. This is the whole point: unlike `preferences.ts`, there is never a per-flag migration block to maintain when a flag is added or retired.
- **API:** `isFeatureEnabled(flag)` (reactive read, so `<Show>` re-renders on toggle) and `setFeatureFlag(flag, enabled)` (updates the signal and persists). The runtime toggle lives in the Advanced preferences tab (unlocked-only).

**Why not the `Preferences` interface?** `Preferences` carries a migration block (`loadPreferences()`) that appends new defaults and self-heals stored values. Every flag added there would grow that migration surface and every flag retired would risk a stale-field cleanup. The constraint for this work was explicitly *do not touch `loadPreferences()` when a flag is added or retired* — an open-map store with no migration satisfies that directly.

**When to still reach for the other options:** a flag that Rust must read **before unlock** cannot live in `localStorage`; put it in `config.json` `experimental_features` using the `AppConfig` serde pattern (`#[serde(default, skip_serializing_if = "Option::is_none")]`). Never put security-relevant policy in either place; `db_settings` owns that (see the taxonomy ADR).

#### Current runtime flags

**The inventory is empty as of 2026-07-25.** `inAppMenu` — the only flag Tier 2 ever carried — **graduated with TODO-0065**: the `<Show>` wrapper came off the `<HeaderMoreMenu />` render site in `Header.tsx`, so the `⋮` menu is now unconditional, and the flag was deleted from the `FeatureFlag` union, `DEFAULTS`, and `FEATURE_FLAGS` per the retirement rule above (no migration; a stale stored `inAppMenu` key is simply ignored on the next load).

`src/state/feature-flags.ts` is kept as **dormant infrastructure** — the store, its API, and the `e2e/specs/helpers.ts` `setFeatureFlag` helper all survive with an empty union, so the next in-progress feature that wants a runtime toggle costs three small edits instead of rebuilding the mechanism. The Preferences → Advanced → Experimental Features section renders from `FEATURE_FLAGS` and **hides itself entirely while that registry is empty**, so users never see an empty group in the meantime.

| Flag (`FeatureFlag`) | Default | Gates | Status |
|---|---|---|---|
| _(none registered)_ | — | — | — |
| ~~`inAppMenu`~~ | `false` | The **entire** header `⋮` overflow menu — the trigger and all items (Preferences, Statistics, Import, Export). Gated at the entry point in `Header.tsx`; `HeaderMoreMenu.tsx` was always flag-agnostic. | Graduated 2026-07-25 (TODO-0065) |

#### Enabling / disabling a flag at runtime

Every flag defaults **off** and each user's choice persists per app-install in `localStorage['feature-flags']`. There are two ways to flip one:

1. **In-app (the normal path — maintainers / manual testing).** Unlock a journal, open **Preferences → Advanced → Experimental Features**, and check or uncheck the flag. The change is reactive: gated UI (`<Show when={isFeatureEnabled(...)}>`) appears or disappears immediately, no reload needed. The Advanced tab is unlocked-only, so this is unavailable pre-unlock. **While `FEATURE_FLAGS` is empty the section is not rendered at all** — with nothing to toggle there is nothing to show; it reappears as soon as a flag is registered.

   **No lock-out — a standing constraint on what a flag may gate.** While `inAppMenu` existed, the justification for hiding the whole `⋮` menu was that Preferences stayed reachable from the native OS menu, so the toggle could never be trapped behind itself. TODO-0065 narrowed the native menu to Preferences + Quit, which **preserves that exact fallback** (the File/App menu item and `CmdOrCtrl+,` both remain, on every platform) while removing every other native escape hatch. The rule to carry forward: **a flag must never gate the only path to the Advanced preferences tab.** Gating the `⋮` menu stays safe because Preferences keeps two other routes; gating the Preferences overlay itself would not be.

2. **Directly in `localStorage` (dev / E2E / pre-unlock).** The store is a plain JSON object under one key, so you can set it from DevTools, an E2E spec, or the `tauri-agent-dev` console — no app UI required:

   ```js
   // Enable
   localStorage.setItem('feature-flags', JSON.stringify({ someFlag: true }));
   // Disable (either set it false, or remove the whole key to fall back to defaults)
   localStorage.setItem('feature-flags', JSON.stringify({ someFlag: false }));
   localStorage.removeItem('feature-flags');
   ```

   The signal reads `localStorage` at module init (`createSignal(loadFlags())`), so a write made **before** the app mounts is picked up automatically; a write made while the app is running needs a reload (or an in-process `setFeatureFlag` call) to re-render. This is exactly why the E2E helper `setFeatureFlag(flag, enabled)` in `e2e/specs/helpers.ts` seeds the key **and reloads** — called after `connectToApp()` but before `authenticate()`, so the reload lands on the still-locked auth screen and no unlock state is lost. `header-actions.spec.ts` used it to enable `inAppMenu` before driving the `⋮` menu; since that flag graduated the helper has **no caller** and is retained (and documented as such in its doc-comment) for the next flag, because the reload gotcha it encodes is expensive to rediscover. Because unknown keys are dropped and absent flags fall back to `DEFAULTS`, a malformed or stale value is harmless — the flag simply reads its default.

To turn a flag **off for everyone** (e.g. reverting a premature enable), you don't touch stored state: flip its `DEFAULTS` entry to `false` in `src/state/feature-flags.ts` — any user who explicitly enabled it keeps their stored `true` until they toggle it back or clear the key. To retire a flag entirely, delete it from the `FeatureFlag` union, `DEFAULTS`, and `FEATURE_FLAGS`; stale stored keys are ignored on the next load. `inAppMenu`'s graduation on 2026-07-25 is the worked example of that path.

## Worked Example

`commands/search.rs` was the first use of Tier 1: it landed in-tree gated behind `#[cfg(feature = "experimental")]` / `<Show when={import.meta.env.VITE_EXPERIMENTAL}>` while the UI was unwired, then graduated to production once the search overlay was mounted (both gates removed in the same PR, and `experimental` is now an empty shell awaiting its next use). The `SearchResult` struct was never gated — it is the preserved interface contract (CLAUDE.md GOTCHA #1) and must always compile. The graduation pattern (gate lands → UI mounts → both gates move together in one PR) is the model for future Tier 1 features.

## Consequences

- Incomplete features land on `master` compile-verified but invisible in production.
- CI runs the `default` feature set only; experimental-only code is not tested in CI unless a separate job is added.
- Contributors must read `CONTRIBUTING.md` to know the standard gate before landing partial work.
- The stub pattern (function exists, returns empty data) should be preferred over a pure `#[cfg]`-only stub when the function is an interface contract that must survive in-tree for future implementation.
