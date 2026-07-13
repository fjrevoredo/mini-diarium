# Open Gaps, Contested Claims, and Deferred Sources

## Deferred sources (corroborating context, not cited in a finding)

These sources were fetched and reviewed but not promoted into a finding
because the central claim they support is already cited to a stronger or
more direct source. They remain available for the downstream agent as
secondary corroboration.

- `src_004` (rockingweb 100K-URL backlink study) — corroborates fnd_006
  (backlinks still matter) at scale. Not cited because the directional claim
  is covered by src_008.
- `src_010` (ranktracker domain-authority statistics) — corroborates the
  DR/authority discussion in fnd_014. Vendor source, lower tier.
- `src_021` (SurferSEO AI citation report), `src_027` (digitalbloom top
  cited domains) — corroborate fnd_016/fnd_017 (most-cited AI domains) from
  independent panels.
- `src_031` (Alex Deng, A/B testing intro), `src_034` (medium synthetic
  control), `src_036` (SearchPilot "what is split testing") — corroborate the
  CausalImpact / split-testing methodology in fnd_019/fnd_020. Alex Deng
  (Microsoft) is a strong methodology reference worth deeper reading.
- `src_039`, `src_040`, `src_041`, `src_043`, `src_044` — additional
  third-party analyses of the May 2024 Content Warehouse API leak,
  corroborating fnd_001/fnd_002. `src_041` (nullstacks) and the two hobo-web
  pieces are the most detailed secondary reads.
- `src_045`, `src_046`, `src_047`, `src_048` — topical-authority and
  content-cluster guides corroborating fnd_023. `src_050` (Moz topic clusters)
  is the original pillar/cluster methodology origin point and worth reading
  for the cluster-design pattern.

## Open questions for the downstream analysis agent

0. **Coverage scope note (CWV and E-E-A-T).** Two SEO sub-topics the brand
   already works on are covered only *indirectly* in this corpus, not via a
   dedicated magnitude finding:
   - **Core Web Vitals** are treated as a "transferring" signal (page speed
     LCP<2.5s, INP<200ms) in the 12-signal map [src_005] and as user-experience
     input to `navBoost`/`chromeInTotal` [src_042], but no finding isolates
     CWV's *direct* ranking-effect size (Google's own stance is that CWV is a
     tie-breaker, not a primary factor). Treat CWV as a hygiene/user-signal
     lever, not a high-magnitude ranking lever.
   - **E-E-A-T** is covered indirectly via entity authority [src_042
     `pageEmbeddingsVersion`, `isElectionAuthority`] and named-author/authorship
     signals [src_005, src_049], but E-E-A-T is a Quality Rater Guidelines
     framework, not a confirmed single ranking system, so no effect size
     applies. The durable expression of it for this brand is consistent entity +
     author provenance.

1. **Actual mini-diarium GSC/BWT baseline.** This corpus provides the *method*
   and *evidence base*, not the data analysis. The downstream agent must pull
   the current `docs/seo/` exports (Queries.csv, Pages.csv) and apply the
   CausalImpact + confound-control method from ins_002 / fnd_019 to identify
   which prior changes actually moved the needle versus rode seasonality or a
   core update.

2. **Per-engine citation baseline for mini-diarium's owned queries.** No
   public dataset tells the brand where it currently stands in ChatGPT /
   Google AI Overviews / Perplexity / Copilot for queries like "encrypted
   diary", "private journal app", "desktop diary app". The downstream agent
   must run the per-platform citation measurement (ins_004) to establish the
   baseline before claiming GEO progress.

3. **Domain-specific GEO tuning.** fnd_009 stresses that GEO efficacy varies
   by domain. The academic benchmarks cover general/web/e-commerce, not
   "privacy software / local-first journaling." The downstream agent should
   validate which GEO techniques (answer placement, FAQ schema, citation
   fluency) move the needle *for this specific niche* rather than assuming the
   general effect sizes transfer.

4. **llms.txt / ai-crawlers.txt measured efficacy.** The site already
   maintains these (per `website/CLAUDE.md`), but the research found no
   peer-reviewed measurement of their actual effect on LLM citation. This is a
   genuine gap in the field; treat the practice as best-effort, not proven.

## Contested / lower-confidence claims (handle with care)

- **Content Warehouse leak "weights" (fnd_001, fnd_002, src_042).** The leak
  reveals field names, not algorithmic weights. Google called interpretations
  "out of context." Any specific multiplier (e.g., "editorial 3x weight",
  "anchor mismatch -0.15") is a third-party inference, not confirmed. Use
  these as directional confirmation that a signal exists, never as a quantified
  lever.
- **GEO effect sizes (fnd_009, fnd_013, fnd_026).** The "40% lift", "2.35x
  retrieval", and "30-50% citation gain in one quarter" figures are each from
  a single study or agency panel. They are plausible and directionally
  consistent with each other, but they are not independently replicated across
  the niche in question. Quote them as "up to" / "in controlled tests", never
  as guaranteed outcomes.
- **Domain Rating's GEO role (fnd_014).** The 0.18 vs 0.55-0.65 correlation
  comparison spans different studies (Profound vs Ahrefs/Authoritas) with
  different methodologies. The *direction* (DR matters less for GEO than SEO)
  is robust; the *exact gap* is an estimate.

## Time-sensitivity flags

- GEO / AI Overviews citation data (fnd_015-fnd_018) is from 2025-mid-2026 and
  the field is moving fast. Re-baseline per-engine citation share quarterly.
- The Content Warehouse leak reflects Google systems as of late-2023 / early
  2024. Google has had time to evolve fields and weights since.
- Topical-authority and CausalImpact methodology (fnd_003, fnd_019) are
  stable and will remain valid through the planning horizon.
