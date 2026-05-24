// Registers a WebView2 WebResourceRequested filter that blocks all HTTP(S)
// requests to external hosts. Uses `with_webview()` + direct COM bindings
// because Tauri's `on_web_resource_request` hook only fires for the custom
// `tauri://` protocol, not for external HTTP(S) requests.
#[cfg(target_os = "windows")]
pub fn install_webresource_requested_handler(win: &tauri::WebviewWindow) {
    use log::warn;

    if let Err(e) = win.with_webview(|webview| {
        // SAFETY: CoreWebView2 is always accessed on the WebView2 creation thread.
        // The `AddWebResourceRequestedFilter` call must precede `add_WebResourceRequested`.
        // The event handler closure is invoked on the browser process thread; it only
        // reads the request URI (no mutable shared state) and is thread-safe per the
        // WebView2 contract. The token (`*mut i64`) is leaked intentionally — the
        // handler must remain registered for the lifetime of the WebView.
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2_2, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
            };
            use webview2_com::WebResourceRequestedEventHandler;
            use windows::core::{w, Interface, PWSTR};

            let core = match webview.controller().CoreWebView2() {
                Ok(c) => c,
                Err(e) => {
                    warn!("WebResourceRequested: failed to get CoreWebView2: {}", e);
                    return;
                }
            };

            if let Err(e) =
                core.AddWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)
            {
                warn!("WebResourceRequested: filter registration failed: {}", e);
                return;
            }

            let core2 = match core.cast::<ICoreWebView2_2>() {
                Ok(c) => c,
                Err(e) => {
                    warn!(
                        "WebResourceRequested: failed to cast CoreWebView2 to ICoreWebView2_2: {}",
                        e
                    );
                    return;
                }
            };

            let env = match core2.Environment() {
                Ok(env) => env,
                Err(e) => {
                    warn!(
                        "WebResourceRequested: failed to get WebView2 environment: {}",
                        e
                    );
                    return;
                }
            };

            let mut token = 0i64;
            if let Err(e) = core.add_WebResourceRequested(
                &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else {
                        return Ok(());
                    };
                    let request = match args.Request() {
                        Ok(r) => r,
                        Err(_) => return Ok(()),
                    };
                    let mut uri_ptr = PWSTR(std::ptr::null_mut());
                    if request.Uri(&mut uri_ptr).is_err() {
                        return Ok(());
                    }
                    // SAFETY: `uri_ptr` is a PWSTR returned by CoreWebView2; valid for
                    // the duration of this callback, pointing to a null-terminated wide
                    // string owned by the WebView2 runtime.
                    let uri_str = uri_ptr.to_string().unwrap_or_default();
                    let is_http = uri_str.starts_with("http://") || uri_str.starts_with("https://");
                    let allow_local_http = uri_str.starts_with("http://localhost")
                        || uri_str.starts_with("http://127.0.0.1")
                        || uri_str.starts_with("http://tauri.localhost")
                        || uri_str.starts_with("http://ipc.localhost")
                        || uri_str.starts_with("https://localhost")
                        || uri_str.starts_with("https://127.0.0.1")
                        || uri_str.starts_with("https://tauri.localhost")
                        || uri_str.starts_with("https://ipc.localhost");
                    let allow = uri_str.starts_with("tauri://")
                        || uri_str.starts_with("ipc://")
                        || allow_local_http;

                    if is_http && !allow {
                        warn!(
                            "WebResourceRequested: blocked external request: {}",
                            uri_str
                        );
                        if let Ok(response) = env.CreateWebResourceResponse(
                            None,
                            403,
                            w!("Forbidden"),
                            w!("Content-Type: text/plain\r\n"),
                        ) {
                            let _ = args.SetResponse(&response);
                        } else {
                            warn!(
                                "WebResourceRequested: failed to create 403 response for {}",
                                uri_str
                            );
                        }
                    }
                    Ok(())
                })),
                &mut token as *mut _,
            ) {
                warn!("WebResourceRequested: handler registration failed: {}", e);
            }
        }
    }) {
        warn!(
            "with_webview failed for WebResourceRequested handler: {}",
            e
        );
    }
}
