# NorthStar — Admin Review Dashboard for Replit

## Obiettivo
Creare un pannello interno di controllo in NorthStar per visualizzare, verificare e confermare tutti i risultati prodotti dagli agenti AI prima della pubblicazione.

Questo pannello deve permettere di:
- vedere in tempo reale le proposte di settori, ruoli, percorsi formativi, calendari e contenuti growth;
- approvare, modificare o rifiutare ogni risultato;
- tracciare lo stato di ogni review;
- mantenere il controllo umano sulle entità che entrano nel sistema pubblico.

Il documento è pensato come istruzione operativa per Replit e deve essere usato come riferimento per costruire la dashboard admin.

---

## 1. Principio del pannello

Il pannello non deve essere visibile agli utenti finali.
Deve essere un backoffice privato per te o per utenti autorizzati.

Tutto ciò che un agente crea deve passare da questo flusso:
1. L’agente genera una proposta.
2. La proposta entra in coda.
3. Il pannello mostra il risultato.
4. L’admin approva o rifiuta.
5. Solo i dati approvati diventano pubblici.

Questo evita di pubblicare contenuti incoerenti o duplicati.

---

## 2. Cosa deve mostrare

La dashboard deve elencare tutti i risultati degli agenti, raggruppati per tipo:
- settori;
- ruoli;
- percorsi formativi;
- calendari;
- contenuti crescita personale;
- suggerimenti work mode;
- altri risultati futuri.

Ogni record deve mostrare almeno:
- nome entità;
- tipo agente;
- confidence score;
- stato review;
- data creazione;
- data ultimo aggiornamento;
- note di sistema.

---

## 3. Stati possibili

Ogni elemento nella review queue deve avere uno di questi stati:
- `draft`
- `pending_review`
- `approved`
- `rejected`
- `archived`

### Regola di flusso
- `draft`: creato ma non pronto.
- `pending_review`: pronto per la tua verifica.
- `approved`: pubblicabile.
- `rejected`: non valido o da rifare.
- `archived`: vecchio o superato.

---

## 4. Layout della dashboard

### Sidebar sinistra
- Queue agenti.
- Settori.
- Ruoli.
- Percorsi formativi.
- Calendar plans.
- Growth content.
- Log.
- Impostazioni.

### Area centrale
Mostra la lista filtrabile dei risultati, con:
- titolo;
- tipologia;
- stato;
- confidence;
- data;
- pulsante visualizza.

### Pannello dettaglio
Quando selezioni un risultato, mostra:
- contenuto completo;
- motivazione dell’agente;
- relazioni con altre entità;
- suggerimenti collegati;
- pulsanti di approvazione.

---

## 5. Funzioni principali

### A. Review queue
Deve mostrare tutti i risultati in attesa di conferma.

### B. Detail view
Per ogni risultato devi poter vedere:
- payload completo;
- nome agente;
- confidence;
- campi compilati;
- relazioni proposte;
- eventuali warning.

### C. Actions
Devi poter:
- approvare;
- rifiutare;
- modificare manualmente;
- archiviare;
- aggiungere note.

### D. Search and filter
Filtra per:
- agente;
- tipo entità;
- stato;
- confidence;
- data;
- priorità.

---

## 6. Modello dati

### Tabella `agent_runs`
Memorizza ogni esecuzione dell’agente.
Campi consigliati:
- id;
- agent_name;
- input_summary;
- output_summary;
- status;
- started_at;
- finished_at;
- duration_ms;
- error_message.

### Tabella `agent_suggestions`
Memorizza le entità suggerite.
Campi consigliati:
- id;
- agent_run_id;
- entity_type;
- entity_name;
- payload_json;
- confidence_score;
- status;
- reviewed_by;
- reviewed_at;
- notes.

### Tabella `review_queue`
Gestisce la revisione umana.
Campi consigliati:
- id;
- suggestion_id;
- queue_status;
- priority;
- assigned_to;
- created_at;
- updated_at.

### Tabella `audit_logs`
Registra ogni azione admin.
Campi consigliati:
- id;
- user_id;
- action;
- target_type;
- target_id;
- created_at;
- metadata_json.

---

## 7. Entità da confermare

La dashboard deve essere pronta a gestire questi oggetti:

### Settori
- nome settore;
- descrizione;
- sottocategoria;
- trend score;
- stato.

### Ruoli
- nome ruolo;
- settore associato;
- work mode;
- skill richieste;
- rilevanza per l’utente.

### Percorsi formativi
- università;
- ITS;
- corsi online con certificazione;
- micro-credentials;
- bootcamp;
- professional certificates.

### Calendar plans
- piano giornaliero;
- piano settimanale;
- step esecutivi;
- scadenze.

### Growth content
- contenuti di crescita personale;
- abitudini;
- disciplina;
- focus;
- consapevolezza;
- miglioramento reale.

---

## 8. UX richiesta

La dashboard deve essere chiara e operativa.

### Requisiti UX
- lista leggibile;
- filtri semplici;
- stato visibile a colpo d’occhio;
- dettaglio espandibile;
- pulsanti chiari;
- nessun sovraccarico visivo.

### Indicatori visivi
- verde = approved;
- giallo = pending_review;
- rosso = rejected;
- grigio = archived.

---

## 9. Flusso operativo corretto

1. Un agente produce un risultato.
2. Il risultato viene salvato in database come `pending_review`.
3. La dashboard lo mostra nella queue.
4. L’admin controlla il contenuto.
5. L’admin approva o modifica.
6. Se approvato, il dato viene sincronizzato nel catalogo pubblico.
7. Se rifiutato, ritorna nel flusso di revisione o viene archiviato.

---

## 10. Sicurezza e accesso

Il pannello deve essere protetto.

### Requisiti
- login admin;
- sessione sicura;
- controllo ruoli;
- accesso limitato;
- eventuale audit trail.

### Regola fondamentale
Non esporre mai la review queue agli utenti standard.

---

## 11. API da creare

- `GET /api/admin/queue`
- `GET /api/admin/suggestions`
- `GET /api/admin/agent-runs`
- `GET /api/admin/suggestions/:id`
- `POST /api/admin/suggestions/:id/approve`
- `POST /api/admin/suggestions/:id/reject`
- `POST /api/admin/suggestions/:id/edit`
- `POST /api/admin/suggestions/:id/archive`
- `GET /api/admin/logs`

---

## 12. Componenti frontend da costruire

- `AdminSidebar`
- `ReviewQueueTable`
- `SuggestionDetailPanel`
- `AgentRunLogTable`
- `StatusBadge`
- `FilterBar`
- `ApprovalActions`
- `AuditTimeline`

---

## 13. Integrazione con gli agenti

La dashboard deve ricevere output da:
- Sector Discovery Agent;
- Role Discovery Agent;
- Education Path Agent;
- Calendar Agent;
- Growth Agent;
- Validator Agent.

Tutti questi agenti devono scrivere i loro risultati in formato strutturato e coerente, così il pannello può leggerli senza interpretazioni ambigue.

---

## 14. Regole per Replit

Costruisci questa dashboard in modo modulare, con codice separato per:
- pagina admin;
- tabelle database;
- API di gestione;
- componenti UI;
- stato globale;
- autenticazione.

Mantieni il progetto coerente con il resto di NorthStar e usa il file come riferimento principale per l’implementazione.

---

## 15. Obiettivo finale

NorthStar deve avere un pannello di controllo interno che ti permetta di vedere tutto ciò che gli agenti producono, confermare ciò che è corretto e mantenere alto il livello qualitativo del sistema prima della pubblicazione.
