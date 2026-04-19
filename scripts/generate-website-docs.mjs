import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEBSITE_DIR = path.join(ROOT_DIR, "website");
const DOCS_SRC_DIR = path.join(WEBSITE_DIR, "docs-src");
const DOCS_DIR = path.join(WEBSITE_DIR, "docs");
const SITEMAP_PATH = path.join(WEBSITE_DIR, "sitemap.xml");
const LLMS_PATH = path.join(WEBSITE_DIR, "llms.txt");
const SITE_URL = "https://mini-diarium.com";
const DEFAULT_AUTHOR = "Francisco J. Revoredo";
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-cover.png`;

const REQUIRED_FIELDS = ["title", "slug", "description", "order", "updated", "tags"];

const SIDEBAR_GROUPS = [
  { label: "Basics", slugs: ["getting-started", "writing-entries", "navigating"] },
  { label: "Discovery", slugs: ["search"] },
  { label: "Your Data", slugs: ["import", "export", "plugins"] },
  { label: "Settings & More", slugs: ["preferences", "statistics", "backups"] },
  { label: "Help", slugs: ["faq"] },
];

const HUB_GROUPS = [
  { label: "Basics", icon: "📖", slugs: ["getting-started", "writing-entries", "navigating"] },
  { label: "Discovery", icon: "🔍", slugs: ["search"] },
  { label: "Your Data", icon: "📁", slugs: ["import", "export", "plugins"] },
  { label: "Settings & More", icon: "⚙️", slugs: ["preferences", "statistics", "backups"] },
  { label: "Help", icon: "💬", slugs: ["faq"] },
];

function ensureDate(value, fieldName, filePath) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${filePath}: ${fieldName} must use YYYY-MM-DD`);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontMatter(filePath) {
  const raw = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---\n")) {
    throw new Error(`${filePath}: expected front matter opening ---`);
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`${filePath}: expected front matter closing ---`);
  }

  const frontMatter = raw.slice(4, end).trim();
  const body = raw.slice(end + 5).trim();
  const meta = {};

  for (const line of frontMatter.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`${filePath}: invalid front matter line "${line}"`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    meta[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }

  for (const field of REQUIRED_FIELDS) {
    if (!meta[field]) {
      throw new Error(`${filePath}: missing required front matter field "${field}"`);
    }
  }

  ensureDate(meta.updated, "updated", filePath);

  meta.order = parseInt(meta.order, 10);
  if (Number.isNaN(meta.order)) {
    throw new Error(`${filePath}: order must be an integer`);
  }

  meta.tags = meta.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (meta.tags.length === 0) {
    throw new Error(`${filePath}: tags must contain at least one value`);
  }

  meta.draft = meta.draft === "true";
  meta.canonical = `${SITE_URL}/docs/${meta.slug}/`;
  meta.body = body;

  return meta;
}

marked.use({
  gfm: true,
  breaks: false,
});

const renderer = new marked.Renderer();
renderer.heading = function heading(token) {
  const text = this.parser.parseInline(token.tokens);
  const id = slugify(text);
  return `<h${token.depth} id="${id}">${text}</h${token.depth}>`;
};
renderer.link = function link(token) {
  const text = this.parser.parseInline(token.tokens);
  const href = token.href ?? "";
  const titleAttribute = token.title ? ` title="${escapeHtml(token.title)}"` : "";
  const isExternal = /^https?:\/\//.test(href);
  const targetAttributes = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${escapeHtml(href)}"${titleAttribute}${targetAttributes}>${text}</a>`;
};

marked.use({ renderer });

function isoDate(value) {
  return `${value}T00:00:00Z`;
}

function readSections() {
  const files = readdirSync(DOCS_SRC_DIR)
    .filter((fileName) => fileName.endsWith(".md") && !fileName.startsWith("_"))
    .sort();

  const sections = files.map((fileName) => parseFrontMatter(path.join(DOCS_SRC_DIR, fileName)));
  const publishedSections = sections.filter((section) => !section.draft);

  const slugSet = new Set();
  for (const section of publishedSections) {
    if (slugSet.has(section.slug)) {
      throw new Error(`Duplicate docs slug: ${section.slug}`);
    }
    slugSet.add(section.slug);
  }

  return publishedSections.sort((a, b) => a.order - b.order);
}

