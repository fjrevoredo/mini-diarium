# Frontend Best Practices

Durable rules and diagnostic habits for Mini Diarium's SolidJS frontend. These focus on Solid reactivity, state ownership, Tauri IPC usage, user-facing error handling, TipTap/editor flows, accessibility, and test coverage that catches regressions early.

This is not a full SolidJS or TypeScript style guide. Use TypeScript strict mode, ESLint, Prettier, and the existing component patterns for routine style. This document covers the practices most likely to prevent security, privacy, state, and UI regressions in this codebase.

## Core Rules

### Keep Solid Reactivity Explicit

Solid components execute once. Reactive updates happen through signal reads inside tracked scopes, JSX, memos, effects, resources, and control-flow components.

- Do not destructure props at component scope. Use `props.name` or create accessors when a child helper needs one value.
- Do not treat components like React render functions. A top-level signal read is a snapshot unless it is inside a tracked context.
- Use `createMemo` for derived values used in JSX, especially translated option arrays and filtered lists.
- Use `<Show>`, `<For>`, and `<Switch>/<Match>` for reactive control flow instead of ternaries or `.map()` in JSX.
- Use `onMount` or `createResource` for async startup work. Do not use top-level `await` in components.

Diagnostic checks:

```powershell
rg -n "const \{.*\} = props|\\.map\\(.*=>.*<|await " src/components src/state src/lib
```

Review every match manually. Some `.map()` calls are valid outside JSX and some `await` calls are valid inside handlers or lifecycle functions.

### Put State In The Smallest Correct Owner

Use the frontend state modules for cross-component and session-level state. Keep temporary form fields, local loading flags, and draft values inside the component or hook that owns the interaction.

- Global state belongs under `src/state/` only when more than one component needs it or it must reset on session boundaries.
- Session-sensitive state must be reset through `src/state/session.ts` when the journal locks or switches.
- Overlay draft state should reset when the overlay opens if stale values could leak across sessions or actions.
- Preferences stay in `localStorage` unless the settings taxonomy says otherwise.
- Frontend settings are UX preferences, not security enforcement. Rust commands must enforce security and persistence invariants.

Current references:

- `src/state/session.ts`
- `src/state/preferences.ts`
- `docs/decisions/2026-05-settings-storage-taxonomy.md`

### Use Typed Tauri Wrappers

Components and hooks should call typed wrappers from `src/lib/tauri.ts` or higher-level state helpers, not raw `invoke()` calls.

- Add a wrapper when adding a new backend command.
- Keep wrapper argument names and shapes aligned with the Rust command.
- Keep command-specific formatting and DTO conversion near the wrapper when it is shared.
- Direct Tauri API usage is acceptable for non-command APIs such as dialogs, filesystem reads, window events, or `listen()`.

Diagnostic check:

```powershell
rg -n "invoke\\(" src
```

Most command invocations should be in `src/lib/tauri.ts` or focused tests.

### Sanitize User-Facing Backend Errors

Raw Tauri errors can expose filesystem paths, SQLite internals, OS details, or crypto internals. Anything rendered in the UI must pass through `mapTauriError()`.

- In components, call `mapTauriError(err, t)` before setting an error signal.
- In state modules without an i18n translator, call `mapTauriError(err)` before setting shared error state or rethrowing for display.
- Add or update tests for new user-visible error paths with deliberately leaky raw strings.
- Treat backend error text matched by `mapTauriError()` as cross-layer API surface.

Required check after changing a user-visible Tauri error path:

```powershell
cmd.exe /c bun run check:ui-errors
```

Diagnostic checks:

```powershell
rg -n "set[A-Za-z]*Error\\((String\\(err\\)|err\\.message|error\\.message|String\\(error\\))" src
rg -n "mapTauriError" src
```

### Keep Sensitive UI Flows Ordered And Testable

The frontend can improve UX for auth and file flows, but it must not become the only enforcement layer.

- Do not show a destructive confirmation until the user has selected the exact target identity or method being changed.
- Do not write key files, export files, or other durable artifacts before the backend operation that authorizes or creates the state has succeeded, unless the workflow explicitly requires a staged temp file.
- When a flow has backend registration plus filesystem work, tests should assert call ordering and cleanup behavior.
- UI guards such as disabled buttons are convenience only. Backend tests must cover the invariant.

Good tests for these flows assert what matters externally: which backend wrapper was called, which file operation happened, what error was shown, and whether the UI allowed the next step.

### Treat TipTap Content As Encrypted HTML

The entry `text` field is HTML generated by TipTap. It is encrypted by the backend as part of the entry row.

- Do not convert entry content to Markdown in frontend save paths.
- Sanitize or constrain new editor extensions before they can emit arbitrary attributes or scriptable content.
- Put standalone editor extensions under `src/components/editor/extensions/`.
- Preserve the alignable block wrapper model when adding block nodes that need text alignment.
- Avoid editor lifecycle effects that can loop between content load, save, and empty-state computation.
- Before configuring a TipTap extension, read its installed source at `node_modules/@tiptap/<extension>/dist/index.js` to verify actual defaults and `configure()` merge behavior. The call does a **deep merge** — setting one attribute to `null` does not clear defaults set elsewhere in the extension.

