# Frontend (src/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).
> For durable frontend rules, use [Frontend best practices](../docs/best-practices/FRONTEND_BEST_PRACTICES.md) before changing SolidJS reactivity, state ownership, Tauri error UI, TipTap/editor behavior, accessibility, or E2E-visible UI.

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/auth/` | Pre-auth unlock and journal creation screens |
| `src/components/calendar/` | Monthly calendar with entry date indicators |
| `src/components/editor/` | TipTap rich-text editor, toolbar, entry navigation, inline overlays |
| `src/components/layout/` | App shell and editor panel; extracted hooks live in `editor-panel/` |
| `src/components/overlays/` | All overlay dialogs — preferences (split by tab), stats, import/export, tags, notifications, onboarding, image picker |
| `src/components/search/` | Search UI — `SearchOverlay` (mounted in `MainLayout`), `SearchBar`, `SearchResults` |
| `src/state/` | Signal-based state modules, one per domain — see State Management below |
| `src/lib/` | Tauri invoke wrappers (`tauri/` — one sub-file per command category, barrel `index.ts`), utility helpers, shortcuts listener, theme management |
| `src/i18n/` | Translation files (`locales/`) and i18n context wrapper |
| `src/test/` | Vitest setup and `renderWithI18n` helper |

## State Management

State modules live in `src/state/` — one file per domain, all SolidJS signals. See each file for current signals and exports.

**Key invariant:** `session.ts:resetSessionState()` orchestrates lock cleanup — it calls reset functions from `entries`, `search`, `ui`, and `tags`. If you add a module that holds session-scoped data, add its reset call there.

The `Preferences` interface (fields, types, defaults) is the source of truth in `src/state/preferences.ts`. Stored in `localStorage`.

> **Settings taxonomy:** When adding a new setting, see [`docs/decisions/2026-05-settings-storage-taxonomy.md`](../docs/decisions/2026-05-settings-storage-taxonomy.md) for the decision flowchart (`localStorage` vs. `config.json` vs. `db_settings` vs. in-memory).

## i18n / Translations

All UI strings are extracted into `src/i18n/locales/en.ts` (the canonical English source). The i18n system uses `@solid-primitives/i18n` v2 with a thin context wrapper (`src/i18n/index.ts`).

### Adding new keys

1. Add the key under the appropriate namespace in `src/i18n/locales/en.ts`.
2. Key naming: `namespace.camelCase`. Suffixes: `.label` (form labels), `.hint` (helper text), `.placeholder` (inputs), `.aria` (aria-labels). Button text uses the verb directly (`common.save`).
3. Interpolation syntax: `{{ name }}` (spaces required) — e.g. `"Hello {{ name }}"`.
4. Plurals: use `_one` / `_other` key suffixes and select in the component:
   ```typescript
   t(count === 1 ? 'editor.wordCount_one' : 'editor.wordCount_other', { count })
   ```
5. In the component, call `const t = useI18n()` and use `t('namespace.key')`.

### `mapTauriError(err, t)` pattern

`mapTauriError` is a pure function called outside JSX render (in async handlers). It accepts `t: T` as a required second parameter. Every call site is inside a component that already calls `useI18n()`:

```typescript
import { mapTauriError } from '../../lib/errors';
import { useI18n } from '../../i18n';

