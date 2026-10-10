import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findConfigDrift,
  findOrphanTests,
  globToRegExp,
  scanTrackedFiles,
  WDIO_SPECS,
} from './check-test-runners.mjs';
import { discoverScriptTests } from './run-script-tests.mjs';

const repoRoot = new URL('..', import.meta.url);
const readConfig = (name) => readFileSync(new URL(name, repoRoot), 'utf8');
const realConfigs = () => ({
  vitestConfig: readConfig('vitest.config.ts'),
  wdioConfig: readConfig('wdio.conf.ts'),
  playwrightConfig: readConfig('playwright.config.ts'),
});

test('findOrphanTests accepts a file for each runner', () => {
  const files = [
    'src/components/Editor.test.tsx',
    'src/lib/dates.test.ts',
    'vite.config.test.ts',
    'e2e/specs/search.spec.ts',
    'tests/print/pdf-pagination.spec.ts',
    'scripts/sync-skills.test.js',
    'scripts/fingerprint-website-assets.test.mjs',
  ];

  assert.deepEqual(findOrphanTests(files), []);
});

test('findOrphanTests ignores files that are not tests', () => {
  const files = [
    'src/lib/markdown.bench.ts',
    'scripts/sync-skills.js',
    'README.md',
    'src/test/setup.ts',
  ];

  assert.deepEqual(findOrphanTests(files), []);
});

test('findOrphanTests reports test files that every runner excludes', () => {
  const files = [
    'scripts/agent-dev/probe.test.ts', // scripts/ is excluded from Vitest; test:scripts is top-level .js only
    'scripts/validate-locales.test.ts', // a TypeScript suite cannot run under plain node --test
    'e2e/helpers.test.ts', // WebdriverIO only collects e2e/specs/**/*.spec.ts
    'tests/other/thing.spec.ts', // Playwright only collects tests/print/
  ];

  assert.deepEqual(findOrphanTests(files), files);
});

test('findOrphanTests reports hidden E2E specs that the WebdriverIO glob skips', () => {
  const files = [
    'e2e/specs/.hidden.spec.ts', // hidden file
    'e2e/specs/.drafts/search.spec.ts', // hidden folder
    'e2e/specs/nested/.cache/search.spec.ts', // hidden folder deeper in the tree
  ];

  assert.deepEqual(findOrphanTests(files), files);
  assert.deepEqual(findOrphanTests(['e2e/specs/nested/search.spec.ts']), []);
});

test('findOrphanTests accepts hidden paths for runners that collect them', () => {
  const files = [
    'src/.fixtures/a.test.ts', // Vitest globs with dot: true
    'tests/print/.drafts/b.spec.ts', // Playwright walks hidden folders
    'scripts/.c.test.mjs', // readdir returns hidden files
  ];

  assert.deepEqual(findOrphanTests(files), []);
});

test('scanTrackedFiles reads raw git ls-files -z output, including non-ASCII names', () => {
  const output = [
    'src/ok.test.ts',
    'scripts/café.test.ts',
    'docs/notes.md',
    'scripts/naïve.test.js',
    '',
  ].join('\0');

  assert.deepEqual(scanTrackedFiles(output), {
    testCount: 3,
    orphans: ['scripts/café.test.ts'],
  });
});

test('findConfigDrift finds no drift in the real runner configs', async () => {
  assert.deepEqual(await findConfigDrift(realConfigs()), []);
});

