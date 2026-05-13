---
name: add-locale
description: |
  Add a new language/locale to Mini Diarium. Use this skill whenever the user asks to add a new locale (e.g., "add Italian", "add French locale", "add Portuguese support", "new language"). Handles the full workflow: JSON file creation, i18n wiring, language dropdown, sync script, and validation. For updating existing translations only — not for new locales.
---

# Add Locale

## Workflow (in order)

1. **Create** `src/i18n/locales/{code}.json` from `en.ts`
2. **Wire** into `src/i18n/index.ts` (import + localeMap entry)
3. **Add** to `AVAILABLE_LOCALES` in `src/i18n/locales/index.ts`
4. **Run** `bun run sync-languages`
5. **Validate** `bun run validate:locales`

## Step 1: Create the locale JSON

- Read `src/i18n/locales/en.ts` — canonical source of truth
- Read `src/i18n/locales/es.json` as structural reference
- Create `{code}.json` with **all 387 keys** translated
- Preserve exact key paths and nesting from en.ts
- Keep `{{ name }}`, `{{ count }}` placeholders unchanged
- Plural keys (`_one`/`_other`): locale-appropriate forms (e.g., French: `{{ count }} mot` / `{{ count }} mots`)
- Month abbrevs: 3-letter, locale-appropriate (French: jan, fév, mars, avr, mai, juin, juil, août, sept, oct, nov, déc)
- Day abbrevs: 3-letter (French: dim, lun, mar, mer, jeu, ven, sam)

## Step 2: Wire into `src/i18n/index.ts`

```typescript
import frLocale from './locales/fr.json';
// Add to localeMap:
fr: flatten(frLocale as unknown as typeof en) as FlatEn,
```
Follow the exact same pattern used for `es`, `de`, and `it`.

## Step 3: Add to `AVAILABLE_LOCALES` in `src/i18n/locales/index.ts`

```typescript
{ code: 'fr', name: 'French', nativeName: 'Français' }
```
Maintain alphabetical order by English name.

## Step 4: Run sync-languages

```bash
bun run sync-languages
```
Updates `README.md` and `website/index.html`. Mandatory per `docs/TRANSLATIONS.md`.

## Step 5: Validate

```bash
bun run validate:locales   # Must show OK for new locale
bun run type-check         # Must pass
bun run lint               # Must pass
bun run format             # No diff
```

## Critical Pitfalls (most common failures)

1. **Missing keys** — always run `validate:locales`; missing keys are reported explicitly
2. **Wrong key paths** — JSON structure must exactly mirror en.ts nesting
3. **Plural forms wrong** — test singular (count=1) and plural (count=2+) separately
4. **Month/day not 3 letters** — must be exactly 3; check BCP 47 standards
5. **Forgotten sync** — `sync-languages` required after updating `AVAILABLE_LOCALES`
6. **Date formatting** — `preferences().language` is the 2-letter code (e.g., `'fr'`), NOT `'fr-FR'`; browser maps automatically