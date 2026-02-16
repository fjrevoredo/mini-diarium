# Centralized Color System Migration Guide

## Overview

This document describes the centralized color system that automatically handles light/dark mode without needing `dark:` classes everywhere.

## The Problem

Previously, components had hardcoded colors like:
```tsx
<Dialog.Title class="text-gray-900">  {/* ❌ Not visible in dark mode */}
<p class="text-gray-700">              {/* ❌ Not visible in dark mode */}
<div class="bg-white dark:bg-gray-800"> {/* ⚠️ Requires dark: variant */}
```

This required adding `dark:` variants manually for every color, leading to:
- Inconsistent dark mode support
- Verbose class names
- Easy to miss colors when creating new components
- Maintenance nightmare

## The Solution

**CSS Custom Properties (CSS Variables)** that automatically adapt based on light/dark mode.

### How It Works

1. **CSS Variables** defined in `src/index.css`:
   - Light mode values in `:root`
   - Dark mode values in `.dark`
   - Variables automatically change when `.dark` class is toggled

2. **Semantic Color Classes** using the variables:
   - `text-primary`, `text-secondary`, `text-tertiary`
   - `bg-primary`, `bg-secondary`, `bg-tertiary`
   - `border-primary`, `border-secondary`
   - Status colors: `text-success`, `bg-error`, etc.

3. **Automatic Adaptation** - No `dark:` classes needed!

---

## Color System Reference

### Background Colors

| Class | CSS Variable | Light Mode | Dark Mode | Usage |
|-------|-------------|------------|-----------|-------|
| `bg-primary` | `--bg-primary` | `#ffffff` | `#1f2937` | Cards, dialogs, main surfaces |
| `bg-secondary` | `--bg-secondary` | `#f9fafb` | `#111827` | Page background, secondary surfaces |
| `bg-tertiary` | `--bg-tertiary` | `#f3f4f6` | `#374151` | Disabled inputs, subtle backgrounds |
| `bg-hover` | `--bg-hover` | `#f3f4f6` | `#374151` | Hover states |
| `bg-active` | `--bg-active` | `#e5e7eb` | `#4b5563` | Active/pressed states |

### Text Colors

| Class | CSS Variable | Light Mode | Dark Mode | Usage |
|-------|-------------|------------|-----------|-------|
| `text-primary` | `--text-primary` | `#111827` | `#f9fafb` | Main text, headings |
| `text-secondary` | `--text-secondary` | `#4b5563` | `#d1d5db` | Body text, labels |
| `text-tertiary` | `--text-tertiary` | `#6b7280` | `#9ca3af` | Muted text, placeholders |
| `text-muted` | `--text-muted` | `#9ca3af` | `#6b7280` | Very subtle text, hints |

### Border Colors

| Class | CSS Variable | Light Mode | Dark Mode | Usage |
|-------|-------------|------------|-----------|-------|
| `border-primary` | `--border-primary` | `#e5e7eb` | `#374151` | Default borders |
| `border-secondary` | `--border-secondary` | `#d1d5db` | `#4b5563` | Emphasized borders |
| `border-focus` | `--border-focus` | `#3b82f6` | `#3b82f6` | Focus rings |

### Status Colors

#### Success (Green)
| Class | CSS Variable | Light Mode | Dark Mode |
|-------|-------------|------------|-----------|
| `bg-success` | `--status-success-bg` | `#f0fdf4` | `#064e3b` |
| `border-success` | `--status-success-border` | `#bbf7d0` | `#065f46` |
| `text-success` | `--status-success-text` | `#166534` | `#d1fae5` |

#### Error (Red)
| Class | CSS Variable | Light Mode | Dark Mode |
|-------|-------------|------------|-----------|
| `bg-error` | `--status-error-bg` | `#fef2f2` | `#7f1d1d` |
| `border-error` | `--status-error-border` | `#fecaca` | `#991b1b` |
| `text-error` | `--status-error-text` | `#991b1b` | `#fecaca` |

#### Warning (Yellow)
| Class | CSS Variable | Light Mode | Dark Mode |
|-------|-------------|------------|-----------|
| `bg-warning` | `--status-warning-bg` | `#fffbeb` | `#78350f` |
| `border-warning` | `--status-warning-border` | `#fde68a` | `#92400e` |
| `text-warning` | `--status-warning-text` | `#92400e` | `#fde68a` |

#### Info (Blue)
| Class | CSS Variable | Light Mode | Dark Mode |
|-------|-------------|------------|-----------|
| `bg-info` | `--status-info-bg` | `#eff6ff` | `#1e3a8a` |
| `border-info` | `--status-info-border` | `#bfdbfe` | `#1e40af` |
| `text-info` | `--status-info-text` | `#1e40af` | `#bfdbfe` |

### Special Variables

| CSS Variable | Usage | Access Method |
|-------------|-------|---------------|
| `--overlay-bg` | Dialog overlays | `style={{ "background-color": "var(--overlay-bg)" }}` |
| `--shadow-sm` | Small shadows | `style={{ "box-shadow": "var(--shadow-sm)" }}` |
| `--shadow-md` | Medium shadows | `style={{ "box-shadow": "var(--shadow-md)" }}` |
| `--shadow-lg` | Large shadows | `style={{ "box-shadow": "var(--shadow-lg)" }}` |

---

## Migration Patterns

### ✅ DO: Use Semantic Color Classes

```tsx
// ✅ GOOD - Automatically adapts to dark mode
<Dialog.Title class="text-primary">Export Entries</Dialog.Title>
<p class="text-secondary">Export all diary entries</p>
<button class="text-tertiary hover:bg-hover">Close</button>
```

### ❌ DON'T: Use Hardcoded Gray Values

