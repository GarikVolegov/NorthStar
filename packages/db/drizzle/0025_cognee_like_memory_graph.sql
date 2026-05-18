ALTER TABLE knowledge_nodes
  ADD COLUMN IF NOT EXISTS source_type varchar(64) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_entity_type varchar(64),
  ADD COLUMN IF NOT EXISTS source_entity_id varchar(128),
  ADD COLUMN IF NOT EXISTS visibility varchar(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS confidence real NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS importance real NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS decay_score real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extracted_by varchar(80) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reinforced_at timestamptz;

ALTER TABLE knowledge_edges
  ADD COLUMN IF NOT EXISTS relation_type varchar(64) NOT NULL DEFAULT 'related',
  ADD COLUMN IF NOT EXISTS confidence real NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS extracted_by varchar(80) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS knowledge_nodes_status_idx ON knowledge_nodes(status);
CREATE INDEX IF NOT EXISTS knowledge_nodes_source_idx ON knowledge_nodes(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_status_idx ON knowledge_edges(status);
