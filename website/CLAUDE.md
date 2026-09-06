# Website (`website/`) — Mini Diarium

> For project architecture and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

Static marketing site — plain HTML/CSS/JS served via Nginx. No frontend framework, no build step for the site itself. Blog posts and documentation pages both require generation — never edit their HTML output directly.

## Key Rule: Never Edit Generated HTML Directly

Both the blog and the docs sections are generated from Markdown sources. Editing the HTML output directly will be silently overwritten on the next build run.

| Source (edit these) | Generated output (never edit) |
|---------------------|-------------------------------|
| `posts-src/*.md` | `blog/*/index.html`, `blog/index.html`, `blog/feed.xml`, `sitemap.xml`, `llms.txt` |
| `docs-src/*.md` | `docs/*/index.html`, `docs/index.html`, `docs/*.md` (per-page Markdown mirror), `llms-full.txt` |

The only files you should edit manually are:
- `posts-src/*.md` — blog post sources (the canonical input)
- `docs-src/*.md` — documentation page sources (the canonical input)
- `website/index.html` — homepage (between its static sections, not the blog teaser block)
- `encrypted-journal/index.html` — the encrypted journal guide page
- `compare/index.html` — the comparison matrix page
- `privacy/index.html` — the privacy policy page
- `newsletter/index.html` — the newsletter signup page
- `donate/index.html` — the donation page
- `css/`, `js/` — styles and scripts

Each static manual page has an `updated` date in its `STATIC_PAGES` entry in
`scripts/generate-website-blog.mjs` (the homepage uses the separate `HOMEPAGE_UPDATED` constant
near `INDEX_PATH`) — this drives its `sitemap.xml` `lastmod`, deliberately decoupled from file
mtime so an unrelated CSS/JS rebuild doesn't bump it. **Whenever one of these pages' actual
content changes, bump its `updated` constant (or `HOMEPAGE_UPDATED`) in the same change**, the
same way `updated:` front matter is bumped for blog posts and docs pages.

When editing any of the static manual pages above, ensure these elements stay consistent:
- **Navigation** — every manual page shares the same nav structure. If you add or remove a nav item, update all of them plus the generator's `buildNav()` in `scripts/generate-website-blog.mjs`.
- **Footer** — the footer is duplicated the same way the nav is: once per manual page, plus `buildFooter()` in **both** `scripts/generate-website-blog.mjs` and `scripts/generate-website-docs.mjs` (those two are byte-identical, so any footer edit goes into both). Changing a footer link means editing every manual page and both generators, then re-running `bun run website:build-static` so `blog/` and `docs/` pick it up.
- **Hreflang** — every page must have `<link rel="alternate" hreflang="x-default" href="...">` pointing to its canonical URL. The generators handle this for blog and docs pages automatically.

---

## Adding a Blog Post

### Step 1 — Create the Markdown source

Add a file to `posts-src/` named `YYYY-MM-DD-slug.md`. Use `_template.md` as a starting point.

Required front matter fields (all must be present):

```
---
title: The article title
slug: the-stable-url-slug
description: Meta description used for search and social previews (1–2 sentences).
date: 2026-04-05
updated: 2026-04-05
author: Francisco J. Revoredo
tags: tag one, tag two, tag three
excerpt: Optional shorter summary for cards and index. Falls back to description if omitted.
draft: true
---
```

- `slug` must be globally unique across all posts — the script throws on duplicates.
- `date` and `updated` must be `YYYY-MM-DD`. The script validates this strictly.
- `tags` is a comma-separated list; at least one tag is required.
- `draft: true` excludes the post from all generated output. Remove or set to `false` when ready to publish.
- `excerpt` is optional. If omitted, `description` is used for blog index cards.

### Step 2 — Run the full build

```bash
bun run website:build-static
```

Always use `website:build-static`, not `website:blog` alone. The full build runs the generator **and** the asset fingerprinter in sequence. Running only `website:blog` leaves HTML files with unfingerprinted CSS/JS references (`style.css`) instead of the correct content-hashed names (`style.<hash>.css`), which breaks cache busting in the deployed site.

This single command regenerates everything:

| Output | What changes |
|--------|-------------|
| `blog/<slug>/index.html` | New post HTML (created) |
| `blog/index.html` | Article card prepended (newest first) |
| `blog/feed.xml` | RSS item prepended |
| `sitemap.xml` | URL entry added |
| `llms.txt` | Article listed under Latest Articles |
| `website/index.html` | Blog teaser section updated (top 3 posts) |

