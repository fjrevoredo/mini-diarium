# Microsoft Store (MSIX) packaging

Mini Diarium ships to the Microsoft Store as an **MSIX with package identity**. The
Store signs the package and manages updates, so there is **no paid code-signing
certificate and no in-app updater** — which keeps the app compatible with its
no-network / no-telemetry non-negotiables (see `PHILOSOPHY.md`).

This directory holds the parts that are versioned in git:

| File | Purpose |
|------|---------|
| `Package.appxmanifest` | MSIX identity manifest. Identity values are filled in from Partner Center and stable for the life of the app; the `Version` is stamped at build time. |
| `.gitignore` | Keeps build outputs (`dist/`, `*.msix`, dev certs) out of git. |

The actual packaging is done by [`../scripts/build-msix.ps1`](../scripts/build-msix.ps1),
used both for local testing and by the CI workflow
[`../.github/workflows/msstore-publish.yml`](../.github/workflows/msstore-publish.yml).

Tile/Store icons are **not** stored here — they are sourced at pack time from
`src-tauri/icons/` (`Square*Logo.png`, `StoreLogo.png`), which the Tauri icon
generator already produces from `public/logo-transparent.svg`. Regenerate them with
`/runbooks update-app-icons` (Claude Code) / `$runbooks update-app-icons` (Codex).

---

## Product identity (filled in — do not change)

The app is **live on the Store** and its identity is already committed in
`Package.appxmanifest`. These values come from Partner Center → your reserved product →
**Product management → Product identity**, and are stable for the life of the app:

| Manifest field | Partner Center value | Committed value |
|----------------|----------------------|-----------------|
| `Identity/@Name` | **Package/Identity Name** | `fjrevoredo.MiniDiarium` |
| `Identity/@Publisher` | **Publisher** (the full `CN=…` string) | `CN=418EE735-930A-47CF-942F-0D0B47D683D7` |
| `Properties/PublisherDisplayName` | **Publisher Display Name** | `fjrevoredo` |

Live product facts (not used in the manifest, but needed for docs, support, CI config, and
`Get-AppxPackage` filtering):

| Fact | Value |
|------|-------|
| Product ID | `9PJFTX44ZS43` (the `MSSTORE_PRODUCT_ID` secret) |
| Store listing | https://apps.microsoft.com/detail/9PJFTX44ZS43 |
| Package Family Name (PFN) | `fjrevoredo.MiniDiarium_4vckxhggeazhp` |

Do **not** tokenize the identity values back out for CI — only `Version` is
machine-rewritten. `build-msix.ps1` keeps a guard that fails the pack step if placeholder
tokens ever reappear in the manifest; it should never fire.

> Store rule: the **publisher name must not equal the product name**. The Tauri
> `identifier` (`com.minidiarium`) is unrelated to MSIX identity and does not need to
> change — MSIX identity comes entirely from Partner Center.

---

## Tooling

```powershell
# winapp CLI (packs the MSIX and generates a local dev cert)
winget install microsoft.winappcli

# msstore CLI (only needed to push submissions; requires .NET 9 Desktop Runtime)
winget install Microsoft.DotNet.DesktopRuntime.9
winget install "Microsoft Store Developer CLI"
```

---

## Local build + smoke test

Do this before ever touching Partner Center — it proves the payload is complete.

```powershell
# 1. Build the Tauri binary, then stage + pack a dev-signed MSIX in one shot.
#    -Build runs `bun run tauri build --no-bundle`; -Pack generates/uses a self-signed dev
#    cert (local test only; the Store re-signs). Version X.Y.Z is mapped to X.Y.Z.0.
pwsh ./scripts/build-msix.ps1 -Version 0.6.2 -Build -Pack

# 2. Trust the dev cert once (elevated), then install the package
#    (build-msix.ps1 prints the exact cert + msix paths it used).
winapp cert install .\msix\devcert.pfx           # run from an elevated shell
Add-AppxPackage .\msix\dist\MiniDiarium_0.6.2.0_x64.msix
```

