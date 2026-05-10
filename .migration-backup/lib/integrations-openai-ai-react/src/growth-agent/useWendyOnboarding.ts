/**
 * useWendyOnboarding — Passo 6.
 *
 * Rileva se l’utente è alla prima sessione e gestisce il flusso onboarding.
 *
 * LOGICA:
 *   1. Al mount, chiama GET /api/growth-agent/onboarding/status
 *   2. Se needsOnboarding = true, attiva l’overlay
 *   3. Quando l’utente completa i 3 step dell’overlay, chiama
 *      POST /api/growth-agent/onboarding (streaming SSE)
 *   4. Il testo streamato viene iniettato come primo ChatMessage (role=assistant)
 *      nello state del genitore via onMessageReady()
 *   5. Salva 'ns_onboarded' in localStorage per evitare ricontrolli
 *
 * RITORNA:
 *   needsOnboarding   boolean
 *   overlayDone       boolean (overlay completato, chat visibile)
 *   isStreaming        boolean (Wendy sta scrivendo)
 *   statusChecked      boolean (fetch status completata)
 *   startOnboarding()  da chiamare quando l’overlay ha raccolto i dati
 *   skipOnboarding()   da chiamare se l’utente vuole saltare
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "./useGrowthChat";

const ONBOARDED_KEY = "ns_onboarded";

function uid() { return Math.random().toString(36).slice(2); }

export interface WendyOnboardingOptions {
  token:            string;
  apiBase?:         string;
  onMessageReady:   (msg: ChatMessage) => void;
  onSessionReady:   (sessionId: number) => void;
}

export function useWendyOnboarding({
  token, apiBase = "/api", onMessageReady, onSessionReady,
}: WendyOnboardingOptions) {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [overlayDone,     setOverlayDone]     = useState(false);
  const [isStreaming,     setIsStreaming]     = useState(false);
  const [statusChecked,   setStatusChecked]   = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ─ 1. Check status at mount ────────────────────────────────────────────────
  useEffect(() => {
    // Skip se già onboarded in questa sessione browser
    if (localStorage.getItem(ONBOARDED_KEY)) {
      setStatusChecked(true);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${apiBase}/growth-agent/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { needsOnboarding: needs } = await res.json() as { needsOnboarding: boolean };
        setNeedsOnboarding(needs);
      } catch { /* rete KO, procedi senza onboarding */ }
      finally { setStatusChecked(true); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─ 2. startOnboarding: POST + SSE stream ─────────────────────────────────
  const startOnboarding = useCallback(async () => {
    setOverlayDone(true);  // chiudi overlay, mostra chat
    setIsStreaming(true);

    // Crea placeholder message che streamer riempie
    const msgId = uid();
    const placeholderMsg: ChatMessage = {
      id:          msgId,
      role:        "assistant",
      content:     "",
      isStreaming:  true,
    };
    onMessageReady(placeholderMsg);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${apiBase}/growth-agent/onboarding`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal:  ctrl.signal,
      });

      // 409: già onboardato (edge case: doppio click)
      if (res.status === 409) {
        onMessageReady({ id: msgId, role: "assistant", content: "", isStreaming: false });
        localStorage.setItem(ONBOARDED_KEY, "1");
        return;
      }

      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      let buf = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw) as {
              type: "token" | "done" | "error";
              value?: string;
              sessionId?: number;
            };
            if (ev.type === "token" && ev.value) {
              accumulated += ev.value;
              // Aggiorna il messaggio in streaming con il testo accumulato
              onMessageReady({
                id:          msgId,
                role:        "assistant",
                content:     accumulated,
                isStreaming:  true,
              });
            } else if (ev.type === "done") {
              onMessageReady({
                id:          msgId,
                role:        "assistant",
                content:     accumulated,
                isStreaming:  false,
              });
              if (ev.sessionId) onSessionReady(ev.sessionId);
              localStorage.setItem(ONBOARDED_KEY, "1");
            } else if (ev.type === "error") {
              onMessageReady({ id: msgId, role: "assistant", content: "Ciao! Sono Wendy, la tua coach. Come posso aiutarti oggi?", isStreaming: false });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Fallback: messaggio generico
        onMessageReady({
          id:         msgId,
          role:       "assistant",
          content:    "Ciao! Sono Wendy 👋 Sono la tua coach personale su NorthStar. Da dove vuoi iniziare?",
          isStreaming: false,
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [token, apiBase, onMessageReady, onSessionReady]);

  // ─ 3. skipOnboarding ───────────────────────────────────────────────────────────
  const skipOnboarding = useCallback(() => {
    abortRef.current?.abort();
    setNeedsOnboarding(false);
    setOverlayDone(true);
    localStorage.setItem(ONBOARDED_KEY, "1");
  }, []);

  return { needsOnboarding, overlayDone, isStreaming, statusChecked, startOnboarding, skipOnboarding };
}