// In component:
const t = useI18n();
// In handler:
setError(mapTauriError(err, t));
```

For the cross-layer IPC error contract and regression checks, see [`docs/best-practices/TAURI_BEST_PRACTICES.md`](../docs/best-practices/TAURI_BEST_PRACTICES.md).

### Module-level arrays using translations

Arrays that contain translated strings must be `createMemo` inside the component (not module-level consts), so they are evaluated after `useI18n()` is called. See `MONTH_NAMES` in `Calendar.tsx` and `FIRST_DAY_OPTIONS` in `overlays/preferences/PreferencesWritingTab.tsx` as reference.

### Testing

All component tests use `renderWithI18n()` from `src/test/i18n-test-utils.tsx` instead of bare `render()`. The wrapper provides the `I18nProvider` context. English strings are identical to hardcoded values, so existing `getByText('...')` assertions continue to pass.

### Validating locale files

Community locale JSON files live in `src/i18n/locales/`. To check completeness against `en.ts`:

```bash
bun run validate:locales
```

See `docs/TRANSLATIONS.md` for the community translator guide.

## Conventions

### Gating Incomplete UI Behind a Feature Flag

If a component or feature is not yet ready to ship, gate its render site with `import.meta.env.VITE_EXPERIMENTAL` rather than leaving it unreachable by convention:

```tsx
import { Show } from 'solid-js';

// Wrap the entry point only — not every sub-component.
<Show when={import.meta.env.VITE_EXPERIMENTAL}>
  <YourInprogressFeature />
</Show>
```

`import.meta.env.VITE_EXPERIMENTAL` is a compile-time `boolean` injected by the `define` block in `vite.config.ts`. When `false` (all production and CI builds), the bundler tree-shakes the guarded subtree entirely. Activate for local development:

```bash
VITE_EXPERIMENTAL=true bun run tauri dev
```

The matching Rust backend command must also be gated with `#[cfg(feature = "experimental")]` — see `src-tauri/CLAUDE.md` for the backend checklist. Both gates must move together. See `docs/decisions/2026-06-feature-flags.md` for the full strategy.

### SolidJS Reactivity Gotchas

The durable SolidJS reactivity rules and diagnostic `rg` commands live in [`docs/best-practices/FRONTEND_BEST_PRACTICES.md`](../docs/best-practices/FRONTEND_BEST_PRACTICES.md). This domain guide keeps local examples and inventories.

Local note: the `<For>` callback receives the unwrapped item directly for primitive arrays: `(item) => ...`, not `(item) => item()`. Only store/object entries behave like signals.

### Error Handling

The durable rules for typed wrappers, sanitized Tauri errors, sensitive UI flow ordering, and regression checks live in [`docs/best-practices/FRONTEND_BEST_PRACTICES.md`](../docs/best-practices/FRONTEND_BEST_PRACTICES.md). Keep the `mapTauriError(err, t)` call pattern above aligned with `src/lib/errors.ts`.

### Testing Pattern

Tests use **Vitest + @solidjs/testing-library**. Tauri APIs are mocked globally in `src/test/setup.ts`.

```tsx
import { renderWithI18n } from '../test/i18n-test-utils';

it('renders correctly', () => {
  const { getByText } = renderWithI18n(() => <MyComponent prop="value" />);
  expect(getByText('expected')).toBeInTheDocument();
});
```

Note the arrow wrapper `() => <Component />` — required for SolidJS test rendering. Use `renderWithI18n` (not bare `render`) so the `I18nProvider` context is available.

### Menu Event Pattern — Frontend

All menu event names are prefixed `menu-`. Listen in `shortcuts.ts` or overlay components:

```typescript
listen("menu-navigate-previous-day", handler)
```

The backend emits via `app.emit("menu-*", ())` in `menu.rs`. See root CLAUDE.md for the full cross-layer pattern.

## Verification Commands

```bash
cmd.exe /c bun run test:run           # All frontend tests (single run)
cmd.exe /c bun run test               # Watch mode
cmd.exe /c bun run test:coverage      # Coverage report
cmd.exe /c bun run lint               # ESLint
cmd.exe /c bun run lint:fix           # ESLint autofix
cmd.exe /c bun run format:check       # Prettier check
cmd.exe /c bun run format             # Prettier fix
cmd.exe /c bun run type-check         # TypeScript type check
```

## data-testid Attributes

These are used by E2E tests — **do not remove** from components.

