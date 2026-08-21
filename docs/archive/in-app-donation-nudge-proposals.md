# Exploration Output: In-App Donation / Support Nudge

> Artifact type: [x] Proposal — three proposed approaches (description only, no code)
>
> This artifact contains NO implementation code. Only prose, tables, and references.
> Implementation happens in a different mode.

## Context

- **Why this exploration started**: The maintainer wants users to know Mini Diarium can be
  supported financially. Today the only donation surface is
  [`mini-diarium.com/donate/`](https://mini-diarium.com/donate/) and `DONATE.md` on GitHub —
  both are things a user has to already know to go looking for. Most users never visit the
  GitHub repo, so awareness of the donate page is effectively zero. The ask: explore how to
  raise that awareness inside the app itself, without becoming annoying, and to also surface
  non-monetary ways to help (reviews, sharing, code contributions, the newsletter).
- **Date**: 2026-08-21
- **Sources consulted**: `src/components/overlays/AboutOverlay.tsx`,
  `src/components/overlays/NotificationsOverlay.tsx`, `src/state/notifications.ts`,
  `src/state/onboarding.ts`, `PHILOSOPHY.md`, `DONATE.md`, `website/donate/index.html`,
  `website/newsletter/index.html`, `.agents/skills/runbooks/skills/pre-release/assets/notification.template.json`,
  `docs/decisions/2026-05-settings-storage-taxonomy.md` (indirectly, via `src/CLAUDE.md`
  gotcha #7), and web research on how comparable single-maintainer / donation-funded FOSS
  projects (Joplin, Fossify, AntennaPod, Standard Notes, qBittorrent) handle this — see
  Findings below for direct quotes and links.
- **Session 2 additions (2026-08-21, same day, continued exploration)**: user asked to
  develop Proposal 3 further (or replace it with something new), and separately asked for
  a purpose-built, conversion-researched "Project Support" destination overlay. Additional
  sources: `src-tauri/src/commands/stats.rs` (`get_statistics`/`calculate_best_streak`),
  `src-tauri/CLAUDE.md` Gotcha #4 (import behavior), and web research on Cialdini's
  principles of persuasion, Wikimedia fundraising-banner A/B testing, and nonprofit
  donation-page friction reduction — see Findings 8–11 and Detailed Proposals 4–5 below.

## Findings

**1. The app already has zero in-app donation awareness.** `AboutOverlay.tsx` links only to
GitHub and the docs site (`src/components/overlays/AboutOverlay.tsx:79-91`). Nothing else in
`src/` mentions "donate," "sponsor," or the newsletter.

**2. "No network access" is a hard constraint, and it shapes what a nudge can even do.**
`PHILOSOPHY.md` (line 165): *"Mini Diarium never initiates any network connection... When you
click a help or documentation link (About screen, Onboarding), the OS opener hands the URL to
your system browser; Mini Diarium makes no network call itself."* Any donate nudge must follow
this same pattern — a button that calls `openUrl()` (`@tauri-apps/plugin-opener`) to hand off
to the system browser, never an embedded widget, iframe, or live-fetched content from
Ko-fi/Buttondown/etc. This is already how the GitHub/Docs buttons in `AboutOverlay.tsx` work,
so it's a well-established precedent, not a new pattern.

**3. There is already a non-intrusive, opt-in announcement channel built for exactly this
kind of message.** `src/state/notifications.ts` + `NotificationsOverlay.tsx` implement a bell
icon (in `Header.tsx`) with an unread-count badge, backed by a **static, locally-bundled**
`public/notifications.json` (fetched from the app's own bundle, not an external server — see
`scripts/check-no-network.ps1`, which greps for exactly this file). It already has a `type:
'tip'` entry kind (alongside `'release'` and `'announcement'`), each with an optional
`linkUrl`/`linkLabel` that opens via `openUrl()`. The pre-release runbook
(`.agents/skills/runbooks/skills/pre-release/assets/notification.template.json`) shows this
file is edited by hand once per release. This means the *mechanism* for a low-pressure,
dismissible, click-to-view nudge already exists and ships today — no new UI component would be
required to use it for a support message.

**4. There is a proven "shown once, dismiss forever" pattern already in the codebase.**
`src/state/onboarding.ts` uses a per-journal `localStorage` key
(`onboarding-shown-${journalId}`) to show the onboarding tour exactly once, with an explicit
`replayOnboarding()` escape hatch reachable from `AboutOverlay.tsx`. Any milestone-triggered
nudge would follow the same shape.

**5. Real-world precedent strongly favors low-frequency, easily-dismissed, non-modal asks.**
- **Joplin** (encrypted, MIT-licensed note app — closest comparable to Mini Diarium): a 2025
  forum proposal to add donation popups was shot down by the *user community itself*. One
  commenter: *"the best way to piss off the user base,"* and noted a "non-intrusive popup" is
  a contradiction in terms. ([Joplin Donation and Support Campaign 2025 thread](https://discourse.joplinapp.org/t/joplin-donation-and-support-campaign-2025-to-boost-development/43273))
  No popup campaign has been implemented. This is a direct signal from users of a very similar
  app: modal donation popups generate backlash, not goodwill.
- **Fossify** (FOSS Android app suite, fork of Simple Mobile Tools, ad-free/tracker-free by
  design): uses periodic donation *dialogs* rather than a persistent banner, funded also via
  Open Collective monthly contributions — i.e., even projects that do interrupt keep it
  infrequent and time-boxed, not a persistent nag.
- **AntennaPod** (volunteer-run, no commercial interest): deliberately avoids in-app donation
  banners; it links out to Open Collective from a "Contribute" page instead. Its own
  documentation states donations already cover its costs — it treats asking as optional, not
  necessary.
- **Standard Notes** (encrypted notes app, MIT core): keeps the ask on a dedicated `/donate`
  page and GitHub Sponsors, not as an in-app interruption; the app itself stays "simple,
  easy to use, and lightweight" by design.
- **The mobile "ask for a review" literature** (Apple/Google review-prompt guidelines, widely
  documented in app-marketing guides) converges on a specific, transferable pattern: gate the
  prompt on a genuine "win" event (not app launch), enforce a cooldown and a lifetime cap,
  make dismissal a single tap, and never show it again once dismissed. This is the most
  rigorously tested version of "compelled, not forced" available, and it maps directly onto a
  usage-milestone donate nudge.
- **qBittorrent**, by contrast, is the commonly-cited *negative* example — a modal-on-launch
  donation nag that recurs — and is a useful cautionary reference for what "too much" looks
  like even though it wasn't possible to confirm forum-level detail on its current cadence.

**6. Mini Diarium already has a settled tone for money-asks.** `website/donate/index.html`
and `DONATE.md` are notably low-pressure: *"Every option below is optional, and nothing in the
app changes either way,"* and *"Donations are gifts, not purchases... no obligation in either
direction."* Whatever in-app nudge is built should match this voice — an offer, not a request
with implied consequences.

**7. Non-monetary alternatives already have concrete homes to link to**: GitHub (star/PR),
the Ko-fi/crypto donate page, the Microsoft Store listing (the one storefront among Mini
Diarium's distribution channels — GitHub Releases, WinGet, Homebrew, Flathub, Microsoft Store
— that actually supports user ratings/reviews), X/social sharing, and the Buttondown
newsletter (`website/newsletter/index.html`, embeddable subscribe form, double opt-in). A
nudge doesn't need to invent any of these destinations, only surface them.

**8. A streak/count statistics engine already exists and is exactly the trigger signal
Proposal 3 needed.** `get_statistics()` (`src-tauri/src/commands/stats.rs`) already computes
`current_streak`, `best_streak`, `total_entries`, and `total_words` — tested, shipped, and
displayed today in `StatsOverlay.tsx`. A milestone trigger built on `current_streak` needs no
new backend logic, only a frontend comparison against a stored "highest streak milestone
already shown" value, mirroring the existing `onboarding-shown-${journalId}` pattern in
`src/state/onboarding.ts`.

**9. Raw entry-count is a broken milestone trigger — the codebase shows why.**
`src-tauri/CLAUDE.md` Gotcha #4: *"Import behavior (no merge): Parsers in `import/*.rs`
return `Vec<DiaryEntry>`. Imports always create new entries; there is no date-conflict
merging."* A user importing years of entries from Day One or another app hits "Nth entry
saved" the instant the import finishes — the worst possible moment for a support nudge, since
it fires on bulk data migration, not on demonstrated day-to-day usage. `current_streak` is
immune to this: it can only advance one real calendar day at a time, so it cannot be
triggered by import volume.

**10. Neuromarketing / conversion research maps onto this app's constraints in a specific
and asymmetric way.** Researched [Cialdini's principles of persuasion applied to online
platforms](https://www.gaiadigital.nl/en/7-principles-of-persuasion-applied-to-online-platforms/),
[donation-page persuasion-principle case studies](https://medium.com/weareevermore/create-a-successful-donation-page-using-the-6-principles-of-persuasion-3b60b5b0aa5b),
[Wikimedia's own fundraising-banner A/B testing history](https://diff.wikimedia.org/2013/04/08/intro-to-the-statistics-of-ab-testing-with-wikimedia-fundraising-banners/),
and nonprofit donation-page friction-reduction literature
([1](https://somedoing.com/how-to-remove-friction-from-your-donation-page/),
[2](https://www.nextafter.com/blog/donation-pages/)). Key transferable findings:
   - **Reciprocity is the strongest lever available**, and uniquely so here: the app can
     honestly show the user their own real usage data ("You've written 12,000 words across
     30 entries") before any ask, at zero cost and with no telemetry required — it's already
     local data via `get_statistics()`.
   - **Commitment/consistency (foot-in-the-door)**: ordering asks from lowest to highest
     friction increases completion of the harder ask that follows — this is the literal
     mechanism behind "donate + leave a review," not a copy trick.
   - **Wikimedia's own testing** found that over 75% of donors convert on the first or
     second banner they ever see, response *declines* with repeated exposure, plain/simple
     designs outperform flashy ones, and a personal founder photo produced the largest single
     lift they measured — all of which argue for a rare, simple, personally-voiced surface
     rather than a recurring or heavily designed one.
   - **Social proof and scarcity/urgency do not transfer honestly to this app.** Mini
     Diarium has no telemetry, so any donor count or "X people supported this" figure would
     have to be a hand-maintained static number — stale the moment it's wrong, and
     effectively fabricated social proof. Scarcity/urgency (countdown timers, limited-time
     framing) has no real referent here at all. Both were excluded from the design rather
     than faked.
   - Nonprofit donation-page research also confirms **friction reduction** (single view, no
     multi-step forms, one click per action) as the dominant lever behind conversion — which
     matches this app's existing `openUrl()`-only pattern; no new payment UI is needed inside
     the app itself.

**11. `DONATE.md` already has the exact voice a "liking/authority" appeal needs.** It is
personal, plain, and accountable — *"If it is useful to you and you want to chip in, here are
the ways... nothing in the app changes either way"* and a "Where it goes" section naming what
the money funds. The in-app overlay should reuse this voice rather than invent new marketing
copy.

**12. `best_streak` (not `current_streak`) is the habit-science-aligned metric — but it has
its own, worse import loophole.** [Lally et al. 2010](https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally),
the study behind the popular "66 days to form a habit" figure, found *"a missed opportunity
reduced automaticity by less than half a point, and scores recovered quickly."* Gating on
`current_streak` (which resets to zero on one missed day) punishes a normal lapse and could
permanently deny a milestone the user has genuinely earned; `best_streak` doesn't reset, so it
matches this finding better. But `best_streak` is *more* exploitable by import than raw count
(Finding 9): a real 200-day daily-journal history imported from another app instantly produces
`best_streak = 200` in Mini Diarium, despite zero real attachment to *this app* yet. The fix
is a wall-clock signal independent of what the imported entries' `date` values claim: record
`first-seen-${journalId}` in `localStorage` the first time a journal is opened (same cost as
the existing `onboarding-shown-${journalId}` flag), and require real elapsed time since then
to also clear each rung — not the streak value alone.

**13. Lally et al.'s 66-day average is a genuinely evidence-based middle rung.** The study
measured *average* time-to-automaticity at 66 days (range 18–254 — high variance, per Dr.
Lally's own caveat) — a real number to anchor "you've built a habit" copy to, rather than a
round 30 or 100 chosen only for being round.

**14. Routing the milestone signal through the Stats overflow-menu item under-reaches, and
`Header.tsx` already shows what better reach looks like.** The user flagged (2026-08-21) that
most people may never open Statistics at all, making a dot on that menu item easy to miss —
undermining the whole point of building a milestone trigger. `src/components/layout/Header.tsx`
shows the app's actual main-window chrome: search, day navigation, timeline toggle, About
(`Info`), **Notifications (`Bell`, with an always-visible unread-count badge —
`hasUnread()`/`unreadCount()`)**, Lock, and the `⋮` overflow menu — all rendered directly in
the persistent header bar, not buried behind a menu click. Two real options were weighed:
reuse the already-proven bell/badge mechanism (zero new UI, but re-mixes milestone content
with the release-news channel Proposal 2 deliberately kept "reserved" to avoid diluting), or
add a small dedicated icon that only mounts into the header when a milestone is actually
pending. **Decided (2026-08-21): a dedicated icon** — it keeps notification semantics
untouched, and because it is conditionally rendered (`<Show when={hasPendingMilestone()}>`,
the same pattern already used for `toggle-sidebar-button`), it adds *zero* permanent chrome to
an already-busy header row — it only exists at all when there's something to show.

## Options Compared

| Option | How it works | Pros | Cons |
|---|---|---|---|
| A — Always-there baseline | Permanent "Support Mini Diarium" section added to `AboutOverlay.tsx` (and optionally a one-line footer/menu link) | Zero interruption risk; trivial to build; matches existing `openUrl()` pattern | Very low reach — most users never open About; on its own, fails the "not too little" bar |
| B — Bell "tip" notification | Reuse the existing `notifications.json` `'tip'` entry type; ship a support message occasionally, bundled at release time | No new UI/engineering; fully maintainer-paced via the release checklist; inherently non-modal (a small dot, not a popup) | Shares a channel with real release news — repeating it risks diluting that channel's credibility; not personalized to actual usage; easy to forget or overdo without a rule |
| C — One-time milestone banner | New inline (non-modal) banner shown once, triggered by a genuine usage milestone (e.g., Nth entry saved), dismiss-forever via a `localStorage` flag mirroring `onboarding-shown-${id}` | Reaches every real user, not just About-openers; fires at the moment goodwill is highest (proven "review-prompt" pattern); single well-designed spot for the full list of monetary + non-monetary asks | Requires new runtime code and a milestone-design decision; another `localStorage` key to track in reset/export flows (`src/CLAUDE.md` gotcha #7); wrong milestone choice or on-screen placement risks interrupting the writing flow of a journaling app — **and its "Nth entry" trigger is import-gameable, see Finding 9** |
| D — Streak-anchored trigger + dedicated header icon (supersedes C) | Reuse `get_statistics().best_streak`, gated by real elapsed journal age; on crossing 7/66/365-day rungs, a small dedicated icon (not the Stats menu, not the bell) mounts into `Header.tsx`'s persistent chrome, visible only while a milestone is pending | Import-proof (streaks require real distinct days, and the wall-clock gate closes the best_streak-import loophole too); genuinely main-window visible — the header is on screen the whole time the user is journaling — without overlaying the editor or requiring a menu click to discover; multiple rungs avoid a single dismiss-forever ceiling; adds zero permanent chrome (conditionally rendered) | New: the milestone-comparison logic, the icon component and its conditional mount, plus a new header icon for the user to learn (distinct from Info/Bell/Lock) |
| E — Project Support overlay (destination, supersedes A) | A single new overlay (`ProjectSupportOverlay`) that both the About/Preferences link (A) and the Option D header icon route into directly; ascending-friction checklist (star → review → share → newsletter → contribute → donate) with self-tap "I did this" checkmarks, opening line personalized by entry point | One well-designed, conversion-researched surface instead of a flat equal-weight list; ask-stacking (foot-in-the-door) makes multi-action completion (e.g. review + donate) more likely than parallel equal-weight buttons; reciprocity hook (real usage stats) for the Option D entry point costs nothing and needs no telemetry | Departs from the original "no option emphasized" equal-weighting — ordering is now by friction, not alphabetical; new overlay component and self-tap checklist state to build and to add to the reset/export audit |

## Detailed Proposals

### Proposal 1 — Always-There Baseline (About + Preferences)

**What it is.** Add a permanent "Support Mini Diarium" section to `AboutOverlay.tsx`, below
the existing GitHub/Docs buttons, listing every way to help — in one place, equal weight, no
single option emphasized over the others:

- Donate (opens `mini-diarium.com/donate/`)
- Star the repo on GitHub
- Leave a review (Microsoft Store — the one channel that supports ratings)
- Share with a friend
- Contribute code / translations (GitHub)
- Subscribe to the newsletter (opens `mini-diarium.com/newsletter/`)

Optionally also add a small, single-line "Support this project" link somewhere persistent but
quiet — e.g., in Preferences → General, near the version number — so it's reachable without
opening About specifically.

**Pros**
- Essentially zero risk of feeling pushy: the user has to go looking for it.
- Cheapest to build and maintain; reuses the exact `openUrl()` button pattern already in
  `AboutOverlay.tsx`.
- No state, no timing logic, no `localStorage` key, nothing to get wrong.
- Sets a consistent, calm tone (matches `DONATE.md`'s "optional, no obligation" voice) that any
  other nudge should also follow.

**Cons**
- Visibility is the whole ask here, and this option has almost none. Users who never open
  About (the vast majority, in most apps) will never see it. On its own this does not meet the
  "not too little" bar the user set — it under-corrects for the actual problem (nobody knows
  GitHub/donations exist).
- A Preferences-only mention is even lower-traffic than About, since Preferences is opened
  even less often by casual users.

### Proposal 2 — Periodic Bell "Tip" Notification (reuse existing infra)

**What it is.** Use the notification-bell system that already exists
(`src/state/notifications.ts`, `NotificationsOverlay.tsx`, backed by the bundled
`public/notifications.json`) exactly as designed: add an occasional `type: 'tip'` entry
alongside the release notes the maintainer already writes per the pre-release runbook. Cadence
would be maintainer-controlled — e.g., no more than once or twice a year, ideally tied to a
release or a milestone worth mentioning (a birthday of the project, a big feature, a "year in
review"), rotating which specific ask it leads with (this release: donate; next time: leave a
review; next time: the newsletter).

Because the mechanism already exists and is already reviewed by
`scripts/check-no-network.ps1` as a local, bundled file (not a live fetch), this requires **no
new UI, no new state, no new IPC surface** — only content authored at release time.

**Pros**
- Nearly free to build: the entire delivery pipeline (bell icon, unread dot, panel, dismiss,
  mark-as-read, `openUrl()` link) is already shipped and tested.
- Inherently low-pressure by construction: it's a small unread dot on a bell icon a user
  chooses to click, not a modal — structurally the opposite of what Joplin's community
  rejected.
- Fully within the maintainer's existing release workflow — no separate "campaign"
  infrastructure to manage, just one more line in a JSON file already touched every release.
- Sits next to genuinely useful content (what's new in this release), so it reads as "one more
  thing worth knowing" rather than a dedicated money-ask moment.

**Cons**
- Repetition dilutes trust in the channel: if "check the bell" starts meaning "there might be
  another donate pitch," users may start ignoring the bell altogether, including for real
  release news — the exact failure mode the Joplin community warned about, just moved to a
  different surface.
- Not personalized — a user who installed the app five minutes ago sees the same message as
  someone who has journaled daily for two years. Timing isn't tied to demonstrated attachment
  to the app.
- Discipline-dependent: nothing in the code enforces a sane cadence; it relies on the
  maintainer remembering not to overdo it release after release.
- Users who dismiss notifications quickly, or who mute/ignore the bell out of habit, may never
  actually read it — reach is better than Proposal 1 but still not universal.

### Proposal 3 — One-Time Milestone Banner (usage-triggered, dismiss-forever)

**What it is.** A small, inline, non-modal banner (not a dialog blocking the editor — think a
dismissible strip near the top of the entry view, or a one-time addition to the existing
onboarding-style overlay pattern) that appears **exactly once**, triggered by a genuine sign of
real usage — for example, after the user's 30th saved entry, or some similar count-based
signal that indicates the app has become part of their routine (deliberately *not* a calendar
timer like "7 days after install," since elapsed time doesn't prove engagement the way saved
entries do). Once shown and dismissed, a `localStorage` flag (mirroring the existing
`onboarding-shown-${journalId}` pattern in `src/state/onboarding.ts`) suppresses it forever for
that journal — no snooze, no re-ask, no escalation.

Content mirrors Proposal 1's full list (donate, star, review, share, contribute, newsletter)
but framed as a single warm sentence — "Enjoying Mini Diarium? Here are a few ways to support
it" — with the options as equally-weighted links, not a single highlighted "Donate" button.

**Pros**
- Reaches essentially every real user, not just the minority who open About — this is the only
  one of the three that actually solves the "most users don't even know GitHub exists"
  problem the user described.
- Timing is the single highest-leverage lever available (per the Apple/Google review-prompt
  literature): asking right after a demonstrated moment of value, once, with permanent
  dismissal, is the most rigorously validated way to be "compelled, not forced." It converts a
  generic interruption into something closer to "you clearly like this — here's how to help,"
  which is a fundamentally different feeling than an unprompted popup.
- One well-designed surface can carry the entire non-monetary menu the user asked for
  (reviews, sharing, contributing, newsletter) without needing five separate touchpoints.
- Fires once, ever, per journal — structurally incapable of becoming a recurring nag, which
  directly avoids the qBittorrent/Joplin-popup failure mode.

**Cons**
- The only option that requires real new engineering: a milestone-detection hook, a new
  dismissible banner component, a new `localStorage` key that must be added to the settings
  taxonomy (`docs/decisions/2026-05-settings-storage-taxonomy.md`) and to the reset/export
  audit in `src/CLAUDE.md` gotcha #7 — more surface area, more to test, more that can regress.
- Getting the milestone wrong undermines the whole premise: too early (e.g., 3rd entry) and it
  reads as presumptuous; too late (e.g., 500th entry) and most users who would have donated
  already left or never see it.
- Placement risk is specific to a journaling app: an entry-count trigger could theoretically
  fire in the same session as writing something emotionally heavy. The banner must be
  visually calm, easy to ignore, and never modal, to avoid feeling tone-deaf at a bad moment —
  this is a real design constraint, not just a nice-to-have.
- A single "shown once" banner has a hard ceiling on reach: someone who dismisses it (even by
  accident, or because they were mid-thought when it appeared) never sees it again, with no
  built-in way to reach them a second time short of a future app update changing the trigger.

### Proposal 4 — Streak-Anchored Trigger, Dot-Invited (supersedes Proposal 3)

**What it is.** Replace Proposal 3's "Nth entry saved" trigger with `best_streak` from the
already-shipped `get_statistics()` command — not `current_streak` (Finding 12: a single missed
day shouldn't erase earned progress). Each rung requires **both** a `best_streak` threshold
**and** real elapsed wall-clock time since the journal was first opened in Mini Diarium
(`first-seen-${journalId}` in `localStorage`), which closes `best_streak`'s own import loophole
(Finding 12 — an imported historical streak from another app must not fire the ask on day one
of real use here). Revised default rungs, grounded in Finding 13's habit-formation research
rather than round numbers:

| Rung | Trigger | Frame |
|---|---|---|
| 1 | `best_streak ≥ 7` and journal age ≥ 7 days | early positive signal |
| 2 | `best_streak ≥ 66` and journal age ≥ 66 days | **primary ask** — Lally et al.'s average time-to-automaticity, i.e. the actual habit-formed moment |
| 3 | `best_streak ≥ 365` and journal age ≥ 365 days | anniversary/loyalty — different tone from rungs 1–2 |

On crossing a rung, a `Heart` icon (lucide-solid — the same icon family as every other Header
glyph) mounts into `Header.tsx`'s persistent chrome (see Finding 14) — conditionally rendered,
so it adds no chrome at all until there's something to show, the same `<Show>` pattern already
used for `toggle-sidebar-button`. It sits at the **end of the left-hand icon group** (after
`header-next-day-button`), deliberately not among the five icons already in the right-hand
group (timeline toggle, About, Notifications, Lock, `⋮` overflow) — `Header.tsx`'s
`justify-between` layout leaves open space between the two groups, so a lone icon at the end
of the left group reads as its own thing near the header's visual middle instead of blending
into an already-busy row:

```
┌────────────────────────────────────────────────────────────────┐
│ [≡] [search] [◀] Tuesday, ... [▶]   ♥        [▤][ⓘ][🔔][🔒][⋮] │
│  └── left group, ends here ──┘  └ new,   └── right group ──┘   │
│                               conditional                       │
└────────────────────────────────────────────────────────────────┘
```

Clicking it opens
the Project Support overlay (Proposal 5) directly, with the personalized reciprocity line for
whichever rung is currently pending. If a later rung fires while an earlier one was never
clicked, the icon simply reflects the newest pending rung — one indicator, never two, no
stacking notifications. Milestone state is tracked per journal via a `localStorage` key such
as `support-milestone-shown-${journalId}`, mirroring `onboarding-shown-${journalId}`.

```
   entry saved, new day begun
              │
              ▼
   recompute best_streak (cheap — reuse
   get_statistics(), call once per real day,
   not per keystroke)
              │
   crossed a new rung (best_streak AND
   journal-age both clear 7 / 66 / 365)?
   compare vs. localStorage highest-shown
              │
      yes ────┴──── no
       │              │
       ▼              ▼
   dedicated icon   nothing — silent,
   mounts into      no UI at all
   Header.tsx
   (main window,
   always visible
   while journaling)
       │
   user clicks the icon (their own
   choice — icon never pops up over
   the editor, never steals focus)
       │
       ▼
   Project Support overlay (Proposal 5)
   opens directly, with a personalized
   reciprocity line for the pending rung
       │
   icon unmounts; localStorage rung
   updated; next rung still available
   later, reusing the same icon
```

**Pros**
- Import-proof: a streak can only advance one real calendar day at a time, and the wall-clock
  journal-age gate closes `best_streak`'s own import loophole too (Finding 12) — cannot be
  triggered by bulk data migration the way an entry-count trigger can (Finding 9).
- Never overlays the editor — the icon sits quietly in the persistent header chrome and the
  ask only ever opens on a deliberate click, which is the closest of any option considered to
  what the Joplin community said they would actually accept (Finding 5): pulled, not pushed.
- Genuinely main-window visible (Finding 14) — the header is on screen the entire time the
  user is journaling, unlike a dot buried behind the Statistics menu item, which the user
  correctly flagged as easy to never see.
- Multiple rungs mean missing one milestone doesn't close the door forever, unlike Proposal
  3's single dismiss-forever banner.
- The icon is conditionally rendered, so it adds zero permanent chrome — it doesn't exist at
  all until a milestone is pending.

**Cons**
- Requires new logic: the rung-comparison (dual-gated on `best_streak` *and*
  `first-seen-${journalId}` wall-clock age), the icon component and its conditional mount into
  `Header.tsx`, and two new `localStorage` keys to add to the settings taxonomy and the
  reset/export audit (`src/CLAUDE.md` gotcha #7).
- The primary rung (66 days) is now evidence-grounded (Finding 13), but rungs 1 and 3 (7 and
  365 days) are still round-number judgment calls — the app collects no telemetry, so there's
  no usage-distribution data to validate them against beyond the habit-formation literature.
- Introduces a new icon the user has to learn to recognize, distinct from the existing
  Info/Bell/Lock row — a small addition to the app's visual vocabulary, mitigated by the fact
  that it's rare enough (at most 3 times ever) to not need to become "familiar" the way Search
  or Lock do.

### Proposal 5 — Project Support Overlay (destination, supersedes Proposal 1)

**What it is.** A single new overlay, `ProjectSupportOverlay`, that both the About/Preferences
"Support Mini Diarium" link (Proposal 1's entry point) and Proposal 4's dedicated header icon
route into directly.
Rather than a flat, equal-weight list, it is a conversion-researched, single-screen
(no multi-step) checklist ordered by **ascending friction** — low-effort actions first, so
completing one increases the likelihood of continuing to the next (Finding 10,
commitment/consistency):

1. ⭐ Star on GitHub — one click, `openUrl()`
2. 📝 Leave a review (Microsoft Store — the one storefront in the distribution list with
   ratings) — one click
3. 🔗 Share with a friend — one click, copies a pre-written share message to the clipboard
   as-is (no inline editing — decided 2026-08-21 to keep this a true one-click action)
4. ✉️ Subscribe to the newsletter — one click
5. 💻 Contribute code / translate — one click to GitHub
6. 💛 Donate (Ko-fi / crypto, per `DONATE.md`) — one click, kept **last** in the ordering
   (decided 2026-08-21: ascending-friction order wins over leading with Donate, to avoid the
   page reading as a money-first funnel and to use the foot-in-the-door effect as intended)

Each row has a self-tap "I did this ✓" toggle — not tracked, not verified anywhere, a purely
local `localStorage` checkmark for the user's own sense of completion. The opening line is the
only content that differs by entry point:

- From Proposal 1 (About/Preferences, cold visitor): *"Enjoying Mini Diarium? Here's how to
  help."*
- From Proposal 4 (header icon, warm visitor): a reciprocity line built from the user's own
  real stats, e.g. *"66-day streak — you've written 14,200 words. That's a real habit. A few
  ways to give back:"*

**Layout sketch:**

```
┌───────────────────────────────────────────────────────────┐
│  Support Mini Diarium                                  [×] │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  🔥 66-day streak — you've written 14,200 words.            │
│  That's a real habit. A few ways to give back:              │
│                                                             │
│  ☐ ⭐ Star the project on GitHub             [ Star ]       │
│  ☐ 📝 Leave a review on Microsoft Store    [ Review ]       │
│  ☐ 🔗 Share with a friend            [ Copy message ]       │
│  ☐ ✉️  Subscribe to the newsletter        [ Subscribe ]     │
│  ☐ 💻 Contribute code or a translation     [ GitHub ]       │
│  ☐ 💛 Donate — one-off or monthly           [ Donate ]      │
│                                                             │
│  All optional. Nothing in the app changes either way.       │
└───────────────────────────────────────────────────────────┘
```

Checking a row swaps its ☐ to a ✓; once ≥1 row is checked, the bottom line changes from "All
optional..." to "Thanks — every bit helps." The Proposal 1 (About/Preferences) entry point
swaps only the opening two lines to *"Enjoying Mini Diarium? Here's how to help."* — the
checklist body, ordering, and footer are identical across both entry points.

**Deliberately excluded** (Finding 10; matches `DONATE.md`'s "no obligation in either
direction" and the user's explicit "genuine" bar):
- No fabricated or stale social-proof counters ("X people have donated") — the app has no
  telemetry to back a live number honestly.
- No scarcity or urgency framing (countdown timers, limited-time language) — nothing about
  this ask is actually time-limited.
- No exit-intent nags ("are you sure you don't want to help?").
- No pre-checked recurring-donation defaults.
- No guilt copy implying consequences for not donating.

**Pros**
- One well-designed surface replaces two separate weaker ones (Proposal 1's low-reach
  About section and Proposal 3's single-shot banner), while still letting Proposal 1's "I
  went looking myself" path exist as an entry point rather than a whole solution.
- Ask-stacking makes the user's own request — "donating + leaving a review... at once" —
  a designed-for outcome rather than a coincidence.
- Reuses `DONATE.md`'s already-correct voice (Finding 11) instead of inventing new copy.
- The reciprocity opening line for the Proposal 4 entry point costs nothing extra to build —
  it's the same `Statistics` object already fetched for the dot check.

**Cons**
- Departs from Proposal 1's original "equal weight, no option emphasized" framing — ordering
  is now by friction, not alphabetical or neutral. This is a deliberate, user-approved change
  (2026-08-21), not an oversight, but it means the two proposals are no longer purely additive
  reads of the earlier recommendation.
- New overlay component, new self-tap checklist state, and a new `localStorage` key to add to
  the reset/export audit (`src/CLAUDE.md` gotcha #7) and the settings taxonomy doc.
- The self-tap checkmarks are an honor-system UI element with no verification — worth being
  explicit in any implementation plan that this is intentional (a completion cue for the
  user, not a tracking mechanism) rather than something a reviewer might read as a bug.

## Risks & Unknowns

- **Risk**: Any option that uses `openUrl()` opens the user's default browser, which is a
  context switch away from the app. This is already accepted behavior (About → GitHub/Docs
  works the same way today), but worth confirming it doesn't feel more jarring when the
  destination is "please pay me" rather than "here's more info."
- **Unknown**: What milestone (entry count vs. days-active vs. a specific feature used) best
  signals "this person has adopted the app" for Proposal 3 — this needs either a product
  decision from the maintainer or, ideally, actual usage-distribution data (which the app
  cannot collect, being network-free, so it would have to be a judgment call, not a metric).
- **Unknown**: Whether the Microsoft Store is genuinely the only review-capable channel worth
  linking, or whether Flathub/other channels have since added ratings — worth a quick check at
  implementation time since store features change.
- **Suggested investigation** (outside exploration mode): sketch the exact banner copy and
  placement for Proposal 3 as a small mockup before building it, given the "wrong moment in a
  journaling app" risk called out above. (Superseded in practice by Proposal 4/5, which avoid
  this risk structurally — see below — but the mockup step still applies to the new overlay.)
- **Unknown (session 2, partially resolved)**: the streak rungs in Proposal 4 are now
  best_streak-based at 7/66/365 days (Findings 12–13), with 66 grounded in Lally et al.'s
  habit-formation research rather than a round number. Rungs 1 and 3 remain judgment calls —
  the app collects no telemetry, so there is no usage-distribution data to tune them against.
- **Risk (session 2)**: the self-tap "I did this ✓" checkmarks in Proposal 5 are intentionally
  unverified (honor system, local-only, not tracked) — worth flagging explicitly in any
  future implementation plan so it reads as a deliberate design choice, not an overlooked gap.
- **Risk (session 2)**: Proposal 5's friction-ordering is a departure from Proposal 1's
  original "equal weight, no option emphasized" principle. Confirmed with the user
  (2026-08-21) that ordering by friction — not by which option earns the most — is the
  intended reading; worth re-confirming at implementation time that the visual design doesn't
  drift into looking like a funnel toward Donate.

## Recommended Direction

**Superseded 2026-08-21 (session 2).** The recommendation below replaces the original
Proposal-1-baseline / Proposal-3-primary combination with **Proposal 4 (trigger) + Proposal 5
(destination)**, refined with the user across this session. The reasoning that justified
Proposal 1 and 3 in the first place — timing over frequency, pulled over pushed, no recurring
nag — still holds; it's the *implementation* of both that improved:

- **Proposal 4 replaces Proposal 3 as the trigger.** Same underlying goal (reach users who
  never open About, at the moment goodwill is highest), but anchored to `current_streak`
  instead of raw entry count, which closes the import-gaming hole in Finding 9 and moves the
  ask fully inside a surface the user opened themselves (`StatsOverlay`), removing the
  "wrong moment in a journaling app" risk structurally rather than by careful copywriting.
- **Proposal 5 replaces Proposal 1 as the destination.** Both the old About-screen link and
  the new Stats dot now route to one purpose-built overlay instead of a flat equal-weight
  list. The ordering (ascending friction, Donate last) is grounded in the
  commitment/consistency research in Finding 10 and directly answers the user's original ask
  for a page designed to convert genuinely — including multiple actions in one visit — without
  resorting to the dark patterns (fake scarcity, fake social proof, guilt copy) that
  neuromarketing research also warns produce backlash, not goodwill, and would contradict
  `DONATE.md`'s established "no obligation in either direction" tone.

The Joplin/qBittorrent failure modes identified in Finding 5 are still the operative guardrail
and are still satisfied: the ask never appears unless the user opened Stats or About
themselves, it can fire at most a handful of times ever (three streak rungs, each shown once),
and it never overlays the editor.

**Proposal 2 (bell "tip" notification) remains a deliberately reserved, low-frequency
instrument** — unchanged from the original recommendation. It stays outside the Proposal 4/5
flow entirely; save it for genuinely occasional moments (a major version, a funding need)
rather than folding it into the streak/overlay mechanism.

This also still satisfies the non-monetary requirement: the checklist in Proposal 5 presents
donate, star, review, share, contribute, and newsletter as genuine options rather than a
single highlighted "Donate" button — friction-ordering changes *which one appears first*, not
whether the others are offered with equal seriousness.

## Next Steps

- [x] Develop Proposal 3 further / consider new options — resulted in Proposal 4 (trigger)
- [x] Research neuromarketing / conversion best practices for the destination overlay —
      resulted in Proposal 5, with an explicit list of excluded dark patterns
- [x] Decide checklist ordering (ascending friction, Donate last) and share-message UX
      (copy-to-clipboard, not inline-editable) — confirmed with the user, 2026-08-21
- [x] Capture Proposals 4 and 5 in this document
- [x] Decide the streak rungs for Proposal 4 — revised to `best_streak` (not
      `current_streak`) at 7/66/365 days, each gated by real wall-clock journal age; 66 is
      Lally et al.'s evidence-based habit-formation average rather than a round number
- [x] Sketch the visual layout and copy for `ProjectSupportOverlay` (Proposal 5) — see the
      layout sketch above
- [x] Decide where the milestone indicator lives in the main window — user flagged
      (2026-08-21) that a dot buried in the Stats overflow-menu item under-reaches, since most
      users may never open Statistics. Weighed reusing the existing notification bell (Finding
      14) vs. a new dedicated icon; **decided: a new dedicated icon**, conditionally rendered
      into `Header.tsx`'s persistent chrome, so it adds no visual clutter except when a
      milestone is actually pending, and doesn't remix milestone content into the
      release-news channel Proposal 2 deliberately keeps separate
- [x] Capture a formal implementation plan (still no code) — see
      [`project-support-overlay-plan.md`](project-support-overlay-plan.md)
- [x] Pick the specific icon/glyph and its position — decided (2026-08-21): a `Heart` icon
      (lucide-solid, already the icon family every other Header glyph uses), placed at the
      **end of the left-hand group** in `Header.tsx` (after `header-next-day-button`), not
      among the five icons already crowding the right-hand group (timeline toggle, About,
      Notifications, Lock, `⋮` overflow). `Header.tsx`'s `justify-between` layout leaves open
      space between the two groups on any non-cramped width, so an icon at the end of the left
      group sits isolated by that whitespace — reading as its own thing near the header's
      visual middle, rather than blending into the right-side icon row. Conditionally
      rendered (`<Show when={hasPendingMilestone()}>`), same as the rest of Proposal 4.
- [x] Exit exploration mode to implement — implemented per
      [`project-support-overlay-plan.md`](project-support-overlay-plan.md), TODO-0106
