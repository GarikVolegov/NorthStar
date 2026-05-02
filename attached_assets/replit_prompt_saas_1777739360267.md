# PROMPT PER REPLIT — SVILUPPO COMPLETO DEL SaaS DI ORIENTAMENTO + CRESCITA PERSONALE

## RUOLO DEL PROGETTO
Stai sviluppando una piattaforma SaaS freemium che aiuta l’utente a capire la propria personalità, scoprire settori e mestieri coerenti, lasciarsi incuriosire da dati reali e confermare in autonomia la direzione da intraprendere.

Il prodotto deve funzionare come un sistema di orientamento intelligente: prima comprende l’utente, poi gli mostra opportunità concrete e statistiche, infine lascia che sia l’utente a confermare la scelta definitiva. La versione premium aggiunge una wiki intelligente, un grafo semantico, contenuti formativi e percorsi personalizzati.

## OBIETTIVO PRINCIPALE
Costruire un SaaS che:
1. identifica la personalità dell’utente con un test breve;
2. suggerisce 3 settori o mestieri compatibili;
3. mostra dati, statistiche, crescita e scalabilità per incuriosire;
4. lascia confermare all’utente la direzione desiderata;
5. costruisce un percorso personalizzato nella versione premium;
6. usa wiki LLM e database a grafo come second brain;
7. supporta sia giovani indecisi sia adulti che vogliono nuovi percorsi di crescita.

## STRUTTURA DEL PRODOTTO

### 1. VERSIONE FREE
La versione gratuita deve dare valore immediato e generare fiducia.

Funzioni free:
- Landing page chiara e moderna.
- Test RIASEC breve o test di personalità semplificato.
- Risultato con profilo utente.
- Top 3 settori o mestieri consigliati.
- Dati di base per ogni suggerimento.
- Pulsanti di conferma: “Esplora questo settore”, “Cambia preferenze”, “Approfondisci”.
- Mini report finale.
- Registrazione account per salvare il risultato.

Obiettivo del free:
- incuriosire l’utente;
- fargli percepire valore reale;
- portarlo a voler approfondire.

### 2. VERSIONE PREMIUM
La versione premium deve essere percepita come un salto di livello reale.

Funzioni premium:
- profilo personale salvato nel tempo;
- dashboard avanzata;
- wiki personale generata con LLM;
- database a grafo del percorso;
- contenuti formativi personalizzati;
- documenti su crescita personale;
- raccomandazioni evolutive;
- roadmap delle competenze;
- obiettivi e progressi;
- eventuale chat AI contestuale;
- eventuale supporto con coach umano.

## FLUSSO UTENTE IDEALE
1. L’utente entra nella landing.
2. Fa il test di personalità.
3. Riceve il profilo.
4. Vede 3 settori o mestieri con dati concreti.
5. Sceglie quello che lo incuriosisce di più.
6. Conferma la direzione.
7. Vede il percorso personalizzato.
8. Se vuole più profondità, passa al premium.

## PRINCIPIO CHIAVE DEL PRODOTTO
Il sistema non deve decidere al posto dell’utente. Deve piuttosto:
- capire chi è;
- mostrargli possibilità compatibili;
- presentare numeri e dati utili;
- creare curiosità;
- far sì che sia l’utente a dare la conferma finale.

Questo punto è fondamentale: il software orienta, ma non impone.

## MODULI FUNZIONALI DA COSTRUIRE

### MODULO A — TEST PERSONALITÀ
Creare un test semplice, veloce e chiaro.

Requisiti:
- 10 o più domande.
- Risposte multiple.
- Calcolo del profilo finale.
- Base RIASEC o modello simile.
- Restituzione di 2-3 tipi di personalità principali.

### MODULO B — MATCH SETTORI / MESTIERI
Dopo il test, il sistema deve suggerire:
- 3 settori principali;
- 3 mestieri principali;
- motivazione del match;
- dati statistici;
- livello di scalabilità;
- trend del settore.

Ogni settore/mestiere deve avere:
- nome;
- descrizione breve;
- personalità adatte;
- competenze richieste;
- crescita nel breve, medio e lungo termine;
- svantaggi;
- opportunità;
- livello di scalabilità;
- valori coerenti con il profilo.

### MODULO C — DATI E STATISTICHE
Mostrare dati utili per incuriosire l’utente.

Esempi di dati:
- crescita del settore;
- salari medi o range;
- posti di lavoro richiesti;
- livello di automazione possibile;
- tempo stimato per diventare autonomi;
- tendenza breve, medio e lungo termine;
- vantaggi e rischi.

I dati devono essere presentati in modo molto semplice, leggibile e visivo.

### MODULO D — CONFERMA UTENTE
Dopo la proposta iniziale, l’utente deve avere il controllo.

Deve poter:
- confermare un settore;
- rifiutare le proposte;
- rifare il test;
- selezionare una nuova area;
- salvare una scelta iniziale.

Questa conferma è un momento centrale del funnel.

### MODULO E — WIKI LLM
La wiki è il sistema di conoscenza che cresce con l’utente.

