import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, sectorsTable } from "@workspace/db";
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

export default router;
