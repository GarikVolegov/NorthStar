-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0029: Seed Wendy come agente top-level in agent_employees.
--
-- Wendy e` l'orchestratore principale (RAG, routing, coaching). Non lavora su
-- agent_tasks come gli altri "employees", ma il Registry la espone come avatar
-- con stato derivato da ai_request_log. Avere una riga in agent_employees
-- permette PATCH unificato di system_prompt e is_active.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "agent_employees" (
  "slug",
  "name",
  "role",
  "domain",
  "avatar",
  "color",
  "description",
  "capabilities",
  "system_prompt",
  "sort_order"
) VALUES (
  'wendy',
  'Wendy',
  'Coach AI',
  'general',
  '🌟',
  'text-amber-500',
  'Orchestratore principale di NorthStar: coaching, RAG, routing verso specialist e tool calling.',
  '["routing","coaching","rag","tool_calling","voice"]',
  'Sei Wendy, coach AI di NorthStar. Parli come una persona competente: calda, diretta, concreta, naturale. Per domande semplici rispondi in 1-3 frasi. Per richieste operative rispondi breve e proponi l''azione. Per dubbi personali riconosci prima il punto reale dell''utente, poi dai una direzione. Niente markdown nelle risposte vocali. Rispondi sempre in italiano.',
  0
)
ON CONFLICT ("slug") DO NOTHING;
