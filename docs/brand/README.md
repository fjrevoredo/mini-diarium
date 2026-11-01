# Fenmark brand masters

Source files for the Fenmark logo, wordmark and lockups. Every shipped brand asset (platform icons,
website favicons, nav lockup, OG card) is derived from these files and from the logo master
`public/logo-transparent.svg`. The rules for using them are in
[`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

## Files

| File | What it is | Use it on |
| --- | --- | --- |
| `../../public/logo-transparent.svg` | Logo master: the book with the ribbon, 1024×1024, transparent | Source of every icon (`tauri icon`), in-app logo, website logo |
| `fenmark-wordmark-dark.svg` | "Fenmark" wordmark, fill `#0e0e0e` | Light backgrounds |
| `fenmark-wordmark-light.svg` | "Fenmark" wordmark, fill `#f0ede6` | Dark backgrounds |
| `fenmark-lockup-dark.svg` | Logo + dark wordmark, horizontal | Light backgrounds |
| `fenmark-lockup-light.svg` | Logo + light wordmark, horizontal | Dark backgrounds (website nav, OG card) |

The logo keeps its own two colours (black `#000000`, gold `#F5C94D`) in both lockup variants. Only
the wordmark colour changes.

## Logo construction

- Canvas 1024×1024, 64-unit module. Book body x 128–896, y 96–928.
- Cover: black rounded rectangle, corner radius 80. Cover border 40.
- Spine: gold strip 80 wide (x 168–248), then a black spine line 40 wide.
- Pages: gold, x 288–856; inner corner radius 40.
- Ribbon (the "mark" in Fen**mark**): black, x 680–792, hangs from the top cover edge to y 544,
  with a V-notch 56 deep.
- Only `<rect>` and `<path>`, integer coordinates, no transforms, no text, exactly two fills.

## Wordmark

- Font: **Plus Jakarta Sans**, weight 650 (variable font, version 2.071), by the Plus Jakarta Sans
  Project Authors. Licence: [SIL Open Font License 1.1](https://openfontlicense.org/). The OFL
  allows outlined glyphs in a logo.
- The word is outlined to SVG paths with the font's own kerning. No font file is in this repo, and
  no brand SVG references a font, so the wordmark looks the same on every OS and needs no network.
- Never retype the wordmark in a live font. To change it, outline it again from the font.

## Lockup construction

- Book height = 1.5 × wordmark cap height.
- Gap between book and wordmark = 0.5 × book height.
- The wordmark is centred on the book's vertical middle.

## Clear space and minimum sizes

- Clear space on every side: 2 × spine width (160 units on the 1024 grid, about one fifth of the
  book's width).
- Icon: 16 px minimum. Lockup: 96 px wide minimum.

## Do not

- Recolour the logo, or use the gold for the wordmark.
- Stretch, rotate, or crop the logo or the lockup.
- Add shadows, outlines, gradients or other effects.
- Retype the wordmark in a live font.
- Add marsh, reed, water or medieval imagery (see `docs/DESIGN_SYSTEM.md`, Brand imagery).
