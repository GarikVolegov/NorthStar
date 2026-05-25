import { describe, expect, it } from "vitest";

import { buildWendyContextSources } from "./ai-wendy-shared";

describe("buildWendyContextSources", () => {
  it("normalizes personal, RAG, and app-data provenance without duplicates", () => {
    expect(
      buildWendyContextSources({
        personalSources: ["openhuman", "graphify", "semantic-memory"],
        toolsUsed: ["search_rag", "list_sectors", "search_rag"],
        ragChunksRetrieved: 2,
      }),
    ).toEqual(["openhuman", "graphify", "semantic-memory", "rag", "app-data"]);
  });
});
