# INTEGRAZIONE DEI CINQUE SPIRITI NEL SaaS DI ORIENTAMENTO

## Obiettivo del modulo
Integrare i Cinque Spiriti della tradizione cinese all’interno del progetto SaaS per rendere il sistema più profondo, differenziante e capace di leggere l’utente non solo come profilo di personalità, ma anche come equilibrio interno tra volontà, mente, visione, sensibilità e coscienza.

L’integrazione deve essere semplice da usare per l’utente finale e utile per il motore di raccomandazione della piattaforma.

## Cosa sono i Cinque Spiriti
Nel progetto i Cinque Spiriti vengono trattati come un secondo strato di analisi della personalità.

I cinque elementi sono:
- Shen: coscienza, presenza, chiarezza emotiva.
- Hun: visione, immaginazione, direzione futura.
- Po: istinto, percezione corporea, energia immediata.
- Yi: concentrazione, logica, memoria, attenzione.
- Zhi: volontà, resilienza, tenacia, capacità di portare a termine.

Questi cinque elementi non devono essere presentati come verità assolute, ma come una metafora strutturata e affascinante per aiutare l’utente a capire il proprio funzionamento interiore.

## Perché inserirli nel progetto
L’integrazione dei Cinque Spiriti è utile per tre motivi principali:

1. Aumenta la profondità del test di personalità.
2. Aggiunge un elemento distintivo rispetto ai competitor tradizionali.
3. Permette di collegare lo stato interno dell’utente con i settori e i mestieri più adatti.

Questo rende il sistema più memorabile e più coerente con l’idea di orientamento evolutivo.

## Ruolo nel flusso utente
Il flusso completo può essere:

1. Test RIASEC breve.
2. Test Cinque Spiriti.
3. Output combinato con profilo personale.
4. Suggerimento dei top 3 settori o mestieri.
5. Presentazione dei dati concreti.
6. Scelta finale dell’utente.
7. Creazione del percorso personalizzato nella versione premium.

Il test dei Cinque Spiriti non sostituisce il test RIASEC, ma lo completa.

## Come usarli nel prodotto
I Cinque Spiriti possono essere usati in tre aree diverse.

### 1. Test di ingresso
Dopo il test RIASEC, l’utente risponde a 5 domande rapide, una per ciascuno spirito.

### 2. Motore di raccomandazione
I risultati vengono trasformati in punteggi che aiutano a scegliere settori e mestieri compatibili.

### 3. Wiki e percorsi premium
Ogni spirito può avere una pagina wiki dedicata, con esercizi, spiegazioni e suggerimenti di crescita personale.

## Domande base del test
Ecco una possibile prima versione delle domande:

- Shen: Ti senti spesso chiaro e centrato nelle emozioni?
- Hun: Riesci a immaginare con facilità il tuo futuro ideale?
- Po: Senti forte il corpo e l’energia quando fai ciò che ti piace?
- Yi: Ti riesce facile concentrare l’attenzione su studio e analisi?
- Zhi: Porti avanti le decisioni anche quando diventano difficili?

Ogni risposta può avere un punteggio da 1 a 5.

## Logica di scoring
Il sistema può calcolare per ogni spirito:
- punteggio totale;
- livello basso, medio o alto;
- relazione con i settori consigliati.

Esempio:
- Zhi alto: buono per percorsi che richiedono perseveranza, disciplina e costruzione a lungo termine.
- Yi alto: buono per analisi, studio, dati, finanza, tecnica.
- Hun alto: buono per visione, imprenditoria, creatività, innovazione.
- Shen alto: buono per relazioni, coaching, benessere, leadership equilibrata.
- Po alto: buono per attività pratiche, sportive, corporee o operative.

## Collegamento con i settori
I Cinque Spiriti vanno collegati al database dei settori e dei mestieri.

