# Mini Diarium: SEO/GEO Action Plan

**Living document.** Prioritized fix queue grounded in the current performance data. Kept
current by the `seo-performance-review` skill each cycle. Priorities: **P1** = do now, **P2** =
this cycle, **P3** = this month, **P4** = ongoing/deferred.

- Strategy behind these actions: [`STRATEGY.md`](STRATEGY.md).
- The data snapshot the open items below were derived from: [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md)
  (prior snapshot: [`STATUS_REPORT_2026-07.md`](STATUS_REPORT_2026-07.md)).
- This file **replaces** the stale `docs/seo/seo-fix-plan.md` reference that previously lived
  in `website/CLAUDE.md`.

Each item: file/location, exact change, expected effect, and a verification command. Rebuild
after any `posts-src/` or static-page change with `cmd.exe /c bun run website:build-static`
(never `website:blog` alone). Verify against the archived review's Verification Checklist
(`curl … | grep`) once deployed.

**Legend:** ☐ open · ☑ done. Cycle it was closed in is noted per item.

---

## P1: 2026-08 cycle — new items

### ☑ 10. Decide a response to the `diarium` query-collision problem
- **Data:** bare query `diarium` grew 828 → 5,338 impressions (Google, +544%) at a flat 0.43%
  CTR; Bing shows the same shape (716 impr, 0.42% CTR). Full detail and the confirming web
  search on the competing "Diarium" app (diariumapp.com, Timo Partl):
  [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md) §3.
- **Decision needed (not yet made):** (a) whether the homepage title/meta should more
  explicitly differentiate "Mini Diarium" from "Diarium" on the chance some of this traffic is
  confused rather than committed to the other product, and (b) whether to exclude the
  `diarium`-family query cluster from CTR-health tracking going forward so it stops masking
  real signal on the homepage's actual audience.
- **Do not** spend title/meta effort chasing the term "diarium" itself — it reads as an
  unconvertible collision, not real demand (frozen-signal territory).
- **Resolved (2026-08-22):** ran the SERP check. A web search for `diarium` returns the real
  Diarium app's Microsoft Store, App Store, Google Play, and diariumapp.com listings plus its
  own community forum — mini-diarium.com does not appear at all. This confirms the collision
  reading: the term is genuinely unconvertible for us at any position. Decision: do not chase
  it or the homepage title. Exclude the `diarium`-family query cluster from CTR-health
  tracking going forward so it stops masking real signal on the homepage's actual audience —
  applied starting with the 2026-08 report's branded-split framing; carry the same exclusion
  into the 2026-09 cycle's comparison.

### ☑ 11. Reinforce `password protected journal app` (new page-1 position)
- **Data:** position 27.5 → 5 this cycle (was Google page-3, now page-1 range), 15 impressions,
  0 clicks. Likely owned by the `password-protected-journal-app` post from action-plan #7, but
  these exports don't provide a query→page join to confirm.
