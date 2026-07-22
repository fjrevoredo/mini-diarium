#!/usr/bin/env node
/**
 * Checks that the donation addresses are identical everywhere they are published, and that
 * each one still passes its own checksum.
 *
 * The same three crypto addresses live in three tracked files (`README.md`, `DONATE.md`, and
 * the website's donate page). Crypto sent to a wrong address is unrecoverable, so a typo or a
 * partial update is not a cosmetic bug — it silently destroys donations. Swapping a donation
 * address in one of several copies is also a known open-source supply-chain trick.
 *
 * This guard therefore does two independent things:
 *   1. Drift: every address below must appear byte-identical in every published file.
 *   2. Validity: the addresses are re-verified from their own checksums, so a future rotation
 *      cannot introduce a transcription error that check 1 would happily propagate.
 *
 * Rotating an address means editing ADDRESSES here *and* all three files; the guard fails
 * until they agree, which is the point.
 *
 * Run: node scripts/check-donation-addresses.js
 * Exit 0 = clean. Exit 1 = drift, an invalid address, or the check itself could not run.
 *
 * Scanning is pure Node rather than `rg`: ripgrep is not installed on every machine that runs
 * `bun run pre-commit`, and a guard that silently exits 0 when its scanner is missing is not a
 * guard. `git ls-files` is used to assert the published files are actually tracked.
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

/**
 * The single source of truth. `kind` selects the checksum verifier; `shape` (optional) is the
 * pattern used to find look-alike addresses elsewhere in the repository. A Lightning address
 * has no distinctive shape, so it has no scan pattern.
 */
const ADDRESSES = [
  {
    label: 'Monero (XMR)',
    kind: 'monero',
    shape: /\b4[1-9A-HJ-NP-Za-km-z]{94}\b/g,
    value: '4ApNmqczyAoWsprSrCMsPNKTGhxaH1Cs6agLVaGiKuBBVSotWK9uj3oVQkWYUX9XUGQJyC9WB7cMofE8wfp5BbUoEdcwbjv',
  },
  {
    label: 'Bitcoin (BTC)',
    kind: 'bech32',
    shape: /\bbc1[02-9ac-hj-np-z]{25,59}\b/g,
    value: 'bc1q0y6v888ala2f8r7tm8g30vqt9ma09w9ww4jhum',
  },
  {
    label: 'Bitcoin over Lightning',
    kind: 'lightning',
    value: 'mini-diarium@cake.cash',
  },
];

/** Every tracked file that publishes the addresses to users. */
const PUBLISHED_IN = ['README.md', 'DONATE.md', 'website/donate/index.html'];

/** The donate page renders each address twice; both copies are extracted and compared. */
const DONATE_PAGE = 'website/donate/index.html';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const failures = [];

/**
 * Tracked files for the look-alike scan. Tracked-only is exactly the intended corpus: it
 * includes dot-directories, excludes `node_modules/` and build output, and cannot be poisoned
 * by a stray local file.
 */
function scanCorpus() {
  try {
    return execFileSync('git', ['ls-files'], {
      encoding: 'utf8',
      cwd: repoRoot,
      maxBuffer: 32 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean);
  } catch (err) {
    // A guard that cannot run must fail, not pass quietly.
    console.error(`${COLORS.red}[donation-addresses] could not list tracked files: ${err.message}${COLORS.reset}`);
    process.exit(1);
  }
}

/** Lockfiles carry long opaque tokens that can collide with the base58 shape by chance. */
const isExemptFromScan = (file) =>
  file === 'bun.lock' ||
  file === 'package-lock.json' ||
  file === 'Cargo.lock' ||
  file.split('/').includes('archive');

// ---------------------------------------------------------------------------
// keccak-256 (the original Keccak padding, not SHA3-256) — Node has no built-in
// digest for it, and Monero's checksum is the first 4 bytes of this hash.
// ---------------------------------------------------------------------------

const MASK = (1n << 64n) - 1n;
const rot = (x, n) => {
  const b = BigInt(n) % 64n;
  return b === 0n ? x : ((x << b) | (x >> (64n - b))) & MASK;
};

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function keccakF(A) {
  for (let round = 0; round < 24; round++) {
    const C = [];
    const D = [];
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rot(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];

    const B = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rot(A[x + 5 * y], ROT[x][y]);

    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        A[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & MASK & B[((x + 2) % 5) + 5 * y]);

    A[0] ^= RC[round];
  }
  return A;
}

function keccak256(bytes) {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01; // original Keccak padding (SHA3 would use 0x06 here)
  padded[padded.length - 1] |= 0x80;

  const A = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF(A);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = A[i];
    for (let b = 0; b < 8; b++) {
      out[i * 8 + b] = Number(lane & 0xffn);
      lane >>= 8n;
    }
  }
  return out;
}

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Standard keccak-256 test vector for the empty input. */
const KECCAK_EMPTY = 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

