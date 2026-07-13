# Bibliography — Source Quality Notes

Quality tiers:
- **A — Primary/transparent:** peer-reviewed or large-N with disclosed,
  reproducible methodology. Cite for effect sizes.
- **B — Practitioner large-scale:** vendor/agency with disclosed method and
  meaningful sample. Cite for directional claims; corroborate for effect size.
- **C — Synthesis/derived:** third-party synthesis, leak-derived, or
  single-anecdote. Directional only; never sole source for a number.

Status: **used** = cited in a finding; **discarded** = reviewed and dropped
(reason below); **deferred** = corroborating context (see [`gaps.md`](gaps.md)).

## Pillar A — Classical SEO

| ID | Source | Tier | Status | Best for |
|---|---|---|---|---|
| src_008 | Search Engine Land — "How important are backlinks for SEO in 2026?" | B | used | Practitioner consensus on link-value shift (fnd_006) |
| src_042 | williejiang — Content Warehouse API leak playbook | C | used | Leak field-name inventory (fnd_001, fnd_002). **Caveat:** field names ≠ weights; weights are inferred |
| src_039 | hobo-web — Core Web Vitals after the leak | C | deferred | Corroborating leak analysis (gaps.md) |
| src_040 | seoworkflows — Content Warehouse leak | C | deferred | Corroborating leak analysis |
| src_041 | nullstacks — what 14,000 factors reveal | C | deferred | Most detailed secondary leak read |
| src_043, src_044 | hobo-web / trapilot — leak coverage | C | deferred | Corroborating leak analysis |
| src_049 | Ahrefs — "Topical Authority" (2026) | B | used | Topical authority > DR; specialist-outranks-generalist (fnd_003, fnd_004, fnd_023). Disclosed data, long-standing practitioner authority |
| src_050 | Moz — blog topic clusters | B | deferred | Origin of pillar/cluster methodology |
| src_045-src_048 | topical-authority / cluster guides | C | deferred | Corroborating cluster-design pattern |
| src_004 | rockingweb — 100K-URL backlink study | B | deferred | Corroborates backlink scale (fnd_006) |
| src_010 | ranktracker — domain-authority statistics | C | deferred | Corroborates DR discussion |
| src_006 | voxbooster — SEO statistics 2026 | C | discarded | Aggregated stat list, no primary method |
| src_001, src_002, src_003 | backlinks/title-tags vendor blogs | C | discarded | Single-factor vendor/aggregator content |
| src_007 | ahrefs.com homepage | — | discarded | No content |
| src_009 | pagepilot Shopify SEO | — | discarded | Off-scope (Shopify-specific) |

## Pillar B — Generative Engine Optimization (GEO)

| ID | Source | Tier | Status | Best for |
|---|---|---|---|---|
| src_013 | Aggarwal et al. — "GEO: Generative Engine Optimization" (arXiv 2311.09735) | A | used | **Foundational GEO paper.** GEO-bench; ≤40% visibility lift; domain-variance (fnd_009) |
| src_011 | Yu et al. — "Structural Feature Engineering for GEO" (arXiv 2603.29979) | A | used | Macro/meso/micro structure; +17.3% citation / +18.5% quality across 6 engines (fnd_010) |
| src_018 | Zhang Kai et al. — "Citation Selection to Absorption" (arXiv 2604.25707) | A | used | 2-stage measurement; high-influence page traits (fnd_011) |
| src_014 | Bagga et al. — "E-GEO" e-commerce testbed (arXiv 2511.20867) | A | used | 7K queries; "universally effective" GEO pattern (fnd_012) |
| src_005 | AiBoost — GEO-vs-SEO 12-signal transferability map | B/C | used | Signal transfer/flip map; FAQ schema 2.35x, answer-placement 2.1x (fnd_013, fnd_014). Transparent calibration against named studies; agency panel |
| src_020 | Pew Research — AI Overviews click behavior (Jul 2025) | A | used | **Gold-standard behavioral data.** 68,879 searches; click-rate halving (fnd_015, fnd_016) |
| src_022 | SEMrush — Most-cited domains in AI (Nov 2025) | B | used | 230K prompts/13 wks/100M citations; volatility evidence (fnd_018) |
| src_019 | Profound — AI platform citation patterns | B | used | 680M citations; per-platform sourcing philosophy (fnd_017) |
| src_021, src_027 | SurferSEO / digitalbloom — AI citation reports | B | deferred | Corroborate most-cited-domain findings |
| src_028 | wellows — AI Overviews ranking factors | C | discarded | Generic vendor blog |
| src_024, src_026 | otterly / everything-pr | C | discarded | Vendor/PR blog, low signal |
| src_023, src_025 | LinkedIn / Reddit social posts | — | discarded | Anecdotal, not evidence-grade |
| src_012 | SERP structures (2015) | A | discarded | Too old for current GEO claims |

