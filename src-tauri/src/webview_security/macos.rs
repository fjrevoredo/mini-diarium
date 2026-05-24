// Installs a compiled WKContentRuleList that blocks all HTTP(S) subresource
// requests to external hosts. WKContentRuleList is the only WebKit-supported
// mechanism for this (NSURLProtocol does not intercept WKWebView traffic —
// WebKit bug #138169, won't-fix).
//
// The rule compilation is async; the completion handler fires on the main queue
// and immediately calls addContentRuleList on the user content controller.
#[cfg(target_os = "macos")]
pub fn install_content_rule_list(win: &tauri::WebviewWindow) {
    use log::warn;

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
