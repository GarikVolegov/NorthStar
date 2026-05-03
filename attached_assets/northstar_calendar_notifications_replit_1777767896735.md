# NorthStar — Prompt per Replit: Calendario Organizzativo + Notifiche Personalizzate

## Obiettivo
Integrare in NorthStar un calendario organizzativo dedicato ai programmi lavorativi e formativi, capace di:
- pianificare attività, corsi, tappe di carriera e scadenze;
- inviare notifiche personalizzate;
- adattare i reminder alle preferenze dell'utente;
- supportare il percorso di studio e lavoro in modo continuativo.

Il calendario deve essere uno strumento operativo, non solo visivo: l'utente deve poter creare eventi, assegnare priorità, ricevere promemoria e monitorare il proprio percorso nel tempo.

---

## 1. Visione del modulo

Il calendario di NorthStar deve diventare il centro organizzativo dei programmi di:
- studio;
- formazione;
- ricerca lavoro;
- crescita personale;
- obiettivi professionali;
- step di carriera.

L'obiettivo è far sì che l'utente non si limiti a leggere informazioni, ma possa trasformarle in azioni concrete e programmabili.

---

## 2. Funzioni principali

### A. Gestione eventi
L'utente deve poter creare eventi come:
- lezioni;
- esami;
- colloqui;
- scadenze;
- sessioni di studio;
- attività di formazione;
- task personali;
- follow-up con aziende o enti.

Ogni evento deve includere:
- titolo;
- descrizione;
- data;
- ora;
- durata;
- categoria;
- priorità;
- collegamento a settore, corso o obiettivo;
- stato (da fare, in corso, completato, rinviato).

### B. Programmi e piani
Il calendario deve permettere di creare piani più lunghi, per esempio:
- programma di 7 giorni;
- piano mensile;
- percorso trimestrale;
- roadmap annuale.

### C. Notifiche personalizzate
Le notifiche devono essere:
- basate sul tempo;
- basate sull'azione;
- personalizzate per l'utente;
- configurabili nel numero e nel momento di invio.

---

## 3. Tipi di notifiche

### Notifiche temporali
Invio automatico:
- 24 ore prima;
- 2 ore prima;
- 30 minuti prima;
- 10 minuti prima.

### Notifiche di follow-up
Invio dopo un evento o una milestone:
- "Hai completato il modulo?";
- "Vuoi segnare questo compito come finito?";
- "È il momento di passare al prossimo step".

### Notifiche comportamentali
Invio quando l'utente:
- non accede da un po';
- salta un'attività;
- non completa un piano;
- salva un obiettivo ma non lo attiva.

### Notifiche intelligenti
Invio in base a:
- priorità dell'evento;
- abitudini dell'utente;
- tipologia di percorso;
- orario preferito;
- dispositivo usato;
- comportamento precedente.

---

## 4. Regole di personalizzazione

Le notifiche non devono essere tutte uguali. Devono cambiare in base a:
- piano Free o Premium;
- tipo di percorso scelto;
- settore di interesse;
- corso di studio;
- obiettivo selezionato;
- fascia oraria preferita;
- frequenza di interazione dell'utente.

### Esempio di personalizzazione
- Utente orientato al lavoro: reminder più orientati a colloqui, candidature e task operativi.
- Utente orientato allo studio: reminder più orientati a lezioni, esercizi, esami e revisione.
- Utente orientato alla crescita personale: reminder su routine, riflessioni, focus e abitudini.

---

## 5. Interazione con il resto del prodotto

Il calendario deve essere collegato a:
- test personalità;
- settori professionali;
- corsi;
- news;
- crescita personale;
- obiettivi;
- seconda brain / wiki;
- percorso Premium.

### Esempio di integrazione
Se l'utente sceglie il settore "Data & Analytics", il sistema può suggerire:
- eventi di studio su SQL, Python, statistica;
- reminder per esercitazioni;
- notifiche per news rilevanti;
- task di completamento modulo;
- follow-up sui progressi.

---

## 6. Struttura dati consigliata

Ogni evento nel calendario dovrebbe avere questo schema:

```json
{
  "id": "evt_001",
  "title": "Studia SQL",
  "description": "Sessione di 45 minuti sul modulo base",
  "date": "2026-05-04",
  "time": "18:00",
  "duration_minutes": 45,
  "category": "study",
  "priority": "high",
  "status": "todo",
  "sector": "Data & Analytics",
  "course": "SQL Basics",
  "goal_id": "goal_123",
  "reminders": [
    { "minutes_before": 1440 },
    { "minutes_before": 120 },
    { "minutes_before": 30 }
  ]
}
```

