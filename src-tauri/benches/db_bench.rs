use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use mini_diarium_lib::db::{
    queries::{
        count_words, get_all_entries, get_all_entry_dates, get_entries_by_date, insert_entry,
        update_entry, DiaryEntry,
    },
    schema::create_database,
};

/// Representative TipTap HTML (~200 words): mixed <h2>, <p>, <ul>, <li>, <strong>, <em>
const REALISTIC_HTML: &str = concat!(
    "<h2>Morning Reflection</h2>",
    "<p>Today was a <strong>productive</strong> session. I managed to focus deeply on the ",
    "implementation without too many interruptions. The new architecture is starting to ",
    "<em>click</em>, and I feel confident about the direction we are heading.</p>",
    "<h2>Key Accomplishments</h2>",
    "<ul>",
    "<li>Finished the <strong>authentication</strong> refactor — the new slot-based approach is much cleaner.</li>",
    "<li>Wrote comprehensive tests for the <em>edge cases</em> in the key derivation path.</li>",
    "<li>Reviewed open pull requests and left detailed feedback on three of them.</li>",
    "</ul>",
    "<p>There are still a few rough edges to address. The error messages from the crypto layer need ",
    "sanitizing before they reach the UI. I made a note to tackle that first thing tomorrow, ",
    "before the weekly sync.</p>",
    "<h2>Tomorrow</h2>",
    "<p>Start with the <strong>error sanitization</strong> task, then move to the calendar component ",
    "refactor. If time allows, revisit the export format specification to make sure it is ",
    "backward-compatible with older versions of the app.</p>"
);

fn make_entry(date: &str) -> DiaryEntry {
    let ts = "2024-01-01T00:00:00Z".to_string();
    DiaryEntry {
        id: 0,
        date: date.to_string(),
        title: "Bench entry".to_string(),
        text: "<p>This is a sample diary entry for benchmarking purposes.</p>".to_string(),
        word_count: 9,
        date_created: ts.clone(),
        date_updated: ts,
    }
}

fn make_date(i: usize) -> String {
    // Produces unique date-like strings for i in 0..500:
    // years 2020–2021, months 1–12, days 1–31
    let year = 2020 + i / 366;
    let remainder = i % 366;
    let month = (remainder / 31) + 1;
    let day = (remainder % 31) + 1;
    format!("{year}-{month:02}-{day:02}")
}

/// Creates a new entry — happens once when opening a blank date.
/// The real auto-save path is `bench_update` below.
fn bench_insert(c: &mut Criterion) {
    c.bench_function("db_insert_entry", |b| {
        b.iter_batched(
            || {
                let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
                let db =
                    create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
                (tmp, db)
            },
            |(_tmp, db)| insert_entry(&db, &make_entry("2024-01-01")).unwrap(),
            BatchSize::SmallInput,
        );
    });
}

/// Updates an existing entry — the real auto-save path, called every ~500ms while typing.
fn bench_update(c: &mut Criterion) {
    let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
    let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
    insert_entry(&db, &make_entry("2024-06-01")).unwrap();
    let saved = get_entries_by_date(&db, "2024-06-01")
        .unwrap()
        .into_iter()
        .next()
        .unwrap();
    let updated = DiaryEntry {
        text: REALISTIC_HTML.to_string(),
        word_count: count_words(REALISTIC_HTML),
        date_updated: "2024-06-01T12:00:00Z".to_string(),
        ..saved
    };
    c.bench_function("db_update_entry", |b| {
        b.iter(|| update_entry(&db, &updated).unwrap());
    });
}

fn bench_get_by_date(c: &mut Criterion) {
    let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
    let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
    insert_entry(&db, &make_entry("2024-06-01")).unwrap();

    c.bench_function("db_get_entries_by_date", |b| {
        b.iter(|| get_entries_by_date(&db, "2024-06-01").unwrap());
    });
}

/// Fetches all distinct entry dates — called on every date navigation and calendar render.
fn bench_get_all_entry_dates(c: &mut Criterion) {
    let mut group = c.benchmark_group("db_get_all_entry_dates");
    for count in [100usize, 500] {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
        for i in 0..count {
            insert_entry(&db, &make_entry(&make_date(i))).unwrap();
        }
        group.bench_with_input(BenchmarkId::from_parameter(count), &db, |b, db| {
            b.iter(|| get_all_entry_dates(db).unwrap());
        });
        drop(tmp); // explicit: tmp must outlive bench_with_input (it does; this is just for clarity)
    }
    group.finish();
}

fn bench_get_all(c: &mut Criterion) {
    let mut group = c.benchmark_group("db_get_all_entries");
    for count in [100usize, 500] {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
        for i in 0..count {
            insert_entry(&db, &make_entry(&make_date(i))).unwrap();
        }
        group.bench_with_input(BenchmarkId::from_parameter(count), &db, |b, db| {
            b.iter(|| get_all_entries(db).unwrap());
        });
        drop(tmp);
    }
    group.finish();
}

criterion_group!(
    benches,
    bench_insert,
    bench_update,
    bench_get_by_date,
    bench_get_all_entry_dates,
    bench_get_all
);
criterion_main!(benches);
