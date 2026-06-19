# ADR: Feature Flag Strategy — Build-Time vs. Runtime Opt-In

**Status:** Accepted
**Date:** 2026-06-18
**Related:** `src-tauri/Cargo.toml` (features); `src-tauri/src/commands/search.rs` (worked example); `vite.config.ts` (define block); `CONTRIBUTING.md` (TBD workflow); `docs/decisions/2026-05-settings-storage-taxonomy.md` (runtime settings taxonomy).

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

**Tier 1 adopted immediately. Tier 2 deferred until a concrete use case requires it.**

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

### Tier 2 — Runtime opt-in (when needed, not today)

If a specific user-facing beta ever requires runtime gating, choose the storage location from the taxonomy in `docs/decisions/2026-05-settings-storage-taxonomy.md`:

- **UI-only beta:** `Preferences` / `localStorage['preferences']` — follows the existing `Preferences` interface in `src/state/preferences.ts`.
- **Pre-unlock Rust reads:** `config.json` `experimental_features` object using the `AppConfig` serde pattern with `#[serde(default, skip_serializing_if = "Option::is_none")]`. Never put security-relevant policy here; `db_settings` owns that.

Do not add this infrastructure until a concrete use case is in scope.

## Worked Example

`commands/search.rs` is the first use of Tier 1. The `SearchResult` struct is NOT gated — it is the preserved interface contract for future secure search (CLAUDE.md GOTCHA #1) and must always compile. Only the Tauri command function and its consumer imports are gated. The search frontend components (`SearchBar.tsx`, `SearchResults.tsx`) are not currently wired up anywhere; their entry point would be wrapped in `<Show when={import.meta.env.VITE_EXPERIMENTAL}>` when a render site is added.

## Consequences

- Incomplete features land on `master` compile-verified but invisible in production.
- CI runs the `default` feature set only; experimental-only code is not tested in CI unless a separate job is added.
- Contributors must read `CONTRIBUTING.md` to know the standard gate before landing partial work.
- The stub pattern (function exists, returns empty data) should be preferred over a pure `#[cfg]`-only stub when the function is an interface contract that must survive in-tree for future implementation.