## Pillar C — Scientific Method / GSC-BWT Analysis

| ID | Source | Tier | Status | Best for |
|---|---|---|---|---|
| src_038 | SearchPilot — "DIY SEO Testing Pitfalls" | A/B | used | **Best-practices-wrong evidence** (breadcrumb -12%, title -15%); confound warnings (fnd_005, fnd_008). Leading experimentation vendor |
| src_037 | loganbryant — SEO A/B testing in-depth guide | B | used | 500K-visitor threshold; CausalImpact method + Pinterest/Etsy history (fnd_007, fnd_019) |
| src_031 | Alex Deng (Microsoft) — causal/A-B intro | A | deferred | Authoritative causal-inference methodology reference (deeper reading) |
| src_034, src_036 | synthetic-control / split-testing explainers | B | deferred | Corroborate CausalImpact methodology |
| src_029, src_030, src_033, src_035 | SearchPilot/wrenda product pages | — | discarded | No methodological content |
| src_032 | Stanford causal-inference PDF | A | discarded | Blocked by anti-bot; no content extracted |

## Tier-A sources the downstream agent should read first

For maximum evidence density per minute:

1. **src_013** (Aggarwal GEO) — the foundational paper; read for the formal
   framework and the domain-variance caveat.
2. **src_020** (Pew) — the only independent, methodologically transparent
   behavioral study of AI Overviews; the click-rate-halving number is the
   single most defensible GEO datum.
3. **src_018** (citation absorption) — the clearest guide to *what content
   shape* gets absorbed, not just cited.
4. **src_011** (GEO-SFE) — the structural-feature evidence that validates
   mini-diarium's BLUF/structural approach.
5. **src_038** (SearchPilot pitfalls) — the discipline of why every change
   must be measured, with concrete counterexamples.

## Known conflicts / corroboration needs

- **DR's GEO role:** src_005 reports r≈0.18; src_049 shows low-DR specialists
  outranking high-DR generalists on owned topics. **Consistent direction**
  (DR matters less for GEO/authority than for raw ranking); the exact
  coefficient spans studies and should not be over-precise.
- **GEO effect sizes:** src_013 (≤40%), src_005 (2.35x, 2.1x), src_011 (17.3%)
  each come from different benchmarks. They are directionally consistent but
  not directly comparable; quote each in its own units.
- **Leak weights:** src_042 and the deferred leak analyses (src_039-041,
  src_043-044) sometimes assert specific multipliers. None are Google-confirmed;
  treat all as inferred.

## Source URLs (for re-fetching)

Self-contained record of every source behind the `src_NNN` citations, ported from the
original research workspace's source index so the corpus does not depend on any external
filesystem location. These are the original references; re-fetch from the URL if the source
content is needed. `cited` marks IDs that appear anywhere in this corpus (a finding or a tier
table above), versus sources that were reviewed but never referenced.

