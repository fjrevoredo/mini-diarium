# Docker Runtime Proposal

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-06-13
- Last Updated: 2026-06-13
- Owner: Coding agent
- Approval: PENDING

## Executive Summary

Running Mini Diarium in Docker is feasible without rewriting it as a web application. The sustainable design is a **Linux desktop appliance container**:

```text
Host browser
  -> 127.0.0.1:<configured port>
  -> noVNC/websockify
  -> TigerVNC Xvnc virtual display
  -> lightweight window manager
  -> unchanged Mini Diarium Tauri binary
  -> persistent /data volume
```

This is not the same as serving the SolidJS frontend as a website. The Tauri Rust process, IPC boundary, encryption implementation, SQLite database, native dialogs, and WebKitGTK runtime all remain intact.

The recommended container should:

- run the unchanged production Linux binary as a non-root user;
- expose the GUI in a browser through a localhost-only published port;
- remove the container's default route before starting any plaintext-bearing process, then drop all effective capabilities;
- persist all application, journal, WebView, and preference state in one named volume mounted at `/data`;
- optionally mount one narrowly scoped `/exchange` host directory for imports, exports, and key files;
- use a multi-stage, reproducible build and publish versioned OCI images to GHCR;
- be tested in CI as a supported release artifact, not kept as an undocumented example.

This mode should be documented as **Docker Runtime (Linux container, browser-rendered desktop)**. Flatpak should remain the preferred installation-free-like experience for Linux desktop users because it has better native desktop integration and a smaller operational stack.

## Second-Pass Empirical Findings

The proposal was tested on 2026-06-13 using Docker Desktop 4.76.0, Docker Engine 29.5.2, Linux containers on WSL2, and the released Mini Diarium 0.5.3 `.deb`.

| Assumption | Result | Proposal impact |
| --- | --- | --- |
| An `internal: true` network can still serve a localhost-published port | **Disproved.** Egress failed, but `127.0.0.1:<port>` was also unreachable. | Remove the original internal-network single-container design. |
| A normal bridge plus localhost port publishing is sufficient | **Partially true.** GUI access worked, but DNS and raw-IP egress also worked. | Localhost binding protects reachability, not outbound isolation. |
| A split internal app plus bridge-connected GUI gateway solves isolation cleanly | **Technically works, security rejected.** The app had no egress and the gateway was reachable, but the gateway saw keystrokes/decrypted pixels and retained egress. | Do not use a sensitive outbound-capable gateway. |
| A published-port container can remove its default route and remain reachable | **Confirmed.** Host GUI access remained functional while DNS and raw-IP egress failed. | Use a fail-closed route-guard bootstrap. |
| The real Tauri app runs under Xvnc/noVNC | **Confirmed.** The released app rendered correctly, and a native GTK directory dialog worked. | Runtime approach is viable without a web rewrite. |
| Debian Bookworm is a compatible runtime | **Disproved.** The released binary requires `GLIBC_2.39`; Bookworm provides 2.36. | Pin build and runtime to the same Ubuntu 24.04-class ABI lineage. |
| A fresh named volume works with direct `USER app` startup | **Disproved.** The fresh volume was root-owned and `/data` initialization failed. | Add a one-shot volume initialization service before the runtime starts. |
| Least-privilege runtime settings are compatible | **Confirmed after initialization.** The app worked with read-only root, writable `/tmp` and `/data`, zero effective capabilities, and `no-new-privileges`. | Make these mandatory acceptance criteria. |
| TigerVNC password is adequate GUI authentication | **Disproved.** Password material is eight bytes and values sharing the first eight characters produce the same verifier. | Do not expose VNC auth as the primary access control. |
| The runtime image will be small | **Disproved.** The unoptimized spike image was approximately 966 MB unpacked. | Treat image size and dependency ownership as explicit sustainability work. |

The second pass therefore strengthens the feasibility conclusion but changes the architecture materially. Docker support is possible, but only if ingress-only networking is implemented as a tested runtime invariant rather than assumed from Compose networking.

## Decision

**Recommend implementation, with a deliberately narrow support contract.**

