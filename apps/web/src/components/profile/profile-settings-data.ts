export type CompletionData = {
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
  hasWorkPreference: boolean;
  hasCv: boolean;
  isPublic: boolean;
  streakDays: number;
  totalObjectives: number;
  completedObjectives: number;
} | null;

export const BADGE_DEFS: Array<{
  id: string;
  emoji: string;
  label: string;
  check: (data: NonNullable<CompletionData>) => boolean;
}> = [
  { id: "test",        emoji: "🧠", label: "Primo test",        check: (data) => data.hasTestSession },
  { id: "sector",      emoji: "🎯", label: "Settore scelto",    check: (data) => data.hasConfirmedSector },
  { id: "cv",          emoji: "📄", label: "CV caricato",       check: (data) => data.hasCv },
  { id: "shared",      emoji: "🌐", label: "Profilo pubblico",  check: (data) => data.isPublic },
  { id: "objectives",  emoji: "🏆", label: "5 obiettivi fatti", check: (data) => data.completedObjectives >= 5 },
  { id: "streak",      emoji: "🔥", label: "Streak 3 giorni",   check: (data) => data.streakDays >= 3 },
];

export const WENDY_TONES: Array<{ value: string; label: string; description: string }> = [
  { value: "auto",     label: "Automatico",  description: "Wendy adatta il tono al contesto" },
  { value: "concise",  label: "Conciso",     description: "Risposte brevi e dirette" },
  { value: "detailed", label: "Dettagliato", description: "Spiegazioni approfondite" },
  { value: "formal",   label: "Formale",     description: "Tono professionale e strutturato" },
  { value: "casual",   label: "Informale",   description: "Conversazione rilassata" },
];
