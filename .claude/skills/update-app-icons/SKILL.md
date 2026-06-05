---
name: update-app-icons
description: |
  Update the Mini Diarium app logo and regenerate all platform icon sizes. Use this skill
  when the user wants to change the app icon, replace public/logo-transparent.svg, or
  regenerate Tauri icon variants after an SVG change.
---

The source logo lives at `public/logo-transparent.svg` (1024×1024, dark background).

## Touch Points

**1. Frontend auth screens** reference the SVG directly at `/logo-transparent.svg`:
- `src/components/auth/PasswordPrompt.tsx`
- `src/components/auth/PasswordCreation.tsx`

Replacing the file takes effect on the next build — no further action needed for these.

**2. Tauri platform icons** (ICO, ICNS, PNG at all sizes, Windows AppX, iOS, Android) live
in `src-tauri/icons/` and must be regenerated explicitly:

```bash
cmd.exe /c bun run tauri icon public/logo-transparent.svg
```

This overwrites every icon variant in `src-tauri/icons/` in one command.

## Steps

1. Replace `public/logo-transparent.svg` with the new SVG (must be 1024×1024, SVG format).
2. Run the regeneration command above.
3. Commit `public/logo-transparent.svg` and `src-tauri/icons/` together in the same commit.

## Gotcha

Never commit only the SVG without regenerating `src-tauri/icons/`. The platform icons are not
derived at build time — they must be explicitly regenerated and committed.
