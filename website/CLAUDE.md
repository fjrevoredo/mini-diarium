# Website (`website/`) — Mini Diarium

> For project architecture and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

Static marketing site — plain HTML/CSS/JS served via Nginx. No frontend framework, no build step for the site itself. Blog posts and documentation pages both require generation — never edit their HTML output directly.

## Key Rule: Never Edit Generated HTML Directly

Both the blog and the docs sections are generated from Markdown sources. Editing the HTML output directly will be silently overwritten on the next build run.

| Source (edit these) | Generated output (never edit) |
|---------------------|-------------------------------|
| `posts-src/*.md` | `blog/*/index.html`, `blog/index.html`, `blog/feed.xml`, `sitemap.xml`, `llms.txt` |
| `docs-src/*.md` | `docs/*/index.html`, `docs/index.html` |

The only files you should edit manually are:
- `posts-src/*.md` — blog post sources (the canonical input)
- `docs-src/*.md` — documentation page sources (the canonical input)
- `website/index.html` — homepage (between its static sections, not the blog teaser block)
- `encrypted-journal/index.html` — the encrypted journal guide page
- `compare/index.html` — the comparison matrix page
- `privacy/index.html` — the privacy policy page
- `css/`, `js/` — styles and scripts

When editing any of the static manual pages above, ensure these elements stay consistent:
- **Navigation** — all four manual pages share the same nav structure. If you add or remove a nav item, update all four plus the generator's `buildNav()` in `scripts/generate-website-blog.mjs`.
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

Every blog post should target at least one specific search query. Current keyword gaps and owned topics:

| Query | Approach |
|-------|----------|
| `encrypted diary` | "What Is an Encrypted Diary" — foundational explainer |
| `private journal app` | "How to Choose a Private Journal App" — buyer's checklist |
| `encrypted journal` | Owned by `/encrypted-journal/` landing page |
| `desktop diary app` | Targeted by `desktop-diary-app` post |
| `private offline journal` | Owned by `private-diary-app-for-desktop` post |

> **Current positions:** Check [`docs/seo/Queries.csv`](../docs/seo/Queries.csv) (updated quarterly) for live ranking data before writing a new post. Do not rely on inline numbers here — they are stale within days.

When writing a new post, check the [SEO audit data](../docs/seo/) to avoid cannibalizing existing pages and to identify new keyword opportunities. If `docs/seo/` does not exist (CSV exports are added quarterly), use the keyword map above as the primary reference and verify the new post's primary keyword does not appear as the title or H1 of an existing post.

### Target topics

Posts should address real search intent around:
- encrypted offline journaling
- local-first ownership and portability
- specific tool comparisons or migrations (Day One, Mini Diary, jrnl, etc.)
- why architecture matters for private writing

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

**Prohibited patterns** — these signal LLM-generated copy and must not appear in any post:

- Em dashes (`—`). Use a comma, period, or restructured sentence instead.
- Emojis anywhere in the post body, headings, or frontmatter.
- Filler phrases: "it is worth noting", "this is crucial", "at the end of the day", "in essence", "to be clear", "deep dive", "dive deep", "delve into".
- Three or more consecutive sentences with identical grammatical structure.
- Bullet lists that restate what the preceding sentence already said.
- Abstract claims without a specific technical fact behind them. Write "encrypts each entry with AES-256-GCM before writing to disk", not "prioritizes security".

**Sentence rhythm and voice:**

- Vary length. Short declarative sentences alongside medium compound ones.
- Active voice by default: "the app stores entries locally" not "entries are stored locally by the app". Passive is fine when the subject is genuinely unknown.
- No exclamation points. No marketing-copy energy.
- Honest about trade-offs. If Mini Diarium lacks a feature the alternative has, say so plainly.

**GEO (BLUF) rule:**

