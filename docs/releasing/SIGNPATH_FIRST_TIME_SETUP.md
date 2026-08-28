# SignPath First-Time Setup

Step-by-step instructions for standing up SignPath code signing for Mini Diarium's Windows
release artifacts from scratch. Follow this if the current SignPath project/organization is
ever lost, needs recreating, or is migrated to a new SignPath account. For how signing fits
into the release pipeline day-to-day, see [`RELEASING.md`](RELEASING.md) → "Windows Code
Signing (SignPath)".

This is a dashboard walkthrough (SignPath's web UI at [app.signpath.io](https://app.signpath.io)),
not a repo change — nothing here is automated, and none of it can be scripted from this
repo. `.github/workflows/release.yml` already contains the CI side (upload → submit signing
request → download signed artifact) and does not need to change when this setup is redone;
only the four `SIGNPATH_*` GitHub secrets need to point at the new org/project/policy.

Verified against SignPath's official docs (`docs.signpath.io`) — see the References section
at the bottom for exact source pages.

## 1. Apply to SignPath Foundation (OSS tier)

Mini Diarium uses the free **SignPath Foundation** program for open source projects.
Application review requirements: a publicly available codebase, an OSI-approved license, no
malware/PUP history, active maintenance, and existing releases in the form to be signed.
Apply via SignPath's open-source community page; a SignPath team member reviews and, if
accepted, sends an organization invitation by email.

As part of Foundation onboarding you're also asked to define code-signing roles (Authors,
Reviewers, Approvers) and publish a code-signing policy statement for the project — check
the acceptance email/dashboard for this if it wasn't already completed.

## 2. Accept the organization invitation

Open the invitation link from the acceptance email, or go to
[app.signpath.io](https://app.signpath.io) and accept the pending organization invitation.

## 3. Get the Organization ID

In the SignPath dashboard, open **Organization settings**. The Organization ID (a GUID) is
shown there.

→ This is the `SIGNPATH_ORGANIZATION_ID` secret value.

## 4. Create a Project

**Projects → Create/Add.** Name it `mini-diarium` (matches the current project slug — reuse
this exact slug if recreating the project, since it's referenced by name throughout this
doc and `RELEASING.md`).

→ The project's slug is the `SIGNPATH_PROJECT_SLUG` secret value.

## 5. Create the artifact configurations

Inside the project: **Artifact Configurations → Add → Custom**. Create exactly two, with
these slugs (hardcoded in `release.yml`'s `artifact-configuration-slug` inputs — they must
match exactly):

**`windows-msi`:**

```xml
<artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
  <zip-file>
    <msi-file path="*.msi">
      <authenticode-sign/>
    </msi-file>
  </zip-file>
</artifact-configuration>
```

**`windows-exe`:**

```xml
<artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
  <zip-file>
    <pe-file path="*.exe">
      <authenticode-sign/>
    </pe-file>
  </zip-file>
</artifact-configuration>
```

The `<zip-file>` wrapper is required because `actions/upload-artifact` always zips whatever
it uploads (our workflow doesn't pass `archive: false`), so the artifact-configuration's
root element must match that zip container, not the file inside it directly.

## 6. Create a signing policy

**Project → Signing Policies → Add.** For the initial setup, pick the **test certificate**
SignPath issues to Foundation projects — production signing only starts once SignPath
reviews the setup and imports a real certificate (see "Production cutover" below).

→ The policy's slug is the `SIGNPATH_SIGNING_POLICY_SLUG` secret value (currently
`test-signing` for Mini Diarium).

## 7. Add a CI submitter and generate its API token

Open the signing policy's detail page → **Submitters**. Add a submitter that CI will
authenticate as — prefer a dedicated non-interactive account (e.g. a "CI builds" service
user under **Users and Groups → Invite user**) over a personal account, so the token isn't
tied to one person's access.

Generate that submitter's API token from **its own profile** (not the org settings page):
click the username top-right → **My profile** → **Generate token**. The token is shown only
once — copy it immediately into a password manager before navigating away.

→ This is the `SIGNPATH_API_TOKEN` secret value.

## 8. Set the GitHub repository secrets

**Repo → Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Value |
|---|---|
| `SIGNPATH_API_TOKEN` | token from step 7 |
| `SIGNPATH_ORGANIZATION_ID` | org GUID from step 3 |
| `SIGNPATH_PROJECT_SLUG` | project slug from step 4 |
| `SIGNPATH_SIGNING_POLICY_SLUG` | signing policy slug from step 6 |

Nothing else in the repo needs to change — `.github/workflows/release.yml` already
references these four secret names and the two artifact-configuration slugs.

## 9. Verify

Trigger the release workflow without tagging a real release:

```bash
gh workflow run release.yml --ref master
```

Watch the Windows leg's "Verify SignPath secrets are set" and "Submit MSI/EXE signing
request (SignPath)" steps in the Actions tab. On success, download the
`release-artifacts-windows` build artifact and check the signature on a Windows machine:

```powershell
Get-AuthenticodeSignature .\Mini-Diarium-*-windows.msi
Get-AuthenticodeSignature .\Mini-Diarium-*-windows.exe
```

Expect a signature chain rooted at the **SignPath test root** — not trusted by Windows by
default, which is expected until the production certificate lands (see below).

## Production cutover

The signing policy `release-signing` already exists for the production certificate but
shows **INVALID / CSR PENDING** until SignPath issues it. Once SignPath confirms the
certificate is live, follow TODO-0109 in `docs/todo/TODO.md` (or its archived record) to
switch `SIGNPATH_SIGNING_POLICY_SLUG` from `test-signing` to `release-signing` and verify a
real (non-test) Authenticode signature.

## Not covered here (optional, not required for this pipeline)

SignPath also supports linking GitHub as a **Trusted Build System**
(**Trusted Build Systems → Add predefined** at the org level, then **Link** it to the
project) to enable "origin verification" — stricter policies tied to the actual GitHub
repo/workflow that submitted the request. Mini Diarium's pipeline uses plain API-token
authentication instead (per the original TODO-0091 decision to avoid OIDC), so this step is
optional and can be added later for tighter provenance guarantees without changing the
GitHub Actions workflow.

## References

- [GitHub Actions trusted build system integration](https://docs.signpath.io/trusted-build-systems/github)
- [Artifact configuration syntax](https://docs.signpath.io/artifact-configuration/syntax)
- [Trusted Build Systems overview](https://docs.signpath.io/trusted-build-systems/)
- [Setting up Projects](https://docs.signpath.io/projects)
- [Managing Users](https://docs.signpath.io/users/)
- [SignPath Foundation](https://signpath.org/)
- [`signpath/github-action-submit-signing-request` action.yml (v2)](https://github.com/signpath/github-action-submit-signing-request/blob/v2/action.yml)
