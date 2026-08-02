//! Workaround for unresponsive Wayland title-bar buttons (issue #238).
//!
//! `tao <= 0.35` installs its own client-side decoration on Wayland
//! ([`wayland/header.rs`](https://github.com/tauri-apps/tao/blob/tao-v0.35.3/src/platform_impl/linux/wayland/header.rs)):
//! a `GtkHeaderBar` carrying the minimize/maximize/close buttons, wrapped in a
//! `GtkEventBox` with `above_child = true`. In GTK 3, `above_child` on a
//! `visible_window` event box is the *sole* reason `gtk_event_box_realize()`
//! creates an `GDK_INPUT_ONLY` overlay `GdkWindow`, and `gtk_event_box_map()`
//! re-raises that overlay above the children on every map. The overlay swallows
//! every button press before the header bar's buttons see it, and the event then
//! dies in tao's `GtkWindow` press/release handlers, which return
//! `Propagation::Stop`. The buttons are painted but can never be clicked.
//!
//! This app hits it from the first frame because the window is built with
//! `.visible(false)` and shown later (so `tauri-plugin-window-state` restores the
//! geometry first) — that hide→show cycle is exactly the map path above. Users
//! could only recover by maximizing or double-clicking the title bar, which makes
//! `GtkHeaderBar` rebuild its buttons so their new `GdkWindow`s land above the
//! overlay.
//!
//! Fixed upstream by [tao#1218](https://github.com/tauri-apps/tao/pull/1218) in
//! tao 0.36.0, which is not yet reachable from any published Tauri release. This
//! module is a temporary application-side stand-in and **self-disables**: on X11
//! there is no titlebar widget, and under tao ≥ 0.36 there is no `EventBox`, so
//! both fall through to [`TitlebarFix::None`]. Deleting it is tracked by
//! TODO-0097, whose trigger is the `tao_version_still_needs_the_workaround`
//! guard test below.

/// What, if anything, has to be done to a window's titlebar widget.
///
/// `dead_code` is allowed off Linux because the decision logic is deliberately
/// compiled on every platform — only `defuse` (its sole non-test caller) is
/// Linux-gated — so the Windows/macOS test runs still cover it.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TitlebarFix {
    /// tao ≤0.35 installed its EventBox-wrapped HeaderBar and raised an
    /// input-only overlay above the buttons. Drop the overlay.
    DropInputOverlay,
    /// Nothing to do: X11/SSD (no titlebar widget), tao ≥0.36 (no EventBox),
    /// or already fixed.
    None,
}

/// Decide the fix from the shape of the titlebar widget.
///
/// Kept free of GTK types so it compiles — and is tested — on every platform;
/// hence the `dead_code` allowance off Linux (see [`TitlebarFix`]).
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub(crate) fn decide(
    has_titlebar: bool,
    titlebar_is_event_box: bool,
    above_child: bool,
) -> TitlebarFix {
    if has_titlebar && titlebar_is_event_box && above_child {
        TitlebarFix::DropInputOverlay
    } else {
        TitlebarFix::None
    }
}

/// Lower tao's input-only overlay so the header-bar buttons receive clicks.
///
/// Takes any `GtkWindow` (rather than `gtk::ApplicationWindow`) so the test can
/// build a bare toplevel instead of registering a `GtkApplication`.
///
/// `set_above_child(false)` is the actual fix, not a nudge: on a realized event
/// box with `visible_window = TRUE`, GTK takes the hide → unrealize → realize →
/// show branch, and on re-realize `(!visible_window || above_child)` is false, so
/// `event_window` is never created again. The overlay is gone permanently and
/// survives later minimize/restore cycles. It is equally correct before
/// realization — the flag is simply set and `realize()` skips the overlay.
///
/// The resizable toggle is the workaround reporters confirmed on
/// [tauri#11856](https://github.com/tauri-apps/tauri/issues/11856); it drives
/// `WlHeader::connect_resize_window` → `set_decoration_layout()` → a header-bar
/// button rebuild. Strictly redundant given the above, but it is two lines and it
/// restores the original value. Drop it if it ever causes visible startup flicker.
#[cfg(target_os = "linux")]
pub(crate) fn defuse(window: &impl gtk::glib::IsA<gtk::Window>) {
    use gtk::prelude::*;

    // Explicitly annotated: `IsA<Window>` carries `AsRef<Window>`, and naming the
    // target type keeps resolution unambiguous however the caller's type widens.
    let window: &gtk::Window = window.as_ref();
    let titlebar = window.titlebar();
    let event_box = titlebar
        .as_ref()
        .and_then(|widget| widget.clone().downcast::<gtk::EventBox>().ok());

    let fix = decide(
        titlebar.is_some(),
        event_box.is_some(),
        event_box
            .as_ref()
            .is_some_and(|event_box| event_box.is_above_child()),
    );

    let TitlebarFix::DropInputOverlay = fix else {
        return;
    };
    let Some(event_box) = event_box else {
        return;
    };

    event_box.set_above_child(false);

    let resizable = window.is_resizable();
    window.set_resizable(!resizable);
    window.set_resizable(resizable);
}

