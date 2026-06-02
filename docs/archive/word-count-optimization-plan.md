# TODO-0029: Optimize Word-Count Performance

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-13
- Last Updated: 2026-05-13
- Owner: Coding agent
- Approval: PENDING
- Related TODO: TODO-0029 in `docs/todo/TODO.md`

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Reduce the word-count calculation time from the current ~8.75µs (plain text) and ~12.05µs (TipTap HTML) to <500ns, eliminating regex/allocation bottlenecks in both the Rust backend (`count_words` / `strip_html_tags`) and the TypeScript frontend (`countWordsInHtml` / `countWordsFromText`).

## Scope

- Optimize `count_words` and `strip_html_tags` in `src-tauri/src/db/queries.rs`
- Optimize `countWordsInHtml` and `countWordsFromText` in `src/lib/wordcount.ts`
- Update benchmarks to measure the optimized implementations
- Verify all existing tests pass
- No changes to the word-count semantics — the result must be identical to the current implementation

## Non-Goals

- Changing the word-count algorithm semantics (e.g. different treatment of hyphenated words, numbers, punctuation)
- Adding new word-count features (character count, paragraph count, reading time)
- Frontend UI changes
- Database schema changes
- Changes to how word count is stored or transmitted

## Assumptions

- The performance target is <500ns for both plain text and HTML paths, as confirmed by the user
- The benchmark corpus (`PLAIN_TEXT` ~500 words, `REALISTIC_HTML` ×3 ~600 words) is representative of real usage
- Word-count is called on every auto-save and on every keystroke via `handleContentUpdate` in `EditorPanel.tsx`
- The frontend `countWordsFromText` uses `editor.getText()` (TipTap's plain-text extractor) and `countWordsInHtml` is used as a fallback for load-time calculations
- Semantic equivalence is required — optimized implementations must produce the same word count as the current ones for all inputs

## Open Questions

None. All questions answered by the user:

1. **Target threshold**: <500ns for both plain text and HTML paths.
2. **Semantic equivalence scope**: Fix bugs if found during optimization — do not preserve incorrect edge-case behavior.
3. **Frontend vs backend priority**: Both equally — both the Rust auto-save path and the TypeScript keystroke path are latency-sensitive.

## Tasks

### Task 1: Profile Current Implementations and Establish Baselines

- Status: TO BE DONE
- Objective: Identify the exact bottlenecks in both Rust and TypeScript implementations and record baseline measurements.
- Steps:
  1. Run `cargo bench --bench word_count_bench` to capture current Rust baseline times
  2. Analyze `strip_html_tags` — the char-by-char iteration with `String::with_capacity` and `push` is the likely bottleneck; each `push` may trigger bounds checks
  3. Analyze `count_words` — `strip_html_tags(text)` allocates a new `String`, then `.split_whitespace().count()` iterates again
  4. Analyze frontend `countWordsInHtml` — `/<[^>]*>/g` regex creates a new string via `.replace()`, then `.split(/\s+/)` allocates an array
  5. Analyze frontend `countWordsFromText` — `.trim().split(/\s+/).filter(Boolean).length` allocates an intermediate array
  6. Record baseline numbers in a temporary note for comparison
- Validation: Baseline benchmark numbers captured; bottleneck analysis documented
- Notes: If cargo bench times out, use `cargo bench --bench word_count_bench -- --noplot` to skip plot generation

### Task 2: Optimize Rust `count_words` — single-pass state machine

- Status: TO BE DONE
- Objective: Eliminate the intermediate `String` allocation in `strip_html_tags` and combine tag-stripping with word-counting into a single pass.
- Steps:
  1. Replace the two-pass approach (strip HTML to new String, then split and count) with a single-pass state machine that:
     - Tracks whether currently inside an HTML tag (`<` to `>`)
     - Counts word boundaries on-the-fly using an `in_word: bool` flag
     - Transitions from `in_word = true` to `in_word = false` on whitespace outside tags, incrementing the count
     - Skips all characters inside tags entirely
  2. The new function signature remains `pub fn count_words(text: &str) -> i32` — all call sites (entries.rs, export.rs, import.rs, json.rs, markdown.rs, rhai_loader.rs, minidiary.rs, db_bench.rs, word_count_bench.rs) continue to work unchanged
  3. Remove `strip_html_tags` entirely — it is `fn` (private) and only called by `count_words` at `queries.rs:403`
  4. Ensure edge cases match or improve current behavior: empty string → 0, whitespace-only → 0, tags-only → 0
- Validation:
  - `cargo test -- queries` — all existing tests in `queries.rs` pass (including `test_count_words` and `test_count_words_strips_html` at lines 794-808)
  - `cargo bench --bench word_count_bench` — new times are <500ns for both plain text and HTML
  - Add edge-case tests for base64 image tags and Unicode text to `queries.rs` (currently missing from Rust tests, already covered in TypeScript tests)
- Notes: The single-pass approach avoids allocating a new `String` entirely. Use `char::is_whitespace` for word boundary detection — it handles Unicode whitespace correctly, matching the current `split_whitespace()` behavior.

### Task 3: Optimize TypeScript `countWordsFromText`

- Status: TO BE DONE
- Objective: Eliminate the intermediate array allocation from `.split(/\s+/).filter(Boolean)`.
- Steps:
  1. Replace `text.trim().split(/\s+/).filter(Boolean).length` with a regex match approach: `(text.trim().match(/\S+/g) || []).length`
  2. Alternatively, use a manual loop that counts non-whitespace runs without allocating an array
  3. Benchmark both approaches in a quick Node/Bun script to verify performance
  4. The regex match approach `/\S+/g` is typically faster because it avoids creating the intermediate array of all split parts
- Validation:
  - `cmd.exe /c bun run test:run` — all existing tests pass
  - `WordCount.test.tsx` passes
  - Manual verification: `countWordsFromText('')` → 0, `countWordsFromText('   ')` → 0, `countWordsFromText('hello world')` → 2
- Notes: The `match(/\S+/g)` approach returns `null` for no matches, hence the `|| []` fallback. This is semantically identical to the current implementation.

### Task 4: Optimize TypeScript `countWordsInHtml`

- Status: TO BE DONE
- Objective: Eliminate the regex `.replace()` allocation and the subsequent `.split()` allocation.
- Steps:
  1. Replace the two-allocation approach (`.replace(/<[^>]*>/g, ' ')` then `.split(/\s+/)`) with a single-pass approach:
     - Use a regex that matches either HTML tags or word tokens: `html.match(/<[^>]*>|\S+/g)` and count the non-tag matches
     - Or use a manual loop that skips tag content and counts `\S+` runs
  2. The regex approach `html.match(/<[^>]*>|\S+/g)?.filter(t => !t.startsWith('<')).length ?? 0` is concise and avoids intermediate string allocation
  3. Benchmark to verify performance improvement
- Validation:
  - `cmd.exe /c bun run test:run` — all existing tests pass
  - Manual verification: `countWordsInHtml('')` → 0, `countWordsInHtml('<p>hello world</p>')` → 2, `countWordsInHtml('<img src="data:...">')` → 0
  - Verify base64 image handling: entries with embedded `<img src="data:image/...;base64,...">` should not count the base64 blob as words
- Notes: The current regex `/<[^>]*>/g` correctly strips all HTML tags including those with base64 data URLs. The optimized version must preserve this behavior. The `match` approach is preferred because it doesn't create a modified string — it just extracts tokens.

### Task 5: Add Frontend Word-Count Benchmark

- Status: TO BE DONE
- Objective: Create a Vitest benchmark for `countWordsInHtml` and `countWordsFromText` to track frontend performance alongside the existing Rust benchmarks.
- Steps:
  1. Create `src/lib/wordcount.bench.ts` following the pattern from `src/lib/markdown.bench.ts`
  2. Use the same corpus as the Rust benchmarks for cross-platform comparability:
     - `PLAIN_TEXT` (~500 words of prose) — benchmark `countWordsFromText`
     - `REALISTIC_HTML` ×3 (~600 words of TipTap HTML) — benchmark `countWordsInHtml`
  3. Add benches: `countWordsFromText ~500w` and `countWordsInHtml ~600w`
  4. Verify the benchmark runs: `cmd.exe /c bun run bench`
- Validation:
  - `cmd.exe /c bun run bench` — both benches execute without errors
  - Baseline numbers captured for comparison post-optimization
- Notes: Vitest uses `bench()` from `vitest`, not `describe/it`. The corpus constants can be copied from `src-tauri/benches/word_count_bench.rs` to keep inputs identical between Rust and TypeScript.

### Task 6: Update Benchmarks and Add Regression Tests

- Status: TO BE DONE
- Objective: Ensure the benchmark suite measures the optimized implementations and add tests to prevent regression.
- Steps:
  1. Verify `word_count_bench.rs` still compiles and runs against the new implementation
  2. Add edge-case tests to `queries.rs` for `count_words` (existing tests at lines 794-808 cover basic cases; add):
     - Base64 image tag handling: `count_words("<img src=\"data:image/png;base64,abc==\" />")` → 0
     - Unicode text with non-ASCII whitespace
  3. Add edge-case tests to existing `src/lib/wordcount.test.ts` (already exists with 13 tests):
     - Whitespace-only string → 0 for both functions
     - HTML tags only (no text content) → 0 for `countWordsInHtml`
     - Unicode text for `countWordsFromText`
  4. Run `cargo test` and `bun run test:run` to verify all tests pass
- Validation:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` — all Rust tests pass
  - `cmd.exe /c bun run test:run` — all frontend tests pass (including `wordcount.test.ts`)
  - `cargo bench --bench word_count_bench` — benchmark runs successfully with improved times
- Notes: `wordcount.test.ts` already exists at `src/lib/wordcount.test.ts` with coverage for base64 images, empty strings, and multiple tags. Do not create a new file — append to the existing one.

### Task 7: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments
  2. Remove only artifacts that are not part of the intended final repository state
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract
  4. If this plan originated from TODO-0029, ensure the TODO will be marked complete during final verification
- Validation: Worktree diff contains only intended final changes
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` — all Rust tests pass
- `cmd.exe /c bun run test:run` — all frontend tests pass
- `cmd.exe /c bun run lint` — no lint errors
- `cmd.exe /c bun run type-check` — TypeScript type check passes
- `cargo bench --bench word_count_bench` — Rust benchmark times are <500ns for both plain text and HTML
- `cmd.exe /c bun run bench` — frontend benchmark runs successfully with improved times
- `cmd.exe /c bun run format:check` — formatting is correct
- Mark TODO-0029 as completed in `docs/todo/TODO.md` (change `[ ]` to `[x]`)

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` directory).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions have been asked and answered by the user.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Run verification commands after each task completes — do not batch multiple tasks before validating.
