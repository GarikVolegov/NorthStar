export const VITAL_KEYS = ["pulse", "oxygen", "temperature", "pressure", "adrenaline"] as const;

export type VitalKey = typeof VITAL_KEYS[number];
export type VitalStatus = "green" | "yellow" | "red";

export interface VitalSign {
  key: VitalKey;
  value: number;
  status: VitalStatus;
  sparkline: number[];
  delta: number;
  source: string;
}

export interface VitalSigns {
  sectorId: number;
  computedAt: string;
  geography: string;
  signs: Record<VitalKey, VitalSign>;
  summary?: string;
}

export interface MonthlyCountRow {
  period: string;
  count: number;
}

export interface MonthlyStrengthRow {
  period: string;
  averageStrength: number;
  count: number;
}

export interface SectorVitalsRepository {
  getSectorName(sectorId: number): Promise<string | null>;
  getJobPostingMonthlyCounts(args: SectorVitalsQueryArgs): Promise<MonthlyCountRow[]>;
  getDistinctRoleTitleMonthlyCounts(args: SectorVitalsQueryArgs): Promise<MonthlyCountRow[]>;
  getNewJobTitleSignalCounts(args: SectorVitalsQueryArgs): Promise<MonthlyCountRow[]>;
  getContentMonthlyCounts(args: SectorVitalsQueryArgs & { sectorName: string | null }): Promise<MonthlyCountRow[]>;
  getRoleCompetitionMonthlyCounts(args: SectorVitalsQueryArgs): Promise<MonthlyCountRow[]>;
  getAdrenalineMonthlyStrength(args: SectorVitalsQueryArgs): Promise<MonthlyStrengthRow[]>;
}

export interface SectorVitalsQueryArgs {
  sectorId: number;
  geography: string;
  periods: string[];
}

export interface ComputeVitalSignsOptions {
  now?: Date;
  repository?: SectorVitalsRepository;
  cache?: boolean;
}
