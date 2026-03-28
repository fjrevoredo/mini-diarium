use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

/// Handles to items that must be disabled while the diary is locked.
/// Stored as Tauri-managed state; `MenuItem<Wry>` is Send + Sync.
pub struct LockableMenuItems(pub Vec<tauri::menu::MenuItem<Wry>>);

/// Handles to all menu items and submenus whose text must update when the locale changes.
/// Stored as Tauri-managed state; all Tauri menu handle types are Send + Sync.
pub struct TranslatableMenuItems {
    pub navigate_prev_day: tauri::menu::MenuItem<Wry>,
    pub navigate_next_day: tauri::menu::MenuItem<Wry>,
    pub navigate_today: tauri::menu::MenuItem<Wry>,
    pub go_to_date: tauri::menu::MenuItem<Wry>,
    pub navigate_prev_month: tauri::menu::MenuItem<Wry>,
    pub navigate_next_month: tauri::menu::MenuItem<Wry>,
    pub statistics: tauri::menu::MenuItem<Wry>,
    pub import_item: tauri::menu::MenuItem<Wry>,
    pub export_item: tauri::menu::MenuItem<Wry>,
    pub preferences: tauri::menu::MenuItem<Wry>,
    pub about: tauri::menu::MenuItem<Wry>,
    pub navigation_menu: tauri::menu::Submenu<Wry>,
    pub diary_menu: tauri::menu::Submenu<Wry>,
    #[cfg(not(target_os = "macos"))]
    pub file_menu: tauri::menu::Submenu<Wry>,
    #[cfg(not(target_os = "macos"))]
    pub help_menu: tauri::menu::Submenu<Wry>,
}

