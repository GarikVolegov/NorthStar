/**
 * ai-image.ts — Image generation endpoint.
 *
 * POST /api/ai/image
 *
 * Genera immagini via OpenAI gpt-image-1.
 * Solo utenti Pro (checkFeatureAccess "image_generation").
 *
 * SECURITY: userId SEMPRE da req.user.id (JWT), mai dal body.
 */
import { Router } from "express";
import { z } from "zod";
import { rootLogger } from "../middleware/logger";
import { planMeets, getEffectivePlan } from "../middleware/check-feature";
import { generateImageBuffer } from "@workspace/ai-server/image";

const router = Router();

const ImageRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  size: z.enum(["1024x1024", "512x512", "256x256"]).optional().default("1024x1024"),
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;

  const currentPlan = await getEffectivePlan(userId);
  const isPremium = planMeets(currentPlan, "pro");
  if (!isPremium) {
    res.status(403).json({ error: "Image generation requires a Pro plan." });
    return;
  }

  const parsed = ImageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { prompt, size } = parsed.data;

  rootLogger.info({ userId, size }, "[ai/image] generation requested");

  try {
    const imageBuffer = await generateImageBuffer(prompt, size);
    const base64 = imageBuffer.toString("base64");
    res.json({ image: base64, mimeType: "image/png", size });
  } catch (err) {
    rootLogger.error({ err, userId }, "[ai/image] generation failed");
    res.status(500).json({ error: "Image generation failed. Please try again." });
  }
});

export default router;
