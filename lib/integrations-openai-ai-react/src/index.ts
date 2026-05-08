// growth-agent — UI components
export { GrowthChatPanel }          from "./growth-agent/GrowthChatPanel";
export { GrowthChatInput }          from "./growth-agent/GrowthChatInput";
export { GrowthChatMessage }        from "./growth-agent/GrowthChatMessage";
export { GrowthMemoryPanel }        from "./growth-agent/GrowthMemoryPanel";
export { GrowthProfilePage }        from "./growth-agent/GrowthProfilePage";
export { GrowthAnalyticsDashboard } from "./growth-agent/GrowthAnalyticsDashboard";
export { ParallelStatusPanel }      from "./growth-agent/ParallelStatusPanel";

// Visual feedback
export { WendyTypingIndicator }     from "./growth-agent/WendyTypingIndicator";
export { WendyThinkingStatus }      from "./growth-agent/WendyThinkingStatus";
export { WendyToast }               from "./growth-agent/WendyToast";
export { useWendyToast }            from "./growth-agent/useWendyToast";

// Contextual copilot (Point 5)
export { WendyPageContextProvider,
         useWendyPageContext }       from "./growth-agent/WendyPageContext";
export { WendyContextButton }       from "./growth-agent/WendyContextButton";
export { usePageContextSnapshot }   from "./growth-agent/usePageContextSnapshot";

// Generative UI (Point 8)
export { WendyUIRenderer }          from "./growth-agent/WendyUIRenderer";

// hooks
export { useGrowthChat }            from "./growth-agent/useGrowthChat";
export { useGrowthMemory }          from "./growth-agent/useGrowthMemory";
export { useGrowthAnalytics }       from "./growth-agent/useGrowthAnalytics";
export { useWendyVoiceSession }     from "./growth-agent/useWendyVoiceSession";

// audio
export { useVoiceStream }           from "./audio/useVoiceStream";

// discovery
export { DiscoveryWizard }          from "./discovery/DiscoveryWizard";

// admin
export { AdminPanel }               from "./admin/AdminPanel";
