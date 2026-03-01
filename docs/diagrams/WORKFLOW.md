# Diagram Workflow

This file documents the end-to-end workflow for updating, generating, and reviewing the diagrams in `docs/diagrams/`.

It is intentionally practical. Use it when you are changing existing diagrams or adding new ones.

## Scope

Current diagram sources:

- Mermaid:
  - `unlock.mmd`
  - `unlock-dark.mmd`
  - `save-entry.mmd`
  - `save-entry-dark.mmd`
  - `context.mmd`
  - `context-dark.mmd`
- D2:
  - `architecture.d2`
  - `architecture-dark.d2`

Generated outputs:

- `unlock.svg`
- `unlock-dark.svg`
- `save-entry.svg`
- `save-entry-dark.svg`
- `context.svg`
- `context-dark.svg`
- `architecture.svg`
- `architecture-dark.svg`

Related references:

- [BEST_PRACTICES_FOR_MERMAID.md](./BEST_PRACTICES_FOR_MERMAID.md)
- [BEST_PRACTICES_FOR_D2.md](./BEST_PRACTICES_FOR_D2.md)

## Rules

- Edit diagram source files, not generated SVGs.
- Keep light and dark variants semantically identical.
- Keep each diagram at its intended abstraction level.
- Regenerate SVGs immediately after source changes.
- Commit source files and generated SVGs together.

## Source Of Truth

Before editing a diagram, identify the real implementation it is supposed to describe.

Typical checks:

- UI structure and state flow: `src/`
- Tauri command surface: `src-tauri/src/lib.rs`
- backend behavior: `src-tauri/src/commands/`
- persistence behavior: `src-tauri/src/db/`

If the code and the diagram disagree, the code wins.

## End-To-End Workflow

### 1. Decide what kind of change you are making

Use one of these buckets:

- Semantic update: the system changed and the diagram content must change.
- Visual cleanup: layout, spacing, labels, or readability changed, but the meaning stays the same.
- New diagram: add both source and generated output, plus dark variant if the doc set expects it.

Do not start by editing the SVG.

### 2. Update the source files

Mermaid diagrams:

- Edit the `.mmd` source.
- If there is a dark variant, mirror the same structure in the `-dark.mmd` file.
- Only theme/init differences should remain between light and dark.

D2 diagrams:

- Edit the `.d2` source.
- Mirror the same content into the `-dark.d2` file.

While editing:

- Keep labels short enough to fit inside nodes.
- Prefer splitting one overloaded diagram into multiple focused diagrams over adding too much detail.
- Use the existing naming from the codebase. Do not invent nicer-but-inaccurate names.

### 3. Regenerate everything

Run:

```bash
bun run diagrams
```

What this does:

- renders Mermaid diagrams with `mmdc`
- renders D2 diagrams with `d2`
- writes the SVGs back into `docs/diagrams/`

The repo script is:

- [render-diagrams.mjs](/mnt/d/Repos/mini-diarium/scripts/render-diagrams.mjs)

### 4. Check that all expected outputs exist

Run:

```bash
bun run diagrams:check
```

This verifies that all tracked SVG outputs are present.

The repo check script is:

- [verify-diagrams.mjs](/mnt/d/Repos/mini-diarium/scripts/verify-diagrams.mjs)

Important limitation:

- `diagrams:check` only verifies presence.
- It does not prove that the SVGs are semantically current.
- It does not prove that the layout is visually good.

### 5. Do a semantic review against the code

This is the most important review step.

Checklist:

- Does the diagram still reflect the actual code paths?
- Are command names correct?
- Are important modules or states omitted?
- Does the diagram imply behavior the app no longer has?
- Does it hide a major new concept such as journals, plugins, backups, or multi-entry behavior?

Good examples of semantic drift:

- a save-flow diagram still showing one-entry-per-date after the app supports multiple entries per date
- an unlock diagram stopping at key unwrap even though unlock also opens the DB and updates app state
- an architecture diagram missing `journals.ts`, `config.json`, or `plugins/`

