# Contributing to Mini Diarium

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Rust** (see `rust-toolchain.toml`, with `clippy` and `rustfmt`)
- **Bun** 1.x
- **Tauri v2 system dependencies** (see [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/) for your platform)
  - **Linux (Ubuntu/Debian)**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **Linux (Fedora)**: `webkit2gtk4.1-devel`, `javascriptcoregtk4.1-devel`, `gtk3-devel`, `libsoup3-devel`, `atk-devel`, `cairo-devel`, `gdk-pixbuf2-devel`, `glib2-devel`, `pango-devel`, `libappindicator-gtk3-devel`, `librsvg2-devel`, `patchelf`, `fuse`, `fuse-libs`
    - If `webkit2gtk4.1-devel` is not found, try `webkit2gtk6.1-devel` and `javascriptcoregtk6.1-devel` instead (newer Fedora releases)
    - If `libsoup3-devel` is not found, try `libsoup-devel`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft Visual Studio C++ Build Tools, WebView2

#### Wayland (Linux)

On Wayland-based Linux desktops (default on Fedora, newer Ubuntu), WebKit2GTK may crash with errors like:

```
Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display.
Failed to create GBM buffer of size 800x753: Invalid argument
```

Fix: run `tauri dev` with X11 backend and software compositing:

```bash
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 bun run tauri dev
```

To persist this, export the variables in your shell profile (e.g. `~/.bashrc` or `~/.zshrc`):

```bash
export GDK_BACKEND=x11
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export LIBGL_ALWAYS_SOFTWARE=1
```

## Getting Started

```bash
git clone https://github.com/fjrevoredo/mini-diarium.git
cd mini-diarium
bun install
bun run tauri dev
```

## Development Workflow

Mini Diarium follows **trunk-based development**: all changes target `master` and feature branches should be short-lived (one to two days). Long-lived branches are a smell.

1. Fork the repository and create a short-lived feature branch from `master`
2. Make your changes
3. Run the full check suite (see below)
4. Open a pull request against `master`

### Incomplete features

If your feature is not ready to ship but you want to land it on `master`, gate it behind a compile-time flag before opening the PR:

- **Backend (Rust):** Add `#[cfg(feature = "experimental")]` to the command function and its `generate_handler![]` entry. Gate consumer-only imports (`use tauri::State`, `use crate::commands::auth::DiaryState`) the same way so they don't produce unused-import warnings in the default build.
- **Frontend (Vite/SolidJS):** Wrap the component render site in `<Show when={import.meta.env.VITE_EXPERIMENTAL}>`.

The `experimental` Cargo feature (`--features experimental`) and `VITE_EXPERIMENTAL=true` Vite define are the standard gates. Production builds never set either. See `docs/decisions/2026-06-feature-flags.md` for the full strategy. (Search was the first feature to graduate from this gate to production — its history is visible in `git log` for `src-tauri/src/commands/search.rs`.)

## Check Suite

A Git pre-commit hook auto-installs on `bun install` (via the `postinstall` lifecycle) and runs Prettier on staged `src/**/*.{ts,tsx,css}` files plus `cargo fmt` on staged `src-tauri/**/*.rs` files before every commit. This keeps the commit cycle fast (<2s typical) and prevents style violations from reaching the repo. Bypass with `git commit --no-verify` when needed.

For everything beyond formatting, run the pre-commit script before pushing:

```bash
# Recommended: Full check suite (runs all tests)
bun run pre-commit

# Or for quick feedback during development
bun run check        # Fast (no tests, ~5-10 seconds)
```

These scripts check:

- ✓ TypeScript type checking
- ✓ ESLint (no errors)
- ✓ Prettier formatting
- ✓ Frontend tests (Vitest)
- ✓ Backend tests (Rust)
- ✓ Rust Clippy (warnings as errors)
- ✓ Rust formatting

**Quick fixes** if checks fail:

```bash
bun run lint:fix     # Auto-fix ESLint errors
bun run format       # Auto-fix formatting
```

**Manual check commands** (if you prefer running individually):

```bash
# Frontend
bun run lint          # ESLint
bun run format:check  # Prettier
bun run type-check    # TypeScript strict mode
bun run test:run      # Vitest

# Backend
cd src-tauri
cargo test            # Rust unit tests
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

See `scripts/README.md` for details on the pre-commit scripts.

## Project Structure

The app has two layers:

- **Frontend** (`src/`): SolidJS with TipTap editor, UnoCSS styling, and reactive state management via signals
- **Backend** (`src-tauri/src/`): Rust with SQLite (encrypted entries), AES-256-GCM crypto, Argon2id password hashing

See `CLAUDE.md` for the full architecture diagram, file map, and command registry.

## Conventions

- **SolidJS**: Never destructure props. Use `<Show>` and `<For>` for control flow. Wrap test renders in arrow functions: `render(() => <Component />)`.
- **Rust commands**: Return `Result<T, String>`. Register new commands in both `commands/mod.rs` and `lib.rs`.
- **Dates**: Always `YYYY-MM-DD` strings. Append `T00:00:00` when constructing `Date` objects to avoid timezone shifts.
- **Naming**: Rust uses `snake_case`, TypeScript uses `camelCase`, components use `PascalCase`.

## Security

This is a privacy-focused app. When contributing, please:

- Never log, print, or serialize passwords or encryption keys
- Never store plaintext diary content in any unencrypted form on disk
- Never add network requests of any kind (no analytics, telemetry, or update checks)
- Entry operations write only to the encrypted `entries` table; there is no FTS index (it was removed in schema v4 because it stored plaintext)

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
