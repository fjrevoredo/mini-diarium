use crate::spellcheck::{self, SpellcheckStatus};
use tauri::{AppHandle, Manager};

/// Which dictionary languages to hand the WebView.
///
/// Disabling needs none — no check will run, so naming a dictionary is meaningless.
fn languages_for(enabled: bool, ui_locale: &str, env_locale: Option<&str>) -> Vec<String> {
    if enabled {
        spellcheck::resolve_languages(ui_locale, env_locale)
    } else {
        Vec::new()
    }
}

/// First non-empty value in `LC_ALL` → `LANG` order, matching POSIX precedence.
/// An exported-but-empty variable means "unset" and must not shadow the next one.
fn pick_locale(lc_all: Option<String>, lang: Option<String>) -> Option<String> {
    [lc_all, lang]
        .into_iter()
        .flatten()
        .find(|value| !value.is_empty())
}

/// The OS locale, used to refine the dictionary region. Shared with the debug dump,
/// which reports the same spell-check status this command returns.
pub(crate) fn system_locale() -> Option<String> {
    pick_locale(std::env::var("LC_ALL").ok(), std::env::var("LANG").ok())
}

/// Turn WebView-level spell checking on or off.
///
/// Called from the frontend `createEffect` whenever the `enableSpellcheck` preference
/// or the UI language changes. `locale` is the app UI language; the dictionary region
/// is refined from the system locale when they agree. Only Linux/WebKitGTK acts on
/// this — see [`crate::spellcheck::apply`].
#[tauri::command]
pub fn set_spellcheck_enabled(app: AppHandle, enabled: bool, locale: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found for spell checking".to_string())?;

    let languages = languages_for(enabled, &locale, system_locale().as_deref());
    spellcheck::apply(&window, enabled, languages);

    Ok(())
}

/// Report whether Enchant can provide the dictionary WebKitGTK will use.
///
/// Windows and macOS return `None` because spell checking is delegated to the OS.
#[tauri::command]
pub fn get_spellcheck_status(locale: String) -> Result<Option<SpellcheckStatus>, String> {
    Ok(spellcheck::status(&locale, system_locale().as_deref()))
}

#[cfg(test)]
mod tests {
    use super::{languages_for, pick_locale};

    #[test]
    fn enabling_resolves_dictionary_languages() {
        assert_eq!(languages_for(true, "de", None), vec!["de_DE"]);
    }

    #[test]
    fn disabling_requests_no_languages() {
        // Nothing is going to be checked, so there is no dictionary to name.
        assert!(languages_for(false, "de", None).is_empty());
    }

    #[test]
    fn system_locale_refines_the_ui_language() {
        assert_eq!(
            languages_for(true, "en", Some("en_GB.UTF-8")),
            vec!["en_GB", "en_US"]
        );
    }

    #[test]
    fn lc_all_takes_precedence_over_lang() {
        assert_eq!(
            pick_locale(Some("en_GB.UTF-8".into()), Some("de_DE.UTF-8".into())),
            Some("en_GB.UTF-8".to_string())
        );
    }

    #[test]
    fn empty_env_values_are_skipped() {
        assert_eq!(
            pick_locale(Some(String::new()), Some("de_DE.UTF-8".into())),
            Some("de_DE.UTF-8".to_string())
        );
        assert_eq!(pick_locale(None, Some(String::new())), None);
        assert_eq!(pick_locale(None, None), None);
    }
}
