import { describe, expect, it } from "vitest";
import { computeVitalSigns } from "./sector-vitals.service";
import type { SectorVitalsRepository } from "./types";

const months = [
  "2025-06",
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
];

function createRepository(): SectorVitalsRepository {
  return {
    async getSectorName() {
      return "Tecnologia";
    },
    async getJobPostingMonthlyCounts() {
      return months.map((period, index) => ({ period, count: 100 + index * 10 }));
    },
    async getDistinctRoleTitleMonthlyCounts() {
      return months.map((period, index) => ({ period, count: 5 + index }));
    },
    async getNewJobTitleSignalCounts() {
      return months.map((period, index) => ({ period, count: index % 2 }));
    },
    async getContentMonthlyCounts() {
      return months.map((period, index) => ({ period, count: 2 + index }));
    },
    async getRoleCompetitionMonthlyCounts() {
      return months.map((period, index) => ({ period, count: 4 + index }));
    },
    async getAdrenalineMonthlyStrength() {
      return months.map((period, index) => ({
        period,
        averageStrength: index < 6 ? 0.2 : 0.7,
        count: index < 6 ? 0 : 2,
      }));
    },
  };
}

describe("computeVitalSigns", () => {
  it("returns five vital signs with chronological 12-month sparklines", async () => {
    const vitals = await computeVitalSigns(7, "IT", {
      now: new Date("2026-05-28T10:00:00.000Z"),
      repository: createRepository(),
      cache: false,
    });

    expect(vitals).toMatchObject({
      sectorId: 7,
      geography: "IT",
    });
    expect(Object.keys(vitals.signs).sort()).toEqual([
      "adrenaline",
      "oxygen",
      "pressure",
      "pulse",
      "temperature",
    ]);

    for (const sign of Object.values(vitals.signs)) {
      expect(sign.sparkline).toHaveLength(12);
      expect(sign.status).toMatch(/^(green|yellow|red)$/);
      expect(typeof sign.delta).toBe("number");
      expect(sign.source.length).toBeGreaterThan(0);
    }
    expect(vitals.signs.pulse.sparkline[0]).toBe(100);
    expect(vitals.signs.pulse.sparkline[11]).toBe(210);
  });

  it("labels pressure as role competition when employer data is unavailable", async () => {
    const vitals = await computeVitalSigns(7, "IT", {
      now: new Date("2026-05-28T10:00:00.000Z"),
      repository: createRepository(),
      cache: false,
    });

    expect(vitals.signs.pressure.source).toBe("job_posting_snapshots:role_competition_proxy");
  });
});
