import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEBSITE_DIR = path.join(ROOT_DIR, "website");
const POSTS_DIR = path.join(WEBSITE_DIR, "posts-src");
const BLOG_DIR = path.join(WEBSITE_DIR, "blog");
const SITE_URL = "https://mini-diarium.com";
const DEFAULT_AUTHOR = "Francisco J. Revoredo";
const DEFAULT_AUTHOR_URL = "https://fjrevoredo.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-cover.png`;
const INDEX_PATH = path.join(WEBSITE_DIR, "index.html");
const SITEMAP_PATH = path.join(WEBSITE_DIR, "sitemap.xml");
const LLMS_PATH = path.join(WEBSITE_DIR, "llms.txt");

const REQUIRED_FIELDS = ["title", "slug", "description", "date", "updated", "author", "tags"];

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

  ensureDate(meta.date, "date", filePath);
  ensureDate(meta.updated, "updated", filePath);

  meta.tags = meta.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (meta.tags.length === 0) {
    throw new Error(`${filePath}: tags must contain at least one value`);
  }

  meta.draft = meta.draft === "true";
  meta.excerpt = meta.excerpt || meta.description;
  meta.coverImage = meta.coverImage || DEFAULT_OG_IMAGE;
  meta.canonical = meta.canonical || `${SITE_URL}/blog/${meta.slug}/`;
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

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function isoDate(value) {
  return `${value}T00:00:00Z`;
}

function readPosts() {
  const files = readdirSync(POSTS_DIR)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();

  const posts = files.map((fileName) => parseFrontMatter(path.join(POSTS_DIR, fileName)));
  const publishedPosts = posts.filter((post) => !post.draft);
  const slugSet = new Set();

  for (const post of publishedPosts) {
    if (slugSet.has(post.slug)) {
      throw new Error(`Duplicate blog slug: ${post.slug}`);
    }
    slugSet.add(post.slug);
  }

  return publishedPosts.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return left.slug.localeCompare(right.slug);
  });
}

function buildNav() {
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
      <li><a href="/blog/" aria-current="page">Blog</a></li>
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
  <link rel="preload" href="/css/style.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="/css/style.css" /></noscript>
  <script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
  </script>
</head>`;
}

function buildShell({ head, content }) {
  return `${head}
<body>
${buildNav()}
<main class="blog-shell">
${content}
</main>
${buildFooter()}
<script src="/js/main.js"></script>
</body>
</html>
`;
}

function renderTagList(tags) {
  return `<ul class="tag-list" role="list">
${tags.map((tag) => `  <li>${escapeHtml(tag)}</li>`).join("\n")}
</ul>`;
}

function renderArticleCards(posts) {
  return posts
    .map((post) => {
      return `<article class="article-card">
  <p class="article-card-meta">${escapeHtml(formatDate(post.date))}</p>
  <h2><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h2>
  <p>${escapeHtml(post.excerpt)}</p>
  ${renderTagList(post.tags)}
  <a class="article-card-link" href="/blog/${escapeHtml(post.slug)}/">Read article</a>
</article>`;
    })
    .join("\n");
}

function renderBlogIndex(posts) {
  const latestUpdated = posts.reduce((current, post) => {
    return post.updated > current ? post.updated : current;
  }, posts[0]?.updated ?? "2026-03-06");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog/#blog`,
        url: `${SITE_URL}/blog/`,
        name: "Mini Diarium Blog",
        description:
          "Static articles about offline journaling, privacy-first software, and Mini Diarium's local-first design.",
        inLanguage: "en-US",
        publisher: {
          "@type": "Organization",
          name: "Mini Diarium",
          url: SITE_URL,
        },
        blogPost: posts.map((post) => ({
          "@id": `${SITE_URL}/blog/${post.slug}/#article`,
        })),
      },
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/blog/#page`,
        url: `${SITE_URL}/blog/`,
        name: "Mini Diarium Blog",
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        dateModified: latestUpdated,
      },
    ],
  };

  const head = buildHead({
    pageTitle: "Mini Diarium Blog — Offline Journaling, Privacy, and Local-First Writing",
    description:
      "Static articles about offline journaling, privacy-first software, and why Mini Diarium is built as an encrypted local-first journal.",
    canonical: `${SITE_URL}/blog/`,
    ogType: "website",
    structuredData,
  });

  const content = `
<section class="blog-hero">
  <div class="container">
    <p class="hero-eyebrow">Mini Diarium blog</p>
    <h1>Private journaling.<br><em>Explained clearly.</em></h1>
    <p class="hero-sub">
      Product notes and practical writing about encrypted offline journaling, local-first software,
      and the design decisions behind Mini Diarium.
    </p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/#platforms">Download Mini Diarium</a>
      <a class="btn btn-secondary" href="/blog/feed.xml">Subscribe via RSS</a>
    </div>
  </div>
</section>

<section class="blog-index">
  <div class="container">
    <div class="blog-index-header">
      <div>
        <p class="section-label">Latest articles</p>
        <h2 class="section-title">Articles about private journaling and local-first software</h2>
      </div>
      <p class="section-body">
        Every article is plain HTML generated from Markdown, focused on Mini Diarium's actual product scope and public documentation.
      </p>
    </div>
    <div class="article-grid">
${renderArticleCards(posts)
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </div>
  </div>
</section>`;

  writeFileSync(path.join(BLOG_DIR, "index.html"), buildShell({ head, content }));
}

