/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → FRONTEND_RULES.md  (pattern React, token, routing)
 *   → API_RULES.md        (endpoint affiliate, auth)
 *
 * AffiliateDashboard — WRAPPER per apps/web.
 *
 * NON contiene logica: tutta la UI e il fetch sono in:
 *   lib/integrations-openai-ai-react/src/growth-agent/AffiliateDashboard.tsx
 *
 * Questo file:
 *   1. Legge ns_token da cookie o localStorage
 *   2. Monta la dashboard canonica dalla lib passando token + apiBase
 *
 * Se vuoi modificare KPI cards, tabelle, modale prelievo, ecc.
 * → vai in lib/.../AffiliateDashboard.tsx, NON qui.
 */
import React, { useEffect, useState } from "react";
import { AffiliateDashboard as CoreDashboard } from "../../lib/growth-agent";

function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

export function AffiliateDashboard() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getCookie("ns_token") ?? localStorage.getItem("ns_token");
    setToken(t);
  }, []);

  const apiBase = (typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL
    : undefined) ?? "/api";

  if (!token) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Accesso non autorizzato. Effettua il login.</p>
      </div>
    );
  }

  return <CoreDashboard token={token} apiBase={apiBase} />;
}
