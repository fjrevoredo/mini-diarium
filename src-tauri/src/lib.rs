pub mod auth;
pub mod backup;
pub mod commands;
pub mod config;
pub mod crypto;
pub mod db;
pub mod export;
pub mod import;
pub mod menu;
pub mod plugin;
pub mod screen_lock;

use commands::auth::DiaryState;
use log::{info, warn};
use std::path::{Path, PathBuf};
use tauri::Manager;

// NOTE: keep in sync with src/lib/network-isolation-script.ts
const NETWORK_ISOLATION_SCRIPT: &str = r#"(function() {
  'use strict';
  const kill = (obj, prop) => {
    try {
      Object.defineProperty(obj, prop, {
        value: undefined, writable: false, configurable: false,
      });
    } catch (_) {}
  };
  kill(window, 'RTCPeerConnection');
  kill(window, 'webkitRTCPeerConnection');
  kill(window, 'mozRTCPeerConnection');
  kill(window, 'RTCSessionDescription');
  kill(window, 'WebTransport');
  // NOTE: fetch/XMLHttpRequest/WebSocket/EventSource stay available because
  // Tauri IPC and the dev server depend on them. External requests are blocked
  // by CSP and platform WebView request handlers.
  kill(window, 'open');
  kill(window, 'Worker');
  kill(window, 'SharedWorker');
  if (navigator) {
    kill(navigator, 'serviceWorker');
    kill(navigator, 'sendBeacon');
    kill(navigator, 'connection');
  }
})();"#;

const LEGACY_APP_IDENTIFIER_DIR: &str = "com.minidiarium.app";

fn has_legacy_app_state(dir: &Path) -> bool {
    dir.join("config.json").is_file() || dir.join("diary.db").is_file()
}

fn resolve_app_data_dir(app_dir: PathBuf) -> PathBuf {
    if has_legacy_app_state(&app_dir) {
        return app_dir;
    }

    if let Some(parent) = app_dir.parent() {
        let legacy_dir = parent.join(LEGACY_APP_IDENTIFIER_DIR);
        if has_legacy_app_state(&legacy_dir) {
            return legacy_dir;
        }
    }

    app_dir
}

