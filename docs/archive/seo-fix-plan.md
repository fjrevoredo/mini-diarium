# SEO Fix Plan — Mini Diarium Website

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-08
- Last Updated: 2026-05-08
- Owner: Coding agent
- Approval: PENDING
- Source: [SEO Audit Report](seo/) (Feb 19–May 6, 2026 GSC data)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Increase organic click-through rates from search results by rewriting low-CTR page titles and meta descriptions, improving internal linking and navigation, adding hreflang foundations, creating new content for keyword gaps, and documenting production configuration requirements. Target outcome: raise the 9-page click baseline and reduce the number of pages at positions 6–10 with 0% CTR.

## Scope

- Rewrite `<title>` and `<meta name="description">` on underperforming pages (both static HTML and blog post front matter)
- Add `/compare/` and `/encrypted-journal/` to main site navigation across all page templates
- Add `hreflang="x-default"` link tags to all manual and generated pages
- Write 2 new blog posts targeting the highest-opportunity non-brand keyword gaps
- Document production-level HTTP redirect requirements for Coolify
- Run `bun run website:build-static` to regenerate all blog-derived output

## Non-Goals

- Redesigning page layouts, CSS, or visual identity
- Modifying the homepage FAQ structure (dedicated FAQ page is a separate project)
- Adding or removing schema markup (existing JSON-LD is comprehensive)
- Implementing multi-language site translations (hreflang x-default is the foundation; full locale pages are out of scope)
- Changing production Coolify configuration (plan documents the requirements; implementation is ops)
- Modifying the docs generator (`generate-website-docs.mjs`) beyond hreflang

## Assumptions

1. `bun run website:build-static` is the canonical rebuild command and runs correctly from the current shell via `cmd.exe /c bun run website:build-static`
2. Production is deployed via Coolify; HTTP→HTTPS redirect and www→non-www canonicalization must be configured there, not in the local `website/nginx.conf`
3. Blog post front matter edits in `website/posts-src/*.md` are the only path to changing blog post titles/descriptions; never hand-edit generated HTML in `website/blog/`
4. Static pages (`website/index.html`, `website/encrypted-journal/index.html`, `website/compare/index.html`) are edited directly as per `website/CLAUDE.md`
5. The existing `DESCRIPTION_MAP` and `BLUF_MAP` in `scripts/generate-website-blog.mjs` contain hardcoded meta descriptions for OG/Twitter cards that differ from the front matter `description` field — both must be updated when post front matter changes
6. Google Search Console "Search Appearance" report shows no rich results despite valid JSON-LD FAQ schema; this may be due to FAQ content inside `<details>` elements — investigating schema eligibility is part of the plan

## Clarifications (Resolved)

- **Blog post depth (M4):** Full articles — write complete article bodies following the content strategy from `website/CLAUDE.md`.
- **Nav label for `/encrypted-journal/`:** Use "How It Works" — matches the existing hero CTA label and is conversational.
- **FAQ schema investigation (T3.3):** Use agent-browser to run Google's Rich Results Test and capture actual pass/fail/warning results.

---

## Milestones

### Milestone 1: CTR Fixes — Title & Meta Rewrites

- Status: TO BE DONE
- Purpose: Fix the pages with highest impressions but lowest CTR (0–0.68%). These are the biggest missed traffic opportunities.
- Exit Criteria:
  - `/encrypted-journal/` has a rewritten title and meta description aiming for CTR > 2% (from current 0.32%)
  - 5 blog posts have updated front matter `title` and `description` fields improving their search snippet appeal
  - `/compare/` title and meta description rewritten for broader comparison-intent keywords
  - `DESCRIPTION_MAP` and `BLUF_MAP` in the generator script are synchronized with all changed post descriptions
  - `bun run website:build-static` completes without errors
  - Spot-check generated HTML for all changed posts confirms new titles and descriptions

#### Task 1.1: Rewrite `/encrypted-journal/` title and meta description

