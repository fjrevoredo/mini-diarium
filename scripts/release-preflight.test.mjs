import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowState, missingSecrets, adminBypass, trustedExecutable } from './release-lib.mjs';

test('uses the latest matching SHA and fails closed for incomplete runs', () => {
  const runs = [{ headSha: 'a', status: 'in_progress', conclusion: null }, { headSha: 'a', status: 'completed', conclusion: 'success' }];
  assert.equal(workflowState(runs, 'a'), 'not green');
  assert.equal(workflowState(runs, 'b'), 'missing');
  assert.equal(workflowState(runs, 'b', true), 'absent');
  assert.equal(workflowState([runs[1]], 'a'), 'green');
});

test('only accepts a verified admin bypass on master', () => {
  const rule = { enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['refs/heads/master'], exclude: [] } }, bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'exempt' }] };
  assert.ok(adminBypass(rule, 'admin'));
  assert.ok(!adminBypass(rule, 'write'));
  assert.ok(!adminBypass({ ...rule, bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'pull_request' }] }, 'admin'));
});

test('finds missing secret names in gh output', () => {
  assert.deepEqual(missingSecrets('ONE\t2026-01-01\nTWO\t2026-01-01', ['ONE', 'THREE']), ['THREE']);
});

test('only accepts a trusted absolute executable, never PATH', () => {
  const existing = process.execPath;
  assert.equal(trustedExecutable(existing, '/usr/bin/ssh'), existing);
  assert.equal(trustedExecutable(null, existing), existing);
  assert.throws(() => trustedExecutable('ssh', existing), /fully qualified absolute path/);
  assert.throws(() => trustedExecutable('./ssh', existing), /fully qualified absolute path/);
  assert.throws(() => trustedExecutable(null, 'ssh'), /fully qualified absolute path/);
  assert.throws(() => trustedExecutable(null, `${existing}\0`), /fully qualified absolute path/);
  assert.throws(() => trustedExecutable(null, '/definitely/not/a/real/ssh'), /not found/);
});
