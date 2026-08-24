# Frontend (src/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).
> For durable frontend rules, use [Frontend best practices](../docs/best-practices/FRONTEND_BEST_PRACTICES.md) before changing SolidJS reactivity, state ownership, Tauri error UI, TipTap/editor behavior, accessibility, or E2E-visible UI.

## State Management

State modules live in `src/state/` — one file per domain, all SolidJS signals. See each file for current signals and exports.

**Key invariant:** `session.ts:resetSessionState()` orchestrates lock cleanup — it calls reset functions from `entries`, `search`, `ui`, and `tags`. If you add a module that holds session-scoped data, add its reset call there.

The `Preferences` interface (fields, types, defaults) is the source of truth in `src/state/preferences.ts`. Stored in `localStorage`.

`feature-flags.ts` holds runtime feature flags (Tier 2 of the feature-flag strategy) in a **migration-free** open `Record<string, boolean>` under its own `localStorage['feature-flags']` key. `isFeatureEnabled(flag)` is a reactive read (drives `<Show>`); `setFeatureFlag(flag, enabled)` persists. Adding/retiring a flag is just editing the `FeatureFlag` union, `DEFAULTS`, and the `FEATURE_FLAGS` registry — there is deliberately no migration block. Use this (not the `Preferences` interface) to gate in-progress features that need a runtime toggle. **The union and registry are currently empty**: `inAppMenu`, the only flag that ever existed, graduated in TODO-0065, and the module is kept as dormant infra. **To flip a flag:** in-app via **Preferences → Advanced → Experimental Features** (unlocked-only, reactive — the section renders from `FEATURE_FLAGS` and hides itself while that list is empty, which is the state today), or in dev/E2E by seeding `localStorage['feature-flags']` before load (e.g. `localStorage.setItem('feature-flags', JSON.stringify({ someFlag: true }))`). Every flag defaults off. See [`docs/decisions/2026-06-feature-flags.md`](../docs/decisions/2026-06-feature-flags.md) (Tier 2 → "Enabling / disabling a flag at runtime") for the full how-to and current-flag inventory.

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

### Keyboard Shortcuts

Every app-level shortcut lives in `src/lib/keyboard-shortcuts.ts` — one `keydown` handler on `document`, registered by `MainLayout`'s `onMount` via `registerKeyboardShortcuts()` and torn down in `onCleanup`. Add new combos there, not in a component. Two rules the file already encodes and new bindings must follow: match brackets on `e.code` (`e.key` is `{`/`}` when Shift is held) and bail when `isAnyOverlayOpen()` (`src/state/ui.ts`) — overlays own the keyboard while open.

These were OS-level native-menu accelerators until TODO-0065 reduced the native menu to Preferences + Quit. `CmdOrCtrl+,` (Preferences) is the one accelerator still handled by the OS.

### Menu Event Pattern — Frontend

Menu event names are prefixed `menu-`. `menu-preferences` is the only one the backend still emits (TODO-0065); `MainLayout.tsx` listens for it:

```typescript
listen("menu-preferences", handler)
```

The backend emits via `app.emit("menu-preferences", ())` in `menu.rs`. See root CLAUDE.md for the full cross-layer pattern.

## Verification Commands

For the canonical post-task checklist (tests + formatting + CHANGELOG + TODO), see [Post-Task Completion Best Practices](../docs/best-practices/POST_TASK_BEST_PRACTICES.md).

Frontend-specific:

