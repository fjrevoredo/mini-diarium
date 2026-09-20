# Exploration Output: Rebrand Name Shortlist

> Artifact type:
> [x] Documentation — explains how something works or why it is the way it is
> [ ] Proposal
> [ ] Plan
> [x] Decision Record — the decision, its context, alternatives, and tradeoffs
>
> **Decision (2026-09-20): the new display name is "Fenmark."** Domain: `fenmark.app`
> (user to purchase). No code, config, or identifier has been changed as part of this
> exploration — implementation is tracked separately in
> `docs/plans/2026-09-20-mini-diarium-display-name-rebrand-plan.md`.

## Context

- **Why this exploration started**: Continuation of the display-name rebrand triggered by
  Timo Partl's request (see `docs/explorations/2026-09-08-rebranding-audit.md` and
  `docs/plans/2026-09-20-mini-diarium-display-name-rebrand-plan.md`). Timo proposed
  "Minidi," but the original audit itself flagged that name as risking the same
  "sounds like a smaller version of X" complaint that started this whole effort, since
  it's explicitly a shortened "Mini Diary." This exploration searched for a name that
  (1) fits the app's matured positioning — local-only, AES-256-GCM encrypted, no cloud,
  "boring security," open source — better than a diary/journal-rooted name, and
  (2) avoids future collision claims from other apps in the same space.
- **Date**: 2026-09-20
- **Sources consulted**: `PHILOSOPHY.md` and `README.md` (for current positioning/tone);
  live web search across ~40 candidate names, checked against existing apps/companies;
  domain registration status checked via RDAP (`rdap.verisign.com` for `.com`,
  `rdap.identitydigital.services` for `.io`, `pubapi.registry.google` for `.app`) across
  `.com`/`.app`/`.io`.
- **Methodology correction (2026-09-20, mid-session)**: Domain checks were initially done
  by fetching `whois.com` lookup pages, which was later discovered to be unreliable — it
  returned an identical generic "already registered, make an offer" template even for a
  deliberately nonsensical, almost-certainly-unregistered 35-character test string.
  Switched to direct RDAP registry queries (structured data, not a scraped marketing
  page) partway through this exploration. Every domain check in this document has since
  been re-verified via RDAP; any entry without a specific registrar name and
  registration date should be treated as unconfirmed.

## Questions & Assumptions

- **Open questions raised**:
  1. Every clean, pronounceable candidate's domain across `.com`, `.app`, and `.io` was
     already registered (27 of 27 checked). Should the project accept a non-exact-match
     domain — an alternate TLD (`.page`, `.md`), a qualified two-word domain
     (`reticentjournal.com`), or a domain decoupled from the exact brand name (the way
     Notion uses `notion.so` and Linear uses `linear.app`) — rather than continue
     searching for an exact-match `.com`?
  2. Which of the six shortlisted names (if any) fits the desired tone: security-forward
     and understated, or warm and approachable?
- **Assumptions made**: A collision with another app in the *same* category (private/
  encrypted journaling, or closely-related privacy tooling) is treated as disqualifying.
  A collision with a company in an unrelated industry (e.g., pharmacy software, ERP
  consulting) is treated as acceptable residual risk, since trademark exposure is
  generally scoped by industry class — this is a judgment call, not a legal opinion.
- **What we asked the user**: Which naming direction to pursue — offered nature metaphor,
  security/privacy-forward, invented word, and borrowed-ordinary-word; user picked the
  latter three. After all of those directions also failed on domain, we asked whether to
  decouple the brand name from the exact-match domain — not yet answered; this document
  is meant to inform that decision, not replace it.

## Findings

- The private/encrypted-journaling space is far more crowded than the original Diarium
  collision suggested. Live search surfaced: Day One, Diarium, Diaro, Diarly, Journey,
  Reflect(ion), Penzu, RytePad, DeepJournal, Apple Journal, Lifeograph, Joplin, Standard
  Notes, jrnl (an import format this app already supports), and "Mini Diary" — the app
  this project was itself originally inspired by. This argues for dropping the
  diary/journal semantic root entirely rather than finding a fresh word within it.
- ~30 candidate names were checked across six rounds of research (nature metaphors,
  security/privacy words, fully invented words, borrowed ordinary words, compounds,
  modified spellings, and literary/obscure real words). The full rejected list is in the
  appendix below, kept so this ground isn't re-covered.
