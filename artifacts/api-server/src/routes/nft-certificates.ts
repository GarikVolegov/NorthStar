/**
 * NFT Certificate System — NorthStar
 * Mints cryptographically-signed achievement certificates when users complete objectives.
 * Each certificate has a unique SHA-256 hash and a generated PNG image (satori + resvg-js).
 * The hash can be independently verified via GET /api/nft-certificates/verify/:hash.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { nftCertificatesTable, userObjectivesTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";
import { getInterFont } from "../lib/og-font.js";
import * as satoriModule from "satori";

const satori = (
  (satoriModule as any).default ?? satoriModule
) as (element: any, options: any) => Promise<string>;

const router: IRouter = Router();

const HASH_SECRET = process.env.JWT_SECRET ?? "northstar-nft-secret-2025";

const CATEGORY_LABELS: Record<string, string> = {
  carriera: "Carriera",
  formazione: "Formazione",
  salute: "Salute & Benessere",
  finanza: "Finanza",
  relazioni: "Relazioni",
  progetto: "Progetto",
  abitudine: "Abitudine",
  altro: "Traguardo",
};

const CATEGORY_COLORS: Record<string, { bg: string; accent: string; badge: string }> = {
  carriera:   { bg: "#08192e", accent: "#D4AF37", badge: "#1a2d4a" },
  formazione: { bg: "#0d1a2e", accent: "#60a5fa", badge: "#162035" },
  salute:     { bg: "#0a1f1a", accent: "#34d399", badge: "#0f2820" },
  finanza:    { bg: "#1a150a", accent: "#fbbf24", badge: "#2d2110" },
  relazioni:  { bg: "#1a0f1a", accent: "#c084fc", badge: "#2a1530" },
  progetto:   { bg: "#0f1a2e", accent: "#f472b6", badge: "#1f1535" },
  abitudine:  { bg: "#0a1a1a", accent: "#2dd4bf", badge: "#102525" },
  altro:      { bg: "#08192e", accent: "#D4AF37", badge: "#1a2d4a" },
};

function generateHash(userId: number, objectiveId: number, mintedAt: Date): string {
  const payload = `${userId}:${objectiveId}:${mintedAt.getTime()}:${HASH_SECRET}`;
  return createHash("sha256").update(payload).digest("hex");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

async function generateCertificateImage(cert: {
  userName: string;
  objectiveText: string;
  category: string;
  certificateHash: string;
  mintedAt: Date;
}): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const font = await getInterFont();

  const colors = CATEGORY_COLORS[cert.category] ?? CATEGORY_COLORS.altro;
  const label = CATEGORY_LABELS[cert.category] ?? "Traguardo";
  const shortHash = cert.certificateHash.slice(0, 16) + "…";
  const dateStr = formatDate(cert.mintedAt);
  const objText = cert.objectiveText.length > 80
    ? cert.objectiveText.slice(0, 79) + "…"
    : cert.objectiveText;

  const el = {
    type: "div",
    props: {
      style: {
        width: 1200, height: 630, display: "flex", flexDirection: "column" as const,
        background: colors.bg,
        fontFamily: "Inter",
        position: "relative" as const,
        overflow: "hidden",
      },
      children: [
        // Top border accent
        { type: "div", props: { style: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 6, background: colors.accent } } },

        // Star watermark
        { type: "div", props: { style: {
          position: "absolute" as const, right: -40, top: -40,
          fontSize: 340, color: "rgba(255,255,255,0.025)", fontWeight: 900,
          userSelect: "none" as const,
        }, children: "★" } },

        // Content
        { type: "div", props: {
          style: { display: "flex", flexDirection: "column" as const, padding: "52px 72px", flex: 1, gap: 0 },
          children: [
            // Header row
            { type: "div", props: {
              style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 },
              children: [
                { type: "div", props: {
                  style: { display: "flex", alignItems: "center", gap: 12 },
                  children: [
                    { type: "div", props: { style: { fontSize: 32, color: colors.accent }, children: "★" } },
                    { type: "div", props: { style: { fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }, children: "NorthStar" } },
                  ],
                }},
                { type: "div", props: {
                  style: {
                    background: colors.badge, border: `1.5px solid ${colors.accent}44`,
                    borderRadius: 100, padding: "8px 20px",
                    fontSize: 14, color: colors.accent, fontWeight: 700, letterSpacing: 1,
                  },
                  children: `CERTIFICATO NFT · ${label.toUpperCase()}`,
                }},
              ],
            }},

            // "Si certifica che" label
            { type: "div", props: {
              style: { fontSize: 16, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: 3, marginBottom: 12, textTransform: "uppercase" as const },
              children: "Si certifica che",
            }},

            // User name
            { type: "div", props: {
              style: { fontSize: 52, fontWeight: 800, color: "#ffffff", letterSpacing: -2, lineHeight: 1, marginBottom: 24 },
              children: cert.userName,
            }},

            // "ha completato con successo"
            { type: "div", props: {
              style: { fontSize: 18, color: "rgba(255,255,255,0.5)", marginBottom: 16 },
              children: "ha completato con successo l'obiettivo:",
            }},

            // Objective
            { type: "div", props: {
              style: {
                fontSize: objText.length > 55 ? 26 : 32, fontWeight: 700,
                color: colors.accent, letterSpacing: -0.5, lineHeight: 1.3,
                maxWidth: 860, marginBottom: "auto",
              },
              children: `"${objText}"`,
            }},

            // Footer
            { type: "div", props: {
              style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" },
              children: [
                // Date
                { type: "div", props: {
                  style: { display: "flex", flexDirection: "column" as const, gap: 4 },
                  children: [
                    { type: "div", props: { style: { fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const }, children: "Data certificazione" } },
                    { type: "div", props: { style: { fontSize: 18, color: "#ffffff", fontWeight: 600 }, children: dateStr } },
                  ],
                }},
                // Hash
                { type: "div", props: {
                  style: { display: "flex", flexDirection: "column" as const, gap: 4, alignItems: "flex-end" as const },
                  children: [
                    { type: "div", props: { style: { fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" as const }, children: "Certificate Hash" } },
                    { type: "div", props: { style: { fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }, children: shortHash } },
                  ],
                }},
              ],
            }},
          ],
        }},
      ],
    },
  };

  const svg = await satori(el, {
    width: 1200, height: 630,
    fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return Buffer.from(resvg.render().asPng());
}

/* ─── POST /api/nft-certificates/mint ─────────────────────────────────── */
router.post("/nft-certificates/mint", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const { objectiveId } = req.body as { objectiveId?: number };

  if (!objectiveId) { res.status(400).json({ error: "objectiveId richiesto" }); return; }

  // Fetch objective
  const [obj] = await db.select().from(userObjectivesTable).where(
    and(eq(userObjectivesTable.id, objectiveId), eq(userObjectivesTable.userId, userId))
  );
  if (!obj) { res.status(404).json({ error: "Obiettivo non trovato" }); return; }
  if (!obj.completed) { res.status(400).json({ error: "L'obiettivo non è ancora completato" }); return; }

  // Check duplicate
  const existing = await db.select({ id: nftCertificatesTable.id })
    .from(nftCertificatesTable)
    .where(and(
      eq(nftCertificatesTable.userId, userId),
      eq(nftCertificatesTable.objectiveId, objectiveId)
    ))
    .limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Certificato già emesso per questo obiettivo" }); return; }

  // Fetch user name
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  const mintedAt = new Date();
  const hash = generateHash(userId, objectiveId, mintedAt);
  const userName = user?.name ?? "Utente NorthStar";

  const [cert] = await db.insert(nftCertificatesTable).values({
    userId,
    objectiveId,
    objectiveText: obj.text,
    userName,
    category: obj.category,
    certificateHash: hash,
    metadata: {
      objectiveCategory: obj.category,
      completedAt: obj.completedAt?.toISOString() ?? mintedAt.toISOString(),
      mintedAt: mintedAt.toISOString(),
      chain: "northstar-chain",
      version: "1.0",
    },
    mintedAt,
  }).returning();

  res.status(201).json({ ok: true, certificate: cert });
});

