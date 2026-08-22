# Mini Diarium: SEO / GEO + Growth Hub

This directory is the single home for Mini Diarium's SEO, GEO (generative engine
optimization), and growth material. It applies to the static marketing site under
`website/`. If you are looking for how a user-facing product feature behaves, that lives in
`website/docs-src/`, not here.

## Start here

Read in this order:

1. [`product-marketing-context.md`](product-marketing-context.md) - what the product is, the
   ideal customer profile, brand voice, and the password/lock accuracy guardrail. Both SEO
   skills read this first.
2. [`STRATEGY.md`](STRATEGY.md) - the durable strategy: what to do next, the keyword and
   topic-cluster map (§3), the budget model (§4), and the measurement regime (§5).
3. The latest [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md) plus
   [`action-plan.md`](action-plan.md) - the current state and the live fix queue.

## Where SEO / GEO + growth material lives now

| Concern | Owner |
|---|---|
| Durable strategy + keyword/cluster map (§3) + budget/measurement regimes | [`STRATEGY.md`](STRATEGY.md) |
| Brand facts, ICP, voice, competitors, accuracy guardrail | [`product-marketing-context.md`](product-marketing-context.md) |
| Dated point-in-time health snapshots (append-only) | [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md) (latest `STATUS_REPORT_*.md`) |
| Live prioritized fix queue + hypothesis log | [`action-plan.md`](action-plan.md) |
| Evidence base (corpus, source tiers, open questions) | [`research/`](research/) |
| Raw performance exports (GSC + Bing) | [`performance/`](performance/) |
| Growth / distribution (newsletter, Product Hunt launch) | [`growth/`](growth/) |
| On-page technical audit method | [`.agents/skills/seo-audit/`](../../.agents/skills/seo-audit/) |
| Recurring data-driven review method | [`.agents/skills/seo-performance-review/`](../../.agents/skills/seo-performance-review/) |
| Website-facing workflow (blog/docs build, IndexNow, monitoring cadence) | [`website/CLAUDE.md`](../../website/CLAUDE.md) |

Each concern has exactly one owner. Other documents point to the owner rather than restating
it. The full accuracy guardrail statement lives only in `product-marketing-context.md`;
everywhere else states a one-line summary and links back.

## Archive / history

Superseded SEO documents live under [`../archive/`](../archive/). Status:

- [`../archive/SEO_REVIEW_2026.md`](../archive/SEO_REVIEW_2026.md) - the May 2026 audit.
  **Still load-bearing:** `action-plan.md` P4 items and its Verification Checklist reference
  it. Do not delete.
- [`../archive/seo-fix-plan.md`](../archive/seo-fix-plan.md) - completed May 2026 execution
  plan, superseded by `action-plan.md`.
- [`../archive/seo-geo-implementation-plan.md`](../archive/seo-geo-implementation-plan.md) -
  completed May 2026 execution record of the audit above.

## Boundaries

- Raw CSVs stay under `performance/` for verifiability. Do not delete them or reintroduce a
  zipped bundle.
- External sources live only as `https://` URLs in `research/bibliography.md` (for re-fetch).
  No external-filesystem paths anywhere under this directory.
- Never edit generated website output (`website/blog/`, `website/docs/`, `sitemap.xml`,
  `llms.txt`, `feed.xml`) by hand. Change the Markdown sources and rebuild.
- Never edit the skill mirrors (`.claude/skills/`, `.pi/skills/`). Edit `.agents/skills/` and
  run `bun run sync-skills`.
