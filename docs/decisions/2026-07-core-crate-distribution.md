# ADR: Core-Crate Distribution — Git Dependency, crates.io Deferred

**Status:** Accepted
**Date:** 2026-07-24
**Related:** [`docs/OPEN_CORE_STRATEGY.md`](../OPEN_CORE_STRATEGY.md) §9 step 3 and §10 (M4); [`crates/mini-diarium-core/API.md`](../../crates/mini-diarium-core/API.md); [`crates/mini-diarium-crypto/API.md`](../../crates/mini-diarium-crypto/API.md); TODO-0084 (this ADR), TODO-0085 (contribution/relicensing posture), TODO-0086 (name protection).

## Context

Open-core milestones M1–M3 turned the backend into a three-crate Cargo workspace, layered bottom-up:

| Crate | Role | Heaviest deps |
|---|---|---|
| `mini-diarium-crypto` | `rusqlite`-free cryptographic base — cipher, password hashing, master-key wrapping, encrypted-field codec | `argon2`, `aes-gcm`, `x25519-dalek` |
| `mini-diarium-core` | Tauri-free SQLite business layer — db, import/export, plugin, backup, config, search | `rusqlite` (bundled), `rhai`, `image` |
| `mini-diarium` (`src-tauri/`) | Tauri app — `commands/*`, OS shell | `tauri` |

M4 asks how the two **library** crates reach a second consumer. The app crate is out of scope: it is a Tauri binary shipped as installers (GitHub Releases, WinGet, Homebrew, Flathub, Microsoft Store) and is never published to a Rust registry.

Three facts shape the decision:

1. **There are two library crates, not one.** TODO-0084's original framing predates M3a. crates.io publishing is transitive — a published crate cannot carry a `path` dependency — so publishing `mini-diarium-core` *requires* publishing `mini-diarium-crypto` first. The reverse is not true: crypto can be published alone.
2. **No second consumer exists.** `minidiarium-plus` is a planned separate private repo (OPEN_CORE_STRATEGY §8) that has not been started. The distribution mechanism only has to serve something once that something exists.
3. **The façade is explicitly pre-1.0 and internal.** Both `API.md` files state that any listed item may change without notice, with no deprecation window and no semver promise. That contract was written deliberately, and M4 is where it is either kept or retired.

## Options Considered

**A. Git dependency.** `minidiarium-plus` depends on the crates by git URL and tag against the public GitHub repo. No registry involvement.

**B. Publish both library crates to crates.io.** Public, versioned, maximally in the open-source spirit; claims both names.

**C. Publish `mini-diarium-crypto` only.** Publishes the small, `rusqlite`-free, WASM-targetable crate that has genuine standalone value; keeps the app-shaped `mini-diarium-core` on a git dependency.

**D. Git submodule.** Vendor the core into the consumer repo as a submodule.

MIT permits all four. This is a preference, not a licensing constraint.

### Why the asymmetry decides it

crates.io is **permanent**. Yanking hides a version from new resolution; it does not delete the artifact, and the name is never released back. A git dependency is fully reversible and can be upgraded to a published crate at any time without breaking the earlier arrangement. The reverse migration does not exist.

Publishing is also the act of *inviting* external consumers that the project then owes semver to — the exact obligation the pre-1.0/internal contract was written to avoid. Taking that on before there is a single consumer buys an obligation and no capability.

A git dependency has no prerequisites here: the repository is public, so a private consumer repo resolves it with no authentication, and Cargo supports tag- and rev-pinned git dependencies natively for reproducibility.

**Option D is rejected outright.** Cargo resolves git dependencies natively; a submodule adds checkout ceremony, a second source of truth for the pinned revision, and buys nothing over `git = "…", tag = "…"`.

### What is knowingly given up

All three crate names (`mini-diarium`, `mini-diarium-core`, `mini-diarium-crypto`) were unclaimed on crates.io as of 2026-07-24. Deferring publication accepts the risk that a third party claims one. This is judged acceptable because:

- The names are unusual enough that opportunistic squatting is unlikely.
- crates.io has a dispute process for names that conflict with an established project.
- Registry name-holding is not the project's primary name protection; that is TODO-0086's subject, and a crates.io name is a weak instrument for it compared to the trademark posture recorded there.

If losing the names becomes a live concern before a consumer exists, Option C (publish crypto only) is the cheapest partial hedge and does not require exposing the core.

