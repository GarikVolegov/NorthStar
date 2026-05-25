import type React from "react";

export type TrendingSector = {
  id: number;
  name: string;
  icon: string;
  description: string;
  trend: string;
  growthRate: number;
  automationRisk: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  riasecTypes: string[];
  weeklyPicks: number;
  totalPicks: number;
};
export type HomeNewsItem = {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  sourceUrl?: string;
  detailUrl?: string;
  publishedAt: string;
  image: string | null;
  category: string;
  tags: string[];
};
export type LatestRec = {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  matchReason: string;
};
export type LatestResult = {
  sessionId: number;
  workPreference: string;
  recommendations: LatestRec[];
  confirmedSectorId: number | null;
};

export type JourneyId =
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

export interface Persona {
  id: JourneyId;
  icon: React.ElementType;
  label: string;
  tagline: string;
  ctaLabel: string;
  ctaHref: string;
  tools: string[];
  accentClass: string;
  borderClass: string;
}