That is the complete workflow. No further manual edits are needed.

### Step 3 — Verify

After the build completes, run the following checks before committing:

**Generated output (all of these must exist or be updated):**
- `website/blog/<slug>/index.html` was created
- `website/sitemap.xml` contains `https://mini-diarium.com/blog/<slug>/`
- `website/llms.txt` contains a line for the new post under "Latest Articles"
- `website/blog/feed.xml` has an `<item>` for the new post at the top
- `website/blog/index.html` has an article card for the new post
- `website/index.html` homepage teaser is updated (it reflects the 3 newest posts)

**Content correctness:**
- All internal links in the article (`/encrypted-journal/`, `/compare/`, `/blog/...`) resolve to existing files on disk
- No em dashes (`—`) in the source Markdown (grep for `—` in the `.md` file)
- `scripts/generate-website-blog.mjs` has entries for the new slug in both `DESCRIPTION_MAP` and `BLUF_MAP`

**SEO fields:**
- Title is ≤ 60 chars (count manually or check the `<title>` tag in the generated HTML)
- Description is 140–160 chars (check the `<meta name="description">` tag)
- `draft: false` is set in front matter

---

## Updating a Blog Post

Edit the relevant `.md` file in `posts-src/`, update the `updated` date, then re-run `bun run website:build-static`. The script regenerates all HTML from the current source state.

---

## Removing a Blog Post

Delete the `.md` file from `posts-src/` and run `bun run website:build-static`. The generator cleans up orphaned post directories automatically — it removes any `blog/*/` directory that has no corresponding source file.

---

## Front Matter Reference

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Yes | Used in `<title>`, OG tags, breadcrumbs, article cards. **Max 70 chars. Target under 60 chars for SERP display.** Use specific hooks: numbers, years, questions, or concrete claims. |
| `slug` | Yes | Stable URL segment: `mini-diarium.com/blog/<slug>/` |
| `description` | Yes | Meta description + OG/Twitter description. **140–160 chars. Must be click-worthy** — promise a takeaway, not a summary. The page title already summarizes; the description should make the user want to click. |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `updated` | Yes | Last modified date (`YYYY-MM-DD`); drives `sitemap.xml` lastmod |
| `author` | Yes | Defaults available in script; currently always `Francisco J. Revoredo` |
| `tags` | Yes | Comma-separated; at least one. Rendered as tag pills and `article:tag` meta. **Each post should target a primary keyword via its title + slug + H1, with related keywords in tags.** |
| `excerpt` | No | Short card summary; falls back to `description` |
| `draft` | No | Set `true` to exclude from all output. Omit or set `false` to publish. |
| `coverImage` | No | Full URL to OG image; defaults to `/assets/og-cover.png` |
| `canonical` | No | Override canonical URL; defaults to `https://mini-diarium.com/blog/<slug>/` |

---

## Content Strategy

### Keyword Map

Every blog post should target at least one specific search query. The full keyword and
topic-cluster map (pillar + clusters, target queries, current positions, owning page, and which
engine surfaces the demand) lives in **[`docs/seo/STRATEGY.md`](../docs/seo/STRATEGY.md) §3**.
That is the single source of truth; do not maintain a duplicate table here (per
[`CONTEXT_FILES_BEST_PRACTICES.md`](../docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md):
prefer pointers over copies).

Before writing a new post:
- Read `STRATEGY.md` §3 to place the post in a cluster and confirm the target query is not
  already the title/H1 of an existing post (cannibalization).
- Check live positions in the latest export under [`docs/seo/performance/`](../docs/seo/performance/)
  (do not rely on inline numbers anywhere; they are stale within days).
- For the "before you write a blog post" checklist, follow `STRATEGY.md` §9.

### Target topics

The owned topic and its adjacent framings are defined once in
[`docs/seo/STRATEGY.md`](../docs/seo/STRATEGY.md) §1 and
[`docs/seo/product-marketing-context.md`](../docs/seo/product-marketing-context.md). Place every
post inside that owned topic; do not chase unrelated volume.

### Title and Description Rules

- **Titles ≤ 70 chars, target ≤ 60 chars** for SERP truncation safety
- **Descriptions 140–160 chars** — promise a takeaway, not a summary
- Avoid titles that read as feature lists or specifications (e.g., "App for X, Y, and Z"). Lead with the user's concern, the benefit, or a specific claim
- Use hooks: numbers ("5 Things"), years ("in 2026"), questions, or "Why X" / "How to X" patterns
- The title and H1 will appear in the SERP snippet — optimize for click-through, not comprehensiveness
- **After changing a post's title or description, update the corresponding entry in `DESCRIPTION_MAP` and `BLUF_MAP`** in `scripts/generate-website-blog.mjs` or the OG/Twitter cards and "Short answer" blurb will go stale

