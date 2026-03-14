# Design System — Mini Diarium

This document captures the color palette, theming strategy, and visual design constraints for Mini Diarium. Its purpose is to prevent design drift across the app, website, and any future contributions.

The document is structured in two layers:
1. **Design language** — implementation-agnostic: palette, intent, and decisions.
2. **Implementation** — how the design language maps to CSS variables, utility classes, and files.

---

## Design Language

### Logo

The logo is a stylised book. It uses exactly two colors:

| Role | Hex | Description |
|------|-----|-------------|
| Structure (cover/frame) | `#000000` | Black — recedes, frames the content |
| Content (pages) | `#F5C94D` | Warm gold — the brand color |

The black-and-gold combination is deliberate: it reads as private, weighty, and premium — fitting for an encrypted personal journal.

### Brand Color

**Gold `#F5C94D`** is the single brand color for Mini Diarium. It appears in the logo and throughout the marketing website as the primary accent.

It is **not** the interactive color inside the app. See "Interactive color" below for the rationale.

### Color Palette

Mini Diarium uses two distinct palettes: one for the **website**, one for the **app**.

#### Website palette (always dark)

The website is permanently dark-themed. Its palette is built around near-black backgrounds and the brand gold as the sole accent.

| Role | Hex | Notes |
|------|-----|-------|
| Page background | `#0e0e0e` | Near-black |
| Card surface | `#161616` | Slight lift from page |
| Raised surface | `#1f1f1f` | Inputs, code blocks, nav buttons |
| Accent | `#F5C94D` | Brand gold — all interactive highlights |
| Accent (hover) | `#c49c2e` | Darkened gold for hover states |
| Primary text | `#f0ede6` | Warm off-white, not pure white |
| Secondary text | `#888` | Supporting copy, metadata |
| Border | `#2a2a2a` | Subtle dividers |

Gold drives all accent-level decoration on the website: labels, headings, button backgrounds, icon fills, hover highlights, and blockquote borders.

#### App palette (light + dark)

The app is based on Tailwind's neutral gray scale, stepped into semantic roles. There is no brand gold in the app UI.

**Grays used (light → dark mapping):**

| Tailwind name | Hex | Light role | Dark role |
|---------------|-----|-----------|-----------|
| White | `#ffffff` | Primary surface | — |
| Gray-50 | `#f9fafb` | Page background | — |
| Gray-100 | `#f3f4f6` | Hover, tertiary surface | — |
| Gray-200 | `#e5e7eb` | Active state, HR | — |
| Gray-300 | `#d1d5db` | Borders | — |
| Gray-400 | `#9ca3af` | Muted text | Dark: tertiary text |
| Gray-500 | `#6b7280` | Tertiary text | Dark: muted text |
| Gray-600 | `#4b5563` | Secondary text | Dark: active state |
| Gray-700 | `#374151` | — | Dark: hover, tertiary surface |
| Gray-800 | `#1f2937` | — | Dark: primary surface |
| Gray-900 | `#111827` | Primary text | Dark: page background |

**Interactive color — Blue `#3b82f6` (Tailwind blue-500):**

All interactive elements in the app — buttons, focus rings, selected states, checkboxes — use the blue family:

| State | Light | Dark |
|-------|-------|------|
| Default | `#3b82f6` (blue-500) | `#3b82f6` |
| Hover / active | `#2563eb` (blue-600) | `#60a5fa` (blue-400) |

*Why blue and not the brand gold?* Gold has poor contrast against white backgrounds at interactive element sizes and fails WCAG AA for text on light surfaces. Blue carries a universal affordance for interactivity. The gold is reserved for the logo and the website, where it sits on dark backgrounds that give it the contrast it needs.

**Editor highlight color — Amber:**

The text highlight mark (`<mark>`) uses amber: `#b45309` (amber-700) in light mode and `#fbbf24` (amber-400) in dark mode. Amber is visually distinct from both blue (interactive) and the gray palette, making highlighted text immediately recognisable. Outside the editor, amber appears only in warning status messages.

