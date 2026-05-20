import {
  COMPRESS_AFTER,
  KEEP_RAW_TURNS,
  PAGE_CONTEXT_MAX_CHARS,
} from './wendy.config';

export interface CompressedHistory {
  summary?:       string | undefined;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  totalTurns:     number;
}

export function compactPageData(value: unknown, maxChars = PAGE_CONTEXT_MAX_CHARS): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const preferredKeys = [
    'ideaId',
    'status',
    'ideaName',
    'oneLiner',
    'canvas',
    'scores',
    'scoreReasons',
    'scoreSuggestions',
    'averageScore',
    'assumption',
    'experiment',
    'experiments',
    'activeExperimentId',
    'activeExperiment',
    'market',
    'competitors',
    'activeCompetitorId',
    'activeCompetitor',
    'lastWendyAdvice',
    'timeline',
    'decisionState',
    'decisionReason',
    'decisionUpdatedAt',
    'decisionSuggested',
    'focus',
    'capabilities',
    'fields',
    'actions',
  ];
  const compact = preferredKeys.reduce<Record<string, unknown>>((acc, key) => {
    if (key in raw) acc[key] = raw[key];
    return acc;
  }, {});
  const json = JSON.stringify(compact);
  if (json.length <= maxChars) return compact;
  return {
    ...compact,
    experiments: Array.isArray(raw.experiments) ? raw.experiments.slice(0, 5) : raw.experiments,
    competitors: Array.isArray(raw.competitors) ? raw.competitors.slice(0, 8) : raw.competitors,
    timeline: Array.isArray(raw.timeline) ? raw.timeline.slice(0, 8) : raw.timeline,
    truncated: true,
    note: 'Contesto pagina compattato per limite payload.',
  };
}

export function buildCompressedHistory(
  rawHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingSummary?: string,
): CompressedHistory {
  const totalTurns = rawHistory.length;

  if (totalTurns <= COMPRESS_AFTER) {
    return { summary: existingSummary, recentMessages: rawHistory, totalTurns };
  }

  const recentMessages = rawHistory.slice(-KEEP_RAW_TURNS);
  const summary = existingSummary ?? buildFallbackSummary(rawHistory.slice(0, -KEEP_RAW_TURNS));

  return { summary, recentMessages, totalTurns };
}

function buildFallbackSummary(
  oldMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  if (oldMessages.length === 0) return '';
  const lines = oldMessages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => `- ${m.content.slice(0, 120)}`);
  return `[Riepilogo turni precedenti]\n${lines.join('\n')}`;
}