/* ─── GET /api/nft-certificates/me ────────────────────────────────────── */
router.get("/nft-certificates/me", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const certs = await db.select().from(nftCertificatesTable)
    .where(eq(nftCertificatesTable.userId, userId))
    .orderBy(desc(nftCertificatesTable.mintedAt));
  res.json(certs);
});

/* ─── GET /api/nft-certificates/verify/:hash ───────────────────────────── */
router.get("/nft-certificates/verify/:hash", async (req, res): Promise<void> => {
  const { hash } = req.params;
  const [cert] = await db.select().from(nftCertificatesTable)
    .where(eq(nftCertificatesTable.certificateHash, hash));
  if (!cert) { res.status(404).json({ error: "Certificato non trovato o hash non valido" }); return; }
  res.json({
    valid: true,
    certificate: {
      id: cert.id,
      userName: cert.userName,
      objectiveText: cert.objectiveText,
      category: cert.category,
      certificateHash: cert.certificateHash,
      chain: cert.chain,
      mintedAt: cert.mintedAt,
      status: cert.status,
    },
  });
});

/* ─── GET /api/nft-certificates/image/:hash.png ─────────────────────────── */
router.get("/nft-certificates/image/:hash.png", async (req, res): Promise<void> => {
  const hash = req.params.hash;
  const [cert] = await db.select().from(nftCertificatesTable)
    .where(eq(nftCertificatesTable.certificateHash, hash));
  if (!cert) { res.status(404).send("Not found"); return; }

  try {
    const png = await generateCertificateImage({
      userName: cert.userName,
      objectiveText: cert.objectiveText,
      category: cert.category,
      certificateHash: cert.certificateHash,
      mintedAt: new Date(cert.mintedAt),
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
