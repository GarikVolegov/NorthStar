import { Router, type Request, type Response } from "express";
import { agentPromptVersionsTable, agentPromptsTable, db } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord } from "../../lib/type-guards";
import {
  DEFAULT_PROMPTS,
  ensurePromptRegistry,
  findDefaultPrompt,
  getDefaultPromptPayload,
  getNextPromptVersionNumber,
  getPromptPayload,
  getPromptVersions,
  persistenceFallback,
  renderPrompt,
  sampleVariables,
  validatePromptValue,
} from "./shared/prompts";

const router = Router();

router.get("/prompts", async (_req: Request, res: Response) => {
  try {
    const payload = [];
    for (const prompt of DEFAULT_PROMPTS) {
      payload.push(await getPromptPayload(prompt));
    }
    res.json(payload);
  } catch (err) {
    rootLogger.warn(
      { err },
      "[admin/prompts] returning default prompts after read failure",
    );
    res.json(DEFAULT_PROMPTS.map(getDefaultPromptPayload));
  }
});

router.get("/prompts/:key/versions", async (req: Request, res: Response) => {
  try {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const versions = await getPromptVersions(registry.id);
    res.json({
      promptKey: registry.key,
      activeVersionId: registry.activeVersionId,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        value: version.value,
        notes: version.notes,
        createdBy: version.createdBy,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        validation: validatePromptValue(
          version.value,
          registry.placeholders,
          registry.requiredPlaceholders,
        ),
      })),
    });
  } catch (err) {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    rootLogger.warn(
      { err, key: String(req.params.key ?? "") },
      "[admin/prompts/:key/versions] returning default virtual version after read failure",
    );
    res.json({
      promptKey: prompt.key,
      activeVersionId: null,
      ...persistenceFallback("prompt_versions_persistence_unavailable"),
      versions: [
        {
          id: 0,
          versionNumber: 1,
          status: "active",
          value: prompt.defaultValue,
          notes: "Versione default non persistita",
          createdBy: null,
          publishedAt: null,
          createdAt: null,
          updatedAt: null,
          validation: validatePromptValue(
            prompt.defaultValue,
            prompt.placeholders,
            prompt.requiredPlaceholders ?? [],
          ),
        },
      ],
    });
  }
});