The `BLUF_MAP` entry for each post must be a single self-contained answer that an LLM can quote verbatim without needing surrounding context. It should name the specific products, the specific trade-off, and the specific constraint.

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
8. Added to `STATIC_PAGES` array in `scripts/generate-website-blog.mjs` (ensures inclusion in `llms.txt` and sitemap)

### Navigation Consistency

The main navigation lives in four places that must stay in sync:
- `website/index.html` (uses `#fragment` links since it's at root)
- `website/encrypted-journal/index.html` (uses `/#fragment` links)
- `website/compare/index.html` (uses `/#fragment` links)
- `website/privacy/index.html` (uses `/#fragment` links)
- `scripts/generate-website-blog.mjs` → `buildNav()` (uses `/#fragment` links for blog pages)
- `scripts/generate-website-docs.mjs` → (uses `/#fragment` links for docs pages)

Current nav order: Features → Security → Blog → Docs → Download

### Generator Map Synchronization

`scripts/generate-website-blog.mjs` contains two hardcoded maps keyed by post slug:
- `DESCRIPTION_MAP` — used in `llms.txt` entries for AI crawler summary
- `BLUF_MAP` — used for the "Short answer:" blurb at the top of each blog post

**When changing a post's description, update both maps.** If the slug doesn't exist in these maps, the generator falls back to the front matter directly — but new posts should have explicit entries.

### Monitoring Cadence

- Export Google Search Console data (3-month window) to `docs/seo/` quarterly
- Compare against the last baseline in [`docs/seo/`](../docs/seo/) (see the most recent `Pages.csv` and `Queries.csv` — do not inline numbers here).
- Key metrics to watch (current baselines in `docs/seo/Pages.csv` and `Queries.csv`):
  - `/encrypted-journal/` CTR — target >2%
  - Blog post CTR on positions 6–10 — target >1%
  - US market CTR — target >5%
  - New blog post positions as they get indexed
- After each audit, create or update `docs/seo/seo-fix-plan.md` with prioritized actions

### Production Configuration

HTTP→HTTPS redirect is handled by Coolify, not the local `website/nginx.conf`. If GSC shows `http://` impressions, the Coolify edge must be configured with 301 redirects. See `docs/seo/production-config-notes.md`.

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

See `website/docs-src/_template.md` for the starter template.

---

## How the build pipeline works

`bun run website:build-static` runs three scripts in sequence:

1. **`generate-website-blog.mjs`** — reads all `.md` sources, renders HTML, updates `blog/index.html`, `feed.xml`, `sitemap.xml`, `llms.txt`, and the homepage blog teaser. Outputs unfingerprinted asset references (`style.css`, `main.js`).

2. **`generate-website-docs.mjs`** — reads all `docs-src/*.md` sources, renders HTML for each section and the hub index, updates `sitemap.xml` and `llms.txt` with docs URLs. Outputs unfingerprinted asset references.

3. **`fingerprint-website-assets.mjs`** — hashes `css/style.css` and `js/main.js`, writes the content-addressed copies (`css/style.<hash>.css`, `js/main.<hash>.js`), and rewrites all HTML references to use the new names. Removes stale fingerprinted files when the hash changes.

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
| `encrypted-journal/`, `compare/`, `privacy/` | Edit | Static guide / comparison / policy pages |
| `css/`, `js/` | Edit | Site stylesheet and scripts |
| `nginx.conf` | Edit | Local Docker preview only — does not affect production |
| `../docs/seo/` | Edit | SEO audit exports (outside `website/` but referenced by monitoring guidance above) |

---

## Local Docker Dev

Use the Docker Compose setup in `website/` to build and preview the site locally before committing or deploying.

### Prerequisites

Docker Desktop must be installed and its daemon must be running.

### Commands (run from `website/` directory)

```bash
# Build the Docker image
docker compose build

# Start the container (serves at http://localhost:80)
docker compose up -d

# Stop the container
docker compose down
```

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

> **Note:** This compose file is for local preview only. Production runs through Coolify with separate TLS, redirect, and caching configuration. Changes to `nginx.conf` here do not affect production.
