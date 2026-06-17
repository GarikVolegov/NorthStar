export type DiaryMood = "ottimo" | "bene" | "neutro" | "difficile" | "critico";
export type DiaryImportance = "bassa" | "media" | "alta";
export type InvestorOutcome = "opportunita" | "rischio" | "neutro";

export interface DiaryEntry {
  id: number;
  userId: number;
  content: string;
  mood: DiaryMood | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DiaryIdea {
  id: number;
  userId: number;
  content: string;
  importance: DiaryImportance;
  dueDate: string | null;
  emoji: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorAnalysis {
  id: number;
  userId: number;
  sectorId: number | null;
  sectorName: string;
  outcome: InvestorOutcome;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sectorGrowthRate?: number | null;
  sectorTrend?: string | null;
  sectorAutomationRisk?: string | null;
}

export interface DiaryRecapPayload {
  period: "week" | "month";
  entriesCount: number;
  ideasCount: number;
  completedIdeasCount: number;
  analysesCount: number;
  moodCounts: Record<DiaryMood, number>;
  topTags: Array<{ tag: string; count: number }>;
  latestEntries: Array<Pick<DiaryEntry, "id" | "content" | "mood" | "tags" | "createdAt">>;
}