Contenuti possibili:
- orientamento;
- crescita personale;
- gestione del tempo;
- consapevolezza;
- obiettivi;
- finanza personale;
- benessere;
- lavoro;
- carriera;
- mindset;
- studio.

La wiki deve essere:
- in markdown;
- organizzata per pagine concettuali;
- collegata ai dati dell’utente;
- espandibile dall’LLM.

### MODULO F — DATABASE A GRAFO
Creare un grafo che colleghi:
- utenti;
- personalità;
- settori;
- mestieri;
- competenze;
- documenti;
- obiettivi;
- esercizi;
- progressi;
- risultati dei test.

Il grafo serve per:
- raccomandazioni contestuali;
- memoria del percorso;
- connessione tra concetti;
- ricerca interna;
- evoluzione del profilo.

### MODULO G — DASHBOARD PREMIUM
La dashboard premium deve mostrare:
- profilo personalità;
- settori selezionati;
- percorso attuale;
- competenze da sviluppare;
- articoli o documenti consigliati;
- progresso nel tempo;
- obiettivi;
- elementi del grafo;
- consigli AI.

## ARCHITETTURA TECNICA CONSIGLIATA

### Frontend
- React o Next.js.
- Tailwind CSS.
- UI semplice, pulita, moderna.
- Focus su leggibilità e chiarezza.

### Backend
- Node.js con Express oppure NestJS.
- API per:
  - utenti;
  - test;
  - suggerimenti;
  - contenuti;
  - pagamenti;
  - grafi;
  - wiki.

### Database
- PostgreSQL per dati strutturati.
- Neo4j o database a grafo per relazioni semantiche.
- Storage file per documenti e PDF.

### AI
- LLM per:
  - generare wiki;
  - sintetizzare contenuti;
  - proporre collegamenti;
  - aiutare nella chat;
  - personalizzare i consigli.

### Pagamenti
- Stripe per i piani premium.

### Auth
- Login email/password.
- Possibile Google OAuth.

## REQUISITI DI UX
L’interfaccia deve essere:
- intuitiva;
- motivante;
- non tecnica;
- coinvolgente;
- adatta anche a ragazzi giovani;
- credibile per adulti benestanti;
- orientata alla scoperta.

L’utente deve sentire che il sistema lo aiuta a vedere possibilità che non aveva considerato.

## CONTENUTI DA PREVEDERE NEL SISTEMA
La piattaforma deve includere contenuti su:
- orientamento scolastico;
- orientamento universitario;
- ingresso nel mondo del lavoro;
- crescita personale;
- finanza personale;
- benessere mentale;
- carriera;
- startup e imprenditoria;
- mestieri scalabili;
- settori in crescita.

## COME DEVE ESSERE COSTRUITO IL MATCH
Il sistema deve usare almeno questi criteri:
- personalità;
- interessi;
- attitudini;
- valori;
- livello di rischio accettato;
- scalabilità del mestiere;
- crescita del settore;
- compatibilità con stile di vita;
- potenziale economico;
- motivazione psicologica.

## FUNZIONE DI INCURIOSIMENTO
Dopo il test, il sistema deve mostrare:
- 3 settori principali;
- 3 mestieri principali;
- statistiche;
- perché sono coerenti;
- un invito a esplorare uno di essi.

L’obiettivo è far nascere curiosità, non dare una risposta finale rigida.

## ROADMAP DI SVILUPPO
### Fase 1
- Setup progetto.
- Landing page.
- Test personalità.
- Risultati base.
- Salvataggio utenti.

### Fase 2
- Top 3 settori/mestieri.
- Dati e statistiche.
- Conferma utente.
- Dashboard base.

### Fase 3
- Premium.
- Stripe.
- Wiki LLM.
- Grafo.

### Fase 4
- Contenuti avanzati.
- Personalizzazione forte.
- Chat AI.
- Coaching.

### Fase 5
- Espansione B2B.
- Scuole.
- Multi settore.
- Analytics.

## STRUTTURA DEI FILE SUGGERITA
- `src/`
- `src/components/`
- `src/pages/` oppure `src/app/`
- `src/data/`
- `src/lib/`
- `src/api/`
- `src/services/`
- `src/styles/`
- `src/wiki/`
- `src/graph/`
- `src/tests/`

## PRIMA COSA DA SVILUPPARE
Il primo MVP deve includere:
1. landing page;
2. test personalità;
3. output con 3 suggerimenti;
4. conferma dell’utente;
5. salvataggio del risultato.

Solo dopo si aggiungono wiki, grafo e AI avanzata.

## OBIETTIVO DI BUSINESS
Il prodotto deve diventare una piattaforma che converte utenti free in premium perché offre:
- chiarezza;
- curiosità;
- dati concreti;
- percorso personalizzato;
- memoria continua;
- profondità strategica.

## ISTRUZIONE FINALE PER LO SVILUPPO
Costruisci il progetto in modo modulare, chiaro e scalabile. Parti dal problema dell’orientamento, poi aggiungi dati, curiosità, conferma utente, wiki, grafo e AI. Ogni parte deve essere pensata per trasformare l’utente da curioso a consapevole, e da consapevole a deciso.
