/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → AI_RULES.md       (policy AI, prompt, costi, sicurezza)
 *   → FRONTEND_RULES.md (componenti React, pattern hooks)
 *
 * Public API del pacchetto growth-agent.
 *
 * Regola fondamentale:
 *   Esporta SOLO ciò che il frontend (apps/web) deve importare.
 *   I componenti interni rimangono privati e non compaiono qui.
 *
 * Componenti privati (NON esportare mai):
 *   - WendyContextButton, WendyPageContext
 *   - WendyThinkingStatus, WendyTypingIndicator, WendyToast
 *   - GrowthChatInput, GrowthChatMessage
 *   - AffiliateDashboardInner, AccessDenied
 *
 * USO dal frontend (apps/web/src/lib/growth-agent.ts fa re-export di tutto):
 *
 *   // Componenti
 *   import { GrowthChatPanel }          from "../lib/growth-agent";
 *   import { AffiliateDashboard }        from "../lib/growth-agent";
 *   import { GrowthAnalyticsDashboard }  from "../lib/growth-agent";
 *   import { WendyOnboardingOverlay }    from "../lib/growth-agent";
 *
 *   // Hook
 *   import { useGrowthChat }             from "../lib/growth-agent";
 *   import { useAffiliateDashboard }     from "../lib/growth-agent";
 *   import { useWendyOnboarding }        from "../lib/growth-agent";
 *
 *   // Tipi
 *   import type { GrowthChatPanelProps } from "../lib/growth-agent";
 *   import type { AffiliateDashboardProps, DashboardData, AccountData } from "../lib/growth-agent";
 *   import type { ChatMessage }          from "../lib/growth-agent";
 */

// ── Componenti pubblici ───────────────────────────────────────────────────────────
// Chat + Wendy
export { GrowthChatPanel }          from "./GrowthChatPanel";
export { WendyOnboardingOverlay }   from "./WendyOnboardingOverlay";
export { WendyUIRenderer }          from "./WendyUIRenderer";

// Dashboard e profilo
export { GrowthAnalyticsDashboard } from "./GrowthAnalyticsDashboard";
export { GrowthMemoryPanel }        from "./GrowthMemoryPanel";
export { GrowthProfilePage }        from "./GrowthProfilePage";
export { ProgressPanel }            from "./ProgressPanel";
export { PublicProfilePage }        from "./PublicProfilePage";
export { RiasecProfileCard }        from "./RiasecProfileCard";
export { ParallelStatusPanel }      from "./ParallelStatusPanel";
export { ProfileEditPanel }         from "./ProfileEditPanel";

// Affiliazione
export { AffiliateDashboard }       from "./AffiliateDashboard";

// ── Hook pubblici ───────────────────────────────────────────────────────────────
// Chat + Wendy
export { useGrowthChat }            from "./useGrowthChat";
export { useWendyOnboarding }       from "./useWendyOnboarding";
export { useWendyVoiceSession }     from "./useWendyVoiceSession";
export { usePageContextSnapshot }   from "./usePageContextSnapshot";

// Analytics e memoria
export { useGrowthAnalytics }       from "./useGrowthAnalytics";
export { useGrowthMemory }          from "./useGrowthMemory";

// Affiliazione (Step 3: aggiunto, era export nel file ma mancava qui)
export { useAffiliateDashboard }    from "./AffiliateDashboard";

// ── Tipi pubblici ───────────────────────────────────────────────────────────────
// Chat
export type { GrowthChatPanelProps }  from "./GrowthChatPanel";
export type { ChatMessage }           from "./useGrowthChat";

// Affiliazione (Step 3: aggiunto, tipi necessari per chi usa useAffiliateDashboard)
export type {
  AffiliateDashboardProps,
  DashboardData,
  AccountData,
  ReferralRow,
  WithdrawalRow,
}                                     from "./AffiliateDashboard";
