# Test Fixtures

Handcrafted sample files used for **manual import testing** and, where referenced via
`include_str!`, for automated unit tests.

Each file is representative of a real export format at a complexity level appropriate
for its purpose. Do **not** put real diary content here — use placeholder text.

---

## jrnl

### `jrnl-sample.json`

| Field | Value |
|-------|-------|
| Format | jrnl JSON (`jrnl --format json`) |
| Entries | 3 |
| Used by | `src/import/jrnl.rs::tests::test_parse_jrnl_sample_fixture` (automated) |

Minimal fixture. Covers basic fields, root-level tag count object, per-entry tag
arrays, `starred` flag, and dates across three consecutive days. Kept small so that
the automated test assertions stay simple and readable.

**Do not change this file without updating the matching assertions in
`test_parse_jrnl_sample_fixture`.**

---

### `jrnl-realistic.json`

| Field | Value |
|-------|-------|
| Format | jrnl JSON (`jrnl --format json`) |
| Entries | 6 |
| Used by | Manual testing via Import overlay |

Comprehensive fixture grounded in jrnl v4.x's actual JSON schema
(https://jrnl.sh/en/stable/export-formats/). Designed to exercise the full range of
real-world jrnl export patterns:

| Scenario | Entry |
|----------|-------|
| Multi-paragraph body (`\n\n`) | "Back to work …", "Shipped v2." |
| Single short paragraph | "Started running again." |
| Multiple tags on one entry | "Idea: offline-first sync …" (`@idea`, `@work`) |
| Cross-category tags | "Dentist, then dinner." (`@health`, `@personal`) |
| Empty body (title-only entry) | "Quiet Sunday." |
| `starred: true` | "Idea: offline-first sync …", "Shipped v2." |
| Dates spanning multiple months | Jan–Mar 2024 |
| Late-night timestamp | "Shipped v2." at 23:30 |
| Early-morning timestamp | "Started running again." at 07:30 |

**To use for manual testing:** open the app, go to Import, choose jrnl JSON, and
select this file. Expected result: 6 entries imported across 6 distinct dates.

---

## Day One

### `dayone-sample.txt`

| Field | Value |
|-------|-------|
| Format | Day One TXT export |
| Entries | 4 raw (3 import, 1 is blank/metadata-only and skipped) |
| Used by | `src/import/dayone_txt.rs::tests::test_parse_dayone_txt_sample_fixture` (automated) |

Minimal fixture covering the Day One TXT date header in both the modern format
(`Date:\t<Month> <D>, <YYYY> at <time> <TZ>`, confirmed against Day One's own
current export guide — see the format reference below) and the legacy format
(`Date:\t<DD> <Month> <YYYY>`, seen in older exports), plus tab-delimited
`Weather:`/`Location:` metadata lines directly after a date line, the
`29 February 2024` leap-year date edge case, and an entry that carries only
metadata (no title/body) to prove such entries are skipped rather than
imported blank.

**Do not change this file without updating the matching assertions in
`test_parse_dayone_txt_sample_fixture`.**

---

### `dayone-txt-realistic.txt`

| Field | Value |
|-------|-------|
| Format | Day One TXT export |
| Entries | 5 raw (4 import, 1 is blank/metadata-only and skipped) |
| Used by | Manual testing via Import overlay |

Comprehensive fixture grounded in Day One's documented TXT export format and
independent parsers' corroborating behavior (see the format reference below —
**unlike the JSON fixtures, no byte-exact real Day One TXT export sample was
available**, so this is built from documented format + corroboration, not a
verified real file):

| Scenario | Entry |
|----------|-------|
| Modern date format + Weather/Location metadata | "Coffee with an old friend" |
| Legacy date format, same calendar date as the entry above | "Quick note: forgot my umbrella again." |
| Metadata-only entry (Weather line, no title/body) | (skipped) |
| Unicode/emoji text | "Feeling grateful 🌻" |
| Leading inline Markdown image reference (`![](path)`) | title imported as `![](photos/sunset.jpg)`, "Evening walk" lands in the body text — a known artifact of `extract_title_and_text` splitting on the first `\n\n`, same pass-through behavior as `dayone-moment://` references in the JSON fixtures |

**To use for manual testing:** open the app, go to Import, choose Day One TXT,
and select this file. Expected result: 4 entries imported (the metadata-only
entry is silently skipped), two of them sharing the date 2023-04-03.

---

### `dayone-sample.json`

