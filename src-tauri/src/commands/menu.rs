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
        "de" => MenuLabels {
            navigation_menu: "Navigation",
            diary_menu: "Tagebuch",
            navigate_prev_day: "Vorheriger Tag",
            navigate_next_day: "Nächster Tag",
            navigate_today: "Zu heute gehen",
            go_to_date: "Gehe zu Datum...",
            navigate_prev_month: "Vorheriger Monat",
            navigate_next_month: "Nächster Monat",
            statistics: "Statistiken...",
            import_item: "Importieren...",
            export_item: "Exportieren...",
            preferences: "Einstellungen...",
            about: "Über Mini Diarium",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Datei",
            #[cfg(not(target_os = "macos"))]
            help_menu: "Hilfe",
        },
        "it" => MenuLabels {
            navigation_menu: "Navigazione",
            diary_menu: "Diario",
            navigate_prev_day: "Giorno precedente",
            navigate_next_day: "Giorno successivo",
            navigate_today: "Vai a oggi",
            go_to_date: "Vai a data...",
            navigate_prev_month: "Mese precedente",
            navigate_next_month: "Mese successivo",
            statistics: "Statistiche...",
            import_item: "Importa...",
            export_item: "Esporta...",
            preferences: "Preferenze...",
            about: "Informazioni su Mini Diarium",
            #[cfg(not(target_os = "macos"))]
            file_menu: "File",
            #[cfg(not(target_os = "macos"))]
            help_menu: "Aiuto",
        },
        "hi" => MenuLabels {
            navigation_menu: "नेविगेशन",
            diary_menu: "डायरी",
            navigate_prev_day: "पिछला दिन",
            navigate_next_day: "अगला दिन",
            navigate_today: "आज पर जाएं",
            go_to_date: "तारीख पर जाएं...",
            navigate_prev_month: "पिछला महीना",
            navigate_next_month: "अगला महीना",
            statistics: "आँकड़े...",
            import_item: "आयात करें...",
            export_item: "निर्यात करें...",
            preferences: "प्राथमिकताएं...",
            about: "Mini Diarium के बारे में",
            #[cfg(not(target_os = "macos"))]
            file_menu: "फ़ाइल",
            #[cfg(not(target_os = "macos"))]
            help_menu: "सहायता",
        },
        "pt-BR" => MenuLabels {
            navigation_menu: "Navegação",
            diary_menu: "Diário",
            navigate_prev_day: "Dia anterior",
            navigate_next_day: "Próximo dia",
            navigate_today: "Ir para hoje",
            go_to_date: "Ir para data...",
            navigate_prev_month: "Mês anterior",
            navigate_next_month: "Próximo mês",
            statistics: "Estatísticas...",
            import_item: "Importar...",
            export_item: "Exportar...",
            preferences: "Preferências...",
            about: "Sobre o Mini Diarium",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Arquivo",
            #[cfg(not(target_os = "macos"))]
            help_menu: "Ajuda",
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

#[cfg(test)]
mod tests {
    use super::labels_for_locale;

    #[test]
    fn pt_br_arm_returns_brazilian_portuguese_labels() {
        let l = labels_for_locale("pt-BR");
        assert_eq!(l.navigation_menu, "Navegação");
        assert_eq!(l.diary_menu, "Diário");
        assert_eq!(l.navigate_prev_day, "Dia anterior");
        assert_eq!(l.navigate_next_day, "Próximo dia");
        assert_eq!(l.navigate_today, "Ir para hoje");
        assert_eq!(l.go_to_date, "Ir para data...");
        assert_eq!(l.navigate_prev_month, "Mês anterior");
        assert_eq!(l.navigate_next_month, "Próximo mês");
        assert_eq!(l.statistics, "Estatísticas...");
        assert_eq!(l.import_item, "Importar...");
        assert_eq!(l.export_item, "Exportar...");
        assert_eq!(l.preferences, "Preferências...");
        assert_eq!(l.about, "Sobre o Mini Diarium");
        #[cfg(not(target_os = "macos"))]
        {
            assert_eq!(l.file_menu, "Arquivo");
            assert_eq!(l.help_menu, "Ajuda");
        }
    }

    #[test]
    fn unknown_locale_falls_back_to_english() {
        let l = labels_for_locale("xx");
        assert_eq!(l.navigation_menu, "Navigation");
        assert_eq!(l.diary_menu, "Diary");
    }
}
