# TODO Archive

Archived completed items moved out of [TODO.md](../TODO.md). This keeps the active backlog focused on open work while preserving the original task notes.

## Completed

### Medium Priority

- [x] **Expanded rich text editor support** (2026-02-28) — extend the built-in editor with more complete rich text capabilities beyond the current formatting set; define the supported feature set, keep the UX consistent with local-first editing, and ensure stored HTML remains compatible with import/export flows
- [x] **Configurable auto-lock timeout** (2026-03-01) — add a new Preferences setting to enable auto-lock and set the idle timeout in seconds; enforce a valid range of `1` to `999` seconds and lock the diary automatically when the threshold is reached
- [x] **Hide advanced rich-text controls behind a setting** (2026-03-01) — add a preference to keep the default editor toolbar minimal and reveal the extra formatting controls (for example underline, strikethrough, blockquote, inline code, horizontal rule, and heading picker) only when the user opts in; define the default state, make sure the setting only affects toolbar visibility and not rendering of existing content, and keep import/export behavior unchanged
- [x] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