| Field | Value |
|-------|-------|
| Format | Day One JSON export |
| Entries | 4 raw (2 import, 2 are blank and skipped) |
| Used by | `src/import/dayone.rs::tests::test_parse_dayone_sample_fixture` (automated) |

Minimal fixture for issue [#294](https://github.com/fjrevoredo/mini-diarium/issues/294):
Day One omits the `"text"` key entirely for a blank entry (confirmed against
independent Day One JSON parsers — see the format reference below), which used to
fail `serde_json` deserialization for the *whole file* since `text` was a required
`String`. Also covers a whitespace-only `"text": "   "` entry (same "blank entry"
shape, different encoding) and fields we intentionally don't import (`timeZone`,
`starred`, `tags`) to prove they're safely ignored rather than rejected.

**Do not change this file without updating the matching assertions in
`test_parse_dayone_sample_fixture`.**

---

### `dayone-realistic.json`

| Field | Value |
|-------|-------|
| Format | Day One JSON export |
| Entries | 8 raw (6 import, 2 are blank and skipped) |
| Used by | Manual testing via Import overlay |

Comprehensive fixture grounded in real Day One JSON exports and independent
third-party parsers (see the format reference below), covering the field noise a
real export carries alongside `creationDate`/`text` — none of which Mini Diarium
imports, but all of which must not break parsing:

