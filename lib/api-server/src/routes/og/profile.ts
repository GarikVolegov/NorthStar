import { Router, Request, Response } from "express";
import { db } from "../../db";
import { usersTable, testSessionsTable } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export const ogProfileRouter = Router();

ogProfileRouter.get("/api/og/profile/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Fetch user data
    const [user] = await db
      .select({
        name: usersTable.name,
        isPublic: usersTable.isPublic,
        userMode: usersTable.userMode,
        journeyType: usersTable.journeyType,
        streakDays: usersTable.streakDays,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isPublic) {
      return res.status(403).json({ error: "Profile is private" });
    }

    // Fetch latest test session
    const [session] = await db
      .select({
        recommendations: testSessionsTable.recommendations,
        dominantSpirit: testSessionsTable.dominantSpirit,
        profileSummary: testSessionsTable.profileSummary,
      })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, userId))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(1);

    // Build SVG
    const name = user.name ?? "NorthStar User";
    const spirit = session?.dominantSpirit ?? "Explorer";
    const summary = (session?.profileSummary ?? "Trova il tuo percorso con NorthStar").slice(0, 120);
    const streak = user.streakDays ?? 0;
    const journeyType = user.journeyType ?? "";

    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A1628"/>
      <stop offset="100%" stop-color="#0D1F3C"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F5C842"/>
      <stop offset="100%" stop-color="#E8A800"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Gold accent bar -->
  <rect x="0" y="0" width="8" height="630" fill="url(#gold)"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#gold)"/>

  <!-- Star icon -->
  <text x="80" y="120" font-size="72" fill="#F5C842">★</text>

  <!-- NorthStar brand -->
  <text x="160" y="110" font-family="Georgia, serif" font-size="28" fill="#F5C842" font-weight="bold">NORTHSTAR</text>
  <text x="160" y="138" font-family="Arial, sans-serif" font-size="16" fill="#8BA3CC">Orientamento AI-Powered</text>

  <!-- Divider -->
  <line x1="80" y1="165" x2="1120" y2="165" stroke="#1E3A5F" stroke-width="1"/>

  <!-- User Name -->
  <text x="80" y="260" font-family="Georgia, serif" font-size="64" fill="#FFFFFF" font-weight="bold">${escapeXml(name)}</text>

  <!-- Dominant Spirit Badge -->
  <rect x="80" y="285" width="${Math.min(spirit.length * 18 + 40, 400)}" height="44" rx="22" fill="url(#gold)"/>
  <text x="100" y="313" font-family="Arial, sans-serif" font-size="20" fill="#0A1628" font-weight="bold">${escapeXml(spirit)}</text>

  <!-- Profile Summary -->
  <text x="80" y="380" font-family="Arial, sans-serif" font-size="22" fill="#C5D8F0">${escapeXml(summary)}</text>

  <!-- Stats row -->
  <rect x="80" y="430" width="220" height="80" rx="12" fill="#0D2040" stroke="#1E3A5F" stroke-width="1"/>
  <text x="190" y="465" font-family="Arial, sans-serif" font-size="13" fill="#8BA3CC" text-anchor="middle">STREAK</text>
  <text x="190" y="498" font-family="Georgia, serif" font-size="32" fill="#F5C842" text-anchor="middle" font-weight="bold">${streak}🔥</text>

  ${journeyType ? `<rect x="320" y="430" width="280" height="80" rx="12" fill="#0D2040" stroke="#1E3A5F" stroke-width="1"/>
  <text x="460" y="465" font-family="Arial, sans-serif" font-size="13" fill="#8BA3CC" text-anchor="middle">PERCORSO</text>
  <text x="460" y="498" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle" font-weight="bold">${escapeXml(journeyType)}</text>` : ""}

  <!-- Bottom CTA -->
  <text x="80" y="590" font-family="Arial, sans-serif" font-size="18" fill="#4A6FA5">northstar.app/profile/${escapeXml(userId)}</text>

  <!-- Bottom right logo repeat -->
  <text x="1100" y="590" font-family="Georgia, serif" font-size="18" fill="#F5C842" text-anchor="end" opacity="0.5">★ NorthStar</text>
</svg>`;

    // Attempt PNG conversion via sharp
    let imageBuffer: Buffer | null = null;
    let contentType = "image/svg+xml";

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require("sharp");
      imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      contentType = "image/png";
    } catch {
      // sharp not available — serve SVG as fallback
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

    return res.send(imageBuffer ?? svg);
  } catch (err) {
    console.error("[og/profile] error:", err);
    return res.status(500).json({ error: "Failed to generate OG image" });
  }
});

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
