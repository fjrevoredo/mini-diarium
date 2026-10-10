#!/usr/bin/env node
// Path-only transformation of cargo-crap 0.6.1 report-v1 envelopes.
// The producer root is explicit: the consumer can run on a different OS.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPORT_SCHEMA =
  'https://raw.githubusercontent.com/minikin/cargo-crap/main/schemas/report-v1.json';
const slash = (value) => value.replaceAll('\\', '/');
const windowsAbsolute = (value) => /^[a-z]:\//i.test(value) || value.startsWith('//');
const absolute = (value) => windowsAbsolute(value) || value.startsWith('/');

export function normalizeReport(report, { root, forBaseline = false, warn = console.error }) {
  if (
    !report ||
    report.version !== '0.6.1' ||
    report.$schema !== REPORT_SCHEMA ||
    !Array.isArray(report.entries) ||
    Object.hasOwn(report, 'removed')
  ) {
    throw new Error('Expected a cargo-crap 0.6.1 report-v1 envelope, not a delta report');
  }
  if (typeof root !== 'string' || !absolute(slash(root))) {
    throw new Error('--root must be the absolute workspace root recorded by the producer');
  }
  const windows = windowsAbsolute(slash(root));
  const api = windows ? path.win32 : path.posix;
  const producerRoot = slash(api.normalize(root)).replace(/\/+$/, '') + '/';
  const comparisonRoot = windows ? producerRoot.toLowerCase() : producerRoot;
  const outside = [];
  const normalize = (raw) => {
    if (typeof raw !== 'string' || !raw || raw.includes('\0')) {
      throw new Error('Report path must be a non-empty string without NUL');
    }
    const value = slash(raw);
    if (!absolute(value)) {
      // Resolve solely to check containment. Preserve relative spelling/order.
      const resolved = slash(api.resolve(producerRoot, value));
      const check = windows ? resolved.toLowerCase() : resolved;
      if (!check.startsWith(comparisonRoot)) outside.push(raw);
      return value;
    }
    const sameStyle = windowsAbsolute(value) === windows;
    const normalized = slash((windowsAbsolute(value) ? path.win32 : path.posix).normalize(value));
    const check = windows ? normalized.toLowerCase() : normalized;
    if (sameStyle && check.startsWith(comparisonRoot)) {
      return normalized.slice(producerRoot.length);
    }
    outside.push(raw);
    return value;
  };

  const output = structuredClone(report);
  for (const entry of output.entries) entry.file = normalize(entry.file);
  if (output.diagnostics != null) {
    for (const group of ['source_only', 'lcov_only']) {
      const diagnostics = output.diagnostics[group];
      if (!diagnostics || !Array.isArray(diagnostics.examples)) {
        throw new Error(`Invalid diagnostics.${group}.examples`);
      }
      diagnostics.examples = diagnostics.examples.map(normalize);
    }
  }
  if (output.duplicates != null) {
    if (!Array.isArray(output.duplicates)) throw new Error('Invalid duplicates array');
    for (const duplicate of output.duplicates) {
      duplicate.first_file = normalize(duplicate.first_file);
      duplicate.second_file = normalize(duplicate.second_file);
    }
  }
  if (outside.length) {
    const message = `Paths outside producer root ${root}:\n${outside.join('\n')}`;
    if (forBaseline) throw new Error(message);
    warn(
      `Warning: ${message}\nOutside-root paths retained; do not commit this report as a baseline.`,
    );
  }
  // JSON.parse accepts overflow (1e400); JSON.stringify would silently turn it
  // into null. Refuse that lossy conversion rather than alter a metric.
  JSON.stringify(output, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('Non-finite JSON number: refusing lossy normalization');
    }
    return value;
  });
  return output;
}

