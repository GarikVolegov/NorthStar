// Pure renderer for the interactive loop's per-iteration status block.
// Deterministic: same state in -> same string out (unit-tested in checkpoint.test.mjs).

const GATE_ICON = { green: '🟢', red: '🔴' };

function itemLine(item) {
  if (!item) return '(nessuno)';
  return `${item.id} · ${item.type ?? '—'}/${item.priority ?? '—'} · "${item.title ?? '—'}"`;
}

export function renderCheckpoint(state) {
  const {
    iter, max,
    item = null,
    result = '—',
    gate = null,
    decision = null,
    review = null,
    commit = null,
    pushed = null,
    failures = 0,
    maxFailures = 3,
    next = null,
    byStatus = {},
    mode = 'unknown',
  } = state;

  const gateStr = gate ? `${GATE_ICON[gate] ?? '—'} ${gate}` : '—';
  const pushStr = pushed == null ? '—' : pushed ? 'sì' : 'no';
  const counts = ['todo', 'in_progress', 'blocked', 'done']
    .map((k) => `${k} ${byStatus[k] ?? 0}`)
    .join(' · ');

  return [
    `─── Ralph · iterazione ${iter}/${max} ─────────────────────────`,
    ` item      ${itemLine(item)}`,
    ` gate      ${gateStr}        decisione  ${decision ?? '—'}`,
    ` review    ${review ?? '—'}`,
    ` commit    ${commit ?? '—'}         push       ${pushStr}`,
    ` esito     ${result}  fail       ${failures}/${maxFailures}`,
    ` prossimo  ${itemLine(next)}`,
    ` backlog   ${counts}   mode ${mode}`,
    `──────────────────────────────────────────────────────`,
  ].join('\n');
}
