# End-User Linux Spellcheck Guidance Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-07-26
- Last Updated: 2026-07-26
- Owner: Coding agent
- Approval: APPROVED

## Goal

Make a missing Linux spellcheck dictionary understandable and actionable with a direct help link, a copyable Ubuntu/Debian Spanish example, and support channels for unresolved problems.

## Scope

- Rewrite missing-dictionary warnings and add a help-link button in Preferences.
- Expand the existing Linux spellcheck documentation and regenerate its website output.
- Cover the warning and browser-handoff behavior with tests.

## Non-Goals

- Automatically install OS packages, detect Linux distributions, or change dictionary detection.

## Assumptions

- The stable guide URL is `https://mini-diarium.com/docs/preferences/#spell-check-on-linux`.
- Normal warnings name the interface language in plain terms rather than exposing locale codes.

## Open Questions

- None.

## Tasks

### Task 1: Rewrite Recovery Copy

- Status: COMPLETED
- Objective: Give normal Linux and Flatpak users a clear recovery path in their own language.
- Steps: Replace technical dictionary copy, add a localized guide-button label, and retain the current warning visibility conditions.
- Validation: `bun run validate:locales` passed.
- Notes: The main warning must not require users to understand Hunspell or locale identifiers.

### Task 2: Add Guide Link and Tests

- Status: COMPLETED
- Objective: Open the exact documentation section in the system browser from a missing-dictionary warning.
- Steps: Use the established `openUrl()` pattern and add component tests for visibility and invocation.
- Validation: Focused component and IPC tests passed. The test asserts that the button delegates the exact guide URL to the established Tauri opener API.
- Notes: Do not use a raw anchor or `target="_blank"` in the Tauri WebView.

### Task 3: Expand Help Documentation

- Status: COMPLETED
- Objective: Explain recovery in user terms, including Ubuntu/Debian Spanish instructions and support links.
- Steps: Update `website/docs-src/07-preferences.md`, regenerate static output, and update the changelog.
- Validation: `bun run website:build-static` passed; generated Preferences help contains the Ubuntu/Debian example and both support links.
- Notes: Keep advanced custom dictionary instructions separate from the primary path.

### Task 4: Cleanup and Final Verification

- Status: COMPLETED
- Objective: Retain only intended changes and verify the complete enhancement.
- Steps: Preserve unrelated worktree changes untouched; run formatting, type, lint, locale, test, and diff checks.
- Validation: `bun run format:check`, `bun run type-check`, `bun run lint`, and `git diff --check` passed.
- Notes: Generated website output is part of the intended repository state.

## Final Verification

- `cargo test --workspace` passed (567 tests).
- `bun run test:run` passed (791 tests).
- `bun run type-check` passed.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bun run validate:locales` passed.
- `bun run website:build-static` passed.
- `git diff --check` passed.

## Plan Self-Check

- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Every task has concrete steps and validation.
- [x] Browser handoff has an explicit manual verification step.
- [x] Cleanup and final verification are included.

## Completion Notes

- The system-browser handoff is covered by a component test that asserts the exact `openUrl()` invocation. A live browser launch was not automated in this Linux-native shell.

## Execution Notes

- Update task status before beginning work and immediately after validation passes.
- Keep the plan status and task statuses accurate as the execution ledger.
