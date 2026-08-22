---
name: seo-performance-review
description: Applies to Mini Diarium's marketing site (`website/`) and its SEO data under `docs/seo/`. Use this recurring, data-driven review when the user has fresh (or wants to pull) Google Search Console / Bing Webmaster performance exports and asks to turn them into ranked, actionable recommendations. Triggers include "SEO performance review," "GSC data," "Search Console export," "Bing keyword report," "how are we ranking now," "what should I write next," "SEO content briefs," "striking distance," "CTR gaps," "update the SEO action plan," or "run the SEO cycle." This is distinct from `seo-audit` (technical on-page auditing): this skill analyzes performance data over time and produces content briefs and an updated action plan. If the user wants a technical/on-page audit instead, use `seo-audit`.
metadata:
  version: 1.1.0
  cadence: bi-weekly (weekly is noise at current volume)
---

# SEO Performance Review

You convert each new Google Search Console + Bing Webmaster export into ranked, actionable
recommendations for Mini Diarium. This is a **performance-data** skill, not an on-page audit.
For technical/on-page issues use `seo-audit`. The two are complementary and share the
`docs/seo/product-marketing-context.md` brand context.

**Cadence:** recommend **bi-weekly** at the current traffic (~455 Google clicks / quarter).
Weekly is noise; GSC also lags 2-3 days. Do not run more often than the data can support.

## Step 0 - Read context first

Read, in this order, before touching data:
1. `docs/seo/product-marketing-context.md` - brand, ICP, owned topic, the password/lock accuracy
   guardrail.
2. `docs/seo/STRATEGY.md` - the analysis framework, the keyword & topic-cluster map, the
   budget model (transfer/freeze/flip), and the measurement regime this skill executes. **The
   cluster map in STRATEGY.md §3 is the scoring rubric for topical coverage.**
3. `docs/seo/action-plan.md` - the live fix queue and the hypothesis log you will update.
4. The previous `docs/seo/STATUS_REPORT_*.md` (most recent by date) - the prior snapshot you
   compare against for movement.

Do not re-derive the strategy. Apply it.

## Step 1 - Locate the latest exports (by pattern, never hardcoded names)

Exports live under `docs/seo/performance/`, one dated subfolder per cycle:
`docs/seo/performance/<YYYY-MM-DD>/`, holding every file for that pull under its original
downloaded filename. **Match by filename pattern within the newest dated folder**, never
hardcode names — the pattern already changed once (Bing renamed the overview file), and
zips are kept unextracted. Expect up to five files per cycle:

- **GSC main export** — `*-Performance-on-Search-<date>.zip` (not `*Generative-AI*`): contains
  `Queries.csv`, `Pages.csv`, `Countries.csv`, `Devices.csv`, `Chart.csv`, `Filters.csv`,
  `Search appearance.csv`. Extract to a temp dir to read; do not commit the extraction — the
  zip as downloaded is the tracked copy.
- **GSC AI Overview export** — `*-Performance-on-Search-Generative-AI-Features-<date>.zip`: same
  shape minus `Queries.csv` (Google does not break this report out by query). Impressions-only —
  no clicks/CTR/position. See Step 3.
- **Bing overview CSV** — `*SearchPerformanceOverview*.csv` (daily clicks/impressions/CTR).
- **Bing query-level CSV** — `*KeywordReport*.csv` (per-keyword impressions/clicks/CTR/position).
- **Bing AI/Copilot citations CSV** — `*AIPerformanceOverviewStats*.csv` (daily `Citations` /
  `Cited Pages` counts). See Step 3.

A folder may also hold stray non-export files (e.g. leftover placeholder text files from manual
reorganization) — ignore anything that doesn't match these patterns rather than erroring, but
flag unrecognized files to the user instead of silently treating them as data.

Older cycles (pre-2026-08) may still use the legacy layout: GSC CSVs extracted into a nested
`google-search-console_<date>/` folder, Bing CSVs loose directly under `docs/seo/performance/`
with no dated wrapper, and no AI-performance exports at all. Treat those as historical — read
them for the prior-cycle comparison in Step 2/3, but do not rewrite them into the new layout.

Find the newest dated folder and the immediately prior one (the last STATUS_REPORT names which
cycle it came from). If the newest export is older than ~3 weeks, it is **stale**: guide the
user to pull fresh data before analyzing (Step 1a). Do not analyze stale data silently.

### Step 1a - Guide a fresh pull when stale

If exports are stale or missing, walk the user through it (this is manual; the skill cannot
authenticate). Save everything under one new `docs/seo/performance/<today>/` folder, original
filenames, zips left unextracted:
- **Google Search Console** (search.google.com/search-console): Performance > Search results >
  set date range to Last 3 months > Export > download the zip. Then repeat with the **AI
  Overview** filter applied (Search appearance > AI Overview, or the "Generative AI Features"
  report if offered directly) > Export > download that second zip.
- **Bing Webmaster Tools** (bing.com/webmasters): Search Performance > export the overview CSV;
  then the **Keyword** report > export the query-level CSV; then the **AI** / Copilot performance
  view > export the citations CSV.

## Step 2 - Run the analysis framework, per engine

Execute the measurement regime from `STRATEGY.md` §5 for **both** engines. Respect the GSC
caveats: position is an *average*, data is sampled (low-impression rows dropped), reporting
lags 2-3 days. Aggregate low-impression rows before drawing conclusions; single-digit-impression
rows are statistically fragile.

Produce these tables (Google from `Queries.csv`/`Pages.csv`, Bing from `KeywordReport`):

1. **Branded vs non-branded split.** Branded = "mini diarium" and close variants. Report the
   clicks share and whether generic demand is being captured.
2. **Striking distance (position ~8-20 with real impressions).** These are the near-term rank
   wins. Rank them by impressions.
