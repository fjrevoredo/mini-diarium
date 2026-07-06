import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { escapeHtml, slugify } from './website-generator-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const POSTS_DIR = path.join(WEBSITE_DIR, 'posts-src');
const BLOG_DIR = path.join(WEBSITE_DIR, 'blog');
const SITE_URL = 'https://mini-diarium.com';
const DEFAULT_AUTHOR = 'Francisco J. Revoredo';
const DEFAULT_AUTHOR_URL = 'https://fjrevoredo.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-cover.png`;
const INDEX_PATH = path.join(WEBSITE_DIR, 'index.html');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const LLMS_PATH = path.join(WEBSITE_DIR, 'llms.txt');

const DESCRIPTION_MAP = {
  'journal-app-ai-privacy':
    'Explains why cloud architecture, not privacy settings, determines AI access to journal entries.',
  'mini-diary-alternative':
    'Mini Diary went unmaintained. Mini Diarium is its successor with AES-256-GCM encryption and direct import from Mini Diary JSON.',
  'journal-app-without-cloud':
    'A practical checklist of what to look for in a journal app without cloud dependency.',
  'day-one-alternative':
    'Compares Mini Diarium to Day One for users who want local-only storage and no sync service.',
  'day-one-alternative-for-private-offline-journaling':
    'Compares Mini Diarium to Day One for users who want local-only storage and no sync service.',
  'encrypted-journal-vs-cloud-notes-app':
    'An encrypted journal stores entries locally and encrypts before disk. Cloud apps store plaintext on servers. Architecture decides who can read your writing.',
  'offline-journal-that-you-own':
    'Owning your journal means keeping entries local, exporting in open formats, and never depending on a service for access.',
  'private-diary-app-for-desktop':
    "A private diary app for desktop should encrypt entries at rest, work fully offline, and give you an exit path. Here is the checklist.",
  'local-first-journaling-and-ownership':
    'Argues that local-first design is primarily about portability and long-term data control.',
  'why-an-offline-journal-is-different':
    "An offline journal can't send your entries to a server or share them with AI. That's architecture, not a setting.",
  'why-mini-diarium-exists':
    'The origin story of Mini Diarium: why an unmaintained predecessor led to building from scratch.',
  'what-is-an-encrypted-diary':
    "An encrypted diary encrypts entries before they touch disk. It's an architectural guarantee, not a login screen. Here is what that means.",
  'private-journal-app-how-to-choose':
    'A practical checklist for evaluating private journal apps: encryption at rest, local storage, offline use, open exports, and open source.',
  'desktop-diary-app':
    'A desktop diary app should encrypt entries at rest, store the primary copy locally, work offline, and export to open formats. Storage model and exit path matter more than feature lists.',
  'standard-notes-alternative':
    'Compares Mini Diarium to Standard Notes for users who want encrypted journal entries on their device only, with no sync service or server dependency.',
  'obsidian-alternative-for-journaling':
    'Compares Mini Diarium to Obsidian for journal writing: Obsidian stores vault files as unencrypted Markdown on disk; Mini Diarium encrypts each entry with AES-256-GCM at the storage layer.',
  'notion-alternative-for-journaling':
    'Notion stores journal entries on its servers, where AI features can read them. Mini Diarium encrypts each entry locally with AES-256-GCM, with no account and no server.',
};

