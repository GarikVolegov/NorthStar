/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → FRONTEND_RULES.md  (routing, layout, lazy loading)
 *   → AI_RULES.md        (componenti Wendy e onboarding)
 *
 * wendy.tsx — Entry route per la pagina Wendy.
 *
 * Se usi React Router, aggiungi in App.tsx / router.tsx:
 *   <Route path="/wendy" element={<WendyRoute />} />
 *
 * Se usi Next.js App Router, questo file è ignorato;
 * usa invece apps/web/src/app/wendy/page.tsx.
 */
import React from "react";
import { WendyPage } from "../components/wendy/WendyPage";

export default function WendyRoute() {
  return (
    // Altezza full-viewport meno navbar (aggiusta la classe in base al tuo layout)
    <main className="h-[calc(100vh-64px)] overflow-hidden">
      <WendyPage />
    </main>
  );
}
