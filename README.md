<div align="center">

<img src="public/logo-transparent.svg" alt="Mini Diarium" width="128" />

# Mini Diarium

**A local-only journal with serious encryption.**
Free, open source, and never touches the internet.

[![CI](https://github.com/fjrevoredo/mini-diarium/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/fjrevoredo/mini-diarium/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/fjrevoredo/mini-diarium/graph/badge.svg?token=0ABJIE0333)](https://codecov.io/gh/fjrevoredo/mini-diarium)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=fjrevoredo_mini-diarium&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=fjrevoredo_mini-diarium)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.6.6-blue)](https://github.com/fjrevoredo/mini-diarium/releases)
[![Platform](https://img.shields.io/badge/platform-Windows_%7C_macOS_%7C_Linux-lightgrey)](https://github.com/fjrevoredo/mini-diarium#download)
[![Follow @MiniDiarium](https://img.shields.io/badge/Follow-%40MiniDiarium-000?logo=x&logoColor=white)](https://x.com/MiniDiarium)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy_me_a_coffee-ff5f5f?logo=kofi&logoColor=white)](https://ko-fi.com/fjrevoredo)
[![Donate crypto](https://img.shields.io/badge/Crypto-XMR%20%7C%20BTC%20%7C%20Lightning-FF6600?logo=monero&logoColor=white)](DONATE.md)

[![Tauri v2](https://img.shields.io/badge/Tauri_v2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![SolidJS](https://img.shields.io/badge/SolidJS-2C4F7C?logo=solid&logoColor=white)](https://solidjs.com)
[![Rust](https://img.shields.io/badge/Rust-CE422B?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Flathub](https://img.shields.io/flathub/v/io.github.fjrevoredo.mini-diarium?logo=flathub&logoColor=white&label=Flathub)](https://flathub.org/apps/io.github.fjrevoredo.mini-diarium)
[![Microsoft Store](https://img.shields.io/badge/Microsoft_Store-0078D4)](https://apps.microsoft.com/detail/9PJFTX44ZS43)

[mini-diarium.com](https://mini-diarium.com) · [Download](#download) · [Documentation](https://mini-diarium.com/docs) · [Features](#features) · [Philosophy](PHILOSOPHY.md) · [Benchmarks](https://fjrevoredo.github.io/mini-diarium/benchmarks/)

<img src="public/demo.gif" alt="Demo" width="768" />

## ☕ Support the Project

Mini Diarium is free, open source, and will always be. If you find it useful and want to support its development, consider buying me a coffee on Ko-fi. Every donation goes directly toward keeping this project alive and improving.

<a href="https://ko-fi.com/fjrevoredo" target="_blank">
  <img src="https://storage.ko-fi.com/cdn/kofi2.png" alt="Buy Me a Coffee on Ko-fi" height="48" />
</a>

Prefer crypto? Monero, Bitcoin, and Lightning are below and in [DONATE.md](DONATE.md).

</div>

<details>
<summary><b>Donate with crypto (Monero &middot; Bitcoin &middot; Lightning)</b></summary>

<br />

**Monero (XMR)**, standard mainnet address:

```text
4ApNmqczyAoWsprSrCMsPNKTGhxaH1Cs6agLVaGiKuBBVSotWK9uj3oVQkWYUX9XUGQJyC9WB7cMofE8wfp5BbUoEdcwbjv
```

**Bitcoin (BTC)**, on-chain native SegWit (bech32):

```text
bc1q0y6v888ala2f8r7tm8g30vqt9ma09w9ww4jhum
```

**Bitcoin over Lightning**, a Lightning address that works with Cake Wallet, Phoenix, Zeus, Blink, and Wallet of Satoshi:

```text
mini-diarium@cake.cash
```

Always verify addresses against [DONATE.md](DONATE.md) on `master` before sending. That file also covers network warnings and what donations do and do not buy.

</details>

## Download

Download the latest release for your platform from [GitHub Releases](https://github.com/fjrevoredo/mini-diarium/releases).

Requires **Windows 10 (1809)+**, **macOS 10.15 Catalina+**, or **Linux** (Ubuntu 20.04+, Fedora 36+, Arch, or equivalent).

Quick install:

- Windows (Microsoft Store): [apps.microsoft.com/detail/9PJFTX44ZS43](https://apps.microsoft.com/detail/9PJFTX44ZS43)
- Windows (WinGet): `winget install fjrevoredo.MiniDiarium`
- macOS (Homebrew): `brew tap fjrevoredo/mini-diarium` then `brew install --cask mini-diarium`
- Linux (Flatpak): `flatpak install flathub io.github.fjrevoredo.mini-diarium`
- NixOS / Nix (Flakes): `nix run github:fjrevoredo/mini-diarium`

For package formats, first-run notes (Gatekeeper / SmartScreen), and checksum verification, see [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Quick Start

1. Launch Mini Diarium
2. Create a password (this encrypts your journal; there is no recovery if forgotten)
3. Write your first entry. It auto-saves as you type
4. Navigate between days with `Ctrl+[` / `Ctrl+]` or click dates on the calendar
5. Lock your journal when you're done

## Background

Mini Diarium is a spiritual successor to [Mini Diary](https://github.com/samuelmeuli/mini-diary) by Samuel Meuli. I loved the original tool. It was simple, private, and did exactly what a journal app should do. Unfortunately, it's been unmaintained for years and its dependencies have aged out. I initially thought about forking it and modernizing the stack, but turned out impractical. So I started over from scratch, keeping the same core philosophy (encrypted, local-only, focused) while rebuilding completely with Tauri 2, SolidJS, and Rust. The result is a lighter, faster app with stronger encryption and a few personal touches.

## Philosophy First

Mini Diarium is intentionally opinionated. The philosophy is not a side note, it is the product:

- **Small, extensible core**: keep core responsibilities tight (encrypt, store, authenticate) and push extras to extension points
- **Boring security**: use established algorithms and audited libraries, never custom crypto
- **Local-only by design**: no cloud sync, no telemetry, no analytics, no hidden network behavior
- **Easy in, easy out**: import from common formats and export in open formats to avoid lock-in
- **Focused scope**: private journaling over feature sprawl
- **Simplicity over cleverness**: fewer moving parts, smaller attack surface, easier maintenance

Read the full principles and how these translates to the architecture in [PHILOSOPHY.md](PHILOSOPHY.md).

> [!NOTE]
> Mini Diarium uses AI tooling as leverage for human engineers, never as a replacement. Every change still passes through deliberate design, careful implementation, proper testing, and direct feedback. Responsibility, authorship, and final judgment remain human.

## Features

- **Key file authentication**: unlock your journal with an X25519 private key file instead of (or alongside) your password, like SSH keys for your journal. See [docs/KEY_FILE_AUTHENTICATION.md](docs/KEY_FILE_AUTHENTICATION.md).
- **Local-only journals**: create journals that auto-unlock on your device (no password prompt) while still encrypting entries at rest.
- **AES-256-GCM encryption**: all entries are encrypted with a random master key. Each auth method holds its own wrapped copy of that key, so adding or removing a method is O(1), with no re-encryption of your entries.
- **Multiple journals**: keep separate journals for different purposes (personal, work, travel).
- **Rich text editor**: including images.
- **Tags**
- **Multiple entries per day**: keep separate entries for the same date without merging them together
- **Calendar navigation**
- **Import**: Mini Diary JSON, Day One JSON/TXT, and jrnl JSON with additive imports that preserve separate same-date entries
- **Export**: JSON for structural fidelity and Markdown for human-readable best-effort export
- **Themes**
- **Automatic backups**: verified encrypted snapshots taken before migrations and destructive actions, with tiered retention going back a year
- **Statistics**
- **Preferences**: first day of week, future entries toggle, title visibility, spellcheck, auto-lock, password change, authentication method management
- **Cross-platform**: Windows, macOS, and Linux
- **Zero network access**: no telemetry, no analytics, no update checks

## Documentation

- Online user docs: https://mini-diarium.com/docs
- Offline / GitHub user guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- Installation: [docs/INSTALLATION.md](docs/INSTALLATION.md)
- Key file authentication: [docs/KEY_FILE_AUTHENTICATION.md](docs/KEY_FILE_AUTHENTICATION.md)
- Architecture diagrams and flows: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Known issues / tradeoffs: [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)
- Privacy: [docs/PRIVACY.md](docs/PRIVACY.md)
- Security model + reporting: [SECURITY.md](SECURITY.md)
- User plugins (Rhai): [docs/user-plugins/USER_PLUGIN_GUIDE.md](docs/user-plugins/USER_PLUGIN_GUIDE.md)

## Architecture

For the diagrams and detailed data flows, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Keyboard Shortcuts

| Action         | Shortcut       |
| -------------- | -------------- |
| Previous Day   | `Ctrl+[`       |
| Next Day       | `Ctrl+]`       |
| Go to Today    | `Ctrl+T`       |
| Go to Date     | `Ctrl+G`       |
| Previous Month | `Ctrl+Shift+[` |
| Next Month     | `Ctrl+Shift+]` |
| Preferences    | `Ctrl+,`       |

Statistics, Import, and Export are available via the Journal menu (no default keyboard accelerators).

On macOS, use `Cmd` instead of `Ctrl`.

## Building from Source

**Prerequisites:** Rust (see `rust-toolchain.toml`), Bun 1.x, and [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/).

For detailed platform-specific instructions (Linux package names, Fedora setup, Wayland troubleshooting), see [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/fjrevoredo/mini-diarium.git
cd mini-diarium
bun install
bun run tauri build
```

Artifacts will be in `target/release/bundle/` (the Cargo workspace root owns `target/`).

## Tech Stack

- [Tauri 2](https://v2.tauri.app/): desktop app framework (Rust backend, web frontend)
- [SolidJS](https://www.solidjs.com/): reactive UI framework
- [Rust](https://www.rust-lang.org/): backend logic, encryption, database
  - `x25519-dalek`, `hkdf`, `sha2`: X25519 ECIES key wrapping for key file authentication
- [SQLite](https://www.sqlite.org/): local encrypted database storage
- [TipTap](https://tiptap.dev/): rich text editor
- [UnoCSS](https://unocss.dev/): utility-first CSS
- [Kobalte](https://kobalte.dev/): accessible UI primitives

## Known Issues

For the full list of known limitations, deliberate tradeoffs, and technical debt, see [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

**User-facing highlights:**

- Concurrent access to the same journal file is not supported (by design)
- No password recovery — losing all credentials is permanent (by design)
- Full-text search runs as an in-memory scan over decrypted entries (added back after the v0.2.0 FTS removal); nothing searchable is written to disk
- Importing the same file twice creates duplicate entries (no deduplication)
- Plugin changes require an app restart to take effect

## Extending Mini Diarium

You can add local import/export extensions using Rhai scripts in your journal's `plugins/` folder.
See [docs/user-plugins/USER_PLUGIN_GUIDE.md](docs/user-plugins/USER_PLUGIN_GUIDE.md) for requirements, best practices, and a complete example plugin.

## Performance Benchmarks

Criterion benchmarks for the crypto and database hot paths are tracked on every push to `master` and published at **[fjrevoredo.github.io/mini-diarium/benchmarks/](https://fjrevoredo.github.io/mini-diarium/benchmarks/)**.

The page covers four areas: Argon2id key derivation (intentionally slow — ~200 ms to resist brute-force), AES-256-GCM encrypt/decrypt at three entry sizes, SQLite operations (insert, update, delete, date enumeration, full scan), and word-count calculation. Each card shows the latest timing and a Chart.js trend chart over the last 30 CI runs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development workflow, and conventions.
For maintainers adding official plugins, see [docs/BUILTIN_PLUGIN_GUIDE.md](docs/BUILTIN_PLUGIN_GUIDE.md).
For maintainers changing frontend UI/state, the Rust backend, Tauri IPC boundary, WebView security, or CI, see [docs/best-practices](docs/best-practices/README.md).

### Translations

Mini Diarium ships in the following languages:

<!-- supported-languages-start -->
- English
- French (Français)
- German (Deutsch)
- Hindi (हिन्दी)
- Italian (Italiano)
- Portuguese (Brazil) (Português (Brasil))
- Spanish (Español)
<!-- supported-languages-end -->

If you'd like to add support for another language, see [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md) for instructions on creating a locale file and submitting a PR.

## Releasing

For maintainers: See [docs/RELEASING.md](docs/RELEASING.md) for step-by-step release instructions.

## Security

See [SECURITY.md](SECURITY.md) for the security model and how to report vulnerabilities.

## License

Mini Diarium is licensed under the MIT License. See [LICENSE](LICENSE).

## Credits

Made with love by [Francisco J. Revoredo](https://github.com/fjrevoredo) (with a little help from Claude Code).

## Contributors

Thanks to everyone who has contributed code, translations, or improvements to Mini Diarium:

<a href="https://github.com/jottyfan"><img src="https://github.com/jottyfan.png?size=40" width="40" height="40" alt="jottyfan" /></a>
<a href="https://github.com/Yujonpradhananga"><img src="https://github.com/Yujonpradhananga.png?size=40" width="40" height="40" alt="Yujonpradhananga" /></a>
<a href="https://github.com/albanobattistella"><img src="https://github.com/albanobattistella.png?size=40" width="40" height="40" alt="albanobattistella" /></a>
<a href="https://github.com/tyler274"><img src="https://github.com/tyler274.png?size=40" width="40" height="40" alt="tyler274" /></a>
<a href="https://github.com/bronty13"><img src="https://github.com/bronty13.png?size=40" width="40" height="40" alt="bronty13" /></a>
<a href="https://github.com/kenlacroix"><img src="https://github.com/kenlacroix.png?size=40" width="40" height="40" alt="kenlacroix" /></a>

## Star History

<a href="https://www.star-history.com/?repos=fjrevoredo%2Fmini-diarium&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=fjrevoredo/mini-diarium&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=fjrevoredo/mini-diarium&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=fjrevoredo/mini-diarium&type=date&legend=top-left" />
 </picture>
</a>
