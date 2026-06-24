// Backlog selection — the priority policy of the autonomous loop.
//
// Founder decision: bugs & security ALWAYS first, then improvements/tech-debt,
// then features. Within a tier, lower P-number wins; ties are FIFO by createdAt.
//
// Pure functions, no I/O — unit-tested in backlog.test.mjs.

/** Tier rank: lower runs first. Security & bugs share the top tier. */
const TYPE_TIER = {
  security: 0,
  bug: 0,
  improvement: 1,
  chore: 1,
  feature: 2,
};

const tierOf = (type) => (type in TYPE_TIER ? TYPE_TIER[type] : 1);

/** "P0".."P3" -> 0..3; unknown/missing sorts last. */
const priorityNum = (priority) => {
  const m = /^P(\d+)$/.exec(String(priority ?? ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

const timeOf = (createdAt) => {
  const t = Date.parse(createdAt ?? '');
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

/** Full ordering of the backlog (does not mutate the input array). */
export function sortBacklog(items) {
  return [...items].sort((a, b) => {
    const tier = tierOf(a.type) - tierOf(b.type);
    if (tier !== 0) return tier;
    const prio = priorityNum(a.priority) - priorityNum(b.priority);
    if (prio !== 0) return prio;
    return timeOf(a.createdAt) - timeOf(b.createdAt);
  });
}

/** The single highest-priority item still in `todo`, or null if none. */
export function selectNextItem(items) {
  const todo = items.filter((i) => i.status === 'todo');
  if (todo.length === 0) return null;
  return sortBacklog(todo)[0];
}

/** A status snapshot for the morning report / `ralph:status`. */
export function summarize(items) {
  const byStatus = {};
  for (const i of items) {
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  }
  const next = selectNextItem(items);
  return { total: items.length, byStatus, next: next ? next.id : null };
}
