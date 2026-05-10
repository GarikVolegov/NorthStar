import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const articles = [
  {
    title: "Conoscere i tuoi valori prima di scegliere",
    slug: "conoscere-i-tuoi-valori",
    category: "autoconsapevolezza",
    description: "Senza sapere cosa conta davvero per te, ogni scelta diventa una scommessa. Ecco come identificare i tuoi valori fondamentali.",
    content: `I valori sono la bussola interna che guida ogni decisione, anche quando non ce ne accorgiamo. Eppure la maggior parte delle persone non sa nominarli con precisione.

## Perché i valori contano

Quando prendiamo decisioni in contrasto con i nostri valori — anche inconsciamente — proviamo disagio, stanchezza o senso di vuoto. Quando invece le nostre scelte li rispettano, c'è una coerenza interna che si traduce in energia e chiarezza.

Il problema è che spesso *crediamo* di sapere cosa vogliamo, ma in realtà stiamo inseguendo i valori di qualcun altro: la famiglia, la società, i colleghi.

## Come identificare i tuoi valori reali

**1. Osserva quando ti senti vivo**
In quali momenti della settimana senti che stai usando qualcosa di autentico? Che lavoro stai facendo, che relazioni stai vivendo?

**2. Osserva quando ti arrabbi o ti svuoti**
La rabbia e la demotivazione sono segnali di violazione dei valori. Se lavori in un contesto caotico e questo ti pesa enormemente, forse ordine e struttura sono valori centrali per te.

**3. Fai la lista dei 10 valori**
Scrivi 10 cose che per te sono irrinunciabili. Poi eliminane 5. Poi ancora 2. I 3 che rimangono sono probabilmente il tuo nucleo.

**4. Controlla la tua agenda**
Come usi davvero il tempo? Spesso la differenza tra i valori dichiarati e quelli reali è visibile nell'agenda settimanale.

## Valori e orientamento

I valori non sono solo una questione filosofica. Influenzano direttamente:
- il tipo di lavoro in cui puoi prosperare;
- l'ambiente professionale che ti si addice;
- i conflitti che emergeranno se ignori questa bussola.

Una volta chiari, possono guidare la scelta del settore, del ruolo, del tipo di azienda — molto più efficacemente di qualsiasi ranking salariale.

## Esercizio pratico

Questa settimana, alla fine di ogni giornata, scrivi una frase: *"Oggi ho agito in coerenza con i miei valori quando..."* e una seconda: *"Oggi ho tradito qualcosa di importante quando..."*

Dopo 7 giorni, leggi tutto. I pattern che emergono ti diranno molto di più di qualsiasi test di personalità.`,
    tags: ["valori", "identità", "scelte", "autoconsapevolezza"],
    difficulty: "base",
    personality_matches: ["investigativa", "artistica"],
    sector_links: ["Psicologia e scienze umane", "Formazione"],
    read_time_minutes: 5,
  },
  {
    title: "Il punto cieco: cosa non vedi di te stesso",
    slug: "il-punto-cieco",
    category: "autoconsapevolezza",
    description: "Tutti abbiamo zone d'ombra che influenzano le nostre decisioni. Capire dove sono è il primo passo per superarle.",
    content: `Ogni persona ha un punto cieco — un'area della propria personalità, del proprio comportamento o dei propri schemi mentali che non riesce a vedere, ma che è perfettamente visibile agli altri.

## La finestra di Johari

Il modello della finestra di Johari divide la conoscenza di sé in quattro quadranti:
- **Aperto**: ciò che sai di te e che gli altri sanno
- **Nascosto**: ciò che sai di te ma non mostri agli altri
- **Cieco**: ciò che gli altri vedono di te ma tu non vedi
- **Ignoto**: ciò che né tu né gli altri conoscete ancora

Il quadrante cieco è il più insidioso. Non possiamo migliorare qualcosa che non vediamo.

## Come ridurre il punto cieco

**1. Chiedi feedback specifici**
Non "come mi vedi?" ma "quando lavoriamo insieme, noti qualcosa che rallenta la mia efficacia?" Le domande specifiche ottengono risposte utili.

**2. Osserva le reazioni degli altri**
Le persone spesso reagiscono ai nostri punti ciechi prima che noi li vediamo. Quando qualcuno sembra sorpreso da una nostra risposta, c'è un segnale.

**3. Tieni un diario delle reazioni**
Scrivi le situazioni in cui ti sei sentito frainteso. In molti casi, i pattern rivelano dove è il tuo punto cieco.

**4. Cerca un confronto con qualcuno di fiducia**
Non un validatore, ma qualcuno che possa dirti la verità con rispetto.

## Il vantaggio dell'autoconsapevolezza

Chi lavora sui propri punti ciechi prende decisioni più accurate, gestisce meglio le relazioni e impara più velocemente dagli errori.`,
    tags: ["autoconsapevolezza", "feedback", "crescita", "punti ciechi"],
    difficulty: "intermedio",
    personality_matches: ["sociale", "investigativa"],
    sector_links: ["Psicologia e scienze umane", "Comunicazione e media"],
    read_time_minutes: 5,
  },
  {
    title: "La motivazione che dura: oltre la spinta iniziale",
    slug: "motivazione-che-dura",
    category: "motivazione",
    description: "L'entusiasmo del primo giorno svanisce sempre. Ecco come costruire una motivazione che regge nel tempo.",
    content: `La motivazione è spesso descritta come una scintilla — qualcosa che si accende e poi, se va bene, continua a bruciare. Ma chiunque abbia provato a mantenere un progetto sul lungo periodo sa che non funziona così.

## Il problema della motivazione a picco

La maggior parte delle persone aspetta di *sentirsi* motivata per iniziare. Il risultato: l'azione dipende dall'umore, dall'energia, dalle circostanze. Nei momenti difficili — e ci saranno sempre — la motivazione sparisce proprio quando serve di più.

## Motivazione estrinseca vs intrinseca

La motivazione estrinseca è guidata da ricompense esterne: soldi, approvazione, premi. Funziona nel breve periodo, ma si esaurisce.

La motivazione intrinseca nasce dall'interno: curiosità, crescita, senso di padronanza, significato. È più stabile e più potente una volta costruita.

## Come costruire motivazione duratura

**1. Connetti l'azione al perché profondo**
Non "voglio diventare programmatore perché si guadagna bene" ma "voglio costruire strumenti che risolvono problemi reali". Il perché profondo regge quando le cose si fanno difficili.

**2. Progetta piccole vittorie**
Il cervello rilascia dopamina quando completa task. Spezza i progetti grandi in sotto-obiettivi raggiungibili.

**3. Crea sistemi, non solo obiettivi**
Gli obiettivi dicono dove vuoi arrivare. I sistemi determinano se ci arriverai.

**4. Gestisci l'identità**
"Voglio correre tre volte a settimana" ha meno forza di "sono una persona che si prende cura del proprio corpo".

## Il ruolo dell'ambiente

L'ambiente è il fattore più sottovalutato nella motivazione. Rendi visibili e accessibili le cose che vuoi fare. Rendi difficili e invisibili le distrazioni.`,
    tags: ["motivazione", "abitudini", "sistemi", "identità"],
    difficulty: "base",
    personality_matches: ["realistica", "imprenditoriale"],
    sector_links: ["Formazione", "Psicologia e scienze umane"],
    read_time_minutes: 5,
  },
  {
    title: "Il sistema delle abitudini: piccole azioni, grandi risultati",
    slug: "sistema-delle-abitudini",
    category: "abitudini",
    description: "Non sono i grandi cambiamenti improvvisi che trasformano una vita, ma le piccole azioni ripetute ogni giorno con intenzione.",
    content: `Le abitudini sono il software del cervello. Una volta installate, girano in background senza consumare attenzione consapevole.

## Come funziona un'abitudine

Il loop dell'abitudine ha tre componenti:
- **Segnale** (cue): il trigger che attiva il comportamento
- **Routine**: il comportamento automatico
- **Ricompensa**: il rinforzo che consolida il loop

## Il principio dell'1%

Migliorare dell'1% ogni giorno sembra irrilevante. Ma 1,01 elevato a 365 fa 37,78. Peggiorare dell'1% ogni giorno porta a 0,03.

Le abitudini lavorano per composizione — come gli interessi sul capitale.

## Come costruire nuove abitudini

**1. Inizia in piccolo — più piccolo di quanto pensi**
Se vuoi iniziare a meditare, inizia da 2 minuti. Il punto è diventare il tipo di persona che medita ogni mattina.

**2. Usa l'habit stacking**
Collega la nuova abitudine a una già esistente. "Dopo che mi faccio il caffè, scrivo 3 priorità per oggi."

**3. Progetta l'ambiente**
Metti il libro sul cuscino se vuoi leggere prima di dormire. Prepara le scarpe da ginnastica la sera.

**4. Traccia la sequenza**
Non spezzare la catena. Ogni giorno che completi l'abitudine, segna una X sul calendario.

**5. Non saltare mai due volte**
Saltare una volta è umano. Saltare due volte è l'inizio di una nuova abitudine negativa.

## Abitudini e identità

Le abitudini più solide non sono basate su obiettivi ma su identità. Ogni comportamento è un voto per il tipo di persona che stai diventando.`,
    tags: ["abitudini", "sistemi", "routine", "disciplina"],
    difficulty: "base",
    personality_matches: ["convenzionale", "realistica"],
    sector_links: ["Sport e benessere", "Formazione"],
    read_time_minutes: 5,
  },
  {
    title: "Perché le abitudini falliscono (e come rilanciarle)",
    slug: "perche-le-abitudini-falliscono",
    category: "abitudini",
    description: "La maggior parte delle abitudini muore entro 3 settimane. Capire perché è il primo passo per costruirne di durature.",
    content: `Ogni anno, miliardi di persone si propongono nuove abitudini. La stragrande maggioranza le abbandona entro 3 settimane. Non è una questione di forza di volontà: è una questione di design.

## I motivi principali di fallimento

**1. Troppo, troppo in fretta**
Il cervello resiste al cambiamento. Cambiare 5 abitudini contemporaneamente quasi sempre porta al collasso.

**2. Obiettivi senza sistemi**
"Voglio essere più in forma" non è un sistema. "Faccio 20 minuti di camminata ogni mattina dopo la doccia" è un sistema.

**3. Dipendenza dalla motivazione**
Se fai un'abitudine solo quando ti va, non stai costruendo un'abitudine — stai solo facendo qualcosa ogni tanto.

**4. Nessun piano per le ricadute**
Molte persone non pianificano cosa fare quando mancano un giorno. La risposta corretta è: riprendo domani.

**5. Ricompense troppo lontane**
Il cervello risponde meglio alle ricompense immediate.

## Come rilanciare abitudini fallite

**Passo 1: Ridimensiona, non ripartire da zero**
Se fallivi correndo 5km al giorno, riparti da 10 minuti.

**Passo 2: Identifica il punto di rottura**
Quando esattamente hai smesso? Spesso c'è un fattore esterno — non mancanza di volontà.

**Passo 3: Riduci l'attrito al minimo**
L'abitudine deve essere impossibile da non fare.

**Passo 4: Connettila a qualcosa che ami**
Ascolta il podcast che ti piace solo mentre cammini.

**Passo 5: Cambia il linguaggio interno**
Da "devo farlo" a "lo faccio perché è quello che faccio".`,
    tags: ["abitudini", "ricadute", "resilienza", "sistemi"],
    difficulty: "intermedio",
    personality_matches: ["realistica", "convenzionale"],
    sector_links: ["Formazione", "Sport e benessere"],
    read_time_minutes: 5,
  },
  {
    title: "La disciplina non è forza di volontà: è progettazione",
    slug: "disciplina-come-progettazione",
    category: "disciplina-e-focus",
    description: "Smetti di combattere contro te stesso. La vera disciplina si costruisce progettando un sistema in cui le scelte giuste sono le più facili.",
    content: `C'è un mito molto diffuso: le persone di successo hanno più forza di volontà. La realtà è diversa. Le persone che sembrano più disciplinate spesso lavorano di meno contro se stesse — perché hanno progettato un ambiente in cui le scelte difficili diventano naturali.

## La forza di volontà è una risorsa limitata

La ricerca sulla fatica decisionale mostra che ogni scelta che prendiamo erode la capacità di prendere buone scelte successive. I giudici sono più clementi al mattino. I chirurghi più attenti nelle prime ore.

Non è debolezza morale: è biologia.

## La disciplina come architettura

**Ambiente fisico:**
- Metti sul tavolo quello su cui vuoi lavorare, non quello che ti distrae
- Tieni il telefono fuori dalla stanza mentre lavori
- Prepara la sera cosa ti serve il mattino

**Ambiente digitale:**
- Disabilita le notifiche non essenziali
- Usa blocchi temporali per i siti che ti distraggono

**Ambiente sociale:**
- Frequenta persone che fanno già quello che vuoi fare
- Dichiara pubblicamente i tuoi impegni

## Il ruolo delle routine

Le routine eliminano le decisioni. Quando le stesse azioni vengono eseguite alla stessa ora, nello stesso ordine, smettono di richiedere deliberazione.

## Disciplina vs autocoercizione

C'è una differenza fondamentale tra:
- **Disciplina**: strutture che supportano chi vuoi essere
- **Autocoercizione**: punizione per chi sei

La prima ti porta avanti. La seconda ti esaurisce.`,
    tags: ["disciplina", "focus", "sistemi", "ambiente", "forza di volontà"],
    difficulty: "intermedio",
    personality_matches: ["investigativa", "convenzionale"],
    sector_links: ["Tecnologia e digitale", "Finanza e fintech"],
    read_time_minutes: 5,
  },
  {
    title: "Time blocking: come strutturare le tue giornate",
    slug: "time-blocking",
    category: "gestione-del-tempo",
    description: "Il time blocking non è un modo per fare di più — è un modo per fare le cose giuste, senza disperdere energia in mille direzioni.",
    content: `La maggior parte delle persone gestisce il tempo in modo reattivo: risponde alle email appena arrivano, va alle riunioni quando qualcuno le convoca, riempie i vuoti con le urgenze altrui.

Il time blocking capovolge questa logica: pianifica prima ciò che conta, poi il resto.

## Cos'è il time blocking

Il time blocking significa assegnare ogni ora della giornata a una specifica attività. Non una to-do list, ma un calendario in cui ogni blocco di tempo ha uno scopo definito.

Esempi:
- 08:00–10:00 → Lavoro profondo (nessuna interruzione)
- 10:00–10:30 → Email e messaggi
- 14:00–16:00 → Progetto prioritario

## Perché funziona

**1. Rende visibile la realtà**
Quando pianifichi il tempo, ti accorgi che 24 ore sono poche — e quindi sei costretto a scegliere cosa conta davvero.

**2. Protegge il lavoro profondo**
Il lavoro più importante raramente è urgente. Senza blocchi protetti, le urgenze altrui colonizzano le ore migliori.

**3. Riduce le decisioni**
Sapere già cosa farai alle 9 elimina la microfatica di dover decidere ogni mattina.

## Come iniziare

**Settimana 1**: Osserva come usi il tempo senza cambiare nulla.
**Settimana 2**: Pianifica solo i 3 blocchi più importanti.
**Settimana 3**: Aggiungi blocchi per email, riunioni, recupero.

## Gli errori comuni

- Blocchi troppo ottimistici: prevedi sempre il 20% in più
- Nessun buffer tra i blocchi
- Ignorare l'energia: metti il lavoro impegnativo nelle ore migliori`,
    tags: ["tempo", "produttività", "focus", "pianificazione"],
    difficulty: "base",
    personality_matches: ["convenzionale", "investigativa"],
    sector_links: ["Tecnologia e digitale", "Economia e management"],
    read_time_minutes: 5,
  },
  {
    title: "Mindset fisso vs mindset di crescita",
    slug: "mindset-fisso-vs-crescita",
    category: "emozioni-e-mentalita",
    description: "Come interpreti le tue capacità determina quanto puoi svilupparle. Ecco come trasformare il modo in cui guardi le difficoltà.",
    content: `Carol Dweck, psicologa di Stanford, ha studiato per decenni cosa distingue i maestri dai mediocri. La conclusione è semplice ma rivoluzionaria: ciò che credi di poter essere determina in larga misura ciò che riesci a diventare.

## I due mindset

**Mindset fisso**: Le capacità sono innate e immutabili. Il fallimento è una prova dei tuoi limiti.

**Mindset di crescita**: Le capacità si sviluppano con impegno e feedback. Il fallimento è informazione.

## Come si manifesta nella vita reale

*Ricevi un feedback critico sul tuo lavoro:*

- **Mindset fisso**: "Non sono bravo abbastanza per questo."
- **Mindset di crescita**: "Cos'esattamente non ha funzionato? Come posso migliorare?"

*Incontri una difficoltà in un nuovo progetto:*

- **Mindset fisso**: "Non sono fatto per questo."
- **Mindset di crescita**: "Non l'ho ancora capito. Di cosa ho bisogno?"

## Come coltivare il mindset di crescita

**1. Trasforma il "non posso" in "non posso ancora"**
Aggiungere "ancora" sposta il focus da uno stato fisso a un processo in corso.

**2. Reinterpreta la difficoltà**
La fatica cognitiva è spesso un segnale che il cervello sta costruendo nuove connessioni.

**3. Apprezza il processo, non solo il risultato**
Celebra l'impegno e il progresso, non solo i successi finali.

**4. Cerca il feedback attivamente**
Non aspettare che arrivi — chiedilo.

## La regola delle 10.000 ore (riveduta)

Non è il tempo totale che conta, ma le ore di pratica intenzionale. Un'ora di pratica deliberata vale più di 10 di esercizio automatico.`,
    tags: ["mindset", "crescita", "credenze", "apprendimento"],
    difficulty: "base",
    personality_matches: ["investigativa", "artistica", "sociale"],
    sector_links: ["Formazione", "Psicologia e scienze umane"],
    read_time_minutes: 6,
  },
  {
    title: "Obiettivi che reggono: come definire cosa vuoi davvero",
    slug: "obiettivi-che-reggono",
    category: "obiettivi-e-visione",
    description: "La maggior parte degli obiettivi si sgonfiano dopo poche settimane. Ecco come costruirne di solidi, concreti e motivanti.",
    content: `Gli obiettivi falliscono quasi sempre per lo stesso motivo: sono stati definiti male. Vaghi, scollegati da ciò che conta, privi di un piano concreto.

## Il problema degli obiettivi standard

*"Voglio avere successo"* — cosa significa esattamente?
*"Voglio dimagrire"* — quanto? in quanto tempo?
*"Voglio guadagnare di più"* — di quanto? facendo cosa?

La vaghezza permette di rimandare a tempo indeterminato.

## La struttura di un obiettivo solido

- **Specifico**: Cosa esattamente? Con chi? Dove?
- **Misurabile**: Come sai quando l'hai raggiunto?
- **Motivante**: Perché ti importa? Cosa cambia nella tua vita?
- **Con scadenza**: Entro quando?
- **Con sistema**: Quali azioni concrete ogni settimana?

## L'obiettivo vs il sistema

Un obiettivo è la destinazione. Un sistema è la strada. Puoi fissare l'obiettivo di correre una maratona — ma è l'allenamento settimanale che ti ci porta.

## La domanda dei 10 anni

Quando ti senti bloccato, chiediti: *"Tra 10 anni, sarò contento di aver lavorato su questo?"*

Se la risposta è no, potrebbe non essere il tuo obiettivo — potrebbe essere quello di qualcun altro.

## Revisione trimestrale

Ogni 3 mesi:
- Sto avanzando?
- Questo obiettivo rispecchia ancora cosa voglio?
- Cosa devo cambiare nel sistema?

La flessibilità non è debolezza — è capacità di rispondere alla realtà.`,
    tags: ["obiettivi", "visione", "pianificazione", "sistemi"],
    difficulty: "base",
    personality_matches: ["imprenditoriale", "convenzionale"],
    sector_links: ["Economia e management", "Formazione"],
    read_time_minutes: 5,
  },
  {
    title: "Fallire bene: come trasformare gli errori in risorse",
    slug: "fallire-bene",
    category: "resilienza",
    description: "Fallire non è il problema — è il modo in cui reagiamo al fallimento che determina se cresciamo o ci blocchiamo.",
    content: `La cultura del successo ha creato un paradosso: celebriamo i risultati, ma quasi mai il processo — inclusi gli errori che lo compongono. Eppure ogni persona di alto livello ti dirà: i fallimenti sono stati le lezioni più preziose.

## Il costo del fallimento non elaborato

Quando non processiamo un fallimento in modo sano:
- **Lo neghiamo**: "Non è andata male, è che gli altri non hanno capito"
- **Lo generalizziamo**: "Sono un fallito" invece di "ho fallito in questo"
- **Lo evitiamo**: smettiamo di rischiare per non rischiare di fallire ancora

Tutte e tre le risposte ci bloccano.

## Fallire bene: le 4 fasi

**Fase 1: Sentire senza giudicare**
Dai spazio all'emozione. Delusione e frustrazione sono reazioni normali.

**Fase 2: Analizzare senza difendersi**
- Cosa non ha funzionato?
- Cosa era sotto il mio controllo?
- Cosa avrei potuto fare diversamente?

**Fase 3: Estrarre la lezione**
Ogni fallimento contiene almeno un'informazione utile. Scrivila.

**Fase 4: Reimpostare e riprendere**
Con la lezione in mano, definisci il passo successivo — non il piano intero, il passo successivo.

## La differenza tra fallimento e sconfitta

Un fallimento è un evento. Una sconfitta è una scelta — quella di non rialzarsi.

La resilienza non è l'assenza di dolore: è la capacità di rimanere in movimento nonostante il dolore.`,
    tags: ["resilienza", "fallimento", "crescita", "errori"],
    difficulty: "intermedio",
    personality_matches: ["imprenditoriale", "artistica", "investigativa"],
    sector_links: ["Economia e management", "Psicologia e scienze umane"],
    read_time_minutes: 6,
  },
  {
    title: "Ascolto attivo: la skill più sottovalutata",
    slug: "ascolto-attivo",
    category: "comunicazione",
    description: "La maggior parte di noi ascolta per rispondere, non per capire. Imparare ad ascoltare davvero cambia le relazioni e le trattative.",
    content: `Se chiedi a chiunque "sai ascoltare?", la risposta sarà quasi sempre sì. Ma l'ascolto attivo è rarissimo — e il motivo è che è molto più difficile di quanto sembra.

## Cosa non è ascolto attivo

**Non è aspettare il proprio turno per parlare.** Mentre l'altro parla, la maggior parte di noi sta già formulando la risposta.

**Non è accordarsi.** Puoi ascoltare profondamente qualcuno senza condividere le sue opinioni.

**Non è fare molte domande.** Le domande possono interrompere il flusso.

## Cos'è l'ascolto attivo

L'ascolto attivo è la capacità di ricevere ciò che l'altro sta dicendo — parole, emozioni, sottotesti — senza filtri immediati di giudizio.

Richiede:
- **Presenza fisica**: corpo orientato, contatto visivo naturale
- **Presenza mentale**: mente nel momento presente
- **Sospensione del giudizio**: differire le valutazioni
- **Rispecchiamento**: riformulare per verificare la comprensione

## Le tecniche

**Riformulazione**: "Se ho capito bene, stai dicendo che..." Questo fa sentire l'interlocutore compreso.

**Domande aperte**: Invece di "hai avuto problemi?", prova "com'è andata?"

**Silenzio attivo**: Non riempire ogni silenzio. Le cose più importanti arrivano dopo una pausa.

## Perché è una competenza professionale

Chi sa ascoltare davvero:
- costruisce fiducia più in fretta
- negozia più efficacemente
- gestisce meglio i conflitti
- riceve informazioni più accurate

In ogni ambito — vendita, leadership, medicina, insegnamento — l'ascolto separa i bravi dai grandi.`,
    tags: ["comunicazione", "ascolto", "relazioni", "soft skills"],
    difficulty: "base",
    personality_matches: ["sociale", "artistica"],
    sector_links: ["Comunicazione e media", "Psicologia e scienze umane", "Economia e management"],
    read_time_minutes: 5,
  },
  {
    title: "Identità vs ruolo: chi sei davvero?",
    slug: "identita-vs-ruolo",
    category: "identita-personale",
    description: "Tendiamo a confondere chi siamo con cosa facciamo. Questa confusione crea fragilità. Separare identità e ruolo è liberatorio.",
    content: `"Cosa fai?" è la domanda più comune quando conosciamo qualcuno. E quasi sempre la risposta diventa la risposta a "chi sei?" — lavoro, titolo, ruolo familiare.

Il problema: i ruoli cambiano, le identità no.

## La trappola dell'identità di ruolo

Quando sei *il medico*, *il direttore*, *il genitore* — e basta — ogni minaccia a quel ruolo diventa una minaccia alla tua identità.

Perdi il lavoro? Perdi te stesso. I figli crescono? Perdi il tuo senso di scopo.

Questo meccanismo causa depressione, burnout e crisi di mezza età.

## La distinzione fondamentale

**Ruolo**: ciò che fai in un contesto specifico.
**Identità**: il nucleo stabile di chi sei — valori, qualità, modo di relazionarsi al mondo.

L'identità sopravvive ai ruoli.

## Come costruire un'identità robusta

**1. Definisci i tuoi valori fondamentali**
Non cosa fai, ma cosa guida il modo in cui lo fai: integrità, curiosità, cura, creatività.

**2. Distingui i tuoi attributi dai tuoi risultati**
Sei paziente, curioso, determinato — indipendentemente da cosa hai ottenuto finora.

**3. Riconosci i ruoli come espressioni dell'identità**
Il tuo ruolo professionale è un modo di esprimere chi sei — non è chi sei.

**4. Coltiva più dimensioni**
Chi costruisce identità in una sola area è più vulnerabile. L'identità ricca ha molte radici.

## Identità e orientamento

Comprendere la propria identità è il primo passo per un orientamento professionale autentico. Il lavoro che ti si addice è quello che ti permette di esprimere chi sei.`,
    tags: ["identità", "ruolo", "autoconsapevolezza", "valori"],
    difficulty: "intermedio",
    personality_matches: ["artistica", "investigativa", "sociale"],
    sector_links: ["Psicologia e scienze umane", "Formazione"],
    read_time_minutes: 5,
  },
  {
    title: "L'apprendimento deliberato: come imparare più in fretta",
    slug: "apprendimento-deliberato",
    category: "crescita-professionale",
    description: "Non basta fare esperienza: bisogna allenarsi ai bordi delle proprie capacità, con feedback immediato e intenzione precisa.",
    content: `Il ricercatore Anders Ericsson ha studiato per decenni cosa distingue i maestri dai mediocri. La sua conclusione ha cambiato il modo in cui pensiamo all'apprendimento.

## Esperienza ≠ competenza

Controintuitivamente, fare la stessa cosa per molti anni non porta necessariamente all'eccellenza. Se fai sempre le stesse cose, nello stesso modo, il cervello entra in modalità automatica. Smette di imparare.

## Cos'è la pratica deliberata

La pratica deliberata ha queste caratteristiche:

**1. Lavora ai bordi delle tue capacità**
Né troppo facile (nessuna crescita) né troppo difficile (frustrazione). Il punto ottimale è leggermente oltre la tua zona di comfort.

**2. Focus su debolezze specifiche**
Non "esercitarsi genericamente", ma identificare l'area specifica che non funziona.

**3. Feedback immediato**
Sapere subito se stai facendo bene è fondamentale. Senza feedback, l'allenamento rinforza anche i pattern sbagliati.

**4. Intenzione consapevole**
Ogni sessione ha un obiettivo preciso. Non si va in automatico.

## Come applicarla

- **Identifica i sub-skill**: ogni competenza complessa è fatta di sotto-competenze.
- **Cerca feedback rapido**: chi può darti un riscontro onesto e specifico?
- **Esci dalla zona di conforto**: cerca situazioni che mettono alla prova le aree deboli.

## La regola delle 10.000 ore (corretta)

Non è il tempo totale che conta, ma le ore di pratica deliberata. Un'ora intenzionale vale più di 10 automatiche.`,
    tags: ["apprendimento", "competenze", "crescita professionale", "pratica"],
    difficulty: "intermedio",
    personality_matches: ["investigativa", "realistica"],
    sector_links: ["Tecnologia e digitale", "Formazione", "Ricerca e innovazione"],
    read_time_minutes: 6,
  },
  {
    title: "Il recupero come strategia: ricaricare le energie non è pigrizia",
    slug: "recupero-come-strategia",
    category: "benessere-mentale",
    description: "In una cultura che glorifica il burnout, imparare a recuperare è un atto radicale — e una delle competenze più importanti per performare nel lungo periodo.",
    content: `C'è una credenza diffusa e pericolosa: più lavori, più produci. La realtà è quasi sempre l'opposto. Oltre un certo soglia, ogni ora in più abbassa la qualità del lavoro.

## Cosa succede senza recupero

Il cervello in deficit di recupero:
- prende decisioni più impulsive e meno accurate
- perde creatività e pensiero laterale
- diventa più irritabile e reattivo

Il corpo in deficit di recupero:
- produce più cortisolo (stress cronico)
- abbassa la risposta immunitaria

## I tipi di recupero

**Recupero fisico**: Sonno (il più importante), riposo muscolare, nutrizione.

**Recupero cognitivo**: Pause dal focus intenso, attività senza schermi.

**Recupero emotivo**: Tempo con persone che ricaricano, attività che danno gioia.

**Recupero sociale**: A seconda del profilo, può essere solitudine o connessione.

## La scienza del recupero

Gli studi sui violinisti di élite mostrano che praticavano in media 4 ore al giorno — di intensità estrema — seguite da recupero deliberato. Non 8 ore di lavoro mediocre.

## Recupero pratico

**Pause brevi**: Ogni 90 minuti di lavoro, una pausa di 10-15 minuti. Non al telefono.

**Sonno**: 7-9 ore. Non è negoziabile per la performance cognitiva.

**Giornate di scarico**: Almeno un giorno a settimana senza lavoro pesante.

## Il paradosso della produttività

Chi lavora 10 ore al giorno senza recupero spesso produce meno di chi lavora 6 ore con recupero strategico. La stanchezza non è un badge d'onore.`,
    tags: ["benessere", "recupero", "energia", "performance", "burnout"],
    difficulty: "base",
    personality_matches: ["realistica", "sociale", "investigativa"],
    sector_links: ["Sport e benessere", "Psicologia e scienze umane"],
    read_time_minutes: 6,
  },
  {
    title: "Scegliere il proprio percorso senza rimpianti",
    slug: "scegliere-il-percorso",
    category: "carriera-e-scelte-di-vita",
    description: "Le scelte di carriera più difficili non sono tra una cosa buona e una cattiva — sono tra due cose entrambe valide. Ecco come orientarsi.",
    content: `Bronnie Ware, infermiera che ha lavorato con persone in fase terminale, ha raccolto i rimpianti più comuni. Il numero uno: *"Vorrei aver avuto il coraggio di vivere una vita fedele a me stesso, non la vita che gli altri si aspettavano da me."*

Questo rimpianto arriva da una serie di piccole scelte — o non-scelte — accumulate nel tempo.

## Perché le scelte di percorso sono così difficili

**L'ambiguità non si risolve con più informazioni**
Puoi analizzare all'infinito un'opzione di carriera senza mai avere la certezza che sia quella giusta. A un certo punto, l'informazione non aiuta più — serve l'azione.

**Il costo opportunità è sempre presente**
Ogni sì a qualcosa è un no a qualcos'altro. L'accettazione di questo fatto è necessaria per scegliere senza tormentarti.

**Le aspettative esterne sono rumore potente**
Famiglia, cultura, pari — tutti emanano segnali su cosa "dovresti" fare.

## Un framework per scegliere

**1. Separa cosa vuoi fare da cosa credi di dover fare**
Scrivi due liste separate. Quanto della seconda lista è davvero tua?

**2. Usa il criterio del "sarò contento tra 10 anni"**
Non "sarò ricco" o "sarò approvato" — ma contento.

**3. Distingui reversibile da irreversibile**
La maggior parte delle scelte di carriera sono più reversibili di quanto sembri.

**4. Scegli per espansione, non per evitamento**
Le scelte migliori vengono dalla curiosità e dall'attrazione — non dalla paura di sbagliare.

**5. Agisci prima di essere certo**
La chiarezza arriva spesso dopo il primo passo, non prima.

## Il percorso non è una linea retta

Si costruisce scegliendo, imparando, adattando. Non esiste una scelta definitiva — esiste il coraggio di fare la prossima.`,
    tags: ["carriera", "scelte", "valori", "rimpianti", "orientamento"],
    difficulty: "base",
    personality_matches: ["artistica", "investigativa", "imprenditoriale"],
    sector_links: ["Psicologia e scienze umane", "Economia e management"],
    read_time_minutes: 6,
  },
];

let inserted = 0;
for (const a of articles) {
  try {
    await client.query(
      `INSERT INTO growth_articles (title, slug, category, description, content, tags, difficulty, personality_matches, sector_links, status, read_time_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10)
       ON CONFLICT (slug) DO NOTHING`,
      [a.title, a.slug, a.category, a.description, a.content,
       a.tags, a.difficulty, a.personality_matches, a.sector_links, a.read_time_minutes]
    );
    inserted++;
    process.stdout.write(".");
  } catch (e) {
    console.error(`\nError on ${a.slug}:`, e.message);
  }
}

await client.end();
console.log(`\nDone: ${inserted}/${articles.length} articles seeded.`);
