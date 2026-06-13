# Docker Runtime

Mini Diarium's Docker runtime is a Linux desktop appliance container. It runs the unchanged Tauri application on a virtual display and exposes the GUI through a localhost-only browser session.

This is not a web rewrite. The Rust backend, Tauri IPC boundary, encryption, SQLite journal, and GTK dialogs remain intact.

## Supported model

- Linux container only.
- Browser access only through `http://127.0.0.1:6080`.
- One container = one private desktop session.
- Flatpak remains the preferred Linux desktop install when you do not specifically want Docker.

## Quick start

1. Create the GUI password secret on the host:

   - Windows / PowerShell:

     ```powershell
     powershell -ExecutionPolicy Bypass -File .\docker\init-secret.ps1
     ```

   - Linux / macOS:

     ```sh
     sh ./docker/init-secret.sh
     ```

2. Initialize the persistent volume:

   ```sh
   docker compose run --rm init
   ```

3. Start the runtime:

   ```sh
   docker compose up -d
   ```

4. Open `http://127.0.0.1:6080` in your browser.

5. Authenticate with:

   - Username: `mini`
   - Password: the value stored in `docker/secrets/gui-password.txt`

## Persistence

- Persistent state lives in the named volume mounted at `/data`.
- Host file exchange uses `/exchange`, mapped by default to `./docker/exchange`.
- `docker compose down` stops the runtime without deleting the named volume.
- `docker compose down --volumes` deletes the journal volume and is destructive.

## Updating

To use a published image from GHCR, set `MINI_DIARIUM_IMAGE_TAG` to a released app version and pull:

```sh
docker compose pull
docker compose up -d
```

From a source checkout, rebuild locally instead:

```sh
docker compose build
docker compose up -d
```

## Security notes

- The GUI port is intentionally bound to `127.0.0.1` only.
- Publishing the container beyond localhost is unsupported.
- `/exchange` is the only host bind mount in the supported configuration.
- The bootstrap removes the default route before the GUI stack starts and drops all runtime capabilities before handing off to `supervisord`.

