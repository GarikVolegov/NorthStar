// Journal (audit trail) helpers — the morning-readable diary of the loop.
// One file per day under scripts/ralph/journal/YYYY-MM-DD.md; each iteration
// appends a block so the founder can review the night in a couple of minutes.

import { join } from 'node:path';

/** YYYY-MM-DD path under <dir>/journal for a Date or ISO string. */
export function journalPathFor(date, dir) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return join(dir, 'journal', `${day}.md`);
}

const line = (label, value) =>
  value === undefined || value === null || value === '' ? '' : `- **${label}:** ${value}\n`;

/** Render one iteration as a markdown block. Missing optional fields are skipped. */
export function formatJournalEntry(entry) {
  const { time, itemId, type, title, gate, review, decision, action, commit, pr, deploy, notes } = entry;
  const heading = `### ${time ? `${time} · ` : ''}${itemId ?? '(no-item)'}${title ? ` — ${title}` : ''}\n`;
  return (
    heading +
    line('type', type) +
    line('gate', gate) +
    line('review', review) +
    line('decision', decision) +
    line('action', action) +
    line('commit', commit) +
    line('pr', pr) +
    line('deploy', deploy) +
    line('notes', notes) +
    '\n'
  );
}
