//! Best-effort detection of a journal sitting inside a cloud-sync folder.
//!
//! A synced journal directory is a recurring source of support reports — two machines
//! writing `diary.db` through a sync client produce corruption and lost entries that look
//! like app bugs. The debug dump reports whether one was detected and which tool it looks
//! like, so that hypothesis is cheap to check.
//!
//! Lives in the app crate rather than the core crate: this is OS-shell heuristics, not
//! business logic, and keeping it here avoids widening the core API for a guess.
//!
//! # Privacy
//!
//! Returns a `&'static str` tool name, **never a path**. That is the whole contract —
//! callers cannot accidentally surface the journal location through this module.

use std::path::Path;

/// Marker entries a sync client leaves in the root of the folder it manages.
///
/// Checked first because a marker is evidence, not a guess.
const MARKERS: &[(&str, &str)] = &[
    (".dropbox", "Dropbox"),
    (".dropbox.cache", "Dropbox"),
    (".stfolder", "Syncthing"),
    // OneDrive stamps this fixed GUID file into the root of each synced library.
    (".849C9593-D756-4E56-8D6E-42412F2A707B", "OneDrive"),
    (".tmp.driveupload", "Google Drive"),
    (".nextcloudsync", "Nextcloud"),
];

/// Directory names that identify a sync root when no marker file is present.
///
/// Weaker evidence: a user can name any folder "Dropbox". Only consulted as a fallback,
/// and matched case-insensitively against a whole path component.
const WELL_KNOWN_DIRS: &[(&str, &str)] = &[
    ("dropbox", "Dropbox"),
    ("onedrive", "OneDrive"),
    ("google drive", "Google Drive"),
    ("googledrive", "Google Drive"),
    ("my drive", "Google Drive"),
    ("nextcloud", "Nextcloud"),
    ("owncloud", "ownCloud"),
    ("icloud drive", "iCloud Drive"),
    ("mobile documents", "iCloud Drive"),
    ("syncthing", "Syncthing"),
    ("pcloudrive", "pCloud"),
    ("mega", "MEGA"),
];

/// Returns the name of the sync tool whose folder `dir` appears to live in, if any.
///
/// Walks `dir` and its ancestors, preferring marker evidence at any level over a
/// well-known directory name at any level.
pub fn detect_sync_tool(dir: &Path) -> Option<&'static str> {
    let mut name_match: Option<&'static str> = None;

    for ancestor in dir.ancestors() {
        for (marker, tool) in MARKERS {
            if ancestor.join(marker).exists() {
                return Some(tool);
            }
        }

        if name_match.is_none() {
            if let Some(component) = ancestor.file_name().and_then(|name| name.to_str()) {
                let component = component.to_lowercase();
                name_match = WELL_KNOWN_DIRS
                    .iter()
                    .find(|(needle, _)| component == *needle)
                    .map(|(_, tool)| *tool);
            }
        }
    }

    name_match
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_marker_and_no_known_name_detects_nothing() {
        let tmp = tempfile::tempdir().unwrap();
        let journal = tmp.path().join("Journals").join("personal");
        std::fs::create_dir_all(&journal).unwrap();
        assert_eq!(detect_sync_tool(&journal), None);
    }

    #[test]
    fn marker_in_an_ancestor_is_detected() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("SomeFolder");
        let journal = root.join("nested").join("personal");
        std::fs::create_dir_all(&journal).unwrap();
        std::fs::create_dir_all(root.join(".dropbox.cache")).unwrap();

        assert_eq!(detect_sync_tool(&journal), Some("Dropbox"));
    }

    #[test]
    fn marker_in_the_journal_directory_itself_is_detected() {
        let tmp = tempfile::tempdir().unwrap();
        let journal = tmp.path().join("personal");
        std::fs::create_dir_all(&journal).unwrap();
        std::fs::write(journal.join(".849C9593-D756-4E56-8D6E-42412F2A707B"), "").unwrap();

        assert_eq!(detect_sync_tool(&journal), Some("OneDrive"));
    }

    #[test]
    fn well_known_directory_name_is_the_fallback() {
        let tmp = tempfile::tempdir().unwrap();
        let journal = tmp.path().join("OneDrive").join("Journals");
        std::fs::create_dir_all(&journal).unwrap();

        assert_eq!(detect_sync_tool(&journal), Some("OneDrive"));
    }

    #[test]
    fn marker_wins_over_a_misleading_directory_name() {
        let tmp = tempfile::tempdir().unwrap();
        let journal = tmp.path().join("Dropbox").join("personal");
        std::fs::create_dir_all(&journal).unwrap();
        std::fs::create_dir_all(journal.join(".stfolder")).unwrap();

        assert_eq!(detect_sync_tool(&journal), Some("Syncthing"));
    }

    #[test]
    fn directory_name_match_is_case_insensitive_and_whole_component() {
        let tmp = tempfile::tempdir().unwrap();
        let matching = tmp.path().join("nextCLOUD").join("j");
        let not_matching = tmp.path().join("my-dropbox-notes").join("j");
        std::fs::create_dir_all(&matching).unwrap();
        std::fs::create_dir_all(&not_matching).unwrap();

        assert_eq!(detect_sync_tool(&matching), Some("Nextcloud"));
        assert_eq!(detect_sync_tool(&not_matching), None);
    }
}
