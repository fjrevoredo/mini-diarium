# SEO & GEO for mini-diarium: An Evidence-Grounded Research Corpus

> **Vendored into the repository on 2026-07-13.** This is a tracked copy of a deep-research
> report originally produced outside the repo. It is preserved verbatim (aside from this note
> and the two relative-path fixes to its sibling files) so `docs/seo/STRATEGY.md` can cite a
> stable source with its evidence-quality tiers (A/B/C) rather than an untracked folder.
> Its companion files live alongside it: [`bibliography.md`](bibliography.md) (per-source
> quality tiers) and [`gaps.md`](gaps.md) (open questions, contested claims, deferred sources).
> Preserve the corpus's "up to" / directional language when quoting it: no single-study effect
> size (40% lift, 2.35x retrieval, etc.) is a guarantee.

**Prepared for:** the downstream analysis agent.
**Scope:** empirical and science-based grounding for content & brand strategy,
to replace "vibe checks" with a defensible method.
**Context:** mini-diarium is a local-first encrypted desktop journal app; the
site (`mini-diarium.com`) already implements BLUF answers, FAQ structure,
`llms.txt`/`ai-crawlers.txt`, JSON-LD, IndexNow, and a keyword map. This
corpus *validates, prioritizes, and methodizes* that existing work; it does
not replace the GSC/BWT data analysis, which the downstream agent performs.

> **Reading guide.** Every claim below traces to a `src_NNN` (see
> [`bibliography.md`](bibliography.md) for source quality tiers and re-fetch URLs). Evidence tiers:
> **A** = peer-reviewed / large-N transparent methodology;
> **B** = practitioner large-scale study or vendor with disclosed method;
> **C** = third-party synthesis / leak-derived (directional only).
> Contested claims are flagged inline.

---

## 1. Executive Summary (actionable)

1. **The strategy is already directionally correct; the job now is depth,
   measurement, and reallocation.** The research independently validates the
   site's BLUF/FAQ/llms.txt design as near-optimal for GEO [fnd_011, fnd_013,
   fnd_024, ins_003]. The highest-leverage *new* work is editorial polish and
   disciplined measurement, not new infrastructure.

2. **Own the topic, not the keyword.** For a low-DR niche brand, **topical
   authority is the single highest-leverage strategy on both SEO and GEO axes**
   [ins_001]. A specialist can outrank DR-96 generalists by covering a topic
   completely [src_049, fnd_003], and GEO citation correlates with topical
   depth, not Domain Rating (r≈0.18 vs 0.55-0.65) [src_005, fnd_014].
   "Encrypted offline journaling" is a narrow, ownable topic.

3. **Stop split-testing the wrong way.** Statistically valid SEO A/B testing
   needs very high traffic (a practitioner threshold of ~500K monthly visitors)
   — infeasible for a niche site [src_037, fnd_007]. The correct method is
   **Google's CausalImpact** (Bayesian counterfactual time-series) on individual
   pages, with explicit controls for seasonality, core updates, and competitor
   moves [fnd_019, fnd_020, ins_002]. Every "we changed X and traffic rose"
   claim in GSC is *false evidence* without a counterfactual [fnd_008].

4. **Measure GEO as per-platform citation visibility, not ranking.** AI
   citation patterns are volatile and engine-specific (ChatGPT's Reddit share
   swung 60%→10% in two weeks while others held steady) [fnd_018]. Track
   ChatGPT, Google AI Overviews, Perplexity, and Copilot with a fixed query
   set on a recurring cadence; record both citation presence *and* answer
   absorption [fnd_011, fnd_022, ins_004]. Traditional rank trackers cannot
   produce this.

5. **Reallocate budget from non-transferring signals to dual-purpose levers.**
   Keyword density, anchor-text optimization, paid-link velocity, and
   SERP-feature targeting do **not** transfer to GEO [fnd_013, ins_006].
   Redirect growth budget to: topical-depth content (highest dual-purpose),
   FAQ schema on all top pages, above-the-fold answer blocks, dated named-author
   bylines, and brand/entity consistency [fnd_026].

