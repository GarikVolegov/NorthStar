export const XP_PER_LEVEL = 200;

export const XP_REWARDS = {
  VOICE_SESSION: 50,
  CHAT_MESSAGE: 5,
  DAILY_LOGIN: 10,
  OBJECTIVE_COMPLETED: 100,
  ASSESSMENT_COMPLETED: 30,
  BADGE_UNLOCKED: 100,
} as const;

export const DAILY_LIMITS = {
  VOICE_SESSIONS: 3,
  CHAT_MESSAGES: 10,
} as const;

export const LEVEL_UNLOCKS = [
  { level: 0,  feature: "chat",                label: "Chat con Wendy" },
  { level: 1,  feature: "voice_sessions",      label: "Sessioni vocali" },
  { level: 2,  feature: "knowledge_graph",     label: "Grafo conoscenze" },
  { level: 3,  feature: "objectives",          label: "Obiettivi personali" },
  { level: 5,  feature: "wiki",                label: "Wiki settoriale" },
  { level: 7,  feature: "interview",           label: "Simulazione colloqui" },
  { level: 10, feature: "mentorship",          label: "Mentorship (chat con utenti)" },
  { level: 15, feature: "custom_badges",       label: "Badge personalizzati" },
] as const;

export function computeLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL);
}

export function xpProgress(totalXp: number): { level: number; current: number; next: number; progress: number } {
  const level = computeLevel(totalXp);
  const current = totalXp % XP_PER_LEVEL;
  return { level, current, next: XP_PER_LEVEL, progress: Math.round((current / XP_PER_LEVEL) * 100) };
}

export function getUnlockedFeatures(totalXp: number): string[] {
  const level = computeLevel(totalXp);
  return LEVEL_UNLOCKS.filter((u) => level >= u.level).map((u) => u.feature);
}

export function getNextUnlock(totalXp: number): { feature: string; label: string; level: number } | null {
  const level = computeLevel(totalXp);
  const next = LEVEL_UNLOCKS.find((u) => level < u.level);
  return next ? { feature: next.feature, label: next.label, level: next.level } : null;
}
