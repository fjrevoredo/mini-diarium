# Mini Diarium: SEO & GEO Strategy

**Status:** durable reference. Consult this before writing a blog post, running an ad
campaign, or making a brand-growth decision. When a doubt about "what should we do next"
comes up, it should resolve to a concrete next action in this document.

**Companion docs**
- Evidence base: [`research/seo-geo-research-corpus.md`](research/seo-geo-research-corpus.md)
  (+ [`research/bibliography.md`](research/bibliography.md),
  [`research/gaps.md`](research/gaps.md)). Evidence tiers used below: **A** = peer-reviewed /
  large-N transparent method; **B** = practitioner large-scale study; **C** = synthesis /
  leak-derived (directional only).
- Point-in-time health: latest `STATUS_REPORT_*.md` (currently
  [`STATUS_REPORT_2026-07.md`](STATUS_REPORT_2026-07.md)).
- Live fix queue: [`action-plan.md`](action-plan.md).
- Brand context both SEO skills read first: [`product-marketing-context.md`](product-marketing-context.md).
- Recurring review: run the `seo-performance-review` skill each cycle to regenerate the status
  report, refresh this map's positions, and append to the hypothesis log.

**The one-paragraph thesis.** The site's *infrastructure* is already near-optimal for both
classical SEO and GEO (BLUF openings, FAQ schema, `llms.txt`/`ai-crawlers.txt`, JSON-LD
`@graph`, IndexNow, hreflang). The independent research corpus validates that design rather
than replacing it [corpus §1, §5.2]. So the growth work is **not more infrastructure**. It is
four things: (1) **topical depth** on the narrow owned topic, (2) **disciplined measurement**
that treats every change as a testable hypothesis, (3) **additive GEO editorial passes** on
pages that already rank, and (4) **entity/brand consistency**. At the same time we **freeze**
spend on signals that do not move the needle for a low-DR niche site (keyword density,
anchor-text optimization, paid-link velocity, SERP-feature chasing).

---

## 1. Positioning & owned topic

The brand facts (what the product is, the ICP, and the owned-topic framings) are stated once in
[`product-marketing-context.md`](product-marketing-context.md); the owned topic is **"encrypted
offline journaling."** This section keeps only the strategic argument for why that topic is the
lever.

**Own the topic, not the keyword.** For a low-Domain-Rating niche brand, topical authority is
the single highest-leverage lever on both the SEO and GEO axes [corpus §1.2, Tier A/B]. A
specialist that covers a topic completely can outrank DR-96 generalists, and GEO citation
correlates with topical depth, not Domain Rating (r≈0.18 vs 0.55–0.65 for classic ranking)
[corpus §2.2, §3.2]. Everything we publish should deepen coverage of that topic and its
subtopics rather than chase unrelated volume.

**Quasi-YMYL implication.** This is a privacy/encryption product. Author and entity trust
matter more than for a generic app. Google maintains an entity model (`pageEmbeddingsVersion`
in the 2024 leak) and AI Overviews over-cite authoritative sources [corpus §5.4, Tier C/A].
So the brand/entity layer (§6) is part of the ranking strategy, not a nicety.

---

## 2. Content design shape (dual SEO + GEO optimal)

Four independent research sources converge on the same content shape that maximizes both
ranking and LLM citation [corpus §5.2, Tier A]. Every new page and every editorial refresh
should hit these:

1. **A self-contained 50–80-word direct answer above the first H2** (the BLUF). On blog posts
   this is the `BLUF_MAP` "Short answer" block; it must be quotable verbatim by an LLM with no
   surrounding context, and must name the specific products, the specific trade-off, and the
   specific constraint.
2. **FAQ-style Q&A with body-mirrored FAQ schema** where the page type supports schema. The
   static pages (`/encrypted-journal/`, `/compare/`) carry `FAQPage` JSON-LD; blog posts do
   **not** currently have a post-level FAQ schema mechanism in the generator, so on blog posts
   use plain H2/H3 question headings with direct answers underneath. Do not hand-inject
   `FAQPage` JSON-LD into a generated blog post; if post-level FAQ schema is wanted, add it to
   the generator, not to one file.
