# Newsletter

**Status:** Live. Signup forms deployed across the site; delivery via Buttondown (free tier).

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Provider | Buttondown | Simplest option for the actual need: a handful of manual broadcasts to a small list. Self-hosting (Listmonk) was considered but the privacy argument for it was weak, since Mini Diarium's privacy promise is about journal entries, not a marketing list. Free under 100 subscribers. |
| Opt-in | Double opt-in | Mandatory in Buttondown by default, not a toggle. Also best practice. |
| Sender | `news@mini-diarium.com` | On the project domain. Domain verification lives in Buttondown, not in this repo. |
| Content | Manual broadcasts only | Launch sequence plus occasional digests. No RSS automation; every send is hand-written. |
| Placement | Dedicated section after the hero, footer on every page, plus a `/newsletter/` landing page | Prominent capture without competing with the hero's download CTA, plus persistent low-friction capture everywhere. |
| Tint | `#F5C94D` | Matches the site accent (`--accent` in `style.css`). |

## What is implemented

The signup form is Buttondown's embed, posting to:

```
https://buttondown.com/api/emails/embed-subscribe/mini_diarium
```

It appears in three shapes, each with a unique input `id` to avoid duplicate-id collisions on pages that render more than one form:

| Where | File | Input id |
|---|---|---|
| Homepage prominent section (`#newsletter`, right after the hero) | `website/index.html` | `bd-email-top` |
| Footer, every page | `buildFooter()` in both generators + 4 manual pages | `bd-email-footer` |
| Dedicated landing page | `website/newsletter/index.html` | `bd-email-page` (plus footer) |

Footer form locations (the only form on most pages):

- Manual pages (hand-edited): `website/index.html`, `website/encrypted-journal/index.html`, `website/compare/index.html`, `website/privacy/index.html`
- Generated pages: `buildFooter()` in `scripts/generate-website-blog.mjs` and `scripts/generate-website-docs.mjs`

Supporting changes:

- CSS classes in `website/css/style.css`: `.newsletter-cta`, `.footer-newsletter`, `.newsletter-form`, `.newsletter-form--lg`, `.newsletter-powered`.
- `/newsletter/` registered in `STATIC_PAGES` (`scripts/generate-website-blog.mjs`) so it appears in `sitemap.xml` and `llms.txt`.
- `website/privacy/index.html` has a Newsletter section naming Buttondown as processor.

## Maintenance

- **Change the form HTML:** it lives in 8 places (homepage section, `/newsletter/` body, 4 manual footers, `buildFooter()` in 2 generators). Edit all of them, then rebuild. The Buttondown endpoint and `name="email"` field must stay intact.
- **Rebuild after any HTML/CSS change:** `bun run website:build-static` regenerates blog/docs and re-fingerprints CSS/JS.
- **Buttondown config (external):** account, sending-domain verification for `mini-diarium.com`, tint, description, and the subscriber list all live in Buttondown's UI, not in this repo.
- **Add a `/newsletter` link to the nav** (currently footer only): the nav lives in 6 synced places (4 manual pages + `buildNav()` in both generators).

## Open items

- Verify `news@mini-diarium.com` sending in Buttondown (domain DNS records).
- Run one real test signup through the live form to confirm the double-opt-in email lands.

## Future

If the list grows past 100 subscribers and the $9/mo Buttondown tier is not wanted, **Listmonk** (self-hosted on the existing Coolify box, free, Brevo SMTP at 300 emails/day) is the migration target. The site-side integration is identical; only the form `action` URL changes. Revisit when the list is real.
