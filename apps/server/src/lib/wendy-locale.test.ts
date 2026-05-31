import { describe, expect, it } from "vitest";
import { resolveWendyLocale } from "./wendy-locale";

describe("resolveWendyLocale", () => {
  it("prefers Italian for Italian greetings and explicit language requests", () => {
    expect(resolveWendyLocale("en", "ciao")).toBe("it");
    expect(resolveWendyLocale("en", "parlami in italiano")).toBe("it");
    expect(resolveWendyLocale("en", "come funziona?")).toBe("it");
  });

  it("prefers Italian for Wendy quick actions written in Italian", () => {
    expect(resolveWendyLocale("en", "Cosa dovrei fare oggi?")).toBe("it");
    expect(resolveWendyLocale("en", "Analizza il mio profilo e dimmi la prossima mossa")).toBe("it");
    expect(resolveWendyLocale("en", "Quali settori sono piu adatti a me?")).toBe("it");
  });

  it("keeps the requested locale for non-Italian messages", () => {
    expect(resolveWendyLocale("en", "hello, how are you?")).toBe("en");
    expect(resolveWendyLocale("en", "how does this app work?")).toBe("en");
  });
});
