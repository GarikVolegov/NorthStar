/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → FRONTEND_RULES.md  (pattern React, layout, Tailwind)
 *   → AI_RULES.md        (SSE streaming, onboarding Wendy, costi)
 *   → API_RULES.md       (endpoint growth-agent, auth cookie)
 *
 * WendyPage — Pagina principale della coach AI Wendy.
 *
 * FLUSSO:
 *   1. Legge il token JWT dal cookie ns_token (impostato al login)
 *   2. Recupera il profilo utente da /api/users/me per popolare userContext
 *   3. Monta GrowthChatPanel che gestisce internamente:
 *      - GET /api/growth-agent/onboarding/status → needsOnboarding
 *      - Se true: mostra WendyOnboardingOverlay (3 step)
 *      - POST /api/growth-agent/onboarding → SSE primo messaggio Wendy
 *      - Poi chat normale via useGrowthChat
 *
 * MOBILE-FIRST NOTES (feat/mobile-pwa-optimization):
 *   - Header: min-h-[56px], padding p-4 mobile / md:p-5
 *   - Avatar: 44x44px (tap target minimo iOS/Android)
 *   - Testo troncato con truncate per evitare overflow su schermi piccoli
 *   - Loading/Error: padding sicuro p-4 / md:p-8, max-w-sm centrato
 */
import React, { useEffect, useState } from "react";
import { GrowthChatPanel } from "../../lib/growth-agent";

// ── Helpers ────────────────────────────────────────────────────────────────────────────

/** Legge un cookie per nome. Restituisce undefined se assente. */
function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

/** Legge il token JWT: prima dal cookie ns_token, poi da localStorage. */
function readToken(): string | null {
  return getCookie("ns_token") ?? localStorage.getItem("ns_token") ?? null;
}

// ── Tipi ───────────────────────────────────────────────────────────────────────────

interface UserProfile {
  name?:        string;
  journeyType?: string;
  userMode?:    string;
}

// ── Componente ─────────────────────────────────────────────────────────────────────

export function WendyPage() {
  const [token,   setToken]   = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  // Leggi token al mount
  useEffect(() => {
    const t = readToken();
    if (!t) {
      setError("Non sei autenticato. Effettua il login per accedere a Wendy.");
      setLoading(false);
      return;
    }
    setToken(t);
  }, []);

  // Recupera profilo utente (per popolare userContext di Wendy)
  useEffect(() => {
    if (!token) return;

    fetch(`${apiBase}/users/me`, {
      headers:     { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Profilo non trovato (${r.status})`);
        return r.json() as Promise<UserProfile>;
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // Wendy funziona anche senza profilo: mostriamo solo un warning
        console.warn("[WendyPage] Profilo non caricato:", err);
        setProfile({});
        setLoading(false);
      });
  }, [token, apiBase]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      // p-4: padding sicuro su tutti i device mobile
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !token) {
    return (
      // p-4 mobile, md:p-8 desktop
      <div className="flex h-full items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-4 md:px-6 md:py-5 text-center text-sm text-red-700">
          <p className="font-semibold mb-1">🚫 Accesso non autorizzato</p>
          <p>{error ?? "Token mancante. Effettua il login."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/*
       * Header mobile-first:
       * - min-h-[56px]: altezza minima per zona touch sicura
       * - px-4 / md:px-5: padding orizzontale scalabile
       * - py-2 / md:py-3: padding verticale scalabile
       */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0 min-h-[56px] md:px-5 md:py-3">
        {/*
         * Avatar 44x44px: tap target minimo consigliato da Apple HIG e Material.
         * h-11 w-11 = 44px (1 Tailwind unit = 4px)
         */}
        <div className="h-11 w-11 rounded-full bg-indigo-100 flex items-center justify-center text-xl shrink-0">
          🧡
        </div>
        <div className="min-w-0">
          {/* truncate: evita overflow su schermi piccoli */}
          <p className="text-sm font-semibold leading-tight truncate">Wendy</p>
          <p className="text-xs text-muted-foreground truncate">La tua coach personale NorthStar</p>
        </div>
      </div>

      {/* Chat panel — gestisce onboarding + chat SSE internamente */}
      <GrowthChatPanel
        token={token}
        apiBase={apiBase}
        userContext={{
          name:        profile?.name,
          journeyType: profile?.journeyType,
          userMode:    profile?.userMode,
        }}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