3. **Extractable evidence units**: definitions, numeric facts, comparisons, and procedural
   steps. High-influence (frequently absorbed) pages are longer, more structured, and richer
   in exactly these units [corpus §3.1, src_018, Tier A]. A sentence like "encrypts each entry
   with AES-256-GCM before writing to disk" is an extractable unit; "prioritizes security" is
   not.
4. **A dated, named-author byline** (Francisco J. Revoredo). Named-expert authorship transfers
   cleanly to GEO [corpus §3.2].
5. **Macro / meso / micro structural clarity**: a clear page thesis, clear section purposes,
   and clean paragraph-level units. Structural decomposition alone raised citation rate
   +17.3% across six engines in controlled tests [corpus §3.1, src_011, Tier A].

Treat these as the checklist, not as guaranteed multipliers. Effect sizes in the corpus are
single-study; quote them as "up to" / "in controlled tests" (§5, honesty rule).

---

## 3. Keyword & topic-cluster map

Built from **both** engines: the July 2026 Google Search Console `Queries.csv` and the Bing
`KeywordReport` (query-level). This **supersedes the small inline keyword table that used to
live in `website/CLAUDE.md`.** Positions are a point-in-time snapshot (GSC position is an
*average*, sampled, and lags 2–3 days, §5); refresh them each cycle via the review skill. The
`Engine` column records which surface actually shows the demand, because the two engines want
different emphasis.

**Two cross-cutting notes that govern this whole map:**

- **(a) Bing = Windows-first.** Bing's demand is dominated by Windows/PC framing ("diary app
  for windows", "offline diary for pc", "desktop diary windows", dozens of "windows" variants).
  Where it is honest, keep **Windows/desktop explicit** in titles and H1s. That framing earns
  disproportionate Bing return and is the exact channel IndexNow already pushes to.
- **(b) Accuracy guardrail for the password/lock cluster.** The secure/password cluster and any
  password/lock content are governed by the accuracy guardrail in
  [`product-marketing-context.md`](product-marketing-context.md) (canonical): frame whole-journal
  AES-256-GCM encryption and the per-entry edit-lock precisely, and never imply per-entry
  encryption. It applies to any content targeting "does diarium have a password" / "lock certain
  entries in diarium".

### Pillar: Encrypted journal / diary → `/encrypted-journal/`

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| encrypted journal | ~6.2 | 43 | Google | Pillar's core term |
| encrypted journal app | ~8.1 | 43 | Google (also Bing pos ~6) | 4 clicks; drives the pillar page |
| encrypted diary | **~11.6** | 74 | Google | **Best striking-distance win** (page 2 → page 1) |
| encrypted journal software | ~2.5 | 2 | Bing | Already ranks; tiny volume |
| offline encrypted diary | ~3 | 3 | Bing | Already ranks; tiny volume |
| encrypted daily journal | mixed | n/a | both | Long-tail into pillar |

Pillar page owns the head terms. Push `encrypted diary` from page 2 with on-page targeting +
internal links (see action-plan). The pillar page's own CTR is the biggest single lever on the
site: 4,156 impressions at ~0.94% CTR at position ~7.

### Cluster: Private journal app → `/blog/private-journal-app-how-to-choose/`

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| private journal app | ~40 | 34 | Google | Page-4 positioning term; large unrealized pool |
| private journaling app | ~37.5 | 10 | Google | |
| private diary app | ~41.3 | 6 | Google | |
| private journaling | ~47.3 | 3 | Google | |
| private writing app | ~25.2 | 5 | Google | |
| private diary (windows) | ~3–10 | few | Bing | Bing ranks better at tiny volume |

This is the clearest growth pool: the product's own positioning terms rank on page 3–5 and are
almost entirely unrealized. Owning page exists but ranks page 2 (pos ~10) with a very low CTR.

### Cluster: Secure / password-protected journal → NEW posts

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| secure journal app | ~43.8 | 17 | Google | No dedicated page yet |
| secure diary / secure diary app | ~34 / ~39 | 1–2 | Google | |
| password protected journal | ~30 | 3 | Google | |
| password protected journal app | ~27.5 | 2 | Google | |
| does diarium have a password | ~5.5 | 2 | Bing | Feature-intent; competitor gap |
| can you lock certain entries in diarium | ~3.5 | 2 | Bing | **Observe guardrail (b)** |
| encrypted journal software | ~2.5 | 2 | Bing | |

