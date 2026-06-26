#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const DEFAULT_FILES = ['coverage/lcov.info', 'src-tauri/lcov.info'];
const DEFAULT_BASE = 'origin/master';
const DEFAULT_FAIL_UNDER = 80;
const IS_WIN = process.platform === 'win32';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

function paint(color, msg) {
  return process.stdout.isTTY ? `${C[color]}${msg}${C.reset}` : msg;
}

function git(args, opts = {}) {
  const res = spawnSync('git', args, { encoding: 'utf8', ...opts });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    throw new Error(err || `git ${args.join(' ')} failed (exit ${res.status})`);
  }
  return (res.stdout || '').trim();
}

export function normalizePath(raw, repoRootNorm) {
  let p = raw.replace(/\\/g, '/');
  p = p.replace(/^\.\/+/, '');
  const isAbs = IS_WIN ? /^[a-z]:\//i.test(p) : p.startsWith('/');
  if (isAbs && repoRootNorm) {
    const root = repoRootNorm.replace(/\/+$/, '');
    const rootSlash = root + '/';
    const matchesRoot = IS_WIN
      ? p.toLowerCase().startsWith(rootSlash.toLowerCase())
      : p.startsWith(rootSlash);
    if (matchesRoot) p = p.slice(rootSlash.length);
  }
  return p.replace(/^\/+$/, '');
}

export function parseLcov(content, repoRootNorm) {
  const byFile = new Map();
  let curPath = null;
  let cur = null;
  const flush = () => {
    if (curPath && cur && cur.size > 0) {
      const key = normalizePath(curPath, repoRootNorm);
      const existing = byFile.get(key);
      if (existing) {
        for (const [ln, hits] of cur) existing.set(ln, Math.max(existing.get(ln) ?? 0, hits));
      } else {
        byFile.set(key, new Map(cur));
      }
    }
    curPath = null;
    cur = null;
  };
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      curPath = line.slice(3);
      cur = new Map();
    } else if (line.startsWith('DA:')) {
      if (!cur) continue;
      const comma = line.indexOf(',');
      const ln = parseInt(line.slice(3, comma), 10);
      const hits = parseInt(line.slice(comma + 1), 10);
      if (Number.isFinite(ln)) cur.set(ln, (cur.get(ln) ?? 0) + hits);
    } else if (line === 'end_of_record') {
      flush();
    }
  }
  flush();
  return byFile;
}