Current references:

- `src/components/editor/DiaryEditor.tsx`
- `src/components/layout/EditorPanel.tsx`
- `src/components/layout/editor-panel/`

### Keep Component Boundaries Boring

Large components should be split by responsibility, not by arbitrary line count.

- Shell components own layout, dialog state, and orchestration.
- Child form components own their fields, validation messages, and submit handlers.
- Reusable hooks own lifecycle and side effects that need focused tests.
- Pure helpers should live in `src/lib/` or a nearby module when they are component-specific.

Useful signs that a split is justified:

- one component mixes unrelated forms or tabs
- a lifecycle effect is hard to test through the UI
- tests need excessive setup to exercise a small behavior
- a helper is duplicated in multiple components

### Treat Large Frontend Files As Design Smells

Line count is a review signal, not an automatic refactor mandate. A large file is acceptable only when it has one clear responsibility and splitting it would make the workflow harder to understand or test.

Soft limits trigger a split review:

- UI components and overlay shells: 250 lines
- complex editor, layout, or workflow components: 350 lines
- hooks and state modules: 220 lines
- frontend utility modules: 250 lines
- focused test files: 450 lines

Hard limits require an explicit justification in the PR or a split plan:

- UI components and overlay shells: 400 lines
- complex editor, layout, or workflow components: 550 lines
- hooks and state modules: 350 lines
- frontend utility modules: 400 lines
- focused test files: 750 lines

Prefer splits that preserve the user's workflow:

- shell component vs. tab/form components
- component rendering vs. lifecycle hook
- lifecycle hook vs. pure helper
- Tauri wrapper/state orchestration vs. UI presentation
- test fixture setup vs. behavior assertions

Do not split just to satisfy a number if the result creates indirection without clearer ownership. Do require a written reason when a file stays above a hard limit.

Diagnostic check:

```powershell
Get-ChildItem src -Recurse -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.generated\\.' } |
  ForEach-Object {
    $lines = (Get-Content $_.FullName).Count
    if ($lines -ge 250) { "{0,5} {1}" -f $lines, $_.FullName }
  } |
  Sort-Object -Descending
```

## Preferences Panel UI Patterns

Every settings panel is a `<div class="space-y-6 focus:outline-none">` tab panel. The rules below define the exact class strings for each recurring element type. Use them verbatim — do not substitute raw hex colours, Tailwind palette shades, or `dark:` variants for theme tokens (`text-primary`, `text-secondary`, `text-tertiary`, `text-error`, `border-primary`, `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-hover`, `interactive-primary`, `interactive-destructive`).

### Section heading (named group, no `for` target)

Used when a tab section contains multiple related controls rather than a single labeled input.

```tsx
<h3 class="text-sm font-medium text-primary mb-3">{t('...')}</h3>
```

Followed immediately by a description paragraph when one exists:

```tsx
<p class="text-xs text-tertiary leading-relaxed mb-3">{t('...')}</p>
```

### Field label (directly above a single control)

Used directly above a `<select>`, `<input>`, or read-only value block. Always a `<label>` with a matching `for` / `id` pair.

```tsx
<label for="input-id" class="block text-sm font-medium text-secondary mb-2">
  {t('...')}
</label>
```

Hint text that follows the control (below it) uses `mt-2`:

```tsx
<p class="mt-2 text-xs text-tertiary leading-relaxed">{t('...')}</p>
```

### Field label with inline actions (header + buttons row)

When a section header sits on the same line as "Select all / Select none" or similar links:

```tsx
<div class="flex items-center justify-between mb-1">
  <label class="block text-sm font-medium text-secondary">{t('...')}</label>
  <div class="flex gap-3">
    <button type="button" class="text-xs text-blue-500 hover:underline">{t('...')}</button>
  </div>
</div>
<p class="text-xs text-tertiary leading-relaxed mb-3">{t('...')}</p>
```

### Select control

```tsx
<select
  id="input-id"
  class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
>
```

### Text input (full-width)

```tsx
<input
  type="text"
  id="input-id"
  class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
```

Compact inline variant (e.g. short number field inside a row):

```tsx
<input
  type="number"
  class="w-20 px-2 py-1 text-sm border border-primary rounded-md bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

### Checkbox row

Wrap both the input and its text label in one `<label>` so the entire row is a click target.

```tsx
<label class="flex items-center gap-3">
  <input
    type="checkbox"
    class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
  />
  <span class="text-sm text-secondary">{t('...')}</span>
</label>
```

### Read-only value display

```tsx
<div class="px-3 py-3 bg-tertiary border border-primary rounded-md text-sm text-secondary font-mono break-all">
  {value}
</div>
```

### Primary action button

```tsx
<button
  type="button"
  class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
