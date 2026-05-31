import { Router } from "express";
import {
  computeVitalSigns,
  getLLM,
  modelFor,
  type VitalSigns,
} from "@workspace/ai-server";
import { requireAuth } from "../middleware/auth";
import { createWendyOrchestrator } from "../services/wendy/wendy-orchestrator.service";

type ComputeSectorVitals = (sectorId: number, geography?: string) => Promise<VitalSigns>;
type SummarizeSectorVitals = (input: {
  userId: number;
  sectorId: number;
  geography: string;
  vitals: VitalSigns;
}) => Promise<string>;

interface SectorVitalsRouterDeps {
  compute?: ComputeSectorVitals;
  summarize?: SummarizeSectorVitals;
}

export function createSectorVitalsRouter({
  compute = computeVitalSigns,
  summarize = summarizeVitalsWithWendy,
}: SectorVitalsRouterDeps = {}) {
  const router = Router();

  router.get("/:id/vitals", async (req, res) => {
    const sectorId = readPositiveId(req.params.id);
    if (!sectorId) {
      res.status(400).json({ error: "ID settore non valido" });
      return;
    }

    const geography = readGeography(req.query.geography);
    const vitals = await compute(sectorId, geography);
    res.json(vitals);
  });

  router.post("/:id/vitals/summary", requireAuth, async (req, res) => {
    const sectorId = readPositiveId(req.params.id);
    if (!sectorId) {
      res.status(400).json({ error: "ID settore non valido" });
      return;
    }

    const geography = readGeography((req.body as { geography?: unknown })?.geography);
    const vitals = await compute(sectorId, geography);
    const summary = await summarize({
      userId: req.user!.id,
      sectorId,
      geography,
      vitals,
    });
    res.json({ summary });
  });

  return router;
}

async function summarizeVitalsWithWendy(input: {
  userId: number;
  sectorId: number;
  geography: string;
  vitals: VitalSigns;
}): Promise<string> {
  try {
    const routeModel = modelFor("growth-agent-chat");
    const llm = getLLM();
    const orchestrator = createWendyOrchestrator({
      async *stream({ prompt, message }) {
        const stream = await llm.chat(
          [
            { role: "system", content: prompt },
            { role: "user", content: message },
          ],
          { model: routeModel, temperature: 0.2, maxTokens: 120 },
        );
        yield* stream;
      },
    });

    const chunks: string[] = [];
    for await (const chunk of orchestrator.run({
      userId: input.userId,
      message: buildSummaryPrompt(input),
      context: {
        locale: "it",
        ragContext: JSON.stringify({
          sectorId: input.sectorId,
          geography: input.geography,
          vitals: input.vitals,
        }),
      },
    })) {
      chunks.push(chunk);
    }
    return chunks.join("").trim() || fallbackSummary(input.vitals);
  } catch {
    return fallbackSummary(input.vitals);
  }
}

function buildSummaryPrompt(input: {
  sectorId: number;
  geography: string;
  vitals: VitalSigns;
}): string {
  return [
    "Scrivi una singola frase markdown, massimo 22 parole, per etichettare la salute del settore.",
    "Non inventare fonti. Usa solo questi vital signs JSON.",
    `Settore ID: ${input.sectorId}`,
    `Geografia: ${input.geography}`,
    JSON.stringify(input.vitals.signs),
  ].join("\n");
}

function fallbackSummary(vitals: VitalSigns): string {
  const greenCount = Object.values(vitals.signs).filter((sign) => sign.status === "green").length;
  if (greenCount >= 4) return "Settore in salute: domanda, segnali e attenzione mostrano un quadro favorevole.";
  if (greenCount >= 2) return "Settore in equilibrio: alcuni segnali spingono, altri richiedono monitoraggio ravvicinato.";
  return "Settore sotto osservazione: i segnali vitali suggeriscono cautela prima di accelerare.";
}

function readPositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function readGeography(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "IT";
}

export default createSectorVitalsRouter();
