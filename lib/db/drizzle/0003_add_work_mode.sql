-- Add work mode fields to sectors table
ALTER TABLE "sectors"
  ADD COLUMN IF NOT EXISTS "work_mode" json DEFAULT '["dipendente","ibrido"]'::json,
  ADD COLUMN IF NOT EXISTS "autonomy_score" integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "stability_score" integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "client_acquisition_required" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "freelance_steps" json DEFAULT '[]'::json,
  ADD COLUMN IF NOT EXISTS "remote_friendly" boolean DEFAULT true;

-- Add work preference fields to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "work_preference" text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "autonomy_preference" integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "stability_preference" integer DEFAULT 5;

-- Populate work mode data for known sectors
UPDATE "sectors" SET
  "work_mode" = '["dipendente","ibrido"]',
  "autonomy_score" = 6,
  "stability_score" = 7,
  "client_acquisition_required" = false,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Costruisci un portfolio pubblico", "description": "Crea progetti personali o open source che dimostrino le tue competenze tecniche."},
    {"step": 2, "title": "Definisci la tua specializzazione", "description": "Scegli una nicchia (es. backend Node.js, mobile Flutter) per distinguerti dal mercato."},
    {"step": 3, "title": "Acquisisci i primi clienti", "description": "Parti da piattaforme come Upwork o Fiverr, poi costruisci relazioni dirette con aziende."},
    {"step": 4, "title": "Gestisci la parte fiscale", "description": "Apri una Partita IVA regime forfettario e tieni traccia delle spese deducibili."},
    {"step": 5, "title": "Scala verso tariffe premium", "description": "Con la reputazione costruita, aumenta le tariffe orarie e seleziona clienti di qualità."}
  ]'
WHERE LOWER("name") LIKE '%tecnolog%' OR LOWER("name") LIKE '%software%' OR LOWER("name") LIKE '%digital%';

UPDATE "sectors" SET
  "work_mode" = '["dipendente"]',
  "autonomy_score" = 3,
  "stability_score" = 9,
  "client_acquisition_required" = false,
  "remote_friendly" = false,
  "freelance_steps" = '[
    {"step": 1, "title": "Ottieni le certificazioni necessarie", "description": "Le professioni sanitarie richiedono abilitazioni specifiche. Verifica i requisiti per la tua specializzazione."},
    {"step": 2, "title": "Apri uno studio privato", "description": "Registra l''attività, trova uno spazio adeguato e rispetta i requisiti sanitari locali."},
    {"step": 3, "title": "Costruisci una rete di referral", "description": "Collabora con medici di base e altri specialisti che possono indirizzarti pazienti."},
    {"step": 4, "title": "Gestione amministrativa", "description": "Assicurazione professionale, fatturazione e gestione agenda sono fondamentali in autonomia."},
    {"step": 5, "title": "Crescita e specializzazione", "description": "Differenziati con corsi di aggiornamento e costruisci una reputazione online."}
  ]'
WHERE LOWER("name") LIKE '%salut%' OR LOWER("name") LIKE '%sanit%' OR LOWER("name") LIKE '%healthcare%' OR LOWER("name") LIKE '%benessere%';

UPDATE "sectors" SET
  "work_mode" = '["autonomo","ibrido"]',
  "autonomy_score" = 9,
  "stability_score" = 4,
  "client_acquisition_required" = true,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Costruisci il tuo brand creativo", "description": "Crea un portfolio online (Behance, sito personale) che rappresenti il tuo stile unico."},
    {"step": 2, "title": "Scegli le tue piattaforme", "description": "Individua dove sono i tuoi clienti ideali: agenzie, startup, privati, mercati internazionali."},
    {"step": 3, "title": "Definisci i tuoi pacchetti", "description": "Proponi offerte chiare con prezzi trasparenti per evitare negoziazioni infinite."},
    {"step": 4, "title": "Costruisci relazioni a lungo termine", "description": "Un cliente fidelizzato vale molto più di dieci clienti occasionali. Cura il post-progetto."},
    {"step": 5, "title": "Diversifica le fonti di reddito", "description": "Affianca ai servizi prodotti digitali (template, corsi) per reddito passivo."}
  ]'
WHERE LOWER("name") LIKE '%creativit%' OR LOWER("name") LIKE '%design%' OR LOWER("name") LIKE '%gaming%' OR LOWER("name") LIKE '%esport%';

UPDATE "sectors" SET
  "work_mode" = '["autonomo"]',
  "autonomy_score" = 10,
  "stability_score" = 4,
  "client_acquisition_required" = true,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Valida la tua idea di business", "description": "Testa il mercato con un MVP prima di investire risorse significative."},
    {"step": 2, "title": "Costituisci la struttura legale", "description": "Scegli la forma giuridica adatta (Partita IVA, SRL, SAS) in base al progetto."},
    {"step": 3, "title": "Trova i primi clienti o investitori", "description": "Il bootstrapping o il pre-seed da angel investor sono percorsi complementari."},
    {"step": 4, "title": "Costruisci il team", "description": "Identifica i ruoli chiave mancanti e recluta collaboratori o co-fondatori."},
    {"step": 5, "title": "Scala e consolida", "description": "Con trazione dimostrata, cerca funding istituzionale o reinvesti i profitti per crescere."}
  ]'
