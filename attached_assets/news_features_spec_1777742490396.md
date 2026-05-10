# SPECIFICA FUNZIONALITÀ NEWS — SaaS ORIENTAMENTO

## Scopo
Questa sezione descrive in modo preciso come sviluppare le funzionalità di notizie della piattaforma SaaS.

L’obiettivo è avere due livelli di esperienza:
- Free: notizie generiche, panoramiche e utili a tutti.
- Premium: notizie specifiche per il settore o mestiere scelto dall’utente.

Il sistema deve essere semplice, veloce, scalabile e facile da mantenere.

## Obiettivi prodotto
Le news devono servire a:
- aumentare il valore percepito della piattaforma;
- mantenere l’utente attivo;
- far percepire che il sistema è aggiornato;
- incuriosire l’utente sui settori;
- supportare il processo decisionale;
- collegare notizie, settori e percorsi formativi.

## Differenza tra Free e Premium

### Free
- news generiche;
- su più categorie;
- poco personalizzate;
- utili per esplorare il mondo del lavoro e dei settori;
- visibili subito dopo il test o nella dashboard base.

### Premium
- news collegate al settore scelto;
- news collegate al mestiere scelto;
- filtri per località, ruolo, trend, certificazioni, aziende;
- alert e riepiloghi;
- collegamento con il grafo e la wiki;
- maggiore profondità.

## Categorie Free
Le news free devono usare categorie semplici e standard.

Categorie consigliate:
- general;
- business;
- technology;
- science;
- health;
- finance;
- education.

La piattaforma può mostrare 2 o 3 news per categoria oppure un feed misto con priorità alle categorie più rilevanti per l’orientamento.

## Settori Premium
Le news premium devono essere filtrate in base al settore scelto dall’utente.

Settori iniziali consigliati:
- AI;
- data science;
- cybersecurity;
- fintech;
- green energy;
- healthcare digitale;
- e-commerce;
- marketing;
- robotica;
- turismo evoluto;
- educazione;
- finanza personale.

## Funzioni del modulo news
Il modulo deve includere:
- recupero news da API esterne;
- normalizzazione dei dati;
- classificazione per categoria o settore;
- ranking per rilevanza;
- visualizzazione in dashboard;
- salvataggio delle news lette o preferite;
- possibile notifica o alert.

## Struttura dati consigliata
Ogni news deve avere almeno questi campi:
- id;
- titolo;
- descrizione breve;
- fonte;
- link;
- data pubblicazione;
- categoria;
- settore;
- tag;
- livello di rilevanza;
- tipo piano: free o premium.

## Flusso Free
### Passaggi
1. Utente entra nella piattaforma.
2. Fa il test.
3. Riceve il risultato.
4. Vede la dashboard free.
5. La dashboard mostra news generiche.

### Obiettivo UX
Le news free devono far capire che il mondo del lavoro è ampio e in movimento.
Non devono essere troppo tecniche, ma abbastanza interessanti da spingere alla curiosità.

## Flusso Premium
### Passaggi
1. Utente conferma settore o mestiere.
2. Il sistema salva la scelta.
3. La dashboard premium mostra news pertinenti.
4. Le news sono collegate alla wiki e al grafo.
5. L’utente può approfondire o salvare.

### Obiettivo UX
L’utente deve pensare: “Questa piattaforma mi aggiorna davvero sul mio percorso.”

## API news
Per il modulo news si consiglia di usare una API esterna con supporto a:
- categorie;
- keyword;
- lingua italiana;
- eventuale data filtering;
- possibilmente fonti affidabili.

## Suggerimento tecnico
Usare un livello di astrazione unico nel backend:
- `getFreeNews()` per le categorie generiche;
- `getSectorNews(sector)` per le notizie premium;
- `rankNewsByRelevance()` per ordinare i risultati;
- `normalizeNews()` per standardizzare i dati.

## Logica di filtro
### Free
- filtrare per categoria;
- eliminare duplicati;
- limitare il numero di articoli;
- mantenere varietà.

### Premium
- filtrare per settore specifico;
- filtrare per ruolo o mestiere;
- preferire articoli recenti;
- dare priorità a news che parlano di opportunità, trend, certificazioni, aziende, innovazione.

## Collegamento con il grafo
Le news possono diventare nodi del grafo.

Relazioni possibili:
- news riguarda settore;
- news riguarda mestiere;
- news riguarda competenza;
- news è utile per utente;
- news è collegata a documento wiki;
- news supporta obiettivo.

Questo permette di usare le news non solo come contenuto da leggere, ma come parte attiva del sistema di raccomandazione.

## Collegamento con la wiki
Le news premium dovrebbero poter rimandare a:
- una pagina wiki;
- una competenza correlata;
- un esercizio utile;
- una roadmap di studio o carriera.

Esempio:
- news su un nuovo trend AI → link alla pagina wiki “Come iniziare in AI” → link al corso consigliato.

## UI consigliata
### Free dashboard
- 4 o 5 card di news generiche;
- titolo;
- fonte;
- categoria;
- bottone “leggi di più”.

### Premium dashboard
- news per settore;
- news per ruolo;
- news salvate;
- news consigliate;
- alert;
- collegamenti a wiki e grafo.

## Metriche da monitorare
- click sulle news;
- tempo di permanenza;
- percentuale di lettura completa;
- news salvate;
- conversione free → premium;
- aumento di ritorno giornaliero.

## Roadmap di sviluppo per le news
### Fase 1
- integrare news free;
- visualizzare 3-5 categorie;
- creare layout dashboard.

### Fase 2
- salvare preferenze utente;
- permettere news preferite;
- introdurre ricerca base.

### Fase 3
- aggiungere news premium per settore;
- collegamento con grafo;
- collegamento con wiki.

### Fase 4
- alert;
- newsletter;
- raccomandazioni intelligenti;
- ranking AI.

## Regole di qualità
Le news devono essere:
- aggiornate;
- leggibili;
- pertinenti;
- non spammy;
- utili per orientamento;
- facilmente filtrabili.

## Priorità di sviluppo consigliata
1. News free generiche.
2. Dashboard con feed base.
3. Salvataggio preferenze.
4. News premium per settore.
5. Collegamento al grafo.
6. Collegamento alla wiki.
7. Alert e personalizzazione avanzata.

## Obiettivo finale del modulo news
Il modulo news deve trasformare la piattaforma da semplice test di orientamento a strumento vivo e aggiornato che mostra all’utente come i settori cambiano, dove si trovano le opportunità e perché vale la pena approfondire un percorso specifico.
