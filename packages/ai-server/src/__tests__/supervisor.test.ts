import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SupervisorAgent } from "../growth-agent/supervisor-agent";

const { mockChatOnce, mockEmbedText, mockDbInsert, mockDbValues } = vi.hoisted(() => ({
  mockChatOnce: vi.fn(),
  mockEmbedText: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbValues: vi.fn(),
}));

vi.mock("../llm/client", () => ({
  getLLM: vi.fn(() => ({
    chatOnce: mockChatOnce,
  })),
}));

vi.mock("../db/client", () => ({
  db: {
    insert: mockDbInsert,
  },
}));

vi.mock("../growth-agent/embedder", () => ({
  EMBEDDING_DIMS: 3,
  embedText: mockEmbedText,
}));

describe("SupervisorAgent", () => {
  let supervisor: SupervisorAgent;
  const originalOpenAiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockResolvedValue(undefined);
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    mockEmbedText.mockResolvedValue([1, 0, 0]);
    supervisor = new SupervisorAgent();
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    } else {
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  describe("evaluate", () => {
    it("passes a good response with actions", async () => {
      const result = await supervisor.evaluate({
        userMessage: "come trovo lavoro?",
        draft: "Ecco 3 passi concreti: 1. Aggiorna il CV con le ultime esperienze. 2. Contatta 5 recruiter su LinkedIn entro questa settimana. 3. Preparati per i colloqui tecnici studiando system design.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.70);
    });

    it("fails a response with platitudes", async () => {
      const result = await supervisor.evaluate({
        userMessage: "non ce la faccio",
        draft: "Credi in te stesso e tutto è possibile. Non mollare mai. Il successo arriva per chi persevera. Sei sulla strada giusta.",
        domain: "mindset",
        intent: "reflect",
      });
      expect(result.dimensions.platitudeFree).toBeLessThanOrEqual(0.30);
    });

    it("applies low actionability weight for vent responses", async () => {
      const result = await supervisor.evaluate({
        userMessage: "oggi è stata una giornata terribile",
        draft: "Mi dispiace che tu abbia passato una giornata così difficile. Ti ascolto. Cosa è successo di preciso?",
        domain: "general",
        intent: "vent",
      });
      expect(result.dimensions.actionability).toBeLessThan(0.30);
    });

    it("passes vent response without actions (correctly weighted)", async () => {
      const result = await supervisor.evaluate({
        userMessage: "sono molto giù oggi, è stata una settimana pesante al lavoro e non vedo miglioramenti",
        draft: "Mi dispiace che tu abbia avuto una settimana così pesante al lavoro. È normale sentirsi giù quando non si vedono miglioramenti nonostante l'impegno. Ti ascolto e sono qui per te. Cosa è successo di preciso al lavoro che ti ha fatto sentire così? A volte condividere il peso della settimana con qualcuno aiuta già a sentirsi meglio.",
        domain: "general",
        intent: "vent",
      });
      // Vent intent has 0.00 actionability weight, so it passes on empathy alone + good length
      // Draft includes user words: settimana, pesante, lavoro, miglioramenti, giù
      expect(result.pass).toBe(true);
    });

    it("fails plan response without action steps", async () => {
      const result = await supervisor.evaluate({
        userMessage: "fammi un piano carriera",
        draft: "Il tuo percorso professionale è importante. Dovresti considerare le tue opzioni e fare delle scelte. Il tempo è dalla tua parte.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("passes problem_solve with concrete advice", async () => {
      const result = await supervisor.evaluate({
        userMessage: "come preparo un colloquio per una posizione da data scientist?",
        draft: "Ecco 5 azioni concrete per prepararti al colloquio. 1. Studia la mission aziendale e i prodotti principali, prepara 3 domande strategiche da fare al hiring manager. 2. Rivedi i fondamentali di machine learning: regressione, alberi, reti neurali. 3. Prepara 2 case study di progetti passati con metriche di impatto. 4. Simula il colloquio tecnico con un amico usando problemi di coding. 5. Il giorno prima, prepara i documenti e dormi almeno 8 ore. Inizia oggi con il punto 1, ti richiederà circa 2 ore.",
        domain: "career",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(true);
    });

    it("fails problem_solve without concrete steps", async () => {
      const result = await supervisor.evaluate({
        userMessage: "come risolvo questo problema?",
        draft: "Devi pensarci bene e trovare la soluzione giusta per te. Ogni problema ha una soluzione. Con calma troverai la strada.",
        domain: "general",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(false);
    });

    it("passes reflect with thoughtful content", async () => {
      const result = await supervisor.evaluate({
        userMessage: "sto riflettendo sul mio percorso professionale e su cosa voglio fare da grande",
        draft: "È normale fermarsi a riflettere sul proprio percorso professionale e chiedersi cosa fare da grande. Ecco alcune domande per guidare la tua riflessione: 1. Quali sono stati i momenti in cui ti sei sentito più realizzato nel tuo percorso? 2. Cosa facevi in quei momenti e perché ti davano energia? 3. Se potessi ricominciare il tuo percorso professionale, cosa faresti diversamente? 4. Quali competenze ti piacerebbe sviluppare nei prossimi 12 mesi? Prenditi un'ora questo weekend per scrivere le risposte.",
        domain: "general",
        intent: "reflect",
      });
      expect(result.pass).toBe(true);
    });

    it("fails reflect with generic platitudes", async () => {
      const result = await supervisor.evaluate({
        userMessage: "rifletto sulla mia vita",
        draft: "La vita è un viaggio meraviglioso. Ogni giorno è un nuovo inizio. Il cambiamento inizia da dentro. Ricorda che puoi farcela.",
        domain: "general",
        intent: "reflect",
      });
      expect(result.pass).toBe(false);
    });

    it("passes ask_info with factual content", async () => {
      const result = await supervisor.evaluate({
        userMessage: "quanto costa un corso di laurea in Italia e ci sono borse di studio disponibili?",
        draft: "In Italia, il costo di un corso di laurea varia da 150€ a 3.500€ all'anno in base all'ISEE familiare. Per quanto riguarda le borse di studio, il DSU (Diritto allo Studio) copre completamente le tasse universitarie e offre un contributo fino a 7.000€ annui, più servizi come mensa e alloggio. I requisiti per ottenere la borsa di studio sono: ISEE sotto la soglia regionale e merito accademico. Per fare domanda, presenta la richiesta entro luglio sul portale della tua università. I dati sui costi e sulle borse sono aggiornati al 2025.",
        domain: "general",
        intent: "ask_info",
      });
      expect(result.pass).toBe(true);
    });

    it("fails ask_info with vague non-answer", async () => {
      const result = await supervisor.evaluate({
        userMessage: "quanto costa?",
        draft: "Dipende da tanti fattori. Ogni università ha i suoi costi. Dovresti informarti direttamente.",
        domain: "general",
        intent: "ask_info",
      });
      expect(result.pass).toBe(false);
    });

    it("passes explore with balanced exploration", async () => {
      const result = await supervisor.evaluate({
        userMessage: "che opzioni ho per formarmi nel settore tecnologico?",
        draft: "Ecco 3 percorsi possibili per formarti nel tech, ognuno con pro e contro. 1. Formazione tecnica intensiva (bootcamp): 6 mesi, costo 2.000-5.000€, inserimento rapido ma base teorica leggera. 2. Corso universitario: 3 anni, costo 1.500-3.000€/anno, formazione completa ma tempi lunghi. 3. Auto-apprendimento guidato: gratuito, 12-18 mesi, massima flessibilità ma richiede disciplina. Considera il tuo budget, il tempo disponibile e il tuo stile di apprendimento per scegliere. Posso approfondire un percorso specifico se vuoi.",
        domain: "career",
        intent: "explore",
      });
      expect(result.pass).toBe(true);
    });

    it("flags short responses", async () => {
      const result = await supervisor.evaluate({
        userMessage: "ciao",
        draft: "Ciao!",
        domain: "general",
        intent: "explore",
      });
      expect(result.dimensions.lengthOk).toBeLessThan(0.50);
    });

    it("rejects empty plan drafts", async () => {
      const result = await supervisor.evaluate({
        userMessage: "fammi un piano",
        draft: "Certo, ecco il tuo piano personale.",
        domain: "general",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
    });

    it("passes when onTopic is high", async () => {
      const result = await supervisor.evaluate({
        userMessage: "come investire in ETF per il lungo termine con un budget di 500 euro al mese?",
        draft: "Per investire in ETF per il lungo termine con un budget di 500 euro al mese, ecco i passi: 1. Apri un conto titoli presso un broker a basso costo. 2. Scegli ETF azionari globali per il tuo investimento a lungo termine con TER sotto lo 0.30%. 3. Imposta un PAC mensile di 500 euro, così investi ogni mese indipendentemente dal prezzo. 4. Ribilancia una volta all'anno vendendo posizioni sovrappesate. 5. Tieni l'investimento in ETF per almeno 10-15 anni per beneficiare dell'interesse composto sul lungo termine. Con un budget di 500 euro al mese, puoi costruire un portafoglio significativo nel tempo.",
        domain: "finance",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(true);
      // Draft rephrases user words: investire, ETF, lungo termine, budget, 500, euro, mese
      expect(result.dimensions.onTopic).toBeGreaterThanOrEqual(0.50);
    });

    it("uses embedding similarity for semantically aligned answers with different words", async () => {
      mockEmbedText
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0.82, 0.18, 0]);

      const result = await supervisor.evaluate({
        userMessage: "come posso superare la paura di cambiare carriera?",
        draft: "Ecco un modo pratico: 1. Scrivi entro stasera quali competenze trasferibili hai gia. 2. Scegli due ruoli compatibili con il tuo profilo. 3. Parla questa settimana con una persona che lavora in quei ruoli. L'obiettivo e ridurre il rischio percepito con dati reali, non convincerti a fare un salto al buio.",
        domain: "career",
        intent: "problem_solve",
      });

      expect(mockEmbedText).toHaveBeenCalledTimes(2);
      expect(result.dimensions.onTopic).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe("rewrite", () => {
    it("returns rewritten text when successful", async () => {
      mockChatOnce.mockResolvedValue(
        "Ecco 3 azioni concrete: 1. Analizza le tue spese. 2. Crea un budget mensile. 3. Automatizza il risparmio.",
      );

      const failResult = await supervisor.evaluate({
        userMessage: "come risparmio?",
        draft: "Risparmia è importante.",
        domain: "finance",
        intent: "plan",
      });

      const rewritten = await supervisor.rewrite(
        { userMessage: "come risparmio?", draft: "Risparmia è importante.", domain: "finance", intent: "plan" },
        failResult,
      );
      expect(rewritten).not.toBe("Risparmia è importante.");
      expect(rewritten.length).toBeGreaterThan(20);
    });

    it("keeps original if rewrite degrades quality", async () => {
      const goodDraft = "Ecco cosa fare: 1. Prendi un respiro. 2. Identifica il problema. 3. Chiedi supporto.";

      mockChatOnce.mockResolvedValue("breve");

      const failResult = await supervisor.evaluate({
        userMessage: "aiuto",
        draft: goodDraft,
        domain: "mindset",
        intent: "problem_solve",
      });

      const rewritten = await supervisor.rewrite(
        { userMessage: "aiuto", draft: goodDraft, domain: "mindset", intent: "problem_solve" },
        failResult,
      );
      expect(rewritten).toBe(goodDraft);
    });

    it("redacts obvious PII before writing supervisor logs", async () => {
      mockChatOnce.mockResolvedValue(
        "Ecco 3 azioni concrete: 1. Scrivi le spese oggi. 2. Scegli un limite. 3. Ricontrolla venerdi.",
      );
      const failResult = await supervisor.evaluate({
        userMessage: "scrivimi a ada@example.com o chiamami al +39 333 123 4567",
        draft: "Ti rispondo via ada@example.com e telefono +39 333 123 4567.",
        domain: "finance",
        intent: "plan",
      });

      await supervisor.rewrite(
        {
          userMessage: "scrivimi a ada@example.com o chiamami al +39 333 123 4567",
          draft: "Ti rispondo via ada@example.com e telefono +39 333 123 4567.",
          domain: "finance",
          intent: "plan",
        },
        failResult,
      );

      expect(mockDbValues).toHaveBeenCalledWith(expect.objectContaining({
        userMessage: "scrivimi a [redacted-email] o chiamami al [redacted-phone]",
        draft: "Ti rispondo via [redacted-email] e telefono [redacted-phone].",
      }));
      const logged = mockDbValues.mock.calls.at(-1)?.[0] as { userMessage: string; draft: string };
      expect(logged.userMessage).not.toContain("ada@example.com");
      expect(logged.draft).not.toContain("+39 333 123 4567");
    });
  });
});
