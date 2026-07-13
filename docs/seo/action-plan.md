# Mini Diarium: SEO/GEO Action Plan

**Living document.** Prioritized fix queue grounded in the current performance data. Kept
current by the `seo-performance-review` skill each cycle. Priorities: **P1** = do now, **P2** =
this cycle, **P3** = this month, **P4** = ongoing/deferred.

- Strategy behind these actions: [`STRATEGY.md`](STRATEGY.md).
- The data snapshot they were derived from: [`STATUS_REPORT_2026-07.md`](STATUS_REPORT_2026-07.md).
- This file **replaces** the stale `docs/seo/seo-fix-plan.md` reference that previously lived
  in `website/CLAUDE.md`.

Each item: file/location, exact change, expected effect, and a verification command. Rebuild
after any `posts-src/` or static-page change with `cmd.exe /c bun run website:build-static`
(never `website:blog` alone). Verify against the archived review's Verification Checklist
(`curl … | grep`) once deployed.

**Legend:** ☐ open · ☑ done this cycle (2026-07).

---

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

### ☑ 5. `encrypted diary` striking-distance push (pos ~11.64)
- **Data:** the single best near-term rank win (page 2, 74 impr).
- **Files:** `website/encrypted-journal/index.html` and
  `website/posts-src/2026-05-08-what-is-an-encrypted-diary.md`.
- **Change:** strengthen on-page targeting of "encrypted diary" on the pillar page and add/keep
  internal links from `/encrypted-journal/` and `what-is-an-encrypted-diary` to reinforce the
  cluster. Do not keyword-stuff (frozen signal per `STRATEGY.md` §4).
- **Expected effect:** push from page 2 to page 1 over the next cycle; validate directionally.
- **Verify:** internal links resolve; position tracked next cycle in the review skill.

---

## P2: On-site regressions (this cycle)

### ☑ 3. Homepage title separator `-` → `\|`
- **File:** `website/index.html`, `<title>` (line ~32), `og:title` (~16), `twitter:title` (~28).
- **Change:** replace the em dash with a pipe in all three (blog titles already use `\|`;
  homepage/OG/Twitter were missed in the May pass).
- **Verify:** `curl -s https://mini-diarium.com/ | grep -o '<title>[^<]*'` shows `\|`, not `-`.

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

### ☑ 6. `softwareVersion` drift check
- **Data:** recurring bug class (archived P1-A / P4-C). Current app version: `0.6.2`
  (`src-tauri/tauri.conf.json`).
- **Change:** confirm every page carrying `SoftwareApplication` schema agrees with the current
  version. **This cycle: homepage and `/encrypted-journal/` both show 0.6.2, no drift.** No
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

---

## P4: Ongoing / deferred

- **Per-post OG images** (archived P3-F): generic `og-cover.png` shared everywhere. Deferred;
  low priority.
- **`softwareVersion` as a build-time constant** (archived P4-C): prevents the drift bug class
  permanently. Deferred until the next release-tooling pass.
- **US CTR gap** (5,736 impr @ 1.2%): largely downstream of the title/meta rescues above; re-check
  next cycle before treating as a separate workstream.
- **Mini Diary successor demand** (Bing): `mini-diary-alternative` already exists; the review
  skill decides refresh-vs-new each cycle. Usually a strengthen, not a new post.

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
