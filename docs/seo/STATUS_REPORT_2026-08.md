# Mini Diarium: SEO/GEO Status Report

**Snapshot date:** 2026-08-22 · **Data window:** 2026-05-20 → 2026-08-19 (last 3 months)
**Author:** Francisco J. Revoredo

Point-in-time health report. It combines the technical/GEO audit state with the August
performance analysis for both engines, plus the first cycle of the new AI-citation exports.
This is a **dated snapshot**, it is not maintained after this date. The durable reference is
[`STRATEGY.md`](STRATEGY.md); the living fix queue is [`action-plan.md`](action-plan.md).
Findings follow the `seo-audit` Issue / Impact / Evidence / Fix / Priority structure.

**Data sources**
- Google Search Console: `performance/2026-08-22/mini-diarium.com-Performance-on-Search-2026-08-22.zip`
  (`Queries.csv`, `Pages.csv`, `Countries.csv`, `Devices.csv`, `Chart.csv`, `Filters.csv`,
  `Search appearance.csv`).
- Google AI Overview export (new this cycle):
  `performance/2026-08-22/mini-diarium.com-Performance-on-Search-Generative-AI-Features-2026-08-22.zip`
  (`Pages.csv`, `Countries.csv`, `Devices.csv`, `Chart.csv` — impressions only, no query
  breakdown, no clicks/CTR/position).
- Bing Webmaster Tools: `performance/2026-08-22/mini-diarium.com_SearchPerformanceOverview_All_8_22_2026.csv`
  (overview) and `performance/2026-08-22/mini-diarium.com_KeywordReport_8_22_2026.csv`
  (query-level, 420 keywords).
- Bing AI/Copilot citations export (new this cycle):
  `performance/2026-08-22/mini-diarium.com_AIPerformanceOverviewStats_8_22_2026.csv`
  (daily `Citations` / `Cited Pages` counts).

**Denominator note (read before comparing numbers to the July report):** GSC's `Queries.csv`
suppresses/anonymizes low-impression queries, so it undercounts site totals — this cycle
`Queries.csv` sums to 242 clicks / 7,983 impressions, well below the real total. `Pages.csv`
captures the fullest picture and is used for every site-wide and per-page total in this report,
for **both** cycles (recomputed for July, not copied from the July report). The July report's
stated "~455 clicks / ~13,555 impressions" does not match any single CSV recomputed from the
July export folder and its exact provenance is unclear — treat the recomputed Pages.csv figures
below (July: 457 / 16,542; August: 481 / 24,519) as the authoritative comparison basis going
forward, and query-level tables (branded split, striking distance, CTR gap) as drawn from
`Queries.csv`, which is a partial, query-attributed subset of that total.

---

## 1. Executive summary

**Overall health: real growth, diluted by a brand-collision problem.** Impressions grew
sharply on both engines this quarter, and every hypothesis logged in July that had time to play
out validated in the expected direction: the `/encrypted-journal/` and `encrypted diary` moves
both improved, and the two new secure/password posts are climbing fast on Google (one already
reached position 5). But site-wide Google CTR fell from 2.76% to 1.96% because of a large,
newly-dominant query, plain **"diarium,"** that appears to be search-term collision with a
different, unrelated commercial journaling app of the same name — not demand for Mini Diarium.
Bing, by contrast, had a clean quarter: clicks up 67%, CTR held steady, and its long-tail is
increasingly AI-assistant-shaped (full sentences, not keywords). This cycle also establishes
the first-ever baseline for real (not spot-checked) AI Overview and Copilot citation volume.

**Top findings**

1. **The `diarium` query problem is the headline finding.** On Google, the bare query
   `diarium` grew from 828 to 5,338 impressions (+544%) at a flat, near-zero 0.43% CTR
   (23 clicks) and stable position (~6.3 → ~7.4). Bing shows the identical shape: `diarium`
   is Bing's single largest query at 716 impressions, 3 clicks, 0.42% CTR. **Diarium is a
   real, separate, award-winning journaling app** (Windows/Mac/iOS/Android, paid, cloud-sync,
   by developer Timo Partl — diariumapp.com, Microsoft Store Awards 2024), and the volume/typo
   shape of the surrounding query tail (`diarum`, `dairium`, `darium`, `diairum`, `diariun`,
   `doarium`, `diarima`, `diriun`, `dairum`) reads as name-confusion traffic, not demand for
   Mini Diarium. This is the most likely explanation, not a confirmed one — see §3 for the
   verification step and why it matters for what to do next.
