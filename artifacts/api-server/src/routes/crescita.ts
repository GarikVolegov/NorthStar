import { Router, type IRouter } from "express";
import { db, growthArticlesTable, userFavoritesTable } from "@workspace/db";
import { desc, eq, and, sql, ilike } from "drizzle-orm";

const router: IRouter = Router();

export const GROWTH_CATEGORIES = [
  { id: "autoconsapevolezza",      label: "Autoconsapevolezza",       icon: "🧠", description: "Capire chi sei, cosa vuoi e cosa ti blocca davvero." },
  { id: "motivazione",             label: "Motivazione",              icon: "🔥", description: "Alimentare la spinta interiore in modo duraturo." },
  { id: "abitudini",               label: "Abitudini",                icon: "🔄", description: "Costruire routine solide che ti portano avanti ogni giorno." },
  { id: "disciplina-e-focus",      label: "Disciplina e Focus",       icon: "🎯", description: "Mantenere la concentrazione su ciò che conta." },
  { id: "gestione-del-tempo",      label: "Gestione del Tempo",       icon: "⏱️", description: "Usare le ore in modo intenzionale e strategico." },
  { id: "emozioni-e-mentalita",    label: "Emozioni e Mentalità",     icon: "💭", description: "Lavorare sulle credenze limitanti e sul mindset." },
  { id: "obiettivi-e-visione",     label: "Obiettivi e Visione",      icon: "🌟", description: "Definire dove vai e costruire il percorso per arrivarci." },
  { id: "resilienza",              label: "Resilienza",               icon: "💪", description: "Reggere le pressioni e rimbalzare dopo i fallimenti." },
  { id: "comunicazione",           label: "Comunicazione",            icon: "💬", description: "Parlare, ascoltare e connettersi in modo efficace." },
  { id: "identita-personale",      label: "Identità Personale",       icon: "🪞", description: "Definire chi sei e chi vuoi diventare." },
  { id: "crescita-professionale",  label: "Crescita Professionale",   icon: "📈", description: "Evolvere nel lavoro con intenzione e strategia." },
  { id: "benessere-mentale",       label: "Benessere Mentale",        icon: "🌿", description: "Preservare l'energia mentale come risorsa strategica." },
  { id: "carriera-e-scelte-di-vita", label: "Carriera e Scelte di Vita", icon: "🧭", description: "Prendere decisioni difficili con più chiarezza." },
];

function getUser(req: any) {
  return req.session?.userId ? { id: req.session.userId as number } : null;
}

router.get("/crescita/categorie", async (_req, res): Promise<void> => {
  const counts = await db
    .select({ category: growthArticlesTable.category, count: sql<number>`count(*)::int` })
    .from(growthArticlesTable)
    .where(eq(growthArticlesTable.status, "published"))
    .groupBy(growthArticlesTable.category);

  const countMap: Record<string, number> = {};
  counts.forEach(r => { countMap[r.category] = r.count; });

  const categories = GROWTH_CATEGORIES.map(c => ({ ...c, count: countMap[c.id] ?? 0 }));
  res.json(categories);
});

router.get("/crescita/salvati", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }

  const saved = await db
    .select({ growthArticleId: userFavoritesTable.growthArticleId })
    .from(userFavoritesTable)
    .where(and(eq(userFavoritesTable.userId, user.id), eq(userFavoritesTable.type, "growth")));

  const ids = saved.map(s => s.growthArticleId).filter(Boolean) as number[];
  if (ids.length === 0) { res.json([]); return; }

  const articles = await db
    .select()
    .from(growthArticlesTable)
    .where(and(
      eq(growthArticlesTable.status, "published"),
      sql`${growthArticlesTable.id} = ANY(${ids})`
    ))
    .orderBy(desc(growthArticlesTable.updatedAt));
  res.json(articles);
});