### Voice and Style

**Post structure template** — every blog post should follow this section order:

1. Opening paragraph — the reader's problem or question, not the product
2. Two to four H2 sections — each with a clear, distinct purpose
3. "Where Mini Diarium fits" — factual product claims only (AES-256-GCM, no HTTP client, MIT license, key-file auth, etc.)
4. "The practical takeaway" — one or two clear if/then recommendations plus 2–3 internal links

**Prohibited patterns and voice:** Follow [`docs/best-practices/WRITING_STYLE.md`](../docs/best-practices/WRITING_STYLE.md) for all shared rules (em dashes, emojis, filler phrases, sentence rhythm, active voice). Blog posts add one further constraint: every claim about Mini Diarium must be backed by a specific technical fact. Write "encrypts each entry with AES-256-GCM before writing to disk", not "prioritizes security". If Mini Diarium lacks a feature the alternative has, say so plainly.

**GEO (BLUF) rule:**

The BLUF content shape (a self-contained 50–80-word direct answer above the first H2 that names the specific products, trade-off, and constraint) is defined in [`docs/seo/STRATEGY.md`](../docs/seo/STRATEGY.md) §2. The generator-specific mechanic: each post's `BLUF_MAP` entry must hold that answer and be quotable by an LLM verbatim with no surrounding context.

**Internal linking:**

Always link to at least two of `/encrypted-journal/`, `/compare/`, or a related blog post. Internal linking is load-bearing for the SEO/GEO strategy.

### GEO (Generative Engine Optimization)

`llms.txt` and `ai-crawlers.txt` are maintained so AI crawlers index the content accurately. The generator keeps `llms.txt` in sync automatically. When adding a new post, the `Latest Articles` section in `llms.txt` is updated by the script — no manual edits needed.

---

## SEO & Discoverability

### Static Page Checklist

When creating a new static HTML page (not generated from Markdown), ensure:

1. `<title>` under 60 chars, keyword-rich but click-worthy
2. `<meta name="description">` 140–160 chars, compelling
3. `<link rel="canonical">` self-referencing with full `https://` URL
4. `<link rel="alternate" hreflang="x-default">` matching the canonical
5. OG and Twitter card meta tags (title, description, image)
6. JSON-LD structured data (at minimum Organization + WebPage; add FAQPage or BreadcrumbList if the content supports it)
7. Navigation matches the existing nav structure on all other pages
8. Added to `STATIC_PAGES` array in `scripts/generate-website-blog.mjs` (ensures inclusion in `llms.txt` and sitemap), including an `updated: 'YYYY-MM-DD'` field — required for `sitemap.xml` `lastmod`, validated by `ensureDate()`

### Navigation Consistency