function buildNav(activePage = "") {
  const docsActive = activePage === "docs" ? ' aria-current="page"' : "";
  const blogActive = activePage === "blog" ? ' aria-current="page"' : "";

  return `
<nav class="nav" aria-label="Main navigation">
  <div class="container nav-inner">
    <a class="nav-brand" href="/">
      <img src="/assets/logo.svg" alt="Mini Diarium logo" class="nav-logo" width="28" height="28" />
      Mini Diarium
    </a>

    <ul class="nav-links" id="nav-links" role="list">
      <li><a href="/#features">Features</a></li>
      <li><a href="/#security">Security</a></li>
      <li><a href="/blog/"${blogActive}>Blog</a></li>
      <li><a href="/docs/"${docsActive}>Docs</a></li>
      <li><a href="/#facts">FAQ</a></li>
      <li><a href="/#platforms">Download</a></li>
      <li><a href="/#about">About</a></li>
      <li>
        <a class="nav-github" href="https://github.com/fjrevoredo/mini-diarium" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3z"/>
          </svg>
          Star on GitHub
        </a>
      </li>
    </ul>

    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  </div>
</nav>`;
}

function buildFooter() {
  return `
<footer class="footer">
  <div class="container">
    <div class="footer-inner">
      <div class="footer-left">
        <img src="/assets/logo.svg" alt="" class="footer-logo" width="20" height="20" aria-hidden="true" />
        <span>Mini Diarium</span>
        <span class="footer-sep">·</span>
        <span>Offline-first</span>
        <span class="footer-sep">·</span>
        <span>MIT License</span>
      </div>
      <div class="footer-right">
        <a href="https://github.com/fjrevoredo/mini-diarium" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://x.com/MiniDiarium" target="_blank" rel="noopener noreferrer">X</a>
        <a href="https://github.com/fjrevoredo/mini-diarium/blob/master/SECURITY.md" target="_blank" rel="noopener noreferrer">Security</a>
        <a href="https://github.com/fjrevoredo/mini-diarium/blob/master/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a>
        <a href="/blog/feed.xml">RSS</a>
        <a href="/ai-crawlers.txt">AI Crawlers</a>
        <a href="/llms.txt">LLMs</a>
        <a href="mailto:minidiarium@gmail.com" aria-label="Email Mini Diarium">minidiarium@gmail.com</a>
        <span style="color: var(--text-muted);">mini-diarium.com</span>
      </div>
    </div>
  </div>
</footer>`;
}