| ID | Cited | Status | URL |
|---|---|---|---|
| src_001 | yes | discarded | https://web.swipeinsight.app/posts/how-crucial-are-backlinks-for-seo-in-2024-6432 |
| src_002 | yes | discarded | https://www.clickrank.ai/title-tags-a-google-ranking-factor/ |
| src_003 | yes | discarded | https://www.rankability.com/ranking-factors/google/backlinks/ |
| src_004 | yes | used | https://www.rockingweb.com.au/how-many-backlinks-top-ranking-pages-100000-url-study/ |
| src_005 | yes | used | https://aiboost.co.uk/geo-vs-seo-12-signal-transferability-map/ |
| src_006 | yes | discarded | https://voxbooster.com/blog/seo-statistics-2026/ |
| src_007 | yes | discarded | https://ahrefs.com/ |
| src_008 | yes | used | https://searchengineland.com/backlinks-seo-importance-442529 |
| src_009 | yes | discarded | https://pagepilot.ai/blog/on-page-seo-shopify |
| src_010 | yes | used | https://www.ranktracker.com/blog/domain-authority-statistics-2025/ |
| src_011 | yes | used | http://arxiv.org/abs/2603.29979v1 |
| src_012 | yes | discarded | http://arxiv.org/abs/1511.05802v1 |
| src_013 | yes | used | http://arxiv.org/abs/2311.09735v3 |
| src_014 | yes | used | http://arxiv.org/abs/2511.20867v1 |
| src_015 | - | discarded | http://arxiv.org/abs/1407.1133v1 |
| src_016 | - | discarded | http://arxiv.org/abs/2606.05868v1 |
| src_017 | - | discarded | http://arxiv.org/abs/1808.06100v6 |
| src_018 | yes | used | http://arxiv.org/abs/2604.25707v2 |
| src_019 | yes | used | https://www.tryprofound.com/blog/ai-platform-citation-patterns |
| src_020 | yes | used | https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/ |
| src_021 | yes | used | https://surferseo.com/blog/ai-citation-report/ |
| src_022 | yes | used | https://www.semrush.com/blog/most-cited-domains-ai/ |
| src_023 | yes | discarded | https://www.linkedin.com/posts/donnellychris_google-seo-is-dead-ai-citation-is-the-new-activity-7371511928285712384-qOhI |
| src_024 | yes | discarded | https://otterly.ai/blog/how-to-track-monitor-google-ai-overviews/ |
| src_025 | yes | discarded | https://everything-pr.com/google-ai-overviews-citation-source-index-2026 |
| src_026 | yes | discarded | https://www.reddit.com/r/AskMarketing/comments/1ndza1h/has_schema_actually_helped_anyone_get_cited_in_ai/ |
| src_027 | yes | used | https://thedigitalbloom.com/learn/google-ai-overviews-top-cited-domains-2025/ |
| src_028 | yes | discarded | https://wellows.com/blog/google-ai-overviews-ranking-factors/ |
| src_029 | yes | discarded | https://www.searchpilot.com/ |
| src_030 | yes | discarded | https://www.searchpilot.com/data-analysts |
| src_031 | yes | used | https://alexdeng.github.io/causal/abintro.html |
| src_032 | yes | discarded | https://web.stanford.edu/~swager/causal_inf_book.pdf |
| src_033 | yes | discarded | https://wrenda.ai/features/seo-testing |
| src_034 | yes | used | https://medium.com/@suraj_bansal/understanding-synthetic-control-and-causal-inference-in-a-b-testing-e10e67d570a0 |
| src_035 | yes | discarded | https://www.searchpilot.com/seo-abtesting-solution |
| src_036 | yes | used | https://www.searchpilot.com/resources/blog/what-is-seo-split-testing |
| src_037 | yes | used | https://loganbryant.com/seo-ab-testing-guide |
| src_038 | yes | used | https://www.searchpilot.com/resources/blog/do-it-yourself-seo-split-testing-tool-with-causal-impact/ |
| src_039 | yes | used | https://www.hobo-web.co.uk/core-web-vitals-seo-after-the-google-content-warehouse-api-data-leaks/ |
| src_040 | yes | used | https://www.seoworkflows.com/blog/article/google-content-warehouse-leak |
| src_041 | yes | used | https://nullstacks.com/blog/core-algorithm-leak-analysis-what-googles-14000-ranking-factors-actually-reveal-about-modern-seo/ |
| src_042 | yes | used | https://williejiang.com/en/blog/the-may-2024-google-content-warehouse-api-leak-your-complete-seo-playbook/ |
| src_043 | yes | used | https://trapilot.ai/google-leak/coverage/seoworkflows-unpacking-content-warehouse-leak |
| src_044 | yes | used | https://www.hobo-web.co.uk/the-google-content-warehouse-leak-2024/ |
| src_045 | yes | used | https://thestacc.com/blog/topical-authority-impact-study/ |
| src_046 | yes | used | https://rankai.ai/articles/content-clusters-for-topical-authority-guide |
| src_047 | yes | used | https://seohq.github.io/topical-authority-content-clustering |
| src_048 | yes | used | https://www.contentgrip.com/internal-linking-topic-clusters-guide/ |
| src_049 | yes | used | https://ahrefs.com/blog/topical-authority/ |
| src_050 | yes | used | https://moz.com/blog/blog-topic-clusters |
