// Deterministic review triage: which specialist reviewers run for a change, scaled by risk.
// Pure, unit-tested. The iteration brain calls this (via `ralph-cli.mjs review-panel`) so the
// panel is consistent and not left to in-prompt judgment. Tiers (spec §4):
//   FULL     bug/security item OR deploy-relevant area  -> all 5
//   STANDARD frontend code (web)                        -> no server-consistency
//   LIGHT    other code (repo/scripts/…)                -> correctness+security+design
//   MINIMAL  no code change (docs/ci/config only)       -> design sanity only
// Security is present in every code-touching tier.

const DEPLOY_RELEVANT = new Set(['api', 'db', 'ai', 'wendy']);

export function reviewPanel({ type, area, hasCodeChange = true } = {}) {
  if (!hasCodeChange) return ['design'];

  const highRisk = type === 'bug' || type === 'security' || DEPLOY_RELEVANT.has(area);
  if (highRisk) return ['correctness', 'security', 'tests', 'design', 'consistency'];
  if (area === 'web') return ['correctness', 'security', 'tests', 'design'];
  return ['correctness', 'security', 'design'];
}