## Decision

**Library crates are distributed as a tagged git dependency. crates.io publication is deferred, not rejected.**

### Distribution

- `minidiarium-plus`, or any other future consumer, depends on `mini-diarium-core` and `mini-diarium-crypto` by **git URL with an explicit `tag` or `rev`** — never a floating branch, so consumer builds are reproducible.
- Within this repository the crates remain **path** dependencies. Nothing about the workspace changes.
- Neither library crate is published to crates.io, and neither name is reserved there, until the trigger conditions below are met.

### Versioning and compatibility

- Both library crates stay on **independent `0.x` versions, decoupled from the app version** (currently `0.1.0` each; the app is `0.6.2`). This is the existing state and it is now deliberate rather than provisional.
- They remain **out of** `bump-version.sh` / `bump-version.ps1`, the pre-release guard, and `docs/RELEASING.md`. An app release does not bump, tag, or publish a library crate.
- The **pre-1.0/internal contract in both `API.md` files stands unchanged.** No semver promise, no deprecation window, no changelog obligation beyond this repository's `CHANGELOG.md`. The Change rule (API.md must be updated in the same commit as any surface change) continues to be the only enforced obligation.
- Consumer compatibility is pinned by git tag, so a consumer that has not moved its pin is unaffected by façade churn. This is precisely what makes deferring semver affordable.

### Ownership

Single copyright holder, Francisco J. Revoredo, sole maintainer; the repository is MIT with no third-party copyright assignments. No ownership restructuring is needed for either this decision or a later crates.io publication. Whether that stays true is TODO-0085's subject (contribution and relicensing posture).

### Publishing prerequisites (for when the trigger fires)

None of these are done now, and this ADR does **not** authorize doing them beyond the manifest hygiene noted below.

1. **Manifest metadata.** `license`, `repository`, `readme`, `keywords`, and `categories` on both library crates. `license` is mandatory for crates.io.
2. **A `README.md` per published crate** — crates.io renders it as the landing page, and it is where the "internal, no stability promise" status has to be stated loudly enough that a drive-by consumer sees it before depending on the crate.
3. **A library release process.** Version bumping, tagging, and `cargo publish` ordering (crypto before core) currently exist nowhere. Publishing means writing that into `docs/RELEASING.md` as a track separate from app releases.
4. **A decision on the semver promise.** Publishing at `0.x` with a documented "no stability promise" README is defensible, but the honest version is that a published crate attracts consumers regardless. Retiring or keeping the pre-1.0 contract is part of the publish decision, not a detail of it.
5. **`cargo-public-api` regression guard.** Already noted as a deferred follow-up in OPEN_CORE_STRATEGY §10 M2. It becomes required, not optional, once the surface is public.

**Fixed now, independently of all the above:** `license = "MIT"` and `repository` are added to all three manifests and the placeholder `authors = ["you"]` is replaced with the real copyright holder. These are correctness defects in their own right — an MIT repository whose manifests declare no license, and a published-in-installers app crate carrying a placeholder author — and are not gated on any distribution decision.

### Trigger to revisit

Reopen this ADR when **both** hold:

1. A second consumer actually exists and is being built against the core (realistically `minidiarium-plus`), and
2. The façade has stabilized enough that a semver promise is credible — meaning the API.md Change rule has stopped firing on most feature work.

A third, independent trigger: evidence that a crate name is at risk of being claimed by someone else. That one justifies Option C (publish `mini-diarium-crypto` alone) as a name-protection measure without committing the core.

Until then, no publication step is authorized, and the app's release versioning is unchanged.

## Consequences

**Positive**

- Zero prerequisite work to unblock a future consumer; a git dependency works today.
- The pre-1.0/internal contract stays honest — the façade can keep changing at the pace M1–M3 established without breaking a promise to anyone.
- Fully reversible. Nothing here forecloses crates.io.
- App release process is untouched; no new release track to maintain.

**Negative**

- The three crate names remain unclaimed and could be taken.
- Less discoverable than a published crate. Accepted: discoverability serves adoption of a library the project is not yet trying to get adopted.
- A consumer must pin and manually bump a git tag rather than using a version range. This is the intended friction — it makes façade churn the consumer's scheduling decision.

**Neutral**

- MIT already permits anyone to build a competing product from the public repository. Publishing would change convenience, not rights, so it is not a factor in either direction.
