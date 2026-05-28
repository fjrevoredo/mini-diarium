## What's Changed

This release adds custom font uploads and Hindi translation, streamlines the Preferences dialog with immediate-apply settings, polishes the About dialog, and fixes editor placeholder updates on language switches.

### Added
- **Custom font upload**: users can now upload their own `.ttf`, `.otf`, `.woff`, or `.woff2` font files from **Preferences → Advanced → Custom fonts** and use them as the editor font. Regular and Bold weights are uploaded separately; if only a Regular is provided, the browser synthesizes bold text and a warning is shown in the preferences list. Custom fonts are stored as blobs inside the journal (`diary.db`) so they travel to other devices automatically. Deleting the currently selected custom font reverts the editor to System Default immediately. Schema bumped to v8 (`custom_fonts` table).
- **Hindi (हिन्दी) translation**: the app UI is now fully translated into Hindi, covering all 456 strings across every screen — auth, editor, preferences, import/export, stats, tags, onboarding, and error messages. The native OS menu bar (Navigation, Diary, File, Help) is also translated when Hindi is selected in Preferences → General → Language.

### Changed
- **Preferences lifecycle**: the Preferences dialog is now close-only (no Save/Cancel footer). Reversible settings apply immediately across General, Writing, and Security auto-lock controls. Theme Overrides moved to **Preferences → Advanced** and now auto-apply as soon as JSON is valid; invalid JSON stays local with an inline error while the last valid saved overrides remain active. Explicit actions (password/auth operations, journal reset/move, debug dump export, and custom-font upload/delete) remain button-driven.
- **About dialog link styling**: the GitHub and Documentation links are now pill-style buttons (icon + label, rounded border) and the "Show Welcome Tour" shortcut is a ghost button with a Compass icon, replacing the bare underlined text links.

### Fixed
- **Editor placeholder updates on locale switch**: the body placeholder ("What's on your mind today?") now updates immediately and reliably when changing the language in Preferences, including when switching back to a previously used locale.
