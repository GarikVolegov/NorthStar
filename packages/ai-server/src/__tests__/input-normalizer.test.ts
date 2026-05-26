import { describe, expect, it } from "vitest";
import { normalizeInput } from "../growth-agent/input-normalizer";

describe("normalizeInput", () => {
  it("fixes common Italian typos without changing intent", () => {
    expect(normalizeInput("come stqi con la cariera?")).toBe("come stai con la carriera?");
    expect(normalizeInput("mi serve un consigil sul lavorro")).toBe("mi serve un consiglio sul lavoro");
  });

  it("preserves unrelated text", () => {
    expect(normalizeInput("voglio cambiare settore")).toBe("voglio cambiare settore");
  });
});
