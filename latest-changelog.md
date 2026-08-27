## What's Changed

This release fixes a regression where pressing Enter at the true end of a paragraph silently did nothing, caused by a duplicate TipTap editing dependency introduced in v0.7.0.

### Fixed

- **Enter key silently did nothing at the end of a paragraph (#273)**: pressing Enter with the cursor at the true end of a paragraph produced no new line, with no visible error. The cause was a duplicate copy of a TipTap editing dependency, introduced by the v0.7.0 dependency bump: one copy ended up nested inside another, and TipTap's node-splitting code crashed silently when crossing that boundary. Only operations that build a brand-new empty paragraph hit the failing path, which is why the bug looked position-specific. Fixed by pinning the dependency so a single copy resolves. A regression test guards against the duplicate returning. Full investigation: [docs/archive/2026-08-27-issue-273-enter-key-rca.md](docs/archive/2026-08-27-issue-273-enter-key-rca.md).