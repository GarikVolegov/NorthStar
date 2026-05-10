# NorthStar — Prompt per Replit: Integrazione Mestieri Autonomi e Scelta Lavoro Autonomo / Dipendente

## Obiettivo
Integrare in NorthStar una logica chiara che permetta all'utente di scegliere tra:
- lavoro dipendente;
- lavoro autonomo;
- freelance;
- imprenditorialità / attività indipendente.

Il sistema deve mostrare opzioni, mestieri e percorsi coerenti con la preferenza selezionata, così da offrire orientamento realistico e personalizzato.

---

## 1. Visione del modulo

NorthStar deve aiutare l'utente non solo a capire *quale mestiere* gli si addice, ma anche *in quale forma di lavoro* si sente più a suo agio.

La piattaforma deve quindi distinguere tra:
- **Dipendente**: lavora per un'azienda o un ente, con contratto e struttura organizzata.
- **Autonomo / Freelance**: lavora in modo indipendente, con clienti o progetti.
- **Imprenditore / Self-employed**: costruisce una propria attività, eventualmente con team, servizi o prodotti.

L'utente deve poter selezionare una preferenza iniziale o ricevere una raccomandazione basata sul test di personalità, per poi confrontarla con il mercato reale.

---

## 2. Obiettivi funzionali

Il modulo deve:
- raccogliere la preferenza dell'utente tra autonomo e dipendente;
- proporre mestieri coerenti con quella preferenza;
- spiegare vantaggi e svantaggi di ciascun modello;
- mostrare step di carriera realistici;
- collegare il modello di lavoro a settori, corsi e personalità;
- supportare sia utenti orientati alla stabilità sia utenti orientati alla libertà.

---

## 3. Tipologie di lavoro da supportare

### A. Lavoro dipendente
Caratteristiche:
- contratto con azienda o ente;
- orari e responsabilità più strutturati;
- percorso di carriera più lineare;
- maggiore prevedibilità.

### B. Lavoro autonomo / freelance
Caratteristiche:
- scelta autonoma dei clienti o dei progetti;
- maggiore libertà organizzativa;
- richiesta di capacità commerciali;
- gestione personale di tasse, fatturazione e clienti.

### C. Self-employed / imprenditoriale
Caratteristiche:
- attività indipendente;
- possibilità di costruire servizi, studio, brand o team;
- maggiore potenziale di scala;
- maggiore complessità gestionale.

---

## 4. Scelta iniziale dell'utente

Durante il test o subito dopo il risultato, NorthStar deve chiedere all'utente:

**Domanda base:**
> Preferisci un lavoro dipendente o un lavoro autonomo?

### Possibili risposte
- Voglio un lavoro dipendente.
- Voglio un lavoro autonomo / freelance.
- Voglio un mix.
- Non lo so ancora.

### Caso "non lo so ancora"
Il sistema deve mostrare un confronto semplice con:
- livello di libertà;
- livello di stabilità;
- rischio economico;
- bisogno di clienti;
- crescita possibile;
- compatibilità con la personalità.

---

## 5. Logica di personalizzazione

La scelta tra autonomo e dipendente deve influire su:
- ranking dei mestieri;
- suggerimenti di carriera;
- tipologia di percorsi formativi;
- news mostrate;
- consigli di crescita personale;
- esempi di step futuri.

### Esempio
Se l'utente sceglie "autonomo", il sistema deve privilegiare mestieri come:
- consulente;
- designer freelance;
- sviluppatore freelance;
- marketer indipendente;
- fotografo;
- copywriter;
- formatore;
- personal trainer;
- commercialista indipendente;
- professionista sanitario con studio proprio, dove consentito.

Se l'utente sceglie "dipendente", il sistema deve privilegiare:
- ruoli in azienda;
- posizioni junior / mid / senior;
- percorsi di crescita interna;
- ruoli con struttura organizzata e benefit.

---

## 6. Struttura dati consigliata

Ogni mestiere deve contenere un campo che indichi la modalità di lavoro.

### Esempio schema
```json
{
  "title": "Graphic Designer",
  "sector": "Design e Creatività",
  "work_mode": ["dipendente", "autonomo"],
  "personality_match": ["Artistico", "Imprenditoriale"],
  "skills": ["creatività", "Adobe Suite", "portfolio"],
  "advantages": ["flessibilità", "domanda trasversale"],
  "disadvantages": ["competizione", "portfolio necessario"],
  "career_steps": ["junior", "mid", "senior", "art director"],
  "freelance_steps": ["clienti piccoli", "portfolio forte", "studio proprio"],
  "salary_model": "varies",
  "autonomy_level": 8,
  "stability_level": 5
}
```

### Campi consigliati aggiuntivi
- work_mode: dipendente / autonomo / entrambi;
- autonomy_score;
- stability_score;
- client_acquisition_required;
- bureaucracy_level;
- scalability_potential;
- portfolio_required;
- remote_friendly;
- suitable_for_beginners.

---

## 7. Classificazione dei mestieri

### A. Mestieri soprattutto dipendenti
- HR Specialist.
- Supply Chain Analyst.
- Data Analyst in azienda.
- Project Manager.
- Business Analyst.
- Customer Success Manager.
- Product Specialist.
- Security Analyst.

### B. Mestieri soprattutto autonomi
- consulente indipendente;
- freelancer creativo;
- coach / formatore;
- copywriter;
- social media specialist indipendente;
- fotografo;
- videomaker;
- consulente fiscale / commerciale indipendente dove previsto;
- sviluppatore freelance;
- personal trainer.