/// Apply the title-bar fix to the app's main window, if the platform needs it.
///
/// Must run **after** `WebviewWindow::show()`: the overlay is (re-)raised by
/// `gtk_event_box_map()`, so lowering it before the window maps would be undone.
/// Errors are logged and swallowed — a window that will not hand out its GTK
/// handle is not a reason to fail startup.
pub fn apply(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "linux")]
    {
        match window.gtk_window() {
            Ok(gtk_window) => defuse(&gtk_window),
            Err(error) => {
                log::warn!("gtk_window() failed; Wayland title-bar fix not applied: {error}");
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = window;
    }
}

#[cfg(test)]
mod tests {
    use super::{decide, TitlebarFix};

    // ---- Group A: pure decision logic (runs on every platform) ----

    #[test]
    fn event_box_titlebar_with_raised_overlay_is_defused() {
        assert_eq!(
            decide(true, true, true),
            TitlebarFix::DropInputOverlay,
            "tao <=0.35 shape: EventBox titlebar with above_child raised"
        );
    }

    #[test]
    fn event_box_titlebar_already_lowered_is_left_alone() {
        assert_eq!(decide(true, true, false), TitlebarFix::None);
    }

    #[test]
    fn non_event_box_titlebar_is_left_alone() {
        // GTK's own client-side decorations, or tao >=0.36 which installs no
        // EventBox wrapper at all.
        assert_eq!(decide(true, false, false), TitlebarFix::None);
        assert_eq!(decide(true, false, true), TitlebarFix::None);
    }

    #[test]
    fn no_titlebar_widget_is_left_alone() {
        // X11 / server-side decorations: GtkWindow::titlebar() is None.
        assert_eq!(decide(false, false, false), TitlebarFix::None);
        assert_eq!(decide(false, true, true), TitlebarFix::None);
    }

    // ---- Group B: real GTK widget shape (Linux only) ----

    #[cfg(target_os = "linux")]
    #[test]
    fn defuse_lowers_the_overlay_and_keeps_the_header_bar() {
        use gtk::prelude::*;

        if gtk::init().is_err() {
            eprintln!("skipping defuse_lowers_the_overlay_and_keeps_the_header_bar: no display");
            return;
        }

        // Reconstruct tao 0.35.3's exact widget shape (wayland/header.rs).
        let window = gtk::Window::new(gtk::WindowType::Toplevel);
        let header = gtk::HeaderBar::new();
        header.set_show_close_button(true);
        let event_box = gtk::EventBox::new();
        event_box.set_above_child(true);
        event_box.add(&header);
        window.set_titlebar(Some(&event_box));

        let resizable_before = window.is_resizable();

        super::defuse(&window);

        assert!(
            !event_box.is_above_child(),
            "the input-only overlay must be lowered so header-bar buttons receive clicks"
        );
        assert_eq!(
            event_box.child().map(|child| child.is::<gtk::HeaderBar>()),
            Some(true),
            "the header bar must survive — we defuse the overlay, not the decorations"
        );
        assert_eq!(
            window.is_resizable(),
            resizable_before,
            "the resizable toggle must restore the original value"
        );
    }

    // ---- Group C: upstream guard (runs on every platform) ----

    /// Read a package's version out of a `Cargo.lock`.
    ///
    /// Line-based on purpose: `core.autocrlf` is on for this repo and nothing in
    /// `.gitattributes` pins `Cargo.lock` to LF, so a fresh Windows clone has a
    /// CRLF lockfile. `str::lines` strips the `\r`; substring matching against
    /// `"\n"`-anchored patterns would not, and the guard would panic on a clean
    /// checkout instead of guarding anything.
    fn lockfile_package_version<'a>(lockfile: &'a str, package: &str) -> Option<&'a str> {
        let mut in_package = false;

        for line in lockfile.lines() {
            if line == "[[package]]" {
                in_package = false;
            } else if let Some(name) = line
                .strip_prefix("name = \"")
                .and_then(|name| name.strip_suffix('"'))
            {
                in_package = name == package;
            } else if in_package {
                if let Some(version) = line
                    .strip_prefix("version = \"")
                    .and_then(|version| version.strip_suffix('"'))
                {
                    return Some(version);
                }
            }
        }

        None
    }

    /// Whether this tao still predates the upstream fix released in tao 0.36.0.
    ///
    /// An unparseable version counts as *fixed*, so a lockfile format change
    /// fails the guard loudly rather than silently keeping it green forever.
    fn tao_predates_upstream_fix(version: &str) -> bool {
        let mut parts = version.split('.');
        let (Some(Ok(major)), Some(Ok(minor))) = (
            parts.next().map(str::parse::<u32>),
            parts.next().map(str::parse::<u32>),
        ) else {
            return false;
        };

        major == 0 && minor < 36
    }

    #[test]
    fn tao_version_still_needs_the_workaround() {
        // env! resolves at compile time, so the path is correct regardless of the
        // test runner's CWD; unlike include_str! it does not bake the lockfile
        // into the test binary.
        let lockfile =
            std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../Cargo.lock"))
                .expect("workspace Cargo.lock must be readable from the app crate");

        let version = lockfile_package_version(&lockfile, "tao")
            .expect("Cargo.lock must contain a tao package entry");

        assert!(
            tao_predates_upstream_fix(version),
            "tao {version} >= 0.36 is in the lockfile — tao#1218 fixes issue #238 upstream. \
             Complete TODO-0097: delete src-tauri/src/wayland_titlebar.rs, its mod + call site \
             in lib.rs, the linux gtk dependency, and this test."
        );
    }

    /// A tripwire that cannot trip is not a tripwire — prove it fires.
    #[test]
    fn the_guard_fires_once_tao_reaches_the_upstream_fix() {
        assert!(tao_predates_upstream_fix("0.35.3"), "today's lockfile");
        assert!(!tao_predates_upstream_fix("0.36.0"), "the fix release");
        assert!(!tao_predates_upstream_fix("0.41.2"), "any later 0.x");
        assert!(!tao_predates_upstream_fix("1.0.0"), "a 1.x tao");
        assert!(!tao_predates_upstream_fix("not-a-version"), "fails loud");
    }

    #[test]
    fn lockfile_parsing_finds_the_right_package_on_lf_and_crlf() {
        // Ordered so a naive "first version after any tao mention" parser would
        // return 9.9.9: `tauri-runtime-wry` names tao as a dependency first.
        let lockfile = "\
[[package]]
name = \"tauri-runtime-wry\"
version = \"9.9.9\"
dependencies = [
 \"tao\",
]

[[package]]
name = \"tao\"
version = \"0.36.0\"
source = \"registry+https://github.com/rust-lang/crates.io-index\"
";

        assert_eq!(lockfile_package_version(lockfile, "tao"), Some("0.36.0"));
        assert_eq!(
            lockfile_package_version(&lockfile.replace('\n', "\r\n"), "tao"),
            Some("0.36.0"),
            "a fresh Windows clone has a CRLF Cargo.lock (core.autocrlf, no .gitattributes rule)"
        );
        assert_eq!(lockfile_package_version(lockfile, "wry"), None);
    }
}
