import { logger } from "../logger";
import type {
  AICapability,
  AIPlugin,
  AIPluginEntry,
  AIPluginSnapshot,
} from "./types";

class AIPluginRegistry {
  private byCapability = new Map<AICapability, AIPluginEntry[]>();
  private byId = new Map<string, AIPluginEntry>();

  register(plugin: AIPlugin, options: { active?: boolean } = {}): void {
    if (this.byId.has(plugin.id)) {
      logger.warn({ id: plugin.id }, "[ai-plugin] re-registering, replacing existing");
      this.unregister(plugin.id);
    }
    const entry: AIPluginEntry = {
      plugin,
      registeredAt: new Date(),
      active: options.active ?? true,
    };
    this.byId.set(plugin.id, entry);
    const list = this.byCapability.get(plugin.capability) ?? [];
    list.push(entry);
    this.byCapability.set(plugin.capability, list);
    logger.info(
      { id: plugin.id, capability: plugin.capability, provider: plugin.provider, version: plugin.version },
      "[ai-plugin] registered",
    );
  }

  unregister(id: string): boolean {
    const entry = this.byId.get(id);
    if (!entry) return false;
    this.byId.delete(id);
    const list = this.byCapability.get(entry.plugin.capability);
    if (list) {
      const next = list.filter((e) => e.plugin.id !== id);
      if (next.length > 0) this.byCapability.set(entry.plugin.capability, next);
      else this.byCapability.delete(entry.plugin.capability);
    }
    return true;
  }

  setActive(id: string, active: boolean): boolean {
    const entry = this.byId.get(id);
    if (!entry) return false;
    entry.active = active;
    return true;
  }

  get(id: string): AIPlugin | undefined {
    return this.byId.get(id)?.plugin;
  }

  list(capability?: AICapability): AIPlugin[] {
    if (capability) {
      return (this.byCapability.get(capability) ?? []).map((e) => e.plugin);
    }
    return [...this.byId.values()].map((e) => e.plugin);
  }

  getBest(capability: AICapability): AIPlugin | undefined {
    const list = this.byCapability.get(capability);
    if (!list) return undefined;
    const active = list.find((e) => e.active);
    return active?.plugin;
  }

  snapshots(): AIPluginSnapshot[] {
    return [...this.byId.values()].map((e) => {
      const snapshot: AIPluginSnapshot = {
        id: e.plugin.id,
        capability: e.plugin.capability,
        version: e.plugin.version,
        provider: e.plugin.provider,
        active: e.active,
        registeredAt: e.registeredAt.toISOString(),
      };
      if (e.lastHealth) snapshot.lastHealth = e.lastHealth;
      if (e.lastHealthAt) snapshot.lastHealthAt = e.lastHealthAt.toISOString();
      return snapshot;
    });
  }

  async runHealthAll(): Promise<AIPluginSnapshot[]> {
    const entries = [...this.byId.values()];
    await Promise.all(
      entries.map(async (entry) => {
        const t0 = Date.now();
        try {
          const result = await entry.plugin.health();
          entry.lastHealth = {
            ok: result.ok,
            latencyMs: result.latencyMs ?? Date.now() - t0,
            ...(result.message ? { message: result.message } : {}),
          };
        } catch (err) {
          entry.lastHealth = {
            ok: false,
            latencyMs: Date.now() - t0,
            message: err instanceof Error ? err.message : String(err),
          };
        }
        entry.lastHealthAt = new Date();
      }),
    );
    return this.snapshots();
  }

  reset(): void {
    this.byId.clear();
    this.byCapability.clear();
  }
}

export const aiPlugins = new AIPluginRegistry();
export type { AIPluginRegistry };
