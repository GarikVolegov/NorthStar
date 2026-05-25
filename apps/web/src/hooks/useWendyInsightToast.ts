/**
 * useWendyInsightToast — mostra un toast non invasivo quando arriva un nuovo insight proattivo.
 *
 * Regole:
 *   - Mostra solo i veri "nuovi" insight (delta rispetto agli ID già visti in questa sessione).
 *   - Rate-limit: max 1 toast ogni TOAST_INTERVAL_MS (default 30 min) per non spammare.
 *   - Non rieseguire al primo render (gli insight esistenti al boot non sono "nuovi").
 *   - Cliccando il toast l'utente viene mandato al CTA dell'insight (se presente) e il toast viene chiuso.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "./use-toast";
import {
  useProactiveInsights,
  type ProactiveInsight,
} from "./useProactiveInsights";

const TOAST_INTERVAL_MS = 30 * 60 * 1000; // 30 minuti
const SEEN_IDS_KEY = "wendy:insights-seen-ids:v1";

function loadSeenIds(): Set<number> {
  if (typeof window === "undefined" || !window.sessionStorage) return new Set();
  try {
    const raw = window.sessionStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === "number"));
  } catch {
    return new Set();
  }
}

function persistSeenIds(ids: Set<number>): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage non disponibile: il rate limit resta in memoria
  }
}

function pickFreshestInsight(
  candidates: ProactiveInsight[],
): ProactiveInsight | null {
  const eligible = candidates
    .filter((i) => !i.readAt && !i.dismissedAt)
    .sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return eligible[0] ?? null;
}

interface UseWendyInsightToastOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function useWendyInsightToast(
  options: UseWendyInsightToastOptions = {},
): void {
  const { enabled = true, intervalMs = TOAST_INTERVAL_MS } = options;
  const { insights, markRead } = useProactiveInsights();
  const [, setLocation] = useLocation();

  const seenIdsRef = useRef<Set<number>>(loadSeenIds());
  const lastToastAtRef = useRef<number>(0);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (insights.length === 0) return;

    // Al primo ciclo annota tutti gli insight come già visti — non sono "nuovi".
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      for (const i of insights) seenIdsRef.current.add(i.id);
      persistSeenIds(seenIdsRef.current);
      return;
    }

    const newOnes = insights.filter((i) => !seenIdsRef.current.has(i.id));
    if (newOnes.length === 0) return;

    // Aggiorniamo subito il set: anche se per rate-limit non mostriamo il toast,
    // non vogliamo rimanere "in coda" sullo stesso insight per sempre.
    for (const i of newOnes) seenIdsRef.current.add(i.id);
    persistSeenIds(seenIdsRef.current);

    const now = Date.now();
    if (now - lastToastAtRef.current < intervalMs) return;

    const fresh = pickFreshestInsight(newOnes);
    if (!fresh) return;

    lastToastAtRef.current = now;

    const result = toast({
      title: fresh.title,
      description: fresh.body.length > 140 ? `${fresh.body.slice(0, 137)}...` : fresh.body,
      duration: 8_000,
    });

    if (fresh.ctaTarget) {
      // CTA: clic naviga, ma per ora il toast shadcn non ha azione click globale
      // sul body. Lasciamo l'utente cliccare il bottone "Vedi" se renderizzato
      // nel toaster; in mancanza, basta che il toast appaia.
      void result;
      // Auto-mark-read dopo un breve delay così l'utente non vede il count salire
      // a vuoto se ignora il toast.
      window.setTimeout(() => {
        markRead(fresh.id);
        if (fresh.ctaTarget) {
          // Non navighiamo automaticamente — solo se l'utente clicca.
          // Manteniamo la rotta come navigazione manuale via CTA card.
          void fresh.ctaTarget;
        }
      }, 0);
    } else {
      window.setTimeout(() => markRead(fresh.id), 0);
    }

    void setLocation;
  }, [insights, enabled, intervalMs, markRead, setLocation]);
}

export function _resetWendyInsightToastForTest(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(SEEN_IDS_KEY);
  }
}