Esempio di associazione:
- Zhi forte → AI, cybersecurity, imprenditoria, finanza di lungo termine.
- Yi forte → data analysis, ricerca, programmazione, auditing, finanza tecnica.
- Hun forte → startup, product design, marketing creativo, innovazione.
- Shen forte → coaching, salute, formazione, relazioni, leadership umana.
- Po forte → mestieri manuali, sport, costruzione, attività pratiche, artigianato evoluto.

Questa mappatura deve essere dinamica e modificabile nel tempo.

## Integrazione con il grafo
Nel grafo vanno creati questi nodi:
- Spirito
- TestSpirito
- RisultatoSpirito
- Settore
- Mestiere
- PersonalitàRIASEC
- Utente
- DocumentoWiki
- Esercizio

Relazioni possibili:
- utente ha risultato
- risultato indica spirito alto
- spirito è adatto a settore
- spirito è utile per mestiere
- documento wiki spiega spirito
- esercizio allena spirito

Esempio:
- Utente123 → ha risultato → Zhi alto
- Zhi alto → è utile per → AI Engineer
- Zhi alto → è utile per → Project Manager
- Zhi alto → collegato a → pagina wiki “Volontà e Disciplina”

## Integrazione con la wiki LLM
Ogni spirito deve avere una pagina in wiki con:
- spiegazione semplice;
- significato pratico;
- livello alto / medio / basso;
- esercizi da fare;
- settori e mestieri suggeriti;
- rischi di squilibrio;
- consigli per migliorarlo.

La wiki può anche contenere pagine ibride, ad esempio:
- “Zhi e carriera tecnica”
- “Yi e lavoro analitico”
- “Hun e imprenditoria creativa”
- “Shen e leadership personale”
- “Po e lavoro pratico”

## Integrazione con l’AI
L’AI deve leggere il profilo dell’utente e spiegare in modo semplice il significato dei risultati.

L’output AI deve dire, per esempio:
- “Hai una forte volontà, quindi ti potrebbero piacere percorsi dove i risultati arrivano nel medio-lungo termine.”
- “La tua concentrazione analitica ti rende compatibile con mestieri basati su dati, metodo e precisione.”
- “La tua visione futura è forte: questo può aiutarti in contesti imprenditoriali o creativi.”

L’AI non deve usare un tono mistico eccessivo. Deve essere chiara, concreta e utile.

## UX suggerita
Per l’utente il modulo deve apparire come una seconda bussola.

Nome possibile della sezione:
- Bussola Interiore
- Seconda Bussola
- Equilibrio Interno
- Mappa dei Cinque Spiriti

La schermata risultati dovrebbe mostrare:
- punteggio dei 5 spiriti;
- spirito dominante;
- spirito secondario;
- settori suggeriti;
- motivazione;
- call to action per approfondire.

## Uso nella versione free e premium
### Free
- Test base dei Cinque Spiriti.
- Risultati sintetici.
- 1 o 2 suggerimenti di settore.

### Premium
- Analisi completa.
- Collegamento con wiki.
- Percorso di crescita personalizzato.
- Esercizi per rafforzare uno o più spiriti.
- Integrazione con il grafo.
- Raccomandazioni AI più profonde.

## Benefici strategici
Questa integrazione può aiutare il progetto a:
- distinguersi sul mercato;
- dare una dimensione più umana e filosofica;
- creare curiosità nell’utente;
- aumentare la percezione di profondità;
- migliorare conversione verso il premium.

## Nota importante di prodotto
I Cinque Spiriti devono essere presentati come un modello interpretativo e non come una diagnosi scientifica. Il tono deve essere rispettoso, interessante e utile.

## Priorità di sviluppo
Ordine consigliato:
1. Aggiungere le 5 domande nel test.
2. Creare scoring e output.
3. Collegare risultati a settori e mestieri.
4. Aggiungere pagine wiki dedicate.
5. Integrare il grafo.
6. Collegare il tutto all’AI.

## Obiettivo finale
L’integrazione dei Cinque Spiriti deve aiutare l’utente a capire meglio se stesso e a trovare percorsi professionali e di vita più coerenti con la propria energia interiore, mantenendo il progetto utile, originale e facilmente monetizzabile.
