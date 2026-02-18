# Security Review — Mini Diarium v0.2.0

**Date:** 2026-02-18
**Scope:** Cryptographic/auth backend, command/data-flow layer, SolidJS frontend
**Reviewer:** Automated security analysis (Claude Code)
**Version reviewed:** `feature-v0.2.0` branch (commit `0cc2d2c`)

---

## Threat Model

Mini Diarium is a local-first desktop application with **no network access**. The stated threat model covers:

- **Attacker with filesystem access** — can read the diary `.db` file and backup files directly
- **Memory forensics** — can dump process memory to recover keys or plaintext
- **Physical device access** — can access the machine while unlocked or while the app is running
- **Local malware** — runs on the same OS user account or as a different OS user on the same machine

**Out of scope:** Remote attacks, network eavesdropping, supply chain attacks, and server-side vulnerabilities — the app has no network surface.

---

## Findings Summary

| ID | Severity | Title | File |
|----|----------|-------|------|
| H1 | **HIGH** | `write_key_file` does not restrict file permissions | `src-tauri/src/commands/auth.rs:251` |
| H2 | **HIGH** | Import commands read files without a size limit | `src-tauri/src/commands/import.rs:40,99,158,217` |
| M1 | **MEDIUM** | Password minimum length inconsistency (6 vs 8 chars) | `src/components/overlays/PreferencesOverlay.tsx:166` |
| M2 | **MEDIUM** | Content Security Policy is disabled | `src-tauri/tauri.conf.json:23` |
| M3 | **MEDIUM** | Raw backend error messages propagated to UI | `src/state/auth.ts:44-45`, `src/components/overlays/PreferencesOverlay.tsx:179-180` |
| L1 | **LOW** | Backup files use `.txt` extension for binary SQLite data | `src-tauri/src/backup.rs:17` |
| L2 | **INFO** | FTS index stores plaintext inside encrypted database | Design tradeoff — documented |
| L3 | **INFO** | No `cargo audit` in development workflow | Process gap |
| L4 | **INFO** | Exported files are unencrypted plaintext | Expected — missing user warning |

---

## Detailed Findings

### H1 — `write_key_file` Does Not Restrict File Permissions

**Severity:** HIGH
**File:** `src-tauri/src/commands/auth.rs:251`

**Description:**

The `write_key_file` command writes the X25519 private key hex string to a user-chosen path using `std::fs::write`, which applies the process's default umask with no explicit permission restriction.

```rust
// auth.rs:250-252
pub fn write_key_file(path: String, private_key_hex: String) -> Result<(), String> {
    std::fs::write(&path, &private_key_hex).map_err(|e| format!("Failed to write key file: {}", e))
}
```

The doc comment directly above this function (line 248) states: *"The file is written with restricted permissions where possible."* — this is a broken promise.

**Impact:**

On Linux and macOS, the default umask typically yields `644` permissions (`-rw-r--r--`), making the private key file world-readable. Any other OS user or process running as a different UID can read the key file. An attacker who obtains this file can unlock the diary without knowing any password.

On Windows, default NTFS ACLs typically restrict new files to the current user, so the impact is lower on Windows but still unverified.

**Fix:**

Use `OpenOptions` with explicit mode bits on Unix:

```rust
#[cfg(unix)]
{
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)  // owner read/write only
        .open(&path)?
        .write_all(private_key_hex.as_bytes())?;
}
#[cfg(windows)]
{
    // Write file, then restrict ACL via Windows API or document that
    // Windows default ACLs are acceptable
    std::fs::write(&path, &private_key_hex)?;
}
```

---

### H2 — Import Commands Read Files Without a Size Limit

**Severity:** HIGH
**Files:** `src-tauri/src/commands/import.rs:40` (Mini Diary), `:99` (Day One JSON), `:158` (Day One TXT), `:217` (jrnl)

**Description:**

All four import command handlers read the entire import file into memory using `std::fs::read_to_string` with no pre-check on file size:

```rust
// import.rs:40 (same pattern at lines 99, 158, 217)
let json_content = std::fs::read_to_string(&file_path).map_err(|e| {
    let err = format!("Failed to read file: {}", e);
    error!("{}", err);
    err
})?;
```

