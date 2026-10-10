#!/usr/bin/env node
/**
 * Checks that every tracked test file belongs to a runner that a gate executes.
 *
 * A test file that no runner collects never fails, so it gives false confidence. This guard
 * lists every tracked `*.test.*` / `*.spec.*` file and fails when one sits outside the
 * include rules of every runner below.
 *
 * The RUNNERS rules mirror the runner configs. When you change a config's include or exclude
 * list, change the matching rule here in the same commit. findConfigDrift parses the configs
 * and makes this guard fail when the exported config values below no longer match them:
 *   - Vitest            vitest.config.ts      (default include, minus `test.exclude`)
 *   - WebdriverIO E2E   wdio.conf.ts          (`specs`)
 *   - Playwright print  playwright.config.ts  (`testDir` + default testMatch)
 *   - node:test         scripts/run-script-tests.mjs (SCRIPT_TEST_FILE)
 *
 * Hidden paths: Vitest (tinyglobby, `dot: true`), Playwright (its own directory walk, matcher
 * with `dot: true`) and the node:test runner (`readdir`) collect files and folders whose name
 * starts with `.`. WebdriverIO calls `globSync` without `dot: true`, so it skips them.
 *
 * Scanning is done over `git ls-files -z` in pure Node rather than with `rg`, because ripgrep
 * is not installed on every machine that runs `bun run pre-commit`. `-z` gives raw paths:
 * without it, git quotes names with non-ASCII or special characters, and a quoted name would
 * match no test pattern and escape the check.
 *
 * Run: node scripts/check-test-runners.mjs [--config-dir <dir>]
 * Exit 0 = every test file has a runner. Exit 1 = orphan test files found (or the scan failed).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SCRIPT_TEST_FILE } from './run-script-tests.mjs';

/**
 * Any file name that a JS/TS test runner could treat as a test. It is also the file-name part
 * of the Vitest default include and the Playwright default testMatch
 * (`*.{test,spec}.?(c|m)[jt]s?(x)`).
 */
export const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** The project entries of `test.exclude` in vitest.config.ts (after `...configDefaults.exclude`). */
export const VITEST_EXCLUDE = ['e2e/**', '.reference/**', '.claude/**', 'tests/**', 'scripts/**'];

/** `specs` in wdio.conf.ts. */
export const WDIO_SPECS = ['./e2e/specs/**/*.spec.ts'];

/** `testDir` in playwright.config.ts. */
export const PLAYWRIGHT_TEST_DIR = './tests/print';

const VITEST_EXCLUDED_PREFIXES = VITEST_EXCLUDE.map((pattern) => pattern.replace(/\*\*$/, ''));
const PLAYWRIGHT_PREFIX = `${PLAYWRIGHT_TEST_DIR.replace(/^\.\//, '')}/`;

const baseName = (file) => file.slice(file.lastIndexOf('/') + 1);
const isUnder = (file, prefix) => file.startsWith(prefix);
const hasSegment = (file, segment) => file.split('/').includes(segment);

/**
 * Converts the small glob subset the runner configs use (`**` as a whole non-final segment, `*`, `?`,
 * literal characters) to a RegExp with the semantics of a glob without `dot: true`: a `*`,
 * `?`, or `**` never matches a segment that starts with `.`. Any other glob syntax throws, so
 * a config that starts to use it fails loudly here and the matcher gets extended on purpose.
 */