/// Build and set up the application menu
///
/// # Active keyboard shortcuts (single canonical reference)
///
/// All shortcuts are OS-level menu accelerators — they fire before the webview/editor
/// sees the keystroke, so they never conflict with TipTap bindings.
///
/// | Action            | Shortcut                | Notes                              |
/// |-------------------|-------------------------|------------------------------------|
/// | Previous Day      | CmdOrCtrl+[             | Bracket keys: no editor conflict   |
/// | Next Day          | CmdOrCtrl+]             |                                    |
/// | Previous Month    | CmdOrCtrl+Shift+[       |                                    |
/// | Next Month        | CmdOrCtrl+Shift+]       |                                    |
/// | Go to Today       | CmdOrCtrl+T             | Safe as OS-level accelerator       |
/// | Go to Date…       | CmdOrCtrl+G             |                                    |
/// | Preferences…      | CmdOrCtrl+,             | Universal standard                 |
/// | Statistics…       | (none)                  | Removed: was TipTap italic conflict|
/// | Import…           | (none)                  | Removed: was DevTools conflict     |
/// | Export…           | (none)                  | Removed: rare operation            |
pub fn build_menu(
    app: &AppHandle<Wry>,
) -> tauri::Result<(LockableMenuItems, TranslatableMenuItems)> {
    // Lockable — start disabled, enabled on unlock
    let navigate_prev_day = MenuItemBuilder::with_id("navigate_prev_day", "Previous Day")
        .accelerator("CmdOrCtrl+[")
        .enabled(false)
        .build(app)?;

    let navigate_next_day = MenuItemBuilder::with_id("navigate_next_day", "Next Day")
        .accelerator("CmdOrCtrl+]")
        .enabled(false)
        .build(app)?;

    let navigate_today = MenuItemBuilder::with_id("navigate_today", "Go to Today")
        .accelerator("CmdOrCtrl+T")
        .enabled(false)
        .build(app)?;

    let go_to_date = MenuItemBuilder::with_id("go_to_date", "Go to Date...")
        .accelerator("CmdOrCtrl+G")
        .enabled(false)
        .build(app)?;

    let navigate_prev_month = MenuItemBuilder::with_id("navigate_prev_month", "Previous Month")
        .accelerator("CmdOrCtrl+Shift+[")
        .enabled(false)
        .build(app)?;

    let navigate_next_month = MenuItemBuilder::with_id("navigate_next_month", "Next Month")
        .accelerator("CmdOrCtrl+Shift+]")
        .enabled(false)
        .build(app)?;

    let statistics = MenuItemBuilder::with_id("statistics", "Statistics...")
        .enabled(false)
        .build(app)?;

    let import_item = MenuItemBuilder::with_id("import", "Import...")
        .enabled(false)
        .build(app)?;

    let export_item = MenuItemBuilder::with_id("export", "Export...")
        .enabled(false)
        .build(app)?;

    // Always enabled
    let preferences = MenuItemBuilder::with_id("preferences", "Preferences...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let about = MenuItemBuilder::with_id("about", "About Mini Diarium").build(app)?;

    let lockable = vec![
        navigate_prev_day.clone(),
        navigate_next_day.clone(),
        navigate_today.clone(),
        go_to_date.clone(),
        navigate_prev_month.clone(),
        navigate_next_month.clone(),
        statistics.clone(),
        import_item.clone(),
        export_item.clone(),
    ];

    // Shared submenus (same on all platforms)
    let navigation_menu = SubmenuBuilder::new(app, "Navigation")
        .item(&navigate_prev_day)
        .item(&navigate_next_day)
        .separator()
        .item(&navigate_today)
        .item(&go_to_date)
        .separator()
        .item(&navigate_prev_month)
        .item(&navigate_next_month)
        .build()?;

    let diary_menu = SubmenuBuilder::new(app, "Diary")
        .item(&statistics)
        .separator()
        .item(&import_item)
        .item(&export_item)
        .build()?;

    #[cfg(target_os = "macos")]
    let menu = {
        let app_menu = SubmenuBuilder::new(app, "Mini Diarium")
            .item(&about)
            .separator()
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
            .item(&navigation_menu)
            .item(&diary_menu)
            .item(&window_menu)
            .build()?
    };

    #[cfg(not(target_os = "macos"))]
    let (menu, file_menu_handle, help_menu_handle) = {
        let file_menu = SubmenuBuilder::new(app, "File")
            .item(&preferences)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        let help_menu = SubmenuBuilder::new(app, "Help").item(&about).build()?;
        let file_clone = file_menu.clone();
        let help_clone = help_menu.clone();
        let m = MenuBuilder::new(app)
            .item(&file_menu)
            .item(&navigation_menu)
            .item(&diary_menu)
            .item(&help_menu)
            .build()?;
        (m, file_clone, help_clone)
    };

    // Set an app-wide menu.
    // On macOS, window-specific menus are unsupported and must be set via AppHandle.
    // On Windows/Linux, this also applies the menu to windows that use the app-wide menu.
    app.set_menu(menu.clone())?;

    // Set up menu event handler
    app.on_menu_event(move |app, event| {
        let event_id = event.id().as_ref();

        // Emit event to frontend for handling
        match event_id {
            "navigate_prev_day" => {
                let _ = app.emit("menu-navigate-previous-day", ());
            }
            "navigate_next_day" => {
                let _ = app.emit("menu-navigate-next-day", ());
            }
            "navigate_today" => {
                let _ = app.emit("menu-navigate-to-today", ());
            }
            "go_to_date" => {
                let _ = app.emit("menu-go-to-date", ());
            }
            "navigate_prev_month" => {
                let _ = app.emit("menu-navigate-previous-month", ());
            }
            "navigate_next_month" => {
                let _ = app.emit("menu-navigate-next-month", ());
            }
            "preferences" => {
                let _ = app.emit("menu-preferences", ());
            }
            "statistics" => {
                let _ = app.emit("menu-statistics", ());
            }
            "import" => {
                let _ = app.emit("menu-import", ());
            }
            "export" => {
                let _ = app.emit("menu-export", ());
            }
            "about" => {
                let _ = app.emit("menu-about", ());
            }
            _ => {}
        }
    });

    let translatable = TranslatableMenuItems {
        navigate_prev_day: navigate_prev_day.clone(),
        navigate_next_day: navigate_next_day.clone(),
        navigate_today: navigate_today.clone(),
        go_to_date: go_to_date.clone(),
        navigate_prev_month: navigate_prev_month.clone(),
        navigate_next_month: navigate_next_month.clone(),
        statistics: statistics.clone(),
        import_item: import_item.clone(),
        export_item: export_item.clone(),
        preferences: preferences.clone(),
        about: about.clone(),
        navigation_menu: navigation_menu.clone(),
        diary_menu: diary_menu.clone(),
        #[cfg(not(target_os = "macos"))]
        file_menu: file_menu_handle,
        #[cfg(not(target_os = "macos"))]
        help_menu: help_menu_handle,
    };

    Ok((LockableMenuItems(lockable), translatable))
}

/// Enable or disable the lockable menu items based on diary lock state.
/// Safe to call even before `LockableMenuItems` has been managed.
pub fn update_menu_lock_state(app: &AppHandle<Wry>, locked: bool) {
    if let Some(state) = app.try_state::<LockableMenuItems>() {
        for item in &state.0 {
            let _ = item.set_enabled(!locked);
        }
    }
}
