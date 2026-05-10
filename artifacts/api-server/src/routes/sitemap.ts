import { Router, type IRouter } from "express";
import { db, sectorsTable } from "@workspace/db";

const router: IRouter = Router();

const BASE_URL = process.env.SITE_URL || "https://northstar.app";

const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/",                    priority: "1.0", changefreq: "weekly"  },
  { path: "/test",                priority: "0.9", changefreq: "monthly" },
  { path: "/news",                priority: "0.8", changefreq: "daily"   },
  { path: "/settori",             priority: "0.8", changefreq: "weekly"  },
  { path: "/premium",             priority: "0.8", changefreq: "monthly" },
  { path: "/confronta",           priority: "0.7", changefreq: "weekly"  },
  { path: "/come-funziona",       priority: "0.7", changefreq: "monthly" },
  { path: "/chi-siamo",           priority: "0.7", changefreq: "monthly" },
  { path: "/contatti",            priority: "0.5", changefreq: "monthly" },
  { path: "/sitemap",             priority: "0.3", changefreq: "monthly" },
  { path: "/privacy-policy",      priority: "0.4", changefreq: "yearly"  },
  { path: "/termini-di-servizio", priority: "0.4", changefreq: "yearly"  },
];

function xmlEscape(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

router.get("/robots.txt", (_req, res): void => {
  const sitemapUrl = `${BASE_URL}/api/sitemap.xml`;
  const content = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Pagine pubbliche e indicizzabili",
    "Allow: /test",
    "Allow: /news",
    "Allow: /settori",
    "Allow: /confronta",
    "Allow: /premium",
    "Allow: /come-funziona",
    "Allow: /chi-siamo",
    "Allow: /contatti",
    "Allow: /sitemap",
    "Allow: /privacy-policy",
    "Allow: /termini-di-servizio",
    "Allow: /settore/",
    "",
    "# Pagine private — non indicizzare",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /risultati/",
    "Disallow: /profilo",
    "Disallow: /registra",
    "Disallow: /reset-password",
    "Disallow: /wiki/",
    "Disallow: /roadmap/",
    "Disallow: /grafo/",
    "Disallow: /premium/successo",
    "",
    `# Sitemap`,
    `Sitemap: ${sitemapUrl}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(content);
});

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const sectors = await db
    .select({ id: sectorsTable.id })
    .from(sectorsTable)
    .orderBy(sectorsTable.id);

  const entries: string[] = [];

  for (const route of STATIC_ROUTES) {
    entries.push(urlEntry(`${BASE_URL}${route.path}`, today, route.changefreq, route.priority));
  }

  for (const sector of sectors) {
    entries.push(urlEntry(`${BASE_URL}/settore/${sector.id}`, today, "weekly",  "0.7"));
    entries.push(urlEntry(`${BASE_URL}/wiki/${sector.id}`,   today, "monthly", "0.6"));
    entries.push(urlEntry(`${BASE_URL}/roadmap/${sector.id}`,today, "monthly", "0.6"));
    entries.push(urlEntry(`${BASE_URL}/grafo/${sector.id}`,  today, "monthly", "0.5"));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
    ...entries,
    "</urlset>",
  ].join("\n");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
