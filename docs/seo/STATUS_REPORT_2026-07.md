# Mini Diarium: SEO/GEO Status Report

**Snapshot date:** 2026-07-13 · **Data window:** 2026-04-12 → 2026-07-11 (last 3 months)
**Author:** Francisco J. Revoredo

Point-in-time health report. It combines the technical/GEO audit state with the July
performance analysis for both engines. This is a **dated snapshot**, it is not maintained
after this date. The durable reference is [`STRATEGY.md`](STRATEGY.md); the living fix queue is
[`action-plan.md`](action-plan.md). Findings follow the `seo-audit` Issue / Impact / Evidence /
Fix / Priority structure.

**Data sources**
- Google Search Console: `performance/google-search-console_2026-07-13/` (`Queries.csv`,
  `Pages.csv`, `Countries.csv`, `Devices.csv`; also `Chart.csv`, `Filters.csv`).
- Bing Webmaster Tools: `performance/mini-diarium.com_SearchPerformanceOverview_All_7_13_2026.csv`
  (overview) and `performance/mini-diarium.com_KeywordReport_7_13_2026.csv` (query-level, 255
  keywords, new this cycle; the earlier "Bing is overview-only" read is superseded).

---

## 1. Executive summary

**Overall health: strong foundation, unrealized growth.** The site is technically
well-optimized and captures its branded/navigational demand almost perfectly. It does **not**
yet capture generic growth demand: the product's own positioning terms rank on page 3–5, and
the two highest-impression non-branded pages convert clicks poorly. The work this quarter is
CTR rescue on pages that already rank, a striking-distance rank push, and two new posts filling
the clearest content gap. No new infrastructure is needed.

**Top 5 findings**
1. **Branded demand is captured; generic demand is not.** ~53% of Google clicks are branded
   ("mini diarium", pos ~1.3, ~45% CTR). The positioning terms that would drive new users
   (`secure journal app` pos ~44, `private journal app` pos ~40, `password protected journal`
   pos ~30) are almost entirely unrealized.
2. **`/encrypted-journal/` is the biggest single lever:** 4,156 impressions at **0.94% CTR**,
   position ~7.3. A title/meta CTR rescue here has more upside than any other single change.
3. **`/blog/private-journal-app-how-to-choose/` is the second lever:** 1,952 impressions at
   **0.26% CTR**, position ~10.2.
