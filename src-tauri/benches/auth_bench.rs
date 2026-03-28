use criterion::{criterion_group, criterion_main, Criterion};
use mini_diarium_lib::auth::password::PasswordMethod;

fn bench_wrap(c: &mut Criterion) {
    let master_key = [42u8; 32];
    let method = PasswordMethod::new("benchmark_password_123".to_string());
    let mut group = c.benchmark_group("auth_argon2");
    group.sample_size(10);
    group.bench_function("wrap_master_key", |b| {
        b.iter(|| method.wrap_master_key(&master_key).unwrap());
    });
    group.finish();
}

fn bench_unwrap(c: &mut Criterion) {
    let master_key = [42u8; 32];
    let method = PasswordMethod::new("benchmark_password_123".to_string());
    // Setup cost (one Argon2id hash) excluded from measurement:
    let wrapped = method.wrap_master_key(&master_key).unwrap();
    let mut group = c.benchmark_group("auth_argon2");
    group.sample_size(10);
    group.bench_function("unwrap_master_key", |b| {
        b.iter(|| method.unwrap_master_key(&wrapped).unwrap());
    });
    group.finish();
}

criterion_group!(benches, bench_wrap, bench_unwrap);
criterion_main!(benches);
