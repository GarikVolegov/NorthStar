/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → FRONTEND_RULES.md  (routing, layout, lazy loading)
 *   → API_RULES.md        (endpoint affiliate, auth)
 *
 * affiliate.tsx — Route entry per la pagina Affiliazione.
 *
 * Aggiungi in App.tsx / router.tsx:
 *   <Route path="/affiliate" element={<AffiliateRoute />} />
 *
 * Proteggi con PrivateRoute (solo utenti loggati).
 * Il guard isAffiliate è gestito internamente da AffiliateDashboard.
 */
import React from "react";
import { AffiliateDashboard } from "../components/affiliate/AffiliateDashboard";

export default function AffiliateRoute() {
  return (
    <main className="min-h-[calc(100vh-64px)] overflow-y-auto bg-background">
      <AffiliateDashboard />
    </main>
  );
}