**Impact:**

A multi-gigabyte file (accidental or malicious) would cause the application to allocate all available memory and either crash or trigger an OOM kill. Deeply nested JSON structures could exhaust the stack during parsing. While this requires the user to actively choose a malformed file, the failure mode is ungraceful (OOM, not a clean error).

**Fix:**

Check file size before reading and reject files exceeding a reasonable limit:

```rust
const MAX_IMPORT_SIZE_BYTES: u64 = 100 * 1024 * 1024; // 100 MB

let metadata = std::fs::metadata(&file_path)
    .map_err(|e| format!("Cannot access file: {}", e))?;
if metadata.len() > MAX_IMPORT_SIZE_BYTES {
    return Err(format!(
        "File is too large ({} MB). Maximum allowed is 100 MB.",
        metadata.len() / 1_048_576
    ));
}
let json_content = std::fs::read_to_string(&file_path)...
```

Apply this guard in all four import command handlers before the `read_to_string` call.

---

### M1 — Password Minimum Length Inconsistency

**Severity:** MEDIUM
**Files:**
- `src/components/auth/PasswordCreation.tsx:28` — enforces **8** characters
- `src/components/overlays/PreferencesOverlay.tsx:166` — enforces only **6** characters

**Description:**

When creating a new diary, the UI correctly enforces an 8-character minimum:

```tsx
// PasswordCreation.tsx:28-30
if (pwd.length < 8) {
  setError('Password must be at least 8 characters');
```

But the "Change Password" flow in Preferences uses a weaker threshold:

```tsx
// PreferencesOverlay.tsx:166-168
if (newPassword().length < 6) {
  setPasswordError('New password must be at least 6 characters');
```

**Impact:**

A user with an 8-character password can change it to a 6-character password, reducing their security posture without awareness. The mismatch also signals an unintentional inconsistency in the security policy.

**Fix:**

Unify both checks to 8 characters (or extract a shared constant). Update the error message in `PreferencesOverlay.tsx:167` to match:

```tsx
if (newPassword().length < 8) {
  setPasswordError('New password must be at least 8 characters');
```

---

### M2 — Content Security Policy Is Disabled

**Severity:** MEDIUM
**File:** `src-tauri/tauri.conf.json:23`

**Description:**

The Tauri configuration explicitly sets CSP to null:

```json
"security": {
  "csp": null
}
```

The app renders rich-text diary content via TipTap (a ProseMirror-based editor), which processes and displays HTML. While ProseMirror's node schema filters disallowed elements during editing, previously stored entries are rendered directly as HTML in the webview. If a diary database were tampered with at the filesystem level to inject malicious HTML, the webview would execute scripts on next open.

**Impact:**

In the threat model (attacker with filesystem access), a targeted attack could inject a `<script>` tag into an existing diary entry in the SQLite database. On next unlock, the entry would be decrypted and rendered in the webview without a CSP to block inline script execution. This is a defense-in-depth gap rather than a direct vulnerability, but it falls within the stated threat model.

**Fix:**

Define a strict CSP in `tauri.conf.json`:

```json
"security": {
  "csp": "default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:"
}
```

Note: `'unsafe-inline'` for styles is common with CSS-in-JS/UnoCSS tooling. Inline scripts should not be needed with a bundled SolidJS app.

---

### M3 — Raw Backend Error Messages Propagated to UI

**Severity:** MEDIUM
**Files:**
- `src/state/auth.ts:44-45`
- `src/components/overlays/PreferencesOverlay.tsx:179-180`

**Description:**

Error messages from Tauri commands are displayed directly to the user without sanitization:

```typescript
// auth.ts:43-45
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
```

```typescript
// PreferencesOverlay.tsx:178-180
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  setPasswordError(message);
```

Rust error messages may include system-level details: filesystem paths, OS error codes, library internals (e.g., `"Failed to read key file: /home/user/.ssh/diary.key: Permission denied (os error 13)"`). These messages are stored in UI signals and rendered in the DOM.

**Impact:**

