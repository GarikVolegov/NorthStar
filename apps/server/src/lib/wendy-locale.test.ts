import { describe, expect, it } from "vitest";
import { resolveWendyLocale } from "./wendy-locale";

describe("resolveWendyLocale", () => {
  it("prefers Italian for Italian greetings and explicit language requests", () => {
    expect(resolveWendyLocale("en", "ciao")).toBe("it");
    expect(resolveWendyLocale("en", "parlami in italiano")).toBe("it");
  });

  it("keeps the requested locale for non-Italian messages", () => {
    expect(resolveWendyLocale("en", "hello, how are you?")).toBe("en");
  });
});
