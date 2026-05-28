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
4. **Add native menu labels** in `src-tauri/src/commands/menu.rs`
5. **Run** `bun run sync-languages`
6. **Validate** `bun run validate:locales`

## Step 1: Create the locale JSON

- Read `src/i18n/locales/en.ts` — canonical source of truth
- Read `src/i18n/locales/es.json` as structural reference
- Create `{code}.json` with **all keys** translated (run `validate:locales` to confirm the exact count — it changes with each release)
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

## Step 4: Add native menu labels in `src-tauri/src/commands/menu.rs`

Add a new `"{code}" =>` arm to `labels_for_locale()` **before** the `_ =>` fallback (line ~87).
Without this step the native OS menu bar silently falls back to English — there is no compile error.

```rust
"hi" => MenuLabels {
    navigation_menu: "नेविगेशन",
    diary_menu: "डायरी",
    navigate_prev_day: "पिछला दिन",
    navigate_next_day: "अगला दिन",
    navigate_today: "आज पर जाएं",
    go_to_date: "तारीख पर जाएं...",
    navigate_prev_month: "पिछला महीना",
    navigate_next_month: "अगला महीना",
    statistics: "आँकड़े...",
    import_item: "आयात करें...",
    export_item: "निर्यात करें...",
    preferences: "प्राथमिकताएं...",
    about: "Mini Diarium के बारे में",
    #[cfg(not(target_os = "macos"))]
    file_menu: "फ़ाइल",
    #[cfg(not(target_os = "macos"))]
    help_menu: "सहायता",
},
```

The locale code must match exactly what appears in `AVAILABLE_LOCALES` and `localeMap`.

## Step 5: Run sync-languages

```bash
bun run sync-languages
```
Updates `README.md` and `website/index.html`. Mandatory per `docs/TRANSLATIONS.md`.

If no output is shown (known issue with `cmd.exe /c bun run ...` in this environment), run directly:
```bash
npx tsx scripts/sync-languages.ts
```

## Step 6: Validate

```bash
bun run validate:locales   # Must show OK for new locale
bun run type-check         # Must pass
bun run lint               # Must pass
bun run format             # No diff
```

If `validate:locales` produces no output (known issue with `cmd.exe /c bun run ...`), run directly:
```bash
npx tsx scripts/validate-locales.ts
```
Expected output: `validate-locales: [{code}.json] OK (N keys)` where N is the current key count.

## Critical Pitfalls (most common failures)

1. **Missing keys** — always run `validate:locales`; missing keys are reported explicitly
2. **Wrong key paths** — JSON structure must exactly mirror en.ts nesting
3. **Plural forms wrong** — test singular (count=1) and plural (count=2+) separately
4. **Month/day not 3 letters** — must be exactly 3; check BCP 47 standards
5. **Forgotten sync** — `sync-languages` required after updating `AVAILABLE_LOCALES`
6. **Date formatting** — `preferences().language` is the 2-letter code (e.g., `'fr'`), NOT `'fr-FR'`; browser maps automatically
7. **Missing Rust menu arm** — the most commonly forgotten step. `labels_for_locale()` in `src-tauri/src/commands/menu.rs` silently falls back to English if no arm is added for the new locale; there is no compile error or runtime warning.
8. **Silent script output** — `bun run validate:locales` and `bun run sync-languages` may produce no visible output when run via `cmd.exe /c` in this WSL-over-Windows environment. Run `npx tsx scripts/validate-locales.ts` and `npx tsx scripts/sync-languages.ts` directly to confirm they executed and see their output.
9. **ASCII double-quotes inside JSON string values** — JSON string delimiters are `"` (U+0022). If a translation value contains a `"` (U+0022) character, it will silently terminate the string and corrupt the JSON. When a language conventionally quotes terms with `„…"` or `"…"`, verify the inner characters are Unicode typographic quotes (U+201C `"`, U+201D `"`, U+201E `„`), not ASCII U+0022. Safest approach: avoid quoting UI terms in translation strings entirely (e.g., `gehen Sie zum Tab Erweitert` instead of `gehen Sie zum Tab „Erweitert"`). If the Edit tool produces JSON parse errors on a line you just wrote, use PowerShell to inspect the raw bytes: `sed -n 'Np' file.json | xxd | head` — ASCII `22` hex is the problem character.