//! Spell-check language resolution and WebView-level enablement.
//!
//! Windows (WebView2) and macOS (WKWebView) route the HTML `spellcheck` attribute
//! straight to the OS text checker, so nothing here is needed on those platforms.
//! WebKitGTK runs no checker at all until spell checking is switched on for the
//! `WebKitWebContext`, which defaults to off — so on Linux the attribute alone is
//! inert and [`apply`] is what actually turns the feature on.

use serde::Serialize;

/// Availability of the dictionary WebKitGTK will request for the selected UI locale.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpellcheckStatus {
    pub language: String,
    pub dictionary_available: bool,
    pub is_flatpak: bool,
}

/// Region appended to a bare language tag, one per shipped UI language.
///
/// Resolving to a fully-qualified locale (rather than a bare tag) is what
/// guarantees a hit against the dictionaries bundled in the Flatpak, instead of
/// relying on enchant's fuzzy tag matching.
const DEFAULT_REGIONS: &[(&str, &str)] = &[
    ("en", "US"),
    ("es", "ES"),
    ("de", "DE"),
    ("fr", "FR"),
    ("it", "IT"),
    ("pt", "BR"),
    ("hi", "IN"),
];

/// Split a locale string into `(language, region)`.
///
/// Handles both the POSIX (`de_DE.UTF-8@euro`) and BCP-47-ish (`pt-BR`) spellings,
/// dropping the codeset and modifier suffixes. Returns `None` for the non-locale
/// values `C` / `POSIX`, which carry no language information.
fn parse_locale(raw: &str) -> Option<(String, Option<String>)> {
    let base = raw.split(['.', '@']).next().unwrap_or("").replace('-', "_");
    if base.is_empty() || base == "C" || base == "POSIX" {
        return None;
    }

    let mut parts = base.split('_');
    let language = parts.next().filter(|s| !s.is_empty())?.to_lowercase();
    let region = parts
        .next()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_uppercase());

    Some((language, region))
}

/// Resolve the dictionary languages to request, from the app UI language refined
/// by the system locale.
///
/// The UI language wins: an explicit region in it (`pt-BR`) is used as-is. Only when
/// the UI language carries no region does the system locale get a say, and then only
/// if it names the same base language — so a German system locale never drags in a
/// German dictionary for an English UI. The app language's default region remains a
/// fallback, so a Flatpak-bundled `es_ES` dictionary still works on an `es_MX` system.
/// The result is never empty.
pub fn resolve_languages(ui_locale: &str, env_locale: Option<&str>) -> Vec<String> {
    let Some((language, ui_region)) = parse_locale(ui_locale) else {
        return vec!["en_US".to_string()];
    };

    if let Some(region) = ui_region {
        return vec![format!("{}_{}", language, region)];
    }

    let env_region = env_locale
        .and_then(parse_locale)
        .filter(|(env_language, _)| *env_language == language)
        .and_then(|(_, region)| region);

    let default_region = DEFAULT_REGIONS
        .iter()
        .find(|(tag, _)| *tag == language)
        .map(|(_, region)| region.to_string());

    match (env_region, default_region) {
        (Some(env_region), Some(default_region)) if env_region != default_region => vec![
            format!("{}_{}", language, env_region),
            format!("{}_{}", language, default_region),
        ],
        (Some(region), _) | (None, Some(region)) => vec![format!("{}_{}", language, region)],
        // Unknown language with no known default: best effort, never empty.
        (None, None) => vec![language],
    }
}

/// Resolve the active dictionary and check whether Enchant can provide it.
///
/// The injected lookup keeps tests independent from the machine's installed
/// dictionaries while production uses Enchant itself below.
pub fn status_for(
    ui_locale: &str,
    env_locale: Option<&str>,
    is_flatpak: bool,
    dictionary_exists: impl Fn(&str) -> bool,
) -> SpellcheckStatus {
    let languages = resolve_languages(ui_locale, env_locale);
    let language = languages
        .first()
        .cloned()
        .unwrap_or_else(|| "en_US".to_string());
    let dictionary_available = languages
        .iter()
        .any(|candidate| dictionary_exists(candidate));

    SpellcheckStatus {
        language,
        dictionary_available,
        is_flatpak,
    }
}

#[cfg(target_os = "linux")]
fn enchant_dictionary_exists(language: &str) -> bool {
    use std::ffi::{c_char, c_int, c_void, CString};

    type EnchantBrokerInit = unsafe extern "C" fn() -> *mut c_void;
    type EnchantBrokerDictExists = unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int;
    type EnchantBrokerFree = unsafe extern "C" fn(*mut c_void);

    let Ok(language) = CString::new(language) else {
        return false;
    };

    // Enchant is already a WebKitGTK runtime dependency. Loading it at runtime
    // avoids making native development builds depend on its header package.
    let Ok(library) = (unsafe { libloading::Library::new("libenchant-2.so.2") }) else {
        return false;
    };

    // SAFETY: The Enchant 2 public header declares these exact C ABI signatures.
    // `library` remains alive until after the broker is freed, and the CString
    // keeps the language pointer valid for the duration of the call.
    unsafe {
        let Ok(init) = library.get::<EnchantBrokerInit>(b"enchant_broker_init\0") else {
            return false;
        };
        let Ok(dict_exists) =
            library.get::<EnchantBrokerDictExists>(b"enchant_broker_dict_exists\0")
        else {
            return false;
        };
        let Ok(free) = library.get::<EnchantBrokerFree>(b"enchant_broker_free\0") else {
            return false;
        };

        let broker = init();
        if broker.is_null() {
            return false;
        }

        let exists = dict_exists(broker, language.as_ptr()) != 0;
        free(broker);
        exists
    }
}

