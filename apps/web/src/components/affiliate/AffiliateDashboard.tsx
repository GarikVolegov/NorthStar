/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → FRONTEND_RULES.md  (pattern React, token, routing)
 *   → API_RULES.md        (endpoint affiliate, auth)
 *
 * AffiliateDashboard — WRAPPER per apps/web.
 *
 * NON contiene logica UI: tutta la UI e il fetch sono in:
 *   lib/integrations-openai-ai-react/src/growth-agent/AffiliateDashboard.tsx
 *
 * Questo file:
 *   1. Legge ns_token da cookie o localStorage
 *   2. Chiama GET /api/auth/me per leggere isAffiliate
 *   3. Monta la dashboard canonica dalla lib passando token + apiBase + isAffiliate
 *
 * Changelog:
 *   - Step 3: fix VITE_API_URL read
 *   - Step 3: aggiunta gestione 401 con redirect /login
 *   - Step 3: passa isAffiliate al CoreDashboard per il guard accesso
 *   - Step 3: loading state mentre token/profilo vengono letti
 *
 * Se vuoi modificare KPI cards, tabelle, modale prelievo —
 *   → vai in lib/.../AffiliateDashboard.tsx, NON qui.
 */
import React, { useEffect, useState } from "react";
import { AffiliateDashboard as CoreDashboard } from "../../lib/growth-agent";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]!) : undefined;
}

function readToken(): string | null {
  return getCookie("ns_token") ?? localStorage.getItem("ns_token") ?? null;
}

export function AffiliateDashboard() {
  const [token,       setToken]       = useState<string | null>(null);
  const [isAffiliate, setIsAffiliate] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const t = readToken();
    if (!t) {
      // Nessun token: redirect immediato al login
      window.location.href = "/login";
      return;
    }
    setToken(t);

    // Leggi isAffiliate da /api/auth/me
    fetch(`${API_BASE}/auth/me`, {
      headers:     { Authorization: `Bearer ${t}` },
      credentials: "include",
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("ns_token");
          window.location.href = "/login";
          throw new Error("Sessione scaduta");
        }
        if (!r.ok) throw new Error(`auth/me error ${r.status}`);
        return r.json() as Promise<{ isAffiliate?: boolean }>;
      })
      .then((data) => setIsAffiliate(data.isAffiliate ?? false))
      .catch(() => setIsAffiliate(false));
  }, []);

  // Loading: token o profilo non ancora pronti
  if (!token || isAffiliate === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <CoreDashboard
      token={token}
      apiBase={API_BASE}
      isAffiliate={isAffiliate}
    />
  );
}