3. **CTR gap (high-impression / low-CTR relative to position).** These are the title/meta
   levers. A page at position ~7 with sub-2% CTR is a flag.
4. **Topical-coverage score against the cluster map** (`STRATEGY.md` §3). For each cluster,
   note the owning page, its position, and whether a gap exists (demand with no strong owning
   page). Prioritize procedural/comparison gaps (highest LLM absorption).
5. **Movement vs the previous snapshot.** For the tracked queries/pages, note direction of
   change. This validates the prior cycle's hypotheses (see the hypothesis log).
6. **Google-vs-Bing divergence check.** Bing is Windows/PC-first and surfaces predecessor
   ("mini diary" successor) and feature-intent ("does diarium have a password", "offline
   encrypted diary") demand that Google under-reports. Every recommendation must account for
   both engines: Google = topic/positioning terms; Bing = platform + successor + feature intent.

## Step 3 - GEO citation check

Since 2026-08, two real measured data sources exist per cycle (Step 1) and are the **primary**
signal for the engines they cover — prefer them over the manual spot-check where they overlap:

- **Google AI Overviews** — the AI-Overview zip's `Pages.csv` (which URLs surfaced in an AI
  Overview and how often, impressions-only) and `Chart.csv` (daily trend). No query breakdown
  and no clicks/CTR/position — Google does not expose that for this surface. Compare a page's
  AI-Overview impressions against its total impressions in the main export's `Pages.csv` to see
  what share of its visibility is AI-Overview-driven.
- **Bing / Copilot** — the `*AIPerformanceOverviewStats*.csv`'s daily `Citations` and
  `Cited Pages` counts. A direct, comparable-cycle-over-cycle citation-volume KPI.

Still run the fixed ~30-query set in
[`references/geo-citation-queries.md`](references/geo-citation-queries.md) for **ChatGPT and
Perplexity**, which publish no exportable performance data:

- **Attempt automation** with the available web/browser tools where possible (e.g. Perplexity
  via the browser tool). Record, per engine and per query: (a) whether mini-diarium.com is
  cited, and (b) whether the answer language was absorbed (the answer reflects the site's
  framing).
- **Fall back to a manual checklist** when a platform cannot be automated (most chat UIs).
  Present the query set as a checklist for the user to run and paste back.
- Also use the spot-check to sanity-check *which* queries are plausibly driving the Google/Bing
  AI numbers, since neither export breaks out by query.

Report all four engines together. This is a separate KPI from GSC ranking (`STRATEGY.md` §5). Do
not overstate: the Google/Bing counts are real but still small-sample at this traffic volume, and
the ChatGPT/Perplexity spot-check stays a directional baseline, not a precise metric.

## Step 4 - Output prioritized content briefs (do not auto-draft)

For each recommended new or refreshed post, output a **content brief** using
[`references/content-brief-template.md`](references/content-brief-template.md). Rank briefs by
expected leverage (impressions x CTR-gap or striking-distance proximity). Each brief:

- Target query + cluster placement (from `STRATEGY.md` §3).
- Current position / impressions / engine.
- Working title (<=60 chars, click-worthy, not a feature list).
- BLUF (50-80 words, self-contained, names products/trade-off/constraint) for `BLUF_MAP`.
- H2 outline (each section a distinct purpose; include H2/H3 Q&A for question intent).
- Required internal links (>=2 of `/encrypted-journal/`, `/compare/`, related posts).
- Any accuracy guardrails that apply (e.g. the password/lock rule for that cluster).

**Do not write the post.** Hand the brief to the blog workflow (`website/CLAUDE.md`) so the
human/author controls voice per `WRITING_STYLE.md` and the AI-writing rules. Also decide, for
existing pages, **refresh vs new**: if a page already owns the cluster (e.g.
`mini-diary-alternative` for predecessor demand), recommend strengthening it rather than a new
post.

## Step 5 - Update the action plan and hypothesis log

1. Write a new dated status report if the user wants a full snapshot:
   `docs/seo/STATUS_REPORT_<YYYY-MM>.md` (follow the structure of the existing one). Otherwise
   update the existing snapshot's "movement" notes.
2. Update `docs/seo/action-plan.md`: mark completed items, re-rank open items against the new
   data, add new items (with file/location, exact change, expected effect, verification
   command).
3. **Append to the hypothesis log** in `action-plan.md`: validate last cycle's hypotheses by
   directional movement (we cannot prove causation at this traffic scale), and record this
   cycle's changes as new hypotheses with expected direction. Append, never rewrite history.
4. If the cluster map's positions have shifted materially, note it so `STRATEGY.md` §3 can be
   refreshed (positions there are a point-in-time snapshot).

## Guardrails

- **Never auto-draft blog posts.** Produce briefs; the author writes.
- **Respect the password/lock accuracy guardrail** (`docs/seo/product-marketing-context.md`, read
  in Step 0) in any brief for the secure/password cluster: whole-journal AES-256-GCM + per-entry
  edit-lock, never per-entry encryption.
- **Honest about scale.** ~455 clicks/quarter is far below the ~500k monthly visitors needed
  for valid split testing. Report directional signals and hypotheses, not causal claims.
- **Freeze non-transferring signals.** Do not recommend keyword-density, anchor-text, paid-link
  velocity, or SERP-feature chasing work (`STRATEGY.md` §4).
- This skill reads and writes `docs/seo/`; it does not touch `website/` HTML directly. On-site
  changes go through the blog/docs generators and the action plan.

## References

- [`references/geo-citation-queries.md`](references/geo-citation-queries.md) - the fixed ~30-query
  GEO citation spot-check set, grouped by cluster.
- [`references/content-brief-template.md`](references/content-brief-template.md) - the content
  brief hand-off template.
