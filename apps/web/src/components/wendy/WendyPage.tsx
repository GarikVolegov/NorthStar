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
 *   2. Recupera il profilo utente da /api/auth/me per popolare userContext
 *   3. Monta GrowthChatPanel che gestisce internamente:
 *      - GET /api/growth-agent/onboarding/status → needsOnboarding
 *      - Se true: mostra WendyOnboardingOverlay (3 step)
 *      - POST /api/growth-agent/onboarding → SSE primo messaggio Wendy
 *      - Poi chat normale via useGrowthChat
 *
 * CHANGELOG:
 *   - Step 2: fix endpoint /api/users/me → /api/auth/me
 *   - Step 2: UserProfile esteso con objectives + sectorName
 *   - Step 2: gestione 401 con redirect a /login
 */
import React, { useEffect, useState } from "react";
import { GrowthChatPanel } from "../../lib/growth-agent";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Legge un cookie per nome. Restituisce undefined se assente. */
function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]!) : undefined;
}

/** Legge il token JWT: prima dal cookie ns_token, poi da localStorage. */
function readToken(): string | null {
  return getCookie("ns_token") ?? localStorage.getItem("ns_token") ?? null;
}

// ── Tipi ───────────────────────────────────────────────────────────────────

interface UserProfile {
  name?:        string;
  journeyType?: string;
  userMode?:    string;
  // Step 2: campi aggiuntivi per userContext Wendy
  objectives?:  string[];
  sectorName?:  string;
}

// ── Componente ─────────────────────────────────────────────────────────────

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

  // Recupera profilo utente da /api/auth/me (Step 2: fix endpoint)
  useEffect(() => {
    if (!token) return;

    fetch(`${apiBase}/auth/me`, {
      headers:     { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => {
        // 401 → token scaduto o invalido: redirect login
        if (r.status === 401) {
          localStorage.removeItem("ns_token");
          window.location.href = "/login";
          throw new Error("Sessione scaduta");
        }
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

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-center text-sm text-red-700">
          <p className="font-semibold mb-1">🚫 Accesso non autorizzato</p>
          <p>{error ?? "Token mancante. Effettua il login."}</p>
          <a
            href="/login"
            className="mt-3 inline-block rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
          >
            Vai al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
          🧡
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Wendy</p>
          <p className="text-xs text-muted-foreground">La tua coach personale NorthStar</p>
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
          // Step 2: passa objectives e sectorName se disponibili
          objectives:  profile?.objectives,
          sectorName:  profile?.sectorName,
        }}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
