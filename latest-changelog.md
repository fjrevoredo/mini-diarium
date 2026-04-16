## What's Changed

v0.4.16 ships a structured documentation hub at `mini-diarium.com/docs/` with 11 per-section pages, an in-app Documentation button in the About dialog, and restores the CI diagram staleness check using a reproducible source-hash approach instead of fragile SVG byte comparison.

### Added

- **Website documentation section**: User guide is now published as a structured, per-section documentation area at `mini-diarium.com/docs/`. Each of the 11 feature sections has its own page with sidebar navigation, breadcrumbs, prev/next links, and section-level SEO. Built from Markdown sources in `website/docs-src/` via a new `generate-website-docs.mjs` script integrated into the `website:build-static` pipeline.
- **In-app docs link**: About dialog now includes a "Documentation" button linking to `mini-diarium.com/docs/`.

### Changed

- **CI diagram staleness check restored**: `scripts/verify-diagrams.mjs` was previously reverted to an existence-only check because `mmdc` (Puppeteer/Chrome) produces slightly different SVG bytes on different OSes even with the same tool version, making byte comparison impossible across platforms. The script now uses a source-hash approach: `bun run diagrams` writes `docs/diagrams/.source-hashes.json` with SHA-256 hashes of every `.mmd` and `.d2` source file after rendering; `diagrams:check` recomputes those hashes at CI time and fails if any source has changed since the last render — no SVG byte comparison needed, no re-rendering in CI. Supporting changes: `@mermaid-js/mermaid-cli` pinned to an exact version in `devDependencies` (caret removed); `.gitattributes` added to force LF on `docs/diagrams/*.svg`.
