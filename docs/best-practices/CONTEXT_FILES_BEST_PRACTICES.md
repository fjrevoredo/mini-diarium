# Context File Best Practices (CLAUDE.md / AGENTS.md)

Authoring standard for all context files in this repo. Use as a checklist before adding content and as an audit guide when reviewing existing files.

## The Core Rule

**A context file captures what an agent cannot derive from reading the code.** If the information already lives in a source file, a pointer beats a copy — copies drift and mislead; pointers stay accurate.

Test every section: *Would this mislead an agent if it were three months stale?*
- **Yes** → replace with a pointer or remove
- **No** → it may belong

---

## What Belongs

| Type | Rationale | Examples |
|------|-----------|---------|
| **Gotchas and non-obvious invariants** | Not surfaced by types or tests | `delete_entry_if_empty` vs. `delete_entry` semantics; TipTap snapshot pattern for dialogs |
| **Security rules and policies** | Decisions, not derivable from code | "Never log passwords"; `unlock_diary_auto` intentionally bypasses `require_all_auth` |
| **Cross-cutting conventions** | Patterns that span many files | IPC error handling contract; `YYYY-MM-DD` date format |
| **Operational environment rules** | Outside the codebase itself | `cmd.exe /c bun run ...` for WSL; `cargo --manifest-path` from repo root |
| **Architectural decisions and WHY** | Context that prevents re-opening closed debates | Schema version history; why FTS was removed; why `h-full` not `h-screen` |
| **Verification commands** | Saves lookup; stable and short | `bun run type-check`, `cargo test --workspace` |
| **Pointers to key files** | Navigation help — one line each | "Commands: `lib.rs` → `generate_handler![]`. Wrappers: `src/lib/tauri/`." |
| **Purpose-only directory / module tables** | Orient an agent to an unfamiliar codebase without enumerating files | See format rule below |
| **Short reminder checklists** | Brief "don't forget X when doing Y" reminders that apply broadly | "When updating icons, also regenerate `src-tauri/icons/` with `bun run tauri icon`" — a one-liner reminder, not a step-by-step procedure |

---

## What Does Not Belong

| Type | Why | Instead |
|------|-----|---------|
| **File-structure trees** | Duplicate the filesystem; drift with every new file | `Glob` finds current state instantly |
| **Command / function registries** | Duplicate `lib.rs` / `tauri.ts`; drift with every new command | One-liner pointer to the source |
| **State module tables with signal lists** | Signal names and counts change every feature; agents read the module directly | Pointer to `src/state/` + key invariants only |
| **Counts in headings or prose** | "Nine modules", "68 commands" — drift silently | Omit the count entirely |
| **Volatile metrics** | GSC rankings, performance baselines, test counts | Pointer to the source data file |
| **Duplicated tables across files** | Two owners means both drift | One canonical file owns it; others link |
| **Multi-step task procedures** | Step-by-step workflows bloat every session; they belong in skills so they load on demand | Move to `.claude/skills/` if the checklist has more than ~3 steps or is only needed for a specific workflow |
| **"What the code does" narration** | The code already says this | Delete |

---

## Format Rules

**File length**: CLAUDE.md loads in full regardless of size, but adherence degrades noticeably above ~200 lines — important rules get lost in the noise. **This primarily applies to the root CLAUDE.md and user-level files, which load at every session start.** Subdirectory files (e.g. `src/CLAUDE.md`, `website/CLAUDE.md`) load on demand when Claude reads files in that directory — a focused 300-line domain file is far less risky than a 200-line catch-all root. Prune rules Claude already follows, and move step-by-step procedures to skills. Splitting content into `@path` imports doesn't help — imported files also load at session start.

**CLAUDE.md is advisory, not enforced.** Instructions shape Claude's behavior; there is no guarantee of strict compliance, especially for vague or conflicting rules. For actions that *must* happen deterministically — linting before a commit, blocking writes to a directory — write a hook instead. Hooks are shell commands that run at fixed lifecycle events regardless of what Claude decides. See `.claude/settings.json` hooks configuration.

**Directory and module tables** are allowed — they orient an agent without enumerating files — but cells must state **purpose only**. No file names, no signal lists, no function signatures.

```
Good:  | `src/components/auth/` | Pre-auth unlock and journal creation screens |
Bad:   | `src/components/auth/` | JournalPicker, PasswordCreation, PasswordPrompt, PasswordStrengthIndicator |
```

The "good" cell survives a new component being added. The "bad" cell is a file tree in disguise.

**Gotchas must name the failure.** A gotcha that only says "be careful with X" is not actionable. State exactly what an agent would do wrong and what breaks.

