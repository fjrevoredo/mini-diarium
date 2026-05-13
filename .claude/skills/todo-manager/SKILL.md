---
name: todo-manager
description: |
  End-to-end management of TODO items in `docs/todo/TODO.md`. Covers creation with auto-assigned IDs,
  status tracking, archival of completed items, and format validation. Use when the user asks to add a new TODO,
  check TODO status, archive completed items, or validate the TODO system.
  Triggers: TODO, todo item, add todo, create todo, todo status, archive todo, validate TODO,
  TODO ID, TODO-0001, check TODO, todos, list todos, todo list.
---

# TODO Manager Skill

Manages the full lifecycle of TODO items in `docs/todo/TODO.md` and linked extra detail in `docs/todo/TODO_EXTRA.md`.

## Quick Reference

| Operation | Purpose |
|-----------|---------|
| **Create** | Add a new TODO item with auto-assigned `TODO-XXXX` ID |
| **Track** | Report status: open/closed counts, stale items, ID health |
| **Archive** | Move completed items to `docs/todo/TODO_ARCHIVE.md` |
| **Validate** | Check ID uniqueness, sequential order, format correctness |

## File Layout

```
docs/todo/
  TODO.md          Active backlog (this is the working file)
  TODO_ARCHIVE.md  Completed items (historical, no changes to existing entries)
  TODO_EXTRA.md    Implementation detail linked to parent TODOs via TODO-XXXX-YY
```

## Format Rules

- Top-level items: `- [ ] **TODO-XXXX: Title** — description`
- Indented sub-items: `  - [ ] **Title** — description` (free-form, **no ID**)
- IDs are 4-digit zero-padded sequential: `TODO-0001`, `TODO-0002`, ...
- TODO_EXTRA.md items: `## TODO-XXXX-YY: Title` linking back to parent `TODO-XXXX`
- Completed items in TODO.md: `- [x] **TODO-XXXX: Title** — description`
- When archived: `- [x] **TODO-XXXX: Title** (YYYY-MM-DD) — description`
- IDs are **never reused** — always scan for the highest existing ID and increment

---

## Operation 1: Create a New TODO

Add a brand-new TODO item to the correct priority section with an auto-assigned ID.

### Step-by-Step

1. **Read** `docs/todo/TODO.md`.
2. **Scan** for the highest existing `TODO-XXXX` ID — the new ID is that number + 1, zero-padded to 4 digits.
3. **Format** the new item: `- [ ] **TODO-XXXX: Title** — description` (use em-dash `—` between title and description).
4. **Insert** into the appropriate priority section (High, Medium, Website, or Low), maintaining alphabetical or logical order within the section.
5. **Do NOT** add IDs to new indented sub-items — they stay as `- [ ] **Title** — description`.
6. **Update** the plan milestone or status marker if this TODO references a plan file.

### Example

```
- [ ] **TODO-0020: New feature** — brief description of what must be true
```

### Validation

- `rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort` shows the new ID at the end.
- No duplicate IDs.
- The item is in the correct priority section.

---

## Operation 2: Track TODO Status

Report on the state of the TODO backlog.

### Step-by-Step

1. Read `docs/todo/TODO.md`.
2. Count items by section and status (`[ ]` vs `[x]`).
3. Identify stale items — completed `[x]` items that have been sitting without archival (more than a few days) should be flagged for archival.
4. Check that `TODO_EXTRA.md` parent IDs all reference valid `TODO-XXXX` entries in `TODO.md`.
5. Report any `TODO-XXXX-YY` IDs in `TODO_EXTRA.md` whose parent `TODO-XXXX` doesn't exist.

### Validation

- Report format:
  ```
  High: 0 open, 1 completed
  Medium: 7 open, 2 completed
  Website: 1 open
  Low: 8 open
  ---
  Total: 16 open, 3 completed
  Orphaned EXTRA items: (none / list)
  ```

---

## Operation 3: Archive Completed Items

Move completed `[x]` items from `docs/todo/TODO.md` to `docs/todo/TODO_ARCHIVE.md`.