router.get("/crescita", async (req, res): Promise<void> => {
  const { category, tag, q, limit: lim, offset: off } = req.query as Record<string, string>;
  const limit  = Math.min(Number(lim) || 12, 50);
  const offset = Number(off) || 0;

  let query = db.select().from(growthArticlesTable)
    .where(eq(growthArticlesTable.status, "published")) as any;

  const conditions: any[] = [eq(growthArticlesTable.status, "published")];

  if (category) conditions.push(eq(growthArticlesTable.category, category));
  if (tag)      conditions.push(sql`${tag} = ANY(${growthArticlesTable.tags})`);
  if (q?.trim()) conditions.push(ilike(growthArticlesTable.title, `%${q.trim()}%`));

  const articles = await db
    .select()
    .from(growthArticlesTable)
    .where(and(...conditions))
    .orderBy(desc(growthArticlesTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(growthArticlesTable)
    .where(and(...conditions));

  res.json({ articles, total, limit, offset });
});

router.get("/crescita/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [article] = await db
    .select()
    .from(growthArticlesTable)
    .where(and(eq(growthArticlesTable.slug, slug), eq(growthArticlesTable.status, "published")));

  if (!article) { res.status(404).json({ error: "Articolo non trovato" }); return; }

  await db
    .update(growthArticlesTable)
    .set({ viewCount: sql`${growthArticlesTable.viewCount} + 1` })
    .where(eq(growthArticlesTable.id, article.id));

  const related = await db
    .select({ id: growthArticlesTable.id, title: growthArticlesTable.title, slug: growthArticlesTable.slug, category: growthArticlesTable.category, description: growthArticlesTable.description, readTimeMinutes: growthArticlesTable.readTimeMinutes, difficulty: growthArticlesTable.difficulty })
    .from(growthArticlesTable)
    .where(and(
      eq(growthArticlesTable.status, "published"),
      eq(growthArticlesTable.category, article.category),
      sql`${growthArticlesTable.id} != ${article.id}`
    ))
    .orderBy(desc(growthArticlesTable.updatedAt))
    .limit(3);

  res.json({ ...article, related });
});

router.post("/crescita/:id/salva", async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Accedi per salvare l'articolo" }); return; }

  const articleId = parseInt(req.params.id ?? "", 10);
  if (isNaN(articleId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select()
    .from(userFavoritesTable)
    .where(and(
      eq(userFavoritesTable.userId, user.id),
      eq(userFavoritesTable.type, "growth"),
      eq(userFavoritesTable.growthArticleId, articleId)
    ));

  if (existing) {
    await db.delete(userFavoritesTable).where(eq(userFavoritesTable.id, existing.id));
    res.json({ saved: false });
  } else {
    await db.insert(userFavoritesTable).values({
      userId: user.id,
      type: "growth",
      growthArticleId: articleId,
    });
    res.json({ saved: true });
  }
});

router.post("/crescita", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" }); return;
  }
  const { title, slug, category, description, content, tags, difficulty, personalityMatches, sectorLinks, status, readTimeMinutes } = req.body;
  if (!title || !slug || !category || !description || !content) {
    res.status(400).json({ error: "Campi obbligatori mancanti" }); return;
  }
  const [article] = await db.insert(growthArticlesTable).values({
    title, slug, category,
    description, content,
    tags: tags ?? [],
    difficulty: difficulty ?? "base",
    personalityMatches: personalityMatches ?? [],
    sectorLinks: sectorLinks ?? [],
    status: status ?? "published",
    readTimeMinutes: readTimeMinutes ?? 3,
  }).returning();
  res.status(201).json(article);
});

router.patch("/crescita/:id", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" }); return;
  }
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const allowed = ["title", "slug", "category", "subcategory", "description", "content", "tags", "difficulty", "personalityMatches", "sectorLinks", "status", "readTimeMinutes"];
  const updates: Record<string, any> = { updatedAt: new Date() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  const [article] = await db.update(growthArticlesTable).set(updates).where(eq(growthArticlesTable.id, id)).returning();
  if (!article) { res.status(404).json({ error: "Non trovato" }); return; }
  res.json(article);
});

export default router;