- Every candidate's `.com` domain was already registered — the large majority since the
  1994–1998 domain gold rush, now parked for resale via Sedo. This held true even for
  fully invented, non-dictionary words, and even when checked against `.app` and `.io` as
  fallbacks. Clean, pronounceable, brand-shaped domains are structurally close to extinct
  across every mainstream TLD.
- Two candidates hit direct same-category collisions worth keeping as cautionary
  examples: **"Sanctum"** is an existing app described almost word-for-word like this
  app's own positioning ("encrypted on this device... no server, we collect nothing"),
  and **"QuietPage"** is an existing "privacy-focused journaling app with E2E encryption."
  Both show how easily a plausible-sounding name in this exact space turns out to already
  belong to a near-identical product — precisely the failure mode this whole rebrand is
  trying to avoid.

## Options Compared (Shortlist)

| Candidate | Direction | Collision check | Domain check | Pros | Cons |
|---|---|---|---|---|---|
| **Fenmark** ⭐ | Invented/constructed compound (fen + mark) | Clean of same-category (journaling/privacy-app) collisions, but see **Round 5** below — a deeper pass found several more small, unrelated-industry businesses already using this name (a UK accounting firm, a now-apparently-inactive Chicago webcasting company, an inactive Texas corp) plus an unplanned Tolkien/fantasy literary association | `.com` **taken** (GoDaddy/Afternic, re-registered 2023 — a domain-flipping platform) · `.io` **AVAILABLE** (verified via RDAP, clean 404) · `.app` **AVAILABLE** (verified via RDAP, clean 404) | Purpose-built, no dictionary-word baggage to collide with; its collisions are all different industries, low legal risk; **the only candidate in this document with a confirmed-available domain**, checked in real depth | `.com` itself is gone; more "already-used" as a small-business name than first assessed; a bare web search surfaces Tolkien-fandom content before this app would |
| **Reticent** | Security/privacy-forward (real word: reserved, keeps things to itself) | Clean — no app/software hits found | `.com` taken (GoDaddy, registered 2002) · `.io` taken (NameCheap, registered 2015) — both confirmed via RDAP | Directly evokes the app's actual differentiator (keeps things to itself, reserved); zero same-space collision found anywhere; not a generic startup-generator word | Domain confirmed squatted on both credible TLDs checked; the word is slightly abstract as a noun/brand, may need explaining once |
| **Amble** | Borrowed ordinary word (a slow, unhurried personal walk) | Clean in the journal/diary space — only hits are an unrelated transit-booking app and an unrelated fitness app | `.com` taken (IONOS, registered 1997, parked) | Warm and calming; evokes the unhurried, personal nature of journaling without naming it directly; easy to say and spell | Domain squatted since 1997; the word already has some app-store presence in unrelated categories, which could complicate app-store search visibility |
| **Meadow** | Borrowed ordinary word (a calm, open personal space) | Clean in the journal/diary space — no app hits found | `.com` taken (Network Solutions, registered 1995) · `.app` taken (NameCheap, registered 2018) — both confirmed via RDAP | Calming, nature-adjacent tone; no journal-space collision found | Domain squatted on both `.com` and `.app`; fairly generic word, weaker as an exclusive/defensible trademark |
| **Ward** | Security-forward (protection, guardianship) | Clean — no app/software hits found | `.com` taken (IONOS, registered 1994 — oldest of the batch) | Short; evokes protection without leaning on security clichés like "vault" or "cipher"; no collision found anywhere | Domain squatted since 1994; very short, common word — weak standalone trademark strength |
| **Sealed** | Security-forward (locked, protected) | Clean — no app hits found | `.com` taken (Bluehost, registered 1998) · `.app` taken (NameCheap, registered 2020) — both confirmed via RDAP | Plainly describes what the app does (entries are sealed/encrypted); no explaining needed | Purely descriptive word — hard to build an exclusive trademark around; domain squatted on both major TLDs checked |

