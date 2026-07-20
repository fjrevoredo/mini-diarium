# Best Practices

Maintainer-focused guidance for changes that affect code quality, security, CI, and diagnosability.

Ownership rule: domain guides describe current structure, workflows, and feature-specific gotchas; best-practice guides describe durable review rules, diagnostics, and regression-prevention checks. Do not duplicate a detailed rule in both places. Link to the owner instead.

- [Rust Best Practices](RUST_BEST_PRACTICES.md) - backend invariants, encrypted data handling, migrations, lock scope, command-core testing, and compatibility shims.
- [Tauri Best Practices](TAURI_BEST_PRACTICES.md) - command registration, IPC validation, error sanitization, WebView security, capabilities, and frontend/backend responsibility boundaries.
- [Frontend Best Practices](FRONTEND_BEST_PRACTICES.md) - SolidJS reactivity, state ownership, Tauri error UI, TipTap/editor flows, accessibility, testing, and E2E stability.
- [CI Best Practices](CI_BEST_PRACTICES.md) - GitHub Actions structure, permissions, caching, release safeguards, artifacts, and failure diagnostics.
- [Context File Best Practices](CONTEXT_FILES_BEST_PRACTICES.md) - authoring rules for CLAUDE.md / AGENTS.md files: what belongs, what doesn't, format guidelines, and an audit checklist.
- [Writing Style Guide](WRITING_STYLE.md) - shared rules for all human-facing prose (blog posts, PR responses, docs): em dashes, filler phrases, voice, and punctuation.
- [Post-Task Completion Best Practices](POST_TASK_BEST_PRACTICES.md) - the six-check checklist every task must pass before being reported as complete (scope assessment, TODO, CHANGELOG, tests, formatting, summary), plus the verbatim summary template to present.

Use these together with the domain guides:

- [Frontend guide](../../src/CLAUDE.md)
- [Backend guide](../../src-tauri/CLAUDE.md)
- [E2E guide](../../e2e/CLAUDE.md)