**Status colors:**

| State | Semantic meaning | Hue family |
|-------|-----------------|------------|
| Success | Saved, completed | Green |
| Error | Failed, destructive | Red |
| Warning | Caution, irreversible | Amber |
| Info | Neutral information | Blue |

Status colors are semantic — they communicate meaning, not decoration. They must not be repurposed for visual styling.

### Typography

A native system font stack is used throughout — no web fonts are loaded. This keeps the app fully offline-capable and avoids any external network request.

- **UI text:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Monospace (code blocks, editor pre):** `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

### Theming Model

| Surface | Themes | Controlled by |
|---------|--------|---------------|
| Website | Dark only | Fixed; no toggle |
| App | Light + Dark | User preference (stored in `localStorage`) |

The two surfaces are visually independent. Changing the app's theme has no effect on the website, and the website's always-dark palette does not imply the app should default to dark.

### Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Brand color | Gold `#F5C94D` | Derived directly from the logo's page color |
| App interactive color | Blue `#3b82f6` | WCAG contrast on light backgrounds; universal affordance |
| Website theme | Always dark | Gold reads best on dark; consistent with private/encrypted aesthetic |
| App theme | Light default, dark available | Matches OS conventions; light is more legible for long writing sessions |
| Web fonts | None | Preserves offline-first and privacy-first principles |
| Gray scale | Tailwind neutral gray | Single coherent ramp covers all light/dark steps |
| Highlight mark | Amber | Visually separate from blue (interactive) and gray (UI) without conflicting with status colors |

---

## Implementation

The sections below describe how the design language above is translated into code. They are the authoritative reference for file locations, variable names, and class usage.

### Logo

Source file: `public/logo-transparent.svg` (1024×1024). Two fill colors: `#000000` (cover) and `#F5C94D` (pages). Regenerate all icon sizes with `bun run tauri icon public/logo-transparent.svg`.

---

### Website (`website/`)

The marketing site is **always dark**. It has no light/dark toggle.

### CSS Custom Properties (`website/css/style.css`)

```css
--bg:          #0e0e0e   /* page background, near-black */
--bg-card:     #161616   /* card surfaces */
--bg-raised:   #1f1f1f   /* raised elements, code blocks, inputs */
--accent:      #F5C94D   /* brand gold — matches logo pages */
--accent-dim:  #c49c2e   /* darkened gold for hover states */
--text:        #f0ede6   /* primary text, warm off-white */
--text-muted:  #888      /* secondary / supporting text (shorthand for #888888) */
--border:      #2a2a2a   /* subtle dividers and outlines */
--radius:      10px      /* default corner radius */
--radius-lg:   16px      /* cards, modals */
```

### Website Accent Usage

The brand gold (`#F5C94D`) drives all accent-level design on the website:
- Section labels, hero eyebrow text, highlighted headings
- CTA button background (primary), icon fills, blockquote left-borders
- Hover highlight on cards, nav links, badge buttons
- Decorative uses: `rgba(245, 201, 77, 0.10)` for icon halos, tag backgrounds

`#0e0e0e` is used as the text color on top of gold buttons (dark-on-gold contrast).

---

### App (`src/`)

The app supports **light and dark themes** toggled via the `.dark` class on `<html>`. Theme switching is controlled by user preference, stored in `localStorage`.

### Theme Architecture

All theme-aware colors are defined as CSS custom properties in `src/index.css`:
- `:root` — light theme values
- `.dark` — dark theme overrides

Components use the CSS variables (via utility classes or inline styles) and Tailwind/UnoCSS utility classes. Hard-coded hex values in component files should be treated as technical debt; new code must use the variable system.

