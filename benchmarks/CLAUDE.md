# Benchmarks — CLAUDE.md

Performance benchmarks for Mini Diarium. Two layers: Rust hot-path benchmarks (criterion 0.5) and frontend render benchmarks (Vitest bench).

Rust benchmarks live in `src-tauri/benches/` (four criterion files: auth, cipher, db, word count). Frontend benchmark: `src/lib/markdown.bench.ts`. Dashboard report page: `benchmarks/index.html` (served from gh-pages).

## Verification Commands

For the canonical post-task checklist (tests + formatting + CHANGELOG + TODO), see [Post-Task Completion Best Practices](../docs/best-practices/POST_TASK_BEST_PRACTICES.md).

Benchmark-specific:

| Command | What it does |
|---------|-------------|
| `cargo bench --manifest-path src-tauri/Cargo.toml` | Run all Rust benchmarks |
| `cargo bench --manifest-path src-tauri/Cargo.toml --bench cipher_bench` | Run cipher benchmarks only |
| `cargo bench --manifest-path src-tauri/Cargo.toml -- --output-format html` | HTML report → `target/criterion/` (workspace target dir at repo root) |
| `bun run bench` | Run frontend Vitest benchmarks |

## Benchmarks Covered

| Benchmark | File | Scenarios |
|-----------|------|-----------|
| `cipher_encrypt` | `cipher_bench.rs` | AES-256-GCM encrypt at 1 KB, 10 KB, 100 KB |
| `cipher_decrypt` | `cipher_bench.rs` | AES-256-GCM decrypt at 1 KB, 10 KB, 100 KB |
| `db_insert_entry` | `db_bench.rs` | One-time entry creation into fresh DB (in-memory DB — isolates query CPU from disk-flush variance) |
| `db_update_entry` | `db_bench.rs` | Auto-save hot path: update existing entry, realistic HTML (in-memory DB — isolates query CPU from disk-flush variance) |
| `db_delete_entry` | `db_bench.rs` | Hard delete by id — explicit user-initiated delete (in-memory DB — isolates query CPU from disk-flush variance) |
| `db_get_entries_by_date` | `db_bench.rs` | Read 1 entry by date |
| `db_get_all_entry_dates/100` | `db_bench.rs` | Distinct date list — 100-entry journal |
| `db_get_all_entry_dates/500` | `db_bench.rs` | Distinct date list — 500-entry journal |
| `db_get_all_entries/100` | `db_bench.rs` | Full scan — 100-entry journal |
| `db_get_all_entries/500` | `db_bench.rs` | Full scan — 500-entry journal |
| `db_get_all_entries/1000` | `db_bench.rs` | Full scan — 1000-entry journal |
| `db_get_all_entries/3650` | `db_bench.rs` | Full scan — 3650-entry journal (decade scale) |
| `db_search_entries/500` | `db_bench.rs` | In-memory full-text search — 500-entry worst case (all match) |
| `db_search_entries/1000` | `db_bench.rs` | In-memory full-text search — 1000-entry worst case |
| `db_search_entries/3650` | `db_bench.rs` | In-memory full-text search — 3650-entry worst case; 150 ms is the architecture decision gate |
| `auth_argon2/wrap_master_key` | `auth_bench.rs` | Argon2id hash + AES-GCM wrap (unlock cost) |
| `auth_argon2/unwrap_master_key` | `auth_bench.rs` | Argon2id verify + AES-GCM unwrap (unlock cost) |
| `count_words_plain_500w` | `word_count_bench.rs` | Word count on ~500-word plain prose |
| `count_words_html_500w` | `word_count_bench.rs` | Word count on realistic TipTap HTML |
| `parseMarkdownToHtml short` | `markdown.bench.ts` | marked + DOMPurify on ~100-word Markdown |
| `parseMarkdownToHtml long` | `markdown.bench.ts` | marked + DOMPurify on ~1000-word Markdown |
| `ci_pipeline_duration` | _workflow-generated_ | Total wall-clock CI pipeline duration on master |

## Benchmark Dashboard (`index.html`)

The custom report page is a single static HTML file served from the `gh-pages` branch. It has no build step — all dependencies (Chart.js, chartjs-plugin-annotation) are loaded from CDN.

### Visual features

- **Threshold lines**: Horizontal reference lines on each chart showing target (green), warning (amber, 1.5× target), and critical (red, 2× target) performance envelopes. Rendered via `chartjs-plugin-annotation`.
- **SMA trendline**: Simple moving average overlay (orange dashed) to smooth CI runner noise and reveal long-term drift. Window auto-scales: 3 for 6–15 points, 5 for 16–30, 7 for >30.
- **Regression highlighting**: Cards with the latest value above warning get an amber border + "⚠ Above target" badge; above critical gets a red border + "🔴 Critical" badge.
- **Toggle controls**: "Show trendline" and "Show thresholds" checkboxes in the page header.

### `THRESHOLDS` constant

All threshold values are stored in nanoseconds inside `index.html` as a `THRESHOLDS` object keyed by benchmark name. All benchmarks that appear in `data.js` have thresholds (Rust benchmarks + the synthetic `ci_pipeline_duration`). The `warning` level is not stored — it is derived as `target * 1.5` at render time.

