import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { PROMPT_DEFAULTS, listPromptOverrides, setPrompt, deletePrompt } from "../lib/prompt-store.js";

const router: IRouter = Router();

function adminKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) { res.status(503).json({ error: "Admin non configurato." }); return; }
  if (req.headers["x-admin-key"] !== adminKey) { res.status(403).json({ error: "Accesso non autorizzato." }); return; }
  next();
}

router.use("/admin/prompts", adminKeyMiddleware);

router.get("/admin/prompts", async (_req, res): Promise<void> => {
  const overrides = await listPromptOverrides();
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.key, o]));

  const prompts = Object.entries(PROMPT_DEFAULTS).map(([key, def]) => ({
    key,
    label: def.label,
    description: def.description,
    placeholders: def.placeholders ?? [],
    defaultValue: def.value,
    currentValue: overrideMap[key]?.value ?? def.value,
    isOverridden: !!overrideMap[key],
    updatedAt: overrideMap[key]?.updated_at ?? null,
    updatedBy: overrideMap[key]?.updated_by ?? null,
  }));

  res.json(prompts);
});

router.get("/admin/prompts/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  if (!PROMPT_DEFAULTS[key]) { res.status(404).json({ error: "Chiave prompt non trovata" }); return; }

  const overrides = await listPromptOverrides();
  const override = overrides.find((o) => o.key === key);
  const def = PROMPT_DEFAULTS[key];

  res.json({
    key,
    label: def.label,
    description: def.description,
    placeholders: def.placeholders ?? [],
    defaultValue: def.value,
    currentValue: override?.value ?? def.value,
    isOverridden: !!override,
    updatedAt: override?.updated_at ?? null,
    updatedBy: override?.updated_by ?? null,
  });
});

router.put("/admin/prompts/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value?: string };

  if (!PROMPT_DEFAULTS[key]) { res.status(404).json({ error: "Chiave prompt non trovata" }); return; }
  if (typeof value !== "string" || !value.trim()) { res.status(400).json({ error: "value deve essere una stringa non vuota" }); return; }

  await setPrompt(key, value.trim(), "admin");
  res.json({ ok: true, key });
});

router.delete("/admin/prompts/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  if (!PROMPT_DEFAULTS[key]) { res.status(404).json({ error: "Chiave prompt non trovata" }); return; }

  await deletePrompt(key);
  res.json({ ok: true, key, restoredDefault: PROMPT_DEFAULTS[key].value });
});

export default router;
