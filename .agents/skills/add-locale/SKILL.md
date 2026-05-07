---
name: add-locale
description: |
  Add a new language/locale to Mini Diarium. Use this skill whenever the user asks to add a new locale (e.g., "add Italian", "add French locale", "add Portuguese support", "new language"). This skill handles the full workflow: creating the JSON translation file from en.ts, wiring it into the i18n framework, adding to the language dropdown, running the sync script, and validating. Do NOT use this for updating existing translations — only for adding brand new locales.
---

# Add Locale Skill

Add a new language/locale to Mini Diarium following the exact step-by-step sequence below.

## Quick Checklist

- [ ] Create `{code}.json` from `en.ts` (preserve key paths, plural forms, 3-letter month/day abbrevs)
- [ ] Wire into `src/i18n/index.ts` (import + localeMap entry)
- [ ] Add to `AVAILABLE_LOCALES` in `src/i18n/locales/index.ts` (alphabetical by English name)
- [ ] Run `bun run sync-languages`
- [ ] Validate: `bun run validate:locales`

## Step 1: Create the Locale JSON File

1. Read `src/i18n/locales/en.ts` in full — this is the canonical source of truth
2. Read an existing locale JSON (e.g., `src/i18n/locales/es.json`) for structural reference
3. Create `src/i18n/locales/{code}.json` with ALL keys translated
4. Preserve exact key paths and object nesting from en.ts
5. Keep interpolation placeholders (`{{ name }}`, `{{ count }}`) unchanged
6. For plural keys (`_one`/`_other`): use locale-appropriate singular/plural forms (e.g., French: `{{ count }} mot` / `{{ count }} mots`)
7. Month abbreviations: 3-letter format, locale-appropriate (e.g., French: jan, fév, mars, avr, mai, juin, juil, août, sept, oct, nov, déc)
8. Day abbreviations: 3-letter format (e.g., French: dim, lun, mar, mer, jeu, ven, sam)

## Step 2: Wire the Locale into `src/i18n/index.ts`

1. Add import alongside existing locale imports:
   ```typescript
   import frLocale from './locales/fr.json';
   ```
2. Add to `localeMap` object:
   ```typescript
   fr: flatten(frLocale as unknown as typeof en) as FlatEn,
   ```
Follow the exact same pattern used for `es`, `de`, and `it`.

## Step 3: Add to `AVAILABLE_LOCALES` in `src/i18n/locales/index.ts`

1. Add the new locale to the array:
   ```typescript
   { code: 'fr', name: 'French', nativeName: 'Français' }
   ```
2. Maintain alphabetical order by English name (French after German, before Italian)

## Step 4: Run `bun run sync-languages`

This updates `README.md` and `website/index.html` to include the new language. This is a mandatory step per `docs/TRANSLATIONS.md`.

## Step 5: Validate

```bash
bun run validate:locales   # Reports missing keys; should show OK for new locale
bun run type-check          # Should pass with no errors
bun run lint                # Should pass with no errors
bun run format              # Should produce no diff
```

## Key Files Reference

| File | Role |
|------|------|
| `src/i18n/locales/en.ts` | Canonical source — all 542 lines of translation keys |
| `src/i18n/locales/{code}.json` | Community locale — created from en.ts |
| `src/i18n/index.ts` | Wires JSON locale files into `localeMap` |
| `src/i18n/locales/index.ts` | `AVAILABLE_LOCALES` array — drives language dropdown |
| `src/lib/dates.ts` | `formatDate`/`formatTimestamp` — receives `preferences().language` as locale |

## Common Pitfalls

1. **Missing keys** — Always run `bun run validate:locales` after creating the JSON; missing keys are reported explicitly
2. **Wrong key paths** — JSON structure must EXACTLY mirror en.ts nesting; check deep nested objects carefully
3. **Plural forms** — Test both singular (count=1) and plural (count=2+) forms; each locale has different rules
4. **Month/day abbreviations** — Must be exactly 3 letters; not 4, not 2; check BCP 47 standards
5. **Forgotten sync step** — `sync-languages` must run after updating `AVAILABLE_LOCALES` or README/website won't update
6. **Date formatting** — `preferences().language` is the 2-letter code (e.g., `'fr'`), NOT `'fr-FR'`; `toLocaleDateString` maps it automatically

## BCP 47 / Locale Code Convention

- 2-letter code for i18n framework: `'fr'`, `'es'`, `'de'`, `'it'`
- `formatDate`/`formatTimestamp` receive this code and the browser/OS maps it to `fr-FR` automatically
- No changes needed in `dates.ts` when adding a new locale

## Add a New Locale in ~10 Minutes

1. Create `{code}.json` (6-8 min)
2. Wire in `index.ts` + add to `AVAILABLE_LOCALES` (1 min)
3. Run `bun run sync-languages` (30 sec)
4. Validate with `bun run validate:locales` (30 sec)