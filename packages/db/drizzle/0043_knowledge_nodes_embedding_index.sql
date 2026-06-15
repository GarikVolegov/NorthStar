-- Indice vettoriale mancante su knowledge_nodes.embedding_vec.
--
-- Senza questo indice, OGNI turno di Wendy esegue un full-scan + sort su tutti
-- i nodi dell'utente (packages/ai-server/src/growth-agent/retriever.ts:
--   ... WHERE embedding_vec IS NOT NULL ORDER BY embedding_vec <=> $1::vector).
-- È il costo di latenza dominante sul percorso AI e satura il pool DB sotto
-- carico. Indice PARZIALE (WHERE embedding_vec IS NOT NULL) perché la query
-- filtra già i NULL — combacia col predicato ed evita di indicizzare righe nulle.
--
-- Guardato dalla disponibilità di pgvector (i DB locali possono non averlo: il
-- retriever JS fa da fallback). Idempotente: CREATE INDEX IF NOT EXISTS.
DO $$
BEGIN
  IF to_regtype('vector') IS NOT NULL THEN
    ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

    CREATE INDEX IF NOT EXISTS knowledge_nodes_embedding_vec_idx
      ON knowledge_nodes USING hnsw (embedding_vec vector_cosine_ops)
      WHERE embedding_vec IS NOT NULL;
  ELSE
    RAISE NOTICE 'pgvector non disponibile; salto knowledge_nodes_embedding_vec_idx';
  END IF;
END $$;