> **Critical — build the exe with Tauri, not cargo.** The packaged exe MUST come from a
> `tauri build`, never a bare `cargo build` / `cargo test` / `cargo bench`. A cargo-only
> binary has no embedded frontend, so the packaged app navigates to the dev URL
> (`http://localhost:1420`) and fails with **ERR_CONNECTION_REFUSED / "localhost refused
> to connect"**. A cargo rebuild silently overwrites the Tauri-built exe in
> `target/release/`, so use `-Build` (or re-run the Tauri build) whenever the exe might be
> stale. A Tauri-built binary is noticeably larger from the embedded assets (~15 MB here,
> vs ~8 MB cargo-only) — a quick sanity check.

**Before packing** (omit `-Pack`), run the staged app directly to confirm the payload is
complete:

```powershell
pwsh ./scripts/build-msix.ps1 -Version 0.6.2 -Build   # stage only
.\msix\dist\mini-diarium.exe
```

If fonts fail to load, the bundled-font layout is wrong — see the note in
`build-msix.ps1` about the `_up_/fonts` resource subpath (Tauri normalizes the
`../fonts` resource glob to an `_up_\fonts` folder next to the exe). The pack step also
fails loudly if `mini-diarium.exe` or the fonts are missing from `dist\`.

### Smoke-test checklist (installed MSIX, package identity)

- [ ] App launches **with package identity** (`Get-AppxPackage *MiniDiarium*` lists it).
- [ ] Create a journal → unlock → create / save / read encrypted entries.
- [ ] Custom journal directory chosen via the picker writes/reads `diary.db` there.
- [ ] User Rhai plugins in `{app_data_dir}/plugins/*.rhai` load.
- [ ] Import / export and key-file dialogs work through the broker.
- [ ] All three auto-lock paths fire: idle timer, OS screen-lock, focus-loss lock.
- [ ] Works on a machine with **no pre-installed WebView2** (Evergreen runtime).

---

## Known limitation: separate AppData from the GitHub build

An MSIX (Store) install gets a **virtualized, per-package `app_data_dir`** that is
distinct from the one used by the GitHub-download `.exe`/`.msi` build. A user who
already has journals under the classic install will **not** see them in the Store build
(and vice-versa). This is expected MSIX behavior, not a bug. It is a non-issue for the
Store's target audience (new, non-technical users), but existing users migrating from
the GitHub build must move their journal directory by hand (or keep using the build
they started with). This is documented for users in
[`../docs/INSTALLATION.md`](../docs/INSTALLATION.md) ("Microsoft Store (Windows)") and, in
short form, on the Windows platform card of `website/index.html`.

---

## Restricted capability approval: `runFullTrust`

Certification flags `runFullTrust` and asks for a written justification before it
approves the submission. Any *Medium IL* (full-trust) app must declare it, per
Microsoft's own capability docs
([App capability declarations § Restricted capabilities](https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations#special-and-restricted-capabilities)).
No AppContainer or UWP packaging path exists for a native Win32 exe that avoids the
requirement. `Makeappx.exe` enforces this at build time: if the manifest omits
`runFullTrust` and the package needs it, the build fails with a schema error.

Paste this into the Partner Center justification field:

> `runFullTrust` is required because Mini Diarium is packaged via the Desktop Bridge as a
> Medium Integrity Level (full-trust) Win32 application. Per Microsoft's own packaging
> documentation, any Medium IL app must declare this capability, and no AppContainer or
> UWP alternative exists for a native Win32 executable. It grants no privileges beyond
> what the identical unpackaged binary already has through our GitHub, WinGet, and
> Homebrew builds. The app makes no network calls, requests no other capabilities, and
> touches the filesystem via the standard broker-mediated file picker plus its own
> per-user encrypted database and optional user-authored plugin scripts.

---

## Submission flow

- **The first submission is done** — listing text, screenshots, age rating (IARC), and
  privacy declarations were filled in by hand in Partner Center (they cannot be
  automated). The product is live as `9PJFTX44ZS43`.
- **Subsequent package updates are automated** by `msstore-publish.yml`.

See the "Microsoft Store (MSIX)" section of [`../docs/releasing/RELEASING.md`](../docs/releasing/RELEASING.md)
for the full manual-first + CI-update procedure and the required GitHub secrets.
