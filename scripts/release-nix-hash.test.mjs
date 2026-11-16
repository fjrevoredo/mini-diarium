import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, applyHash } from './release-nix-hash.mjs';

test('classifies each Nix outcome from fixture runs and logs', () => {
  const run = { headSha: 'a', databaseId: 1, status: 'completed', conclusion: 'failure' };
  assert.equal(classify([], 'a').state, 'no run');
  assert.equal(classify([{ ...run, status: 'in_progress' }], 'a').state, 'running');
  assert.equal(classify([{ ...run, conclusion: 'success' }], 'a').state, 'green');
  assert.equal(classify([run], 'a').state, 'real failure');
  assert.deepEqual(classify([run], 'a', 'npmDepsHash is stale. Set it to sha256-abc='), { state: 'stale-hash', id: 1, hash: 'sha256-abc=' });
});

test('replaces exactly one hash and refuses ambiguity', () => {
  assert.equal(applyHash('npmDepsHash = "old";', 'sha256-abc='), 'npmDepsHash = "sha256-abc=";');
  assert.throws(() => applyHash('none', 'sha256-abc='));
});
