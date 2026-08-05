//! Snapshot-creation cost.
//!
//! Locking the journal became a snapshot trigger in TODO-0098, which makes `VACUUM INTO` a
//! hot path whose cost scales with journal size — and image-heavy journals reach hundreds of
//! megabytes. PHILOSOPHY principle 3 requires criterion coverage on hot paths; this is it.
//!
//! Three shapes are measured because they stress different things: a small text journal
//! (per-call overhead dominates), a large text journal (page count dominates), and an
//! image-heavy journal (BLOB pages dominate and the size-to-entry-count ratio inverts).

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use mini_diarium_lib::backup::{
    create_snapshot, BackupContext, FsSnapshotStore, SnapshotStore, SnapshotTrigger,
};
use mini_diarium_lib::db::{create_database, insert_entry, DatabaseConnection, DiaryEntry};

const BENCH_PASSWORD: &str = "bench-only-not-a-real-secret";

fn make_entry(index: usize, body: &str) -> DiaryEntry {
    let ts = "2024-01-01T00:00:00Z".to_string();
    DiaryEntry {
        id: 0,
        // Spread across dates so the journal looks like a real one rather than one huge day.
        date: format!("2024-{:02}-{:02}", (index % 12) + 1, (index % 28) + 1),
        title: format!("Bench entry {index}"),
        text: body.to_string(),
        word_count: body.split_whitespace().count() as i32,
        date_created: ts.clone(),
        date_updated: ts,
        metadata: None,
        locked: false,
    }
}

/// A journal of `entries` entries, each carrying `body_bytes` of text.
///
/// Returns the temp dir alongside the handle so the journal outlives the call — dropping the
/// `TempDir` would delete the database mid-benchmark.
fn seeded_journal(
    name: &str,
    entries: usize,
    body_bytes: usize,
) -> (tempfile::TempDir, std::path::PathBuf, DatabaseConnection) {
    let dir = tempfile::Builder::new()
        .prefix(&format!("mini-diarium-bench-{name}-"))
        .tempdir()
        .unwrap();
    let db_path = dir.path().join("diary.db");
    let db = create_database(&db_path, BENCH_PASSWORD.to_string()).unwrap();

    let body = format!(
        "<p>{}</p>",
        "lorem ipsum dolor sit amet ".repeat(body_bytes / 27)
    );
    for i in 0..entries {
        insert_entry(&db, &make_entry(i, &body)).unwrap();
    }

    (dir, db_path, db)
}

fn bench_snapshot_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("backup_snapshot");
    // `VACUUM INTO` is I/O bound and slow relative to the default sample size.
    group.sample_size(10);

    // (label, entry count, body size) — roughly: a new journal, a few years of daily
    // writing, and a journal whose bulk is embedded media.
    let shapes: [(&str, usize, usize); 3] = [
        ("small", 50, 500),
        ("large", 2_000, 2_000),
        ("image_heavy", 200, 200_000),
    ];

    for (label, entries, body_bytes) in shapes {
        let (dir, db_path, db) = seeded_journal(label, entries, body_bytes);
        let backups_dir = dir.path().join("backups");
        let size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);

        group.bench_with_input(
            BenchmarkId::new("create_snapshot", format!("{label}_{size}B")),
            &(),
            |b, _| {
                b.iter(|| {
                    let ctx = BackupContext {
                        db_path: &db_path,
                        backups_dir: &backups_dir,
                        app_version: Some("bench"),
                    };
                    // `Manual` bypasses the dedup and minimum-interval rules, so every
                    // iteration measures a real write rather than a skipped decision.
                    create_snapshot(&db, &ctx, SnapshotTrigger::Manual).unwrap();
                });
            },
        );

        // Retention keeps the directory bounded during the run, but clear it between shapes
        // so one shape's snapshots never inflate the next one's storage-budget maths.
        let store = FsSnapshotStore::new(&backups_dir);
        if let Ok(snapshots) = store.list() {
            for snapshot in snapshots {
                let _ = store.delete(&snapshot.file_name);
            }
        }
    }

    group.finish();
}

criterion_group!(benches, bench_snapshot_creation);
criterion_main!(benches);
