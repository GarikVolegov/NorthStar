import { Router } from "express";
import { ai } from "../lib/ai/index.js";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const graphCache = new Map<number, { nodes: GraphNode[]; edges: GraphEdge[] }>();

interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
  userAdded?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  userAdded?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.get("/grafo/:sectorId", async (req, res): Promise<void> => {
  const sectorId = parseInt(String(req.params.sectorId), 10);
  if (isNaN(sectorId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  if (!req.query.refresh && graphCache.has(sectorId)) {
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
    const text = await ai.chat({
      useCase: "json_extraction",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      temperature: 0.3,
    });

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

router.post("/grafo/:sectorId/chat", async (req, res): Promise<void> => {
  const sectorId = parseInt(String(req.params.sectorId), 10);
  if (isNaN(sectorId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  const { messages, nodes, edges, sectorName } = req.body as {
    messages: ChatMessage[];
    nodes: GraphNode[];
    edges: GraphEdge[];
    sectorName: string;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages obbligatori" });
    return;
  }

  const allNodes: GraphNode[] = Array.isArray(nodes) ? nodes : [];
  const allEdges: GraphEdge[] = Array.isArray(edges) ? edges : [];

  const nodeLines = allNodes.map((n) => {
    const tag = n.userAdded ? " [aggiunto da te]" : "";
    return `[${n.type.toUpperCase()}] ${n.label}${tag}: ${n.description}`;
  });

  const findLabel = (id: string) => allNodes.find((n) => n.id === id)?.label ?? id;
  const edgeLines = allEdges.map((e) => {
    const rel = e.label ? ` —${e.label}→ ` : " → ";
    return `${findLabel(e.from)}${rel}${findLabel(e.to)}`;
  });

  const systemPrompt = `Sei un esperto del settore professionale "${sectorName || "specificato"}" in Italia. 
L'utente ha costruito un grafo della conoscenza su questo settore. Rispondi SEMPRE basandoti principalmente sui dati presenti nel grafo. 
Se l'utente ha aggiunto nodi personalizzati, trattali con la stessa importanza dei nodi generati dall'AI.
Puoi ampliare con conoscenze generali se utile, ma segnalalo chiaramente.
Rispondi in italiano, in modo chiaro, pratico e specifico.

═══ GRAFO DELLA CONOSCENZA ═══

NODI (${allNodes.length} totali):
${nodeLines.join("\n")}

CONNESSIONI (${allEdges.length} totali):
${edgeLines.join("\n")}

═════════════════════════════`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.slice(-10),
    ];

    for await (const chunk of ai.streamChat({
      useCase: "streaming_chat",
      messages: allMessages,
      maxTokens: 1024,
    })) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ text: "\n\n[Errore nella generazione della risposta]" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