export function globToRegExp(glob) {
  const segments = glob.replace(/^\.\//, '').split('/');
  const parts = segments.map((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**' && !last) return '(?:(?!\\.)[^/]+/)*';
    if (segment.includes('**') || /[[\]{}()!+@\\]/.test(segment)) {
      throw new Error(`unsupported glob syntax in "${glob}"`);
    }
    let source = '';
    for (const [position, char] of [...segment].entries()) {
      const wildcard = char === '*' ? '[^/]*' : char === '?' ? '[^/]' : null;
      if (wildcard === null) {
        source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else {
        source += (position === 0 ? '(?!\\.)' : '') + wildcard;
      }
    }
    return source + (last ? '' : '/');
  });
  return new RegExp(`^${parts.join('')}$`);
}

const WDIO_SPEC_MATCHERS = WDIO_SPECS.map(globToRegExp);

export const RUNNERS = [
  {
    name: 'Vitest (bun run test:coverage)',
    owns: (file) =>
      TEST_FILE.test(baseName(file)) &&
      !hasSegment(file, 'node_modules') &&
      !VITEST_EXCLUDED_PREFIXES.some((prefix) => isUnder(file, prefix)),
  },
  {
    name: 'WebdriverIO E2E (bun run test:e2e)',
    owns: (file) => WDIO_SPEC_MATCHERS.some((matcher) => matcher.test(file)),
  },
  {
    name: 'Playwright print (bun run test:print)',
    owns: (file) =>
      isUnder(file, PLAYWRIGHT_PREFIX) &&
      !hasSegment(file, 'node_modules') &&
      TEST_FILE.test(baseName(file)),
  },
  {
    name: 'node:test (bun run test:scripts)',
    owns: (file) =>
      isUnder(file, 'scripts/') &&
      !file.slice('scripts/'.length).includes('/') &&
      SCRIPT_TEST_FILE.test(baseName(file)),
  },
];

/** Returns the test files (repo-relative, `/`-separated) that no runner owns. */
export function findOrphanTests(files, runners = RUNNERS) {
  return files
    .filter((file) => TEST_FILE.test(baseName(file)))
    .filter((file) => !runners.some((runner) => runner.owns(file)));
}

/** Checks raw `git ls-files -z` output. Returns the test-file count and the orphans. */
export function scanTrackedFiles(lsFilesZOutput, runners = RUNNERS) {
  const files = lsFilesZOutput.split('\0').filter(Boolean);
  return {
    testCount: files.filter((file) => TEST_FILE.test(baseName(file))).length,
    orphans: findOrphanTests(files, runners),
  };
}

/**
 * Compares the runner configs with VITEST_EXCLUDE, WDIO_SPECS, and PLAYWRIGHT_TEST_DIR.
 * Each config is parsed with the TypeScript parser (never imported or run), so comments and
 * quote style do not matter. A syntax error, a value that is not a plain string literal, and an
 * object spread next to a checked property (it could override the property) are reported as
 * problems. Returns a list of problems; an empty list means the rules match.
 */
export async function findConfigDrift({ vitestConfig, wdioConfig, playwrightConfig }) {
  const { default: ts } = await import('typescript');
  const problems = [];

  /**
   * Parses a config. The parser recovers from syntax errors, so a broken file could still show
   * the expected properties; report its syntax errors and skip its checks instead.
   */
  const parse = (name, text) => {
    const sourceFile = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    // parseDiagnostics is internal to the TypeScript API but present on every SourceFile.
    const diagnostics = sourceFile.parseDiagnostics ?? [];
    for (const diagnostic of diagnostics) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      problems.push(`${name}:${line + 1}:${character + 1}: syntax error: ${message}`);
    }
    return diagnostics.length > 0 ? undefined : sourceFile;
  };

  /** Reports object spreads next to a checked property: a spread can override it at run time. */
  const expectNoSpreadAround = (file, nodes, label) => {
    for (const node of nodes) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (!ts.isObjectLiteralExpression(parent)) continue;
        for (const member of parent.properties) {
          if (ts.isSpreadAssignment(member)) {
            problems.push(
              `${file}: unsupported spread ...${member.expression.getText()} in the object that holds ${label}`,
            );
          }
        }
      }
    }
  };

  const isConfigDefaultsExclude = (expression) =>
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'configDefaults' &&
    ts.isIdentifier(expression.name) &&
    expression.name.text === 'exclude';
  const propertyName = (node) =>
    node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      ? node.name.text
      : undefined;
  const isProperty = (node) =>
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isMethodDeclaration(node);

  /** Every property, at any depth, whose key path ends with `path` (first key anywhere). */
  const propertiesAt = (sourceFile, path) => {
    let found = [];
    const visit = (node) => {
      if (isProperty(node) && propertyName(node) === path[0]) found.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    for (const key of path.slice(1)) {
      found = found.flatMap((node) =>
        ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer)
          ? node.initializer.properties.filter((child) => propertyName(child) === key)
          : [],
      );
    }
    return found;
  };

  const stringValue = (node) =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;

  /** Reads the single property at `path` as a string array; reports a problem otherwise. */
  const readStrings = (file, sourceFile, path, { leadingConfigDefaults = false } = {}) => {
    const label = `${file}: ${path.join('.')}`;
    const nodes = propertiesAt(sourceFile, path);
    expectNoSpreadAround(file, nodes, path.join('.'));
    if (nodes.length !== 1) {
      problems.push(`${label}: expected exactly one property, found ${nodes.length}`);
      return undefined;
    }
    const node = nodes[0];
    if (!ts.isPropertyAssignment(node) || !ts.isArrayLiteralExpression(node.initializer)) {
      problems.push(`${label}: unsupported value (expected an array literal)`);
      return undefined;
    }
    let elements = [...node.initializer.elements];
    if (leadingConfigDefaults) {
      const first = elements[0];
      if (!first || !ts.isSpreadElement(first) || !isConfigDefaultsExclude(first.expression)) {
        problems.push(`${label}: expected the array to start with ...configDefaults.exclude`);
        return undefined;
      }
      elements = elements.slice(1);
    }
    const values = elements.map(stringValue);
    if (values.includes(undefined)) {
      problems.push(`${label}: unsupported value (expected string literals only)`);
      return undefined;
    }
    return values;
  };

  const expectSame = (label, actual, expected) => {
    if (actual !== undefined && JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(
        `${label}: config has ${JSON.stringify(actual)}, guard expects ${JSON.stringify(expected)}`,
      );
    }
  };
  const expectAbsent = (file, sourceFile, path) => {
    if (propertiesAt(sourceFile, path).length > 0) {
      problems.push(`${file}: ${path.join('.')} is set; the guard assumes the runner default`);
    }
  };

  const vitest = parse('vitest.config.ts', vitestConfig);
  if (vitest) {
    expectSame(
      'vitest.config.ts: test.exclude',
      readStrings('vitest.config.ts', vitest, ['test', 'exclude'], {
        leadingConfigDefaults: true,
      }),
      VITEST_EXCLUDE,
    );
    expectAbsent('vitest.config.ts', vitest, ['test', 'include']);
  }

  const wdio = parse('wdio.conf.ts', wdioConfig);
  if (wdio) {
    expectSame('wdio.conf.ts: specs', readStrings('wdio.conf.ts', wdio, ['specs']), WDIO_SPECS);
    expectAbsent('wdio.conf.ts', wdio, ['exclude']);
  }

  const playwright = parse('playwright.config.ts', playwrightConfig);
  if (playwright) {
    const testDirs = propertiesAt(playwright, ['testDir']);
    expectNoSpreadAround('playwright.config.ts', testDirs, 'testDir');
    const testDir =
      testDirs.length === 1 && ts.isPropertyAssignment(testDirs[0])
        ? stringValue(testDirs[0].initializer)
        : undefined;
    if (testDir === undefined) {
      problems.push('playwright.config.ts: testDir: expected exactly one string literal');
    }
    expectSame('playwright.config.ts: testDir', testDir, PLAYWRIGHT_TEST_DIR);
    expectAbsent('playwright.config.ts', playwright, ['testMatch']);
    expectAbsent('playwright.config.ts', playwright, ['testIgnore']);
  }

  return problems;
}