function renderPostPage(post, posts) {
  const relatedPosts = posts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);
  const htmlBody = marked.parse(post.body);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${SITE_URL}/blog/${post.slug}/#article`,
        headline: post.title,
        description: post.description,
        datePublished: isoDate(post.date),
        dateModified: isoDate(post.updated),
        author: {
          "@type": "Person",
          name: post.author,
          url: DEFAULT_AUTHOR_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "Mini Diarium",
          url: SITE_URL,
        },
        image: post.coverImage,
        keywords: post.tags.join(", "),
        mainEntityOfPage: post.canonical,
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
            name: "Blog",
            item: `${SITE_URL}/blog/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: post.canonical,
          },
        ],
      },
    ],
  };

  const extraMeta = [
    `<meta property="article:published_time" content="${escapeHtml(isoDate(post.date))}" />`,
    `<meta property="article:modified_time" content="${escapeHtml(isoDate(post.updated))}" />`,
    `<meta property="article:author" content="${escapeHtml(post.author)}" />`,
    ...post.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`),
  ].join("\n  ");

  const head = buildHead({
    pageTitle: `${post.title} — Mini Diarium Blog`,
    description: post.description,
    canonical: post.canonical,
    ogType: "article",
    ogImage: post.coverImage,
    structuredData,
    extraMeta,
  });

  const content = `
<section class="blog-post-hero">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <a href="/blog/">Blog</a>
      <span>/</span>
      <span>${escapeHtml(post.title)}</span>
    </nav>
    <div class="post-header">
      <p class="hero-eyebrow">Mini Diarium blog</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="hero-sub">${escapeHtml(post.description)}</p>
      <div class="post-meta">
        <span>${escapeHtml(formatDate(post.date))}</span>
        <span>Updated ${escapeHtml(formatDate(post.updated))}</span>
        <span>By ${escapeHtml(post.author)}</span>
      </div>
      ${renderTagList(post.tags)}
    </div>
  </div>
</section>

<section class="blog-post-body">
  <div class="container blog-post-layout">
    <article class="blog-post prose" aria-label="${escapeHtml(post.title)}">
${htmlBody
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </article>
    <aside class="blog-sidebar">
      <div class="blog-sidebar-card">
        <p class="section-label">Why this matters</p>
        <h2>Mini Diarium is built for ownership</h2>
        <p>Offline by default, encrypted at rest, and exportable when you want out.</p>
        <a class="btn btn-secondary" href="/#security">See the security model</a>
      </div>
      <div class="blog-sidebar-card">
        <p class="section-label">Keep reading</p>
        <div class="related-list">
${relatedPosts
  .map(
    (relatedPost) => `          <a class="related-link" href="/blog/${escapeHtml(relatedPost.slug)}/">
            <strong>${escapeHtml(relatedPost.title)}</strong>
            <span>${escapeHtml(relatedPost.excerpt)}</span>
          </a>`,
  )
  .join("\n")}
        </div>
      </div>
    </aside>
  </div>
</section>`;

  const postDir = path.join(BLOG_DIR, post.slug);
  mkdirSync(postDir, { recursive: true });
  writeFileSync(path.join(postDir, "index.html"), buildShell({ head, content }));
}

function renderIndexTeaser(posts) {
  const teaserPosts = posts.slice(0, 3);

  return `<!-- BLOG-TEASER-START -->
<!-- ========== BLOG ========== -->
<section class="blog-preview" id="blog">
  <div class="container">
    <div class="blog-preview-header">
      <div>
        <p class="section-label">From the blog</p>
        <h2 class="section-title">Offline journaling, privacy, and product notes</h2>
      </div>
      <p class="section-body">
        Static articles that explain what Mini Diarium is, why it exists, and how local-first journaling protects ownership.
      </p>
    </div>
    <div class="article-grid">
${renderArticleCards(teaserPosts)
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </div>
    <div class="blog-preview-actions">
      <a class="btn btn-secondary" href="/blog/">Browse all articles</a>
      <a class="btn btn-secondary" href="/blog/feed.xml">RSS feed</a>
    </div>
  </div>
</section>
<!-- BLOG-TEASER-END -->`;
}