### Step-by-Step

1. Read `docs/todo/TODO.md`.
2. Find all top-level `- [x]` items and their indented sub-items.
3. For each completed top-level item:
   - Insert today's date (ISO format `YYYY-MM-DD`) between the closing `**` and the ` — `: `- [x] **TODO-XXXX: Title** (2026-05-07) — description`.
   - Keep indented sub-items verbatim below their parent.
4. **Prepend** the transformed block to `docs/todo/TODO_ARCHIVE.md` after the `## Completed` heading.
5. **Remove** the completed lines from `docs/todo/TODO.md`. Collapse consecutive blank lines to at most one.
6. If no completed items exist, note this and stop.

### Compatibility Note

This operation complements the `pre-release` skill which also archives completed items during release preparation. This skill can be used standalone between releases for single-item archival.

### Validation

- Completed items are no longer in `docs/todo/TODO.md`.
- They appear at the top of `docs/todo/TODO_ARCHIVE.md` under `## Completed`.
- Dates are inserted in the correct position (between `**...**` and ` — `).

---

## Operation 4: Validate the TODO System

Run a full consistency check on the TODO files.

### Step-by-Step

1. **ID uniqueness**: `rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort | Get-Unique` — should match the count from `rg -c '\*\*TODO-\d{4}:' docs/todo/TODO.md`.
2. **ID sequence**: IDs should be sequential from `TODO-0001` to the highest, with no gaps.
3. **No IDs on sub-items**: Indented `- [` lines must NOT contain `TODO-` pattern.
4. **TODO_EXTRA.md parent validity**: Every `TODO-XXXX-YY` in `TODO_EXTRA.md` must have a parent `TODO-XXXX` that exists in `TODO.md`.
5. **No stale `[x]` without archive date**: Items marked `[x]` in `TODO.md` that haven't been archived are valid but should be flagged.
6. **Format consistency**: All top-level items follow `- [ ] **TODO-XXXX: Title** — description` or `- [x] **TODO-XXXX: Title** — description`.

### Validation Commands

```bash
# Count TODO items
rg -c '\*\*TODO-\d{4}:' docs/todo/TODO.md

# Check uniqueness
rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort | Get-Unique | Measure-Object

# Check for IDs on sub-items (should be zero)
rg '^  - \[.\] \*\*TODO-' docs/todo/TODO.md

# Check EXTRA parent IDs exist
rg -o '(?<=Parent: .)TODO-\d{4}' docs/todo/TODO_EXTRA.md | ForEach-Object {
  $parent = $_; if (-not (Select-String -Pattern $parent -LiteralPath "docs/todo/TODO.md")) {
    Write-Output "ORPHAN: $_"
  }
}
```

---

## Key Files Reference

| File | Role |
|------|------|
| `docs/todo/TODO.md` | Active backlog — the working TODO file |
| `docs/todo/TODO_ARCHIVE.md` | Completed items archive |
| `docs/todo/TODO_EXTRA.md` | Implementation detail linked to parent TODOs |
| `.agents/skills/todo-manager/SKILL.md` | This skill |

## Common Pitfalls

1. **ID reuse** — Never reassign a previously used ID. Always scan for the highest existing `TODO-XXXX` and add 1.
2. **Sub-items getting IDs** — Indented items under a parent TODO are free-form. They must NOT carry `TODO-XXXX` IDs.
3. **Wrong priority section** — Insert new items under the correct `## <Priority>` heading.
4. **Missing em-dash** — Use ` — ` (em-dash with surrounding spaces) between title and description, not ` - ` (hyphen).
5. **Archive date position** — Date goes between `**...**` and ` — `: `**TODO-0001: Title** (2026-05-07) — description`.
6. **Forgetting to remove from TODO.md after archive** — Archiving is a *move*, not a copy.
7. **TODO_EXTRA parent drift** — When a TODO ID changes (should be rare), update all `TODO-XXXX-YY` references in `TODO_EXTRA.md`.