| Component | Element | data-testid |
|-----------|---------|-------------|
| `OnboardingOverlay.tsx` | Next / Done button in tour card | `onboarding-next-btn` |
| `PasswordCreation.tsx` | Password input | `password-create-input` |
| `PasswordCreation.tsx` | Confirm password input | `password-repeat-input` |
| `PasswordCreation.tsx` | Create button | `create-journal-button` |
| `PasswordPrompt.tsx` | Password input | `password-unlock-input` |
| `PasswordPrompt.tsx` | Unlock submit button | `unlock-journal-button` |
| `Header.tsx` | Sidebar toggle (hamburger) | `toggle-sidebar-button` |
| `Header.tsx` | Search button (opens `SearchOverlay`) | `search-button` |
| `SearchOverlay.tsx` | Search dialog content | `search-overlay` |
| `Header.tsx` | Lock button | `lock-journal-button` |
| `Header.tsx` | Timeline toggle button | `timeline-toggle-button` |
| `HeaderMoreMenu.tsx` | Overflow menu trigger (⋮) | `header-more-menu-trigger` |
| `HeaderMoreMenu.tsx` | Overflow menu dropdown content | `header-more-menu-content` |
| `HeaderMoreMenu.tsx` | Preferences item in overflow menu | `header-more-menu-preferences-item` |
| `PreferencesOverlay.tsx` | Preferences dialog content | `preferences-overlay` |
| `TitleEditor.tsx` | Title input | `title-input` |
| `Calendar.tsx` | Each day button | `calendar-day-YYYY-MM-DD` |
| `EntryNavBar.tsx` | Nav bar container | `entry-nav-bar` |
| `EntryNavBar.tsx` | Previous entry button (`←`) | `entry-prev-button` |
| `EntryNavBar.tsx` | Entry number button N (1-based); active entry has `aria-current="true"` | `entry-number-button-{N}` |
| `EntryNavBar.tsx` | Next entry button (`→`) | `entry-next-button` |
| `EntryNavBar.tsx` | Delete entry button (`−`) | `entry-delete-button` |
| `EntryNavBar.tsx` | Add entry button (`+`) | `entry-add-button` |
| `EntryNavBar.tsx` | Lock/unlock entry button; `aria-pressed` reflects locked state | `entry-lock-button` |
| `Timeline.tsx` | Passive lock indicator on a locked entry's row | `timeline-lock-indicator` |
| `Calendar.tsx` | Passive lock glyph on a day with a locked entry | `calendar-lock-YYYY-MM-DD` |

## Gotchas and Pitfalls

1. **Three-level font model**: The editor supports fonts at three hierarchy levels, applied in order: app default (from `preferences.editorFontFamily` / `editorFontSize`), entry default (from encrypted `entry_metadata_encrypted` in the entry), and inline formatting (Tiptap `FontFamily` / `FontSize` marks applied to selections). The toolbar font dropdowns apply inline marks to the selection/cursor, not global preferences. Multi-font loading (@font-face rules) covers all three sources: app default + entry default + inline fonts referenced in the encrypted `text` HTML. Custom font changes refresh automatically across all three levels.

2. **Date format is always `YYYY-MM-DD`**: The `T00:00:00` suffix is appended in `dates.ts` functions (`new Date(dateStr + 'T00:00:00')`) to avoid timezone-related date shifts.

3. **TipTap stores HTML**: The editor content is stored as HTML strings, not Markdown. This is intentional — the `text` field in `DiaryEntry` is HTML.

4. **E2E breakpoint planning rule**: Default E2E clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px). The sidebar uses `lg:relative lg:translate-x-0`, so it is always in mobile/overlay behavior in E2E. **When changing the default value of any UI visibility signal (`isSidebarCollapsed`, overlay open states, etc.), explicitly audit `e2e/specs/` for interactions that depend on the affected element being visible and update the test accordingly.**

