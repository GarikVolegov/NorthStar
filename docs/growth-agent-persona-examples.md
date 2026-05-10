# Come istruire il Coach di Crescita Personale

Il coach impara il tuo modo di ragionare leggendo **esempi che scrivi tu**.
Non è un fine-tuning del modello: gli esempi vengono cercati per similarità
at ogni conversazione e iniettati nel system prompt come "come ragiona il coach".

---

## Struttura di un esempio

Ogni esempio è una coppia domanda/risposta che mostra **come vorresti che il coach ragionasse**:

```json
{
  "sourceType": "persona_example",
  "question": "Come esco da un periodo di stagnazione?",
  "answer": "Prima osservo: questa fase mi sta dicendo qualcosa. La stagnazione spesso non è assenza di movimento, è accumulo silenzioso. La domanda che pongo è: cosa sto evitando di decidere? Poi passo all'azione minima: non il piano perfetto, ma la prossima azione concreta nelle prossime 24 ore.",
  "tags": ["stagnazione", "azione", "blocco"]
}
```

---

## Tipi di contenuto che puoi inserire

| `sourceType` | Cosa contiene | Esempio |
|---|---|---|
| `persona_example` | Q&A che insegna lo stile di ragionamento | "Come affronti X? → Ecco come la vedo..." |
| `document` | Libro, articolo, appunti tuoi | PDF di un libro che ami, note personali |
| `user_note` | Riflessioni personali, journal entries | "Oggi ho capito che..." |
| `web` | Pagine web (scrape automatico) | URL di un articolo di Seneca, Nassim Taleb... |

---

## Come inviare i contenuti (API)

### Esempio di ragionamento (persona_example)
```bash
curl -X POST /api/growth-agent/ingest \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "persona_example",
    "question": "Cosa fai quando ti senti sopraffatto?",
    "answer": "Distinguo prima cosa dipende da me e cosa no. Su ciò che dipende da me, scelgo la prossima azione più piccola possibile. Sul resto, pratico il distacco attivo: non ignoro, ma non spreco energia.",
    "tags": ["overwhelm", "stoicismo", "controllo"]
  }'
```

### File di testo (appunti, libro estratto)
```bash
curl -X POST /api/growth-agent/ingest \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@mio-libro-preferito.txt" \
  -F "sourceType=document" \
  -F "metadata={\"author\":\"Nome Autore\"}"
```

### URL da web
```bash
curl -X POST /api/growth-agent/ingest \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.collaborativefund.com/blog/the-psychology-of-money/",
    "sourceType": "document",
    "sourceName": "Psychology of Money - Housel"
  }'
```

---

## Visualizzare e cancellare la knowledge base

```bash
# Lista tutto
GET /api/growth-agent/knowledge

# Cancella un chunk specifico
DELETE /api/growth-agent/knowledge/42

# Cancella tutti gli esempi di ragionamento
DELETE /api/growth-agent/knowledge?sourceType=persona_example
```

---

## Buone pratiche per gli esempi

1. **Scrivi esempi che mostrano il ragionamento, non solo la risposta**
   - ❌ "Devi fare attività fisica ogni giorno"
   - ✓ "Prima capisco se la resistenza è fisica o psicologica. Se psicologica, la domanda è: cosa sto associando a questo comportamento?"

2. **Usa linguaggio specifico e concreto**
   - ❌ "Bisogna avere pazienza"
   - ✓ "Distinguo tra impazienze produttive (accelerano la decisione) e impazienze reattive (sabotano il processo)"

3. **Copri aree diverse** — blocchi, motivazione, relazioni, denaro, carriera, identità

4. **Aggiungi tag** — aiutano il retriever a trovare l'esempio giusto per contesto

5. **Almeno 10 esempi** prima di aspettarsi un impatto visibile sul tono del coach
