import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

type ReadinessBand = "low" | "mid" | "high";

interface ReadinessComponents {
  selfKnowledge: number;
  exploration: number;
  reflection: number;
  emotion: number;
  commitment: number;
}

const COMPONENT_CAPS: ReadinessComponents = {
  selfKnowledge: 25,
  exploration: 25,
  reflection: 25,
  emotion: 15,
  commitment: 10,
};

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function bandFor(score: number): ReadinessBand {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function buildBaselineReadiness(reqUser: Express.Request["user"]) {
  const hasTestSession = Boolean(reqUser?.testSessionId);
  const hasOnboarding = Boolean(reqUser?.onboardingCompleted);
  const isUndecided = !reqUser?.journeyType || reqUser.journeyType === "indeciso";

  const components: ReadinessComponents = {
    selfKnowledge: clamp((hasTestSession ? 14 : 6) + (hasOnboarding ? 4 : 0), COMPONENT_CAPS.selfKnowledge),
    exploration: clamp(isUndecided ? 8 : 14, COMPONENT_CAPS.exploration),
    reflection: clamp(hasOnboarding ? 8 : 4, COMPONENT_CAPS.reflection),
    emotion: clamp(hasTestSession ? 6 : 3, COMPONENT_CAPS.emotion),
    commitment: clamp(isUndecided ? 2 : 7, COMPONENT_CAPS.commitment),
  };

  const score = (Object.values(components) as number[]).reduce((sum, value) => sum + value, 0);
  const weakest = Object.entries(components).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "exploration";

  const nudges: Record<string, { component: string; toolHref: string; message: string }> = {
    selfKnowledge: {
      component: "selfKnowledge",
      toolHref: "/test",
      message: "Completa o rivedi il test per aggiungere segnali su interessi, stile e motivazioni.",
    },
    exploration: {
      component: "exploration",
      toolHref: "/settori",
      message: "Esplora alcuni settori e salva quelli che ti incuriosiscono di piu.",
    },
    reflection: {
      component: "reflection",
      toolHref: "/diario",
      message: "Annota cosa ti attrae o ti frena: la scelta diventa piu chiara quando i segnali sono scritti.",
    },
    emotion: {
      component: "emotion",
      toolHref: "/coach",
      message: "Fai emergere dubbi ed energie con il coach prima di forzare una decisione.",
    },
    commitment: {
      component: "commitment",
      toolHref: "/profilo",
      message: "Quando un percorso ti sembra stabile, aggiorna il profilo per sbloccare strumenti piu mirati.",
    },
  };

  return {
    score,
    band: bandFor(score),
    components,
    nextNudge: nudges[weakest] ?? nudges.exploration,
    source: "baseline",
  };
}

router.get("/readiness", requireAuth, async (req, res) => {
  res.json(buildBaselineReadiness(req.user));
});

export default router;
