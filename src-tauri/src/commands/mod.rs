pub mod attachments;
pub mod auth;
pub mod backup;
pub mod backup_inspect;
pub mod backup_triggers;
pub mod debug;
pub mod entries;
pub mod export;
pub mod files;
pub mod fonts;
pub mod images;
pub mod import;
pub mod menu;
pub mod navigation;
pub mod platform;
pub mod plugin;
pub mod search;
pub mod spellcheck;
pub mod stats;
pub mod tags;

use tauri::AppHandle;

/// Runs a command's heavy work on Tauri's blocking thread pool and waits for it.
///
/// On Windows a synchronous command runs on the WebView2 event thread, so the window cannot
/// repaint or take input until it returns. A command that reads, encrypts, or writes large
/// blobs is `async` and puts that work here instead. The closure must be `'static`, so it
/// reaches managed state through the `AppHandle` (`app.state::<DiaryState>()`), not through
/// a borrowed `State`.
pub(crate) async fn run_blocking<T, F>(app: AppHandle, work: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || work(&app))
        .await
        .map_err(|_| "Background task failed".to_string())?
}
