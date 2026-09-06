/// Whether the app is running inside the Flatpak sandbox.
///
/// Flatpak sets `FLATPAK_ID` for every process it launches — same signal already used in
/// `spellcheck.rs` for dictionary-path resolution. The picker needs this because a native
/// save dialog under Flatpak's zero-`--filesystem=` sandbox can hand back a temporary
/// `/run/user/*/doc/` portal path instead of a real one (KI-10) — so "Create New Journal"
/// skips the dialog there and asks for a filename directly instead.
#[tauri::command]
pub fn is_flatpak_sandbox() -> bool {
    std::env::var_os("FLATPAK_ID").is_some()
}
