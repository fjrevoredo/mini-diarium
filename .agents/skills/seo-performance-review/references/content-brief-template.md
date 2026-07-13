# Content Brief Template

One brief per recommended new or refreshed post. Rank briefs by expected leverage. Hand the
brief to the blog workflow (`website/CLAUDE.md`); **do not draft the post here** - the author
writes it under `WRITING_STYLE.md` and the AI-writing rules.

---

## Brief: <working title>

- **Cluster:** <cluster name from STRATEGY.md §3>
- **Refresh or new:** <new post | strengthen existing page `/blog/<slug>/`>
- **Primary target query:** <query> - current pos ~<N>, <impr> impr, engine: <Google | Bing | both>
- **Secondary queries:** <query (pos/impr/engine)>, ...
- **Why now (leverage):** <striking-distance proximity, or CTR-gap on an existing page, or an
  uncovered cluster with real demand>

### Working title (<=60 chars, click-worthy, not a feature list)
<title>

### Meta description (140-160 chars, promise a takeaway)
<description>

### BLUF (50-80 words, for `BLUF_MAP`)
Self-contained answer an LLM can quote verbatim. Name the specific products, the specific
trade-off, and the specific constraint. Every product claim backed by a technical fact.

<bluf>

### H2 outline
1. <H2 - the reader's problem/question, distinct purpose>
2. <H2 - ...>
3. <H2 - include H2/H3 Q&A where the intent is a question>
4. Where Mini Diarium fits - factual product claims only (AES-256-GCM, no HTTP client, MIT,
   key-file auth, whole-journal encryption + per-entry edit-lock, imports/exports)
5. The practical takeaway - one or two if/then recommendations

### Required internal links (>=2)
- <e.g. /encrypted-journal/>
- <e.g. /compare/ or a related /blog/ post>

### Accuracy guardrails that apply
- <e.g. password/lock cluster: whole-journal AES-256-GCM + per-entry edit-lock, NOT per-entry
  passwords/encryption. Or: name any limitation plainly (desktop-only, no sync).>

### Cannibalization check
- <confirm the primary query is not already the title/H1 of an existing post; if it is,
  recommend refresh instead of new>
