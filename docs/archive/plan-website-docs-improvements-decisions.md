# Decision Log — Website Docs Improvements Plan

Companion to [`plan-website-docs-improvements.md`](plan-website-docs-improvements.md).

Each entry records a non-obvious choice made during planning, the options considered, and the reasoning. Entries are written before implementation so future deviations can reference them.

---

## D-01: CSS override strategy for docs content width

**Decision:** Add `.container { max-width: 1400px; }` inside the inline `<style>` block in `scripts/generate-website-docs.mjs`, overriding the global 1100px value from `website/css/style.css` for docs pages only.

**Options considered:**

| Option | Description | Rejected because |
|--------|-------------|-----------------|
| A (chosen) | Inline style override in generator | Scoped to docs pages only; no risk of affecting homepage, blog, or compare pages |
| B | Edit `.container` max-width in `website/css/style.css` directly | Would widen every page on the site, including the homepage, blog, and compare pages — out of scope |
| C | Add a new `.docs-container` class in the generator and the stylesheet | Requires coordinated changes to two files and every `<div class="container">` in the generator template — more fragile |
| D | Reduce sidebar/TOC column widths (240px → 200px, 200px → 160px) | Saves only ~80px of content width vs. ~300px from widening the container; doesn't solve the core problem |

**Why 1400px:** At 1400px container with `box-sizing: border-box` and `padding: 40px` per side, the 3-column grid `(240px sidebar) + (gap 40px) + (1fr content) + (gap 40px) + (200px TOC)` gives `1fr = 1320 - 520 - 80 = 800px`. This is ~60% wider than the current ~500px, appropriate for technical documentation.

**Side effects acknowledged:**
- `no-toc` docs pages (`.docs-layout.no-toc { grid-template-columns: 240px 1fr; }`) would get `1fr = 1320 - 240 - 40 = 1040px`. All 11 current pages have H2+ headings and generate a TOC, so no-toc is not triggered by any current page. Noted in Task 2.
- The `@media (max-width: 1099px)` breakpoint continues to collapse to 2-column at those viewport widths — unchanged and correct.

---

## D-02: Backups description changed to 153 chars instead of keeping 150

**Decision:** Replace the backups description (previously 150 chars, exactly at the lower bound) with a 153-char rewrite: `"Mini Diarium automatically backs up your encrypted journal on every unlock and keeps the 30 most recent copies in a backups folder next to your diary.db."`

**Why:** 150 is technically within the TODO-0045 target of 150–160, but Bing's guidelines treat descriptions below ~150 chars as potentially too short for independent use as a snippet. Sitting exactly at the lower bound carries the risk of a borderline rejection on a future audit. 153 chars provides comfortable margin at no cost to readability.

**Content:** Semantically identical to the original — same facts, reordered into a single sentence instead of two fragments.

---

## D-03: Visual content audit produces a decision record, not screenshots

**Decision:** Task 3 results in a written decision table in `website/CLAUDE.md`, not actual screenshots or image files.

**Why:** The TODO-0047 text says "decide which pages actually need visuals versus which are fine as text-only" — the deliverable is a decision, not an implementation. Adding real screenshots requires a running build of the app and involves significant scope outside this plan. The decision table:
1. Resolves the question stated in TODO-0047.
2. Provides a concrete spec for whoever implements the screenshot task next.
3. Can be done without running the app.

**If screenshots are needed:** A follow-on TODO should be created (using the `todo-manager` skill) referencing this decision table. Task 3 notes this.

---

## D-04: `updated:` date bumped for all 11 files, not just the ones with changed descriptions

**Decision:** All 11 `docs-src/*.md` files get their `updated:` front matter field set to `2026-06-04`, even the 3 files (`03-search.md`, `06-plugins.md`, and the others already in range) whose `description:` text is unchanged or identical.

**Why:** The `updated:` field drives:
1. The `lastmod` entry in `sitemap.xml` (signals to search crawlers that the page was reviewed).
2. The "Last updated" display on the docs page (readers know it was recently audited).

