# NorthStar — Growth & Self-Development Hub Prompt for Replit

## Obiettivo
Aggiungere a NorthStar una nuova sezione verticale dedicata alla crescita personale, con contenuti che lo sviluppatore possiede già e che potrà continuare ad aggiornare nel tempo.

La sezione deve essere progettata come una knowledge base / hub editoriale interna, facile da mantenere, aggiornata a mano o in modo semi-automatico, e integrata nel resto del prodotto.

---

## 1. Visione del modulo

La sezione "Crescita Personale" deve diventare uno spazio stabile del prodotto in cui l'utente trova:
- contenuti di crescita personale;
- riflessioni pratiche;
- framework, esercizi e appunti;
- risorse già curate dallo sviluppatore;
- aggiornamenti futuri aggiunti in modo continuo;
- connessioni con personalità, settori, studi e obiettivi.

Questa sezione non deve sembrare un blog generico, ma una libreria organizzata di contenuti utili, collegata al profilo utente e al percorso di orientamento.

---

## 2. Obiettivo strategico

NorthStar non deve limitarsi a suggerire settori e mestieri. Deve accompagnare l'utente anche nella parte di evoluzione personale:
- consapevolezza;
- disciplina;
- focus;
- abitudini;
- identità;
- motivazione;
- equilibrio;
- obiettivi di lungo periodo.

La sezione crescita personale deve essere uno dei pilastri del prodotto, insieme a:
- orientamento;
- news;
- corsi;
- career planning;
- second brain.

---

## 3. Struttura del modulo

### 3.1 Macro categorie
Organizza i contenuti in categorie chiare:
- Autoconsapevolezza.
- Motivazione.
- Abitudini.
- Disciplina e focus.
- Gestione del tempo.
- Emozioni e mentalità.
- Obiettivi e visione.
- Resilienza.
- Comunicazione.
- Relazioni.
- Identità personale.
- Crescita professionale.
- Benessere mentale.
- Approccio al denaro.
- Carriera e scelte di vita.

### 3.2 Tipi di contenuto
Per ogni categoria inserisci:
- articoli brevi;
- guide pratiche;
- schede riassuntive;
- esercizi;
- checklist;
- riflessioni;
- citazioni o idee chiave riscritte in forma originale;
- contenuti salvabili dall'utente;
- contenuti collegati a settore e personalità.

---

## 4. Fonti dei contenuti

La sezione deve essere alimentata da due flussi:

### A. Contenuti già in possesso dello sviluppatore
Tu, come sviluppatore, potrai inserire:
- idee personali;
- appunti;
- framework di crescita;
- esperienze dirette;
- riflessioni;
- testi originali;
- schede e mini guide.

### B. Contenuti aggiornati nel tempo
In futuro potrai aggiungere:
- nuovi articoli;
- nuovi esercizi;
- nuovi temi;
- nuovi percorsi;
- nuovi contenuti generati o revisionati dall'AI;
- contenuti derivati da trend e feedback utenti.

---

## 5. Modalità di aggiornamento

Il sistema deve supportare tre livelli di aggiornamento:

### 5.1 Manuale
Lo sviluppatore inserisce nuovi contenuti direttamente nel CMS interno, nel database o nei file markdown.

### 5.2 Semi-automatico
L'AI aiuta a:
- riassumere il contenuto;
- proporre tag;
- suggerire relazioni;
- generare snippet;
- classificare il contenuto per categorie.

### 5.3 Continuo
Il sistema registra:
- contenuti più letti;
- contenuti più salvati;
- contenuti più cercati;
- contenuti che generano più interazioni.

In questo modo puoi decidere cosa aggiornare o approfondire in base all'uso reale.

---

## 6. Modello di contenuto

Ogni contenuto di crescita personale dovrebbe avere questo schema:

- id;
- titolo;
- slug;
- categoria;
- sottocategoria;
- descrizione breve;
- contenuto completo;
- tag;
- livello di profondità;
- personalità collegate;
- settori collegati;
- obiettivi collegati;
- data creazione;
- data ultimo aggiornamento;
- stato: bozza / pubblicato / archiviato.

Esempio:

```json
{
  "title": "Disciplina quotidiana",
  "category": "Abitudini",
  "tags": ["focus", "routine", "costanza"],
  "personality_matches": ["Convenzionale", "Investigativa"],
  "sector_links": ["Tecnologia", "Data", "Fintech"],
  "updated_at": "2026-05-02"
}
```

---

## 7. Integrazione nel software