| Area | Decision |
| --- | --- |
| Application architecture | Keep the Tauri desktop application unchanged |
| GUI transport | TigerVNC `Xvnc` plus noVNC/websockify |
| Host access | Browser at `http://127.0.0.1:<port>` only |
| Outbound network | Fail-closed route-guard bootstrap removes the default route before app startup |
| Persistence | Named volume at `/data` |
| Host file exchange | Optional bind mount at `/exchange`, never the whole home directory |
| Process user | One-shot root volume initializer; runtime drops to fixed non-root UID/GID |
| Process management | Minimal init/supervisor with explicit child health and shutdown behavior |
| Supported hosts | Docker Engine or Docker Desktop capable of running Linux containers |
| Initial architectures | `linux/amd64`; add `linux/arm64` only after native CI validation |
| Distribution | GHCR image tagged with app version and immutable digest |
| Default recommendation | Flatpak for Linux desktop; Docker for users who specifically want container isolation/portability |

## Why This Is Feasible

### The repository already proves the core technical path

- Mini Diarium is a Tauri v2 Linux application using WebKitGTK. The Linux release build installs `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, and `librsvg2-dev`.
- Linux E2E already runs the real compiled binary under `xvfb-run`, proving the application can run on a virtual display without a physical desktop session.
- The Flatpak manifest already builds the production binary with `custom-protocol` and runs it against a controlled GNOME runtime.
- The application already has explicit filesystem boundaries:
  - `{app_data_dir}/config.json` and `{app_data_dir}/plugins/`;
  - journal `diary.db` files and adjacent `backups/`;
  - WebView storage containing non-sensitive preferences in `localStorage`.
- Native file dialogs are already part of the Tauri application. They will operate inside the container and can be constrained to `/data` and `/exchange`.

### The container does not require a web rewrite

Serving `dist/` from nginx would not work. The frontend depends on Tauri IPC commands for authentication, encryption, database access, files, fonts, images, tags, import/export, and menus. Replacing that IPC layer with HTTP would create a second application architecture, add a network API carrying plaintext journal content, and violate the project's small-core and no-network principles.

## Recommended Architecture

### Runtime components

Use an Ubuntu 24.04-class runtime compatible with WebKitGTK 4.1 and the Linux release ABI. The build and runtime stages must share the same pinned ABI lineage; the released 0.5.3 binary does not run on Debian Bookworm because it requires `GLIBC_2.39`.

Install only the runtime dependencies:

- Mini Diarium release binary and bundled fonts;
- WebKitGTK 4.1 runtime libraries;
- TigerVNC `Xvnc`, which combines an X server and virtual framebuffer;
- a minimal window manager such as Openbox for native dialogs and window focus;
- noVNC and websockify for browser access;
- `supervisord` for deterministic startup, shutdown, restart policy, and health inspection;
- minimal font, D-Bus, and GTK support required by WebKitGTK.

Do not include Bun, Node.js, Rust, Cargo, compilers, source files, package-manager caches, or build secrets in the runtime image.

### Process model

The runtime has two phases:

1. a one-shot volume initializer prepares `/data` ownership and exits;
2. the runtime bootstrap starts with only `NET_ADMIN`, `SETUID`, and `SETGID`, removes the default route, verifies the route is absent, drops to the fixed application UID/GID, enables `no-new-privileges`, and launches the supervisor with zero effective capabilities.

The supervisor should own these processes:

1. `Xvnc` on an internal-only VNC socket;
2. the window manager;
3. Mini Diarium;
4. websockify/noVNC on the container GUI port.

The container should stop if Mini Diarium exits unexpectedly. Restarting the container must drop all in-memory keys and require journal unlock again. Startup must fail before Mini Diarium starts if route removal or privilege dropping fails.

### Network model

Docker does not provide a portable declarative network mode that both permits a published localhost port and removes outbound connectivity. Empirical testing showed:

- `internal: true`: no egress, but the published host port is unreachable;
- normal bridge: published host port works, but egress also works;
- split app/gateway: app isolation works, but the sensitive GUI gateway retains egress.

The supported single-container configuration should therefore publish exactly one port on a normal bridge:

```yaml
ports:
  - "127.0.0.1:${MINI_DIARIUM_PORT:-6080}:6080"