const HUNK_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function stripNewPath(raw) {
  const p = raw.slice(4);
  if (p === '/dev/null') return null;
  return p.replace(/^[ab]\//, '');
}

export function parseUnifiedDiff(diffText, repoRootNorm) {
  const addedByFile = new Map();
  let inHunk = false;
  let newPath = null;
  let newLine = 0;
  const ensure = (p) => {
    if (!addedByFile.has(p)) addedByFile.set(p, new Set());
    return addedByFile.get(p);
  };
  for (const raw of diffText.split(/\r?\n/)) {
    if (raw.startsWith('diff --git ') || raw.startsWith('diff --cc ')) {
      inHunk = false;
      newPath = null;
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(HUNK_RE);
      if (m) {
        inHunk = true;
        newLine = parseInt(m[1], 10);
        continue;
      }
    }
    if (!inHunk) {
      if (raw.startsWith('+++ ')) {
        const stripped = stripNewPath(raw);
        newPath = stripped ? normalizePath(stripped, repoRootNorm) : null;
        if (newPath) ensure(newPath);
      }
      continue;
    }
    if (raw === '') continue;
    if (raw.startsWith('+')) {
      if (newPath) addedByFile.get(newPath).add(newLine);
      newLine++;
      continue;
    }
    if (raw.startsWith('-') || raw.startsWith('\\')) continue;
    newLine++;
  }
  return addedByFile;
}

export function classifyGroup(p) {
  if (p.startsWith('src-tauri/src/')) return 'backend';
  if (p.startsWith('src/')) return 'frontend';
  return 'other';
}

function findBySuffix(byFile, rel) {
  let match = null;
  for (const [key, val] of byFile) {
    if (key !== rel && (key.endsWith('/' + rel) || rel.endsWith('/' + key))) {
      if (match) return null;
      match = val;
    }
  }
  return match;
}

export function computePatch(byFile, addedByFile) {
  const perFile = [];
  let totalCovered = 0;
  let totalInst = 0;
  const uncovered = [];
  for (const [rel, lines] of addedByFile) {
    let da = byFile.get(rel);
    if (!da) da = findBySuffix(byFile, rel);
    if (!da || da.size === 0) continue;
    let covered = 0;
    let inst = 0;
    const missing = [];
    for (const ln of [...lines].sort((a, b) => a - b)) {
      if (!da.has(ln)) continue;
      inst++;
      if (da.get(ln) > 0) covered++;
      else missing.push(ln);
    }
    if (inst === 0) continue;
    perFile.push({ path: rel, covered, inst, missing });
    totalCovered += covered;
    totalInst += inst;
    for (const ln of missing) uncovered.push(`${rel}:${ln}`);
  }
  perFile.sort((a, b) => a.path.localeCompare(b.path));
  uncovered.sort();
  return {
    perFile,
    totalCovered,
    totalInst,
    uncovered,
    pct: totalInst === 0 ? null : (totalCovered / totalInst) * 100,
  };
}

function pct(n, d) {
  if (d === 0) return null;
  return (n / d) * 100;
}

function resolveBase(base) {
  try {
    return git(['merge-base', base, 'HEAD']);
  } catch {
    try {
      git(['rev-parse', '--verify', `${base}^{commit}`]);
      return git(['rev-parse', base]);
    } catch {
      throw new Error(
        `Could not resolve base ref '${base}'. Run \`git fetch origin master\` or pass --base <ref>.`,
      );
    }
  }
}

function generateCoverage() {
  const errors = [];
  console.log(paint('cyan', 'Generating coverage (this runs the full test suites)...'));
  const fe = spawnSync('bun', ['run', 'test:coverage'], { stdio: 'inherit' });
  if (fe.status !== 0) errors.push('frontend coverage generation failed (tests failed or lcov not written)');
  const covCheck = spawnSync('cargo', ['llvm-cov', '--version'], { encoding: 'utf8' });
  if (covCheck.status !== 0) {
    console.log(
      paint('yellow', '  ⚠ cargo-llvm-cov not installed — skipping backend coverage.'),
    );
    console.log(paint('dim', '    Install with: cargo install cargo-llvm-cov --locked'));
  } else {
    const res = spawnSync(
      'cargo',
      ['llvm-cov', 'nextest', '--lcov', '--output-path', 'lcov.info'],
      { cwd: path.join(process.cwd(), 'src-tauri'), stdio: 'inherit' },
    );
    if (res.status !== 0) errors.push('Backend coverage failed: `cargo llvm-cov nextest`');
  }
  return errors;
}

function render(result, mb, base, failUnder, workingTree = false) {
  const { perFile, totalCovered, totalInst, pct: totalPct, uncovered } = result;
  const bar = paint('dim', '─'.repeat(64));
  console.log();
  console.log(bar);
  console.log(
    paint('bold', ` Diff coverage vs ${base}${workingTree ? ' (working tree)' : ''}`) +
      paint('dim', `  (merge-base ${mb.slice(0, 10)})`),
  );
  const verdict =
    totalPct === null
      ? 'no instrumented changes'
      : `${totalCovered}/${totalInst} (${totalPct.toFixed(1)}%)`;
  const vColor = totalPct === null ? 'dim' : totalPct >= failUnder ? 'green' : 'red';
  console.log(` Threshold: ${failUnder}%   Combined: ${paint(vColor, verdict)}`);
  console.log(bar);

  const groups = { frontend: [], backend: [], other: [] };
  for (const f of perFile) groups[classifyGroup(f.path)].push(f);

  for (const [name, files] of Object.entries(groups)) {
    if (files.length === 0) continue;
    let gCov = 0;
    let gInst = 0;
    console.log();
    console.log(paint('bold', ` ${name}`));
    for (const f of files) {
      gCov += f.covered;
      gInst += f.inst;
      const p = pct(f.covered, f.inst);
      const miss = f.missing.length ? paint('red', `  missing: ${f.missing.join(', ')}`) : '';
      const color = p >= failUnder ? 'green' : 'red';
      console.log(
        `   ${paint('dim', f.path.padEnd(48))} ${String(f.covered).padStart(3)}/${String(f.inst).padEnd(3)} ${paint(color, `${p.toFixed(0)}%`)}${miss}`,
      );
    }
    const gp = pct(gCov, gInst);
    console.log(
      `   ${paint('bold', 'subtotal'.padEnd(48))} ${String(gCov).padStart(3)}/${String(gInst).padEnd(3)} ${paint('bold', `${gp.toFixed(1)}%`)}`,
    );
  }

  console.log();
  if (totalPct === null) {
    console.log(paint('dim', ' No instrumented changes against the base — nothing to gate.'));
    return;
  }
  if (totalPct >= failUnder) {
    console.log(paint('green', ` ✓ Diff coverage ${totalPct.toFixed(1)}% meets threshold ${failUnder}%`));
    return;
  }
  console.log(paint('red', ` ✗ Diff coverage ${totalPct.toFixed(1)}% below threshold ${failUnder}%`));
  console.log(paint('red', ' Uncovered new lines:'));
  for (const loc of uncovered) console.log(paint('red', `   ${loc}`));
}

function parseArgs(argv) {
  const out = { files: DEFAULT_FILES.slice(), base: DEFAULT_BASE, failUnder: DEFAULT_FAIL_UNDER, noFail: false, generate: false, workingTree: false, selfTest: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--no-fail') out.noFail = true;
    else if (a === '--generate') out.generate = true;
    else if (a === '--working-tree' || a === '-w') out.workingTree = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--frontend') out.files = ['coverage/lcov.info'];
    else if (a === '--backend') out.files = ['src-tauri/lcov.info'];
    else if (a === '--base') out.base = argv[++i];
    else if (a === '--fail-under') out.failUnder = Number(argv[++i]);
    else if (a === '--files') out.files = argv[++i].split(',').map((s) => s.trim());
  }
  return out;
}

function help() {
  console.log(
    `
check-diff-coverage — local mirror of Codecov's patch check.

Consumes lcov.info files (same ones CI uploads to Codecov) and computes
coverage over the new/modified lines in your diff vs the base branch.

Usage:
  node scripts/check-diff-coverage.mjs [options]

Options:
  --base <ref>        Base ref to diff against (default: origin/master)
  --fail-under <n>    Fail when combined patch coverage is below n% (default: 80)
  --no-fail           Report only; always exit 0
  --generate          Run the coverage commands first, then gate
  --working-tree, -w  Diff the working tree (staged + unstaged) vs base, not HEAD.
                      Use in pre-commit to check not-yet-committed changes.
  --frontend          Only check coverage/lcov.info
  --backend           Only check src-tauri/lcov.info
  --files a,b         Comma-separated list of lcov files to check
  --self-test         Run built-in parser self-tests and exit
  -h, --help          Show this help

Typical usage:
  bun run test:coverage              # (and cargo llvm-cov nextest for backend)
  bun run coverage:diff              # gate against origin/master
  bun run coverage:check             # generate + gate in one go
`.trim(),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return 0;
  }
  if (args.selfTest) {
    return runSelfTest() ? 0 : 1;
  }

  let repoRootNorm;
  try {
    const root = git(['rev-parse', '--show-toplevel']);
    repoRootNorm = normalizePath(root, null);
    process.chdir(root);
  } catch (e) {
    console.error(paint('red', `✗ ${e.message}`));
    return 1;
  }

  if (args.generate) {
    const errs = generateCoverage();
    if (errs.length) console.log(paint('yellow', `⚠ Coverage generation issues: ${errs.join('; ')}`));
  }

  let mb;
  try {
    mb = resolveBase(args.base);
  } catch (e) {
    console.error(paint('red', `✗ ${e.message}`));
    return 1;
  }

  const present = args.files.filter((f) => existsSync(f));
  const missing = args.files.filter((f) => !existsSync(f));
  if (missing.length) {
    console.log(paint('yellow', `⚠ Missing lcov files (skipped): ${missing.join(', ')}`));
    console.log(
      paint(
        'dim',
        '  Generate them with: bun run test:coverage  (frontend) and\n' +
          '  cargo llvm-cov nextest --lcov --output-path lcov.info  (backend, from src-tauri/)\n' +
          '  or pass --generate to run them automatically.',
      ),
    );
  }
  if (present.length === 0) {
    console.error(paint('red', '✗ No lcov files found. Generate coverage first or pass --generate.'));
    return 1;
  }

  const byFile = new Map();
  for (const f of present) {
    const content = readFileSync(f, 'utf8');
    const parsed = parseLcov(content, repoRootNorm);
    for (const [k, v] of parsed) {
      const ex = byFile.get(k);
      if (ex) for (const [ln, h] of v) ex.set(ln, Math.max(ex.get(ln) ?? 0, h));
      else byFile.set(k, v);
    }
  }

  const diffArgs = ['diff', mb];
  if (!args.workingTree) diffArgs.push('HEAD');
  diffArgs.push('-U0', '--no-color', '--no-prefix', '--no-ext-diff');
  const diffText = git(diffArgs);
  const added = parseUnifiedDiff(diffText, repoRootNorm);
  const result = computePatch(byFile, added);

  render(result, mb, args.base, args.failUnder, args.workingTree);

  if (result.pct === null) return 0;
  if (args.noFail) return 0;
  return result.pct >= args.failUnder ? 0 : 1;
}

function runSelfTest() {
  const rootNorm = IS_WIN ? 'd:/repos/mini-diarium' : '/d/repos/mini-diarium';
  const lcov = [
    'SF:src/widgets.ts',
    'DA:10,1',
    'DA:11,0',
    'DA:12,3',
    'end_of_record',
    'SF:src/empty.ts',
    'end_of_record',
  ].join('\n');
  const byFile = parseLcov(lcov, rootNorm);
  let ok = true;
  const eq = (label, got, want) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (!pass) ok = false;
    console.log(`${pass ? paint('green', '✓') : paint('red', '✗')} ${label}${pass ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
  };

  eq('parseLcov skips empty SF blocks', byFile.size, 1);
  eq('parseLcov line 10 hits', byFile.get('src/widgets.ts').get(10), 1);
  eq('parseLcov line 11 uncovered', byFile.get('src/widgets.ts').get(11), 0);

  const diff = [
    'diff --git a/src/widgets.ts b/src/widgets.ts',
    '--- src/widgets.ts',
    '+++ src/widgets.ts',
    '@@ -8,2 +10,2 @@',
    '+newA',
    '+newB',
    '@@ -20,1 +22,1 @@',
    '+otheradd',
  ].join('\n');
  const added = parseUnifiedDiff(diff, rootNorm);
  eq('parseUnifiedDiff file count', added.size, 1);
  eq('parseUnifiedDiff added lines', [...added.get('src/widgets.ts')].sort((a, b) => a - b), [10, 11, 22]);

  const result = computePatch(byFile, added);
  eq('computePatch ignores non-instrumented added lines', result.totalInst, 2);
  eq('computePatch covered', result.totalCovered, 1);
  eq('computePatch missing', result.uncovered, ['src/widgets.ts:11']);
  eq('computePatch pct 50', result.pct, 50);

  const readmeDiff = [
    'diff --git a/README.md b/README.md',
    '+++ README.md',
    '@@ -1,0 +1,1 @@',
    '+docs',
  ].join('\n');
  const emptyAdded = parseUnifiedDiff(readmeDiff, rootNorm);
  const result3 = computePatch(byFile, emptyAdded);
  eq('computePatch ignores non-instrumented files', result3.totalInst, 0);
  eq('computePatch null pct when nothing', result3.pct, null);

  eq('classifyGroup frontend', classifyGroup('src/App.tsx'), 'frontend');
  eq('classifyGroup backend', classifyGroup('src-tauri/src/commands/auth.rs'), 'backend');
  eq('classifyGroup other', classifyGroup('scripts/x.mjs'), 'other');

  const subByFile = new Map([['src/commands/auth.rs', new Map([[1, 0]])]]);
  const subAdded = new Map([['src-tauri/src/commands/auth.rs', new Set([1])]]);
  const r4 = computePatch(subByFile, subAdded);
  eq('computePatch suffix-fallback matches subdir-relative lcov', r4.totalInst, 1);
  eq('computePatch suffix-fallback uncovered', r4.uncovered, ['src-tauri/src/commands/auth.rs:1']);

  const ambByFile = new Map([
    ['a/src/x.rs', new Map([[1, 0]])],
    ['b/src/x.rs', new Map([[1, 1]])],
  ]);
  const ambAdded = new Map([['src/x.rs', new Set([1])]]);
  const r5 = computePatch(ambByFile, ambAdded);
  eq('computePatch suffix-fallback skips ambiguous matches', r5.totalInst, 0);

  return ok;
}

const code = main();
if (typeof code === 'number') process.exit(code);
