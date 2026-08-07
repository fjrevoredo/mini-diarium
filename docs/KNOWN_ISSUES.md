# Known Issues & Architectural Tradeoffs

This document is the canonical reference for Mini Diarium's known limitations, deliberate tradeoffs, and outstanding technical debt. It is split into two audiences:

- **[For Users](#for-users)** — things that affect day-to-day use
- **[For Developers](#for-developers)** — architectural decisions, implementation constraints, and open technical debt

Items marked **By design** are intentional decisions, not bugs. Items marked **Open** are known gaps that may be addressed in a future release.

---

## For Users

### KI-1 — No concurrent access
**Status:** By design

Only one instance of Mini Diarium may have a given journal open at a time. Opening the same `diary.db` from a second process (e.g. a second app window, or a sync tool that locks the file) will cause errors. This is a deliberate simplification: a single `Mutex<Option<DatabaseConnection>>` protects the database state, and supporting multi-writer access would require a fundamentally different architecture (WAL mode, connection pooling, distributed locking).

**Workaround:** Use the journal-switching feature to manage multiple separate journals instead of sharing a single file across sessions.

---

### KI-2 — No password recovery
**Status:** By design

If you lose all registered credentials (password forgotten and key file deleted), there is no recovery path. This is intentional — any recovery mechanism would require either storing a copy of your credentials (defeating the encryption) or a centralized escrow service (incompatible with the offline-only model).

**Mitigation:** Register a key file as a backup authentication method. Keep the key file in a different location from the diary database.

---

### KI-3 — Search is an in-memory scan (no persistent index)
**Status:** By design (security tradeoff)

Full-text search was originally a SQLite FTS5 table, removed in v0.2.0 (schema v4) because it stored entry content in plaintext, creating an unencrypted copy of diary content alongside the encrypted entries. This defeated the AES-256-GCM encryption for the purpose of local file access protection.

Search was reintroduced as an in-memory scan: each query decrypts entries (via the same decrypt path used by export/stats), matches case- and accent-folded terms, and discards everything — no plaintext is ever written to disk. The tradeoff is that the scan is O(n) over all entries per query (debounced 500 ms on the client, capped at 200 results), which is acceptable for the personal-journal scale this app targets but is not a constant-time indexed lookup.

The `// Search index hook:` comments in `db/queries/entries/{insert,update,delete}.rs` and `commands/import.rs` mark where a future encrypted index would plug in if performance ever demands it. See `src-tauri/CLAUDE.md` "Search" for the full design constraints.

---

### KI-4 — Import always creates new entries; no duplicate detection
**Status:** By design

When importing from any format (Mini Diary JSON, Day One, jrnl, etc.), the importer always creates new entries. Re-importing the same file will create duplicate entries. There is no date-conflict detection or content-deduplication logic.

**Why:** The merge logic was removed because its heuristics were unreliable and led to silent data loss when the source format's date/time semantics didn't match Mini Diarium's model. Creating duplicates is always recoverable; silent merge failures are not.

---

### KI-5 — Plugins load once at startup; changes require a restart
**Status:** By design

The Rhai plugin registry is built once during app initialization by scanning `{diary_dir}/plugins/*.rhai`. Adding, removing, or editing a plugin script takes effect only after restarting the app. This is a deliberate simplification — hot-reloading Rhai scripts would require re-compiling ASTs and invalidating cached state across threads.

---

### KI-6 — Large images significantly inflate entry size
**Status:** By design (known consequence)

Images are stored as base64-encoded data URLs embedded directly in the encrypted HTML `text` field. There is no separate media storage layer. Images are auto-resized to a maximum of 1200×1200 px before embedding, but a single photo-quality image can still add hundreds of kilobytes to an entry. Many large images per entry will slow down save and load times.

**Why:** A separate media store would require managing file references, handling broken references on diary moves/backups, and complicating the encryption model. Base64 embedding keeps the diary self-contained as a single file.

---

### KI-7 — Exported files are unencrypted plaintext
**Status:** By design

JSON and Markdown exports contain decrypted diary content in plain text. This is intentional — the purpose of export is to produce a file usable in other tools, which requires readable content. Encrypt the export file yourself if you intend to store or transmit it.

---

### KI-8 — No minimum password length enforced
**Status:** By design (user responsibility)

The app accepts any non-empty password (minimum 1 character). A visual strength indicator in the password creation UI guides your choice, but no minimum is enforced. The Argon2id key derivation (64 MB memory, 3 iterations) provides strong offline-attack resistance regardless of password length, but a 1-character password remains trivially guessable in an online or physical-access scenario.

**Our position:** Password strength is the user's responsibility. Mini Diarium's threat model is protection of a file at rest, not authentication against an active attacker. A strength minimum without server-side enforcement would be easily circumvented and creates false confidence.

---

### KI-9 — Backup files used SQLite file copy, not WAL mode
**Status:** Resolved in TODO-0098

Backups were created with `fs::copy` of the live SQLite file, so a copy taken during an active write could capture a partially-committed transaction, and a partial copy was indistinguishable from a good backup.

Snapshots are now written with `VACUUM INTO`, which makes SQLite **rebuild** a clean database from committed pages rather than copying bytes. The result is internally consistent under either journal mode, so the torn-copy concern no longer applies. The write is then fsynced, moved into place with an atomic rename, and reopened and verified before it is reported as created; on any failure the file is deleted, so a partial write can never masquerade as a backup.

WAL mode remains disabled. That is now an independent decision rather than a mitigation for this issue: `VACUUM INTO` is correct under either mode.

> The former "mitigation in practice" claim — that backups were taken at unlock time *before any writes occur* — was **incorrect** even for the old implementation, and is removed. Backups are now taken **before** the risky write (schema migrations, destructive commands), which is what that sentence wrongly implied.

---

### KI-10 — On Flatpak, folders outside the sandbox are reached through a temporary portal path
**Status:** Open (mitigated in v0.6.6)

The Flathub build runs sandboxed and has direct access only to its own data directory. When you browse to any *other* folder, the file chooser goes through the XDG document portal, which hands the app a temporary handle under `/run/user/<uid>/doc/` instead of the real path. That handle is tied to one grant: it works while the chooser's permission lasts and stops resolving afterwards. A journal whose stored location is such a handle becomes unopenable later, and creating a new database inside one fails.

This affects only journals placed outside the sandbox — the chooser opens on a real, writable location, so the common path is unaffected.

**Mitigation (v0.6.6):** **+ Create New Journal** now pre-fills a working location — your Documents folder, or the app's own data folder where Documents is not writable (as on Flathub, where the sandbox holds no filesystem permission) — and no longer requires the folder chooser at all. Each journal created there gets a folder of its own. The app also refuses a portal path as a journal location — explaining why instead of failing with a generic permissions error. The refusal covers both ways a journal gets a location: adding one, and **Preferences → Data → Change journal directory**. The move case is refused before the database file is touched, since relocating a journal into a path that later stops resolving is worse than a bad config entry.

**Workaround if you want a journal in a specific host folder:** grant Mini Diarium persistent access to it with Flatseal (or `flatpak override --user --filesystem=/path/to/folder io.github.fjrevoredo.mini-diarium`), then pick the folder. With a real filesystem permission in place the chooser returns the true path rather than a portal handle.

Resolving an existing stored portal path back to its host location is not implemented; a journal already saved that way must be re-added from its real folder.

---

### KI-11 — Opening a backup snapshot directly modifies it
**Status:** Mitigated in v0.6.6

A snapshot is an ordinary encrypted Mini Diarium database, so **+ Open Existing** used to accept one — and opening it as a journal writes to it, destroying the untouched restore point you were reaching for. This affected every platform, not just Flatpak.

**Mitigation (v0.6.6):** the app refuses to register a `backup-*.db` file, or any file inside a `backups/` folder, as a journal, and tells you to copy it elsewhere first and open the copy.

**Workaround:** copy the snapshot out of the `backups/` folder, rename it (e.g. `diary.db`), and open the copy. A non-destructive in-app restore is tracked in TODO-0098.

---

## For Developers

### AT-1 — Single database connection; no concurrent read access
**Status:** By design

`DiaryState` holds a `Mutex<Option<DatabaseConnection>>`. Every command serializes access through this mutex. This eliminates data races and simplifies state management, but means no concurrent reads — even two simultaneous read commands block each other.

**Alternative considered:** A read/write lock (`RwLock`) allowing concurrent reads with exclusive writes. Rejected because: (1) the SQLite connection itself is not thread-safe, (2) decryption is per-query and stateful, and (3) the current query volume does not justify the added complexity.

---

### AT-2 — TipTap editor stores HTML, not Markdown
**Status:** By design

The `text` field in every `DiaryEntry` is an HTML string produced by TipTap's ProseMirror serializer. It is never Markdown. This enables rich formatting (alignment, images, highlights, code blocks) but means:
- Markdown export requires an HTML→Markdown conversion step with inherent fidelity loss for complex nodes
- The HTML is encrypted as-is; no sanitization or normalization happens between save and load
- Future editor changes that alter the ProseMirror schema may produce HTML that existing entries cannot cleanly round-trip through

---

### AT-3 — Image storage as base64 in the encrypted text field
**Status:** By design

See KI-6. From the developer perspective: the `text_encrypted` BLOB in the `entries` table may contain a very large payload when images are present. There is no size cap at the database layer. The encrypt/decrypt operations on `text` scale linearly with entry size. For entries with multiple large images, this can be noticeable.

A future media storage layer would require: a separate table or file system store, reference management (integrity on diary moves/backups), and per-media encryption with its own key or the master key. This has not been designed.

---

### AT-4 — Search index does not exist; stub is intentionally preserved
**Status:** Open (security tradeoff; future implementation required)

`commands/search.rs` is a stub that always returns `[]`. The FTS5 table was dropped in schema v4 because it stored plaintext. `// Search index hook:` comments in `db/queries/entries/{insert,update,delete}.rs` and `commands/import.rs` mark the exact integration points.

Any implementation must satisfy: (1) no plaintext on disk, (2) schema migration (bump `SCHEMA_VERSION`), (3) UI placement is unspecified — the existing `SearchBar.tsx` / `SearchResults.tsx` / `state/search.ts` are preserved as interface contracts but their placement is not decided.

---

### AT-5 — Plugin registry is initialized once at startup
**Status:** By design

See KI-5. From the developer perspective: `PluginRegistry` is built in `lib.rs`'s `.setup()` closure and stored as `State<Mutex<PluginRegistry>>`. If the user changes the active journal directory, plugins from the new directory are not loaded until the next app start. This is consistent with the existing behavior but means plugin registration cannot be triggered reactively.

---

### AT-6 — Rhai export scripts must use `fn format_entries`, not `fn export`
**Status:** By design (language constraint)

`export` is a reserved keyword in the Rhai scripting language. Export plugin scripts must define `fn format_entries(entries)` instead. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally. This naming inconsistency with "export" is unavoidable without forking Rhai or aliasing the keyword.

---

### AT-7 — `rhai::AST` requires `unsafe impl Send + Sync`
**Status:** By design (library limitation)

`rhai::AST` does not implement `Send + Sync` in the current version of the Rhai crate. The `unsafe impl Send for RhaiImportPlugin` and `unsafe impl Sync for RhaiImportPlugin` (and their `RhaiExportPlugin` equivalents) in `plugin/rhai_loader/runtime.rs` are required to store the compiled AST in `State<Mutex<PluginRegistry>>`.

The `unsafe` impls are sound: the AST is immutable after compilation and each call to `parse()` / `format_entries()` constructs a fresh `Engine`. No shared mutable state exists across threads. This is documented in CLAUDE.md Gotcha #11 and the backend assessment report.

---

### AT-8 — `rand_core 0.6` is pinned; bump to 0.10 is blocked on source migration
**Status:** Open (deferred; source migration not yet done)

`rand` is already at `0.10` and the crypto crates (`aes-gcm 0.11`, `x25519-dalek 3`) are on stable releases that depend on the modern `rand_core`. The remaining blocker is a source migration: `rand_core 0.10` removed `OsRng` and renamed `RngCore` to `Rng`. The codebase still has ~22 `rand_core::OsRng` / `rand_core::RngCore` call sites — in `crates/mini-diarium-crypto/src/crypto/cipher.rs`, `crates/mini-diarium-core/src/db/schema/create.rs`, `crates/mini-diarium-core/src/db/schema/migrations/v2_to_v3.rs`, and several test modules — that must be migrated to `rand::rng()` / the `Rng` trait before the `rand_core = "0.6"` → `"0.10"` manifest bump compiles.

**Retry when:** the `OsRng`/`RngCore` call sites are migrated; then apply the `rand_core = "0.10"` bump in all three manifests that now carry it — `src-tauri/Cargo.toml`, `crates/mini-diarium-core/Cargo.toml`, and `crates/mini-diarium-crypto/Cargo.toml` (the crypto crate gained `rand_core` when `cipher.rs` moved there in open-core M3a / TODO-0082). (Dependabot PR #225 was closed with this comment on 2026-07-21.)

---

### AT-9 — State lock acquisition boilerplate is repeated across all command files
**Status:** Accepted as-is

Every command that accesses the database acquires the mutex with the same pattern:
```rust
let db_state = state.db.lock().map_err(|_| "State lock poisoned".to_string())?;
let db = db_state.as_ref().ok_or("Journal must be unlocked to ...")?;
```
This appears verbatim in 10+ files. Extracting it into a helper is complicated by `MutexGuard` lifetime rules (the guard must remain alive for the duration of the command body), which prevents returning a reference from a non-generic helper without significant restructuring.

**Not a correctness issue.** A helper macro would be the cleanest path if this becomes unmaintainable.

---

### AT-10 — Legacy export commands coexist with the plugin system
**Status:** By design (backward compatibility)

The legacy export commands (`export_json`, `export_markdown`) remain registered in `generate_handler![]` alongside the plugin-based `run_export_plugin`. The UI uses the plugin system; these two commands exist for backward compatibility with external tooling or scripts that may call them directly. The legacy import commands were removed in the 2026-04 cleanup (review finding B1/B2) because no consumer other than the deleted frontend wrappers called them.

---

### AT-11 — Auth slots require a minimum of one slot
**Status:** By design

`remove_auth_method` in `commands/auth/auth_slots.rs` refuses to delete the last remaining auth slot. This prevents users from locking themselves out of their own journal. It is enforced via `count_auth_slots()` before deletion.

---

### AT-12 — Theme settings span three independent localStorage keys
**Status:** Known complexity

User preferences are split across three independent `localStorage` keys:
- `'preferences'` — the main `Preferences` interface (`autoLockEnabled`, `hideTitles`, etc.)
- `'theme-preference'` — `'auto' | 'light' | 'dark'` (managed by `src/lib/theme.ts`)
- `'theme-overrides'` — JSON object of CSS token overrides (managed by `src/lib/theme-overrides.ts`)

Any code that resets, exports, or migrates user settings must handle all three independently. This split was introduced incrementally and could be consolidated in the future.

---

### AT-13 — Dependabot alert #6: `glib` unsoundness (Linux-only transitive dep)
**Status:** Open (blocked on Tauri upstream)

GitHub Security Advisory [GHSA-c2rh-4qvr-6q6p](https://github.com/advisories/GHSA-c2rh-4qvr-6q6p) flags `glib` versions ≥0.15.0 and <0.20.0 for unsoundness in the `Iterator` and `DoubleEndedIterator` impls of `glib::VariantStrIter`. Mini Diarium resolves `glib 0.18.5` transitively through the Tauri → GTK → webkit2gtk Linux stack.

**Impact:** Zero practical risk for Mini Diarium:
- **Linux-only compilation path** — the GTK/WebKit crates only compile on Linux. Windows (WebView2) and macOS (WKWebView) binaries are unaffected.
- **Fully transitive** — Mini Diarium code never imports or calls `glib` directly, and never uses `VariantStrIter`.
- **API soundness issue, not a C memory corruption** — the unsoundness is in Rust iterator impls, not the underlying C library.

**Resolution path:** Tauri 2.11.1 pins the gtk-rs 0.18.x ecosystem. Upgrading `glib` independently to 0.20.0 is impossible — it would break the semver contract with every other crate in the GTK stack (gtk, gdk, pango, cairo-rs, webkit2gtk, etc.). The fix arrives when Tauri upstream bumps its Linux GTK dependencies to 0.20+ in a future release. No action is possible at this level.

---

## Technical Debt

### TD-1 — Frontend test coverage is incomplete
**Status:** Open

`Calendar.tsx`, `Sidebar.tsx`, most overlays (`PreferencesOverlay`, `StatsOverlay`, `ImportOverlay`, `ExportOverlay`, `AboutOverlay`), and broader editor integration workflows lack direct unit tests. The current 137 frontend tests cover state modules and core components well but leave the full overlay and calendar surfaces unverified beyond E2E coverage.

---

### TD-2 — No Tauri integration tests
**Status:** Open

All 239 backend tests use direct `DatabaseConnection` instances, bypassing the Tauri command layer. There are no tests that call a Tauri command through the `State<DiaryState>` injection path. Command-level errors (state lock poisoning, wrong state transitions) are only covered by the E2E suite.

---

### TD-3 — No error boundary components
**Status:** Open

Unhandled errors thrown inside SolidJS components crash the affected component subtree without a visible recovery UI. There are no `<ErrorBoundary>` wrappers around major layout regions (sidebar, editor, overlays). An uncaught error in the calendar or editor would render that section blank with no user feedback.

---

### TD-4 — `menu.rs` and `screen_lock.rs` have zero unit tests
**Status:** Open (partially mitigated by E2E)

Both files require live OS-level handles (`AppHandle<Wry>`, HWND, `NSWorkspace`) that are not available in unit tests. `menu.rs` (226 lines: menu building, event dispatch, lock state updates) and `screen_lock.rs` (Windows WM_WTSSESSION_CHANGE + macOS NSWorkspace notifications, including `unsafe` Win32 code) are entirely covered only by E2E functional tests. Tracked in OPEN_TASKS.md Task 71.

---

### TD-5 — `lib.rs` bootstrap logic is not unit-tested
**Status:** Open

The app data directory resolution (`resolve_app_data_dir`) and legacy config detection (`has_legacy_app_state`) in `lib.rs` are pure functions that could be unit-tested without Tauri infrastructure but currently are not. Tracked in OPEN_TASKS.md Task 71 (A12).

---

*Last updated: 2026-07-23. For the security threat model, see [SECURITY.md](../SECURITY.md). For open features and enhancements, see [OPEN_TASKS.md](OPEN_TASKS.md). For the full backend architectural assessment conducted at v0.4.9, see [BACKEND_ASSESSMENT_2026-03.md](BACKEND_ASSESSMENT_2026-03.md).*