```

Before any GUI or application process starts, the bootstrap must delete the default route and verify:

```text
no default route exists
raw-IP outbound connection fails
DNS resolution fails or is unusable for connection
localhost-published GUI remains reachable
runtime PID 1 has zero effective/permitted capabilities
```

The bootstrap requires narrowly scoped startup capabilities. After it hands off to the application user, `CapEff` and `CapPrm` must be zero and `NoNewPrivs` must be enabled. This is less elegant than a declarative internal network, so it must be covered by startup checks and CI regression tests. No VNC port should be published. The GUI port must never default to `0.0.0.0`.

The browser transport changes the wording of the security claim:

- The **Mini Diarium process** still makes no network requests.
- The **container appliance** accepts a localhost-only GUI connection and internally proxies display traffic.
- Every plaintext-bearing process in the container has no outbound route.
- Publishing the GUI beyond localhost is unsupported and unsafe unless the operator adds an independently secured reverse proxy and accepts the expanded threat model.

### GUI access authentication

Localhost binding is necessary but not sufficient because another local process or same-host user could connect to an unlocked session. TigerVNC's built-in password is not acceptable as the primary control because it effectively uses only the first eight characters.

The supported configuration should put a small authenticated HTTP/WebSocket reverse proxy in front of noVNC and require a strong GUI access secret in addition to the journal password. noVNC/websockify and VNC remain reachable only inside the container.

Recommended flow:

- provide a small cross-platform initialization command that creates a Docker Compose secret file with restrictive permissions;
- mount it through Compose secrets, not an environment variable;
- configure the authenticated reverse proxy from that secret;
- fail closed when the secret is missing or empty;
- never print the secret in container logs.

Loopback HTTP authentication does not protect against malicious local software, which is already outside the application's threat model, but it prevents casual same-host access to an unlocked session. Remote/public exposure remains unsupported. KasmVNC should not be adopted without a separate review of image size, dependency cost, configuration complexity, authentication, and outbound/WebRTC behavior.

### Persistence contract

Set stable container paths:

```text
HOME=/data/home
XDG_DATA_HOME=/data/xdg/data
XDG_CONFIG_HOME=/data/xdg/config
XDG_STATE_HOME=/data/xdg/state
XDG_CACHE_HOME=/tmp/xdg-cache
```

Mount one named volume:

```yaml
volumes:
  - mini-diarium-data:/data
```

This keeps the following across container replacement:

- journal databases and encrypted backups;
- `config.json`, including the journal registry and any passwordless auto-key;
- user Rhai plugins;
- WebKitGTK `localStorage` preferences;
- window state where applicable.

Cache and runtime files should remain ephemeral under `/tmp`.

A fresh named volume is root-owned. Compose must run a one-shot initializer that creates the required directories, sets ownership to the fixed UID/GID, writes a versioned initialization marker, and exits before the runtime service starts. The steady-state runtime must not retain `CHOWN`.

Use `/exchange` as the only optional host bind mount:

```yaml
volumes:
  - type: bind
    source: ${MINI_DIARIUM_EXCHANGE_DIR}
    target: /exchange
