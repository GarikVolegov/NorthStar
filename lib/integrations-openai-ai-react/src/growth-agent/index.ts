/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → AI_RULES.md       (policy AI, prompt, costi, sicurezza)
 *   → FRONTEND_RULES.md (componenti React, pattern hooks)
 *
 * Public API del pacchetto growth-agent.
 *
 * Esporta SOLO ciò che il frontend (apps/web) deve importare.
 * I componenti interni (WendyToast, WendyPageContext, ecc.) rimangono
 * privati e si importano direttamente dal loro path se necessario.
 *
 * USO dal frontend:
 *   import { GrowthChatPanel } from "../../lib/growth-agent";
 *   import { useGrowthChat }   from "../../lib/growth-agent";
 */

// ── Componenti pubblici ────────────────────────────────────────────────────
export { GrowthChatPanel }         from "./GrowthChatPanel";
export { GrowthAnalyticsDashboard } from "./GrowthAnalyticsDashboard";
export { GrowthMemoryPanel }       from "./GrowthMemoryPanel";
export { GrowthProfilePage }       from "./GrowthProfilePage";
export { ProgressPanel }           from "./ProgressPanel";
export { PublicProfilePage }       from "./PublicProfilePage";
export { RiasecProfileCard }       from "./RiasecProfileCard";
export { AffiliateDashboard }      from "./AffiliateDashboard";
export { ParallelStatusPanel }     from "./ParallelStatusPanel";
export { ProfileEditPanel }        from "./ProfileEditPanel";
export { WendyOnboardingOverlay }  from "./WendyOnboardingOverlay";
export { WendyUIRenderer }         from "./WendyUIRenderer";

// ── Hook pubblici ─────────────────────────────────────────────────────────
export { useGrowthChat }           from "./useGrowthChat";
export { useGrowthAnalytics }      from "./useGrowthAnalytics";
export { useGrowthMemory }         from "./useGrowthMemory";
export { useWendyOnboarding }      from "./useWendyOnboarding";
export { useWendyVoiceSession }    from "./useWendyVoiceSession";
export { usePageContextSnapshot }  from "./usePageContextSnapshot";

// ── Tipi pubblici ─────────────────────────────────────────────────────────
export type { GrowthChatPanelProps } from "./GrowthChatPanel";
export type { ChatMessage }          from "./useGrowthChat";