```

### Destructive action button

```tsx
<button
  type="button"
  class="px-4 py-2 text-sm font-medium interactive-destructive rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
>
```

### Error message

Always use the `text-error` theme token and `role="alert"`.

```tsx
<p class="text-xs text-error" role="alert">{errorMessage()}</p>
```

### Section divider

```tsx
<div class="border-t border-primary pt-4 mt-4">
```

### Diagnostic check

```powershell
rg -n "text-red-[0-9]|text-green-[0-9]" src/components/overlays/preferences
```

Raw Tailwind palette colours in preferences panels are almost always a mistake — they should be theme tokens.

## Testing Rules

### Use The Project Test Harness

Component tests use Vitest and `@solidjs/testing-library`.

- Use `renderWithI18n(() => <Component />)`, not bare `render()`, for components that render translated text.
- Keep Tauri command mocks at the wrapper or state boundary.
- Use `waitFor` or async queries for UI that changes after promises, effects, or resources.
- Do not assert private signal names when a visible behavior or wrapper call can be asserted.

Reference:

- `src/test/i18n-test-utils.tsx`
- `src/test/setup.ts`

### Add Characterization Tests Before Risky Refactors

Before splitting a component, changing an editor lifecycle hook, or moving auth form logic, add tests that describe the current user-visible behavior.

Good characterization tests cover:

- happy path and failure path
- reset behavior when overlays reopen or sessions lock
- ordering of backend and filesystem calls for sensitive flows
- E2E selectors that must remain stable

After the refactor, keep or adapt those tests so the behavior remains pinned.

### Preserve E2E Reachability

The default E2E viewport is below the `lg` breakpoint. Sidebar and overlay visibility changes can make existing flows unreachable.

- Do not remove or rename documented `data-testid` attributes without updating `e2e/CLAUDE.md`, `src/CLAUDE.md`, and affected specs.
- If a visibility default changes, audit `e2e/specs/` at the 800x660 clean-mode viewport.
- Prefer accessible names and roles first; use `data-testid` for stable app-specific controls that are hard to select semantically.

Diagnostic check:

```powershell
rg -n "data-testid|isSidebarCollapsed|is[A-Za-z]+Open" src e2e
```

## UI And Accessibility Rules

- Every input needs a visible label or an accessible label.
- Error banners and validation messages that need announcement should use `role="alert"` or an equivalent existing pattern.
- Icon-only buttons need an accessible name.
- Dialogs and overlays must have a clear close path and must not leave stale draft state in a later session.
- Keep layout behavior stable at the E2E viewport and common desktop widths before refining visual polish.

### Use The Standard Overlay Surface Pattern

Dialog and overlay surfaces should follow the existing tokenized pattern used by `ImportOverlay`, `ExportOverlay`, `PreferencesOverlay`, `LinkOverlay`, and other working dialogs:

- Backdrop: `style={{ 'background-color': 'var(--overlay-bg)' }}`
- Dialog surface: `bg-primary`
- Dialog elevation: `style={{ 'box-shadow': 'var(--shadow-lg)' }}`

Do not introduce ad hoc surface tokens such as `bg-surface` unless the token is already defined in `src/index.css`. Overlay/dialog regressions can look fine in JSX review but render transparent at runtime if a non-existent class token is used.

When touching dialog styling:

- compare the changed dialog with an existing working overlay before changing broader theme code
- add or update a focused regression test if the surface token, backdrop token, or elevation token changes

## Diagnostics

Use these checks when reviewing frontend work:

```powershell
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run test:run
cmd.exe /c bun run check:ui-errors
cmd.exe /c bun run format:check
```

Run additional checks when relevant:

```powershell
cmd.exe /c bun run validate:locales
cmd.exe /c bun run test:e2e
```

Suggested investigation commands:

```powershell
rg -n "const \{.*\} = props" src
rg -n "invoke\\(" src
rg -n "mapTauriError|set[A-Za-z]*Error" src
rg -n "createEffect|onMount|createResource|createMemo" src/components src/state
rg -n "data-testid" src e2e
```

## Review Checklist

Use this checklist for frontend PRs:

- Reactivity: no prop destructuring, no accidental top-level signal snapshots, derived values are memos when needed.
- State: session-sensitive state resets on lock/switch, local form state stays local, preferences follow the settings taxonomy.
- IPC: components use typed wrappers, user-facing backend errors are sanitized, command shape changes are tested.
- Security UX: sensitive flows have explicit target selection, correct operation ordering, and backend invariant coverage.
- Editor: TipTap content remains HTML, editor effects do not create load/save loops, extension behavior is constrained and tested.
- Testing: characterization tests cover risky refactors, async UI uses `waitFor`, E2E selectors and viewport reachability are preserved.
- Accessibility: inputs, dialogs, icon buttons, and errors expose stable accessible names or roles.
- File size: files above soft limits have a clear responsibility boundary; files above hard limits have an explicit justification or split plan.