5. **Block alignment uses a container model (not per-node)**: Alignment is applied via `TextAlign` on a wrapping container (`<figure>`, `<div>`), not on the content element itself. This means:
   - `ProseMirror-selectednode` is added to the **container**, not the inner element
   - CSS must use `display: inline-block` on the inner element for `text-align` to work
   - To align a new block type, extend its node to use a wrapper and add its name to the TextAlign `types` array — see "Adding an Alignable Editor Block Node" below

6. **Images are stored as base64 in the encrypted HTML `text` field** — there is no separate media storage. Users can drag-drop, paste, or pick images; they are auto-resized to max 1200×1200 px and embedded as base64 data URLs. Backend `read_file_bytes()` reads disk images for drag-drop paths (Tauri drag-drop gives file paths, not `File` objects). Large images significantly increase encrypted entry size.

7. **Theme preference and CSS token overrides are separate localStorage keys**, independent of the main `'preferences'` key. Any code that resets or exports user settings must handle all three keys:
   - `'preferences'` — the `Preferences` interface (autoLockEnabled, hideTitles, etc.)
   - `'theme-preference'` — `'auto'|'light'|'dark'` (managed by `src/lib/theme.ts`)
   - `'theme-overrides'` — JSON object of CSS token overrides (managed by `src/lib/theme-overrides.ts`)

   See [`docs/decisions/2026-05-settings-storage-taxonomy.md`](../docs/decisions/2026-05-settings-storage-taxonomy.md) for the full taxonomy and decision guide.

8. **TipTap inline styles require `dangerousDisableAssetCspModification: ["style-src"]`**: Tauri injects a random nonce into all CSP directives at runtime. Per the CSP spec, when a nonce is present in `style-src`, `'unsafe-inline'` is **ignored** — so TipTap's `style="text-align: X"` node-attribute rendering is silently blocked by the browser. The `tauri.conf.json` security section uses `"dangerousDisableAssetCspModification": ["style-src"]` to prevent nonce injection into `style-src` only (leaving `script-src` nonce-protected). **Do not remove this line or restructure the CSP string without verifying alignment still works** — the failure is silent (no console error in dev mode, only in production builds where the nonce is active). See issue #63.

9. **TipTap dialog state capture — snapshot, not memo**: Never use `createMemo(() => editor.state.*)` inside a dialog component. TipTap collapses the selection when an `autofocus` input receives focus, making reactive reads of `editor.state.selection` unreliable after the dialog opens. Instead, capture editor state **once** when the dialog opens via a `createEffect` that fires when `isOpen` transitions to `true`. See `snapshotEditor()` in `src/components/editor/LinkOverlay.tsx` as the reference implementation.

10. **Always import `open`/`save`/`confirm` from `src/lib/dialog.ts`, never directly from `@tauri-apps/plugin-dialog`**: native dialogs are separate OS windows that steal focus from the main window, which would trigger the focus-loss auto-lock (`src/lib/focus-lock.ts`, TODO-0068) mid-export/import if left unguarded. `dialog.ts` wraps the same three functions with a shared open-dialog counter that `focus-lock.ts` consults via `isDialogOpen()` to suppress the lock while one of the app's own dialogs is open. A new call site importing the plugin directly reopens the false-positive-lock gap this wrapper exists to close.

## Common Task Checklists

### Adding an Alignable Editor Block Node

Wrap the node in a `<figure class="X-container">` container, register it in `TextAlign.configure({ types: [..., 'yourNodeName'] })`, and add CSS: `figure.X-container { display: block }` + `.inner-element { display: inline-block }` (container's `text-align` propagates). `ProseMirror-selectednode` lands on the container, not the inner element. See Gotcha #5 above and `AlignableImage` in `DiaryEditor.tsx` as the reference implementation.

## Security

Do not log passwords, cache plaintext diary content in `localStorage`, or expose sensitive data in error messages. Pass all Tauri error strings through `mapTauriError()` before displaying. See root CLAUDE.md for the full Security Rules.
