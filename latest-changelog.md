## What's Changed

Removed the Windows installer outbound firewall rule which was triggering false-positive errors in winget's validation pipeline while providing no meaningful additional network isolation beyond the existing WebView-layer defenses.

### Removed
- **Windows installer outbound firewall rule**: removed the NSIS post-install hook that added a Windows Firewall block rule for `mini-diarium.exe`. The rule covered only the main Rust process, not WebView2 subprocess traffic, so it provided no meaningful additional isolation on top of the existing WebView-layer defenses (CSP, `WebResourceRequested` COM handler, init script, `on_navigation`). The hook was triggering a false-positive `Validation-Defender-Error` in winget's validation pipeline.