```bash
cmd.exe /c bun run test:coverage      # Coverage report (single run, writes coverage/lcov.info)
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
| `Header.tsx` | Previous-day button (◀) | `header-prev-day-button` |
| `Header.tsx` | Date title button (opens `GoToDateOverlay`) | `header-date-title` |
| `Header.tsx` | Next-day button (▶) | `header-next-day-button` |
| `SearchOverlay.tsx` | Search dialog content | `search-overlay` |
| `Header.tsx` | Lock button | `lock-journal-button` |
| `Header.tsx` | Timeline toggle button | `timeline-toggle-button` |
| `Header.tsx` | Streak-milestone Support icon (rendered only when a milestone is pending) | `support-milestone-button` |
| `HeaderMoreMenu.tsx` | Overflow menu trigger (⋮); also carries `data-tour-target="import"` for the onboarding tour | `header-more-menu-trigger` |
| `HeaderMoreMenu.tsx` | Overflow menu dropdown content | `header-more-menu-content` |
| `HeaderMoreMenu.tsx` | Preferences item in overflow menu | `header-more-menu-preferences-item` |
| `HeaderMoreMenu.tsx` | Statistics item in overflow menu | `header-more-menu-statistics-item` |
| `HeaderMoreMenu.tsx` | Import item in overflow menu | `header-more-menu-import-item` |
| `HeaderMoreMenu.tsx` | Export item in overflow menu | `header-more-menu-export-item` |
| `PreferencesOverlay.tsx` | Preferences dialog content | `preferences-overlay` |
| `ChangePasswordForm.tsx` | Persistent snapshot-credential-drift notice (not the auto-dismissing success toast) | `change-password-snapshot-warning` |
| `BackupsPanel.tsx` | Panel root (Preferences → Backups and the pre-auth view) | `backups-panel` |
| `BackupsPanel.tsx` | One snapshot row | `backups-list-item` |
| `BackupsPanel.tsx` | Empty-state message | `backups-empty` |
| `BackupsPanel.tsx` | "Backups are working" line | `backups-health-ok` |
| `BackupsPanel.tsx` | Pending-first-backup line (healthy journal, no snapshot taken yet) | `backups-health-pending` |
| `BackupsPanel.tsx` | Degraded-health line (unreachable folder / failed attempt / over budget) | `backups-health-problem` |
| `BackupsPanel.tsx` | Back up now button | `backups-create-button` |
| `BackupsPanel.tsx` | Open backups folder button | `backups-reveal-button` |
| `BackupsPanel.tsx` | Per-row checked / not-checked badge | `backups-item-verified` / `backups-item-unverified` |
| `BackupsPanel.tsx` | Per-row Restore button | `backups-restore-button` |
| `BackupsPanel.tsx` | Restore success message, naming the safety snapshot | `backups-restore-success` |
| `BackupsPanel.tsx` | Passwordless-journal notice (UX-7) | `backups-local-only-notice` |
| `BackupsPanel.tsx` | Reduced-mode explanation for disabled actions | `backups-locked-hint` |
| `BackupsPanel.tsx` | Per-row "Restore entries…" button (opens `BackupInspectDialog`; hidden in reduced mode) | `backups-restore-entries-button` |
| `BackupsPanel.tsx` | Per-row required-credential hint (from `auth_slot_types`; absent when only `auto`) | `backups-required-credential` |
| `BackupsOverlay.tsx` | Standalone backups dialog (pre-auth) | `backups-overlay` |
| `BackupInspectDialog.tsx` | Per-entry restore dialog root | `backup-inspect-dialog` |
| `BackupInspectDialog.tsx` | Credential-differs notice (UX-3) | `backup-inspect-credential-differs` |
| `BackupInspectDialog.tsx` | "View entries" submit button | `backup-inspect-open-button` |
| `BackupInspectDialog.tsx` | Entry count in snapshot metadata | `backup-inspect-entry-count` |
| `BackupInspectDialog.tsx` | Empty-state message | `backup-inspect-empty` |
| `BackupInspectDialog.tsx` | "Select all missing or shorter" button | `backup-inspect-select-all` |
| `BackupInspectDialog.tsx` | One snapshot entry row | `backup-inspect-entry-item` |
| `BackupInspectDialog.tsx` | Per-entry status badge (UX-4) | `backup-inspect-status-missing` / `backup-inspect-status-shorter_in_live` / `backup-inspect-status-present` |
| `BackupInspectDialog.tsx` | Restore-selected button | `backup-inspect-restore-button` |
| `BackupInspectDialog.tsx` | Restore success message | `backup-inspect-success` |
| `PreAuthTools.tsx` | Row of tools reachable without unlocking | `pre-auth-tools` |
| `PreAuthTools.tsx` | View-backups entry point on the unlock screen | `pre-auth-backups-button` |
| `StatsOverlay.tsx` | Statistics dialog content | `stats-overlay` |
| `ImportOverlay.tsx` | Import dialog content | `import-overlay` |
| `ExportOverlay.tsx` | Export dialog content | `export-overlay` |
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
| `ConfirmDialog.tsx` | Dialog content root | `confirm-dialog` |
| `ConfirmDialog.tsx` | Cancel button | `confirm-dialog-cancel-button` |
| `ConfirmDialog.tsx` | Confirm button | `confirm-dialog-confirm-button` |
| `ProjectSupportOverlay.tsx` | Dialog content root | `project-support-overlay` |
| `ProjectSupportOverlay.tsx` | Per-item action button | `support-item-{star\|review\|share\|newsletter\|contribute\|donate}` |
| `NotificationsOverlay.tsx` | Unread dot on one entry | `unread-dot-{id}` |
| `NotificationsOverlay.tsx` | External link button on one entry | `link-{id}` |
| `NotificationsOverlay.tsx` | "Read more" button (visible only when `entry.body` is set; opens `NotificationDetailDialog`) | `read-more-{id}` |
| `NotificationsOverlay.tsx` | Mark-read button on one entry | `mark-read-{id}` |
| `NotificationsOverlay.tsx` | "Mark all read" footer button | `mark-all-read-button` |
| `NotificationsOverlay.tsx` | Close button | `notifications-close-button` |
| `NotificationDetailDialog.tsx` | Dialog content root | `notification-detail-dialog` |
| `NotificationDetailDialog.tsx` | External link button | `notification-detail-link` |
| `NotificationDetailDialog.tsx` | Close button | `notification-detail-close-button` |

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

   A fourth independent key, `'feature-flags'` (managed by `src/state/feature-flags.ts`), holds runtime experimental flags. Unlike the three above it is **not** wiped by `resetPreferences` and **not** included in settings export — experimental flags are intentionally ephemeral, so leave it out of reset/export flows.

   See [`docs/decisions/2026-05-settings-storage-taxonomy.md`](../docs/decisions/2026-05-settings-storage-taxonomy.md) for the full taxonomy and decision guide.

8. **TipTap inline styles require `dangerousDisableAssetCspModification: ["style-src"]`**: Tauri injects a random nonce into all CSP directives at runtime. Per the CSP spec, when a nonce is present in `style-src`, `'unsafe-inline'` is **ignored** — so TipTap's `style="text-align: X"` node-attribute rendering is silently blocked by the browser. The `tauri.conf.json` security section uses `"dangerousDisableAssetCspModification": ["style-src"]` to prevent nonce injection into `style-src` only (leaving `script-src` nonce-protected). **Do not remove this line or restructure the CSP string without verifying alignment still works** — the failure is silent (no console error in dev mode, only in production builds where the nonce is active). See issue #63.

9. **TipTap dialog state capture — snapshot, not memo**: Never use `createMemo(() => editor.state.*)` inside a dialog component. TipTap collapses the selection when an `autofocus` input receives focus, making reactive reads of `editor.state.selection` unreliable after the dialog opens. Instead, capture editor state **once** when the dialog opens via a `createEffect` that fires when `isOpen` transitions to `true`. See `snapshotEditor()` in `src/components/editor/LinkOverlay.tsx` as the reference implementation.

10. **The editor's id, title, and body must be committed atomically**: `pendingEntryId`, `title`, and `content` together answer "which entry is open and what does it contain?", and **every** flush-before-navigating-away path (date switch, entry switch, lock, `beforeunload`, unmount) re-reads them from live signals. Writing them at different points in time — e.g. setting the id, then `await`ing `getEntryImages`, then setting the content — leaves a window where a flush pairs a real entry's id and title with an empty document, and persists `save_entry(id, title, '')`: the row survives, the title survives, the body is wiped (TODO-0089). Rules:
    - Resolve everything the commit needs (image refs included) **before** touching a signal, re-check the request/token guard on the line above, then write through `commitEntryToEditor` / `clearEntryFromEditor` in `editor-panel/entryHydration.ts` — never with loose setters.
    - The write path itself lives in `editor-panel/useEntryPersistence.ts` (`useEntryLifecycle` keeps load/creation/teardown and drives it). A write is additionally gated on `hydratedEntryId`, which is only set by those two helpers; the coordinator refuses any `entryId` that does not match it. Its `saveCurrentById` stays private — reach the backend through `flushCurrent` / `debouncedSave` only, so nobody can hand-assemble a payload.
    - The save-vs-delete decision travels **with** the payload (`isEmpty` and `metadata` captured at snapshot time), never re-derived when the 500 ms debounce fires. Use `computeIsEmpty(editor, content)` at the capture site; `lifecycle.flushCurrent(path)` and `captureCurrentSnapshot()` already do this.
    - Every backend write is logged at `log.info` (id + lengths + decision + calling path) so a wild recurrence is diagnosable in a release build — `createLogger` compiles `debug` out of production.
    - **Extension (TODO-0104):** leaving a real entry blank is no longer silently swallowed by the atomic-commit machinery above — `canLeaveCurrentEntry()` (`editor-panel/useEntryLifecycle.ts`) is registered as a navigation guard (`src/state/entries.ts`'s guard registry, mirroring `registerCleanupCallback`/`registerReloadCallback`) and runs before every guarded navigation entry point. It reads the on-disk row live via `entry_has_content(id)` rather than trusting the in-memory snapshot, shows `confirmInApp()` when real content would otherwise be dropped, and performs an explicit hard-delete only on confirmation. This guard is deliberately **not** wired into the auto-lock or `beforeunload` paths (Non-Goals in `docs/entry-persistence-consent-gate-plan.md`) — those rely solely on the backend on-disk refusal in `delete_entry_if_empty_inner` (`src-tauri/src/commands/entries.rs`), never on a dialog. On cancel, it now also restores the entry's real on-disk content into the editor via a `restoreEntryFromDisk` helper (targeting the exact entry being restored, not just the day's newest — see `docs/entry-persistence-cancel-restore-plan.md`) before denying the navigation, so Cancel no longer leaves the editor visibly blank while the disk row underneath it is intact.

11. **SolidJS cleanup order differs between dev and release builds**: `createComponent` creates an owner **only** in `solid-js/dist/dev.js` (`devComponent`); `dist/solid.js` uses a bare `untrack`. So in dev, a child's `onCleanup` (e.g. `DiaryEditor`'s `editor.destroy()`) runs **before** the parent's (`EditorPanel`'s `lifecycle.dispose()`); in release builds it runs **after**. Cleanup code must never depend on that ordering: read the editor defensively (`editor && !editor.isDestroyed`, with a `content()`-signal fallback), and capture anything a teardown handler needs **synchronously at the top of the handler**, before any `await`. Unit tests run the dev build, so they exercise only one of the two orders.

12. **Always import `open`/`save`/`confirm` from `src/lib/dialog.ts`, never directly from `@tauri-apps/plugin-dialog`**: native dialogs are separate OS windows that steal focus from the main window, which would trigger the focus-loss auto-lock (`src/lib/focus-lock.ts`, TODO-0068) mid-export/import if left unguarded. `dialog.ts` wraps the same three functions with a shared open-dialog counter that `focus-lock.ts` consults via `isDialogOpen()` to suppress the lock while one of the app's own dialogs is open. A new call site importing the plugin directly reopens the false-positive-lock gap this wrapper exists to close. **`ConfirmDialog`/`confirmInApp()` (`src/state/confirm-dialog.ts`, TODO-0104) is in-app `@kobalte/core/dialog` content, not a native OS window** — it deliberately does **not** go through this wrapper or `isDialogOpen()`, since it never steals OS-level focus and cannot trigger the focus-loss guard. Do not route it through `dialog.ts`.

13. **A TipTap `update` event is not proof the document changed**: TipTap also emits `update` for state-only events — `setEditable()` emits one synthetically, bypassing `dispatchTransaction`'s `docChanged` check. Treating one as a keystroke is a body-wipe vector: it resets `content()` to the pre-load document, and the blank is then persisted over the real entry (TODO-0089). Rules:
    - Gate `DiaryEditor`'s `onUpdate` on `isDocumentChange(transaction, appendedTransactions)` — `editorUpdateGuard.ts` owns the mechanism (with the TipTap-source reasoning in its doc comment) and `editorUpdateGuard.test.ts` pins the cases. Both arguments matter: a plugin-appended transaction can be the only one carrying `docChanged`.
    - Call `setEditable(value, false)` so it does not emit at all. The `locked` effect re-runs on every `dayEntries`/`currentIndex` change, so the default fires a stream of fake edits.
    - `commands.setContent(html, { emitUpdate: false })` is safe by contrast — the guard recognises it.

14. **`onMount`, not `createEffect`, for one-shot DOM side effects like `.focus()`**: a `createEffect` that reads any prop derived from app state re-runs whenever that state changes, even when the prop's *value* is unchanged — SolidJS tracks the underlying signals, not the computed result. `TitleEditor`'s auto-focus was a `createEffect` reading `props.readOnly` (derived from `dayEntries`/`currentIndex`), so every entry-list change re-focused the title input — including the one that fires mid-typing, moving the caret out of the body (TODO-0089; `TitleEditor.test.tsx` covers it). `onMount` reads props untracked and fires exactly once. Applies to any imperative one-time DOM call, not just focus.

## Common Task Checklists

### Adding an Alignable Editor Block Node

Wrap the node in a `<figure class="X-container">` container, register it in `TextAlign.configure({ types: [..., 'yourNodeName'] })`, and add CSS: `figure.X-container { display: block }` + `.inner-element { display: inline-block }` (container's `text-align` propagates). `ProseMirror-selectednode` lands on the container, not the inner element. See Gotcha #5 above and `AlignableImage` in `DiaryEditor.tsx` as the reference implementation.

## Security

Do not log passwords, cache plaintext diary content in `localStorage`, or expose sensitive data in error messages. Pass all Tauri error strings through `mapTauriError()` before displaying. See root CLAUDE.md for the full Security Rules.
