use criterion::{criterion_group, criterion_main, Criterion};
use mini_diarium_lib::db::queries::count_words;

fn bench_word_count(c: &mut Criterion) {
    let plain = "word ".repeat(500);
    let html = "<p><strong>word</strong> </p>".repeat(500);

    c.bench_function("count_words_plain_500w", |b| {
        b.iter(|| count_words(&plain));
    });
    c.bench_function("count_words_html_500w", |b| {
        b.iter(|| count_words(&html));
    });
}

criterion_group!(benches, bench_word_count);
criterion_main!(benches);