function buildHead({
  pageTitle,
  description,
  canonical,
  ogType,
  ogImage = DEFAULT_OG_IMAGE,
  structuredData,
  extraMeta = "",
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
  <meta name="theme-color" content="#0e0e0e" />
  <meta name="author" content="${escapeHtml(DEFAULT_AUTHOR)}" />
  <meta property="og:type" content="${escapeHtml(ogType)}" />
  <meta property="og:site_name" content="Mini Diarium" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Mini Diarium - encrypted local-first desktop journal" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@MiniDiarium" />
  <meta name="twitter:creator" content="@MiniDiarium" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  ${extraMeta}
  <title>${escapeHtml(pageTitle)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="alternate" type="application/rss+xml" title="Mini Diarium Blog" href="${SITE_URL}/blog/feed.xml" />
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
  <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/favicon-128x128.png" type="image/png" sizes="128x128" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  <link rel="stylesheet" href="/css/style.css" />
  <style>
    .docs-layout {
      display: grid;
      grid-template-columns: 240px 1fr 200px;
      gap: 2.5rem;
      align-items: start;
      padding-top: 2rem;
      padding-bottom: 4rem;
    }
    .docs-layout.no-toc {
      grid-template-columns: 240px 1fr;
    }
    .docs-sidebar {
      position: sticky;
      top: 80px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
    .docs-sidebar-header {
      font-size: .75rem;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-primary, #f0ede6);
      margin-bottom: 1rem;
      padding: .25rem 0;
    }
    .docs-sidebar-group {
      margin-bottom: 1.25rem;
    }
    .docs-sidebar-group-label {
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-muted, #666);
      padding: .25rem .75rem;
      margin-bottom: .25rem;
      display: block;
    }
    .docs-sidebar ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: .15rem;
    }
    .docs-sidebar li a {
      display: block;
      padding: .35rem .75rem;
      font-size: .875rem;
      color: var(--text-secondary);
      border-radius: 6px;
      text-decoration: none;
      transition: background .15s, color .15s;
    }
    .docs-sidebar li a:hover { background: var(--bg-hover, rgba(255,255,255,.06)); color: var(--text-primary); }
    .docs-sidebar li.active a {
      background: rgba(245,201,77,.12);
      color: #f5c94d;
      font-weight: 600;
    }
    .docs-toc {
      position: sticky;
      top: 80px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
    .docs-toc-label {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-muted, #666);
      margin: 0 0 .75rem;
    }
    .docs-toc ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: .2rem;
    }
    .docs-toc li a {
      display: block;
      font-size: .8rem;
      color: var(--text-muted, #888);
      text-decoration: none;
      padding: .2rem 0;
      transition: color .15s;
      line-height: 1.4;
    }
    .docs-toc li a:hover { color: var(--text-primary, #f0ede6); }
    .docs-toc li a.active { color: #f5c94d; }
    .docs-toc-h3 { padding-left: 1rem; }
    .docs-sidebar-toggle {
      display: none;
      align-items: center;
      gap: .5rem;
      font-size: .875rem;
      font-weight: 600;
      color: var(--text-secondary);
      background: var(--bg-card, #161616);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 6px;
      padding: .5rem .75rem;
      cursor: pointer;
      margin-bottom: 1rem;
      transition: border-color .15s, color .15s;
    }
    .docs-sidebar-toggle:hover { border-color: #f5c94d; color: #f5c94d; }
    .docs-sidebar.open {
      display: block !important;
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100%;
      z-index: 200;
      background: var(--bg, #0e0e0e);
      padding: 2rem 1.5rem;
      overflow-y: auto;
      box-shadow: 4px 0 24px rgba(0,0,0,.5);
    }
    .docs-prevnext {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-primary, #2a2a2a);
    }
    .docs-prevnext a {
      font-size: .875rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: .5rem .75rem;
      border: 1px solid var(--border-primary, #2a2a2a);
      border-radius: 6px;
      transition: border-color .15s, color .15s;
    }
    .docs-prevnext a:hover { border-color: #f5c94d; color: #f5c94d; }
    .docs-prevnext a.prev { margin-right: auto; }
    .docs-prevnext a.next { margin-left: auto; }
    .docs-hub-intro { max-width: 60ch; margin-bottom: 2rem; color: var(--text-secondary); line-height: 1.7; }
    .docs-hub-intro a { color: #f5c94d; text-decoration: none; }
    .docs-hub-intro a:hover { text-decoration: underline; }
    .docs-hub-group { margin-bottom: 2.5rem; }
    .docs-hub-group-label {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-muted, #666);
      margin-bottom: 1rem;
      padding-bottom: .5rem;
      border-bottom: 1px solid var(--border, #2a2a2a);
    }
    .docs-hub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }
    .docs-card {
      background: var(--bg-card, #161616);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      gap: .4rem;
      transition: border-color .15s, transform .15s;
    }
    .docs-card:hover { border-color: #f5c94d; transform: translateY(-2px); }
    .docs-card h2 { font-size: .95rem; font-weight: 700; color: var(--text, #f0ede6); margin: 0; }
    .docs-card p { font-size: .825rem; color: var(--text-muted, #888); margin: 0; line-height: 1.5; }
    .docs-card-icon { font-size: 1.1rem; }
    @media (max-width: 1099px) {
      .docs-layout { grid-template-columns: 240px 1fr; }
      .docs-toc { display: none; }
    }
    @media (max-width: 899px) {
      .docs-layout { grid-template-columns: 1fr; }
      .docs-sidebar { display: none; position: static; max-height: none; }
      .docs-sidebar-toggle { display: flex; }
    }
  </style>
  <script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
  </script>
</head>`;
}

function buildShell({ head, content }) {
  return `${head}
<body>
${buildNav("docs")}
<main class="blog-shell">
${content}
</main>
${buildFooter()}
<script src="/js/main.js"></script>
</body>
</html>
`;
}

function buildSidebar(sections, activeSlug) {
  const slugToSection = new Map(sections.map((s) => [s.slug, s]));

  const groups = SIDEBAR_GROUPS.map((group) => {
    const items = group.slugs
      .map((slug) => {
        const section = slugToSection.get(slug);
        if (!section) return "";
        const isActive = slug === activeSlug;
        return `      <li${isActive ? ' class="active"' : ""}><a href="/docs/${escapeHtml(slug)}/">${escapeHtml(section.title)}</a></li>`;
      })
      .filter(Boolean)
      .join("\n");

    if (!items) return "";

    return `  <div class="docs-sidebar-group">
    <span class="docs-sidebar-group-label">${escapeHtml(group.label)}</span>
    <ul>
${items}
    </ul>
  </div>`;
  })
    .filter(Boolean)
    .join("\n");

  return `<nav class="docs-sidebar" aria-label="Documentation sections">
  <p class="docs-sidebar-header">Documentation</p>
${groups}
</nav>`;
}

function buildToc(htmlBody) {
  const headingRe = /<h([23])\s+id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  const headings = [];
  let match;
  while ((match = headingRe.exec(htmlBody)) !== null) {
    headings.push({
      level: match[1],
      id: match[2],
      title: match[3].replace(/<[^>]+>/g, ""),
    });
  }
  if (headings.length < 2) return "";

  const items = headings
    .map(
      (h) =>
        `    <li class="docs-toc-h${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.title)}</a></li>`,
    )
    .join("\n");

  return `<aside class="docs-toc" aria-label="On this page">
  <p class="docs-toc-label">On this page</p>
  <ul>
${items}
  </ul>
</aside>`;
}

function renderDocsHub(sections) {
  const latestUpdated = sections.reduce((current, section) => {
    return section.updated > current ? section.updated : current;
  }, sections[0]?.updated ?? "2026-04-16");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/docs/#page`,
        url: `${SITE_URL}/docs/`,
        name: "Mini Diarium Documentation",
        description: "User guide and documentation for Mini Diarium — encrypted local-first desktop journal.",
        inLanguage: "en-US",
        dateModified: latestUpdated,
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        publisher: {
          "@type": "Organization",
          name: "Mini Diarium",
          url: SITE_URL,
        },
      },
    ],
  };

  const head = buildHead({
    pageTitle: "Mini Diarium Documentation — User Guide",
    description:
      "Complete user guide for Mini Diarium: getting started, writing entries, navigation, import, export, plugins, preferences, backups, and more.",
    canonical: `${SITE_URL}/docs/`,
    ogType: "website",
    structuredData,
  });

  const slugToSection = new Map(sections.map((s) => [s.slug, s]));

  const groupsHtml = HUB_GROUPS.map((group) => {
    const cards = group.slugs
      .map((slug) => {
        const section = slugToSection.get(slug);
        if (!section) return "";
        return `<a class="docs-card" href="/docs/${escapeHtml(slug)}/">
  <span class="docs-card-icon">${group.icon}</span>
  <h2>${escapeHtml(section.title)}</h2>
  <p>${escapeHtml(section.description)}</p>
</a>`;
      })
      .filter(Boolean)
      .join("\n");

    if (!cards) return "";

    return `<div class="docs-hub-group">
  <p class="docs-hub-group-label">${escapeHtml(group.label)}</p>
  <div class="docs-hub-grid">
${cards
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  </div>
</div>`;
  })
    .filter(Boolean)
    .join("\n");

  const content = `
<section class="blog-hero">
  <div class="container">
    <p class="hero-eyebrow">Mini Diarium documentation</p>
    <h1>User Guide</h1>
    <p class="hero-sub">
      Everything you need to know about writing, protecting, and managing your journal in Mini Diarium.
    </p>
  </div>
</section>

<section>
  <div class="container">
    <p class="docs-hub-intro">
      New here? <a href="/docs/getting-started/">Jump in: Getting Started →</a>
    </p>
${groupsHtml
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  </div>
</section>`;

  writeFileSync(path.join(DOCS_DIR, "index.html"), buildShell({ head, content }));
}

function renderSectionPage(section, sections) {
  const sectionIndex = sections.findIndex((s) => s.slug === section.slug);
  const prevSection = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
  const nextSection = sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : null;

  const htmlBody = marked.parse(section.body);
  const tocHtml = buildToc(htmlBody);
  const hasToc = tocHtml !== "";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${SITE_URL}/docs/${section.slug}/#article`,
        headline: section.title,
        description: section.description,
        dateModified: isoDate(section.updated),
        keywords: section.tags.join(", "),
        publisher: {
          "@type": "Organization",
          name: "Mini Diarium",
          url: SITE_URL,
        },
        mainEntityOfPage: section.canonical,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Documentation",
            item: `${SITE_URL}/docs/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: section.title,
            item: section.canonical,
          },
        ],
      },
    ],
  };

  const head = buildHead({
    pageTitle: `${section.title} — Mini Diarium Documentation`,
    description: section.description,
    canonical: section.canonical,
    ogType: "article",
    structuredData,
  });

  const prevNextHtml =
    prevSection || nextSection
      ? `
<div class="docs-prevnext">
  ${prevSection ? `<a href="/docs/${escapeHtml(prevSection.slug)}/" class="prev">← ${escapeHtml(prevSection.title)}</a>` : "<span></span>"}
  ${nextSection ? `<a href="/docs/${escapeHtml(nextSection.slug)}/" class="next">${escapeHtml(nextSection.title)} →</a>` : "<span></span>"}
</div>`
      : "";

  const layoutClass = hasToc ? "docs-layout" : "docs-layout no-toc";

  const tocBlock = hasToc
    ? `\n${tocHtml
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n")}`
    : "";

  const content = `
<section class="blog-post-hero">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <a href="/docs/">Documentation</a>
      <span>/</span>
      <span>${escapeHtml(section.title)}</span>
    </nav>
    <div class="post-header">
      <p class="hero-eyebrow">Mini Diarium documentation</p>
      <h1>${escapeHtml(section.title)}</h1>
      <p class="hero-sub">${escapeHtml(section.description)}</p>
    </div>
  </div>
</section>

<section class="blog-post-body">
  <div class="container">
    <button class="docs-sidebar-toggle" id="docs-sidebar-toggle" aria-label="Open documentation navigation">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
      Menu
    </button>
    <div class="${layoutClass}">
${buildSidebar(sections, section.slug)
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
      <article class="blog-post prose" aria-label="${escapeHtml(section.title)}">
${htmlBody
  .split("\n")
  .map((line) => `        ${line}`)
  .join("\n")}
${prevNextHtml
  .split("\n")
  .map((line) => `        ${line}`)
  .join("\n")}
      </article>${tocBlock}
    </div>
  </div>
</section>`;

  const sectionDir = path.join(DOCS_DIR, section.slug);
  mkdirSync(sectionDir, { recursive: true });
  writeFileSync(path.join(sectionDir, "index.html"), buildShell({ head, content }));
}

function ensureDirectories() {
  mkdirSync(DOCS_DIR, { recursive: true });

  for (const entry of readdirSync(DOCS_DIR, { withFileTypes: true })) {
    if (entry.name === "index.html") {
      continue;
    }

    if (entry.isDirectory()) {
      rmSync(path.join(DOCS_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

function updateSitemap(sections) {
  if (!existsSync(SITEMAP_PATH)) {
    return;
  }

  let xml = readFileSync(SITEMAP_PATH, "utf8");
  const endTag = "</urlset>";
  const endIndex = xml.indexOf(endTag);
  if (endIndex === -1) {
    return;
  }

  const latestUpdated = sections.reduce((current, section) => {
    return section.updated > current ? section.updated : current;
  }, sections[0]?.updated ?? "2026-04-16");

  const docsUrls = [
    { loc: `${SITE_URL}/docs/`, lastmod: latestUpdated },
    ...sections.map((section) => ({
      loc: `${SITE_URL}/docs/${section.slug}/`,
      lastmod: section.updated,
    })),
  ];

  const newEntries = docsUrls
    .map(
      (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${escapeHtml(url.lastmod)}</lastmod>
  </url>`,
    )
    .join("\n");

  // Remove existing docs entries to avoid duplicates on re-run
  xml = xml.replace(/  <url>\s*<loc>[^<]*\/docs\/[^<]*<\/loc>[\s\S]*?<\/url>\n?/g, "");

  const insertIndex = xml.indexOf(endTag);
  const before = xml.slice(0, insertIndex);
  const after = xml.slice(insertIndex);
  writeFileSync(SITEMAP_PATH, `${before}${newEntries}\n${after}`);
}

function updateLlms(sections) {
  if (!existsSync(LLMS_PATH)) {
    return;
  }

  let content = readFileSync(LLMS_PATH, "utf8");

  // Remove existing Documentation block to avoid duplicates on re-run
  content = content.replace(/\n## Documentation\n[\s\S]*?(?=\n## |\s*$)/, "");
  content = content.trimEnd();

  const docsBlock = [
    "",
    "",
    "## Documentation",
    "",
    `- Documentation hub: ${SITE_URL}/docs/`,
    ...sections.map(
      (section) =>
        `- ${section.title}: ${section.description} (${SITE_URL}/docs/${section.slug}/)`,
    ),
  ].join("\n");

  writeFileSync(LLMS_PATH, `${content}${docsBlock}\n`);
}

function main() {
  const sections = readSections();
  ensureDirectories();
  renderDocsHub(sections);
  for (const section of sections) {
    renderSectionPage(section, sections);
  }
  updateSitemap(sections);
  updateLlms(sections);
  console.log(`Generated static docs with ${sections.length} section(s)`);
}

main();
