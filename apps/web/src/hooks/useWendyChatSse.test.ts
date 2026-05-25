import { describe, expect, it } from "vitest";

import { parseWendySseEvent } from "./useWendyChatSse";

describe("parseWendySseEvent", () => {
  it("parses done context sources and drops unknown providers", () => {
    expect(
      parseWendySseEvent(
        JSON.stringify({
          type: "done",
          requestId: "req-1",
          contextSources: ["rag", "openhuman", "graphify", "unknown"],
        }),
      ),
    ).toEqual({
      type: "done",
      requestId: "req-1",
      contextSources: ["rag", "openhuman", "graphify"],
    });
  });
});