```

This preserves import/export usability without granting the container write access to the host home directory. Documentation must warn users not to store a key file beside its protected journal if their threat model assumes the journal volume may be stolen.

### Container hardening

The supported Compose service should include, subject to compatibility testing:

- a root bootstrap only long enough to remove the route and drop UID/GID; every steady-state process runs as the fixed non-root user;
- `security_opt: ["no-new-privileges:true"]`;
- `cap_drop: ["ALL"]`, with only bootstrap-time `NET_ADMIN`, `SETUID`, and `SETGID` available before the handoff;
- Docker's default seccomp profile;
- no `privileged`, no host PID/IPC/network namespace, no Docker socket;
- a read-only root filesystem;
- writable `tmpfs` mounts for `/tmp`, `/run`, and any required transient GTK/WebKit paths;
- explicit memory and shared-memory guidance for WebKitGTK;
- log rotation limits;
- a health check that verifies the supervisor, Mini Diarium process, virtual display, and noVNC listener;
- a health check/startup check that verifies no default route and no effective capabilities;
- pinned base-image version/digest and pinned noVNC/websockify sources.

Do not add `/dev/dri` initially. Software rendering is more portable and matches the application's existing Linux fallback behavior. GPU acceleration can be evaluated later as an optional profile.

## User Experience

The target workflow should be:

```bash
docker compose run --rm init
docker compose up -d
```

Then open:

```text
http://127.0.0.1:6080
```

Stopping or upgrading:

```bash
docker compose down
docker compose pull
docker compose up -d
```

`docker compose down` must not delete the named data volume. Destructive removal with `--volumes` must be prominently documented.

The file picker should open inside the container. Users can select persistent files under `/data` or host-shared files under `/exchange`. Direct browsing of arbitrary host paths is intentionally unsupported.

## Compatibility And Limitations

| Capability | Expected result |
| --- | --- |
| Core writing, encryption, journals, tags, backups | Supported |
| Preferences in `localStorage` | Supported when `/data` persists |
| Import/export | Supported through `/exchange` |
| Key-file authentication | Supported through `/exchange` or `/data`; threat-model warning required |
| Native dialogs | Confirmed working inside the virtual desktop |
| Clipboard | Must be validated; browser/VNC clipboard behavior may vary |
| Drag and drop from host desktop | Likely unsupported through browser VNC; use `/exchange` and file picker |
| Printing | Browser/VNC printing behavior is not equivalent to native desktop printing; validate and document |
| OS session-lock auto-lock | Not supported on Linux today because the Linux screen-lock hook is a no-op |
| Frontend inactivity auto-lock | Supported |
| Host browser opening for documentation links | Not expected to behave like native desktop; document as unsupported or disable in container mode |
| Audio, camera, microphone | Not needed and should not be exposed |
| Multiple simultaneous users | Unsupported; one container is one private desktop session |
| Remote/public deployment | Unsupported |
| Windows/macOS native binary in Docker | Unsupported; the image runs the Linux build |

The most important functional gap is OS session-lock auto-lock. Container users must rely on the existing frontend inactivity timer and manual lock. The implementation should default inactivity auto-lock to an appropriately conservative value for container mode or clearly prompt users to enable it; this requires a product decision before implementation.

## Alternatives Considered

### 1. Serve the frontend as a normal web application

**Rejected.** This requires replacing Tauri IPC with a network API, creates a separate security model, exposes plaintext over that API while unlocked, duplicates application architecture, and conflicts with the no-network principle.

### 2. Forward the host X11 or Wayland socket into the container

**Rejected as the default.** It is Linux-host-specific, difficult on Docker Desktop, grants sensitive access to the host display server, and does not meet the goal of working without additional host GUI software. It may be documented later as an expert-only hardened profile with `network_mode: none`.

### 3. Put Flatpak inside Docker

**Rejected.** Nested sandboxing adds complexity and often needs privileges without improving the user-facing result. The existing Flatpak is already the better solution for Linux users who want sandboxed native desktop integration.

### 4. Use a large third-party desktop-container base image

**Rejected as the first implementation.** Images such as full web desktops reduce initial work but add a large dependency and attack surface controlled outside this project. The runtime stack is small enough to own explicitly.

### 5. Use AppImage as the runtime payload

**Rejected.** Running AppImage inside a container often requires FUSE or extraction workarounds. Copying the release binary into a purpose-built runtime image is simpler and easier to test.

### 6. Split the app and GUI gateway into separate containers

**Rejected after empirical validation.** It cleanly removes egress from the Mini Diarium process, but the gateway still sees passwords, keystrokes, and decrypted pixels while retaining outbound connectivity. This weakens the useful security boundary.

### 7. Rely on TigerVNC password authentication

**Rejected after empirical validation.** TigerVNC's password verifier uses only the first eight characters. Use a modern authenticated HTTP/WebSocket reverse proxy instead.

## Sustainability Requirements

The Docker runtime is sustainable only if treated like other release formats:

- Source-controlled Dockerfile, Compose file, supervisor configuration, scripts, and documentation.
- One canonical image build; no separate hand-built image repository.
- Multi-stage build uses the existing lockfiles and `custom-protocol` release feature.
- Image versions match Mini Diarium versions.
- Build and runtime ABI lineages remain pinned together.
- Release workflow publishes immutable version tags and digests to GHCR.
- CI builds the image on every PR and executes a container-specific smoke test.
- Dependency updates include the base image and remote-desktop stack.
- Security documentation explicitly covers localhost GUI transport, the data volume, `/exchange`, and unsupported remote deployment.
- Startup and CI fail if the default route remains or runtime capabilities are non-zero.
- Image-size changes are reviewed; the initial spike was approximately 966 MB unpacked.
- The implementation does not add container-only branches to core encryption, database, or journal behavior.

## Proposed Repository Changes

Expected new artifacts:

```text
.dockerignore
compose.yaml
docker/
  Dockerfile
  README.md
  entrypoint.sh
  healthcheck.sh
  init.sh
  route-guard.sh
  supervisor.conf
  proxy.conf
