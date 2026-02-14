# Mini Diarium

> A modern, encrypted, local-first desktop journaling application

Mini Diarium is a spiritual successor to the original Mini Diary, reimagined with modern technologies while maintaining privacy and simplicity as core principles.

## Features (Current Implementation)

✅ **Phase 1 Complete: Foundation & Core Infrastructure**
- 🔐 **Encrypted Storage**: AES-256-GCM encryption with Argon2id password hashing (m=64MB, t=3, p=4)
- 📝 **Rich Text Editor**: TipTap-based Markdown editor with auto-save (500ms debounce)
- 📅 **Calendar Widget**: Month navigation with visual indicators for entries
- 🔍 **Full-Text Search**: SQLite FTS5 with highlighted snippets
- 💾 **Auto-Save**: Debounced saving with empty entry auto-deletion
- 🎨 **Responsive UI**: Two-panel layout that adapts to mobile screens

**In Progress: Phase 2 - Core Features** (1/14 tasks complete)

## Technology Stack

**Frontend:**
- [SolidJS](https://www.solidjs.com/) - Reactive UI framework
- [TipTap](https://tiptap.dev/) - Rich text editor
- [UnoCSS](https://unocss.dev/) - Atomic CSS engine
- [Kobalte](https://kobalte.dev/) - Accessible UI components
- TypeScript (strict mode)

**Backend:**
- [Tauri 2.x](https://v2.tauri.app/) - Desktop app framework
- Rust - Backend logic
- SQLite - Local database with FTS5
- Argon2id - Password hashing
- AES-256-GCM - Data encryption

## Prerequisites

Before running Mini Diarium, ensure you have the following installed:

### Required
- **Bun** (v1.1+) - JavaScript runtime and package manager
  - Install: https://bun.sh/
- **Rust** (v1.75+) - Programming language
  - Install: https://rustup.rs/
- **System dependencies** - Per Tauri's prerequisites:
  - Windows: WebView2 (usually pre-installed on Windows 11)
  - macOS: Xcode Command Line Tools
  - Linux: See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Recommended
- **Visual Studio Code** with extensions:
  - rust-analyzer
  - Prettier
  - ESLint
  - Solid.js (solid-language-tools)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mini-diarium
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
bun install
```

Rust dependencies are managed by Cargo and will be installed automatically.

### 3. Run in Development Mode

```bash
# Run the app in development mode (hot reload enabled)
bun tauri dev
```

This will:
1. Start the Vite development server (frontend)
2. Build and launch the Tauri app (backend + window)
3. Open the application window

On first run, you'll be prompted to create a password for your encrypted diary.

### 4. Build for Production

```bash
# Build the frontend
bun run build

# Build the Tauri app (creates installers)
bun tauri build
```

Build artifacts will be in `src-tauri/target/release/`.

## Development Commands

### Frontend

```bash
# Start Vite dev server only
bun run dev

# Build frontend for production
bun run build

# Run ESLint
bun run lint

# Fix ESLint issues automatically
bun run lint:fix

# Format code with Prettier
bun run format

# Check formatting
bun run format:check

# Type-check TypeScript
bun run type-check
```

### Backend (Rust)

```bash
cd src-tauri

# Run Rust tests
cargo test --lib

# Run Clippy (linter)
cargo clippy --lib -- -D warnings

# Format Rust code
cargo fmt

# Build backend only
cargo build --lib
```

### Full Stack

```bash
# Run app in development mode
bun tauri dev

# Build production app
bun tauri build
```

## Project Structure

```
mini-diarium/
├── src/                      # Frontend (SolidJS + TypeScript)
│   ├── components/
│   │   ├── auth/            # Password creation/prompt
│   │   ├── calendar/        # Calendar widget
│   │   ├── editor/          # TipTap rich text editor
│   │   ├── layout/          # Layout components
│   │   └── search/          # Search bar and results
│   ├── state/               # Global state management (signals)
│   ├── lib/                 # Utilities (Tauri IPC, dates, debounce)
│   └── styles/              # Global styles and editor CSS
├── src-tauri/                # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── commands/        # Tauri IPC commands
│   │   │   ├── auth.rs      # Authentication (create/unlock/lock)
│   │   │   ├── entries.rs   # Entry CRUD operations
│   │   │   └── search.rs    # FTS5 search
│   │   ├── crypto/          # Encryption & password hashing
│   │   │   ├── password.rs  # Argon2id hashing
│   │   │   └── cipher.rs    # AES-256-GCM encryption
│   │   └── db/              # Database layer
│   │       ├── schema.rs    # SQLite schema + FTS5
│   │       └── queries.rs   # Encrypted CRUD operations
│   └── Cargo.toml           # Rust dependencies
├── dist/                     # Built frontend (generated)
└── package.json             # Node.js dependencies
```

## How It Works

### First Launch
1. App checks if a diary database exists
2. If not, prompts for password creation
3. Creates encrypted SQLite database with master password

### Daily Use
1. Unlock diary with password
2. Select a date from the calendar
3. Write your entry (auto-saves every 500ms)
4. Search past entries with full-text search

### Security
- **Encryption**: All diary entries are encrypted at rest using AES-256-GCM
- **Password**: Master password is hashed with Argon2id (64MB memory, 3 iterations, 4 parallelism)
- **Local-First**: All data stored locally, never sent to servers
- **Zero-Knowledge**: Application cannot access entries without the correct password

## Testing

**Backend Tests:**
```bash
cd src-tauri
cargo test --lib
```

Currently: **46/46 tests passing** (100% pass rate)

Coverage:
- Password hashing: 10 tests
- Encryption: 11 tests
- Database: 15 tests
- Commands: 10 tests

**Frontend Tests:**
Not yet implemented (planned for Phase 5: E2E Testing)

## Database

**Location:**
- Windows: `%APPDATA%\com.minidiarium.app\diary.db`
- macOS: `~/Library/Application Support/com.minidiarium.app/diary.db`
- Linux: `~/.local/share/com.minidiarium.app/diary.db`

**Schema:**
- `entries` - Encrypted diary entries (title, text, metadata)
- `entries_fts` - Full-text search index (FTS5)
- `metadata` - Password hash and encryption metadata
- `schema_version` - Database version tracking

## Troubleshooting

### "Diary is locked" error
You need to unlock the diary first. The app should show a password prompt - enter your master password.

### Search not finding entries
Search uses SQLite FTS5 which requires exact word matches or prefix matching (e.g., "rust*" to find "rustacean"). Try simpler search terms.

### Auto-save not working
Auto-save triggers 500ms after you stop typing. Also saves on blur and window close. Check browser console for errors.

### Build fails on Windows
Ensure you have:
- WebView2 runtime installed
- Windows SDK (comes with Visual Studio Build Tools)
- Rust toolchain with MSVC target

## Development Status

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the complete roadmap.

**Current Progress:** Phase 1 complete (19/19 tasks) + Task 20 from Phase 2

**Next Steps:**
- Task 21: Build search bar UI ✅ (Complete)
- Task 22: Build search results list ✅ (Complete)
- Task 23: Implement "Go To Today" button ✅ (Complete)
- Task 24: Build editor toolbar (Bold, Italic, Lists)
- Task 25: Implement word count display
- ... and more (see plan)

## Contributing

This project follows incremental development with each feature being functional and tested before proceeding. See [AGENTS.md](./AGENTS.md) for detailed development guidelines and project architecture.

## License

MIT License - See [LICENSE](./LICENSE) for details

## Acknowledgments

Inspired by [Mini Diary](https://github.com/samuelmeuli/mini-diary) by Samuel Meuli.