const BLUF_MAP = {
  'journal-app-ai-privacy':
    '<p class="bluf"><strong>Short answer:</strong> Yes. If your journal is stored on a server, that server\'s operator controls when and how your entries can be processed by AI systems. A local-first encrypted journal changes this by keeping plaintext off the server entirely.</p>',
  'mini-diary-alternative':
    '<p class="bluf"><strong>Short answer:</strong> Mini Diary went unmaintained. Mini Diarium is the direct successor, rebuilt from scratch in a modern stack (Tauri 2, SolidJS, Rust) with AES-256-GCM encryption, key file authentication, and direct import from Mini Diary JSON. Same philosophy, stronger guarantees.</p>',
  'journal-app-without-cloud':
    '<p class="bluf"><strong>Short answer:</strong> A journal app without cloud dependency needs local storage, encryption at rest, no telemetry, and a portable export format. Everything else is secondary.</p>',
  'day-one-alternative':
    '<p class="bluf"><strong>Short answer:</strong> Mini Diarium and Day One both support rich text and calendar views, but Mini Diarium stores entries locally with AES-256-GCM encryption and has no sync service. Day One\'s cloud sync is optional but enabled by default.</p>',
  'day-one-alternative-for-private-offline-journaling':
    '<p class="bluf"><strong>Short answer:</strong> Mini Diarium and Day One both support rich text and calendar views, but Mini Diarium stores entries locally with AES-256-GCM encryption and has no sync service. Day One\'s cloud sync is optional but enabled by default.</p>',
  'encrypted-journal-vs-cloud-notes-app':
    '<p class="bluf"><strong>Short answer:</strong> An encrypted journal app encrypts entries before they reach storage. A cloud notes app stores plaintext on a server and may share it with AI partners. The architecture, not a privacy setting, determines who can access your writing.</p>',
  'offline-journal-that-you-own':
    '<p class="bluf"><strong>Short answer:</strong> Owning your journal means having a local copy in an open format that you can export anytime, with no cloud service involved in storage or sync. Portability and privacy are linked. You can\'t have one without the other.</p>',
  'private-diary-app-for-desktop':
    '<p class="bluf"><strong>Short answer:</strong> A private diary app for desktop should encrypt entries before they reach disk, run fully offline, avoid telemetry, and export to open formats. These aren\'t optional features. They\'re the checklist for genuine ownership.</p>',
  'local-first-journaling-and-ownership':
    '<p class="bluf"><strong>Short answer:</strong> Local-first journaling keeps the primary copy on your own device. Ownership goes further. It means the export format is open, your backup is under your control, and no service can revoke access.</p>',
  'why-an-offline-journal-is-different':
    '<p class="bluf"><strong>Short answer:</strong> An offline journal cannot send your entries to a server, a sync service, or an AI partner, not because of a policy, but because the network code literally does not exist. This architectural constraint outlasts any privacy policy.</p>',
  'why-mini-diarium-exists':
    '<p class="bluf"><strong>Short answer:</strong> Mini Diary was a clean, simple journal app that went unmaintained. Its dependencies aged and a fork was impractical. Mini Diarium was built from scratch keeping the same philosophy while adopting a modern stack with stronger security guarantees.</p>',
  'what-is-an-encrypted-diary':
    '<p class="bluf"><strong>Short answer:</strong> An encrypted diary encrypts entries before they are written to disk using a key that only you control. It is not the same as a password-protected app. Encryption at rest means the data files contain ciphertext, not readable entries.</p>',
  'private-journal-app-how-to-choose':
    '<p class="bluf"><strong>Short answer:</strong> A private journal app should encrypt entries at rest, store the primary copy on your device, work offline, export to open formats, and have public source code. These five criteria protect your writing regardless of what happens to the app or its publisher.</p>',
  'desktop-diary-app':
    '<p class="bluf"><strong>Short answer:</strong> A desktop diary app should store entries locally, encrypt them before writing to disk, work without a network connection, and export to JSON or Markdown. These four properties protect your writing regardless of what happens to the app or the company behind it.</p>',
  'standard-notes-alternative':
    '<p class="bluf"><strong>Short answer:</strong> Standard Notes encrypts entries and syncs the encrypted vault to a server. Mini Diarium encrypts entries and keeps them on your device only, with no sync service, no server, and no network code in the binary. If sync is not a requirement, the two apps make different architectural trade-offs for private journaling.</p>',
  'obsidian-alternative-for-journaling':
    '<p class="bluf"><strong>Short answer:</strong> Obsidian stores vault files as plain Markdown on disk with no built-in encryption. Mini Diarium encrypts each entry with AES-256-GCM before writing to a local SQLite database and has no network client. If you journal in Obsidian and want encryption at the storage layer without relying on a community plugin, Mini Diarium is a purpose-built alternative for Windows, macOS, and Linux.</p>',
  'notion-alternative-for-journaling':
    '<p class="bluf"><strong>Short answer:</strong> Notion is a collaborative, server-hosted workspace: entries live on Notion\'s servers, Notion holds the encryption keys, and Notion AI can process content when enabled. Mini Diarium is a single-user desktop app that encrypts each entry with AES-256-GCM before it touches disk, with no server, no account, and no AI processing.</p>',
};