### Campi utili aggiuntivi
- is_recurring;
- recurrence_rule;
- color;
- notes;
- tags;
- linked_news_ids;
- linked_content_ids.

---

## 7. Notifiche: canali consigliati

La piattaforma può usare:
- notifiche in-app;
- email;
- push browser;
- eventualmente SMS o WhatsApp in una fase successiva.

### Priorità canali
1. In-app per la dashboard.
2. Email per promemoria importanti.
3. Push browser per urgenze o reminder veloci.
4. Canali esterni solo se autorizzati e utili.

---

## 8. UX del calendario

### Vista principale
Il calendario deve mostrare:
- mese / settimana / giorno;
- eventi con colori diversi;
- priorità;
- stato dell'attività;
- eventuali icone per reminder attivi.

### Elementi utili
- pulsante "Aggiungi evento";
- filtro per categoria;
- filtro per settore;
- filtro per stato;
- sezione "prossimi eventi";
- sezione "obiettivi collegati".

### Obiettivo UX
L'utente deve capire in un attimo:
- cosa deve fare;
- quando deve farlo;
- perché conta;
- quali passi sono già completati.

---

## 9. Logica di reminder

### Requisiti
- Evitare spam.
- Evitare notifiche inutili.
- Rispetto del fuso orario dell'utente.
- Configurazione flessibile.
- Possibilità di silenziare o rinviare notifiche.

### Best practice operative
- Reminder brevi e chiari.
- Linguaggio diretto.
- Una sola azione per notifica.
- Timing strategico in base al tipo di evento.
- Frequenza diversa per eventi ad alta e bassa priorità.

---

## 10. Architettura tecnica consigliata

### Frontend
- componente calendario;
- componente form evento;
- componente reminder settings;
- widget prossimi eventi;
- widget obiettivi collegati.

### Backend
- API eventi;
- API reminder;
- API programmi;
- API notifiche;
- job scheduler;
- log eventi notifiche.

### Database
Tabelle o collezioni consigliate:
- users;
- calendar_events;
- reminders;
- programs;
- notifications_log;
- goals;
- linked_entities.

### Scheduler
Usare un job scheduler per:
- controllare gli eventi imminenti;
- generare notifiche nel momento giusto;
- evitare duplicati;
- gestire reminder ricorrenti.

---

## 11. Regole di business

1. Un utente può creare eventi manuali.
2. Un utente può accettare eventi suggeriti dal sistema.
3. Ogni evento può avere più reminder.
4. Ogni reminder deve poter essere modificato o disattivato.
5. Gli eventi possono essere collegati a corsi, obiettivi e contenuti.
6. Il sistema deve tenere traccia di notifiche inviate, aperte e completate.

---

## 12. Integrazione con Free e Premium

### Free
- calendario base;
- pochi eventi;
- reminder essenziali;
- eventuali suggerimenti semplici;
- vista limitata ma utile.

### Premium
- calendario completo;
- programmi lavorativi/formativi;
- reminder avanzati;
- automazioni;
- collegamenti a wiki, corsi e percorsi;
- notifiche personalizzate per settori e obiettivi.

---

## 13. SEO e contenuto

La pagina del calendario può essere ottimizzata per keyword come:
- calendario organizzativo studio lavoro;
- agenda formazione personale;
- reminder percorsi formativi;
- calendario obiettivi carriera;
- app orientamento con notifiche.

La pagina deve spiegare bene il valore pratico del calendario, senza risultare generica.

---

## 14. Prompt operativo per Replit

Crea in NorthStar un modulo calendario organizzativo per programmi lavorativi e formativi.

Il modulo deve consentire all'utente di:
- creare eventi manuali;
- gestire scadenze, lezioni, esami, colloqui e task;
- collegare gli eventi a corsi, settori e obiettivi;
- ricevere notifiche personalizzate via in-app, email e push browser;
- configurare più reminder per ogni evento;
- visualizzare il calendario in vista mese, settimana e giorno;
- tracciare eventi completati, rinviati o in corso.

Il sistema deve includere:
- modello dati per eventi e reminder;
- scheduler per notifiche;
- dashboard con prossimi eventi;
- integrazione con il profilo utente;
- collegamento con il piano Free e Premium;
- UX chiara e moderna.

Il calendario deve essere un elemento centrale del percorso utente: non solo agenda, ma motore operativo della crescita personale, dello studio e della carriera.

---

## 15. Obiettivo finale

L'obiettivo è trasformare NorthStar in una piattaforma che non si limita a consigliare, ma aiuta davvero l'utente ad agire, rispettando i tempi, le priorità e il percorso che ha scelto.
