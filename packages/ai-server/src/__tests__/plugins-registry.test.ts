import { describe, it, expect, beforeEach } from "vitest";
import { aiPlugins } from "../plugins/registry";
import type { AIPlugin, AIPluginHealth } from "../plugins/types";

function makePlugin(overrides: Partial<AIPlugin> & Pick<AIPlugin, "id" | "capability">): AIPlugin {
  return {
    version: "1.0.0",
    provider: "fake",
    init: async () => {},
    health: async (): Promise<AIPluginHealth> => ({ ok: true, latencyMs: 1 }),
    execute: async (input: unknown) => input,
    ...overrides,
  } as AIPlugin;
}

describe("AIPluginRegistry", () => {
  beforeEach(() => {
    aiPlugins.reset();
  });

  it("registers and retrieves a plugin by id", () => {
    const p = makePlugin({ id: "fake-reasoning-1", capability: "reasoning" });
    aiPlugins.register(p);
    expect(aiPlugins.get("fake-reasoning-1")).toBe(p);
  });

  it("lists plugins by capability", () => {
    aiPlugins.register(makePlugin({ id: "r-1", capability: "reasoning" }));
    aiPlugins.register(makePlugin({ id: "r-2", capability: "reasoning" }));
    aiPlugins.register(makePlugin({ id: "m-1", capability: "memory" }));
    expect(aiPlugins.list("reasoning")).toHaveLength(2);
    expect(aiPlugins.list("memory")).toHaveLength(1);
    expect(aiPlugins.list()).toHaveLength(3);
  });

  it("getBest returns the first active plugin for a capability", () => {
    const first = makePlugin({ id: "v-1", capability: "voice" });
    const second = makePlugin({ id: "v-2", capability: "voice" });
    aiPlugins.register(first);
    aiPlugins.register(second);
    expect(aiPlugins.getBest("voice")).toBe(first);
    aiPlugins.setActive("v-1", false);
    expect(aiPlugins.getBest("voice")).toBe(second);
  });

  it("unregister removes the plugin from id and capability indexes", () => {
    aiPlugins.register(makePlugin({ id: "e-1", capability: "embedding" }));
    expect(aiPlugins.unregister("e-1")).toBe(true);
    expect(aiPlugins.get("e-1")).toBeUndefined();
    expect(aiPlugins.list("embedding")).toHaveLength(0);
    expect(aiPlugins.unregister("e-1")).toBe(false);
  });

  it("re-registering an id replaces the existing entry", () => {
    const first = makePlugin({ id: "x-1", capability: "vision", version: "1.0.0" });
    const second = makePlugin({ id: "x-1", capability: "vision", version: "2.0.0" });
    aiPlugins.register(first);
    aiPlugins.register(second);
    expect(aiPlugins.get("x-1")?.version).toBe("2.0.0");
    expect(aiPlugins.list("vision")).toHaveLength(1);
  });

  it("runHealthAll captures result and propagates errors as ok=false", async () => {
    aiPlugins.register(
      makePlugin({
        id: "ok-plugin",
        capability: "reasoning",
        health: async () => ({ ok: true, latencyMs: 5, message: "fine" }),
      }),
    );
    aiPlugins.register(
      makePlugin({
        id: "bad-plugin",
        capability: "memory",
        health: async () => {
          throw new Error("boom");
        },
      }),
    );

    const snapshots = await aiPlugins.runHealthAll();
    const ok = snapshots.find((s) => s.id === "ok-plugin");
    const bad = snapshots.find((s) => s.id === "bad-plugin");

    expect(ok?.lastHealth?.ok).toBe(true);
    expect(ok?.lastHealth?.message).toBe("fine");
    expect(bad?.lastHealth?.ok).toBe(false);
    expect(bad?.lastHealth?.message).toBe("boom");
  });

  it("snapshots() exposes plugin metadata without leaking the executor", () => {
    aiPlugins.register(
      makePlugin({ id: "snap-1", capability: "reasoning", provider: "openai", version: "1.2.3" }),
    );
    const [snap] = aiPlugins.snapshots();
    expect(snap).toMatchObject({
      id: "snap-1",
      capability: "reasoning",
      provider: "openai",
      version: "1.2.3",
      active: true,
    });
    expect(snap?.registeredAt).toMatch(/T/);
  });
});