// ---------------------------------------------------------------------------
// Monero: base58 (block-wise, not Bitcoin's) + keccak-256 checksum
// ---------------------------------------------------------------------------

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
/** Monero encodes 8-byte blocks as 11 chars; this maps a block's char count back to bytes. */
const BLOCK_BYTES = { 0: 0, 2: 1, 3: 2, 5: 3, 6: 4, 7: 5, 9: 6, 10: 7, 11: 8 };
/** Network byte 18 = mainnet standard address (19 = integrated, 42 = subaddress). */
const XMR_MAINNET_STANDARD = 18;

function moneroB58Decode(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 11) {
    const chunk = str.slice(i, i + 11);
    const nBytes = BLOCK_BYTES[chunk.length];
    if (nBytes === undefined) throw new Error(`invalid base58 block length ${chunk.length}`);

    let num = 0n;
    for (const ch of chunk) {
      const idx = B58.indexOf(ch);
      if (idx < 0) throw new Error(`invalid base58 character '${ch}'`);
      num = num * 58n + BigInt(idx);
    }
    if (num >= 1n << BigInt(8 * nBytes)) throw new Error('base58 block overflow');

    for (let b = nBytes - 1; b >= 0; b--) out.push(Number((num >> BigInt(8 * b)) & 0xffn));
  }
  return new Uint8Array(out);
}

function verifyMonero(address) {
  const raw = moneroB58Decode(address);
  const body = raw.slice(0, raw.length - 4);
  const want = hex(raw.slice(raw.length - 4));
  const got = hex(keccak256(body)).slice(0, 8);

  if (want !== got) throw new Error(`checksum mismatch (address says ${want}, keccak says ${got})`);
  if (raw[0] !== XMR_MAINNET_STANDARD) {
    throw new Error(`network byte ${raw[0]} is not a mainnet standard address`);
  }
}

// ---------------------------------------------------------------------------
// Bitcoin: BIP-173 bech32 / BIP-350 bech32m
// ---------------------------------------------------------------------------

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function verifyBech32(address) {
  const pos = address.lastIndexOf('1');
  if (pos < 1) throw new Error('missing bech32 separator');

  const hrp = address.slice(0, pos);
  if (hrp !== 'bc') throw new Error(`human-readable part '${hrp}' is not Bitcoin mainnet`);

  const data = [...address.slice(pos + 1)].map((c) => {
    const i = CHARSET.indexOf(c);
    if (i < 0) throw new Error(`invalid bech32 character '${c}'`);
    return i;
  });

  const expanded = [
    ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...hrp].map((c) => c.charCodeAt(0) & 31),
  ];

  const witver = data[0];
  // Witness v0 uses bech32 (constant 1); v1+ uses bech32m (constant 0x2bc830a3).
  const expected = witver === 0 ? 1 : 0x2bc830a3;
  const actual = polymod([...expanded, ...data]);

  if (actual !== expected) {
    throw new Error(`checksum mismatch (got 0x${actual.toString(16)}, want 0x${expected.toString(16)})`);
  }
}

