## What's Changed

Mini Diarium 0.6.1 ships Brazilian Portuguese (pt-BR) localization covering all UI strings and the native OS menu, and fixes the Linux AppImage to launch on Debian 12 by switching the release CI runner to ubuntu-22.04 (glibc 2.35).

### Added
- **Brazilian Portuguese (pt-BR) translation**: full Brazilian Portuguese localisation covering all 536 UI strings and the native OS menu, with Brazilian conventions throughout (3-letter month/day abbreviations `Jan`–`Dez` / `Dom`–`Sáb`, gerund in `-ando`/`-endo`, "você" form). Selectable from Preferences → General → Language.

### Fixed
- **AppImage GLIBC compatibility with Debian 12 (bookworm)** (TODO-0051): the Linux release build ran on `ubuntu-latest` (resolves to Ubuntu 24.04, glibc 2.39), so the AppImage refused to launch on any distro with an older glibc, including Debian 12 bookworm (glibc 2.36). The Linux leg of `.github/workflows/release.yml` now builds on `ubuntu-22.04` (glibc 2.35), so the AppImage now runs on Debian 12 and other distros with glibc ≥2.35, previously ≥2.38/2.39.