```

Expected updates:

- `.github/workflows/ci.yml`: build and smoke-test the image.
- `.github/workflows/release.yml`: publish versioned GHCR images after release verification.
- `docs/INSTALLATION.md`: Docker runtime installation and lifecycle.
- `SECURITY.md`: exact container threat model and localhost GUI transport.
- `docs/KNOWN_ISSUES.md`: container-specific limitations.
- `website/docs-src/00-getting-started.md` and FAQ: user-facing Docker guidance.
- `CHANGELOG.md`: user-visible Docker runtime support.

No changes should initially be required in `src/` or `src-tauri/`. If implementation testing proves a small container-mode signal is required, it must be narrowly scoped, documented, and must not weaken normal desktop behavior.

## Implementation Plan

### Milestone 1: Productionize The Validated Runtime

- Status: TO BE DONE
- Purpose: Turn the validated proof of concept into a pinned, maintainable runtime.
- Exit Criteria: The production image runs the unchanged binary with ABI alignment, authenticated GUI access, initialized persistence, no outbound route, and least privilege.

#### Task 1.1: Build Minimal Runtime Image

- Status: TO BE DONE
- Objective: Produce a multi-stage image containing the release binary and only required runtime packages.
- Steps:
  1. Build frontend assets and the Rust binary with `custom-protocol` in an Ubuntu 24.04-class builder.
  2. Copy the binary and fonts into an ABI-matched pinned runtime stage.
  3. Add a fail-closed bootstrap that hands off to a fixed non-root user before sensitive processes start.
- Validation: `docker build` succeeds from a clean checkout; the final image contains no build toolchains/source tree; the binary starts; ABI checks pass.
- Notes: Pin the base image by version and digest before merge. Record and review the image size.

#### Task 1.2: Prove Virtual Desktop Stack

- Status: TO BE DONE
- Objective: Display and control Mini Diarium through a browser using Xvnc, a window manager, and noVNC.
- Steps:
  1. Configure Xvnc and the window manager.
  2. Configure noVNC/websockify without publishing the raw VNC port.
  3. Add a modern authenticated reverse proxy in front of noVNC.
  4. Add deterministic process supervision and shutdown.
- Validation: The app is usable only after GUI authentication at `http://127.0.0.1:6080`, raw VNC/noVNC backends are not host-published, and stopping the container cleanly terminates all child processes.
- Notes: Do not use TigerVNC's eight-character password as the primary access control.

#### Task 1.3: Validate Core User Flows

- Status: TO BE DONE
- Objective: Confirm container mode preserves critical behavior.
- Steps:
  1. Create, lock, unlock, edit, and reopen a password-protected journal.
  2. Restart and replace the container while preserving the data volume.
  3. Test native dialogs, imports, exports, key files, plugins, clipboard, image insertion, and printing.
  4. Record supported and unsupported behavior.
- Validation: Critical journal flow survives container replacement; native dialogs work; all limitation claims are backed by observed results.
- Notes: Drag/drop, printing, clipboard, and opener links are explicit investigation targets.

### Milestone 2: Security And Storage Contract

- Status: TO BE DONE
- Purpose: Make the runtime align with the project's privacy and portability principles.
- Exit Criteria: The container has stable persistence, authenticated localhost GUI access, no outbound route, and least-privilege runtime settings.

#### Task 2.1: Define Persistent And Exchange Mounts

- Status: TO BE DONE
- Objective: Persist every required state type while limiting host filesystem exposure.
- Steps:
  1. Set stable `HOME` and XDG paths under `/data`.
  2. Add a one-shot initializer for fresh-volume ownership and directory creation.
  3. Persist `/data` through a named volume.
  4. Add optional `/exchange` bind mount support.
  5. Verify multi-journal absolute paths remain valid across replacement.
- Validation: Journals, backups, config, plugins, window state, and `localStorage` survive image replacement; imports/exports work through `/exchange`.
- Notes: Do not use the E2E-only `MINI_DIARIUM_DATA_DIR` override as the production storage contract.

#### Task 2.2: Enforce Network And GUI Access Boundaries