// ---------------------------------------------------------------------------
// Lightning address: no checksum exists, so only the shape is verifiable.
// ---------------------------------------------------------------------------

function verifyLightning(address) {
  if (!/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) {
    throw new Error('not a well-formed Lightning address (user@domain)');
  }
}

const VERIFIERS = {
  monero: verifyMonero,
  bech32: verifyBech32,
  lightning: verifyLightning,
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

// 0. The verifier itself must be sound before its verdicts mean anything.
const selfTest = hex(keccak256(new Uint8Array(0)));
if (selfTest !== KECCAK_EMPTY) {
  console.error(`${COLORS.red}[donation-addresses] keccak-256 self-test failed: ${selfTest}${COLORS.reset}`);
  process.exit(1);
}

// 1. Each address must still pass its own checksum.
for (const { label, kind, value } of ADDRESSES) {
  try {
    VERIFIERS[kind](value);
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
  }
}

// 2. Each address must appear byte-identical in every published file.
for (const file of PUBLISHED_IN) {
  let content;
  try {
    content = readFileSync(join(repoRoot, file), 'utf8');
  } catch (err) {
    failures.push(`${file}: could not read (${err.message})`);
    continue;
  }

  for (const { label, value } of ADDRESSES) {
    if (!content.includes(value)) failures.push(`${file}: ${label} address missing or altered`);
  }
}

// 3. The donate page holds each address twice — in the visible <code> and in the copy
//    button's data-address. A typo in only one of them would pass check 2 while handing
//    users a wrong address, so both sets are compared against the source of truth.
const expected = new Set(ADDRESSES.map((a) => a.value));

try {
  const page = readFileSync(join(repoRoot, DONATE_PAGE), 'utf8');
  const extract = (regex) => [...page.matchAll(regex)].map((m) => m[1]);

  const sources = [
    ['copy button data-address', extract(/data-address="([^"]+)"/g)],
    ['rendered address', extract(/<code class="donate-address-value">([^<]+)<\/code>/g)],
  ];

  for (const [what, found] of sources) {
    if (found.length !== expected.size) {
      failures.push(`${DONATE_PAGE}: expected ${expected.size} ${what} values, found ${found.length}`);
    }
    for (const value of found) {
      if (!expected.has(value)) failures.push(`${DONATE_PAGE}: unknown ${what} "${value}"`);
    }
  }
} catch (err) {
  failures.push(`${DONATE_PAGE}: could not read (${err.message})`);
}

// 4. Nothing anywhere else in the repository may look like one of these addresses but differ.
//    Checks 2 and 3 only prove the right address is present where it is expected; they cannot
//    see a typo'd copy in a blog post, or a fourth publication site the guard does not know
//    about. Matching by *shape* catches both, which is the case that actually loses donations.
for (const file of scanCorpus()) {
  if (isExemptFromScan(file)) continue;

  let content;
  try {
    content = readFileSync(join(repoRoot, file), 'utf8');
  } catch {
    continue; // binary, deleted, or unreadable — nothing to match
  }

  for (const { label, shape, value } of ADDRESSES) {
    if (!shape) continue;
    for (const match of content.matchAll(shape)) {
      if (match[0] === value) continue;
      const line = content.slice(0, match.index).split('\n').length;
      failures.push(`${file}:${line}: looks like a ${label} address but is not the known one: ${match[0]}`);
    }
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`${COLORS.red}[donation-addresses] ${failure}${COLORS.reset}`);
  }
  console.error(`\n${COLORS.red}✗ ${failures.length} donation address problem(s) found.${COLORS.reset}`);
  console.error(
    `${COLORS.cyan}  Addresses must match scripts/check-donation-addresses.js in: ${PUBLISHED_IN.join(', ')}.${COLORS.reset}\n`,
  );
  process.exit(1);
} else {
  console.log(
    `${COLORS.green}✓ All ${ADDRESSES.length} donation addresses are valid and consistent across ${PUBLISHED_IN.length} files.${COLORS.reset}`,
  );
  process.exit(0);
}
