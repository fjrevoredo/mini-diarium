# Changelog

All notable changes to Mini Diarium are documented here. This project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-02-16

### Added

- Password-based diary creation and unlock with Argon2id hashing
- AES-256-GCM encryption for all diary entries at rest
- Rich text editor powered by TipTap (bold, italic, lists, headings, blockquotes, code blocks, links)
- Entry titles with optional hide-titles preference
- Auto-save with debounced writes and automatic deletion of empty entries
- Calendar sidebar with entry indicators and month navigation
- Full-text search via SQLite FTS5 with snippet highlighting
- Keyboard shortcuts and application menu for navigation (previous/next day, previous/next month, go to today, go to date)
- Import from Mini Diary JSON and Day One JSON formats with merge conflict resolution
- Export to JSON and Markdown formats
- Statistics overlay (total entries, total words, average words, longest/current streaks, entries per weekday)
- Preferences (theme selection, first day of week, allow future entries, hide titles, spellcheck toggle, password change, diary reset)
- Go to Date overlay with date picker
- Light and dark theme support
- Automatic database backups with rotation
- Live word count display
- Cross-platform support (Windows, macOS, Linux)
- CI/CD pipeline with lint, test, and build jobs across all three platforms