- Status: TO BE DONE
- Objective: This page gets 927 impressions (2nd most after homepage) at position 7.5 but only 3 clicks (0.32% CTR). The current title "Encrypted Journal App for Windows, macOS, and Linux | Mini Diarium" reads as a specification, not a promise. Meta description is factual but not compelling.
- Steps:
  1. Edit `website/encrypted-journal/index.html` line 6: change `meta name="description"` to a benefit-driven description that differentiates from competitors
  2. Edit line 14: change `og:title` to match the new title
  3. Edit line 24: change `twitter:title` to match the new title
  4. Edit line 25: change `twitter:description` to match the new meta description
  5. Edit line 27: change `<title>` to the new title
  6. Edit the `DESCRIPTION_MAP` entry for `"encrypted-journal-app-guide"` (or add one) if used for OG on this page, or verify this page's OG is self-contained
- Validation:
  - Open `website/encrypted-journal/index.html` and confirm `<title>`, `<meta name="description">`, `og:title`, `twitter:title` are all updated
  - Manually verify the new title is under 60 characters and the new description is 140–160 characters
- Notes:
  - This file is manually edited, not generated. No rebuild needed.
  - Suggested title pattern: "The Encrypted Journal App That Never Touches the Cloud | Mini Diarium" (60 chars) — leads with user concern, ends with brand
  - Suggested description pattern: "Mini Diarium encrypts every entry with AES-256-GCM before it touches disk. Offline-first, no cloud, no telemetry. Export your writing anytime." (154 chars)

#### Task 1.2: Rewrite blog post front matter for 5 underperforming posts

- Status: TO BE DONE
- Objective: Five blog posts rank at positions 6–13 with 0–0.68% CTR despite meaningful impression counts. Rewrite their `title` and `description` front matter to be more click-worthy in SERPs.
- Steps:
  1. **`website/posts-src/2026-03-12-private-diary-app-for-desktop.md`** (285 imp, 0 clicks, pos 12.9): Change `title` to something with a stronger hook. Change `description` to include a specific benefit statement.
  2. **`website/posts-src/2026-03-12-encrypted-journal-vs-cloud-notes-app.md`** (131 imp, 0 clicks, pos 8.3): Change `title` to emphasize the "why it matters" angle. Change `description` to promise a clear takeaway.
  3. **`website/posts-src/2026-03-12-offline-journal-that-you-own.md`** (61 imp, 0 clicks, pos 6.6): Change `title` to be more specific about ownership benefits. Change `description` to list concrete outcomes.
  4. **`website/posts-src/2026-04-05-mini-diary-alternative.md`** (147 imp, 1 click, 0.68% CTR, pos 8.2): Change `title` to add a year or number hook. Change `description` to more directly address the searcher's intent.
  5. **`website/posts-src/2026-03-06-why-an-offline-journal-is-different.md`** (84 imp, 0 clicks, pos 8.1): Change `title` to be more provocative. Change `description` to create curiosity.
- Validation:
  - Read each `.md` file and confirm the `title` and `description` front matter lines are updated
  - Each new title should be under 70 characters, each description 140–160 characters
- Notes:
  - After these edits, the generator must re-run (Task 1.5) to produce updated HTML
  - Suggested rewrites are documented in each file's edit, not hardcoded here — the agent should propose specific titles and descriptions, then run them by the user for approval before applying
  - The `DESCRIPTION_MAP` and `BLUF_MAP` in `scripts/generate-website-blog.mjs` must be updated to match the new descriptions (these map hardcoded OG/twitter descriptions per slug). This is handled in Task 1.4.

#### Task 1.3: Synchronize DESCRIPTION_MAP and BLUF_MAP in the generator

- Status: TO BE DONE
- Objective: The generator script has a `DESCRIPTION_MAP` (lines 20–43) and `BLUF_MAP` (lines 45–68) keyed by post slug. When blog post descriptions change, these maps must be updated so that OG/Twitter cards and the "Short answer" blurb stay consistent.
- Steps:
  1. Edit `scripts/generate-website-blog.mjs`: for each post whose `description` changed in Task 1.2, update the corresponding entry in `DESCRIPTION_MAP` to match the new front matter `description`
  2. Edit the corresponding entry in `BLUF_MAP` to align with the new description tone
