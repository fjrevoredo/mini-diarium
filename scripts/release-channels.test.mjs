import test from 'node:test';
import assert from 'node:assert/strict';
import { storeState, prState, runTag, runDetail } from './release-channels.mjs';

test('dispatch association uses an exact explicit marker and reports failures', () => {
  assert.equal(runTag('step 2026-01-01 RELEASE_AUTOMATION_TAG=v0.6.20\n'), 'v0.6.20');
  assert.equal(runTag('unrelated v0.6.2'), null);
  assert.equal(runTag('RELEASE_AUTOMATION_TAG=v0.6.2\nRELEASE_AUTOMATION_TAG=v0.6.20'), null);
  assert.match(runDetail({ status: 'completed', conclusion: 'failure', databaseId: 1 }), /^failed/);
});

test('historical Store certification is only submitted', () => {
  const run = { status: 'completed', conclusion: 'success' };
  assert.equal(storeState(run, 'Submission ID: 123\nStatus: Certification'), 'submitted / awaiting external review');
  assert.equal(storeState(run, 'Submission created. Id=123\nStatus: Certification'), 'submitted / awaiting external review');
  assert.equal(storeState({ ...run, conclusion: 'failure' }, ''), 'failed');
  assert.equal(storeState(run, 'Status: Certification'), 'awaiting maintainer');
});
test('PR states distinguish merged availability from submission', () => {
  assert.equal(prState({ mergedAt: 'today' }, true), 'available');
  assert.equal(prState({ mergedAt: 'today' }), 'submitted / awaiting external review');
  assert.equal(prState({ state: 'OPEN' }), 'submitted / awaiting external review');
});
