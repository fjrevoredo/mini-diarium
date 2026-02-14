# AGENTS.md - AI Agent Development Guide

> **Purpose**: This document provides AI agents with comprehensive context about the Mini Diarium project to enable effective autonomous development.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Current Implementation Status](#current-implementation-status)
4. [Technology Stack Details](#technology-stack-details)
5. [Code Organization](#code-organization)
6. [Development Conventions](#development-conventions)
7. [Testing Strategy](#testing-strategy)
8. [Common Tasks](#common-tasks)
9. [Security Considerations](#security-considerations)
10. [Known Issues & Technical Debt](#known-issues--technical-debt)

---

## Project Overview

**What We're Building:**
Mini Diarium is a modern, encrypted, local-first desktop journaling application built as a spiritual successor to Mini Diary. The application prioritizes privacy, security, and simplicity.

**Core Principles:**
- **Privacy First**: All data encrypted locally, never sent to servers
- **Incremental Development**: Each feature must be functional and tested before moving forward
- **Clean Architecture**: Clear separation between frontend (SolidJS), backend (Rust), and data layer (SQLite)
- **Type Safety**: TypeScript strict mode + Rust's type system
- **Security**: Argon2id password hashing + AES-256-GCM encryption

**Target Platforms:**
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu 20.04+, Fedora, Arch)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│                  (SolidJS Components)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Auth   │  │ Calendar │  │  Editor  │  │  Search  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ (Reactive Signals)
┌───────────────────────▼─────────────────────────────────────┐
│                     STATE LAYER                             │
│              (SolidJS Signals & Stores)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │authState │  │  entries │  │   search │  │    ui    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ (Tauri IPC - invoke())
┌───────────────────────▼─────────────────────────────────────┐
│                  BACKEND LAYER (Rust)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Tauri Commands (IPC Handlers)               │  │
│  │  • auth.rs  • entries.rs  • search.rs               │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │               Business Logic Layer                    │  │
│  │  ┌──────────────┐         ┌──────────────┐          │  │
│  │  │   Crypto     │         │   Database   │          │  │
│  │  │ (password.rs)│         │ (queries.rs) │          │  │
│  │  │ (cipher.rs)  │         │ (schema.rs)  │          │  │
│  │  └──────────────┘         └──────────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    DATA LAYER                               │
│                  (SQLite Database)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ entries  │  │entries_  │  │ metadata │  │  schema_ │  │
│  │          │  │   fts    │  │          │  │  version │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  (encrypted)   (FTS5 index)   (password)     (version)    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Examples

**1. Creating a Diary Entry:**
```
User types in editor
    ↓
DiaryEditor.onUpdate (500ms debounce)
    ↓
saveCurrentEntry() (EditorPanel.tsx)
    ↓
invoke('save_entry', {date, title, text}) (lib/tauri.ts)
    ↓
save_entry() command (commands/entries.rs)
    ↓
encrypt(title) + encrypt(text) (crypto/cipher.rs)
    ↓
INSERT into entries (db/queries.rs)
    ↓
Trigger: UPDATE entries_fts (db/schema.rs)
    ↓
update_fts_index() with decrypted text (db/queries.rs)
    ↓
SUCCESS → setEntryDates() updates calendar dots
```

**2. Searching Entries:**
```
User types in SearchBar
    ↓
debounced search (500ms)
    ↓
invoke('search_entries', {query})
    ↓
search_entries() command (commands/search.rs)
    ↓
SELECT FROM entries_fts WHERE MATCH query
    ↓
Returns SearchResult[] with snippets
    ↓
SearchResults.tsx displays with <mark> highlights
```

---

## Current Implementation Status

### ✅ Completed (Phase 1: Tasks 1-19 + Task 20)

**Phase 1: Foundation & Core Infrastructure**
1. ✅ Tauri + SolidJS project initialization
2. ✅ Development tooling (ESLint, Prettier, UnoCSS)
3. ✅ Folder structure
4. ✅ Argon2id password hashing (m=64MB, t=3, p=4)
5. ✅ AES-256-GCM encryption
6. ✅ SQLite database schema with FTS5
7. ✅ Entry CRUD operations (encrypted)
8. ✅ Authentication Tauri commands
9. ✅ Entry Tauri commands
10. ✅ Password creation screen
11. ✅ Password prompt screen
12. ✅ Two-panel responsive layout
13. ✅ TipTap editor with Markdown
14. ✅ Title editor
15. ✅ Auto-save with debouncing (500ms)
16. ✅ Calendar widget with month navigation
17. ✅ Calendar day highlighting for entries (dots)
18. ✅ Calendar ↔ Editor integration
19. ✅ Empty entry auto-deletion

**Phase 2: Core Features (1/14)**
20. ✅ SQLite FTS5 search with SearchBar + SearchResults

### 🔄 Next Tasks (Phase 2)
21. ❌ Build search bar UI (DONE - merged with Task 20)
22. ❌ Build search results list (DONE - merged with Task 20)
23. ❌ Implement "Go To Today" button (DONE - already exists)
24. ⏳ **NEXT:** Build editor toolbar (Bold, Italic, Lists)
25. ⏳ Implement word count display
26. ⏳ Implement calendar navigation (prev/next month)
27. ⏳ Implement date navigation shortcuts (keyboard)
28. ⏳ Build "Go To Date" overlay
29. ⏳ Implement future date restriction preference
30. ⏳ Implement first day of week preference
31. ⏳ Implement hide titles preference
32. ⏳ Implement spellcheck preference
33. ⏳ Build statistics overlay

**Note:** Tasks 21-23 were completed as part of Task 20 implementation.

### ⏳ Future Phases
- **Phase 3:** Import/Export, Theming, Backups (13 tasks)
- **Phase 4:** i18n, Accessibility, Distribution (12 tasks)
- **Phase 5:** E2E Testing (2 tasks)

---

## Technology Stack Details

### Frontend Stack

**SolidJS (v1.9.11)**
- Fine-grained reactivity (signals, stores, effects)
- No Virtual DOM (direct DOM manipulation)
- Similar to React but more performant
- Key primitives:
  - `createSignal()` - reactive state
  - `createEffect()` - side effects
  - `createMemo()` - derived state
  - `<Show>`, `<For>` - control flow

**TipTap (v3.19.0)**
- Headless rich text editor
- Built on ProseMirror
- Extensions used:
  - `StarterKit` (basic formatting)
  - `Placeholder` (placeholder text)
- Markdown input/output

**UnoCSS (v66.6.0)**
- Atomic CSS engine (like Tailwind)
- Presets: `presetUno`, `presetTypography`, `presetIcons`
- Config: `uno.config.ts`
- Class syntax: `class="flex items-center gap-2"`

**Kobalte (v0.13.11)**
- Accessible UI primitives
- Not heavily used yet (planned for dialogs, dropdowns)

### Backend Stack

**Tauri 2.x**
- Desktop app framework
- Rust backend + web frontend
- IPC via `invoke()` calls
- Managed state via `app.manage()`
- Commands decorated with `#[tauri::command]`

**Rust Dependencies** (see `src-tauri/Cargo.toml`):
```toml
argon2 = "0.5"           # Password hashing
aes-gcm = "0.10"         # Encryption
zeroize = "1.8"          # Secure memory clearing
rusqlite = "0.32"        # SQLite
rand = "0.8"             # Random number generation
hex = "0.4"              # Hex encoding
chrono = "0.4"           # Date/time handling
```

### Database

**SQLite with FTS5**
- Local file: `<app_data>/diary.db`
- Tables:
  - `entries` - Encrypted diary entries
  - `entries_fts` - FTS5 full-text search index
  - `metadata` - Password hash, salt
  - `schema_version` - Migration tracking

**Encryption Strategy:**
- Title and text stored encrypted (AES-256-GCM)
- FTS index populated with decrypted text (local only)
- Triggers sync FTS on INSERT/UPDATE/DELETE
- Manual `update_fts_index()` call for decrypted content

---

## Code Organization

### Frontend File Structure

```
src/
├── App.tsx                    # Root component, auth routing
├── index.tsx                  # Entry point
│
├── components/
│   ├── auth/
│   │   ├── PasswordCreation.tsx   # First-time password setup
│   │   └── PasswordPrompt.tsx     # Unlock screen
│   ├── calendar/
│   │   └── Calendar.tsx           # Month view with entry dots
│   ├── editor/
│   │   ├── DiaryEditor.tsx        # TipTap rich text editor
│   │   └── TitleEditor.tsx        # Plain text title input
│   ├── layout/
│   │   ├── MainLayout.tsx         # Two-panel container
│   │   ├── Sidebar.tsx            # Left panel (calendar, search)
│   │   ├── EditorPanel.tsx        # Right panel (editor, auto-save)
│   │   └── Header.tsx             # Top bar with date
│   └── search/
│       ├── SearchBar.tsx          # Debounced search input
│       └── SearchResults.tsx      # Results list with snippets
│
├── state/                     # Global reactive state
│   ├── auth.ts                # AuthState, createDiary(), unlockDiary()
│   ├── entries.ts             # currentEntry, entryDates, isSaving
│   ├── search.ts              # searchQuery, searchResults
│   └── ui.ts                  # selectedDate, isSidebarCollapsed
│
├── lib/                       # Utilities
│   ├── tauri.ts               # Typed Tauri IPC wrappers
│   ├── debounce.ts            # Debounce utility (500ms)
│   └── dates.ts               # Date formatting (formatDate, getTodayString)
│
└── styles/
    ├── editor.css             # TipTap editor styles
    └── index.css              # Global styles, UnoCSS imports
```

### Backend File Structure

```
src-tauri/src/
├── main.rs                    # Tauri app entry point
├── lib.rs                     # Module exports, Tauri setup
│
├── commands/
│   ├── mod.rs                 # Module exports
│   ├── auth.rs                # Authentication commands
│   │   ├── create_diary(password)
│   │   ├── unlock_diary(password)
│   │   ├── lock_diary()
│   │   ├── diary_exists()
│   │   ├── is_diary_unlocked()
│   │   ├── change_password(old, new)
│   │   └── reset_diary()
│   ├── entries.rs             # Entry CRUD commands
│   │   ├── save_entry(date, title, text)
│   │   ├── get_entry(date)
│   │   ├── delete_entry_if_empty(date, title, text)
│   │   └── get_all_entry_dates()
│   └── search.rs              # Search command
│       └── search_entries(query)
│
├── crypto/
│   ├── mod.rs                 # Module exports
│   ├── password.rs            # Argon2id hashing
│   │   ├── hash_password(password, salt)
│   │   ├── verify_password(password, hash)
│   │   └── generate_salt()
│   └── cipher.rs              # AES-256-GCM encryption
│       ├── Key struct (auto-zeroizing)
│       ├── encrypt(key, plaintext)
│       └── decrypt(key, ciphertext)
│
└── db/
    ├── mod.rs                 # Module exports
    ├── schema.rs              # Database creation
    │   ├── create_database(path, password)
    │   ├── open_database(path, password)
    │   └── SQL schema (entries, entries_fts, triggers)
    └── queries.rs             # CRUD operations
        ├── insert_entry(db, entry)
        ├── get_entry(db, date)
        ├── update_entry(db, entry)
        ├── delete_entry(db, date)
        ├── get_all_entry_dates(db)
        └── update_fts_index(db, date, title, text)
```

---

## Development Conventions

### Frontend Conventions

**1. Component Structure**
```tsx
import { createSignal, createEffect } from 'solid-js';
import { someState } from '../../state/moduleName';

interface ComponentProps {
  prop1: string;
  prop2?: number;  // Optional props with ?
}

export default function ComponentName(props: ComponentProps) {
  // Local signals first
  const [localState, setLocalState] = createSignal<Type>(initialValue);

  // Effects for side effects
  createEffect(() => {
    // React to signal changes
  });

  // Event handlers
  const handleEvent = () => {
    // Handle user interaction
  };

  // Return JSX
  return (
    <div class="...">  {/* Note: class not className */}
      {/* JSX content */}
    </div>
  );
}
```

**2. State Management**
- Use signals for reactive state: `createSignal()`
- Export signals from `src/state/*.ts` modules
- Import and use directly in components (no provider needed)
- Naming: `[value, setValue]` - e.g., `[authState, setAuthState]`

**3. Styling**
- UnoCSS utility classes: `class="flex items-center gap-2"`
- Custom CSS in `src/styles/` for editor-specific styles
- Responsive: Use `lg:` prefix for desktop breakpoints
- Colors: `text-gray-900`, `bg-blue-600`, `border-gray-200`

**4. TypeScript**
- Strict mode enabled (`tsconfig.json`)
- Always type props interfaces
- Avoid `any` - use `unknown` or proper types
- Use `// eslint-disable-next-line` for intentional violations

**5. Reactivity Rules** (Important for SolidJS)
- Don't destructure props: `props.value` not `const { value } = props`
- Wrap async in non-tracked scope or use `untrack()`
- Event handlers: wrap props in functions: `onClick={() => props.onClose()}`

### Backend Conventions

**1. Command Structure**
```rust
#[tauri::command]
pub fn command_name(
    param1: String,
    param2: i32,
    state: State<DiaryState>,  // Managed state always last
) -> Result<ReturnType, String> {
    // 1. Get managed state
    let db_guard = state.db.lock().unwrap();
    let db_conn = db_guard.as_ref()
        .ok_or("Diary is locked. Please unlock first.")?;

    // 2. Perform operation
    let result = some_operation(db_conn, param1, param2)
        .map_err(|e| format!("Operation failed: {}", e))?;

    // 3. Return result
    Ok(result)
}
```

**2. Error Handling**
- Use `Result<T, String>` for Tauri commands (String errors sent to frontend)
- Use custom error types internally: `PasswordError`, `CipherError`
- Always `.map_err()` to convert to String for IPC boundary
- Provide descriptive error messages

**3. Security**
- Use `zeroize::Zeroize` for passwords and keys
- Encrypt all sensitive data before storing
- Use `ZeroizeOnDrop` for auto-cleanup
- Never log passwords or encryption keys

**4. Testing**
- Unit tests in `#[cfg(test)] mod tests`
- Use `tempfile` or temp directories for test databases
- Clean up test files: `drop(db_conn); fs::remove_dir_all()`
- Test error cases: wrong password, tampering, edge cases

**5. Naming Conventions**
- Functions: `snake_case`
- Types/Structs: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Modules: `snake_case` (e.g., `crypto::password`)

---

## Testing Strategy

### Current Test Coverage

**Rust Backend: 46/46 tests passing (100%)**

Breakdown by module:
- `crypto::password`: 10 tests
  - Hashing, verification, salt generation
  - Unicode, long passwords, tampering
- `crypto::cipher`: 11 tests
  - Encryption/decryption roundtrip
  - Wrong key, tampered data, empty data
  - Nonce randomness
- `db::schema`: 6 tests
  - Database creation, FTS table, metadata
  - Wrong password, version tracking
- `db::queries`: 9 tests
  - Insert, get, update, delete
  - Encryption roundtrip, nonexistent entries
  - Entry date retrieval
- `commands::auth`: 5 tests
  - Create/unlock/lock workflows
  - Password changes, reset
- `commands::entries`: 4 tests
  - Save, delete if empty, get dates
- `commands::search`: 1 test
  - SearchResult serialization

**Frontend: No tests yet**
- Planned for Phase 5 (E2E with Playwright)
- Current verification via manual testing and builds

### Running Tests

```bash
# Run all Rust tests
cd src-tauri
cargo test --lib

# Run tests with output
cargo test --lib -- --nocapture

# Run specific module tests
cargo test --lib crypto::password

# Run with coverage (requires cargo-tarpaulin)
cargo tarpaulin --lib
```

### Test Writing Guidelines

**Rust Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_descriptive_name() {
        // Arrange
        let input = "test data";

        // Act
        let result = function_to_test(input);

        // Assert
        assert_eq!(result, expected_value);
    }

    #[test]
    #[should_panic(expected = "error message")]
    fn test_error_case() {
        // Test that should panic
    }
}
```

---

## Common Tasks

### Adding a New Tauri Command

**1. Backend (Rust):**

```rust
// src-tauri/src/commands/module_name.rs

#[tauri::command]
pub fn new_command(param: String, state: State<DiaryState>) -> Result<ReturnType, String> {
    // Implementation
    Ok(result)
}

// Add to mod.rs if new module
// pub mod module_name;

// Register in lib.rs
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::module_name::new_command,
])
```

**2. Frontend (TypeScript):**

```typescript
// src/lib/tauri.ts

export interface ReturnType {
  field1: string;
  field2: number;
}

export async function newCommand(param: string): Promise<ReturnType> {
  return await invoke('new_command', { param });
}
```

**3. Usage in Component:**

```tsx
import { newCommand } from '../../lib/tauri';

const result = await newCommand('value');
```

### Adding a New State Module

**1. Create state file:**

```typescript
// src/state/feature.ts

import { createSignal } from 'solid-js';

const [featureState, setFeatureState] = createSignal<Type>(initialValue);
const [isLoading, setIsLoading] = createSignal(false);

export {
  featureState,
  setFeatureState,
  isLoading,
  setIsLoading,
};
```

**2. Use in components:**

```tsx
import { featureState, setFeatureState } from '../../state/feature';

const value = featureState();  // Read
setFeatureState(newValue);     // Write
```

### Adding a New Component

```bash
# Create component file
# src/components/category/ComponentName.tsx

# Follow the component structure pattern (see conventions)

# Import in parent component
import ComponentName from '../category/ComponentName';

# Use in JSX
<ComponentName prop1="value" prop2={123} />
```

### Adding ESLint/TypeScript Suppressions

**ESLint (when justified):**
```tsx
// Single line
// eslint-disable-next-line rule-name

// Block
/* eslint-disable rule-name */
// code
/* eslint-enable rule-name */
```

**TypeScript:**
```typescript
// @ts-expect-error: Reason for suppression
// @ts-ignore: Use sparingly, prefer @ts-expect-error
```

**When to suppress:**
- Ref variables in SolidJS (always undefined until assigned): `no-unassigned-vars`
- Server-controlled HTML (FTS snippets with `<mark>` tags): `solid/no-innerhtml`
- Intentional `any` in generic utilities: `@typescript-eslint/no-explicit-any`

---

## Security Considerations

### Critical Security Rules

**1. Password Handling**
- ✅ Always use `Argon2id` with strong parameters (m=64MB, t=3, p=4)
- ✅ Zeroize passwords immediately after hashing/verification
- ❌ Never log passwords or password hashes
- ❌ Never store passwords in plaintext

**2. Encryption**
- ✅ Use AES-256-GCM (authenticated encryption)
- ✅ Generate random nonces for each encryption
- ✅ Zeroize keys when done (use `ZeroizeOnDrop`)
- ❌ Never reuse nonces
- ❌ Never decrypt without verifying authentication tag

**3. Data Storage**
- ✅ Encrypt all sensitive data (title, text) before storing
- ✅ Use encrypted database for entries
- ✅ FTS index is local-only (acceptable to have decrypted text)
- ❌ Never send decrypted data over network

**4. Frontend Security**
- ✅ Validate all user input
- ✅ Use `innerHTML` only for trusted server-generated content
- ✅ Escape user input if rendering as HTML
- ❌ Never execute user input as code
- ❌ Never use `eval()` or `Function()` constructor

### Security Checklist for New Features

- [ ] Does this handle passwords? → Use Argon2id, zeroize after use
- [ ] Does this handle encryption? → Use AES-256-GCM, random nonces
- [ ] Does this store data? → Encrypt before storing
- [ ] Does this render user input? → Escape or sanitize
- [ ] Does this make network calls? → We shouldn't have any (local-first)
- [ ] Does this log sensitive data? → Remove logging

---

## Known Issues & Technical Debt

### Non-Critical Issues

**1. SolidJS Reactivity Warnings (5 warnings)**
- **Location:** EditorPanel.tsx (2), Header.tsx (1), Sidebar.tsx (2)
- **Issue:** Best practice hints about reactivity
- **Impact:** None - functionality works correctly
- **Resolution:** Can be addressed in future refactoring

**2. Search FTS5 Test Coverage**
- **Location:** src-tauri/src/commands/search.rs
- **Issue:** Only basic serialization test, no comprehensive FTS5 query tests
- **Reason:** External content table complexity with encrypted columns
- **Impact:** Search functionality verified working in practice
- **Resolution:** Defer comprehensive FTS tests to later phase

### Technical Debt to Address

**1. Missing Features** (per plan, not yet implemented)
- Editor toolbar (bold, italic, lists) - **NEXT PRIORITY**
- Word count display
- Statistics overlay
- Preferences system
- Import/export functionality
- Theming (light/dark mode)
- i18n (English/Spanish)
- E2E tests

**2. Code Improvements**
- Consider adding Rust integration tests (beyond unit tests)
- Add frontend component tests (Solid Testing Library)
- Extract common UI components (buttons, inputs) to `src/components/ui/`
- Add error boundaries for React-like error handling

**3. Performance Optimizations** (if needed later)
- Virtual scrolling for large search results
- Lazy loading for calendar months
- Debounce calendar re-renders
- Memoize expensive computations

---

## Development Workflow

### Starting a New Feature

1. **Read the plan:** Check IMPLEMENTATION_PLAN.md for task details
2. **Create task:** Use TaskCreate to track progress
3. **Backend first:** If feature needs backend, start with Rust
   - Write function signature
   - Write tests
   - Implement function
   - Run tests
4. **Frontend next:** Build UI components
   - Create state management
   - Build component(s)
   - Wire up to backend
5. **Test manually:** Run `bun tauri dev` and verify
6. **Update status:** Mark task as completed

### Before Committing

```bash
# Run all checks
bun run lint              # ESLint
bun run format:check      # Prettier
bun run type-check        # TypeScript
cd src-tauri && cargo test --lib  # Rust tests
cd src-tauri && cargo clippy --lib -- -D warnings  # Clippy

# Build to verify
bun run build
```

### Git Workflow

- **Branches:** Work on feature branches, merge to `master`
- **Commits:** Descriptive messages, include "Co-Authored-By: Claude Sonnet 4.5"
- **PRs:** Not required for solo development, but can be used

### Getting Help

- **Check this file** for architecture and conventions
- **Check IMPLEMENTATION_PLAN.md** for feature specifications
- **Check README.md** for setup and running instructions
- **Check code comments** for inline documentation

---

## Quick Reference

### Most Common Commands

```bash
# Development
bun tauri dev           # Run app with hot reload

# Testing
cargo test --lib        # Run Rust tests
bun run lint            # Check frontend code

# Building
bun run build           # Build frontend
bun tauri build         # Build full app

# Code Quality
cargo clippy --lib -- -D warnings  # Rust linter
bun run format          # Format all code
```

### Most Common Files to Edit

**Adding a feature usually involves:**
1. `src-tauri/src/commands/*.rs` - Backend logic
2. `src/lib/tauri.ts` - IPC wrapper
3. `src/state/*.ts` - State management
4. `src/components/**/*.tsx` - UI components

### Key Configuration Files

- `package.json` - Frontend dependencies & scripts
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/tauri.conf.json` - Tauri app config
- `tsconfig.json` - TypeScript config
- `eslint.config.js` - ESLint rules
- `uno.config.ts` - UnoCSS config

---

## Conclusion

This document should provide AI agents with all necessary context to work effectively on the Mini Diarium project. When in doubt:

1. **Follow the plan:** IMPLEMENTATION_PLAN.md is the source of truth
2. **Match the style:** Look at existing code for patterns
3. **Test thoroughly:** Write tests for new backend code
4. **Ask questions:** Use comments to explain complex logic
5. **Document changes:** Update this file if architecture changes

**Current Status:** Phase 1 complete (19/19) + Task 20 from Phase 2 complete
**Next Task:** Task 24 - Build editor toolbar (Bold, Italic, Lists)

Happy coding! 🚀