- Validation:
  - After rebuild, inspect a generated post HTML and confirm `og:description` and `twitter:description` match the new front matter
- Notes:
  - The `DESCRIPTION_MAP` is used in the generated `<head>` for OG/Twitter meta tags. The `BLUF_MAP` is used for the "Short answer" paragraph at the top of each post.
  - If a slug does not appear in these maps, the script falls back to the front matter `description` directly. Currently all 10 slugs have entries.

#### Task 1.4: Rewrite `/compare/` title and meta for broader comparison intent

- Status: TO BE DONE
- Objective: The `/compare/` page exists in the sitemap but gets zero traffic in GSC. Its title "Mini Diarium vs. The Alternatives | Comparison Guide" may not match what users search for. Rewrite to capture comparison-intent keywords.
- Steps:
  1. Edit `website/compare/index.html` lines 6, 14, 20, 23: update `description`, `og:title`, `twitter:title`, and `<title>`
  2. Add a stronger meta description that lists specific competitors compared
- Validation:
  - Confirm `<title>` and `<meta name="description">` are updated
  - Title should include "comparison" or "alternative" and mention a key competitor name (e.g., "Day One")
- Notes:
  - Suggested title: "Mini Diarium vs. Day One, Notion & Obsidian | Journal App Comparison" (64 chars)
  - Suggested description should name-check the specific apps compared (Day One, Notion, Obsidian, Standard Notes, Joplin) since the page has a feature matrix table

#### Task 1.5: Rebuild static site and verify generated outputs

- Status: TO BE DONE
- Objective: After all front matter and generator changes, rebuild the static site to regenerate blog HTML, blog index, sitemap, RSS feed, llms.txt, homepage blog teaser, and fingerprinted assets.
- Steps:
  1. Run `cmd.exe /c bun run website:build-static`
  2. Spot-check 3–4 regenerated blog post HTML files: confirm `<title>` and `<meta name="description">` reflect the new front matter
  3. Spot-check `website/blog/index.html`: confirm article card titles and excerpts are updated
  4. Spot-check `website/index.html` blog teaser section: confirm excerpt changes
  5. Confirm `website/sitemap.xml` still contains all expected URLs
- Validation:
  - `bun run website:build-static` exits with code 0
  - `git diff` shows expected changes only in generated files and edited sources
  - No unfingerprinted asset references remain in generated HTML (no bare `style.css` or `main.js`)
- Notes:
  - This task depends on Tasks 1.1–1.4 being complete

---

### Milestone 2: Navigation & Internal Linking

- Status: TO BE DONE
- Purpose: Add high-value landing pages (`/compare/`, `/encrypted-journal/`) to the main navigation on all pages, and improve cross-linking between the homepage and these pages to distribute link equity and increase discovery.
- Exit Criteria:
  - `/compare/` and `/encrypted-journal/` appear in the main nav on the homepage, encrypted-journal page, compare page, blog index, and all blog post pages
  - The homepage hero section has a visible link to `/compare/` (comparison intent)
  - The homepage encrypted journal guide link (already present) is preserved and functional
  - The generator's `buildNav()` function and all manual page navs are synchronized to the same link set
  - Site rebuild completes without errors

#### Task 2.1: Add `/compare/` and `/encrypted-journal/` to the generator's buildNav()

- Status: TO BE DONE
- Objective: The `buildNav()` function in `scripts/generate-website-blog.mjs` (lines 238–273) generates the navigation for all blog posts, the blog index, and the generated blog teaser on the homepage. It currently lacks links to `/compare/` and `/encrypted-journal/`.
- Steps:
  1. Edit `scripts/generate-website-blog.mjs`: in `buildNav()`, add two new `<li>` entries between existing nav items for `/compare/` and `/encrypted-journal/`
  2. Place them logically: "Compare" after "Blog", "How It Works" (linking to `/encrypted-journal/`) after "Compare"