**Exception — `src/styles/critical-auth.css`:** This file duplicates a subset of Tailwind utility classes as static CSS and is loaded synchronously (via `<link>`) before UnoCSS hydrates. Its purpose is to prevent a flash of unstyled content (FOUC) on auth screens during cold launch. It uses light-mode hard-coded hex values only. This is intentional: auth screens are always rendered in light mode regardless of theme preference (the `.dark` class is applied to `<html>` only after the main app mounts). Do not convert this file to CSS variables.

**Unused color scale — `uno.config.ts` `primary`:** The UnoCSS config defines a `primary` color scale (`primary-500: #0ea5e9`, sky/cyan blue) that is **not used anywhere in the codebase**. Do not confuse this with the interactive blue (`#3b82f6`, Tailwind `blue-500`). If you are looking for the interactive color, use `blue-*` classes, not `primary-*`.

---

### App Color Tokens

#### Background

| Token | Light | Dark | Tailwind Equivalent |
|-------|-------|------|---------------------|
| `--bg-primary` | `#ffffff` | `#1f2937` | white / gray-800 |
| `--bg-secondary` | `#f9fafb` | `#111827` | gray-50 / gray-900 |
| `--bg-tertiary` | `#f3f4f6` | `#374151` | gray-100 / gray-700 |
| `--bg-hover` | `#f3f4f6` | `#374151` | gray-100 / gray-700 |
| `--bg-active` | `#e5e7eb` | `#4b5563` | gray-200 / gray-600 |

`body` defaults to `--bg-secondary`. Primary content panels (editor, overlays) use `--bg-primary`.

#### Text

| Token | Light | Dark | Tailwind Equivalent |
|-------|-------|------|---------------------|
| `--text-primary` | `#111827` | `#f9fafb` | gray-900 / gray-50 |
| `--text-secondary` | `#4b5563` | `#d1d5db` | gray-600 / gray-300 |
| `--text-tertiary` | `#6b7280` | `#9ca3af` | gray-500 / gray-400 |
| `--text-muted` | `#9ca3af` | `#6b7280` | gray-400 / gray-500 |
| `--text-inverse` | `#ffffff` | `#111827` | white / gray-900 |

#### Border

| Token | Light | Dark | Tailwind Equivalent |
|-------|-------|------|---------------------|
| `--border-primary` | `#e5e7eb` | `#374151` | gray-200 / gray-700 |
| `--border-secondary` | `#d1d5db` | `#4b5563` | gray-300 / gray-600 |
| `--border-focus` | `#3b82f6` | `#3b82f6` | blue-500 (same both) |

#### Interactive (Action Blue)

| Token | Light | Dark | Tailwind Equivalent |
|-------|-------|------|---------------------|
| `--interactive-primary` | `#3b82f6` | `#3b82f6` | blue-500 |
| `--interactive-primary-hover` | `#2563eb` | `#60a5fa` | blue-600 / blue-400 |
| `--interactive-secondary` | `#6b7280` | `#9ca3af` | gray-500 / gray-400 |
| `--interactive-secondary-hover` | `#4b5563` | `#d1d5db` | gray-600 / gray-300 |

**Why blue, not logo gold?**
The app interactive color is blue (`#3b82f6`) rather than the brand gold. This is an intentional decision: gold is warm and decorative — it works well for a marketing site but has poor accessibility contrast against white backgrounds at interactive sizes (buttons, focus rings). Blue carries strong affordance for interactivity and meets WCAG AA at the sizes used. The logo and brand gold remain exclusive to the logo mark and website.

#### Status

| Token group | Light bg | Light border | Light text | Dark bg | Dark border | Dark text |
|------------|----------|--------------|------------|---------|-------------|-----------|
| Success | `#f0fdf4` | `#bbf7d0` | `#166534` | `#064e3b` | `#065f46` | `#d1fae5` |
| Error | `#fef2f2` | `#fecaca` | `#991b1b` | `#7f1d1d` | `#991b1b` | `#fecaca` |
| Warning | `#fffbeb` | `#fde68a` | `#92400e` | `#78350f` | `#92400e` | `#fde68a` |
| Info | `#eff6ff` | `#bfdbfe` | `#1e40af` | `#1e3a8a` | `#1e40af` | `#bfdbfe` |

