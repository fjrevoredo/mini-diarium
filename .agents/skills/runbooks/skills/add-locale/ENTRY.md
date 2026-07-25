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
5. **Add Linux spellcheck dictionary support** in `src-tauri/src/spellcheck.rs` and `flatpak/io.github.fjrevoredo.mini-diarium.yml`
6. **Run** `bun run sync-languages`
7. **Validate** `bun run validate:locales`

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

Add a new `"{code}" =>` arm to `labels_for_locale()` **before** the `_ =>` fallback.
Without this step the native OS menu bar silently falls back to English — there is no compile error.

The native menu is only Preferences + Quit since TODO-0065 (everything else moved into the
WebView), so this is now just two strings — and only one of them on macOS:

```rust
"hi" => MenuLabels {
    preferences: "प्राथमिकताएं...",
    #[cfg(not(target_os = "macos"))]
    file_menu: "फ़ाइल",
},
```

The locale code must match exactly what appears in `AVAILABLE_LOCALES` and `localeMap`.

## Step 5: Add Linux spellcheck dictionary support

Every shipped UI locale must resolve to a dictionary that is bundled in the Flatpak.
Without this step, the locale works in the UI but spellcheck silently finds no dictionary on Linux.

1. Add the language's default region to `DEFAULT_REGIONS` in `src-tauri/src/spellcheck.rs`.
   Use the dictionary locale that should apply when the UI code has no region. Locale codes are
   [BCP 47 tags](https://www.rfc-editor.org/rfc/rfc5646), so they may be a bare language (`fr`)
   or include a region (`pt-BR`); the resolver normalizes either form to `language_REGION`.
2. In `flatpak/io.github.fjrevoredo.mini-diarium.yml`, add matching `.aff` and `.dic` install
   commands under `hunspell-dicts`, using the normalized filename that Enchant looks up in
   `/app/share/hunspell/`. Add the upstream licence/readme files for that dictionary as well.
3. Update the module comment's shipped-language count and the user-facing Linux spellcheck list
   in `website/docs-src/07-preferences.md`.
4. Compare all `AVAILABLE_LOCALES` entries with `DEFAULT_REGIONS` and the Flatpak install pairs.
   Every shipped locale must have one resolved dictionary locale and one `.aff`/`.dic` pair.

`src-tauri/CLAUDE.md` Gotcha #9 is the canonical explanation of the WebKitGTK and dictionary
contract. Do not add a spellcheck dictionary for an unshipped locale unless the product decision
also adds that UI locale.

## Step 6: Run sync-languages

```bash
bun run sync-languages
```
Updates `README.md` and `website/index.html`. Mandatory per `docs/TRANSLATIONS.md`.

If no output is shown (known issue with `cmd.exe /c bun run ...` in this environment), run directly:
```bash
npx tsx scripts/sync-languages.ts
```

## Step 7: Validate

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
6. **Locale-code shape** — `preferences().language` is a BCP 47 tag, not necessarily a two-letter language code: `'fr'` and `'pt-BR'` are both valid. Keep the exact code aligned across `AVAILABLE_LOCALES`, `localeMap`, native-menu labels, and the spellcheck resolver.
7. **Missing Rust menu arm** — the most commonly forgotten step. `labels_for_locale()` in `src-tauri/src/commands/menu.rs` silently falls back to English if no arm is added for the new locale; there is no compile error or runtime warning.
8. **Silent script output** — `bun run validate:locales` and `bun run sync-languages` may produce no visible output when run via `cmd.exe /c` in this WSL-over-Windows environment. Run `npx tsx scripts/validate-locales.ts` and `npx tsx scripts/sync-languages.ts` directly to confirm they executed and see their output.
9. **ASCII double-quotes inside JSON string values** — JSON string delimiters are `"` (U+0022). If a translation value contains a `"` (U+0022) character, it will silently terminate the string and corrupt the JSON. When a language conventionally quotes terms with `„…"` or `"…"`, verify the inner characters are Unicode typographic quotes (U+201C `"`, U+201D `"`, U+201E `„`), not ASCII U+0022. Safest approach: avoid quoting UI terms in translation strings entirely (e.g., `gehen Sie zum Tab Erweitert` instead of `gehen Sie zum Tab „Erweitert"`). If the Edit tool produces JSON parse errors on a line you just wrote, use PowerShell to inspect the raw bytes: `sed -n 'Np' file.json | xxd | head` — ASCII `22` hex is the problem character.
