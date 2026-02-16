# Contributing to Mini Diarium

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Rust** 1.75 or later (with `clippy` and `rustfmt`)
- **Bun** 1.x
- **Tauri v2 system dependencies** (see [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/) for your platform)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft Visual Studio C++ Build Tools, WebView2

## Getting Started

```bash
git clone https://github.com/fjrevoredo/mini-diarium.git
cd mini-diarium
bun install
bun run tauri dev
```

## Development Workflow

1. Fork the repository and create a feature branch from `master`
2. Make your changes
3. Run the full check suite (see below)
4. Open a pull request against `master`

## Check Suite

Before committing, run the pre-commit script to verify everything passes:

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
- ✓ Frontend tests (23 tests)
- ✓ Backend tests (160 Rust tests)
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
- Never store plaintext diary content outside the FTS index
- Never add network requests of any kind (no analytics, telemetry, or update checks)
- Ensure any new entry operations update both the encrypted `entries` table and the `entries_fts` index

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
