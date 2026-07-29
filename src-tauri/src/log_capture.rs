//! In-memory capture of recent backend log records for the debug dump.
//!
//! `env_logger` writes to stderr, which a packaged desktop app throws away — so the
//! migration, unlock, and backup records that answer most support questions were
//! previously unobtainable. [`CapturingLogger`] wraps the built `env_logger::Logger`,
//! forwards every record to it unchanged (stderr behaviour is identical), and keeps the
//! last [`CAPACITY`] records in a bounded ring buffer.
//!
//! # Privacy
//!
//! The dump must contain **zero filesystem paths**, so two rules hold this module
//! together and must not be relaxed independently:
//!
//! 1. **`Info` and above only.** `Debug`/`Trace` records are forwarded to stderr but never
//!    captured. Debug logging is where paths, entry titles, and other user data appear.
//! 2. **[`redact`] on read.** Every captured message is scrubbed of the home directory and
//!    of absolute-path-shaped runs before it leaves this module.
//!
//! Redaction is a net, not a guarantee: call sites that log user-chosen names or labels
//! are fixed at the source (see `commands/auth/`), because no regex can recognise them.
//!
//! # Deadlock caution
//!
//! Nothing inside the buffer's critical section may log — [`CapturingLogger::log`] would
//! re-enter its own mutex. Keep [`snapshot`] and the eviction path free of `log!` calls.

use log::{Level, Log, Metadata, Record};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

/// Maximum number of records retained; the oldest is evicted first.
const CAPACITY: usize = 200;

/// A single captured log record, as it appears in the debug dump.
#[derive(Debug, Clone, Serialize)]
pub struct CapturedRecord {
    pub ts: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// The ring buffer. A `static` rather than Tauri managed state because the logger is
/// installed before `app.manage(...)` exists.
static BUFFER: OnceLock<Mutex<VecDeque<CapturedRecord>>> = OnceLock::new();

fn buffer() -> &'static Mutex<VecDeque<CapturedRecord>> {
    BUFFER.get_or_init(|| Mutex::new(VecDeque::with_capacity(CAPACITY)))
}

/// `env_logger::Logger` with a capture tap on the way through.
pub struct CapturingLogger {
    inner: env_logger::Logger,
}

impl CapturingLogger {
    pub fn new(inner: env_logger::Logger) -> Self {
        Self { inner }
    }
}

impl Log for CapturingLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        self.inner.enabled(metadata)
    }

    fn log(&self, record: &Record) {
        // `matches` applies the same per-target filter env_logger itself would, so the
        // capture never holds a record the user's RUST_LOG chose to silence.
        if record.level() <= Level::Info && self.inner.matches(record) {
            push(CapturedRecord {
                ts: chrono::Utc::now().to_rfc3339(),
                level: record.level().to_string(),
                target: record.target().to_string(),
                message: record.args().to_string(),
            });
        }
        self.inner.log(record);
    }

    fn flush(&self) {
        self.inner.flush();
    }
}

fn push(record: CapturedRecord) {
    // No logging inside this lock — see the module-level deadlock caution.
    if let Ok(mut buffer) = buffer().lock() {
        if buffer.len() == CAPACITY {
            buffer.pop_front();
        }
        buffer.push_back(record);
    }
}

/// Installs `logger` as the global logger, capturing every `Info`-and-above record.
///
/// Called once at startup in place of `env_logger::Builder::init()`. A second call (or a
/// logger already set by something else) is ignored rather than fatal — diagnostics must
/// never be the reason the app fails to start.
pub fn install(logger: env_logger::Logger) {
    let level = logger.filter();
    if log::set_boxed_logger(Box::new(CapturingLogger::new(logger))).is_ok() {
        log::set_max_level(level);
    }
}

/// Returns the retained records, oldest first, with [`redact`] applied to each message.
pub fn snapshot() -> Vec<CapturedRecord> {
    let records: Vec<CapturedRecord> = match buffer().lock() {
        Ok(buffer) => buffer.iter().cloned().collect(),
        Err(_) => Vec::new(),
    };
    records
        .into_iter()
        .map(|mut record| {
            record.message = redact(&record.message);
            record
        })
        .collect()
}

/// Clears the buffer. Test-only; production has no reason to drop diagnostics.
#[cfg(test)]
pub fn clear() {
    if let Ok(mut buffer) = buffer().lock() {
        buffer.clear();
    }
}

fn home_dir() -> Option<String> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .and_then(|value| value.into_string().ok())
        // A degenerate home (`/`, `C:`) would turn redaction into a search-and-replace
        // over every message; ignore it and let the path scrubber do the work instead.
        .filter(|value| value.len() > 3)
}

