# NorthStar — Prompt per Replit: Sistema Multi-Agentico

## Obiettivo
Integrare in NorthStar un sistema multi-agentico capace di gestire in modo specializzato le funzioni più complesse della piattaforma.

Il sistema deve essere progettato per supportare:
- orientamento personalizzato;
- analisi di settori e mestieri;
- news generiche e settoriali;
- crescita personale;
- calendari e notifiche;
- percorsi formativi;
- supporto a Free e Premium;
- contenuti, matching e raccomandazioni.

L'architettura deve essere semplice da mantenere, scalabile e costruita attorno a ruoli ben definiti.

---

## 1. Principio architetturale

NorthStar deve usare un sistema multi-agentico **specializzato**, non un singolo agente onnisciente.

Ogni agente deve avere:
- una responsabilità chiara;
- un input ben definito;
- un output strutturato;
- regole di fallback;
- accesso solo ai dati necessari.

Questo riduce confusione, costi, errori e comportamenti incoerenti.

---

## 2. Perché usarlo in NorthStar

NorthStar contiene più domini diversi:
- personalità;
- settori professionali;
- mestieri;
- corsi;
- news;
- crescita personale;
- calendario;
- affiliazione istituzionale;
- lavoro autonomo/dipendente;
- contenuti istituzionali.

Un sistema multi-agentico è adatto perché permette di dividere il lavoro in moduli specialistici che collaborano tra loro.

---

## 3. Ruoli degli agenti

### 3.1 Orchestrator Agent
È il supervisore centrale.

Compiti:
- ricevere la richiesta utente;
- capire quale sottosistema coinvolgere;
- distribuire i task;
- raccogliere i risultati;
- unificare la risposta finale.

Non deve fare analisi profonde da solo, ma coordinare gli altri agenti.

### 3.2 Personality Agent
Compiti:
- analizzare il test;
- interpretare RIASEC;
- interpretare i Cinque Spiriti;
- produrre un profilo sintetico.

Output:
- personalità principali;
- predisposizioni;
- punti di forza;
- punti di attenzione.

### 3.3 Sector Agent
Compiti:
- analizzare i settori;
- valutare crescita, rischi, scalabilità;
- proporre settori coerenti con il profilo utente.

### 3.4 Profession Agent
Compiti:
- analizzare i mestieri all'interno dei settori;
- distinguere mestieri dipendenti, autonomi e ibridi;
- collegare ogni mestiere a competenze, vantaggi e svantaggi.

### 3.5 Education Agent
Compiti:
- analizzare corsi universitari e non universitari;
- suggerire percorsi formativi;
- spiegare step di carriera e sbocchi.

### 3.6 News Agent
Compiti:
- selezionare news generiche per il Free;
- selezionare news settoriali per il Premium;
- collegare news a settori, mestieri e interessi.

### 3.7 Growth Agent
Compiti:
- gestire la sezione crescita personale;
- suggerire contenuti, esercizi, abitudini e riflessioni;
- collegare crescita personale e obiettivi professionali.

### 3.8 Calendar Agent
Compiti:
- creare eventi;
- gestire programmi lavorativi/formativi;
- coordinare reminder e notifiche;
- adattare il calendario agli obiettivi dell'utente.

### 3.9 Affiliation Agent
Compiti:
- gestire il canale istituzionale;
- proporre NorthStar a scuole, università, agenzie e centri di formazione;
- preparare materiali, CTA e follow-up.

### 3.10 Work Mode Agent
Compiti:
- distinguere tra lavoro dipendente, autonomo, freelance e imprenditoriale;
- adattare il ranking dei mestieri alla preferenza dell'utente;
- proporre confronti semplici e realistici.

---

## 4. Architettura consigliata

### Pattern da usare
Per NorthStar il pattern più adatto è:
- **Orchestrator + specialist workers**.

Opzionalmente puoi aggiungere:
- workflow sequenziali per i test;
- route-based routing per news, corsi e mestieri;
- evaluator/validator per controllare la qualità dei risultati.

### Flusso ideale
1. L'utente fa una richiesta.
2. L'orchestrator capisce il tipo di task.
3. Chiama uno o più agenti specializzati.
4. Ogni agente restituisce un output strutturato.
5. Un validator controlla coerenza e qualità.
6. L'orchestrator costruisce la risposta finale.

---

## 5. Stato condiviso e memoria

Il sistema deve usare uno stato condiviso, ma con regole chiare.

### Dati che possono stare nello stato globale
- profilo utente;
- test completati;
- settori selezionati;
- mestieri salvati;
- corsi preferiti;
- preferenza dipendente/autonomo;
- piano attivo;
- calendario;
- obiettivi;
- contenuti salvati.