2. **The homepage absorbed almost all of that inflow, and its CTR paid for it.** Homepage
   impressions nearly tripled (4,611 → 11,078, +140%) while clicks slipped slightly (371 → 352)
   and CTR collapsed (8.05% → 3.18%). The growth in "diarium"-family query impressions
   (roughly +5,100 across the family) tracks closely with the homepage's impression growth
   (+6,467), though these exports do not provide a query-to-page join to confirm the exact
   share.
3. **Every hypothesis that had time to run validated in the right direction.** `/encrypted-journal/`
   CTR rescue: 0.94% → 1.34% CTR, clicks 39 → 63, position 7.28 → 6.85 (validated).
   `encrypted diary` rank push: position 11.64 → 7.45, page 2 → page 1 (validated, the
   cleanest win of the cycle). See §5 for the full hypothesis log update.
4. **A new page-1 opportunity appeared: `password protected journal app` at position 5**
   (was 27.5 in July), 15 impressions, 0 clicks. This is the single best striking-distance item
   in this export — likely the new `password-protected-journal-app` post finding its rank
   (these exports don't map query→page directly, so this is the probable but unconfirmed
   owner). Zero clicks at 15 impressions and position 5 is not unusual at this volume (§ caveat)
   and should not be read as a CTR failure; it needs more impressions before CTR is meaningful.
5. **Bing had a clean, uncomplicated growth quarter:** 134 clicks / 2,598 impressions vs July's
   recomputed 80 / 1,568 (+67% clicks, CTR held ~5.2%). Its query tail is increasingly
   conversational — `i am looking for a private diary app with encryption`,
   `fully local journaling app for sensitive data`, `offline journaling app encryption
   local-first privacy` — full-sentence queries that look like Copilot-assisted search, ranking
   pos 1.5–5. This is GEO-shaped demand showing up directly in Bing's own data.
6. **First AI-citation baseline established.** Google AI Overviews: ~3,309 impressions over the
   window (Chart.csv daily series), ~13–14% of total Google impressions. Bing/Copilot: 175
   citations across 78 cited-page-days. No prior cycle exists to compare against; this is the
   2026-08 baseline. See §6.

**Quick wins seeded into the action plan:** verify and reinforce whatever is winning
`password protected journal app` at position 5; decide a `diarium`-collision response (§3);
do **not** re-rewrite `/blog/private-journal-app-how-to-choose/` title/meta again this cycle —
its CTR dip is confounded by a position decline, not proven copy failure (§4); update the
predecessor cluster note now that `mini diary` / `mini diary app` show real Google volume, not
just Bing.

---

## 2. Technical & GEO state

**Recurring checks, this cycle:**
- `softwareVersion` drift check: app is now `0.6.6` (`src-tauri/tauri.conf.json`); homepage and
  `/encrypted-journal/` both read `0.6.6` in their `SoftwareApplication` schema. **No drift.**