In this local-first threat model, the impact is primarily information disclosure to a shoulder-surfing observer or to a user inspecting the DOM. Full filesystem paths and OS error details may reveal information about the system layout. More seriously, if any future logging or crash reporting were added, these raw messages could inadvertently capture sensitive paths.

**Fix:**

Map known error patterns to user-friendly messages at the frontend boundary:

```typescript
function toUserFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('Diary not unlocked')) return 'Please unlock your diary first.';
  if (raw.includes('Wrong password') || raw.includes('Invalid password')) return 'Incorrect password.';
  if (raw.includes('Failed to read')) return 'Could not read file. Check permissions.';
  // Log full detail only in development
  if (import.meta.env.DEV) console.error('[auth error]', raw);
  return 'An unexpected error occurred.';
}
```

---

### L1 — Backup Files Use `.txt` Extension for Binary SQLite Data

**Severity:** LOW
**File:** `src-tauri/src/backup.rs:17`

**Description:**

```rust
// backup.rs:17
let backup_filename = format!("backup-{}.txt", timestamp);
```

Backup files are complete copies of the encrypted SQLite database — binary files. Naming them `.txt` causes:
- Double-clicking opens them in a text editor, showing garbled binary data
- File managers may associate them with text tools rather than SQLite viewers
- Users may be confused about what the file contains

**Impact:** No security impact. Low usability/confusion risk.

**Fix:** Change extension to `.db` or `.sqlite`:

```rust
let backup_filename = format!("backup-{}.db", timestamp);
```

---

### L2 — FTS Index Stores Plaintext Inside the Encrypted Database

**Severity:** INFORMATIONAL (design tradeoff)

**Description:**

The `entries_fts` virtual table stores diary content in plaintext to enable full-text search. This is documented in `CLAUDE.md`:

> *"FTS index (`entries_fts`) stores plaintext for search. Any operation that writes entries must update both."*

The SQLite database file itself is not encrypted at the container level (no SQLCipher). Encryption is applied per-entry (AES-256-GCM). This means:

- The `entries` table rows are opaque ciphertext — safe
- The `entries_fts` table rows are readable plaintext — visible to anyone with the `.db` file

A tool like DB Browser for SQLite or `sqlite3` CLI can read diary content directly from the FTS table without knowing the password.

**Recommendation:**

This is a known architectural tradeoff (SQLite FTS5 cannot natively operate on ciphertext). The impact should be clearly communicated to users in:
- The `docs/PRIVACY.md` file
- The `docs/USER_GUIDE.md` file

Recommended addition:

> **Note on full-text search:** To support search, a plaintext copy of your diary entries is stored in the database alongside the encrypted entries. The database file is protected by your password (the password is required to add or modify entries), but if an attacker obtains the raw database file and uses a SQLite tool, they can read your entries directly. For maximum security, store your diary file on an encrypted volume (e.g., BitLocker, FileVault, LUKS).

---

### L3 — No `cargo audit` in Development Workflow

**Severity:** INFORMATIONAL

**Description:**

There is no evidence of automated dependency vulnerability scanning (`cargo audit`, `cargo deny`, or similar) in the project's CI, Makefile, or documented release process (`RELEASING.md`).

The current Rust dependencies (aes-gcm, argon2, x25519-dalek, rusqlite, hkdf, sha2) are all actively maintained and no known advisories were identified during this review. However, this is not guaranteed to remain true across future dependency updates.

**Recommendation:**

Add `cargo audit` to the release checklist in `docs/RELEASING.md` and optionally to a CI step:

```bash
cargo install cargo-audit
cargo audit
```

---

### L4 — Exported Files Are Unencrypted Plaintext Without User Warning

**Severity:** INFORMATIONAL
**Files:** `src-tauri/src/export/json.rs`, `src-tauri/src/export/markdown.rs`

**Description:**

The JSON and Markdown export commands write all diary entries as unencrypted plaintext. This is intentional behavior (exports are for portability), but the `ImportOverlay.tsx` / export UI does not warn the user that the resulting file contains their full diary in readable form.

**Impact:** A user who exports to a shared folder, cloud drive, or email attachment inadvertently exposes their full diary content.