- Status: TO BE DONE
- Objective: Permit localhost GUI access without outbound container connectivity.
- Steps:
  1. Bind the GUI port explicitly to `127.0.0.1`.
  2. Add a fail-closed bootstrap that removes and verifies absence of the default route before starting sensitive processes.
  3. Drop to the fixed UID/GID with zero effective capabilities and `no-new-privileges`.
  4. Require GUI authentication from a Compose secret.
  5. Fail startup when route isolation, privilege drop, or authentication is not configured.
- Validation: Host browser can connect; another LAN device cannot connect; outbound DNS, HTTP, and raw IP connection attempts fail; PID 1 has zero effective/permitted capabilities.
- Notes: Do not publish raw VNC.

#### Task 2.3: Apply Least-Privilege Hardening

- Status: TO BE DONE
- Objective: Minimize the runtime attack surface without breaking WebKitGTK.
- Steps:
  1. Drop Linux capabilities after the route-guard bootstrap and enable `no-new-privileges`.
  2. Make the root filesystem read-only and add only required tmpfs paths.
  3. Retain Docker's default seccomp profile.
  4. Add health checks and bounded logs.
- Validation: The critical-flow checks pass with hardening enabled; inspection confirms no privileged mode, host namespaces, Docker socket, or broad bind mounts.
- Notes: Add exceptions only when a reproducible failure proves they are required.

### Milestone 3: Productization

- Status: TO BE DONE
- Purpose: Make Docker a tested, documented, maintainable release format.
- Exit Criteria: CI validates the runtime, releases publish it, and user/security documentation is complete.

#### Task 3.1: Add Container CI

- Status: TO BE DONE
- Objective: Catch Docker runtime regressions on every pull request.
- Steps:
  1. Build the image after existing lint and test jobs pass.
  2. Run static checks on Docker and Compose configuration.
  3. Start the container and wait for its health check.
  4. Run a container-specific critical-flow test against the virtual display.
  5. Verify outbound network attempts fail and published localhost access still works.
- Validation: CI fails on image build, process-health, persistence, GUI, or network-isolation regressions.
- Notes: Reuse existing E2E flows where practical; do not maintain a second broad E2E suite.

#### Task 3.2: Publish Versioned Images

- Status: TO BE DONE
- Objective: Publish reproducible images as release artifacts.
- Steps:
  1. Add GHCR publishing after release asset verification.
  2. Tag images with the exact app version and immutable digest.
  3. Generate provenance/SBOM metadata if supported by the release workflow.
  4. Document architecture support and upgrade behavior.
- Validation: A release candidate image can be pulled by version, passes smoke tests, and reports the matching Mini Diarium version.
- Notes: Do not publish `latest` until the versioned workflow is proven reliable.

#### Task 3.3: Document Usage And Threat Model

- Status: TO BE DONE
- Objective: Ensure users understand setup, persistence, backups, updates, and security limits.
- Steps:
  1. Add installation, initialization, start/stop, update, backup, restore, and removal instructions.
  2. Document `/data`, `/exchange`, GUI authentication, localhost binding, and destructive volume deletion.
  3. Update security claims to distinguish the application process from the GUI transport.
  4. Document unsupported remote/public deployment, route-guard behavior, GUI proxy authentication, and OS-lock auto-lock limitations.
- Validation: A new user can follow the docs from Docker installation to a persistent journal without repository knowledge.
- Notes: User-facing docs under `website/docs-src/` are authoritative and must be updated.

### Milestone 4: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure only maintainable artifacts ship and the full implementation is verified.
- Exit Criteria: Temporary spike artifacts are removed, documentation is consistent, and all release-quality checks pass.

#### Task 4.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only for the implementation spike.
- Steps:
  1. Remove temporary images, debug scripts, test volumes, logs, screenshots, and obsolete configuration variants.
  2. Keep only maintainable tests, scripts, docs, and generated files required by the repository contract.
  3. Add the user-visible change to `CHANGELOG.md`.
- Validation: Worktree diff contains only intentional final artifacts.
- Notes: Do not remove unrelated user changes.

#### Task 4.2: Final Verification

- Status: TO BE DONE
- Objective: Validate the complete Docker runtime and ensure normal desktop builds are unaffected.
- Steps:
  1. Run the existing frontend, backend, Linux build, E2E, and Flatpak checks.
  2. Build and start the Compose deployment from a clean checkout.
  3. Complete create/write/lock/restart/unlock/export flow.
  4. Replace the image while retaining the volume and repeat unlock.
  5. Verify LAN access and outbound container connectivity remain blocked.
