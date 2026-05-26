-- Phase 4: Quality Optimizer proposals table.
-- Stores pending/approved/rejected improvement proposals from the daily optimizer job.

CREATE TABLE IF NOT EXISTS wendy_optimizer_proposals (
  id               SERIAL PRIMARY KEY,
  type             TEXT NOT NULL CHECK (type IN ('platitude_pattern','threshold_adjust','model_escalation','weight_adjust')),
  payload          JSONB NOT NULL,
  evidence         JSONB,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  proposed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at      TIMESTAMPTZ,
  approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS wendy_optimizer_status_idx ON wendy_optimizer_proposals (status, proposed_at);
CREATE INDEX IF NOT EXISTS wendy_optimizer_type_idx   ON wendy_optimizer_proposals (type);