**Recommendation:**

Add a one-line disclosure in the Export overlay before the user selects a destination:

> "The exported file will contain your diary entries as plain text. Store it in a secure location."

---

## Cryptographic Assessment

The core cryptographic design is **correct and well-implemented**. No cryptographic vulnerabilities were found.

| Component | Implementation | Assessment |
|-----------|---------------|------------|
| Entry encryption | AES-256-GCM, 12-byte random nonce per ciphertext | Correct — nonce never reused |
| Password KDF | Argon2id (64 MB, t=3, p=4) | Strong — exceeds OWASP minimums |
| Master key wrapping | AES-256-GCM, per-slot | Correct — master key never stored plaintext |
| Keypair auth | X25519 ECIES + HKDF-SHA256 + AES-256-GCM | Correct — ephemeral DH, forward-looking |
| Key zeroization | `ZeroizeOnDrop` + explicit `.zeroize()` after use | Thorough — covers all key material |
| Auth slot guard | Refuses to delete last slot | Correct — prevents self-lockout |
| Schema migration | Transaction + rollback on v2→v3 | Robust |

**Notes on specific design choices:**

- **HKDF salt = ephemeral public key** (keypair.rs): unconventional but cryptographically sound. The ephemeral public key is effectively a unique nonce per encryption; using it as the HKDF salt provides domain separation without weakening security.
- **Argon2id parameters**: 64 MB / 3 iterations / 4 lanes is strong. At these parameters, even an attacker with direct filesystem access who extracts the wrapped key blob must spend significant GPU/ASIC time per guess.
- **Backup files are encrypted**: backups are byte-for-byte copies of the SQLite database, which includes encrypted entries — they are not plaintext. The FTS plaintext concern (L2) applies equally to backups.

---

## What Was Reviewed and Not Found to Be Vulnerable

The following areas were investigated and found to be **not vulnerable**, with reasoning:

| Area | Finding |
|------|---------|
| **Path traversal in import/export** | Paths sourced from OS-native Tauri dialogs (`open()`, `save()`). The dialog enforces valid filesystem paths; arbitrary path injection is not possible from the UI. |
| **TipTap XSS during editing** | ProseMirror parses HTML through its node schema, stripping disallowed tags and attributes on input. This prevents injection via the editor interface. (See M2 for the render-path concern.) |
| **Brute-force rate limiting** | In the threat model, an attacker with filesystem access can run Argon2id offline. In-app rate limiting provides no meaningful resistance. The Argon2id parameters (H2 above table) are the correct defense layer. |
| **localStorage for preferences** | Only non-secret booleans and numbers stored (`allowFutureEntries`, `firstDayOfWeek`, `hideTitles`, `enableSpellcheck`). No credentials or keys. |
| **`DiaryState` mutex** | Correctly holds `Mutex<Option<Connection>>` — `None` when locked, `Some` when unlocked. All entry commands check `as_ref().ok_or("Diary not unlocked")?`. No TOCTOU issues found. |

---

## Recommendations by Priority

### Immediate (before next release)

1. **[H1]** Fix `write_key_file` to set `0o600` permissions on Unix using `OpenOptions::mode()`. This is a one-function change with high security impact.
2. **[H2]** Add a file size pre-check (100 MB limit) before `read_to_string` in all four import command handlers.
3. **[M1]** Unify password minimum length to 8 characters in `PreferencesOverlay.tsx:166`.

### Short-term (next sprint)

4. **[M2]** Enable CSP in `tauri.conf.json` with a strict policy. Test that TipTap and UnoCSS still function correctly.
5. **[M3]** Add a thin error-mapping layer in the frontend to replace raw Rust errors with user-friendly messages.

### Documentation / Process

6. **[L2]** Add a plaintext-FTS disclosure to `docs/PRIVACY.md` and `docs/USER_GUIDE.md`, recommending full-disk encryption.
7. **[L4]** Add an unencrypted-export warning to the export UI.
8. **[L3]** Add `cargo audit` to the release checklist in `docs/RELEASING.md`.
9. **[L1]** Change backup file extension from `.txt` to `.db` (low risk, low effort).
