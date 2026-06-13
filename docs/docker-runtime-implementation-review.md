# Docker Runtime Implementation Review

Date: 2026-06-13
Branch: `feature-v0.5.4`
Reviewed commit: `4eefd943180df97543fd6be8da04b183eb115340`

## Part 1: Assessment

The implementation is close to the proposal and the core runtime path works when the GUI secret file exists and is valid. The reviewed build:

- builds successfully with `docker compose build`;
- resolves correctly with `docker compose config`;
- starts successfully with `docker compose run --rm init` followed by `docker compose up -d`;
- reaches `healthy` status;
- returns `401` for unauthenticated `GET /` and `200` for authenticated `GET /`;
- preserves `/data` across container restart;
- runs with `CapEff=0`, `CapPrm=0`, and `NoNewPrivs=1`;
- removes the default route while keeping localhost GUI access working.

The main gaps are in first-run robustness on Windows and in fail-closed handling for a missing GUI secret. Those issues break the supported setup path described in the documentation, so the implementation is not merge-ready yet.

Validation notes:

- `cmd.exe /c bun run website:build-static` was flaky in this shell. It succeeded once, then failed twice with Windows `UNKNOWN` file-open errors while rewriting generated `website/blog/*/index.html` files. That does not appear tied to the Docker runtime code itself, but it weakens the confidence of the required docs regeneration step.
- The POSIX helper `docker/init-secret.sh` was not executed from this shell because no `sh` binary is available in the current PowerShell environment.

## Part 2: Actionable Fixes

### 1. Make the Windows secret-init script compatible with the documented PowerShell entrypoint

Severity: High

The documented Windows setup flow is:

- `powershell -ExecutionPolicy Bypass -File .\docker\init-secret.ps1`

That script currently calls `RandomNumberGenerator::Fill(...)` in [docker/init-secret.ps1](/d:/Repos/mini-diarium-2/docker/init-secret.ps1:17). In this environment, `powershell` resolves to Windows PowerShell 5.1, where that API is unavailable. The script fails immediately with:

`Method invocation failed because [System.Security.Cryptography.RandomNumberGenerator] does not contain a method named 'Fill'.`

That means the documented first-run path for Windows users does not work, and the Docker runtime cannot be initialized from the published instructions.

Suggested fix:

- Replace the `Fill` call with a PowerShell 5.1-compatible pattern such as `RNGCryptoServiceProvider.GetBytes(...)`, or
- explicitly require `pwsh` and update docs/scripts consistently if PowerShell 7 is the real requirement.

Tests to add:

- A Windows CI smoke check that runs `docker/init-secret.ps1` and verifies it creates a non-empty secret file.

### 2. Fail cleanly when the GUI secret file is missing or malformed

Severity: High

The proposal requires startup to fail closed when the GUI secret is missing or empty. The current bootstrap check in [docker/entrypoint.sh](/d:/Repos/mini-diarium-2/docker/entrypoint.sh:10) uses `[ ! -s "$SECRET_FILE" ]`, which is not enough when Docker mounts an invalid/missing secret path as a directory-like object. In that state, the check passes and the script later crashes here:

- [docker/entrypoint.sh](/d:/Repos/mini-diarium-2/docker/entrypoint.sh:27)

Observed runtime logs:

- `tr: read error: Is a directory`

This creates two problems:

1. the failure mode is obscure and does not explain the real setup mistake;
2. Docker can leave `docker/secrets/gui-password.txt` as a directory on the host, which then breaks later attempts to create the file normally.

Suggested fix:

- Require the secret path to be a regular readable file before continuing, for example by checking `-f`, `-r`, and non-empty content before hashing it.
- Emit a specific error that names the expected host-side file and refuses to continue.

Tests to add:

- A negative-path container test that starts the stack without a secret file and asserts a clear bootstrap error message instead of a `tr` failure.

## Review Verdict

Not merge-ready.

The core Docker runtime design is implemented and works once manually repaired, but the supported first-run contract is broken on Windows and missing-secret handling is not robust enough for a release artifact.
