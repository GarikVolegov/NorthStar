// scripts/ralph/lib/review-panel.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPanel } from './review-panel.mjs';

test('FULL panel for a bug or security item (any area)', () => {
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'web', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
  assert.deepEqual(reviewPanel({ type: 'security', area: 'repo', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
});

test('FULL panel for a deploy-relevant area even on a chore', () => {
  for (const area of ['api', 'db', 'ai', 'wendy']) {
    assert.deepEqual(reviewPanel({ type: 'chore', area, hasCodeChange: true }),
      ['correctness', 'security', 'tests', 'design', 'consistency']);
  }
});

test('STANDARD panel for frontend code (no server-consistency)', () => {
  assert.deepEqual(reviewPanel({ type: 'improvement', area: 'web', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design']);
});

test('LIGHT panel for other code areas', () => {
  assert.deepEqual(reviewPanel({ type: 'chore', area: 'repo', hasCodeChange: true }),
    ['correctness', 'security', 'design']);
  assert.deepEqual(reviewPanel({ type: 'improvement', area: 'scripts', hasCodeChange: true }),
    ['correctness', 'security', 'design']);
});

test('MINIMAL panel (design only) when no code changed', () => {
  assert.deepEqual(reviewPanel({ type: 'chore', area: 'ci', hasCodeChange: false }), ['design']);
  // deploy-relevant area but docs/config only → still minimal
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'api', hasCodeChange: false }), ['design']);
});

test('security is present in every panel that touches code', () => {
  for (const area of ['api', 'web', 'repo', 'db']) {
    assert.ok(reviewPanel({ type: 'chore', area, hasCodeChange: true }).includes('security'));
  }
});

test('consistency runs only in the FULL panel', () => {
  assert.ok(reviewPanel({ type: 'chore', area: 'api', hasCodeChange: true }).includes('consistency'));
  assert.ok(!reviewPanel({ type: 'chore', area: 'web', hasCodeChange: true }).includes('consistency'));
  assert.ok(!reviewPanel({ type: 'chore', area: 'repo', hasCodeChange: true }).includes('consistency'));
});

test('hasCodeChange defaults to true', () => {
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'api' }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
});
