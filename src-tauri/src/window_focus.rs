use tauri::{AppHandle, Emitter, Manager, WindowEvent, Wry};

/// Emits `"window-unfocused"`/`"window-focused"` whenever the main window
/// loses or regains OS-level focus — minimize, Cmd+Tab / Alt+Tab away,
/// clicking another app's window, and (on macOS) Cmd+H "Hide" all resign the
/// window's key/active status, so a single `WindowEvent::Focused` handler
/// covers every case without per-OS branching or polling:
///
/// - Windows: `WM_KILLFOCUS`/`WM_NCACTIVATE` fire on minimize and on losing
///   activation to another app (`tao::platform_impl::windows::event_loop`).
/// - macOS: `windowDidResignKey` fires on Cmd+Tab, miniaturize, and Hide
///   (`tao::platform_impl::macos::window_delegate` — its own doc comment
///   calls out the Cmd+Tab case explicitly).
/// - Linux: GTK's `focus-out-event` is forwarded as a genuine `WindowEvent`
///   (unlike minimize/iconify, which GTK only tracks internally — see the
///   `is_minimized()`-based design this replaced).
///
/// Runs for the app's lifetime, independent of any frontend preference — the
/// frontend (`src/lib/focus-lock.ts`) decides whether to act on the event
/// based on `autoLockOnFocusLoss`, lock state, whether one of the app's own
/// native dialogs is currently open, and a debounce timer (a quick misclick
/// outside the window and back should not lock the journal) — the
/// `"window-focused"` event cancels a pending debounce.
pub fn init(app: AppHandle<Wry>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    window.on_window_event(move |event| {
        let WindowEvent::Focused(is_focused) = event else {
            return;
        };

        let event_name = if *is_focused {
            "window-focused"
        } else {
            "window-unfocused"
        };

        if let Err(error) = app.emit(event_name, ()) {
            log::warn!("Failed to emit {} event: {}", event_name, error);
        }
    });
}