/// Collapses every path-shaped run in `message` to the single placeholder `<path>`.
///
/// A run starts at the user's home directory, at a Windows drive prefix (`C:\…` / `C:/…`),
/// or at one of the Unix home roots (`/home/…`, `/Users/…`), and continues to the first
/// character that frames rather than forms a path.
///
/// Deliberately narrow — the goal is to catch the paths this app logs, not to guess at
/// every string containing a slash. Idempotent: `<path>` is not itself path-shaped.
///
/// The whole run goes, not just the prefix: an earlier version replaced the home
/// directory alone, which left `<home>\Downloads\Junk\dump.json` in a real dump. Folder
/// names under the home directory are still user data, and the documented promise is that
/// the dump contains no path at all.
pub fn redact(message: &str) -> String {
    let home = home_dir();
    // Both separators, since a logged path may have been normalised either way.
    let home_alt = home.as_ref().map(|home| home.replace('\\', "/"));
    let starts: Vec<&str> = home
        .iter()
        .chain(home_alt.iter())
        .map(String::as_str)
        .collect();

    scrub_absolute_paths(message, &starts)
}

fn scrub_absolute_paths(message: &str, extra_starts: &[&str]) -> String {
    let bytes = message.as_bytes();
    let mut out = String::with_capacity(message.len());
    let mut index = 0;

    while index < bytes.len() {
        if let Some(start_len) = path_start_len(message, index, extra_starts) {
            let end = consume_path_run(message, index + start_len);
            out.push_str("<path>");
            index = end;
        } else {
            // Advance one full char so multi-byte UTF-8 is never split.
            let char_len = message[index..].chars().next().map_or(1, char::len_utf8);
            out.push_str(&message[index..index + char_len]);
            index += char_len;
        }
    }

    out
}

/// True for the characters that frame a path in a log message rather than form one.
fn is_run_terminator(byte: u8) -> bool {
    byte.is_ascii_whitespace() || matches!(byte, b'"' | b'\'' | b'`' | b',' | b')')
}

/// Returns the end of the path-shaped run whose prefix ends at `from`.
///
/// Quotes and the punctuation that frames a path always end the run. Whitespace usually
/// does — but **not** when the next token still contains a path separator, because Windows
/// profile and folder names routinely contain spaces (`C:\Users\John Smith\My Docs\x.db`).
/// Stopping at the first space there would publish the surname and every folder below it.
/// A following word with no separator (`… migrated C:\a\b.db to v13`) ends the run as
/// normal, so ordinary prose after a path survives.
fn consume_path_run(message: &str, from: usize) -> usize {
    let bytes = message.as_bytes();
    let mut end = from;

    loop {
        while end < bytes.len() && !is_run_terminator(bytes[end]) {
            end += 1;
        }
        // Only whitespace is worth looking past; a quote or comma is always the end.
        if end >= bytes.len() || !bytes[end].is_ascii_whitespace() {
            return end;
        }

        let Some(gap) = bytes[end..].iter().position(|b| !b.is_ascii_whitespace()) else {
            return end; // Trailing whitespace — nothing follows.
        };
        let token_start = end + gap;
        let token_end = token_start
            + bytes[token_start..]
                .iter()
                .position(|b| is_run_terminator(*b))
                .unwrap_or(bytes.len() - token_start);

        if !bytes[token_start..token_end]
            .iter()
            .any(|b| matches!(b, b'\\' | b'/'))
        {
            return end;
        }
        end = token_end;
    }
}

