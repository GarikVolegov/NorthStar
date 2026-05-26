import { describe, expect, it } from "vitest";
import {
  buildJobSnapshotRows,
  extractSkillsFromText,
  parseAdzunaJobs,
} from "../discovery-agent/job-postings-agent";

describe("job-postings-agent", () => {
  it("extracts known skill signals from posting text", () => {
    expect(extractSkillsFromText("Cerchiamo profilo React, TypeScript, SQL e machine learning.")).toEqual([
      "typescript",
      "react",
      "sql",
      "machine learning",
    ]);
  });

  it("parses Adzuna result payloads into counts, salaries and skill hits", () => {
    const aggregate = parseAdzunaJobs({
      count: 42,
      results: [
        { description: "Python SQL cloud", salary_min: 32000, salary_max: 46000 },
        { description: "Python data analysis", salary_min: 36000, salary_max: 52000 },
      ],
    });

    expect(aggregate).toMatchObject({
      count: 42,
      avgSalaryMin: 34000,
      avgSalaryMax: 49000,
      topSkills: ["python", "sql", "cloud", "data analysis"],
    });
  });

  it("builds monthly upsert rows with growth rate against prior snapshots", () => {
    const rows = buildJobSnapshotRows(
      {
        id: 12,
        title: "Data Analyst",
        sectorId: 7,
        skills: ["SQL", "Python"],
      },
      "2026-05",
      "IT",
      [
        { source: "adzuna", count: 42, topSkills: ["python", "sql"], avgSalaryMin: 34000, avgSalaryMax: 49000 },
        { source: "jooble", count: 18, topSkills: ["excel"], avgSalaryMin: null, avgSalaryMax: null },
      ],
      [
        { roleTitle: "data analyst", source: "adzuna", count: 35 },
        { roleTitle: "data analyst", source: "jooble", count: 20 },
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        roleTitle: "data analyst",
        professionId: 12,
        sectorId: 7,
        count: 42,
        period: "2026-05",
        geography: "IT",
        source: "adzuna",
        growthRate: 0.2,
      }),
      expect.objectContaining({
        count: 18,
        source: "jooble",
        growthRate: -0.1,
      }),
    ]);
  });
});