- Validation:
  - After rebuild, open any generated blog post and confirm both new nav links are present and point to correct URLs
- Notes:
  - Keep the generated nav visually consistent with the manual nav on `index.html` — the agent should read the manual nav first to match the same labels and structure

#### Task 2.2: Sync nav changes to static manual pages

- Status: TO BE DONE
- Objective: The homepage (`website/index.html`), encrypted-journal page (`website/encrypted-journal/index.html`), and compare page (`website/compare/index.html`) each have their own inline `<nav>` that must match the generator's `buildNav()` output.
- Steps:
  1. Read the nav section in all three files to understand the current structure
  2. Edit `website/index.html`: add `/compare/` and `/encrypted-journal/` nav links in the same positions as the generator's `buildNav()`
  3. Edit `website/encrypted-journal/index.html`: same nav additions
  4. Edit `website/compare/index.html`: same nav additions
- Validation:
  - Open each file and confirm the nav list items match across all pages
  - All manual pages show the same 9 nav items (plus GitHub badge) in the same order
- Notes:
  - The homepage already links to `/encrypted-journal/` from the hero section but not from the top nav

#### Task 2.3: Improve homepage internal linking to `/compare/`

- Status: TO BE DONE
- Objective: The homepage hero section has a link to `/encrypted-journal/` but not to `/compare/`. Add a subtle link to `/compare/` in the hero subtext or a nearby logical location.
- Steps:
  1. Read the homepage hero section (after `<section class="hero">`)
  2. Add a `<p>` or inline link to `/compare/` near the existing `/encrypted-journal/` guide link in the hero-context area
- Validation:
  - Open `website/index.html` and confirm a link to `/compare/` exists in the hero/above-fold area
  - Link text should be natural, e.g., "See how Mini Diarium compares to Day One, Notion, and Obsidian"
- Notes:
  - The existing link pattern in `hero-context` is: `<a href="/encrypted-journal/">encrypted journal guide</a>`. The new link should follow a similar pattern.

#### Task 2.4: Rebuild and verify navigation

- Status: TO BE DONE
- Objective: Rebuild the site and verify all nav changes propagate correctly.
- Steps:
  1. Run `cmd.exe /c bun run website:build-static`
  2. Open `website/index.html` and confirm nav + internal links are present
  3. Open a generated blog post and confirm nav is consistent
  4. Open `website/blog/index.html` and confirm nav is consistent
- Validation:
  - All nav instances across the site contain `/compare/` and `/encrypted-journal/` links
  - No broken references from the build output

---

### Milestone 3: Technical SEO Foundations

- Status: TO BE DONE
- Purpose: Add hreflang x-default tags to all pages (foundation for future multi-language), verify FAQ schema eligibility, and document production HTTP redirect requirements.
- Exit Criteria:
  - Every HTML page (manual and generated) includes `<link rel="alternate" hreflang="x-default" href="...">` pointing to its canonical URL
  - The generator's `buildHead()` function emits the hreflang tag for all blog and blog-index pages
  - FAQ schema behavior is documented with a concrete investigation result
  - Production HTTP→HTTPS redirect requirement is documented for the Coolify ops context

#### Task 3.1: Add hreflang x-default to manual pages

- Status: TO BE DONE
- Objective: Add `<link rel="alternate" hreflang="x-default" href="...">` to all manually edited HTML pages. This signals to Google that the English page is the default when no language match exists.
- Steps:
  1. Edit `website/index.html`: add `<link rel="alternate" hreflang="x-default" href="https://mini-diarium.com/" />` after the canonical tag (line 33)
  2. Edit `website/encrypted-journal/index.html`: add `<link rel="alternate" hreflang="x-default" href="https://mini-diarium.com/encrypted-journal/" />` after its canonical tag (line 28)
  3. Edit `website/compare/index.html`: add `<link rel="alternate" hreflang="x-default" href="https://mini-diarium.com/compare/" />` after its canonical tag (line 24)
- Validation:
  - Grep each file for `hreflang="x-default"` and confirm the href matches the canonical URL
