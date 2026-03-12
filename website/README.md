# Website Blog Workflow

The marketing site stays fully static. Blog posts are authored in Markdown, then generated into committed HTML plus SEO/GEO artifacts.

## Deployment Boundary

- `website/docker-compose.yml` and `website/nginx.conf` are for local website testing only.
- Production is deployed through Coolify.
- Production redirects, canonical host enforcement, TLS behavior, and proxy rules are not controlled by the local `nginx.conf`.
- If Search Console shows canonicalization issues such as `http://mini-diarium.com/` impressions, fix them in Coolify or the real production edge configuration, not only in the local website container.

## Source of Truth

- Write and edit posts only in `website/posts-src/`
- Do not hand-edit:
  - `website/blog/`
  - `website/sitemap.xml`
  - `website/llms.txt`
  - `website/index.html` inside the generated blog teaser block
- The generator owns all of those files

## Create a New Post

1. Copy `website/posts-src/_template.md` to a new file
2. Name the file with a date and slug, for example:
   - `website/posts-src/2026-03-07-my-new-post.md`
3. Fill in the front matter:
   - `title`: full article title
   - `slug`: stable URL segment
   - `description`: short SEO/meta description
   - `date`: publish date in `YYYY-MM-DD`
   - `updated`: last substantive edit date in `YYYY-MM-DD`
   - `author`: currently `Francisco J. Revoredo`
   - `tags`: comma-separated list
   - optional: `excerpt`, `coverImage`, `canonical`, `draft`
4. Write the article body in Markdown
5. Run the static build:
   - preferred: `bun run website:build-static`
   - fallback if `bun` is unavailable: `node scripts/generate-website-blog.mjs && node scripts/fingerprint-website-assets.mjs`
6. Review generated diffs before committing

## Edit an Existing Post

1. Edit the matching source file in `website/posts-src/`
2. Update the `updated` field if the change is substantive
3. Keep the `slug` unchanged unless you intentionally want a new URL
4. Re-run the static build
5. Review regenerated outputs

Changing the slug removes the old generated URL. There is no redirect mechanism in the current static blog flow, so slug changes should be rare.

## Drafts

- Set `draft: true` in front matter to keep a post out of:
  - `website/blog/`
  - homepage teaser cards
  - `website/sitemap.xml`
  - `website/blog/feed.xml`
  - `website/llms.txt`
- Remove `draft: true` and rebuild when the post is ready to publish

## Review Checklist

Before committing, verify:

- the title matches the article intent and product vocabulary
- the description reads well as a search snippet
- the post stays aligned with Mini Diarium’s real product scope:
  - encrypted journaling
  - offline/local-first ownership
  - Mini Diary successor context
  - imports/exports/security/privacy claims already supported by the product
- links work and external links are intentional
- headings are clean and scan well
- the generated homepage teaser, blog index, feed, sitemap, and `llms.txt` look correct

## Front Matter Reference

```md
---
title: Example title
slug: example-slug
description: Short search-friendly summary of the post.
date: 2026-03-07
updated: 2026-03-07
author: Francisco J. Revoredo
tags: offline journaling, privacy-first software
excerpt: Optional shorter card summary.
draft: true
---
```

## Generated Outputs

The build regenerates:

- `website/blog/index.html`
- `website/blog/<slug>/index.html`
- `website/blog/feed.xml`
- `website/sitemap.xml`
- `website/llms.txt`
- the homepage blog teaser in `website/index.html`
- hashed asset references across all generated HTML pages

## Commands

```bash
# Full static blog/site rebuild
bun run website:build-static

# Generator only
bun run website:blog

# Node fallback if bun is unavailable
node scripts/generate-website-blog.mjs
node scripts/fingerprint-website-assets.mjs
```
