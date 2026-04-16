# Website (`website/`) — Mini Diarium

> For project architecture and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

Static marketing site — plain HTML/CSS/JS served via Nginx. No frontend framework, no build step for the site itself. Blog posts are the only content that requires generation.

## Key Rule: Never Edit Blog HTML Directly

All blog content is generated from Markdown sources in `posts-src/`. The HTML files in `blog/*/`, `blog/index.html`, `blog/feed.xml`, `sitemap.xml`, and `llms.txt` are **all generated output** — editing them directly will be overwritten on the next generation run.

The only files you should edit manually are:
- `posts-src/*.md` — blog post sources (the canonical input)
- `website/index.html` — homepage (between its static sections, not the blog teaser block)
- `encrypted-journal/index.html` — the encrypted journal guide page
- `css/`, `js/` — styles and scripts

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

Open `blog/<slug>/index.html` locally and confirm the rendered content looks correct before committing.

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
| `title` | Yes | Used in `<title>`, OG tags, breadcrumbs, article cards |
| `slug` | Yes | Stable URL segment: `mini-diarium.com/blog/<slug>/` |
| `description` | Yes | Meta description + OG/Twitter description |
| `date` | Yes | Publication date (`YYYY-MM-DD`) |
| `updated` | Yes | Last modified date (`YYYY-MM-DD`); drives `sitemap.xml` lastmod |
| `author` | Yes | Defaults available in script; currently always `Francisco J. Revoredo` |
| `tags` | Yes | Comma-separated; at least one. Rendered as tag pills and `article:tag` meta. |
| `excerpt` | No | Short card summary; falls back to `description` |
| `draft` | No | Set `true` to exclude from all output. Omit or set `false` to publish. |
| `coverImage` | No | Full URL to OG image; defaults to `/assets/og-cover.png` |
| `canonical` | No | Override canonical URL; defaults to `https://mini-diarium.com/blog/<slug>/` |

---

## Content Strategy

### Target topics

Posts should address real search intent around:
- encrypted offline journaling
- local-first ownership and portability
- specific tool comparisons or migrations (Day One, Mini Diary, jrnl, etc.)
- why architecture matters for private writing

### Style rules

- Lead with the user's problem, not the product.
- Be concrete. Avoid unsupported superlatives and vague marketing language.
- Every post should include a "Where Mini Diarium fits" section with factual product claims only.
- Always link to `/encrypted-journal/` or a related post — internal linking is part of the SEO/GEO strategy.
- The tone across posts should be consistent: direct, clear, no fluff.

### GEO (Generative Engine Optimization)

`llms.txt` and `ai-crawlers.txt` are maintained so AI crawlers index the content accurately. The generator keeps `llms.txt` in sync automatically. When adding a new post, the `Latest Articles` section in `llms.txt` is updated by the script — no manual edits needed.

---

## Documentation Section (`docs-src/`)

Source files: `website/docs-src/*.md` — one file per section.

Required front matter: `title`, `slug`, `description`, `order` (integer), `updated` (YYYY-MM-DD), `tags` (comma-separated). Optional: `draft: true` (excludes from build).

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

```
website/
├── posts-src/               # Blog Markdown sources — edit these
│   ├── _template.md         # Blank post template
│   └── YYYY-MM-DD-slug.md   # One file per post
├── docs-src/                # Docs Markdown sources — edit these
│   ├── _template.md         # Blank section template
│   └── NN-slug.md           # One file per section (ordered by filename)
├── blog/                    # Generated output — do not edit
│   ├── index.html
│   ├── feed.xml
│   └── <slug>/index.html
├── docs/                    # Generated output — do not edit
│   ├── index.html
│   └── <slug>/index.html
├── encrypted-journal/       # Static guide page — edit directly
│   └── index.html
├── assets/                  # Images, logo, OG cover
├── css/style.css            # Site stylesheet
├── js/main.js               # Site JS
├── index.html               # Homepage — edit directly; blog teaser is auto-updated
├── sitemap.xml              # Generated — do not edit
├── llms.txt                 # Generated — do not edit
├── ai-crawlers.txt          # Static AI crawler policy — edit directly if policy changes
├── robots.txt               # Static
└── nginx.conf               # Nginx config for deployment
```