Status colors follow Tailwind's green/red/amber/blue scale semantics. They are used only for feedback banners and inline messages, never for decorative purposes.

#### Overlay & Shadows

| Token | Light | Dark |
|-------|-------|------|
| `--overlay-bg` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` |
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0/0.05)` | `…/0.30` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0/0.10)` | `…/0.30` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0/0.10)` | `…/0.30` |

Dark mode shadows use 30% opacity instead of 5–10% to remain visible against dark surfaces.

---

### Editor-Specific Colors (`src/styles/editor.css`)

TipTap (ProseMirror) styles use CSS custom properties from `src/index.css`. All `.dark`-specific overrides inside `editor.css` have been removed — the light/dark cascade is handled entirely by `:root` / `.dark` variable definitions.

| Element | Token | Light value | Dark value |
|---------|-------|-------------|------------|
| Body text | `--editor-body-text` | `var(--text-primary)` | `#e5e7eb` |
| Headings, bold | `--editor-heading-text` | `var(--text-primary)` | `#f3f4f6` |
| Placeholder | `--editor-placeholder-text` | `#adb5bd` | `#adb5bd` (same) |
| Blockquote border | `--editor-blockquote-border` | `var(--border-secondary)` | `var(--interactive-secondary)` |
| Blockquote text | `--editor-blockquote-text` | `var(--text-tertiary)` | `var(--text-tertiary)` |
| HR rule | `--editor-rule-color` | `var(--border-primary)` | `var(--bg-active)` |
| Inline code bg | `--editor-code-bg` | `var(--bg-tertiary)` | `var(--bg-tertiary)` |
| Code block bg | `--editor-code-block-bg` | `#1f2937` (fixed) | `#1f2937` (fixed) |
| Code block text | `--editor-code-block-text` | `#f3f4f6` (fixed) | `#f3f4f6` (fixed) |
| Link | `--editor-link-color` | `var(--interactive-primary)` | `var(--interactive-primary-hover)` |
| Highlight mark | `--editor-highlight-color` | `#b45309` (amber-700) | `#fbbf24` (amber-400) |
| Selected image outline | `--editor-selection-outline` | `var(--interactive-primary)` | `var(--interactive-primary-hover)` |
| Editor font size | `var(--editor-font-size, 16px)` | — | — |

**Note:** `--editor-code-block-bg` / `--editor-code-block-text` are intentionally fixed to the same dark/light values in both themes — code blocks always render as dark-surface content. A user override to these tokens would change code block appearance in all themes.

Highlight (`<mark>`) intentionally uses amber to distinguish it visually from the blue interactive palette without conflicting with status colors.

---

### Button Tokens

#### Light theme

| Token | Value | Role |
|-------|-------|------|
| `--btn-primary-bg` | `#2563eb` | Primary button background (blue-600) |
| `--btn-primary-bg-hover` | `#1d4ed8` | Primary button hover (blue-700) |
| `--btn-primary-text` | `#ffffff` | Primary button text |
| `--btn-primary-ring` | `#3b82f6` | Primary button focus ring (matches `focus:ring-blue-500`) |
| `--btn-destructive-bg` | `#dc2626` | Destructive button background |
| `--btn-destructive-bg-hover` | `#b91c1c` | Destructive button hover |
| `--btn-destructive-text` | `#ffffff` | Destructive button text |
| `--btn-destructive-ring` | `#ef4444` | Destructive button focus ring |
| `--btn-active-bg` | `#dbeafe` | Active/selected badge background (toolbar, picker badge) |
| `--btn-active-text` | `#1d4ed8` | Active/selected badge text |
| `--spinner-color` | `#2563eb` | Loading spinner border (blue-600) |

#### Dark theme