- Homepage `<title>`/`og:title`/`twitter:title` separator and the LCP `preload` +
  `a.fsdn.com` `preconnect` hints (July action-plan #3/#4) remain in place; no regression
  reported by this data-only review (a full on-page re-verification is `seo-audit` scope, not
  this skill's).

**Open gaps, unchanged from July (still deferred, P4):** per-post OG images still generic;
`softwareVersion` is still not a build-time constant (the drift-prevention fix), so this remains
a manual recurring check.

GEO infrastructure is unchanged and still near-optimal (BLUF + FAQ schema + `llms.txt` +
IndexNow + hreflang); no infrastructure work is indicated by this cycle's data. The new signal
this cycle is entirely on the editorial/measurement side — see §6.

---

## 3. The `diarium` query-collision problem

**What the data shows.** `diarium` (bare term, no "mini") is now the single largest query on
both engines:

| Engine | Impr (Aug) | Impr (Jul) | Δ | Clicks | CTR | Position |
|---|---|---|---|---|---|---|
| Google | 5,338 | 828 | +544% | 23 | 0.43% | 6.31 → 7.42 (flat-ish) |
| Bing | 716 | n/a (not tracked pre-Aug) | — | 3 | 0.42% | ~7.1 |

The surrounding query tail is large and mostly unusable: `diarum` (169 impr), `diarium
download` (132), `diarium windows` (103), `diarium web` (82), `diarium free download for pc`
(75), `diarium official website` (69), plus a long list of near-zero-impression typo/variant
rows (`dairium`, `darium`, `diairum`, `diariun`, `doarium`, `diarima`, `diriun`, `dairum`, even
`wiener diarium` — an 18th-century Viennese newspaper, further evidence the bare term is
polluted rather than owned by any one party).

**Why this matters.** A confirmed web search shows **Diarium is a real, separate product**:
a paid journaling app for Windows, macOS, iOS, and Android by developer Timo Partl
(diariumapp.com; also on the Microsoft Store, App Store, and Google Play), with cloud sync via
the user's own OneDrive/Google Drive/Dropbox/iCloud/WebDAV, and a Microsoft Store Award in 2024.
That is the most likely explanation for this query cluster: searchers typing "diarium" (plus
typo variants) most likely want that product — which is paid and cloud-syncing, the opposite of
Mini Diarium's free/local-only model — and are landing on mini-diarium.com by name collision,
hence the near-zero CTR that doesn't move regardless of position.

**What would confirm or overturn this reading (not yet done, do next cycle or now if useful):**
pull the live Google/Bing SERP for `diarium` and see who actually ranks for it and how
mini-diarium.com appears in that result set (title/snippet shown). If Diarium (diariumapp.com)
or Microsoft Store visibly dominates the SERP, this reading holds. If mini-diarium.com is
itself the dominant result, the alternate explanation is that Google/Bing loosened fuzzy
matching on a low-competition term and the impressions are structurally low-value regardless of
any competitor.

**What this means for the action plan either way:** these are low-value impressions that will
not convert at any achievable position, because they are not evidence of demand for this
product. Do not spend title/meta effort chasing "diarium" — that's frozen-signal territory
(chasing an unconvertible term). What is worth deciding: (a) whether the homepage's title/meta
should more explicitly differentiate "Mini Diarium" from "Diarium" on the small chance some of
this traffic is confused rather than hard-committed to the other product, and (b) whether to
exclude the "diarium"-family query cluster from CTR-health tracking going forward so it doesn't
mask real signal on the homepage's actual audience (branded + generic). Logged as a decision
item in the action plan, not auto-actioned.

---

## 4. Performance analysis: Google

**Totals (window, `Pages.csv`):** 481 clicks / 24,519 impressions / 1.96% CTR — up from July's
recomputed 457 / 16,542 / 2.76%. Impressions +48%, clicks +5%, CTR down 0.8pp. The CTR
decline is attributable to the `diarium` inflow (§3), not a broad-based ranking or relevance
problem — most individual pages and queries that already converted continued to convert at
the same or better rate (see below).

**Branded vs non-branded (`Queries.csv`, partial/query-attributed subset only — see
denominator note above).** "mini diarium" + "mini diarium app": 178 clicks / 444 impressions,
40.1% CTR, position ~1.06 — branded capture is as strong as ever. The `diarium`-family bare-term
cluster (§3) is now larger than the entire rest of the query-attributed impression pool
combined and converts at 0.43%; treating it as neither "branded" nor real "generic demand" but
its own bucket, the residual generic/positioning query pool is ~41 clicks / ~2,201 impressions
(1.86% CTR) — comparable to July's recomputed ~23 clicks / ~1,018 impressions (2.26% CTR) once
`diarium` is excluded from both cycles the same way.

**Hypothesis-tracked pages and queries, movement vs July:**

| Page/query | Jul | Aug | Verdict |
|---|---|---|---|
| `/encrypted-journal/` (page) | 4,156 impr / 0.94% CTR / pos 7.28 | 4,719 impr / **1.34%** CTR / pos **6.85** | **Validated** — CTR rescue worked |
| `/blog/private-journal-app-how-to-choose/` (page) | 1,952 impr / 0.26% CTR / pos 10.22 | 2,523 impr / 0.20% CTR / pos **11.83** | **Not validated, confounded** — position got worse, which alone depresses CTR independent of the copy; do not attribute the CTR dip to the rewrite, and do not rewrite the title again this cycle |
| `encrypted diary` (query) | pos 11.64, 74 impr | pos **7.45**, 92 impr | **Validated, cleanest win** — page 2 → page 1 |
| `encrypted journal app` (query) | pos 8.07, 43 impr | pos **4.86**, 83 impr | Improved (not a logged hypothesis, but the pillar's core term is strengthening) |
| `encrypted journal` (query) | pos 6.21, 43 impr | pos **4.9**, 49 impr | Improved |
| `is entries ai safe` (query) | pos 12.64, 22 impr | pos 14, 8 impr | Slipped — low volume, statistically fragile, watch not act |
| Homepage `-`→`\|`, LCP preload/preconnect | n/a | n/a | **Unmeasurable, confounded** — homepage CTR is dominated by the `diarium` inflow this cycle, any separator/preload effect is unreadable underneath it |

**Secure/password/private cluster — first real cycle (posts published 2026-07-13, after the
July window closed 2026-07-11):**

| Query | Jul pos | Aug pos | Jul impr | Aug impr | Aug clicks |
|---|---|---|---|---|---|
| `password protected journal app` | 27.5 | **5** | 2 | 15 | 0 |
| `private journal app` | 40.03 | 27.56 | 34 | 61 | 0 |
| `secure journal app` | 43.82 | 36.23 | 17 | 22 | 0 |
| `password protected journal` | 30 | 27.8 | 3 | 10 | 0 |

Every tracked query in this cluster moved up in rank; total clicks are still 0 across ~108
impressions. At page-3 positions (27–36) zero clicks is expected, not a title/meta failure —
do not recommend copy work here yet. `password protected journal app` at position 5 is the
exception: that's page-1 territory and worth watching closely next cycle, and reinforcing with
internal links now rather than waiting.

**Cluster-map correction:** `mini diary` (14 impr, pos 11.36) and `mini diary app` (13 impr,
pos 8.62) now show real volume in **Google** data. July's read was "Bing-only predecessor
demand" — that's no longer accurate; both engines now show it. Zero clicks so far on Google
side.

**Striking distance (position 8–20), after excluding the `diarium`-collision tail:** thin this
cycle. `mini diary` (pos 11.36) and `mini diary app` (pos 8.62) are the clearest real
opportunities; `desktop diary` (pos 9.2, 5 impr) and `encrypted diary app` (pos 8, 4 impr) are
too low-volume to act on yet (single-digit-impression caveat).

**Device breakdown:** Desktop 377 clicks / 16,971 impr (2.22% CTR); Mobile 94 / 4,410 (2.13%);
Tablet 4 / 213 (1.88%). Desktop still dominates impressions, consistent with a desktop app;
overall CTR down across all three vs July, consistent with the site-wide `diarium` dilution
rather than a device-specific issue.

---

## 5. Performance analysis: Bing (query-level)

**Totals (window, overview CSV):** 134 clicks / 2,598 impressions, ~5.2% CTR — up from July's
recomputed ~80 clicks / ~1,568 impressions (~5.1% CTR). Clicks +67%, impressions +66%, CTR
essentially flat. Bing's growth this cycle is clean: more volume at the same conversion rate,
unlike Google where the volume growth diluted CTR.

**The `diarium` collision shows up on Bing too** (§3): 716 impressions, 3 clicks, 0.42% CTR,
position ~7.1 — same shape as Google, cross-engine confirmation that this is a query-level
phenomenon, not a Google-specific artifact.

**Windows/PC-first intent, still present:** `diary app for windows` (pos 6.3, 10 impr, 2
clicks), `diarium for windows`/`diarium pc`/`diarium windows journaling app` (all collision-tail
variants, not Mini Diarium demand — same caveat as §3 applies to any query containing
"diarium").

**Predecessor demand, now clearer:** `mini diary` — 124 impressions, 8 clicks, 6.45% CTR,
position 3.14. This converts far better than the `diarium`-collision cluster, confirming it is
real successor-intent demand, not name confusion.

**New this cycle: conversational, GEO-shaped long-tail.** A cluster of full-sentence queries
ranks well and looks distinctly like Copilot-assisted search rather than typed keywords:
`i am looking for a private diary app with encryption` (pos 5.2, 6 impr), `fully local
journaling app for sensitive data` (pos 4.75, 8 impr), `offline journaling app encryption
local-first privacy` (pos 3.6, 8 impr), `encrypted local diary app` (pos 1.5, 8 impr). None of
these convert yet (0 clicks each, low volume), but the pattern — long, natural-language,
specific-constraint queries already ranking at position 1.5–5 — is exactly the shape GEO
content is supposed to win, and it is showing up unprompted in Bing's own data before any
targeted content was built for it. Worth watching as a cluster, not yet worth a dedicated post
at this volume.

**Contrast with Google, unchanged:** Google = topic/positioning terms; Bing = platform +
successor + feature intent + (new) conversational/AI-assisted long-tail.

---

## 6. GEO / AI-citation baseline (new this cycle)

Real measured citation/impression data exists for the first time, replacing what was previously
only available via manual spot-check for Google and Bing. **This is a baseline, not a
comparison** — no prior-cycle data exists for either export.

**Google AI Overviews** (impressions only; no clicks/CTR/position, no query breakdown):
~3,309 impressions over the window (daily `Chart.csv` series; `Pages.csv` sums to 3,524, a
close but not identical figure — use the Chart.csv daily total as the authoritative sum and
`Pages.csv` as directional for the per-page split). That is roughly **13–14% of total Google
impressions** (3,309 of 24,519). Top pages surfaced in AI Overviews: homepage (2,185, 62% of
the AI-Overview total — a higher share than its 45% share of total impressions, meaning the
homepage is disproportionately likely to be pulled into an AI Overview, plausibly boosted by
the `diarium`-collision queries triggering an Overview), `/encrypted-journal/` (767, ~16% share
— roughly proportional to its 19% share of total impressions, a cleaner content-citation signal
than the homepage's), `/blog/private-journal-app-how-to-choose/` (116), `/docs/` (98). Devices:
Desktop 2,185, Mobile 1,068, Tablet 56 — AI Overview appearance skews even more desktop-heavy
than the site average.

**Bing / Copilot citations:** 175 total citations across 78 cited-page-days (summed daily
`Cited Pages` counts; note this is not necessarily 78 unique pages, since a page cited on
multiple days counts once per day) over the same window. Citation activity is irregular
(many zero days, occasional small clusters — a 6-page/18-citation day on 2026-07-13, an
11-citation/4-page day on 2026-08-15) rather than a steady trickle. No per-page breakdown is
available in this export.

**Manual spot-check (ChatGPT, Perplexity) — not run this cycle.** Since both real exports above
are first-cycle baselines with nothing yet to compare against, and the manual ~30-query
checklist adds a directional read with no movement to validate, it was skipped this cycle per
the review skill's guidance to avoid spending it on a cycle where it can't show movement. Run it
next cycle so the Google/Bing exports and the manual ChatGPT/Perplexity check both have a first
comparison point together. The fixed query set is in
[`../../.agents/skills/seo-performance-review/references/geo-citation-queries.md`](../../.agents/skills/seo-performance-review/references/geo-citation-queries.md)
if you want to run it yourself in the meantime — paste results back and they'll be logged
against this baseline.

---

## 7. Gap-to-opportunity map

Each finding tagged with the lever it pulls.

| Finding | Lever | Action |
|---|---|---|
| `diarium` bare-query collision, 5,338 impr @ 0.43% CTR, cross-engine | **Decision, not a lever** | Verify SERP ownership; decide whether to exclude from CTR tracking and/or differentiate homepage title against "Diarium" (action-plan, new item) |
| Homepage CTR 8.05% → 3.18%, largely `diarium`-driven | **Diagnosis, not title work** | Do not rewrite; the collapse is inflow composition, not a homepage relevance problem |
| `password protected journal app` pos 27.5 → 5, 0 clicks | **New page-1 opportunity** | Confirm owning page, reinforce internal links now (action-plan, new item, P1) |
| `private-journal-app-how-to-choose` CTR flat/down, position down | **Confounded, do not act** | Re-test next cycle before any further title/meta change |
| `mini diary` / `mini diary app` now real on Google (not just Bing) | **Cluster-map correction** | Update `STRATEGY.md` §3 predecessor cluster row |
| Bing conversational/GEO long-tail cluster (new) | **Watch, not yet a post** | Track next cycle; consider a post only if volume grows |
| First AI-citation baseline (Google AI Overview + Bing Copilot) | **Baseline established** | Compare next cycle; run the manual ChatGPT/Perplexity checklist alongside it |
| `softwareVersion` drift check | **Schema validity** | No drift (0.6.6 everywhere); keep the recurring check |
