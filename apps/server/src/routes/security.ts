import { Router, type Request, type Response } from "express";
import { resolve } from "path";
import { execSync } from "child_process";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { runSecurityAgent } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const router = Router();

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");

function getModifiedFiles(): string[] {
  try {
    const staged   = execSync("git diff --cached --name-only", { cwd: REPO_ROOT }).toString();
    const unstaged = execSync("git diff --name-only",          { cwd: REPO_ROOT }).toString();
    return [...new Set([...staged.split("\n"), ...unstaged.split("\n")])].filter(Boolean);
  } catch {
    return [];
  }
}

function resolveFiles(requested: string[] | undefined, autoDetect: boolean): string[] {
  if (requested && requested.length > 0) {
    return requested.map((f) => (f.startsWith("/") ? f : resolve(REPO_ROOT, f)));
  }
  if (autoDetect) {
    return getModifiedFiles().map((f) => resolve(REPO_ROOT, f));
  }
  return [];
}

/**
 * POST /api/security/scan
 *
 * Admin-only. Streams a security scan via SSE.
 *
 * Body:
 *   { files?: string[], autoDetect?: boolean, applyFixes?: boolean }
 *
 * Events (text/event-stream):
 *   data: {"type":"status","value":"..."}
 *   data: {"type":"finding","finding":{...}}
 *   data: {"type":"fix_applied","file":"...","title":"..."}
 *   data: {"type":"rules_updated"}
 *   data: {"type":"done","findings":[...],"totalFiles":N,"costUsd":0.001}
 *   data: {"type":"error","message":"..."}
 */
router.post("/scan", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { files, autoDetect = true, applyFixes = false } = req.body as {
    files?:       string[];
    autoDetect?:  boolean;
    applyFixes?:  boolean;
  };

  const userId      = req.user!.id;
  const resolvedFiles = resolveFiles(files, autoDetect);

  if (resolvedFiles.length === 0) {
    res.status(400).json({ error: "Nessun file specificato. Usa 'files' o 'autoDetect: true'." });
    return;
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  rootLogger.info({ userId, files: resolvedFiles.length, applyFixes }, "security-scan: started");

  try {
    for await (const event of runSecurityAgent({
      files:      resolvedFiles,
      applyFixes,
      userId,
      repoRoot:   REPO_ROOT,
    })) {
      send(event);
      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootLogger.error({ err, userId }, "security-scan: unhandled error");
    send({ type: "error", message });
  } finally {
    res.end();
  }
});

/**
 * GET /api/security/status
 *
 * Admin-only. Returns a quick summary of the last scan from SECURITY_RULES.md.
 */
router.get("/status", requireAuth, requireAdmin, (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Security agent disponibile. Usa POST /api/security/scan per avviare una scansione." });
});

export default router;