6. **Treat "best practices" as hypotheses.** SearchPilot's split tests show
   best-practice changes routinely *harm* traffic (breadcrumb fixes -12%,
   price-in-title -15%) [fnd_005]. Every intervention must be measured, not
   assumed.

7. **Invest in the brand/entity layer as a durable compounder.** For a
   privacy/encryption product (quasi-YMYL-adjacent), consistent Organization/
   Person schema, verifiable author identity, and presence on trusted profiles
   feed both Google's entity model and LLM source-trust heuristics [fnd_001,
   fnd_025, ins_005].

8. **Two honest caveats.** GEO is a ~2-year-old field; effect sizes (40% lift,
   2.35x retrieval) are single-study and may not generalize. The Content
   Warehouse leak shows *what Google measures*, not *how much it weights*.
   The corpus grounds *direction and priorities*, not exact ROI [ins_007].

---

## 2. Pillar A — Classical SEO Ranking Evidence

### 2.1 What Google actually measures (the May 2024 leak) [Tier C — directional]

The May 2024 Content Warehouse API leak exposed ~14,000 internal documents
confirming several long-suspected signals Google had publicly denied [src_042,
src_039, src_041, fnd_001]:

| Leaked field | Confirmed meaning |
|---|---|
| `siteAuthority` | Domain-wide quality score (Google long denied "domain authority") |
| `navBoost` | **User behavior from Chrome**: CTR, dwell time, pogo-sticking |
| `chromeInTotal` | Chrome interaction counts per URL |
| `sourceType` | Content classification (editorial / UGC / syndicated); *analyst-inferred* ~3x editorial weight |
| `lastSignificantUpdate` | Freshness decay (content >3yrs demoted) |
| `pageEmbeddingsVersion` | Semantic/entity understanding (BERT/MUM) |
| `raffia` | Link-graph analysis, disavow processing, PageRank variants |

**Critical caveat:** the leak shows *field names*, not *weights*. Google called
interpretations "out of context." The strongest defensible takeaway is that
**user-behavior signals (navBoost) are real and measured**, which makes GSC
CTR/position data a legitimate (indirect) window into a live ranking input
[fnd_002]. Do not quote specific multipliers as confirmed.

### 2.2 Topical authority > domain authority for niche sites [Tier A/B]

Ahrefs' data studies show topical authority is **distinct from** Domain Rating
and is the mechanism by which a low-DR specialist outranks a high-DR
generalist: Bicycle Motor Works (DR 15) outranks Amazon (DR 96) for
competitive e-bike keywords and earns regular AI Overview appearances "simply
because it owns the topic better" [src_049, fnd_003]. Topical authority compounds — a
single authoritative page ranks for far more queries than it explicitly
targets [src_049, fnd_004]. This is the most important classical-SEO finding for
mini-diarium.

### 2.3 Links still matter, but quality/relevance > quantity [Tier B]

Practitioner consensus (2025-2026) treats backlinks as still material but
declining relative to content and user signals; link *quality and relevance*
dominate raw quantity, consistent with the leak's editorial-weighting [src_008,
src_004, fnd_006].

### 2.4 Best practices are frequently wrong when tested [Tier A]

Controlled SEO split tests (SearchPilot) repeatedly disprove "best practices":
fixing breadcrumb markup errors *caused a 12% traffic drop*; adding price to
title tags *caused a 15% drop*; adding alt text had *no effect* [src_038,
fnd_005].
**There are no golden rules — everything must be measured.** This is the core
empirical argument against vibe-based SEO.

---

## 3. Pillar B — Generative Engine Optimization (GEO)

> **GEO = Generative Engine Optimization** (optimizing for AI/LLM search:
> Google AI Overviews, ChatGPT, Perplexity, Copilot). Confirmed by the
> site's own `BLUF_MAP`/`llms.txt` work.

