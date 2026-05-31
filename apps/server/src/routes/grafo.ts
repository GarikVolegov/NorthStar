import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";

const router = Router();

const NodeTypeSchema = z.enum(["role", "skill", "tool", "certification"]);

const ChatBodySchema = z.object({
  messages: z
    .array(z.object({ role: z.string(), content: z.string().max(5000) }))
    .optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: NodeTypeSchema,
        description: z.string().optional(),
      }),
    )
    .optional(),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).optional(),
  sectorName: z.string().optional(),
});

function buildFallbackGraph(sectorId: number) {
  const prefix = `sector-${sectorId}`;
  return {
    nodes: [
      {
        id: `${prefix}-role`,
        label: "Ruoli del settore",
        type: "role",
        description: "Punto di partenza per mappare ruoli e opportunita del settore.",
      },
      {
        id: `${prefix}-skill`,
        label: "Competenze chiave",
        type: "skill",
        description: "Competenze da validare con esperienze, progetti o contenuti salvati.",
      },
      {
        id: `${prefix}-tool`,
        label: "Strumenti utili",
        type: "tool",
        description: "Strumenti e metodi che possono supportare l'esplorazione.",
      },
      {
        id: `${prefix}-certification`,
        label: "Percorsi formativi",
        type: "certification",
        description: "Corsi o certificazioni da valutare dopo aver chiarito il focus.",
      },
    ],
    edges: [
      { from: `${prefix}-role`, to: `${prefix}-skill`, label: "richiede" },
      { from: `${prefix}-skill`, to: `${prefix}-tool`, label: "si pratica con" },
      { from: `${prefix}-skill`, to: `${prefix}-certification`, label: "si consolida con" },
    ],
  };
}

function parseSectorId(rawId: string | undefined) {
  const sectorId = Number.parseInt(rawId ?? "", 10);
  return Number.isInteger(sectorId) && sectorId > 0 ? sectorId : null;
}

router.get("/:id", requireAuth, async (req, res) => {
  const sectorId = parseSectorId(req.params.id);
  if (sectorId === null) {
    res.status(400).json({ error: "Settore non valido" });
    return;
  }

  res.json(buildFallbackGraph(sectorId));
});

router.post("/:id/chat", requireAuth, async (req, res) => {
  const parsed = ChatBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta chat non valida" });
    return;
  }

  const sectorId = parseSectorId(req.params.id);
  if (sectorId === null) {
    res.status(400).json({ error: "Settore non valido" });
    return;
  }

  const graph = parsed.data.nodes?.length ? parsed.data : buildFallbackGraph(sectorId);
  const sectorName = parsed.data.sectorName?.trim() || `settore ${sectorId}`;
  const latestQuestion = parsed.data.messages?.filter((message) => message.role === "user").at(-1)?.content;
  const nodeLabels = (graph.nodes ?? []).slice(0, 4).map((node) => node.label).join(", ");

  const text = latestQuestion
    ? `Sul grafo ${sectorName}, partirei da questi segnali: ${nodeLabels || "nessun nodo salvato"}. Per la domanda "${latestQuestion}", scegli un nodo, aggiungi evidenze concrete e collega le competenze ai ruoli che vuoi esplorare.`
    : `Sul grafo ${sectorName}, aggiungi nodi personali e collega ruoli, competenze, strumenti e formazione per renderlo piu utile.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
});

export default router;