| Scenario | Entry |
|----------|-------|
| Full metadata noise (location, weather, userActivity, richText, device/OS provenance) | "Morning walk …" |
| Non-UTC `creationDate` offset (`+05:00`) | "Single line title only …" |
| Photo attachment + inline `dayone-moment://` reference | "Lunch spot …" |
| Video + audio attachments, body is only moment references | (untitled, moment-only text) |
| Backslash-escaped punctuation (Day One's plain-text quirk) | "Quoted line …" |
| Blank entry — `"text"` key omitted entirely | (skipped) |
| Blank entry — whitespace-only `"text"` | (skipped) |
| `starred`/`isPinned` flags, multiple tags | "Shipped v2 …" |

**To use for manual testing:** open the app, go to Import, choose Day One JSON, and
select this file. Expected result: 6 entries imported across 6 distinct dates (the
2 blank entries are silently skipped).

---

## jrnl JSON format reference

Generated by running `jrnl --format json` (jrnl v4.x). The schema is:

```json
{
  "tags": { "@tag-name": <occurrence-count> },
  "entries": [
    {
      "title": "First line of the entry (extracted by jrnl)",
      "body":  "Everything after the title line. Newlines are literal \\n characters.",
      "date":  "YYYY-MM-DD",
      "time":  "HH:MM",
      "tags":  ["@tag-name"],
      "starred": false
    }
  ]
}
```

Key properties:
- `title` is what jrnl extracted as the first line when the entry was created.
- `body` may be an empty string `""` for title-only entries.
- `tags` in each entry are a subset of the root `tags` keys.
- `time` is always 24-hour `HH:MM` (no seconds).
- `date` is always `YYYY-MM-DD`.
- Mini Diarium imports `title`, `body` → `text`, and `date`. `time`, `tags`, and
  `starred` are present in the JSON but are not imported.

## Day One JSON format reference

There is no single official schema document for Day One's JSON export — Day One's
own [export guide](https://dayoneapp.com/guides/tips-and-tutorials/exporting-entries/)
describes the export process but not the field list. The field set below is
cross-referenced from real exports and independent open-source parsers, since each
one only documents (or defensively handles) the subset of fields it imports:

- [`marcdonald/obsidian-day-one-importer`](https://github.com/marcdonald/obsidian-day-one-importer) —
  Zod schema (`src/schema.ts`) plus real, unredacted export samples used as its own
  test fixtures (`test/__test_data__/day-one-in/*.json`); `text` is
  `z.string().default('')` there for the same reason we default it here.
- [`paviro/Notema`](https://github.com/paviro/Notema) — a Rust `serde` model
  (`crates/notema-import/src/dayone/model.rs`) that mirrors the export field-for-field
  (location, weather, userActivity, device/OS provenance, media) and models `text`
  as `Option<String>` with the comment "Day One escapes literal punctuation with
  backslashes" — independent confirmation of both the missing-`text` shape and the
  backslash-escaping quirk this fixture also covers.
- [Day One community forum](https://forums.dayoneapp.com/forums/topic/json-export-why-does-not-contain-book-tags-weather-audio/) —
  user reports on which fields the export does/doesn't include in practice (e.g.
  `tags` sometimes absent even when set in the app; `weather` present even when
  export settings say otherwise).

Per-entry fields observed across those sources, beyond what Mini Diarium imports
(`creationDate`, `text`): `uuid`, `modifiedDate`, `timeZone`, `tags`, `starred`,
`isPinned`, `isAllDay`, `duration`, `editingTime`, `richText` (a JSON-encoded rich
body, preferred by some importers over `text` when present), `location` (with a
nested `region`), `weather`, `userActivity`, `creationDevice*`/`creationOS*`
provenance, and `photos`/`videos`/`audios`/`pdfAttachments` arrays (each entry
referenced inline in `text` as `dayone-moment://<identifier>`,
`dayone-moment:/video/<identifier>`, or `dayone-moment:/audio/<identifier>`). Mini
Diarium's parser doesn't set `#[serde(deny_unknown_fields)]`, so all of these are
safely ignored today — `dayone-realistic.json` exercises that.

Key properties:
- `text` may be **absent entirely** (a blank entry) or present but
  whitespace-only — both must import as zero entries, not a parse failure
  (issue #294).
- `creationDate` may carry a non-UTC offset (e.g. `+05:00`) instead of `Z`.
- Media identifiers in `photos`/`videos`/`audios` are referenced from `text` by
  `dayone-moment://` URLs, not by array position — Mini Diarium doesn't resolve
  these today, so they pass through as literal Markdown image syntax.

## Day One TXT format reference

**Confidence caveat:** unlike the JSON fixtures above (built from real,
byte-exact GitHub-hosted export samples), there is no byte-exact real Day One
TXT export file backing these fixtures — only Day One's own documented format
plus independent parsers' corroborating behavior, cross-referenced below:

- [Day One's official import/export guide](https://dayoneapp.com/guides/import-export/importing-data-from-plain-text/) —
  authoritative and current. Documents the per-entry date line as
  `Date: June 24, 2016 at 10:59:06 AM MDT` (`"MMMM D, YYYY at H:MM:SS AM/PM TZ"`)
  and the "two carriage returns separate entries" rule that this importer's
  `\n\n`-based splitting already assumes correctly.
- A DEVONthink community forum thread confirms a **tab** precedes `Date:` in
  real exports (matching this importer's existing `"\tDate:\t"` delimiter) and
  separately shows real exports carrying additional tab-delimited
  `Weather:`/`Location:` metadata lines per entry.
- Christian Tietze's blog post on parsing Day One TXT exports, built against
  real exported files, uses a generic `/\A\t(?<key>\w+):\t(?<value>.*+)$/`
  regex — independent confirmation that **any** tab-delimited `Key:\tValue`
  line can appear after the date (not just `Date:`/`Weather:`/`Location:`),
  and that images appear inline as literal `![](path)` Markdown at the top of
  an entry's content.
- One source notes that Day One Classic (the older app generation) "doesn't
  export dates in a standard format, unlike Day One 2.x" — suggesting the
  original `"DD MMMM YYYY"` (e.g. `"15 January 2024"`) assumption in this
  importer may be a legacy/guessed format rather than one confirmed against a
  current, real Day One export; it's kept as a fallback for compatibility.
- A German-locale forum report shows a translated header
  (`Datum: ... um ... MEZ`) — locale-dependent date labels exist in some Day
  One installs, but there is no verified translation set to test against, so
  locale-specific `Date:` labels are explicitly **out of scope**.
- Metadata-line stripping only looks *after* the `Date:` line, matching the
  official guide's documented entry layout (date first). A hypothetical export
  that placed a `Weather:`/`Location:` line *before* `Date:` would attach to
  the end of the *previous* entry's body instead (this importer splits on the
  literal `"\tDate:\t"` delimiter first) — also explicitly **out of scope**,
  since no source shows Day One ordering metadata before the date.

Key properties:
- The date line's time-of-day and timezone abbreviation (everything from
  `" at "` onward) are discarded before parsing — only the calendar date
  (`YYYY-MM-DD`) is ever used, since `date_created`/`date_updated` are set from
  the import moment, not from the parsed date.
- A tab-delimited `\tKey:\tValue` line appearing directly after the date line
  is treated as metadata and skipped (no key allowlist), not imported as
  entry content.
- An entry whose title and body are both empty after metadata-stripping is
  skipped, matching the policy already used for the Day One JSON importer.
