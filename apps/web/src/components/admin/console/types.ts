// Barrel for admin console types. Definitions live in ./types/* grouped by
// domain (common, agents, prompts, overview, subscriptions, inbox, quality).
// Re-exported here so existing `import { ... } from ".../console/types"` keep working.
export * from "./types/common";
export * from "./types/agents";
export * from "./types/prompts";
export * from "./types/overview";
export * from "./types/subscriptions";
export * from "./types/inbox";
export * from "./types/quality";
