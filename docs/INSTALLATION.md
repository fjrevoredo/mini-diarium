# Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/fjrevoredo/mini-diarium/releases).

## Package formats

| Platform | Format                                               |
| -------- | ---------------------------------------------------- |
| Windows  | `.msi` or `.exe` (NSIS installer, no admin required) |
| macOS    | `.dmg`                                               |
| Linux    | `.AppImage`, `.deb`, Flatpak via Flathub, or Docker Runtime |

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

## Docker Runtime (Linux container, browser-rendered desktop)

Mini Diarium can also run as a Linux desktop appliance container. This mode keeps the native Tauri app intact and renders the desktop through your browser at `http://127.0.0.1:6080`.

This mode is for users who specifically want a containerized runtime. Flatpak remains the simpler Linux desktop install.

### What you need

- Docker Engine or Docker Desktop configured for Linux containers.
- The `compose.yaml` file and `docker/` directory from the same Mini Diarium release tag or source checkout.

### First-time setup

Create the GUI password secret on the host:

**Windows / PowerShell**

```powershell
powershell -ExecutionPolicy Bypass -File .\docker\init-secret.ps1
```

**Linux / macOS**

```sh
sh ./docker/init-secret.sh
```

Initialize the persistent volume:

```bash
docker compose run --rm init
```

### Start from a published image

Set the image tag to the exact app version you want, then pull and start:

```bash
export MINI_DIARIUM_IMAGE_TAG=<release-version>
docker compose pull
docker compose up -d
```

Open `http://127.0.0.1:6080` and authenticate with:

- Username: `mini`
- Password: the contents of `docker/secrets/gui-password.txt`

You still need your normal journal password or key file to unlock the journal itself.

### Build from a source checkout

If you are running from the repository instead of a published image:

```bash
docker compose build
docker compose up -d
```

### Persistence and file exchange

- Persistent application and journal state lives in the named volume mounted at `/data`.
- Host file exchange is limited to `/exchange`, which maps by default to `./docker/exchange` or to `MINI_DIARIUM_EXCHANGE_DIR` if you set it.
- Imports, exports, and key files should go through `/exchange` or stay inside `/data`.

### Stop, update, and remove

Stop the runtime without deleting the journal volume:

```bash
docker compose down
```

Update to a newer published image:

```bash
docker compose pull
docker compose up -d
```

Destructive removal of the named volume:

```bash
docker compose down --volumes
```

`--volumes` deletes the persistent `/data` volume and therefore deletes your container-managed journals.

## First-run notes

**Windows**

On first launch, Windows SmartScreen may show a warning ("Windows protected your PC"). This is expected for unsigned applications. Click "More info" then "Run anyway" to proceed. Mini Diarium is open source and builds are reproducible from source.

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
