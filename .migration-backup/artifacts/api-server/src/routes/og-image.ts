import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, sectorsTable, usersTable, testSessionsTable } from "@workspace/db";
import { getInterFont } from "../lib/og-font";
import * as satoriModule from "satori";

// satori@0.26 exports a namespace that TS 5.9 cannot infer as callable.
// We resolve the function at runtime and use a plain hardcoded signature.
const satori = (
  (satoriModule as any).default ?? satoriModule
) as (element: any, options: any) => Promise<string>;

const router: IRouter = Router();

const SITE_URL = process.env.SITE_URL || "https://northstar.app";

const TREND_LABEL: Record<string, string> = {
  booming: "🚀 Booming",
  growing: "📈 In crescita",
  stable: "➡️ Stabile",
  declining: "📉 In calo",
};

const RISK_EMOJI: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

function clamp(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

async function generateSectorPng(sector: {
  name: string;
  description: string;
  trend: string;
  growthRate: number;
  automationRisk: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  riasecTypes: string[];
}): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const font = await getInterFont();

  const salaryMin = Math.round(sector.avgSalaryMin / 1000);
  const salaryMax = Math.round(sector.avgSalaryMax / 1000);
  const trend = TREND_LABEL[sector.trend] ?? sector.trend;
  const riskEmoji = RISK_EMOJI[sector.automationRisk] ?? "⚪";
  const desc = clamp(sector.description, 110);

  const element = {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column" as const,
        background: "linear-gradient(135deg, #0f2d1e 0%, #1a3d2b 50%, #0a2418 100%)",
        padding: "56px 64px",
        fontFamily: "Inter",
        position: "relative" as const,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "auto",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: 28, color: "#4ade80" },
                  children: "★",
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px" },
                  children: "NorthStar",
                },
              },
              {
                type: "div",
                props: {
                  style: { marginLeft: "8px", fontSize: 16, color: "rgba(255,255,255,0.35)" },
                  children: "· northstar.app",
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: sector.name.length > 20 ? 62 : 76,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1.05,
              marginTop: "32px",
              marginBottom: "20px",
            },
            children: sector.name,
          },
        },
        {
          type: "div",
          props: {
            style: { fontSize: 24, color: "rgba(255,255,255,0.65)", lineHeight: 1.4, marginBottom: "auto", maxWidth: 900 },
            children: desc,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", gap: "16px", marginTop: "48px", alignItems: "center" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    background: "rgba(74,222,128,0.15)",
                    border: "1.5px solid rgba(74,222,128,0.4)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "2px",
                  },
                  children: [
                    { type: "div", props: { style: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "1px" }, children: "STIPENDIO" } },
                    { type: "div", props: { style: { fontSize: 20, fontWeight: 700, color: "#4ade80" }, children: `€${salaryMin}k – €${salaryMax}k` } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "2px",
                  },
                  children: [
                    { type: "div", props: { style: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "1px" }, children: "CRESCITA" } },
                    { type: "div", props: { style: { fontSize: 20, fontWeight: 700, color: "#ffffff" }, children: `+${sector.growthRate}% / anno` } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "2px",
                  },
                  children: [
                    { type: "div", props: { style: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "1px" }, children: "TREND" } },
                    { type: "div", props: { style: { fontSize: 20, fontWeight: 700, color: "#ffffff" }, children: trend } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "2px",
                  },
                  children: [
                    { type: "div", props: { style: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "1px" }, children: "RISCHIO AI" } },
                    { type: "div", props: { style: { fontSize: 20, fontWeight: 700, color: "#ffffff" }, children: `${riskEmoji} ${sector.automationRisk === "low" ? "Basso" : sector.automationRisk === "medium" ? "Medio" : "Alto"}` } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Inter",
        data: font,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

const cache = new Map<number, { png: Buffer; ts: number }>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

router.get("/og-image/settore/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).send("ID non valido");
    return;
  }

  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res
      .set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=43200, s-maxage=86400",
        "X-Cache": "HIT",
      })
      .send(cached.png);
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

  try {
    const png = await generateSectorPng(sector);
    cache.set(id, { png, ts: Date.now() });

    res
      .set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=43200, s-maxage=86400",
        "X-Cache": "MISS",
      })
      .send(png);
  } catch (err) {
    console.error("OG image generation failed:", err);
    res.redirect(`${SITE_URL}/opengraph.jpg`);
  }
});

