import type { ReactNode } from "react";

export type CatalogTab =
  | "sectors"
  | "professions"
  | "education-paths"
  | "growth-articles";

export type CatalogResource<T> = {
  data: T[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export interface Sector {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  automationRisk: string;
  trend: string;
  growthRate: number;
  avgSalaryMin: number;
  avgSalaryMax: number;
}

export interface Profession {
  id: number;
  title: string;
  sector: string;
  description?: string;
  salaryRange: string;
  growthOutlook: string;
  isActive: boolean;
}

export interface EducationPath {
  id: number;
  path: string;
  type: string;
  duration: string;
  cost: string;
  steps: string[];
  careerOutcomes: string[];
  sectorFit: string[];
  isActive: boolean;
}

export interface GrowthArticle {
  id: number;
  title: string;
  category: string;
  description: string;
  difficulty: string;
  status: string;
  readTimeMinutes: number;
}

export type CatalogTabConfig = {
  id: CatalogTab;
  label: string;
  icon: ReactNode;
};
