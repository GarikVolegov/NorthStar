import { describe, expect, it } from "vitest";
import { classifyIntent } from "../wendy-router/intent-classifier";

describe("Wendy intent classifier", () => {
  it("keeps language preference and app purpose questions on the fast path", () => {
    expect(classifyIntent({ userMessage: "parlami in italiano" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "a cosa serve l'app" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "a cosa serve NorthStar?" })).toBe("simple_qa");
  });
});