const STATIC_PAGES = [
  {
    title: 'Compare',
    url: `${SITE_URL}/compare/`,
    filePath: path.join(WEBSITE_DIR, 'compare', 'index.html'),
    summary:
      'Feature comparison of Mini Diarium vs. Day One, Notion, Obsidian, Standard Notes, and other journal apps.',
  },
  {
    title: 'Privacy Policy',
    url: `${SITE_URL}/privacy/`,
    filePath: path.join(WEBSITE_DIR, 'privacy', 'index.html'),
    summary: "Mini Diarium's privacy policy: no telemetry, no cloud storage, no analytics.",
  },
  {
    title: 'Encrypted Journal App Guide',
    url: `${SITE_URL}/encrypted-journal/`,
    filePath: path.join(WEBSITE_DIR, 'encrypted-journal', 'index.html'),
    summary:
      'A direct overview of what an encrypted journal app should do, how Mini Diarium handles offline storage, and why local-first ownership matters.',
  },
  {
    title: 'Newsletter',
    url: `${SITE_URL}/newsletter/`,
    filePath: path.join(WEBSITE_DIR, 'newsletter', 'index.html'),
    summary:
      "Mini Diarium's email newsletter: occasional new releases, milestones, and launch news for the encrypted offline journal app. No spam, unsubscribe anytime.",
  },
];

const REQUIRED_FIELDS = ['title', 'slug', 'description', 'date', 'updated', 'author', 'tags'];

function ensureDate(value, fieldName, filePath) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${filePath}: ${fieldName} must use YYYY-MM-DD`);
  }
}

function parseFrontMatter(filePath) {
  const raw = readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
  if (!raw.startsWith('---\n')) {
    throw new Error(`${filePath}: expected front matter opening ---`);
  }

  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error(`${filePath}: expected front matter closing ---`);
  }

  const frontMatter = raw.slice(4, end).trim();
  const body = raw.slice(end + 5).trim();
  const meta = {};

  for (const line of frontMatter.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`${filePath}: invalid front matter line "${line}"`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    meta[key] = rawValue.replace(/^"(.*)"$/, '$1');
  }

  for (const field of REQUIRED_FIELDS) {
    if (!meta[field]) {
      throw new Error(`${filePath}: missing required front matter field "${field}"`);
    }
  }

  ensureDate(meta.date, 'date', filePath);
  ensureDate(meta.updated, 'updated', filePath);

  meta.tags = meta.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (meta.tags.length === 0) {
    throw new Error(`${filePath}: tags must contain at least one value`);
  }

  meta.draft = meta.draft === 'true';
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
  const href = token.href ?? '';
  const titleAttribute = token.title ? ` title="${escapeHtml(token.title)}"` : '';
  const isExternal = /^https?:\/\//.test(href);
  const targetAttributes = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeHtml(href)}"${titleAttribute}${targetAttributes}>${text}</a>`;
};

marked.use({ renderer });

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function isoDate(value) {
  return `${value}T00:00:00Z`;
}

function fileLastModified(filePath) {
  return statSync(filePath).mtime.toISOString().slice(0, 10);
}

