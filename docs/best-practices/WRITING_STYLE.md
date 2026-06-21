# Writing Style Guide

Rules for all human-facing prose this project produces: blog posts, PR responses, release notes, and user-facing documentation.

These rules exist to prevent AI-generated text from reading like generic AI text which triggers people. The patterns below are reliable signals of LLM-generated copy to readers and to downstream AI systems. Apply them consistently.

This, and all the documentation of the project, is public and we are not intend to hide AI usage, and we include disclaimers as needed; but generic AI tone is off-putting to read so we need to not write any text in the project like that.

## Prohibited Patterns

- **Em dashes (`—`) as sentence connectors.** Use a comma, period, or restructured sentence instead.
- **Emojis** anywhere in body text, headings, or code comments.
- **Filler phrases** that add length without meaning:
  - "it is worth noting", "it should be noted"
  - "this is crucial", "this is critical"
  - "at the end of the day", "in essence", "to be clear"
  - "deep dive", "dive deep", "delve into"
  - "a testament to", "underscores the importance of"
- **Three or more consecutive sentences with identical grammatical structure.** Vary the rhythm.
- **Bullet lists that restate what the preceding sentence already said.** A list is for parallel items that would not read naturally as prose. If a sentence can hold the point, use a sentence.

## Voice

- **Active voice by default.** "The app stores entries locally" not "entries are stored locally by the app." Passive is fine when the subject is genuinely unknown or unimportant.
- **No exclamation points.** No marketing-copy energy.
- **Vary sentence length.** Short declarative sentences alongside medium compound ones. Long sentences that pile clause on clause lose the reader.
- **Concrete over abstract.** Name the specific thing. "Encrypts each entry with AES-256-GCM before writing to disk" not "prioritizes security."
- **Honest about trade-offs.** If something has a limitation, name it plainly.

## Punctuation

- Use a comma or period where an em dash would go.
- Oxford comma in lists of three or more items.
- Avoid semicolons unless the two clauses are closely related and parallel in structure. A period is almost always cleaner.

---

Context-specific extensions of these rules:

- Blog posts and docs: see [Voice and Style in website/CLAUDE.md](../../website/CLAUDE.md) for post structure, SEO fields, and GEO rules.
- PR responses: see [Style rules in the review-external-pr runbook](../../.agents/skills/runbooks/skills/review-external-pr/ENTRY.md) for review-specific conventions.
