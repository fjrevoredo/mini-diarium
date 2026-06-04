---
name: sync-lockfiles
description: |
  Regenerate both npm lockfiles after any manual change to package.json. Use this skill when
  the user has added, removed, or bumped a dependency in package.json and needs bun.lock and
  package-lock.json kept in sync. Triggers: "sync lockfiles", "update lockfiles", "I edited
  package.json", "regenerate lockfiles". Distinct from apply-dependency-prs, which handles
  the PR-discovery workflow — this skill handles lockfile sync only.
---

When `package.json` changes, two lockfiles must both be updated and committed together:

| File | Used by |
|------|---------|
| `bun.lock` | Dev workflow |
| `package-lock.json` | Flathub `flatpak-node-generator` (offline Linux build) |

## Steps

1. Regenerate `bun.lock`:
   ```bash
   cmd.exe /c bun install
   ```

2. Regenerate `package-lock.json`:
   ```bash
   cmd.exe /c npm install --package-lock-only --legacy-peer-deps
   ```

3. Commit `package.json`, `bun.lock`, and `package-lock.json` together.

## Why `--legacy-peer-deps`

`eslint-plugin-solid` declares a peer of `eslint@^9` but the project uses `eslint@10`. bun
resolves this silently; npm does not. The flag is required or `npm install` errors out.

## Gotcha

Never commit only one lockfile. `package-lock.json` is required by Flathub's
`flatpak-node-generator` to resolve npm dependencies during the offline Flatpak build. A
stale or missing `package-lock.json` causes the Flathub CI build to fail.