- Notes:
  - An x-default hreflang without any language alternates is lightweight; it simply declares "this is the default canonical locale." It becomes useful immediately if Google serves the page to non-English searchers, and is required foundation when translated pages are added later.

#### Task 3.2: Add hreflang x-default to generated pages via generator

- Status: TO BE DONE
- Objective: The `buildHead()` function in `scripts/generate-website-blog.mjs` (lines 306–355) constructs the `<head>` for all generated blog pages and the blog index. Add an hreflang x-default link using the `canonical` parameter already available in the function.
- Steps:
  1. Edit `scripts/generate-website-blog.mjs`: in `buildHead()`, add `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />` after the existing canonical `<link>` (line 343)
- Validation:
  - Rebuild (`bun run website:build-static`)
  - Open any generated blog post and confirm `<link rel="alternate" hreflang="x-default" href="...">` is present with the correct canonical URL
- Notes:
  - The `canonical` parameter is passed correctly for both individual posts and the blog index via the callers at lines 443 and 553

#### Task 3.3: Verify FAQ schema eligibility and document findings

- Status: TO BE DONE
- Objective: The homepage and `/encrypted-journal/` both have `FAQPage` JSON-LD schema, but the GSC "Search Appearance" report is empty (no rich results detected). Investigate whether Google considers the FAQ content eligible for rich results.
- Steps:
  1. Load the `agent-browser` skill and use it to navigate to `https://search.google.com/test/rich-results`
  2. Submit the homepage URL `https://mini-diarium.com/` and capture the test result (pass/fail, any warnings, eligibility status for FAQ rich results)
  3. Submit the `/encrypted-journal/` URL `https://mini-diarium.com/encrypted-journal/` and capture its test result
  4. Write findings into `docs/seo/faq-schema-investigation.md` including: whether each page is eligible for FAQ rich results, any warnings (e.g., "content hidden behind tabs/details"), and the recommended fix if ineligible
- Validation:
  - `docs/seo/faq-schema-investigation.md` exists and contains the actual Rich Results Test outcome for both URLs (not placeholder text)
- Notes:
  - The agent-browser skill can render JavaScript and capture the dynamic test results that `webfetch` cannot
  - If FAQ rich results are ineligible due to `<details>` elements, the investigation should note that removing `<details>` wrappers or creating a standalone `/faq/` page are follow-up projects

#### Task 3.4: Document production HTTP redirect requirements

- Status: TO BE DONE
- Objective: GSC shows `http://mini-diarium.com/` with 15 impressions and 0 clicks. The local `website/nginx.conf` already redirects `www.` → non-www but does NOT handle HTTP → HTTPS (production is deployed via Coolify). Document what needs to be configured in Coolify.
- Steps:
  1. Create or update a deployment notes file at `docs/seo/production-config-notes.md`
  2. Document the required Coolify rules:
     - 301 redirect from `http://mini-diarium.com/*` → `https://mini-diarium.com/*`
     - 301 redirect from `http://www.mini-diarium.com/*` → `https://mini-diarium.com/*`
     - 301 redirect from `https://www.mini-diarium.com/*` → `https://mini-diarium.com/*`
     - Ensure HSTS header is set (optional but recommended)
  3. Note: after configuring these, use GSC's URL Inspection tool to request reindexing of the HTTP variant
  4. Note: the local `website/nginx.conf` handles `www.` → non-www on port 80 for local testing but does not control production behavior
- Validation:
  - `docs/seo/production-config-notes.md` exists with the redirect specifications
- Notes:
  - This is a documentation-only task; the actual Coolify configuration is ops territory
  - Per `website/README.md` line 9: "fix them in Coolify or the real production edge configuration, not only in the local website container"

---

### Milestone 4: Content Expansion — New Blog Posts for Keyword Gaps