The main navigation lives in these places, which must stay in sync (the footer is duplicated across the same set):
- `website/index.html` (uses `#fragment` links since it's at root)
- `website/encrypted-journal/index.html` (uses `/#fragment` links)
- `website/compare/index.html` (uses `/#fragment` links)
- `website/privacy/index.html` (uses `/#fragment` links)
- `website/newsletter/index.html` (uses `/#fragment` links)
- `website/donate/index.html` (uses `/#fragment` links)
- `scripts/generate-website-blog.mjs` → `buildNav()` (uses `/#fragment` links for blog pages)
- `scripts/generate-website-docs.mjs` → (uses `/#fragment` links for docs pages)

Current nav order: Features → Security → Blog → Docs → Download

### Generator Map Synchronization

`scripts/generate-website-blog.mjs` contains two hardcoded maps keyed by post slug:
- `DESCRIPTION_MAP` — used in `llms.txt` entries for AI crawler summary
- `BLUF_MAP` — used for the "Short answer:" blurb at the top of each blog post

**When changing a post's description, update both maps.** If the slug doesn't exist in these maps, the generator falls back to the front matter directly — but new posts should have explicit entries.

### Monitoring Cadence

The recurring, data-driven review is the `seo-performance-review` skill (bi-weekly at current
volume). It ingests the latest Google Search Console + Bing exports, runs the analysis
framework in [`docs/seo/STRATEGY.md`](../docs/seo/STRATEGY.md) §5, produces content briefs, and
updates the action plan. Run it each cycle rather than doing this by hand.

- Export Google Search Console (3-month window, main + AI-Overview report) and Bing (overview +
  query-level Keyword report + AI/Copilot citations) to a new dated folder under
  [`docs/seo/performance/`](../docs/seo/performance/) each cycle. The review skill guides the
  pull when data is stale.
- Compare against the most recent snapshot: the latest `docs/seo/STATUS_REPORT_*.md` and the
  prior dated folder under `docs/seo/performance/` (do not inline numbers here; they go stale).
- Key metrics to watch (baselines in the latest status report, not inlined here):
  - `/encrypted-journal/` CTR (target >2%)
  - Blog post CTR at positions 6-10 (target >1%)
  - US market CTR (target >5%)
  - New blog post positions as they get indexed
- The prioritized fix queue and the hypothesis log live in
  [`docs/seo/action-plan.md`](../docs/seo/action-plan.md), kept current by the review skill.

### Production Configuration

HTTP→HTTPS redirect is handled by Coolify, not the local `website/nginx.conf`. If GSC shows `http://` impressions, the Coolify edge must be configured with 301 redirects.

### IndexNow

[IndexNow](https://www.indexnow.org) is a protocol that lets search engines (Bing, Yandex, Seznam, and others) know immediately when URLs are added, updated, or deleted. Instead of waiting for crawlers to discover changes, the site actively notifies them.

**Key file:** A single hex key file lives at `website/indexnow-key-<HEX>.txt`. The script auto-discovers it by matching `website/indexnow-key-*.txt`. Exactly one key file must exist — the script errors if zero or multiple are found.

**Endpoints:** The script submits to two endpoints in sequence — `api.indexnow.org` (propagates to Yandex, Seznam, etc.) and `https://www.bing.com/indexnow` directly. The direct Bing endpoint is required for submissions to appear in Bing Webmaster Tools; the generic endpoint alone does not register there.

**Manual submission:**
```bash
bun run website:submit-indexnow          # Submit all sitemap URLs to both endpoints
bun run website:submit-indexnow:dry-run  # Preview the payload without sending
```

**CI/CD workflow:** `.github/workflows/indexnow.yml` is triggered via `workflow_dispatch` (manual). Run it from the Actions tab after deploying the website. The `push` trigger is commented out until Coolify auto-deployment is configured — uncomment it when ready.

**Regenerating the key:** Delete the old `website/indexnow-key-*.txt`, generate a new 32-char hex key (`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`), create a new `website/indexnow-key-<NEW_HEX>.txt` with the key followed by a newline, and commit. No other files need updating — the script auto-discovers the key.

**Response codes:**

| Code | Meaning | Action |
|------|---------|--------|
| 200 | URLs submitted successfully | None |
| 400 | Bad request — invalid payload | Check the script output for details |
| 403 | Forbidden — key not found on domain | Verify the key file is deployed and accessible at `https://mini-diarium.com/indexnow-key-<HEX>.txt` |
| 422 | URLs don't match declared host | Check the `host` field in the submission payload |
| 429 | Rate limited | Wait and retry later |

---

## Documentation Section (`docs-src/`)

`docs-src/` is the **authoritative user-facing reference** for every Mini Diarium feature — the primary source of truth for both users and agents auditing feature behavior. Keep it complete and up to date: whenever a user-facing feature is added, changed, or removed, update the relevant `docs-src/` file in the same task. Stale docs are a bug.

Source files: `website/docs-src/*.md` — one file per section.

Required front matter: `title`, `slug`, `description`, `order` (integer), `updated` (YYYY-MM-DD), `tags` (comma-separated). Optional: `draft: true` (excludes from build).

**`description` must be 140–160 characters.** It maps directly to `<meta name="description">` and is used in search snippets. "One sentence" descriptions are too short — Bing and Google will either ignore them or generate their own. Write it to be specific about what the reader will find: name the actual features, options, or answers covered, not just the topic area.

**Never edit `website/docs/` directly** — all HTML there is auto-generated.

- Dev iteration: `bun run website:docs` (docs only)
- Full deploy build: `bun run website:build-static` (blog → docs → fingerprinter, in that order)

### Adding Images to a Docs Page

Standard Markdown syntax works: `![alt text](src "optional caption")`. The generator's `image` renderer (`scripts/generate-website-docs.mjs`, next to the `heading`/`link` overrides) wraps the output in `<figure class="prose-figure"><img loading="lazy" ...></figure>`, adding a `<figcaption>` only when the optional title (the `"..."` part) is present — the `alt` text is never duplicated into a caption. The renderer also reads the image's real pixel dimensions at build time (`readImageDimensions()` in `scripts/website-generator-utils.mjs`, supports `.svg` and `.webp`) and emits matching `width`/`height` on the `<img>` tag to reserve layout space and avoid CLS; it degrades to no attributes (never fails the build) if the file is missing or unrecognized. Styling lives in `website/css/style.css` next to the other `.prose` rules.

- **Screenshots**: `website/assets/docs/<page-slug>-<NN>-<short-description>.webp`. Live-capture from the real dev app via the `tauri-agent-dev` skill — never reuse old promotional PNGs, they drift from the current UI. Target WebP quality 78-82. PNG is acceptable if a screenshot needs pixel-exact detail (e.g. thin text on a dense table), but WebP is the default.
- **Diagrams**: `website/assets/docs/diagrams/<page-slug>-<short-description>.svg`. Hand-build these (not Mermaid's default theme) using the site's own dark/gold palette (`--bg:#0e0e0e`, `--bg-card:#161616`, `--accent:#F5C94D`, `--text:#f0ede6`, `--text-muted:#888`, `--border:#2a2a2a`) so they read as part of the site, not a pasted-in export. Give every SVG an explicit `viewBox` plus matching `width`/`height` and a system font stack — treat the first draft as a draft, not a shipped asset, and re-render it (e.g. open the raw `file://` path in a browser and screenshot it) to check for label/arrow overlap before committing.
- **No fingerprinting**: `fingerprint-website-assets.mjs` only hashes `css/js`. Changing an image's content later needs a **new filename** — overwriting one in place will not bust any cache.
- Insert each image immediately after the paragraph or step it illustrates, not bunched at the top or bottom of the page. Don't force one image per H2 — a thin page might only need one, a long tabbed page might need several.
- After adding images, verify every `<img src="...">` and `<figure>`'s image path in the built `website/docs/*/index.html` resolves to a real file — the generator does not validate image paths, so a typo is a silently broken image on a green build.

See `website/docs-src/_template.md` for the starter template.

### Agent-Friendly Mirrors (Copy Page, `llms-full.txt`)

Each docs **section** page (not the hub) ships a Mintlify-style "Copy page" dropdown next to
its title (Copy page, View as Markdown, Open in ChatGPT/Claude/Perplexity), a per-page Markdown
mirror at `docs/<slug>.md`, and a `<link rel="alternate" type="text/markdown">` discovery tag in
its `<head>`. All three are generated — never hand-edit `docs/*.md`. `website/llms-full.txt` is
the full-text sibling of the curated `llms.txt`: every section's Markdown, concatenated, for
single-file ingestion by AI assistants. Like `docs/*/index.html` and `llms.txt`, `docs/*.md` and
`llms-full.txt` are generated **and committed** — `bun run website:build-static` regenerates
them, and the diff goes into the same commit as the `docs-src/` change that produced it.

- **Canonicalization, not `noindex`:** each `.md` mirror is near-duplicate content of its HTML
  page, so `nginx.conf` sends an HTTP `Link: <...>; rel="canonical"` header pointing at the HTML
  page (Google's documented method for canonicalizing a non-HTML resource) instead of blocking
  it with `X-Robots-Tag: noindex`. This follows the `seo-audit` skill's duplicate-content
  guidance — consolidate ranking signal onto one page rather than just hiding the duplicate.
  Keep the header's target in exact sync with that section's `<link rel="canonical">`.
- **The three AI deep-links are unofficial.** `chatgpt.com/?q=`, `claude.ai/new?q=`, and
  `perplexity.ai/search?q=` are reverse-engineered query params, not a stable contract. If a
  provider changes its chat UI and a link stops prefilling, drop that one entry from
  `buildAiLinks()` in `scripts/generate-website-docs.mjs` rather than leaving a dead button.
- This is a user-initiated referral affordance (a reader sends a page to their own chat
  assistant) — distinct from the GEO-citation measurement in `docs/seo/STRATEGY.md` §5
  (AI-Overview citation rate via GSC/Bing exports).

---

## How the build pipeline works

`bun run website:build-static` runs three scripts in sequence:

1. **`generate-website-blog.mjs`** — reads all `.md` sources, renders HTML, updates `blog/index.html`, `feed.xml`, `sitemap.xml`, `llms.txt`, and the homepage blog teaser. Outputs unfingerprinted asset references (`style.css`, `main.js`).

2. **`generate-website-docs.mjs`** — reads all `docs-src/*.md` sources, renders HTML for each section and the hub index, updates `sitemap.xml` and `llms.txt` with docs URLs. Outputs unfingerprinted asset references.

3. **`fingerprint-website-assets.mjs`** — hashes `css/style.css` and `js/main.js`, writes the content-addressed copies (`css/style.<hash>.css`, `js/main.<hash>.js`), and rewrites all HTML references to use the new names. Removes stale fingerprinted files when the hash changes.

   **Hashing is line-ending-normalized** (`\r\n` → `\n` before the digest, and the hashed copy is written as those same normalized bytes), so the fingerprint is a function of the content and not of which platform checked the repo out. `.gitattributes` additionally pins `website/` css/js/html/xml/txt output to `eol=lf`; the two layers are deliberate belt-and-braces — the same pairing already used for `docs/diagrams/`. Without them a Windows checkout produced different hashes than CI and rotated the `<link>`/`<script>` refs in every generated HTML file on each platform switch.

   **The script is a no-op when nothing changed.** It compares before writing and skips identical files, reporting `N updated / N unchanged`. A run with no CSS/JS change performs zero writes. Writes retry with backoff, because Windows AV/indexer can briefly hold a handle on a freshly written file (`errno -4094` / `UNKNOWN`).

   Pure helpers (`shortHash`, `readNormalized`, `rewriteAssetReferences`, `ASSETS`) are exported and covered by `scripts/fingerprint-website-assets.test.mjs` — run it with `node --test scripts/fingerprint-website-assets.test.mjs`.

**Do not run the scripts individually.** `bun run website:blog` or `bun run website:docs` alone leaves the repo in an inconsistent state (unfingerprinted references committed alongside fingerprinted asset files).

---

## File Layout

| Path | Status | Purpose |
|------|--------|---------|
| `posts-src/` | Edit | Blog Markdown sources — one `.md` file per post |
| `docs-src/` | Edit | Docs Markdown sources — one `.md` file per section (ordered by filename) |
| `blog/`, `docs/` | Generated | Do not edit — overwritten on every build |
| `sitemap.xml`, `llms.txt`, `feed.xml` | Generated | Do not edit — managed by the generator scripts |
| `index.html` | Edit | Homepage — edit static sections directly; blog teaser block is auto-updated |
| `encrypted-journal/`, `compare/`, `privacy/`, `newsletter/`, `donate/` | Edit | Static guide / comparison / policy / signup / donation pages |
| `css/`, `js/` | Edit | Site stylesheet and scripts |
| `nginx.conf` | Edit | Ships to production (Coolify builds `Dockerfile`, which `COPY`s this to `/etc/nginx/conf.d/default.conf`); only redirect/TLS/canonical-host enforcement is Coolify-overridden |
| `../docs/seo/` | Edit | SEO/GEO + growth hub (outside `website/`) — start at [`../docs/seo/README.md`](../docs/seo/README.md) |

---

## Local Docker Dev

Use the standard `docker compose` commands from the `website/` directory to build and preview the site locally before committing or deploying. The container serves on port 80.

### Verifying the site

The nginx config uses `server_name mini-diarium.com`. Browsers and curl reject requests to `localhost` unless you either:

- Pass the `Host` header explicitly:
  ```bash
  curl -H "Host: mini-diarium.com" http://localhost:80/
  ```
  On Windows PowerShell:
  ```powershell
  Invoke-WebRequest -Uri "http://localhost:80/" -Headers @{"Host"="mini-diarium.com"} -UseBasicParsing
  ```
- Or add `127.0.0.1 mini-diarium.com` to your hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` on Linux/macOS) for full browser testing.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 80 already in use | Change `"80:80"` to `"8080:80"` in `docker-compose.yml` (local testing only; revert before committing) |
| Stale cached layers | `docker compose build --no-cache` |
| Container starts but returns 404 | Check that `bun run website:build-static` ran and `website/docs/` and `website/blog/` are populated |
| `www.mini-diarium.com` redirects | The nginx config redirects `www.*` to the non-www host — expected behavior |

> **Note:** This compose file is for local preview only. `nginx.conf` itself ships to production via `Dockerfile` (Coolify builds it) — Coolify only overrides TLS termination and redirect/canonical-host enforcement on top of it. Use this compose setup to verify routing and header changes before they reach production.
