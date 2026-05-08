/**
 * GrowthChatPanel v2 — Passo 6: integrazione Wendy onboarding.
 *
 * CHANGES vs v1:
 * - Importa useWendyOnboarding e WendyOnboardingOverlay
 * - Se needsOnboarding = true, mostra l’overlay invece della chat
 * - Quando l’overlay completa, chiama startOnboarding() che streamma il
 *   primo messaggio Wendy e lo inietta nei messages via injectMessage()
 * - injectMessage(): callback che aggiunge o aggiorna un ChatMessage
 *   nello state (usato dall’hook per update incrementali in streaming)
 * - skipOnboarding() porta direttamente alla chat vuota
 * - Se statusChecked = false, mostra spinner (evita flash dell’overlay)
 *
 * Tutto il resto (SSE chat, scroll, eval badges) invariato rispetto v1.
 */
import React, { useRef, useEffect, useCallback, useState } from "react";
import { useGrowthChat, type ChatMessage }     from "./useGrowthChat";
import { GrowthChatMessage }                    from "./GrowthChatMessage";
import { GrowthChatInput }                      from "./GrowthChatInput";
import { WendyThinkingStatus }                  from "./WendyThinkingStatus";
import { WendyTypingIndicator }                 from "./WendyTypingIndicator";
import { WendyOnboardingOverlay }               from "./WendyOnboardingOverlay";
import { useWendyOnboarding }                   from "./useWendyOnboarding";

interface UserContext {
  name?:        string;
  journeyType?: string;
  userMode?:    string;
  objectives?:  string[];
  sectorName?:  string;
}

export interface GrowthChatPanelProps {
  token:        string;
  apiBase?:     string;
  userContext?: UserContext;
  className?:   string;
}

export function GrowthChatPanel({
  token, apiBase = "/api", userContext = {}, className = "",
}: GrowthChatPanelProps) {

  // ─ Core chat hook ───────────────────────────────────────────────────
  const chat = useGrowthChat({ token, apiBase, userContext });

  // ─ Inject message: aggiunge o aggiorna per ID ─────────────────────────
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>([]);

  const injectMessage = useCallback((msg: ChatMessage) => {
    setExtraMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = msg;
        return next;
      }
      return [...prev, msg];
    });
  }, []);

  const onSessionReady = useCallback((sessionId: number) => {
    // Aggiorna il sessionId nel localStorage (usato da useGrowthChat)
    localStorage.setItem("growth_session_id", String(sessionId));
  }, []);

  // ─ Onboarding hook ──────────────────────────────────────────────────
  const onboarding = useWendyOnboarding({
    token, apiBase,
    onMessageReady: injectMessage,
    onSessionReady,
  });

  // ─ Merge messages: extraMessages davanti, poi chat.messages ──────────
  const allMessages: ChatMessage[] = [...extraMessages, ...chat.messages];
  const isEmpty = allMessages.length === 0;

  // ─ Auto-scroll ──────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, onboarding.isStreaming]);

  // ─ Show overlay? ────────────────────────────────────────────────────
  const showOverlay  = onboarding.statusChecked && onboarding.needsOnboarding && !onboarding.overlayDone;
  const showSpinner  = !onboarding.statusChecked;

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>

      {/* Overlay onboarding */}
      {showOverlay && (
        <WendyOnboardingOverlay
          userName={userContext.name ?? ""}
          token={token}
          apiBase={apiBase}
          onComplete={onboarding.startOnboarding}
          onSkip={onboarding.skipOnboarding}
        />
      )}

      {/* Spinner mentre controllo status */}
      {showSpinner ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"/>
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

            {/* Empty state (solo dopo onboarding completato) */}
            {isEmpty && onboarding.overlayDone && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                  <span className="text-3xl">🧡</span>
                </div>
                <p className="text-sm font-semibold">Wendy è pronta</p>
                <p className="text-xs text-muted-foreground mt-1">Scrivi il tuo primo messaggio qui sotto</p>
              </div>
            )}

            {/* Empty state iniziale (no onboarding) */}
            {isEmpty && !onboarding.overlayDone && !onboarding.needsOnboarding && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                  <span className="text-3xl">🧡</span>
                </div>
                <p className="text-sm font-semibold">Ciao! Sono Wendy</p>
                <p className="text-xs text-muted-foreground mt-1">La tua coach personale su NorthStar</p>
              </div>
            )}

            {/* Message list */}
            {allMessages.map((msg) => (
              <GrowthChatMessage key={msg.id} message={msg}/>
            ))}

            {/* Thinking / status */}
            {chat.statusMessage && <WendyThinkingStatus message={chat.statusMessage}/>}

            {/* Typing indicator */}
            {(chat.isStreaming || onboarding.isStreaming) &&
              allMessages[allMessages.length - 1]?.role !== "assistant" && (
              <WendyTypingIndicator/>
            )}

            <div ref={bottomRef}/>
          </div>

          {/* Error */}
          {chat.error && (
            <div className="mx-4 mb-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {chat.error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border">
            <GrowthChatInput
              onSend={chat.sendMessage}
              onAbort={chat.abort}
              isStreaming={chat.isStreaming || onboarding.isStreaming}
              disabled={showOverlay}
            />
          </div>
        </>
      )}
    </div>
  );
}