When adding a new benchmark:
1. Add it to the `SECTIONS` array (for grouping).
2. Add a `META` entry (title, description, interpretation).
3. Add a `THRESHOLDS` entry with `target` and `critical` values in nanoseconds.

### Auth threshold gap

Auth benchmarks only have upper-bound thresholds. A value dropping *below* expected (faster Argon2id) is equally dangerous (weakened KDF parameters) but is not shown on the dashboard. This is mitigated by CI (which alerts on slowdowns) and a dedicated unit test checking minimum Argon2 parameters.

## CI Integration

Workflow: `.github/workflows/benchmark.yml`
Trigger: every push to `master`
Results: stored as JSON in `gh-pages` branch under `benchmarks/`
Alert threshold: **200%** — posts a PR comment if a benchmark regresses to 2× but does **not** fail the CI job.

After each run, the workflow also copies `benchmarks/index.html` to gh-pages so the custom report reflects the latest data.

`contents: write` permission is required on the workflow to push results to `gh-pages`.

### CI Pipeline Duration Metric

A synthetic benchmark named `ci_pipeline_duration` is computed by the workflow itself (not by Cargo/bencher).
It measures total wall-clock time from workflow start to the end of the benchmark job, covering lint, test, build, and e2e stages.
The value is appended to `bench-output.txt` in bencher format (`<name> <value> nanoseconds`) so it integrates with the existing `github-action-benchmark` storage and appears in `data.js`.
On the dashboard it is rendered in the "CI Pipeline" section with a target threshold of 600 s and critical at 1 200 s.

The duration step uses `if: always()` so it runs even after earlier steps fail. However, the subsequent "Store benchmark results" step does **not** use `if: always()` — so a `ci_pipeline_duration` data point is only pushed when the full Rust bench job succeeds. Failed runs do not record a duration metric.

## Gotchas

1. **`harness = false` is required** — bench targets declare `criterion_main!` themselves; setting `harness = false` in `[[bench]]` prevents Cargo from injecting the default test harness. Without it, compilation fails with duplicate `main` symbols.

2. **Cold-target compile time** — the first `cargo bench` run compiles criterion and all bench targets from scratch. Expect 2–5 minutes. Subsequent runs are incremental.

3. **CI numbers ≠ developer numbers** — GitHub Actions shared runners have variable CPU performance. Absolute numbers are not meaningful; only the trend over time matters.

4. **`jsdom` environment is required for `markdown.bench.ts`** — DOMPurify calls `window.document.createElement`. Vitest's default `jsdom` environment (set in `vitest.config.ts`) provides this. Do not add a `@vitest-environment` override — it would be redundant and could cause confusion.

5. **Keep `NamedTempFile` alive in `iter_batched` setups** — `tempfile::NamedTempFile` deletes its file on `Drop`. In `iter_batched`, the setup closure must return both `(tmp, db)` so the file outlives the benchmark iteration. Dropping `tmp` before the iteration runs will cause SQLite to open a deleted file. **Exception:** the three mutating benches (`db_insert_entry`, `db_update_entry`, `db_delete_entry`) now use `create_database(":memory:", …)` and carry no tempfile, so this rule no longer applies to them — it still governs the read/search benches that seed a file-backed DB.

6. **All benchmark imports use `mini_diarium_lib::*`** — the app crate's Cargo.toml `[lib]` section declares `name = "mini_diarium_lib"`. Benchmark targets (which stay in `src-tauri/benches/`, built with the app crate) import from this crate name, not from the binary target. Since `db` moved to the `mini-diarium-core` crate and `crypto`/`auth` moved further to the `mini-diarium-crypto` crate (open-core M1 then M3a), `lib.rs` re-exports them (`pub use mini_diarium_core::{auth, crypto, db, …};`, and core in turn re-exports `crypto`/`auth` from the crypto crate), so `mini_diarium_lib::{crypto,auth,db}::…` bench imports resolve unchanged through the two-hop re-export. `db_bench` also reaches `mini_diarium_lib::commands::search` (an app-crate module). All three crates set `[lib] bench = false`.

7. **Auth bench uses `sample_size(10)` intentionally** — Argon2id takes 100–300 ms per
   sample; 10 samples (~30–60 s) is sufficient for trend tracking without blocking CI.
   Do not increase `sample_size` on this group.

8. **Auth bench alerts on slowdowns only** — criterion tracks regressions (things getting
   slower). It does NOT alert if Argon2id gets faster/weaker (e.g. reduced iterations).
   Guarding against weakened parameters requires a dedicated unit test checking minimum
   param values — that is a separate concern from performance benchmarking.

9. **`parseMarkdownToHtml` benchmarks do not appear on the dashboard** — they are frontend Vitest benchmarks not run in CI. Only the 18 Rust benchmarks are in `data.js` and rendered on the report page. Do not add them to `SECTIONS` or `THRESHOLDS` unless the CI workflow is also updated to run and store frontend results.

10. **Threshold values are initial estimates** — they are calibrated from interpretation text and domain knowledge, not from actual CI data. Once real data flows, review and tighten/relax as needed.

11. **`chartjs-plugin-annotation` must match Chart.js v4** — the report page loads `chartjs-plugin-annotation@3` which is the major version compatible with Chart.js 4. Do not upgrade one without the other.