Google shows definitional/positioning demand on page 3; Bing shows the matching feature-intent.
Two new posts target this cluster (see §9 / action-plan). Content must observe guardrail (b).

### Cluster: Offline / local-first → existing offline & no-cloud posts + pillar

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| diary app for windows | ~6.3 | 10 | Bing | Windows-first framing |
| offline diary for pc | ~6.6 | 9 | Bing | |
| desktop diary windows | ~6.8 | 4 | Bing | |
| journal app without cloud | n/a | 414 (page) | Google | Owned by `journal-app-without-cloud` |
| offline journal / offline diary | ~5–9 | few | Bing | |

Owning pages: `journal-app-without-cloud`, `why-an-offline-journal-is-different`,
`local-first-journaling-and-ownership`, `offline-journal-that-you-own`, and the pillar. Keep
Windows/desktop explicit per note (a).

### Cluster: Comparisons / migrations → `/compare/` + alternative posts

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| diarium vs day one | ~7.0 | 28 | Google (also Bing) | |
| day one vs diarium / day one vs obsidian | ~7 | few | both | |
| diarium or day one | ~7 | 2 | Bing | |
| export day one to diarium | n/a | 1 | Bing | Migration intent |

Owning pages: `/compare/`, `day-one-alternative-for-private-offline-journaling`,
`standard-notes-alternative`, `obsidian-alternative-for-journaling`,
`notion-alternative-for-journaling`. Comparison tables are what LLMs extract for "best X" /
"X alternative" queries; keep `/compare/` structured and current.

### Cluster: AI privacy / legal → AI-privacy & subpoena posts

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| is entries ai safe | ~12.6 | 22 | Google | Striking distance |
| why is a journal offline? | ~2.5 | 2 | Bing | GEO-friendly *question* query |
| ai journaling app privacy concerns … | ~1 | 1 | Bing | Long-tail question intent |

Owning pages: `journal-app-ai-privacy`, `can-your-journal-be-subpoenaed`. Question queries are
exactly what AI Overviews surface (60% of AI Overviews are question queries [corpus §3.3]).

### Cluster: Predecessor: "Mini Diary" successor → `/blog/mini-diary-alternative/`

| Target query | Pos | Impr | Engine | Notes |
|---|---|---|---|---|
| mini diary | ~3.0 | 95 (8 clicks) | Bing | Real predecessor demand |
| mini diary app / mini diary download | ~8.9 / ~1.5 | few | both | |
| minidiary open source journal app | ~1 | 1 | Bing | |
| mini diary open source encrypted journal github abandoned | ~2.5 | 2 | Bing | Successor intent, explicit |

Bing surfaces clear predecessor demand that Google under-shows. Owning page exists
(`mini-diary-alternative`); the review skill decides refresh-vs-new each cycle. Given the
existing page, this is usually a **strengthen**, not a new post.

---

## 4. Budget model: transfer / freeze / flip

The 12-signal SEO↔GEO transferability map [corpus §3.2, src_005, Tier B/C]. Use it to decide
where growth effort goes. Direction is robust; the exact multipliers are single-study, quote as
"up to".

**Keep investing (transfers cleanly to GEO, free dividends):**
- Topical depth on "encrypted offline journaling" (highest dual-purpose lever).
- Content freshness (update `updated:` dates and refresh stale posts; the leak's
  `lastSignificantUpdate` demotes content >3 yrs).
- Named-expert authorship / bylines.
- Page speed / Core Web Vitals as **hygiene** (a tie-breaker and a `navBoost` input, not a
  high-magnitude ranking lever per [corpus gaps §0]).
- Crawlability (`llms.txt`, `ai-crawlers.txt`, sitemap, IndexNow).

**Freeze (SEO-only signals that do NOT transfer to GEO, low payoff for a niche site):**
- Keyword density / keyword stuffing.
- Anchor-text optimization.
- Paid-link velocity / link buying.
- SERP-feature chasing for its own sake.

**Flip budget into (highest additive GEO leverage on pages that already rank):**
- **FAQ schema with body-mirrored Q&A** (reported ~2.35x retrieval in controlled tests).
- **A 50–80-word answer block above the first H2** (reported ~2.1x citation).
- **Dated named-author bylines.**

The synthesis reports these editorial moves typically add ~30–50% to GEO citation within a
quarter without harming classic SEO (single agency panel; **directional, not guaranteed**).
Consider these a recurring "generative-search editor" pass, not a one-off.

