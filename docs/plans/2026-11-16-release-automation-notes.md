# Notes — 2026-11-16-release-automation-plan.md

Append-only evidence and run ledger for [2026-11-16-release-automation-plan.md](2026-11-16-release-automation-plan.md), written by `plan-status.py note`. The plan keeps at most 3 result lines per task.

- 2026-11-16 22:38 UTC — Task 1.2: Template placeholders are HTML comments; Step 6 requires no comments or template tags in the release body. The v0.8.0 body contains neither.
- 2026-11-16 22:45 UTC — Task 2.4: PowerShell and Git Bash: fake cargo failure exit 1; stale lock exit 1; clean real cargo exit 0, one metainfo entry; repeated runs exit 0 and byte-identical. Shared URL helper: pinned and legacy exit 0; mismatch and zero exit 1. Clone cleanup blocked by automatic approval.
- 2026-11-16 22:48 UTC — Task 3.1: Live preflight correctly named dirty tree and unpushed commits; HTTPS principal fjrevoredo verified as admin bypass. CI and cargo audit reported failures; Nix had no run for this local SHA.
- 2026-11-16 22:53 UTC — Task 3.6: v0.8.0: eight assets and checksums pass; published body differs by appended SourceForge badge; live site still has latest URLs as expected; redirects pass and robots lacks Content-Signal. Channels: Homebrew, WinGet, Flathub available; Store submitted (run 41544022537). Preflight reports dirty tree, unpushed commit, missing green CI, cargo audit failure and verified HTTPS admin bypass.
- 2026-11-16 22:56 UTC — Task 2.4: Each bump script also exercised with pinned and legacy URLs (exit 0) and mismatched and zero URLs (exit 1), using isolated fake cargo and a matching lock.
- 2026-11-17 21:56 UTC — Task 5.1: Partner Center overview showed Submission 12 as the live Store presence on 2026-11-17; publication condition satisfied, subject to recheck before release.
- 2026-11-17 21:59 UTC — Task 5.2: Maintainer requested release 0.8.1 on 2026-11-17. Local tests: frontend 1325, script 96, workspace backend passed; type-check, lint, build, format, runner guard and cargo audit passed. Audit reported 12 allowed warnings.