### 7.1 Dove appare
La sezione crescita personale deve essere visibile in almeno questi punti:
- menu principale;
- dashboard utente;
- area Premium;
- pagine settore;
- pagine corsi;
- pagina risultati del test;
- area consigliati.

### 7.2 Come si collega
Ogni contenuto deve potersi collegare a:
- personalità RIASEC;
- Cinque Spiriti;
- settori professionali;
- mestieri;
- corsi di studio;
- obiettivi personali;
- news correlate;
- esercizi pratici.

### 7.3 Quale logica usare
Quando l'utente legge un contenuto, il sistema può suggerire:
- un altro contenuto simile;
- un settore coerente;
- un mestiere collegato;
- un esercizio pratico;
- un passo successivo nel percorso.

---

## 8. Architettura tecnica consigliata

### Frontend
- Pagina hub con card per categorie.
- Pagina elenco contenuti.
- Pagina dettaglio contenuto.
- Filtri per categoria, tag, settore e personalità.
- Salvataggio preferiti.

### Backend
- API per contenuti.
- API per categorie/tags.
- API per salvataggi utente.
- API per suggerimenti correlati.
- API per aggiornamento contenuti.

### Database
Salva per ogni contenuto:
- titolo;
- descrizione;
- testo;
- categoria;
- tag;
- relazioni;
- stato;
- data revisione;
- autore;
- visibilità.

### File system / CMS interno
Puoi iniziare con file markdown o JSON e poi migrare a un CMS più strutturato.

---

## 9. SEO della sezione crescita personale

La sezione deve essere pensata anche come motore di discoverability.

### Obiettivi SEO
- intercettare ricerche su crescita personale;
- intercettare ricerche su disciplina, abitudini, mindset, focus;
- aumentare autorevolezza del brand;
- creare topic cluster forti attorno a orientamento e sviluppo personale.

### Linee guida
- Un H1 chiaro per ogni pagina.
- Titoli descrittivi e naturali.
- Meta description uniche.
- Slug brevi.
- Link interni tra articoli, settori e corsi.
- FAQ dove utili.
- Contenuti originali, non copiati.

---

## 10. Metodo editoriale

Per mantenere la sezione viva, definisci un processo editoriale semplice:

1. Crei un contenuto originale.
2. Lo assegni a una categoria.
3. Gli dai tag e relazioni.
4. Lo pubblichi.
5. Monitori letture e salvataggi.
6. Lo aggiorni quando cambia il contesto o quando trovi un modo migliore per spiegarlo.

Puoi anche mantenere un campo:
- "last_reviewed_at";
- "next_review_due".

---

## 11. Piano di implementazione

### Fase 1 — MVP
- Creare hub crescita personale.
- Creare categorie.
- Creare 10-20 contenuti base che già possiedi.
- Creare pagina dettaglio contenuto.
- Salvare contenuti preferiti.

### Fase 2 — Integrazione intelligente
- Collegare contenuti a settori e personalità.
- Aggiungere suggerimenti correlati.
- Aggiungere ricerca interna.
- Aggiungere filtri.

### Fase 3 — Sistema vivo
- Consentire aggiornamenti continui.
- Usare AI per supporto redazionale.
- Tracciare cosa viene letto di più.
- Evidenziare contenuti più utili.

---

## 12. CTA consigliate

- Esplora la crescita personale.
- Salva questo contenuto.
- Aggiungilo al tuo percorso.
- Vedi contenuti correlati.
- Continua il tuo percorso.

---

## 13. Prompt operativo per Replit

Crea una nuova sezione all'interno di NorthStar chiamata "Crescita Personale". Questa sezione deve funzionare come una knowledge base editoriale interna, dove lo sviluppatore può caricare contenuti già posseduti e aggiornarli continuamente nel tempo.

Il sistema deve includere:
- una pagina hub con categorie;
- una pagina elenco contenuti;
- una pagina dettaglio contenuto;
- filtri per categoria, tag, settore e personalità;
- salvataggio dei contenuti preferiti;
- relazioni tra contenuti, settori, mestieri, corsi e obiettivi;
- supporto a contenuti manuali e aggiornamenti futuri.

La struttura deve essere SEO-friendly, con URL puliti, H1/H2 corretti, meta title e meta description, e link interni verso settori, test, news e pagine formative.

Il tono deve essere utile, chiaro, profondo e coerente con il brand NorthStar.

---

## 14. Obiettivo finale

L'obiettivo è creare una sezione di crescita personale che sia davvero viva, mantenibile dallo sviluppatore e utile per l'utente, così che NorthStar non sia solo un software di orientamento, ma anche un ambiente di crescita continua.
