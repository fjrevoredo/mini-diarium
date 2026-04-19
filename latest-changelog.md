## What's Changed

v0.4.17 adds an in-app notification center for surfacing release notes without network access, full Italian localisation, a redesigned benchmark report page with Chart.js trend charts and a new database delete benchmark, and upgrades the documentation site to a modern three-column layout with sidebar navigation and an on-page TOC.

### Added

- **In-app notification center**: Bell icon in the header surfaces bundled release notes and announcements without any network access. Notifications ship as `public/notifications.json` with each release. Unread entries show a badge counter; users can mark individual notifications read or dismiss all at once. Read state persists to `localStorage`. Entries older than 90 days are auto-dismissed. Links open in the system browser via `@tauri-apps/plugin-opener`.
- **Italian translation**: Full Italian (`it`) localisation contributed by the community (#96). Covers all UI strings and the native OS menu.
- **Custom benchmark report page**: Replaces the auto-generated `github-action-benchmark` index with a hand-crafted `benchmarks/index.html` served from gh-pages. The new page groups all 18 benchmarks into four labelled sections (Auth Security, Cryptography, Database, Word Count), gives each benchmark a human title, a what/why description, and an interpretation callout explaining what "good" and "bad" results look like. Each card shows the latest timing value and a Chart.js line trend chart over the last 30 CI runs. Supports automatic dark/light mode via `prefers-color-scheme`. The CI workflow now copies the file to gh-pages after every benchmark run.
- **`db_delete_entry` benchmark**: New criterion benchmark in `db_bench.rs` covering the hard-delete-by-id path (`DELETE FROM entries WHERE id = ?`). Uses `iter_batched` so each iteration gets a fresh database with a pre-inserted entry. This was the only common DB operation without a benchmark.

### Changed

- **Docs layout and navigation redesign**: The documentation site (`mini-diarium.com/docs/`) moves from a flat two-column layout to a modern three-column experience. The left sidebar now groups pages under labelled sections (Basics, Discovery, Your Data, Settings & More, Help) and is always visible without a `<details>` disclosure wrapper. A right-hand "On this page" TOC is generated from each page's h2/h3 headings and highlights the active heading as you scroll (Intersection Observer). On screens narrower than 900 px the sidebar collapses to a slide-in drawer toggled by a hamburger button; the TOC hides below 1 100 px. The docs hub index page is reorganised to match the same groupings, with emoji category icons and a "Jump in: Getting Started →" CTA. All SEO metadata, canonical URLs, and structured data are unchanged.
