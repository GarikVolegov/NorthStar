import type { JourneyType } from "@/components/profile/profile-sections";

export interface SkillBridgeProfession {
  id: number;
  title: string;
  sector: string;
  salaryRange: string;
  workModes: string[];
  overlapSkills: string[];
  missingSkills: string[];
  ring: 1 | 2 | 3;
  overlapPercent: number;
  learnTimeWeeks?: number;
}

export interface SkillBridgeResponse {
  center: {
    userId: number;
    skills: string[];
  };
  professions: SkillBridgeProfession[];
  filtersApplied: {
    sectorId?: number;
    minSalary?: number;
    workMode?: string;
    city?: string;
  };
}

export interface SkillBridgeFiltersState {
  sectorId: string;
  minSalary: string;
  workMode: string;
  city: string;
}

export type SkillBridgeLens = Exclude<JourneyType, "investitore">;