**No section should exceed ~20 lines** without a clear reason. If a section is longer, check whether it is capturing WHY or narrating WHAT. WHAT belongs in the code.

---

## Named Exception: the `data-testid` Table in `src/CLAUDE.md`

The `data-testid` table in `src/CLAUDE.md` is a justified departure from the "no registries" rule. It is:

1. A **curated subset** — only E2E-critical selectors, not every `data-testid` in the codebase (unit-test-only attributes are excluded deliberately).
2. The **single source of truth** — `e2e/CLAUDE.md` links to it rather than duplicating it.
3. Not derivable by reading one file — selectors are scattered across many components.

Do not apply the "no registries" rule to remove this table. Do not add unit-test-only selectors to it.

---

## Audit Checklist

Before adding any content, run through this:

- [ ] Is this already in a source file an agent can read? → Replace with a pointer
- [ ] Would this mislead an agent if three months stale? → Replace with a pointer or remove
- [ ] Is this the same content as another context file? → Pick one owner; link from the other
- [ ] Does this explain WHY, or only WHAT? → If only WHAT, the code says it already; remove
- [ ] Does this have a count or file name that will change? → Remove the count / name; add a pointer
- [ ] Is this a gotcha? Does it name the wrong action and the consequence? → If not, sharpen or remove
- [ ] Is this a directory/module table? Do any cells list file names? → Replace cell with purpose only
- [ ] Is this a step-by-step procedure invoked only sometimes? → Move to a skill (`.claude/skills/`)
- [ ] Is this something that must *always* happen? → Convert to a hook, not a CLAUDE.md instruction

---

## Anti-Patterns Found in This Codebase

These all occurred in Mini Diarium's CLAUDE.md files and required dedicated cleanup passes. Use them as concrete examples of what to avoid.

1. **The copy-of-lib.rs** — a 68-row command registry table that mirrored `generate_handler![]`. Drifted immediately; replaced with a one-paragraph pointer.

2. **The file tree** — 90-line `src/components/` tree and 77-line `src-tauri/src/` tree. Required Milestone 2 to patch 14 missing files; dropped after the second audit.

3. **The stale counter** — "Nine signal-based state modules" that became wrong when the tenth and eleventh were added in the same release.

4. **The volatile metric** — GSC ranking positions (`encrypted diary → 26.7`) inlined in `website/CLAUDE.md`. Changed weekly; replaced with a pointer to `docs/seo/`.

5. **The split table** — `data-testid` table existed in both `src/CLAUDE.md` and `e2e/CLAUDE.md`, diverged between releases, and required reconciliation.

6. **The wrong-path gotcha** — `src/components/editor/extensions/LinkOverlay.tsx` in a gotcha; the `extensions/` subdirectory never existed.

7. **The hardcoded path** — `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && ..."` broke on any clone to a different directory; and `cmd.exe` misparses `/C` inside `Cargo.toml` as its own execute flag.

8. **Long task checklists in CLAUDE.md** — multi-step procedures for icon regeneration, lockfile updates, and releasing belong in skills so they load on demand rather than consuming context in every session. The root CLAUDE.md still carries these; they are candidates to move to `.claude/skills/` once the 200-line adherence threshold becomes a concern. *The post-task completion checklist in [`POST_TASK_BEST_PRACTICES.md`](POST_TASK_BEST_PRACTICES.md) is a cross-cutting review rule (applies to every task), not a specific-workflow procedure, which is why it lives here rather than as a skill.*

9. **Treating CLAUDE.md as enforced policy** — instructions in CLAUDE.md shape Claude's behavior but are not guaranteed. Treating them as hard guarantees leads to false confidence. Anything that *must* happen should be a hook.

---

## Sources

These documents were consulted when writing and validating this guide. Check them for updates if guidance here seems stale.

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) — Anthropic official: CLAUDE.md content guidelines, what to include/exclude, and the over-specified CLAUDE.md failure pattern.
- [How Claude remembers your project](https://code.claude.com/docs/en/memory) — Anthropic official: CLAUDE.md load mechanics, 200-line adherence threshold, advisory vs. enforced distinction, skills vs. CLAUDE.md split, auto memory.
- [How to write a great agents.md — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/) — Empirical findings from 2,500+ repos: what patterns correlate with better agent performance; six core coverage areas; three-tier boundary system.
- [Custom instructions with AGENTS.md — OpenAI Codex](https://developers.openai.com/codex/guides/agents-md) — Codex perspective: layered instruction hierarchy, byte limits, and override files.
