# Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/fjrevoredo/mini-diarium/releases).

## System requirements

| Platform | Minimum version                                            |
| -------- | ---------------------------------------------------------- |
| Windows  | Windows 10 (1809) or later, 64-bit                          |
| macOS    | **macOS 10.15 Catalina** or later (Intel and Apple Silicon) |
| Linux    | Ubuntu 20.04+, Fedora 36+, Arch, or equivalent (`glibc` 2.31+, WebKitGTK 4.1) |

The macOS `.dmg` is a universal binary and runs natively on both Intel and Apple Silicon Macs.
Versions older than Catalina (Mojave 10.14, High Sierra 10.13, and earlier) are **not supported** —
the app will refuse to launch. See [issue #241](https://github.com/fjrevoredo/mini-diarium/issues/241)
for the discussion on older macOS releases.

## Package formats

| Platform | Format                                                        |
| -------- | ------------------------------------------------------------- |
| Windows  | MSIX via the Microsoft Store, or `.msi` / `.exe` (NSIS installer, no admin required) |
| macOS    | `.dmg`                                                        |
| Linux    | `.AppImage`, `.deb`, Flatpak via Flathub, or Nix Flake        |

## Microsoft Store (Windows)

Mini Diarium is available on the [Microsoft Store](https://apps.microsoft.com/detail/9PJFTX44ZS43). The Store signs the package and handles updates, so there is **no SmartScreen warning** on first launch and nothing to update by hand.

Install from the listing page:

```
https://apps.microsoft.com/detail/9PJFTX44ZS43
```

Or open it directly on Windows:

```powershell
start ms-windows-store://pdp/?productid=9PJFTX44ZS43
```

> **Note:** A Store (MSIX) install gets its own virtualized per-package data directory, separate from the one used by the `.exe` / `.msi` build. Journals created in a GitHub or WinGet install will **not** appear in the Store build, and vice versa. This is expected MSIX behavior, not a bug. If you already use Mini Diarium, either stay on the build you started with or move your journal folder across by hand.

## Windows (WinGet)

The easiest way to install Mini Diarium on Windows is via WinGet:

```powershell
winget install fjrevoredo.MiniDiarium
```

To update an existing installation later:

```powershell
winget upgrade fjrevoredo.MiniDiarium
```

## Homebrew (macOS)

The easiest way to install Mini Diarium on macOS is via Homebrew:

```sh
brew tap fjrevoredo/mini-diarium
brew install --cask mini-diarium
```

> **Note:** Mini Diarium is not code-signed. On first launch, macOS Gatekeeper may show a "damaged and can't be opened" error. Run the following command in Terminal, then open the app normally:
>
> ```sh
> xattr -cr "/Applications/Mini Diarium.app"
> ```

## Flatpak (Linux)

Mini Diarium is available on [Flathub](https://flathub.org/apps/io.github.fjrevoredo.mini-diarium). The easiest way to install on Linux is via Flatpak:

```bash
flatpak install flathub io.github.fjrevoredo.mini-diarium
```

To run:

```bash
flatpak run io.github.fjrevoredo.mini-diarium
```

To update:

```bash
flatpak update io.github.fjrevoredo.mini-diarium
```

## Nix Flake (Linux)

Mini Diarium ships a flake for `x86_64-linux` and `aarch64-linux`. Flakes must be enabled (`experimental-features = nix-command flakes`).

Try it without installing:

```bash
nix run github:fjrevoredo/mini-diarium
```

For a persistent installation, add the flake as an input and choose one of the three integration styles:

```nix
{
  inputs.mini-diarium.url = "github:fjrevoredo/mini-diarium";
  # Optional: avoid a second nixpkgs copy.
  inputs.mini-diarium.inputs.nixpkgs.follows = "nixpkgs";
}
```

**1. Bare package** — add to any package list:

```nix
environment.systemPackages = [ inputs.mini-diarium.packages.${pkgs.system}.default ]; # NixOS
# or, for Home Manager:
home.packages = [ inputs.mini-diarium.packages.${pkgs.system}.default ];
```

**2. NixOS module:**

```nix
{
  imports = [ inputs.mini-diarium.nixosModules.default ];
  programs.mini-diarium.enable = true;
}
```

**3. Home Manager module:**

```nix
{
  imports = [ inputs.mini-diarium.homeModules.default ];
  programs.mini-diarium.enable = true;
}
```

An overlay is also exported as `mini-diarium.overlays.default` (adds `pkgs.mini-diarium`).

## First-run notes

**Windows**

Store installs are signed by the Microsoft Store and launch without a warning.

For the GitHub-download and WinGet builds, Windows SmartScreen may show a warning on first launch ("Windows protected your PC"). This is expected for unsigned applications. Click "More info" then "Run anyway" to proceed. Mini Diarium is open source and builds are reproducible from source.

**macOS**

macOS Gatekeeper may block the app on first launch with **"damaged and can't be opened"**. This happens because the app is open-source and not commercially code-signed.

Run this command in Terminal after dragging the app to Applications:

```bash
xattr -cr "/Applications/Mini Diarium.app"
```

Then launch the app normally. This is a one-time step.

**Linux**

No code signing is required. For security, verify the SHA256 checksum against `checksums-linux.txt` from the release before installation:

```bash
sha256sum Mini-Diarium-*.AppImage
# Compare with checksums-linux.txt
```
