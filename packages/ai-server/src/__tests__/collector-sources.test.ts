import { describe, expect, it } from "vitest";
import { getCollectorSources } from "../discovery-agent/collector-sources";

describe("collector source selection", () => {
  it("limits fast lane to high-frequency sources", () => {
    const names = getCollectorSources({ priorityOnly: true }).map((source) => source.name);

    expect(names).toEqual(expect.arrayContaining(["hackernews", "newsapi", "gnews", "static_priority_rss", "dynamic_priority_sources"]));
    expect(names).not.toContain("reddit");
    expect(names).not.toContain("youtube_edu");
    expect(names).not.toContain("devto");
  });
});
