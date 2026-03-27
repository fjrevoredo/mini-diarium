# Frontend (src/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

## File Structure

```
src/
├── index.tsx                          # Entry point
├── App.tsx                            # Auth routing (Switch/Match on authState)
├── components/
│   ├── auth/
│   │   ├── JournalPicker.tsx          # Pre-auth journal selection + management (outermost layer)
│   │   ├── JournalPicker.test.tsx
│   │   ├── PasswordCreation.tsx       # New diary setup
│   │   ├── PasswordCreation.test.tsx
│   │   ├── PasswordPrompt.tsx         # Password + Key File unlock modes
│   │   └── PasswordPrompt.test.tsx
│   ├── calendar/
│   │   └── Calendar.tsx               # Monthly calendar with entry indicators
│   ├── editor/
│   │   ├── DiaryEditor.tsx            # TipTap rich-text editor
│   │   ├── EditorToolbar.tsx          # Formatting toolbar (basic + advanced; alignment in advanced)
│   │   ├── TitleEditor.tsx            # Entry title input
│   │   ├── WordCount.tsx              # Live word count display
│   │   ├── EntryNavBar.tsx            # Per-day entry counter/navigator (hidden when ≤1 entry)
│   │   ├── TitleEditor.test.tsx
│   │   ├── WordCount.test.tsx
│   │   ├── EntryNavBar.test.tsx
│   │   └── EditorToolbar.test.tsx
│   ├── layout/
│   │   ├── MainLayout.tsx             # App shell (sidebar + editor)
│   │   ├── Header.tsx                 # Top bar
│   │   ├── Sidebar.tsx                # Calendar panel (search removed; see "Implementing Search")
│   │   ├── EditorPanel.tsx            # Editor container
│   │   └── MainLayout-event-listeners.test.tsx
│   ├── overlays/
│   │   ├── GoToDateOverlay.tsx        # Date picker dialog
│   │   ├── PreferencesOverlay.tsx     # Settings dialog (includes Auth Methods section)
│   │   ├── StatsOverlay.tsx           # Statistics display
│   │   ├── ImportOverlay.tsx          # Import format selector + file picker
│   │   ├── ExportOverlay.tsx          # Export format selector + file picker
│   │   └── AboutOverlay.tsx           # App info, version, license, GitHub link
│   └── search/
│       ├── SearchBar.tsx              # Search input (not rendered; reserved for future secure search)
│       └── SearchResults.tsx          # Search result list
├── state/
│   ├── auth.ts                        # AuthState signal + authMethods + initializeAuth/create/unlock/lock/unlockWithKeypair
│   ├── entries.ts                     # currentEntry, entryDates, isLoading, isSaving
│   ├── journals.ts                    # journals, activeJournalId, isSwitching + loadJournals/switchJournal/addJournal/removeJournal/renameJournal
│   ├── search.ts                      # searchQuery, searchResults, isSearching
│   ├── session.ts                     # resetSessionState() — resets entries/search/UI on journal lock
│   ├── ui.ts                          # selectedDate, overlay open states, sidebar state
│   └── preferences.ts                 # Preferences interface, localStorage persistence
├── lib/
│   ├── tauri.ts                       # All Tauri invoke() wrappers (typed)
│   ├── dates.ts                       # Date formatting/arithmetic helpers
│   ├── debounce.ts                    # Generic debounce utility
│   ├── shortcuts.ts                   # Keyboard shortcut + menu event listeners
│   ├── logger.ts                      # createLogger(name) factory used throughout frontend
│   ├── errors.ts                      # mapTauriError() for user-facing error message mapping
│   ├── theme.ts                       # Theme signals + initializeTheme() / setTheme()
│   ├── theme-overrides.ts             # User CSS token overrides per theme
│   ├── dates.test.ts
│   ├── import.test.ts
│   ├── tauri-params.test.ts
│   └── theme-overrides.test.ts
├── test/
│   └── setup.ts                       # Vitest setup: Tauri API mocks, cleanup
├── styles/
│   ├── critical-auth.css
│   └── editor.css
└── index.css
```

## State Management

Six signal-based state modules in `src/state/`:

