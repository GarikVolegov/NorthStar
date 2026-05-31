import { describe, expect, it } from "vitest";
import { classifyIntent } from "../wendy-router/intent-classifier";

describe("Wendy intent classifier", () => {
  it("keeps language preference and app purpose questions on the fast path", () => {
    expect(classifyIntent({ userMessage: "parlami in italiano" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "a cosa serve l'app" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "a cosa serve NorthStar?" })).toBe("simple_qa");
  });

  it("keeps combined greetings and small talk on the fast path", () => {
    expect(classifyIntent({ userMessage: "ciao, come stai?" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "ciao come va?" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "hey, tutto bene?" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "hello, how are you?" })).toBe("simple_qa");
  });

  it("keeps punctuation-only and punctuated social fragments on the fast path", () => {
    expect(classifyIntent({ userMessage: "hey!" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "ok!" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "!" })).toBe("simple_qa");
    expect(classifyIntent({ userMessage: "hey\n!" })).toBe("simple_qa");
  });
});
