// Tests for the backlog selection logic — the priority policy of the loop.
// Run: node --test scripts/ralph/lib/backlog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectNextItem, sortBacklog, summarize } from './backlog.mjs';

const item = (over) => ({
  id: 'x',
  type: 'feature',
  priority: 'P2',
  status: 'todo',
  title: 't',
  createdAt: '2026-06-24T00:00:00Z',
  ...over,
});

test('returns null for an empty backlog', () => {
  assert.equal(selectNextItem([]), null);
});

test('returns null when no item is in todo status', () => {
  const items = [item({ id: 'a', status: 'done' }), item({ id: 'b', status: 'blocked' })];
  assert.equal(selectNextItem(items), null);
});

test('security and bug outrank improvement and feature', () => {
  const items = [
    item({ id: 'feat', type: 'feature', priority: 'P0' }),
    item({ id: 'imp', type: 'improvement', priority: 'P0' }),
    item({ id: 'bug', type: 'bug', priority: 'P3' }),
  ];
  assert.equal(selectNextItem(items).id, 'bug');
});

test('within the same tier, lower P-number wins', () => {
  const items = [
    item({ id: 'sec3', type: 'security', priority: 'P3' }),
    item({ id: 'sec0', type: 'security', priority: 'P0' }),
  ];
  assert.equal(selectNextItem(items).id, 'sec0');
});

test('ties broken by older createdAt first (FIFO)', () => {
  const items = [
    item({ id: 'newer', type: 'bug', priority: 'P1', createdAt: '2026-06-24T10:00:00Z' }),
    item({ id: 'older', type: 'bug', priority: 'P1', createdAt: '2026-06-24T08:00:00Z' }),
  ];
  assert.equal(selectNextItem(items).id, 'older');
});

test('skips non-todo items even if higher priority', () => {
  const items = [
    item({ id: 'sec', type: 'security', priority: 'P0', status: 'in_progress' }),
    item({ id: 'bug', type: 'bug', priority: 'P2', status: 'todo' }),
  ];
  assert.equal(selectNextItem(items).id, 'bug');
});

test('sortBacklog is a stable full ordering (does not mutate input)', () => {
  const items = [item({ id: 'feat', type: 'feature' }), item({ id: 'bug', type: 'bug' })];
  const sorted = sortBacklog(items);
  assert.deepEqual(sorted.map((i) => i.id), ['bug', 'feat']);
  assert.deepEqual(items.map((i) => i.id), ['feat', 'bug']); // original untouched
});

test('summarize counts items by status and surfaces the next item id', () => {
  const items = [
    item({ id: 'a', type: 'bug', status: 'todo' }),
    item({ id: 'b', type: 'feature', status: 'todo' }),
    item({ id: 'c', status: 'done' }),
    item({ id: 'd', status: 'blocked' }),
  ];
  const s = summarize(items);
  assert.equal(s.total, 4);
  assert.equal(s.byStatus.todo, 2);
  assert.equal(s.byStatus.done, 1);
  assert.equal(s.byStatus.blocked, 1);
  assert.equal(s.next, 'a'); // bug beats feature
});

test('summarize reports no next item when nothing is todo', () => {
  const s = summarize([item({ status: 'done' })]);
  assert.equal(s.byStatus.todo, undefined);
  assert.equal(s.next, null);
});