router.post("/prompts/:key/draft", async (req: Request, res: Response) => {
  try {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    const body = asPlainRecord(getRequestBody(req));
    const value = typeof body.value === "string" ? body.value : "";
    const notes = typeof body.notes === "string" ? body.notes : null;
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }

    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    const now = new Date();
    const draft = await db.transaction(async (tx) => {
      const [existingDraft] = await tx
        .select()
        .from(agentPromptVersionsTable)
        .where(
          and(
            eq(agentPromptVersionsTable.promptId, registry.id),
            eq(agentPromptVersionsTable.status, "draft"),
          ),
        )
        .orderBy(desc(agentPromptVersionsTable.createdAt))
        .limit(1);

      if (existingDraft) {
        const [updated] = await tx
          .update(agentPromptVersionsTable)
          .set({
            value,
            notes,
            createdBy: req.user?.id ?? null,
            updatedAt: now,
          })
          .where(eq(agentPromptVersionsTable.id, existingDraft.id))
          .returning();
        if (!updated) {
          throw new Error(
            `Prompt draft update did not return a record for ${registry.key}`,
          );
        }
        return updated;
      }

      const [row] = await tx
        .select({
          next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
        })
        .from(agentPromptVersionsTable)
        .where(eq(agentPromptVersionsTable.promptId, registry.id));

      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: Number(row?.next) || 1,
          status: "draft",
          value,
          notes,
          createdBy: req.user?.id ?? null,
          updatedAt: now,
        })
        .returning();
      if (!created) {
        throw new Error(
          `Prompt draft insert did not return a record for ${registry.key}`,
        );
      }
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_draft_saved",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: draft.id,
        versionNumber: draft.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, draft, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/draft] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/publish", async (req: Request, res: Response) => {
  try {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [draft] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(
        and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "draft"),
        ),
      )
      .orderBy(desc(agentPromptVersionsTable.createdAt))
      .limit(1);
    if (!draft) {
      res.status(400).json({ error: "Nessuna bozza da pubblicare" });
      return;
    }
    const validation = validatePromptValue(
      draft.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({
        error: validation.errors[0] ?? "Prompt non valido",
        validation,
      });
      return;
    }

    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(
          and(
            eq(agentPromptVersionsTable.promptId, registry.id),
            eq(agentPromptVersionsTable.status, "active"),
          ),
        );
      const [published] = await tx
        .update(agentPromptVersionsTable)
        .set({
          status: "active",
          createdBy: req.user?.id ?? draft.createdBy ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(agentPromptVersionsTable.id, draft.id))
        .returning();
      if (!published) {
        throw new Error(
          `Prompt publish did not return a record for ${registry.key}`,
        );
      }
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: published.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return published;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_published",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/publish] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/rollback", async (req: Request, res: Response) => {
  try {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    const body = asPlainRecord(getRequestBody(req));
    const versionId = Number(body.versionId);
    if (!prompt || !Number.isFinite(versionId)) {
      res.status(400).json({ error: "Rollback non valido" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [source] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(
        and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.id, versionId),
        ),
      )
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Versione prompt non trovata" });
      return;
    }
    const validation = validatePromptValue(
      source.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({
        error: validation.errors[0] ?? "Versione non valida",
        validation,
      });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "rolled_back", updatedAt: now })
        .where(
          and(
            eq(agentPromptVersionsTable.promptId, registry.id),
            eq(agentPromptVersionsTable.status, "active"),
          ),
        );
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(
          and(
            eq(agentPromptVersionsTable.promptId, registry.id),
            eq(agentPromptVersionsTable.status, "draft"),
          ),
        );
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: source.value,
          notes: `Rollback da v${source.versionNumber}`,
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) {
        throw new Error(
          `Prompt rollback insert did not return a record for ${registry.key}`,
        );
      }
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_rollback",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        sourceVersionId: source.id,
        sourceVersionNumber: source.versionNumber,
        newVersionId: active.id,
        newVersionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/rollback] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/reset", async (req: Request, res: Response) => {
  try {
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      registry.defaultValue,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({
        error: validation.errors[0] ?? "Default non valido",
        validation,
      });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(eq(agentPromptVersionsTable.promptId, registry.id));
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: registry.defaultValue,
          notes: "Reset al default",
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) {
        throw new Error(
          `Prompt reset insert did not return a record for ${registry.key}`,
        );
      }
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_reset_default",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/reset] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/preview", async (req: Request, res: Response) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const value =
      typeof body.value === "string"
        ? body.value
        : (await getPromptPayload(prompt)).draftValue;
    const variables = sampleVariables(
      registry.placeholders,
      asPlainRecord(body.variables),
    );
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    res.json({
      ok: true,
      rendered: renderPrompt(value, variables),
      variables,
      validation,
    });
  } catch (err) {
    const body = asPlainRecord(getRequestBody(req));
    const prompt = findDefaultPrompt(String(req.params.key ?? ""));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    rootLogger.warn(
      { err, key: String(req.params.key ?? "") },
      "[admin/prompts/:key/preview] returning default preview after read failure",
    );
    const value =
      typeof body.value === "string" ? body.value : prompt.defaultValue;
    const variables = sampleVariables(
      prompt.placeholders,
      asPlainRecord(body.variables),
    );
    const validation = validatePromptValue(
      value,
      prompt.placeholders,
      prompt.requiredPlaceholders ?? [],
    );
    res.json({
      ok: true,
      ...persistenceFallback("prompt_preview_persistence_unavailable"),
      rendered: renderPrompt(value, variables),
      variables,
      validation,
    });
  }
});

export default router;
