//! Spell-check language resolution and WebView-level enablement.
//!
//! Windows (WebView2) and macOS (WKWebView) route the HTML `spellcheck` attribute
//! straight to the OS text checker, so nothing here is needed on those platforms.
//! WebKitGTK runs no checker at all until spell checking is switched on for the
//! `WebKitWebContext`, which defaults to off — so on Linux the attribute alone is
//! inert and [`apply`] is what actually turns the feature on.

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
/// German dictionary for an English UI. Otherwise the language's default region
/// applies. The result is never empty.
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

    let region = env_region.or_else(|| {
        DEFAULT_REGIONS
            .iter()
            .find(|(tag, _)| *tag == language)
            .map(|(_, region)| region.to_string())
    });

    match region {
        Some(region) => vec![format!("{}_{}", language, region)],
        // Unknown language with no known default: best effort, never empty.
        None => vec![language],
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
    use super::resolve_languages;

    #[test]
    fn env_region_refines_matching_base_language() {
        assert_eq!(resolve_languages("en", Some("en_GB.UTF-8")), vec!["en_GB"]);
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
}
