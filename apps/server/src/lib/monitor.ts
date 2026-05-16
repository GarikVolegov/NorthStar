interface RequestRecord {
  timestamp: number;
  statusCode: number;
  durationMs: number;
}

const WINDOW_MS = 5 * 60 * 1000;
const records: RequestRecord[] = [];

function prune(): void {
  const cutoff = Date.now() - WINDOW_MS;
  while (records.length > 0 && records[0].timestamp < cutoff) {
    records.shift();
  }
}

export function record(statusCode: number, durationMs: number): void {
  records.push({ timestamp: Date.now(), statusCode, durationMs });
  if (records.length > 10000) records.splice(0, 1000);
}

export function getStats(): {
  total: number;
  errors: number;
  errorRate: number;
  p95: number;
} | null {
  prune();
  const total = records.length;
  if (total === 0) return null;

  const errors = records.filter((r) => r.statusCode >= 500).length;
  const errorRate = errors / total;

  const sorted = [...records].sort((a, b) => a.durationMs - b.durationMs);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]?.durationMs ?? 0;

  return { total, errors, errorRate, p95 };
}
