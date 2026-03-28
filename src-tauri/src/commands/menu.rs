use crate::menu::TranslatableMenuItems;
use tauri::State;

struct MenuLabels {
    navigation_menu: &'static str,
    diary_menu: &'static str,
    navigate_prev_day: &'static str,
    navigate_next_day: &'static str,
    navigate_today: &'static str,
    go_to_date: &'static str,
    navigate_prev_month: &'static str,
    navigate_next_month: &'static str,
    statistics: &'static str,
    import_item: &'static str,
    export_item: &'static str,
    preferences: &'static str,
    about: &'static str,
    #[cfg(not(target_os = "macos"))]
    file_menu: &'static str,
    #[cfg(not(target_os = "macos"))]
    help_menu: &'static str,
}

/// Map locale code → static menu label strings.
/// Add a new `"xx" =>` arm here whenever a new community locale JSON file is
/// added to `src/i18n/locales/` — the key must match the locale code used in
/// the frontend `localeMap` in `src/i18n/index.ts`.
fn labels_for_locale(locale: &str) -> MenuLabels {
    match locale {
        "es" => MenuLabels {
            navigation_menu: "Navegación",
            diary_menu: "Diario",
            navigate_prev_day: "Día anterior",
            navigate_next_day: "Día siguiente",
            navigate_today: "Ir a hoy",
            go_to_date: "Ir a fecha...",
            navigate_prev_month: "Mes anterior",
            navigate_next_month: "Mes siguiente",
            statistics: "Estadísticas...",
            import_item: "Importar...",
            export_item: "Exportar...",
            preferences: "Preferencias...",
            about: "Acerca de Mini Diarium",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Archivo",
            #[cfg(not(target_os = "macos"))]
            help_menu: "Ayuda",
        },
        // Default / fallback — English for any unknown locale code
        _ => MenuLabels {
            navigation_menu: "Navigation",
            diary_menu: "Diary",
            navigate_prev_day: "Previous Day",
            navigate_next_day: "Next Day",
            navigate_today: "Go to Today",
            go_to_date: "Go to Date...",
            navigate_prev_month: "Previous Month",
            navigate_next_month: "Next Month",
            statistics: "Statistics...",
            import_item: "Import...",
            export_item: "Export...",
            preferences: "Preferences...",
            about: "About Mini Diarium",
            #[cfg(not(target_os = "macos"))]
            file_menu: "File",
            #[cfg(not(target_os = "macos"))]
            help_menu: "Help",
        },
    }
}

/// Update all native menu item texts to match the given locale code.
/// Called from the frontend `createEffect` whenever `preferences().language` changes.
/// Unknown locale codes silently fall back to English.
#[tauri::command]
pub fn update_menu_locale(
    locale: String,
    state: State<TranslatableMenuItems>,
) -> Result<(), String> {
    let l = labels_for_locale(&locale);

    state
        .navigate_prev_day
        .set_text(l.navigate_prev_day)
        .map_err(|e| e.to_string())?;
    state
        .navigate_next_day
        .set_text(l.navigate_next_day)
        .map_err(|e| e.to_string())?;
    state
        .navigate_today
        .set_text(l.navigate_today)
        .map_err(|e| e.to_string())?;
    state
        .go_to_date
        .set_text(l.go_to_date)
        .map_err(|e| e.to_string())?;
    state
        .navigate_prev_month
        .set_text(l.navigate_prev_month)
        .map_err(|e| e.to_string())?;
    state
        .navigate_next_month
        .set_text(l.navigate_next_month)
        .map_err(|e| e.to_string())?;
    state
        .statistics
        .set_text(l.statistics)
        .map_err(|e| e.to_string())?;
    state
        .import_item
        .set_text(l.import_item)
        .map_err(|e| e.to_string())?;
    state
        .export_item
        .set_text(l.export_item)
        .map_err(|e| e.to_string())?;
    state
        .preferences
        .set_text(l.preferences)
        .map_err(|e| e.to_string())?;
    state.about.set_text(l.about).map_err(|e| e.to_string())?;
    state
        .navigation_menu
        .set_text(l.navigation_menu)
        .map_err(|e| e.to_string())?;
    state
        .diary_menu
        .set_text(l.diary_menu)
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    {
        state
            .file_menu
            .set_text(l.file_menu)
            .map_err(|e| e.to_string())?;
        state
            .help_menu
            .set_text(l.help_menu)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
