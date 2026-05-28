import { describe, expect, it } from "vitest";
import { aggregateUserSkillsFromSources, normalizeSkillLabel } from "./user-skills-aggregator";

describe("user skill aggregation", () => {
  it("normalizes labels without losing readable casing", () => {
    expect(normalizeSkillLabel("  react   native  ")).toBe("react native");
    expect(normalizeSkillLabel("")).toBeNull();
  });

  it("unions certification, CV and LinkedIn skills sorted by source frequency", () => {
    const skills = aggregateUserSkillsFromSources({
      certificationSkills: [
        ["React", "SQL"],
        ["react", "Python"],
      ],
      cvJson: {
        skills: ["SQL", "Product analytics"],
        experiences: [{ skills: ["React", "Node.js"] }],
        education: [{ skills: ["Statistics"] }],
      },
      linkedinExtractedData: [
        { skills: ["python", "Leadership"] },
      ],
    });

    expect(skills[0]).toBe("React");
    expect(new Set(skills.slice(1, 3))).toEqual(new Set(["Python", "SQL"]));
    expect(skills).toContain("Product analytics");
    expect(skills).toContain("Node.js");
    expect(skills).toContain("Statistics");
    expect(skills.filter((skill) => skill.toLowerCase() === "react")).toHaveLength(1);
  });
});