/// Length of the path prefix starting at `index`, if one starts there.
fn path_start_len(message: &str, index: usize, extra_starts: &[&str]) -> Option<usize> {
    let bytes = message.as_bytes();

    // Longest match wins. An exact home-directory match must beat the generic 3-byte drive
    // rule: for a home containing a space (`C:\Users\John Smith`) logged on its own, the
    // short match would end the run at the space and leave the surname in the dump.
    let mut best = extra_starts
        .iter()
        .copied()
        .chain(["/home/", "/Users/"])
        .filter(|prefix| message[index..].starts_with(prefix))
        .map(str::len)
        .max();

    // Windows drive letter: `C:\` or `C:/`, and only at a token boundary so that a
    // substring of a longer word is not mistaken for a drive.
    if index + 2 < bytes.len()
        && bytes[index].is_ascii_alphabetic()
        && bytes[index + 1] == b':'
        && matches!(bytes[index + 2], b'\\' | b'/')
        && (index == 0 || !bytes[index - 1].is_ascii_alphanumeric())
    {
        best = Some(best.map_or(3, |len| len.max(3)));
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The ring buffer is global, so the tests that mutate it must not run concurrently.
    static BUFFER_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn lock_buffer() -> std::sync::MutexGuard<'static, ()> {
        let guard = BUFFER_TEST_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        clear();
        guard
    }

    #[test]
    fn redact_removes_the_whole_path_under_the_home_directory() {
        // Regression: an earlier version replaced only the home prefix, leaving
        // `<home>/journals/diary.db` — folder names under home are still user data.
        let home = home_dir().expect("test host defines HOME or USERPROFILE");
        let message = format!("Backup created: {}/journals/diary.db", home);
        assert_eq!(redact(&message), "Backup created: <path>");
    }

    #[test]
    fn redact_removes_the_home_directory_with_either_separator() {
        let home = home_dir().expect("test host defines HOME or USERPROFILE");
        let message = format!("opened {}", home.replace('\\', "/"));
        assert_eq!(redact(&message), "opened <path>");
    }

    #[test]
    fn redact_scrubs_windows_absolute_path() {
        let redacted = redact(r"Debug dump written to: C:\Data\Journals\dump.json");
        assert_eq!(redacted, "Debug dump written to: <path>");
    }

    // The synthetic user names below must not collide with the test host's real home,
    // or the home-prefix branch would fire first and produce `<home>` instead.
    #[test]
    fn redact_scrubs_unix_absolute_paths() {
        assert_eq!(redact("opened /home/md_test_u/diary.db"), "opened <path>");
        assert_eq!(redact("opened /Users/md_test_u/diary.db"), "opened <path>");
    }

    #[test]
    fn redact_stops_at_quotes_and_keeps_trailing_text() {
        let redacted = redact(r#"Failed to create app directory '/home/md_test_u/x': denied"#);
        assert_eq!(redacted, "Failed to create app directory '<path>': denied");
    }

    #[test]
    fn redact_is_idempotent() {
        let once = redact(r"migrated C:\Users\md_test_u\diary.db to v13");
        assert_eq!(redact(&once), once);
    }

    // The spaced-path cases below drive `scrub_absolute_paths` directly with a synthetic
    // home, because the test host's real home cannot be changed safely from a parallel
    // test — and a host whose home happens to have no space would pass these vacuously.
    const SPACED_HOME: &[&str] = &[r"C:\Users\John Smith"];

    #[test]
    fn a_home_directory_containing_a_space_is_consumed_whole() {
        // Regression: the 3-byte drive-letter rule used to win over the longer home match,
        // ending the run at the space and leaving the surname in the dump.
        assert_eq!(
            scrub_absolute_paths(r"app dir is C:\Users\John Smith", SPACED_HOME),
            "app dir is <path>"
        );
    }

    #[test]
    fn spaces_inside_a_path_do_not_end_the_run() {
        assert_eq!(
            scrub_absolute_paths(r"opened C:\Users\John Smith\My Docs\diary.db", SPACED_HOME),
            "opened <path>"
        );
        // …and the same holds with no home configured at all, via the drive rule alone.
        assert_eq!(
            scrub_absolute_paths(r"opened C:\Data\My Docs\diary.db", &[]),
            "opened <path>"
        );
    }

    #[test]
    fn prose_after_a_path_is_not_swallowed() {
        // The next token has no separator, so it is words, not more path.
        assert_eq!(
            scrub_absolute_paths(r"migrated C:\a\b.db to v13", &[]),
            "migrated <path> to v13"
        );
    }

    #[test]
    fn a_second_path_later_in_the_message_is_also_redacted() {
        assert_eq!(
            scrub_absolute_paths(r"copied C:\a\b.db and C:\c\d.db", &[]),
            "copied <path> and <path>"
        );
    }

    #[test]
    fn redact_leaves_ordinary_messages_alone() {
        let message = "Migration v12 -> v13 applied (locked column added)";
        assert_eq!(redact(message), message);
    }

    #[test]
    fn redact_does_not_mangle_non_ascii() {
        let message = "Journal unlocked — café ☕";
        assert_eq!(redact(message), message);
    }

    #[test]
    fn redact_ignores_a_colon_inside_a_word() {
        // `note:/foo` is not a drive letter — the byte before `n` matters only when the
        // candidate is preceded by alphanumerics, which `a:/` here is not.
        assert_eq!(redact("see note:x for detail"), "see note:x for detail");
    }

    #[test]
    fn buffer_evicts_oldest_beyond_capacity() {
        let _guard = lock_buffer();
        for i in 0..(CAPACITY + 5) {
            push(CapturedRecord {
                ts: "2026-07-29T00:00:00Z".to_string(),
                level: "INFO".to_string(),
                target: "test".to_string(),
                message: format!("record {}", i),
            });
        }

        let records = snapshot();
        assert_eq!(records.len(), CAPACITY);
        // Oldest first, and the first five are gone.
        assert_eq!(records[0].message, format!("record {}", 5));
        assert_eq!(
            records[CAPACITY - 1].message,
            format!("record {}", CAPACITY + 4)
        );
    }

    #[test]
    fn snapshot_redacts_captured_messages() {
        let _guard = lock_buffer();
        push(CapturedRecord {
            ts: "2026-07-29T00:00:00Z".to_string(),
            level: "INFO".to_string(),
            target: "test".to_string(),
            message: "wrote /home/md_test_u/diary.db".to_string(),
        });

        let records = snapshot();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].message, "wrote <path>");
    }

    #[test]
    fn capturing_logger_excludes_debug_and_trace() {
        let _guard = lock_buffer();
        let inner = env_logger::Builder::new()
            .filter_level(log::LevelFilter::Trace)
            .build();
        let logger = CapturingLogger::new(inner);

        for level in [
            Level::Error,
            Level::Warn,
            Level::Info,
            Level::Debug,
            Level::Trace,
        ] {
            logger.log(
                &Record::builder()
                    .args(format_args!("{} record", level))
                    .level(level)
                    .target("capture_test")
                    .build(),
            );
        }

        let captured: Vec<String> = snapshot().into_iter().map(|r| r.level).collect();
        assert_eq!(captured, vec!["ERROR", "WARN", "INFO"]);
    }
}