### Regola fondamentale
Ogni agente deve leggere e scrivere solo i campi di cui è responsabile.

### Esempio di namespace
- `/profile`
- `/personality`
- `/sectors`
- `/jobs`
- `/education`
- `/news`
- `/growth`
- `/calendar`
- `/affiliation`
- `/work_mode`

Questo evita caos, overwrite e conflitti tra agenti.

---

## 6. Output strutturato

Ogni agente deve rispondere in JSON o in uno schema prevedibile.

### Esempio output agente
```json
{
  "agent": "sector_agent",
  "status": "ok",
  "summary": "I 3 settori più coerenti sono...",
  "items": [
    {
      "name": "Cybersecurity",
      "score": 92,
      "reason": "Alta compatibilità con profilo investigativo e convenzionale"
    }
  ],
  "next_actions": ["show_jobs", "show_courses"]
}
```

Questo rende più facile orchestrazione, debug e test.

---

## 7. Regole di progettazione

### Single responsibility
Ogni agente deve fare una sola cosa principale.

### Routing chiaro
L'orchestrator deve decidere rapidamente chi chiamare.

### Fallback
Se un agente fallisce:
- usare risposta parziale;
- riprovare una volta;
- mostrare fallback umano o contenuto statico.

### Validazione
Prima di mostrare il risultato finale, un agente validator deve controllare:
- coerenza;
- completezza;
- presenza di campi obbligatori;
- assenza di conflitti.

---

## 8. Integrazione nei moduli NorthStar

### A. Test e orientamento
- Personality Agent
- Sector Agent
- Profession Agent
- Work Mode Agent

### B. News
- News Agent
- Sector Agent come supporto semantico

### C. Corsi e carriera
- Education Agent
- Profession Agent
- Sector Agent

### D. Crescita personale
- Growth Agent
- Personality Agent

### E. Calendario
- Calendar Agent
- Education Agent
- Work Mode Agent

### F. Affiliazione istituzionale
- Affiliation Agent
- Sector Agent
- Education Agent

---

## 9. Free vs Premium nel sistema agentico

### Free
- routing semplice;
- output sintetici;
- pochi agenti attivi;
- suggerimenti base.

### Premium
- più agenti coinvolti;
- analisi più ricca;
- memoria più profonda;
- suggerimenti contestuali;
- step di carriera, corsi, news e calendario più precisi.

---

## 10. Logging e osservabilità

Il sistema deve registrare:
- quale agente è stato chiamato;
- input sintetico;
- output;
- tempo di risposta;
- eventuale errore;
- eventuale retry;
- qualità del risultato.

### Perché è importante
Ti permette di:
- correggere agenti deboli;
- ottimizzare costi;
- capire dove il sistema fallisce;
- migliorare progressivamente il flusso.

---

## 11. Tecnologie consigliate

### Backend
- Node.js / TypeScript.
- API per orchestrazione.
- Job scheduler per attività ricorrenti.

### AI layer
- orchestrator centrale;
- agenti specialistici;
- validator;
- memory store.

### Storage
- PostgreSQL per dati utente e configurazioni;
- vettoriale per knowledge base semantica;
- eventualmente grafo per relazioni complesse.

---

## 12. Prompt operativo per Replit

Integra in NorthStar un sistema multi-agentico con orchestratore centrale e agenti specialistici.

L'architettura deve includere almeno questi agenti:
- Personality Agent;
- Sector Agent;
- Profession Agent;
- Education Agent;
- News Agent;
- Growth Agent;
- Calendar Agent;
- Affiliation Agent;
- Work Mode Agent;
- Validator Agent;
- Orchestrator Agent.

Ogni agente deve avere:
- un compito specifico;
- input e output strutturati;
- accesso limitato ai dati necessari;
- regole di fallback;
- logging delle attività.

L'orchestrator deve:
- ricevere la richiesta;
- decidere quali agenti chiamare;
- unificare le risposte;
- produrre un output finale chiaro per l'utente.

Il sistema deve essere integrato nei moduli di:
- test personalità;
- settori;
- mestieri;
- news;
- corsi;
- crescita personale;
- calendario;
- affiliazione;
- lavoro autonomo/dipendente.

Il risultato deve essere scalabile, testabile, e adatto a evolvere con NorthStar.

---

## 13. Obiettivo finale

NorthStar deve diventare una piattaforma multi-agentica in cui ogni parte del prodotto è gestita da un agente specializzato, coordinato da un orchestratore, così da offrire risposte più precise, flussi più robusti e un'esperienza utente più intelligente.
