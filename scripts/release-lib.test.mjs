import test from 'node:test';
import assert from 'node:assert/strict';
import { unreleased } from './release-lib.mjs';

test('parses the first version under Versions, not the template', () => {
  const result = unreleased('# Changelog\n## [X.Y.Z] - Unreleased\n# Versions\n## [0.8.1] - Unreleased\n### Added\n- Item\n## [0.8.0] - date\nold');
  assert.deepEqual(result, { version: '0.8.1', body: '### Added\n- Item' });
});

test('rejects a stamped first heading', () => {
  assert.equal(unreleased('# Versions\n## [0.8.1] - date\n'), null);
});
