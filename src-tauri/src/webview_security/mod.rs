//! Platform-specific WebView security request handlers.
//!
//! Each platform file installs an engine-level request blocker that enforces the
//! no-external-network policy as defense-in-depth alongside CSP and the JS init script.
//! See the Network Isolation Defense-in-Depth Stack in `src-tauri/CLAUDE.md` for the
//! full picture.

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
mod macos;

/// Install platform-specific WebView engine-level request blockers.
///
/// - Windows: WebView2 `WebResourceRequested` COM event handler — returns 403 for
///   external HTTP(S) requests.
/// - macOS: `WKContentRuleList` compiled rule — blocks HTTP(S) to non-localhost domains
///   at the WebKit engine level.
pub fn install_platform_handlers(_win: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    windows::install_webresource_requested_handler(win);

    #[cfg(target_os = "macos")]
    macos::install_content_rule_list(win);
}
