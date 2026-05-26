import { describe, expect, it } from "vitest";
import { computeCorroboration } from "../discovery-agent/news-verifier";

describe("news verifier", () => {
  it("counts distinct collector sources for matching stories", () => {
    const result = computeCorroboration([
      {
        urlHash: "ansa-ai",
        title: "Intelligenza artificiale cambia il mercato del lavoro italiano",
        collectorSource: "ansa_rss",
      },
      {
        urlHash: "sole-ai",
        title: "Mercato del lavoro italiano, come cambia con intelligenza artificiale",
        collectorSource: "sole24ore_rss",
      },
      {
        urlHash: "gnews-ai",
        title: "Intelligenza artificiale e lavoro italiano: nuovi scenari",
        collectorSource: "gnews",
      },
      {
        urlHash: "wired-cloud",
        title: "Cloud europeo e cybersecurity crescono nelle imprese",
        collectorSource: "wired_it_rss",
      },
    ]);

    expect(result.get("ansa-ai")).toBe(3);
    expect(result.get("sole-ai")).toBe(3);
    expect(result.get("gnews-ai")).toBe(3);
    expect(result.get("wired-cloud")).toBe(1);
  });

  it("does not double count duplicate items from the same collector source", () => {
    const result = computeCorroboration([
      {
        urlHash: "gnews-1",
        title: "Startup italiana raccoglie finanziamento per intelligenza artificiale",
        collectorSource: "gnews",
      },
      {
        urlHash: "gnews-2",
        title: "Finanziamento per startup italiana di intelligenza artificiale",
        collectorSource: "gnews",
      },
    ]);

    expect(result.get("gnews-1")).toBe(1);
    expect(result.get("gnews-2")).toBe(1);
  });
});