| Module | Signals | Key Functions |
|--------|---------|---------------|
| `auth.ts` | `authState: AuthState`, `error`, `authMethods: AuthMethodInfo[]` | `initializeAuth()`, `createJournal()`, `unlockJournal()`, `lockJournal()`, `unlockWithKeypair()`, `goToJournalPicker()` |
| `entries.ts` | `currentEntry`, `entryDates`, `isLoading`, `isSaving` | Setters exported directly |
| `journals.ts` | `journals: JournalConfig[]`, `activeJournalId`, `isSwitching` | `loadJournals()`, `switchJournal()`, `addJournal()`, `removeJournal()`, `renameJournal()` |
| `search.ts` | `searchQuery`, `searchResults`, `isSearching` | Setters exported directly |
| `ui.ts` | `selectedDate`, `isSidebarCollapsed`, `isGoToDateOpen`, `isPreferencesOpen`, `isStatsOpen`, `isImportOpen`, `isExportOpen`, `isAboutOpen` | Setters exported directly; `resetUiState()` resets all |
| `preferences.ts` | `preferences: Preferences` | `setPreferences(Partial<Preferences>)`, `resetPreferences()` |

`Preferences` fields: `allowFutureEntries` (bool), `firstDayOfWeek` (number|null), `hideTitles` (bool), `enableSpellcheck` (bool), `escAction` (`'none'|'quit'`), `autoLockEnabled` (bool), `autoLockTimeout` (number, seconds), `advancedToolbar` (bool), `editorFontSize` (number, px), `showEntryTimestamps` (bool). Stored in `localStorage`.

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

### Module-level arrays using translations

Arrays that contain translated strings must be `createMemo` inside the component (not module-level consts), so they are evaluated after `useI18n()` is called. See `MONTH_NAMES` in `Calendar.tsx` and `FIRST_DAY_OPTIONS` in `PreferencesOverlay.tsx` as reference.

### Testing

All component tests use `renderWithI18n()` from `src/test/i18n-test-utils.tsx` instead of bare `render()`. The wrapper provides the `I18nProvider` context. English strings are identical to hardcoded values, so existing `getByText('...')` assertions continue to pass.

### Validating locale files

Community locale JSON files live in `src/i18n/locales/`. To check completeness against `en.ts`:

```bash
bun run validate:locales
```

See `docs/TRANSLATIONS.md` for the community translator guide.

## Conventions

### SolidJS Reactivity Gotchas

- **Never destructure props** — kills reactivity. Use `props.name` always.
- **Wrap async in components** — use `onMount` or `createResource`, never top-level `await`.
- **Event handlers** — use `on:click` (native) or `onClick` (SolidJS delegated). Wrap async handlers: `onClick={() => handleAsync()}`.
- **Conditional rendering** — use `<Show when={...}>`, not JS ternaries.
- **Lists** — use `<For each={...}>`, never `.map()`.

### Error Handling