WHERE LOWER("name") LIKE '%imprenditor%' OR LOWER("name") LIKE '%business%';

UPDATE "sectors" SET
  "work_mode" = '["ibrido","autonomo"]',
  "autonomy_score" = 7,
  "stability_score" = 6,
  "client_acquisition_required" = true,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Costruisci una specializzazione verticale", "description": "I consulenti generalisti faticano. Scegli un settore o un problema specifico su cui essere l''esperto di riferimento."},
    {"step": 2, "title": "Crea contenuti di valore", "description": "Pubblica insights su LinkedIn, scrivi articoli o un blog per costruire autorevolezza."},
    {"step": 3, "title": "Costruisci la tua rete professionale", "description": "Il networking è fondamentale in consulenza. Il 70% dei mandati arriva da referral."},
    {"step": 4, "title": "Struttura la tua offerta", "description": "Definisci metodologie, deliverable e pricing chiari per ogni servizio."},
    {"step": 5, "title": "Scala con collaboratori", "description": "Quando hai più richieste di quante ne puoi gestire, associa junior o freelance specializzati."}
  ]'
WHERE LOWER("name") LIKE '%consulenz%' OR LOWER("name") LIKE '%strateg%' OR LOWER("name") LIKE '%marketing%';

UPDATE "sectors" SET
  "work_mode" = '["ibrido"]',
  "autonomy_score" = 5,
  "stability_score" = 6,
  "client_acquisition_required" = false,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Consolida l''expertise tecnica", "description": "Approfondisci un''area specifica (data engineering, ML, BI) per diventare punto di riferimento."},
    {"step": 2, "title": "Costruisci un portfolio di analisi", "description": "Pubblica analisi su dataset pubblici, partecipa a Kaggle, scrivi su Medium o Towards Data Science."},
    {"step": 3, "title": "Offri consulenze per progetto", "description": "Inizia con piccoli mandati di analisi dati per aziende che non hanno un team interno."},
    {"step": 4, "title": "Automatizza con strumenti SaaS", "description": "Usa tool come Metabase, Looker Studio o Tableau per scalare le tue analisi senza aumentare le ore."},
    {"step": 5, "title": "Passa a retainer mensili", "description": "Proponi abbonamenti mensili per reporting continuo: reddito ricorrente e relazioni stabili."}
  ]'
WHERE LOWER("name") LIKE '%data%' OR LOWER("name") LIKE '%analytic%' OR LOWER("name") LIKE '%fintech%' OR LOWER("name") LIKE '%finanz%';

UPDATE "sectors" SET
  "work_mode" = '["dipendente","ibrido"]',
  "autonomy_score" = 4,
  "stability_score" = 8,
  "client_acquisition_required" = false,
  "remote_friendly" = false,
  "freelance_steps" = '[
    {"step": 1, "title": "Accumula esperienza in azienda", "description": "Prima di andare in proprio, costruisci 3-5 anni di esperienza in strutture organizzate."},
    {"step": 2, "title": "Diventa un esperto riconosciuto", "description": "Pubblica, parla a convegni, costruisci una reputazione nel tuo ambito specifico."},
    {"step": 3, "title": "Avvia la consulenza part-time", "description": "Mantieni la stabilità del lavoro dipendente mentre costruisci i primi clienti."},
    {"step": 4, "title": "Formalizza l''attività", "description": "Apri Partita IVA, definisci contratti standard e gestisci la privacy dei dati (GDPR)."},
    {"step": 5, "title": "Costruisci un team", "description": "Quando il volume cresce, associa collaboratori specializzati per diversificare i servizi."}
  ]'
WHERE LOWER("name") LIKE '%risorse umane%' OR LOWER("name") LIKE '%istruzione%' OR LOWER("name") LIKE '%formazione%' OR LOWER("name") LIKE '%logistic%';

-- Set default for any remaining sectors not yet updated
UPDATE "sectors" SET
  "work_mode" = '["dipendente","ibrido"]',
  "autonomy_score" = 5,
  "stability_score" = 6,
  "client_acquisition_required" = false,
  "remote_friendly" = true,
  "freelance_steps" = '[
    {"step": 1, "title": "Consolida le competenze chiave", "description": "Approfondisci le competenze tecniche e trasversali richieste nel settore prima di muoverti in autonomia."},
    {"step": 2, "title": "Costruisci il tuo network", "description": "Le opportunità in autonomia arrivano spesso dalle persone che conosci. Investi nelle relazioni professionali."},
    {"step": 3, "title": "Inizia con progetti part-time", "description": "Testa il mercato mantenendo la sicurezza di un reddito fisso finché non hai abbastanza clienti."},
    {"step": 4, "title": "Formalizza la tua attività", "description": "Apri Partita IVA (regime forfettario se il fatturato lo permette) e gestisci la contabilità."},
    {"step": 5, "title": "Scala e differenzia", "description": "Aumenta le tariffe, seleziona clienti migliori e aggiungi servizi complementari alla tua offerta."}
  ]'
WHERE "work_mode"::text = '["dipendente","ibrido"]' AND "autonomy_score" = 5 AND "freelance_steps"::text = '[]';