// Profile card SVG endpoint
router.get("/og/profile-card/:userId", async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).send("Invalid userId"); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isPublic) { res.status(404).send("Non trovato o profilo privato"); return; }

  let testSession = null;
  if (user.testSessionId) {
    const [ts] = await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, user.testSessionId));
    testSession = ts;
  }

  const riasecTypes = (testSession?.primaryTypes as string[]) ?? [];
  const dominantSpirit = testSession?.dominantSpirit ?? "";

  let sectorName = "Non ancora scelto";
  if (testSession?.confirmedSectorId) {
    const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, testSession.confirmedSectorId));
    sectorName = sector?.name ?? "N/D";
  }

  const riasecColors: Record<string, string> = {
    R: "#f97316", I: "#3b82f6", A: "#a855f7", S: "#22c55e", E: "#eab308", C: "#06b6d4"
  };
  const riasecLabels: Record<string, string> = {
    R: "Realistico", I: "Investigativo", A: "Artistico", S: "Sociale", E: "Imprenditoriale", C: "Convenzionale"
  };
  const spiritEmoji: Record<string, string> = {
    shen: "✨", hun: "🌙", po: "⚡", yi: "🔮", zhi: "🔥"
  };

  const typesBadges = riasecTypes.slice(0, 3).map((t, i) => {
    const x = 40 + i * 130;
    return `
      <rect x="${x}" y="180" width="110" height="36" rx="18" fill="${riasecColors[t] ?? "#6366f1"}22" stroke="${riasecColors[t] ?? "#6366f1"}" stroke-width="1.5"/>
      <text x="${x + 55}" y="203" font-family="system-ui" font-size="13" font-weight="600" fill="${riasecColors[t] ?? "#6366f1"}" text-anchor="middle">${t} · ${riasecLabels[t] ?? t}</text>
    `;
  }).join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="315" viewBox="0 0 600 315" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1a2744"/>
    </linearGradient>
  </defs>
  <rect width="600" height="315" fill="url(#bg)" rx="16"/>
  <rect x="0" y="0" width="600" height="4" fill="#4f46e5" rx="2"/>
  <text x="40" y="50" font-family="system-ui" font-size="13" font-weight="700" fill="#818cf8" letter-spacing="3">NORTHSTAR</text>
  <text x="40" y="75" font-family="system-ui" font-size="22" font-weight="700" fill="#f8fafc">Il tuo profilo professionale</text>
  <text x="40" y="130" font-family="system-ui" font-size="32" font-weight="800" fill="#f8fafc">${clamp(user.name, 24)}</text>
  <text x="40" y="162" font-family="system-ui" font-size="15" fill="#94a3b8">🎯 ${sectorName}</text>
  ${typesBadges}
  ${dominantSpirit ? `<text x="40" y="250" font-family="system-ui" font-size="14" fill="#a78bfa">${spiritEmoji[dominantSpirit] ?? "✨"} Spirito dominante: ${dominantSpirit.charAt(0).toUpperCase() + dominantSpirit.slice(1)}</text>` : ""}
  <text x="40" y="290" font-family="system-ui" font-size="11" fill="#475569">orientamento.northstar.it · Scopri il tuo percorso professionale</text>
  <circle cx="560" cy="275" r="24" fill="#4f46e5" opacity="0.3"/>
  <text x="560" y="282" font-family="system-ui" font-size="20" text-anchor="middle">⭐</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

export default router;
