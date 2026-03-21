# Mini Diarium × Gingiris-Launch Playbook — Analysis & Adapted Roadmap

> **Purpose:** Evaluate applicability of the Gingiris-launch playbook (30× PH #1 Daily) to Mini Diarium and produce an actionable launch roadmap for an indie/solo context.
>
> **Date written:** 2026-03-20 | **App version at writing:** v0.4.9 (unreleased) / v0.4.8 latest stable

---

## 1. Playbook Summary

The **Gingiris-launch system** (authored by Iris, former COO of AFFiNE) is a structured 6-week Product Hunt preparation framework built from 30+ first-place PH launches. Its core claim: PH results are engineered, not lucky. The system covers:

- **Weeks 1–2:** ICP definition, narrative, website audit
- **Week 3:** Video production (30 s hero + 3 min demo), screenshot system
- **Week 4:** KOL (Key Opinion Leader) outreach and relationship-building
- **Week 5:** UGC (User-Generated Content) campaign, community seeding
- **Week 6:** The 24-hour PH battle plan (hunter selection, upvote push, comment engagement)

**Budget tiers in the playbook:** $10K (lean) · $25K (mid) · $50K (standard). These assume a funded startup with a marketing budget, design agency relationships, and a paid network of KOLs.

**Key prerequisite called out explicitly:** 500+ GitHub stars before launch, as PH evaluators and voters use GitHub activity as a credibility signal.

---

## 2. Mini Diarium Strengths (Playbook Alignment)

| Playbook requirement | Mini Diarium status |
|---|---|
| Open-source project | ✅ GitHub public repo (`fjrevoredo/mini-diarium`) |
| Clear differentiator | ✅ Local-first, zero-network, AES-256-GCM — rare in the journal space |
| Existing website | ✅ `mini-diarium.com` with SEO, demo video, GitHub link |
| Social presence | ✅ `@MiniDiarium` on X/Twitter |
| WinGet package | ✅ Reduces friction for Windows users discovering via CLI |
| Multi-platform | ✅ Windows, macOS, Linux builds |
| Strong feature set | ✅ Rich text + images, multiple journals, multiple entries/day, auto-lock, themes, import/export |
| Privacy narrative | ✅ No telemetry, no analytics, no network calls — baked into architecture |
| Compelling emotional hook | ✅ "Your journal that can't be subpoenaed, sold, or hacked by a breach" |

---

## 3. Gap Analysis

These are things the playbook requires that Mini Diarium currently lacks:

| Gap | Severity | Notes |
|---|---|---|
| GitHub stars below 500 | **High** | This is a hard prerequisite per the playbook. Check current count before setting a date. |
| No community channel | **High** | No Discord, Reddit community, or Telegram. The playbook relies heavily on pre-existing engaged users for the launch-day upvote push. |
| No KOL relationships | **High** | The playbook dedicates a full week to KOL outreach. Solo devs typically have zero existing relationships here. |
| No dedicated design resources | **Medium** | Professional PH screenshots and hero video require design time; doable solo but slower. |
| Budget gap | **Medium** | Even the "lean" $10K playbook tier is likely above a solo indie budget. Adapted lean budget is $0–$2K. |
| No UGC pipeline | **Medium** | UGC (user testimonials, social posts) requires existing active users willing to create content. |
| macOS + Linux marketing | **Low** | WinGet covers Windows; macOS/Linux distribution and discoverability are less developed. |
| No email list | **Low** | No newsletter or waitlist visible. The playbook uses email for launch-day activation. |

---

## 4. Playbook Phase Applicability Assessment

### Phase 1 — ICP Definition
**Applicability: High.** This is pure strategy work. Can be done for free and should be first.

### Phase 2 — Website Optimization
**Applicability: High.** `mini-diarium.com` exists but can be sharpened for conversion. Add social proof (star count widget, testimonials), a clear above-the-fold headline, and a stronger CTA.

### Phase 3 — Video Production
**Applicability: Medium.** A 30 s hero video and a 3 min demo are achievable solo. OBS + screen recording + simple narration covers 90% of the playbook's video goals. Skip the agency.

### Phase 4 — KOL Outreach
**Applicability: Low–Medium.** Traditional KOL outreach (tech YouTubers, newsletter writers) takes months of relationship-building. More realistic for Mini Diarium: target **privacy/security newsletters** (e.g. Privacy Guides community), **open-source communities** (Hacker News, lobste.rs), and journaling subreddits. These are organic relationships, not paid placements.

### Phase 5 — UGC Campaign
**Applicability: Low.** Requires an existing active user base. Replace with: focus on getting 10–20 real users to write honest reviews/posts before launch. Quality over quantity.

### Phase 6 — 24-Hour Battle Plan
**Applicability: Medium.** Core tactics (hunter selection, comment engagement, timing) apply directly. The "upvote network" tactics depend on community size — focus on authenticity.

---

## 5. Adapted 6-Week Launch Roadmap (Solo Indie Scale)

> **Before starting the clock:** Confirm GitHub stars ≥ 300 (minimum viable) or ≥ 500 (ideal). If below 300, prioritize star growth first via HN, Reddit r/selfhosted, and privacy forums.

### Week 1 — Strategy & Foundation

- [ ] Define ICP (see Section 6 below for draft)
- [ ] Write the emotional narrative (see Section 6)
- [ ] Audit `mini-diarium.com`: headline, CTA, social proof, download buttons
- [ ] Set up a simple email capture (Mailchimp free / Buttondown) for launch notification
- [ ] Decide launch date (Tuesday–Thursday land best on PH)
- [ ] Identify potential PH hunter (someone with PH credibility who can "hunt" the product)

### Week 2 — Website & Assets

- [ ] Rewrite homepage headline to lead with the privacy narrative
- [ ] Add GitHub star widget and download count (or OS badges) for social proof
- [ ] Prepare 3–5 PH screenshots (see Section 7 for spec)
- [ ] Draft PH tagline and description (250 words max, no jargon)
- [ ] Create a `CHANGELOG`-style "What's new" summary for PH description

### Week 3 — Video

- [ ] Record 30 s GIF/screen capture for PH hero image
- [ ] Record 3–5 min demo video: unlock → write → lock → re-open (the security story told visually)
- [ ] Upload to YouTube (unlisted) for embedding in PH page
- [ ] Optional: 60 s Twitter/X clip teaser

### Week 4 — Community Seeding

- [ ] Post to: r/selfhosted, r/privacy, r/journaling, r/opensource
- [ ] Submit to Hacker News "Show HN" (separate from launch — do this early for organic momentum)
- [ ] Submit to privacy-focused link aggregators: Privacy Guides forum, lobste.rs
- [ ] Reach out to 3–5 privacy/productivity newsletter authors with a personal note + free download
- [ ] Post on X/Twitter with a behind-the-scenes dev thread (builds authenticity)

### Week 5 — Pre-Launch Push

- [ ] Email the notification list: "Launching on [date] — help us by upvoting on PH"
- [ ] Collect 3–5 written testimonials from real users (even beta users)
- [ ] Add testimonials to website
- [ ] Confirm PH hunter is ready and has the product page drafted
- [ ] Test all download links, WinGet install, and website on mobile

### Week 6 / Launch Day — 24-Hour Battle Plan

- [ ] Product goes live at **12:01 AM PST** (PH day resets at midnight Pacific)
- [ ] Post announcement across all channels simultaneously (X, Reddit, HN comment, email)
- [ ] Respond to **every PH comment** within the hour — founders who engage win more votes
- [ ] Ask satisfied users in DMs to leave a comment (not just upvote — comments drive algorithm)
- [ ] Post updates during the day ("We hit X upvotes — here's what's next")
- [ ] Thank supporters publicly throughout the day

---

## 6. ICP & Narrative

### Ideal Customer Profile

**Primary ICP — The Privacy-Conscious Knowledge Worker**
- 25–45 years old, tech-literate but not necessarily a developer
- Uses tools like Obsidian, Notion, or Bear and has concerns about cloud sync
- Reads privacy-focused content (Privacy Guides, EFF, Hacker News)
- Keeps a personal journal for reflection, mental health, or professional notes
- Has experienced or fears cloud service data breaches or business closures
- Values open-source software as a trust signal

**Secondary ICP — The Developer/Privacy Enthusiast**
- Technically sophisticated, evaluates tools critically
- Contributes to or follows open-source projects
- May recommend tools to non-technical friends/family

### Emotional Narrative

> "Every major journal app stores your most private thoughts on someone else's server. Notion can read your entries. Day One has had breaches. Obsidian Sync is another cloud. **Mini Diarium stores your journal on your own device — encrypted, always. Not even we can read it.** Free. Open source. No accounts. Your words belong to you."

**PH tagline options:**
1. "Your journal that no cloud can touch"
2. "End-to-end encrypted journaling — zero servers, zero accounts"
3. "The journal app that cannot spy on you"
4. "Local-first journaling with military-grade encryption"

---

## 7. PH Page Requirements

### Screenshots (3–5 required, 1270×952 px or 1600×1200 px)

| # | Scene | Key message |
|---|---|---|
| 1 | Editor with a formatted entry (rich text visible) | "Beautiful writing experience" |
| 2 | Password unlock screen with journal name | "Encrypted at rest — opens with your password" |
| 3 | Calendar view with multiple entry dots | "Navigate your past — every day, searchable" |
| 4 | Multiple journals list (Journal Picker) | "Separate journals for work, personal, private" |
| 5 | Dark mode + light mode split (or theme switcher) | "Yours to customize" |

### Video (optional but strongly recommended)

- **Format:** MP4, under 5 min, 1080p
- **Flow:** Cold open (privacy hook) → unlock demo → write an entry with formatting → lock → re-unlock → import from another app → "It stays on your machine. Always."
- **No music needed** — narration over screen recording works well for privacy tools

### PH Description Structure

```
Hook (1–2 sentences): The privacy problem
↓
What Mini Diarium is (1 sentence)
↓
3 bullet points: top features
↓
Who it's for (1 sentence)
↓
Why open source matters (1 sentence)
↓
CTA: Download free at mini-diarium.com
```

---

## 8. Channel Strategy (Solo Dev Focus)

**High ROI channels for Mini Diarium specifically:**

| Channel | Why it works | Tactic |
|---|---|---|
| r/selfhosted | Audience actively seeks local-first apps | Show HN-style post: "I built an encrypted local journal" |
| r/privacy | Audience cares about data sovereignty | Focus on the "no cloud" angle |
| Hacker News Show HN | High-credibility signal; can drive stars | Post early in the week morning (ET); engage every comment |
| lobste.rs | Curated tech community, privacy-aware | Submit with honest framing |
| Privacy Guides community | Directly relevant audience | Participate genuinely before promoting |
| r/journaling | Core use case audience | Softer sell: "I made a private journal app" |
| X/Twitter | Existing @MiniDiarium account | Dev threads + privacy takes + feature showcases |

**Lower ROI for solo indie (skip or deprioritize):**
- Paid KOL sponsorships
- Instagram/TikTok (too visual/entertainment-focused for this tool)
- Product newsletters with large paid fees
- Press outreach (tech media rarely covers indie tools without a funding angle)

---

## 9. Budget Estimate ($0–$2K Range)

| Item | Playbook tier | Indie estimate | Notes |
|---|---|---|---|
| Video production | $3K–$10K | $0 | OBS + Kdenlive or CapCut; narration by founder |
| Design (screenshots) | $2K–$5K | $0–$200 | Figma free tier; or hire one Fiverr pass at ~$100–200 |
| KOL/newsletter sponsorships | $2K–$15K | $0 | Replaced by organic outreach |
| PH hunter gift | $0–$500 | $0 | Choose a genuine community member, not paid |
| Email tooling | $0–$200/yr | $0 | Mailchimp or Buttondown free tiers |
| Domain/hosting | Already active | $0 | Already paying for mini-diarium.com |
| **Total** | **$10K–$50K** | **$0–$400** | |

---

## 10. Go/No-Go Checklist

Run through this checklist before committing to a launch date:

### Prerequisites (must have)
- [ ] GitHub stars ≥ 300 (minimum) / ≥ 500 (recommended)
- [ ] Download count growing month-over-month (any positive trend is fine)
- [ ] Website is live and loads cleanly on mobile
- [ ] At least one download link works for each platform (Windows, macOS, Linux)
- [ ] PH hunter identified and confirmed
- [ ] PH page draft reviewed and approved by hunter

### Nice to have
- [ ] 10+ real users willing to upvote and comment on launch day
- [ ] Email notification list (even 50 subscribers who opted in)
- [ ] Video demo recorded and uploaded
- [ ] At least 1 organic write-up or mention from an external source
- [ ] Show HN post completed at least 2 weeks before PH launch

### Hard stops (do not launch if)
- GitHub repo is under 100 stars — not enough social proof
- Any known critical bugs on any platform
- Download links are broken or installer is flagged by antivirus without resolution
- No hunter confirmed

---

## 11. Realistic Outcome Expectations

The Gingiris playbook is optimized for funded startups with 10K+ GitHub stars, existing communities, and marketing budgets. At Mini Diarium's current scale, a realistic PH launch outcome is:

- **Best case:** #1–5 in "Privacy" or "Productivity" category for the day; 200–500 upvotes; meaningful HN cross-post traffic; +100–300 GitHub stars in the week of launch
- **Likely case:** Top 10 for the day in category; 100–200 upvotes; +50–100 stars; handful of new regular users
- **Launch is still worth it** regardless of ranking — it creates a permanent PH page, generates backlinks to the website, and establishes a public milestone to reference in future content

The most important outcome is **momentum**: a PH launch gives you a "we launched" story to tell in every subsequent post, README, and outreach message.

---

*This document is a living guide — revisit and update as the launch date approaches and circumstances change.*