4. **Bing tells a complementary story Google under-reports:** Bing search is Windows/PC-first,
   shows real "Mini Diary" predecessor demand, and surfaces feature-intent queries ("does
   diarium have a password", "offline encrypted diary" pos ~3) where the site already ranks
   well but at tiny volume.
5. **Two on-site regressions vs the May archived plan:** the homepage `<title>` still uses an
   em dash (blog titles were converted to `|`; homepage/OG/Twitter were not), and the LCP
   `preload` + `a.fsdn.com` `preconnect` hints are absent despite being marked done.

**Quick wins (all low-effort, high-confidence, seeded into the action plan):** rewrite
`/encrypted-journal/` title+meta; rewrite the how-to-choose post title+description; homepage
`-` → `|`; add LCP `preload` + `a.fsdn.com` `preconnect`; push `encrypted diary` (pos ~11.6)
with on-page targeting + internal links.

---

## 2. Technical & GEO state

**Implemented (verified present):**
- JSON-LD `@graph` with `SoftwareApplication` / `Organization` / `WebSite` / `FAQPage`,
  `SearchAction`, `DefinedTermSet`, `ItemList`, and `HowTo` on docs pages.
- `llms.txt` (with per-article descriptions) and `ai-crawlers.txt`.
- IndexNow (auto-submits to `api.indexnow.org` + Bing directly).
- BLUF "Short answer" openings on blog posts (`BLUF_MAP`).
- Canonical + `hreflang x-default` on every page.
- `softwareVersion` **consistent at 0.6.2** across the homepage and `/encrypted-journal/`
  (the May P1-A drift is fixed and did not recur this cycle).
- `dateModified` current (2026-07-12) on the homepage schema.

**Open gaps / regressions:**

| Issue | Impact | Evidence | Fix | Priority |
|---|---|---|---|---|
| Homepage `<title>`, `og:title`, `twitter:title` use an em dash separator | Low–Med (SERP display; inconsistent with blog titles which use `\|`) | `website/index.html` lines 16, 28, 32 all read `Mini Diarium, Encrypted Journal App…` | Replace `-` with `\|` in all three | P2 |
| LCP `preload` hint absent | Med (Core Web Vitals; `demo-poster.png` is the LCP candidate, discovered late in parse) | `grep rel="preload" website/index.html` → 0 matches | Add `<link rel="preload" as="image" href="/assets/demo-poster.png" fetchpriority="high">` after charset | P2 |
| `a.fsdn.com` `preconnect`/`dns-prefetch` absent | Low–Med (extra DNS+TLS round-trip before SourceForge badge loads) | `grep preconnect website/index.html` → 0 matches; badge at line 310 | Add `preconnect` + `dns-prefetch` for `https://a.fsdn.com` | P2 |
| Shared OG image across all pages/posts | Low (generic logo on social/AI link previews) | All pages use `/assets/og-cover.png` | Per-post OG cards (deferred; archived P3-F) | P4 |
| `softwareVersion` drift is a recurring bug class | Med when it recurs (schema validity) | No drift this cycle, but it recurred historically (archived P1-A) | Verify every cycle against `src-tauri/tauri.conf.json`; long-term make it a build-time constant | P4 |

GEO posture is already near-optimal (BLUF + FAQ schema on static pages + `llms.txt`); the
research corpus validates this design [corpus §5.2]. The remaining GEO work is editorial
coverage, not infrastructure.

---

## 3. Performance analysis: Google

**Totals (window):** ~455 clicks / ~13,555 impressions, ~3.36% site CTR.

**Branded vs non-branded.** Branded queries ("mini diarium" 239 clicks, "mini diarium app" 3,
plus variants) are ~53% of clicks at position ~1.3 and ~45% CTR. Navigational demand is
captured well. **Generic/positioning demand is the unrealized pool.**

**The two low-CTR high-impression pages (biggest immediate levers):**

| Page | Impr | CTR | Pos | Issue |
|---|---|---|---|---|
| `/encrypted-journal/` | 4,156 | **0.94%** | 7.28 | Title/meta/intent mismatch for "encrypted journal / diary" intent |
| `/blog/private-journal-app-how-to-choose/` | 1,952 | **0.26%** | 10.22 | Weak title/description at bottom of page 1 |

**Striking distance (page 2, pos 8–20), near-term rank wins:**

| Query | Pos | Impr | Note |
|---|---|---|---|
| encrypted diary | **11.64** | 74 | **Best single near-term win** |
| is entries ai safe | 12.64 | 22 | Owned by AI-privacy post |
| encrypted journal app | 8.07 | 43 | Already close; drives the pillar |

**The page-3–5 positioning-term cluster (the growth pool, almost entirely unrealized):**

| Query | Pos | Impr |
|---|---|---|
| private journal app | 40.03 | 34 |
| private journaling app | 37.5 | 10 |
| private diary app | 41.33 | 6 |
| secure journal app | 43.82 | 17 |
| password protected journal | 30 | 3 |
| password protected journal app | 27.5 | 2 |

**Device breakdown:** Desktop 375 clicks / 11,535 impr (3.25% CTR); Mobile 72 / 1,924 (3.74%);
Tablet 8 / 96 (8.33%). Desktop dominates impressions, consistent with a desktop app.

**Country breakdown, the geo CTR gap:** the US delivers **5,736 impressions at just 1.2%
CTR** (the worst CTR of any major market), while India converts at 13.7% (635 impr) and
Pakistan at 18.2%. The US is the largest impression pool with the most CTR headroom.

---

## 4. Performance analysis: Bing (query-level)

**Totals (window):** ~80 clicks / ~1,568 impressions (overview CSV). Query-level `KeywordReport`
adds 255 keywords. Where the site ranks on Bing it ranks well (pos 2–6) but volumes are tiny.
Bing surfaces demand Google under-reports:

- **Windows/PC-first intent.** "diary app for windows" (pos ~6.3, 10 impr), "offline diary for
  pc" (pos ~6.6), "desktop diary windows", "diarium for windows", and dozens of "windows"
  variants. This is a distinct audience Google's data does not surface, and the exact channel
  IndexNow already pushes to.
- **Predecessor ("Mini Diary") demand pool.** "mini diary" (95 impr / 8 clicks, pos ~3),
  "minidiary open source journal app" (pos ~1), "mini diary open source encrypted journal
  github abandoned" (pos ~2.5). Clear successor intent.
- **Feature / differentiator intent** competitor Diarium can't fully answer: "does diarium have
  a password" (pos ~5.5), "can you lock certain entries in diarium" (pos ~3.5), "offline
  encrypted diary" (pos ~3), "encrypted journal software" (pos ~2.5), and the GEO-friendly
  *question* query "why is a journal offline?" (pos ~2.5).

**Contrast with Google.** The two engines want different emphasis: **Google = topic/positioning
terms** (encrypted diary, private/secure journal app), **Bing = platform + successor + feature
intent** (windows, mini diary successor, password/lock). Recommendations must serve both: keep
Windows/desktop framing explicit where honest, keep the `mini-diary-alternative` page strong,
and answer the password/lock feature intent precisely (observing the accuracy guardrail:
whole-journal encryption + per-entry edit-lock, never per-entry passwords).

---

## 5. Gap-to-opportunity map

Each finding tagged with the lever it pulls.

| Finding | Lever | Action |
|---|---|---|
| `/encrypted-journal/` 0.94% CTR @ 4,156 impr | **Title/meta CTR** | Rewrite title+meta+og+twitter (action-plan #1) |
| `private-journal-app-how-to-choose` 0.26% CTR @ 1,952 impr | **Title/meta CTR** | Rewrite title+description (action-plan #2) |
| `encrypted diary` pos 11.64 | **Rank push** | On-page targeting + internal links (action-plan #5) |
| `secure/password-protected journal` pos 27–44, no page | **New content** | Two new posts (action-plan #7, #8) |
| `private journal app` cluster pos 37–41 | **New content + internal linking** | Strengthen how-to-choose post; internal links from cluster |
| Homepage em-dash title | **SERP display** | `-` → `\|` (action-plan #3) |
| Missing LCP preload / fsdn preconnect | **Core Web Vitals** | Add hints (action-plan #4) |
| US 1.2% CTR @ 5,736 impr | **Title/meta CTR (geo)** | Downstream of #1/#2/#3; largest headroom market |
| Bing Windows/successor/feature intent | **New content + framing** | Windows-explicit framing; keep `mini-diary-alternative` strong; password post answers feature intent |
| `softwareVersion` drift risk | **Schema validity** | Recurring cycle check vs `tauri.conf.json` |
