import test from 'node:test';
import assert from 'node:assert/strict';
import { storeState, prState } from './release-channels.mjs';

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
