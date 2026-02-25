# Built-in Plugin Guide

This guide is for maintainers adding an **official plugin** that ships by default in Mini Diarium builds.

Use this together with:
- `PHILOSOPHY.md` (source of truth for principles)

## When to Build a Built-in Plugin

Choose a built-in plugin when all of these are true:

1. The format is broadly useful to many users.
2. Long-term maintenance in Rust is acceptable.
3. Strong typing and compile-time guarantees are preferred over script flexibility.
4. Shipping it by default improves portability without violating scope.

If a format is niche, experimental, or user-specific, prefer a user Rhai plugin first.

## Non-Negotiable Requirements

Every built-in plugin must satisfy:

1. **No network behavior**
   - Do not add HTTP clients, telemetry, update checks, or remote dependencies.
2. **Core safety preserved**
   - Plugin failures must return `Err(String)`; no panics as control flow.
3. **Deterministic behavior**
   - Same input entries should produce the same output.
4. **Portable output**
   - Exported data must not introduce lock-in.
5. **Offline compatibility**
   - Plugin must work fully offline with local data only.

## Philosophy Alignment Checklist

Validate against `PHILOSOPHY.md` before merging:

1. **Small and Extensible Core**: keep plugin logic isolated; do not bloat core flows.
2. **Boring Security**: use existing audited crates/patterns; no custom crypto.
3. **Testing Pyramid**: add unit tests and command-level assertions.
4. **Easy In, Easy Out**: ensure format helps migration and data ownership.
5. **Focused Scope**: journaling-oriented only; no marketplace or unrelated features.
6. **Simple is Good**: minimal API surface, explicit code, low dependency overhead.

## Implementation Requirements (Rust)

For export plugins:

1. Implement `ExportPlugin` in `src-tauri/src/plugin/builtins.rs`.
2. Provide stable metadata:
   - id namespace: `builtin:*`
   - clear `name`
   - accurate `file_extensions`
   - `builtin: true`
3. Register plugin in `register_all()`.

For import plugins:

1. Implement parser/module and wrapper plugin in builtins as applicable.
2. Keep parser behavior strict and explicit for invalid input handling.

## Testing Requirements

Minimum required tests:

1. Metadata test (`id`, `name`, `extensions`, `builtin` flag).
2. Happy-path behavior test with deterministic fixtures.
3. Failure-path test (invalid content/schema).
4. Registry presence test via `register_all()`.
5. Command-level visibility assertion where relevant.

Recommended:

1. Parity test against equivalent Rhai plugin when promoting from script to built-in.
2. Edge-case coverage for escaping, unicode, and empty/untitled entries.

## Best Practices

1. Keep formatting logic pure and side-effect free.
2. Reuse existing helpers (for example `html_to_markdown`) instead of reimplementing.
3. Avoid adding new dependencies unless clearly justified by philosophy.
4. Keep plugin IDs stable once released.
5. Update docs and changelog in the same PR.
6. Do not promote every comparison spike to a built-in plugin; keep it user-scriptable unless there is clear long-term value in shipping it by default.

## PR Checklist (Built-in Plugin)

- [ ] Philosophy alignment checked (all six principles)
- [ ] `ExportPlugin`/`ImportPlugin` implementation added
- [ ] `register_all()` updated
- [ ] Deterministic output/parse behavior documented
- [ ] Required tests added and passing
- [ ] User docs updated (`docs/USER_GUIDE.md` when relevant)
- [ ] Changelog updated
