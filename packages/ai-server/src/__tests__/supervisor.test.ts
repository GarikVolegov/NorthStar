import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupervisorAgent } from "../growth-agent/supervisor-agent";

const mockChatOnce = vi.fn();

vi.mock("../llm/client", () => ({
  getLLM: vi.fn(() => ({
    chatOnce: mockChatOnce,
  })),
}));

vi.mock("../db/client", () => ({
  db: null,
}));

describe("SupervisorAgent", () => {
  let supervisor: SupervisorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    supervisor = new SupervisorAgent();
  });

  describe("evaluate", () => {
    it("passes a good response with actions", () => {
      const result = supervisor.evaluate({
        userMessage: "come trovo lavoro?",
        draft: "Ecco 3 passi concreti: 1. Aggiorna il CV con le ultime esperienze. 2. Contatta 5 recruiter su LinkedIn entro questa settimana. 3. Preparati per i colloqui tecnici studiando system design.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.70);
    });

    it("fails a response with platitudes", () => {
      const result = supervisor.evaluate({
        userMessage: "non ce la faccio",
        draft: "Credi in te stesso e tutto è possibile. Non mollare mai. Il successo arriva per chi persevera. Sei sulla strada giusta.",
        domain: "mindset",
        intent: "reflect",
      });
      expect(result.dimensions.platitudeFree).toBeLessThanOrEqual(0.30);
    });

    it("applies low actionability weight for vent responses", () => {
      const result = supervisor.evaluate({
        userMessage: "oggi è stata una giornata terribile",
        draft: "Mi dispiace che tu abbia passato una giornata così difficile. Ti ascolto. Cosa è successo di preciso?",
        domain: "general",
        intent: "vent",
      });
      expect(result.dimensions.actionability).toBeLessThan(0.30);
    });

    it("passes vent response without actions (correctly weighted)", () => {
      const result = supervisor.evaluate({
        userMessage: "sono molto giù oggi",
        draft: "Mi dispiace che tu stia attraversando questo momento. Sono qui per ascoltarti. Vuoi parlare di cosa è successo?",
        domain: "general",
        intent: "vent",
      });
      // Vent intent has 0.00 actionability weight, so it passes on empathy alone
      expect(result.pass).toBe(true);
    });

    it("fails plan response without action steps", () => {
      const result = supervisor.evaluate({
        userMessage: "fammi un piano carriera",
        draft: "Il tuo percorso professionale è importante. Dovresti considerare le tue opzioni e fare delle scelte. Il tempo è dalla tua parte.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("passes problem_solve with concrete advice", () => {
      const result = supervisor.evaluate({
        userMessage: "come preparo un colloquio?",
        draft: "Prepara 3 domande strategiche da fare al recruiter. Studia la mission aziendale. Prepara 2 esempi di successo con dati. Simula il colloquio con un amico. Dormi 8 ore prima.",
        domain: "career",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(true);
    });

    it("fails problem_solve without concrete steps", () => {
      const result = supervisor.evaluate({
        userMessage: "come risolvo questo problema?",
        draft: "Devi pensarci bene e trovare la soluzione giusta per te. Ogni problema ha una soluzione. Con calma troverai la strada.",
        domain: "general",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(false);
    });

    it("passes reflect with thoughtful content", () => {
      const result = supervisor.evaluate({
        userMessage: "sto riflettendo sul mio percorso",
        draft: "È normale fermarsi a riflettere sul proprio cammino. Quali sono state le scelte che ti hanno portato fin qui? Cosa vorresti di diverso? A volte guardare indietro aiuta a capire cosa vogliamo veramente.",
        domain: "general",
        intent: "reflect",
      });
      expect(result.pass).toBe(true);
    });

    it("fails reflect with generic platitudes", () => {
      const result = supervisor.evaluate({
        userMessage: "rifletto sulla mia vita",
        draft: "La vita è un viaggio meraviglioso. Ogni giorno è un nuovo inizio. Il cambiamento inizia da dentro. Ricorda che puoi farcela.",
        domain: "general",
        intent: "reflect",
      });
      expect(result.pass).toBe(false);
    });

    it("passes ask_info with factual content", () => {
      const result = supervisor.evaluate({
        userMessage: "quanto costa un corso di laurea?",
        draft: "In Italia, le tasse universitarie variano da 150€ a 3.500€ all'anno in base all'ISEE. Le borse di studio DSU coprono tasse e danno contributo fino a 7.000€. I dati sono aggiornati al 2025.",
        domain: "general",
        intent: "ask_info",
      });
      expect(result.pass).toBe(true);
    });

    it("fails ask_info with vague non-answer", () => {
      const result = supervisor.evaluate({
        userMessage: "quanto costa?",
        draft: "Dipende da tanti fattori. Ogni università ha i suoi costi. Dovresti informarti direttamente.",
        domain: "general",
        intent: "ask_info",
      });
      expect(result.pass).toBe(false);
    });

    it("passes explore with balanced exploration", () => {
      const result = supervisor.evaluate({
        userMessage: "che opzioni ho?",
        draft: "Ecco 3 percorsi possibili: 1. Formazione tecnica (6 mesi, costo 2.000€). 2. Corso universitario (3 anni, costo 1.500€/anno). 3. Auto-apprendimento (gratuito, 12 mesi). Ognuno ha pro e contro. Quale ti interessa approfondire?",
        domain: "career",
        intent: "explore",
      });
      expect(result.pass).toBe(true);
    });

    it("flags short responses", () => {
      const result = supervisor.evaluate({
        userMessage: "ciao",
        draft: "Ciao!",
        domain: "general",
        intent: "explore",
      });
      expect(result.dimensions.lengthOk).toBeLessThan(0.50);
    });

    it("rejects empty plan drafts", () => {
      const result = supervisor.evaluate({
        userMessage: "fammi un piano",
        draft: "Certo, ecco il tuo piano personale.",
        domain: "general",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
    });

    it("passes when onTopic is high", () => {
      const result = supervisor.evaluate({
        userMessage: "come investire in ETF",
        draft: "Per investire in ETF: 1. Apri un conto titoli. 2. Scegli ETF a basso costo come VWCE o SWDA. 3. Imposta un PAC mensile. 4. Ribilancia una volta all'anno. 5. Tieni per almeno 10 anni.",
        domain: "finance",
        intent: "problem_solve",
      });
      expect(result.pass).toBe(true);
      expect(result.dimensions.onTopic).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe("rewrite", () => {
    it("returns rewritten text when successful", async () => {
      mockChatOnce.mockResolvedValue(
        "Ecco 3 azioni concrete: 1. Analizza le tue spese. 2. Crea un budget mensile. 3. Automatizza il risparmio.",
      );

      const failResult = supervisor.evaluate({
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

      const failResult = supervisor.evaluate({
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
  });
});