If the meaning is wrong, fix the source and regenerate again before doing visual polish.

### 6. Do a visual review

After semantic correctness, inspect the generated SVGs visually.

Check both light and dark variants.

Review checklist:

- no clipped node labels
- no text overlapping lines or shapes
- no arrows terminating in the wrong place
- no unreadable multi-line labels
- no excessive edge crossings if a cleaner ordering is available
- dark variants remain readable on a dark background
- transparent dark Mermaid diagrams are reviewed on an actual dark canvas, not a white viewer

Practical review methods:

- Open the SVG directly in a browser.
- Open the SVG in your editor preview if it renders correctly.
- If a dark SVG uses transparency, place it on a dark page/background before judging contrast.
- If SVG rendering is awkward in your local tool, render temporary PNG previews from the SVGs and inspect those.

What to look for by diagram type:

- Flowcharts:
  - decision diamonds remain readable
  - labels on `Yes` / `No` edges are visible
  - top-to-bottom or left-to-right reading order is still obvious
- Sequence diagrams:
  - participant headers are not clipped
  - message text fits on one or two clean lines
  - alt/else sections are readable
- Architecture diagrams:
  - layers are visually distinct
  - edges do not create misleading visual shortcuts
  - dense labels are still readable at normal doc viewing size

### 7. Iterate until both semantic and visual checks pass

The normal loop is:

1. Edit source
2. Regenerate
3. Semantic review
4. Visual review
5. Repeat if needed

Do not postpone SVG regeneration until the end of a large batch of edits. Small regenerate-and-check loops are faster and safer.

### 8. Commit the full diagram change

A complete diagram update usually includes:

- the edited `.mmd` or `.d2` source files
- the regenerated `.svg` files
- any nearby documentation updates that describe the diagrams

Do not commit only the source files and leave stale SVGs behind.

## Fast Working Routine

For most updates, this is the shortest safe loop:

```bash
# 1. Edit the source files

# 2. Regenerate all diagrams
bun run diagrams

# 3. Check expected outputs exist
bun run diagrams:check

# 4. Visually inspect the changed SVGs

# 5. Commit source + SVGs together
```

## How To Check Effectively

The fastest good review is a three-pass check:

### Pass 1: meaning

Ask:

- "Is this still true?"
- "What code path proves it?"

If you cannot point to the implementation, the diagram is not yet trustworthy.

### Pass 2: readability

Ask:

- "Can someone understand this in a few seconds?"
- "Is anything cramped, noisy, or visually ambiguous?"

If yes, shorten labels, reorder nodes, or split the diagram.

### Pass 3: light/dark parity

Ask:

- "Do both variants say the same thing?"
- "Is the dark variant actually readable on a dark background?"

Dark diagrams with transparent backgrounds are easy to misjudge if previewed on white.

## Common Mistakes

- Editing the SVG instead of the source file
- Updating the light diagram but forgetting the dark variant
- Treating `diagrams:check` as a full validation step
- Adding too much implementation detail to a high-level diagram
- Using stale names after code refactors
- Regenerating locally but forgetting to commit the SVG outputs
- Reviewing transparent dark diagrams on a white background and assuming they are broken

## When To Split A Diagram

Split instead of cramming more detail into one view when:

- the diagram no longer communicates one main idea
- labels must become long to stay accurate
- there are too many crossings to fix with reordering
- readers need different abstraction levels

Examples:

- keep `context` high-level
- keep `unlock` focused on unlock behavior
- keep `save-entry` focused on editor persistence flow
- keep `architecture` layered rather than turning it into a dependency graph

## Definition Of Done

A diagram update is done when all of the following are true:

- the source files are updated
- the SVGs are regenerated
- `bun run diagrams:check` passes
- the diagram matches the current code
- the changed diagrams have been visually reviewed
- light and dark variants are consistent
- the source files and generated SVGs are committed together