- `try/catch` around `invoke()` calls; set error signals for UI display.
- **Always pass raw Tauri error strings through `mapTauriError()` from `src/lib/errors.ts` before displaying to users.** It strips filesystem paths, OS error codes, SQLite internals, and Argon2 details to prevent information disclosure.

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
bun run test:run           # All frontend tests (single run)
bun run test               # Watch mode
bun run test:coverage      # Coverage report
bun run lint               # ESLint
bun run lint:fix           # ESLint autofix
bun run format:check       # Prettier check
bun run format             # Prettier fix
bun run type-check         # TypeScript type check
```

## data-testid Attributes

These are used by E2E tests — **do not remove** from components.

| Component | Element | data-testid |
|-----------|---------|-------------|
| `PasswordCreation.tsx` | Password input | `password-create-input` |
| `PasswordCreation.tsx` | Confirm password input | `password-repeat-input` |
| `PasswordCreation.tsx` | Create button | `create-journal-button` |
| `PasswordPrompt.tsx` | Password input | `password-unlock-input` |
| `PasswordPrompt.tsx` | Unlock submit button | `unlock-journal-button` |
| `Header.tsx` | Sidebar toggle (hamburger) | `toggle-sidebar-button` |
| `Header.tsx` | Lock button | `lock-journal-button` |
| `TitleEditor.tsx` | Title input | `title-input` |
| `Calendar.tsx` | Each day button | `calendar-day-YYYY-MM-DD` |
| `EntryNavBar.tsx` | Nav bar container | `entry-nav-bar` |
| `EntryNavBar.tsx` | Previous entry button (`←`) | `entry-prev-button` |
| `EntryNavBar.tsx` | Entry position counter | `entry-counter` |
| `EntryNavBar.tsx` | Next entry button (`→`) | `entry-next-button` |
| `EntryNavBar.tsx` | Delete entry button (`−`) | `entry-delete-button` |
| `EntryNavBar.tsx` | Add entry button (`+`) | `entry-add-button` |

## Gotchas and Pitfalls

1. **Date format is always `YYYY-MM-DD`**: The `T00:00:00` suffix is appended in `dates.ts` functions (`new Date(dateStr + 'T00:00:00')`) to avoid timezone-related date shifts.

2. **TipTap stores HTML**: The editor content is stored as HTML strings, not Markdown. This is intentional — the `text` field in `DiaryEntry` is HTML.

3. **E2E breakpoint planning rule**: Default E2E clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px). The sidebar uses `lg:relative lg:translate-x-0`, so it is always in mobile/overlay behavior in E2E. **When changing the default value of any UI visibility signal (`isSidebarCollapsed`, overlay open states, etc.), explicitly audit `e2e/specs/` for interactions that depend on the affected element being visible and update the test accordingly.**

4. **Block alignment uses a container model (not per-node)**: Alignment is applied via `TextAlign` on a wrapping container (`<figure>`, `<div>`), not on the content element itself. This means:
   - `ProseMirror-selectednode` is added to the **container**, not the inner element
   - CSS must use `display: inline-block` on the inner element for `text-align` to work
   - To align a new block type, extend its node to use a wrapper and add its name to the TextAlign `types` array — see "Adding an Alignable Editor Block Node" below

5. **Images are stored as base64 in the encrypted HTML `text` field** — there is no separate media storage. Users can drag-drop, paste, or pick images; they are auto-resized to max 1200×1200 px and embedded as base64 data URLs. Backend `read_file_bytes()` reads disk images for drag-drop paths (Tauri drag-drop gives file paths, not `File` objects). Large images significantly increase encrypted entry size.

6. **Theme preference and CSS token overrides are separate localStorage keys**, independent of the main `'preferences'` key. Any code that resets or exports user settings must handle all three keys:
   - `'preferences'` — the `Preferences` interface (autoLockEnabled, hideTitles, etc.)
   - `'theme-preference'` — `'auto'|'light'|'dark'` (managed by `src/lib/theme.ts`)
   - `'theme-overrides'` — JSON object of CSS token overrides (managed by `src/lib/theme-overrides.ts`)

7. **TipTap inline styles require `dangerousDisableAssetCspModification: ["style-src"]`**: Tauri injects a random nonce into all CSP directives at runtime. Per the CSP spec, when a nonce is present in `style-src`, `'unsafe-inline'` is **ignored** — so TipTap's `style="text-align: X"` node-attribute rendering is silently blocked by the browser. The `tauri.conf.json` security section uses `"dangerousDisableAssetCspModification": ["style-src"]` to prevent nonce injection into `style-src` only (leaving `script-src` nonce-protected). **Do not remove this line or restructure the CSP string without verifying alignment still works** — the failure is silent (no console error in dev mode, only in production builds where the nonce is active). See issue #63.

## Common Task Checklists

### Adding an Alignable Editor Block Node

Wrap the node in a `<figure class="X-container">` container, register it in `TextAlign.configure({ types: [..., 'yourNodeName'] })`, and add CSS: `figure.X-container { display: block }` + `.inner-element { display: inline-block }` (container's `text-align` propagates). `ProseMirror-selectednode` lands on the container, not the inner element. See Gotcha #4 above and `AlignableImage` in `DiaryEditor.tsx` as the reference implementation.

## Security

Do not log passwords, cache plaintext diary content in `localStorage`, or expose sensitive data in error messages. Pass all Tauri error strings through `mapTauriError()` before displaying. See root CLAUDE.md for the full Security Rules.
