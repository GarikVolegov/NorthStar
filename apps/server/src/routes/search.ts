import { Router } from "express";
import { or, sql } from "drizzle-orm";
import {
  db,
  sectorsTable,
  professionsTable,
  growthArticlesTable,
  newsArticlesTable,
} from "@workspace/db";
import { runSearchOrchestrator, loadMemory, buildMemorySection } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const router = Router();

interface SearchResult {
  type: "sector" | "role" | "article" | "news";
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
}

router.get("/", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const pattern = `%${q}%`;

    const [sectors, roles, articles, newsItems] = await Promise.all([
      db
        .select({
          id: sectorsTable.id,
          title: sectorsTable.name,
          description: sectorsTable.description,
          icon: sectorsTable.icon,
          color: sectorsTable.color,
        })
        .from(sectorsTable)
        .where(
          or(
            sql`${sectorsTable.name} ILIKE ${pattern}`,
            sql`${sectorsTable.description} ILIKE ${pattern}`,
          ),
        )
        .limit(5),

      db
        .select({
          id: professionsTable.id,
          title: professionsTable.title,
          description: professionsTable.description,
        })
        .from(professionsTable)
        .where(
          or(
            sql`${professionsTable.title} ILIKE ${pattern}`,
            sql`${professionsTable.description} ILIKE ${pattern}`,
            sql`${professionsTable.skills}::text ILIKE ${pattern}`,
          ),
        )
        .limit(5),

      db
        .select({
          id: growthArticlesTable.id,
          title: growthArticlesTable.title,
          description: growthArticlesTable.description,
          slug: growthArticlesTable.slug,
          category: growthArticlesTable.category,
        })
        .from(growthArticlesTable)
        .where(
          or(
            sql`${growthArticlesTable.title} ILIKE ${pattern}`,
            sql`${growthArticlesTable.description} ILIKE ${pattern}`,
            sql`${growthArticlesTable.tags}::text ILIKE ${pattern}`,
          ),
        )
        .limit(5),

      db
        .select({
          id: newsArticlesTable.id,
          title: newsArticlesTable.title,
          description: newsArticlesTable.summary,
          category: newsArticlesTable.category,
          source: newsArticlesTable.source,
        })
        .from(newsArticlesTable)
        .where(
          or(
            sql`${newsArticlesTable.title} ILIKE ${pattern}`,
            sql`${newsArticlesTable.summary} ILIKE ${pattern}`,
          ),
        )
        .limit(5),
    ]);

    const results: SearchResult[] = [
      ...sectors.map((s) => ({
        type: "sector" as const,
        id: s.id,
        title: s.title,
        description: s.description,
        url: `/settore/${s.id}`,
        icon: s.icon,
        color: s.color,
      })),
      ...roles.map((r) => ({
        type: "role" as const,
        id: r.id,
        title: r.title,
        description: r.description ?? "",
        url: `/ruolo/${r.id}`,
        icon: "briefcase",
        color: "#10b981",
      })),
      ...articles.map((a) => ({
        type: "article" as const,
        id: a.id,
        title: a.title,
        description: a.description,
        url: `/crescita/articolo/${a.slug}`,
        icon: "book-open-text",
        color: "#f59e0b",
      })),
      ...newsItems.map((n) => ({
        type: "news" as const,
        id: n.id,
        title: n.title,
        description: n.description,
        url: `/news`,
        icon: "newspaper",
        color: "#8b5cf6",
      })),
    ];

    if (results.length === 0) {
      results.push(
        { type: "sector", id: 1, title: "Tecnologia", description: "Settore tecnologico e informatico", url: "/settore/1", icon: "layers", color: "#6366f1" },
        { type: "sector", id: 2, title: "Marketing", description: "Settore del marketing e della comunicazione", url: "/settore/2", icon: "layers", color: "#6366f1" },
        { type: "sector", id: 3, title: "Finanza", description: "Settore finanziario e bancario", url: "/settore/3", icon: "layers", color: "#6366f1" },
        { type: "sector", id: 4, title: "Sanità", description: "Settore sanitario e farmaceutico", url: "/settore/4", icon: "layers", color: "#6366f1" },
        { type: "sector", id: 5, title: "Istruzione", description: "Settore dell'istruzione e della formazione", url: "/settore/5", icon: "layers", color: "#6366f1" },
      );
    }

    res.json({ results });
  } catch (err) {
    req.log?.error?.({ err }, "search error");
    res.status(500).json({ error: "Errore nella ricerca" });
  }
});

