use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use mini_diarium_lib::crypto::cipher::{decrypt, encrypt, Key};

fn make_key() -> Key {
    Key::from_slice(&[42u8; 32]).unwrap()
}

fn bench_encrypt(c: &mut Criterion) {
    let key = make_key();
    let mut group = c.benchmark_group("cipher_encrypt");
    for size in [1_024usize, 10_240, 102_400] {
        let plaintext = vec![0xABu8; size];
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), &plaintext, |b, p| {
            b.iter(|| encrypt(&key, p).unwrap());
        });
    }
    group.finish();
}

fn bench_decrypt(c: &mut Criterion) {
    let key = make_key();
    let mut group = c.benchmark_group("cipher_decrypt");
    for size in [1_024usize, 10_240, 102_400] {
        let plaintext = vec![0xABu8; size];
        let ciphertext = encrypt(&key, &plaintext).unwrap();
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), &ciphertext, |b, ct| {
            b.iter(|| decrypt(&key, ct).unwrap());
        });
    }
    group.finish();
}

criterion_group!(benches, bench_encrypt, bench_decrypt);
criterion_main!(benches);