Bumping only the files whose description text changed would leave pages like search/plugins showing stale `updated:` dates even though they were explicitly reviewed and confirmed as acceptable. A systematic review justifies a date bump for all 11.

**Noted:** The generator validates that `updated` is a required front matter field (line 18 of `generate-website-docs.mjs`). Bumping it to `2026-06-04` is a valid change.

---

## D-05: Docker verification as a gracefully-degradable task

**Decision:** Task 4 (Docker verification) is written to be self-blocking and skippable: the first step is `docker --version`; if it fails, the task marks itself BLOCKED and the plan continues to Task 5. TODO-0048 is marked BLOCKED (not complete) in that scenario.

**Why:** Docker Desktop is not guaranteed to be installed in every execution environment (the project runs on WSL over Windows, and Docker may not be configured). Blocking the entire plan on Docker availability would make Tasks 1–3 (which are independent) unreachable. The graceful-skip pattern ensures the high-value TODO-0045 and TODO-0047 work is never gated on whether Docker is available.

**If Docker is unavailable:** TODO-0048 remains open with a blocker note. The agent running this plan in a Docker-capable environment can re-execute Task 4 independently.

---

## D-06: nginx server_name mismatch — Host header is mandatory for local verification

**Decision:** The Docker verification step explicitly tests with `Host: mini-diarium.com`, and the documented troubleshooting guide requires this header for all local tests.

**Why:** `website/nginx.conf` defines two server blocks:
- `server_name www.mini-diarium.com` → redirects to `https://mini-diarium.com` (HTTP 301)
- `server_name mini-diarium.com` → serves the site (HTTP 200)

Neither block has `default_server`. When a request arrives with `Host: localhost`, nginx has no matching `server_name`, falls back to the first defined block (`www.mini-diarium.com`), and returns a 301 redirect to `https://mini-diarium.com`. Without HTTPS locally, following that redirect fails. A naive `curl http://localhost:80/` or browser test against `localhost` will silently fail (redirect, not 200). This is a non-obvious gotcha that the documented workflow must explicitly address.

---

## D-07: Sections appended to `website/CLAUDE.md` in task order (no prescribed relative ordering)

**Decision:** Task 3 and Task 4 both append their sections to the end of `website/CLAUDE.md` independently. No prescribed ordering between the two new sections.

**Options considered:**

| Option | Rejected because |
|--------|-----------------|
| Prescribe `## Local Docker Dev` before `## Docs Page Visual Content Audit` | Requires Task 4 to insert (not append), which is a more error-prone file edit; the two sections are unrelated and their order in the file doesn't matter |
| Prescribe Task 3 before Task 4 | Tasks are independent; neither logically precedes the other |
| Merge into one section | They cover different topics (Docker vs. visual content); keeping separate is cleaner for future updates |

---

## D-08: Character count verification methodology

**Decision:** Character counts in the Task 1 table were verified by running `node -e "..."` with `String.prototype.length` on each description literal. This is authoritative (JavaScript counts Unicode code points as `length`, matching how Bing and most SEO tools count meta description characters).

**Findings from verification:**
- All 11 descriptions pass (150–160 chars).
- Three initial manual counts were off by 1 char (search: 153 not 154, faq: 156 not 157, backups: 150 not 151). These were corrected in the plan.
- The backups description was additionally replaced with a 153-char version (see D-02).

---

## Self-check results recorded at plan finalization (2026-06-04)

| Check | Result |
|-------|--------|
| All 11 description character counts in 150–160 range | PASS (verified by Node.js) |
| Backups comfortably above 150-char boundary | PASS (153 chars after D-02) |
| Task 1 step and note consistent on `updated:` date | PASS (after correction) |
| Task 2 CSS override scoped to docs pages only | PASS (inline style, not global CSS) |
| Task 2 no-toc edge case documented | PASS (noted in Task 2) |
| Task 3 and Task 4 append ordering conflict resolved | PASS (both append independently) |
| Docker Host header requirement explicit in validation | PASS (Task 4 validation updated) |
| No Tauri WebView or dialog interactions | N/A |
| All tasks have concrete steps and validation commands | PASS |
