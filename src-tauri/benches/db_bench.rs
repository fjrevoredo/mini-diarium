use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use mini_diarium_lib::db::{
    queries::{get_all_entries, get_entries_by_date, insert_entry, DiaryEntry},
    schema::create_database,
};

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

fn bench_insert(c: &mut Criterion) {
    c.bench_function("db_insert_entry", |b| {
        b.iter_batched(
            || {
                let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
                let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
                (tmp, db)
            },
            |(_tmp, db)| insert_entry(&db, &make_entry("2024-01-01")).unwrap(),
            BatchSize::SmallInput,
        );
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

fn bench_get_all(c: &mut Criterion) {
    let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
    let db = create_database(tmp.path().to_str().unwrap(), "bench".to_string()).unwrap();
    for i in 0..100 {
        let date = format!("2024-{:02}-{:02}", (i / 28) + 1, (i % 28) + 1);
        insert_entry(&db, &make_entry(&date)).unwrap();
    }

    c.bench_function("db_get_all_entries_100", |b| {
        b.iter(|| get_all_entries(&db).unwrap());
    });
}

criterion_group!(benches, bench_insert, bench_get_by_date, bench_get_all);
criterion_main!(benches);