fn is_e2e_mode() -> bool {
    matches!(std::env::var("MINI_DIARIUM_E2E").as_deref(), Ok("1"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Disable DMA-BUF renderer on Linux to avoid WebKit rendering issues
    // (white screen / GPU reset) on some drivers. Must be set before GTK init.
    // Skip in any E2E mode (clean or stateful): the software fallback renderer
    // slows WebKit's compositing pipeline, which causes hit-testing to lag behind
    // DOM updates ("element click intercepted") and makes DOM updates exceed
    // WebDriver poll timeouts.  MINI_DIARIUM_APP_DIR is always injected by the
    // wdio.conf.ts harness for both clean and stateful runs; it is absent in
    // normal production use.
    #[cfg(target_os = "linux")]
    if std::env::var("MINI_DIARIUM_APP_DIR").is_err() {
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("mini_diarium_lib=info"),
    )
    .init();
    info!("Mini Diarium starting");

    let is_e2e = is_e2e_mode();
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init());

    if is_e2e {
        info!("E2E mode detected (MINI_DIARIUM_E2E=1): window-state persistence disabled");
    } else {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .setup(move |app| {
            // Get app data directory and create diary path
            let system_app_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    warn!(
                        "Could not determine app data directory ({}), using CWD as fallback",
                        e
                    );
                    PathBuf::from(".")
                }
            };

            // Allow E2E tests to override the app data dir (config.json location) independently.
            let app_dir = if let Ok(e2e_app_dir) = std::env::var("MINI_DIARIUM_APP_DIR") {
                info!("Using E2E app dir override: {}", e2e_app_dir);
                PathBuf::from(e2e_app_dir)
            } else {
                let resolved = resolve_app_data_dir(system_app_dir.clone());
                if resolved != system_app_dir {
                    info!(
                        "Using legacy app data directory for compatibility: {}",
                        resolved.display()
                    );
                }
                resolved
            };
            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                warn!(
                    "Failed to create app directory '{}': {}",
                    app_dir.display(),
                    e
                );
            }

            let (diary_dir, db_filename) =
                if let Ok(test_dir) = std::env::var("MINI_DIARIUM_DATA_DIR") {
                    // E2E test isolation — bypass journal config entirely
                    (PathBuf::from(test_dir), "diary.db".to_string())
                } else {
                    let journals = crate::config::load_journals(&app_dir);
                    if !journals.is_empty() {
                        // Use active journal, or first journal as fallback
                        let active_id = crate::config::load_active_journal_id(&app_dir);
                        let active =
                            active_id.and_then(|id| journals.iter().find(|j| j.id == id).cloned());
                        let journal = active.or_else(|| journals.first().cloned());
                        let db_filename = journal
                            .as_ref()
                            .and_then(|j| j.db_filename.clone())
                            .unwrap_or_else(|| "diary.db".to_string());
                        let dir = journal
                            .map(|j| PathBuf::from(&j.path))
                            .filter(|p| p.is_dir())
                            .unwrap_or_else(|| app_dir.clone());
                        (dir, db_filename)
                    } else {
                        // Fresh install or legacy without migration trigger
                        let dir = crate::config::load_diary_dir(&app_dir)
                            .filter(|p| p.is_dir())
                            .unwrap_or_else(|| app_dir.clone());
                        (dir, "diary.db".to_string())
                    }
                };

            let db_path = diary_dir.join(&db_filename);
            let stem = std::path::Path::new(&db_filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("diary");
            let backups_dir = diary_dir.join("backups").join(stem);

            // Set up state
            app.manage(DiaryState::new(db_path, backups_dir, app_dir.clone()));

            // Initialize plugin registry
            let plugins_dir = app_dir.join("plugins");

            // One-time migration: copy any .rhai files from per-journal plugins/ dirs
            // to the new central location. Non-destructive — originals stay in place.
            {
                let mut old_dirs: Vec<PathBuf> = vec![diary_dir.clone()];
                for j in crate::config::load_journals(&app_dir) {
                    old_dirs.push(PathBuf::from(&j.path));
                }
                if let Some(legacy) = crate::config::load_diary_dir(&app_dir) {
                    old_dirs.push(legacy);
                }
                plugin::rhai_loader::migrate_journal_plugins(&old_dirs, &plugins_dir);
            }

            let mut registry = plugin::registry::PluginRegistry::new();
            plugin::builtins::register_all(&mut registry);
            plugin::rhai_loader::load_plugins(&plugins_dir, &mut registry);
            app.manage(std::sync::Mutex::new(registry));

            // Build and set application menu
            let (lockable, translatable) = menu::build_menu(app.handle())?;
            app.manage(lockable);
            app.manage(translatable);

            if let Err(error) = screen_lock::init(app.handle()) {
                warn!("Screen-lock listener initialization failed: {}", error);
            }

            // Create the main window programmatically so we can configure two critical
            // security properties that are only available on the builder, not at runtime:
            //
            // 1. on_navigation — intercepts every WebView2 NavigationStarting event and
            //    blocks any URL that isn't this app's own scheme or the local dev server.
            //    Without this, WebView2 silently navigates to any URL dragged onto the
            //    window, typed into JS, or embedded in dropped HTML — defeating the
            //    no-network guarantee.
            //
            // 2. disable_drag_drop_handler — disables WRY's IDropTarget registration so
            //    WebView2 receives all drag events natively via the DOM. Without this,
            //    Tauri's WryDropHandler returns DROPEFFECT_NONE for non-file drags
            //    (browser images, Typora), blocking the DOM drop event entirely.
            let mut win_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Mini Diarium")
            .min_inner_size(600.0, 400.0)
            .visible(false)
            .disable_drag_drop_handler()
            .on_navigation(|url| {
                let scheme = url.scheme();
                let host = url.host_str().unwrap_or("");
                let allowed = scheme == "tauri"
                    || scheme == "ipc"
                    || (matches!(scheme, "http" | "https")
                        && matches!(host, "localhost" | "127.0.0.1" | "tauri.localhost"));
                if !allowed {
                    warn!("Blocked navigation to external URL: {}", url);
                }
                allowed
            })
            // Block all new-window creation (window.open, target=_blank) on all platforms.
            // Maps to WebView2 NewWindowRequested on Windows and WKUIDelegate on macOS.
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            // Null network-capable JS globals before any page script runs.
            // Defense-in-depth alongside CSP; runs in main frame and all subframes.
            .initialization_script_for_all_frames(NETWORK_ISOLATION_SCRIPT);

            if is_e2e {
                // Set the window to the exact E2E viewport size in the builder so the WebView
                // renders at 800×660 from the very first paint. WebView2 captures CSS viewport
                // values (100vh, window.innerHeight) at first paint; any resize after show()
                // leaves those values stale and produces a white gap in screen-filling layouts.
                info!("E2E mode: forcing window to 800×660 before show");
                win_builder = win_builder.inner_size(800.0, 660.0);
            } else {
                win_builder = win_builder.inner_size(800.0, 780.0);
            }

            let win = win_builder.build()?;

            // Windows: block HTTP(S) subresource requests at the WebView2 engine level
            // via the WebResourceRequested COM event. This intercepts requests below JS
            // and CSP, providing engine-level blocking for non-tauri:// traffic.
            #[cfg(target_os = "windows")]
            install_webresource_requested_handler(&win);

            // macOS: block HTTP(S) subresource requests via WKContentRuleList.
            // WKContentRuleList is the only WebKit-supported mechanism for blocking
            // HTTP(S) subresource requests (NSURLProtocol does not intercept WKWebView).
            #[cfg(target_os = "macos")]
            install_content_rule_list(&win);

            // Show after setup completes so the window-state plugin has already restored
            // the saved position/size (non-E2E) before the window becomes visible.
            let _ = win.show();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth - core
            commands::auth::create_diary,
            commands::auth::unlock_diary,
            commands::auth::unlock_diary_with_keypair,
            commands::auth::create_diary_auto,
            commands::auth::unlock_diary_auto,
            commands::auth::lock_diary,
            commands::auth::diary_exists,
            commands::auth::check_diary_path,
            commands::auth::is_diary_unlocked,
            commands::auth::get_diary_path,
            commands::auth::change_diary_directory,
            commands::auth::change_password,
            commands::auth::reset_diary,
            // Auth - journals
            commands::auth::list_journals,
            commands::auth::get_active_journal_id,
            commands::auth::add_journal,
            commands::auth::remove_journal,
            commands::auth::rename_journal,
            commands::auth::switch_journal,
            // Auth - method management
            commands::auth::verify_password,
            commands::auth::list_auth_methods,
            commands::auth::peek_auth_slot_types,
            commands::auth::generate_keypair,
            commands::auth::write_key_file,
            commands::auth::register_password,
            commands::auth::register_keypair,
            commands::auth::remove_auth_method,
            commands::auth::unlock_diary_all_methods,
            commands::auth::set_require_all_auth,
            // Entries
            commands::entries::create_entry,
            commands::entries::save_entry,
            commands::entries::get_entries_for_date,
            commands::entries::delete_entry_if_empty,
            commands::entries::delete_entry,
            commands::entries::get_all_entry_dates,
            // Search
            commands::search::search_entries,
            // Navigation
            commands::navigation::navigate_previous_day,
            commands::navigation::navigate_next_day,
            commands::navigation::navigate_to_today,
            commands::navigation::navigate_previous_month,
            commands::navigation::navigate_next_month,
            // Stats
            commands::stats::get_statistics,
            // Files (image embedding support + markdown import)
            commands::files::read_file_bytes,
            commands::files::read_text_file,
            // Export
            commands::export::export_json,
            commands::export::export_markdown,
            // Plugins
            commands::plugin::list_import_plugins,
            commands::plugin::list_export_plugins,
            commands::plugin::run_import_plugin,
            commands::plugin::run_export_plugin,
            // Debug
            commands::debug::generate_debug_dump,
            // Menu locale
            commands::menu::update_menu_locale,
            // Fonts
            commands::fonts::list_bundled_fonts,
            commands::fonts::get_font_data,
            // Tags
            commands::tags::create_tag,
            commands::tags::get_all_tags,
            commands::tags::rename_tag,
            commands::tags::delete_tag,
            commands::tags::add_tag_to_entry,
            commands::tags::remove_tag_from_entry,
            commands::tags::get_tags_for_entry,
            commands::tags::get_entry_dates_by_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Windows: WebResourceRequested handler ────────────────────────────────────
//
// Registers a WebView2 WebResourceRequested filter that blocks all HTTP(S)
// requests to external hosts. Uses `with_webview()` + direct COM bindings
// because Tauri's `on_web_resource_request` hook only fires for the custom
// `tauri://` protocol, not for external HTTP(S) requests.
#[cfg(target_os = "windows")]
fn install_webresource_requested_handler(win: &tauri::WebviewWindow) {
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

// ── macOS: WKContentRuleList handler ─────────────────────────────────────────
//
// Installs a compiled WKContentRuleList that blocks all HTTP(S) subresource
// requests to external hosts. WKContentRuleList is the only WebKit-supported
// mechanism for this (NSURLProtocol does not intercept WKWebView traffic —
// WebKit bug #138169, won't-fix).
//
// The rule compilation is async; the completion handler fires on the main queue
// and immediately calls addContentRuleList on the user content controller.
#[cfg(target_os = "macos")]
fn install_content_rule_list(win: &tauri::WebviewWindow) {
    if let Err(e) = win.with_webview(|webview| {
        // SAFETY: WKWebView and WKUserContentController must be accessed on the main
        // thread. This closure is invoked during window setup on the main thread.
        // The completion handler block captures `ucc_retained` (a Retained<WKUserContentController>
        // which is Send) and is dispatched by WebKit on the main queue — no data race.
        // `compileContentRuleListForIdentifier` retains the store and the block internally;
        // the compiled rule list is cached on disk by WebKit after the first compilation.
        unsafe {
            use block2::RcBlock;
            use objc2::MainThreadMarker;
            use objc2_foundation::{NSError, NSString};
            use objc2_web_kit::{WKContentRuleList, WKContentRuleListStore, WKWebView};

            let mtm = MainThreadMarker::new().expect("must be on main thread");

            let wk_webview = webview.inner() as *mut WKWebView;
            let config = (*wk_webview).configuration();
            let ucc = config.userContentController();

            // Block all external http/https; allow tauri:// and localhost (dev server).
            // In production builds, localhost is not reachable anyway.
            let rules_json = concat!(
                r#"[{"trigger":{"url-filter":"https?://.*","#,
                r#""unless-domain":["localhost","127.0.0.1","tauri.localhost"]},"#,
                r#""action":{"type":"block"}}]"#,
            );

            let identifier = NSString::from_str("mini-diarium-block");
            let rules = NSString::from_str(rules_json);

            // Clone ucc so the async completion handler can call addContentRuleList
            // after the with_webview closure returns.
            let ucc_retained = ucc.clone();

            let block = RcBlock::new(move |list: *mut WKContentRuleList, _err: *mut NSError| {
                if let Some(rule_list) = list.as_ref() {
                    ucc_retained.addContentRuleList(rule_list);
                }
            });

            WKContentRuleListStore::defaultStore(mtm)
                .as_ref()
                .expect("defaultStore should succeed")
                .compileContentRuleListForIdentifier_encodedContentRuleList_completionHandler(
                    Some(&identifier),
                    Some(&rules),
                    Some(&*block),
                );
        }
    }) {
        warn!("with_webview failed for WKContentRuleList handler: {}", e);
    }
}
