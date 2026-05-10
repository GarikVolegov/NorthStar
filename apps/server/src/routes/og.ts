import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, sectorsTable } from "@workspace/db";

const router: IRouter = Router();

const SITE_URL = process.env.SITE_URL || "https://northstar.app";

const TREND_LABEL: Record<string, string> = {
  booming: "in forte crescita 🚀",
  growing: "in crescita",
  stable: "stabile",
  declining: "in rallentamento",
};

const RISK_LABEL: Record<string, string> = {
  low: "Basso rischio AI",
  medium: "Rischio AI medio",
  high: "Alto rischio AI",
};

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOgHtml(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  jsonLd: object;
  canonicalPath: string;
}): string {
  const { title, description, url, image, jsonLd, canonicalPath } = opts;
  const fullTitle = `${title} | NorthStar`;
  const esc = (s: string) => htmlEscape(s);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta name="robots" content="noindex, follow" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="NorthStar" />
  <meta property="og:title" content="${esc(fullTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(title)}" />
  <meta property="og:locale" content="it_IT" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <meta name="twitter:image:alt" content="${esc(title)}" />

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Redirect humans to the real page -->
  <meta http-equiv="refresh" content="0;url=${esc(canonicalPath)}" />

  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #f8f8f7; color: #1a1a1a; }
    .box { text-align: center; padding: 2rem; }
    .star { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #6b7280; font-size: 0.9rem; }
    a { color: #2a6049; }
  </style>
</head>
<body>
  <div class="box">
    <div class="star">⭐</div>
    <h1>${esc(title)}</h1>
    <p>Reindirizzamento in corso… <a href="${esc(canonicalPath)}">Clicca qui</a> se non vieni reindirizzato.</p>
  </div>
</body>
</html>`;
}

// GET /api/og/settore/:id — prerender HTML for social crawlers
router.get("/og/settore/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).send("ID settore non valido");
    return;
  }

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(eq(sectorsTable.id, id));

  if (!sector) {
    res.status(404).send("Settore non trovato");
    return;
  }

  const canonicalPath = `/settore/${sector.id}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const imageUrl = `${SITE_URL}/api/og-image/settore/${sector.id}`;

  const salaryMin = Math.round(sector.avgSalaryMin / 1000);
  const salaryMax = Math.round(sector.avgSalaryMax / 1000);
  const trend = TREND_LABEL[sector.trend] ?? sector.trend;
  const risk = RISK_LABEL[sector.automationRisk] ?? sector.automationRisk;

  const shortDesc = sector.description.slice(0, 120).replace(/\.$/, "");
  const description =
    `${shortDesc}. Stipendio €${salaryMin}k–${salaryMax}k/anno, crescita +${sector.growthRate}%, ${trend}, ${risk}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Occupation",
    "@id": canonicalUrl,
    name: sector.name,
    description: sector.description,
    occupationLocation: { "@type": "Country", name: "Italy" },
    estimatedSalary: {
      "@type": "MonetaryAmountDistribution",
      name: "Stipendio annuale (Italia)",
      currency: "EUR",
      duration: "P1Y",
      minValue: sector.avgSalaryMin,
      maxValue: sector.avgSalaryMax,
    },
    skills: sector.riasecTypes.join(", "),
    url: canonicalUrl,
  };

  const html = buildOgHtml({
    title: `${sector.name} — Settore professionale`,
    description,
    url: canonicalUrl,
    image: imageUrl,
    jsonLd,
    canonicalPath,
  });

  res
    .status(200)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Link: `<${canonicalUrl}>; rel="canonical"`,
    })
    .send(html);
});

// GET /api/og/settori — prerender HTML for /settori list page
router.get("/og/settori", (_req: Request, res: Response): void => {
  const canonicalPath = "/settori";
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  const html = buildOgHtml({
    title: "Esplora i 21 settori professionali",
    description:
      "Sfoglia tutti i settori professionali italiani. Filtra per tipo RIASEC, rischio AI e trend di mercato. Trova dove il tuo talento incontra un'opportunità reale.",
    url: canonicalUrl,
    image: `${SITE_URL}/opengraph.jpg`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Settori professionali — NorthStar",
      description: "21 settori professionali con dati aggiornati su stipendi, crescita e rischio AI.",
      url: canonicalUrl,
    },
    canonicalPath,
  });

  res
    .status(200)
    .set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" })
    .send(html);
});

// GET /api/og/news — prerender HTML for /news page
router.get("/og/news", (_req: Request, res: Response): void => {
  const canonicalPath = "/news";
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  const html = buildOgHtml({
    title: "News & Tendenze del mercato del lavoro",
    description:
      "Aggiornamenti su tecnologia, business, finanza, salute e formazione. Articoli selezionati per settore professionale e personalizzati sul tuo profilo.",
    url: canonicalUrl,
    image: `${SITE_URL}/opengraph.jpg`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "NewsMediaOrganization",
      name: "NorthStar News",
      url: canonicalUrl,
    },
    canonicalPath,
  });

  res
    .status(200)
    .set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=1800" })
    .send(html);
});

export default router;
