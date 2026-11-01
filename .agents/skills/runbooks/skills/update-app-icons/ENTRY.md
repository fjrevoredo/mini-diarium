---
name: update-app-icons
description: |
  Update the Fenmark app logo and regenerate every derived icon and brand asset. Use this skill
  when the user wants to change the app icon, replace public/logo-transparent.svg, or
  regenerate Tauri icons, website favicons, the OG card or the brand lockups after an SVG change.
---

The logo master is `public/logo-transparent.svg` (1024×1024, transparent background, exactly two
fills: `#000000` and `#F5C94D`). Construction rules: `docs/brand/README.md`. Usage rules:
`docs/DESIGN_SYSTEM.md` (Logo, Wordmark and Lockups).

## Touch Points

**1. In-app `<img>` uses** reference the master directly at `/logo-transparent.svg`:
- `src/components/auth/JournalPicker.tsx`
- `src/components/auth/PasswordPrompt.tsx`
- `src/components/auth/PasswordCreation.tsx`
- `src/components/overlays/AboutOverlay.tsx`
- `index.html` (the app favicon, `<link rel="icon" href="/logo-transparent.svg">`)

`README.md` also shows the master (`<img src="public/logo-transparent.svg">`). These take effect
with no further action.

**2. Tauri platform icons** (ICO, ICNS, PNG at all sizes, Windows AppX, iOS, Android) live in
`src-tauri/icons/` and must be regenerated explicitly. Run from the PowerShell tool:

```powershell
bun run tauri icon public/logo-transparent.svg
```

This overwrites every icon variant in `src-tauri/icons/` and keeps the file names.

**3. Website logo copy:** copy the master to `website/assets/logo.svg` (footer logo and the
generated pages' `<link rel="icon">`).

**4. Website favicons** (`website/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`,
`favicon-128x128.png`, `apple-touch-icon.png`):
- `favicon.ico`: copy `src-tauri/icons/icon.ico` (it embeds the 16 and 32 px sizes).
- PNG sizes: `bun run tauri icon public/logo-transparent.svg -o <scratch-dir> -p 16,32,128,180`,
  then copy the 16, 32 and 128 px files.
- `apple-touch-icon.png`: the 180 px render flattened onto an opaque `#0e0e0e` background
  (iOS fills transparency with black; make it intentional).

**5. Brand lockups** in `docs/brand/` (`fenmark-lockup-dark.svg`, `fenmark-lockup-light.svg`)
embed the logo paths. Rebuild them from the new master with the construction rules in
`docs/brand/README.md`, then copy `fenmark-lockup-light.svg` to `website/assets/fenmark-lockup.svg`
(website nav).

**6. OG card:** `website/assets/og-cover.svg` is the single source. It embeds the light lockup
paths; update them, then run `scripts/generate-website-assets.cmd`, which renders
`og-cover.png` (1200×630) with Edge headless. Edge returns before the PNG exists, so the script
polls for the file. Keep the PNG under about 80 KiB.

**7. Website build:** run `bun run website:build-static` from the PowerShell tool.

## Steps

1. Replace `public/logo-transparent.svg` (1024×1024, SVG, two fills, no `<text>`).
2. Work through touch points 2 to 7.
3. Check the result at 16 px (favicon) and in the nav; read the PNGs.
4. Commit `public/logo-transparent.svg` and `src-tauri/icons/` together in the same commit; the
   website and brand assets can go in their own commits.

## Gotcha

Never commit only the SVG without regenerating `src-tauri/icons/`. The platform icons are not
derived at build time; they must be explicitly regenerated and committed. The same is true for
the favicons, the lockups and `og-cover.png`.