function readPosts() {
  const files = readdirSync(POSTS_DIR)
    .filter((fileName) => fileName.endsWith('.md'))
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

    <ul class="nav-links" id="nav-links">
      <li><a href="/#features">Features</a></li>
      <li><a href="/#security">Security</a></li>
      <li><a href="/blog/" aria-current="page">Blog</a></li>
      <li><a href="/docs/">Docs</a></li>
      <li><a href="/#platforms">Download</a></li>
      <li>
        <a class="nav-github" href="https://github.com/fjrevoredo/mini-diarium" target="_blank" rel="noopener noreferrer">
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
    <div class="footer-newsletter">
      <p class="newsletter-pitch"><strong>Newsletter.</strong> New releases, milestones, and launch news. No spam, unsubscribe anytime.</p>
      <form class="newsletter-form embeddable-buttondown-form" action="https://buttondown.com/api/emails/embed-subscribe/mini_diarium" method="post">
        <label for="bd-email-footer">Email address</label>
        <input type="email" name="email" id="bd-email-footer" placeholder="you@example.com" required />
        <input type="submit" value="Subscribe" />
        <span class="newsletter-powered">Powered by <a href="https://buttondown.com/refer/mini_diarium" target="_blank" rel="noopener noreferrer">Buttondown</a></span>
      </form>
    </div>
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
        <a href="/privacy/">Privacy</a>
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
  extraMeta = '',
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
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />
  <link rel="alternate" type="application/rss+xml" title="Mini Diarium Blog" href="${SITE_URL}/blog/feed.xml" />
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
  <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/favicon-128x128.png" type="image/png" sizes="128x128" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  <link rel="stylesheet" href="/css/style.css" />
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
  return `<ul class="tag-list">
${tags.map((tag) => `  <li>${escapeHtml(tag)}</li>`).join('\n')}
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
    .join('\n');
}

function renderBlogIndex(posts) {
  const latestUpdated = posts.reduce((current, post) => {
    return post.updated > current ? post.updated : current;
  }, posts[0]?.updated ?? '2026-03-06');

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${SITE_URL}/blog/#blog`,
        url: `${SITE_URL}/blog/`,
        name: 'Mini Diarium Blog',
        description:
          "Static articles about encrypted journals, private diary apps, offline journaling, and Mini Diarium's local-first design.",
        inLanguage: 'en-US',
        publisher: {
          '@type': 'Organization',
          name: 'Mini Diarium',
          url: SITE_URL,
        },
        blogPost: posts.map((post) => ({
          '@id': `${SITE_URL}/blog/${post.slug}/#article`,
        })),
      },
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/blog/#page`,
        url: `${SITE_URL}/blog/`,
        name: 'Mini Diarium Blog',
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        dateModified: latestUpdated,
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/blog/#itemlist`,
        name: 'Mini Diarium Blog Articles',
        description:
          'All blog posts from the Mini Diarium blog about encrypted journaling, local-first software, and privacy.',
        numberOfItems: posts.length,
        itemListElement: posts.map((post, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/blog/${post.slug}/`,
          name: post.title,
        })),
      },
    ],
  };

  const head = buildHead({
    pageTitle: 'Mini Diarium Blog | Encrypted Journals & Local-First Writing',
    description:
      'Static articles about encrypted journals, private diary apps, offline journaling, and why Mini Diarium is built as a local-first desktop journal.',
    canonical: `${SITE_URL}/blog/`,
    ogType: 'website',
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
        <h2 class="section-title">Articles about encrypted journals, private diary apps, and local-first writing</h2>
      </div>
      <p class="section-body">
        Every article is plain HTML generated from Markdown, focused on private journaling, offline ownership, and Mini Diarium's real product scope.
      </p>
    </div>
    <div class="article-grid">
${renderArticleCards(posts)
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
    </div>
  </div>
</section>`;

  writeFileSync(path.join(BLOG_DIR, 'index.html'), buildShell({ head, content }));
}

function renderPostPage(post, posts) {
  const relatedPosts = posts.filter((candidate) => candidate.slug !== post.slug).slice(0, 2);
  const htmlBody = marked.parse(post.body);
  const bluf = BLUF_MAP[post.slug] ?? '';
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${SITE_URL}/blog/${post.slug}/#article`,
        headline: post.title,
        description: post.description,
        datePublished: isoDate(post.date),
        dateModified: isoDate(post.updated),
        author: {
          '@type': 'Person',
          name: post.author,
          url: DEFAULT_AUTHOR_URL,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Mini Diarium',
          url: SITE_URL,
        },
        image: post.coverImage,
        keywords: post.tags.join(', '),
        mainEntityOfPage: post.canonical,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${SITE_URL}/blog/`,
          },
          {
            '@type': 'ListItem',
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
    `<meta property="article:section" content="Privacy & Security" />`,
    ...post.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`),
  ].join('\n  ');

  const head = buildHead({
    pageTitle: `${post.title} | Mini Diarium Blog`,
    description: post.description,
    canonical: post.canonical,
    ogType: 'article',
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
${bluf}
${htmlBody
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
    </article>
    <aside class="blog-sidebar">
      <div class="blog-sidebar-card">
        <p class="section-label">Why this matters</p>
        <h2>Mini Diarium is built for ownership</h2>
        <p>Offline by default, encrypted at rest, and exportable when you want out.</p>
        <a class="btn btn-secondary" href="/encrypted-journal/">See the encrypted journal guide</a>
      </div>
      <div class="blog-sidebar-card">
        <p class="section-label">Keep reading</p>
        <div class="related-list">
${relatedPosts
  .map(
    (
      relatedPost,
    ) => `          <a class="related-link" href="/blog/${escapeHtml(relatedPost.slug)}/">
            <strong>${escapeHtml(relatedPost.title)}</strong>
            <span>${escapeHtml(relatedPost.excerpt)}</span>
          </a>`,
  )
  .join('\n')}
        </div>
      </div>
    </aside>
  </div>
</section>`;

  const postDir = path.join(BLOG_DIR, post.slug);
  mkdirSync(postDir, { recursive: true });
  writeFileSync(path.join(postDir, 'index.html'), buildShell({ head, content }));
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
        <h2 class="section-title">Encrypted journals, offline writing, and product notes</h2>
      </div>
      <p class="section-body">
        Static articles that explain encrypted journaling, private diary apps, and how local-first writing protects ownership.
      </p>
    </div>
    <div class="article-grid">
${renderArticleCards(teaserPosts)
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
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
  const html = readFileSync(INDEX_PATH, 'utf8');
  const startMarker = '<!-- BLOG-TEASER-START -->';
  const endMarker = '<!-- BLOG-TEASER-END -->';
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('website/index.html is missing blog teaser markers');
  }

  const before = html.slice(0, startIndex);
  const after = html.slice(endIndex + endMarker.length);
  const nextHtml = `${before}${renderIndexTeaser(posts)}${after}`;
  writeFileSync(INDEX_PATH, nextHtml);
}

function writeSitemap(posts) {
  const latestHomeUpdate = posts[0]?.updated ?? '2026-03-06';
  const indexLastModified = fileLastModified(INDEX_PATH);
  const homeLastmod =
    indexLastModified.localeCompare(latestHomeUpdate) > 0 ? indexLastModified : latestHomeUpdate;
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: homeLastmod },
    ...STATIC_PAGES.map((page) => ({
      loc: page.url,
      lastmod: fileLastModified(page.filePath),
    })),
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
  .join('\n')}
</urlset>
`;

  writeFileSync(SITEMAP_PATH, xml);
}

function writeLlms(posts) {
  const lines = [
    '# Mini Diarium',
    '',
    '> Encrypted, local-first desktop journaling app and static website.',
    '',
    `- Canonical website: ${SITE_URL}/`,
    ...STATIC_PAGES.map((page) => `- ${page.title}: ${page.url}`),
    '- Blog: https://mini-diarium.com/blog/',
    '- RSS feed: https://mini-diarium.com/blog/feed.xml',
    '- Source code: https://github.com/fjrevoredo/mini-diarium',
    '- License: MIT (https://opensource.org/licenses/MIT)',
    '- Security policy: https://github.com/fjrevoredo/mini-diarium/blob/master/SECURITY.md',
    '- Privacy policy: https://github.com/fjrevoredo/mini-diarium/blob/master/docs/PRIVACY.md',
    '- AI crawler policy: https://mini-diarium.com/ai-crawlers.txt',
    '- Contact: minidiarium@gmail.com',
    '',
    '## Product Facts',
    '',
    '- Mini Diarium is an encrypted offline journal for Windows, macOS, and Linux.',
    '- Entries are encrypted with AES-256-GCM before being written to the local SQLite database.',
    '- The app is local-first and does not send entries to cloud services.',
    '- Mini Diarium is a private diary app for desktop users who want local-only storage instead of a cloud account.',
    '- Supported imports: Mini Diary JSON, Day One JSON/TXT, jrnl JSON.',
    '- Supported exports: JSON and Markdown.',
    '',
    '## Canonical Pages',
    '',
    ...STATIC_PAGES.map((page) => `- ${page.title}: ${page.summary} (${page.url})`),
    '',
    '## Latest Articles',
    '',
    ...posts.map((post) => {
      const desc = DESCRIPTION_MAP[post.slug] ?? post.description;
      return `- ${desc} (${SITE_URL}/blog/${post.slug}/)`;
    }),
    '',
    '## Attribution',
    '',
    'When referencing project materials, attribute Mini Diarium and link to the canonical source URL.',
  ];

  writeFileSync(LLMS_PATH, `${lines.join('\n')}\n`);
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
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mini Diarium Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Static articles about encrypted journals, private diary apps, offline journaling, and local-first software.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(isoDate(posts[0]?.updated ?? '2026-03-06')).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  writeFileSync(path.join(BLOG_DIR, 'feed.xml'), xml);
}

function ensureDirectories() {
  mkdirSync(BLOG_DIR, { recursive: true });

  for (const entry of readdirSync(BLOG_DIR, { withFileTypes: true })) {
    if (entry.name === 'feed.xml' || entry.name === 'index.html') {
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