/// Return dictionary availability on Linux, where WebKitGTK uses Enchant.
/// Other platforms use their OS-native checker and have no dictionary status to report.
pub fn status(ui_locale: &str, env_locale: Option<&str>) -> Option<SpellcheckStatus> {
    #[cfg(target_os = "linux")]
    {
        Some(status_for(
            ui_locale,
            env_locale,
            std::env::var_os("FLATPAK_ID").is_some(),
            enchant_dictionary_exists,
        ))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (ui_locale, env_locale);
        None
    }
}

/// Apply the spell-check setting to the WebView itself.
///
/// Linux only: WebKitGTK ignores the HTML `spellcheck` attribute until the
/// `WebKitWebContext` has spell checking switched on, so this is what makes the
/// preference do anything there. `languages` is only consulted when enabling, and
/// must hold fully-qualified locales (`en_US`) so enchant finds a bundled dictionary.
/// Failures are logged and swallowed — a WebView that won't hand out its context is
/// not a reason to fail the command.
///
/// On Windows and macOS the OS text checker already honours the HTML attribute, so
/// this is a no-op.
pub fn apply(window: &tauri::WebviewWindow, enabled: bool, languages: Vec<String>) {
    #[cfg(target_os = "linux")]
    {
        use log::warn;
        use webkit2gtk::{WebContextExt, WebViewExt};

        // The closure captures only `bool` + `Vec<String>`, satisfying the
        // `Send + 'static` bound `with_webview` imposes.
        let result = window.with_webview(move |webview| {
            let Some(context) = webview.inner().context() else {
                warn!("WebKit web context unavailable; spell checking not applied");
                return;
            };

            // Languages must be set before enabling, or WebKit picks up the
            // environment locale for the first check.
            if enabled {
                let languages: Vec<&str> = languages.iter().map(String::as_str).collect();
                context.set_spell_checking_languages(&languages);
            }
            context.set_spell_checking_enabled(enabled);
        });

        if let Err(error) = result {
            warn!("with_webview failed for spell checking: {}", error);
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, enabled, languages);
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_languages, status_for};

    #[test]
    fn env_region_refines_matching_base_language() {
        assert_eq!(
            resolve_languages("en", Some("en_GB.UTF-8")),
            vec!["en_GB", "en_US"]
        );
    }

    #[test]
    fn non_matching_env_base_falls_back_to_default_region() {
        assert_eq!(resolve_languages("en", Some("de_DE.UTF-8")), vec!["en_US"]);
    }

    #[test]
    fn missing_env_locale_uses_default_region() {
        assert_eq!(resolve_languages("en", None), vec!["en_US"]);
    }

    #[test]
    fn posix_env_locales_are_rejected() {
        assert_eq!(resolve_languages("en", Some("C")), vec!["en_US"]);
        assert_eq!(resolve_languages("en", Some("POSIX")), vec!["en_US"]);
    }

    #[test]
    fn explicit_ui_region_wins_over_env() {
        assert_eq!(
            resolve_languages("pt-BR", Some("pt_PT.UTF-8")),
            vec!["pt_BR"]
        );
    }

    #[test]
    fn german_default_region() {
        assert_eq!(resolve_languages("de", None), vec!["de_DE"]);
    }

    #[test]
    fn hindi_default_region() {
        assert_eq!(resolve_languages("hi", None), vec!["hi_IN"]);
    }

    #[test]
    fn codeset_and_modifier_are_stripped() {
        assert_eq!(
            resolve_languages("en", Some("en_US.UTF-8@euro")),
            vec!["en_US"]
        );
    }

    #[test]
    fn unknown_language_is_returned_as_is() {
        assert_eq!(resolve_languages("xx", None), vec!["xx"]);
    }

    #[test]
    fn unparseable_ui_locale_falls_back_to_english() {
        // The UI language comes from a persisted preference, so it can be anything.
        // Whatever it is, WebKit must be handed a usable locale.
        assert_eq!(resolve_languages("", None), vec!["en_US"]);
        assert_eq!(resolve_languages("C", Some("de_DE.UTF-8")), vec!["en_US"]);
    }

    #[test]
    fn status_reports_the_resolved_dictionary_availability() {
        assert_eq!(
            status_for("es", None, false, |language| language == "es_ES"),
            super::SpellcheckStatus {
                language: "es_ES".to_string(),
                dictionary_available: true,
                is_flatpak: false,
            }
        );
    }

    #[test]
    fn status_marks_missing_flatpak_dictionary_for_repair_guidance() {
        assert_eq!(
            status_for("es", None, true, |_| false),
            super::SpellcheckStatus {
                language: "es_ES".to_string(),
                dictionary_available: false,
                is_flatpak: true,
            }
        );
    }

    #[test]
    fn status_accepts_the_bundled_default_when_the_system_region_is_unavailable() {
        assert_eq!(
            status_for("es", Some("es_MX.UTF-8"), true, |language| language
                == "es_ES"),
            super::SpellcheckStatus {
                language: "es_MX".to_string(),
                dictionary_available: true,
                is_flatpak: true,
            }
        );
    }
}
