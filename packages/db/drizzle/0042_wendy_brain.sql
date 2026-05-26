CREATE TABLE IF NOT EXISTS wendy_brain_nodes (
  id SERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(240) NOT NULL,
  normalized_title VARCHAR(240) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'candidate',
  confidence REAL NOT NULL DEFAULT 0.7,
  importance REAL NOT NULL DEFAULT 0.5,
  decay_score REAL NOT NULL DEFAULT 1,
  source_type VARCHAR(64) NOT NULL DEFAULT 'manual',
  source_ref VARCHAR(160) NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),
  last_reinforced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_wendy_brain_nodes_status CHECK (status IN ('candidate', 'active', 'archived')),
  CONSTRAINT ck_wendy_brain_nodes_type CHECK (type IN ('domain_knowledge', 'world_model', 'personality_rule', 'style_rule', 'skill', 'playbook', 'tool_affordance', 'policy', 'open_question')),
  CONSTRAINT ck_wendy_brain_nodes_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT ck_wendy_brain_nodes_importance CHECK (importance >= 0 AND importance <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS wendy_brain_nodes_unique_source_idx
  ON wendy_brain_nodes(type, normalized_title, source_ref);
CREATE INDEX IF NOT EXISTS wendy_brain_nodes_status_idx
  ON wendy_brain_nodes(status, type);
CREATE INDEX IF NOT EXISTS wendy_brain_nodes_source_idx
  ON wendy_brain_nodes(source_type, source_ref);
CREATE INDEX IF NOT EXISTS wendy_brain_nodes_embedding_idx
  ON wendy_brain_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS wendy_brain_edges (
  id SERIAL PRIMARY KEY,
  source_node_id INTEGER NOT NULL REFERENCES wendy_brain_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES wendy_brain_nodes(id) ON DELETE CASCADE,
  relation_type VARCHAR(64) NOT NULL DEFAULT 'related',
  status VARCHAR(24) NOT NULL DEFAULT 'candidate',
  confidence REAL NOT NULL DEFAULT 0.7,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_wendy_brain_edges_status CHECK (status IN ('candidate', 'active', 'archived')),
  CONSTRAINT ck_wendy_brain_edges_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS wendy_brain_edges_unique_idx
  ON wendy_brain_edges(source_node_id, target_node_id, relation_type);
CREATE INDEX IF NOT EXISTS wendy_brain_edges_source_idx
  ON wendy_brain_edges(source_node_id);
CREATE INDEX IF NOT EXISTS wendy_brain_edges_target_idx
  ON wendy_brain_edges(target_node_id);

CREATE TABLE IF NOT EXISTS wendy_brain_events (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES wendy_brain_nodes(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  source_ref VARCHAR(160),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wendy_brain_events_node_idx
  ON wendy_brain_events(node_id);
CREATE INDEX IF NOT EXISTS wendy_brain_events_type_idx
  ON wendy_brain_events(event_type, created_at);
