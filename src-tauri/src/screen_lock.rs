#[cfg(target_os = "windows")]
mod imp {
    use log::{info, warn};
    use std::sync::OnceLock;
    use tauri::{AppHandle, Manager, Wry};
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, WTSUnRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        PBT_APMSUSPEND, WM_NCDESTROY, WM_POWERBROADCAST, WM_WTSSESSION_CHANGE, WTS_SESSION_LOCK,
        WTS_SESSION_LOGOFF,
    };

    const SCREEN_LOCK_SUBCLASS_ID: usize = 0x4D444C4B; // "MDLK"

    /// Stores the `AppHandle` for use inside the Win32 subclass callback.
    ///
    /// `OnceLock` guarantees single-init: `init()` calls `set()` once at startup
    /// and subsequent calls are no-ops.  `AppHandle<Wry>` is `Send + Sync`, so
    /// accessing it from the message-pump thread (which calls the subclass proc)
    /// is safe.
    static APP_HANDLE: OnceLock<AppHandle<Wry>> = OnceLock::new();

    pub fn init(app: &AppHandle<Wry>) -> Result<(), String> {
        let _ = APP_HANDLE.set(app.clone());

        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "Main window not found for screen-lock hook".to_string())?;
        let hwnd = window
            .hwnd()
            .map_err(|e| format!("Failed to obtain native window handle: {}", e))?;
        let hwnd_raw = hwnd.0 as HWND;

        // SAFETY: `hwnd_raw` is the HWND obtained from Tauri's `WebviewWindow::hwnd()`,
        // which is valid and owned by the application for its entire lifetime.
        // `WTSRegisterSessionNotification` requires a valid top-level window handle;
        // `NOTIFY_FOR_THIS_SESSION` restricts events to the current logon session.
        // The matching `WTSUnRegisterSessionNotification` is called in the
        // `WM_NCDESTROY` handler, satisfying the session-notification contract.
        //
        // `SetWindowSubclass` installs `screen_lock_subclass_proc` with a unique
        // subclass ID (`SCREEN_LOCK_SUBCLASS_ID`) so it does not clash with other
        // subclasses.  The subclass proc signature matches `SUBCLASSPROC` exactly.
        // `RemoveWindowSubclass` is called on `WM_NCDESTROY` to clean up.
        unsafe {
            if WTSRegisterSessionNotification(hwnd_raw, NOTIFY_FOR_THIS_SESSION) == 0 {
                return Err(format!(
                    "Failed to register Windows session notifications: {}",
                    std::io::Error::last_os_error()
                ));
            }

            if SetWindowSubclass(
                hwnd_raw,
                Some(screen_lock_subclass_proc),
                SCREEN_LOCK_SUBCLASS_ID,
                0,
            ) == 0
            {
                let _ = WTSUnRegisterSessionNotification(hwnd_raw);
                return Err(format!(
                    "Failed to install Windows message subclass: {}",
                    std::io::Error::last_os_error()
                ));
            }
        }

        info!("Screen-lock listener initialized (Windows)");
        Ok(())
    }

    fn trigger_auto_lock(reason: &str) {
        if let Some(app) = APP_HANDLE.get() {
            let state = app.state::<crate::commands::auth::DiaryState>();
            match crate::commands::auth::auto_lock_diary_if_unlocked(state, app.clone(), reason) {
                Ok(true) => info!("Diary auto-locked due to {}", reason),
                Ok(false) => {}
                Err(error) => warn!("Failed to auto-lock diary ({}): {}", reason, error),
            }
        }
    }

    // SAFETY: This function is registered as a `SUBCLASSPROC` callback via
    // `SetWindowSubclass`.  Windows invokes it on the message-pump thread that
    // owns the window, so there is no data race on `hwnd`.
    // `APP_HANDLE` is a `OnceLock<AppHandle<Wry>>`; `AppHandle` is `Send + Sync`,
    // so reading it here is safe even though the callback runs on a Win32 thread.
    // On `WM_NCDESTROY` we call `WTSUnRegisterSessionNotification` and
    // `RemoveWindowSubclass` before the window is destroyed, preventing dangling
    // references.  `DefSubclassProc` is always called last to maintain the
    // subclass chain invariant.
    unsafe extern "system" fn screen_lock_subclass_proc(
        hwnd: HWND,
        umsg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uidsubclass: usize,
        _dwrefdata: usize,
    ) -> LRESULT {
        match umsg {
            WM_WTSSESSION_CHANGE => match wparam as u32 {
                WTS_SESSION_LOCK | WTS_SESSION_LOGOFF => trigger_auto_lock("session lock"),
                _ => {}
            },
            WM_POWERBROADCAST => {
                if wparam as u32 == PBT_APMSUSPEND {
                    trigger_auto_lock("system suspend");
                }
            }
            WM_NCDESTROY => {
                let _ = WTSUnRegisterSessionNotification(hwnd);
                let _ = RemoveWindowSubclass(
                    hwnd,
                    Some(screen_lock_subclass_proc),
                    SCREEN_LOCK_SUBCLASS_ID,
                );
            }
            _ => {}
        }

        DefSubclassProc(hwnd, umsg, wparam, lparam)
    }
}

#[cfg(target_os = "windows")]
pub use imp::init;

#[cfg(not(target_os = "windows"))]
pub fn init(_app: &tauri::AppHandle<tauri::Wry>) -> Result<(), String> {
    Ok(())
}
