use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

/// Build and set up the application menu
pub fn build_menu(app: &AppHandle<Wry>) -> tauri::Result<()> {
    // Build the Navigation menu items
    let navigate_prev_day = MenuItemBuilder::with_id("navigate_prev_day", "Previous Day")
        .accelerator("CmdOrCtrl+Left")
        .build(app)?;

    let navigate_next_day = MenuItemBuilder::with_id("navigate_next_day", "Next Day")
        .accelerator("CmdOrCtrl+Right")
        .build(app)?;

    let navigate_today = MenuItemBuilder::with_id("navigate_today", "Go to Today")
        .accelerator("CmdOrCtrl+T")
        .build(app)?;

    let go_to_date = MenuItemBuilder::with_id("go_to_date", "Go to Date...")
        .accelerator("CmdOrCtrl+G")
        .build(app)?;

    let navigate_prev_month = MenuItemBuilder::with_id("navigate_prev_month", "Previous Month")
        .accelerator("CmdOrCtrl+Shift+Left")
        .build(app)?;

    let navigate_next_month = MenuItemBuilder::with_id("navigate_next_month", "Next Month")
        .accelerator("CmdOrCtrl+Shift+Right")
        .build(app)?;

    // Build Preferences menu item
    let preferences = MenuItemBuilder::with_id("preferences", "Preferences...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    // Build the Navigation submenu
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

    // Build the main menu
    let menu = MenuBuilder::new(app)
        .item(&navigation_menu)
        .item(&preferences)
        .build()?;

    // Set the menu on all windows
    for window in app.webview_windows().values() {
        window.set_menu(menu.clone())?;
    }

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
            _ => {}
        }
    });

    Ok(())
}
