> **Archived status:** Historical May 2026 SEO audit. **Still load-bearing** - `docs/seo/action-plan.md` P4 items and its Verification Checklist reference this document. Current strategy lives in `docs/seo/STRATEGY.md`; the hub index is `docs/seo/README.md`.

**Audit date:** May 2, 2026
**Site:** https://mini-diarium.com/
**Priority order:** P1 = fix today, P2 = this week, P3 = this month, P4 = ongoing

Each item includes the exact file/location to change and the exact code or copy to use.

---

## P1 — Fix Today (Schema Bugs & Trust Gaps)

These are factual errors that actively harm structured data validity and E-E-A-T trust signals.

---

### P1-A · Fix stale `softwareVersion` on `/encrypted-journal/`

**Problem:** The `SoftwareApplication` schema on this page shows `"0.4.6"` while the homepage correctly shows `"0.4.19"`. Google may suppress or deprioritize the Rich Result when it sees conflicting data about the same entity.

**File:** The HTML template or source file that generates `/encrypted-journal/index.html`

**Find this block:**

    {
      "@type": "SoftwareApplication",
      "@id": "https://mini-diarium.com/#software",
      "softwareVersion": "0.4.6",

**Replace with:**

    {
      "@type": "SoftwareApplication",
      "@id": "https://mini-diarium.com/#software",
      "softwareVersion": "0.4.19",

**Going forward:** Make `softwareVersion` a shared template constant (e.g., `{{APP_VERSION}}`) so all pages stay in sync from a single source of truth.

---

### P1-B · Update stale `dateModified` in homepage schema

**Problem:** Both the `SoftwareApplication` and `WebSite` nodes in the homepage `@graph` show `"dateModified": "2026-03-12"`. The sitemap correctly shows `"2026-04-27"` for the homepage. Google uses `dateModified` to schedule re-crawls — stale dates reduce crawl frequency.

**File:** `index.html` (homepage) — the `<script type="application/ld+json">` block

**Find** (appears twice — once in SoftwareApplication, once in WebSite):

    "dateModified": "2026-03-12",

**Replace both with:**

    "dateModified": "2026-04-27",

**Going forward:** Make `dateModified` a build-time variable injected at build time. Example shell snippet:

    DATE=$(date +%Y-%m-%d)
    sed "s/{{DATE}}/$DATE/g"

---

### P1-C · Host a Privacy page on the canonical domain

**Problem:** `/privacy/` and `/terms/` both return HTTP 404. Google's Quality Rater Guidelines treat accessible privacy pages on the same domain as a baseline trust signal. Both currently link to `github.com/…/PRIVACY.md` — an offsite URL that Google treats as external documentation, not a self-certified trust signal.

**Action:** Create `/privacy/index.html` with the following minimum viable content:

    <h1>Privacy Policy</h1>
    <p>Mini Diarium is a local-first, offline desktop application.
    It does not collect, transmit, or store any personal data on remote servers.
    There is no account system, no telemetry, and no analytics.</p>

    <p>The full privacy policy is maintained in the project repository:<br>
    <a href="https://github.com/fjrevoredo/mini-diarium/blob/master/PRIVACY.md">
      View Privacy Policy on GitHub
    </a></p>

    <p>For questions: <a href="mailto:minidiarium@gmail.com">minidiarium@gmail.com</a></p>

**Add to sitemap.xml:**

    <url>
      <loc>https://mini-diarium.com/privacy/</loc>
      <lastmod>2026-05-02</lastmod>
    </url>

**Link from the footer** on every page via your footer template.

---

## P2 — This Week (High-Impact, Moderate Effort)

---

### P2-A · Add `<link rel="preload">` for the LCP image

**Problem:** `demo-poster.png` is the largest above-the-fold media element and the LCP candidate. The browser only discovers it when it parses the `<video>` tag in the body — late in parse order. No preload hint means delayed LCP, which directly affects Core Web Vitals scoring.

**File:** Homepage `<head>` section

**Add this line immediately after `<meta charset="UTF-8" />`:**

    <link rel="preload" as="image" href="/assets/demo-poster.png" fetchpriority="high">

---

### P2-B · Fix title separator: replace `—` with `|`

**Problem:** Google prefers the pipe character as a title separator. Em dashes can be mis-parsed and look odd when truncated in SERPs.

**Files:** All page HTML templates. Find and replace across all pages:

Current:
    Mini Diarium — Encrypted Journal App for Windows, macOS &amp; Linux

Replace with:
    Mini Diarium | Encrypted Journal App for Windows, macOS &amp; Linux

Current:
    Can AI Access Your Journal? Cloud Storage and the Case for Local — Mini Diarium Blog

Replace with:
    Can AI Access Your Journal? Cloud Storage and the Case for Local | Mini Diarium Blog

Apply the same `—` to `|` replacement to all page titles that end in `— Mini Diarium Blog`.

Also update the matching `og:title` and `twitter:title` meta tags on each page.

---

### P2-C · Shorten blog index title (currently 84 chars — too long)

**Problem:** Titles over 65 characters are truncated in SERPs. The blog index title is 84 characters and will be cut off.

**File:** `/blog/index.html`

Current title tag:
    <title>Mini Diarium Blog — Encrypted Journals, Private Diary Apps, and Local-First Writing</title>

Replace with:
    <title>Mini Diarium Blog | Encrypted Journals & Local-First Writing</title>

Same fix for the OG and Twitter title tags on that page:
    <meta property="og:title" content="Mini Diarium Blog | Encrypted Journals & Local-First Writing" />
    <meta name="twitter:title" content="Mini Diarium Blog | Encrypted Journals & Local-First Writing" />

---

### P2-D · Add `potentialAction: SearchAction` to `WebSite` schema

**Problem:** Missing from the `WebSite` node on the homepage. This enables the Sitelinks Searchbox in branded Google SERPs and signals to AI crawlers that the site has navigable, searchable content.

**File:** Homepage `<script type="application/ld+json">`

Find the WebSite node:

    {
      "@type": "WebSite",
      "@id": "https://mini-diarium.com/#website",
      "url": "https://mini-diarium.com/",
      "name": "Mini Diarium",
      "inLanguage": "en-US",
      "publisher": {
        "@id": "https://mini-diarium.com/#organization"
      },
      "dateModified": "2026-03-12"
    }

Replace with:

    {
      "@type": "WebSite",
      "@id": "https://mini-diarium.com/#website",
      "url": "https://mini-diarium.com/",
      "name": "Mini Diarium",
      "inLanguage": "en-US",
      "publisher": {
        "@id": "https://mini-diarium.com/#organization"
      },
      "dateModified": "2026-04-27",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://mini-diarium.com/docs/faq/?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }

---

### P2-E · Add `article:published_time` and `article:modified_time` OG tags to blog posts

**Problem:** These Open Graph tags are read by LinkedIn, Facebook, and some AI crawlers for freshness signals. They are currently absent on all blog posts.

**File:** Each blog post HTML template (or the shared blog post shell function if one exists)

Add to each blog post `<head>`, after the existing OG tags. Use the same date values already in the BlogPosting JSON-LD schema for that post:

    <meta property="article:published_time" content="2026-04-27T00:00:00Z" />
    <meta property="article:modified_time" content="2026-04-27T00:00:00Z" />
    <meta property="article:author" content="Francisco J. Revoredo" />
    <meta property="article:section" content="Privacy & Security" />

---

### P2-F · Add `preconnect` hint for SourceForge badge domain

**Problem:** The SourceForge download badge (`a.fsdn.com`) loads from an external domain with no preconnect hint, causing an extra DNS + TLS round-trip before the image can be fetched.

**File:** Homepage `<head>`

Add after the charset meta tag:

    <link rel="preconnect" href="https://a.fsdn.com" crossorigin>
    <link rel="dns-prefetch" href="https://a.fsdn.com">

---

## P3 — This Month (GEO Content & Schema Enrichment)

---

### P3-A · Add descriptions to blog article entries in `llms.txt`

**Problem:** Blog articles in `/llms.txt` only list a title and URL. Documentation entries have one-sentence descriptions — AI crawlers use those to understand relevance before deciding whether to cite the page. Articles without descriptions are less likely to be cited.

**File:** `/llms.txt`

Current format:
    - Can AI Access Your Journal? Cloud Storage and the Case for Local: https://mini-diarium.com/blog/journal-app-ai-privacy/

Replace every article entry with this format:

    - Can AI Access Your Journal? Cloud Storage and the Case for Local: Explains why cloud architecture, not privacy settings, determines AI access to journal entries, and why local-first encryption provides a structural guarantee that settings cannot match. (https://mini-diarium.com/blog/journal-app-ai-privacy/)

    - Mini Diary Alternative: A Private Offline Desktop Journal: Covers why Mini Diarium is the maintained successor to Mini Diary — same local-first philosophy, stronger encryption model, and direct JSON import from Mini Diary exports. (https://mini-diarium.com/blog/mini-diary-alternative/)

    - Journal App Without Cloud: What Actually Matters: A practical checklist of what to look for in a journal app that avoids cloud dependency — local storage, offline use, data portability, and clear ownership. (https://mini-diarium.com/blog/journal-app-without-cloud/)

    - Day One Alternative for Private Offline Journaling: Compares Mini Diarium to Day One for users who want local-only storage without a subscription or cloud sync. (https://mini-diarium.com/blog/day-one-alternative-for-private-offline-journaling/)

    - Encrypted Journal App vs. Cloud Notes App: Side-by-side analysis of what separates an encrypted local journal from a cloud notes app, focusing on who controls the encryption keys. (https://mini-diarium.com/blog/encrypted-journal-vs-cloud-notes-app/)

    - Offline Journal That You Own: Explains what data ownership means in practice for a journal app — export formats, absence of lock-in, and what happens when a service shuts down. (https://mini-diarium.com/blog/offline-journal-that-you-own/)

    - Private Diary App for Desktop: What Actually Matters: Outlines the practical requirements for a private diary app on desktop — local storage, encryption at rest, no telemetry, and cross-platform builds. (https://mini-diarium.com/blog/private-diary-app-for-desktop/)

    - Local-First Journaling Means You Keep the Exit Door Open: Argues that local-first design is primarily about portability and user control, not just offline access. (https://mini-diarium.com/blog/local-first-journaling-and-ownership/)

    - Why an Offline Journal Is Different From a Cloud Notes App: Addresses the specific architectural differences between offline journaling tools and cloud notes apps in the context of privacy. (https://mini-diarium.com/blog/why-an-offline-journal-is-different/)

    - Why Mini Diarium Exists: The origin story — why Mini Diary's unmaintained state led to building Mini Diarium from scratch with Tauri 2, SolidJS, and a stronger encryption model. (https://mini-diarium.com/blog/why-mini-diarium-exists/)

---

### P3-B · Add BLUF (Bottom Line Up Front) opening to each blog post

**Problem:** LLMs cite sources that answer the question directly in the first paragraph. Posts currently open with descriptive context rather than a direct answer. Adding one sentence at the top that states the answer plainly increases citation likelihood significantly.

**For each blog post, add a summary paragraph as the first element of the article body. Examples:**

For /blog/journal-app-ai-privacy/:

    <p class="bluf"><strong>Short answer:</strong> Yes — if your journal is stored on a server,
    that server's operator controls when and how your entries can be processed by AI systems,
    regardless of any privacy setting. A local-first encrypted journal eliminates this risk
    architecturally, not by policy.</p>

For /blog/mini-diary-alternative/:

    <p class="bluf"><strong>Short answer:</strong> Mini Diarium is the direct maintained
    successor to Mini Diary — it imports Mini Diary JSON natively and uses the same
    local-first, no-cloud philosophy with a stronger encryption model.</p>

For /blog/journal-app-without-cloud/:

    <p class="bluf"><strong>Short answer:</strong> A journal app without cloud dependency
    needs local storage, encryption at rest, no telemetry, and a portable export format.
    Everything else is secondary.</p>

Style the BLUF paragraph slightly differently from body text (e.g., slightly larger font or a left border accent in the site's yellow #f5c94d) so it visually stands out and is easy for crawlers to identify as a summary.

---

### P3-C · Add `ItemList` schema to `/blog/` index

**Problem:** The blog index uses a `Blog` schema with @id references to posts. Adding `ItemList` creates an additional rich result opportunity and makes the page more parseable by AI crawlers scanning for curated content lists.

**File:** `/blog/index.html` — add to the existing `@graph` array:

    {
      "@type": "ItemList",
      "@id": "https://mini-diarium.com/blog/#list",
      "name": "Mini Diarium Blog Articles",
      "description": "Articles about encrypted journals, private diary apps, and local-first writing.",
      "numberOfItems": 10,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://mini-diarium.com/blog/journal-app-ai-privacy/",
          "name": "Can AI Access Your Journal? Cloud Storage and the Case for Local"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "url": "https://mini-diarium.com/blog/mini-diary-alternative/",
          "name": "Mini Diary Alternative: A Private Offline Desktop Journal"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "url": "https://mini-diarium.com/blog/journal-app-without-cloud/",
          "name": "Journal App Without Cloud: What Actually Matters"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "url": "https://mini-diarium.com/blog/day-one-alternative-for-private-offline-journaling/",
          "name": "Day One Alternative for Private Offline Journaling"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "url": "https://mini-diarium.com/blog/encrypted-journal-vs-cloud-notes-app/",
          "name": "Encrypted Journal App vs. Cloud Notes App"
        },
        {
          "@type": "ListItem",
          "position": 6,
          "url": "https://mini-diarium.com/blog/offline-journal-that-you-own/",
          "name": "Offline Journal That You Own"
        },
        {
          "@type": "ListItem",
          "position": 7,
          "url": "https://mini-diarium.com/blog/private-diary-app-for-desktop/",
          "name": "Private Diary App for Desktop: What Actually Matters"
        },
        {
          "@type": "ListItem",
          "position": 8,
          "url": "https://mini-diarium.com/blog/local-first-journaling-and-ownership/",
          "name": "Local-First Journaling Means You Keep the Exit Door Open"
        },
        {
          "@type": "ListItem",
          "position": 9,
          "url": "https://mini-diarium.com/blog/why-an-offline-journal-is-different/",
          "name": "Why an Offline Journal Is Different From a Cloud Notes App"
        },
        {
          "@type": "ListItem",
          "position": 10,
          "url": "https://mini-diarium.com/blog/why-mini-diarium-exists/",
          "name": "Why Mini Diarium Exists"
        }
      ]
    }

---

### P3-D · Add `HowTo` schema to key documentation pages

**Problem:** The /docs/ section contains step-by-step task guides that are exactly what HowTo schema was designed for. This schema type has a high rate of appearing in AI Overviews and featured snippets for procedural queries ("how to import from Day One", "how to export Mini Diarium").

**Example for `/docs/getting-started/index.html` — add to the JSON-LD @graph:**

    {
      "@type": "HowTo",
      "@id": "https://mini-diarium.com/docs/getting-started/#howto",
      "name": "How to get started with Mini Diarium",
      "description": "How to create your first journal, set a password, and start writing in Mini Diarium.",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Download Mini Diarium",
          "text": "Download the installer for your platform from the GitHub releases page.",
          "url": "https://mini-diarium.com/docs/getting-started/#download"
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Create a new journal",
          "text": "On first launch, choose a location for your journal file and set a master password.",
          "url": "https://mini-diarium.com/docs/getting-started/#create"
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Write your first entry",
          "text": "Click on today's date in the calendar panel and start writing in the rich text editor.",
          "url": "https://mini-diarium.com/docs/getting-started/#write"
        }
      ]
    }

Apply the same pattern to /docs/import/, /docs/export/, and /docs/backups/ — these are the highest-value how-to pages for search queries.

---

### P3-E · Add `DefinedTerm` schema to the security model section

**Problem:** The homepage has a detailed "Under the hood" section explaining AES-256-GCM, Argon2id, X25519 ECIES, and HKDF-SHA256. LLMs are frequently asked definitional questions about these concepts and cite pages with structured DefinedTerm data. Low effort, high citation value.

**File:** Homepage `<script type="application/ld+json">` — add to the @graph array:

    {
      "@type": "DefinedTermSet",
      "@id": "https://mini-diarium.com/#security-terms",
      "name": "Mini Diarium Security Model",
      "hasDefinedTerm": [
        {
          "@type": "DefinedTerm",
          "name": "AES-256-GCM encryption",
          "description": "Each journal entry is encrypted with AES-256-GCM using a random 256-bit master key before being written to the local SQLite database. Plaintext never exists on disk.",
          "inDefinedTermSet": "https://mini-diarium.com/#security-terms"
        },
        {
          "@type": "DefinedTerm",
          "name": "Key file authentication",
          "description": "An X25519 private key file used as a second unlock method for the journal, similar to SSH key-based authentication. The key file holds its own wrapped copy of the master key.",
          "inDefinedTermSet": "https://mini-diarium.com/#security-terms"
        },
        {
          "@type": "DefinedTerm",
          "name": "Local-first storage",
          "description": "All journal entries are stored in an encrypted SQLite database on the user's device. No entries are sent to cloud services or remote servers.",
          "inDefinedTermSet": "https://mini-diarium.com/#security-terms"
        }
      ]
    }

---

### P3-F · Create unique OG images for blog posts

**Problem:** All pages share `og-cover.png`. When blog posts are shared on social media or cited in AI-generated link previews, the generic app logo appears instead of a post-specific image.

**Recommended approach:** Use a simple template (Satori, Vercel OG, or a Figma template) to generate per-post cards. Each card needs:
    - Post title (large text)
    - "Mini Diarium Blog" label (small, top)
    - Accent color #f5c94d + dark background #0e0e0e (already used on the site)
    - Size: 1200x630px

Naming convention:
    /assets/og/journal-app-ai-privacy.png
    /assets/og/mini-diary-alternative.png
    /assets/og/journal-app-without-cloud.png
    (etc. — match the slug of each post)

Then update each blog post head:

    <meta property="og:image" content="https://mini-diarium.com/assets/og/journal-app-ai-privacy.png" />
    <meta name="twitter:image" content="https://mini-diarium.com/assets/og/journal-app-ai-privacy.png" />

---

## P4 — Ongoing (Content Strategy for GEO)

---

### P4-A · Create a `/compare/` page with a structured feature matrix

**Why:** Queries like "best encrypted journal app", "Day One alternative with no cloud", and "Obsidian vs encrypted journal" are answered by LLMs using comparison tables. The blog has comparison posts but they are narrative — LLMs prefer structured tabular data they can extract cleanly.

**Page:** `/compare/index.html`

Minimum viable feature matrix (render this as an HTML table):

    Feature             | Mini Diarium     | Day One              | Standard Notes | Joplin          | Obsidian
    --------------------|------------------|----------------------|----------------|-----------------|----------
    Fully offline       | Yes              | No (cloud required)  | Optional       | Optional        | Yes
    Encryption at rest  | AES-256-GCM      | AES-256 (cloud)      | XChaCha20      | None (plugin)   | None
    No telemetry        | Yes              | No                   | Yes            | Yes             | No
    Free & open source  | Yes (MIT)        | No                   | Yes            | Yes             | No
    Desktop-native      | Yes              | macOS/iOS only       | Yes            | Yes             | Yes
    Key file auth       | Yes              | No                   | No             | No              | No
    Import from Day One | Yes              | Native               | No             | No              | No

Add an FAQPage schema below the table with comparison questions:
    "Is Mini Diarium better than Day One for privacy?"
    "Does Mini Diarium work without a subscription?"
    "Can I migrate from Day One to Mini Diarium?"

---

### P4-B · Add `aggregateRating` to `SoftwareApplication` schema when ratings exist

**Why:** Star ratings in SERPs are one of the highest CTR signals for software products.

**Possible sources:** SourceForge listing (already present), GitHub stars as social proof.

When ready, add to the SoftwareApplication node on the homepage and /encrypted-journal/:

    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "47",
      "bestRating": "5",
      "worstRating": "1"
    }

---

### P4-C · Maintain `softwareVersion` as a build-time constant

**Why:** Version mismatches across pages will recur every release unless injected from a single source.

**Recommended:** Read version from tauri.conf.json and inject into all HTML templates at build time:

    VERSION=$(cat tauri.conf.json | jq -r '.version')
    find ./dist -name "*.html" -exec sed -i "s/{{APP_VERSION}}/$VERSION/g" {} \;

---

## Verification Checklist

After completing each priority group, verify with these commands:

Confirm schema version fix on /encrypted-journal/:
    curl -s https://mini-diarium.com/encrypted-journal/ | grep -o '"softwareVersion": "[^"]*"'
    Expected output: "softwareVersion": "0.4.19"

Confirm dateModified fix on homepage:
    curl -s https://mini-diarium.com/ | grep -o '"dateModified": "[^"]*"'
    Expected: all instances show 2026-04-27 or later

Confirm privacy page exists:
    curl -o /dev/null -s -w "%{http_code}" https://mini-diarium.com/privacy/
    Expected: 200

Confirm preload hint:
    curl -s https://mini-diarium.com/ | grep "rel=\"preload\""
    Expected: a line containing demo-poster.png

Confirm title separators:
    curl -s https://mini-diarium.com/ | grep -o '<title>[^<]*'
    Expected: pipe | separator, not em dash

Confirm SearchAction schema:
    curl -s https://mini-diarium.com/ | grep -o "SearchAction"
    Expected: at least one match

Validate all structured data using:
    https://validator.schema.org/  (paste the page URL)
    https://search.google.com/test/rich-results  (test homepage, /encrypted-journal/, any blog post)

---

## Summary Table

    ID    | Action                                          | Effort  | SEO Impact              | GEO Impact           | Priority
    ------|-------------------------------------------------|---------|-------------------------|----------------------|---------
    P1-A  | Fix softwareVersion on /encrypted-journal/      | 2 min   | High (schema validity)  | Medium               | Today
    P1-B  | Update dateModified in homepage schema          | 2 min   | High (freshness)        | Low                  | Today
    P1-C  | Host /privacy/ page on domain                   | 30 min  | High (E-E-A-T)          | Low                  | Today
    P2-A  | Preload LCP image (demo-poster.png)             | 5 min   | High (Core Web Vitals)  | Low                  | This week
    P2-B  | Fix title separators (em dash to pipe)          | 10 min  | Medium (SERP display)   | Low                  | This week
    P2-C  | Shorten blog index title                        | 5 min   | Medium (CTR)            | Low                  | This week
    P2-D  | Add SearchAction to WebSite schema              | 10 min  | Medium (Sitelinks)      | Medium               | This week
    P2-E  | Add article OG time tags to blog posts          | 15 min  | Low-Medium              | Medium               | This week
    P2-F  | Add preconnect for a.fsdn.com                   | 2 min   | Low-Medium (perf)       | Low                  | This week
    P3-A  | Add descriptions to llms.txt articles           | 20 min  | Low                     | High (citation)      | This month
    P3-B  | Add BLUF opening to blog posts                  | 1-2h    | Medium (snippets)       | High (citation rate) | This month
    P3-C  | Add ItemList schema to /blog/                   | 20 min  | Medium                  | Medium               | This month
    P3-D  | Add HowTo schema to /docs/ pages                | 1h      | High (snippets)         | High                 | This month
    P3-E  | Add DefinedTerm schema to homepage              | 20 min  | Low-Medium              | High (definitional)  | This month
    P3-F  | Unique OG images per blog post                  | 2-3h    | Medium (social CTR)     | Low                  | This month
    P4-A  | Create /compare/ page with feature matrix       | 3-4h    | High (comparison)       | High                 | Ongoing
    P4-B  | Add aggregateRating when ratings available      | 30 min  | High (star CTR)         | Low                  | When ready
    P4-C  | Build-time version constant                     | 30 min  | Medium (prevents bugs)  | Low                  | Next release