- Status: TO BE DONE
- Purpose: Create two new blog posts targeting the highest-opportunity non-brand keyword gaps identified in the audit: "encrypted diary" (13 imp/month, pos 26.7) and "private journal app" (14 imp/month, pos 57.5). Both terms have clear intent alignment with the product.
- Exit Criteria:
  - Two new `.md` source files exist in `website/posts-src/` with complete front matter and body content
  - Both posts appear in regenerated `blog/index.html`, the homepage blog teaser, `sitemap.xml`, `feed.xml`, and `llms.txt`
  - Post content follows the content strategy from `website/CLAUDE.md` (lead with the user's problem, include "Where Mini Diarium fits" section, link to `/encrypted-journal/`)
  - `bun run website:build-static` completes without errors

#### Task 4.1: Create blog post targeting "encrypted diary" query

- Status: TO BE DONE
- Objective: Write a new blog post source file that targets the "encrypted diary" search intent. The audit shows this query gets 13 impressions at position 26.7 with 0 clicks — the site barely ranks for it. A dedicated post can capture this traffic.
- Steps:
  1. Create `website/posts-src/2026-05-08-what-is-an-encrypted-diary.md` from `_template.md`
  2. Fill front matter:
     - `title`: Something like "What Is an Encrypted Diary? Why Encryption at Rest Matters" — includes primary keyword
     - `slug`: `what-is-an-encrypted-diary`
     - `description`: 140–160 char meta description targeting the query
     - `tags`: `encrypted diary, encrypted journal, private diary app, AES-256-GCM`
     - `draft: false`
     - `date` and `updated`: `2026-05-08`
  3. Write the article body: start with "what an encrypted diary actually means," differentiate from "password-protected app," explain encryption at rest vs. in transit, describe how Mini Diarium does it (AES-256-GCM before disk), end with "Where Mini Diarium fits"
  4. Link to `/encrypted-journal/`, `/compare/`, and at least one related blog post
- Validation:
  - The `.md` file passes `bun run website:build-static` without errors
  - The generated post HTML includes the new title, description, OG tags, and hreflang x-default
  - The blog index lists the new post first (newest)
- Notes:
  - Existing post `2026-03-12-encrypted-journal-vs-cloud-notes-app.md` covers adjacent territory — this new post should be more foundational ("what is it") vs. comparative ("vs. cloud notes")
  - This task includes writing the full article body, not just front matter. The content must follow the strategy in `website/CLAUDE.md`: lead with the user's problem, include a "Where Mini Diarium fits" section, and link to `/encrypted-journal/` and at least one related post.

#### Task 4.2: Create blog post targeting "private journal app" query

- Status: TO BE DONE
- Objective: Write a new blog post that targets the "private journal app" search intent. The audit shows this query has 14 impressions at position 57.5 — very low visibility. A dedicated post can improve ranking.
- Steps:
  1. Create `website/posts-src/2026-05-08-private-journal-app-how-to-choose.md` from `_template.md`
  2. Fill front matter:
     - `title`: Something like "How to Choose a Private Journal App in 2026" — includes primary keyword
     - `slug`: `private-journal-app-how-to-choose`
     - `description`: 140–160 char meta description
     - `tags`: `private journal app, encrypted diary, offline journal, local-first journaling`
     - `draft: false`
     - `date` and `updated`: `2026-05-08`
  3. Write the article body: create a buyer's guide / checklist for evaluating private journal apps (encryption model, storage location, network dependency, export formats, open source status). Lead with the user's evaluation criteria, not the product
  4. Include a practical checklist or numbered criteria section for scanability
  5. "Where Mini Diarium fits" section at the end
  6. Link to `/encrypted-journal/`, `/compare/`, and at least one related post
- Validation:
  - The `.md` file passes `bun run website:build-static` without errors
  - The generated post HTML includes checklist formatting
  - The blog index lists the post correctly
- Notes:
  - Existing post `2026-03-12-private-diary-app-for-desktop.md` covers very similar territory — this new post should focus more on evaluation criteria and decision-making than on desktop-specific features
  - This task includes writing the full article body, not just front matter. The content must follow the strategy in `website/CLAUDE.md`: lead with the user's problem, include a "Where Mini Diarium fits" section, and link to `/encrypted-journal/` and at least one related post.

#### Task 4.3: Rebuild and verify content expansion outputs

- Status: TO BE DONE
- Objective: Full rebuild after new posts are added; verify all downstream artifacts include the new content.
- Steps:
  1. Run `cmd.exe /c bun run website:build-static`
  2. Verify `website/blog/index.html` includes both new posts at the top
  3. Verify `website/index.html` blog teaser includes the new posts (top 3)
  4. Verify `website/sitemap.xml` has new `<url>` entries
  5. Verify `website/blog/feed.xml` has new RSS `<item>` entries
  6. Verify `website/llms.txt` lists the new posts under "Latest Articles"
- Validation:
  - Grep each generated file for the new slugs to confirm presence
  - `bun run website:build-static` exits with code 0

---

### Milestone 5: Cleanup and Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified end-to-end.
- Exit Criteria: All temporary artifacts are removed, all regenerated files are consistent, and the site structure passes a final audit checklist.

#### Task 5.1: Cleanup intermediate artifacts

- Status: TO BE DONE
- Objective: Remove any temporary files, scratch notes, or intermediate artifacts created during implementation.
- Steps:
  1. Inspect `website/` for any unexpected new files beyond the planned changes
  2. Inspect `scripts/` for any commented-out code or debug logging added during implementation
  3. Run `git status` and review the diff for unintended changes
- Validation:
  - `git status` shows only: edited manual pages, edited `.md` sources, edited generator script, regenerated outputs, and the new plan/investigation docs
  - No stale fingerprinted asset files remain (e.g., old `style.<oldhash>.css`)

#### Task 5.2: Final verification — full build and audit checklist

- Status: TO BE DONE
- Objective: Run the complete build pipeline and verify the whole site is consistent.
- Steps:
  1. Run `cmd.exe /c bun run website:build-static`
  2. Verify build exit code is 0
  3. Run `cmd.exe /c bun run lint` (if applicable to website files)
  4. Audit checklist:
     - All 5 manual pages have hreflang x-default
     - All generated blog posts have hreflang x-default
     - Navigation is consistent across all page types (homepage, encrypted-journal, compare, blog index, individual posts)
     - `/compare/` is linked from the main nav on all pages
     - `/encrypted-journal/` is linked from the main nav on all pages
     - Blog post titles and descriptions reflect the rewrites from Milestone 1
     - The two new blog posts are discoverable from the blog index, sitemap, RSS feed, and homepage teaser
     - No pages reference unfingerprinted assets (`style.css`, `main.js` without hash)
     - Sitemap contains all expected URLs (homepage, encrypted-journal, compare, privacy, blog index, all 12 blog posts, all docs pages)
  5. Run `cmd.exe /c bun run format` to ensure consistent formatting
  6. Mark plan as COMPLETED
- Validation:
  - Build succeeds
  - All checklist items pass
  - `git diff` is reviewable and intentional

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval. Fix all failures before proceeding.

- [ ] `cmd.exe /c bun run website:build-static` exits with code 0
- [ ] `cmd.exe /c bun run lint` passes (if lint rules cover website files)
- [ ] `cmd.exe /c bun run format` succeeds
- [ ] All generated HTML files reference fingerprinted assets (`style.<hash>.css`, `main.<hash>.js`) — no bare `style.css` or `main.js` references
- [ ] `git status` shows only intentional changes
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/seo-fix-plan.md`)
- [x] Scope, non-goals, assumptions, and clarifications are explicit
- [x] No unresolved open questions remain
- [x] Tasks are grouped into milestones (18 tasks across 5 milestones)
- [x] Every task has concrete steps and validation
- [x] Every milestone has exit criteria
- [x] Cleanup and final verification are included (Milestone 5)
- [x] The plan avoids vague actions without concrete targets
- [x] The plan can be executed by a coding agent without reading the original conversation

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- The generator script (`generate-website-blog.mjs`) changes affect ALL generated pages — always run `bun run website:build-static` after any generator edit.
- Static manual pages (homepage, encrypted-journal, compare) must have their nav sections kept synchronized manually. The generator does not touch them.
