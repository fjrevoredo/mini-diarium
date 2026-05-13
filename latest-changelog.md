## What's Changed

Mini Diarium v0.4.22 bundles two new open-source Arabic-capable fonts (Amiri and Tajawal), replaces the folder picker with a direct `.db` file selector for opening existing journals, caps the journal picker list to 5 visible items with scrolling, and optimizes word-count calculation to sub-microsecond performance on both plain text and TipTap HTML paths.

### Added

- **Amiri and Tajawal bundled fonts**: two new open-source font families with Arabic script support are now bundled — Amiri (classic Arabic serif) and Tajawal (modern Arabic sans-serif), each with Regular and Bold weights. Both are SIL Open Font License 1.1. The editor font family dropdown now includes these alongside the existing 5 font families.

### Changed

- **Journal picker scroll limit**: the journal list in the picker is now capped at ~5 visible items with a vertical scrollbar appearing for additional journals, preventing the picker card from growing beyond the viewport. The "Your Journals" heading stays fixed above the scrollable list.
- **Open Existing Journal uses a file picker**: instead of picking a folder and requiring a `diary.db` file inside it, the "Open Existing" flow now opens a file dialog filtered to `.db` files so the user selects the database file directly. The DB filename (no longer hardcoded to `diary.db`) is stored in `JournalConfig.db_filename`, and backups are namespaced under `backups/{stem}/` so co-located journals don't share a backup pool. Updated `selectFolderTitle`, `noJournalFound`, and `chooseFolderTitle` to file-oriented text in all five locales.
- **Word-count performance optimization**: replaced the two-pass Rust `strip_html_tags` + `split_whitespace()` with a zero-allocation single-pass state machine; optimized TypeScript `countWordsFromText` and `countWordsInHtml` to use `match(/\S+/g)` instead of `split().filter()`, eliminating intermediate array allocations. Word-count now runs in sub-microsecond time for both plain text and TipTap HTML paths.