// ── GET /api/search/suggest  —  AI-powered suggestions ───
router.get("/suggest", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const suggestions: Array<{
      title: string;
      description: string;
      url: string;
    }> = [];

    const pattern = `%${q}%`;

    const [sectors, roles, articles, newsItems] = await Promise.all([
      db
        .select({ id: sectorsTable.id, title: sectorsTable.name, description: sectorsTable.description })
        .from(sectorsTable)
        .where(or(sql`${sectorsTable.name} ILIKE ${pattern}`, sql`${sectorsTable.description} ILIKE ${pattern}`))
        .limit(3),
      db
        .select({ id: professionsTable.id, title: professionsTable.title, description: professionsTable.description })
        .from(professionsTable)
        .where(or(sql`${professionsTable.title} ILIKE ${pattern}`, sql`${professionsTable.description} ILIKE ${pattern}`))
        .limit(3),
      db
        .select({ id: growthArticlesTable.id, title: growthArticlesTable.title, slug: growthArticlesTable.slug })
        .from(growthArticlesTable)
        .where(or(sql`${growthArticlesTable.title} ILIKE ${pattern}`, sql`${growthArticlesTable.tags}::text ILIKE ${pattern}`))
        .limit(2),
      db
        .select({ id: newsArticlesTable.id, title: newsArticlesTable.title })
        .from(newsArticlesTable)
        .where(or(sql`${newsArticlesTable.title} ILIKE ${pattern}`, sql`${newsArticlesTable.summary} ILIKE ${pattern}`))
        .limit(2),
    ]);

    if (sectors.length > 0) {
      suggestions.push({
        title: `Esplora il settore: ${sectors[0].title}`,
        description: sectors[0].description,
        url: `/settore/${sectors[0].id}`,
      });
    }
    if (roles.length > 0) {
      suggestions.push({
        title: `Ruolo: ${roles[0].title}`,
        description: roles[0].description ?? "",
        url: `/ruolo/${roles[0].id}`,
      });
    }
    if (articles.length > 0) {
      suggestions.push({
        title: `Leggi: ${articles[0].title}`,
        description: "Articolo di crescita personale",
        url: `/crescita/articolo/${articles[0].slug}`,
      });
    }
    if (newsItems.length > 0) {
      suggestions.push({
        title: `Notizie: ${newsItems[0].title}`,
        description: "Novità dal settore",
        url: "/news",
      });
    }

    suggestions.push({
      title: "Chiedi a Wendy",
      description: `Parla con l'AI per approfondire "${q}"`,
      url: "#wendy",
    });
    suggestions.push({
      title: "Cerca nel Knowledge Graph",
      description: "Scopri connessioni e approfondimenti",
      url: "/archivio",
    });

    res.json({ suggestions });
  } catch (err) {
    req.log?.error?.({ err }, "search suggest error");
    res.json({ suggestions: [] });
  }
});

// ── POST /api/search/orchestrate  —  SSE orchestratore AI ───────────────────
router.post("/orchestrate", async (req, res) => {
  const { q, sessionId, history = [] } = req.body as {
    q: string;
    sessionId?: number;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!q || q.trim().length < 2) {
    res.status(400).json({ error: "Query troppo corta" });
    return;
  }

  const isAuthenticated = !!req.user;
  const userId = req.user?.id ?? 0;
  const isPremium = !!req.user?.stripeSubscriptionId;

  // If not authenticated, use a simpler flow without user-specific data
  if (!isAuthenticated) {
    rootLogger.info({ q, sessionId }, "[search/orchestrate] unauthenticated — using public flow");

    res.setHeader("Content-Type",    "text/event-stream");
    res.setHeader("Cache-Control",   "no-cache");
    res.setHeader("Connection",      "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Use public knowledge base only, no user memory
      for await (const event of runSearchOrchestrator({
        query:      q.trim(),
        userId:     0, // anonymous
        sessionId,
        userContext: { isPremium: false, memorySection: "" },
        history,
        requestId:  crypto.randomUUID?.() ?? Math.random().toString(36),
      })) {
        send(event);
        if (event.type === "done" || event.type === "error") break;
      }
    } catch (err) {
      rootLogger.error({ err, q }, "[search/orchestrate] unhandled error (unauthenticated)");
      send({ type: "error", message: "Errore interno" });
    } finally {
      res.end();
    }
    return;
  }

  // Authenticated flow
  res.setHeader("Content-Type",    "text/event-stream");
  res.setHeader("Cache-Control",   "no-cache");
  res.setHeader("Connection",      "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  rootLogger.info({ userId, q, sessionId }, "[search/orchestrate] started");

  try {
    // Carica memoria utente in anticipo
    const userMemory    = await loadMemory(userId);
    const memorySection = buildMemorySection(userMemory);

    for await (const event of runSearchOrchestrator({
      query:      q.trim(),
      userId,
      sessionId,
      userContext: { isPremium, memorySection },
      history,
      requestId:  crypto.randomUUID?.() ?? Math.random().toString(36),
    })) {
      send(event);
      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    rootLogger.error({ err, userId, q }, "[search/orchestrate] unhandled error");
    send({ type: "error", message: "Errore interno" });
  } finally {
    res.end();
  }
});

export default router;
