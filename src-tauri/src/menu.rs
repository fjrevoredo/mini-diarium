use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Wry,
};

/// Handles to all menu items and submenus whose text must update when the locale changes.
/// Stored as Tauri-managed state; all Tauri menu handle types are Send + Sync.
pub struct TranslatableMenuItems {
    pub preferences: tauri::menu::MenuItem<Wry>,
    #[cfg(not(target_os = "macos"))]
    pub file_menu: tauri::menu::Submenu<Wry>,
}

/// Build and set up the application menu.
///
/// The native menu is deliberately minimal (TODO-0065): every app action lives in the
/// WebView (Header controls + the `⋮` overflow menu), so the OS menu keeps only
/// Preferences and Quit as a fallback access path — plus, on macOS, the
/// `PredefinedMenuItem` Edit/Window submenus that back OS text-editing behavior.
///
/// # Active keyboard shortcuts
///
/// Only **Preferences** (`CmdOrCtrl+,`) is still an OS-level menu accelerator, firing
/// before the webview sees the keystroke. Every other app shortcut is a JS `keydown`
/// handler — see `src/lib/keyboard-shortcuts.ts`, which is the canonical reference for
/// the full list (day/month navigation, Go to Today, Go to Date, search).
pub fn build_menu(app: &AppHandle<Wry>) -> tauri::Result<TranslatableMenuItems> {
    let preferences = MenuItemBuilder::with_id("preferences", "Preferences...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    #[cfg(target_os = "macos")]
    let menu = {
        let app_menu = SubmenuBuilder::new(app, "Mini Diarium")
            .item(&preferences)
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        let edit_menu = SubmenuBuilder::new(app, "Edit")
            .item(&PredefinedMenuItem::undo(app, None)?)
            .item(&PredefinedMenuItem::redo(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::cut(app, None)?)
            .item(&PredefinedMenuItem::copy(app, None)?)
            .item(&PredefinedMenuItem::paste(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::select_all(app, None)?)
            .build()?;
        let window_menu = SubmenuBuilder::new(app, "Window")
            .item(&PredefinedMenuItem::minimize(app, None)?)
            .item(&PredefinedMenuItem::maximize(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::close_window(app, None)?)
            .build()?;
        MenuBuilder::new(app)
            .item(&app_menu)
            .item(&edit_menu)
            .item(&window_menu)
            .build()?
    };

    #[cfg(not(target_os = "macos"))]
    let (menu, file_menu_handle) = {
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(&preferences)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        let file_clone = file_menu.clone();
        let m = MenuBuilder::new(app).item(&file_menu).build()?;
        (m, file_clone)
    };

    // Set an app-wide menu.
    // On macOS, window-specific menus are unsupported and must be set via AppHandle.
    // On Windows/Linux, this also applies the menu to windows that use the app-wide menu.
    app.set_menu(menu.clone())?;

    // Set up menu event handler
    app.on_menu_event(move |app, event| {
        if event.id().as_ref() == "preferences" {
            let _ = app.emit("menu-preferences", ());
        }
    });

    Ok(TranslatableMenuItems {
        preferences: preferences.clone(),
        #[cfg(not(target_os = "macos"))]
        file_menu: file_menu_handle,
    })
}
