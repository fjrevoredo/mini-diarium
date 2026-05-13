---
name: diagram-maintainer
description: |
  Maintain, update, regenerate, and review Mermaid and D2 documentation diagrams for this repo.
  Use when working in docs/diagrams/, editing .mmd or .d2 sources, syncing diagrams to current code,
  regenerating SVGs, checking light/dark variants, or reviewing diagram readability and semantic drift.
  Triggers: mermaid, d2, docs/diagrams, mmd, svg diagram, architecture diagram, flow diagram,
  unlock flow, save-entry flow.
---

# Diagram Maintainer

## Overview

Use this skill to keep `docs/diagrams/` accurate, regenerated, and visually readable.

Treat the implementation as the source of truth, edit only `.mmd` and `.d2` sources, regenerate SVGs immediately, and review both light and dark variants before finishing.

## Load These Files First

- Always open [docs/diagrams/WORKFLOW.md](/mnt/d/Repos/mini-diarium/docs/diagrams/WORKFLOW.md) first.
- If editing Mermaid, open [docs/diagrams/BEST_PRACTICES_FOR_MERMAID.md](/mnt/d/Repos/mini-diarium/docs/diagrams/BEST_PRACTICES_FOR_MERMAID.md).
- If editing D2, open [docs/diagrams/BEST_PRACTICES_FOR_D2.md](/mnt/d/Repos/mini-diarium/docs/diagrams/BEST_PRACTICES_FOR_D2.md).
- If the change is semantic, inspect the relevant code under `src/` and `src-tauri/src/` before editing.
- When regenerating or checking outputs, use:
  - [scripts/render-diagrams.mjs](/mnt/d/Repos/mini-diarium/scripts/render-diagrams.mjs)
  - [scripts/verify-diagrams.mjs](/mnt/d/Repos/mini-diarium/scripts/verify-diagrams.mjs)

## Repo Diagram Map

Current sources:

- Mermaid:
  - `docs/diagrams/unlock.mmd`
  - `docs/diagrams/unlock-dark.mmd`
  - `docs/diagrams/save-entry.mmd`
  - `docs/diagrams/save-entry-dark.mmd`
  - `docs/diagrams/context.mmd`
  - `docs/diagrams/context-dark.mmd`
- D2:
  - `docs/diagrams/architecture.d2`
  - `docs/diagrams/architecture-dark.d2`

Current outputs:

- `docs/diagrams/unlock.svg`
- `docs/diagrams/unlock-dark.svg`
- `docs/diagrams/save-entry.svg`
- `docs/diagrams/save-entry-dark.svg`
- `docs/diagrams/context.svg`
- `docs/diagrams/context-dark.svg`
- `docs/diagrams/architecture.svg`
- `docs/diagrams/architecture-dark.svg`

Current intended abstraction:

- `context`: high-level system context only
- `unlock`: full unlock workflow, not just key unwrap
- `save-entry`: real editor persistence flow
- `architecture`: layered structure, not a dependency graph

## Workflow

### 1. Classify the change

Use one of these buckets:

- Semantic update: the system changed and the diagram meaning must change.
- Visual cleanup: layout or readability changes, but the meaning stays the same.
- New diagram: add source, dark variant if needed, and generated output.

### 2. Confirm the source of truth

Before editing, find the current implementation.

Typical targets:

- UI/state shape: `src/`
- command registry: `src-tauri/src/lib.rs`
- command behavior: `src-tauri/src/commands/`
- persistence behavior: `src-tauri/src/db/`

If code and diagram disagree, the code wins.

### 3. Edit only the source files

- Edit `.mmd` or `.d2`, never `.svg`.
- Keep light and dark variants semantically identical.
- Keep labels short enough to fit.
- Use exact implementation names from the codebase.
- Split overloaded diagrams instead of packing too much into one view.

### 4. Regenerate the SVGs

Run:

```bash
bun run diagrams
```

This renders all Mermaid and D2 sources back into `docs/diagrams/*.svg`.

### 5. Check that expected outputs exist

Run:

```bash
bun run diagrams:check
```

This is only a presence check. It does not prove semantic accuracy or visual quality.

### 6. Review semantics

Ask:

- Does the diagram still reflect the actual code path?
- Are key modules, commands, or states missing?
- Does it imply behavior the app no longer has?
- Does it omit a major concept like journals, plugins, backups, or multi-entry behavior?

If the meaning is wrong, go back to the source and regenerate again before polishing layout.

### 7. Review visuals

Check both light and dark variants for:

- clipped node labels
- overlapping text or arrows
- unreadable multi-line labels
- broken routing
- misleading crossings
- dark-mode readability on an actual dark background

Important:

- transparent dark Mermaid SVGs are easy to misjudge on a white canvas
- review dark diagrams on a dark background, not a default white preview

### 8. Finish cleanly

Commit the full diagram update together:

- edited `.mmd` or `.d2`
- regenerated `.svg`
- adjacent doc updates if the diagram descriptions changed

## Visual QA Helper

Use the bundled preview script when direct SVG viewing is awkward or when you need a reliable dark-background check.

Script:

- `.agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh`

What it does:

- renders SVGs to PNG previews with a headless browser
- wraps `*-dark.svg` files in a dark HTML canvas before screenshotting
- works well for checking transparent dark Mermaid diagrams

Typical usage:

```bash
.agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh
```

Useful options:

```bash
.agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh --out-dir /tmp/diagram-previews
.agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh --files docs/diagrams/save-entry.svg docs/diagrams/save-entry-dark.svg
```

Environment override:

```bash
DIAGRAM_BROWSER="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  .agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh
```

Practical note:

- In WSL, browser execution may require approval because it launches a local Windows browser binary.

## Guardrails

- Never hand-edit generated SVGs.
- Never treat `bun run diagrams:check` as a full validation step.
- Do not change the abstraction level of a diagram accidentally.
- Do not update only the light variant and forget the dark variant.
- Do not invent nicer names that diverge from the code.
- Do not leave regenerated SVGs out of the change.

## Fast Loop

For most diagram tasks, use this loop:

```bash
# 1. Inspect the relevant code and docs

# 2. Edit the source files

# 3. Regenerate
bun run diagrams

# 4. Check outputs exist
bun run diagrams:check

# 5. Visually review the changed diagrams
.agents/skills/diagram-maintainer/scripts/render_diagram_previews.sh

# 6. Commit source + SVGs together
```
