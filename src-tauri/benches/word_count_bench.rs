use criterion::{criterion_group, criterion_main, Criterion};
use mini_diarium_lib::db::queries::count_words;

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

/// ~500 words of varied prose (plain text, no HTML)
const PLAIN_TEXT: &str = concat!(
    "The morning light filtered through the blinds as I sat down at my desk. ",
    "There was something different about today — a quiet resolve that had been missing for weeks. ",
    "I opened my notebook and began to write, not because I had something profound to say, ",
    "but because the act of writing itself felt necessary. ",
    "Some days the words come easily, tumbling out faster than the hand can capture them. ",
    "Other days every sentence is a negotiation, a careful arrangement of thoughts ",
    "that seem to resist being pinned down. Today was somewhere in between. ",
    "I had been thinking about the project for several days, turning the problem over in my mind ",
    "the way you turn a stone in your hand, feeling its weight and texture. ",
    "The architecture was sound, I was fairly certain of that. ",
    "But there were details at the edges that still needed attention, ",
    "small decisions that would have large downstream consequences if made carelessly. ",
    "Experience teaches you to pay attention to those small decisions. ",
    "The ones that seem trivial in the moment are often the ones you revisit later, ",
    "wondering what you were thinking. ",
    "I made a list of the open questions and tried to rank them by urgency and impact. ",
    "This is a habit I picked up years ago and have never abandoned — ",
    "the simple act of writing things down changes how you think about them. ",
    "A problem that loomed large in your head often shrinks on paper. ",
    "Conversely, something you thought was minor sometimes reveals hidden complexity ",
    "once you try to articulate it clearly. ",
    "By mid-morning I had worked through most of the list. ",
    "Two items remained unresolved, both requiring input from people who were not yet available. ",
    "I flagged them and moved on, trusting that the answers would come in time. ",
    "The afternoon passed quickly. I reviewed some earlier work, ",
    "made a few small refinements, and drafted notes for the following day. ",
    "When I finally closed my laptop, the light outside had shifted to the amber tones of early evening. ",
    "It had been a good day — not dramatic, not particularly memorable in any external sense, ",
    "but the kind of day where quiet progress accumulates into something real. ",
    "Those are often the best days of all."
);

fn bench_word_count(c: &mut Criterion) {
    // ~500-word plain prose (varied sentence lengths, no HTML)
    let plain = PLAIN_TEXT;
    // ~600-word realistic TipTap HTML (3× the representative HTML block)
    let html = REALISTIC_HTML.repeat(3);

    c.bench_function("count_words_plain_500w", |b| {
        b.iter(|| count_words(plain));
    });
    c.bench_function("count_words_html_500w", |b| {
        b.iter(|| count_words(&html));
    });
}

criterion_group!(benches, bench_word_count);
criterion_main!(benches);