- Validation: All existing checks pass and the Docker acceptance flow passes on a clean host.
- Notes: Docker Desktop on Windows and native Docker Engine on Linux should both be manually verified before declaring support.

## Approval Gate

Implementation should not start until this revised proposal is approved. The proof-of-concept runtime and networking spike is complete; productization must preserve its measured security invariants.

## Open Questions

None.

## Spike Decision Gates

The following decisions remain before productization:

- Which minimal authenticated reverse proxy to place in front of noVNC.
- Whether printing and clipboard behavior meet the minimum supported experience.
- Whether container mode should set or prompt for a conservative inactivity auto-lock default.
- Whether `linux/arm64` can be supported immediately or should follow later.
- What image-size ceiling is acceptable and whether distro-packaged noVNC/websockify dependencies should be replaced with smaller pinned artifacts.

## Proposal Self-Check

- [x] Proposal location follows the repository documentation convention.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] The recommendation preserves the existing application architecture.
- [x] Security and no-network implications are stated honestly.
- [x] Persistence, import/export, and upgrade behavior are defined.
- [x] Alternatives and rejection reasons are documented.
- [x] Tasks are grouped into milestones and each has concrete validation.
- [x] Cleanup and final verification are included.
- [x] Another coding agent can execute the plan without the original conversation.

## Empirical Validation Record

The second pass created temporary proof-of-concept containers and removed them after recording the results. The validated observations were:

- Real release package: Mini Diarium 0.5.3 Linux `.deb`.
- Compatible runtime: Ubuntu 24.04 with glibc 2.39 and WebKitGTK 4.1.
- Incompatible runtime: Debian Bookworm failed immediately because `GLIBC_2.39` was unavailable.
- GUI: noVNC rendered the real Tauri app; a GTK native directory chooser opened and selected `/data/home`.
- Hardened steady state: runtime PID 1 ran as UID/GID 10001 with `CapEff=0`, `CapPrm=0`, and `NoNewPrivs=1`; the root filesystem was read-only.
- Persistence: WebKit state and the generated app-data plugin guide survived container restart through the `/data` named volume.
- Internal network: raw-IP egress failed, but localhost published-port access also failed.
- Normal bridge: localhost published-port access, DNS, and raw-IP egress all succeeded.
- Split gateway: core egress failed and GUI access succeeded, but gateway egress succeeded.
- Route-guard single container: localhost GUI access succeeded; no default route remained; DNS and raw-IP egress failed.
- VNC authentication: two passwords with the same first eight characters produced identical TigerVNC password files.
- Spike resource profile: approximately 966 MB unpacked image, approximately 114 MiB core runtime memory at idle, and approximately 24 MiB for the tested split gateway.

## Sources

Repository evidence:

- `src-tauri/src/lib.rs`: application data paths, Linux renderer behavior, WebView setup, and process-level network defenses.
- `.github/workflows/ci.yml`: real Linux binary build and E2E execution under `xvfb-run`.
- `flatpak/io.github.fjrevoredo.mini-diarium.yml`: current Linux runtime and no-network sandbox.
- `SECURITY.md`: current threat model and Linux network-isolation claims.
- `PHILOSOPHY.md`: no-network, boring-security, focused-scope, and simplicity requirements.

External primary documentation:

- Docker internal networks: <https://docs.docker.com/compose/how-tos/networking/#internal-networks>
- Docker localhost-only port publishing: <https://docs.docker.com/engine/network/port-publishing/>
- Docker volumes: <https://docs.docker.com/engine/storage/volumes/>
- Docker bind mounts: <https://docs.docker.com/engine/storage/bind-mounts/>
- Docker Compose secrets: <https://docs.docker.com/compose/how-tos/use-secrets/>
- Docker build best practices: <https://docs.docker.com/build/building/best-practices/>
- Docker seccomp guidance: <https://docs.docker.com/engine/security/seccomp/>
- Tauri Linux prerequisites: <https://v2.tauri.app/start/prerequisites/>
- Tauri WebDriver CI with a virtual display: <https://v2.tauri.app/develop/tests/webdriver/ci/>
- TigerVNC project: <https://github.com/TigerVNC/tigervnc>
- noVNC project: <https://github.com/novnc/noVNC>
- KasmVNC project, fallback candidate only: <https://github.com/kasmtech/KasmVNC>