| Token | Value | Role |
|-------|-------|------|
| `--btn-primary-bg` | `#2563eb` | blue-600 — same as light (original had no dark variant) |
| `--btn-primary-bg-hover` | `#1d4ed8` | blue-700 — same as light |
| `--spinner-color` | `#2563eb` | blue-600 — same as light |
| `--btn-destructive-bg` | `#ef4444` | Lighter red for legibility on dark |
| `--btn-destructive-bg-hover` | `#dc2626` | |
| `--btn-destructive-ring` | `#f87171` | |
| `--btn-active-bg` | `#1e3a8a` | Dark blue badge background |
| `--btn-active-text` | `#bfdbfe` | Light blue badge text |

---

### Utility Classes

`src/index.css` exposes CSS-variable-backed utility classes for use directly in JSX alongside UnoCSS utilities. These should be preferred over hard-coded hex values:

**Background:** `.bg-primary`, `.bg-secondary`, `.bg-tertiary`, `.bg-hover`, `.bg-active`
**Text:** `.text-primary`, `.text-secondary`, `.text-tertiary`, `.text-muted`
**Border:** `.border-primary`, `.border-secondary`
**Status bg:** `.bg-success`, `.bg-error`, `.bg-warning`, `.bg-info`
**Status border:** `.border-success`, `.border-error`, `.border-warning`, `.border-info`
**Status text:** `.text-success`, `.text-error`, `.text-warning`, `.text-info`
**Placeholder:** `.placeholder-primary`, `.placeholder-secondary`, `.placeholder-tertiary`, `.placeholder-muted`

**Interactive components:**
- `.interactive-primary` — primary action button (replaces `bg-blue-600 text-white hover:bg-blue-700`)
- `.interactive-destructive` — destructive action button (replaces `bg-red-600 text-white hover:bg-red-700`)
- `.text-destructive` — text-only destructive link/button (replaces `text-red-500 hover:text-red-700`)
- `.btn-active` — toolbar active / selected badge (replaces `bg-blue-100 text-blue-700`)
- `.spinner-border` — loading spinner border color (replaces `border-blue-600`)
- `.text-interactive` — interactive accent text (replaces `text-blue-500`)
- `.bg-interactive` — interactive accent background (replaces `bg-blue-600` on dots/indicators)

---

### Typography (Font Stack Declaration)

No font files are loaded. The font stacks are declared inline in `body` in both `src/index.css` and `website/css/style.css`:

- **UI text:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Monospace:** `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

---

### Implementation Rules

1. **Logo gold (`#F5C94D`) is website-only.** Do not introduce it into app UI elements. If a brand highlight is ever needed inside the app, open a design discussion first.

2. **Blue is the one interactive color in the app.** All primary buttons, focus rings, active calendar days, checkboxes, and range inputs use the blue family (`blue-500` / `blue-600` / `blue-400`). Do not introduce a second interactive color without updating this document.

3. **Always use CSS variables for new app UI.** Hard-coded hex values in component files bypass the theme system and break dark mode. Use the tokens above or add a new token to `src/index.css` if none fits.

4. **Dark mode uses `.dark` class, not `prefers-color-scheme`.** The toggle is class-based (`darkMode: 'class'` in `uno.config.ts`) so the user's explicit preference in the app overrides the OS setting. Do not add `@media (prefers-color-scheme: dark)` overrides.

5. **Status colors are semantic, not decorative.** Success = green, Error = red, Warning = amber, Info = blue. Do not repurpose status colors for non-status UI (e.g., do not use the error red to highlight a selected date).

6. **The website is always dark.** Do not add a light mode toggle to `website/`. Its palette is independent of the app's theme system.

7. **Amber is reserved for the editor highlight mark.** Outside the editor, amber/yellow shades appear only in status warnings. Introducing amber into general UI will create visual confusion with both the highlight mark and warning states.

8. **Focus rings use blue-500 consistently.** `focus:ring-blue-500` and `focus-visible` styles must be present on all interactive elements for keyboard accessibility. Never remove focus indicators.

