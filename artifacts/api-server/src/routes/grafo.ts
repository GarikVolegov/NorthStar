import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// In-memory cache: sectorId → graph data
const graphCache = new Map<number, { nodes: GraphNode[]; edges: GraphEdge[] }>();

interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

router.get("/grafo/:sectorId", async (req, res): Promise<void> => {
  const sectorId = parseInt(req.params.sectorId, 10);
  if (isNaN(sectorId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  if (graphCache.has(sectorId)) {
    res.json(graphCache.get(sectorId));
    return;
  }

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) {
    res.status(404).json({ error: "Settore non trovato" });
    return;
  }

  const prompt = `Crea un grafo della conoscenza per il settore professionale "${sector.name}" in Italia.

Competenze del settore: ${sector.skills.join(", ")}
Descrizione: ${sector.description}

Rispondi SOLO con JSON valido (nessun testo prima o dopo). Struttura esatta:
{
  "nodes": [
    {"id": "role_1", "label": "Nome Ruolo", "type": "role", "description": "Breve descrizione del ruolo in 1 frase"},
    {"id": "skill_1", "label": "Nome Skill", "type": "skill", "description": "Cosa comporta questa competenza"},
    {"id": "tool_1", "label": "Nome Strumento", "type": "tool", "description": "A cosa serve questo strumento"},
    {"id": "cert_1", "label": "Nome Certificazione", "type": "certification", "description": "Cosa certifica e chi la rilascia"}
  ],
  "edges": [
    {"from": "role_1", "to": "skill_1", "label": "richiede"},
    {"from": "skill_1", "to": "tool_1", "label": "usa"},
    {"from": "skill_1", "to": "cert_1", "label": "porta a"}
  ]
}

Regole tassative:
- Esattamente 5 nodi "role" (ruoli professionali reali in questo settore in Italia)
- Esattamente 7 nodi "skill" (competenze fondamentali e specifiche)
- Esattamente 5 nodi "tool" (software, piattaforme o tecnologie reali)
- Esattamente 4 nodi "certification" (certificazioni riconosciute nell'industria)
- Edges: ogni role deve connettersi ad almeno 2 skill, ogni skill a 1-2 tool e 0-1 cert
- Totale nodi: 21, totale edges: 25-35
- ID formato: role_1..role_5, skill_1..skill_7, tool_1..tool_5, cert_1..cert_4`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    let graph: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes: [], edges: [] };

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        graph = JSON.parse(jsonMatch[0]);
      }
    } catch {
      graph = { nodes: [], edges: [] };
    }

    graphCache.set(sectorId, graph);
    res.json(graph);
  } catch {
    res.status(500).json({ error: "Errore nella generazione del grafo" });
  }
});

export default router;
