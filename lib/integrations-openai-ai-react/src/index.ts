// Audio utilities (pre-existing)
export * from "./audio";

// Growth Coach Chat
export { useGrowthChat }      from "./growth-agent/useGrowthChat";
export type { ChatMessage, UseGrowthChatOptions } from "./growth-agent/useGrowthChat";
export { GrowthChatMessage }  from "./growth-agent/GrowthChatMessage";
export { GrowthChatInput }    from "./growth-agent/GrowthChatInput";
export { GrowthChatPanel }    from "./growth-agent/GrowthChatPanel";

// Growth Coach Memory
export { useGrowthMemory }    from "./growth-agent/useGrowthMemory";
export type { MemoryFact, MemoryPattern, UseGrowthMemoryOptions } from "./growth-agent/useGrowthMemory";
export { GrowthMemoryPanel }  from "./growth-agent/GrowthMemoryPanel";

// Growth Coach Analytics
export { useGrowthAnalytics }       from "./growth-agent/useGrowthAnalytics";
export type { AnalyticsData, TopicEntry, TrendEntry, LevelBreakdown, UseGrowthAnalyticsOptions } from "./growth-agent/useGrowthAnalytics";
export { GrowthAnalyticsDashboard } from "./growth-agent/GrowthAnalyticsDashboard";
