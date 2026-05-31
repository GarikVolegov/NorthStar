CREATE TABLE IF NOT EXISTS wendy_neural_activations (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_hash VARCHAR(64) NOT NULL,
  intent VARCHAR(32) NOT NULL,
  domain VARCHAR(32),
  item_kind VARCHAR(32) NOT NULL,
  item_ref TEXT NOT NULL,
  label VARCHAR(240) NOT NULL,
  score REAL NOT NULL,
  components JSONB NOT NULL DEFAULT '{"semantic":0,"userRelevance":0,"graphProximity":0,"recency":0,"salience":0,"trust":0}'::jsonb,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_wendy_neural_activations_kind CHECK (item_kind IN ('brain_note', 'wendy_brain_node', 'personal_memory', 'semantic_memory', 'tool', 'page_context', 'rag_chunk', 'code_graph')),
  CONSTRAINT ck_wendy_neural_activations_score CHECK (score >= 0 AND score <= 1)
);

CREATE INDEX IF NOT EXISTS wendy_neural_activations_request_idx
  ON wendy_neural_activations(request_id);
CREATE INDEX IF NOT EXISTS wendy_neural_activations_user_created_idx
  ON wendy_neural_activations(user_id, created_at);
CREATE INDEX IF NOT EXISTS wendy_neural_activations_item_idx
  ON wendy_neural_activations(item_kind, item_ref);

CREATE TABLE IF NOT EXISTS wendy_neural_edges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  source_item_kind VARCHAR(32) NOT NULL,
  source_item_ref TEXT NOT NULL,
  target_item_kind VARCHAR(32) NOT NULL,
  target_item_ref TEXT NOT NULL,
  relation_type VARCHAR(64) NOT NULL DEFAULT 'co_activated',
  weight REAL NOT NULL DEFAULT 0.1,
  decay_score REAL NOT NULL DEFAULT 1,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'candidate',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_reinforced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_wendy_neural_edges_source_kind CHECK (source_item_kind IN ('brain_note', 'wendy_brain_node', 'personal_memory', 'semantic_memory', 'tool', 'page_context', 'rag_chunk', 'code_graph')),
  CONSTRAINT ck_wendy_neural_edges_target_kind CHECK (target_item_kind IN ('brain_note', 'wendy_brain_node', 'personal_memory', 'semantic_memory', 'tool', 'page_context', 'rag_chunk', 'code_graph')),
  CONSTRAINT ck_wendy_neural_edges_status CHECK (status IN ('candidate', 'active', 'archived')),
  CONSTRAINT ck_wendy_neural_edges_weight CHECK (weight >= 0 AND weight <= 1),
  CONSTRAINT ck_wendy_neural_edges_decay CHECK (decay_score >= 0 AND decay_score <= 1),
  CONSTRAINT ck_wendy_neural_edges_not_self CHECK (source_item_kind <> target_item_kind OR source_item_ref <> target_item_ref)
);

CREATE INDEX IF NOT EXISTS wendy_neural_edges_user_idx
  ON wendy_neural_edges(user_id, status);
CREATE INDEX IF NOT EXISTS wendy_neural_edges_source_idx
  ON wendy_neural_edges(source_item_kind, source_item_ref);
CREATE INDEX IF NOT EXISTS wendy_neural_edges_target_idx
  ON wendy_neural_edges(target_item_kind, target_item_ref);

CREATE UNIQUE INDEX IF NOT EXISTS wendy_neural_edges_user_unique_idx
  ON wendy_neural_edges(user_id, source_item_kind, source_item_ref, target_item_kind, target_item_ref, relation_type)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wendy_neural_edges_global_unique_idx
  ON wendy_neural_edges(source_item_kind, source_item_ref, target_item_kind, target_item_ref, relation_type)
  WHERE user_id IS NULL;
