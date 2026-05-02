import { Router } from "express";
import {
  getFreeNews,
  getSectorNews,
  getMultiCategoryNews,
  FREE_CATEGORIES,
  type FreeCategory,
} from "../lib/news";

const router = Router();

router.get("/news", async (req, res) => {
  const category = (req.query.category as string) || "general";
  const limit = Math.min(Number(req.query.limit) || 6, 20);
  const multi = req.query.multi === "true";

  if (multi) {
    const cats = (req.query.categories as string || "general,technology,business,science")
      .split(",")
      .filter((c) => FREE_CATEGORIES.includes(c as FreeCategory)) as FreeCategory[];
    const perCat = Math.min(Number(req.query.perCategory) || 2, 5);
    const news = await getMultiCategoryNews(cats, perCat);
    return res.json({ news, source: process.env.GNEWS_API_KEY ? "live" : "static" });
  }

  if (!FREE_CATEGORIES.includes(category as FreeCategory)) {
    return res.status(400).json({ error: "Categoria non valida" });
  }

  const news = await getFreeNews(category as FreeCategory, limit);
  return res.json({ news, source: process.env.GNEWS_API_KEY ? "live" : "static" });
});

router.get("/news/sector/:sector", async (req, res) => {
  const { sector } = req.params;
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const news = await getSectorNews(sector, limit);
  return res.json({ news, source: process.env.GNEWS_API_KEY ? "live" : "static" });
});

export default router;