---

### Checklist: Adding New UI

Use this when writing a new component or modifying an existing one.

- [ ] **Backgrounds** — use `.bg-primary`, `.bg-secondary`, `.bg-tertiary`, or `var(--bg-*)`. No raw hex.
- [ ] **Text** — use `.text-primary`, `.text-secondary`, `.text-tertiary`, `.text-muted`, or `var(--text-*)`.
- [ ] **Borders** — use `.border-primary`, `.border-secondary`, or `var(--border-*)`. Focus borders always `border-blue-500` / `var(--border-focus)`.
- [ ] **Interactive elements** — primary buttons use `.interactive-primary`; destructive buttons use `.interactive-destructive`; text-only destructive buttons/links use `.text-destructive`. Focus ring: `focus:ring-blue-500` (consistent with `--btn-primary-ring` token).
- [ ] **Dark mode** — every color that appears in the component must have a dark variant, either via CSS variables (automatic) or explicit `dark:` UnoCSS classes.
- [ ] **Status messages** — use the status tokens (`--status-{success,error,warning,info}-{bg,border,text}`) or the `.bg-*` / `.border-*` / `.text-*` utility classes. Do not invent new colors for feedback states.
- [ ] **No gold in the app** — if you are tempted to use `#F5C94D` or any amber/yellow for non-highlight, non-warning UI, stop and reconsider.
- [ ] **No `primary-*` UnoCSS classes** — use `blue-*` for the interactive color. The `primary` scale in `uno.config.ts` is unused sky-blue and will not match.
- [ ] **Overlays** — backdrop uses `style={{ 'background-color': 'var(--overlay-bg)' }}`. Panel shadow uses `style={{ 'box-shadow': 'var(--shadow-lg)' }}`.
- [ ] **New token needed?** — add it to both `:root` and `.dark` in `src/index.css`, then document it here.

---

### Theme Override Boundary

This section defines the stable token contract for future user theme overrides.

**Inside the stable token contract (overridable):**

All custom properties in `:root` / `.dark` in `src/index.css`:
`--bg-*`, `--text-*`, `--border-*`, `--interactive-*`, `--status-*`, `--btn-*`, `--editor-*`, `--spinner-color`, `--overlay-bg`, `--shadow-*`.

**Outside the contract (not supported for user overrides):**

- `src/styles/critical-auth.css` — intentionally hardcoded light-mode, pre-hydration; overriding these has no effect at runtime because the file is loaded before CSS variable resolution
- `focus:ring-blue-500` on form inputs (browser focus affordance; its value `#3b82f6` matches `--btn-primary-ring` but is applied via UnoCSS static class, not the token)
- Native checkbox `accent-color` behavior (`text-blue-600`)
- `hover:text-blue-600` on journal name paragraph (minor hover affordance)
- Static marketing website (`website/`) — independent palette, always dark

---

### Quick Reference: Key Hex Values

| Value | Name | Used in |
|-------|------|---------|
| `#F5C94D` | Brand gold | Logo, website accent |
| `#c49c2e` | Dim gold | Website hover on gold |
| `#3b82f6` | Interactive blue | App buttons, focus, borders (blue-500) |
| `#2563eb` | Interactive blue hover (light) | App primary button hover (blue-600) |
| `#60a5fa` | Interactive blue hover (dark) | App primary button hover dark (blue-400) |
| `#111827` | Gray-900 | App dark bg-secondary, light text-primary |
| `#1f2937` | Gray-800 | App dark bg-primary |
| `#374151` | Gray-700 | App dark bg-tertiary/hover |
| `#f9fafb` | Gray-50 | App light bg-secondary, dark text-primary |
| `#ffffff` | White | App light bg-primary, text-inverse |
| `#0e0e0e` | Near-black | Website page background |
| `#b45309` | Amber-700 | Editor highlight mark (light) |
| `#fbbf24` | Amber-400 | Editor highlight mark (dark) |