async function main() {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));

  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files', '-z'], {
      encoding: 'utf8',
      cwd: repoRoot,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`[test-runners] could not list tracked files: ${err.message}`);
    process.exit(1);
  }

  // --config-dir <dir> reads the three runner configs from another folder (used by the tests).
  const configDirFlag = process.argv.indexOf('--config-dir');
  const configDir = configDirFlag === -1 ? repoRoot : process.argv[configDirFlag + 1];
  const drift = await findConfigDrift({
    vitestConfig: readFileSync(join(configDir, 'vitest.config.ts'), 'utf8'),
    wdioConfig: readFileSync(join(configDir, 'wdio.conf.ts'), 'utf8'),
    playwrightConfig: readFileSync(join(configDir, 'playwright.config.ts'), 'utf8'),
  });
  if (drift.length > 0) {
    for (const problem of drift) {
      console.error(`[test-runners] ${problem}`);
    }
    console.error(
      `\n✗ The runner configs and the rules in scripts/check-test-runners.mjs disagree.\n` +
        '  Update the exported config values and the matching RUNNERS rule together.',
    );
    process.exit(1);
  }

  const { testCount, orphans } = scanTrackedFiles(tracked);

  if (orphans.length > 0) {
    for (const orphan of orphans) {
      console.error(`[test-runners] no runner executes ${orphan}`);
    }
    console.error(
      `\n✗ ${orphans.length} test file(s) are outside every runner's include list.\n` +
        '  Move each file under a runner, or add a runner and wire it into CI and pre-commit.\n' +
        '  Runners: ' +
        RUNNERS.map((runner) => runner.name).join('; '),
    );
    process.exit(1);
  }

  console.log(`✓ All ${testCount} tracked test files belong to a gated runner.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[test-runners] ${err.message}`);
    process.exit(1);
  });
}