```tsx
// ❌ BAD - Not visible in dark mode
<Dialog.Title class="text-gray-900">Export Entries</Dialog.Title>
<p class="text-gray-700">Export all diary entries</p>
<button class="text-gray-500 hover:bg-gray-100">Close</button>
```

### ⚠️ AVOID: Using dark: Classes for Semantic Colors

```tsx
// ⚠️ UNNECESSARY - Use semantic classes instead
<Dialog.Title class="text-gray-900 dark:text-gray-100">Export Entries</Dialog.Title>

// ✅ BETTER - Semantic class handles both modes
<Dialog.Title class="text-primary">Export Entries</Dialog.Title>
```

---

## Common Migration Replacements

| Old Pattern | New Pattern | Notes |
|------------|-------------|-------|
| `text-gray-900 dark:text-gray-100` | `text-primary` | Main text |
| `text-gray-700 dark:text-gray-300` | `text-secondary` | Body text, labels |
| `text-gray-600 dark:text-gray-400` | `text-tertiary` | Muted text |
| `text-gray-500` | `text-muted` or `text-tertiary` | Depends on emphasis |
| `bg-white dark:bg-gray-800` | `bg-primary` | Cards, dialogs |
| `bg-gray-50 dark:bg-gray-900` | `bg-tertiary` | Disabled inputs |
| `bg-gray-100 dark:bg-gray-700` | `bg-tertiary` or `bg-hover` | Context-dependent |
| `border-gray-300 dark:border-gray-600` | `border-primary` | Default borders |
| `hover:bg-gray-100 dark:hover:bg-gray-700` | `hover:bg-hover` | Hover states |
| `bg-red-50 border-red-200` | `bg-error border-error` | Error messages |
| `text-red-800 dark:text-red-200` | `text-error` | Error text |
| `bg-green-50 border-green-200` | `bg-success border-success` | Success messages |
| `text-green-800 dark:text-green-200` | `text-success` | Success text |

---

## Component Migration Checklist

### For Each Component:

1. **Dialog Overlays**:
   ```tsx
   // Old
   class="fixed inset-0 z-50 bg-black/50"

   // New
   class="fixed inset-0 z-50"
   style={{ "background-color": "var(--overlay-bg)" }}
   ```

2. **Dialog Content**:
   ```tsx
   // Old
   class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg"

   // New
   class="bg-primary"
   style={{ "box-shadow": "var(--shadow-lg)" }}
   ```

3. **Headings/Titles**:
   ```tsx
   // Old
   class="text-gray-900 dark:text-gray-100"

   // New
   class="text-primary"
   ```

4. **Body Text**:
   ```tsx
   // Old
   class="text-gray-700 dark:text-gray-300"

   // New
   class="text-secondary"
   ```

5. **Muted/Helper Text**:
   ```tsx
   // Old
   class="text-gray-600 dark:text-gray-400"

   // New
   class="text-tertiary"
   ```

6. **Buttons**:
   ```tsx
   // Old
   class="text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"

   // New
   class="text-secondary hover:bg-hover"
   ```

7. **Borders**:
   ```tsx
   // Old
   class="border border-gray-300 dark:border-gray-600"

   // New
   class="border border-primary"
   ```

8. **Select/Input Elements**:
   ```tsx
   // Old
   class="bg-white border-gray-300 text-gray-900 disabled:bg-gray-100"

   // New
   class="bg-primary border-primary text-primary disabled:bg-tertiary"
   ```

9. **Status Messages**:
   ```tsx
   // Error - Old
   class="bg-red-50 border-red-200 text-red-800"

   // Error - New
   class="bg-error border-error text-error"

   // Success - Old
   class="bg-green-50 border-green-200 text-green-800"

   // Success - New
   class="bg-success border-success text-success"
   ```

---

## Files Already Migrated

- ✅ `src/index.css` - Color system defined
- ✅ `src/components/overlays/ExportOverlay.tsx` - Fully migrated
- ✅ `src/components/overlays/ImportOverlay.tsx` - Fully migrated

## Files Still Needing Migration

Run this command to find components with hardcoded colors:

```bash
grep -r "text-gray-\|bg-gray-\|border-gray-" src/components --include="*.tsx" --exclude-dir=node_modules
```

### Priority Files:
- `src/components/overlays/StatsOverlay.tsx`
- `src/components/overlays/GoToDateOverlay.tsx`
- `src/components/overlays/PreferencesOverlay.tsx`
- `src/components/calendar/Calendar.tsx`
- `src/components/editor/*`
- `src/components/search/*`
- `src/components/layout/*`

---

## Testing Dark Mode

1. Open the app
2. Toggle dark mode (check preferences or menu)
3. Navigate through all dialogs/overlays
4. Verify:
   - ✅ All text is readable
   - ✅ All backgrounds have proper contrast
   - ✅ Borders are visible
   - ✅ Hover states work correctly
   - ✅ No hardcoded light-mode-only colors

---

## Benefits of This System

1. **Automatic Dark Mode** - Colors adapt without manual intervention
2. **Consistency** - All components use the same semantic colors
3. **Maintainability** - Change colors in one place (index.css)
4. **Type Safety** - UnoCSS can validate color class names
5. **Less Code** - No need for `dark:` on every color
6. **Accessibility** - Ensures proper contrast in both modes

---

## Advanced: Accessing Variables in Inline Styles

For properties that can't be set via utility classes:

```tsx
// Box shadows
<div style={{ "box-shadow": "var(--shadow-lg)" }}>Content</div>

// Overlay backgrounds
<div style={{ "background-color": "var(--overlay-bg)" }}>Content</div>

// Custom gradients
<div style={{
  "background": "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))"
}}>
  Content
</div>
```

---

## Questions or Issues?

If you encounter a color use case not covered by the semantic system, add a new CSS variable to `src/index.css` rather than hardcoding values.