For reference, **"Minidi"** (Timo's own suggestion, from the original email exchange) was
not re-tested in this round: the original audit already flagged the risk that it still
reads as a shortened "Mini Diary" — the same category of complaint that started this
whole exercise. Not eliminated, but it carries that identified risk without further
vetting here.

### Round 2 — Spanish/Latin words (not diary translations)

At the user's suggestion, this round tried Spanish/Latin vocabulary evoking privacy and
calm — deliberately avoiding direct translations of "diary" (e.g. "Mi Diario"), since a
translated diary-word carries the same "sounds like a smaller/derivative version" risk
that started this whole rebrand.

| Candidate | Direction | Collision check | Domain check | Pros | Cons |
|---|---|---|---|---|---|
| **Quietud** | Spanish: stillness, calm | Clean — no app/software hits found (only unrelated "Quiet"-named apps, not this exact word) | `.com` taken (parked, ownership unclear) | Evokes the calm, personal atmosphere of journaling without naming the activity; zero exact-name collision found | Domain taken; four syllables is longer than most successful short brand names; Spanish-only speakers will parse it instantly, English speakers will need it explained |
| **Sosiego** | Spanish: tranquility, peace of mind | Ambiguous — a "Sosiego" LinkedIn company page exists with no discoverable details on what it does | `.com` taken (registered 2003, actively held for 20+ years — not a stale squat) | Beautiful, uncommon word; strong calm/privacy connotation | The unidentified LinkedIn company is an open question, not cleared; long-held active domain suggests a real, unwilling-to-sell owner rather than a speculator |
| **Fuero** | Spanish/Latin: a historical personal legal privilege/protected right | Moderate collision — "Fuero Games," a funded Polish game studio (different industry, but a real, notable company) | Not checked (eliminated on collision) | Unique legal/historical root evoking a personally-protected right; not used in any privacy-app context | Existing funded company in an adjacent-enough industry (software/games) to carry real risk; "fuero" is also a real Spanish legal term, which can read as obscure/confusing out of context |
| **Cifra** | Spanish/Latin: cipher, figure, code — directly evokes encryption | Heavy collision — at least four unrelated "Cifra" apps (salon management, banking/accounting, education, invoicing) | Not checked (eliminated on collision) | Best conceptual fit of the round — literally means "cipher," which is what the app does to every entry | Too crowded a name already; would need heavy qualification to stand out |
| **Custodia** | Spanish/Latin: custody, safekeeping | Heavy collision — funded NYC fintech company ($7.2M raised) using this exact name for expense-management software | Not checked (eliminated on collision) | Directly evokes "keeping something safe," a strong conceptual fit | A real, funded, same-broad-category (financial software) company already owns this name |
| **Quies** | Latin: rest, quiet (root of "quiet," "requiem") | Light collision — owned by an active French earplug/skincare company (not a squatter, a real trademark holder) | `.com` taken (registered 1998, actively held by the earplug company) | Very short, distinctive, rare as a brand name | The domain's current owner is a real operating company with an active claim to the mark, not a stale parking page — higher risk than the other survivors here |

### Round 3 — Composites built from the shortlist's roots

At the user's request, this round blended roots from the surviving candidates above into
portmanteau/compound words (e.g. "Fen" from Fenmark + "ward" from Ward), on the theory
that longer composite strings are less likely to already be squatted than a single common
word. Checked with the corrected RDAP methodology throughout.

| Candidate | Built from | Collision check | Domain check | Pros | Cons |
|---|---|---|---|---|---|
| **Fenward** | Fen(mark) + Ward | Clean — no exact-name hits | `.com` taken (GoDaddy/Afternic, registered Dec 2020 — parked) | Reads like a plausible English place-name/surname; blends "secluded" (fen) with "protected" (ward) | Domain gone to a parking speculator |
| **Amblewick** | Amble + -wick (English place-name suffix, as in Warwick/Fenwick) | Clean — no exact-name hits | `.com` taken (Porkbun, registered **Sept 11, 2026** — 9 days before this check) | Warm, pastoral, village-name feel; distinctive | Registered so recently it strongly suggests automated bulk speculation on brandable-sounding compounds is active right now — a structural headwind, not bad luck |
| **Wardstead** | Ward + -stead (homestead) | Clean — no exact-name hits | `.com` taken (NameSilo, registered July 14, 2026 — also within the last ~2 months) | Evokes a protected home; plausible place-name feel | Same very-recent-registration pattern as Amblewick |
| **Sealcroft** | Sealed + -croft (a small enclosed private plot) | Clean — no exact-name hits (only an unrelated "Seal Software" match) | `.com` taken (Hostinger, registered Aug 8, 2026 — parked, `dns-parking.com` nameservers) | Evokes a small, private, sealed plot; place-name feel | Same very-recent-registration pattern |
| **Quietfold** | Quiet + fold (an enclosure; also a paper-folding pun) | Taken — `quietfold.com` is a live site ("Bringing back the quiet internet") | Not checked (eliminated on collision) | Nice double meaning (enclosure + folded page) | Already a live, named project |
| **Fenlock** | Fen(mark) + lock | Taken — an existing Turkish science-education app (`fenlock.com.tr`, Google Play) | Not checked (eliminated on collision) | Blends "secluded" with a security nod ("lock") without the vault/cipher cliché | Already a live app in an unrelated but real category |

**Notable pattern**: three of the four collision-clean composites (Amblewick, Wardstead,
Sealcroft) were registered within the last ~2 months of this check (Jul–Sep 2026), one of
them only 9 days prior. That's strong evidence of active, likely automated, bulk
registration of plausible startup-sounding compound words — the modern equivalent of the
1990s domain gold rush, now apparently running continuously. This makes composite-word
`.com` hunting a moving target, not a one-time search.

### Round 4 — Fenmark family (second iteration, at user's request)

The user liked **Fenmark** and asked for a second iteration on it — sibling names built
the same way (a short, evocative first syllable + a second syllable that reads as a
plausible English surname/place-name ending), to see whether any sibling does even better
than the original on domain availability.

| Candidate | Built from | Collision check | Domain check | Pros | Cons |
|---|---|---|---|---|---|
| **Fenmark** *(original)* | fen (secluded, marsh-like retreat) + mark (a personal/written mark) | Near-clean — one small, unrelated ERP consultancy | `.com` taken (parked) · `.io` **available** · `.app` **available** | Best conceptual fit — "the mark you leave in your own secluded space" reads directly as a private-journaling metaphor | `.com` gone |
| **Fenmoor** | fen + moor (open, wild landscape) | Clean — only unrelated UK retail/clothing/blacksmith companies share the name | `.com` taken (NameCheap, registered June 2024) · `.io` **available** · `.app` **available** | Pure nature-compound, evocative, easy to say | Leans more "landscape" than "personal record" — weaker tie to journaling specifically than Fenmark |
| **Fenholt** | fen + holt (a small wood/copse) | Clean — no hits at all | `.com` taken (GoDaddy, registered 1999) · `.io` **available** · `.app` **available** | Distinctive, no collision found anywhere | "Holt" is an obscure word to most readers — may need explaining |
| **Fenray** | fen + ray (a ray of light) | Clean — only an unrelated freelancer profile | `.com` taken (Gname.com, registered 2022) · `.io` **available** · `.app` **available** | Warm imagery — a ray of light inside a private, secluded space; softer tone than the others | Slightly less obviously "written record"-themed than Fenmark |
| **Fenlow** | fen + low | Clean — only a dissolved 2017 UK company and an unrelated 1945 engine manufacturer | `.com` taken (Atom.com Domains, registered **Nov 2025** — 10 months old) · `.io` taken (GoDaddy, registered **July 2026** — 2 months old) | — | Both available-TLD candidates lost to very recent speculative registration; eliminated from further consideration |
| **Wrenmark** | wren (a small, humble bird — folklore's "king of birds" despite its size) + mark | Clean — no hits at all | `.com` taken (GoDaddy/Afternic, registered 2014) · `.io` **available** · `.app` **available** | Charming personal metaphor (something small and unassuming, quietly significant); breaks from repeating the "Fen-" prefix | Slightly more whimsical/less minimal than the "Fen-" siblings |
| **Fendrick** | fen + -drick (invented ending, reads as a surname, cf. "Kendrick") | Clean — only unrelated people's surnames and a landscaping firm | `.com` taken (DomainSite, registered 1999) · `.io` **available** · `.app` **available** | Sounds like a real surname/brand, comfortable to say | Weakest conceptual tie of the batch — "-drick" carries no meaning of its own |

**Result**: five of six siblings (all but Fenlow) are clean on collision *and* have both
`.io` and `.app` confirmed available — the same profile as the original Fenmark. This
means there is now a small family of viable options, not just one, in case Fenmark itself
runs into a snag at the trademark-register stage (see Risks & Unknowns).

### Round 5 — Deep-dive due diligence on Fenmark specifically (at user's request)

The earlier "near-clean — one small ERP consultancy" read on Fenmark was based on a
single generic search. This round widened the net specifically for Fenmark: a bare-word
search (no qualifiers), app-store site-searches, GitHub/npm/GitLab, a trademark-oriented
search, and social-handle checks — to surface anything a narrower query would miss.

- **Revised collision picture — more real-world usage than first found, still no
  same-category hit**:
  - **Fenmark LLP** — a currently active UK accounting firm (verified live site,
    `accessible-root-034005.framer.app`), not previously found. Different industry
    (accounting services), no trademark symbols visible on their site.
  - **FenMark™** — a Chicago internet-webcasting/production company that used the ™
    symbol on its marketing materials (`fenmark.net`). The domain no longer resolves
    (DNS lookup failed), suggesting the business is now inactive — lowers but does not
    eliminate the risk, since an unrenewed mark can still complicate a formal trademark
    application depending on abandonment status.
  - **Fenmark, Inc.** — a Texas corporation, per CorporationWiki, that appears inactive.
  - **Fenmark Solutions Ltd** — the ERP consultancy already found in Round 1 (still the
    only *active*, clearly-operating collision).
  - **No collision found** in the private-journaling/privacy-app category specifically,
    on Apple App Store or Google Play (site-searched directly), or in the open-source
    namespace (GitHub/npm/GitLab) — the software-specific picture remains clean.
- **New finding, not previously surfaced — a literary/fantasy association**: "Fenmark"
  (spelled "Fenmarch" in the first published edition) is a real place name in Tolkien's
  *Lord of the Rings* legendarium — a marshy border region of Rohan. Tolkien himself
  preferred the "Fenmark" spelling and tried unsuccessfully to have later editions
  corrected to it. The name also appears, independently, in two unrelated fantasy
  settings (the *Inheritance* Cycle novels, and a tabletop setting called *The Eighth
  Realm*). None of this is a legal collision, but it means a bare "Fenmark" web search is
  dominated by Tolkien-wiki and fantasy-fandom results, which (a) dilutes search
  visibility for the actual product, and (b) hands the name an unintended
  medieval/fantasy connotation that sits oddly next to a calm, modern, security-forward
  brand tone.
- **Social handle**: `@fenmark` on Instagram belongs to an individual (Frans Enmark), not
  a business — minor friction for that exact handle, not a legal risk.
- **Formal trademark register**: still not directly queryable through the tools
  available in this exploration (USPTO TESS and Trademarkia both blocked automated
  fetches). This remains an open item, now with slightly higher expected likelihood of a
  hit given how many small businesses have independently landed on this name.

**Net effect**: Fenmark is still clean on the dimension that matters most (no journaling/
privacy-app competitor), but it is a more "already-used" name than the first pass
suggested, and it carries an unplanned-for literary association. This doesn't disqualify
it, but it does close some of the gap between Fenmark and its siblings from Round 4 — the
siblings (Fenmoor, Fenholt, Fenray, Wrenmark, Fendrick) have not yet had this same
deep-dive pass, so a direct cleanliness comparison isn't settled.

## Risks & Unknowns

- **Risk**: None of the six shortlisted names has a clean `.com`. Whichever is chosen
  will need either an alternate TLD (`.page` and `.md` both looked less squatted during
  this research — e.g. `palimpsest.page`, and Obsidian's real-world `obsidian.md`), a
  qualified two-word domain (`reticentjournal.com`), or a deliberate decoupling of brand
  name from domain (Notion → `notion.so`, Linear → `linear.app`). **Suggested
  investigation**: decide the domain strategy before locking the final name, since the
  choice of TLD/domain shape may itself change which of these six reads best.
- **Risk**: "Amble" and "Satchel"-style everyday words carry unverified residual
  collision risk outside the journal category (a UK schools app called Satchel was
  flagged but not fully investigated) that a quick web search may not fully surface.
  **Suggested investigation**: one more targeted check on the finalist before committing.
- **Gap**: None of these six have had a formal trademark-register search (USPTO TESS,
  EUIPO, etc.) — only web and app-store search coverage. That is a distinct, more
  rigorous check still needed before treating any name as settled.
- **Gap**: A wider set of ~24 other candidates were checked and eliminated during this
  exploration; the full list is kept in the appendix below so this search isn't
  accidentally repeated in a future session.

## Recommended Direction

- **Fenmark is still the lead recommendation** — best conceptual fit of the whole
  exploration ("the mark you leave in your own secluded space"), only a light,
  unrelated-industry collision, and confirmed-available `.io`/`.app` domains.
- It's no longer the *only* option with that profile: **Fenmoor**, **Fenholt**,
  **Fenray**, **Wrenmark**, and **Fendrick** all share the same clean-collision +
  available-`.io`/`.app` profile (Round 4). This gives a real fallback family if Fenmark
  hits a snag at the formal trademark-search stage, rather than having to restart the
  whole search from zero.
- If `.io`/`.app` is an acceptable domain shape (common for software, though it reads
  slightly more "dev-tool" than "consumer app"), this family resolves the domain problem
  this whole exploration ran into. If a `.com` is a hard requirement, no candidate found
  in this exploration clears that bar, and the domain-strategy question below becomes
  unavoidable.
- Runners-up on trademark cleanliness alone (all `.com`-only, all taken): **Reticent** and
  **Ward** — zero same-space or adjacent-space collisions found for either. **Amble** and
  **Meadow** are the warmest/most approachable if a softer tone is preferred over a
  security-forward one.
- Whatever is chosen, the domain question is now the binding constraint, not the name
  itself. Recommend resolving the TLD/domain strategy (alternate TLD vs. qualified domain
  vs. decoupled domain) before finalizing the name.

## Decision

- [x] User picks a direction from the shortlist — **decided 2026-09-20: Fenmark**
- [x] Resolve the domain strategy — **decided: `.app` (`fenmark.app`), decoupled from a
      `.com`, since no `.com` survived this entire exploration**
- [x] Purchase `fenmark.app` — done, 2026-09-20
- [ ] Run a formal trademark-register search (USPTO TESS / EUIPO) on "Fenmark" before
      treating the name as fully settled — still open; Round 5 found several
      unrelated-industry businesses already using the name, which raises (but does not
      confirm) the odds of a formal registration existing somewhere
- [ ] Feed "Fenmark" / `fenmark.app` into
      `docs/plans/2026-09-20-mini-diarium-display-name-rebrand-plan.md` Task 1.1 (the
      plan's own placeholder find-and-replace step)

## Appendix: Eliminated Candidates (for reference — do not re-propose without new information)

| Candidate | Why eliminated |
|---|---|
| Minidi | Not re-tested this round; carries the pre-existing risk of reading as a derivative of "Mini Diary" |
| Loam | Taken — existing AI journaling app on the App Store |
| Hollow | Soft collision — an existing journal app was formerly named "The Hollow Page" |
| Cloister | Held by a defunct academic-reference Mac app — low risk but not fully clean |
| Airgap | Heavy collision — well-known crypto self-custody brand (AirGap Wallet/Vault) |
| Sanctum | Severe collision — existing app with near-identical positioning ("encrypted on device... no server, we collect nothing") |
| Quire | Taken — funded project-management SaaS (`quire.io`) |
| Latch | Taken — smart-lock/building-access unicorn |
| Kept | Taken — multiple existing journal apps use this exact name |
| Stowe | Taken — funded fintech app |
| Privet | Taken — existing social app |
| Fathom | Domain taken; name used by multiple financial-SaaS companies |
| Wisp | Domain taken; name used by multiple apps (healthcare, HR/intranet) |
| Selkie | Domain taken; name used by data-recovery software |
| Cwtch | Severe collision — existing privacy/decentralized-messaging app, near-identical ethos |
| Apotheca | Domain taken; name used by pharmacy-management software |
| QuietPage | Severe collision — existing "privacy-focused journaling app with E2E encryption" |
| InkKeep | Domain taken by a tattoo-studio management app |
| Wardyn | Domain taken by a healthcare workplace-safety platform |
| Marrow | Domain taken multiple times over; `marrow.md` is a close-positioning "private home for your life" app |
| Loft | Domain taken by a major RealPage resident-experience platform |
| Palimpsest | Collision — existing local-first, offline writing software (`palimpsest.page`) |
| Furrow | Collision — a literary-journal brand and a gardening app with journal features |
| Verith | Collision — existing privacy-first health-data app, near-identical positioning language |
| Noema, Verya, Solvane, Faylo | Domain taken; each name already used by an unrelated small company |
| Satchel | Domain taken (`.com`/`.app`); unverified residual risk from a UK schools app of the same name |
