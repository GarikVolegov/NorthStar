import type { Sector as SectorBase } from "@workspace/api-client-react";

export interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

export interface CareerStep {
  step: number;
  title: string;
  description: string;
}

export type SectorExtended = SectorBase & {
  workMode?: Array<"dipendente" | "autonomo" | "ibrido">;
  dipendentiSteps?: CareerStep[];
  freelanceSteps?: CareerStep[];
};