---

## 5. Measurement regime (science-based, honest about scale)

At ~455 Google clicks and ~80 Bing clicks per quarter, this site does **not** have the traffic
for statistically valid SEO A/B split testing. The practitioner threshold for that is roughly
**500,000 monthly organic visitors** [corpus §4.1, src_037, Tier B]. So we do **not** claim
causal inference. We rely on **directional signals**, recorded as hypotheses, validated next
cycle by movement. The pragmatic default regime:

1. **Striking-distance analysis.** Queries at position ~8–20 with real impressions are the
   near-term rank wins. (July's best is `encrypted diary`, pos ~11.6.)
2. **CTR-gap analysis.** High-impression / low-CTR pages relative to their position are the
   biggest title/meta levers. (July's worst offenders: `/encrypted-journal/` and
   `/blog/private-journal-app-how-to-choose/`.)
3. **Topical-coverage scoring.** Map the owned topic into subtopics + question angles; score
   coverage; prioritize procedural/comparison gaps (highest absorption [corpus §3.1]).
4. **GEO citation check.** Since 2026-08, Google's AI-Overview export and Bing's
   `AIPerformanceOverviewStats` export give real measured citation/impression counts each cycle
   (see the review skill's Step 3) — the primary signal for those two engines. A fixed
   ~30-query set (see the review skill's `references/geo-citation-queries.md`) still runs across
   **ChatGPT and Perplexity**, which publish no exportable data, and cross-checks which queries
   plausibly drive the Google/Bing numbers. Record citation presence *and* answer absorption per
   engine. This is a separate KPI from GSC position/CTR [corpus §4.5].
5. **Google-vs-Bing divergence check.** The two engines want different emphasis (Google =
   topic/positioning terms; Bing = platform + successor + feature intent). Every recommendation
   must account for both.
6. **Hypothesis log.** Every change is recorded as a testable hypothesis with an expected
   effect and validated next cycle by directional movement. Best practices are hypotheses, not
   rules: controlled tests routinely show "best-practice" changes *harming* traffic (breadcrumb
   fix -12%, price-in-title -15% [corpus §2.4, src_038, Tier A]). The log lives in the
   action-plan.

**Aspiration (documented, not current practice):** when/if traffic supports it, the correct
low-traffic causal method is **CausalImpact** (Bayesian synthetic-control counterfactual) on
individual pages, controlling for seasonality, core-update dates, and competitor moves [corpus
§4.2]. We are far below the traffic where this yields signal, so today it is aspiration, not
method.

**GSC data caveats to respect every cycle** [corpus §4.4]: data is sampled/aggregated
(low-impression rows dropped), position is an *average* not an exact rank, reporting lags 2–3
days, and there is no per-user attribution. Aggregate low-impression rows before interpreting;
conclusions from single-digit-impression rows are statistically fragile.

---

## 6. Brand & entity strategy

For a quasi-YMYL-adjacent privacy product, a consistent verifiable entity is a long-compounding
authority signal that feeds both Google's entity model and LLM source-trust heuristics [corpus
§5.4]. Maintain:

- **Consistent Organization + Person schema** across every page (name, URL, `sameAs` where it
  exists). The homepage `@graph` is the source of truth; new static pages must not contradict
  it.
- **Verifiable author identity:** Francisco J. Revoredo, author URL `https://fjrevoredo.com`,
  as the byline on every post and in `article:author`.
- **A consistent entity description across the web** ("local-first encrypted desktop journaling
  app; maintained successor to Mini Diary") on trusted profiles: GitHub, SourceForge,
  Microsoft Store, Homebrew/WinGet listings, Flathub. Same one-line description everywhere.
- **`softwareVersion` consistency** across all pages that carry `SoftwareApplication` schema.
  Version drift is a recurring bug class; verify it every cycle against
  `src-tauri/tauri.conf.json`.

---

## 7. Distribution & growth

Organic search is the compounding channel, but it is slow and the click itself is increasingly
rare (when an AI Overview appears, users click a traditional result ~8% of the time vs ~15%
without [corpus §3.3]). Newsletter, community, and comparison surfaces are complementary, not
substitutes. The implementation state for each distribution surface lives in
[`growth/`](growth/); this section keeps only the strategic frame.

- **Newsletter.** A low-friction email surface tied to the owned topic ("occasional releases
  and privacy-journaling notes, no spam"). Do not build heavy tooling before there is an
  audience. Provider, placement, and open items: [`growth/newsletter.md`](growth/newsletter.md).
- **GitHub / community.** The repo (200+ stars from a Hacker News post) is a trust and
  discovery surface. Keep the README's one-line description consistent with the entity
  description (§6). Community surfaces (r/selfhosted, r/privacy, r/opensource) reward honest
  FOSS framing, not marketing.
- **Product Hunt launch.** A one-time momentum surface for a solo-indie FOSS product. The
  adapted 6-week roadmap, go/no-go checklist, and realistic-outcome expectations:
  [`growth/product-hunt-launch.md`](growth/product-hunt-launch.md).
- **Comparison-driven referral.** "X alternative" and "X vs Y" queries convert buyer intent;
  the comparison posts and `/compare/` are the referral surface. Keep them current as
  competitors change pricing or features.

---

## 8. Paid / ad-campaign guidance

Before launching any campaign, run the "before you launch a campaign" checklist (§9). Rules:

- **Bid only on buyer-intent generic terms where organic rank is weak.** The right targets are
  the page-3–5 positioning terms where we cannot yet rank organically but the intent is
  commercial: `private journal app`, `secure journal app`, `password protected journal app`,
  `encrypted diary app`. Do **not** bid on branded terms ("mini diarium"), we already own
  position ~1 at ~45% CTR, so paid clicks there cannibalize free ones.
- **Map each ad group to the single best landing page**, never the homepage generically:
  - encrypted journal / diary intent → `/encrypted-journal/`
  - private journal app intent → `/blog/private-journal-app-how-to-choose/`
  - secure / password-protected intent → the secure / password-protected posts (or
    `/encrypted-journal/` until they rank)
  - comparison / migration intent → `/compare/`
- **Messaging rules:** same brand voice as the site (§ brand voice in the marketing context).
  Every claim backed by a technical fact. Lead with the honest differentiator (offline, no
  cloud, AES-256-GCM, free/MIT). Observe the password/lock guardrail (§3b) in any ad copy that
  mentions passwords or locking entries.
- **Geo note:** the US delivers the most impressions at the worst CTR (~1.2%). If testing paid,
  the US is where the organic CTR gap is largest, so a well-matched landing page has the most
  headroom, but also the most competition. Treat any paid test as a hypothesis logged per §5.

---

## 9. Operating procedures

### Before you write a blog post

1. **Check this map (§3) first.** Confirm the target query's cluster, current position, and
   owning page. Do not create a post whose primary keyword is already the title/H1 of an
   existing post (cannibalization), refresh that post instead.
2. **Confirm the demand is real** in the latest export (`docs/seo/performance/…`), not just
   assumed. Aggregate low-impression rows (§5 caveats).
3. **Design to the content shape (§2):** BLUF above the first H2, extractable evidence units,
   dated byline, clean macro/meso/micro structure. Add H2/H3 Q&A for question intent.
4. **Respect the accuracy guardrail (§3b)** for any password/lock/encryption claim, and the
   voice rules (no em dashes, no emojis, no filler; every product claim backed by a technical
   fact; name limitations plainly).
5. **Internal links:** at least two of `/encrypted-journal/`, `/compare/`, or a related post.
   Internal linking is load-bearing for the strategy.
6. **Follow the blog workflow:** write `website/posts-src/YYYY-MM-DD-slug.md`, add
   `DESCRIPTION_MAP` + `BLUF_MAP` entries in `scripts/generate-website-blog.mjs`, run
   `bun run website:build-static`, then verify per `website/CLAUDE.md`.

### Before you launch a campaign

1. **Confirm the term is buyer-intent and organically weak** (§8), check its position in §3.
   If we already rank page 1 organically, question whether paid is worth it.
2. **Pick the single best landing page** from the §8 map. Never send paid traffic to the
   homepage generically.
3. **Write ad copy in the brand voice**, every claim backed by a technical fact, guardrail
   (§3b) observed.
4. **Log the campaign as a hypothesis (§5)** with an expected effect, and pick a directional
   metric to check next cycle (CTR on the landing page, assisted conversions). We cannot prove
   causation at this scale, so decide in advance what directional movement would count.
