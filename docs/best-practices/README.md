# Best Practices

Maintainer-focused guidance for changes that affect code quality, security, CI, and diagnosability.

- [Rust Best Practices](RUST_BEST_PRACTICES.md) - backend invariants, encrypted data handling, migrations, lock scope, command-core testing, and compatibility shims.
- [Tauri Best Practices](TAURI_BEST_PRACTICES.md) - command registration, IPC validation, error sanitization, WebView security, capabilities, and frontend/backend responsibility boundaries.
- [Frontend Best Practices](FRONTEND_BEST_PRACTICES.md) - SolidJS reactivity, state ownership, Tauri error UI, TipTap/editor flows, accessibility, testing, and E2E stability.
- [CI Best Practices](CI_BEST_PRACTICES.md) - GitHub Actions structure, permissions, caching, release safeguards, artifacts, and failure diagnostics.

Use these together with the domain guides:

- [Frontend guide](../../src/CLAUDE.md)
- [Backend guide](../../src-tauri/CLAUDE.md)
- [E2E guide](../../e2e/CLAUDE.md)