### C. Mestieri ibridi
- commercialista;
- designer;
- sviluppatore;
- marketer;
- consulente;
- formatore;
- architetto;
- psicologo / professioni regolamentate dove possibile;
- project specialist;
- content creator professionale.

---

## 8. UX della scelta

Il modulo deve presentare la scelta in modo semplice e non giudicante.

### Sezione comparativa
Mostrare:
- Libertà;
- Stabilità;
- Guadagno potenziale;
- Rischio;
- Gestione clienti;
- Orari;
- Crescita;
- Complessità amministrativa.

### Obiettivo UX
L'utente deve capire qual è il modello più adatto per il suo carattere, il suo momento di vita e la sua tolleranza al rischio.

---

## 9. Collegamento con il test personalità

Il test RIASEC e i Cinque Spiriti devono influenzare la scelta.

### Possibili correlazioni
- **Imprenditoriale**: spesso più adatto ad autonomia o self-employment.
- **Convenzionale**: spesso più adatto a dipendente con struttura definita.
- **Artistico**: spesso aperto a freelance o ibrido.
- **Investigativo**: può funzionare sia dipendente sia indipendente, a seconda del settore.
- **Sociale**: può andare bene in entrambe le forme, ma cambia il contesto.

Il sistema non deve decidere in modo rigido, ma mostrare il livello di compatibilità.

---

## 10. Collegamento con i percorsi formativi

Anche i corsi devono mostrare la loro coerenza rispetto al modello lavorativo.

### Esempio
- Un corso universitario può essere presentato come adatto sia a dipendente sia ad autonomo.
- Un corso tecnico rapido può essere più adatto a freelance o a lavoro operativo.
- Un master può essere collegato alla crescita in azienda o alla consulenza indipendente.

Il sistema deve quindi mostrare per ogni corso:
- sbocco dipendente;
- sbocco autonomo;
- sbocco ibrido.

---

## 11. Modello di contenuti per i mestieri autonomi

Per ogni mestiere autonomo il sistema dovrebbe mostrare:
- cosa fa il professionista;
- come trova clienti;
- quali strumenti usa;
- quanto è difficile iniziare;
- che tipo di personalità lo supporta;
- quali step può fare nel tempo;
- quali rischi ha.

### Esempio di contenuto
**Mestiere: Copywriter Freelance**
- settore: marketing e contenuti;
- modalità: autonomo;
- personalità adatta: artistico, investigativo, imprenditoriale;
- vantaggi: flessibilità, lavoro remoto, scalabilità;
- svantaggi: client acquisition, continuità dei progetti, concorrenza;
- step: portfolio → piccoli clienti → nicchia → tariffe più alte → team o agenzia.

---

## 12. Integrazione nel motore di matching

Quando l'utente seleziona "autonomo" o "dipendente", il motore deve:
1. filtrare i mestieri;
2. ricalcolare il ranking;
3. mostrare i percorsi più coerenti;
4. evidenziare i pro e contro;
5. suggerire gli step successivi.

### Regole di ranking
- Se l'utente vuole stabilità, aumentare il peso dei lavori dipendenti.
- Se l'utente vuole libertà, aumentare il peso dei lavori autonomi.
- Se l'utente è incerto, proporre opzioni ibride.

---

## 13. Integrazione con news e contenuti

### Free
- news generiche sul mondo del lavoro.
- contenuti base su autonomia vs dipendenza.

### Premium
- news specifiche su professioni indipendenti.
- guide su freelancing, self-employment e carriera in azienda.
- percorsi e casi studio per chi vuole cambiare modello lavorativo.

---

## 14. Architettura tecnica consigliata

### Frontend
- Toggle o step di scelta: dipendente / autonomo / entrambi.
- Card dei mestieri con badge del modello di lavoro.
- Filtri nel catalogo mestieri.
- Pagina confronto vantaggi / svantaggi.

### Backend
- API per la preferenza di work mode.
- API per filtrare i mestieri per modalità di lavoro.
- API per mostrare confronto personalizzato.

### Database
Campi da salvare per utente:
- work_preference;
- stability_preference;
- autonomy_preference;
- ideal_work_mode;
- compatible_jobs;
- saved_jobs;
- saved_paths.

---

## 15. Prompt operativo per Replit

Aggiungi a NorthStar una funzione che permetta all'utente di scegliere se vuole orientarsi verso un lavoro dipendente, autonomo, freelance o imprenditoriale.

Il sistema deve:
- raccogliere la preferenza dell'utente in fase di onboarding o subito dopo il test;
- filtrare i mestieri in base alla modalità di lavoro;
- mostrare vantaggi e svantaggi di ciascun modello;
- distinguere i ruoli soprattutto dipendenti, soprattutto autonomi e ibridi;
- collegare la scelta a personalità, settori, corsi e percorsi di carriera;
- salvare la preferenza nel profilo utente;
- aggiornare i suggerimenti della dashboard di conseguenza.

L'interfaccia deve essere semplice, chiara e non giudicante. L'utente deve poter confrontare i due modelli e scegliere quello più adatto a lui, con la possibilità di cambiare preferenza in qualsiasi momento.

---

## 16. Obiettivo finale

NorthStar deve diventare una piattaforma capace di orientare non solo verso un mestiere, ma anche verso il giusto modo di lavorare, aiutando l'utente a capire se è più adatto a un percorso da dipendente, autonomo o ibrido.