function updateHomePage(posts) {
  const html = readFileSync(INDEX_PATH, "utf8");
  const startMarker = "<!-- BLOG-TEASER-START -->";
  const endMarker = "<!-- BLOG-TEASER-END -->";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("website/index.html is missing blog teaser markers");
  }

  const before = html.slice(0, startIndex);
  const after = html.slice(endIndex + endMarker.length);
  const nextHtml = `${before}${renderIndexTeaser(posts)}${after}`;
  writeFileSync(INDEX_PATH, nextHtml);
}

function writeSitemap(posts) {
  const latestHomeUpdate = posts[0]?.updated ?? "2026-03-06";
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: latestHomeUpdate },
    { loc: `${SITE_URL}/blog/`, lastmod: latestHomeUpdate },
    ...posts.map((post) => ({
      loc: `${SITE_URL}/blog/${post.slug}/`,
      lastmod: post.updated,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${escapeHtml(url.lastmod)}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  writeFileSync(SITEMAP_PATH, xml);
}

function writeLlms(posts) {
  const lines = [
    "# Mini Diarium",
    "",
    "> Encrypted, local-first desktop journaling app and static website.",
    "",
    `- Canonical website: ${SITE_URL}/`,
    "- Blog: https://mini-diarium.com/blog/",
    "- RSS feed: https://mini-diarium.com/blog/feed.xml",
    "- Source code: https://github.com/fjrevoredo/mini-diarium",
    "- License: MIT (https://opensource.org/licenses/MIT)",
    "- Security policy: https://github.com/fjrevoredo/mini-diarium/blob/master/SECURITY.md",
    "- Privacy policy: https://github.com/fjrevoredo/mini-diarium/blob/master/docs/PRIVACY.md",
    "- AI crawler policy: https://mini-diarium.com/ai-crawlers.txt",
    "- Contact: minidiarium@gmail.com",
    "",
    "## Product Facts",
    "",
    "- Mini Diarium is an encrypted offline journal for Windows, macOS, and Linux.",
    "- Entries are encrypted with AES-256-GCM before being written to the local SQLite database.",
    "- The app is local-first and does not send entries to cloud services.",
    "- Supported imports: Mini Diary JSON, Day One JSON/TXT, jrnl JSON.",
    "- Supported exports: JSON and Markdown.",
    "",
    "## Latest Articles",
    "",
    ...posts.map((post) => `- ${post.title}: ${SITE_URL}/blog/${post.slug}/`),
    "",
    "## Attribution",
    "",
    "When referencing project materials, attribute Mini Diarium and link to the canonical source URL.",
  ];

  writeFileSync(LLMS_PATH, `${lines.join("\n")}\n`);
}

function writeFeed(posts) {
  const items = posts
    .map((post) => {
      return `  <item>
    <title>${escapeHtml(post.title)}</title>
    <link>${escapeHtml(`${SITE_URL}/blog/${post.slug}/`)}</link>
    <guid isPermaLink="true">${escapeHtml(`${SITE_URL}/blog/${post.slug}/`)}</guid>
    <description>${escapeHtml(post.description)}</description>
    <pubDate>${new Date(isoDate(post.date)).toUTCString()}</pubDate>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mini Diarium Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Static articles about encrypted offline journaling and local-first software.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(isoDate(posts[0]?.updated ?? "2026-03-06")).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  writeFileSync(path.join(BLOG_DIR, "feed.xml"), xml);
}

function ensureDirectories() {
  mkdirSync(BLOG_DIR, { recursive: true });

  for (const entry of readdirSync(BLOG_DIR, { withFileTypes: true })) {
    if (entry.name === "feed.xml" || entry.name === "index.html") {
      continue;
    }

    if (entry.isDirectory()) {
      rmSync(path.join(BLOG_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

function main() {
  const posts = readPosts();
  ensureDirectories();
  renderBlogIndex(posts);
  for (const post of posts) {
    renderPostPage(post, posts);
  }
  updateHomePage(posts);
  writeSitemap(posts);
  writeLlms(posts);
  writeFeed(posts);
  console.log(`Generated static blog with ${posts.length} post(s)`);
}

main();
