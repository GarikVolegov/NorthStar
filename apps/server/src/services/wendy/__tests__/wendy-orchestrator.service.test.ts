import { describe, expect, it, vi } from "vitest";
import { createWendyOrchestrator } from "../wendy-orchestrator.service";

async function collect(generator: AsyncGenerator<string>) {
  const values: string[] = [];
  for await (const value of generator) values.push(value);
  return values;
}

describe("wendy-orchestrator.service", () => {
  it("streams model tokens", async () => {
    const model = {
      stream: vi.fn(async function* () {
        yield "ciao";
      }),
    };
    const tokens = await collect(createWendyOrchestrator(model).run({ userId: 1, message: " hey " }));
    expect(tokens).toEqual(["ciao"]);
    expect(model.stream).toHaveBeenCalledWith(expect.objectContaining({ message: "hey" }));
  });

  it("rejects invalid input", async () => {
    const model = {
      stream: vi.fn(async function* () {
        yield "unused";
      }),
    };
    await expect(collect(createWendyOrchestrator(model).run({ userId: 0, message: "x" }))).rejects.toThrow("Invalid userId");
  });

  it("propagates model failures", async () => {
    const model = {
      stream: vi.fn(async function* () {
        yield "before-error";
        throw new Error("model down");
      }),
    };
    await expect(collect(createWendyOrchestrator(model).run({ userId: 1, message: "x" }))).rejects.toThrow("model down");
  });
});
