import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCheckpoint } from './checkpoint.mjs';

const base = {
  iter: 3, max: 12,
  item: { id: 'CHORE-001', type: 'chore', priority: 'P0', title: 'verify gate green' },
  result: 'ITERATION_DONE', gate: 'green', decision: 'report', commit: 'abc1234', pushed: true,
  failures: 0, maxFailures: 3,
  next: { id: 'IMP-001', type: 'improvement', priority: 'P2', title: 'deprecate route-paths.ts' },
  byStatus: { todo: 2, in_progress: 0, blocked: 3, done: 3 },
  mode: 'pr-only',
};

test('renders the worked item and the next item', () => {
  const out = renderCheckpoint(base);
  assert.match(out, /CHORE-001 · chore\/P0 · "verify gate green"/);
  assert.match(out, /IMP-001 · improvement\/P2 · "deprecate route-paths.ts"/);
});

test('shows iteration and failure ratios', () => {
  const out = renderCheckpoint(base);
  assert.match(out, /iterazione 3\/12/);
  assert.match(out, /fail\s+0\/3/);
});

test('maps gate to an icon, with a dash when unknown', () => {
  assert.match(renderCheckpoint(base), /🟢 green/);
  assert.match(renderCheckpoint({ ...base, gate: 'red' }), /🔴 red/);
  assert.match(renderCheckpoint({ ...base, gate: null }), /gate\s+—/);
});

test('derives backlog counts from byStatus, defaulting missing keys to 0', () => {
  const out = renderCheckpoint({ ...base, byStatus: { todo: 5 } });
  assert.match(out, /todo 5 · in_progress 0 · blocked 0 · done 0/);
});

test('handles a null next item (no todo left)', () => {
  assert.match(renderCheckpoint({ ...base, next: null }), /prossimo  \(nessuno\)/);
});

test('renders push state as sì / no / —', () => {
  assert.match(renderCheckpoint(base), /push\s+sì/);
  assert.match(renderCheckpoint({ ...base, pushed: false }), /push\s+no/);
  assert.match(renderCheckpoint({ ...base, pushed: null }), /push\s+—/);
});

test('degrades an id-only item to em-dashes (no "undefined")', () => {
  const out = renderCheckpoint({ ...base, item: { id: 'NONEXISTENT-999' } });
  assert.match(out, /NONEXISTENT-999 · —\/— · "—"/);
  assert.doesNotMatch(out, /undefined/);
});

test('renders the review line, defaulting to an em-dash', () => {
  assert.match(renderCheckpoint({ ...base, review: '🟢 5 rev · 0 crit · 1 imp (fixed)' }),
    /review\s+🟢 5 rev · 0 crit · 1 imp \(fixed\)/);
  assert.match(renderCheckpoint(base), /review\s+—/); // base has no review field
});
