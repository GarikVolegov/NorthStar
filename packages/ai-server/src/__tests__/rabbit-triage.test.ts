import { describe, expect, it } from "vitest";
import { checkRabbitEmergency } from "../rabbit/emergency-triage";

describe("checkRabbitEmergency", () => {
  // ── RED signals ────────────────────────────────────────────────────────────

  describe("anorexia with duration", () => {
    it("non mangia da 8 ore → emergency", () => {
      const r = checkRabbitEmergency("il mio coniglio non mangia da 8 ore");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("anorexia_duration");
    });

    it("non beve da 6 ore → emergency", () => {
      const r = checkRabbitEmergency("il coniglio non beve da 6 ore");
      expect(r.isEmergency).toBe(true);
    });

    it("smesso di mangiare → emergency", () => {
      const r = checkRabbitEmergency("il mio coniglio ha smesso di mangiare");
      expect(r.isEmergency).toBe(true);
    });

    it("non mangia da 2 ore (< 4h) → NOT emergency", () => {
      const r = checkRabbitEmergency("il coniglio non mangia da 2 ore");
      expect(r.isEmergency).toBe(false);
    });
  });

  describe("no feces", () => {
    it("non defeca → emergency", () => {
      const r = checkRabbitEmergency("il coniglio non defeca più");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("no_feces");
    });

    it("niente feci → emergency", () => {
      const r = checkRabbitEmergency("non ci sono niente feci nella gabbia");
      expect(r.isEmergency).toBe(true);
    });

    it("niente cacche → emergency", () => {
      const r = checkRabbitEmergency("il bunny non fa niente cacche");
      expect(r.isEmergency).toBe(true);
    });
  });

  describe("bloated abdomen", () => {
    it("pancia gonfia → emergency", () => {
      const r = checkRabbitEmergency("ha la pancia gonfia e dura");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("bloated_abdomen");
    });

    it("addome rigido → emergency", () => {
      const r = checkRabbitEmergency("addome rigido non mangia");
      expect(r.isEmergency).toBe(true);
    });

    it("timpanismo → emergency", () => {
      const r = checkRabbitEmergency("il coniglio ha il timpanismo");
      expect(r.isEmergency).toBe(true);
    });
  });

  describe("head tilt", () => {
    it("testa storta → emergency", () => {
      const r = checkRabbitEmergency("il coniglio tiene la testa storta");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("head_tilt");
    });

    it("torcicollo → emergency", () => {
      const r = checkRabbitEmergency("sembra avere il torcicollo");
      expect(r.isEmergency).toBe(true);
    });

    it("head tilt (english) → emergency", () => {
      const r = checkRabbitEmergency("ha un head tilt improvviso");
      expect(r.isEmergency).toBe(true);
    });
  });

  describe("bruxism", () => {
    it("bruxismo → emergency", () => {
      const r = checkRabbitEmergency("fa bruxismo continuo");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("bruxism");
    });

    it("stride i denti → emergency", () => {
      const r = checkRabbitEmergency("stride i denti di continuo");
      expect(r.isEmergency).toBe(true);
    });
  });

  describe("seizure", () => {
    it("convulsioni → emergency", () => {
      const r = checkRabbitEmergency("il coniglio ha avuto delle convulsioni");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("seizure");
    });
  });

  describe("GI stasis direct", () => {
    it("stasi intestinale → emergency", () => {
      const r = checkRabbitEmergency("penso abbia la stasi intestinale");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("gi_stasis_direct");
    });
  });

  describe("toxic ingestion", () => {
    it("ha mangiato ciclamino → emergency", () => {
      const r = checkRabbitEmergency("il coniglio ha mangiato del ciclamino");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("toxic_ingestion");
    });

    it("avvelenamento → emergency", () => {
      const r = checkRabbitEmergency("sospetto avvelenamento");
      expect(r.isEmergency).toBe(true);
    });
  });

  describe("blood in urine", () => {
    it("sangue nelle urine → emergency", () => {
      const r = checkRabbitEmergency("ho visto sangue nelle urine del coniglio");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) expect(r.matchedSignals).toContain("blood_urine");
    });
  });

  // ── AMBER signals (2+ required) ────────────────────────────────────────────

  describe("amber signals", () => {
    it("single amber (letargia) → NOT emergency", () => {
      const r = checkRabbitEmergency("il coniglio è un po' pigro oggi");
      expect(r.isEmergency).toBe(false);
    });

    it("single amber (mangia poco) → NOT emergency", () => {
      const r = checkRabbitEmergency("mangia un po' meno del solito");
      expect(r.isEmergency).toBe(false);
    });

    it("2 ambers: pigro + mangia poco → emergency", () => {
      const r = checkRabbitEmergency("il coniglio è pigro e mangia poco");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) {
        expect(r.matchedSignals.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("2 ambers: letargico + feci ridotte → emergency", () => {
      const r = checkRabbitEmergency("è letargico e ho notato poche feci");
      expect(r.isEmergency).toBe(true);
    });

    it("2 ambers: rannicchiato + scarso appetito → emergency", () => {
      const r = checkRabbitEmergency("è rannicchiato in un angolo e ha scarso appetito");
      expect(r.isEmergency).toBe(true);
    });
  });

  // ── Safe queries ───────────────────────────────────────────────────────────

  describe("safe queries — no emergency", () => {
    it("quanto vive un coniglio", () => {
      expect(checkRabbitEmergency("quanto vive un coniglio in media?").isEmergency).toBe(false);
    });

    it("cosa mangia un coniglio", () => {
      expect(checkRabbitEmergency("cosa può mangiare il mio coniglio?").isEmergency).toBe(false);
    });

    it("quale razza di coniglio adottare", () => {
      expect(checkRabbitEmergency("quale razza di coniglio mi consigli?").isEmergency).toBe(false);
    });

    it("pulizia gabbia", () => {
      expect(checkRabbitEmergency("ogni quanto pulisco la gabbia del coniglio?").isEmergency).toBe(false);
    });

    it("posso dare le carote", () => {
      expect(checkRabbitEmergency("posso dare le carote al mio coniglio ogni giorno?").isEmergency).toBe(false);
    });
  });

  // ── Accented input normalization ───────────────────────────────────────────

  describe("Italian accents normalized", () => {
    it("handles accented characters", () => {
      const r = checkRabbitEmergency("il coniglio non defecà più e ha difficoltà respiratorie");
      expect(r.isEmergency).toBe(true);
    });

    it("mixed case", () => {
      const r = checkRabbitEmergency("TESTA STORTA del mio Coniglio");
      expect(r.isEmergency).toBe(true);
    });
  });

  // ── Response text ──────────────────────────────────────────────────────────

  describe("response text", () => {
    it("emergency response contains vet instruction", () => {
      const r = checkRabbitEmergency("non defeca da ore");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) {
        expect(r.responseText).toContain("veterinario");
        expect(r.responseText).toContain("ORA");
      }
    });

    it("matched signals not exposed in responseText", () => {
      const r = checkRabbitEmergency("ha la testa storta");
      expect(r.isEmergency).toBe(true);
      if (r.isEmergency) {
        expect(r.responseText).not.toContain("head_tilt");
        expect(r.responseText).not.toContain("matchedSignals");
      }
    });
  });
});
