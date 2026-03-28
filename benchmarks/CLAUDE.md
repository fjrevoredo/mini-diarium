# Benchmarks — CLAUDE.md

Performance benchmarks for Mini Diarium. Two layers: Rust hot-path benchmarks (criterion 0.5) and frontend render benchmarks (Vitest bench).

## File Structure

```
benchmarks/
  CLAUDE.md              ← this file
src-tauri/benches/
  cipher_bench.rs        ← AES-256-GCM encrypt/decrypt at 1 KB / 10 KB / 100 KB
  db_bench.rs            ← insert, read-by-date, read-all on 100-entry corpus
  word_count_bench.rs    ← plain text and HTML word counting
src/lib/
  markdown.bench.ts      ← parseMarkdownToHtml short and long entry
```

## Verification Commands

| Command | What it does |
|---------|-------------|
| `cd src-tauri && cargo bench` | Run all Rust benchmarks |
| `cd src-tauri && cargo bench --bench cipher_bench` | Run cipher benchmarks only |
| `cd src-tauri && cargo bench -- --output-format html` | HTML report → `src-tauri/target/criterion/` |
| `bun run bench` | Run frontend Vitest benchmarks |

## Benchmarks Covered

| Benchmark | File | Scenarios |
|-----------|------|-----------|
| `cipher_encrypt` | `cipher_bench.rs` | AES-256-GCM encrypt at 1 KB, 10 KB, 100 KB |
| `cipher_decrypt` | `cipher_bench.rs` | AES-256-GCM decrypt at 1 KB, 10 KB, 100 KB |
| `db_insert_entry` | `db_bench.rs` | One-time entry creation into fresh DB |
| `db_update_entry` | `db_bench.rs` | Auto-save hot path: update existing entry (realistic HTML) |
| `db_get_entries_by_date` | `db_bench.rs` | Read 1 entry by date |
| `db_get_all_entry_dates/100` | `db_bench.rs` | Distinct date list — 100-entry journal |
| `db_get_all_entry_dates/500` | `db_bench.rs` | Distinct date list — 500-entry journal |
| `db_get_all_entries/100` | `db_bench.rs` | Full scan — 100-entry journal |
| `db_get_all_entries/500` | `db_bench.rs` | Full scan — 500-entry journal |
| `auth_argon2/wrap_master_key` | `auth_bench.rs` | Argon2id hash + AES-GCM wrap (unlock cost) |
| `auth_argon2/unwrap_master_key` | `auth_bench.rs` | Argon2id verify + AES-GCM unwrap (unlock cost) |
| `count_words_plain_500w` | `word_count_bench.rs` | Word count on ~500-word plain prose |
| `count_words_html_500w` | `word_count_bench.rs` | Word count on realistic TipTap HTML |
| `parseMarkdownToHtml short` | `markdown.bench.ts` | marked + DOMPurify on ~100-word Markdown |
| `parseMarkdownToHtml long` | `markdown.bench.ts` | marked + DOMPurify on ~1000-word Markdown |

## CI Integration

Workflow: `.github/workflows/benchmark.yml`
Trigger: every push to `master`
Results: stored as JSON in `gh-pages` branch under `benchmarks/`
Alert threshold: **200%** — posts a PR comment if a benchmark regresses to 2× but does **not** fail the CI job.

`contents: write` permission is required on the workflow to push results to `gh-pages`.

## Gotchas

1. **`harness = false` is required** — bench targets declare `criterion_main!` themselves; setting `harness = false` in `[[bench]]` prevents Cargo from injecting the default test harness. Without it, compilation fails with duplicate `main` symbols.

2. **Cold-target compile time** — the first `cargo bench` run compiles criterion and all bench targets from scratch. Expect 2–5 minutes. Subsequent runs are incremental.

3. **CI numbers ≠ developer numbers** — GitHub Actions shared runners have variable CPU performance. Absolute numbers are not meaningful; only the trend over time matters.

4. **`jsdom` environment is required for `markdown.bench.ts`** — DOMPurify calls `window.document.createElement`. Vitest's default `jsdom` environment (set in `vitest.config.ts`) provides this. Do not add a `@vitest-environment` override — it would be redundant and could cause confusion.

5. **Keep `NamedTempFile` alive in `iter_batched` setups** — `tempfile::NamedTempFile` deletes its file on `Drop`. In `iter_batched`, the setup closure must return both `(tmp, db)` so the file outlives the benchmark iteration. Dropping `tmp` before the iteration runs will cause SQLite to open a deleted file.

6. **All benchmark imports use `mini_diarium_lib::*`** — the Cargo.toml `[lib]` section declares `name = "mini_diarium_lib"`. Benchmark targets import from this crate name, not from the binary target. Ensure `pub mod crypto` and `pub mod db` are exported from `lib.rs`.

7. **Auth bench uses `sample_size(10)` intentionally** — Argon2id takes 100–300 ms per
   sample; 10 samples (~30–60 s) is sufficient for trend tracking without blocking CI.
   Do not increase `sample_size` on this group.

8. **Auth bench alerts on slowdowns only** — criterion tracks regressions (things getting
   slower). It does NOT alert if Argon2id gets faster/weaker (e.g. reduced iterations).
   Guarding against weakened parameters requires a dedicated unit test checking minimum
   param values — that is a separate concern from performance benchmarking.
