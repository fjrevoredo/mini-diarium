# Product & Marketing Context: Mini Diarium

Concise brand, positioning, and audience context. Both the `seo-audit` skill (technical
on-page) and the `seo-performance-review` skill (data-driven recurring review) read this
file first. It is a pointer, not a copy: for the full strategy, keyword-cluster map, budget
model, and measurement regime see [`STRATEGY.md`](STRATEGY.md). For the
current point-in-time health snapshot see the latest `STATUS_REPORT_*.md`, and for
the live prioritized fix queue see [`action-plan.md`](action-plan.md).

## What the product is

Mini Diarium is a local-first, encrypted desktop journaling app for Windows, macOS, and
Linux. SolidJS front end, Rust/Tauri v2 backend, encrypted SQLite storage. Free and MIT
licensed. It is the maintained successor to the unmaintained **Mini Diary**.

Every product claim in marketing copy must be backed by a specific technical fact (repo
rule). The load-bearing facts:

- Each entry is encrypted with **AES-256-GCM** before it is written to the local SQLite
  database. Plaintext never touches disk.
- The whole journal is unlocked with **one password or a key file** (X25519, used like an
  SSH key). Password slots use Argon2id; a passwordless device-bound option also exists.
- There is **no HTTP client in the binary**: no cloud, no sync service, no telemetry, no
  account, no update pings. The app cannot send data anywhere because the transport layer
  does not exist.
- Imports: Mini Diary JSON, Day One JSON/TXT, jrnl JSON. Exports: JSON, Markdown, PDF.
- **Accuracy guardrail (password/lock cluster):** Mini Diarium encrypts the *entire* journal
  behind one credential. It also offers a per-entry **lock-against-accidental-edits** flag.
  It does **not** offer separate per-entry passwords or per-entry encryption. Content that
  targets "does X have a password" / "lock certain entries" queries must frame these facts
  precisely and never imply per-entry encryption.

## Positioning & owned topic

The narrow, ownable topic is **"encrypted offline journaling."** Adjacent framings we own or
want to own: private/secure desktop journaling, local-first ownership and portability,
offline-by-architecture privacy. Because this is a privacy/encryption product, trust signals
(verifiable author identity, consistent entity description) matter more than for a generic
app: treat it as quasi-YMYL-adjacent.

**Author / entity:** Francisco J. Revoredo (author URL `https://fjrevoredo.com`). Keep
Organization/Person schema and the byline consistent across the site and external profiles.

## Ideal customer profile (ICP)

Privacy-conscious individuals who write a personal journal and do not want it on someone
else's server: people leaving Day One / Notion / Obsidian / Standard Notes over cloud or
subscription concerns, self-hosters, FOSS users, and people searching for a maintained
replacement for Mini Diary. Two engine-specific audience notes from the July 2026 data:

- **Google** surfaces topic/positioning demand (encrypted diary, private/secure journal app).
- **Bing** is **Windows/PC-first** (dozens of "diary app for windows" / "offline diary for
  pc" variants) and shows clear **predecessor demand** ("mini diary" successor intent) and
  **feature/differentiator** queries ("does diarium have a password", "offline encrypted
  diary"). Keep Windows/desktop framing explicit in titles and H1s where it is honest.

## Brand voice (non-negotiable)

Follow [`docs/best-practices/WRITING_STYLE.md`](../best-practices/WRITING_STYLE.md): no
em dashes as connectors, no emojis, no LLM filler ("it is worth noting", "dive deep", "a
testament to"), varied sentence rhythm, active voice, concrete over abstract, honest about
trade-offs. Blog posts add: every Mini Diarium claim is backed by a technical fact, and if a
competitor has a feature Mini Diarium lacks, say so plainly.

## Competitors named on the site

Day One, Notion, Obsidian, Standard Notes, Joplin, jrnl, and the predecessor Mini Diary.
The `/compare/` page holds the structured feature matrix; comparison blog posts are narrative.
