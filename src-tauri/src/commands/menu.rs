use crate::menu::TranslatableMenuItems;
use tauri::State;

struct MenuLabels {
    preferences: &'static str,
    #[cfg(not(target_os = "macos"))]
    file_menu: &'static str,
}

/// Map locale code → static menu label strings.
/// Add a new `"xx" =>` arm here whenever a new community locale JSON file is
/// added to `src/i18n/locales/` — the key must match the locale code used in
/// the frontend `localeMap` in `src/i18n/index.ts`.
fn labels_for_locale(locale: &str) -> MenuLabels {
    match locale {
        "es" => MenuLabels {
            preferences: "Preferencias...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Archivo",
        },
        "de" => MenuLabels {
            preferences: "Einstellungen...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Datei",
        },
        "it" => MenuLabels {
            preferences: "Preferenze...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "File",
        },
        "hi" => MenuLabels {
            preferences: "प्राथमिकताएं...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "फ़ाइल",
        },
        "pt-BR" => MenuLabels {
            preferences: "Preferências...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "Arquivo",
        },
        // Default / fallback — English for any unknown locale code
        _ => MenuLabels {
            preferences: "Preferences...",
            #[cfg(not(target_os = "macos"))]
            file_menu: "File",
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
        .preferences
        .set_text(l.preferences)
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    {
        state
            .file_menu
            .set_text(l.file_menu)
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
        assert_eq!(l.preferences, "Preferências...");
        #[cfg(not(target_os = "macos"))]
        assert_eq!(l.file_menu, "Arquivo");
    }

    #[test]
    fn unknown_locale_falls_back_to_english() {
        let l = labels_for_locale("xx");
        assert_eq!(l.preferences, "Preferences...");
        #[cfg(not(target_os = "macos"))]
        assert_eq!(l.file_menu, "File");
    }
}
