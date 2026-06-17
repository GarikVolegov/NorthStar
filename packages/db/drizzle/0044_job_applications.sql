-- job_applications: colonne per i career tools (US-003).
--
-- La tabella job_applications esiste già (schema in users.ts). Aggiungiamo le due
-- colonne necessarie al cover-letter generator (US-006): il testo dell'annuncio in
-- input e la cover letter generata. ALTER idempotente (ADD COLUMN IF NOT EXISTS),
-- coerente con lo stile delle migrazioni raw 0035–0043 (journal Drizzle fermo a
-- idx 34; riconciliazione del journal = task di staging separata, vedi docs/DEPLOY.md).
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS job_posting_text text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cover_letter     text;
