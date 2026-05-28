# TODO-0040: Preferences Lifecycle Unification — Decision Log

## Purpose

This log captures implementation-time decisions that were not explicitly fixed by `docs/todo-0040-preferences-lifecycle-plan.md`.

## How To Read

- Add one entry per decision.
- Keep entries in chronological order.
- Include enough detail to review tradeoffs after implementation is complete.

## Entry Template

### DEC-XXX: <Short title>

- Date: YYYY-MM-DD
- Related plan task(s): <e.g. Task 2.3, Task 3.2>
- Context: <What ambiguity/gap appeared during implementation>
- Options considered:
  - Option A: <summary>
  - Option B: <summary>
- Decision: <chosen option>
- Rationale: <why this option was selected>
- Impact:
  - Code: <files/components affected>
  - Tests: <tests added/changed>
  - Docs: <docs updated or not needed>

## Decisions

### DEC-001: Auto-lock timeout persistence strategy

- Date: 2026-05-28
- Related plan task(s): Task 2.4
- Context: The plan required immediate persistence for auto-lock timeout while also preventing invalid temporary values from being written during typing.
- Options considered:
  - Option A: Persist only on blur/close.
  - Option B: Persist every input keystroke, including invalid/intermediate values.
  - Option C: Persist valid in-range numeric input immediately, clamp and persist on blur for out-of-range/invalid values.
- Decision: Option C.
- Rationale: This preserves immediate behavior for normal edits, avoids writing invalid values, and guarantees a normalized final value after focus leaves the field.
- Impact:
  - Code: `src/components/overlays/preferences/PreferencesSecurityTab.tsx`
  - Tests: `src/components/overlays/preferences/PreferencesSecurityTab.test.tsx`, `src/components/overlays/preferences/PreferencesOverlay.integration.test.tsx`
  - Docs: No additional doc beyond lifecycle behavior updates.

### DEC-002: Keep legacy i18n keys that are no longer rendered

- Date: 2026-05-28
- Related plan task(s): Task 1.1, Task 3.2
- Context: Removing Save/Cancel footer and Apply Overrides button made `prefs.footer.*`, `prefs.advanced.applyOverrides`, and `prefs.advanced.overridesApplied` unused.
- Options considered:
  - Option A: Remove keys from `en.ts` and every community locale now.
  - Option B: Keep keys for this change and avoid unrelated translation churn.
- Decision: Option B.
- Rationale: The plan targeted lifecycle behavior, not i18n key cleanup; removing keys would force broad locale edits and increase review scope with no runtime benefit.
- Impact:
  - Code: No runtime dependency on the removed UI labels.
  - Tests: No test dependency on those labels after lifecycle refactor.
  - Docs: User docs updated to reflect behavior; no mention of removed button labels remains.

### DEC-003: Assert close control by actual accessible name (`Dismiss`) in tests

- Date: 2026-05-28
- Related plan task(s): Task 1.2, Task 3.3
- Context: After removing Save/Cancel, shell tests needed to assert the close-only control. The rendered `Dialog.CloseButton` exposes `aria-label="Dismiss"` in the test environment, even though the inner SR text is `common.close`.
- Options considered:
  - Option A: Keep assertions on button name `Close`.
  - Option B: Assert the actual exposed accessible name (`Dismiss`) and keep behavior-focused checks.
- Decision: Option B.
- Rationale: Aligning tests with real accessible output avoids false negatives while still validating the required close-only contract.
- Impact:
  - Code: No product behavior change; test expectations only.
  - Tests: `src/components/overlays/preferences/PreferencesOverlay.test.tsx`, `src/components/overlays/preferences/PreferencesOverlay.integration.test.tsx`
  - Docs: No doc impact.
