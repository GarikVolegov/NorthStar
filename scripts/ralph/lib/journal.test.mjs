// Tests for the journal (audit trail) helpers — the morning-readable diary.
// Run: node --test scripts/ralph/lib/journal.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journalPathFor, formatJournalEntry } from './journal.mjs';

test('journalPathFor builds a dated path under <dir>/journal', () => {
  const p = journalPathFor('2026-06-24T23:10:00Z', '/repo/scripts/ralph');
  assert.equal(p, '/repo/scripts/ralph/journal/2026-06-24.md');
});

test('journalPathFor accepts a Date object', () => {
  const p = journalPathFor(new Date('2026-01-05T00:00:00Z'), '/r');
  assert.equal(p, '/r/journal/2026-01-05.md');
});

test('formatJournalEntry renders the key fields as a markdown block', () => {
  const md = formatJournalEntry({
    time: '23:10',
    itemId: 'SEC-001',
    type: 'security',
    title: 'Harden auth',
    gate: 'green',
    decision: 'deploy',
    commit: 'abc1234',
    notes: 'all good',
  });
  assert.match(md, /SEC-001/);
  assert.match(md, /Harden auth/);
  assert.match(md, /security/);
  assert.match(md, /green/);
  assert.match(md, /deploy/);
  assert.match(md, /abc1234/);
  assert.match(md, /all good/);
  assert.match(md, /^### /m); // has a heading
});

test('formatJournalEntry tolerates missing optional fields', () => {
  const md = formatJournalEntry({ itemId: 'X', title: 't', gate: 'red', decision: 'hold' });
  assert.match(md, /X/);
  assert.match(md, /hold/);
  assert.doesNotMatch(md, /undefined/);
});

test('formatJournalEntry renders the review field when present', () => {
  const out = formatJournalEntry({ itemId: 'BUG-009', review: '🟢 panel: correctness,security; 0 crit, 1 imp fixed' });
  assert.match(out, /- \*\*review:\*\* 🟢 panel: correctness,security; 0 crit, 1 imp fixed/);
});

test('formatJournalEntry omits the review field when absent', () => {
  const out = formatJournalEntry({ itemId: 'BUG-009' });
  assert.ok(!out.includes('**review:**'));
});