### 3.1 The academic foundation [Tier A]

The foundational GEO paper (Aggarwal et al., arXiv 2311.09735) formalized
GEO and introduced GEO-bench. Key results [src_013, fnd_009]:

- GEO strategies can **boost visibility in generative engine responses by up
  to 40%**.
- Efficacy **varies by domain** — no universal winning strategy; per-domain
  tuning matters.

Follow-on peer work has refined this:

- **Structural features matter, not just semantics** (GEO-SFE, 2026): decomposing
  content into macro/meso/micro structure yields **+17.3% citation rate** and
  **+18.5% subjective quality** consistently across six generative engines
  [src_011, fnd_010].
- **E-GEO** (e-commerce, 7,000 queries, 15 heuristics) found an iterative
  optimizer beats ad-hoc heuristics and revealed a **stable, domain-agnostic
  "universally effective" GEO pattern** [src_014, fnd_012].
- **Citation selection ≠ citation absorption** (2026, 602 prompts / 21,143
  citations): ChatGPT cites fewer but higher-influence pages; high-influence
  pages are **longer, more structured, semantically aligned, and richer in
  definitions, numerical facts, comparisons, and procedural steps** [src_018,
  fnd_011]. This *directly validates* mini-diarium's BLUF design.

### 3.2 The 12-signal SEO↔GEO transferability map [Tier B/C]

A 2026 synthesis (AiBoost, calibrated against Ahrefs, Backlinko, Authoritas,
Profound, Aggarwal) maps 12 signals across classical SEO and GEO [src_005,
fnd_013]:

| Category | Signals | Implication |
|---|---|---|
| **Transfer cleanly** (7+/7+) | Topical depth, freshness, named-expert authorship, page speed, crawlability | Keep investing; free GEO dividends |
| **Do NOT transfer** (SEO 7+ / GEO ≤3) | Keyword density, anchor-text optimization, paid-link velocity, SERP-feature targeting | Freeze growth budget; redirect |
| **Flip** (4+ divergence) | **FAQ schema** (SEO 4 / GEO 9, **2.35x retrieval**), **Domain Rating** (SEO 8 / GEO 3), **answer placement** (SEO 2 / GEO 9, **2.1x citation**) | Highest-leverage additive GEO moves |

Domain Rating correlates with GEO citation at only ~0.18 vs 0.55-0.65 for
classic ranking; DR-65+ "brochureware" sites got zero citations while DR-<40
sites with genuine procedural depth got multiple [src_005, src_010, fnd_014].

### 3.3 How users actually behave with AI Overviews [Tier A]

Pew Research (68,879 searches, 900 US adults, March 2025) is the gold-standard
behavioral dataset [src_020, fnd_015, fnd_016]:

- **~18% of Google searches** produced an AI Overview.
- AI Overviews skew to **question queries (60%)** and **long queries (53% of
  10+ word vs 8% of 1-2 word)**.
- When an AI Overview appeared, users clicked traditional results **8% of the
  time vs 15% without** — and clicked an AI-summary link only **1%** of the time.
- Top cited sources: **Wikipedia, YouTube, Reddit** (~15% of AI sources);
  **.gov over-represented** in AI Overviews (6%) vs standard (2%).

**Implication:** for the queries mini-diarium targets, winning the AI Overview
citation matters more than the organic click, because the click itself is
increasingly rare.

### 3.4 Per-platform citation patterns [Tier A/B]

- **ChatGPT** favors authoritative knowledge (Wikipedia 7.8% overall) [src_019,
  src_021, fnd_017].
- **Google AI Overviews** balances social-professional (Reddit, YouTube, Quora).
- **Perplexity** is community-driven (Reddit 6.6%).
- `.com` earns 80% of citations; `.org` 11.29%.
- Patterns are **volatile and engine-specific**: ChatGPT's Reddit share
  collapsed 60%→10% in mid-Sept 2025 while others held steady [src_022,
  fnd_018].