- **Change:** confirm which page/URL is actually ranking (a targeted Search Console URL
  inspection or a live SERP check), then add/strengthen internal links into it from
  `/encrypted-journal/` and the private-journal-app-how-to-choose pillar, matching the pattern
  already used for the `encrypted diary` push (#5) and the cluster interlink (#9).
- **Expected effect:** consolidate the position before it has a chance to slip back; 0 clicks
  at 15 impressions is not a CTR problem yet, just too little volume to read.
- **Verify:** position holds or improves next cycle in the review skill.
- **Done (2026-08-22):** confirmed the owner — `website/posts-src/2026-07-13-password-protected-journal-app.md`
  is titled "Password-Protected Journal App: What It Really Means," an exact-match target for
  this query, and it already links out to the pillar and the how-to-choose post. The
  how-to-choose pillar already linked back in (from the July #9 pass). The one missing leg was
  `/encrypted-journal/` → the password post: added a contextual link in
  `website/encrypted-journal/index.html` (in the "password screen vs real encryption" paragraph,
  next to the existing `what-is-an-encrypted-diary` link) and rebuilt with
  `bun run website:build-static`. Cluster is now fully interlinked in both directions.
- **Verify:** `grep -o 'href="/blog/password-protected-journal-app/"' website/encrypted-journal/index.html`
  returns the new line; position tracked next cycle.

### ☐ 12. Do NOT re-rewrite `/blog/private-journal-app-how-to-choose/` title/meta this cycle
- **Data:** CTR went 0.26% → 0.20% and position went 10.22 → 11.83 since the July rewrite
  (action-plan #2). The CTR dip is confounded by the position decline — a worse position alone
  depresses CTR independent of the copy — so this is **not** evidence the July rewrite failed.
- **Action:** re-test next cycle before touching the title/meta again. Two rewrites in two
  cycles would make the signal permanently unreadable.

### ☑ 13. Update the predecessor cluster note in `STRATEGY.md` §3
- **Data:** `mini diary` (pos 11.36, 14 impr) and `mini diary app` (pos 8.62, 13 impr) now show
  real volume in **Google** data this cycle, not just Bing. July's map described this as
  "Bing-only predecessor demand" — that line needs correcting.
- **Change:** update the `Cluster: Predecessor "Mini Diary" successor` table in `STRATEGY.md`
  §3 to add the Google rows and drop the Bing-only framing.
- **Done (2026-08-22):** table updated with the Google rows; framing corrected to note both
  engines show predecessor demand as of this cycle.

---

## P2: 2026-08 cycle — GEO baseline

### ☐ 14. Run the manual ChatGPT/Perplexity GEO spot-check next cycle
- **Data:** the review skill's Step 3 now pulls real Google AI-Overview (~3,309 impr this
  window) and Bing/Copilot citation data (175 citations / 78 cited-page-days) automatically —
  see [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md) §6. This is a first-cycle baseline
  with nothing to compare against yet, so the manual ~30-query ChatGPT/Perplexity checklist was
  skipped this cycle rather than spent on a read with no movement to validate.
- **Action:** run it next cycle (`references/geo-citation-queries.md` in the review skill) so
  all four engines get their first comparison point together.

### ☐ 15. Watch the Bing conversational/GEO long-tail cluster for a content-brief trigger
- **Data:** new this cycle — full-sentence, AI-assisted-search-shaped queries already ranking
  well on Bing: `i am looking for a private diary app with encryption` (pos 5.2, 6 impr),
  `fully local journaling app for sensitive data` (pos 4.75, 8 impr), `offline journaling app
  encryption local-first privacy` (pos 3.6, 8 impr), `encrypted local diary app` (pos 1.5, 8
  impr). See [`STATUS_REPORT_2026-08.md`](STATUS_REPORT_2026-08.md) §5.
- **Why not acted on now:** each query is single-digit impressions — too low-volume to confirm
  real, recurring demand per the §5 caveat (statistically fragile below aggregate volume).
  Writing a post now would be chasing an unconfirmed signal, not responding to demand.
- **Action next cycle:** re-check this cluster's impressions/positions. If volume grows and the
  queries persist as a group (not one-off), draft a content brief per the review skill's Step 4
  (target query, cluster placement, working title, BLUF, H2 outline, internal links). If it
  stays flat or thins out, drop it from the watch list.
---

## Closed — 2026-07 cycle

## P1: Highest-leverage CTR / rank moves

### ☑ 1. `/encrypted-journal/` CTR rescue (biggest single lever)
- **Data:** 4,156 impressions, 0.94% CTR, pos ~7.28. Intent: "encrypted journal / encrypted
  diary / encrypted journal app".
- **File:** `website/encrypted-journal/index.html`, `<title>`, `<meta name="description">`,
  `og:title`, `og:description`, `twitter:title`, `twitter:description`.
- **Change:** lead the title with the exact query + a benefit hook and include "diary" to catch
  `encrypted diary`; rewrite the description as a click hook (benefit-first), not a product
  restatement. Keep body/intent aligned (the page already answers the intent well).
- **Expected effect:** CTR from ~0.94% toward the 2–3% typical of position ~7. This is the
  largest impression pool on the site, so even +1pp CTR is material.
- **Verify:** `curl -s https://mini-diarium.com/encrypted-journal/ | grep -o '<title>[^<]*'`
  shows the new copy; `og:title`/`twitter:title` match.
- **Validated (2026-08 cycle):** CTR 0.94% → 1.34%, clicks 39 → 63, position 7.28 → 6.85. Clean
  win, no further action needed.

### ☑ 2. `/blog/private-journal-app-how-to-choose/` CTR rescue
- **Data:** 1,952 impressions, 0.26% CTR, pos ~10.22.
- **Files:** `website/posts-src/2026-05-08-private-journal-app-how-to-choose.md` (title +
  description front matter) and `scripts/generate-website-blog.mjs` (`DESCRIPTION_MAP` +
  `BLUF_MAP` if the description changes). Rebuild.
- **Change:** more click-worthy title (keep ≤60 chars) and a benefit-promising description
  (140–160 chars).
- **Expected effect:** CTR up from 0.26%; the post sits at the bottom of page 1 where a stronger
  snippet has outsized effect.
- **Verify:** generated `website/blog/private-journal-app-how-to-choose/index.html` `<title>` +
  `<meta name="description">` reflect the new copy; `DESCRIPTION_MAP`/`BLUF_MAP` in sync.
- **Not validated, confounded (2026-08 cycle):** CTR 0.26% → 0.20%, position 10.22 → 11.83. The
  CTR dip is confounded by the position decline, not evidence the copy failed. See action-plan
  #12: do not rewrite again this cycle, re-test next cycle.

### ☑ 5. `encrypted diary` striking-distance push (pos ~11.64)
- **Data:** the single best near-term rank win (page 2, 74 impr).
- **Files:** `website/encrypted-journal/index.html` and
  `website/posts-src/2026-05-08-what-is-an-encrypted-diary.md`.
- **Change:** strengthen on-page targeting of "encrypted diary" on the pillar page and add/keep
  internal links from `/encrypted-journal/` and `what-is-an-encrypted-diary` to reinforce the
  cluster. Do not keyword-stuff (frozen signal per `STRATEGY.md` §4).
- **Expected effect:** push from page 2 to page 1 over the next cycle; validate directionally.
- **Verify:** internal links resolve; position tracked next cycle in the review skill.
- **Validated (2026-08 cycle):** position 11.64 → 7.45, page 2 → page 1. Cleanest win of the
  cycle.

---

## P2: On-site regressions (this cycle)

### ☑ 3. Homepage title separator `-` → `\|`
- **File:** `website/index.html`, `<title>` (line ~32), `og:title` (~16), `twitter:title` (~28).
- **Change:** replace the em dash with a pipe in all three (blog titles already use `\|`;
  homepage/OG/Twitter were missed in the May pass).
- **Verify:** `curl -s https://mini-diarium.com/ | grep -o '<title>[^<]*'` shows `\|`, not `-`.
- **Unmeasurable, confounded (2026-08 cycle):** homepage CTR is dominated this cycle by the
  `diarium`-collision query inflow (action-plan #10); any separator effect is unreadable
  underneath it.

### ☑ 4. Performance hints (LCP preload + fsdn preconnect)
- **File:** `website/index.html` `<head>`, immediately after `<meta charset="UTF-8" />`.
- **Change:** add
  `<link rel="preload" as="image" href="/assets/demo-poster.png" fetchpriority="high">` and
  `<link rel="preconnect" href="https://a.fsdn.com" crossorigin>` +
  `<link rel="dns-prefetch" href="https://a.fsdn.com">`.
- **Expected effect:** earlier LCP discovery (Core Web Vitals) and one fewer round-trip for the
  SourceForge badge.
- **Verify:** `curl -s https://mini-diarium.com/ | grep 'rel="preload"'` returns the
  `demo-poster.png` line; `grep preconnect` returns the `a.fsdn.com` line.
- **Unmeasurable, confounded (2026-08 cycle):** same reason as #3 — homepage CTR this cycle is
  dominated by the `diarium`-collision inflow.

### ☑ 6. `softwareVersion` drift check
- **Data:** recurring bug class (archived P1-A / P4-C).
- **Change:** confirm every page carrying `SoftwareApplication` schema agrees with the current
  version (`src-tauri/tauri.conf.json`). **2026-07 cycle: 0.6.2 everywhere, no drift. 2026-08
  cycle: app bumped to 0.6.6; homepage and `/encrypted-journal/` both show 0.6.6, no drift.** No
  fix needed; keep the check in the recurring cycle.
- **Verify:**
  `curl -s https://mini-diarium.com/encrypted-journal/ | grep -o '"softwareVersion": "[^"]*"'`
  equals the homepage value equals `tauri.conf.json`.

---

## P3: New content (this month)

### ☑ 7. New post: Password-protected journal app
- **Cluster:** secure/password-protected (Google `password protected journal` pos ~27–30, no
  dedicated page) + Bing feature-intent ("does diarium have a password", "can you lock certain
  entries in diarium").
- **Guardrail:** apply the password/lock accuracy guardrail
  ([`product-marketing-context.md`](product-marketing-context.md)): whole-journal AES-256-GCM +
  per-entry edit-lock, never per-entry encryption.
- **Deliverable:** `website/posts-src/2026-07-…-password-protected-journal-app.md` + map
  entries; rebuild.
- **Done:** drafted, mapped, and built in the 2026-07-13 cycle;
  `website/posts-src/2026-07-13-password-protected-journal-app.md` (`draft: false`, title 48
  chars, desc ~152 chars, no em dashes, guardrail applied), `DESCRIPTION_MAP`/`BLUF_MAP` entries
  present, and `website/blog/password-protected-journal-app/index.html` generated. Verified this
  pass — front matter, maps, and generated HTML all present and guardrail-compliant; the P3
  checkbox was simply never flipped last cycle.
- **First measurable cycle (2026-08):** the July window closed 2026-07-11, two days before this
  post published, so August is its first real data. `password protected journal app` jumped
  27.5 → 5, `password protected journal` 30 → 27.8. Zero clicks so far (expected at these
  positions/volumes). See action-plan #11.

### ☑ 8. New post: Secure journal app
- **Cluster:** Google `secure journal app` / `secure diary` (pos ~44) + Bing "encrypted journal
  software" (pos ~2.5), "offline encrypted diary" (pos ~3). Definitional + buyer intent,
  GEO-friendly; a natural place to lead with the Windows/desktop framing Bing rewards.
- **Deliverable:** `website/posts-src/2026-07-…-secure-journal-app.md` + map entries; rebuild.
- **Done:** drafted, mapped, and built in the 2026-07-13 cycle;
  `website/posts-src/2026-07-13-secure-journal-app.md` (`draft: false`, title 50 chars, desc
  ~153 chars, three-property "secure" framing, honest desktop-only limitation),
  `DESCRIPTION_MAP`/`BLUF_MAP` entries present, and
  `website/blog/secure-journal-app/index.html` generated. Verified this pass — front matter,
  maps, and generated HTML all present; the P3 checkbox was simply never flipped last cycle.
- **First measurable cycle (2026-08):** `secure journal app` 43.82 → 36.23, still page 3, 0
  clicks. Directionally right, too early to expect conversions.

### ☑ 9. Strengthen the `private journal app` cluster
- Add internal links from the secure/password posts and the pillar into
  `private-journal-app-how-to-choose`; keep the cluster complete so the page-3–5 positioning
  terms have a strong owning page. No new post needed unless the review skill surfaces a gap.
- **Done (2026-07-14):** the secure and password posts already linked into
  `private-journal-app-how-to-choose` (from the 2026-07-13 cycle). This pass closed the two
  remaining gaps: added a contextual inline link from the pillar
  `website/encrypted-journal/index.html` → `/blog/private-journal-app-how-to-choose/`, and added
  reciprocal links from `private-journal-app-how-to-choose` → `/blog/secure-journal-app/` and
  `/blog/password-protected-journal-app/` in its closing links block. Cluster is now fully
  interlinked; `updated:` on the pillar post bumped to 2026-07-14 and rebuilt.
- **First measurable cycle (2026-08):** `private journal app` 40.03 → 27.56 (+34 impr → 61
  impr), `private journaling app` 37.5 → 29.77. Cluster is climbing across the board; 0 clicks
  so far, still page 3.

---

## P4: Ongoing / deferred

- **Per-post OG images** (archived P3-F): generic `og-cover.png` shared everywhere. Deferred;
  low priority.
- **`softwareVersion` as a build-time constant** (archived P4-C): prevents the drift bug class
  permanently. Deferred until the next release-tooling pass.
- **US CTR gap** (5,736 impr @ 1.2%, July data): downstream of the title/meta rescues; unclear
  this cycle whether it's improved, since the `diarium` inflow (action-plan #10) may itself be
  skewed US-heavy — recheck by country next cycle once the collision question is resolved.
- **Mini Diary successor demand:** `mini-diary-alternative` already exists; now shows real
  demand on **both** Google and Bing (action-plan #13), not just Bing as previously read. The
  review skill decides refresh-vs-new each cycle. Usually a strengthen, not a new post.

---

## Hypothesis log

Every change is recorded here as a testable hypothesis with an expected direction, validated
next cycle by directional movement (we cannot prove causation at this traffic scale, see
`STRATEGY.md` §5). Append, never rewrite history.

| Date | Change | Hypothesis (expected direction) | Validated? (next cycle) |
|---|---|---|---|
| 2026-07-13 | Rewrote `/encrypted-journal/` title+meta (#1) | CTR rises from ~0.94% toward 2%+ at pos ~7 | pending |
| 2026-07-13 | Rewrote `private-journal-app-how-to-choose` title+desc (#2) | CTR rises from ~0.26% | pending |
| 2026-07-13 | Homepage `-` → `\|` (#3) | Neutral-to-slight CTR/consistency gain; no regression | pending |
| 2026-07-13 | Added LCP preload + fsdn preconnect (#4) | LCP improves; no CWV regression | pending |
| 2026-07-13 | Strengthened `encrypted diary` targeting + internal links (#5) | `encrypted diary` moves from pos ~11.6 toward page 1 | pending |
| 2026-07-13 | Drafted secure / password-protected posts (#7, #8) | New impressions on the secure/password cluster within 1–2 cycles | pending |
| 2026-07-14 | Interlinked the `private journal app` cluster (#9): pillar → how-to-choose, and how-to-choose → secure/password posts | Strengthens the owning page's authority for page-3–5 `private journal app` terms; expect gradual rank lift on those terms | pending |
| 2026-08-22 | Validation pass on the 2026-07-13/14 hypotheses above, against the 2026-08 export | (1) title+meta #1: **validated**, CTR 0.94%→1.34%. (2) title+desc #2: **not validated, confounded** — CTR 0.26%→0.20% but position also fell 10.22→11.83, so the copy isn't cleared or convicted. (3) homepage separator #3: **unmeasurable, confounded** by the `diarium` inflow (see next row). (4) LCP/preconnect #4: **unmeasurable**, same confound. (5) `encrypted diary` push #5: **validated**, pos 11.64→7.45, page 2→1. (7,8) secure/password posts: **validated directionally** — `password protected journal app` 27.5→5, `private journal app` 40.03→27.56, `secure journal app` 43.82→36.23, all 0 clicks (expected at these positions/volumes, first cycle since the posts published 2026-07-13). (9) cluster interlink: **validated directionally**, same cluster movement as #7/#8. | validated/confounded, see cells |
| 2026-08-22 | New hypothesis: the bare query `diarium` (828→5,338 impr, Google; new at 716 impr, Bing) is search-term collision with the unrelated competing app "Diarium" (diariumapp.com), not demand for Mini Diarium — see `STATUS_REPORT_2026-08.md` §3 and action-plan #10 | If correct, this query cluster's CTR stays near-zero regardless of any title/meta change, and a live SERP check for `diarium` shows Diarium/diariumapp.com or Microsoft Store dominating the result set | **Validated same-day (2026-08-22).** SERP for `diarium` returns only the real Diarium app's own listings/forum; mini-diarium.com does not appear. Decision executed: excluded from CTR tracking, no title/meta chase (action-plan #10). |
| 2026-08-22 | New hypothesis: `password protected journal app` reaching position 5 (#11) will hold or improve once internal links are reinforced | Position holds ≥ page 1 and starts converting clicks as impressions accumulate | pending |
| 2026-08-22 | Added `/encrypted-journal/` → `/blog/password-protected-journal-app/` internal link (#11), closing the last gap in the secure/password cluster's interlinking (how-to-choose → password post already existed since 2026-07-14) | Reinforces the post's new position 5 ranking; expect it to hold or improve, and for clicks to start appearing as impressions accumulate | pending |
| 2026-08-22 | Baseline only (no hypothesis yet): first-ever Google AI-Overview (~3,309 impr) and Bing/Copilot citation (175 citations/78 cited-page-days) data pulled this cycle | N/A — establishes the comparison point for 2026-08 onward | baseline |
