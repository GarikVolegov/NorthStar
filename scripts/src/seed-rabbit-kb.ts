/**
 * seed-rabbit-kb.ts — popola il knowledge base rabbit (type = 'rabbit_kb', userId = 0)
 *
 * IDEMPOTENTE: salta documenti già presenti (controlla per titolo + userId = 0).
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run seed:rabbit-kb
 *
 * Fonti: RWAF, House Rabbit Society, BSAVA Manual of Rabbit Medicine,
 *        Ministero della Salute IT, ANMVI linee guida esotici.
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db, knowledgeNodesTable } from "@workspace/db";
import { ingestText } from "@workspace/ai-server";

const RABBIT_DOCS: Array<{
  title: string;
  topic: string;
  urgency: "emergency" | "warning" | "info";
  content: string;
}> = [
  // ── 1. GI Stasis ─────────────────────────────────────────────────────────
  {
    title: "Stasi Gastrointestinale nel Coniglio — Emergenza e Gestione",
    topic: "health",
    urgency: "emergency",
    content: `
# Stasi Gastrointestinale (GI Stasis) nel Coniglio

## Cos'è e perché è letale

La stasi gastrointestinale (GI stasis) è il rallentamento o blocco completo della motilità intestinale del coniglio. È una delle principali cause di morte nei conigli domestici e può diventare fatale in 12-24 ore senza trattamento veterinario.

A differenza di altri mammiferi, il coniglio non può vomitare. Qualsiasi rallentamento del transito intestinale causa fermentazione batterica, accumulo di gas, dolore, e in assenza di trattamento, shock e morte.

## Segnali di allarme (emergenza veterinaria immediata)

- Assenza o forte riduzione di feci (le pallottole fecali sono il termometro della salute intestinale)
- Rifiuto totale del cibo, incluso il fieno preferito
- Addome gonfio, teso, o rigido alla palpazione
- Posizione accucciata con zampe raccolte sotto il corpo (posizione da dolore)
- Bruxismo (stridore dei denti) — segnale di dolore acuto
- Letargia estrema, il coniglio non si muove nemmeno se stimolato
- Temperature corporea sotto i 37,5°C (ipotermia da shock)

ATTENZIONE: il coniglio è una preda e nasconde il dolore. Quando i sintomi diventano visibili, la situazione è già grave. Non aspettare "un giorno o due".

## Cause principali

- Dieta povera di fieno (il fieno stimola la motilità intestinale)
- Stress (cambi di ambiente, trasporto, predatori vicini, perdita del compagno)
- Disidratazione
- Ostruzione da ingestione di pelo durante la muta (woolblock)
- Dolore da altra causa (es. problemi dentali, ascesso)
- Gas da eccessivo consumo di carboidrati o verdure gassose
- Encephalitozoon cuniculi (E. cuniculi) che può coinvolgere il sistema nervoso enterico

## Trattamento veterinario

Il trattamento va iniziato entro poche ore. Include:
- Fluidoterapia (reidratazione endovenosa o sottocutanea)
- Analgesici (buprenorfina o meloxicam per il dolore)
- Procinetici (cisapride, metoclopramide, ranitidina) per stimolare la motilità
- Simeticone per ridurre il gas
- Nutrizione forzata con Critical Care (Oxbow) se il coniglio non mangia
- Calore: mantenere il coniglio caldo (il dolore abbassa la temperatura)
- Massaggio delicato dell'addome può aiutare se il vet lo indica

MAI somministrare farmaci umani senza prescrizione veterinaria. Il paracetamolo, l'ibuprofene e l'aspirina sono tossici per i conigli.

## Prevenzione

- Fieno illimitato (timothy, orchard grass, prato) come base della dieta — il 80%+ della dieta deve essere fieno
- Acqua sempre disponibile
- Spazzolatura frequente durante le mute (primavera e autunno)
- Ridurre lo stress ambientale
- Esercizio fisico quotidiano — il movimento stimola la peristalsi
- Visita veterinaria annuale con vet esperto in esotici

Fonti: BSAVA Manual of Rabbit Medicine 2014; RWAF Health Factsheet GI Stasis; House Rabbit Society.
    `.trim(),
  },

  // ── 2. Encephalitozoon cuniculi ───────────────────────────────────────────
  {
    title: "Encephalitozoon Cuniculi (E. cuniculi) nel Coniglio",
    topic: "health",
    urgency: "warning",
    content: `
# Encephalitozoon Cuniculi (E. cuniculi)

## Cos'è

Encephalitozoon cuniculi è un parassita microsporidio intracellulare obbligato che infetta conigli, cani, gatti e occasionalmente umani immunocompromessi. È estremamente diffuso nella popolazione di conigli domestici: studi europei stimano una sieroprevalenza del 52-68% nei conigli sani.

L'infezione avviene tramite ingestione di spore nell'urina di un coniglio infetto (contagio diretto) o in utero dalla madre al feto.

## Manifestazioni cliniche

La maggior parte dei conigli infetti è asintomatica a vita. I sintomi compaiono in caso di immunodepressione, stress, o quando la carica parassitaria raggiunge aree critiche:

**Sistema nervoso centrale (forma neurologica — più comune):**
- Testa storta (torcicollo) — il sintomo più caratteristico
- Rotolamento improvviso (rolling)
- Nistagmo (movimenti oculari rapidi involontari)
- Convulsioni o episodi simil-epilettici
- Paresi o paralisi degli arti posteriori
- Incontinenza

**Reni:**
- Insufficienza renale cronica (E. cuniculi distrugge i tubuli renali)
- Aumento della sete e della diuresi
- Dimagrimento progressivo

**Occhi (forma uveale — tipica nei coniglietti infettati in utero):**
- Uveite faceolitica: opacità bianca nel cristallino, spesso con glaucoma secondario
- Cataratta giovanile (già presente a 3-6 settimane)

## Diagnosi

- Test sierologico (IFA o ELISA) per anticorpi IgG/IgM — un titolo elevato con sintomi è suggestivo
- PCR su urine o LCR per conferma (meno usata in clinica)
- Nessun test confirma con certezza al 100% la forma attiva

## Trattamento

- **Fenbendazolo** (Panacur): antiparassitario di prima scelta. Protocollo ESCCAP: 20 mg/kg/die per 28 giorni. Molti vet prescrivono trattamenti preventivi annuali per conigli esposti.
- **Meloxicam**: antinfiammatorio per ridurre l'edema cerebrale durante la fase acuta
- Fisioterapia e supporto (imbracatura, prevenzione delle piaghe) per conigli con deficit neurologici
- **Prognosi**: variabile. Molti conigli con torcicollo improvviso si stabilizzano con trattamento tempestivo, anche se la testa storta può permanere.

## Zoonosi

E. cuniculi è classificato come patogeno opportunista per gli umani. Le persone immunocompetenti non corrono rischi significativi. Persone con HIV, in chemioterapia, o con trapianti d'organo devono consultare il medico prima di avere contatti stretti con conigli.

Fonti: BSAVA Manual of Rabbit Medicine 2014; Künzel et al. 2008; ESCCAP Guideline 09.
    `.trim(),
  },

  // ── 3. Problemi dentali ───────────────────────────────────────────────────
  {
    title: "Problemi Dentali nel Coniglio — Malocclusione e Spur Dentali",
    topic: "health",
    urgency: "warning",
    content: `
# Problemi Dentali nei Conigli

## Anatomia dentale del coniglio

Il coniglio è un ipsodonte: i denti crescono continuamente per tutta la vita (2-3 mm/settimana). Ha 28 denti:
- 6 incisivi (4 superiori — i secondi, chiamati "peg teeth", sono piccoli e retroposizionati — 2 inferiori)
- 22 denti premolari e molari (i "cheek teeth")

Il movimento di masticazione laterale sul fieno consuma i denti in modo uniforme. Senza fieno sufficiente, i denti crescono in modo anomalo.

## Malocclusione

La malocclusione è la mancata corrispondenza tra i denti. Può essere:

**Malocclusione degli incisivi:**
- Visibile: gli incisivi non si incontrano correttamente
- I denti non si consumano e crescono verso l'esterno
- Causa: congenita (soprattutto nelle razze brachicefale come Nano Olandese, Lop), trauma, carenza di fieno

**Malocclusione dei cheek teeth (molare spur):**
- I premolari/molari sviluppano "speroni" (spur) acuti che lacerino lingua e mucosa buccale
- Sintomi: perdita di peso progressiva, ptialismo (salivazione eccessiva = "wet dewlap"), difficoltà a masticare, coniglio che scarta il cibo
- NON visibile dall'esterno senza sedazione e otoscopio — molti proprietari non se ne accorgono finché il coniglio ha già perso molto peso

## Segnali di problemi dentali

- Perdita di peso pur continuando a mangiare
- Preferirebbe verdure morbide rispetto al fieno
- Salivazione eccessiva, pelo bagnato intorno alla bocca
- Masticazione asimmetrica o "a vuoto"
- Ascessso mandibolare (gonfiore duro sotto la mascella o guancia)
- GI stasis secondaria (dolore dentale → non mangia → stasi)

## Diagnosi e trattamento

- Esame con otoscopio sotto sedazione (unico modo per vedere i cheek teeth)
- Radiografia della testa per valutare le radici
- Limatura dei spur con appositi strumenti sotto anestesia gassosa (isoflurano)
- Nei casi gravi: estrazione dei denti compromessi
- Controlli ogni 3-6 mesi nei conigli con problemi dentali cronici

## Prevenzione

- **Fieno illimitato** — il movimento laterale di masticazione del fieno è l'unico modo naturale per consumare i cheek teeth
- Evitare diete basate su pellet o verdure morbide
- Razze predisposte (brachicefale): controlli dentali annuali preventivi da cucciolo

Fonti: BSAVA Manual of Rabbit Medicine 2014; Capello & Gracis "Rabbit and Rodent Dentistry Handbook" 2005.
    `.trim(),
  },

  // ── 4. Vaccinazioni in Italia ──────────────────────────────────────────────
  {
    title: "Vaccinazioni del Coniglio in Italia — Mixomatosi e RHD",
    topic: "health",
    urgency: "warning",
    content: `
# Vaccinazioni del Coniglio in Italia

## Malattie prevenibili

### Mixomatosi
Malattia virale causata dal Myxoma virus (Poxviridae). Endemica in Italia, trasmessa principalmente da insetti vettori (zanzare, pulci, ragni ragnetti). Mortalità nei conigli non vaccinati: 90-100% nelle forme settecimali.

Sintomi: edema delle palpebre e dei genitali, noduli cutanei, febbre alta, cecità progressiva, morte in 8-14 giorni.
Anche i conigli che vivono esclusivamente in casa sono a rischio: le zanzare entrano facilmente.

### RHD1 (Malattia Emorragica del Coniglio — ceppo classico)
Causata da Lagovirus europaeus GI.1. Endemica in Europa, presente in Italia. Mortalità: fino al 90% nei non vaccinati. Trasmissione per contatto diretto, feci, materiale contaminato, insetti, indumenti umani.

Sintomi: spesso morte improvvisa senza sintomi premonitori, oppure febbre, anoressia, convulsioni, emorragie.

### RHD2 (ceppo emergente GI.2)
Apparso in Europa nel 2010, più virulento e con maggiore capacità di sopravvivenza nell'ambiente. Colpisce anche conigli giovani (sotto le 4-6 settimane che il RHD classico risparmiava). Richiede vaccino specifico diverso dall'RHD1.

## Protocollo vaccinale consigliato in Italia

| Vaccino | Prima dose | Richiamo |
|---------|-----------|---------|
| Mixomatosi + RHD1 (combo) | Da 5-6 settimane di età | Ogni 6-12 mesi (in zone ad alta endemia anche ogni 6 mesi) |
| RHD2 (monovalente) | A distanza di almeno 2 settimane dal combo | Ogni 12 mesi |

Vaccini disponibili in Italia (2024):
- Nobivac Myxo-RHD Plus (MSD): copre Mixomatosi + RHD1 + RHD2 in dose singola — semplifica il protocollo
- Cylap HVD (Zoetis): solo RHD1
- Filavac VHD K C+V (Filavie): RHD1+RHD2

Sempre consultare il veterinario per il protocollo aggiornato nella propria zona geografica.

## Conigli adulti non vaccinati

Cominciare subito con vaccino combo + RHD2 (a distanza). Il veterinario valuta il rischio locale per la frequenza del richiamo.

## Obbligatorietà

In Italia le vaccinazioni dei conigli non sono legalmente obbligatorie per i conigli da compagnia (a differenza dei cani per la rabbia). Tuttavia sono fortemente raccomandate da ANMVI e SIVAE per tutti i conigli, inclusi quelli esclusivamente da interno.

Fonti: SIVAE (Società Italiana Veterinari Animali Esotici); Ministero della Salute; schede tecniche vaccini.
    `.trim(),
  },

  // ── 5. Nutrizione completa ─────────────────────────────────────────────────
  {
    title: "Nutrizione del Coniglio — Dieta Corretta e Alimenti Pericolosi",
    topic: "feeding",
    urgency: "info",
    content: `
# Nutrizione del Coniglio Domestico

## La piramide alimentare del coniglio

### 1. FIENO (80% della dieta, illimitato)
Il fieno è l'alimento più importante. Non è un optional: è il fondamento della salute dentale e intestinale.

- **Timothy (Phleum pratense)**: ideale per adulti. Basso in calcio e proteine, alto in fibra.
- **Orchard grass**: ottima alternativa al timothy, molto palatabile.
- **Prato misto (meadow hay)**: buona varietà, controlla che non contenga piante tossiche.
- **Fieno di erba medica (alfalfa)**: SOLO per cuccioli sotto i 6 mesi e fattrici che allattano — troppo ricco in calcio e proteine per adulti.

Il fieno deve essere profumato, di colore verde/giallo chiaro, asciutto. Fieno ammuffito o polveroso va scartato.

### 2. VERDURE FOGLIOSE (15-20% della dieta)
Dose consigliata: 30-50g per kg di peso corporeo al giorno, divisa in 2 pasti.

**Verdure sicure quotidiane:**
- Cicoria (tutte le varietà)
- Radicchio (in quantità moderate)
- Rucola
- Tarassaco (foglie, fiori, radici — tutto commestibile)
- Prezzemolo (non quotidianamente: alto in calcio)
- Basilico, erba cipollina (piccole quantità)
- Finocchio (foglie e gambi)
- Erba di grano o orzo germogliata
- Erba fresca (non trattata con pesticidi)

**Verdure da limitare (1-2 volte/settimana):**
- Cavolo, broccoli, cavolfiore: possono causare flatulenza
- Spinaci: alto contenuto di ossalati
- Prezzemolo: alto in calcio
- Carota: usare solo le foglie verdi quotidianamente; la radice al max 2 volte/settimana (zucchero)

**VIETARE ASSOLUTAMENTE:**
- Lattuga iceberg: acqua e quasi niente altro, causa diarrea
- Rhubarbo: ossalati letali
- Cipolle e aglio: anemia emolitica
- Avocado: persina tossica
- Mais: difficile da digerire, rischio soffocamento (chicchi secchi)

### 3. PELLET (max 5% della dieta)
Dose: 1 cucchiaio per kg di peso al giorno (adulti).

Scegliere pellet monograno, senza semi, frutta secca o coloranti aggiunti.
Marchi affidabili: Oxbow Essentials Adult, Supreme Science Selective, Burgess Excel.

MAI somministrare mangimi per "conigli nani" che contengono mix di semi e frutta disidratata — provocano obesità e problemi digestivi selettivi.

### 4. FRUTTA (snack occasionale, max 5% della dieta)
Max 1-2 volte a settimana, porzioni piccole (1-2 cm²):
- Mela (senza semi — contengono acido cianidrico)
- Pera (senza semi)
- Fragola
- Lampone, mirtillo
- Papaya (aiuta il transito intestinale — specialmente durante le mute)

### 5. ACQUA
Sempre disponibile. Ciotola preferibile al beccuccio (più naturale, maggiore consumo). Cambiare ogni giorno.

## I cecotrofi: cosa sono e perché non toglierli

I cecotrofi (o cecotrope) sono feci molli di colore verde scuro, prodotte dal cieco, ricche di proteine, aminoacidi essenziali, vitamine B e K. Il coniglio li ingerisce direttamente dall'ano durante la notte o al mattino presto — è comportamento normale e fondamentale.

Se trovi cecotrofi non mangiati: il coniglio sta mangiando troppi pellet o ha dolore (problemi dentali, obesità che impedisce di raggiungere l'ano). Da investigare con il veterinario.

## Cambiamenti dietetici

Qualsiasi cambio alimentare deve essere graduale (7-10 giorni) per evitare disbiosi intestinale.

Fonti: House Rabbit Society Feeding Guide; RWAF Diet Factsheet; Oxbow Animal Health Rabbit Nutrition.
    `.trim(),
  },

  // ── 6. Spazio e housing ────────────────────────────────────────────────────
  {
    title: "Spazio e Alloggio del Coniglio — Standard RWAF e Best Practice",
    topic: "housing",
    urgency: "info",
    content: `
# Spazio e Alloggio del Coniglio Domestico

## Lo spazio minimo secondo RWAF (2019)

La Rabbit Welfare Association & Fund (UK) raccomanda un minimo di:
- **3 metri × 2 metri × 1 metro di altezza** per un singolo coniglio o una coppia
- Il coniglio deve poter compiere almeno 3 salti consecutivi in lunghezza
- Deve potersi alzare sulle zampe posteriori completamente (testare con la razza specifica)

Le gabbie vendute come "per conigli" (60-80 cm) sono inadeguate per essere il recinto permanente. Possono essere accettabili come area sicura notturna se il coniglio ha accesso libero a uno spazio più ampio durante il giorno.

## Struttura dell'alloggio

### Setup indoor (in casa)
Opzioni raccomandate:
- X-pen (recinto in metallo modulare) di almeno 4-6 pannelli 90cm: economico, modulare, facile da pulire
- Stanza rabbit-proof con accesso libero
- Playpen combinato con "casetta" come area rifugio

Substrate (pavimentazione interna):
- Stuoie di giunco o bambu
- Tappeto non peloso (attenzione all'ingestione)
- Piastrelle con tappeto sopra
- MAI wire/griglia: causa pododermatite (ulcere plantari)

### Setup outdoor
- Protetto da predatori: volpi, faine, gatti, cani (copertura superiore obbligatoria)
- Isolato dal terreno umido
- Ombra garantita: i conigli soffrono il colpo di calore sopra i 28°C
- Accesso a riparo chiuso per pioggia e temperatura notturna

### Temperatura ideale
- 10-20°C per la maggior parte delle razze
- Sopra i 25°C: rischio colpo di calore. Sintomi: dispnea, prostrazione, boccheggiamento, temperatura corporea superiore a 40°C.
- Sotto i 5°C: ipotermia nelle razze non adattate all'esterno.

## Area lettiera (WC)

I conigli sono naturalmente puliti e tendono a scegliere un angolo specifico per i bisogni.

- Lettiera angolare con bordi alti
- Riempimento: pellet di carta (Carefresh, Chipsi) o fieno — MAI lettiera per gatti (bentonite: letale se ingerita)
- Mettere una manciata di fieno sulla lettiera: molti conigli mangiano mentre vanno di corpo
- Pulizia ogni 1-2 giorni; igiene profonda settimanale

## Tana/nascondiglio

Il coniglio è una preda. Ha bisogno di un posto dove nascondersi per sentirsi sicuro:
- Casetta di legno (apertura anteriore + foro posteriore = 2 uscite per non sentirsi in trappola)
- Tunnel di cartone o legno
- MAI acrilico o plastica chiusa: surriscaldamento

## Rabbit-proofing

Prima di dare libertà in casa:
- Coprire i cavi elettrici (PERICOLOSISSIMI — il coniglio li rode)
- Bloccare gli spazi sotto i mobili dove potrebbe rimanere incastrato
- Rimuovere piante tossiche (vedi lista alimenti/piante pericolose)
- Proteggere i bordi di mobili e pareti

Fonti: RWAF "A Hutch is Not Enough" Campaign 2019; House Rabbit Society Housing Guide.
    `.trim(),
  },

  // ── 7. Socialità e bonding ─────────────────────────────────────────────────
  {
    title: "Socialità del Coniglio — Bisogno di Compagni e Bonding",
    topic: "socialization",
    urgency: "info",
    content: `
# Socialità del Coniglio e Tecnica di Bonding

## I conigli sono animali sociali

In natura, i conigli selvatici (Oryctolagus cuniculus) vivono in gruppi familiari strutturati (warren). Il contatto sociale con altri conspecifici è una necessità biologica, non un lusso.

Un coniglio solo sviluppa:
- Stress cronico con aumento del cortisolo
- Comportamenti stereotipati (girare in cerchio, rosicchiare le sbarre)
- Apatia o iperattività
- Ridotta aspettativa di vita

L'interazione umana è preziosa ma non sostituisce la compagnia di un altro coniglio.

## Con chi fare bonding

Abbinamento consigliato (in ordine di successo):
1. **Maschio castrato + Femmina sterilizzata**: il più naturale e il più stabile
2. **Due maschi castrati**: funziona con il bonding corretto
3. **Due femmine sterilizzate**: più conflittuali ma possibile
4. **Coppie/trio di razze diverse**: possibile se personalità compatibili

La sterilizzazione è prerequisito indispensabile per ridurre aggressività territoriale e ormonale, e per prevenire tumori uterini nelle femmine.

## Tecnica di bonding step-by-step

### Fase 0 — Pre-bonding
- Entrambi i conigli vivono in spazi separati ma possono vedersi e annusarsi attraverso una barriera (scambio di odori graduale per 1-2 settimane)
- Scambio periodico delle lettiere (abituarsi all'odore dell'altro)

### Fase 1 — Incontri neutri (territorio neutro)
- Scegli un ambiente dove nessuno dei due è mai stato (bagno, corridoio non usuale)
- Sessioni brevi (10-15 minuti) supervisionate
- Porta i conigli insieme: metti cibo gustoso per distrarre
- Osserva: è normale il freeze (immobilità reciproca), annusare, scappare
- STOP subito se uno dei due attacca mordendo (non si inseguono, si mordono)

### Fase 2 — Sessioni progressive
- Aumenta la durata se le sessioni vanno bene
- Sessioni di "stress positivo" condiviso: viaggiare in auto insieme, strofinare entrambi con un asciugamano odorato di entrambi
- Segnali di bonding positivo: grooming reciproco, dormire appoggiati, mangiare vicini
- Segnali di tensione tollerabile: il dominante spinge giù la testa del subordinato (richiesta di grooming)
- Segnali di pericolo: rincorsa, boxing (zampe anteriori), morso che stacca pelo

### Fase 3 — Vita condivisa
- Quando dormono insieme e si groomano: pronti per vivere nello stesso spazio
- Prima introduzione nell'habitat permanente: pulisci tutto, ridisponi gli oggetti per ridurre il "territory scent"
- Rimani presente le prime ore

## Bonding dopo la perdita di un compagno

Il coniglio in lutto può manifestare anoressia, depressione, e in casi estremi GI stasis da stress. Introdurre un nuovo compagno nel tempo adeguato (non troppo presto: 2-4 settimane di lutto), ricominciando dalla Fase 0.

Fonti: House Rabbit Society Bonding Guide; RWAF Companionship Factsheet.
    `.trim(),
  },

  // ── 8. Muta e grooming ────────────────────────────────────────────────────
  {
    title: "Muta Stagionale e Grooming del Coniglio",
    topic: "grooming",
    urgency: "info",
    content: `
# Muta Stagionale e Grooming del Coniglio

## Le mute stagionali

I conigli effettuano due mute principali all'anno:
- **Muta primaverile** (marzo-maggio): perdita del pelo invernale più spesso
- **Muta autunnale** (settembre-novembre): preparazione al pelo invernale

Alcune razze (soprattutto Nani Olandesi) possono avere mute più frequenti o continue.

La quantità di pelo perso è sorprendente — a volte sembra che il coniglio "si stia sciogliendo". È normale.

## Perché la muta è critica per la salute

A differenza dei gatti, i conigli NON riescono a vomitare. Il pelo ingerito durante l'autogrooming si accumula nello stomaco e può contribuire alla GI stasis (blocco intestinale).

La papaya fresca (o enzimi di papaya) aiuta la digestione del pelo — alcuni proprietari la usano durante le mute come supplemento.

## Frequenza di spazzolatura

| Tipo di pelo | Fuori muta | Durante muta |
|---|---|---|
| Pelo corto (Dutch, Rex) | 1-2 volte/settimana | Ogni giorno |
| Pelo medio (Lop, Lionhead criniera) | 2-3 volte/settimana | Ogni giorno |
| Pelo lungo (Angora, Cashmere) | Ogni giorno | Ogni giorno (2 volte al giorno) |

## Tecnica di spazzolatura

Strumenti utili:
- **Pettine a denti stretti**: per rimuovere il pelo morto dal sottopelo
- **Guanto in gomma**: per raccogliere il pelo durante una coccola
- **Slicker brush morbido**: per il pelo lungo (usare delicatamente, non tirare)

Tecnica:
1. Inizia dalla testa, vai verso la coda
2. Pettina contropelo per liberare il sottopelo
3. Finisci a pelo
4. Non tirare mai i grovigli: usa le forbici a punta tonda per tagliare, o vai dal groomer/vet

Razze a pelo lungo: trim del pelo ogni 3-4 mesi, o il pelo cresce fino a 10-15 cm (Angora: fino a 20 cm).

## Il bagno: mai, o quasi

Il bagno completo è controindicato nei conigli:
- Ipotermia anche a temperature ambiente
- Stress cardiaco (il coniglio ha cuore delicato)
- Rimozione degli oli naturali del pelo

Eccezioni accettabili:
- **Dry bath** con amido di mais o talco senza profumo: per pulire piccole zone
- **Wet spot cleaning**: lavare solo la zona sporca con acqua tiepida e asciugare IMMEDIATAMENTE con asciugacapelli a bassa temperatura

Se il coniglio ha spesso le parti posteriori sporche di urina: non è un problema di igiene ma di salute (obesità che impedisce l'autogrooming, cecotropia anomala, infezione urinaria, artrite).

## Taglio delle unghie

Le unghie crescono continuamente e devono essere tagliate ogni 8-12 settimane.

Strumenti: tronchesi per piccoli animali (es. Millers Forge). Evitare le tronchesi per cani.

Tecnica:
- Illumina l'unghia per vedere il "quick" (la parte viva, rosa) — tagliare 2-3 mm prima
- Tieni il kit di styptic powder (Kwik-Stop) per fermare eventuali sanguinamenti
- Prima volta: fai fare al veterinario e guarda

Fonti: RWAF Grooming Guide; House Rabbit Society Molting; Angora Rabbit Owners Association.
    `.trim(),
  },

  // ── 9. Comportamento e linguaggio corporeo ────────────────────────────────
  {
    title: "Comportamento del Coniglio — Linguaggio del Corpo e Comunicazione",
    topic: "behavior",
    urgency: "info",
    content: `
# Comportamento del Coniglio — Linguaggio del Corpo

## I conigli comunicano silenziosamente

I conigli sono quasi completamente silenziosi (a differenza di cani e gatti). Imparare il linguaggio corporeo è fondamentale per capire come si sentono.

## Segnali di benessere e felicità

**Binky**: salto con torsione a mezz'aria, a volte con calcio dei posteriori. È la manifestazione più visibile della gioia pura. Se il tuo coniglio fa i binky, stai facendo tutto bene.

**Loaf position (pagnotta)**: coniglio raccolto con zampe sotto il corpo, occhi semi-chiusi o chiusi. Rilassato e soddisfatto.

**Flop**: si butta di lato improvvisamente. I proprietari inesperti si spaventano, credendo sia un malore — è invece estrema fiducia e rilassamento.

**Teeth chattering dolce** (diverso dal bruxismo da dolore): ronzio morbido mentre viene accarezzato = piacere (paragonabile al gatto che fa le fusa).

**Grooming del proprietario**: lambire le mani o i capelli del proprietario = affetto, accettazione nel gruppo sociale.

**Popcorning** (conigli giovani): movimenti rapidi e quasi convulsi durante il gioco = eccitazione pura.

## Segnali di tensione, paura o dolore

**Thumping** (battere i posteriori sul pavimento): allarme o irritazione. Segnala pericolo ai conspecifici. Può indicare anche frustrazione.

**Posizione allungata tesa con occhi spalancati**: allerta, paura. Non avvicinarsi bruscamente.

**Orecchie piatte e corpo basso**: estrema paura o sottomissione.

**Grugnito + lanciarsi avanti**: avvertimento prima di mordere. Rispetta lo spazio.

**Bruxismo forte** (si sente dall'esterno): dolore acuto — emergenza veterinaria.

**Posizione accucciata, non si muove, occhi semichiusi**: dolore cronico. Il coniglio che soffre non piange: si immobilizza.

## Comportamenti normali spesso fraintesi

**Rosicchiare**: comportamento normale e necessario. Fornire adeguati oggetti da rosicchiare. Un coniglio che roda mobili o cavi è un coniglio che ha bisogno di più opzioni.

**Scavare**: comportamento innato. Fornire una cassetta con terra o cartone da distruggere.

**Spruzzare urina**: comportamento territoriale/ormonale. Quasi sempre scompare dopo la sterilizzazione.

**Mangiare le feci** (cecotrofi): assolutamente normale. È parte del ciclo digestivo — vedi sezione nutrizione.

**Guardarsi intorno da ritto sulle zampe posteriori**: ispezione dell'ambiente. Non disturbarlo durante questa fase.

## Interazione corretta

- Non sollevare il coniglio contro la sua volontà: è una preda; essere tenuto in aria simula la cattura da un predatore
- Interagire al livello del pavimento, non dall'alto
- Lasciare che sia lui ad avvicinarsi, specialmente all'inizio
- Rispettare i segnali di "no": se scappa, aspetta. Non inseguire.
- La fiducia si costruisce mesi, non giorni

Fonti: House Rabbit Society Understanding Body Language; A. McBride "Rabbits" (Companion Animal Behaviour series).
    `.trim(),
  },

  // ── 10. Colpo di calore ───────────────────────────────────────────────────
  {
    title: "Colpo di Calore nel Coniglio — Prevenzione e Primo Soccorso",
    topic: "health",
    urgency: "emergency",
    content: `
# Colpo di Calore nel Coniglio (Heatstroke)

## Perché i conigli sono vulnerabili

I conigli non sudano (sudano solo attraverso le zampe) e non sono in grado di termoregolare efficacemente sopra i 28-30°C. Non possono ansimare efficacemente come i cani.

La soglia critica: temperatura corporea oltre 40°C diventa emergenza. Oltre 42°C è letale in pochi minuti.

## Fattori di rischio aumentato

- Gabbia o hutch esposta al sole senza ombra
- Macchina ferma al sole (anche 5 minuti con 25°C esterno)
- Stanza chiusa in estate senza aria condizionata
- Razze a pelo lungo (Angora): dispersione del calore ridotta
- Conigli obesi o anziani
- Conigli affetti da problemi respiratori

## Sintomi di colpo di calore

**Fase iniziale:**
- Coniglio disteso sul fianco in modo insolito
- Respirazione rapida e superficiale
- Orecchie molto calde e rossastre (vasodilatazione periferica)
- Lieve confusione

**Fase avanzata (emergenza):**
- Boccheggiamento
- Salivazione eccessiva
- Testa che oscilla, tremori
- Incapacità di alzarsi
- Convulsioni
- Perdita di coscienza

## Primo soccorso (prima di arrivare dal vet)

1. **Sposta immediatamente** in ambiente fresco (aria condizionata a 20-22°C)
2. **Bagna gli orecchi** con acqua fresca (non fredda): gli orecchi sono il principale irradiatore di calore
3. **Avvolgi con asciugamano bagnato di acqua fresca** (non di ghiaccio — lo shock termico causa vasocostrizione periferica)
4. **Offri acqua fresca** — se ancora cosciente e in grado di bere; non forzare
5. **Chiama il veterinario** e parti — non aspettare che "migliori da solo"

MAI:
- Immergere in acqua fredda o ghiaccio
- Mettere in freezer
- Ignorare i sintomi aspettando

## Prevenzione

- Temperatura ambiente max 25°C (ideale 18-22°C)
- Bottiglie di acqua congelate avvolte in un asciugamano: il coniglio si avvicina per raffrescarsi
- Ceramica fresca nella gabbia
- Ventilazione senza corrente diretta
- MAI gabbia o hutch al sole diretto in estate
- MAI lasciare in macchina, neanche "solo 5 minuti"

Fonti: BSAVA Manual of Rabbit Medicine 2014; RWAF Heatstroke Factsheet.
    `.trim(),
  },

  // ── 11. Sterilizzazione ───────────────────────────────────────────────────
  {
    title: "Sterilizzazione del Coniglio — Perché, Quando e Come",
    topic: "health",
    urgency: "info",
    content: `
# Sterilizzazione del Coniglio

## Perché sterilizzare

### Femmina (ovariectomia o ovarioisterectomia)

**Prevenzione tumori uterini**: il motivo più importante. Il cancro uterino (adenocarcinoma uterino) colpisce l'80-90% delle femmine non sterilizzate entro i 5-6 anni di età. È la causa di morte più comune nelle femmine adulte.

Oltre al tumore: piometra (infezione uterina), pseudogravidanza (comportamento aggressivo + strappamento del pelo per il nido), tensione ormonale ciclica che porta a comportamenti difficili.

Età consigliata per la sterilizzazione: 4-6 mesi (dopo la pubertà, prima della maturità sessuale completa).

### Maschio (castrazione)

- Riduzione dell'aggressività territoriale (spruzzare urina, aggredire)
- Prerequisito per il bonding con un'altra femmina sterilizzata
- Prevenzione di ascessi periodonali secondari a infezioni urinarie
- Riduzione del rischio di neoplasie testicolari (meno comune che nelle femmine)

Età consigliata: 3-5 mesi (quando i testicoli sono scesi).

## Il rischio anestesiologico

I conigli hanno una reputazione storica di "anestesia rischiosa". Questa reputazione è in parte superata dalle tecniche moderne, ma richiede:

- Veterinario esperto in lagomorfi/esotici (non tutti i vet conoscono i conigli)
- Protocollo anestesiologico specifico: isoflurano gassoso, evitare acepromazina, monitoraggio continuo
- Digiuno MOLTO BREVE prima dell'anestesia: i conigli non regurgitano, quindi il rischio inalazione è basso. Il digiuno prolungato è invece pericoloso (ipoglicemia, GI stasis). Max 1-2 ore senza fieno, no digiuno idrico.
- Riscaldamento durante la procedura

Mortalità anestesiologica con vet esperto: circa 0.5-1% (paragonabile a cane/gatto).

## Decorso post-operatorio

- Controllare che il coniglio mangi entro 4-6 ore dalla chirurgia
- Se non mangia in 12 ore: contattare il vet (rischio GI stasis post-chirurgica)
- Analgesici post-op: meloxicam per 3-5 giorni
- Controllo della ferita: i conigli tendono a leccarsi/rosicchiarsi le suture — necessario body protettivo o collare elizabettiano adattato
- Visita di controllo a 7-10 giorni per rimozione punti (se non riassorbibili)

Fonti: BSAVA Manual of Rabbit Medicine 2014; RWAF Neutering Factsheet; SIVAE.
    `.trim(),
  },

  // ── 12. Piante tossiche ───────────────────────────────────────────────────
  {
    title: "Piante Tossiche per i Conigli — Guida Completa",
    topic: "nutrition",
    urgency: "emergency",
    content: `
# Piante Tossiche per i Conigli

Se il tuo coniglio ha ingerito una pianta tossica, contatta IMMEDIATAMENTE un veterinario esperto in lagomorfi. Non aspettare i sintomi.

## Piante da interno ALTAMENTE TOSSICHE

**Ciclamino (Cyclamen spp.)**
Tossina: terpenoidi (saponine triterpene). Tutti i parti della pianta sono tossici, soprattutto il tubero.
Sintomi: ipersalivazione, crampi intestinali, diarrea con sangue, convulsioni, aritmie cardiache, morte.

**Filodendro (Philodendron spp.) e Pothos (Epipremnum aureum)**
Tossina: ossalati di calcio insolubili.
Sintomi: bruciore intenso nella bocca, edema della lingua e della gola, ipersalivazione.

**Dieffenbachia (Dieffenbachia spp.)**
Tossina: ossalati di calcio insolubili + enzimi proteolitici.
Sintomi: edema orofaringeo grave, difficoltà respiratorie.

**Azalea e Rododendro (Rhododendron spp.)**
Tossina: grayanotossine.
Sintomi: ipersalivazione, vomito (impossibile nel coniglio → dolore acuto), bradicardia, ipotensione, paralisi, morte.

## Piante da giardino ALTAMENTE TOSSICHE

**Oleandro (Nerium oleander)**
Tossina: glicosidi cardiaci (oleandrigenina, neriina). Tra le piante più tossiche.
Dose letale: pochi grammi. Sintomi: aritmie cardiache fatali.

**Digitale (Digitalis purpurea)**
Tossina: glicosidi digitalici (digitossina, digossina).
Sintomi: bradicardia, blocco atrioventricolare, morte cardiaca.

**Tasso (Taxus baccata)**
Tossina: tassina (alcaloide). Quasi nessun antidoto efficace.
Quasi ogni parte è letale: foglie, rami, semi (solo il rivestimento rosso dei semi è non tossico). Morte rapida.

**Mughetto (Convallaria majalis)**
Tossina: glicosidi cardiaci (convallotossina).
Anche piccole quantità: aritmie letali.

**Glicine (Wisteria spp.)**
Tossina: wisterina, lectine nei semi.
Sintomi: nausea, crampi, ipotensione.

**Aquilegia (Aquilegia vulgaris)**
Tossina: alcaloidi e glucosidi cianogenici.
Sintomi: eccitazione seguita da depressione, convulsioni.

## Piante spontanee TOSSICHE

- **Ranuncolo** (Ranunculus spp.): irritazione mucose, diarrea emorragica
- **Aconito** (Aconitum spp.): aconitina, uno dei veleni più potenti. Letale in piccolissime dosi.
- **Stramonio** (Datura stramonium): alcaloidi tropanici (atropina, scopolamina)
- **Edera** (Hedera helix): saponine e poliine

## Erbe aromatiche da evitare o limitare

- **Rosmarino**: in piccole quantità ok, non regolarmente
- **Salvia**: oli essenziali possono essere tossici in grandi quantità
- **Origano e timo**: piccole quantità ok; oli essenziali concentrati no

## Cosa fare in caso di ingestione

1. NON aspettare i sintomi
2. Identifica la pianta (fotografia se possibile)
3. Chiama il centro antiveleni veterinario o il veterinario
4. Centro Antiveleni Veterinario — UniMi: 02 50198618
5. Porta al vet anche solo con sospetto di ingestione

Fonti: ASPCA Animal Poison Control; BSAVA Manual of Rabbit Medicine; Cortinovis & Caloni "Epidemiology of Small Animal Poisoning" 2015.
    `.trim(),
  },

  // ── 13. Razze e scelta del coniglio ───────────────────────────────────────
  {
    title: "Scegliere una Razza di Coniglio — Guida per l'Adozione",
    topic: "breeds",
    urgency: "info",
    content: `
# Scegliere una Razza di Coniglio

## Adottare, non comprare

Prima considerazione: preferire l'adozione da rifugi e associazioni di rescue rispetto all'acquisto da allevatori o negozi.
In Italia: LAV, ENPA, LNDC, associazioni locali di rescue conigli.

I conigli adulti adottati spesso hanno già carattere definito e possono essere già sterilizzati.

## Cosa considerare nella scelta

1. **Tempo disponibile per il grooming**: razze a pelo lungo richiedono 30-60 min al giorno
2. **Spazio disponibile**: razze grandi/giganti (Lop Francese, Gigante Fiammingo) richiedono spazi enormi
3. **Esperienza**: le razze brachicefale (Nano Olandese, Lionhead) sono più predisposte a problemi dentali
4. **Aspettativa di vita**: razze piccole 8-12 anni; razze grandi 5-7 anni

## Profili razze comuni in Italia

**Nano Olandese (Dutch/Netherlands Dwarf)**
Peso: 0.9-1.4 kg. Aspettativa: 8-12 anni.
Temperamento: vivace, curioso, può essere timido all'inizio.
Attenzione: predisposto a malocclusione dentale per il cranio brachicefalo.

**Lop / Ariete nano (Holland Lop, Mini Lop)**
Peso: 1.5-2.5 kg. Aspettativa: 8-12 anni.
Temperamento: generalmente docile, affettuoso, buono con i bambini.
Attenzione: orecchie cadenti = canale auricolare curvo = rischio otiti croniche. Controllo regolare.

**Rex / Mini Rex**
Peso: 1.4-2.0 kg (Mini) / 3-5 kg (Rex standard). Aspettativa: 7-10 anni.
Temperamento: intelligente, attivo, giocoso.
Attenzione: pelo raso sulle zampe = pododermatite se superfici dure.

**Lionhead (Testa di Leone)**
Peso: 1.3-1.7 kg. Aspettativa: 7-10 anni.
Temperamento: vivace, affettuoso, energico.
Attenzione: criniera necessita grooming regolare; alcuni individui brachicefali.

**Angora Inglese / Francese**
Peso: 2-4.5 kg. Aspettativa: 7-12 anni.
Temperamento: docile, tranquillo.
Attenzione: grooming OGNI GIORNO senza eccezioni. Non adatto a proprietari poco disciplinati nel grooming.

**Gigante Fiammingo**
Peso: 6-10+ kg. Aspettativa: 5-7 anni (la taglia riduce la longevità).
Temperamento: calmo, paziente, adatto a famiglie.
Attenzione: spazio enormi; superfici morbide per le articolazioni; vita più breve.

## Coniglio da bambini: miti e realtà

Il coniglio NON è un "pet a bassa manutenzione" adatto ai bambini piccoli.
- Non ama essere preso in braccio
- Ha bisogno di interazione al suolo, non dall'alto
- I bambini devono imparare a interagire correttamente (supervisione adulto obbligatoria)
- Bambini sotto i 6-8 anni spesso spaventano involontariamente il coniglio

Un coniglio spaventato scalcia (forti unghie) o morde per difesa.

Fonti: BRC (British Rabbit Council) Breed Standards; ARBA Breed Standards; RWAF Choosing a Rabbit.
    `.trim(),
  },

  // ── 14. Cure stagionali ───────────────────────────────────────────────────
  {
    title: "Cure Stagionali del Coniglio — Primavera, Estate, Autunno, Inverno",
    topic: "seasonal_care",
    urgency: "info",
    content: `
# Cure Stagionali del Coniglio

## Primavera (marzo-maggio)

**Muta principale**: il coniglio perde il pelo invernale più pesante.
- Spazzolatura quotidiana (ogni 1-2 giorni per le razze a pelo lungo)
- Enzimi di papaya o papaya fresca 2-3 volte/settimana per facilitare la digestione del pelo ingerito
- Monitorare l'appetito: rallentamento lieve può essere GI da ingestione pelo

**Vaccinazioni**: primavera è il momento ideale per il richiamo annuale (pre-estate = pre-stagione dei vettori)

**Zanzare e insetti**: con l'arrivo dei vettori della Mixomatosi aumenta il rischio. Verificare che la vaccinazione sia aggiornata.

**Corsia di sicurezza outdoor**: controllare il giardino per piante tossiche germogliate di fresco.

## Estate (giugno-agosto)

**Colpo di calore**: pericolo principale. Vedi sezione dedicata.
- Non lasciare mai in ambienti non ventilati
- Temperatura massima 25°C nell'ambiente di vita
- Bottiglie di acqua ghiacciata avvolte in asciugamano
- Ceramica fresca nella zona di riposo
- Acqua fresca 2-3 volte al giorno

**Mosca verde (miasi/fly strike)**: le mosche depongono le uova sul pelo sporco/umido (soprattutto nella zona posteriore). Le larve si schiudono in poche ore e penetrano nella carne.
Prevenzione: controllo quotidiano della zona posteriore; shampoo posteriore delicato se necessario; prodotti repellenti veterinari specifici per lagomorfi (Rearguard UK — non sempre disponibile in Italia); doppio controllo dopo ogni pasto e nelle ore calde.
Fly strike è emergenza chirurgica — al minimo sospetto, veterinario immediatamente.

## Autunno (settembre-novembre)

**Seconda muta stagionale**: meno intensa della primaverile ma presente.
- Riprendere la spazzolatura quotidiana
- Stesso protocollo papaya della primavera

**Preparazione all'inverno (outdoor)**: isolamento dell'hutch, copertura impermeabile, abbondante paglia per il nido (non fieno: la paglia trattiene meglio il calore).

**Aggiornamento vaccinazioni** se il richiamo è semestrale: ottobre è il momento per il secondo ciclo.

## Inverno (dicembre-febbraio)

**Temperatura**: conigli outdoor sotto i 5°C: rischio ipotermia, specialmente per razze piccole e giovani.
- Coibentare l'hutch: pannelli di polistirolo all'esterno, panno impenetrabile sopra
- Abbondante paglia per il nido (mai bagnata)
- Controllare che l'acqua non ghiacci (ciotola riscaldata o controllo 2-3 volte al giorno)
- Cibo leggermente aumentato: il coniglio brucia più calorie per termoregolare

**Conigli indoor in inverno**: attenzione al riscaldamento eccessivo (sopra i 20°C l'animale può soffrire). Evitare correnti d'aria.

**Attività ridotta**: normale. Aumentare l'enrichment per compensare la riduzione delle uscite.

Fonti: RWAF Seasonal Care; House Rabbit Society Winter Care; BSAVA Rabbit Medicine.
    `.trim(),
  },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🐰 seed-rabbit-kb — avvio");
  console.log(`   Documenti da inserire: ${RABBIT_DOCS.length}`);

  let inserted = 0;
  let skipped = 0;

  for (const doc of RABBIT_DOCS) {
    // Controlla se già presente (userId = 0 + stesso titolo)
    const existing = await db
      .select({ id: knowledgeNodesTable.id })
      .from(knowledgeNodesTable)
      .where(
        and(
          eq(knowledgeNodesTable.userId, 0),
          eq(knowledgeNodesTable.title, `${doc.title} [1/${Math.ceil(doc.content.length / 600)}]`),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ○ skip (esiste già): ${doc.title}`);
      skipped++;
      continue;
    }

    try {
      const result = await ingestText(doc.content, {
        userId: 0,
        sourceType: "rabbit_kb",
        sourceName: doc.title,
        metadata: {
          topic: doc.topic,
          urgency: doc.urgency,
          language: "it",
          domain: "rabbit",
        },
      });

      console.log(`  ✓ [${result.chunksInserted} chunk] ${doc.title}`);
      inserted++;
    } catch (e) {
      console.error(`  ✗ ERRORE: ${doc.title}`, e);
    }
  }

  console.log(`\n✅ seed-rabbit-kb completato`);
  console.log(`   Inseriti: ${inserted} documenti`);
  console.log(`   Saltati:  ${skipped} (già presenti)`);
  console.log(`   Chunk totali: ~${inserted * 3}-${inserted * 6} (dipende dalla lunghezza)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ seed-rabbit-kb fallito:", e);
  process.exit(1);
});
