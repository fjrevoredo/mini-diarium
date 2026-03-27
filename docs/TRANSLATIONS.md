# Translations Guide

Thank you for your interest in translating Mini Diarium! This guide explains how to add a new language or improve an existing one.

---

## How it works

All UI strings live in `src/i18n/locales/en.ts` — this is the canonical English source. Locale files are JSON objects with the same nested structure. The app ships English-only; community translations are loaded at build time.

---

## Adding a new locale

### 1. Create a JSON file

Create `src/i18n/locales/<lang>.json` where `<lang>` is a [BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag) (e.g. `de.json`, `pt-BR.json`, `zh-CN.json`).

### 2. Copy the English template

The shape of the JSON must exactly match `en.ts`. Start with this template (truncated for brevity — copy all keys from `en.ts`):

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close",
    "add": "Add",
    "remove": "Remove",
    "open": "Open",
    "browse": "Browse",
    "browseDotDotDot": "Browse...",
    "browseFolderDotDotDot": "Browse Folder..."
  },
  "layout": { ... },
  "calendar": { ... },
  "auth": { ... },
  "editor": { ... },
  "search": { ... },
  "stats": { ... },
  "prefs": { ... },
  "export": { ... },
  "import": { ... },
  "about": { ... },
  "goToDate": { ... },
  "errors": { ... }
}
```

Copy the full contents of `en.ts` (the `const en = { ... }` block, without `as const` and without TypeScript syntax) and save it as JSON with your translations as the values.

### 3. Translate values, NOT keys

Keys are always English dot-notation identifiers. Only translate the **values** (the strings in quotes on the right side of the colon). Example:

```json
{
  "common": {
    "save": "Speichern",
    "cancel": "Abbrechen"
  }
}
```

### 4. Validate your file

Run the locale validator to check for missing or extra keys:

```bash
bun run validate:locales
```

It will list any missing keys (translation incomplete) or extra keys (typo in key name).

### 5. Open a pull request

Submit a PR with your JSON file. Title it `i18n: add <Language> translation` (e.g. `i18n: add German translation`). Include in the PR description:
- Your language name and BCP 47 tag
- Whether it is a complete or partial translation
- Any context that may help reviewers

---

## Updating an existing locale

1. Check `src/i18n/locales/en.ts` for any keys your locale file is missing (or run `bun run validate:locales`).
2. Add the missing keys with translated values.
3. Submit a PR.

---

## Syntax reference

### Interpolation — `{{ variable }}`

Spaces inside the braces are **required**. Variable names must match exactly what the component passes.

```json
"about": {
  "version": "Version {{ version }}"
}
```

The component calls: `t('about.version', { version: '1.0.3' })` → `"Version 1.0.3"`

**Do not translate variable names** — only the surrounding text.

### Plurals — `_one` / `_other`

Plural pairs use explicit key suffixes. Both must be present:

```json
"editor": {
  "wordCount_one": "{{ count }} Wort",
  "wordCount_other": "{{ count }} Wörter"
}
```

The component selects the right key: `t(count === 1 ? 'editor.wordCount_one' : 'editor.wordCount_other', { count })`.

Some languages may need only `_other` (e.g., Chinese). In that case, make `_one` and `_other` identical — the component always picks one of them.

### Brand name — do not translate

`"Mini Diarium"` is a proper name and should remain **untranslated** in all locales.

### Keyboard shortcuts in button titles

Some toolbar `title` strings include keyboard shortcuts (e.g. `"Bold (Ctrl/Cmd+B)"`). Keep the shortcut notation consistent with what your keyboard-layout users expect, but do not remove the shortcut entirely — it is valuable context.

---

## Key naming conventions (for developers adding new keys)

When adding new UI strings, follow these rules so future translators can keep up:

| Situation | Key suffix |
|-----------|-----------|
| Form field label | `.label` |
| Hint / helper text below a field | `.hint` |
| Input placeholder | `.placeholder` |
| `aria-label` string | `.aria` (or just the semantic name) |
| Button text | the verb directly (e.g. `common.save`) |

Namespaces:

| Namespace | Covers |
|-----------|--------|
| `common` | Shared buttons: save, cancel, close, browse, add, remove |
| `layout` | App loading, Header aria, Sidebar aria |
| `calendar` | Month names, weekday names, nav aria-labels |
| `auth` | JournalPicker, PasswordPrompt, PasswordCreation, PasswordStrengthIndicator |
| `editor` | Toolbar titles, WordCount, EntryNavBar aria, TitleEditor placeholder |
| `search` | SearchBar placeholder, SearchResults messages |
| `stats` | StatsOverlay labels |
| `prefs` | All 5 tabs of PreferencesOverlay |
| `export` | ExportOverlay labels |
| `import` | ImportOverlay labels |
| `about` | AboutOverlay labels |
| `goToDate` | GoToDateOverlay labels |
| `errors` | User-facing error messages from `mapTauriError()` |

---

## Questions?

Open an [issue on GitHub](https://github.com/fjrevoredo/mini-diarium/issues) with the label `i18n` if you have questions or need help with a translation.