test('findConfigDrift reads the active value, not a commented old value', async () => {
  const wdioConfig = `export const config = {
  // Previous specs: ['./e2e/specs/**/*.spec.ts']
  specs: ['./e2e/specs/smoke/**/*.spec.ts'],
};`;
  const playwrightConfig = `export default defineConfig({
  // Previous testDir: './tests/print'
  testDir: './tests/print/smoke',
});`;

  const problems = await findConfigDrift({ ...realConfigs(), wdioConfig, playwrightConfig });

  assert.equal(problems.length, 2);
  assert.match(problems[0], /^wdio\.conf\.ts: specs: config has \["\.\/e2e\/specs\/smoke/);
  assert.match(
    problems[1],
    /^playwright\.config\.ts: testDir: config has "\.\/tests\/print\/smoke"/,
  );
});

test('findConfigDrift accepts other quotes, whitespace, and comments', async () => {
  const wdioConfig = `export const config = {
  /* exclude: ['x'] */
  specs: [
    "./e2e/specs/**/*.spec.ts", // testMatch: 'y'
  ],
};`;
  const playwrightConfig = 'export default defineConfig({ testDir: `./tests/print` });';

  assert.deepEqual(await findConfigDrift({ ...realConfigs(), wdioConfig, playwrightConfig }), []);
});

test('findConfigDrift reports dynamic values and new include or exclude keys', async () => {
  const problems = await findConfigDrift({
    vitestConfig: `export default defineConfig({ test: { include: ['src/**'], exclude: ['e2e/**'] } });`,
    wdioConfig: 'export const config = { specs: SPECS, exclude: [] };',
    playwrightConfig: 'export default defineConfig({ testDir: dir, testMatch: /x/ });',
  });

  assert.deepEqual(problems, [
    'vitest.config.ts: test.exclude: expected the array to start with ...configDefaults.exclude',
    'vitest.config.ts: test.include is set; the guard assumes the runner default',
    'wdio.conf.ts: specs: unsupported value (expected an array literal)',
    'wdio.conf.ts: exclude is set; the guard assumes the runner default',
    'playwright.config.ts: testDir: expected exactly one string literal',
    'playwright.config.ts: testMatch is set; the guard assumes the runner default',
  ]);
});

test('findConfigDrift reports a syntax error even when the properties match', async () => {
  const configs = realConfigs();
  const problems = await findConfigDrift({
    ...configs,
    vitestConfig: `${configs.vitestConfig}\nconst broken = ;\n`,
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /^vitest\.config\.ts:\d+:\d+: syntax error: Expression expected\.$/);
});

test('findConfigDrift reports object spreads that could override a checked property', async () => {
  const problems = await findConfigDrift({
    vitestConfig: `export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'e2e/**', '.reference/**', '.claude/**', 'tests/**', 'scripts/**'], ...testOverride },
  ...override,
});`,
    wdioConfig: `export const config = { specs: ['./e2e/specs/**/*.spec.ts'], ...override };`,
    playwrightConfig: `export default defineConfig({ testDir: './tests/print', ...override });`,
  });

  assert.deepEqual(problems, [
    'vitest.config.ts: unsupported spread ...testOverride in the object that holds test.exclude',
    'vitest.config.ts: unsupported spread ...override in the object that holds test.exclude',
    'wdio.conf.ts: unsupported spread ...override in the object that holds specs',
    'playwright.config.ts: unsupported spread ...override in the object that holds testDir',
  ]);
});

test('findConfigDrift accepts configDefaults.exclude with comments and spaces around the dot', async () => {
  const vitestConfig = `export default defineConfig({
  test: { exclude: [...configDefaults /* defaults */ . exclude, 'e2e/**', '.reference/**', '.claude/**', 'tests/**', 'scripts/**'] },
});`;

  assert.deepEqual(await findConfigDrift({ ...realConfigs(), vitestConfig }), []);
  const other = vitestConfig.replace(
    'configDefaults /* defaults */ . exclude',
    'otherDefaults.exclude',
  );
  assert.deepEqual(await findConfigDrift({ ...realConfigs(), vitestConfig: other }), [
    'vitest.config.ts: test.exclude: expected the array to start with ...configDefaults.exclude',
  ]);
});

test('the CLI exits 1 when a runner config has a syntax error', () => {
  const dir = join(
    tmpdir(),
    `check-test-runners-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  try {
    mkdirSync(dir, { recursive: true });
    const configs = realConfigs();
    writeFileSync(join(dir, 'vitest.config.ts'), configs.vitestConfig);
    writeFileSync(join(dir, 'wdio.conf.ts'), `${configs.wdioConfig}\nconst broken = ;\n`);
    writeFileSync(join(dir, 'playwright.config.ts'), configs.playwrightConfig);

    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('check-test-runners.mjs', import.meta.url)), '--config-dir', dir],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /wdio\.conf\.ts:\d+:\d+: syntax error/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('globToRegExp matches like a glob without dot: true', () => {
  const [specs] = WDIO_SPECS.map(globToRegExp);

  assert.ok(specs.test('e2e/specs/search.spec.ts'));
  assert.ok(specs.test('e2e/specs/a/b/search.spec.ts'));
  assert.ok(!specs.test('e2e/specs/.hidden.spec.ts'));
  assert.ok(!specs.test('e2e/specs/.drafts/search.spec.ts'));
  assert.ok(!specs.test('e2e/specs/search.spec.tsx'));
  assert.ok(!specs.test('e2e/search.spec.ts'));
  assert.throws(() => globToRegExp('./e2e/{a,b}/*.ts'), /unsupported glob syntax/);
  assert.throws(() => globToRegExp('./e2e/**'), /unsupported glob syntax/);
});

test('findOrphanTests matches the file-name forms Vitest collects', () => {
  const files = ['src/a.spec.ts', 'src/b.test.mjs', 'src/c.test.cts', 'src/d.spec.jsx'];

  assert.deepEqual(findOrphanTests(files), []);
});

test('discoverScriptTests finds only top-level JS test files', () => {
  const root = join(
    tmpdir(),
    `check-test-runners-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  try {
    mkdirSync(join(root, 'nested'), { recursive: true });
    for (const name of [
      'a.test.js',
      'b.test.mjs',
      'c.test.cjs',
      'd.test.ts',
      'e.js',
      'nested/f.test.js',
    ]) {
      writeFileSync(join(root, name), '');
    }

    assert.deepEqual(
      discoverScriptTests(root).map((file) => basename(file)),
      ['a.test.js', 'b.test.mjs', 'c.test.cjs'],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverScriptTests includes this suite in the real scripts folder', () => {
  const names = discoverScriptTests().map((file) => basename(file));

  assert.ok(names.includes('check-test-runners.test.mjs'));
  assert.ok(names.includes('website-generator-utils.test.mjs'));
});
