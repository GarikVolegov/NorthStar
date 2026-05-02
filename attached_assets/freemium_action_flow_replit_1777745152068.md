# FREEMIUM ACTION FLOW — VERSIONE FREE ATTIVA + PREMIUM PROFONDO

## Obiettivo del documento
Questo file descrive come progettare la piattaforma in modo che la versione Free non sia passiva o troppo limitata, ma permetta all’utente di compiere azioni reali, restare nel sistema e tornare nel tempo. La versione Premium deve invece sbloccare la parte più profonda, personalizzata e strategica.

## Principio generale
Il modello migliore per questo progetto è:
- Free = esplorazione + azione concreta + abitudine.
- Premium = personalizzazione completa + percorso evolutivo + memoria del percorso.

La chiave è non far sentire il Free come una demo, ma come una versione utile, interattiva e viva.

## Obiettivo del Free
Il Free deve permettere all’utente di:
- capire la propria personalità;
- esplorare settori e mestieri;
- salvare alcune preferenze;
- tornare nel sistema;
- compiere piccoli passi utili;
- percepire continuità.

## Obiettivo del Premium
Il Premium deve permettere all’utente di:
- approfondire la scelta;
- ricevere contenuti molto più mirati;
- costruire un percorso personalizzato;
- accedere a wiki, grafo e news settoriali;
- ottenere una vera guida di crescita.

## 1. VERSIONE FREE

### Funzioni principali
- Landing page.
- Test personalità breve.
- Risultato sintetico.
- Top 3 settori o mestieri consigliati.
- Motivazione del match.
- Dati base di crescita e scalabilità.
- News generiche.
- Salvataggio preferenze base.
- Mini piano iniziale.
- Possibilità di tornare e aggiornare il profilo.

### Azioni consentite nel Free
L’utente free deve poter:
- salvare settori preferiti;
- salvare mestieri preferiti;
- salvare articoli o news interessanti;
- salvare obiettivi semplici;
- creare una mini lista di esplorazione;
- aggiornare alcune risposte del test;
- vedere un primo riepilogo del proprio percorso.

### Cosa deve sembrare il Free
Il Free deve sembrare:
- utile;
- concreto;
- dinamico;
- ripetibile nel tempo;
- abbastanza ricco da creare abitudine.

### Cosa non deve fare il Free
Il Free non deve dare:
- percorsi completamente personalizzati;
- wiki personale completa;
- news specifiche del settore scelto;
- grafo avanzato;
- analisi di carriera dettagliata;
- coaching avanzato;
- roadmap lunga e strutturata.

## 2. VERSIONE PREMIUM

### Funzioni principali
- Tutte le funzioni del Free.
- Profilo completo salvato.
- News settoriali specifiche.
- Wiki personalizzata.
- Collegamento con il grafo.
- Percorso personalizzato.
- Roadmap di studio/lavoro.
- Analisi di vantaggi e svantaggi.
- Suggerimenti continui.
- Salvataggio progressi e obiettivi.

### Azioni consentite nel Premium
L’utente premium deve poter:
- scegliere un settore principale;
- vedere i sottosegmenti del settore;
- ricevere news solo su quel settore;
- consultare una wiki dedicata;
- salvare un percorso completo;
- ricevere suggerimenti contestuali;
- visualizzare step di carriera;
- monitorare i propri progressi nel tempo;
- confrontare alternative di studio e lavoro.

### Cosa deve sembrare il Premium
Il Premium deve sembrare:
- preciso;
- personale;
- continuo;
- strategico;
- capace di accompagnare davvero l’utente.

## Differenza logica tra Free e Premium
La differenza non deve essere solo nel numero di funzioni, ma nel tipo di esperienza.

### Free
- ti fa entrare;
- ti fa capire chi sei;
- ti fa esplorare;
- ti fa agire un po';
- ti fa tornare.

### Premium
- ti fa scegliere meglio;
- ti fa approfondire;
- ti fa costruire il percorso;
- ti fa seguire nel tempo;
- ti fa crescere nel sistema.

## News nel Free
Le news free devono essere generiche ma interessanti.

Categorie consigliate:
- technology;
- business;
- science;
- health;
- finance;
- education;
- general.

Il feed free deve dare all’utente un assaggio del mondo dei settori, senza legarlo ancora a una scelta troppo specifica.

## News nel Premium
Le news premium devono essere collegate al settore confermato.

Esempi:
- AI;
- cybersecurity;
- fintech;
- green economy;
- data;
- sanità digitale;
- marketing;
- logistica;
- formazione;
- ingegneria.

Le news premium devono mostrare:
- trend;
- opportunità;
- certificazioni;
- aziende;
- innovazioni;
- cambiamenti di mercato.

## Salvataggi nel Free
Per far rimanere l’utente nel sistema, il Free deve avere salvataggi semplici.

L’utente può salvare:
- preferenze;
- settori;
- mestieri;
- articoli;
- mini obiettivi;
- note personali.

Questi salvataggi devono essere visibili in una dashboard base.

## Esperienza di ritorno
Quando l’utente torna, il sistema deve dirgli:
- cosa ha già salvato;
- cosa può approfondire;
- quali nuovi contenuti sono disponibili;
- quali settori sono ancora aperti;
- perché potrebbe valere la pena esplorare il Premium.

## Dashboard Free
La dashboard free deve mostrare:
- profilo sintetico;
- top 3 settori;
- news generiche;
- elementi salvati;
- mini piano;
- invito all’upgrade.

## Dashboard Premium
La dashboard premium deve mostrare:
- settore scelto;
- news settoriali;
- wiki;
- grafo;
- roadmap;
- obiettivi;
- progressi;
- raccomandazioni avanzate.

## Architettura tecnica

### Frontend
- React o Next.js.
- Layout semplice e leggibile.
- Componenti separati per Free e Premium.

### Backend
- Node.js + Express oppure NestJS.
- API per test, profili, news, salvataggi, wiki, percorso.

### Database
- PostgreSQL per utenti, test, preferenze e salvataggi base.
- Database a grafo per relazioni settoriali e personalizzate.
- Storage file per wiki e contenuti.

### AI
- LLM per generare wiki e suggerimenti.
- LLM per spiegare i risultati.
- LLM per arricchire il percorso premium.

## Flusso utente consigliato
1. L’utente entra nel Free.
2. Compila il test.
3. Vede i risultati.
4. Salva settori e contenuti.
5. Torna nel sistema.
6. Riceve suggerimenti per l’upgrade.
7. Passa al Premium se vuole approfondire.

## Regole UX
- Il Free deve essere utile.
- Il Premium deve essere chiaramente migliore.
- L’utente non deve sentirsi forzato.
- L’utente deve avere motivi validi per tornare.
- L’upgrade deve essere percepito come naturale.

## Regole di prodotto
- Non bloccare tutte le azioni nel Free.
- Non rendere il Premium un semplice contenitore di extra marginali.
- Dare al Free un ruolo attivo.
- Dare al Premium il ruolo di profondità e continuità.

## Priorità di sviluppo
### Fase 1
- Test.
- risultati.
- salvataggi base.
- news generiche.
- dashboard free.

### Fase 2
- upgrade premium.
- news settoriali.
- wiki.
- grafo.
- roadmap.

## Obiettivo finale
Costruire una piattaforma in cui il Free permetta all’utente di restare dentro il sistema con azioni semplici ma utili, mentre il Premium gli offre il vero motore di personalizzazione, crescita e decisione.
