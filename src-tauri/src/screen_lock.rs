// ─── Windows ─────────────────────────────────────────────────────────────────
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

// ─── macOS ───────────────────────────────────────────────────────────────────
#[cfg(target_os = "macos")]
mod imp {
    use block2::RcBlock;
    use log::{info, warn};
    use objc2_app_kit::NSWorkspace;
    use objc2_foundation::{NSNotification, NSOperationQueue, NSString};
    use std::ptr::NonNull;
    use std::sync::OnceLock;
    use tauri::{AppHandle, Wry};

    static APP_HANDLE: OnceLock<AppHandle<Wry>> = OnceLock::new();

    pub fn init(app: &AppHandle<Wry>) -> Result<(), String> {
        let _ = APP_HANDLE.set(app.clone());

        // SAFETY: Tauri's setup closure runs on the main thread on macOS.
        // NSWorkspace and NSNotificationCenter require main-thread access.
        // The RcBlock closures capture only `reason` (&'static str) and read
        // APP_HANDLE (OnceLock<AppHandle<Wry>>, Send + Sync); no mutable state.
        // std::mem::forget is called on the same thread that creates the token,
        // so no Send bound is required on Retained<NSObject>.
        // NSNotificationCenter holds a weak reference to the observer; forgetting
        // the Retained token prevents its retain-count from dropping to zero,
        // keeping the subscription alive for the app's lifetime.
        unsafe {
            let workspace = NSWorkspace::sharedWorkspace();
            let nc = workspace.notificationCenter();
            let main_queue = NSOperationQueue::mainQueue();

            let events: &[(&str, &'static str)] = &[
                ("NSWorkspaceScreensDidSleepNotification", "screen sleep"),
                ("NSWorkspaceWillSleepNotification", "system sleep"),
            ];

            for &(name, reason) in events {
                let ns_name = NSString::from_str(name);
                let block: RcBlock<dyn Fn(NonNull<NSNotification>)> =
                    RcBlock::new(move |_notif: NonNull<NSNotification>| {
                        trigger_auto_lock(reason);
                    });
                let observer = nc.addObserverForName_object_queue_usingBlock(
                    Some(&*ns_name),
                    None,
                    Some(&main_queue),
                    &*block,
                );
                std::mem::forget(observer);
            }
        }

        info!("Screen-lock listener initialized (macOS)");
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
}

// ─── Platform re-exports ─────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
pub use imp::init;

#[cfg(target_os = "macos")]
pub use imp::init;

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn init(_app: &tauri::AppHandle<tauri::Wry>) -> Result<(), String> {
    Ok(())
}