export function selfTest() {
  // Entry shape captured from a real installed 0.6.1 report. No score calculation.
  const entry = {
    file: '/repo/src/a.rs',
    function: 'SnapshotCredential::fmt',
    line: 50,
    cyclomatic: 4,
    coverage: 85.71428571428571,
    crap: 4.0466472303206995,
    crate: 'mini-diarium-core',
    uncovered: [{ start: 53, end: 53 }],
  };
  const fixture = (files) => ({
    $schema: REPORT_SCHEMA,
    version: '0.6.1',
    entries: files.map((file, i) => ({ ...entry, file, line: 50 + i })),
    diagnostics: {
      analyzed_files: 3,
      lcov_files: 2,
      matched_files: 1,
      source_only: { count: 1, examples: [files[0]] },
      lcov_only: { count: 1, examples: [files[0]] },
    },
    try_weight: 1,
    threshold: 30,
  });
  const options = { root: '/repo', forBaseline: true };
  const input = fixture(['/repo/src/a.rs', '/repo/src/a.rs', 'src\\b.rs']);
  const original = structuredClone(input);
  const result = normalizeReport(input, options);
  assert.deepEqual(input, original, 'input is not mutated');
  assert.deepEqual(
    result.entries.map((e) => e.file),
    ['src/a.rs', 'src/a.rs', 'src/b.rs'],
  );
  for (let i = 0; i < input.entries.length; i++) {
    assert.deepEqual({ ...result.entries[i], file: input.entries[i].file }, input.entries[i]);
  }
  assert.deepEqual(
    result.entries.map((e) => e.line),
    [50, 51, 52],
    'duplicates retained in order',
  );
  assert.equal(result.diagnostics.source_only.examples[0], 'src/a.rs');
  assert.equal(result.diagnostics.lcov_only.examples[0], 'src/a.rs');
  assert.equal(result.threshold, 30);
  assert.equal(result.try_weight, 1);
  for (const root of ['C:\\Repo\\', 'c:/repo', 'C:/Repo']) {
    assert.equal(
      normalizeReport(fixture(['C:\\Repo\\src\\a.rs']), { root, forBaseline: true }).entries[0]
        .file,
      'src/a.rs',
    );
  }
  assert.equal(
    normalizeReport(fixture(['\\\\server\\share\\repo\\src\\a.rs']), {
      root: '\\\\server\\share\\repo',
      forBaseline: true,
    }).entries[0].file,
    'src/a.rs',
  );
  assert.equal(
    normalizeReport(fixture(['/src/a.rs']), { root: '/', forBaseline: true }).entries[0].file,
    'src/a.rs',
  );
  for (const offender of [
    '/repo-other/a.rs',
    '/Repo/a.rs',
    '/repo/../outside.rs',
    '../outside.rs',
    'src/../../outside.rs',
    'C:/Repo/a.rs',
  ]) {
    assert.throws(
      () => normalizeReport(fixture([offender]), options),
      /Paths outside producer root/,
    );
  }
  for (const offender of ['C:/Repo-other/a.rs', 'D:/Repo/a.rs', '/repo/a.rs']) {
    assert.throws(
      () =>
        normalizeReport(fixture([offender]), {
          root: 'C:/Repo',
          forBaseline: true,
        }),
      /Paths outside producer root/,
    );
  }
  const warnings = [];
  const outside = normalizeReport(fixture(['/outside/a.rs']), {
    root: '/repo',
    warn: (s) => warnings.push(s),
  });
  assert.equal(outside.entries[0].file, '/outside/a.rs');
  assert.match(warnings[0], /outside\/a.rs/);
  const diagnosticOutside = fixture(['/repo/a.rs']);
  diagnosticOutside.diagnostics.lcov_only.examples = ['/outside/lcov.rs'];
  assert.throws(() => normalizeReport(diagnosticOutside, options), /outside\/lcov.rs/);
  const duplicates = fixture(['/repo/a.rs']);
  duplicates.duplicates = [
    { first_file: '/repo/a.rs', second_file: '/repo/b.rs', score: 0.95000001 },
  ];
  assert.deepEqual(normalizeReport(duplicates, options).duplicates, [
    { first_file: 'a.rs', second_file: 'b.rs', score: 0.95000001 },
  ]);
  assert.throws(() => normalizeReport({ ...input, version: '0.7.0' }, options), /0.6.1/);
  assert.throws(() => normalizeReport({ ...input, removed: [] }, options), /delta report/);
  assert.throws(() => normalizeReport(input, { root: 'repo' }), /absolute workspace root/);
  const overflow = fixture(['/repo/a.rs']);
  overflow.entries[0].crap = Infinity;
  assert.throws(() => normalizeReport(overflow, options), /Non-finite/);
  console.log(
    'CRAP normalizer self-test passed (paths, diagnostics, duplicates, precision, input errors)',
  );
}

function main(args) {
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'Usage: node scripts/normalize-crap-baseline.mjs --input <report.json> --root <producer-root> [--output <file>] [--for-baseline]',
    );
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--for-baseline' && !options.forBaseline) options.forBaseline = true;
    else if (
      ['--input', '--root', '--output'].includes(flag) &&
      !Object.hasOwn(options, flag.slice(2)) &&
      args[i + 1] &&
      !args[i + 1].startsWith('--')
    ) {
      options[flag.slice(2)] = args[++i];
    } else throw new Error(`Unknown, repeated, or incomplete argument: ${flag}`);
  }
  if (!options.input || !options.root)
    throw new Error('--input and --root are required; use --help');
  const report = JSON.parse(readFileSync(options.input, 'utf8'));
  const text = JSON.stringify(normalizeReport(report, options), null, 2) + '\n';
  if (options.output) writeFileSync(options.output, text);
  else process.stdout.write(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`CRAP normalization failed: ${error.message}`);
    process.exitCode = 2;
  }
}