**Implication:** a one-size-fits-all GEO strategy cannot succeed; track each
platform separately (ins_004).

---

## 4. Pillar C — Scientific Analysis of GSC / BWT Data

### 4.1 The methodological constraint

True SEO A/B split testing is recommended only for very high-traffic
page-groups; the cited practitioner threshold is roughly **500,000 monthly
organic visitors or more** to reliably detect effects [src_037, fnd_007]. This
is a practitioner heuristic (the underlying statistical-power logic holds at
any scale), but it is far above mini-diarium's traffic, so classical split
testing is **infeasible** here. The methodology must adapt.

### 4.2 The correct method: CausalImpact + confound control [Tier A]

The validated low-traffic method is **Google's CausalImpact** — a Bayesian
structural time-series model that builds a synthetic counterfactual
("synthetic control") to estimate the causal effect of an intervention when no
clean control group exists [src_037, src_031, src_034, fnd_019]. The
Distilled/SearchPilot DIY split tester wraps CausalImpact for free use.

The non-negotiable confounders to control for [src_038, src_036, fnd_020]:

1. **Seasonality** (e.g., journaling/privacy queries spike in January / around
   data-breach news cycles).
2. **Google core/helpful-content update dates** (correlate changes to known
   update windows before attributing to your edit).
3. **Competitor moves** (a rank drop may be a competitor's gain, not your loss).

### 4.3 Why before/after and rank-tracking mislead [Tier A]

- **Before/after** is confounded — it "will be impossible to detect small
  effects, and larger impacts can be caused by confounding effects" [src_038,
  fnd_008].
- **Rank tracking** cannot capture CTR or the full keyword universe; positions
  are sampled/averaged [src_038, fnd_008, fnd_021].
- **Client-side A/B scripts** are unsuitable (Google may not render JS; layout
  shift harms Core Web Vitals) [src_038, fnd_008].

### 4.4 GSC data limitations to respect [Tier A]

GSC data is sampled/aggregated (low-impression rows are dropped), position is
an *average* not an exact rank, reporting lags 2-3 days, and there is no
per-user attribution [src_037, src_038, fnd_021]. Conclusions from small-impression rows are
statistically fragile — aggregate up before interpreting.

### 4.5 For GEO, measure citation visibility, not position [Tier A]

The correct GEO measurement object is **citation visibility / absorption**,
not ranking position [src_018, src_013, fnd_022]. Prompt each target engine with a fixed,
representative query set on a recurring cadence; record (a) citation presence
and (b) whether the answer language was absorbed. Treat this as a separate
KPI from GSC position/CTR.

---

## 5. Pillar D — Content & Brand Strategy with Evidence

### 5.1 The topical-authority build [Tier A/B]

The evidence-based build [src_049, src_050, fnd_023]: topic-based keyword research (seed + all
subtopics + question angles) → clusters → pillar pages + cluster content →
internal links → consistent on-topic publishing → keep clusters complete and
fresh. This is the highest dual-purpose lever for both SEO and GEO [ins_006].

### 5.2 The convergent high-evidence content design [Tier A]

Four independent sources converge on the same content shape that maximizes
both ranking and LLM citation [src_013, src_011, src_018, src_005, fnd_024]:

- A **self-contained 50-80-word direct answer above the first H2** (the BLUF).
- **FAQ-style structured Q&A with matching schema.**
- **Extractable evidence units**: definitions, numerical facts, comparisons,
  procedural steps.
- **Named expert authorship** with verifiable credentials.
- **Macro/meso/micro structural clarity.**

**Mini-diarium's existing `BLUF_MAP` + FAQ + llms.txt design already
implements this.** The research validates the design; remaining work is
coverage and polish, not redesign.

### 5.3 The additive GEO moves (no new content needed) [Tier B/C]

Per the transferability synthesis, the highest-leverage additive moves are
editorial and can be applied to existing top pages within a quarter [src_005,
fnd_026]:

1. **FAQ schema with body-mirrored Q&A** on all top commercial pages.
2. A **50-80-word direct-answer block above the first H2** on every page in
   that set.
3. **Dated named-author bylines.**

The synthesis reports these typically add ~30-50% to GEO citation rate within
one quarter without harming classic SEO (single-agency panel result; treat as
directional, not guaranteed). Consider a **"generative-search editor"** role
owning these signals.

### 5.4 The brand/entity compounder [Tier B/C]

For a privacy/encryption product (quasi-YMYL-adjacent), establishing a
consistent, verifiable entity is a long-compounding authority signal [src_042,
src_020, fnd_025, ins_005]: consistent Organization/Person schema, verifiable author identity
(Francisco J. Revoredo), presence on trusted profiles, and a consistent entity
description across the web. The leak confirms Google maintains an entity model
(`pageEmbeddingsVersion`); Pew shows authoritative/.gov sources are
over-cited in AI Overviews. This is a strategic brand investment, not a tactic.

---

## 6. A Methodical Procedure for the Downstream Agent

A repeatable, evidence-grounded cycle the analysis agent can run quarterly:

1. **Baseline pull.** Export GSC + BWT (3-month window) into `docs/seo/`.
   Aggregate low-impression rows; note the sampling caveat (fnd_021).

2. **Causal attribution of prior changes.** For each SEO/GEO change made since
   the last cycle, run CausalImpact on the affected page(s) against an
   unaffected comparator, controlling for seasonality + core-update dates +
   competitor moves (fnd_019, fnd_020, ins_002). Record which changes actually
   moved the needle vs. rode confounders.

3. **Topical-coverage audit.** Map the owned topic ("encrypted offline
   journaling") into subtopics + question angles. Score current coverage;
   identify gaps (fnd_023, ins_001). Prioritize filling procedural/comparison
   gaps (high absorption per fnd_011).

4. **GEO citation baseline.** Prompt ChatGPT, Google AI Overviews, Perplexity,
   and Copilot with a fixed ~30-query set representing owned queries. Record
   citation presence + absorption per engine (fnd_022, ins_004). This is the
   GEO KPI, separate from GSC.

5. **Editorial GEO pass.** On all top commercial pages, verify: FAQ schema with
   body-mirrored Q&A; 50-80-word direct-answer above first H2; dated named-author
   byline (fnd_024, fnd_026, ins_003).

6. **Budget reallocation check.** Ensure no growth budget is flowing to
   non-transferring signals (keyword density, anchor-text, paid-link velocity,
   SERP-feature chasing); redirect to topical depth, FAQ schema, answer
   placement, entity authority (fnd_013, ins_006).

7. **Brand/entity consistency check.** Verify Organization/Person schema,
   author identity, and consistent entity description across trusted surfaces
   (ins_005).

8. **Hypothesis log.** Record each intervention as a testable hypothesis with
   expected effect; validate next cycle against the CausalImpact + per-platform
   citation baselines. Treat best-practice assumptions as hypotheses, not rules
   (fnd_005).

---

## 7. Evidence-Quality & Honesty Notes

- **Causal vs correlational:** most SEO "ranking factors" are observed
  correlations. True causal evidence is rare (the SearchPilot/Seznam class).
  The report separates the two throughout.
- **GEO maturity:** the field is ~2 years old. Effect sizes are single-study or
  agency-panel; quote as "up to" / "in controlled tests," never as guarantees
  [ins_007].
- **Leak caveat:** the Content Warehouse leak shows field names, not weights;
  Google called interpretations "out of context" [fnd_001].
- **Niche transferability:** academic GEO benchmarks cover general/web/e-commerce,
  not "privacy software / local-first journaling." Validate per-niche [gaps.md].

See [`gaps.md`](gaps.md) for the full open-questions, contested-claims, and
deferred-sources list, and [`bibliography.md`](bibliography.md) for per-source quality
tiers.
